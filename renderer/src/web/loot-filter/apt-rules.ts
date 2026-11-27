// User rules created in-game. They are stored by the app (not only in the
// .filter file), so they survive FilterBlade re-downloads and online filter updates,
// and are written before the tier they were made from or at the top of the filter.

import { parseFilter, parseLine, stripComment, type FilterBlock, type FilterLine, type ParsedFilter, type Visibility } from './filter-parser'
import {
  findBlock, isExactBaseType, isPositiveBaseType, listsBase, raritiesOf, ruleIdOfBlock, selectorOf, tierLadder,
  type BlockSelector
} from './filter-edit'
import type { FilterItem } from './item-props'

export { ruleIdOfBlock }

export interface AptRule {
  id: string
  visibility: Visibility
  label: string
  conditions: string[] // `Class == "Divination Cards"`
  actions: string[] // style copied from another tier; empty = default style
  createdAt: number
  // the tier the rule was made from: it stands right before it; without it - at the top of the filter
  anchor?: BlockSelector
  // made from scratch by the user ("Highlight specific bases"), not for an item of the filter
  custom?: boolean
  // kept by the app, but not written to the filter
  disabled?: boolean
  // the rules of the filter it was raised above (see rule-priority)
  over?: BlockSelector[]
  // the category a custom rule belongs to
  scope?: string
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
    // the ordinary item of this base is another item
    if (item.foulborn) out.push('Foulborn True')
    if (item.rarity === 'Unique' && item.name.startsWith('Replica ')) out.push('Replica True')
  }
  return out
}

// A hiding rule can hide only the small stacks: `StackSize < N`. Bigger stacks
// are not caught by it and get the style the filter gives them.
export function stackLimitOf (rule: AptRule): number | null {
  const c = ruleConditions(rule).find(c => c.keyword === 'StackSize' && c.op === '<')
  const n = c ? Number(c.values[0]) : NaN
  return Number.isInteger(n) ? n : null
}

// `limit`: stacks of this size and bigger are not hidden; null - all of them are
export function withStackLimit (rule: AptRule, limit: number | null): AptRule {
  const conditions = rule.conditions.filter(raw => {
    const c = parseLine(raw)
    return !(c?.keyword === 'StackSize' && c.op === '<')
  })
  if (limit != null && limit > 1) conditions.push(`StackSize < ${limit}`)
  return { ...rule, conditions }
}

// "Hide this item" rule of the item that hides only smaller stacks: it doesn't catch
// the item in hand when its stack is big enough, but must still be found for it
export function stackHideRuleOf (rules: AptRule[], item: FilterItem): AptRule | null {
  const own = itemConditions(item).join('\n')
  return rules.filter(r => !r.custom && r.visibility === 'Hide' && stackLimitOf(r) != null &&
    withStackLimit(r, null).conditions.join('\n') === own).pop() ?? null
}

// a rule without conditions would restyle everything
export function isActive (rule: AptRule): boolean {
  return !rule.disabled && rule.conditions.length > 0
}

export interface NewBase {
  ref: string
  // rarities of the items to highlight; empty - it has none (currency, cards…)
  rarities: string[]
}

// without a base starts disabled, as the user has to choose the items first
export function newCustomRule (label: string, base?: NewBase): AptRule {
  return newRule({
    visibility: 'Show',
    label,
    conditions: base
      ? [`BaseType == ${q(base.ref)}`, ...(base.rarities.length ? [`Rarity ${base.rarities.join(' ')}`] : [])]
      : ['Rarity Normal Magic Rare'],
    actions: ['SetFontSize 40', 'SetBorderColor 220 40 40 255', 'SetBackgroundColor 90 35 40 255'],
    custom: true,
    disabled: !base
  })
}

// base types of a custom rule that it can't show: they are hidden by rules standing above
export function hiddenAbove (rules: AptRule[], rule: AptRule): string[] {
  if (rule.disabled || rule.visibility === 'Hide') return []
  const rarities = raritiesOf(ruleConditions(rule))
  const hiding = rules.filter(r => !r.custom && !r.anchor && r.visibility === 'Hide' &&
    [...raritiesOf(ruleConditions(r))].some(x => rarities.has(x)))
  const hidden = new Set(hiding.flatMap(basesOf))
  return basesOf(rule).filter(x => hidden.has(x))
}

