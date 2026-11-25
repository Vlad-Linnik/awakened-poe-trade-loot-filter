// Conditions of a rule: the catalog for the "Add condition" window (the same groups
// as on filterblade.xyz) and the rows of the editor. A row is one condition as the user
// sees it, e.g. "ItemLevel range 37-62" is two lines of the filter.

import { stripComment, type FilterBlock, type FilterLine, type ParsedFilter } from './filter-parser'
import { isPositiveBaseType, raritiesOf } from './filter-edit'

export type ConditionKind = 'number' | 'bool' | 'rarity' | 'list' | 'sockets' | 'text'

export interface ConditionDef {
  keyword: string
  kind: Exclude<ConditionKind, 'text'>
  // number: bounds of the slider (a larger value can be typed)
  min?: number
  max?: number
  // list: all the values there are
  options?: string[]
  // list: only names known by the filter, the game rejects the others
  strict?: boolean
  // "at least 2 of these"
  countable?: boolean
  // several conditions of one rule make sense, all of them must be met
  repeatable?: boolean
  // the line a new condition starts with
  initial: string
}

export interface ConditionGroup {
  id: string
  conditions: ConditionDef[]
}

const number = (keyword: string, min: number, max: number, initial: string): ConditionDef => ({ keyword, kind: 'number', min, max, initial })
const bool = (keyword: string): ConditionDef => ({ keyword, kind: 'bool', initial: 'True' })

export const CONDITION_GROUPS: ConditionGroup[] = [
  {
    id: 'basics',
    conditions: [
      { keyword: 'Rarity', kind: 'rarity', initial: 'Normal Magic Rare' },
      { keyword: 'Class', kind: 'list', strict: true, initial: '==' },
      number('ItemLevel', 1, 100, '>= 68'),
      number('AreaLevel', 1, 100, '>= 68'),
      number('DropLevel', 1, 100, '>= 60'),
      number('Quality', 0, 40, '>= 20'),
      number('StackSize', 1, 100, '>= 2'),
      number('GemLevel', 1, 21, '>= 19'),
      number('Width', 1, 2, '= 1'),
      number('Height', 1, 4, '= 1')
    ]
  },
  {
    id: 'defences',
    conditions: [
      number('BaseEnergyShield', 0, 600, '>= 1'),
      number('BaseEvasion', 0, 2000, '>= 1'),
      number('BaseArmour', 0, 2000, '>= 1'),
      number('BaseWard', 0, 600, '>= 1'),
      number('BaseDefencePercentile', 0, 100, '>= 90')
    ]
  },
  {
    id: 'flags',
    conditions: [
      'Corrupted', 'Mirrored', 'Identified', 'FracturedItem', 'SynthesisedItem', 'AnyEnchantment',
      'HasImplicitMod', 'Replica', 'Foulborn', 'Fated', 'Vestigial', 'Imbued', 'TransfiguredGem', 'ZanaMemory',
      'HasCruciblePassiveTree', 'Scourged'
    ].map(bool)
  },
  {
    id: 'maps',
    conditions: [number('MapTier', 1, 17, '>= 14'), bool('BlightedMap'), bool('UberBlightedMap')]
  },
  {
    id: 'sockets',
    conditions: [
      { keyword: 'Sockets', kind: 'sockets', initial: '>= 6' },
      number('LinkedSockets', 0, 6, '>= 5'),
      { keyword: 'SocketGroup', kind: 'sockets', initial: 'RGB' }
    ]
  },
  {
    id: 'mods',
    conditions: [
      { keyword: 'HasExplicitMod', kind: 'list', countable: true, repeatable: true, initial: '' },
      {
        keyword: 'HasInfluence',
        kind: 'list',
        options: ['Shaper', 'Elder', 'Crusader', 'Redeemer', 'Hunter', 'Warlord', 'None'],
        initial: 'Shaper Elder Crusader Redeemer Hunter Warlord'
      },
      number('HasSearingExarchImplicit', 0, 6, '>= 1'),
      number('HasEaterOfWorldsImplicit', 0, 6, '>= 1')
    ]
  },
  {
    id: 'other',
    conditions: [
      number('MemoryStrands', 0, 100, '>= 1'),
      number('UnidentifiedItemTier', 1, 5, '>= 3'),
      number('CorruptedMods', 0, 2, '>= 1'),
      { keyword: 'EnchantmentPassiveNode', kind: 'list', initial: '==' },
      number('EnchantmentPassiveNum', 1, 12, '<= 8')
    ]
  }
]

const DEFS = new Map(CONDITION_GROUPS.flatMap(g => g.conditions).map(d => [d.keyword, d]))

export function conditionDef (keyword: string): ConditionDef | undefined {
  return DEFS.get(keyword)
}

export const RARITIES = ['Normal', 'Magic', 'Rare', 'Unique']
export const SOCKET_COLORS = ['R', 'G', 'B', 'W', 'A', 'D']
export const NUMBER_OPS = ['<', '>', '<=', '>=', 'any', '=', 'range']
export const COMPARE_OPS = ['=', '>=', '<=', '>', '<']

