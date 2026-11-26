<template>
  <div class="flex flex-col">
    <!-- settings -->
    <div class="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-sm" :class="$style.bar">
      <input v-model="search" type="text" :placeholder="t(':dust_search')" class="rounded bg-gray-900 px-2 py-0.5 w-56">
      <select :value="model.category ?? ''" class="rounded bg-gray-900 px-1 py-0.5"
        @change="update({ category: ($event.target as HTMLSelectElement).value || null })">
        <option value="">{{ t(':dust_all_classes') }}</option>
        <option v-for="c of categories" :key="c.id" :value="c.id">{{ c.label }}</option>
      </select>
      <label class="flex items-center gap-1">{{ t(':dust_ilvl') }}
        <input type="number" min="1" max="100" :value="model.itemLevel" class="rounded bg-gray-900 px-1 w-14"
          @change="update({ itemLevel: clampInt(($event.target as HTMLInputElement).value, 1, 100, 84) })">
      </label>
      <label class="flex items-center gap-1">{{ t(':dust_quality') }}
        <input type="number" min="0" max="30" :value="model.quality" class="rounded bg-gray-900 px-1 w-12"
          @change="update({ quality: clampInt(($event.target as HTMLInputElement).value, 0, 30, 0) })">
      </label>
      <label class="flex items-center gap-1" :title="t(':dust_extras_hint')">{{ t(':dust_extras') }}
        <input type="number" min="0" max="8" :value="model.extras" class="rounded bg-gray-900 px-1 w-12"
          @change="update({ extras: clampInt(($event.target as HTMLInputElement).value, 0, 8, 0) })">
      </label>
      <span class="flex-1"></span>
      <span class="text-gray-500">{{ t(':dust_count', [rows.length]) }}</span>
    </div>

    <!-- header -->
    <div class="flex items-center gap-2 px-3 py-1 text-xs text-gray-400 select-none" :class="$style.head">
      <span class="w-7"></span>
      <button class="flex-1 text-left" :class="{ 'text-white': model.sort === 'name' }" @click="update({ sort: 'name' })">
        {{ t(':dust_col_name') }} <i v-if="model.sort === 'name'" class="fas fa-caret-down"></i>
      </button>
      <span class="w-12 text-center">{{ t(':dust_col_size') }}</span>
      <button class="w-28 text-right" :class="{ 'text-white': model.sort === 'dust' }" @click="update({ sort: 'dust' })">
        {{ t(':dust_col_dust') }} <i v-if="model.sort === 'dust'" class="fas fa-caret-down"></i>
      </button>
      <button class="w-28 text-right" :class="{ 'text-white': model.sort === 'perSlot' }" :title="t(':dust_col_per_slot_hint')" @click="update({ sort: 'perSlot' })">
        {{ t(':dust_col_per_slot') }} <i v-if="model.sort === 'perSlot'" class="fas fa-caret-down"></i>
      </button>
      <span class="w-5"></span>
    </div>

    <div v-if="!rows.length" class="p-6 text-center text-gray-500">{{ t(':dust_empty') }}</div>
    <VirtualScroll v-else class="flex-1 min-h-0" :items="rows" :item-height="ROW_HEIGHT">
      <template #default="{ item: row, top }">
        <div :key="row.key" class="absolute inset-x-0 flex items-center gap-2 px-3" :class="$style.row"
          :style="{ top: `${top}px`, height: `${ROW_HEIGHT}px` }">
          <span class="w-7 h-7 flex items-center justify-center flex-shrink-0">
            <img v-if="row.icon" :src="row.icon" class="max-w-full max-h-full object-contain" loading="lazy">
          </span>
          <div class="flex-1 min-w-0 leading-tight">
            <div class="truncate font-poe" :class="$style.unique" :title="row.entry.refName">{{ row.entry.name }}</div>
            <div class="truncate text-xs text-gray-500">{{ row.entry.baseName }}<template v-if="row.category"> · {{ row.category }}</template></div>
          </div>
          <span class="w-12 text-center text-gray-400 text-sm">{{ row.entry.w }}×{{ row.entry.h }}</span>
          <span class="w-28 text-right tabular-nums" :title="row.dust.toLocaleString()">{{ compact(row.dust) }}</span>
          <span class="w-28 text-right tabular-nums text-gray-300" :title="row.perSlot.toLocaleString()">{{ compact(row.perSlot) }}</span>
          <button class="w-5 text-gray-600 hover:text-gray-200" :title="t(':dust_wiki')" @click="openWiki(row.entry.refName)">
            <i class="fas fa-external-link-alt text-xs"></i>
          </button>
        </div>
      </template>
    </VirtualScroll>
    <div class="px-3 py-1 text-xs text-gray-500" :class="$style.foot">{{ t(':dust_note') }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import { useI18nNs } from '@/web/i18n'
import { ITEM_BY_REF, ITEMS_ITERATOR } from '@/assets/data'
import VirtualScroll from '@/web/ui/VirtualScroll.vue'
import { CATEGORY_TO_TRADE_ID } from '@/web/price-check/trade/pathofexile-trade'
import { dustEntries, dustValue, type DustEntry } from './dust'
import type { CodexWidget } from './widget'

type DustSettings = CodexWidget['dust']

const props = defineProps<{
  modelValue: DustSettings
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: DustSettings): void
}>()
const model = computed(() => props.modelValue)
const { t } = useI18nNs('codex')

