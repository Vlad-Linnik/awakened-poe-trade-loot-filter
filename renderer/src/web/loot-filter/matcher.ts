import type { FilterBlock, FilterLine, ParsedFilter } from './filter-parser'
import type { FilterItem } from './item-props'

// true / false / null = can't tell from the copied item text
export type Tri = boolean | null

export interface BlockEval {
  block: FilterBlock
  result: Tri
  unknown: FilterLine[]
}

export interface MatchResult {
  // block that decides visibility & style (null = no rule matched, item is shown with default style)
  final: BlockEval | null
  // `Continue` blocks that matched before `final`
  continued: BlockEval[]
  // blocks before `final` that MIGHT match (conditions unknown)
  uncertain: BlockEval[]
}

const RARITY_ORDER: Record<string, number> = { Normal: 0, Magic: 1, Rare: 2, Unique: 3 }

export function matchItem (filter: ParsedFilter, item: FilterItem, opts?: {
  assumeMatch?: Set<number> // block indexes the user confirmed as matching
}): MatchResult {
  const continued: BlockEval[] = []
  const uncertain: BlockEval[] = []

  for (const block of filter.blocks) {
    const ev = evalBlock(block, item)
    if (ev.result === null && opts?.assumeMatch?.has(block.index)) {
      ev.result = true
    }
    if (ev.result === false) continue
    if (ev.result === null) {
      uncertain.push(ev)
      continue
    }
    if (block.continue) {
      continued.push(ev)
      continue
    }
    return { final: ev, continued, uncertain }
  }

  const last = continued.pop() ?? null
  return { final: last, continued, uncertain }
}

// Every rule this kind of item can end up in, whatever its stack size or the area level:
// conditions on those are treated as unknown. Stops at the first rule that always applies.
export function relatedBlocks (filter: ParsedFilter, item: FilterItem): BlockEval[] {
  const variant: FilterItem = { ...item, stackSize: undefined, areaLevel: undefined }
  const out: BlockEval[] = []
  for (const block of filter.blocks) {
    const ev = evalBlock(block, variant)
    if (ev.result === false) continue
    out.push(ev)
    if (ev.result === true && !block.continue) break
  }
  return out
}

export function evalBlock (block: FilterBlock, item: FilterItem): BlockEval {
  let result: Tri = true
  const unknown: FilterLine[] = []
  for (const cond of block.conditions) {
    const r = evalCondition(cond, item)
    if (r === false) return { block, result: false, unknown: [] }
    if (r === null) {
      result = null
      unknown.push(cond)
    }
  }
  return { block, result, unknown }
}

export function evalCondition (cond: FilterLine, item: FilterItem): Tri {
  const { keyword, op, values } = cond
  switch (keyword) {
    case 'Class':
      if (item.class == null) return null
      return item.classIsGuess
        ? guessedClassMatch(cond, item.class)
        : stringMatch(cond, [item.class])
    case 'BaseType':
      return stringMatch(cond, [item.baseType])
    case 'HasExplicitMod':
      if (item.explicitModNames == null) return null
      return stringMatch(cond, item.explicitModNames)
    case 'Rarity':
      return numberMatch(op, values.map(v => RARITY_ORDER[v] ?? -1), RARITY_ORDER[item.rarity])
    case 'ItemLevel':
      return optNumber(op, values, item.itemLevel)
    case 'AreaLevel':
      return optNumber(op, values, item.areaLevel)
    case 'Quality':
      return optNumber(op, values, item.quality)
    case 'StackSize':
      return optNumber(op, values, item.stackSize)
    case 'GemLevel':
      return optNumber(op, values, item.gemLevel)
    case 'MapTier':
      return optNumber(op, values, item.mapTier)
    case 'MemoryStrands':
      return optNumber(op, values, item.memoryStrands)
    case 'Sockets':
    case 'LinkedSockets':
    case 'SocketGroup':
      return socketMatch(cond, item.sockets)
    case 'Identified':
      return boolMatch(values, item.identified)
    case 'Corrupted':
      return boolMatch(values, item.corrupted)
    case 'Mirrored':
      return boolMatch(values, item.mirrored)
    case 'FracturedItem':
      return boolMatch(values, item.fractured)
    case 'SynthesisedItem':
      return boolMatch(values, item.synthesised)
    case 'ElderItem':
      return boolMatch(values, item.influences.includes('Elder'))
    case 'ShaperItem':
      return boolMatch(values, item.influences.includes('Shaper'))
    case 'Replica':
      return boolMatch(values, item.rarity === 'Unique' && item.name.startsWith('Replica '))
    case 'HasInfluence':
      return influenceMatch(op, values, item.influences)
    case 'Imbued':
      return boolMatch(values, item.imbued)
    case 'HasImplicitMod':
      return item.hasImplicit == null ? null : boolMatch(values, item.hasImplicit)
    case 'AnyEnchantment':
      return item.enchanted == null ? null : boolMatch(values, item.enchanted)
    case 'Width':
      return optNumber(op, values, item.width)
    case 'Height':
      return optNumber(op, values, item.height)
    case 'UnidentifiedItemTier':
      // only unidentified items have a tier
      return item.identified ? false : null
    case 'TransfiguredGem':
      return (item.gemLevel == null) ? !isTrue(values) : null
    case 'HasCruciblePassiveTree':
      // only weapons and shields can have a crucible tree
      return (item.class != null && !item.classIsGuess && !WEAPON_OR_SHIELD.test(item.class)) ? !isTrue(values) : null
    case 'BlightedMap':
    case 'UberBlightedMap':
    case 'ShapedMap':
    case 'ElderMap':
      return (item.mapTier == null && item.class != null && !/Map/i.test(item.class)) ? !isTrue(values) : null
    default:
      // DropLevel, Width, Height, HasImplicitMod, AnyEnchantment, BaseArmour, ...
      return null
  }
}

