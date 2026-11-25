// Search of base types for the BaseType list of a tier: only the items that can be
// in this tier at all (by its Class, Rarity and other conditions).

import { ITEMS_ITERATOR, type BaseType } from '@/assets/data'
import { ItemCategory } from '@/parser'
import type { FilterBlock, FilterLine, ParsedFilter } from './filter-parser'
import { CLASS_BY_CATEGORY } from './item-props'
import { isExactBaseType, isPositiveBaseType, raritiesOf, ruleIdOfBlock } from './filter-edit'
import { isGearClass } from './matcher'
import { safeIcon } from './fb'

export interface BaseEntry {
  ref: string
  name: string // in the language of the game
  icon: string | null
  category: ItemCategory | undefined
  // filter classes the item can have (one of them); undefined - unknown
  classes: string[] | undefined
  // equipment, maps…: rarities the item can have. Empty for currency, cards, gems…
  rarities: string[]
  isGem: boolean
  armour?: BaseType['armour']
  // unique items of this base
  uniques: Array<{ ref: string, name: string }>
}

// bases with uniques that are missing in the item data (poedb.tw/us/Unique_item)
const MORE_UNIQUE_BASES = new Set(['Fishing Rod', 'Ghostflame Blade'])

// rarities of the items of a category (poedb.tw), all of them by default
const ALL_RARITIES = ['Normal', 'Magic', 'Rare', 'Unique']
const RARITIES_BY_CATEGORY: Partial<Record<ItemCategory, string[]>> = {
  [ItemCategory.Flask]: ['Normal', 'Magic', 'Unique'],
  [ItemCategory.Tincture]: ['Normal', 'Magic', 'Unique'],
  [ItemCategory.Jewel]: ['Magic', 'Rare', 'Unique'],
  [ItemCategory.AbyssJewel]: ['Magic', 'Rare', 'Unique'],
  [ItemCategory.ClusterJewel]: ['Magic', 'Rare', 'Unique'],
  [ItemCategory.Idol]: ['Magic', 'Rare', 'Unique'],
  [ItemCategory.SanctumRelic]: ['Magic', 'Unique'],
  [ItemCategory.Invitation]: []
}

// most sockets an item can have, 0 by default
const MAX_SOCKETS: Partial<Record<ItemCategory, number>> = {
  [ItemCategory.BodyArmour]: 6,
  [ItemCategory.Bow]: 6,
  [ItemCategory.Staff]: 6,
  [ItemCategory.Warstaff]: 6,
  [ItemCategory.TwoHandedAxe]: 6,
  [ItemCategory.TwoHandedMace]: 6,
  [ItemCategory.TwoHandedSword]: 6,
  [ItemCategory.FishingRod]: 6,
  [ItemCategory.Helmet]: 4,
  [ItemCategory.Gloves]: 4,
  [ItemCategory.Boots]: 4,
  [ItemCategory.Shield]: 3,
  [ItemCategory.Claw]: 3,
  [ItemCategory.Dagger]: 3,
  [ItemCategory.RuneDagger]: 3,
  [ItemCategory.OneHandedAxe]: 3,
  [ItemCategory.OneHandedMace]: 3,
  [ItemCategory.OneHandedSword]: 3,
  [ItemCategory.Sceptre]: 3,
  [ItemCategory.Wand]: 3,
  [ItemCategory.Amulet]: 1,
  [ItemCategory.Ring]: 1,
  [ItemCategory.Belt]: 1
}

// sockets of unique jewellery are never linked
const JEWELLERY = new Set([ItemCategory.Amulet, ItemCategory.Ring, ItemCategory.Belt])
const ELDRITCH = new Set([ItemCategory.Helmet, ItemCategory.BodyArmour, ItemCategory.Gloves, ItemCategory.Boots])

