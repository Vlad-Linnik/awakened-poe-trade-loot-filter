// My rule of an item stands before its tier, so more special rules above still work: stacks,
// replicas, 6 links… But some rules above are not about these items at all: "any item with
// 30% quality" would take a unique from its own rule. My rule is written once more right
// before such a rule, with the conditions of both: only for the items that rule would take.

import { hostOfRule, isActive, ruleConditions, ruleLines, type AptRule } from './apt-rules'
import { baseScope, filterBases, type BaseEntry } from './base-search'
import { findBlock, isExactBaseType, isPositiveBaseType, raritiesOf, ruleIdOfBlock } from './filter-edit'
import { blockTierLabel } from './fb-categories'
import { stripComment, type FilterBlock, type FilterLine, type ParsedFilter } from './filter-parser'
import { ItemCategory } from '@/parser'

const COPY = /\[apt:\w+\] over /

// my rule written once more before another one
export function isRuleCopy (block: FilterBlock): boolean {
  return COPY.test(block.headerComment)
}

// the rule itself in the filter
export function mainBlockOf (filter: ParsedFilter, block: FilterBlock): FilterBlock {
  if (!isRuleCopy(block)) return block
  const id = ruleIdOfBlock(block)
  return filter.blocks.find(b => ruleIdOfBlock(b) === id && !isRuleCopy(b)) ?? block
}

function basesOf (conditions: FilterLine[]): string[] {
  return conditions.filter(isPositiveBaseType).flatMap(c => c.values)
}

// ---- rules that are not about unique items, but take them ----

interface Generic { block: FilterBlock, scope: (base: BaseEntry) => boolean }

const genericCache = new WeakMap<ParsedFilter, Generic[]>()

function genericBlocks (filter: ParsedFilter): Generic[] {
  let list = genericCache.get(filter)
  if (!list) {
    list = filter.blocks
      .filter(b => !b.continue && ruleIdOfBlock(b) == null &&
        // the ones without tags are made by the user on FilterBlade
        b.tags.type != null && !b.tags.type.startsWith('uniques') &&
        !b.conditions.some(c => ['Rarity', 'Replica', 'Foulborn', 'StackSize'].includes(c.keyword)))
      .map(block => ({ block, scope: baseScope(block, new Set(), filter) }))
    genericCache.set(filter, list)
  }
  return list
}

// conditions that equipment never meets
function isForOthers (block: FilterBlock, base: BaseEntry): boolean {
  return block.conditions.some(c =>
    /^(Imbued|TransfiguredGem)$/.test(c.keyword) ||
    (/^(ZanaMemory|BlightedMap|UberBlightedMap)$/.test(c.keyword) && base.category !== ItemCategory.Map))
}

// `Corrupted True` and `Corrupted False`
function contradict (a: FilterLine[], b: FilterLine[]): boolean {
  const isFlag = (c: FilterLine) => c.values.length === 1 && /^(true|false)$/i.test(c.values[0])
  return a.some(x => isFlag(x) && b.some(y => y.keyword === x.keyword && isFlag(y) && y.values[0].toLowerCase() !== x.values[0].toLowerCase()))
}

// bases of the rule that the block lists (or doesn't care about)
function sharedBases (rule: FilterLine[], block: FilterBlock): string[] {
  const bases = basesOf(rule)
  const lists = block.conditions.filter(isPositiveBaseType)
  return bases.filter(base => lists.every(c => c.values.some(v => isExactBaseType(c) ? v === base : base.toLowerCase().includes(v.toLowerCase()))))
}

function autoOver (filter: ParsedFilter, rule: AptRule, host: FilterBlock): FilterBlock[] {
  const conditions = ruleConditions(rule)
  const rarities = raritiesOf(conditions)
  if (rule.visibility === 'Hide' || rarities.size !== 1 || !rarities.has('Unique')) return []
  const known = filterBases(filter)
  return genericBlocks(filter).filter(({ block, scope }) =>
    block.startLine < host.startLine && !contradict(conditions, block.conditions) &&
    sharedBases(conditions, block).some(name => {
      const base = known.get(name)
      return base != null && scope(base) && !isForOthers(block, base)
    })
  ).map(x => x.block)
}

// the rules that mine is raised above
export function blocksUnder (filter: ParsedFilter, rule: AptRule): FilterBlock[] {
  if (!isActive(rule) || rule.custom || !rule.anchor) return []
  const host = hostOfRule(filter, rule)
  if (!host) return []
  const chosen = (rule.over ?? []).map(sel => findBlock(filter, sel))
    .filter((b): b is FilterBlock => b != null && !b.isDisabled && b.startLine < host.startLine)
  return [...new Set([...chosen, ...autoOver(filter, rule, host)])]
}

export function copyLines (rule: AptRule, block: FilterBlock): string[] | null {
  const own = ruleConditions(rule)
  const bases = sharedBases(own, block)
  if (!bases.length) return null
  const exact = own.filter(isPositiveBaseType).every(isExactBaseType)
  const has = (keyword: string) => own.some(c => c.keyword === keyword)
  // the items are the ones of my rule; their class and rarity are known from it
  const added = block.conditions
    .filter(c => !isPositiveBaseType(c) && c.keyword !== 'Rarity' && !(c.keyword === 'Class' && has('Class')))
    .map(c => stripComment(c.raw).trim())
  const rarity = block.conditions.find(c => c.keyword === 'Rarity')
  const conditions = [
    ...own.filter(c => !isPositiveBaseType(c)).map(c => stripComment(c.raw).trim()),
    ...(rarity && !has('Rarity') ? [stripComment(rarity.raw).trim()] : []),
    ...added,
    `BaseType ${exact ? '== ' : ''}${bases.map(x => `"${x}"`).join(' ')}`
  ]
  const [header, ...rest] = ruleLines({ ...rule, conditions: [...new Set(conditions)] })
  return [`${header} over ${blockTierLabel(block)}`, ...rest, '']
}

// ---- the rule that doesn't work for an item ----

// my rule for the item that stands below the one that takes it
export function shadowedRule (filter: ParsedFilter, rules: AptRule[], by: FilterBlock, matches: (block: FilterBlock) => boolean): AptRule | null {
  const list = rules.filter(rule => {
    if (!isActive(rule) || rule.custom || !rule.anchor) return false
    const host = hostOfRule(filter, rule)
    const block = filter.blocks.find(b => ruleIdOfBlock(b) === rule.id && !isRuleCopy(b))
    return host != null && block != null && by.startLine < block.startLine && matches(block)
  })
  return list.pop() ?? null
}
