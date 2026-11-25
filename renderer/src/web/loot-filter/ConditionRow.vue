<template>
  <div class="flex items-center gap-2" :class="{ [$style.removed]: row.removed }">
    <div :class="$style.label" :title="`${row.keyword} — ${hint}`">
      <div class="truncate">• {{ row.keyword }}</div>
      <div v-if="hint" class="truncate text-xs text-gray-500 pl-2">{{ hint }}</div>
    </div>

    <!-- item level and other numbers -->
    <div v-if="row.kind === 'number'" class="flex flex-wrap items-center gap-x-2 gap-y-1 flex-1 min-w-0">
      <select :value="row.op" :class="$style.input" class="w-28" :disabled="row.removed" @change="setOp(($event.target as HTMLSelectElement).value)">
        <option v-for="op of NUMBER_OPS" :key="op" :value="op">{{ opLabel(op) }}</option>
      </select>
      <input v-if="row.op !== 'any'" :value="row.value" type="number" :min="0" :class="$style.input" class="w-14" :disabled="row.removed"
        @change="setNumber('value', $event)">
      <input v-if="row.op === 'range'" :value="row.value2" type="number" :min="0" :class="$style.input" class="w-14" :disabled="row.removed"
        @change="setNumber('value2', $event)">
      <RangeSlider class="flex-1 mx-3" :min="def?.min ?? 0" :max="def?.max ?? 100" :op="row.removed ? 'any' : row.op"
        :value="row.value ?? 0" :value2="row.value2"
        @update:value="emit('change', { value: $event })" @update:value2="emit('change', { value2: $event })" />
    </div>

    <!-- corrupted, identified… -->
    <div v-else-if="row.kind === 'bool'" class="flex flex-wrap flex-1 justify-center">
      <button v-for="state of (['yes', 'no', 'either'] as const)" :key="state" :disabled="row.removed"
        :class="[$style.seg, { [$style.segOn]: row.state === state }]" @click="emit('change', { state })">
        {{ state === 'yes' ? row.keyword : state === 'no' ? `NOT ${row.keyword}` : t(':cond_either') }}
      </button>
    </div>

    <div v-else-if="row.kind === 'rarity'" class="flex flex-wrap flex-1 justify-center">
      <button v-for="r of RARITIES" :key="r" :disabled="row.removed"
        :class="[$style.seg, $style.rarity, { [$style.segOn]: row.values.includes(r) }]"
        :style="{ borderBottomColor: RARITY_COLOR[r] }" @click="toggleValue(r, RARITIES)">
        <i class="far" :class="row.values.includes(r) ? 'fa-check-square' : 'fa-square'"></i> {{ r }}
      </button>
    </div>

    <!-- influences: all of them are known -->
    <div v-else-if="row.kind === 'list' && def?.options" class="flex flex-wrap flex-1">
      <button v-for="v of def.options" :key="v" :disabled="row.removed"
        :class="[$style.seg, { [$style.segOn]: row.values.includes(v) }]" @click="toggleValue(v, def!.options!)">
        <i class="far" :class="row.values.includes(v) ? 'fa-check-square' : 'fa-square'"></i> {{ v }}
      </button>
    </div>

    <!-- classes, mods, passives -->
    <div v-else-if="row.kind === 'list'" class="flex flex-col gap-1 flex-1 min-w-0">
      <div v-if="row.values.length" :class="$style.chips">
        <span v-for="v of row.values" :key="v" :class="$style.chip">
          <span class="px-1">{{ v }}</span>
          <button :class="$style.chipX" :disabled="row.removed" :title="t(':remove_value')" @click="emit('change', { values: row.values.filter(x => x !== v) })">×</button>
        </span>
      </div>
      <div class="flex gap-1">
        <template v-if="def?.countable">
          <select :value="countMode" :class="$style.input" :disabled="row.removed" @change="setCountMode(($event.target as HTMLSelectElement).value)">
            <option v-for="m of COUNT_MODES" :key="m" :value="m">{{ t(`:cond_count_${m}`) }}</option>
          </select>
          <input v-if="row.count && countMode !== 'none'" type="number" min="0" :value="row.count.n" :class="$style.input" class="w-12" :disabled="row.removed"
            @change="setCount($event)">
        </template>
        <input v-model="query" :class="$style.input" class="flex-1 min-w-0" :disabled="row.removed"
          :placeholder="def?.strict ? t(':cond_pick_value') : t(':cond_type_value')"
          @focus="isListOpen = true" @blur="isListOpen = false" @keydown.enter.prevent="submitValue">
        <button :class="$style.btn" :disabled="row.removed || !canSubmit" @mousedown.prevent @click="submitValue">{{ t(':fb_add') }}</button>
      </div>
      <div v-if="isListOpen && options.length" :class="$style.options">
        <button v-for="v of options" :key="v" class="px-1 text-left truncate hover:bg-gray-700" :title="v"
          @mousedown.prevent @click="addValue(v)">{{ v }}</button>
      </div>
    </div>

    <!-- sockets and their colors -->
    <div v-else-if="row.kind === 'sockets'" class="flex flex-wrap items-center gap-1 flex-1">
      <select :value="row.op" :class="$style.input" class="w-28" :disabled="row.removed" @change="emit('change', { op: ($event.target as HTMLSelectElement).value })">
        <option v-for="op of COMPARE_OPS" :key="op" :value="op">{{ opLabel(op) }}</option>
      </select>
      <select :value="row.value ?? ''" :class="$style.input" :disabled="row.removed" @change="setSocketCount(($event.target as HTMLSelectElement).value)">
        <option value="">{{ t(':cond_any_number') }}</option>
        <option v-for="n of socketCounts" :key="n" :value="n">{{ n }}</option>
      </select>
      <button v-for="(c, i) of row.letters" :key="i" :class="$style.socket" :style="{ background: SOCKET_CSS[c] }" :disabled="row.removed"
        :title="t(':remove_value')" @click="emit('change', { letters: row.letters.slice(0, i) + row.letters.slice(i + 1) })">{{ c }}</button>
      <span class="text-gray-500 px-1">+</span>
      <button v-for="c of SOCKET_COLORS" :key="c" :class="[$style.socket, $style.socketAdd]" :style="{ borderColor: SOCKET_CSS[c], color: SOCKET_CSS[c] }"
        :disabled="row.removed || row.letters.length >= 6" :title="t(`:socket_${c}`)" @click="emit('change', { letters: row.letters + c })">{{ c }}</button>
    </div>

    <!-- can't be shown by the controls -->
    <input v-else :value="row.text" :class="$style.input" class="flex-1 min-w-0" :disabled="row.removed"
      @input="emit('change', { text: ($event.target as HTMLInputElement).value })">

    <button class="text-gray-500 hover:text-red-400 px-1 w-5 flex-shrink-0" :class="{ invisible: row.pinned }" :title="row.removed ? t(':undo') : t(':remove_condition')" @click="emit('remove')">
      <i class="fas" :class="row.removed ? 'fa-undo' : 'fa-times'"></i>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18nNs } from '@/web/i18n'
