// Readable names for NeverSink/FilterBlade tiers.
// FilterBlade's own tier names live in its database, the .filter file only has tags
// like `$type->currency->stackedsupplieswisdom $tier->t1`, so names are built from
// the tags, the section titles and the rule's key conditions.

import type { FilterBlock, FilterLine } from './filter-parser'

type T = (key: string, args?: unknown[]) => string

// words used in NeverSink tags, longest first when splitting "stackedsupplieswisdom"
const WORDS: Record<string, string> = {
  abyss: 'Abyss',
  act: 'Act',
  alchemy: 'Alchemy',
  all: 'All',
  alt: 'Alt',
  amu: 'Amulet',
  amulets: 'Amulets',
  amuring: 'Amulets & Rings',
  annul: 'Annulment',
  anointed: 'Anointed',
  any: 'Any',
  archer: 'Archer',
  armors: 'Armours',
  armour: 'Armour',
  armours: 'Armours',
  asorted: 'Assorted',
  attack: 'Attack',
  aug: 'Augmentation',
  bases: 'Bases',
  based: 'based',
  basetypes: 'Bases',
  belt: 'Belt',
  belts: 'Belts',
  bestiary: 'Bestiary',
  blades: 'Blades',
  blade: 'Blade',
  blast: 'Blast',
  bleed: 'Bleed',
  blend: 'Blend',
  blighted: 'Blighted',
  blocker: 'Blocker',
  blueprint: 'Blueprint',
  body: 'Body',
  bodyarmours: 'Body Armours',
  boots: 'Boots',
  boss: 'Boss',
  bow: 'Bow',
  brooch: 'Brooch',
  burial: 'Burial',
  caster: 'Caster',
  chance: 'Chance',
  chancing: 'Chancing',
  chaos: 'Chaos',
  charts: 'Charts',
  chrom: 'Chromatic',
  classes: 'Classes',
  cloak: 'Cloak',
  cluster: 'Cluster',
  coins: 'Coins',
  cold: 'Cold',
  conqueror: 'Conqueror',
  conquerors: 'Conquerors',
  consumable: 'Consumable',
  contract: 'Contract',
  core: 'Core',
  corpses: 'Corpses',
  corrupted: 'Corrupted',
  corruptions: 'Corruptions',
  craft: 'Craft',
  crafting: 'Crafting',
  crit: 'Crit',
  crucible: 'Crucible',
  crusader: 'Crusader',
  currency: 'Currency',
  custom: 'Custom',
  decor: 'Decorator',
  deco: 'Decorator',
  decorators: 'Decorators',
  defense: 'Defence',
  delirium: 'Delirium',
  delve: 'Delve',
  divination: 'Divination Cards',
  divine: 'Divine',
  dot: 'DoT',
  double: 'Double',
  ducats: 'Ducats',
  duo: 'Duo',
  early: 'Early',
  eater: 'Eater',
  ele: 'Elemental',
  elder: 'Elder',
  elemental: 'Elemental',
  enchanted: 'Enchanted',
  endgame: 'Endgame',
  enshrouded: 'Enshrouded',
  es: 'ES',
  essence: 'Essence',
  essences: 'Essences',
  event: 'Event',
  exalted: 'Exalted',
  exalter: 'Exalter',
  exarch: 'Exarch',
  exception: 'Exception',
  exceptional: 'Exceptional',
  exotic: 'Exotic',
  exotics: 'Exotics',
  expedition: 'Expedition',
  fated: 'Fated',
  final: 'Final',
  fire: 'Fire',
  first: 'First',
  fishing: 'Fishing',
  flask: 'Flask',
  flasks: 'Flasks',
  focus: 'Focus',
  forge: 'Forge',
  fossil: 'Fossil',
  foulborn: 'Foulborn',
  four: 'Four',
  fract: 'Fractured',
  fractured: 'Fractured',
  fragments: 'Fragments',
  gear: 'Gear',
  gem: 'Gem',
  gems: 'Gems',
  general: 'General',
  generic: 'Generic',
  gloves: 'Gloves',
  glove: 'Gloves',
  gold: 'Gold',
  guardian: 'Guardian',
  handpicked: 'Handpicked',
  harvest: 'Harvest',
  heist: 'Heist',
  helm: 'Helmet',
  helmet: 'Helmet',
  hidelayer: 'Hide layer',
  hide: 'Hide',
  hideable: 'Hideable',
  high: 'High',
  highlevel: 'High level',
  hit: 'Hit',
  hunter: 'Hunter',
  hybrid: 'Hybrid',
  id: 'Identified',
  idols: 'Idols',
  imbued: 'Imbued',
  implicit: 'Implicit',
  implicits: 'Implicits',
  incursion: 'Incursion',
  infelder: 'Elder influenced',
  influenced: 'Influenced',
  invitations: 'Invitations',
  itemized: 'Itemized',
  items: 'Items',
  jewellery: 'Jewellery',
  jewels: 'Jewels',
  jwlry: 'Jewellery',
  kamasan: 'Kamasan',
  keys: 'Keys',
  labyrinth: 'Labyrinth',
  large: 'Large',
  league: 'League',
  leagues: 'Leagues',
  leveled: 'Levelled',
  leveling: 'Leveling',
  levels: 'Levels',
  life: 'Life',
  lifeforce: 'Lifeforce',
  light: 'Lightning',
  link: 'Link',
  links: 'Links',
  linked: 'Linked',
  logbook: 'Logbook',
  low: 'Low',
  magic: 'Magic',
  mana: 'Mana',
  mapenchantments: 'Map enchantments',
  mapping: 'Mapping',
  maps: 'Maps',
  map: 'Map',
  mapup: 'Map upgrade',
  max: 'Max',
  medium: 'Medium',
  melee: 'Melee',
  memory: 'Memory',
  memorystrand: 'Memory strands',
  mercenary: 'Mercenary',
  minion: 'Minion',
  minor: 'Minor',
  mirage: 'Mirage',
  mirrored: 'Mirrored',
  misc: 'Misc',
  mixer: 'Mixer',
  mod: 'Mod',
  mods: 'Mods',
  movement: 'Movement',
  multi: 'Multi',
  necropolis: 'Necropolis',
  nightmare: 'Nightmare',
  noble: 'Noble',
  non: 'non-',
  normal: 'Normal',
  normalmagic: 'Normal & Magic',
  notice: 'Notice',
  oil: 'Oils',
  omen: 'Omens',
  optimal: 'Optimal',
  other: 'Other',
  others: 'Others',
  outdated: 'Outdated',
  overqual: 'Overquality',
  overquality: 'Overquality',
  perf: 'Perfection',
  perfection: 'Perfection',
  phys: 'Physical',
  physical: 'Physical',
  pieces: 'Pieces',
  portal: 'Portal',
  presence: 'Presence',
  proj: 'Projectile',
  pure: 'Pure',
  qual: 'Quality',
  quality: 'Quality',
  qualityperfection: 'Quality & Perfection',
  quest: 'Quest',
  questlike: 'Quest-like',
  quicksilver: 'Quicksilver',
  quiv: 'Quiver',
  quiver: 'Quiver',
  quivers: 'Quivers',
  rare: 'Rare',
  rares: 'Rares',
  rareid: 'Identified rares',
  rational: 'Rational',
  redeemer: 'Redeemer',
  relic: 'Relic',
  relics: 'Relics',
  remaining: 'Remaining',
  replicas: 'Replicas',
  resist: 'Resist',
  rest: 'Rest',
  rgb: 'RGB',
  ring: 'Ring',
  rings: 'Rings',
  rods: 'Rods',
  runesgrafts: 'Runes & Grafts',
  safe: 'Safe',
  sanctum: 'Sanctum',
  scroll: 'Scroll',
  selected: 'Selected',
  shaper: 'Shaper',
  shared: 'Shared',
  shield: 'Shield',
  shields: 'Shields',
  silver: 'Silver',
  single: 'Single',
  slinger: 'Slinger',
  small: 'Small',
  sockets: 'Sockets',
  socketed: 'Socketed',
  special: 'Special',
  specialclasses: 'Special classes',
  speed: 'Speed',
  splinter: 'Splinters',
  spell: 'Spell',
  stack: 'Stack',
  stacked: 'Stacked',
  staves: 'Staves',
  stranded: 'Stranded',
  stygian: 'Stygian',
  suppress: 'Suppression',
  supplies: 'Supplies',
  sword: 'Sword',
  synth: 'Synthesised',
  tabula: 'Tabula',
  tattoo: 'Tattoos',
  three: 'Three',
  tiered: 'Tiered',
  tiny: 'Tiny',
  tincture: 'Tincture',
  tinctures: 'Tinctures',
  tool: 'Tool',
  top: 'Top',
  totemic: 'Totemic',
  traps: 'Traps',
  trans: 'Transmutation',
  trinket: 'Trinket',
  uber: 'Uber',
  ultimatum: 'Ultimatum',
  uncorrupted: 'Uncorrupted',
  underlevel: 'Under level',
  uniques: 'Uniques',
  unique: 'Unique',
  universal: 'Universal',
  until: 'until',
  utility: 'Utility',
  util: 'Utility',
  vaal: 'Vaal',
  valdo: 'Valdo',
  valuable: 'Valuable',
  veil: 'Veiled',
  veiled: 'Veiled',
  very: 'Very',
  vestige: 'Vestige',
  voidstones: 'Voidstones',
  wand: 'Wand',
  warband: 'Warband',
  warlord: 'Warlord',
  weapon: 'Weapon',
  weapons: 'Weapons',
  wisdom: 'Wisdom',
  zana: 'Zana',
  zone: 'Zone'
}
const WORD_KEYS = Object.keys(WORDS).sort((a, b) => b.length - a.length)

