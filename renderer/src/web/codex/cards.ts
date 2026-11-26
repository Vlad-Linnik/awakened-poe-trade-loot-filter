// Divination cards: drop weights and where they drop.
// The data is a snapshot made by `npm run update-codex` (scripts/update-div-cards.mjs);
// cards added or removed by a patch come with the next run of the script.

export interface CardSource {
  kind: 'map' | 'act' | 'tag' | 'other'
  name: string
}

export interface CardEntry {
  name: string
  stack: number
  reward: string
  // relative to the other cards; null = unknown
  weight: number | null
  // drops only from bosses (not a part of the common pool)
  boss?: true
  // can't drop at all
  disabled?: true
  minLevel?: number
  sources?: CardSource[]
}

export interface CardData {
  league: string
  updated: string
  totalWeight: number
  cards: CardEntry[]
}

// Tiers by drop weight, not by the loot filter: a filter can be written in any way.
export type CardTier = 't0' | 't1' | 't2' | 't3' | 't4' | 'boss' | 'disabled' | 'unknown'

// the highest weight of each tier
export const TIER_LIMITS: Array<[CardTier, number]> = [
  ['t0', 10],
  ['t1', 100],
  ['t2', 1000],
  ['t3', 10000],
  ['t4', Infinity]
]

export function cardTier (card: CardEntry): CardTier {
  if (card.disabled) return 'disabled'
  if (card.boss) return 'boss'
  if (card.weight == null || card.weight <= 0) return 'unknown'
  return TIER_LIMITS.find(([, max]) => card.weight! <= max)![0]
}

// one in N dropped cards is this one (only for cards of the common pool)
export function oneIn (card: CardEntry, totalWeight: number): number | null {
  if (card.disabled || card.boss || !card.weight || card.weight <= 0 || totalWeight <= 0) return null
  return Math.round(totalWeight / card.weight)
}

// a full stack: how many cards of the pool drop for one stack of this card
export function oneStackIn (card: CardEntry, totalWeight: number): number | null {
  const n = oneIn(card, totalWeight)
  return n == null ? null : n * card.stack
}
