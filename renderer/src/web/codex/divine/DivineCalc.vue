<template>
  <div class="text-gray-400 leading-tight text-sm">
    <div v-for="(mod, mi) in mods" :key="'m' + mi" class="mb-1.5" :class="{ 'opacity-50': mod.locked }">
      <div class="text-xs text-gray-500">{{ modLabel(mod) }}</div>
      <div v-for="(line, li) in mod.lines" :key="li" class="py-0.5" :class="{ 'text-gray-100': sel(mi, li).on }">
        <div class="flex items-start gap-x-1.5">
          <button v-if="!mod.locked" @click="toggle(mi, li)" class="shrink-0">
            <i :class="sel(mi, li).on ? 'fas fa-check-square' : 'far fa-square'" />
          </button>
          <i v-else class="fas fa-lock text-xs shrink-0 mt-0.5" :title="t('divine_calc.locked')" />
          <span v-if="!mod.locked" :class="[$style.letter, { [$style.letterOn]: sel(mi, li).on }]">{{ letterOf(mi, li) }}</span>
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
            <span class="ml-auto text-xs tabular-nums">
              <span :class="$style.math">p</span>({{ letterOf(mi, li) }}) = {{ pct(lineChance(line.rolls, sel(mi, li))) }}
            </span>
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
        <span :class="[$style.letter, $style.letterOn]">{{ manualLetter(ri) }}</span>
        <input v-model="row.label" :placeholder="t('divine_calc.mod_name')" class="flex-1 min-w-0 text-left px-1" :class="$style.input" />
        <button @click="manual.splice(ri, 1)" class="text-gray-500 hover:text-red-400"><i class="fas fa-times" /></button>
      </div>
      <div class="flex items-center gap-x-1 mt-0.5">
        <input v-model.number="row.min" type="number" step="any" @mousewheel.stop :placeholder="t('divine_calc.min')" :class="$style.input" />
        <span>–</span>
        <input v-model.number="row.max" type="number" step="any" @mousewheel.stop :placeholder="t('divine_calc.max')" :class="$style.input" />
        <button :class="$style.cmp" @click="flipCmp(row)">{{ cmpSign(row.cmp) }}</button>
        <input v-if="!manualRange(row)" v-model.number="row.target" type="number" step="any" @mousewheel.stop :class="$style.input" />
        <span class="ml-auto text-xs tabular-nums">
          <span :class="$style.math">p</span>({{ manualLetter(ri) }}) = {{ pct(manualChance(row)) }}
        </span>
      </div>
      <RangeSlider fill-to-value v-if="manualRange(row)" :min="manualRange(row)!.min" :max="manualRange(row)!.max" :step="manualRange(row)!.step"
        :op="cmpSign(row.cmp)" :value="typeof row.target === 'number' ? row.target : manualRange(row)!.max" :value2="manualRange(row)!.max"
        @update:value="row.target = $event" />
    </div>
    <button class="text-xs text-gray-500 hover:text-gray-300" @click="addManual">
      <i class="fas fa-plus" /> {{ t('divine_calc.add_mod') }}
    </button>

    <!-- the condition over the lines: A and B or A and C… -->
    <div class="mt-2 pt-2 border-t border-gray-700">
      <div class="flex items-center gap-x-1.5">
        <span>{{ t('divine_calc.logic') }}</span>
        <InfoTip :text="t('divine_calc.tip_logic')" />
        <span class="flex-1"></span>
        <button v-if="logicCustom" :class="$style.cmp" :title="t('divine_calc.logic_auto_hint')" @click="resetLogic">
          <i class="fas fa-undo text-xs" /> {{ t('divine_calc.logic_auto') }}
        </button>
        <span v-else class="text-xs text-gray-500">{{ t('divine_calc.logic_auto') }}</span>
      </div>
      <input ref="logicInput" :value="logicText" @input="onLogicInput(($event.target as HTMLInputElement).value)"
        :placeholder="t('divine_calc.logic_placeholder')" spellcheck="false"
        style="width: 100%;" class="mt-1 px-1.5 py-0.5 text-left" :class="[$style.input, { [$style.invalid]: logicError }]" />
      <div class="flex flex-wrap gap-1 mt-1">
        <button v-for="l in allLetters" :key="l" :class="$style.op" @click="insert(l)">{{ l }}</button>
        <span class="w-1"></span>
        <button :class="$style.op" @click="insert(t('divine_calc.op_and'))">{{ t('divine_calc.op_and') }}</button>
        <button :class="$style.op" @click="insert(t('divine_calc.op_or'))">{{ t('divine_calc.op_or') }}</button>
        <button :class="$style.op" @click="insert(t('divine_calc.op_not'))">{{ t('divine_calc.op_not') }}</button>
        <button :class="$style.op" @click="insert('(')">(</button>
        <button :class="$style.op" @click="insert(')')">)</button>
        <button :class="$style.op" :title="t('divine_calc.erase')" @click="eraseToken"><i class="fas fa-backspace text-xs" /></button>
      </div>
      <div v-if="logicError" class="text-xs text-red-400 mt-1">{{ logicError }}</div>
    </div>

    <div class="mt-2 pt-2 border-t border-gray-700">
      <div v-if="!logicText.trim()" class="text-xs">{{ t('divine_calc.select_hint') }}</div>
      <template v-else-if="chance != null">
        <div class="flex justify-between items-center">
          <span class="flex items-center gap-x-1.5">
            <span :class="$style.math">p</span>
            <span class="text-xs">{{ t('divine_calc.chance') }}</span>
            <InfoTip :text="t('divine_calc.tip_p')" />
          </span>
          <span class="tabular-nums">{{ pct(chance) }}</span>
        </div>
        <div class="flex justify-between items-center mt-1">
          <span class="flex items-center gap-x-1.5">
            <span :class="$style.math">E[n] = 1/p</span>
            <span class="text-xs">{{ t('divine_calc.avg') }}</span>
            <InfoTip :text="t('divine_calc.tip_avg')" />
          </span>
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
        <template v-if="mode === 'need'">
          <div class="flex justify-between items-center mt-1">
            <span class="flex items-center gap-x-1.5">
              <span :class="$style.math">P</span>
              <span class="text-xs">{{ t('divine_calc.guarantee') }}</span>
              <input v-model.number="confidence" type="number" min="1" max="99.99" step="any" @mousewheel.stop
                :class="$style.input" style="width: 4.5ch;" />%
              <InfoTip :text="t('divine_calc.tip_need')" />
            </span>
            <span class="text-gray-100 text-base tabular-nums">
              {{ fmt(guaranteed) }} <span class="font-sans">×</span>
              <img src="/images/divine.png" class="inline w-5 h-5 -mt-1" />
            </span>
          </div>
          <div class="text-xs text-gray-500 mt-0.5" :class="$style.math">n = ⌈ ln(1 − P) / ln(1 − p) ⌉</div>
        </template>
        <!-- what guarantee the divines I have give -->
        <template v-else>
          <div class="flex justify-between items-center mt-1">
            <span class="flex items-center gap-x-1.5">
              <span :class="$style.math">n</span>
              <span class="text-xs">{{ t('divine_calc.have') }}</span>
              <input v-model.number="have" type="number" min="0" step="1" @mousewheel.stop
                :class="$style.input" style="width: 5ch;" />
              <img src="/images/divine.png" class="inline w-5 h-5" />
              <InfoTip :text="t('divine_calc.tip_have')" />
            </span>
            <span class="text-gray-100 text-base tabular-nums">{{ pct(haveChance) }}</span>
          </div>
          <div class="text-xs text-gray-500 mt-0.5" :class="$style.math">P = 1 − (1 − p)<sup>n</sup></div>
        </template>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLocalStorage } from '@vueuse/core'
