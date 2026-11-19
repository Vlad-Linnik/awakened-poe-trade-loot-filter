<template>
  <div class="rounded border border-blue-700 bg-gray-900 p-2 flex flex-col gap-2 text-sm min-w-0">
    <div class="flex items-center gap-2">
      <div class="px-2 py-0.5 font-poe" :style="previewCss">{{ itemName }}</div>
      <span class="flex-1"></span>
      <button class="text-gray-400 hover:text-white" @click="emit('close')"><i class="fas fa-times"></i></button>
    </div>

    <template v-if="!rawMode">
      <!-- visibility -->
      <div class="flex gap-1">
        <button v-for="v of (['Show', 'Hide'] as const)" :key="v"
          class="btn flex-1" :class="{ 'bg-blue-700': visibility === v }" @click="visibility = v">
          {{ v === 'Show' ? t(':vis_show') : t(':vis_hide') }}
        </button>
      </div>

      <!-- font size -->
      <div class="grid items-center gap-x-2 gap-y-1" style="grid-template-columns: 6.5rem 1fr;">
        <label>{{ t(':font_size') }}</label>
        <div class="flex items-center gap-2">
          <input type="range" min="18" max="45" v-model.number="fontSize" class="flex-1 min-w-0" @input="fontTouched = true">
          <span class="w-6 text-right">{{ fontSize }}</span>
        </div>

        <!-- colors -->
        <template v-for="c of colorFields" :key="c.key">
          <label class="flex items-center gap-1">
            <input type="checkbox" v-model="c.enabled.value"> {{ t(c.label) }}
          </label>
          <div class="flex items-center gap-2" :class="{ 'opacity-40': !c.enabled.value }">
            <input type="color" :value="c.hex.value" @input="c.setHex(($event.target as HTMLInputElement).value)" :disabled="!c.enabled.value" class="w-10 h-6 bg-transparent">
            <input type="range" min="0" max="255" v-model.number="c.alpha.value" :disabled="!c.enabled.value" class="flex-1 min-w-0" :title="t(':opacity')">
          </div>
        </template>

        <!-- sound -->
        <label class="flex items-center gap-1"><input type="checkbox" v-model="soundOn"> {{ t(':sound') }}</label>
        <div class="flex items-center gap-2" :class="{ 'opacity-40': !soundOn }">
          <select v-model="sound.id" :disabled="!soundOn" class="p-0.5 rounded bg-gray-800">
            <option v-if="!/^\d+$/.test(sound.id)" :value="sound.id">{{ sound.id }}</option>
            <option v-for="n in 16" :key="n" :value="String(n)">{{ n }}</option>
          </select>
          <input type="range" min="0" max="300" v-model.number="sound.volume" :disabled="!soundOn" class="flex-1 min-w-0" :title="t(':volume')">
          <span class="w-8 text-right">{{ sound.volume }}</span>
        </div>

        <!-- minimap icon -->
        <label class="flex items-center gap-1"><input type="checkbox" v-model="iconOn"> {{ t(':minimap') }}</label>
        <div class="flex items-center gap-1" :class="{ 'opacity-40': !iconOn }">
          <select v-model.number="icon.size" :disabled="!iconOn" class="p-0.5 rounded bg-gray-800">
            <option :value="0">{{ t(':size_big') }}</option>
            <option :value="1">{{ t(':size_mid') }}</option>
            <option :value="2">{{ t(':size_small') }}</option>
          </select>
          <select v-model="icon.color" :disabled="!iconOn" class="p-0.5 rounded bg-gray-800 min-w-0">
            <option v-for="c of EFFECT_COLORS" :key="c" :value="c">{{ c }}</option>
          </select>
          <select v-model="icon.shape" :disabled="!iconOn" class="p-0.5 rounded bg-gray-800 min-w-0 flex-1">
            <option v-for="s of ICON_SHAPES" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>

        <!-- beam -->
        <label class="flex items-center gap-1"><input type="checkbox" v-model="effectOn"> {{ t(':beam') }}</label>
        <div class="flex items-center gap-2" :class="{ 'opacity-40': !effectOn }">
          <select v-model="effect.color" :disabled="!effectOn" class="p-0.5 rounded bg-gray-800">
            <option v-for="c of EFFECT_COLORS" :key="c" :value="c">{{ c }}</option>
          </select>
          <label class="flex items-center gap-1"><input type="checkbox" v-model="effect.temp" :disabled="!effectOn"> {{ t(':beam_temp') }}</label>
        </div>
      </div>

      <!-- items in the tier -->
      <div v-if="hasBaseTypes" class="flex flex-col gap-1">
        <div class="flex items-center gap-2">
          <span class="text-xs uppercase text-gray-500">{{ t(':tier_items', [items.length]) }}</span>
          <span class="flex-1"></span>
          <input v-if="items.length > 12" v-model.trim="itemSearch" :placeholder="t(':search')" class="rounded bg-gray-800 px-1 w-32 text-xs">
        </div>
        <div class="flex flex-wrap gap-1 max-h-40 overflow-y-auto">
          <button v-for="name of visibleItems" :key="name"
            class="px-1.5 rounded text-xs border"
            :class="[
              name === selectedItem ? 'border-blue-400 bg-blue-900' : 'border-gray-700 bg-gray-800',
              { 'text-yellow-300': name === highlight, 'text-green-300': added.includes(name) }
            ]"
            @click="selectedItem = selectedItem === name ? null : name">{{ name }}</button>
          <span v-for="name of removed" :key="`rm-${name}`" class="px-1.5 rounded text-xs border border-gray-800 line-through text-gray-600 cursor-pointer"
            :title="t(':pending_remove')" @click="undoRemove(name)">{{ name }}</span>
        </div>
        <div v-if="selectedItem" class="flex items-center gap-1 flex-wrap bg-gray-800 rounded p-1">
          <span class="text-xs text-gray-300 mr-1">{{ selectedItem }}:</span>
          <button class="btn text-xs" @click="removeItem(selectedItem)"><i class="fas fa-times"></i> {{ t(':remove_from_tier') }}</button>
          <template v-if="moveTargets.length">
            <select v-model="itemMoveTarget" class="p-0.5 rounded bg-gray-900 text-xs flex-1 min-w-0">
              <option :value="null" disabled>{{ t(':move_to') }}</option>
              <option v-for="b of moveTargets" :key="b.index" :value="b.index">{{ b.visibility }} · {{ ruleTitle(b) }}</option>
            </select>
            <button class="btn text-xs" :disabled="itemMoveTarget == null || busy" @click="moveSelected">{{ t(':move') }}</button>
          </template>
        </div>
        <div class="relative">
          <input v-model="newItem" :placeholder="t(':add_item')" class="rounded bg-gray-800 px-1 w-full text-xs"
            @keydown.enter.prevent="addItem(newItem)">
          <div v-if="suggestions.length" class="absolute z-10 left-0 right-0 bg-gray-800 border border-gray-600 rounded mt-0.5 max-h-40 overflow-y-auto">
            <button v-for="sg of suggestions" :key="sg.ref" class="block w-full text-left px-1 text-xs hover:bg-gray-700"
              @click="addItem(sg.ref)">{{ sg.ref }}<span v-if="sg.name !== sg.ref" class="text-gray-500"> · {{ sg.name }}</span></button>
          </div>
        </div>
      </div>

      <!-- conditions -->
      <div class="flex flex-col gap-1">
        <div class="text-xs uppercase text-gray-500">{{ t(':conditions') }}</div>
        <div v-for="row of condRows" :key="row.keyword" class="flex items-center gap-2" :class="{ 'opacity-40 line-through': row.removed }">
          <span class="w-28 truncate" :title="row.keyword">{{ row.keyword }}</span>
          <template v-if="row.kind === 'number' || row.kind === 'rarity'">
            <select v-model="row.op" class="p-0.5 rounded bg-gray-800" :disabled="row.removed">
              <option v-for="op of OPS" :key="op" :value="op">{{ op }}</option>
            </select>
            <select v-if="row.kind === 'rarity'" v-model="row.value" class="p-0.5 rounded bg-gray-800 flex-1" :disabled="row.removed">
              <option v-for="r of RARITIES" :key="r" :value="r">{{ r }}</option>
            </select>
            <input v-else v-model.trim="row.value" class="rounded bg-gray-800 px-1 w-16" :disabled="row.removed">
            <span class="flex-1"></span>
          </template>
          <input v-else v-model="row.text" class="rounded bg-gray-800 px-1 flex-1 min-w-0 text-xs" :disabled="row.removed">
          <button class="text-gray-500 hover:text-red-400" :title="t(':remove_condition')" @click="row.removed = !row.removed">
            <i class="fas" :class="row.removed ? 'fa-undo' : 'fa-times'"></i>
          </button>
        </div>
        <div class="flex gap-1">
          <input v-model="newCondition" :placeholder="t(':add_condition')" class="rounded bg-gray-800 px-1 flex-1 min-w-0 text-xs"
            @keydown.enter.prevent="addCondition">
          <button class="btn text-xs" :disabled="!newCondition.trim()" @click="addCondition"><i class="fas fa-plus"></i></button>
        </div>
        <div v-for="line of addedConditions" :key="line" class="text-xs text-green-300 flex gap-2">
          <span class="flex-1">+ {{ line }}</span>
          <button class="text-gray-500 hover:text-red-400" @click="addedConditions = addedConditions.filter(l => l !== line)"><i class="fas fa-times"></i></button>
        </div>
      </div>
    </template>

    <!-- raw text -->
    <div v-else class="flex flex-col gap-1">
      <div class="text-xs text-gray-500">{{ t(':raw_hint') }}</div>
      <textarea v-model="rawText" rows="12" spellcheck="false" class="bg-gray-800 rounded p-1 font-mono text-xs"></textarea>
    </div>

    <div class="flex gap-2 flex-wrap">
      <button class="btn bg-blue-700 flex-1" :disabled="busy" @click="save">{{ t(':save') }}</button>
      <button class="btn" @click="rawMode = !rawMode">{{ rawMode ? t(':visual_mode') : t(':raw_mode') }}</button>
    </div>
    <div class="flex gap-2 flex-wrap text-xs">
      <button v-if="hasPatch" class="underline text-gray-400" :disabled="busy" @click="emit('reset')">{{ t(':reset_tier') }}</button>
      <button class="underline text-gray-400" :disabled="busy" @click="emit('disable')">{{ t(':disable_tier') }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useI18nNs } from '@/web/i18n'