// ---- rows of the editor ----

export interface ConditionRow {
  id: number
  keyword: string
  kind: ConditionKind
  // lines of the filter this row was made from; empty - a new condition
  lines: string[]
  // the same lines written by the editor: the row is changed when it would write others
  base: string
  removed: boolean
  // always shown, "any" until it is set
  pinned: boolean
  // number: one of NUMBER_OPS; list, sockets: operator of the filter
  op: string
  // number; sockets: the number of sockets, null - any
  value: number | null
  // number: the end of the range
  value2: number
  state: 'yes' | 'no' | 'either'
  // rarity, list
  values: string[]
  count: { op: string, n: number } | null
  // sockets: "RRG"
  letters: string
  // text: all after the keyword
  text: string
}

let nextId = 1

function emptyRow (keyword: string, kind: ConditionKind): ConditionRow {
  const def = conditionDef(keyword)
  return {
    id: nextId++,
    keyword,
    kind,
    lines: [],
    base: '',
    removed: false,
    pinned: false,
    op: kind === 'number' ? 'any' : '',
    value: kind === 'number' ? (def?.min ?? 1) : null,
    value2: def?.max ?? 100,
    state: 'either',
    values: [],
    count: null,
    letters: '',
    text: ''
  }
}

function lineText (c: FilterLine) {
  return stripComment(c.raw).trim()
}

function textRow (c: FilterLine): ConditionRow {
  const row = emptyRow(c.keyword, 'text')
  row.text = lineText(c).slice(c.keyword.length).trim()
  return row
}

const isInt = (s: string | undefined) => s != null && /^\d+$/.test(s)

// null: the controls can't show it, it is edited as text
function controlRow (c: FilterLine): ConditionRow | null {
  const def = conditionDef(c.keyword)
  if (!def) return null
  const row = emptyRow(c.keyword, def.kind)
  const op = c.op === '==' ? '=' : (c.op || '=')
  switch (def.kind) {
    case 'number':
      if (c.values.length !== 1 || !isInt(c.values[0]) || !COMPARE_OPS.includes(op)) return null
      row.op = op
      row.value = Number(c.values[0])
      return row
    case 'bool':
      if (c.op && op !== '=') return null
      if (c.values.length > 1 || !/^(true|false)?$/i.test(c.values[0] ?? '')) return null
      row.state = /^false$/i.test(c.values[0] ?? '') ? 'no' : 'yes'
      return row
    case 'rarity':
      if (!c.values.length || !c.values.every(v => RARITIES.includes(v))) return null
      row.values = RARITIES.filter(r => raritiesOf([c]).has(r))
      return row.values.length ? row : null
    case 'list':
      if (!['', '=', '=='].includes(c.op) || (c.count && !def.countable)) return null
      if (def.options && !c.values.every(v => def.options!.includes(v))) return null
      row.op = c.op
      row.values = [...c.values]
      row.count = c.count ? { ...c.count, op: c.count.op === '==' ? '=' : c.count.op } : null
      if (row.count && !COMPARE_OPS.includes(row.count.op)) return null
      return row
    case 'sockets': {
      const m = c.values.length === 1 ? /^(\d*)([RGBWAD]*)$/i.exec(c.values[0]) : null
      if (!m || !c.values[0] || !COMPARE_OPS.includes(op)) return null
      row.op = op
      row.value = m[1] ? Number(m[1]) : null
      row.letters = m[2].toUpperCase()
      return row
    }
  }
}

function withLines (row: ConditionRow, lines: FilterLine[]): ConditionRow {
  row.lines = lines.map(lineText)
  row.base = rowLines(row).join('\n')
  return row
}

// Rows of the block, `pinned` conditions are always there and come first.
// The BaseType list has its own editor.
export function rowsOf (conditions: FilterLine[], pinned: string[]): ConditionRow[] {
  const rows: ConditionRow[] = []
  const left = conditions.filter(c => !isPositiveBaseType(c))
  while (left.length) {
    const c = left.shift()!
    const row = controlRow(c)
    if (row?.kind === 'number' && (row.op === '>=' || row.op === '<=')) {
      // two lines of one keyword: from..to
      const pairAt = left.findIndex(x => x.keyword === c.keyword && controlRow(x)?.op === (row.op === '>=' ? '<=' : '>='))
      if (pairAt >= 0) {
        const pair = controlRow(left[pairAt])!
        const [lo, hi] = row.op === '>=' ? [row.value!, pair.value!] : [pair.value!, row.value!]
        if (lo <= hi) {
          const [other] = left.splice(pairAt, 1)
          rows.push(withLines({ ...row, op: 'range', value: lo, value2: hi }, [c, other]))
          continue
        }
      }
    }
    rows.push(withLines(row ?? textRow(c), [c]))
  }
  const head = pinned.map((keyword): ConditionRow => {
    const own = rows.find(r => r.keyword === keyword && r.kind !== 'text')
    if (own) return Object.assign(own, { pinned: true })
    // shown as text
    const isText = rows.some(r => r.keyword === keyword)
    return { ...emptyRow(keyword, conditionDef(keyword)!.kind), pinned: true, removed: isText }
  }).filter(r => !r.removed)
  return [...head, ...rows.filter(r => !head.includes(r))]
}

