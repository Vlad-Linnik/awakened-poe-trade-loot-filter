// FilterBlade-like category tree for NeverSink filters.
// FilterBlade's tree lives in its own customizer definition, not in the .filter file.
// The category and subcategory names and their order below follow filterblade.xyz
// (Customize page, PoE 1); NeverSink rules are placed into them by their tags and sections.
// Icons are item art from the app's item data (see fb.ts).

import type { FilterBlock } from './filter-parser'

export type GroupId = 'rewards' | 'endgame' | 'campaign' | 'misc'

export interface Category {
  id: string
  group: GroupId
  title: string
  // a base type whose icon represents the category
  icon: string
  // subcategories in FilterBlade's order
  subs: string[]
}

export const GROUPS: Array<{ id: GroupId, title: string }> = [
  { id: 'rewards', title: 'Currency & Rewards' },
  { id: 'endgame', title: 'Endgame (level 68+)' },
  { id: 'campaign', title: 'Campaign (level 1-67)' },
  { id: 'misc', title: 'Miscellaneous' }
]

export const CATEGORIES: Category[] = [
  {
    id: 'currency',
    group: 'rewards',
    title: 'Currency',
    icon: 'Chaos Orb',
    subs: ['General Currency', 'Currency Stacks', 'Campaign Special Rules', 'Delve Fossils & Resonators', 'Delirium Orbs', 'Blight Oils', "Heist Rogue's Markers", 'Essences', 'Misc. Exotic Currencies']
  },
  { id: 'uniques', group: 'rewards', title: 'Unique items', icon: 'Headhunter', subs: ['Tierlist', 'Multi-Unique Bases'] },
  { id: 'cards', group: 'rewards', title: 'Divination Cards', icon: 'The Doctor', subs: ['Tierlist', 'Exotics: Stacked Card Drops'] },
  { id: 'recipes', group: 'rewards', title: 'Vendor Recipes', icon: 'Chromatic Orb', subs: ['Chromatic Orb', "Gemcutter's Prism", "Jeweller's Orbs", '+1 Skill Gem Recipes', "Glassblower's Bauble"] },
  { id: 'gold', group: 'rewards', title: 'Gold', icon: 'Exotic Coinage', subs: ['Gold'] },
  {
    id: 'league',
    group: 'rewards',
    title: 'Current League',
    icon: 'Burial Idol',
    subs: ['Viscera', 'Unidentified Item Tiers', 'Allflame Embers & Map Enchant Currency', 'Fated Item Treatment', 'Enshrouded Items']
  },
  {
    id: 'fragments',
    group: 'endgame',
    title: 'Fragments and Splinters',
    icon: 'Fragment of Emptiness',
    subs: ['Map Fragments & Invitations', 'Stacked Sacrifice Fragments', 'Simulacrum Splinters', 'Legion Splinters - Single', 'Legion Splinters - High Tier (Stacked)', 'Legion Splinters - Low Tier (Stacked)']
  },
  {
    id: 'maps',
    group: 'endgame',
    title: 'Endgame - Maps, Contracts, Logbooks etc',
    icon: 'Map',
    subs: ['Maps - Highlight and Hide', 'Maps - Influenced, Nightmare, Unique and Exotics', 'Maps - Normal Map Progression', 'Heist Contracts and Blueprints', 'Ultimatum, Sanctum, Incursion', 'Reliquary Keys', 'Expedition Logbooks']
  },
  {
    id: 'rares',
    group: 'endgame',
    title: 'Endgame - Rares',
    icon: 'Vaal Regalia',
    subs: ['Hide Corrupted, Outleveled, [...] Rares', 'Decorators', 'Jewellery', 'Weapons and Armours']
  },
  {
    id: 'crafting',
    group: 'endgame',
    title: 'Endgame - Special Bases & Crafting',
    icon: 'Orb of Fusing',
    subs: ['Valuable Basetypes (poe.ninja)', 'Exotic Basetypes', 'Memory-Stranded Items', 'High Level Crafting Bases', 'Fractured Items', 'Influenced Items', 'Veiled Items', 'Linked Items', 'Exotic Basetypes: Special Cases', 'Overquality, Synthesized & Other Items']
  },
  {
    id: 'jewels',
    group: 'endgame',
    title: 'Endgame - Jewels, Flasks, Tinctures',
    icon: 'Cobalt Jewel',
    subs: ['High Level Utility Flasks', 'Endgame Life & Mana Flasks', 'Exceptional Quality Flasks', 'Tinctures', 'Cobalt, Viridian, Crimson Jewels', 'Abyss Jewels', 'Cluster Jewels: Top Enchantments', 'Cluster Jewels: Good Enchantments', 'Cluster Jewels: Any Enchantment']
  },
  {
    id: 'leveling',
    group: 'campaign',
    title: 'Campaign & Leveling',
    icon: 'Scroll of Wisdom',
    subs: ['Colors and Links', 'Flasks', 'Rare items', 'Act- & Build-specific items', 'Item Progression', 'Other Normal and magic Items']
  },
  {
    id: 'leaguemods',
    group: 'misc',
    title: 'League-specific items and mods',
    icon: "Rogue's Marker",
    subs: ['Special Wombgift Rules', 'Wombgift Tiering', 'Trinkets & Relics', 'Corpses for Spectres', 'Curse of the Allflame', 'Abyss socketed items', 'Blight Anointed Items', 'Identified Mods: Incursion', 'Identified Mods: Delve', 'Identified Mods: Essence', 'Identified Mods: Mercenaries', 'Identified Mods: Bestiary', 'Identified Mods: Warband', 'Currently Unobtainable']
  },
  {
    id: 'misc',
    group: 'misc',
    title: 'Miscellaneous',
    icon: 'Orb of Scouring',
    subs: ['Skill Gems', 'Exotic Unique Rules', 'Heist Follower Equipment', 'Identified Mod Filtering', 'Misc. Items']
  }
]

