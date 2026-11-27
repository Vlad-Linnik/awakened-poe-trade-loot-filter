<template>
  <!-- narrow enough for the codex facts panel next to the loot filter window -->
  <div class="text-gray-400 leading-tight text-sm">
    <div v-for="(mod, mi) in mods" :key="'m' + mi" class="mb-1.5" :class="{ 'opacity-50': mod.locked }">
      <div class="text-xs text-gray-500">{{ modLabel(mod) }}</div>
      <div v-for="(line, li) in mod.lines" :key="li" class="py-0.5" :class="{ 'text-gray-100': sel(mi, li).on }">
        <div class="flex items-start gap-x-1.5">
          <button v-if="!mod.locked" @click="toggle(mi, li)" class="shrink-0">
            <i :class="sel(mi, li).on ? 'fas fa-check-square' : 'far fa-square'" />
          </button>
          <i v-else class="fas fa-lock text-xs shrink-0 mt-0.5" :title="t('divine_calc.locked')" />
          <span class="flex-1 min-w-0 cursor-pointer" @click="!mod.locked && toggle(mi, li)">
            {{ line.text }}
            <span class="text-gray-500 text-xs whitespace-nowrap">[{{ rangeText(line.rolls) }}]</span>
          </span>
        </div>
        <div v-if="sel(mi, li).on" class="pl-5 mt-0.5">
          <div class="flex items-center gap-x-1">
            <button :class="$style.cmp" @click="flipCmp(sel(mi, li))"
              :title="t('divine_calc.compare_hint')">{{ cmpSign(sel(mi, li).cmp) }}</button>
            <!-- "Adds # to #": a target for each value, or for their average -->
            <button v-if="line.rolls.length > 1" :class="$style.cmp"
              :title="t('divine_calc.avg_hint')" @click="sel(mi, li).avg = !sel(mi, li).avg">
              {{ sel(mi, li).avg ? t('divine_calc.by_avg') : t('divine_calc.by_each') }}
            </button>
            <span class="ml-auto text-xs tabular-nums">{{ pct(lineChance(line.rolls, sel(mi, li))) }}</span>
          </div>
          <template v-if="line.rolls.length > 1 && sel(mi, li).avg">
            <RangeSlider fill-to-value :min="avgRange(line.rolls).min" :max="avgRange(line.rolls).max" :step="avgRange(line.rolls).step"
              :op="cmpSign(sel(mi, li).cmp)" :value="sel(mi, li).avgTarget" :value2="avgRange(line.rolls).max"
              @update:value="sel(mi, li).avgTarget = $event" />
          </template>
          <template v-else>
            <RangeSlider fill-to-value v-for="(r, ri) in line.rolls" :key="ri"
              :min="r.min" :max="r.max" :step="r.step"
              :op="cmpSign(sel(mi, li).cmp)" :value="sel(mi, li).targets[ri]" :value2="r.max"
              @update:value="sel(mi, li).targets[ri] = $event" />
          </template>
        </div>
      </div>
    </div>
    <div v-if="!mods.length && hasItem" class="text-xs mb-1.5">{{ t('divine_calc.no_mods') }}</div>

    <div v-if="manual.length" class="text-xs text-gray-500">{{ t('divine_calc.manual') }}</div>
    <div v-for="(row, ri) in manual" :key="row.id" class="py-0.5 text-gray-100">
      <div class="flex items-center gap-x-1.5">
        <input v-model="row.label" :placeholder="t('divine_calc.mod_name')" class="flex-1 min-w-0 text-left px-1" :class="$style.input" />
        <button @click="manual.splice(ri, 1)" class="text-gray-500 hover:text-red-400"><i class="fas fa-times" /></button>
      </div>
      <div class="flex items-center gap-x-1 mt-0.5">
        <input v-model.number="row.min" type="number" step="any" @mousewheel.stop :placeholder="t('divine_calc.min')" :class="$style.input" />
        <span>–</span>
        <input v-model.number="row.max" type="number" step="any" @mousewheel.stop :placeholder="t('divine_calc.max')" :class="$style.input" />
        <button :class="$style.cmp" @click="flipCmp(row)">{{ cmpSign(row.cmp) }}</button>
        <input v-if="!manualRange(row)" v-model.number="row.target" type="number" step="any" @mousewheel.stop :class="$style.input" />
        <span class="ml-auto text-xs tabular-nums">{{ pct(manualChance(row)) }}</span>
      </div>
      <RangeSlider fill-to-value v-if="manualRange(row)" :min="manualRange(row)!.min" :max="manualRange(row)!.max" :step="manualRange(row)!.step"
        :op="cmpSign(row.cmp)" :value="typeof row.target === 'number' ? row.target : manualRange(row)!.max" :value2="manualRange(row)!.max"
        @update:value="row.target = $event" />
    </div>
    <button class="text-xs text-gray-500 hover:text-gray-300" @click="addManual">
      <i class="fas fa-plus" /> {{ t('divine_calc.add_mod') }}
    </button>

    <div class="mt-2 pt-2 border-t border-gray-700">
      <div v-if="!selectedCount" class="text-xs">{{ t('divine_calc.select_hint') }}</div>
      <template v-else>
        <div class="flex justify-between text-xs">
          <span>{{ t('divine_calc.chance') }}</span>
          <span class="tabular-nums">{{ pct(chance) }}</span>
        </div>
        <div class="flex justify-between items-center mt-1">
          <span>{{ t('divine_calc.avg') }}</span>
          <span class="text-gray-100 text-base tabular-nums">
            {{ fmt(avg) }} <span class="font-sans">×</span>
            <img src="/images/divine.png" class="inline w-5 h-5 -mt-1" />
          </span>
        </div>
        <div class="flex gap-1 mt-2 text-xs">
          <button :class="[$style.mode, { [$style.on]: mode === 'need' }]" @click="mode = 'need'">{{ t('divine_calc.mode_need') }}</button>
          <button :class="[$style.mode, { [$style.on]: mode === 'have' }]" @click="mode = 'have'">{{ t('divine_calc.mode_have') }}</button>
        </div>
        <!-- how many divines for the wanted guarantee -->
        <div v-if="mode === 'need'" class="flex justify-between items-center mt-1">
          <span class="flex items-center gap-x-1">
            {{ t('divine_calc.guarantee') }}
            <input v-model.number="confidence" type="number" min="1" max="99.99" step="any" @mousewheel.stop
              :class="$style.input" style="width: 4.5ch;" />%
          </span>
          <span class="text-gray-100 text-base tabular-nums">
            {{ fmt(guaranteed) }} <span class="font-sans">×</span>
            <img src="/images/divine.png" class="inline w-5 h-5 -mt-1" />
          </span>
        </div>
        <!-- what guarantee the divines I have give -->
        <div v-else class="flex justify-between items-center mt-1">
          <span class="flex items-center gap-x-1">
            {{ t('divine_calc.have') }}
            <input v-model.number="have" type="number" min="0" step="1" @mousewheel.stop
              :class="$style.input" style="width: 5ch;" />
            <img src="/images/divine.png" class="inline w-5 h-5" />
          </span>
          <span class="text-gray-100 text-base tabular-nums">{{ pct(haveChance) }}</span>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLocalStorage } from '@vueuse/core'
