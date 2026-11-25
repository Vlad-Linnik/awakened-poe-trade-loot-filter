<template>
  <div :class="[$style.tier, { [$style.tierCustom]: custom }]" class="flex flex-col gap-2 text-sm min-w-0">
    <template v-if="!rawMode">
      <div class="flex gap-2 items-stretch min-w-0">
        <!-- like FilterBlade's Simulate: Show / Disable -->
        <div class="flex flex-col justify-center" :class="custom ? 'gap-4' : 'gap-1'" :style="{ width: custom ? 'clamp(5.5rem, 15%, 8.5rem)' : '5.5rem' }">
          <template v-if="custom">
            <button :class="[$style.btn, $style.big, disabled ? '' : visibility === 'Show' ? $style.show : $style.hide]" :title="t(':custom_show_hint')" @click="toggleShow">
              {{ visibility === 'Show' ? t(':vis_show') : t(':vis_hide') }}
            </button>
            <button :class="[$style.btn, $style.big, { [$style.show]: disabled }]" @click="disabled = true">{{ t(':fb_disable') }}</button>
          </template>
          <template v-else>
            <button :class="[$style.btn, disabled ? '' : visibility === 'Show' ? $style.show : $style.hide]" @click="toggleShow">
              {{ visibility === 'Show' ? t(':vis_show') : t(':vis_hide') }}
            </button>
            <button v-if="!isRule && block.isDisabled" :class="[$style.btn, { [$style.show]: disabled }]" @click="disabled = true">{{ t(':fb_disable') }}</button>
            <button v-else-if="!isRule" :class="$style.btn" :disabled="busy" @click="leave('disable')">{{ t(':fb_disable') }}</button>
            <button v-else :class="$style.btn" :disabled="busy" :title="t(':remove_override')" @click="leave('disable')"><i class="fas fa-trash-alt text-xs"></i> {{ t(':delete_rule') }}</button>
          </template>
        </div>
        <StyleBar class="flex-1 min-w-0" v-model="style" :initial="initial"
          :preview-name="previewName" :below="preview.style" :decorators="preview.decorators.map(b => blockTierName(b, t)).join(', ')" :hidden="visibility === 'Hide'" :notice="disabled ? t(custom ? ':custom_disabled' : ':tier_off_notice') : undefined" />
      </div>

      <!-- my rule made from a tier: the looks of its tier list -->
      <div v-if="ruleLooks.length" :class="$style.items" class="flex flex-wrap items-center gap-1">
        <span class="text-xs text-gray-400">{{ t(':look_as') }}</span>
        <button v-for="l of ruleLooks" :key="l.look" class="px-2 whitespace-nowrap" :class="{ [$style.lookOn]: l.look === currentLook }"
          :style="{ ...styleCss(styleFromActions(l.block.actions), l.look === 'Hide'), fontSize: '0.75rem', borderWidth: '1px' }"
          :title="l.blocks.map(ruleTitle).join('\n')" @click="applyLook(l.block)">
          <i v-if="l.look === 'Hide'" class="fas fa-eye-slash text-xs"></i> {{ blockTierNames(l.blocks, t) }}
        </button>
      </div>

      <!-- the rules of the filter that mine is above -->
      <div v-if="myRule && under.length" :class="$style.items" class="flex flex-wrap items-center gap-1 text-xs">
        <span class="text-gray-400" :title="t(':rule_over_hint')">{{ t(':rule_over') }}</span>
        <span v-for="b of under" :key="b.index" :class="$style.chip" :title="ruleTitle(b)">
          <span class="px-1">{{ blockTierName(b, t) }}</span>
          <button v-if="raisedOver(b)" :class="$style.chipX" :title="t(':rule_over_remove')" @click="over = over.filter(x => x !== raisedOver(b))">×</button>
        </span>
      </div>

      <!-- items of a rule made from scratch -->
      <template v-if="custom">
        <div :class="$style.strip">
          <span v-for="name of items" :key="name" :class="[$style.itemChip, { [$style.chipHl]: name === highlight, [$style.chipNew]: added.includes(name) }]">
            <img v-if="iconForBase(name)" :src="iconForBase(name)!" class="w-6 h-6 object-contain">
            {{ name }}
            <button :class="$style.itemX" :title="t(':remove_from_rule')" @click="removeItem(name)">×</button>
          </span>
          <span v-if="!items.length && !namesClass" class="text-xs text-yellow-300">
            <i class="fas fa-exclamation-triangle"></i> {{ t(':custom_wide') }}
          </span>
        </div>
        <div class="relative flex gap-3">
          <input v-model="newItem" :placeholder="t(':fb_enter_basetype')" :class="$style.baseInput" @keydown.enter.prevent="submitItem">
          <button :class="[$style.btn, $style.big]" :disabled="!newItem.trim()" @click="submitItem">{{ t(':fb_add') }}</button>
          <div v-if="suggestions.length || notice" class="absolute z-10 left-0 top-full bg-gray-900 border border-gray-600 max-h-56 overflow-y-auto" style="width: 24rem; max-width: 100%;">
            <button v-for="sg of suggestions" :key="sg.ref" class="flex items-center gap-1 w-full text-left px-1 hover:bg-gray-700" @click="pick(sg)">
              <img v-if="sg.icon" :src="sg.icon" class="w-6 h-6 object-contain">
              <span :class="{ 'text-gray-500': sg.inTier }">{{ sg.ref }}</span>
              <span v-if="sg.name !== sg.ref" class="text-gray-500"> · {{ sg.name }}</span>
              <span v-if="sg.unique" class="text-orange-400"> · {{ sg.unique }}</span>
            </button>
            <div v-if="notice" class="flex items-center gap-2 px-1 py-0.5 text-xs text-yellow-200">
              <span class="flex-1">{{ notice.text }}</span>
              <button :class="$style.btn" @click="addItem(notice!.name)">{{ t(':add_anyway') }}</button>
            </div>
          </div>
        </div>
      </template>

      <!-- items of the tier -->
      <div v-else-if="hasBaseTypes" :class="$style.items">
        <div class="flex items-center gap-2 mb-1">
          <span class="text-xs uppercase text-gray-400">{{ t(':tier_items', [items.length]) }}</span>
          <span class="flex-1"></span>
          <input v-if="items.length > 12" v-model.trim="itemSearch" :placeholder="t(':search')" :class="$style.input" class="w-32">
        </div>
        <div class="flex flex-wrap gap-1 max-h-44 overflow-y-auto">
          <span v-for="name of visibleItems" :key="name" :class="[$style.chip, {
            [$style.chipSel]: name === selectedItem,
            [$style.chipHl]: name === highlight,
            [$style.chipNew]: added.includes(name),
            [$style.chipGone]: isHidden(name)
          }]">
            <button class="px-1" @click="selectedItem = selectedItem === name ? null : name">
              <i v-if="isHidden(name)" class="fas fa-eye-slash text-xs"></i>
              <i v-else-if="hasOwnRule(name)" class="fas fa-star text-xs text-yellow-400" :title="t(':own_rule_exists')"></i> {{ name }}
            </button>
            <button v-if="up && !isHidden(name) && !added.includes(name)" :class="$style.chipUp" :disabled="busy"
              :title="t(':move_up', [blockTierName(up, t)])" @click="emit('move', name, up)"><i class="fas fa-arrow-up text-xs"></i></button>
            <!-- like "Hide this item": an APT rule above the filter, applied at once -->
            <button v-if="isHidden(name)" :class="$style.chipX" :disabled="busy" :title="t(':unhide_item')"
              @click="emit('unhide-item', name)"><i class="fas fa-undo text-xs"></i></button>
            <button v-else-if="added.includes(name)" :class="$style.chipX" :title="t(':remove_from_tier')" @click="removeAdded(name)">×</button>
            <button v-else-if="isRule" :class="$style.chipX" :title="t(':remove_from_rule')" @click="removed = [...removed, name]">×</button>
            <button v-else :class="$style.chipX" :disabled="busy" :title="t(':hide_item')" @click="emit('hide-item', name)">×</button>
          </span>
        </div>
        <MoveBar v-if="!isRule && selectedItem && !added.includes(selectedItem)" class="mt-1"
          :parsed="parsed" :block="block" :base-type="selectedItem" :has-own-rule="hasOwnRule(selectedItem)" :own-look="ownLook(selectedItem)"
          :busy="busy" :rule-title="ruleTitle"
          @move="emit('move', selectedItem!, $event)" @look="emit('look', selectedItem!, $event)" @own-rule="emit('own-rule', selectedItem!)" />
        <div class="relative flex gap-1 mt-1">
          <input v-model="newItem" :placeholder="t(':fb_enter_basetype')" :class="$style.input" class="flex-1 min-w-0"
            @keydown.enter.prevent="submitItem">
          <button :class="$style.btn" :disabled="!newItem.trim()" @click="submitItem">{{ t(':fb_add') }}</button>
          <div v-if="suggestions.length || notice" class="absolute z-10 left-0 right-12 top-full bg-gray-900 border border-gray-600 max-h-40 overflow-y-auto">
            <button v-for="sg of suggestions" :key="sg.ref" class="flex items-center gap-1 w-full text-left px-1 text-xs hover:bg-gray-700"
              @click="pick(sg)">
              <img v-if="sg.icon" :src="sg.icon" class="w-5 h-5 object-contain">
              <span :class="{ 'text-gray-500': sg.inTier }">{{ sg.ref }}</span>
              <span v-if="sg.name !== sg.ref" class="text-gray-500"> · {{ sg.name }}</span>
              <span v-if="sg.unique" class="text-orange-400"> · {{ sg.unique }}</span>
              <span class="flex-1"></span>
              <span v-if="sg.inTier" class="text-gray-500 whitespace-nowrap">{{ t(':in_this_tier') }}</span>
              <span v-else-if="sg.where" class="text-yellow-400 whitespace-nowrap">{{ t(':now_in_tier', [sg.where]) }}</span>
            </button>
            <div v-if="notice" class="flex items-center gap-2 px-1 py-0.5 text-xs text-yellow-200">
              <span class="flex-1">{{ notice.text }}</span>
              <button :class="$style.btn" @click="addItem(notice!.name)">{{ t(':add_anyway') }}</button>
            </div>
          </div>
        </div>
      </div>

      <!-- rarity, corrupted, item level… and what is added from the list of all conditions -->
      <div :class="custom ? '' : $style.items" class="flex flex-col gap-1.5">
        <ConditionRowEditor v-for="row of shownRows" :key="row.id" :row="row" :parsed="parsed" :no-label="custom != null && row.pinned && row.kind !== 'number'"
          @change="changeRow(row, $event)" @remove="removeRow(row)" />
        <button v-if="showAll" :class="$style.btn" class="self-center px-8 mt-1" :disabled="!pickerHost" @click="pickerOpen = true">
          <i class="fas fa-plus text-xs"></i> {{ t(':cond_add') }}
        </button>
        <button v-else :class="[$style.btn, $style.big]" class="self-center" @click="moreOpen = true">
          {{ t(':custom_more') }} <i class="fas fa-chevron-down text-xs"></i>
        </button>
      </div>
      <ConditionPicker v-if="pickerOpen && pickerHost" :host="pickerHost" :used="usedKeywords"
        @pick="addRow" @close="pickerOpen = false" />
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
      <button v-if="hasPatch" :class="$style.btn" :disabled="busy" @click="leave('reset')">{{ t(':reset_tier') }}</button>
      <span class="flex-1"></span>
      <button class="text-gray-400 hover:text-white px-1" :title="t(':cancel')" @click="emit('close')"><i class="fas fa-times"></i></button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onBeforeUnmount, reactive, ref, type Ref } from 'vue'