const ROW_HEIGHT = 40

function update (patch: Partial<DustSettings>) {
  emit('update:modelValue', { ...props.modelValue, ...patch })
}

const search = ref('')

const entries = shallowRef<DustEntry[]>(dustEntries(
  ITEMS_ITERATOR('"disenchantValue"'),
  ref => ITEM_BY_REF('ITEM', ref)?.[0]
))

function categoryLabel (category: string | null): string | null {
  if (!category) return null
  const tradeId = CATEGORY_TO_TRADE_ID.get(category as never)
  const key = tradeId ? `item_category.${tradeId.replace('.', '_')}` : null
  const label = key ? t(key) : null
  return label && label !== key ? label : category
}

const categories = computed(() => {
  const ids = [...new Set(entries.value.map(e => e.category).filter((c): c is string => c != null))]
  return ids.map(id => ({ id, label: categoryLabel(id)! }))
    .sort((a, b) => a.label.localeCompare(b.label))
})

const rows = computed(() => {
  const { itemLevel, quality, extras, sort, category } = model.value
  const words = search.value.toLowerCase().split(/\s+/).filter(Boolean)
  const list = entries.value
    .filter(e => !category || e.category === category)
    .filter(e => {
      if (!words.length) return true
      const text = `${e.name} ${e.refName} ${e.baseName} ${e.baseRef}`.toLowerCase()
      return words.every(w => text.includes(w))
    })
    .map(entry => {
      const dust = dustValue(entry.disenchantValue, { itemLevel, quality, extras })
      return {
        key: `${entry.refName}\n${entry.baseRef}`,
        entry,
        dust,
        perSlot: Math.floor(dust / (entry.w * entry.h)),
        category: categoryLabel(entry.category),
        icon: entry.icon.startsWith('https://') ? entry.icon : null
      }
    })
  if (sort === 'name') list.sort((a, b) => a.entry.name.localeCompare(b.entry.name))
  else if (sort === 'perSlot') list.sort((a, b) => b.perSlot - a.perSlot || b.dust - a.dust)
  else list.sort((a, b) => b.dust - a.dust || b.perSlot - a.perSlot)
  return list
})

function clampInt (raw: string, min: number, max: number, fallback: number) {
  const n = Math.round(Number(raw))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

function compact (n: number) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2)}M`
  if (n >= 1e4) return `${Math.round(n / 1e3)}k`
  return n.toLocaleString()
}

function openWiki (refName: string) {
  window.open(`https://www.poewiki.net/wiki/${encodeURIComponent(refName.replace(/ /g, '_'))}`)
}
</script>

<style lang="postcss" module>
.bar {
  border-bottom: 1px solid #1d2560;
}
.head {
  border-bottom: 1px solid #1d2560;
  background: #070c2a;
}
.row {
  border-bottom: 1px solid #0f1540;
}
.row:hover {
  background: #0b1238;
}
.unique {
  color: #af6025;
}
.foot {
  border-top: 1px solid #1d2560;
}
</style>