import { ITEMS_ITERATOR } from '@/assets/data'
import { parseLine, stripComment, type FilterBlock, type Visibility } from './filter-parser'
import {
  styleFromActions, styleToActions, styleCss, toHex, fromHex,
  EFFECT_COLORS, ICON_SHAPES, DEFAULT_TEXT, DEFAULT_BACKGROUND, STYLE_KEYWORDS,
  type FilterStyle, type RGBA
} from './style'

export interface TierChange {
  visibility?: Visibility
  actions?: Record<string, string | null>
  conditions?: Record<string, string | null>
  addBaseTypes?: string[]
  removeBaseTypes?: string[]
  raw?: string
}

const props = defineProps<{
  block: FilterBlock
  blockText: string
  itemName: string
  hasPatch: boolean
  busy: boolean
  moveTargets: FilterBlock[]
  ruleTitle: (block: FilterBlock) => string
  // the item the editor was opened for
  highlight?: string
}>()

const emit = defineEmits<{
  (e: 'save', change: TierChange): void
  (e: 'reset' | 'disable' | 'close'): void
  (e: 'move', baseType: string, target: FilterBlock): void
}>()

const { t } = useI18nNs('loot_filter')

const OPS = ['=', '==', '!=', '<', '<=', '>', '>=']
const RARITIES = ['Normal', 'Magic', 'Rare', 'Unique']
const NUMERIC = new Set([
  'AreaLevel', 'ItemLevel', 'DropLevel', 'Quality', 'StackSize', 'GemLevel', 'MapTier', 'WaystoneTier',
  'Sockets', 'LinkedSockets', 'Height', 'Width', 'MemoryStrands', 'CorruptedMods', 'EnchantmentPassiveNum',
  'BaseArmour', 'BaseEvasion', 'BaseEnergyShield', 'BaseWard', 'BaseDefencePercentile', 'UnidentifiedItemTier'
])

