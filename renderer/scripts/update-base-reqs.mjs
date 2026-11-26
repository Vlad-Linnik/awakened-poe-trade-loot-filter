// Builds src/web/codex/base-reqs.json: attribute requirements of the base types that can
// have sockets (weapons and armour). Socket colours are weighted by them.
// Run after a patch: `npm run update-codex` (in ./renderer).
//
// Source: base_items.json of RePoE (repoe-fork), the datamined game files.

import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const OUT = fileURLToPath(new URL('../src/web/codex/base-reqs.json', import.meta.url))
const BASE_ITEMS = 'https://repoe-fork.github.io/base_items.json'

const SOCKETED_CLASSES = new Set([
  'Body Armour', 'Helmet', 'Gloves', 'Boots', 'Shield',
  'Bow', 'Claw', 'Dagger', 'Rune Dagger', 'Wand', 'Sceptre', 'Staff', 'Warstaff', 'FishingRod',
  'One Hand Axe', 'Two Hand Axe', 'One Hand Mace', 'Two Hand Mace',
  'One Hand Sword', 'Thrusting One Hand Sword', 'Two Hand Sword'
])

const res = await fetch(BASE_ITEMS)
if (!res.ok) throw new Error(`${res.status} ${BASE_ITEMS}`)
const items = Object.values(await res.json())

const out = {}
for (const item of items) {
  if (!SOCKETED_CLASSES.has(item.item_class) || item.release_state === 'unreleased' || !item.requirements) continue
  const { strength: str, dexterity: dex, intelligence: int } = item.requirements
  // the first released one wins (some names have legacy duplicates)
  if (out[item.name] && item.release_state !== 'released') continue
  out[item.name] = [str, dex, int]
}

const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)))
await writeFile(OUT, JSON.stringify(sorted) + '\n', 'utf-8')
console.log(`${Object.keys(sorted).length} base types -> ${OUT}`)