import { useI18nNs } from '@/web/i18n'
import { type FilterBlock, type ParsedFilter, type Visibility } from './filter-parser'
import { styleCss, styleFromActions, styleToActions, STYLE_KEYWORDS, type FilterStyle } from './style'
import StyleBar from './StyleBar.vue'
import MoveBar from './MoveBar.vue'
import { findBlock, type BlockSelector, higherTier, listsBase, lookOf, moveTargets, raritiesOf, ruleIdOfBlock, tierLadder, tierLooks } from './filter-edit'
import { hostOfRule, ownRuleOf, ruleBlock, ruleItems, type AptRule } from './apt-rules'
import { type BaseEntry, baseScope, findBase, listedBases, searchBases } from './base-search'
import { previewBase } from './preview'
import { blocksUnder } from './rule-priority'
import type { FilterItem } from './item-props'
import { iconForBase } from './fb'
import { blockTierName, blockTierNames } from './names'
import { changesOf, newRow, rowLines, rowsOf, type ConditionDef, type ConditionRow } from './conditions'
import ConditionRowEditor from './ConditionRow.vue'
import ConditionPicker from './ConditionPicker.vue'

export interface TierChange {
  visibility?: Visibility
  actions?: Record<string, string | null>
  // keyword -> all its lines
  conditions?: Record<string, string[]>
  addBaseTypes?: string[]
  removeBaseTypes?: string[]
  raw?: string
  // only for custom rules
  disabled?: boolean
  // only for my rules: the rules of the filter it is raised above
  over?: BlockSelector[]
  // only for the tiers that are disabled in the filter
  enabled?: boolean
}