import type { ParsedItem } from '@/parser'
import RangeSlider from '@/web/loot-filter/RangeSlider.vue'
import { parseDivineMods, isDivineable, type DivineMod } from './divine-mods'
import {
  type Compare, type RollRange,
  lineSuccessChance, avgAttempts, attemptsForConfidence, chanceWithAttempts, stepFromStrings
} from './divine-math'

const props = defineProps<{
  item: ParsedItem | null
}>()

const { t } = useI18n()

interface Selection {
  on: boolean
  cmp: Compare
  // a target for each value of the line
  targets: number[]
  // or one for the average of its values ("Adds # to #")
  avg: boolean
  avgTarget: number
}
interface ManualRow { id: number, label: string, min: number | '', max: number | '', target: number | '', cmp: Compare }

const confidence = useLocalStorage('divine-calc.confidence', 90)
const mode = useLocalStorage<'need' | 'have'>('divine-calc.mode', 'need')
const have = useLocalStorage<number | ''>('divine-calc.have', 10)

const hasItem = computed(() => props.item != null)
const divineable = computed(() => isDivineable(props.item))

const mods = computed<DivineMod[]>(() =>
  divineable.value ? parseDivineMods(props.item!.rawText) : [])

const selections = ref<Selection[][]>([])
const manual = ref<ManualRow[]>([])
let manualId = 0

watch(mods, (mods) => {
  manual.value = []
  selections.value = mods.map(mod => mod.lines.map(line => {
    // negative rolls (e.g. "-10% to ...") are usually better when lower
    const cmp: Compare = line.rolls.every(r => r.max <= 0) ? 'lte' : 'gte'
    return {
      on: false,
      cmp,
      targets: line.rolls.map(r => r.value),
      avg: false,
      avgTarget: avgOf(line.rolls.map(r => r.value))
    }
  }))
}, { immediate: true })

function sel (mi: number, li: number): Selection {
  return selections.value[mi][li]
}

function toggle (mi: number, li: number) {
  const s = sel(mi, li)
  s.on = !s.on
}

function flipCmp (s: { cmp: Compare }) {
  s.cmp = s.cmp === 'gte' ? 'lte' : 'gte'
}

