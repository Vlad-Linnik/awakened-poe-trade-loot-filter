// User edits of a loot filter, kept by the app and merged into any version of
// the filter (FilterBlade re-download, online filter update).
//
// The game always uses a copy "<filter>_APT.filter" = header + item rules + source filter with tier patches.
// Tiers are found by their FilterBlade/NeverSink tags (`$type->currency $tier->t1`),
// so edits survive economy updates of the filter.

import { parseFilter, parseLine, tokenize, stripComment, type FilterBlock, type ParsedFilter, type Visibility } from './filter-parser'
import { renderSection, renderRules, hostOfRule, onlineVersion, rulesHiding, withoutHiding, MANAGED_HEADER, type AptRule } from './apt-rules'
import { findBlock, fingerprint, isPositiveBaseType, listsBase, selectorOf, tierLadder, type BlockSelector } from './filter-edit'

export { findBlock, selectorOf, type BlockSelector }

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
  // `$type` of the tier list; null - the base type is removed only from `from`
  typeTag: string | null
  // with `typeTag`: the base type is removed from the tiers of the same tier list (see moveSources);
  // null (older versions): from every tier of this `$type`
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

export function patchForBlock (filter: ParsedFilter, edits: FilterEdits, block: FilterBlock): TierPatch | undefined {
  return edits.patches.find(p => findBlock(filter, p.selector)?.index === block.index)
}

// ---- moving items between tiers ----

// tiers the base type is taken from
export function moveSources (filter: ParsedFilter, move: TierMove, target: FilterBlock): FilterBlock[] {
  const from = move.from ? findBlock(filter, move.from) : null
  if (!move.typeTag) return from && from.index !== target.index ? [from] : []
  const sameType = filter.blocks.filter(b => b.tags.type === move.typeTag && b.index !== target.index)
  if (!move.from) return sameType
  // rules for special cases ("6 links", decorators…) keep the base type
  const fp = fingerprint(target)
  return sameType.filter(b => b.index === from?.index || (!b.continue && fingerprint(b) === fp))
}

// Move a base type to another tier. `current` is the filter the tiers belong to (the copy),
// `source` is the original one.
export function withMove (
  edits: FilterEdits, current: ParsedFilter, source: ParsedFilter,
  baseType: string, from: FilterBlock, to: FilterBlock, label: string
): FilterEdits {
  const move: TierMove = {
    id: newId(),
    baseType,
    typeTag: from.tags.type ?? null,
    from: selectorOf(from),
    to: selectorOf(to),
    label,
    createdAt: Date.now()
  }
  // older edits must not put it back to the tiers it is taken from, or drop from the new one
  const taken = new Set(moveSources(current, move, to).map(b => b.index))
  const patches = edits.patches.flatMap(p => {
    const block = findBlock(current, p.selector)
    if (!block || !(block.index === to.index || taken.has(block.index))) return [p]
    const patch = withoutBase(p, baseType, block.index !== to.index)
    if (patch === p) return [p]
    return isEmptyPatch(patch) ? [] : [patch]
  })
  // moved once more: only the last tier counts, but the item stays removed from the first one
  const moves = edits.moves.filter(m => !(m.baseType === baseType && m.typeTag === move.typeTag))
  const rules = withoutHiding(current, edits.rules, baseType, from)

  const target = findBlock(source, move.to)
  const atHome = target != null && listsBase(target, baseType) &&
    !moveSources(source, move, target).some(b => listsBase(b, baseType))
  return { rules, patches, moves: atHome ? moves : [...moves, move] }
}

// Items typed into a tier: the ones listed by another tier of the same tier list are moved
export function splitAdded (current: ParsedFilter, block: FilterBlock, baseTypes: string[]) {
  const others = tierLadder(current, block).filter(b => b.index !== block.index)
  const moved: Array<{ baseType: string, from: FilterBlock }> = []
  const added: string[] = []
  for (const baseType of baseTypes) {
    const from = others.find(b => listsBase(b, baseType))
    if (from) moved.push({ baseType, from })
    else added.push(baseType)
  }
  return { moved, added }
}

function withoutBase (patch: TierPatch, baseType: string, dropAdded: boolean): TierPatch {
  const has = (list?: string[]) => list?.includes(baseType) ?? false
  if (!has(patch.removeBaseTypes) && !(dropAdded && has(patch.addBaseTypes))) return patch
  const without = (list?: string[]) => {
    const out = list?.filter(x => x !== baseType)
    return out?.length ? out : undefined
  }
  return {
    ...patch,
    removeBaseTypes: without(patch.removeBaseTypes),
    addBaseTypes: dropAdded ? without(patch.addBaseTypes) : patch.addBaseTypes
  }
}

