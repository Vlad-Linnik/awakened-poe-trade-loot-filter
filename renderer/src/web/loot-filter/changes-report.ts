// Readable description of the user's edits: what is different in the APT copy
// compared to the source filter (FilterBlade / online). Used by the list of changes
// in the widget and by the downloadable report, so the changes can be repeated in FilterBlade.

import { parseLine, type FilterBlock, type ParsedFilter } from './filter-parser'
import { applyPatch, findBlock, moveSources, type FilterEdits, type FilterSource } from './edits'
import { hostOfRule, onlineVersion, type AptRule } from './apt-rules'
import { listsBase } from './filter-edit'
import { placeOf } from './fb-categories'
import { blockTierName } from './names'

type T = (key: string, args?: unknown[]) => string

export type ChangeKind = 'rule' | 'tier' | 'move'

export interface ChangeEntry {
  id: string
  kind: ChangeKind
  label: string
  // "Currency › Regular Currency › Tier 1" (FilterBlade's Customize page)
  where: string | null
  // FilterBlade category, for grouping
  group: string
  time: number
  orphan: boolean
  details: string[]
  // full text of the rule after the change (for tiers and APT rules)
  text: string | null
  // items of the changed tier (before and after the change), for the search
  items: string[]
}

const ACTION_LABELS: Record<string, string> = {
  SetFontSize: ':font_size',
  SetTextColor: ':text_color',
  SetBorderColor: ':border_color',
  SetBackgroundColor: ':bg_color',
  PlayAlertSound: ':sound',
  PlayAlertSoundPositional: ':sound',
  CustomAlertSound: ':sound',
  CustomAlertSoundOptional: ':sound',
  MinimapIcon: ':minimap',
  PlayEffect: ':beam'
}

export function describeChanges (source: ParsedFilter, edits: FilterEdits, t: T): ChangeEntry[] {
  const out: ChangeEntry[] = []
  const rulesGroup = t(':rep_group_rules')

  for (const rule of edits.rules) {
    out.push({
      id: rule.id,
      kind: 'rule',
      label: rule.label,
      where: whereOfRule(rule, source, t),
      group: rulesGroup,
      time: rule.createdAt,
      orphan: false,
      details: [
        t(':rep_rule_vis', [visName(rule.visibility, t)]),
        ...rule.conditions.map(c => `  ${c}`),
        ...(rule.actions.length ? [t(':rep_rule_style'), ...rule.actions.map(a => `  ${a}`)] : [])
      ],
      text: [`${rule.visibility} # ${rule.label}`, ...rule.conditions.map(c => `\t${c}`), ...rule.actions.map(a => `\t${a}`)].join('\n'),
      items: []
    })
  }

  for (const patch of edits.patches) {
    const block = findBlock(source, patch.selector)
    if (!block) {
      out.push({
        id: patch.id,
        kind: 'tier',
        label: patch.label,
        where: null,
        group: t(':rep_group_missing'),
        time: patch.updatedAt,
        orphan: true,
        details: [],
        text: patch.raw ?? null,
        items: [...(patch.addBaseTypes ?? []), ...(patch.removeBaseTypes ?? [])]
      })
      continue
    }
    const before = source.lines.slice(block.startLine, block.endLine)
    const after = applyPatch(before, patch)
    out.push({
      id: patch.id,
      kind: 'tier',
      label: patch.label,
      where: whereOf(block, t),
      group: placeOf(block).category.title,
      time: patch.updatedAt,
      orphan: false,
      details: after == null ? [t(':tier_disabled')] : diffBlock(before, after, t),
      text: after?.join('\n') ?? null,
      items: [...new Set([...(readBlock(before).baseTypes ?? []), ...(after ? readBlock(after).baseTypes ?? [] : [])])]
    })
  }

  for (const move of edits.moves) {
    const target = findBlock(source, move.to)
    const from = target
      ? moveSources(source, move, target).filter(b => listsBase(b, move.baseType))
      : []
    out.push({
      id: move.id,
      kind: 'move',
      label: move.label,
      where: target ? whereOf(target, t) : null,
      group: target ? placeOf(target).category.title : t(':rep_group_missing'),
      time: move.createdAt,
      orphan: !target,
      details: [
        t(':rep_item', [move.baseType]),
        ...from.map(b => t(':rep_move_from', [whereOf(b, t)])),
        ...(from.length ? [] : [t(':rep_move_from_none')]),
        ...(target ? [t(':rep_move_to', [whereOf(target, t)])] : [])
      ],
      text: null,
      items: [move.baseType]
    })
  }

  return out.sort((a, b) => b.time - a.time)
}

function whereOfRule (rule: AptRule, source: ParsedFilter, t: T) {
  const host = hostOfRule(source, rule)
  return host && whereOf(host, t)
}

function whereOf (block: FilterBlock, t: T) {
  const { category, sub } = placeOf(block)
  return [category.title, sub, blockTierName(block, t)].filter(Boolean).join(' › ') +
    ` (${t(':line', [block.startLine + 1])})`
}

function visName (v: string, t: T) {
  return v === 'Hide' ? t(':vis_hide') : t(':vis_show')
}

interface BlockLines {
  visibility: string
  // keyword -> lines of this keyword (without the keyword)
  lines: Map<string, string[]>
  baseTypes: string[] | null
}