const props = defineProps<{
  parsed: ParsedFilter
  block: FilterBlock
  blockText: string
  itemName: string
  hasPatch: boolean
  busy: boolean
  ruleTitle: (block: FilterBlock) => string
  // the item the editor was opened for
  highlight?: string
  // my rules: items of the tier can be hidden or have rules of their own
  rules: AptRule[]
  // it is one of my rules, not a tier of the filter
  isRule?: boolean
  // …made from scratch: it can be disabled, and have no items
  custom?: AptRule
  // the item under the cursor
  previewItem?: FilterItem | null
}>()

const emit = defineEmits<{
  // 'unsaved': the editor is closing (or re-rendered after another edit) with changes not saved
  (e: 'save' | 'unsaved', change: TierChange): void
  (e: 'reset' | 'disable' | 'close'): void
  (e: 'move' | 'look', baseType: string, target: FilterBlock): void
  (e: 'hide-item' | 'unhide-item' | 'own-rule', baseType: string): void
}>()

const { t } = useI18nNs('loot_filter')

// ---- visuals ----

const initial: FilterStyle = styleFromActions(props.block.actions)
const style = ref<FilterStyle>(JSON.parse(JSON.stringify(initial)) as FilterStyle)
const visibility = ref<Visibility>(props.block.visibility === 'Hide' ? 'Hide' : 'Show')
const disabled = ref(props.custom?.disabled === true || props.block.isDisabled)

