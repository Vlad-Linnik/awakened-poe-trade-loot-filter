// Thaumaturgic Dust of unique items (Kingsmarch disenchanting).
// The base values are `unique.disenchantValue` of the app's own item data, which is
// updated with every patch of the game, so new and removed uniques come with it.

import type { BaseType } from '@/assets/data'

export interface DustProps {
  itemLevel: number
  quality: number
  // influence types + corruption implicits: +50% each
  extras: number
}

// the same formula as `calcDisenchantDust` of the item parser
export function dustValue (disenchantValue: number, p: DustProps): number {
  const factorsMulti = (100 + p.extras * 50 + p.quality * 2) / 100
  const ilvl = p.itemLevel
  const term1 = 50 // ilvl 46 and below
  const term2 = 2 * (Math.min(Math.max(ilvl, 46), 68) - 46) // ilvl 47 to 68
  const term3 = Math.floor(3 * (Math.min(Math.max(ilvl, 46), 68) - 46) / 11) // ilvl 47 to 68
  const term4 = 25 * (Math.min(Math.max(ilvl, 68), 84) - 68) // ilvl 69 to 84
  // + a tiny bit: 891.16 * 2500 * 1.4 is 3119059.9999… in floating point
  return Math.floor(disenchantValue * 5 * (term1 + term2 + term3 + term4) * factorsMulti + 1e-6)
}

export interface DustEntry {
  refName: string
  name: string
  // base type
  baseRef: string
  baseName: string
  category: string | null
  w: number
  h: number
  disenchantValue: number
  icon: string
}

// Uniques with a dust value. `findBase` looks up the base type by its English name.
export function dustEntries (
  uniques: Iterable<BaseType>,
  findBase: (refName: string) => BaseType | undefined
): DustEntry[] {
  const out = new Map<string, DustEntry>()
  for (const u of uniques) {
    const value = u.unique?.disenchantValue
    if (u.namespace !== 'UNIQUE' || !u.unique || value == null) continue
    const key = `${u.refName}\n${u.unique.base}`
    if (out.has(key)) continue
    const base = findBase(u.unique.base)
    out.set(key, {
      refName: u.refName,
      name: u.name,
      baseRef: u.unique.base,
      baseName: base?.name ?? u.unique.base,
      category: base?.craftable?.category ?? null,
      w: base?.w ?? u.w ?? 1,
      h: base?.h ?? u.h ?? 1,
      disenchantValue: value,
      icon: u.icon
    })
  }
  return [...out.values()]
}
