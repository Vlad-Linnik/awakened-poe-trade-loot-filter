import type { FilterBlock, FilterLine, ParsedFilter } from './filter-parser'

export function isPositiveBaseType (c: Pick<FilterLine, 'keyword' | 'op'>) {
  return c.keyword === 'BaseType' && c.op !== '!' && c.op !== '!='
}

export function listsBase (block: FilterBlock, baseType: string): boolean {
  return block.conditions.some(c => isPositiveBaseType(c) && c.values.includes(baseType))
}

// all conditions but the BaseType list: what a tier applies to
export function fingerprint (block: FilterBlock) {
  return block.conditions
    .filter(c => c.keyword !== 'BaseType')
    .map(c => `${c.keyword}${c.op}${c.values.join(',')}`)
    .join('|')
}

// "`BaseType == \"X\"`" lists whole names, "`BaseType \"X\"`" - parts of names
export function isExactBaseType (c: Pick<FilterLine, 'keyword' | 'op'>) {
  return c.keyword === 'BaseType' && c.op === '=='
}

// one of my rules written into the filter by the app
export function ruleIdOfBlock (block: FilterBlock): string | null {
  return /\[apt:(\w+)\]/.exec(block.headerComment)?.[1] ?? null
}

// ---- block lookup ----

export interface BlockSelector {
  type?: string
  tier?: string
  header: string
  fingerprint: string
}

export function selectorOf (block: FilterBlock): BlockSelector {
  return {
    type: block.tags.type,
    tier: block.tags.tier,
    header: block.headerComment,
    fingerprint: fingerprint(block)
  }
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
  const sameFp = blocks.filter(b => fingerprint(b) === sel.fingerprint && ruleIdOfBlock(b) == null)
  return sameFp.length === 1 ? sameFp[0] : null
}

// ---- tier lists ----

// Blocks a base type can be moved to: FilterBlade/NeverSink tiers of the same `$type`
export function moveTargets (filter: ParsedFilter, from: FilterBlock): FilterBlock[] {
  return filter.blocks.filter(b => b.index !== from.index && isTierList(b) && sameGroup(b, from) && sameNaming(b, from))
}

// Tiers of one tier list: the same `$type` and the same conditions, they differ only by items.
// Exceptions of this `$type` ("6 links", "Sockets < 1", …) are not a part of it, nor is
// the hidden layer at the end that lists all items of the tiers once more.
// `block` itself may have no items (the "Rest" tier).
export function tierLadder (filter: ParsedFilter, block: FilterBlock): FilterBlock[] {
  if (block.continue || isHiddenLayer(block) || ruleIdOfBlock(block) != null) return []
  const fp = fingerprint(block)
  const ladder = filter.blocks.filter(b =>
    isTierList(b) && !b.continue && !isRestTier(b) && !isHiddenLayer(b) &&
    sameGroup(b, block) && sameNaming(b, block) && fingerprint(b) === fp)
  // nowhere to move
  return ladder.some(b => b.index !== block.index) ? ladder : []
}

// "Tier 3" -> "Tier 2"; null = there is nothing higher
export function higherTier (ladder: FilterBlock[], block: FilterBlock): FilterBlock | null {
  // the "Rest" tier holds unknown items, it is not lower than the others;
  // lists of parts of names are not ordered by value: "Medium" flasks, "Grand" flasks
  if (isRestTier(block) || block.conditions.some(c => isPositiveBaseType(c) && !isExactBaseType(c))) return null
  // an item raised must not disappear
  const shown = ladder.filter(b => b.index !== block.index && b.visibility !== 'Hide')

  // the same name with one number less: "t5r3" -> "t5r2", "weapont2q1" -> "weapont1q1"
  const tag = block.tags.tier ?? ''
  const siblings = shown
    .map(b => ({ block: b, lower: lowerNumber(tag, b.tags.tier ?? '') }))
    .filter((x): x is { block: FilterBlock, lower: number } => x.lower != null)
  if (siblings.length) return siblings.reduce((a, b) => b.lower > a.lower ? b : a).block
  const high = tag.endsWith('low') && shown.find(b => b.tags.tier === tag.replace(/low$/, 'high'))
  if (high) return high

  const numbered = shown.filter(b => tierNumber(b) != null)
  const own = tierNumber(block)
  const above = own != null
    ? numbered.filter(b => tierNumber(b)! < own)
    : numbered.filter(b => b.index < block.index)
  if (!above.length) return null
  const best = Math.max(...above.map(b => tierNumber(b)!))
  const candidates = above.filter(b => tierNumber(b) === best)
  // "t3" rather than its variations "t3boss", "t4c"
  const target = candidates.find(b => /^t\d+$/.test(b.tags.tier)) ?? candidates[candidates.length - 1]
  // a special tier that looks like this one is not lower
  const style = (b: FilterBlock) => b.actions.map(a => a.raw.trim()).join('|')
  return own == null && style(block) === style(target) ? null : target
}

// the number that is less in `other` while the rest of the tags is equal
function lowerNumber (tag: string, other: string): number | null {
  const a = tag.split(/(\d+)/)
  const b = other.split(/(\d+)/)
  if (a.length !== b.length) return null
  const diff = a.map((_, i) => i).filter(i => a[i] !== b[i])
  if (diff.length !== 1 || diff[0] % 2 === 0) return null
  const [x, y] = [Number(a[diff[0]]), Number(b[diff[0]])]
  return y < x ? y : null
}

// ---- scope ----

const RARITIES = ['Normal', 'Magic', 'Rare', 'Unique']

// rarities of items the rule applies to
export function raritiesOf (conditions: FilterLine[]): Set<string> {
  let out = RARITIES
  for (const c of conditions) {
    if (c.keyword !== 'Rarity') continue
    const order = c.values.map(v => RARITIES.indexOf(v))
    out = out.filter(r => {
      const i = RARITIES.indexOf(r)
      switch (c.op) {
        case '<': return i < order[0]
        case '<=': return i <= order[0]
        case '>': return i > order[0]
        case '>=': return i >= order[0]
        case '!':
        case '!=': return !order.includes(i)
        default: return order.includes(i)
      }
    })
  }
  return new Set(out)
}

function isTierList (block: FilterBlock) {
  // only "tier list" blocks, i.e. ones that already list base types
  return block.conditions.some(isPositiveBaseType) && ruleIdOfBlock(block) == null
}

// an item can't be moved from a list of names to a list of parts of names
function sameNaming (a: FilterBlock, b: FilterBlock) {
  const naming = (x: FilterBlock) => x.conditions.find(isPositiveBaseType)
  const [x, y] = [naming(a), naming(b)]
  return !x || !y || isExactBaseType(x) === isExactBaseType(y)
}

function isHiddenLayer (block: FilterBlock) {
  return block.tags.tier === 'exhide'
}

function isRestTier (block: FilterBlock) {
  return block.tags.tier === 'restex' || block.tags.tier === 'rest'
}

function sameGroup (a: FilterBlock, b: FilterBlock) {
  return b.tags.type
    ? a.tags.type === b.tags.type
    : !a.tags.type && b.section != null && a.section === b.section
}

function tierNumber (block: FilterBlock): number | null {
  const m = /^t(\d+)/.exec(block.tags.tier ?? '')
  return m ? Number(m[1]) : null
}