// FilterBlade's Show: enables the rule, then switches Show / Hide
function toggleShow () {
  if (disabled.value) disabled.value = false
  else visibility.value = visibility.value === 'Show' ? 'Hide' : 'Show'
}

// the tiers my rule can look like
const myRule = props.isRule && !props.custom ? props.rules.find(r => r.id === ruleIdOfBlock(props.block)) : undefined
const over = ref<BlockSelector[]>([...(myRule?.over ?? [])])
const under = computed(() => myRule ? blocksUnder(props.parsed, { ...myRule, over: over.value }) : [])
// the user raised it, otherwise it is above on its own
function raisedOver (b: FilterBlock) {
  return over.value.find(sel => findBlock(props.parsed, sel)?.index === b.index)
}
const ruleHost = myRule ? hostOfRule(props.parsed, myRule) : null
const ruleLooks = ruleHost ? tierLooks(props.parsed, ruleHost).slice(0, 24) : []
const pickedLook = ref<string | null>(null)
const currentLook = computed(() => pickedLook.value ?? lookOf(props.block))

// applied with Save, as the rest of the changes
function applyLook (b: FilterBlock) {
  pickedLook.value = lookOf(b)
  visibility.value = b.visibility === 'Hide' ? 'Hide' : 'Show'
  if (b.visibility !== 'Hide') style.value = styleFromActions(b.actions)
}

// ---- conditions ----

// FilterBlade's common conditions are always there
const hasRarity = props.block.conditions.some(c => c.keyword === 'Rarity')
const rows = reactive(rowsOf(props.block.conditions, props.custom
  ? ['Rarity', 'Corrupted', 'ItemLevel']
  : [...(hasRarity ? ['Rarity'] : []), 'Corrupted', 'Identified', 'ItemLevel', 'AreaLevel']))

// FilterBlade's More: the conditions that are not set are not shown at first
const moreOpen = ref(rows.some(r => r.kind !== 'rarity' && r.lines.length > 0))
const showAll = computed(() => !props.custom || moreOpen.value)
const shownRows = computed(() => showAll.value ? rows : rows.filter(r => r.kind === 'rarity'))

