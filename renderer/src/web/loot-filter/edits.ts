// User edits of a loot filter, kept by the app and merged into any version of
// the filter (FilterBlade re-download, online filter update).
//
// The game always uses a copy "<filter>_APT.filter" = header + item rules + source filter with tier patches.
// Tiers are found by their FilterBlade/NeverSink tags (`$type->currency $tier->t1`),
// so edits survive economy updates of the filter.

import { parseFilter, parseLine, tokenize, stripComment, type FilterBlock, type ParsedFilter, type Visibility } from './filter-parser'
import { renderSection, onlineVersion, MANAGED_HEADER, type AptRule } from './apt-rules'

export interface BlockSelector {
  type?: string
  tier?: string
  header: string
  fingerprint: string
}

export interface TierPatch {
  id: string
  selector: BlockSelector
  label: string
  visibility?: Visibility
  disabled?: boolean
  // keyword -> full line (without indent), null = remove the line
  actions?: Record<string, string | null>
  conditions?: Record<string, string | null>
  // items added to / removed from the tier's BaseType list
  addBaseTypes?: string[]
  removeBaseTypes?: string[]
  // replaces the whole block text
  raw?: string
  updatedAt: number
}

export interface TierMove {
  id: string
  baseType: string
  // remove the base type from every tier of this `$type`; when null - only from `from`
  typeTag: string | null
  from: BlockSelector | null
  to: BlockSelector
  label: string
  createdAt: number
}

export interface FilterEdits {
  rules: AptRule[]
  patches: TierPatch[]
  moves: TierMove[]
}

export type EditsStore = Record<string, FilterEdits>

export interface FilterSource {
  kind: 'online' | 'local'
  id: string
  name: string
}

export function emptyEdits (): FilterEdits {
  return { rules: [], patches: [], moves: [] }
}

export function editsCount (e: FilterEdits) {
  return e.rules.length + e.patches.length + e.moves.length
}

export function normalizeStore (raw: unknown): EditsStore {
  const out: EditsStore = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      out[key] = { ...emptyEdits(), rules: value as AptRule[] }
    } else if (value && typeof value === 'object') {
      const v = value as Partial<FilterEdits>
      out[key] = { rules: v.rules ?? [], patches: v.patches ?? [], moves: v.moves ?? [] }
    }
  }
  return out
}

export function storeKey (source: FilterSource) {
  // online ids are kept as is (compatible with the first version of the store)
  return source.kind === 'online' ? source.id : `local:${source.id}`
}

export function newId () {
  return Math.random().toString(36).slice(2, 10)
}

// ---- block lookup ----

export function selectorOf (block: FilterBlock): BlockSelector {
  return {
    type: block.tags.type,
    tier: block.tags.tier,
    header: block.headerComment,
    fingerprint: fingerprint(block)
  }
}

function fingerprint (block: FilterBlock) {
  return block.conditions
    .filter(c => c.keyword !== 'BaseType')
    .map(c => `${c.keyword}${c.op}${c.values.join(',')}`)
    .join('|')
}

export function findBlock (filter: ParsedFilter, sel: BlockSelector): FilterBlock | null {
  const blocks = filter.blocks
  const exact = blocks.find(b => b.headerComment === sel.header && fingerprint(b) === sel.fingerprint)
  if (exact) return exact
  if (sel.type && sel.tier) {
    const sameTier = blocks.filter(b => b.tags.type === sel.type && b.tags.tier === sel.tier)
    if (sameTier.length === 1) return sameTier[0]
    if (sameTier.length > 1) return sameTier.find(b => fingerprint(b) === sel.fingerprint) ?? sameTier[0]
  }
  if (sel.header) {
    const sameHeader = blocks.find(b => b.headerComment === sel.header)
    if (sameHeader) return sameHeader
  }
  const sameFp = blocks.filter(b => fingerprint(b) === sel.fingerprint)
  return sameFp.length === 1 ? sameFp[0] : null
}

export function patchForBlock (filter: ParsedFilter, edits: FilterEdits, block: FilterBlock): TierPatch | undefined {
  return edits.patches.find(p => findBlock(filter, p.selector)?.index === block.index)
}

// ---- applying ----

type BlockOp = (lines: string[]) => string[] | null

export function applyEdits (sourceText: string, edits: FilterEdits): { text: string, orphans: string[] } {
  const filter = parseFilter(sourceText)
  const ops = new Map<number, BlockOp[]>()
  const orphans: string[] = []
  const addOp = (block: FilterBlock, op: BlockOp) => {
    const list = ops.get(block.index) ?? []
    list.push(op)
    ops.set(block.index, list)
  }

  for (const move of edits.moves) {
    const target = findBlock(filter, move.to)
    if (!target) { orphans.push(move.id); continue }
    const sources = move.typeTag
      ? filter.blocks.filter(b => b.tags.type === move.typeTag && b.index !== target.index)
      : [move.from ? findBlock(filter, move.from) : null].filter((b): b is FilterBlock => b != null && b.index !== target.index)
    for (const b of sources) {
      if (b.conditions.some(c => isPositiveBaseType(c.keyword, c.op) && c.values.includes(move.baseType))) {
        addOp(b, lines => removeBaseType(lines, move.baseType))
      }
    }
    addOp(target, lines => addBaseType(lines, move.baseType))
  }

  for (const patch of edits.patches) {
    const block = findBlock(filter, patch.selector)
    if (!block) { orphans.push(patch.id); continue }
    addOp(block, lines => applyPatch(lines, patch))
  }

  const lines = [...filter.lines]
  const touched = filter.blocks.filter(b => ops.has(b.index)).sort((a, b) => b.startLine - a.startLine)
  for (const block of touched) {
    let blockLines: string[] | null = lines.slice(block.startLine, block.endLine)
    for (const op of ops.get(block.index)!) {
      if (blockLines == null) break
      blockLines = op(blockLines)
    }
    const original = lines.slice(block.startLine, block.endLine)
    const result = blockLines ?? original.map(l => `#APT-disabled# ${l}`)
    lines.splice(block.startLine, block.endLine - block.startLine, ...result)
  }
  return { text: lines.join(filter.eol), orphans }
}

