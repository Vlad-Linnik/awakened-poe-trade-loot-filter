import type { Widget } from '@/web/overlay/interfaces'
import type { CardTier } from './cards'
import type { Reqs } from './sockets'

export interface CodexWidget extends Widget {
  hotkey: string | null
  tab: 'dust' | 'cards' | 'sockets'
  dust: {
    itemLevel: number
    quality: number
    extras: number
    sort: 'dust' | 'perSlot' | 'name'
    category: string | null
  }
  cards: {
    sort: 'rare' | 'common' | 'name'
    tier: CardTier | null
    // English name of a map of the Atlas
    area: string | null
  }
  sockets: {
    // English name of the base type, null = requirements typed in
    base: string | null
    reqs: Reqs
    count: number
    itemLevel: number
    quality: number
  }
}

export function codexDefaults (): Omit<CodexWidget, keyof Widget> {
  return {
    hotkey: 'Ctrl + Shift + U',
    tab: 'dust',
    dust: { itemLevel: 84, quality: 20, extras: 0, sort: 'dust', category: null },
    cards: { sort: 'rare', tier: null, area: null },
    sockets: { base: 'Vaal Regalia', reqs: [0, 0, 194], count: 6, itemLevel: 84, quality: 20 }
  }
}
