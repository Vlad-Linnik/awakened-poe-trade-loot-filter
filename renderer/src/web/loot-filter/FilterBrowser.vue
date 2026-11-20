<template>
  <div class="flex flex-col gap-2 min-h-0">
    <input v-model.trim="search" :placeholder="t(':browse_search')" :class="$style.search">

    <div class="flex-1 overflow-y-auto min-h-0 flex flex-col gap-2 pr-1">
      <div v-if="!groups.length" class="text-gray-400 text-sm">{{ t(':browse_nothing') }}</div>

      <template v-for="group of groups" :key="group.id">
      <div :class="$style.groupTitle">{{ group.title }}</div>
      <div v-for="sec of group.sections" :key="sec.title" :class="[$style.section, { [$style.open]: isOpen(sec.title) }]">
        <!-- category header: icon, title, changes, RESET -->
        <div :class="$style.header" @click="toggle(sec.title)">
          <img v-if="sec.icon" :src="sec.icon" :class="$style.icon">
          <span v-else :class="$style.icon"></span>
          <span :class="$style.headerTitle">{{ sec.title }}</span>
          <span v-if="sec.changes" :class="$style.changes">{{ t(':fb_changes', [sec.changes]) }}</span>
          <button :class="$style.reset" :disabled="!sec.changes || busy" @click.stop="emit('reset-blocks', sec.blocks)">{{ t(':fb_reset') }}</button>
        </div>

        <div v-if="isOpen(sec.title)" class="flex flex-col gap-2 p-2">
          <div v-for="sub of sec.subs" :key="sub.title" :class="[$style.sub, { [$style.open]: isOpen(sec.title + '/' + sub.title) }]">
            <div :class="$style.subHeader" @click="toggle(sec.title + '/' + sub.title)">
              <img v-if="sub.icon" :src="sub.icon" :class="$style.subIcon">
              <span v-else :class="$style.subIcon"></span>
              <span :class="$style.headerTitle">{{ sub.title }}</span>
              <span v-if="sub.changes" :class="$style.changes">{{ t(':fb_changes', [sub.changes]) }}</span>
              <button :class="$style.reset" :disabled="!sub.changes || busy" @click.stop="emit('reset-blocks', sub.blocks.map(e => e.block))">{{ t(':fb_reset') }}</button>
            </div>

            <div v-if="isOpen(sec.title + '/' + sub.title)" class="flex flex-col gap-1 p-1">
              <template v-for="e of sub.blocks" :key="e.block.index">
                <!-- tier row: show checkbox, name, style preview -->
                <div :class="[$style.row, { [$style.rowSel]: selected?.index === e.block.index }]" @click="select(e.block, e.matchedItems[0])">
                  <button :class="[$style.check, { [$style.checkOn]: e.block.visibility !== 'Hide' }]" :disabled="busy"
                    :title="e.block.visibility === 'Hide' ? t(':vis_hide') : t(':vis_show')"
                    @click.stop="emit('save', e.block, { visibility: e.block.visibility === 'Hide' ? 'Show' : 'Hide' })">
                    <i v-if="e.block.visibility !== 'Hide'" class="fas fa-check"></i>
                  </button>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1">
                      <span :class="$style.tierName">{{ blockTierName(e.block, t) }}</span>
                      <i v-if="patchOf(e.block)" class="fas fa-pen text-blue-400 text-xs" :title="t(':tier_changed')"></i>
                      <span v-if="e.count" class="text-xs text-gray-500">{{ e.count }}</span>
                    </div>
                    <div class="text-xs text-gray-500 truncate" :title="e.block.headerComment">{{ conditionHints(e.block, t).join(' · ') }}</div>
                    <div v-if="e.matchedItems.length" class="text-xs text-yellow-400 truncate">{{ e.matchedItems.join(', ') }}</div>
                  </div>
                  <span class="px-1.5 font-poe text-xs whitespace-nowrap overflow-hidden max-w-48" :style="chipStyle(e.block)">
                    <span v-if="e.minimap" :style="{ color: effectColor(e.minimap.color) }">{{ shapeGlyph(e.minimap.shape) }}</span>
                    {{ e.matchedItems[0] ?? sampleName(e.block) }}
                  </span>
                </div>
                <TierEditor v-if="selected?.index === e.block.index"
                  :key="`${e.block.index}-${mtime}`"
                  :block="e.block" :block-text="blockText(parsed, e.block)"
                  :item-name="highlight ?? sampleName(e.block)" :has-patch="Boolean(patchOf(e.block))" :busy="busy"
                  :move-targets="moveTargets(parsed, e.block)" :rule-title="ruleTitle" :highlight="highlight ?? undefined"
                  @move="(bt: string, to: FilterBlock) => emit('move', bt, e.block, to)"
                  @save="emit('save', e.block, $event)" @reset="emit('reset', e.block)"
                  @disable="emit('disable', e.block)" @close="selectedSel = null" />
              </template>
            </div>
          </div>
        </div>
      </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { useI18nNs } from '@/web/i18n'
