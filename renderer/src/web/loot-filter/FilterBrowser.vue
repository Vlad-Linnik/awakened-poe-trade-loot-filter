<template>
  <div class="flex flex-col gap-2 min-h-0">
    <input v-model.trim="search" :placeholder="t(':browse_search')" :class="$style.search">

    <div ref="listEl" class="flex-1 overflow-y-auto min-h-0 flex flex-col gap-2 pr-1">
      <template v-for="group of groups" :key="group.id">
      <div :class="$style.groupTitle">{{ group.title }}</div>
      <div v-for="sec of group.sections" :key="sec.title" :class="[$style.section, { [$style.open]: isOpen(sec.title) }]">
        <!-- category header: icon, title, changes, RESET -->
        <div :class="$style.header" @click="toggle(sec.title)">
          <img v-if="sec.icon" :src="sec.icon" :class="$style.icon">
          <span v-else :class="$style.icon"></span>
          <span :class="$style.headerTitle">{{ sec.title }}</span>
          <span v-if="sec.changes" :class="$style.changes">{{ t(':fb_changes', [sec.changes]) }}</span>
          <button v-if="sec.isCustom" :class="$style.reset" :disabled="!customRules.length || busy" @click.stop="resetCustom">{{ resetArmed ? t(':custom_reset_sure') : t(':fb_reset') }}</button>
          <button v-else-if="group.id !== 'rules'" :class="$style.reset" :disabled="!sec.changes || busy" @click.stop="emit('reset-blocks', sec.blocks)">{{ t(':fb_reset') }}</button>
        </div>

        <div v-if="sec.isCustom && isOpen(sec.title)" class="p-2">
          <CustomRules :parsed="parsed" :rules="customRules" :all-rules="rules" :shown="customShown" :busy="busy" :can-add="canAdd"
            :focus="customFocus" :highlight="highlight ?? undefined"
            @add="emit('custom-add', $event)" @action="(...args) => emit('custom-action', ...args)"
            @save="(b: FilterBlock, c: TierChange) => emit('save', b, c)" @unsaved="(b: FilterBlock, c: TierChange) => emit('unsaved', b, c)" />
        </div>
        <div v-else-if="isOpen(sec.title)" class="flex flex-col gap-2 p-2">
          <!-- rules made from scratch for rares -->
          <div v-if="sec.id === 'rares' && !search" :class="[$style.sub, { [$style.open]: isOpen(RARES_TITLE) }]">
            <div :class="$style.subHeader" @click="toggle(RARES_TITLE)">
              <img v-if="iconForBase('Opal Ring')" :src="iconForBase('Opal Ring')!" :class="$style.subIcon">
              <span :class="$style.headerTitle">{{ RARES_TITLE }}</span>
              <span v-if="rareRules.length" :class="$style.changes">{{ t(':fb_changes', [rareRules.length]) }}</span>
            </div>
            <div v-if="isOpen(RARES_TITLE)" class="flex flex-col gap-2 p-2">
              <div class="text-xs text-gray-400">{{ t(':rares_hint') }}</div>
              <div :class="$style.presets">
                <button v-for="p of RARE_PRESETS" :key="p.id" :class="$style.reset" :disabled="busy || !canAdd"
                  @click="emit('custom-rule', rareRule(parsed, p))"><i class="fas fa-plus text-xs"></i> {{ p.title }}</button>
              </div>
              <CustomRules :parsed="parsed" :rules="rareRules" :shown="rareRules" :all-rules="rules" :scope="RARES_SCOPE"
                :busy="busy" :can-add="canAdd" @action="(...args) => emit('custom-action', ...args)"
                @save="(b: FilterBlock, c: TierChange) => emit('save', b, c)" @unsaved="(b: FilterBlock, c: TierChange) => emit('unsaved', b, c)" />
            </div>
          </div>
          <div v-for="sub of sec.subs" :key="sub.title" :class="[$style.sub, { [$style.open]: isOpen(sec.title + '/' + sub.title) }]">
            <div :class="$style.subHeader" @click="toggle(sec.title + '/' + sub.title)">
              <img v-if="sub.icon" :src="sub.icon" :class="$style.subIcon">
              <span v-else :class="$style.subIcon"></span>
              <span :class="$style.headerTitle">{{ sub.title }}</span>
              <span v-if="sub.changes" :class="$style.changes">{{ t(':fb_changes', [sub.changes]) }}</span>
              <button v-if="group.id !== 'rules'" :class="$style.reset" :disabled="!sub.changes || busy" @click.stop="emit('reset-blocks', sub.blocks.map(e => e.block))">{{ t(':fb_reset') }}</button>
            </div>

            <div v-if="isOpen(sec.title + '/' + sub.title)" class="flex flex-col gap-1 p-1">
              <template v-for="e of sub.blocks" :key="e.block.index">
                <!-- tier row: show checkbox, name, style preview -->
                <div :class="[$style.row, { [$style.rowSel]: selected?.index === e.block.index, [$style.rowOff]: e.block.isDisabled }]" :data-block="e.block.index"
                  @click="select(e.block, e.matchedItems[0])">
                  <button :class="[$style.check, { [$style.checkOn]: isOn(e.block) }]" :disabled="busy"
                    :title="e.block.isDisabled ? t(':tier_is_off') : e.block.visibility === 'Hide' ? t(':vis_hide') : t(':vis_show')"
                    @click.stop="toggleBlock(e.block)">
                    <i class="far" :class="isOn(e.block) ? 'fa-check-square' : 'fa-square'"></i>
                  </button>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1">
                      <span :class="$style.tierName">{{ ruleFor(e.block)?.label ?? blockTierName(e.block, t) }}</span>
                      <i v-if="patchOf(e.block)" class="fas fa-pen text-blue-400 text-xs" :title="t(':tier_changed')"></i>
                      <span v-if="e.count" class="text-xs text-gray-500">{{ e.count }}</span>
                    </div>
                    <div v-if="!rareTitle(e.block)" class="text-xs text-gray-500 truncate" :title="e.block.headerComment">{{ conditionHints(e.block, t).join(' · ') }}</div>
                    <div v-if="e.matchedItems.length" class="text-xs text-yellow-400 truncate">{{ e.matchedItems.join(', ') }}</div>
                  </div>
                  <i class="fas fa-paint-brush text-gray-400"></i>
                  <span :class="[$style.preview, { 'line-through': !isOn(e.block) }]" :title="conditionHints(e.block, t).join(' · ')" :style="chipStyle(e.block)">
                    <span v-if="e.minimap" :style="{ color: effectColor(e.minimap.color) }">{{ shapeGlyph(e.minimap.shape) }}</span>
                    {{ e.matchedItems[0] ?? sampleName(e.block) }}
                  </span>
                </div>
                <TierEditor v-if="selected?.index === e.block.index"
                  :key="`${e.block.index}-${mtime}`"
                  :parsed="parsed" :block="e.block" :block-text="blockText(parsed, e.block)"
                  :item-name="highlight ?? sampleName(e.block)" :has-patch="Boolean(patchOf(e.block))" :busy="busy"
                  :rule-title="ruleTitle" :highlight="highlight ?? undefined"
                  :rules="rules" :is-rule="Boolean(ruleFor(e.block))"
                  @hide-item="emit('hide-item', $event, e.block)" @unhide-item="emit('unhide-item', $event, e.block)"
                  @own-rule="emit('own-rule', $event, e.block)"
                  @unsaved="emit('unsaved', e.block, $event)"
                  @move="(bt: string, to: FilterBlock) => emit('move', bt, e.block, to)"
                  @look="(bt: string, to: FilterBlock) => emit('look', bt, e.block, to)"
                  @save="emit('save', e.block, $event)" @reset="emit('reset', e.block)"
                  @disable="emit('disable', e.block)" @close="selectedSel = null" />
              </template>
              <!-- ranks of the bases -->
              <RankGrid v-if="sec.id === 'rares' && RANKS_OF_SUB[sub.title] && !search" class="mt-1"
                :parsed="parsed" :group="RANKS_OF_SUB[sub.title]" :busy="busy || !canAdd" @apply="emit('ranks', $event)" />
            </div>
          </div>
        </div>
      </div>
      </template>
      <div v-if="groups.length === 1 && search" class="text-gray-400 text-sm">{{ t(':browse_nothing') }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, watch } from 'vue'