// block lines after the patch; null = the block is disabled
export function applyPatch (lines: string[], patch: TierPatch): string[] | null {
  if (patch.disabled) return null
  if (patch.raw != null) {
    return patch.raw.split(/\r?\n/)
  }
  let out = [...lines]
  if (patch.visibility) {
    out[0] = out[0].replace(/^(\s*)(Show|Hide|Minimal)\b/, `$1${patch.visibility}`)
  }
  for (const [kw, line] of Object.entries(patch.conditions ?? {})) {
    out = setKeywordLine(out, kw, line, 'condition')
  }
  for (const bt of patch.addBaseTypes ?? []) {
    out = addBaseType(out, bt)
  }
  for (const bt of patch.removeBaseTypes ?? []) {
    const res = removeBaseType(out, bt)
    if (res == null) return null
    out = res
  }
  for (const [kw, line] of Object.entries(patch.actions ?? {})) {
    out = setKeywordLine(out, kw, line, 'action')
  }
  return out
}

function keywordIndex (lines: string[], keyword: string) {
  for (let i = 1; i < lines.length; ++i) {
    const tokens = tokenize(stripComment(lines[i]))
    if (tokens[0] === keyword) return i
  }
  return -1
}

function indentOf (lines: string[]) {
  return lines.slice(1).find(l => l.trim())?.match(/^\s*/)?.[0] || '\t'
}

function setKeywordLine (lines: string[], keyword: string, line: string | null, kind: 'condition' | 'action'): string[] {
  const out = [...lines]
  const idx = keywordIndex(out, keyword)
  const indent = indentOf(out)
  if (idx >= 0) {
    if (line == null) out.splice(idx, 1)
    else out[idx] = indent + line
  } else if (line != null) {
    if (kind === 'condition') {
      out.splice(1, 0, indent + line)
    } else {
      // before `Continue` if there is one
      const cont = keywordIndex(out, 'Continue')
      out.splice(cont >= 0 ? cont : out.length, 0, indent + line)
    }
  }
  return out
}

function isPositiveBaseType (keyword: string, op: string) {
  return keyword === 'BaseType' && op !== '!' && op !== '!='
}

function baseTypeLine (lines: string[]) {
  for (let i = 1; i < lines.length; ++i) {
    const parsed = parseLine(lines[i])
    if (parsed && isPositiveBaseType(parsed.keyword, parsed.op)) return { index: i, parsed }
  }
  return null
}

function renderBaseType (indent: string, op: string, values: string[]) {
  return `${indent}BaseType ${op ? `${op} ` : ''}${values.map(v => `"${v}"`).join(' ')}`
}

function removeBaseType (lines: string[], baseType: string): string[] | null {
  const found = baseTypeLine(lines)
  if (!found || !found.parsed.values.includes(baseType)) return lines
  const values = found.parsed.values.filter(v => v !== baseType)
  if (!values.length) return null // tier became empty: disable it
  const out = [...lines]
  out[found.index] = renderBaseType(lines[found.index].match(/^\s*/)![0], found.parsed.op, values)
  return out
}

function addBaseType (lines: string[], baseType: string): string[] {
  const found = baseTypeLine(lines)
  const out = [...lines]
  if (found) {
    if (found.parsed.values.includes(baseType)) return lines
    out[found.index] = renderBaseType(lines[found.index].match(/^\s*/)![0], found.parsed.op || '==', [...found.parsed.values, baseType])
  } else {
    out.splice(1, 0, `${indentOf(lines)}BaseType == "${baseType}"`)
  }
  return out
}

// ---- the copy used by the game ----

export function copyName (source: FilterSource) {
  // `/itemfilter <name>` fails for names with spaces
  const base = source.name.replace(/[<>:"/\\|?*]/g, '').trim().replace(/\s+/g, '_') || 'filter'
  return `${base}_APT`
}

export function copySourceVersion (copyText: string): string | null {
  return /^#APT-MANAGED-COPY .*\bversion=(\S+)/.exec(copyText.slice(0, 500))?.[1] ?? null
}

export function buildCopy (source: FilterSource, sourceText: string, edits: FilterEdits): { text: string, orphans: string[] } {
  const eol = sourceText.includes('\r\n') ? '\r\n' : '\n'
  const ref = source.kind === 'online' ? `online:${source.id}` : `local:${encodeURIComponent(source.id)}`
  const { text, orphans } = applyEdits(sourceText, edits)
  const header = [
    `${MANAGED_HEADER} source=${ref} version=${onlineVersion(sourceText)}`,
    `# Copy of the filter "${source.name}" with your changes from Awakened PoE Trade.`,
    '# Generated automatically: edit the original filter (FilterBlade) or use the app, manual edits here will be lost.',
    ''
  ]
  return { text: [...header, ...renderSection(edits.rules), text].join(eol), orphans }
}