const initial = styleFromActions(props.block.actions)

const visibility = ref<Visibility>(props.block.visibility === 'Hide' ? 'Hide' : 'Show')
const fontSize = ref(initial.fontSize ?? 32)
const fontTouched = ref(false)

function colorField (key: 'text' | 'border' | 'background', label: string, fallback: RGBA) {
  const enabled = ref(initial[key] != null)
  const value = ref<RGBA>(initial[key] ?? fallback)
  return {
    key,
    label,
    enabled,
    hex: computed(() => toHex(value.value)),
    alpha: computed({
      get: () => value.value.a,
      set: (a: number) => { value.value = { ...value.value, a } }
    }),
    setHex: (hex: string) => { value.value = fromHex(hex, value.value.a) },
    value
  }
}
const colorFields = [
  colorField('text', ':text_color', DEFAULT_TEXT),
  colorField('border', ':border_color', { r: 255, g: 255, b: 255, a: 255 }),
  colorField('background', ':bg_color', DEFAULT_BACKGROUND)
]

const soundOn = ref(initial.sound != null)
const sound = reactive({ ...(initial.sound ?? { id: '1', volume: 300 }) })
const iconOn = ref(initial.minimap != null)
const icon = reactive({ ...(initial.minimap ?? { size: 1, color: 'White', shape: 'Circle' }) })
const effectOn = ref(initial.effect != null)
const effect = reactive({ ...(initial.effect ?? { color: 'White', temp: false }) })