import type { ParsedItem } from '@/parser'
import RangeSlider from '@/web/loot-filter/RangeSlider.vue'
import InfoTip from './InfoTip.vue'
import { parseDivineMods, isDivineable, type DivineMod } from './divine-mods'
import {
  type Compare, type RollRange,
  lineSuccessChance, avgAttempts, attemptsForConfidence, chanceWithAttempts, stepFromStrings
} from './divine-math'
import { parseExpr, isParseError, varsOf, exprChance, letterAt, type ParseError } from './divine-logic'

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

// the condition typed by the user; null = all ticked lines joined with AND
const customLogic = ref<string | null>(null)
const logicInput = ref<HTMLInputElement | null>(null)

watch(mods, (mods) => {
  manual.value = []
  customLogic.value = null
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

// ---- letters: every line a Divine Orb re-rolls, then the manual ones ----

const lineLetters = computed(() => {
  const letters: string[][] = []
  let n = 0
  mods.value.forEach((mod, mi) => {
    letters[mi] = mod.lines.map(() => mod.locked ? '' : letterAt(n++))
  })
  return { letters, count: n }
})

function letterOf (mi: number, li: number) {
  return lineLetters.value.letters[mi]?.[li] ?? ''
}

function manualLetter (ri: number) {
  return letterAt(lineLetters.value.count + ri)
}

const allLetters = computed(() => {
  const out: string[] = []
  for (let i = 0; i < lineLetters.value.count + manual.value.length; i++) out.push(letterAt(i))
  return out
})

// ---- chances ----

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

interface LetterState { chance?: number, selected: boolean }

const letterStates = computed(() => {
  const states = new Map<string, LetterState>()
  mods.value.forEach((mod, mi) => mod.lines.forEach((line, li) => {
    const letter = letterOf(mi, li)
    if (!letter) return
    const s = selections.value[mi]?.[li]
    states.set(letter, { selected: Boolean(s?.on), chance: s ? lineChance(line.rolls, s) : undefined })
  }))
  manual.value.forEach((row, ri) => {
    states.set(manualLetter(ri), { selected: true, chance: manualChance(row) })
  })
  return states
})

// ---- the condition ----

const autoLogic = computed(() => {
  const ticked = [...letterStates.value].filter(([, s]) => s.selected).map(([l]) => l)
  return ticked.join(` ${t('divine_calc.op_and')} `)
})

const logicCustom = computed(() => customLogic.value != null)
const logicText = computed(() => customLogic.value ?? autoLogic.value)

function onLogicInput (text: string) {
  customLogic.value = text
  // lines named in the condition are ticked
  const expr = parseExpr(text)
  if (isParseError(expr)) return
  for (const name of varsOf(expr)) {
    mods.value.forEach((_, mi) => selections.value[mi]?.forEach((s, li) => {
      if (letterOf(mi, li) === name) s.on = true
    }))
  }
}

function resetLogic () {
  customLogic.value = null
}

function insert (token: string) {
  const el = logicInput.value
  const text = logicText.value
  const start = el?.selectionStart ?? text.length
  const end = el?.selectionEnd ?? text.length
  const before = text.slice(0, start).trimEnd()
  const after = text.slice(end).trimStart()
  const head = before ? `${before} ${token}` : token
  onLogicInput(after ? `${head} ${after}` : head)
  nextTick(() => {
    if (!el) return
    el.focus()
    el.setSelectionRange(head.length, head.length)
  })
}

function eraseToken () {
  const text = logicText.value.trimEnd()
  const m = /(\(|\)|[^\s()]+)$/.exec(text)
  onLogicInput(m ? text.slice(0, m.index).trimEnd() : '')
}

function parseErrorText (e: ParseError) {
  switch (e.code) {
    case 'empty': return ''
    case 'unexpected': return t('divine_calc.err_unexpected', [e.token])
    case 'unknown_word': return t('divine_calc.err_unknown_word', [e.token])
    case 'unclosed': return t('divine_calc.err_unclosed')
    case 'missing_operand': return t('divine_calc.err_missing')
  }
}

const logic = computed(() => {
  const expr = parseExpr(logicText.value)
  if (isParseError(expr)) return { error: parseErrorText(expr) }
  const chances = new Map<string, number>()
  for (const name of varsOf(expr)) {
    const state = letterStates.value.get(name)
    if (!state) return { error: t('divine_calc.err_unknown_letter', [name]) }
    if (!state.selected) return { error: t('divine_calc.err_not_selected', [name]) }
    if (state.chance == null) return { error: t('divine_calc.err_incomplete', [name]) }
    chances.set(name, state.chance)
  }
  return { chance: exprChance(expr, chances) }
})

const logicError = computed(() => logic.value.error ?? '')
const chance = computed(() => logic.value.chance)

const avg = computed(() => avgAttempts(chance.value ?? 0))
const guaranteed = computed(() => {
  const c = Number(confidence.value)
  if (!Number.isFinite(c)) return NaN
  return attemptsForConfidence(chance.value ?? 0, Math.min(Math.max(c, 0), 99.9999) / 100)
})

// P = 1 - (1 - p)^n for the divines I have
const haveChance = computed(() => {
  const n = Number(have.value)
  if (!Number.isFinite(n) || n < 0) return undefined
  return chanceWithAttempts(chance.value ?? 0, Math.floor(n))
})

// ---- formatting ----

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
.op {
  @apply px-1.5 bg-gray-900 rounded text-xs text-gray-300;
  min-width: 1.5rem;
  &:hover { @apply bg-gray-700 text-white; }
}
.mode {
  @apply flex-1 rounded bg-gray-900 px-1 py-0.5 text-gray-400;
  &:hover { @apply text-gray-200; }
  &.on { @apply bg-gray-700 text-gray-100; }
}
.letter {
  @apply shrink-0 rounded text-xs text-center text-gray-500 bg-gray-900;
  width: 1.1rem;
  line-height: 1.1rem;
}
.letterOn {
  @apply text-white;
  background: #1b8fc1;
}
.math {
  /* the game font has no math signs */
  font-family: 'Cambria Math', 'Times New Roman', serif;
  font-style: italic;
  white-space: nowrap;
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
.invalid {
  @apply ring-1 ring-red-500;
}
</style>