function addManual () {
  manual.value.push({ id: manualId++, label: '', min: '', max: '', target: '', cmp: 'gte' })
}

function isNum (n: unknown): n is number {
  return typeof n === 'number' && !Number.isNaN(n)
}

function lineChance (rolls: RollRange[], s: Selection): number {
  if (rolls.length > 1 && s.avg) {
    return isNum(s.avgTarget) ? lineSuccessChance(rolls, s.avgTarget, s.cmp) : 1
  }
  // values of a line roll independently
  return rolls.reduce((p, r, i) =>
    isNum(s.targets[i]) ? p * lineSuccessChance([r], s.targets[i], s.cmp) : p, 1)
}

// the game font has no ≥ / ≤
function cmpSign (cmp: Compare) {
  return cmp === 'gte' ? '>=' : '<='
}

// the slider of the average of the values: (sum of mins / n) .. (sum of maxes / n)
function avgRange (rolls: RollRange[]) {
  const n = rolls.length
  return {
    min: avgOf(rolls.map(r => r.min)),
    max: avgOf(rolls.map(r => r.max)),
    step: Math.min(...rolls.map(r => r.step)) / n
  }
}

function manualRange (row: ManualRow) {
  if (!isNum(row.min) || !isNum(row.max) || row.min === row.max) return null
  const min = Math.min(row.min, row.max)
  const max = Math.max(row.min, row.max)
  return { min, max, step: stepFromStrings(String(min), String(max)) }
}

function manualChance (row: ManualRow): number | undefined {
  const range = manualRange(row)
  if (!range) return undefined
  // the slider starts at the top of the range
  const target = isNum(row.target) ? row.target : range.max
  const step = stepFromStrings(String(range.min), String(range.max), String(target))
  return lineSuccessChance([{ value: target, ...range, step }], target, row.cmp)
}

const selectedCount = computed(() => {
  let count = selections.value.flat().filter(s => s.on).length
  count += manual.value.filter(row => manualChance(row) != null).length
  return count
})

const chance = computed(() => {
  let p = 1
  mods.value.forEach((mod, mi) => mod.lines.forEach((line, li) => {
    const s = selections.value[mi]?.[li]
    if (s?.on && !mod.locked) p *= lineChance(line.rolls, s)
  }))
  for (const row of manual.value) {
    p *= manualChance(row) ?? 1
  }
  return p
})

const avg = computed(() => avgAttempts(chance.value))
const guaranteed = computed(() => {
  const c = Number(confidence.value)
  if (!Number.isFinite(c)) return NaN
  return attemptsForConfidence(chance.value, Math.min(Math.max(c, 0), 99.9999) / 100)
})

// P = 1 - (1 - p)^n for the divines I have
const haveChance = computed(() => {
  const n = Number(have.value)
  if (!Number.isFinite(n) || n < 0) return undefined
  return chanceWithAttempts(chance.value, Math.floor(n))
})

function avgOf (nums: number[]) {
  const v = nums.reduce((a, b) => a + b, 0) / nums.length
  return Math.round(v * 100) / 100
}

function rangeText (rolls: RollRange[]) {
  return rolls.map(r => `${r.min}–${r.max}`).join(', ')
}

function modLabel (mod: DivineMod) {
  const parts: string[] = []
  if (mod.generation) parts.push(t(`divine_calc.${mod.generation}`))
  if (mod.tier) parts.push(`T${mod.tier}`)
  if (mod.name) parts.push(`“${mod.name}”`)
  if (mod.crafted) parts.push(t('divine_calc.crafted'))
  if (mod.locked) parts.push(t('divine_calc.locked'))
  return parts.join(' · ')
}

function pct (p: number | undefined) {
  if (p == null) return '—'
  if (p === 0) return '0%'
  if (p >= 0.1) return `${(p * 100).toFixed(1)}%`
  if (p >= 0.001) return `${(p * 100).toFixed(2)}%`
  return `${(p * 100).toPrecision(2)}%`
}

function fmt (n: number) {
  if (!Number.isFinite(n)) return '∞'
  if (n < 10) return (Math.round(n * 10) / 10).toLocaleString()
  return Math.round(n).toLocaleString()
}
</script>

<style lang="postcss" module>
.cmp {
  @apply px-1 text-center bg-gray-900 rounded text-xs;
  &:hover { @apply bg-gray-700; }
}
.mode {
  @apply flex-1 rounded bg-gray-900 px-1 py-0.5 text-gray-400;
  &:hover { @apply text-gray-200; }
  &.on { @apply bg-gray-700 text-gray-100; }
}
.input {
  @apply bg-gray-900 rounded text-center text-gray-300;
  width: 6ch;
  &:hover, &:focus {
    @apply bg-gray-700;
  }
  &::placeholder {
    @apply text-gray-500;
  }
}
</style>
