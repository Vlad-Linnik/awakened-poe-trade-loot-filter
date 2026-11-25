// FilterBlade's "Endgame - Rares": bases of rare equipment are split into ranks A, B, C…
// The ranks are the tiers t1, t2… of `$type->rr`, `$type->rr->amuring`, `$type->rr->belts`,
// low ones can be disabled by the strictness of the filter.

import { ItemCategory } from '@/parser'
import { allBlocks, type FilterBlock, type ParsedFilter } from './filter-parser'
import { allBases, type BaseEntry } from './base-search'
import { isPositiveBaseType, listsBase } from './filter-edit'
import { newRule, type AptRule } from './apt-rules'
import { selectorOf } from './edits'

export type RankGroup = 'jewellery' | 'gear'

export const RANK_NAMES = ['A', 'B', 'C', 'D', 'E', 'F']
export const RANK_COLORS = ['#41b6ff', '#8cc926', '#ffca3a', '#ff7b47', '#c86bd0', '#8f8f8f']
export const UNTIERED_COLOR = '#b30d22'

// subcategory of FilterBlade -> the ranks in it
export const RANKS_OF_SUB: Record<string, RankGroup> = {
  'Jewellery': 'jewellery',
  'Weapons and Armours': 'gear'
}

const TYPES: Record<RankGroup, Array<{ type: string, has: (category: ItemCategory) => boolean }>> = {
  jewellery: [
    { type: 'rr->amuring', has: c => c === ItemCategory.Amulet || c === ItemCategory.Ring },
    { type: 'rr->belts', has: c => c === ItemCategory.Belt }
  ],
  gear: [{ type: 'rr', has: c => GEAR.has(c) }]
}

const ARMOUR = [ItemCategory.BodyArmour, ItemCategory.Boots, ItemCategory.Gloves, ItemCategory.Helmet, ItemCategory.Shield]
const WEAPONS = [
  ItemCategory.Claw, ItemCategory.Dagger, ItemCategory.OneHandedAxe, ItemCategory.OneHandedMace, ItemCategory.OneHandedSword,
  ItemCategory.TwoHandedAxe, ItemCategory.TwoHandedMace, ItemCategory.TwoHandedSword, ItemCategory.Warstaff, ItemCategory.Bow,
  ItemCategory.RuneDagger, ItemCategory.Quiver, ItemCategory.Sceptre, ItemCategory.Staff, ItemCategory.Wand
]
const GEAR = new Set([...ARMOUR, ...WEAPONS])

export const CLASSES_OF: Record<RankGroup, Array<{ label: string, categories: ItemCategory[] }>> = {
  jewellery: [{ label: 'Armour Classes', categories: [ItemCategory.Amulet, ItemCategory.Belt, ItemCategory.Ring] }],
  gear: [{ label: 'Armour Classes', categories: ARMOUR }, { label: 'Weapon Classes', categories: WEAPONS }]
}

export const DEFENCES = ['Energy Shield', 'ES / Evasion', 'Evasion Rating', 'Evasion / Armour', 'Armour', 'Armour / ES']

export function defenceOf (base: BaseEntry): string | null {
  const { ar, ev, es } = base.armour ?? {}
  if (es && ev && ar) return null
  if (es) return ev ? 'ES / Evasion' : ar ? 'Armour / ES' : 'Energy Shield'
  if (ev) return ar ? 'Evasion / Armour' : 'Evasion Rating'
  return ar ? 'Armour' : null
}

export interface RankedBase {
  base: BaseEntry
  className: string
  // index of the rank, null - in no rank
  rank: number | null
  // the tier that lists it
  block: FilterBlock | null
}

function rankBlocks (filter: ParsedFilter, type: string): FilterBlock[] {
  const out: FilterBlock[] = []
  for (const b of allBlocks(filter)) {
    const m = b.tags.type === type && /^t(\d+)$/.exec(b.tags.tier ?? '')
    // the last one has no list: it is for all the rest
    if (m && b.conditions.some(isPositiveBaseType)) out[Number(m[1]) - 1] ??= b
  }
  return out
}

