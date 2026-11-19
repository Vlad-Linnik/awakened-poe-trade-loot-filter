<template>
  <div class="flex gap-3 min-h-0">
    <!-- left: sections and tiers -->
    <div class="flex flex-col gap-2 min-h-0" style="width: 22rem;">
      <input v-model.trim="search" :placeholder="t(':browse_search')"
        class="rounded bg-gray-900 px-2 py-1 text-sm">
      <div class="flex-1 overflow-y-auto pr-1 flex flex-col gap-1 min-h-0">
        <div v-if="!groups.length" class="text-gray-500 text-sm">{{ t(':browse_nothing') }}</div>
        <div v-for="g of groups" :key="g.title">
          <button class="w-full text-left text-xs uppercase text-gray-400 hover:text-white flex items-center gap-1 py-0.5"
            @click="toggleGroup(g.title)">
            <i class="fas text-gray-600" :class="isOpen(g) ? 'fa-caret-down' : 'fa-caret-right'"></i>
            <span class="truncate flex-1">{{ g.title }}</span>
            <span class="text-gray-600">{{ g.blocks.length }}</span>
          </button>
          <div v-if="isOpen(g)" class="flex flex-col gap-0.5 pl-3">
            <button v-for="e of g.blocks" :key="e.block.index"
              class="text-left rounded px-1.5 py-0.5 text-sm"
              :class="e.block.index === selected?.index ? 'bg-blue-900' : 'hover:bg-gray-700'"
              @click="select(e.block, e.matchedItems[0])">
              <div class="flex items-center gap-1 min-w-0">
                <span :class="visibilityClass(e.block.visibility)" class="px-1 rounded text-xs">{{ e.block.visibility }}</span>
                <span v-if="patchOf(e.block)" class="text-blue-400 text-xs"><i class="fas fa-pen"></i></span>
                <span class="truncate flex-1">{{ ruleTitle(e.block) }}</span>
                <span v-if="e.count" class="text-xs text-gray-500">{{ e.count }}</span>
              </div>
              <div v-if="e.matchedItems.length" class="text-xs text-yellow-400 truncate pl-1">{{ e.matchedItems.join(', ') }}</div>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- right: selected tier -->
    <div class="flex-1 overflow-y-auto overflow-x-hidden min-h-0 min-w-0 flex flex-col gap-2">
      <div v-if="!selected" class="text-gray-500 text-sm mt-4">{{ t(':browse_hint') }}</div>
      <template v-else>
        <div class="flex items-center gap-2">
          <span :class="visibilityClass(selected.visibility)" class="px-1.5 rounded text-xs font-bold">{{ selected.visibility }}</span>
          <span class="font-bold truncate" :title="selected.headerComment">{{ ruleTitle(selected) }}</span>
          <span class="flex-1"></span>
          <span class="text-xs text-gray-500 whitespace-nowrap">{{ t(':line', [selected.startLine + 1]) }}</span>
        </div>
        <div v-if="selected.section" class="text-xs text-gray-500 -mt-1">{{ selected.section }}</div>
        <details>
          <summary class="text-xs text-gray-400 cursor-pointer">{{ t(':show_text') }}</summary>
          <pre class="text-xs bg-gray-900 rounded p-1 overflow-x-auto mt-1">{{ blockText(parsed, selected) }}</pre>
        </details>
        <TierEditor :key="`${selected.index}-${mtime}`"
          :block="selected" :block-text="blockText(parsed, selected)"
          :item-name="sampleName" :has-patch="Boolean(patchOf(selected))" :busy="busy"
          :move-targets="moveTargets(parsed, selected)" :rule-title="ruleTitle" :highlight="highlight ?? undefined"
          @move="(bt: string, to: FilterBlock) => emit('move', bt, selected!, to)"
          @save="emit('save', selected!, $event)" @reset="emit('reset', selected!)"
          @disable="emit('disable', selected!)" @close="selectedSel = null" />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import { useI18nNs } from '@/web/i18n'
import { blockText, type FilterBlock, type ParsedFilter, type Visibility } from './filter-parser'
import { moveTargets } from './filter-edit'
import { findBlock, selectorOf, type BlockSelector, type TierPatch } from './edits'
import TierEditor, { type TierChange } from './TierEditor.vue'

const props = defineProps<{
  parsed: ParsedFilter
  mtime: number
  busy: boolean
  patchOf: (block: FilterBlock) => TierPatch | undefined
  ruleTitle: (block: FilterBlock) => string
  isAptRule: (block: FilterBlock) => boolean
}>()

const emit = defineEmits<{
  (e: 'save', block: FilterBlock, change: TierChange): void
  (e: 'reset' | 'disable', block: FilterBlock): void
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
  selectedSel.value = selectorOf(block)
  highlight.value = item ?? null
}

function baseTypes (block: FilterBlock) {
  return block.conditions.find(c => c.keyword === 'BaseType' && c.op !== '!' && c.op !== '!=')?.values ?? []
}

const sampleName = computed(() => {
  if (!selected.value) return ''
  return highlight.value ?? baseTypes(selected.value)[0] ?? props.ruleTitle(selected.value)
})

const groups = computed(() => {
  const q = search.value.toLowerCase()
  const out: Array<{ title: string, blocks: Array<{ block: FilterBlock, count: number, matchedItems: string[] }> }> = []
  let current: (typeof out)[number] | null = null
  for (const block of props.parsed.blocks) {
    if (props.isAptRule(block)) continue
    const items = baseTypes(block)
    let matchedItems: string[] = []
    if (q) {
      matchedItems = items.filter(n => n.toLowerCase().includes(q))
      const text = `${props.ruleTitle(block)} ${block.headerComment} ${block.section ?? ''}`.toLowerCase()
      if (!matchedItems.length && !text.includes(q)) continue
    }
    const title = block.section ?? '—'
    if (!current || current.title !== title) {
      current = { title, blocks: [] }
      out.push(current)
    }
    current.blocks.push({ block, count: items.length, matchedItems: matchedItems.slice(0, 5) })
  }
  return out
})

function isOpen (g: { title: string, blocks: Array<{ block: FilterBlock }> }) {
  return Boolean(search.value) || opened.value.has(g.title) ||
    g.blocks.some(e => e.block.index === selected.value?.index)
}

function toggleGroup (title: string) {
  const next = new Set(opened.value)
  if (next.has(title)) next.delete(title)
  else next.add(title)
  opened.value = next
}

function visibilityClass (v: Visibility) {
  return v === 'Hide' ? 'bg-gray-700 text-gray-300' : v === 'Minimal' ? 'bg-yellow-900 text-yellow-100' : 'bg-green-800 text-green-100'
}
</script>