function stringMatch (cond: FilterLine, props: string[]): Tri {
  const exact = cond.op === '=='
  const negate = cond.op === '!=' || cond.op === '!'
  const matches = (value: string) => props.some(prop => exact
    ? prop === value
    : prop.toLowerCase().includes(value.toLowerCase()))

  if (cond.count) {
    const n = cond.values.filter(matches).length
    return compare(cond.count.op, n, cond.count.n)
  }
  const any = cond.values.some(matches)
  return negate ? !any : any
}

function guessedClassMatch (cond: FilterLine, guess: string): Tri {
  const negate = cond.op === '!=' || cond.op === '!'
  let sure = false
  let maybe = false
  for (const value of cond.values) {
    const v = value.toLowerCase()
    const g = guess.toLowerCase()
    if (v === g || (cond.op !== '==' && g.includes(v))) sure = true
    else if (v.includes(g)) maybe = true
  }
  if (sure) return !negate
  if (maybe) return null
  return negate
}

function optNumber (op: string, values: string[], prop: number | undefined): Tri {
  if (prop == null) return null
  const nums = values.map(Number)
  if (nums.some(Number.isNaN)) return null
  return numberMatch(op, nums, prop)
}

function numberMatch (op: string, values: number[], prop: number): Tri {
  if (!values.length) return null
  switch (op) {
    case '':
    case '=':
    case '==':
      return values.includes(prop)
    case '!':
    case '!=':
      return !values.includes(prop)
    default:
      return compare(op, prop, values[0])
  }
}

function compare (op: string, a: number, b: number): boolean {
  switch (op) {
    case '<': return a < b
    case '<=': return a <= b
    case '>': return a > b
    case '>=': return a >= b
    case '!':
    case '!=': return a !== b
    default: return a === b
  }
}

const WEAPON_OR_SHIELD = /Shield|Sword|Axe|Mace|Sceptre|Stave|Staff|Bow|Claw|Dagger|Wand|Warstave|Flail|Spear|Crossbow|Quarterstaff|Focus|Quiver/i

function isTrue (values: string[]) {
  return values[0]?.toLowerCase() !== 'false'
}

function boolMatch (values: string[], prop: boolean): Tri {
  const v = values[0]?.toLowerCase()
  if (v === 'true') return prop
  if (v === 'false') return !prop
  return null
}

function influenceMatch (op: string, values: string[], influences: string[]): Tri {
  if (values.length === 1 && values[0] === 'None') {
    return influences.length === 0
  }
  if (op === '==') {
    return values.every(v => influences.includes(v))
  }
  return values.some(v => influences.includes(v))
}

function socketMatch (cond: FilterLine, sockets: string | undefined): Tri {
  const groups = (sockets ?? '').split(' ').filter(Boolean).map(g => g.split('-'))
  const total = groups.reduce((sum, g) => sum + g.length, 0)
  const linked = groups.reduce((max, g) => Math.max(max, g.length), 0)

  const colorsOk = (letters: string, pool: string[]) => {
    const need: Record<string, number> = {}
    for (const ch of letters) need[ch] = (need[ch] ?? 0) + 1
    return Object.entries(need).every(([ch, n]) => pool.filter(s => s === ch).length >= n)
  }

  const results = cond.values.map((value): Tri => {
    const m = /^(\d*)([RGBWAD]*)$/i.exec(value)
    if (!m) return null
    const num = m[1] ? Number(m[1]) : null
    const letters = m[2].toUpperCase()
    const op = cond.op || '='

    if (cond.keyword === 'LinkedSockets') {
      return num == null ? null : compare(op, linked, num)
    }
    if (cond.keyword === 'Sockets') {
      if (num != null && !compare(op, total, num)) return false
      return colorsOk(letters, groups.flat())
    }
    // SocketGroup: some linked group satisfies both size & colors
    return groups.some(g =>
      (num == null || compare(op, g.length, num)) && colorsOk(letters, g))
  })

  if (results.includes(true)) return true
  if (results.includes(null)) return null
  return false
}