// The item data has no classes of currency-like items. Most of them are listed by the filter
// under the conditions of their class (see filterBases), these are for the rest.
const CLASS_BY_NAME: Array<[RegExp, string]> = [
  [/ Reliquary Key$/, 'Vault Keys'],
  [/ Resonator$/, 'Delve Stackable Socketable Currency'],
  [/^Forbidden Tome$/, 'Sanctum Research'],
  [/^(Chronicle of Atzoatl|Inscribed Ultimatum|Mirrored Tablet)$/, 'Misc Map Items'],
  [/ Emblem$/, 'Map Fragments'],
  [/^Map \(Tier \d+\)$/, 'Maps'],
  [/ Wombgift$/, 'Wombgifts'],
  [/ Incubator$/, 'Incubators'],
  [/^Gold$/, 'Gold'],
  [/(Orb|Shard|Splinter|Oil|Fossil|Catalyst|Scrap|Whetstone|Scroll|Coin|Lifeforce|Astrolabe)$/, 'Stackable Currency'],
  [/^(Vial of|Runegraft of|Omen of|Tattoo of|Memory of)|\bTattoo\b|\bEssence of\b|\bExalted Orb\b|^Maven's Chisel of|^Divine Vessel$/, 'Stackable Currency']
]

let cache: { source: unknown, bases: Map<string, BaseEntry> } | null = null

// the item data is replaced when the language changes
export function allBases (): Map<string, BaseEntry> {
  if (cache?.source === ITEMS_ITERATOR) return cache.bases
  const bases = new Map<string, BaseEntry>()
  const uniques: BaseType[] = []
  for (const item of ITEMS_ITERATOR('"namespace":"')) {
    if (item.namespace === 'UNIQUE') uniques.push(item)
    if (item.namespace !== 'ITEM' && item.namespace !== 'DIVINATION_CARD' && item.namespace !== 'GEM') continue
    // the base type of a transfigured gem is the original gem
    if (item.gem?.transfigured || bases.has(item.refName)) continue
    bases.set(item.refName, {
      ref: item.refName,
      name: item.name,
      icon: safeIcon(item.icon),
      category: item.craftable?.category,
      classes: classesOf(item),
      rarities: !item.craftable
        ? []
        : item.craftable.uniqueOnly ? ['Unique'] : RARITIES_BY_CATEGORY[item.craftable.category] ?? ALL_RARITIES,
      isGem: item.namespace === 'GEM',
      armour: item.armour,
      uniques: []
    })
  }
  for (const item of uniques) {
    const base = item.unique && bases.get(item.unique.base)
    if (base && !base.uniques.some(u => u.ref === item.refName)) base.uniques.push({ ref: item.refName, name: item.name })
  }
  cache = { source: ITEMS_ITERATOR, bases }
  return bases
}

function classesOf (item: BaseType): string[] | undefined {
  if (item.namespace === 'DIVINATION_CARD') return ['Divination Cards']
  if (item.namespace === 'GEM') return ['Skill Gems', 'Support Gems']
  if (item.craftable?.category === ItemCategory.Flask) {
    const kind = /(Life|Mana|Hybrid) Flask$/.exec(item.refName)?.[1]
    return [kind ? `${kind} Flasks` : 'Utility Flasks']
  }
  if (item.craftable?.category === ItemCategory.Invitation) return ['Map Fragments', 'Misc Map Items']
  const cls = (item.craftable && CLASS_BY_CATEGORY[item.craftable.category]) ??
    CLASS_BY_NAME.find(([re]) => re.test(item.refName))?.[1]
  return cls ? [cls] : undefined
}

// ---- what the filter itself knows about the items ----

const filterCache = new WeakMap<ParsedFilter, { source: unknown, bases: Map<string, BaseEntry> }>()

// the item data + classes of currency-like items and the items that the data doesn't have,
// taken from the rules of the filter that list them
export function filterBases (filter: ParsedFilter): Map<string, BaseEntry> {
  const all = allBases()
  const known = filterCache.get(filter)
  if (known?.source === ITEMS_ITERATOR) return known.bases

  const classes = new Map<string, string[] | null>()
  const listed = new Map<string, FilterBlock>()
  for (const block of filter.blocks) {
    if (ruleIdOfBlock(block) != null) continue
    const cls = block.conditions.find(c => c.keyword === 'Class' && c.op === '==')?.values
    for (const name of block.conditions.filter(isExactBaseType).flatMap(c => c.values)) {
      if (!listed.has(name)) listed.set(name, block)
      if (!cls) continue
      const prev = classes.get(name)
      classes.set(name, prev === undefined ? cls : prev && prev.filter(c => cls.includes(c)))
    }
  }

  const bases = new Map(all)
  for (const name of listed.keys()) {
    const base = all.get(name)
    if (base?.classes) continue
    const learned = classes.get(name)
    const list = learned?.length ? learned : undefined
    if (base) {
      if (list) bases.set(name, { ...base, classes: list })
    } else {
      const byName = CLASS_BY_NAME.find(([re]) => re.test(name))?.[1]
      const cls = list ?? (byName ? [byName] : undefined)
      bases.set(name, {
        ref: name,
        name,
        icon: null,
        category: undefined,
        classes: cls,
        rarities: cls?.some(isGearClass) ? ALL_RARITIES : [],
        isGem: false,
        uniques: []
      })
    }
  }
  filterCache.set(filter, { source: ITEMS_ITERATOR, bases })
  return bases
}

// the item can be unique: a rule without Rarity would catch unique items too
export function canBeUnique (baseType: string, block: FilterBlock): boolean {
  const base = allBases().get(baseType)
  if (base) return base.rarities.includes('Unique')
  const classes = block.conditions.filter(c => c.keyword === 'Class').flatMap(c => c.values)
  return classes.length > 0 && classes.every(isGearClass)
}

// ---- which items can be in a tier ----

// `listed` - base types of the tiers of the same kind: the filter knows uniques that the data doesn't have
export function baseScope (block: FilterBlock, listed: Set<string>, filter?: ParsedFilter): (base: BaseEntry) => boolean {
  const own = new Set(block.conditions.filter(isPositiveBaseType).flatMap(c => c.values))
  const rarities = block.conditions.some(c => c.keyword === 'Rarity') ? raritiesOf(block.conditions) : null
  const onlyUnique = rarities?.size === 1 && rarities.has('Unique')
  const replica = block.conditions.some(c => c.keyword === 'Replica' && /^true$/i.test(c.values[0] ?? ''))
  const classConds = block.conditions.filter(c => c.keyword === 'Class' && c.op !== '!' && c.op !== '!=' && !c.count)
  const features = block.conditions.filter(c => c.keyword in FEATURES && isRequired(c))
  const knownClasses = filter ? classesOfFilter(filter) : null

  return (base) => {
    if (own.has(base.ref)) return true
    for (const cond of classConds) {
      const ok = base.classes
        ? cond.values.some(v => base.classes!.some(cls => cond.op === '==' && knownClasses?.has(cls) ? cls === v : sameClass(v, cls)))
        // the class is unknown, but it is not the one of equipment, gems, cards
        : cond.values.some(v => !isDataClass(v))
      if (!ok) return false
    }
    if (!features.every(c => FEATURES[c.keyword](base, c))) return false
    if (!rarities) return true
    if (!base.rarities.some(r => rarities.has(r))) return false
    if (!onlyUnique || listed.has(base.ref)) return true
    if (replica) return base.uniques.some(u => u.ref.startsWith('Replica '))
    return base.uniques.length > 0 || MORE_UNIQUE_BASES.has(base.ref)
  }
}

// item data has the class of a group: "One Hand Swords" for "Thrusting One Hand Swords"
function sameClass (a: string, b: string) {
  a = a.toLowerCase()
  b = b.toLowerCase()
  return a.includes(b) || b.includes(a)
}

// classes of currency-like items are exact names: "Stackable Currency" is not "Delve Stackable Socketable Currency"
function classesOfFilter (filter: ParsedFilter): Set<string> {
  const names = new Set([...CLASS_BY_NAME.map(([, cls]) => cls), 'Life Flasks', 'Mana Flasks', 'Hybrid Flasks', 'Utility Flasks'])
  for (const base of filterBases(filter).values()) {
    if (!base.category && !base.isGem) base.classes?.forEach(cls => names.add(cls))
  }
  return names
}

const DATA_CLASSES = new Set(['Skill Gems', 'Support Gems', 'Divination Cards', ...Object.values(CLASS_BY_CATEGORY)])

function isDataClass (value: string) {
  // "Map Fragments" hold more than the invitations
  return value !== 'Map Fragments' && value !== 'Currency' && DATA_CLASSES.has(value)
}

// conditions that only some items can meet
type Feature = (base: BaseEntry, cond: FilterLine) => boolean
const hasRarity: Feature = base => base.rarities.length > 0 || !base.classes
const isEquipment: Feature = base => base.category != null && (MAX_SOCKETS[base.category] != null || base.category === ItemCategory.Quiver)
const hasSockets: Feature = (base, cond) => {
  if (base.category == null) return false
  if (JEWELLERY.has(base.category) && cond.keyword !== 'Sockets') return false
  const max = MAX_SOCKETS[base.category] ?? 0
  return cond.values.some(v => {
    const number = Number(/^\d+/.exec(v)?.[0] ?? 0)
    return max >= Math.max(number, v.replace(/[^A-Za-z]/g, '').length)
  })
}
const FEATURES: Record<string, Feature> = {
  Sockets: hasSockets,
  LinkedSockets: hasSockets,
  SocketGroup: hasSockets,
  HasInfluence: isEquipment,
  ElderItem: isEquipment,
  ShaperItem: isEquipment,
  SynthesisedItem: base => isEquipment(base, null as never) || base.category === ItemCategory.Jewel,
  HasSearingExarchImplicit: base => base.category != null && ELDRITCH.has(base.category),
  HasEaterOfWorldsImplicit: base => base.category != null && ELDRITCH.has(base.category),
  EnchantmentPassiveNum: base => base.category === ItemCategory.ClusterJewel,
  EnchantmentPassiveNode: base => base.category === ItemCategory.ClusterJewel,
  HasExplicitMod: hasRarity,
  FracturedItem: hasRarity,
  MemoryStrands: hasRarity,
  UnidentifiedItemTier: hasRarity,
  CorruptedMods: hasRarity,
  MapTier: base => base.category === ItemCategory.Map || base.category == null,
  GemLevel: base => base.isGem,
  // gems and equipment have quality, currency and cards don't
  Quality: base => base.isGem || base.rarities.length > 0 || !base.classes,
  // equipment and gems are never in a stack
  StackSize: base => !base.isGem && !base.rarities.length
}

// `FracturedItem False`, `Sockets < 1`, `Quality 0` don't need the item to have the property
function isRequired (c: FilterLine) {
  if (c.op === '<' || c.op === '<=' || c.op === '!' || c.op === '!=') return false
  const value = c.values[0] ?? ''
  if (/^(false|none)$/i.test(value)) return false
  if (/^\d+$/.test(value)) return Number(value) > (c.keyword === 'StackSize' ? 1 : 0)
  return true
}

// base types listed by the rules of the same kind
export function listedBases (blocks: FilterBlock[]): Set<string> {
  return new Set(blocks.flatMap(b => b.conditions.filter(isPositiveBaseType).flatMap(c => c.values)))
}

// ---- search ----

export interface BaseHit {
  base: BaseEntry
  // the unique item it was found by
  unique?: { ref: string, name: string }
}

// any case, "Maelström" = "maelstrom"
function fold (text: string) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

// 0 = the name itself, 1 = it starts with the query, 2 = a word of it does, 3 = in the middle
function rankOf (text: string, query: string) {
  const folded = fold(text)
  const i = folded.indexOf(query)
  if (i < 0) return -1
  if (i > 0) return /[\s\-'(]/.test(folded[i - 1]) ? 2 : 3
  return folded === query ? 0 : 1
}

// by the base name or, if uniques can be in the tier, by the name of a unique item
export function searchBases (query: string, opts: {
  scope: (base: BaseEntry) => boolean
  withUniques: boolean
  limit: number
  filter?: ParsedFilter
}): BaseHit[] {
  const q = fold(query)
  if (q.length < 2) return []
  const hits: Array<BaseHit & { rank: number }> = []
  const bases = opts.filter ? filterBases(opts.filter) : allBases()
  for (const base of bases.values()) {
    const ranks = [base.ref, base.name].map(n => rankOf(n, q)).filter(r => r >= 0)
    const unique = (!ranks.length && opts.withUniques)
      ? base.uniques.find(u => rankOf(u.ref, q) >= 0 || rankOf(u.name, q) >= 0)
      : undefined
    if (!(ranks.length || unique) || !opts.scope(base)) continue
    hits.push({ base, unique, rank: ranks.length ? Math.min(...ranks) : 4 })
  }
  return hits
    .sort((a, b) => a.rank - b.rank || a.base.ref.localeCompare(b.base.ref))
    .slice(0, opts.limit)
}

// the base type with exactly this name (in any case and language)
export function findBase (name: string, filter?: ParsedFilter): BaseEntry | undefined {
  const q = fold(name)
  const bases = filter ? filterBases(filter) : allBases()
  for (const base of bases.values()) {
    if (fold(base.ref) === q || fold(base.name) === q) return base
  }
  return undefined
}
