<template>
  <!-- FilterBlade's ranks: choose a brush and paint the bases -->
  <div class="flex flex-col gap-2">
    <div :class="$style.bar">
      <select v-model="view" :class="$style.select">
        <optgroup v-for="g of views" :key="g.label" :label="g.label">
          <option v-for="o of g.options" :key="o.value" :value="o.value">{{ o.label }}</option>
        </optgroup>
      </select>
      <span class="flex-1"></span>
      <span class="whitespace-nowrap">{{ t(':rank_brush') }}</span>
      <div class="flex">
        <button v-for="b of brushes" :key="String(b.rank)" :class="$style.brush" :style="{ background: colorOf(b.rank), color: b.rank == null ? '#fff' : '#000' }"
          @click="brush = b.rank"><i class="far" :class="brush === b.rank ? 'fa-check-square' : 'fa-square'"></i> {{ b.label }}</button>
      </div>
      <span class="flex-1"></span>
      <button :class="$style.lock" @click="locked = !locked"><i class="fas" :class="locked ? 'fa-lock' : 'fa-lock-open'"></i> {{ t(locked ? ':rank_unlock' : ':rank_lock') }}</button>
    </div>

    <div :class="$style.table" @mouseleave="painting = false" @mouseup="painting = false">
      <div v-for="col of columns" :key="col.title" :class="$style.column">
        <div :class="$style.colTitle">{{ col.title }}</div>
        <button v-for="x of col.bases" :key="x.base.ref" :class="[$style.cell, { [$style.changed]: pending.has(x.base.ref), [$style.off]: isOff(x) }]"
          :style="{ background: colorOf(rankOf(x)), color: rankOf(x) == null ? '#fff' : '#000' }"
          :title="titleOf(x)" :disabled="locked || busy"
          @mousedown.prevent="painting = true; paint(x)" @mouseenter="painting && paint(x)">{{ x.base.ref }}</button>
      </div>
    </div>

    <div v-if="pending.size" class="flex items-center gap-2">
      <button :class="[$style.lock, $style.save]" :disabled="busy" @click="apply"><i class="fas fa-check"></i> {{ t(':save') }} ({{ pending.size }})</button>
      <button :class="$style.lock" @click="pending.clear()"><i class="fas fa-undo"></i> {{ t(':dont_save') }}</button>
    </div>
    <div v-if="offRanks.length" class="text-xs text-gray-400"><i class="fas fa-ban"></i> {{ t(':rank_off', [offRanks.join(', ')]) }}</div>
  </div>
</template>

<script lang="ts">
import { reactive } from 'vue'
import type { RankGroup } from './ranks'
// not saved yet; not lost when the category is collapsed
const pendingOf: Record<RankGroup, Map<string, number | null>> = {
  jewellery: reactive(new Map()),
  gear: reactive(new Map())
}
</script>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18nNs } from '@/web/i18n'
import type { ParsedFilter } from './filter-parser'
import { CLASS_BY_CATEGORY } from './item-props'
import {
  CLASSES_OF, DEFENCES, RANK_COLORS, RANK_NAMES, UNTIERED_COLOR, defenceOf, ranksOf, type RankChange, type RankedBase
} from './ranks'

const props = defineProps<{
  parsed: ParsedFilter
  group: RankGroup
  busy: boolean
}>()

const emit = defineEmits<{
  (e: 'apply', changes: RankChange[]): void
}>()

const { t } = useI18nNs('loot_filter')

const ranks = computed(() => {
  const all = ranksOf(props.parsed, props.group)
  // rings and amulets in no rank are talismans and the like
  return props.group === 'gear' ? all : { ...all, bases: all.bases.filter(x => x.rank != null) }
})
const pending = pendingOf[props.group]
const brush = ref<number | null>(0)
const locked = ref(false)
const painting = ref(false)

const rankTitle = (rank: number | null) => rank == null ? 'Untiered' : `Rank ${RANK_NAMES[rank] ?? rank + 1}`
const rankIndexes = computed(() => [...Array(ranks.value.count).keys()])
const brushes = computed(() => [
  ...rankIndexes.value.map(rank => ({ rank: rank as number | null, label: rankTitle(rank) })),
  ...(props.group === 'gear' ? [{ rank: null, label: rankTitle(null) }] : [])
])

function colorOf (rank: number | null) {
  return rank == null ? UNTIERED_COLOR : (RANK_COLORS[rank] ?? '#888')
}

function rankOf (x: RankedBase): number | null {
  return pending.has(x.base.ref) ? pending.get(x.base.ref)! : x.rank
}

// the rank is disabled: these bases have no rule
function isOff (x: RankedBase) {
  const rank = rankOf(x)
  return rank != null && ranks.value.tierOf(x.base, rank)?.isDisabled === true
}
const offRanks = computed(() => {
  const off = new Set(ranks.value.bases.filter(isOff).map(rankOf))
  return rankIndexes.value.filter(r => off.has(r)).map(rankTitle)
})