export interface Ranks {
  // number of ranks
  count: number
  bases: RankedBase[]
  tierOf: (base: BaseEntry, rank: number) => FilterBlock | null
}

export function ranksOf (filter: ParsedFilter, group: RankGroup): Ranks {
  const types = TYPES[group].map(x => ({ ...x, blocks: rankBlocks(filter, x.type) }))
  const bases: RankedBase[] = []
  for (const base of allBases().values()) {
    const type = base.category && base.rarities.includes('Rare') ? types.find(x => x.has(base.category!)) : undefined
    if (!type) continue
    const rank = type.blocks.findIndex(b => b != null && listsBase(b, base.ref))
    bases.push({
      base,
      className: base.classes?.[0] ?? String(base.category),
      rank: rank >= 0 ? rank : null,
      block: rank >= 0 ? type.blocks[rank] : null
    })
  }
  // the best defence first
  const power = ({ base: { armour } }: RankedBase) => armour
    ? [armour.ar, armour.ev, armour.es, armour.ward].reduce((sum, x) => sum + (x?.[1] ?? 0), 0)
    : 0
  bases.sort((a, b) => power(b) - power(a) || a.base.ref.localeCompare(b.base.ref))
  return {
    count: Math.max(0, ...types.map(x => x.blocks.length)),
    bases,
    tierOf: (base, rank) => types.find(x => base.category && x.has(base.category))?.blocks[rank] ?? null
  }
}

// a base is moved to another rank; null - to none
export interface RankChange {
  base: string
  from: FilterBlock | null
  to: FilterBlock | null
}

// ---- "Add custom Show/Hide rule (EG rares)" ----

export interface RarePreset {
  id: string
  title: string
  visibility: 'Show' | 'Hide'
  conditions: string[]
}

const ARMOUR_CLASSES = 'Class == "Body Armours" "Boots" "Gloves" "Helmets" "Shields"'
const preset = (id: string, title: string, visibility: 'Show' | 'Hide', ...conditions: string[]): RarePreset => ({ id, title, visibility, conditions })

export const RARE_PRESETS: RarePreset[] = [
  preset('show_base', 'Highlight rares by Base', 'Show'),
  preset('show_defence', 'Highlight rares by Defence Type', 'Show', ARMOUR_CLASSES, 'BaseEnergyShield >= 1'),
  preset('show_slot', 'Highlight rares by item slot', 'Show', 'Class == "Rings"'),
  preset('show_chromatic', 'Highlight chromatic Rares', 'Show', 'SocketGroup RGB'),
  preset('hide_base', 'Hide rares by Base', 'Hide'),
  preset('hide_defence', 'Hide rares by Defence Type', 'Hide', ARMOUR_CLASSES, 'BaseEvasion >= 1'),
  preset('hide_slot', 'Hide rares by item slot', 'Hide', 'Class == "Belts"'),
  preset('corrupted', 'Corrupted Rares Custom Rules', 'Show', 'Corrupted True')
]

export const RARES_SCOPE = 'egrares'

// Stands before the ranks and the rules that hide rares, but after the rules of valuable
// ones (6 links, influenced, veiled…). It starts disabled: the user chooses what it is for.
export function rareRule (filter: ParsedFilter, p: RarePreset): AptRule {
  const anchor = allBlocks(filter).find(b =>
    (b.tags.type === 'hidelayer' && /^(corruptedrares|mirroredrares|rrihide)/.test(b.tags.tier ?? '')) ||
    /^(rr\b|rareoptional)/.test(b.tags.type ?? ''))
  return newRule({
    visibility: p.visibility,
    label: p.title,
    conditions: ['Rarity Rare', 'ItemLevel >= 68', ...p.conditions],
    actions: p.visibility === 'Hide' ? [] : ['SetFontSize 45', 'SetBorderColor 220 40 40 255', 'SetBackgroundColor 90 35 40 255'],
    custom: true,
    disabled: true,
    scope: RARES_SCOPE,
    anchor: anchor && selectorOf(anchor)
  })
}
