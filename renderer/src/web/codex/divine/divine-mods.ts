import { CLIENT_STRINGS as _$ } from '@/assets/data'
import { groupLinesByMod, isModInfoLine, parseModInfoLine } from '@/parser/advanced-mod-desc'
import { ModifierType } from '@/parser/modifiers'
import { ItemRarity, type ParsedItem } from '@/parser'
import { type DivineLine, parseStatLine } from './divine-math'

export type { DivineLine }

export interface DivineMod {
  name?: string
  tier?: number
  generation?: 'prefix' | 'suffix'
  crafted: boolean
  // fractured values are locked, a Divine Orb doesn't touch them
  locked: boolean
  lines: DivineLine[]
}

function itemTextToSections (text: string): string[][] {
  const lines = text.replaceAll(String.fromCharCode(0x200b), '').split(/\r?\n/)
  const sections: string[][] = [[]]
  for (const line of lines) {
    if (line === '--------') sections.push([])
    else sections[sections.length - 1].push(line)
  }
  return sections.filter(s => s.length)
}

/**
 * Explicit modifiers with rollable values, read from the advanced item
 * description (Ctrl+Alt+C), which carries the tier range of every value.
 */
export function parseDivineMods (rawText: string): DivineMod[] {
  const mods: DivineMod[] = []
  for (const section of itemTextToSections(rawText)) {
    if (!section.some(isModInfoLine)) continue

    for (const { modLine, statLines } of groupLinesByMod(section)) {
      let info: ReturnType<typeof parseModInfoLine>
      try {
        info = parseModInfoLine(modLine)
      } catch {
        continue
      }
      if (
        info.type !== ModifierType.Explicit &&
        info.type !== ModifierType.Crafted &&
        info.type !== ModifierType.Fractured
      ) continue

      const lines = statLines
        .filter(line => !line.startsWith('(') && !line.startsWith('（'))
        .map(line => parseStatLine(line, _$.UNSCALABLE_VALUE))
        .filter((line): line is DivineLine => line != null)
      if (!lines.length) continue

      mods.push({
        name: info.name,
        tier: info.tier,
        generation: info.generation,
        crafted: info.type === ModifierType.Crafted,
        locked: info.type === ModifierType.Fractured,
        lines
      })
    }
  }
  return mods
}

export function isDivineable (item: ParsedItem | null): boolean {
  if (!item) return false
  if (item.isCorrupted || item.isMirrored || item.isUnmodifiable || item.isUnidentified) return false
  return item.rarity === ItemRarity.Magic ||
    item.rarity === ItemRarity.Rare ||
    item.rarity === ItemRarity.Unique
}
