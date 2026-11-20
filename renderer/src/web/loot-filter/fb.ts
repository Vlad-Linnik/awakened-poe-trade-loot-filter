// Helpers for the FilterBlade-like UI: item icons and minimap icon glyphs.
// Icons are the game's own item art (web.poecdn.com) from the app's item data.

import { ITEM_BY_REF } from '@/assets/data'
import type { FilterBlock } from './filter-parser'

const NAMESPACES = ['ITEM', 'DIVINATION_CARD', 'GEM', 'UNIQUE'] as const

// item data has placeholders like "%NOT_FOUND%" for some items: never use them as <img src>
export function safeIcon (icon: string | null | undefined): string | null {
  if (!icon) return null
  return (icon.startsWith('https://') || icon.startsWith('/images/')) ? icon : null
}

const iconCache = new Map<string, string | null>()
export function iconForBase (name: string): string | null {
  if (iconCache.has(name)) return iconCache.get(name)!
  let icon: string | null = null
  for (const ns of NAMESPACES) {
    const found = ITEM_BY_REF(ns, name)?.find(b => safeIcon(b.icon))
    if (found) { icon = safeIcon(found.icon); break }
  }
  iconCache.set(name, icon)
  return icon
}

// a typical item of a class, for rules that list classes but no base types
const CLASS_SAMPLE: Array<[RegExp, string]> = [
  [/Divination/i, 'The Doctor'],
  [/Stackable Currency|Currency/i, 'Chaos Orb'],
  [/Map Fragments/i, 'Sacrifice at Dawn'],
  [/Maps/i, 'Strand Map'],
  [/Body Armours/i, 'Vaal Regalia'],
  [/Helmets/i, 'Hubris Circlet'],
  [/Gloves/i, 'Sorcerer Gloves'],
  [/Boots/i, 'Sorcerer Boots'],
  [/Shields/i, 'Titanium Spirit Shield'],
  [/Quivers/i, 'Spike-Point Arrow Quiver'],
  [/Rings/i, 'Two-Stone Ring'],
  [/Amulets/i, 'Onyx Amulet'],
  [/Belts/i, 'Stygian Vise'],
  [/Abyss Jewels/i, 'Ghastly Eye Jewel'],
  [/Jewels/i, 'Cobalt Jewel'],
  [/Flasks/i, 'Divine Life Flask'],
  [/Tinctures/i, 'Prismatic Tincture'],
  [/Gems/i, 'Fireball'],
  [/Bows/i, 'Thicket Bow'],
  [/Wands/i, 'Imbued Wand'],
  [/Staves|Warstaves/i, 'Eclipse Staff'],
  [/Swords|Axes|Maces|Sceptres|Claws|Daggers/i, 'Jewelled Foil'],
  [/Contracts|Blueprints/i, 'Contract: Bunker'],
  [/Expedition Logbooks/i, 'Expedition Logbook'],
  [/Memories|Memory/i, "Einhar's Memory"],
  [/Incubators/i, 'Foreboding Incubator'],
  [/Heist/i, 'Thieving Brooch']
]

export function iconForBlock (block: FilterBlock): string | null {
  const bt = block.conditions.find(c => c.keyword === 'BaseType' && c.op !== '!' && c.op !== '!=')
  for (const name of bt?.values ?? []) {
    const icon = iconForBase(name)
    if (icon) return icon
  }
  const cls = block.conditions.find(c => c.keyword === 'Class' && c.op !== '!' && c.op !== '!=')
  for (const value of cls?.values ?? []) {
    const sample = CLASS_SAMPLE.find(([re]) => re.test(value))
    if (sample) {
      const icon = iconForBase(sample[1])
      if (icon) return icon
    }
  }
  return null
}

export function iconForBlocks (blocks: FilterBlock[]): string | null {
  for (const b of blocks) {
    const icon = iconForBlock(b)
    if (icon) return icon
  }
  return null
}

// sample item name for a style preview
export function sampleName (block: FilterBlock): string {
  const bt = block.conditions.find(c => c.keyword === 'BaseType' && c.op !== '!' && c.op !== '!=')
  if (bt?.values.length) return bt.values[0]
  const cls = block.conditions.find(c => c.keyword === 'Class')
  if (cls?.values.length) return cls.values[0]
  return 'Item'
}

// ---- minimap icon glyphs ----

const SHAPE_GLYPH: Record<string, string> = {
  Circle: '●',
  Diamond: '◆',
  Hexagon: '⬢',
  Square: '■',
  Star: '★',
  Triangle: '▲',
  Cross: '✚',
  Moon: '☾',
  Raindrop: '💧',
  Kite: '⬥',
  Pentagon: '⬟',
  UpsideDownHouse: '⯆'
}

const EFFECT_CSS: Record<string, string> = {
  Red: '#ff3b3b',
  Green: '#3bd16f',
  Blue: '#3b8cff',
  Brown: '#a0703c',
  White: '#ffffff',
  Yellow: '#ffe14d',
  Cyan: '#3be8ff',
  Grey: '#a0a0a0',
  Orange: '#ff9a3b',
  Pink: '#ff7fd8',
  Purple: '#b26bff'
}

export function shapeGlyph (shape: string) {
  return SHAPE_GLYPH[shape] ?? '●'
}

export function effectColor (color: string) {
  return EFFECT_CSS[color] ?? '#ffffff'
}

// FilterBlade shows icon size as S/M/L (0 = big)
export function sizeLetter (size: number) {
  return size === 0 ? 'L' : size === 1 ? 'M' : 'S'
}

// "t1" -> "T1", "exstack" -> "EXSTACK", nested types: "currency->leveling" -> "LEVELING"
export function tierLabel (block: FilterBlock) {
  const { tier, type } = block.tags
  if (tier) return tier.toUpperCase()
  if (type) return type.split('->').pop()!.toUpperCase()
  return block.headerComment || `#${block.index + 1}`
}
