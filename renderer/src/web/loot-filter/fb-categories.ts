// FilterBlade-like category tree for NeverSink filters.
// FilterBlade's own tree lives in its customizer definition, not in the .filter file,
// so NeverSink's `[[xxxx]] Section` titles are mapped to similar categories here.
// Icons are item art from the app's item data (see fb.ts).

import type { FilterBlock } from './filter-parser'

export interface Category {
  id: string
  group: 'rewards' | 'endgame' | 'campaign' | 'misc'
  title: string
  // a base type whose icon represents the category
  icon: string
  // tested against "<top section> / <section>"
  match: RegExp
}

// order matters: the first match wins
export const CATEGORIES: Category[] = [
  { id: 'leveling', group: 'campaign', title: 'Campaign & Leveling', icon: 'Scroll of Wisdom', match: /leveling|hide outdated|first zones|campaign|\bacts?\b/i },
  { id: 'gold', group: 'rewards', title: 'Gold', icon: 'Exotic Coinage', match: /^gold\b|including gold/i },
  { id: 'cards', group: 'rewards', title: 'Divination Cards', icon: 'The Doctor', match: /divination|cards/i },
  { id: 'uniques', group: 'rewards', title: 'Unique items', icon: 'Headhunter', match: /uniques|replica|foulborn|questlike-items1|heist targets/i },
  { id: 'fragments', group: 'endgame', title: 'Fragments and Splinters', icon: 'Fragment of Emptiness', match: /fragment|splinter/i },
  { id: 'currency', group: 'rewards', title: 'Currency', icon: 'Chaos Orb', match: /currency|lifeforce|oils|fossils|essences|delirium orbs|ducats|omens|tattoos|runes/i },
  { id: 'recipes', group: 'rewards', title: 'Vendor Recipes', icon: 'Chromatic Orb', match: /recipes|link based|5links|rgb/i },
  { id: 'league', group: 'rewards', title: 'Current League', icon: 'Burial Idol', match: /idols|event league|enshrouded/i },
  { id: 'maps', group: 'endgame', title: 'Endgame - Maps, Contracts, Logbooks etc', icon: 'Map', match: /maps?\b|map items|maplike|contracts|logbooks|blueprints|memories|relic keys|reliquary/i },
  { id: 'rares', group: 'endgame', title: 'Endgame - Rares', icon: 'Vaal Regalia', match: /endgame - rare|hide layer|hidelayer|rare endgame/i },
  { id: 'jewels', group: 'endgame', title: 'Endgame - Jewels, Flasks, Tinctures', icon: 'Cobalt Jewel', match: /jewels?|flasks?|tinctures?/i },
  { id: 'crafting', group: 'endgame', title: 'Endgame - Special Bases & Crafting', icon: 'Orb of Fusing', match: /crafting|exotic bases|high priority equipment|influenced|eldritch|item variations|special/i },
  { id: 'idmods', group: 'endgame', title: 'Endgame - Identified Mods', icon: 'Divine Orb', match: /identified mod|exotic mods|mod filtering/i },
  { id: 'gems', group: 'misc', title: 'Gems', icon: 'Fireball', match: /gem/i },
  { id: 'leaguemods', group: 'misc', title: 'League-specific items and mods', icon: "Rogue's Marker", match: /heist|exotic item classes|questlike|voidstones|sanctum|ultimatum|incursion|expedition/i },
  { id: 'misc', group: 'misc', title: 'Miscellaneous', icon: 'Orb of Scouring', match: /./ }
]

export const GROUPS: Array<{ id: Category['group'], title: string }> = [
  { id: 'rewards', title: 'Currency & Rewards' },
  { id: 'endgame', title: 'Endgame (level 68+)' },
  { id: 'campaign', title: 'Campaign (level 1-67)' },
  { id: 'misc', title: 'Miscellaneous' }
]

export function categoryOf (block: FilterBlock): Category {
  const key = `${block.topSection ?? ''} / ${block.section ?? ''}`
  return CATEGORIES.find(c => c.match.test(key))!
}