import { useI18nNs } from '@/web/i18n'
import { allBlocks, blockText, type FilterBlock, type ParsedFilter } from './filter-parser'
import type { AptRule, NewBase } from './apt-rules'
import { findBlock, selectorOf, type BlockSelector, type TierPatch } from './edits'
import { styleFromActions, styleCss } from './style'
import { previewStyle } from './preview'
import { isRuleCopy } from './rule-priority'
import { iconForBlocks, iconForBase, sampleName, shapeGlyph, effectColor } from './fb'
import { CATEGORIES, GROUPS, isHideRule, placeOf, rareTitle } from './fb-categories'
import { RANKS_OF_SUB, RARE_PRESETS, RARES_SCOPE, rareRule, type RankChange } from './ranks'
import RankGrid from './RankGrid.vue'
import { blockTierName, conditionHints } from './names'
import TierEditor, { type TierChange } from './TierEditor.vue'
import CustomRules, { type CustomAction } from './CustomRules.vue'

const props = defineProps<{
  parsed: ParsedFilter
  mtime: number
  busy: boolean
  patchOf: (block: FilterBlock) => TierPatch | undefined
  ruleTitle: (block: FilterBlock) => string
  ruleFor: (block: FilterBlock) => AptRule | null
  // open this tier (e.g. "Find in Customizer" from an item)
  focus?: { selector: BlockSelector, item?: string } | null
  rules: AptRule[]
  canAdd: boolean
}>()

