import { shallowRef } from 'vue'
import type { ParsedItem } from '@/parser'
import { AppConfig } from '@/web/Config'
import type { WidgetManager } from '../overlay/interfaces'
import type { CodexWidget } from './widget'
import type { Reqs } from './sockets'
import { BASE_REQS } from './data'
import { lastDivineItem } from './divine/last-item'

type Color = 'R' | 'G' | 'B' | 'W'

// socket colours of the item the Sockets tab was opened for, until its settings change
export const socketsFromItem = shallowRef<Color[] | null>(null)

function show (wm: WidgetManager, tab: CodexWidget['tab']) {
  const codex = AppConfig<CodexWidget>('codex')
  if (!codex) return null
  codex.tab = tab
  wm.show(codex.wmId)
  return codex
}

/** Opens the codex in the middle of the screen on the Divine Orb tab, for this item. */
export function openDivineCalc (wm: WidgetManager, item: ParsedItem) {
  lastDivineItem.value = item
  show(wm, 'divine')
}

/** Opens the codex on the Sockets tab, set up for an item with these sockets. */
export function openSocketCalc (wm: WidgetManager, opts: {
  colors: Color[]
  baseRef: string
  reqs: Reqs
  itemLevel: number
  quality: number
}) {
  const codex = AppConfig<CodexWidget>('codex')
  if (!codex) return
  codex.sockets = {
    base: (opts.baseRef in BASE_REQS) ? opts.baseRef : null,
    reqs: [...opts.reqs] as Reqs,
    count: opts.colors.length,
    itemLevel: opts.itemLevel,
    quality: opts.quality
  }
  socketsFromItem.value = [...opts.colors]
  show(wm, 'sockets')
}
