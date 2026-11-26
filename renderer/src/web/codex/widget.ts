import type { Widget } from '@/web/overlay/interfaces'
import type { CardTier } from './cards'

export interface CodexWidget extends Widget {
  hotkey: string | null
  tab: 'dust' | 'cards'
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
}

export function codexDefaults (): Omit<CodexWidget, keyof Widget> {
  return {
    hotkey: 'Ctrl + Shift + U',
    tab: 'dust',
    dust: { itemLevel: 84, quality: 20, extras: 0, sort: 'dust', category: null },
    cards: { sort: 'rare', tier: null, area: null }
  }
}