import { blockText, type FilterBlock, type ParsedFilter } from './filter-parser'
import { moveTargets } from './filter-edit'
import { findBlock, selectorOf, type BlockSelector, type TierPatch } from './edits'
import { styleFromActions, styleCss } from './style'
import { iconForBlocks, iconForBase, sampleName, shapeGlyph, effectColor } from './fb'
import { CATEGORIES, GROUPS, categoryOf } from './fb-categories'
import { blockTierName, conditionHints } from './names'
import TierEditor, { type TierChange } from './TierEditor.vue'

const props = defineProps<{
  parsed: ParsedFilter
  mtime: number
  busy: boolean
  patchOf: (block: FilterBlock) => TierPatch | undefined
  ruleTitle: (block: FilterBlock) => string
  isAptRule: (block: FilterBlock) => boolean
  // open this tier (e.g. "Find in Customizer" from an item)
  focus?: { selector: BlockSelector, item?: string } | null
}>()

const emit = defineEmits<{
  (e: 'save', block: FilterBlock, change: TierChange): void
  (e: 'reset' | 'disable', block: FilterBlock): void
  (e: 'reset-blocks', blocks: FilterBlock[]): void
  (e: 'move', baseType: string, from: FilterBlock, to: FilterBlock): void
}>()

const { t } = useI18nNs('loot_filter')

const search = ref('')
const opened = ref(new Set<string>())
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

watch(() => props.focus, (focus) => {
  if (!focus) return
  const block = findBlock(props.parsed, focus.selector)
  if (!block) return
  selectedSel.value = selectorOf(block)
  highlight.value = focus.item ?? null
  const cat = categoryOf(block).title
  opened.value = new Set([...opened.value, cat, `${cat}/${block.section ?? block.topSection ?? cat}`])
}, { immediate: true })

function baseTypes (block: FilterBlock) {
  return block.conditions.find(c => c.keyword === 'BaseType' && c.op !== '!' && c.op !== '!=')?.values ?? []
}

interface Entry { block: FilterBlock, count: number, matchedItems: string[], minimap: ReturnType<typeof styleFromActions>['minimap'] }
interface Sub { title: string, blocks: Entry[], icon: string | null, changes: number }
interface Section { title: string, subs: Sub[], blocks: FilterBlock[], icon: string | null, changes: number, order: number }

// FilterBlade-like tree: group -> category -> NeverSink subsection -> tiers
const groups = computed(() => {
  const q = search.value.toLowerCase()
  const byCategory = new Map<string, Section & { group: string }>()
  for (const block of props.parsed.blocks) {
    if (props.isAptRule(block)) continue
    const items = baseTypes(block)
    let matchedItems: string[] = []
    if (q) {
      matchedItems = items.filter(n => n.toLowerCase().includes(q))
      const text = `${props.ruleTitle(block)} ${blockTierName(block, t)} ${block.headerComment} ${block.section ?? ''} ${block.topSection ?? ''}`.toLowerCase()
      if (!matchedItems.length && !text.includes(q)) continue
    }
    const cat = categoryOf(block)
    let sec = byCategory.get(cat.id)
    if (!sec) {
      sec = { title: cat.title, group: cat.group, subs: [], blocks: [], icon: iconForBase(cat.icon), changes: 0, order: CATEGORIES.indexOf(cat) }
      byCategory.set(cat.id, sec)
    }
    const subTitle = block.section ?? block.topSection ?? cat.title
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
  for (const sec of byCategory.values()) {
    for (const sub of sec.subs) sub.icon = iconForBlocks(sub.blocks.map(e => e.block)) ?? sec.icon
  }
  return GROUPS
    .map(g => ({
      id: g.id,
      title: g.title,
      sections: [...byCategory.values()].filter(sec => sec.group === g.id).sort((a, b) => a.order - b.order)
    }))
    .filter(g => g.sections.length)
})

function isOpen (key: string) {
  return Boolean(search.value) || opened.value.has(key)
}

function toggle (key: string) {
  const next = new Set(opened.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  opened.value = next
}

function chipStyle (block: FilterBlock) {
  return { ...styleCss(styleFromActions(block.actions), block.visibility === 'Hide'), fontSize: '0.8rem', borderWidth: '1px' }
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
.check {
  width: 1.1rem;
  height: 1.1rem;
  flex-shrink: 0;
  border: 1px solid #9fb3ff;
  background: transparent;
  color: #fff;
  font-size: 0.65rem;
  display: flex;
  align-items: center;
  justify-content: center;
}
.checkOn {
  background: #1b8fc1;
  border-color: #fff;
}
.tierName {
  color: #fff;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-family: 'Fontin', sans-serif;
}
</style>