function readBlock (lines: string[]): BlockLines {
  const visibility = /^\s*(Show|Hide|Minimal)\b/.exec(lines[0] ?? '')?.[1] ?? ''
  const map = new Map<string, string[]>()
  let baseTypes: string[] | null = null
  for (const raw of lines.slice(1)) {
    const parsed = parseLine(raw)
    if (!parsed) continue
    if (parsed.keyword === 'BaseType' && parsed.op !== '!' && parsed.op !== '!=' && !parsed.count && baseTypes == null) {
      baseTypes = parsed.values
      continue
    }
    const rest = raw.trim().slice(parsed.keyword.length).replace(/#.*$/, '').trim()
    map.set(parsed.keyword, [...(map.get(parsed.keyword) ?? []), rest])
  }
  return { visibility, lines: map, baseTypes }
}

function diffBlock (before: string[], after: string[], t: T): string[] {
  const a = readBlock(before)
  const b = readBlock(after)
  const out: string[] = []
  if (a.visibility !== b.visibility) {
    out.push(t(':rep_visibility', [a.visibility, b.visibility]))
  }
  const oldItems = new Set(a.baseTypes ?? [])
  const newItems = new Set(b.baseTypes ?? [])
  for (const bt of newItems) if (!oldItems.has(bt)) out.push(t(':rep_item_added', [bt]))
  for (const bt of oldItems) if (!newItems.has(bt)) out.push(t(':rep_item_removed', [bt]))

  const keywords = new Set([...a.lines.keys(), ...b.lines.keys()])
  for (const kw of keywords) {
    const oldV = (a.lines.get(kw) ?? []).join(' | ')
    const newV = (b.lines.get(kw) ?? []).join(' | ')
    if (oldV === newV) continue
    const name = ACTION_LABELS[kw] ? `${t(ACTION_LABELS[kw])} (${kw})` : kw
    if (!oldV) out.push(t(':rep_line_added', [name, newV || '✓']))
    else if (!b.lines.has(kw)) out.push(t(':rep_line_removed', [name, oldV]))
    else out.push(t(':rep_line_changed', [name, oldV, newV]))
  }
  return out.length ? out : [t(':rep_no_diff')]
}

// ---- search ----

export interface ChangeHit {
  entry: ChangeEntry
  // items of the tier that matched the query when the change itself does not mention it
  inTier: string[]
}

// Every word of the query must be found in the change (name, category, differences)
// or in one item of its tier: "the doctor", "currency шрифт", "chaos перенос".
export function searchChanges (entries: ChangeEntry[], query: string, t: T): ChangeHit[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return entries.map(entry => ({ entry, inTier: [] }))
  const out: ChangeHit[] = []
  for (const entry of entries) {
    const text = `${entry.label} ${badge(entry.kind, t)} ${entry.group} ${entry.where ?? ''} ${entry.details.join(' ')}`.toLowerCase()
    const missing = words.filter(w => !text.includes(w))
    if (!missing.length) {
      out.push({ entry, inTier: [] })
      continue
    }
    const inTier = entry.items.filter(item => {
      const name = item.toLowerCase()
      return missing.every(w => name.includes(w))
    })
    if (inTier.length) out.push({ entry, inTier })
  }
  return out
}

export function formatTime (time: number) {
  if (!time) return ''
  const d = new Date(time)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

// ---- downloadable report ----

export function renderReport (opts: {
  source: FilterSource
  sourceText: string
  entries: ChangeEntry[]
  t: T
}): string {
  const { source, sourceText, entries, t } = opts
  const fbVersion = /^#\s*VERSION:\s*(\S+)/m.exec(sourceText.slice(0, 3000))?.[1]
  const version = fbVersion ?? onlineVersion(sourceText)
  const lines: string[] = [
    t(':rep_title', [source.name]),
    source.kind === 'online'
      ? t(':rep_source_online', [source.name, source.id, version])
      : t(':rep_source_local', [source.name, version]),
    t(':rep_created', [formatTime(Date.now())]),
    t(':rep_total', [entries.length]),
    '',
    ...t(':rep_howto').split('\n'),
    ''
  ]

  // grouped by FilterBlade category, rules and missing tiers at the end
  const groups = new Map<string, ChangeEntry[]>()
  for (const e of entries) groups.set(e.group, [...(groups.get(e.group) ?? []), e])
  const order = [...groups.keys()].sort((x, y) => rank(x, t) - rank(y, t) || x.localeCompare(y))

  let n = 0
  for (const group of order) {
    lines.push(`==== ${group} ====`, '')
    for (const e of groups.get(group)!) {
      lines.push(`${++n}. [${badge(e.kind, t)}] ${e.label}`)
      if (e.where) lines.push(`   ${t(':rep_where', [e.where])}`)
      if (e.time) lines.push(`   ${t(':rep_changed_at', [formatTime(e.time)])}`)
      if (e.orphan) lines.push(`   ${t(':rep_orphan')}`)
      for (const d of e.details) lines.push(`   ${d}`)
      lines.push('')
    }
  }

  const withText = entries.filter(e => e.text)
  if (withText.length) {
    lines.push(`==== ${t(':rep_full_text')} ====`, '')
    for (const e of withText) {
      lines.push(`# ${e.label}${e.where ? ` — ${e.where}` : ''}`, e.text!, '')
    }
  }
  return lines.join('\r\n')
}

function rank (group: string, t: T) {
  if (group === t(':rep_group_missing')) return 2
  if (group === t(':rep_group_rules')) return 1
  return 0
}

export function badge (kind: ChangeKind, t: T) {
  return kind === 'rule' ? t(':badge_rule') : kind === 'tier' ? t(':badge_tier') : t(':badge_move')
}

export function reportFileName (source: FilterSource) {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  const name = source.name.replace(/[<>:"/\\|?*]/g, '').trim() || 'filter'
  return `${name} - APT changes ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}-${p(d.getMinutes())}.txt`
}