// [pattern, category id, subcategory] tested against "type=..;tier=..;top=..;sec=.." — the first match wins
const RULES: Array<[RegExp, string, string]> = [
  // campaign
  [/type=leveling->flasks|type=leveling->tincture/, 'leveling', 'Flasks'],
  [/type=leveling->rare->socketslinks|type=leveling->normalmagic->[34]l/, 'leveling', 'Colors and Links'],
  [/type=leveling->rare|type=decorators->leveling->rare/, 'leveling', 'Rare items'],
  [/type=leveling->normalmagic->act/, 'leveling', 'Act- & Build-specific items'],
  [/type=leveling->(weaponprogression|wandprogression|firstlevels)/, 'leveling', 'Item Progression'],
  [/type=leveling|type=decorators->leveling|type=jewels->leveling|top=hide outdated leveling|top=leveling/, 'leveling', 'Other Normal and magic Items'],
  [/type=currency->leveling/, 'currency', 'Campaign Special Rules'],
  [/type=gems/, 'misc', 'Skill Gems'],
  // currency & rewards
  [/type=gold/, 'gold', 'Gold'],
  [/type=currency->stackedsplintershigh/, 'fragments', 'Legion Splinters - High Tier (Stacked)'],
  [/type=currency->stackedsplinterslow/, 'fragments', 'Legion Splinters - Low Tier (Stacked)'],
  [/type=currency->splinter->simulacrum/, 'fragments', 'Simulacrum Splinters'],
  [/type=currency->splinter/, 'fragments', 'Legion Splinters - Single'],
  [/type=currency->(heist|leagueexclusive)/, 'currency', "Heist Rogue's Markers"],
  [/type=currency->stacked/, 'currency', 'Currency Stacks'],
  [/type=currency->deliriumorbs/, 'currency', 'Delirium Orbs'],
  [/type=currency->fossil/, 'currency', 'Delve Fossils & Resonators'],
  [/type=currency->oil/, 'currency', 'Blight Oils'],
  [/type=currency->essence/, 'currency', 'Essences'],
  [/type=currency->ducats|type=mapenchantments/, 'league', 'Allflame Embers & Map Enchant Currency'],
  [/type=currency->/, 'currency', 'Misc. Exotic Currencies'],
  [/type=currency;/, 'currency', 'General Currency'],
  [/type=runesgrafts|type=corpses/, 'leaguemods', 'Corpses for Spectres'],
  [/type=exotic->wombgifts/, 'leaguemods', 'Wombgift Tiering'],
  [/type=divination;tier=(excustomstack|exstack)/, 'cards', 'Exotics: Stacked Card Drops'],
  [/type=divination/, 'cards', 'Tierlist'],
  [/type=uniques->maps/, 'maps', 'Maps - Influenced, Nightmare, Unique and Exotics'],
  [/type=uniques->heist/, 'maps', 'Heist Contracts and Blueprints'],
  [/type=uniques->(replicas|foulborn)|type=uniques;.*sec=exceptions/, 'misc', 'Exotic Unique Rules'],
  [/type=uniques;.*sec=multi-unique/, 'uniques', 'Multi-Unique Bases'],
  [/type=uniques/, 'uniques', 'Tierlist'],
  [/type=viscera/, 'league', 'Viscera'],
  [/type=gear->tiered/, 'league', 'Unidentified Item Tiers'],
  [/tier=fated/, 'league', 'Fated Item Treatment'],
  [/type=enshrouded/, 'league', 'Enshrouded Items'],
  [/type=event->idols/, 'leaguemods', 'Currently Unobtainable'],
  // endgame
  [/type=fragments|type=miscmapitems;/, 'fragments', 'Map Fragments & Invitations'],
  [/type=maps->influenced|type=maps->(nightmare|blighted|vaaltemple|specialmods|enchanted)/, 'maps', 'Maps - Influenced, Nightmare, Unique and Exotics'],
  [/type=maps;tier=(maps_|restex)/, 'maps', 'Maps - Normal Map Progression'],
  [/type=maps/, 'maps', 'Maps - Highlight and Hide'],
  [/type=heist->(contract|blueprint)/, 'maps', 'Heist Contracts and Blueprints'],
  [/type=exoticmap->sanctum|type=charts/, 'maps', 'Ultimatum, Sanctum, Incursion'],
  [/type=miscmapitemsextra/, 'maps', 'Reliquary Keys'],
  [/type=expedition->logbook/, 'maps', 'Expedition Logbooks'],
  [/type=decorators->rareeg/, 'rares', 'Decorators'],
  [/type=rr->(amuring|belts)/, 'rares', 'Jewellery'],
  [/type=rr/, 'rares', 'Weapons and Armours'],
  [/type=hidelayer/, 'rares', 'Hide Corrupted, Outleveled, [...] Rares'],
  [/type=exoticbases/, 'crafting', 'Exotic Basetypes'],
  [/type=gear->memorystrand/, 'crafting', 'Memory-Stranded Items'],
  [/type=crafting->generalgear/, 'crafting', 'High Level Crafting Bases'],
  [/type=exotic->fractured/, 'crafting', 'Fractured Items'],
  [/type=influenced|type=rare->(exarch|eater)/, 'crafting', 'Influenced Items'],
  [/type=rare->exotic->veiled|type=exoticmods;.*sec=identified mods - low priority veiled/, 'crafting', 'Veiled Items'],
  // vendor recipes: RGB items -> chromatic orbs, 6 sockets -> jeweller's orbs
  [/type=socketslinks;tier=rgb/, 'recipes', 'Chromatic Orb'],
  [/type=socketslinks;tier=(6sockets|5link6sockets)/, 'recipes', "Jeweller's Orbs"],
  [/type=6l|type=socketslinks/, 'crafting', 'Linked Items'],
  [/type=exotic->crucible/, 'crafting', 'Exotic Basetypes: Special Cases'],
  [/type=crafting->qualityperfection|type=exotic->corruptions/, 'crafting', 'Overquality, Synthesized & Other Items'],
  [/type=endgametinctures/, 'jewels', 'Tinctures'],
  [/type=endgameflasks;tier=overqual/, 'jewels', 'Exceptional Quality Flasks'],
  [/type=endgameflasks;.*sec=(utility flasks|endgame flasks - high level utility)/, 'jewels', 'High Level Utility Flasks'],
  [/type=endgameflasks/, 'jewels', 'Endgame Life & Mana Flasks'],
  [/type=jewels->abyss/, 'jewels', 'Abyss Jewels'],
  [/type=jewels->clustereco/, 'jewels', 'Cluster Jewels: Top Enchantments'],
  [/type=jewels->cluster/, 'jewels', 'Cluster Jewels: Any Enchantment'],
  [/type=jewels/, 'jewels', 'Cobalt, Viridian, Crimson Jewels'],
  // league-specific & misc
  [/type=artefact|type=questlikeexception/, 'leaguemods', 'Trinkets & Relics'],
  [/type=exotic->sockets/, 'leaguemods', 'Abyss socketed items'],
  [/type=exotic->enchanted/, 'leaguemods', 'Blight Anointed Items'],
  [/type=exoticmods;.*sec=identified mods - incursion|type=exoticmods;tier=incursion/, 'leaguemods', 'Identified Mods: Incursion'],
  [/type=exoticmods;tier=(delve|delvefractured)/, 'leaguemods', 'Identified Mods: Delve'],
  [/type=exoticmods;tier=essence/, 'leaguemods', 'Identified Mods: Essence'],
  [/type=exoticmods;tier=mercenary/, 'leaguemods', 'Identified Mods: Mercenaries'],
  [/type=exoticmods;.*sec=bestiary|type=exoticmods;tier=bestiary/, 'leaguemods', 'Identified Mods: Bestiary'],
  [/type=exoticmods;tier=warband/, 'leaguemods', 'Identified Mods: Warband'],
  [/type=exoticmods;.*sec=necropolis/, 'leaguemods', 'Curse of the Allflame'],
  [/type=heist->/, 'misc', 'Heist Follower Equipment'],
  [/type=(rareid|rareblendid|magicid|corruptedid|exoticmods)/, 'misc', 'Identified Mod Filtering'],
  [/./, 'misc', 'Misc. Items']
]

export function placeOf (block: FilterBlock): { category: Category, sub: string } {
  const key = `type=${block.tags.type ?? ''};tier=${block.tags.tier ?? ''};top=${block.topSection ?? ''};sec=${block.section ?? ''}`.toLowerCase()
  const [, id, sub] = RULES.find(([re]) => re.test(key))!
  return { category: CATEGORIES.find(c => c.id === id)!, sub }
}

export function categoryOf (block: FilterBlock): Category {
  return placeOf(block).category
}
