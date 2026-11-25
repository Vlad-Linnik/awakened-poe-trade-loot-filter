// How an item of a rule looks in the game: the default color of its kind, then the rules
// with Continue above ("decorators"), then the rule itself.

import { filterBases } from './base-search'
import { raritiesOf } from './filter-edit'
import { evalBlock } from './matcher'
import { layerStyle, styleFromActions, type FilterStyle, type RGBA } from './style'
import type { FilterBlock, FilterLine, ParsedFilter } from './filter-parser'
import type { FilterItem } from './item-props'

const rgb = (r: number, g: number, b: number): RGBA => ({ r, g, b, a: 255 })

const RARITY_TEXT: Record<string, RGBA> = {
  Normal: rgb(200, 200, 200),
  Magic: rgb(136, 136, 255),
  Rare: rgb(255, 255, 119),
  Unique: rgb(175, 96, 37)
}

// items that have a color of their own whatever their rarity is
const CLASS_TEXT: Array<[RegExp, RGBA]> = [
  [/Gems/i, rgb(27, 162, 155)],
  [/Divination/i, rgb(14, 186, 255)],
  [/Quest|Labyrinth/i, rgb(74, 230, 58)],
  [/Currency|Incubator|Corpses/i, rgb(170, 158, 130)]
]

export interface PreviewBase {
  // what the rule is drawn over
  style: FilterStyle
  decorators: FilterBlock[]
}

// `item`: the item under the cursor; otherwise - an ordinary item of the rule
// `line`: where the rule stands in the filter
export function previewBase (filter: ParsedFilter, block: FilterBlock, opts: {
  item?: FilterItem | null
  baseType?: string
  line?: number
}): PreviewBase {
  // the rule can be for other items of this base: another rarity, item level…
  const item = opts.item && evalBlock(block, opts.item).result !== false
    ? opts.item
    : sampleItem(filter, block, opts.baseType)
  const line = opts.line ?? block.startLine
  const decorators = filter.blocks.filter(b => b.continue && b.startLine < line && evalBlock(b, item).result === true)
  const start: FilterStyle = { ...styleFromActions([]), text: defaultText(item) }
  return {
    decorators,
    style: decorators.reduce((style, b) => layerStyle(style, styleFromActions(b.actions)), start)
  }
}

export function previewStyle (filter: ParsedFilter, block: FilterBlock, opts: Parameters<typeof previewBase>[2]): FilterStyle {
  return layerStyle(previewBase(filter, block, opts).style, styleFromActions(block.actions))
}

export function defaultText (item: Pick<FilterItem, 'class' | 'rarity'>): RGBA {
  const special = item.rarity !== 'Unique' && CLASS_TEXT.find(([re]) => item.class && re.test(item.class))
  return special ? special[1] : (RARITY_TEXT[item.rarity] ?? RARITY_TEXT.Normal)
}

// The plainest item the rule applies to: nothing that the rule doesn't ask for.
// `undefined` is for what can be anything.
export function sampleItem (filter: ParsedFilter, block: FilterBlock, baseType?: string): FilterItem {
  const of = (keyword: string) => block.conditions.filter(c => c.keyword === keyword)
  const name = baseType ?? of('BaseType')[0]?.values[0] ?? ''
  const base = filterBases(filter).get(name)
  const flag = (keyword: string) => of(keyword).some(c => !/^false$/i.test(c.values[0] ?? ''))
  const number = (keyword: string) => boundOf(of(keyword))
  const classes = of('Class').filter(c => c.op !== '!' && c.op !== '!=').flatMap(c => c.values)
  const own = base?.classes?.find(cls => classes.includes(cls)) ?? base?.classes?.[0]
  const allowed = raritiesOf(block.conditions)
  const isGear = base ? base.rarities.length > 0 : of('Rarity').length > 0
  const rarities = ['Normal', 'Magic', 'Rare', 'Unique'].filter(r => allowed.has(r) && (!base?.rarities.length || base.rarities.includes(r)))
  return {
    class: own ?? classes[0],
    // a class of the item data is the name of a group: "Flasks", "One Hand Swords"
    classIsGuess: own != null && !classes.includes(own),
    baseType: name,
    name,
    rarity: (isGear ? rarities[0] ?? 'Normal' : 'Normal') as FilterItem['rarity'],
    itemLevel: number('ItemLevel'),
    quality: number('Quality') ?? 0,
    stackSize: number('StackSize') ?? 1,
    gemLevel: number('GemLevel') ?? (base?.isGem ? 1 : undefined),
    mapTier: number('MapTier'),
    memoryStrands: number('MemoryStrands') ?? 0,
    sockets: undefined,
    identified: flag('Identified'),
    corrupted: flag('Corrupted'),
    mirrored: flag('Mirrored'),
    fractured: flag('FracturedItem'),
    synthesised: flag('SynthesisedItem'),
    foulborn: flag('Foulborn'),
    influences: of('HasInfluence').flatMap(c => c.values).filter(v => v !== 'None').slice(0, 1),
    explicitModNames: undefined,
    hasImplicit: undefined,
    enchanted: flag('AnyEnchantment') || undefined,
    imbued: flag('Imbued'),
    width: base ? base.w : number('Width'),
    height: base ? base.h : number('Height'),
    areaLevel: number('AreaLevel')
  }
}

// the least number that meets the conditions
function boundOf (conditions: FilterLine[]): number | undefined {
  let min: number | undefined
  let max: number | undefined
  for (const c of conditions) {
    const value = Number(c.values[0])
    if (!Number.isFinite(value)) continue
    switch (c.op) {
      case '>=': min = Math.max(min ?? value, value); break
      case '>': min = Math.max(min ?? value + 1, value + 1); break
      case '<=': max = Math.min(max ?? value, value); break
      case '<': max = Math.min(max ?? value - 1, value - 1); break
      case '!':
      case '!=': break
      default: return value
    }
  }
  return min ?? max
}