const emit = defineEmits<{
  (e: 'save' | 'unsaved', block: FilterBlock, change: TierChange): void
  (e: 'reset' | 'disable', block: FilterBlock): void
  (e: 'reset-blocks', blocks: FilterBlock[]): void
  (e: 'custom-add', base?: NewBase): void
  (e: 'custom-reset'): void
  (e: 'custom-rule', rule: AptRule): void
  (e: 'ranks', changes: RankChange[]): void
  (e: 'custom-action', id: string, action: CustomAction, label?: string): void
  (e: 'move' | 'look', baseType: string, from: FilterBlock, to: FilterBlock): void
  (e: 'hide-item' | 'unhide-item' | 'own-rule', baseType: string, block: FilterBlock): void
}>()

const { t } = useI18nNs('loot_filter')

const search = ref('')
const CUSTOM_TITLE = t(':custom_title')
const opened = ref(new Set<string>([CUSTOM_TITLE]))
// selection survives re-parsing after a save (block indexes may shift)
const selectedSel = shallowRef<BlockSelector | null>(null)
const highlight = ref<string | null>(null)

const selected = computed(() => selectedSel.value ? findBlock(props.parsed, selectedSel.value) : null)

function select (block: FilterBlock, item?: string) {
  if (selected.value?.index === block.index) {
    selectedSel.value = null
    return
  }
  selectedSel.value = selectorOf(block)
  highlight.value = item ?? null
}

function rulesSub (rule: AptRule) {
  return rule.visibility === 'Hide' ? t(':my_rules_hide') : t(':my_rules_show')
}

const listEl = ref<HTMLElement | null>(null)

// "Find in Customizer": bring the opened tier into view
function scrollToBlock (index: number) {
  nextTick(() => {
    const row = listEl.value?.querySelector(`[data-block="${index}"]`)
    row?.scrollIntoView({ block: 'start' })
  })
}

function baseTypes (block: FilterBlock) {
  return block.conditions.find(c => c.keyword === 'BaseType' && c.op !== '!' && c.op !== '!=')?.values ?? []
}

interface Entry { block: FilterBlock, count: number, matchedItems: string[], minimap: ReturnType<typeof styleFromActions>['minimap'] }
interface Sub { title: string, blocks: Entry[], icon: string | null, changes: number }
interface Section { id?: string, title: string, subs: Sub[], blocks: FilterBlock[], icon: string | null, changes: number, order: number, isCustom?: boolean }

// ---- rules made from scratch, like FilterBlade's "Highlight specific bases": always the first ----

const customRules = computed(() => props.rules.filter(r => r.custom))
const customShown = computed(() => {
  const q = search.value.toLowerCase()
  if (!q || CUSTOM_TITLE.toLowerCase().includes(q)) return customRules.value
  return customRules.value.filter(r => `${r.label} ${r.conditions.join(' ')}`.toLowerCase().includes(q))
})
const customFocus = ref<string | undefined>()

const customSection = computed<Section>(() => ({
  title: CUSTOM_TITLE,
  subs: [],
  blocks: [],
  icon: iconForBase('Two-Toned Boots') ?? iconForBase('Opal Ring'),
  changes: customRules.value.length,
  order: 0,
  isCustom: true
}))

const RARES_TITLE = 'Add custom Show/Hide rule (EG rares)'
const rareRules = computed(() => customRules.value.filter(r => r.scope === RARES_SCOPE))

// ---- the check of a tier ----