const pickerHost = inject<Ref<HTMLElement | null>>('loot-filter-window', ref(null))
const pickerOpen = ref(false)
const usedKeywords = computed(() => rows.filter(r => !r.removed).map(r => r.keyword))
const namesClass = computed(() => rows.some(r => r.keyword === 'Class' && !r.removed && rowLines(r).length))

function changeRow (row: ConditionRow, patch: Partial<ConditionRow>) {
  Object.assign(row, patch)
}

// a saved condition is only crossed out until Save
function removeRow (row: ConditionRow) {
  if (row.lines.length) row.removed = !row.removed
  else rows.splice(rows.indexOf(row), 1)
}

function addRow (def: ConditionDef) {
  pickerOpen.value = false
  const removed = rows.find(r => r.keyword === def.keyword && r.removed)
  if (removed && !def.repeatable) removed.removed = false
  else rows.push(newRow(def))
}

// ---- items (BaseType list) ----

const baseTypeCond = props.block.conditions.find(c => c.keyword === 'BaseType' && c.op !== '!' && c.op !== '!=')
const hasBaseTypes = Boolean(baseTypeCond)
const originalItems = baseTypeCond?.values ?? []
const added = ref<string[]>([])
// only for my rules: items of a tier are hidden or moved, not removed
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
// the item the editor was opened for can be moved right away
const selectedItem = ref<string | null>(props.highlight && originalItems.includes(props.highlight) ? props.highlight : null)

// the editor is created anew after every change of the filter
const ladder = tierLadder(props.parsed, props.block)
const up = higherTier(ladder, props.block)

const itemRules = computed(() => props.isRule ? new Map<string, never>() : ruleItems(props.parsed, props.rules, props.block))
function isHidden (name: string) {
  return itemRules.value.get(name) === 'hidden'
}
function hasOwnRule (name: string) {
  return itemRules.value.get(name) === 'own'
}
function ownLook (name: string) {
  if (isHidden(name)) return 'Hide'
  const rule = hasOwnRule(name) ? ownRuleOf(props.parsed, props.rules, name, props.block) : null
  return rule ? lookOf(ruleBlock(rule)) : undefined
}
const previewName = computed(() => {
  if (!props.custom) return props.itemName
  return items.value.find(n => n === props.highlight) ?? items.value[0] ?? props.itemName
})
// a disabled rule is not in the filter itself
const previewLine = props.custom ? hostOfRule(props.parsed, props.custom)?.startLine ?? 0 : undefined
const preview = computed(() => previewBase(props.parsed, props.block, {
  item: props.previewItem?.baseType === previewName.value || !props.custom ? props.previewItem : null,
  baseType: hasItem(previewName.value) ? previewName.value : undefined,
  line: previewLine
}))
function hasItem (name: string) {
  return items.value.includes(name)
}
function removeItem (name: string) {
  if (added.value.includes(name)) removeAdded(name)
  else removed.value = [...removed.value, name]
}
// an item added in this editor (not saved yet) is just dropped
function removeAdded (name: string) {
  added.value = added.value.filter(n => n !== name)
  if (selectedItem.value === name) selectedItem.value = null
}

const newItem = ref('')
function addItem (name: string) {
  name = name.trim()
  newItem.value = ''
  if (!name || items.value.includes(name)) return
  if (removed.value.includes(name)) removed.value = removed.value.filter(n => n !== name)
  else added.value = [...added.value, name]
}

// only the items this tier can have: no currency in a tier of uniques
const scope: (base: BaseEntry) => boolean = props.custom ? () => true : baseScope(props.block, listedBases(moveTargets(props.parsed, props.block)), props.parsed)
const withUniques = props.custom != null ||
  (props.block.conditions.some(c => c.keyword === 'Rarity') && raritiesOf(props.block.conditions).has('Unique'))