function titleOf (x: RankedBase) {
  const name = x.base.name !== x.base.ref ? ` (${x.base.name})` : ''
  const was = pending.has(x.base.ref) ? ` ← ${rankTitle(x.rank)}` : ''
  return `${x.base.ref}${name}: ${rankTitle(rankOf(x))}${was}`
}

function paint (x: RankedBase) {
  if (locked.value || props.busy) return
  if (brush.value != null && !ranks.value.tierOf(x.base, brush.value)) return
  if (x.rank === brush.value) pending.delete(x.base.ref)
  else pending.set(x.base.ref, brush.value)
}

function apply () {
  const changes: RankChange[] = []
  for (const x of ranks.value.bases) {
    if (!pending.has(x.base.ref)) continue
    const rank = pending.get(x.base.ref)!
    if (rank === x.rank) continue
    changes.push({ base: x.base.ref, from: x.block, to: rank == null ? null : ranks.value.tierOf(x.base, rank) })
  }
  pending.clear()
  if (changes.length) emit('apply', changes)
}

// ---- what is shown ----

const classGroups = computed(() => CLASSES_OF[props.group].map(g => ({
  label: g.label,
  classes: g.categories.map(c => CLASS_BY_CATEGORY[c]!)
})))
const classes = computed(() => classGroups.value.flatMap(g => g.classes))

const views = computed(() => [
  ...(props.group === 'gear' ? [{ label: 'Defence Types', options: DEFENCES.map(d => ({ value: `def:${d}`, label: d })) }] : []),
  ...classGroups.value.map(g => ({ label: g.label, options: g.classes.map(c => ({ value: `class:${c}`, label: c })) })),
  { label: 'All', options: [{ value: 'all:class', label: 'Show ALL by class' }, { value: 'all:rank', label: 'Show ALL by rank' }] },
  {
    label: 'Ranks',
    options: brushes.value.map(b => ({ value: `rank:${b.rank ?? ''}`, label: b.label }))
  }
])
const view = ref(props.group === 'gear' ? `def:${DEFENCES[0]}` : 'class:Amulets')

interface Column { title: string, bases: RankedBase[] }

function byRank (bases: RankedBase[]): Column[] {
  const columns = rankIndexes.value.map(r => ({ title: rankTitle(r), bases: bases.filter(x => x.rank === r) }))
  const rest = bases.filter(x => x.rank == null)
  return rest.length ? [...columns, { title: rankTitle(null), bases: rest }] : columns
}

function byClass (bases: RankedBase[]): Column[] {
  const order = (x: RankedBase) => rankOf(x) ?? 99
  return classes.value
    .map(c => ({ title: c, bases: bases.filter(x => x.className === c).sort((a, b) => order(a) - order(b)) }))
    .filter(c => c.bases.length)
}

// a painted base stays in its place until it is saved
const columns = computed<Column[]>(() => {
  const { bases } = ranks.value
  const [kind, value] = view.value.split(/:(.*)/)
  switch (kind) {
    case 'class': return byRank(bases.filter(x => x.className === value))
    case 'def': return byClass(bases.filter(x => defenceOf(x.base) === value))
    case 'rank': return byClass(bases.filter(x => x.rank === (value === '' ? null : Number(value))))
    default: return value === 'rank' ? byRank(bases) : byClass(bases)
  }
})
</script>

<style lang="postcss" module>
.bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem;
  background: #000;
  border: 1px solid #555;
  color: #fff;
}
.select {
  background: #1b8fc1;
  color: #fff;
  padding: 0.25rem 0.5rem;
  min-width: 11rem;
}
.brush {
  padding: 0.2rem 0.5rem;
  font-size: 0.85rem;
  white-space: nowrap;
}
.lock {
  background: #0b2a6e;
  border: 1px solid #2a4fa8;
  color: #fff;
  padding: 0.2rem 0.8rem;
  white-space: nowrap;
}
.lock:hover:not(:disabled) {
  background: #1d3787;
}
.save {
  background: #1b8fc1;
  box-shadow: 0 0 0 1px #fff;
}
.table {
  display: flex;
  align-items: flex-start;
  gap: 2px;
  padding: 0.4rem;
  max-height: 34rem;
  overflow: auto;
  background: #000;
  border: 1px solid #555;
}
.column {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1 0 8rem;
  min-width: 0;
}
.colTitle {
  position: sticky;
  top: -0.4rem;
  background: #000;
  color: #fff;
  text-align: center;
  font-size: 0.9rem;
}
.cell {
  padding: 0.1rem 0.25rem;
  text-align: left;
  font-size: 0.85rem;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: 'Fontin', sans-serif;
}
.cell:hover:not(:disabled) {
  box-shadow: inset 0 0 0 2px #fff;
}
.changed {
  box-shadow: inset 0 0 0 2px #000, 0 0 0 1px #fff;
  font-weight: bold;
}
.off {
  opacity: 0.7;
}
</style>