function isOn (block: FilterBlock) {
  return !block.isDisabled && (isHideRule(block) || block.visibility !== 'Hide')
}

function toggleBlock (block: FilterBlock) {
  if (block.isDisabled) emit('save', block, { enabled: true, ...(block.visibility === 'Hide' && !isHideRule(block) ? { visibility: 'Show' } : {}) })
  else if (isHideRule(block)) emit('disable', block)
  else emit('save', block, { visibility: block.visibility === 'Hide' ? 'Show' : 'Hide' })
}

// copies of the ranks for fated items, there are none of them now
function isHiddenTier (block: FilterBlock) {
  return block.isDisabled && /^rr\b/.test(block.tags.type ?? '') && /f$/.test(block.tags.tier ?? '')
}

// asks once more: all the rules are removed
const resetArmed = ref(false)
function resetCustom () {
  if (!resetArmed.value) {
    resetArmed.value = true
    setTimeout(() => { resetArmed.value = false }, 3000)
    return
  }
  resetArmed.value = false
  emit('custom-reset')
}

// FilterBlade-like tree: group -> category -> NeverSink subsection -> tiers
const groups = computed(() => {
  const q = search.value.toLowerCase()
  const byCategory = new Map<string, Section & { group: string }>()
  const mine: Section = { title: t(':my_rules_items'), subs: [], blocks: [], icon: null, changes: 0, order: 0 }
  for (const block of allBlocks(props.parsed)) {
    const rule = props.ruleFor(block)
    if (rule?.custom || isRuleCopy(block) || isHiddenTier(block)) continue
    const items = baseTypes(block)
    let matchedItems: string[] = []
    if (q) {
      matchedItems = items.filter(n => n.toLowerCase().includes(q))
      const text = `${rule?.label ?? ''} ${props.ruleTitle(block)} ${blockTierName(block, t)} ${block.headerComment} ${block.section ?? ''} ${block.topSection ?? ''}`.toLowerCase()
      if (!matchedItems.length && !text.includes(q)) continue
    }
    if (rule) {
      let sub = mine.subs.find(x => x.title === rulesSub(rule))
      if (!sub) mine.subs.push(sub = { title: rulesSub(rule), blocks: [], icon: null, changes: 0 })
      sub.blocks.push({ block, count: items.length, matchedItems: matchedItems.slice(0, 5), minimap: styleFromActions(block.actions).minimap })
      mine.blocks.push(block)
      continue
    }
    const { category: cat, sub: subTitle } = placeOf(block)
    let sec = byCategory.get(cat.id)
    if (!sec) {
      sec = { id: cat.id, title: cat.title, group: cat.group, subs: [], blocks: [], icon: iconForBase(cat.icon), changes: 0, order: CATEGORIES.indexOf(cat) }
      byCategory.set(cat.id, sec)
    }
    let sub = sec.subs.find(x => x.title === subTitle)
    if (!sub) {
      sub = { title: subTitle, blocks: [], icon: null, changes: 0 }
      sec.subs.push(sub)
    }
    sub.blocks.push({ block, count: items.length, matchedItems: matchedItems.slice(0, 5), minimap: styleFromActions(block.actions).minimap })
    sec.blocks.push(block)
    if (props.patchOf(block)) {
      sub.changes++
      sec.changes++
    }
  }
  for (const [id, sec] of byCategory) {
    const order = CATEGORIES.find(c => c.id === id)!.subs
    sec.subs.sort((a, b) => order.indexOf(a.title) - order.indexOf(b.title))
    // Rank A - Rings/Amulets, Rank A - Belts, Rank B…
    const ranked = sec.subs.find(sub => sub.title === 'Jewellery')
    ranked?.blocks.sort((a, b) => (rareTitle(a.block) ?? '').slice(0, 6).localeCompare((rareTitle(b.block) ?? '').slice(0, 6)))
    for (const sub of sec.subs) sub.icon = iconForBlocks(sub.blocks.map(e => e.block)) ?? sec.icon
  }
  for (const sub of mine.subs) sub.icon = iconForBlocks(sub.blocks.map(e => e.block))
  mine.icon = mine.subs[0]?.icon ?? null
  const rulesGroup = { id: 'rules', title: t(':my_rules'), sections: [customSection.value, ...(mine.subs.length ? [mine] : [])] }
  return [rulesGroup, ...GROUPS
    .map(g => ({
      id: g.id,
      title: g.title,
      sections: [...byCategory.values()].filter(sec => sec.group === g.id).sort((a, b) => a.order - b.order) as Section[]
    }))
    .filter(g => g.sections.length)]
})