// "stackedsupplieswisdom" -> "Stacked Supplies Wisdom"; unknown parts are kept as is
export function splitWords (code: string): string {
  const out: string[] = []
  for (const part of code.split(/[_\s]+/).filter(Boolean)) {
    let rest = part.toLowerCase()
    let unknown = ''
    while (rest.length) {
      const num = /^\d+/.exec(rest)
      if (num) {
        if (unknown) { out.push(unknown); unknown = '' }
        out.push(num[0])
        rest = rest.slice(num[0].length)
        continue
      }
      const word = WORD_KEYS.find(w => rest.startsWith(w))
      if (word) {
        if (unknown) { out.push(unknown); unknown = '' }
        out.push(WORDS[word])
        rest = rest.slice(word.length)
      } else {
        unknown += rest[0]
        rest = rest.slice(1)
      }
    }
    if (unknown) out.push(unknown)
  }
  return out.join(' ').replace(/\s+/g, ' ').trim()
}

// tier tag -> readable name
export function tierName (tier: string, t: T): string {
  let m: RegExpExecArray | null
  if (tier === 'restex' || tier === 'rest') return t(':tn_rest')
  if (tier === 'exstack') return t(':tn_stacks')
  if (tier === 'excustomstack') return t(':tn_custom_stack')
  if (tier === 'exhide') return t(':tn_hidden')
  // "ex" = exception: ex6link -> 6link
  if ((m = /^ex(?=[a-z0-9])(.*)$/.exec(tier)) && !WORD_KEYS.some(w => w.startsWith('ex') && tier.startsWith(w))) return tierName(m[1], t)
  // twisdom, tportal: the tier of one currency
  if ((m = /^t([a-z]{3,})$/.exec(tier))) return splitWords(m[1])
  if ((m = /^t(\d+)c$/.exec(tier))) return `${t(':tn_tier', [m[1]])} · ${t(':tn_currency_rewards')}`
  if ((m = /^t(\d+)r(\d+)$/.exec(tier))) return `${t(':tn_tier', [m[1]])} · ${t(':tn_rank', [m[2]])}`
  if ((m = /^t(\d+)_(\d+)$/.exec(tier))) return `${t(':tn_tier', [m[1]])} · iLvl ${m[2]}`
  if ((m = /^t(\d+)(\D.*)?$/.exec(tier))) return m[2] ? `${t(':tn_tier', [m[1]])} · ${splitWords(m[2])}` : t(':tn_tier', [m[1]])
  if ((m = /^maps_[a-d]_t(\d+)$/.exec(tier))) return t(':tn_maps_tier', [m[1]])
  if ((m = /^deco_mapup_t(\d+)$/.exec(tier))) return t(':tn_map_upgrade', [m[1]])
  if ((m = /^deco_zone(\d)general$/.exec(tier))) return t(':tn_map_zone', [m[1]])
  if ((m = /^underlevel(\d+)$/.exec(tier))) return t(':tn_under_level', [m[1]])
  if ((m = /^(?:top)?ilvl(\d+)$/.exec(tier)) || (m = /^topilvl(\d+)$/.exec(tier))) return `${t(':tn_top')} iLvl ${m[1]}`
  if ((m = /^n(\d+)_i(\d+)_t(\d+)$/.exec(tier))) return `${t(':tn_tier', [m[3]])} · iLvl ${m[2]}`
  if ((m = /^(stack|stacklvl)(\d+)$/.exec(tier))) return t(':tn_stack_n', [m[2]])
  if ((m = /^(\d)links?(.*)$/.exec(tier))) return `${t(':tn_links', [m[1]])}${m[2] ? ' · ' + splitWords(m[2]) : ''}`
  if ((m = /^(\d)s(?:ockets)?(.*)$/.exec(tier))) return `${t(':tn_sockets', [m[1]])}${m[2] ? ' · ' + splitWords(m[2]) : ''}`
  if ((m = /^(r|l|lt|qt|w|v)(\d+)(.*)$/.exec(tier))) return `${splitWords(m[1] === 'qt' ? 'quality' : m[1] === 'l' || m[1] === 'lt' ? 'leveling' : m[1] === 'r' ? 'rares' : m[1] === 'w' ? 'weapons' : 'vaal')} ${m[2]}${m[3] ? ' · ' + splitWords(m[3]) : ''}`
  return splitWords(tier.replace(/^ex(?=[a-z])/, ''))
}

