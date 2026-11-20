<template>
  <div :class="$style.tier" class="flex flex-col gap-2 text-sm min-w-0">
    <template v-if="!rawMode">
      <div class="flex flex-wrap gap-2 items-stretch min-w-0">
        <!-- like FilterBlade's Simulate: Show / Disable -->
        <div class="flex flex-col gap-1 justify-center" style="width: 5.5rem;">
          <button :class="[$style.btn, visibility === 'Show' ? $style.show : $style.hide]"
            @click="visibility = visibility === 'Show' ? 'Hide' : 'Show'">
            {{ visibility === 'Show' ? t(':vis_show') : t(':vis_hide') }}
          </button>
          <button :class="$style.btn" :disabled="busy" @click="emit('disable')">{{ t(':fb_disable') }}</button>
        </div>
        <StyleBar class="flex-1 min-w-0" v-model="style" :initial="initial"
          :preview-name="itemName" :hidden="visibility === 'Hide'" />
      </div>

      <!-- FilterBlade's common conditions: item level, area level, corrupted, identified -->
      <div :class="$style.items" class="flex flex-col gap-1">
        <div v-for="row of fbNum" :key="row.keyword" class="flex flex-wrap items-center gap-2">
          <span class="w-24">• {{ row.keyword }}:</span>
          <select v-model="row.op" :class="$style.input" class="w-28">
            <option v-for="op of NUM_OPS" :key="op.op" :value="op.op">{{ op.label }}</option>
          </select>
          <input v-model.number="row.value" type="number" min="1" max="100" :disabled="row.op === 'any'"
            :class="$style.input" class="w-14">
          <input v-model.number="row.value" type="range" min="1" max="100" :disabled="row.op === 'any'"
            class="flex-1" style="min-width: 5rem;" :class="{ 'opacity-40': row.op === 'any' }">
        </div>
        <div v-for="row of fbBool" :key="row.keyword" class="flex justify-center">
          <button v-for="opt of (['yes', 'no', 'either'] as const)" :key="opt"
            :class="[$style.seg, { [$style.segOn]: row.state === opt }]" @click="row.state = opt">
            {{ opt === 'yes' ? row.keyword : opt === 'no' ? `NOT ${row.keyword}` : 'Either' }}
          </button>
        </div>
      </div>

      <!-- items of the tier -->
      <div v-if="hasBaseTypes" :class="$style.items">
        <div class="flex items-center gap-2 mb-1">
          <span class="text-xs uppercase text-gray-400">{{ t(':tier_items', [items.length]) }}</span>
          <span class="flex-1"></span>
          <input v-if="items.length > 12" v-model.trim="itemSearch" :placeholder="t(':search')" :class="$style.input" class="w-32">
        </div>
        <div class="flex flex-wrap gap-1 max-h-44 overflow-y-auto">
          <span v-for="name of visibleItems" :key="name" :class="[$style.chip, {
            [$style.chipSel]: name === selectedItem,
            [$style.chipHl]: name === highlight,
            [$style.chipNew]: added.includes(name)
          }]">
            <button class="px-1" @click="selectedItem = selectedItem === name ? null : name">{{ name }}</button>
            <button :class="$style.chipX" :title="t(':remove_from_tier')" @click="removeItem(name)">×</button>
          </span>
          <span v-for="name of removed" :key="`rm-${name}`" :class="[$style.chip, $style.chipGone]"
            :title="t(':pending_remove')" @click="undoRemove(name)"><span class="px-1">{{ name }}</span></span>
        </div>
        <div v-if="selectedItem && moveTargets.length" class="flex items-center gap-1 mt-1">
          <span class="text-xs text-gray-300">{{ selectedItem }} →</span>
          <select v-model="itemMoveTarget" :class="$style.input" class="flex-1 min-w-0">
            <option :value="null" disabled>{{ t(':move_to') }}</option>
            <option v-for="b of moveTargets" :key="b.index" :value="b.index">{{ b.visibility }} · {{ ruleTitle(b) }}</option>
          </select>
          <button :class="$style.btn" :disabled="itemMoveTarget == null || busy" @click="moveSelected">{{ t(':move') }}</button>
        </div>
        <div class="relative flex gap-1 mt-1">
          <input v-model="newItem" :placeholder="t(':fb_enter_basetype')" :class="$style.input" class="flex-1 min-w-0"
            @keydown.enter.prevent="addItem(newItem)">
          <button :class="$style.btn" :disabled="!newItem.trim()" @click="addItem(newItem)">{{ t(':fb_add') }}</button>
          <div v-if="suggestions.length" class="absolute z-10 left-0 right-12 top-full bg-gray-900 border border-gray-600 max-h-40 overflow-y-auto">
            <button v-for="sg of suggestions" :key="sg.ref" class="flex items-center gap-1 w-full text-left px-1 text-xs hover:bg-gray-700"
              @click="addItem(sg.ref)">
              <img v-if="sg.icon" :src="sg.icon" class="w-5 h-5 object-contain">
              {{ sg.ref }}<span v-if="sg.name !== sg.ref" class="text-gray-500"> · {{ sg.name }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- conditions -->
      <details :class="$style.items">
        <summary class="cursor-pointer text-xs uppercase text-gray-400">{{ t(':conditions') }} ({{ condRows.length }})</summary>
        <div class="flex flex-col gap-1 mt-1">
          <div v-for="row of condRows" :key="row.keyword" class="flex items-center gap-2" :class="{ 'opacity-40 line-through': row.removed }">
            <span class="w-28 truncate" :title="row.keyword">{{ row.keyword }}</span>
            <template v-if="row.kind === 'number' || row.kind === 'rarity'">
              <select v-model="row.op" :class="$style.input" :disabled="row.removed">
                <option v-for="op of OPS" :key="op" :value="op">{{ op }}</option>
              </select>
              <select v-if="row.kind === 'rarity'" v-model="row.value" :class="$style.input" class="flex-1" :disabled="row.removed">
                <option v-for="r of RARITIES" :key="r" :value="r">{{ r }}</option>
              </select>
              <input v-else v-model.trim="row.value" :class="$style.input" class="w-16" :disabled="row.removed">
              <span class="flex-1"></span>
            </template>
            <input v-else v-model="row.text" :class="$style.input" class="flex-1 min-w-0" :disabled="row.removed">
            <button class="text-gray-500 hover:text-red-400" :title="t(':remove_condition')" @click="row.removed = !row.removed">
              <i class="fas" :class="row.removed ? 'fa-undo' : 'fa-times'"></i>
            </button>
          </div>
          <div class="flex gap-1">
            <input v-model="newCondition" :placeholder="t(':add_condition')" :class="$style.input" class="flex-1 min-w-0"
              @keydown.enter.prevent="addCondition">
            <button :class="$style.btn" :disabled="!newCondition.trim()" @click="addCondition"><i class="fas fa-plus"></i></button>
          </div>
          <div v-for="line of addedConditions" :key="line" class="text-xs text-green-300 flex gap-2">
            <span class="flex-1">+ {{ line }}</span>
            <button class="text-gray-500 hover:text-red-400" @click="addedConditions = addedConditions.filter(l => l !== line)"><i class="fas fa-times"></i></button>
          </div>
        </div>
      </details>
    </template>

    <!-- raw text -->
    <div v-else class="flex flex-col gap-1">
      <div class="text-xs text-gray-400">{{ t(':raw_hint') }}</div>
      <textarea v-model="rawText" rows="12" spellcheck="false" class="bg-gray-900 rounded p-1 font-mono text-xs"></textarea>
    </div>

    <div class="flex gap-1 flex-wrap items-center">
      <button :class="[$style.btn, { [$style.dirty]: dirty }]" :disabled="busy" @click="save">
        <i class="fas fa-check"></i> {{ t(':save') }}
      </button>
      <button :class="$style.btn" @click="rawMode = !rawMode">{{ rawMode ? t(':visual_mode') : t(':raw_mode') }}</button>
      <button v-if="hasPatch" :class="$style.btn" :disabled="busy" @click="emit('reset')">{{ t(':reset_tier') }}</button>
      <span class="flex-1"></span>
      <button class="text-gray-400 hover:text-white px-1" :title="t(':cancel')" @click="emit('close')"><i class="fas fa-times"></i></button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useI18nNs } from '@/web/i18n'