// ---- conditions ----

const condRows = reactive(props.block.conditions
  .filter(c => c.keyword !== 'BaseType')
  .map(c => {
    const kind = (c.values.length === 1 && NUMERIC.has(c.keyword))
      ? 'number' as const
      : (c.values.length === 1 && c.keyword === 'Rarity') ? 'rarity' as const : 'text' as const
    // everything after the keyword, e.g. `== "Divination Cards"`
    const text = stripComment(c.raw).trim().slice(c.keyword.length).trim()
    return {
      keyword: c.keyword,
      kind,
      op: c.op || '=',
      value: c.values[0] ?? '',
      text,
      initial: kind === 'text' ? text : `${c.op || '='} ${c.values[0]}`,
      removed: false
    }
  }))

const newCondition = ref('')
const addedConditions = ref<string[]>([])
function addCondition () {
  const line = newCondition.value.trim()
  const parsed = line ? parseLine(line) : null
  if (!parsed) return
  addedConditions.value = [...addedConditions.value.filter(l => parseLine(l)?.keyword !== parsed.keyword), line]
  newCondition.value = ''
}

// ---- items (BaseType list) ----

const baseTypeCond = props.block.conditions.find(c => c.keyword === 'BaseType' && c.op !== '!' && c.op !== '!=')
const hasBaseTypes = Boolean(baseTypeCond)
const originalItems = baseTypeCond?.values ?? []
const added = ref<string[]>([])
const removed = ref<string[]>([])
const items = computed(() => [...originalItems.filter(n => !removed.value.includes(n)), ...added.value])
const itemSearch = ref('')
const visibleItems = computed(() => {
  const q = itemSearch.value.toLowerCase()
  const list = q ? items.value.filter(n => n.toLowerCase().includes(q)) : items.value
  // the item the editor was opened for comes first
  return props.highlight && list.includes(props.highlight)
    ? [props.highlight, ...list.filter(n => n !== props.highlight)]
    : list
})
const selectedItem = ref<string | null>(null)
const itemMoveTarget = ref<number | null>(null)

