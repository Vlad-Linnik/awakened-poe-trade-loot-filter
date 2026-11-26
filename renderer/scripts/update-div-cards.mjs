// Builds src/web/codex/div-cards.json: divination cards with drop weights and where they drop.
// Run after a new league or patch: `npm run update-cards` (in ./renderer).
//
// Sources:
// - drop weights, stack size, reward: the current PoE 1 league of wraeclast.cards
//   (its reference data is the datamine of navali-creations/fateweaver)
// - where cards drop: divcord data of shonya3/divicards-site
//   (maps of the Atlas with their cards, acts, bosses and other sources)

import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const OUT = fileURLToPath(new URL('../src/web/codex/div-cards.json', import.meta.url))
const WRAECLAST_INDEX = 'https://wraeclast.cards/data/drop-rates/index.json'
const DIVICARDS = 'https://raw.githubusercontent.com/shonya3/divicards-site/main/gen/json'

async function json (url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.json()
}

const index = await json(WRAECLAST_INDEX)
const leagues = index.games.poe1.leagues
const league = leagues.find(l => !l.historical) ??
  [...leagues].sort((a, b) => b.generated_at.localeCompare(a.generated_at))[0]
const weightsUrl = league.reference_source_url
console.log(`league: ${league.name}, weights: ${weightsUrl}`)

const [cards, records, poeData] = await Promise.all([
  json(weightsUrl),
  json(`${DIVICARDS}/records.json`),
  json(`${DIVICARDS}/poeData.json`)
])

const actName = new Map(poeData.acts.map(a => [a.id, `${a.name} (${a.act})`]))
const mapsOf = new Map()
for (const map of poeData.maps) {
  for (const card of map.atlasCards ?? []) {
    mapsOf.set(card, [...(mapsOf.get(card) ?? []), map.name.replace(/ Map$/, '')])
  }
}
const cardInfo = poeData.cards?.[1] ?? poeData.cards ?? {}

// `<span>Level 21</span><br><span>Quality: +20%</span>` -> `Level 21 · Quality: +20%`
function rewardText (card) {
  if (!card.reward_html) return card.description ?? ''
  return card.reward_html
    .replace(/<span class="hoverbox__display[\s\S]*?<\/span>/g, '')
    .replace(/<br\s*\/?>/g, ' · ')
    .replace(/\[\[File:[^\]]*\]\]/g, '')
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

// `atziri_area` -> `Atziri area`: where divcord guesses the card drops
function tagLabel (tag) {
  if (!tag) return null
  const text = tag.replace(/_/g, ' ').trim()
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function sourceLabel (s) {
  if (s.type === 'Act') return { kind: 'act', name: actName.get(s.id) ?? s.id }
  if (s.type === 'Map') return { kind: 'map', name: s.id.replace(/ Map$/, '') }
  if (s.type === 'Disabled') return null
  return { kind: 'other', name: s.type === s.id ? s.id : `${s.type}: ${s.id}` }
}

const out = cards.map(card => {
  const recs = records.filter(r => r.card === card.name)
  const sources = new Map()
  for (const map of mapsOf.get(card.name) ?? []) sources.set(`map:${map}`, { kind: 'map', name: map })
  for (const r of recs) {
    for (const s of r.sources) {
      const label = sourceLabel(s)
      if (label) sources.set(`${label.kind}:${label.name}`, label)
    }
  }
  if (!sources.size) {
    for (const r of recs) {
      const tag = tagLabel(r.tagHypothesis)
      if (tag) sources.set(`tag:${tag}`, { kind: 'tag', name: tag })
    }
  }
  const entry = {
    name: card.name,
    stack: card.stack_size ?? 1,
    reward: rewardText(card),
    weight: card.weight ?? null
  }
  if (card.from_boss) entry.boss = true
  if (card.is_disabled || recs.some(r => r.greynote === 'disabled')) entry.disabled = true
  const minLevel = cardInfo[card.name]?.minLevel
  if (minLevel) entry.minLevel = minLevel
  if (sources.size) entry.sources = [...sources.values()]
  return entry
}).sort((a, b) => a.name.localeCompare(b.name))

const data = {
  league: league.name,
  updated: new Date().toISOString().slice(0, 10),
  totalWeight: out.reduce((sum, c) => sum + (c.disabled || c.boss ? 0 : c.weight ?? 0), 0),
  cards: out
}
await writeFile(OUT, JSON.stringify(data, null, 1) + '\n', 'utf-8')
console.log(`${out.length} cards, ${out.filter(c => c.weight).length} with a weight -> ${OUT}`)