import { ITEMS_ITERATOR } from '@/assets/data'
import { parseLine, stripComment, type FilterBlock, type Visibility } from './filter-parser'
import { styleFromActions, styleToActions, STYLE_KEYWORDS, type FilterStyle } from './style'
import StyleBar from './StyleBar.vue'
import { safeIcon } from './fb'

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

// ---- visuals ----

const initial: FilterStyle = styleFromActions(props.block.actions)
const style = ref<FilterStyle>(JSON.parse(JSON.stringify(initial)) as FilterStyle)
const visibility = ref<Visibility>(props.block.visibility === 'Hide' ? 'Hide' : 'Show')

// ---- conditions ----

// ---- FilterBlade's common conditions ----

const NUM_OPS = [
  { op: 'any', label: 'any' },
  { op: '>=', label: '>= at least' },
  { op: '<=', label: '<= at most' },
  { op: '=', label: '= exactly' },
  { op: '>', label: '> more than' },
  { op: '<', label: '< less than' }
] as const
const FB_NUM = ['ItemLevel', 'AreaLevel']
const FB_BOOL = ['Corrupted', 'Identified']

const fbNum = reactive(FB_NUM.map(keyword => {
  const c = props.block.conditions.find(x => x.keyword === keyword)
  const single = c && c.values.length === 1 && /^\d+$/.test(c.values[0])
  return {
    keyword,
    op: (c && single ? (c.op === '==' ? '=' : (c.op || '=')) : 'any') as string,
    value: single ? Number(c!.values[0]) : 1,
    // conditions this editor can't show (several values...) stay as they are
    editable: !c || single,
    initialOp: (c && single ? (c.op === '==' ? '=' : (c.op || '=')) : 'any') as string,
    initialValue: single ? Number(c!.values[0]) : 1
  }
}).filter(r => r.editable))