interface Suggestion { ref: string, name: string, icon: string | null, unique?: string, inTier: boolean, where?: string }
const suggestions = computed<Suggestion[]>(() => searchBases(newItem.value, { scope, withUniques, limit: 30, filter: props.parsed })
  .map(({ base, unique }) => {
    const inTier = items.value.includes(base.ref)
    const other = inTier ? undefined : ladder.find(b => b.index !== props.block.index && listsBase(b, base.ref))
    return { ref: base.ref, name: base.name, icon: base.icon, unique: unique?.name, inTier, where: other && blockTierName(other, t) }
  }))

// an unknown BaseType makes the game reject the whole filter: add it only on purpose
const notice = computed(() => {
  const name = newItem.value.trim()
  if (name.length < 2) return null
  const known = findBase(name, props.parsed)
  if (known) return scope(known) ? null : { name: known.ref, text: t(':base_not_for_tier', [known.ref]) }
  return suggestions.value.length ? null : { name, text: t(':base_unknown', [name]) }
})

function pick (sg: Suggestion) {
  if (sg.inTier) selectedItem.value = sg.ref
  addItem(sg.ref)
}

function submitItem () {
  const exact = findBase(newItem.value, props.parsed)
  const sg = exact ? suggestions.value.find(s => s.ref === exact.ref) : suggestions.value[0]
  if (sg) pick(sg)
}

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

  const conditions = changesOf(rows)
  if (Object.keys(conditions).length) change.conditions = conditions

  if (added.value.length) change.addBaseTypes = [...added.value]
  if (removed.value.length) change.removeBaseTypes = [...removed.value]
  if (props.block.isDisabled && !disabled.value) change.enabled = true
  if (myRule && over.value.length !== (myRule.over ?? []).length) change.over = over.value
  if (props.custom && disabled.value !== Boolean(props.custom.disabled)) change.disabled = disabled.value
  return change
}

function currentChange (): TierChange | null {
  if (rawMode.value) {
    return rawText.value !== props.blockText
      ? { raw: rawText.value, ...(props.block.isDisabled && !disabled.value ? { enabled: true } : {}) }
      : null
  }
  const change = buildChange()
  return Object.keys(change).length ? change : null
}

const dirty = computed(() => currentChange() != null)

// what was last handed to the parent: it is not "unsaved" when the editor closes
let submitted: string | null = null

function save () {
  const change = currentChange()
  if (!change) {
    emit('close')
    return
  }
  submitted = JSON.stringify(change)
  emit('save', change)
}

// Reset / Disable drop the edits on purpose
function leave (action: 'reset' | 'disable') {
  const change = currentChange()
  submitted = change ? JSON.stringify(change) : null
  emit(action)
}

// closing the editor in any way must not lose the edits silently:
// the parent asks whether to save them
onBeforeUnmount(() => {
  const change = currentChange()
  if (change && JSON.stringify(change) !== submitted) emit('unsaved', change)
})
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
.chipUp {
  background: #13235e;
  color: #9fb3ff;
  padding: 0 0.3rem;
  align-self: stretch;
  border-right: 1px solid #333a5c;
}
.chipUp:hover:not(:disabled) {
  background: #1b8fc1;
  color: #fff;
}
.lookOn {
  box-shadow: 0 0 0 2px #1b8fc1;
}
.tierCustom {
  background: #111;
  border: none;
}
.big {
  font-size: 0.95rem;
  padding: 0.3rem 0.8rem;
}
.strip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 0.6rem;
  min-height: 3.4rem;
  max-height: 14rem;
  overflow-y: auto;
  padding: 0.6rem;
  background: #333;
  border: 1px solid #555;
}
.itemChip {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.1rem 1.1rem 0.1rem 0.25rem;
  background: #000;
  border: 1px solid #2f7fd0;
  color: #fff;
  font-size: 0.95rem;
}
.itemX {
  position: absolute;
  top: -0.5rem;
  right: -0.4rem;
  width: 1.15rem;
  height: 1.15rem;
  line-height: 1;
  background: #13235e;
  border: 1px solid #2f7fd0;
  color: #fff;
}
.itemX:hover {
  background: #a3263a;
}
.baseInput {
  width: 13rem;
  background: #333;
  border: 1px solid #666;
  color: #fff;
  padding: 0.3rem 0.5rem;
  font-size: 0.95rem;
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
  color: #777;
}
.input {
  background: #13235e;
  color: #fff;
  padding: 0.1rem 0.3rem;
  font-size: 0.8rem;
}
</style>
