// User rules created in-game. They are stored by the app (not only in the
// .filter file), so they survive FilterBlade re-downloads and online filter updates,
// and are written at the top of the filter as a separate section.

import type { FilterBlock, ParsedFilter, Visibility } from './filter-parser'
import type { FilterItem } from './item-props'

export interface AptRule {
  id: string
  visibility: Visibility
  label: string
  conditions: string[] // `Class == "Divination Cards"`
  actions: string[] // style copied from another tier; empty = default style
  createdAt: number
}

export const SECTION_START = '#===APT-RULES-START==='
export const SECTION_END = '#===APT-RULES-END==='
export const MANAGED_HEADER = '#APT-MANAGED-COPY'

const STACKABLE_CLASSES = /Currency|Divination|Fragment|Gem|Scarab|Oil|Essence|Fossil|Resonator|Incubator|Splinter|Catalyst|Tattoo|Omen|Corpse|Rune|Stackable/i

export function itemConditions (item: FilterItem): string[] {
  const out: string[] = []
  if (item.class && !item.classIsGuess) {
    out.push(`Class == ${q(item.class)}`)
  }
  out.push(`BaseType == ${q(item.baseType)}`)
  if (!item.class || !STACKABLE_CLASSES.test(item.class)) {
    out.push(`Rarity == ${item.rarity}`)
  }
  return out
}

export function newRule (props: Omit<AptRule, 'id' | 'createdAt'>): AptRule {
  return {
    ...props,
    id: Math.random().toString(36).slice(2, 10),
    createdAt: Date.now()
  }
}

export function ruleForItem (item: FilterItem, visibility: Visibility, style?: FilterBlock, styleLabel?: string): AptRule {
  return newRule({
    visibility,
    label: styleLabel ? `${item.name} → ${styleLabel}` : item.name,
    conditions: itemConditions(item),
    actions: style ? style.actions.map(a => a.raw.trim()) : []
  })
}

// ---- rendering ----

export function renderSection (rules: AptRule[]): string[] {
  if (!rules.length) return []
  const lines = [
    `${SECTION_START} Rules added in-game with Awakened PoE Trade. They are stored in the app and re-applied automatically, edit them from the app.`,
    ''
  ]
  // newest rules first: the most recent decision wins
  for (const rule of [...rules].reverse()) {
    lines.push(`${rule.visibility} # APT: ${rule.label.replace(/[\r\n]/g, ' ')} [apt:${rule.id}]`)
    for (const c of rule.conditions) lines.push(`\t${c}`)
    for (const a of rule.actions) lines.push(`\t${a}`)
    lines.push('')
  }
  lines.push(SECTION_END, '')
  return lines
}

// version of a source filter: `#hash:` of online filters, content hash otherwise
export function onlineVersion (onlineText: string): string {
  const hash = /^#hash:(\S+)/m.exec(onlineText.slice(0, 2000))?.[1]
  if (hash) return hash
  let h = 0x811c9dc5
  for (let i = 0; i < onlineText.length; ++i) {
    h ^= onlineText.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return `fnv${h.toString(16)}`
}

// ---- lookup ----

export function ruleIdOfBlock (block: FilterBlock): string | null {
  return /\[apt:(\w+)\]/.exec(block.headerComment)?.[1] ?? null
}

export function isRuleBlock (filter: ParsedFilter, block: FilterBlock): boolean {
  if (ruleIdOfBlock(block) == null) return false
  const start = filter.lines.findIndex(l => l.startsWith(SECTION_START))
  const end = filter.lines.findIndex(l => l.startsWith(SECTION_END))
  return start >= 0 && block.startLine > start && block.startLine < end
}

function q (value: string) {
  return `"${value}"`
}
