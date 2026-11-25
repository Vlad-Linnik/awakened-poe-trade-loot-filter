import { CLIENT_STRINGS as _$ } from '@/assets/data'
import { ItemCategory, ItemRarity, type ParsedItem } from '@/parser'

// Item properties as the loot filter sees them.
// `undefined` means "can't be determined from the copied item text".
export interface FilterItem {
  class: string | undefined
  classIsGuess: boolean
  baseType: string
  name: string
  rarity: ItemRarity
  itemLevel: number | undefined
  quality: number
  stackSize: number | undefined
  gemLevel: number | undefined
  mapTier: number | undefined
  memoryStrands: number | undefined
  sockets: string | undefined // "R-G-B B"
  identified: boolean
  corrupted: boolean
  mirrored: boolean
  fractured: boolean
  synthesised: boolean
  foulborn: boolean
  influences: string[]
  explicitModNames: string[] | undefined
  hasImplicit: boolean | undefined
  enchanted: boolean | undefined
  imbued: boolean
  width: number | undefined
  height: number | undefined
  areaLevel: number | undefined
}

// English item class names used by loot filters, for non-English game clients
export const CLASS_BY_CATEGORY: Partial<Record<ItemCategory, string>> = {
  [ItemCategory.Map]: 'Maps',
  [ItemCategory.Helmet]: 'Helmets',
  [ItemCategory.BodyArmour]: 'Body Armours',
  [ItemCategory.Gloves]: 'Gloves',
  [ItemCategory.Boots]: 'Boots',
  [ItemCategory.Shield]: 'Shields',
  [ItemCategory.Amulet]: 'Amulets',
  [ItemCategory.Belt]: 'Belts',
  [ItemCategory.Ring]: 'Rings',
  [ItemCategory.Flask]: 'Flasks',
  [ItemCategory.AbyssJewel]: 'Abyss Jewels',
  [ItemCategory.Jewel]: 'Jewels',
  [ItemCategory.ClusterJewel]: 'Jewels',
  [ItemCategory.Quiver]: 'Quivers',
  [ItemCategory.Claw]: 'Claws',
  [ItemCategory.Bow]: 'Bows',
  [ItemCategory.Sceptre]: 'Sceptres',
  [ItemCategory.Wand]: 'Wands',
  [ItemCategory.FishingRod]: 'Fishing Rods',
  [ItemCategory.Staff]: 'Staves',
  [ItemCategory.Warstaff]: 'Warstaves',
  [ItemCategory.Dagger]: 'Daggers',
  [ItemCategory.RuneDagger]: 'Rune Daggers',
  [ItemCategory.OneHandedAxe]: 'One Hand Axes',
  [ItemCategory.TwoHandedAxe]: 'Two Hand Axes',
  [ItemCategory.OneHandedMace]: 'One Hand Maces',
  [ItemCategory.TwoHandedMace]: 'Two Hand Maces',
  [ItemCategory.OneHandedSword]: 'One Hand Swords',
  [ItemCategory.TwoHandedSword]: 'Two Hand Swords',
  [ItemCategory.HeistBlueprint]: 'Blueprints',
  [ItemCategory.HeistContract]: 'Contracts',
  [ItemCategory.HeistTool]: 'Heist Tools',
  [ItemCategory.HeistBrooch]: 'Heist Brooches',
  [ItemCategory.HeistGear]: 'Heist Gear',
  [ItemCategory.HeistCloak]: 'Heist Cloaks',
  [ItemCategory.Trinket]: 'Trinkets',
  [ItemCategory.Invitation]: 'Map Fragments',
  [ItemCategory.ExpeditionLogbook]: 'Expedition Logbooks',
  [ItemCategory.Gem]: 'Gems',
  [ItemCategory.Currency]: 'Currency',
  [ItemCategory.DivinationCard]: 'Divination Cards',
  [ItemCategory.Voidstone]: 'Atlas Upgrade Items',
  [ItemCategory.Sentinel]: 'Sentinels',
  [ItemCategory.MemoryLine]: 'Memories',
  [ItemCategory.SanctumRelic]: 'Sanctum Relics',
  [ItemCategory.Tincture]: 'Tinctures',
  [ItemCategory.Charm]: 'Charms',
  [ItemCategory.Idol]: 'Idols',
  [ItemCategory.Graft]: 'Grafts',
  [ItemCategory.CapturedBeast]: 'Captured Beasts',
  [ItemCategory.MetamorphSample]: 'Metamorph Samples'
}

// `Class` conditions use substring matching, so for guessed (non-English)
// classes we use the shortest name that is still contained in the real one
// (e.g. "Currency" for "Stackable Currency").

export function toFilterItem (item: ParsedItem, language: string, areaLevel: number | undefined): FilterItem {
  const lines = item.rawText.split(/\r?\n/)

  let itemClass: string | undefined
  let classIsGuess = false
  if (language === 'en' && lines[0]?.startsWith(_$.ITEM_CLASS)) {
    itemClass = lines[0].slice(_$.ITEM_CLASS.length).trim()
  } else if (item.category) {
    itemClass = CLASS_BY_CATEGORY[item.category]
    classIsGuess = true
  }

  let baseType = item.info.refName
  if (item.info.unique) {
    baseType = item.info.unique.base
  }

  const socketsLine = lines.find(line => line.startsWith(_$.SOCKETS))
  const sockets = socketsLine?.slice(_$.SOCKETS.length).trim()

  let explicitModNames: string[] | undefined
  let hasImplicit: boolean | undefined
  let enchanted: boolean | undefined
  if (language === 'en') {
    hasImplicit = lines.some(line => line.startsWith('{ Implicit Modifier'))
    enchanted = lines.some(line => line.endsWith('(enchant)'))
    explicitModNames = []
    const re = /^\{ [^"}]*Modifier "([^"]+)"/
    for (const line of lines) {
      const m = re.exec(line)
      if (m && !line.includes('Implicit Modifier')) explicitModNames.push(m[1])
    }
  }

  const isGem = item.category === ItemCategory.Gem
  return {
    class: itemClass,
    classIsGuess,
    baseType,
    name: item.info.refName,
    rarity: item.rarity ?? ItemRarity.Normal,
    itemLevel: item.itemLevel,
    quality: item.quality ?? 0,
    stackSize: item.stackSize?.value ?? 1,
    gemLevel: isGem ? (item.gemLevel ?? 1) : undefined,
    mapTier: item.mapTier,
    memoryStrands: item.memoryStrands ?? 0,
    sockets,
    identified: !item.isUnidentified,
    corrupted: Boolean(item.isCorrupted),
    mirrored: Boolean(item.isMirrored),
    fractured: Boolean(item.isFractured),
    synthesised: Boolean(item.isSynthesised),
    foulborn: Boolean(item.isFoulborn),
    influences: item.influences.map(String),
    explicitModNames,
    hasImplicit,
    enchanted,
    imbued: Boolean(item.imbuedGem),
    width: item.info.w,
    height: item.info.h,
    areaLevel
  }
}