import type { ParsedFilter } from './filter-parser'
import {
  conditionDef, knownValues, COMPARE_OPS, NUMBER_OPS, RARITIES, SOCKET_COLORS, type ConditionRow
} from './conditions'
import RangeSlider from './RangeSlider.vue'

const props = defineProps<{
  row: ConditionRow
  parsed: ParsedFilter
}>()

const emit = defineEmits<{
  (e: 'change', patch: Partial<ConditionRow>): void
  (e: 'remove'): void
}>()

const { t } = useI18nNs('loot_filter')

const RARITY_COLOR: Record<string, string> = { Normal: '#c8c8c8', Magic: '#8888ff', Rare: '#ffff77', Unique: '#af6025' }
const SOCKET_CSS: Record<string, string> = { R: '#d0393c', G: '#3fae49', B: '#4a6fe0', W: '#e8e8e8', A: '#b59a5b', D: '#c98a2b' }

const def = computed(() => conditionDef(props.row.keyword))
const hint = computed(() => def.value ? t(`:cond_${props.row.keyword}`) : '')

function opLabel (op: string) {
  return op === 'any' || op === 'range' ? t(`:op_${op}`) : `${op} ${t(`:op_${OP_NAMES[op]}`)}`
}
const OP_NAMES: Record<string, string> = { '<': 'lt', '>': 'gt', '<=': 'le', '>=': 'ge', '=': 'eq' }

// ---- numbers ----

function setOp (op: string) {
  if (op === 'range') {
    const max = def.value?.max ?? 100
    emit('change', { op, value2: Math.max(props.row.value ?? 0, props.row.op === 'range' ? props.row.value2 : max) })
  } else {
    emit('change', { op })
  }
}