export function isEmptyPatch (p: TierPatch) {
  return p.raw == null && !p.disabled && p.visibility == null &&
    !Object.keys(p.actions ?? {}).length && !Object.keys(p.conditions ?? {}).length &&
    !p.addBaseTypes?.length && !p.removeBaseTypes?.length
}

// In the first versions the × removed the item from its tier, so it was not hidden
// but got the style of the "Rest" tier.
export interface RemovedItem { patchId: string, baseType: string, block: FilterBlock }

export function removedItems (current: ParsedFilter, edits: FilterEdits): RemovedItem[] {
  const out: RemovedItem[] = []
  for (const p of edits.patches) {
    if (!p.removeBaseTypes?.length || p.raw != null || p.disabled) continue
    const block = findBlock(current, p.selector)
    if (!block) continue
    const ladder = tierLadder(current, block)
    for (const baseType of p.removeBaseTypes) {
      if (ladder.some(b => listsBase(b, baseType)) || rulesHiding(current, edits.rules, baseType, block).length) continue
      out.push({ patchId: p.id, baseType, block })
    }
  }
  return out
}

// put the items back to their tiers
export function withoutRemoved (edits: FilterEdits, items: RemovedItem[]): FilterEdits {
  return {
    ...edits,
    patches: edits.patches.flatMap(p => {
      const patch = items.filter(x => x.patchId === p.id)
        .reduce((acc, x) => withoutBase(acc, x.baseType, false), p)
      return patch !== p && isEmptyPatch(patch) ? [] : [patch]
    })
  }
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

  const patches: Array<{ patch: TierPatch, block: FilterBlock }> = []
  for (const patch of edits.patches) {
    const block = findBlock(filter, patch.selector)
    if (block) patches.push({ patch, block })
    else orphans.push(patch.id)
  }
  const replaced = new Set(patches.filter(p => p.patch.raw != null && !p.patch.disabled).map(p => p.block.index))

  // a replaced text goes first, so that it doesn't cancel the moves
  for (const { patch, block } of patches) {
    if (replaced.has(block.index)) addOp(block, lines => applyPatch(lines, patch))
  }
  // items are added before any is removed: a tier that gets an item is not empty
  const removals: Array<() => void> = []
  for (const move of edits.moves) {
    const target = findBlock(filter, move.to)
    if (!target) { orphans.push(move.id); continue }
    addOp(target, lines => addBaseType(lines, move.baseType))
    for (const b of moveSources(filter, move, target)) {
      if (replaced.has(b.index) || listsBase(b, move.baseType)) {
        removals.push(() => addOp(b, lines => removeBaseType(lines, move.baseType)))
      }
    }
  }
  removals.forEach(fn => fn())

  for (const { patch, block } of patches) {
    if (!replaced.has(block.index)) addOp(block, lines => applyPatch(lines, patch))
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

function baseTypeLine (lines: string[]) {
  for (let i = 1; i < lines.length; ++i) {
    const parsed = parseLine(lines[i])
    if (parsed && isPositiveBaseType(parsed)) return { index: i, parsed }
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

// Rules of tier items go right before the tier: more special rules above it
// (6 links, replicas, stacks…) still work. The others stay at the top of the filter.
function placeRules (text: string, rules: AptRule[]): { text: string, top: AptRule[] } {
  if (!rules.some(r => r.anchor)) return { text, top: rules }
  const filter = parseFilter(text)
  const top: AptRule[] = []
  const placed = new Map<number, AptRule[]>()
  for (const rule of rules) {
    const host = hostOfRule(filter, rule)
    if (host) placed.set(host.startLine, [...(placed.get(host.startLine) ?? []), rule])
    else top.push(rule)
  }
  const lines = [...filter.lines]
  for (const [line, list] of [...placed].sort((a, b) => b[0] - a[0])) {
    lines.splice(line, 0, ...renderRules(list))
  }
  return { text: lines.join(filter.eol), top }
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
  const { text: patched, orphans } = applyEdits(sourceText, edits)
  const { text, top } = placeRules(patched, edits.rules)
  const header = [
    `${MANAGED_HEADER} source=${ref} version=${onlineVersion(sourceText)}`,
    `# Copy of the filter "${source.name}" with your changes from Awakened PoE Trade.`,
    '# Generated automatically: edit the original filter (FilterBlade) or use the app, manual edits here will be lost.',
    ''
  ]
  return { text: [...header, ...renderSection(top), text].join(eol), orphans }
}