// a condition added by the user
export function newRow (def: ConditionDef): ConditionRow {
  const row = emptyRow(def.keyword, def.kind)
  const [, op, rest] = /^(==|<=|>=|<|>|=)?\s*(.*)$/.exec(def.initial)!
  const values = rest.split(' ').filter(Boolean)
  switch (def.kind) {
    case 'number': return { ...row, op, value: Number(rest) }
    case 'bool': return { ...row, state: 'yes' }
    case 'rarity': return { ...row, values }
    case 'list': return { ...row, op: op ?? '', values }
    case 'sockets': return { ...row, op: op ?? '=', value: isInt(rest) ? Number(rest) : null, letters: isInt(rest) ? '' : rest }
  }
}

// lines of the filter; empty - the row sets no condition
export function rowLines (row: ConditionRow): string[] {
  const line = (...parts: string[]) => [[row.keyword, ...parts].filter(Boolean).join(' ')]
  switch (row.kind) {
    case 'number':
      if (row.op === 'any' || row.value == null) return []
      if (row.op !== 'range') return line(row.op, String(row.value))
      return [
        ...line('>=', String(Math.min(row.value, row.value2))),
        ...line('<=', String(Math.max(row.value, row.value2)))
      ]
    case 'bool':
      return row.state === 'either' ? [] : line(row.state === 'yes' ? 'True' : 'False')
    case 'rarity':
      // all of them is the same as any
      return (!row.values.length || row.values.length === RARITIES.length) ? [] : line(...row.values)
    case 'list': {
      if (!row.values.length) return []
      const values = conditionDef(row.keyword)?.options ? row.values : row.values.map(v => `"${v}"`)
      return row.count
        ? line(`${row.count.op}${row.count.n}`, ...values)
        : line(row.op, ...values)
    }
    case 'sockets': {
      const value = `${row.value ?? ''}${row.letters}`
      return value ? line(row.op === '=' ? '' : row.op, value) : []
    }
    case 'text':
      return row.text.trim() ? line(row.text.trim()) : []
  }
}

export function isChanged (row: ConditionRow): boolean {
  return (row.removed && row.lines.length > 0) || (!row.removed && rowLines(row).join('\n') !== row.base)
}

// keyword -> all its lines, only for the keywords that were changed
export function changesOf (rows: ConditionRow[]): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const keyword of new Set(rows.filter(isChanged).map(r => r.keyword))) {
    const own = rows.filter(r => r.keyword === keyword)
    const before = own.flatMap(r => r.lines)
    const after = own.flatMap(r => r.removed ? [] : isChanged(r) ? rowLines(r) : r.lines)
    if (after.join('\n') !== before.join('\n')) out[keyword] = after
  }
  return out
}

// ---- known values ----

// class names of the game that any filter can use
const CLASSES = [
  'Abyss Jewels', 'Amulets', 'Belts', 'Blueprints', 'Body Armours', 'Boots', 'Bows', 'Claws', 'Contracts', 'Daggers',
  'Delve Stackable Socketable Currency', 'Divination Cards', 'Gloves', 'Helmets', 'Hybrid Flasks', 'Jewels', 'Life Flasks',
  'Mana Flasks', 'Map Fragments', 'Maps', 'Misc Map Items', 'One Hand Axes', 'One Hand Maces', 'One Hand Swords', 'Quivers',
  'Rings', 'Rune Daggers', 'Sceptres', 'Shields', 'Skill Gems', 'Stackable Currency', 'Staves', 'Support Gems',
  'Thrusting One Hand Swords', 'Tinctures', 'Trinkets', 'Two Hand Axes', 'Two Hand Maces', 'Two Hand Swords', 'Utility Flasks',
  'Wands', 'Warstaves'
]

const valuesCache = new WeakMap<ParsedFilter, Map<string, string[]>>()

// values of a list condition: the ones the filter itself uses
export function knownValues (filter: ParsedFilter, keyword: string): string[] {
  const options = conditionDef(keyword)?.options
  if (options) return options
  let cache = valuesCache.get(filter)
  if (!cache) valuesCache.set(filter, cache = new Map())
  const known = cache.get(keyword)
  if (known) return known
  const values = new Set(keyword === 'Class' ? CLASSES : [])
  for (const block of filter.blocks) {
    for (const c of block.conditions) {
      if (c.keyword !== keyword) continue
      // "Class Currency" is a part of a name
      if (keyword === 'Class' && c.op !== '==') continue
      c.values.forEach(v => values.add(v))
    }
  }
  const list = [...values].sort((a, b) => a.localeCompare(b))
  cache.set(keyword, list)
  return list
}

// the rule names no items, it applies to everything that meets the rest of conditions
export function isWide (block: Pick<FilterBlock, 'conditions'>): boolean {
  return !block.conditions.some(c => (c.keyword === 'BaseType' || c.keyword === 'Class') && c.op !== '!' && c.op !== '!=')
}