// an empty or wrong number is not applied
function readNumber (e: Event, old: number | null) {
  const input = e.target as HTMLInputElement
  const value = Number(input.value)
  if (input.value !== '' && Number.isInteger(value) && value >= 0) return value
  input.value = String(old ?? '')
  return null
}

function setNumber (key: 'value' | 'value2', e: Event) {
  const value = readNumber(e, props.row[key])
  if (value != null) emit('change', { [key]: value })
}

// ---- lists ----

// in the order of the game
function toggleValue (value: string, all: string[]) {
  emit('change', { values: all.filter(v => (v === value) !== props.row.values.includes(v)) })
}

const COUNT_MODES = ['any', 'none', 'least', 'most', 'exact'] as const
const COUNT_OP: Record<string, string> = { least: '>=', most: '<=', exact: '=' }
const countMode = computed(() => {
  const { count } = props.row
  if (!count) return 'any'
  if (count.op === '=' && count.n === 0) return 'none'
  return Object.keys(COUNT_OP).find(m => COUNT_OP[m] === count.op) ?? (count.op === '>' ? 'least' : 'most')
})

function setCountMode (mode: string) {
  const n = props.row.count?.n || 1
  emit('change', {
    count: mode === 'any' ? null : mode === 'none' ? { op: '=', n: 0 } : { op: COUNT_OP[mode], n }
  })
}

function setCount (e: Event) {
  const n = readNumber(e, props.row.count!.n)
  if (n != null) emit('change', { count: { ...props.row.count!, n } })
}

const query = ref('')
const isListOpen = ref(false)
const known = computed(() => props.row.kind === 'list' ? knownValues(props.parsed, props.row.keyword) : [])
const options = computed(() => {
  const q = query.value.trim().toLowerCase()
  return known.value
    .filter(v => !props.row.values.includes(v) && v.toLowerCase().includes(q))
    .slice(0, 200)
})

const typed = computed(() => {
  const text = query.value.replace(/"/g, '').trim()
  return known.value.find(v => v.toLowerCase() === text.toLowerCase()) ??
    (def.value?.strict ? (text && options.value[0]) || '' : text)
})
const canSubmit = computed(() => typed.value !== '')

function addValue (value: string) {
  query.value = ''
  if (!props.row.values.includes(value)) emit('change', { values: [...props.row.values, value] })
}

function submitValue () {
  if (canSubmit.value) addValue(typed.value)
}

// ---- sockets ----

const socketCounts = computed(() => {
  const list = [0, 1, 2, 3, 4, 5, 6]
  const own = props.row.value
  return own == null || list.includes(own) ? list : [...list, own]
})

function setSocketCount (value: string) {
  emit('change', { value: value === '' ? null : Number(value) })
}
</script>

<style lang="postcss" module>
.label {
  width: 9.5rem;
  flex-shrink: 0;
  line-height: 1.15;
}
.removed > :not(:last-child) {
  opacity: 0.4;
  text-decoration: line-through;
}
.input {
  background: #13235e;
  color: #fff;
  padding: 0.1rem 0.3rem;
  font-size: 0.8rem;
}
.btn {
  background: #13235e;
  border: 1px solid #2a4fa8;
  color: #fff;
  font-size: 0.8rem;
  padding: 0 0.5rem;
}
.btn:disabled {
  opacity: 0.5;
}
.seg {
  background: #13235e;
  border: 1px solid #2a4fa8;
  color: #fff;
  font-size: 0.8rem;
  padding: 0.15rem 0.5rem;
  white-space: nowrap;
}
.segOn {
  background: #1b8fc1;
}
.rarity {
  border-bottom-width: 2px;
  min-width: 5rem;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  max-height: 8rem;
  overflow-y: auto;
}
.chip {
  display: inline-flex;
  align-items: center;
  background: #000;
  border: 1px solid #333a5c;
  color: #fff;
  font-size: 0.78rem;
}
.chipX {
  background: #13235e;
  color: #fff;
  padding: 0 0.3rem;
  align-self: stretch;
}
.chipX:hover:not(:disabled) {
  background: #a3263a;
}
.options {
  display: flex;
  flex-direction: column;
  max-height: 10rem;
  overflow-y: auto;
  background: #05081a;
  border: 1px solid #3a4270;
  font-size: 0.8rem;
}
.socket {
  width: 1.4rem;
  height: 1.4rem;
  border-radius: 50%;
  border: 2px solid transparent;
  color: #000;
  font-size: 0.75rem;
  line-height: 1;
}
.socketAdd {
  background: transparent;
}
.socketAdd:disabled {
  opacity: 0.4;
}
</style>
