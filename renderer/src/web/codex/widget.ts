import type { Widget } from '@/web/overlay/interfaces'

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
}

export function codexDefaults (): Omit<CodexWidget, keyof Widget> {
  return {
    hotkey: 'Ctrl + Shift + U',
    tab: 'dust',
    dust: { itemLevel: 84, quality: 20, extras: 0, sort: 'dust', category: null }
  }
}