const fbBool = reactive(FB_BOOL.map(keyword => {
  const c = props.block.conditions.find(x => x.keyword === keyword)
  return {
    keyword,
    state: (c ? (/^true$/i.test(c.values[0] ?? '') ? 'yes' : 'no') : 'either') as 'yes' | 'no' | 'either',
    initial: (c ? (/^true$/i.test(c.values[0] ?? '') ? 'yes' : 'no') : 'either') as 'yes' | 'no' | 'either'
  }
}))

const FB_KEYWORDS = new Set([...fbNum.map(r => r.keyword), ...FB_BOOL])

const condRows = reactive(props.block.conditions
  .filter(c => c.keyword !== 'BaseType' && !FB_KEYWORDS.has(c.keyword))
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
  if (selectedItem.value === name) selectedItem.value = null
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
  const out: Array<{ ref: string, name: string, icon: string | null }> = []
  const seen = new Set<string>()
  for (const base of ITEMS_ITERATOR(q)) {
    if (base.namespace === 'UNIQUE' || base.namespace === 'CAPTURED_BEAST') continue
    if (seen.has(base.refName) || items.value.includes(base.refName)) continue
    seen.add(base.refName)
    out.push({ ref: base.refName, name: base.name, icon: safeIcon(base.icon) })
    if (out.length >= 10) break
  }
  return out
})

// ---- raw text ----

const rawMode = ref(false)
const rawText = ref(props.blockText)

// ---- save ----

function norm (line: string) {
  return line.trim().replace(/\s+/g, ' ')
}

function buildChange (): TierChange {
  const change: TierChange = {}
  if (visibility.value !== props.block.visibility) change.visibility = visibility.value

  // compare with what the block has now; keep untouched actions as they are
  const before = styleToActions(initial)
  const after = styleToActions(style.value)
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
  for (const row of fbNum) {
    const same = row.op === row.initialOp && (row.op === 'any' || row.value === row.initialValue)
    if (same) continue
    conditions[row.keyword] = (row.op === 'any' || !Number.isFinite(row.value)) ? null : `${row.keyword} ${row.op} ${row.value}`
  }
  for (const row of fbBool) {
    if (row.state === row.initial) continue
    conditions[row.keyword] = row.state === 'either' ? null : `${row.keyword} ${row.state === 'yes' ? 'True' : 'False'}`
  }
  if (Object.keys(conditions).length) change.conditions = conditions

  if (added.value.length) change.addBaseTypes = [...added.value]
  if (removed.value.length) change.removeBaseTypes = [...removed.value]
  return change
}

const dirty = computed(() => rawMode.value
  ? rawText.value !== props.blockText
  : Object.keys(buildChange()).length > 0)

function save () {
  if (rawMode.value) {
    if (rawText.value !== props.blockText) emit('save', { raw: rawText.value })
    else emit('close')
    return
  }
  const change = buildChange()
  if (Object.keys(change).length) emit('save', change)
  else emit('close')
}
</script>

<style lang="postcss" module>
.tier {
  background: #070b24;
  border: 1px solid #1d2c6b;
  padding: 0.5rem;
}
.btn {
  background: #13235e;
  border: 1px solid #2a4fa8;
  color: #fff;
  font-size: 0.8rem;
  padding: 0.2rem 0.6rem;
  white-space: nowrap;
}
.btn:hover:not(:disabled) {
  background: #1d3787;
}
.btn:disabled {
  opacity: 0.5;
}
.show {
  background: #1b8fc1;
}
.hide {
  background: #3a3f55;
}
.dirty {
  background: #1b8fc1;
  box-shadow: 0 0 0 1px #fff;
}
.items {
  background: #0b1235;
  border: 1px solid #1d2c6b;
  padding: 0.4rem;
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
.chipX:hover {
  background: #a3263a;
}
.chipSel {
  border-color: #1b8fc1;
}
.chipHl {
  color: #ffe14d;
}
.chipNew {
  color: #6fff9a;
}
.chipGone {
  text-decoration: line-through;
  color: #666;
  cursor: pointer;
}
.seg {
  background: #13235e;
  border: 1px solid #2a4fa8;
  color: #fff;
  font-size: 0.8rem;
  padding: 0.15rem 0.5rem;
}
.segOn {
  background: #1b8fc1;
}
.input {
  background: #13235e;
  color: #fff;
  padding: 0.1rem 0.3rem;
  font-size: 0.8rem;
}
</style>
