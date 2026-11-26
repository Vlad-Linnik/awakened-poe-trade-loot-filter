// Helpers for the loot filter tests.
// neversink-1-regular.filter: NeverSink's filter 8.21.1, 1-REGULAR (MIT, see NEVERSINK-LICENSE),
// https://github.com/NeverSinkDev/NeverSink-Filter/tree/4c0e73c9ecc700c4cfae4f76755fb74a8d954a10

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ItemRarity } from '@/parser'
import { parseFilter, type FilterBlock, type ParsedFilter } from '../filter-parser'
import type { FilterItem } from '../item-props'
import { matchItem } from '../matcher'

export const NEVERSINK = readFileSync(join(__dirname, 'neversink-1-regular.filter'), 'utf-8')

export function item (props: Partial<Omit<FilterItem, 'rarity'>> & { baseType: string, rarity?: string }): FilterItem {
  return {
    class: undefined,
    classIsGuess: false,
    name: props.baseType,
    itemLevel: undefined,
    quality: 0,
    stackSize: undefined,
    gemLevel: undefined,
    mapTier: undefined,
    memoryStrands: 0,
    sockets: undefined,
    identified: true,
    corrupted: false,
    mirrored: false,
    fractured: false,
    synthesised: false,
    foulborn: false,
    influences: [],
    explicitModNames: [],
    hasImplicit: false,
    enchanted: false,
    imbued: false,
    width: 1,
    height: 1,
    areaLevel: 83,
    ...props,
    rarity: (props.rarity ?? 'Normal') as ItemRarity
  }
}

export function currency (baseType: string, stackSize = 1): FilterItem {
  return item({ baseType, class: 'Stackable Currency', stackSize })
}

// the only enabled block with these tags
export function tier (filter: ParsedFilter, type: string, tierName: string): FilterBlock {
  const found = filter.blocks.filter(b => b.tags.type === type && b.tags.tier === tierName)
  if (found.length !== 1) throw new Error(`${found.length} blocks $type->${type} $tier->${tierName}`)
  return found[0]
}

// the block that decides how the item looks
export function finalBlock (filterOrText: ParsedFilter | string, it: FilterItem): FilterBlock | null {
  const filter = typeof filterOrText === 'string' ? parseFilter(filterOrText) : filterOrText
  return matchItem(filter, it).final?.block ?? null
}

export function tierOf (filterOrText: ParsedFilter | string, it: FilterItem): string | undefined {
  const b = finalBlock(filterOrText, it)
  return b ? `${b.tags.type}/${b.tags.tier}` : undefined
}
