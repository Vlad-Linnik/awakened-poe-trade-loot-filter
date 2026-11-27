import { shallowRef } from 'vue'
import type { ParsedItem } from '@/parser'

// the last item checked (price check / loot filter), for the Divine tab of the codex,
// which opens by hotkey without an item
export const lastDivineItem = shallowRef<ParsedItem | null>(null)

export function rememberDivineItem (item: ParsedItem | null | undefined) {
  if (item) lastDivineItem.value = item
}