// my rule as a block of a filter: a disabled one is not in the filter itself
export function ruleBlock (rule: AptRule): FilterBlock {
  return parseFilter(ruleLines(rule).join('\n')).blocks[0]
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

// A rule for one base type of a tier. It has all the conditions of the tier and stands right before it,
// so it applies to the same items as the tier does.
// `isGear`: the item can be unique; uniques must not be caught by a tier without Rarity
export function ruleForBase (baseType: string, block: FilterBlock, opts: {
  visibility: Visibility
  isGear: boolean
}): AptRule {
  const list = block.conditions.find(c => isPositiveBaseType(c) && c.values.includes(baseType))
  const partial = list != null && !isExactBaseType(list)
  return newRule({
    visibility: opts.visibility,
    label: baseType,
    conditions: [
      ...block.conditions.filter(c => c.keyword !== 'BaseType').map(conditionText),
      ...(opts.isGear && !block.conditions.some(c => c.keyword === 'Rarity') ? ['Rarity <= Rare'] : []),
      `BaseType ${partial ? '' : '== '}${q(baseType)}`
    ],
    actions: opts.visibility === 'Hide' ? [] : block.actions.map(conditionText),
    anchor: selectorOf(block)
  })
}

// the item keeps the conditions of its tier, but looks like another one
export function withLook (rule: AptRule, look: FilterBlock): AptRule {
  const isHidden = look.visibility === 'Hide'
  return { ...rule, visibility: look.visibility, actions: isHidden ? [] : look.actions.map(conditionText) }
}

// the tier my rule stands before: its item could have been moved to another tier
export function hostOfRule (filter: ParsedFilter, rule: AptRule): FilterBlock | null {
  const anchor = rule.anchor && findBlock(filter, rule.anchor)
  if (!anchor || rule.custom) return anchor ?? null
  const ladder = tierLadder(filter, anchor)
  const hosts = ruleConditions(rule).filter(isPositiveBaseType).flatMap(c => c.values)
    .map(base => ladder.find(b => !b.isDisabled && listsBase(b, base)) ?? ladder.find(b => listsBase(b, base)) ?? anchor)
  return hosts.reduce((a, b) => b.startLine < a.startLine ? b : a, hosts[0] ?? anchor)
}

function conditionText (c: FilterLine) {
  return stripComment(c.raw).trim()
}

// my rules that work in this tier: made from one of its tier list, or (top of the filter)
// with the same rarities: "Rarity Unique" rules have nothing to do with the crafting bases
function rulesOfTier (filter: ParsedFilter, rules: AptRule[], block: FilterBlock): AptRule[] {
  const rarities = raritiesOf(block.conditions)
  const tiers = new Set([block.index, ...tierLadder(filter, block).map(b => b.index)])
  return rules.filter(rule => {
    // it has conditions of its own and is listed separately
    if (rule.custom) return false
    const anchor = rule.anchor && findBlock(filter, rule.anchor)
    if (anchor) return tiers.has(anchor.index)
    return [...raritiesOf(ruleConditions(rule))].some(r => rarities.has(r))
  })
}

function basesOf (rule: AptRule): string[] {
  return ruleConditions(rule).filter(isPositiveBaseType).flatMap(c => c.values)
}

function rulesFor (filter: ParsedFilter, rules: AptRule[], baseType: string, block: FilterBlock): AptRule[] {
  return rulesOfTier(filter, rules.filter(r => basesOf(r).includes(baseType)), block)
}

export function rulesHiding (filter: ParsedFilter, rules: AptRule[], baseType: string, block: FilterBlock): AptRule[] {
  return rulesFor(filter, rules, baseType, block).filter(r => r.visibility === 'Hide')
}

// what my rules do with the base types of a tier: the newest rule wins in the filter
export function ruleItems (filter: ParsedFilter, rules: AptRule[], block: FilterBlock): Map<string, 'hidden' | 'own'> {
  const out = new Map<string, 'hidden' | 'own'>()
  for (const rule of rulesOfTier(filter, rules, block)) {
    for (const name of basesOf(rule)) out.set(name, rule.visibility === 'Hide' ? 'hidden' : 'own')
  }
  return out
}

// the rules without those hiding the base type in this tier
export function withoutHiding (filter: ParsedFilter, rules: AptRule[], baseType: string, block: FilterBlock): AptRule[] {
  const hiding = new Set(rulesHiding(filter, rules, baseType, block))
  return rules.flatMap(rule => {
    if (!hiding.has(rule)) return [rule]
    const conditions = rule.conditions.map(raw => {
      const c = parseLine(raw)
      if (c?.keyword !== 'BaseType' || !c.values.includes(baseType)) return raw
      const rest = c.values.filter(v => v !== baseType)
      return rest.length ? `BaseType ${c.op}${c.op && ' '}${rest.map(q).join(' ')}` : null
    })
    return conditions.includes(null) ? [] : [{ ...rule, conditions: conditions as string[] }]
  })
}

// the own rule of a base type: the newest one wins in the filter
export function ownRuleOf (filter: ParsedFilter, rules: AptRule[], baseType: string, block: FilterBlock): AptRule | null {
  return rulesFor(filter, rules, baseType, block).filter(r => r.visibility !== 'Hide').pop() ?? null
}

export function ruleConditions (rule: AptRule): FilterLine[] {
  return rule.conditions.map(c => parseLine(c)).filter((c): c is FilterLine => c != null)
}

export function ruleLines (rule: AptRule): string[] {
  return [
    `${rule.visibility} # APT: ${rule.label.replace(/[\r\n]/g, ' ')} [apt:${rule.id}]`,
    ...rule.conditions.map(c => `\t${c}`),
    ...rule.actions.map(a => `\t${a}`)
  ]
}

// the rule with the text changed in the editor; null = it has nothing left to apply to
export function ruleFromLines (rule: AptRule, lines: string[] | null): AptRule | null {
  const block = lines && parseFilter(lines.join('\n')).blocks[0]
  if (!block || (!block.conditions.length && !rule.custom)) return null
  return {
    ...rule,
    visibility: block.visibility,
    conditions: block.conditions.map(conditionText),
    actions: [...block.actions.map(conditionText), ...(block.continue ? ['Continue'] : [])]
  }
}

// ---- rendering ----

export function renderSection (rules: AptRule[]): string[] {
  if (!rules.length) return []
  const lines = [
    `${SECTION_START} Rules added in-game with Awakened PoE Trade. They are stored in the app and re-applied automatically, edit them from the app.`,
    ''
  ]
  lines.push(...renderRules(rules), SECTION_END, '')
  return lines
}

export function renderRules (rules: AptRule[]): string[] {
  // newest rules first: the most recent decision wins; rules of items are above
  // the custom ones, which the user puts in order
  return [...rules.filter(r => !r.custom).reverse(), ...rules.filter(r => r.custom)]
    .flatMap(rule => [...ruleLines(rule), ''])
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

function q (value: string) {
  return `"${value}"`
}