watch(() => props.focus, (focus) => {
  if (!focus) return
  const block = findBlock(props.parsed, focus.selector)
  if (!block) return
  const custom = props.ruleFor(block)?.custom ? props.ruleFor(block) : null
  if (custom) {
    search.value = ''
    highlight.value = focus.item ?? null
    customFocus.value = custom.id
    opened.value = new Set([...opened.value, CUSTOM_TITLE])
    return
  }
  // the search may not include it
  const isListed = groups.value.some(g => g.sections.some(sec => sec.blocks.some(b => b.index === block.index)))
  if (!isListed) search.value = ''
  selectedSel.value = selectorOf(block)
  highlight.value = focus.item ?? null
  const rule = props.ruleFor(block)
  const place = rule ? null : placeOf(block)
  const [title, sub] = place ? [place.category.title, place.sub] : [t(':my_rules_items'), rulesSub(rule!)]
  opened.value = new Set([...opened.value, title, `${title}/${sub}`])
  scrollToBlock(block.index)
}, { immediate: true })

function isOpen (key: string) {
  // it isn't hidden by the search, but doesn't take the place of what is found
  if (key === CUSTOM_TITLE) return opened.value.has(key) && (!search.value || customShown.value.length > 0)
  return Boolean(search.value) || opened.value.has(key)
}

function toggle (key: string) {
  const next = new Set(opened.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  opened.value = next
}

function chipStyle (block: FilterBlock) {
  return { ...styleCss(previewStyle(props.parsed, block, {}), !isOn(block)), fontSize: '0.85rem', borderWidth: '1px' }
}

</script>

<style lang="postcss" module>
.search {
  background: #0b0f2e;
  border: 1px solid #3a4270;
  color: #fff;
  padding: 0.35rem 0.6rem;
  font-size: 0.9rem;
}
.groupTitle {
  color: #fff;
  text-align: center;
  font-size: 1.35rem;
  letter-spacing: 0.04em;
  padding: 0.4rem 0 0.1rem;
  font-family: 'Fontin', sans-serif;
}
.section {
  background: #0d1a5a;
}
.section.open {
  background: #000;
  border: 1px solid #2a4fa8;
}
.header {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.35rem 0.6rem;
  background: #0d1a5a;
  cursor: pointer;
}
.header:hover {
  background: #12247a;
}
.icon {
  width: 2.2rem;
  height: 2.2rem;
  object-fit: contain;
  flex-shrink: 0;
}
.headerTitle {
  flex: 1;
  min-width: 0;
  color: #fff;
  font-size: 1.05rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: 'Fontin', sans-serif;
}
.changes {
  color: #3d8bff;
  font-size: 0.85rem;
  white-space: nowrap;
}
.reset {
  background: #0b2a6e;
  border: 1px solid #2a4fa8;
  color: #fff;
  font-size: 0.8rem;
  padding: 0.2rem 0.7rem;
  text-transform: uppercase;
}
.reset:disabled {
  opacity: 0.45;
}
.sub {
  background: #0d1a5a;
}
.sub.open {
  background: #050817;
  border: 1px solid #2a4fa8;
}
.subHeader {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.5rem;
  cursor: pointer;
}
.subHeader:hover {
  background: #12247a;
}
.subIcon {
  width: 1.7rem;
  height: 1.7rem;
  object-fit: contain;
  flex-shrink: 0;
}
.row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 0.5rem;
  background: #0d1a5a;
  cursor: pointer;
}
.row:hover {
  background: #12247a;
}
.rowSel {
  background: #050817;
  border: 1px solid #2a4fa8;
}
.rowOff {
  background: #050d2b;
}
.rowOff .tierName {
  color: #8f9bc4;
}
.preview {
  width: 13rem;
  max-width: 40%;
  flex-shrink: 0;
  padding: 0.2rem 0.4rem;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: 'FontinSmallcaps', 'Fontin', sans-serif;
}
.presets {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
  gap: 0.35rem;
}
.check {
  width: 1.7rem;
  height: 1.7rem;
  flex-shrink: 0;
  border: 1px solid #2a4fa8;
  background: #0b2a6e;
  color: #fff;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  justify-content: center;
}
.checkOn {
  background: #1b8fc1;
}
.tierName {
  color: #fff;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-family: 'Fontin', sans-serif;
}
</style>