function removeItem (name: string) {
  if (added.value.includes(name)) added.value = added.value.filter(n => n !== name)
  else removed.value = [...removed.value, name]
  selectedItem.value = null
}
function undoRemove (name: string) {
  removed.value = removed.value.filter(n => n !== name)
}
function moveSelected () {
  const target = props.moveTargets.find(b => b.index === itemMoveTarget.value)
  if (!target || !selectedItem.value) return
  emit('move', selectedItem.value, target)
}

const newItem = ref('')
function addItem (name: string) {
  name = name.trim()
  if (!name || items.value.includes(name)) return
  if (removed.value.includes(name)) undoRemove(name)
  else added.value = [...added.value, name]
  newItem.value = ''
}
const suggestions = computed(() => {
  const q = newItem.value.trim()
  if (q.length < 2) return []
  const out: Array<{ ref: string, name: string }> = []
  const seen = new Set<string>()
  for (const base of ITEMS_ITERATOR(q)) {
    if (base.namespace === 'UNIQUE' || base.namespace === 'CAPTURED_BEAST') continue
    if (seen.has(base.refName) || items.value.includes(base.refName)) continue
    seen.add(base.refName)
    out.push({ ref: base.refName, name: base.name })
    if (out.length >= 10) break
  }
  return out
})

const rawMode = ref(false)
const rawText = ref(props.blockText)

const currentStyle = computed<FilterStyle>(() => ({
  fontSize: (initial.fontSize == null && !fontTouched.value) ? null : fontSize.value,
  text: colorFields[0].enabled.value ? colorFields[0].value.value : null,
  border: colorFields[1].enabled.value ? colorFields[1].value.value : null,
  background: colorFields[2].enabled.value ? colorFields[2].value.value : null,
  sound: soundOn.value ? { ...sound } : null,
  minimap: iconOn.value ? { ...icon } : null,
  effect: effectOn.value ? { ...effect } : null
}))

const previewCss = computed(() => styleCss(currentStyle.value, visibility.value === 'Hide'))

function norm (line: string) {
  return line.trim().replace(/\s+/g, ' ')
}

function save () {
  if (rawMode.value) {
    if (rawText.value !== props.blockText) emit('save', { raw: rawText.value })
    else emit('close')
    return
  }

  const change: TierChange = {}
  if (visibility.value !== props.block.visibility) change.visibility = visibility.value

  // compare with what the block has now; keep untouched actions as they are
  const before = styleToActions(initial)
  const after = styleToActions(currentStyle.value)
  const actions: Record<string, string | null> = {}
  for (const kw of STYLE_KEYWORDS) {
    const a = after[kw]
    const b = before[kw]
    if ((a == null ? null : norm(a)) !== (b == null ? null : norm(b))) actions[kw] = a
  }
  if (Object.keys(actions).length) change.actions = actions

  const conditions: Record<string, string | null> = {}
  for (const row of condRows) {
    if (row.removed) {
      conditions[row.keyword] = null
    } else if (row.kind === 'text') {
      if (row.text.trim() !== row.initial && row.text.trim()) conditions[row.keyword] = `${row.keyword} ${row.text.trim()}`
    } else if (`${row.op} ${row.value}` !== row.initial && row.value !== '') {
      conditions[row.keyword] = `${row.keyword} ${row.op} ${row.value}`
    }
  }
  for (const line of addedConditions.value) {
    conditions[parseLine(line)!.keyword] = line
  }
  if (Object.keys(conditions).length) change.conditions = conditions

  if (added.value.length) change.addBaseTypes = [...added.value]
  if (removed.value.length) change.removeBaseTypes = [...removed.value]

  if (Object.keys(change).length) emit('save', change)
  else emit('close')
}
</script>