// the last part of the type tag: `currency->stackedsupplieswisdom` -> "Stacked Supplies Wisdom"
export function typeName (type: string): string {
  return splitWords(type.split('->').pop()!)
}

// short readable notes about the rule's key conditions
export function conditionHints (block: FilterBlock, t: T): string[] {
  const out: string[] = []
  const num = (c: FilterLine) => `${c.op && c.op !== '=' && c.op !== '==' ? c.op + ' ' : ''}${c.values.join(', ')}`
  for (const c of block.conditions) {
    switch (c.keyword) {
      case 'StackSize': out.push(t(':hint_stack', [num(c)])); break
      case 'AreaLevel': out.push(t(':hint_area', [num(c)])); break
      case 'ItemLevel': out.push(`iLvl ${num(c)}`); break
      case 'LinkedSockets': out.push(t(':hint_links', [num(c)])); break
      case 'Sockets': out.push(t(':hint_sockets', [num(c)])); break
      case 'Quality': out.push(t(':hint_quality', [num(c)])); break
      case 'MapTier': out.push(t(':hint_map_tier', [num(c)])); break
      case 'GemLevel': out.push(t(':hint_gem_level', [num(c)])); break
      case 'Rarity': out.push(c.values.join('/')); break
      case 'Corrupted': out.push(/true/i.test(c.values[0]) ? t(':hint_corrupted') : t(':hint_not_corrupted')); break
      case 'Mirrored': if (/true/i.test(c.values[0])) out.push(t(':hint_mirrored')); break
      case 'Identified': out.push(/true/i.test(c.values[0]) ? t(':hint_identified') : t(':hint_unidentified')); break
      case 'FracturedItem': if (/true/i.test(c.values[0])) out.push(t(':hint_fractured')); break
      case 'SynthesisedItem': if (/true/i.test(c.values[0])) out.push(t(':hint_synthesised')); break
      case 'HasInfluence': out.push(t(':hint_influence', [c.values.join('/')])); break
      case 'HasExplicitMod': out.push(t(':hint_mods')); break
      case 'BaseType': out.push(t(':hint_items', [c.values.length])); break
    }
  }
  return [...new Set(out)]
}

export function blockTierName (block: FilterBlock, t: T): string {
  if (block.tags.tier) return tierName(block.tags.tier, t)
  if (block.tags.type) return typeName(block.tags.type)
  return block.headerComment || `#${block.index + 1}`
}

// "Supplies: Wisdom Stacking — Tier 1"
// NeverSink's catch-all sections ("All rules - except gold and six-links") say nothing about the rule
const GENERIC_SECTION = /^(all rules|global|exceptions?\b)/i

export function blockTitle (block: FilterBlock, t: T): string {
  let context = block.section ?? block.topSection ?? ''
  if ((!context || GENERIC_SECTION.test(context)) && block.tags.type) {
    // "maps->influenced" -> "Maps › Influenced"
    context = block.tags.type.split('->').map(p => splitWords(p)).join(' › ')
  }
  const name = blockTierName(block, t)
  return context ? `${context} — ${name}` : name
}
