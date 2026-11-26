<template>
  <div class="flex flex-col">
    <!-- settings -->
    <div class="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-sm" :class="$style.bar">
      <input v-model="search" type="text" :placeholder="t(':cards_search')" class="rounded bg-gray-900 px-2 py-0.5 w-56">
      <select :value="model.tier ?? ''" class="rounded bg-gray-900 px-1 py-0.5"
        @change="update({ tier: (($event.target as HTMLSelectElement).value || null) as CardTier | null })">
        <option value="">{{ t(':cards_all_tiers') }}</option>
        <option v-for="tier of TIERS" :key="tier" :value="tier">{{ t(`:card_tier_${tier}`) }}</option>
      </select>
      <select :value="model.area ?? ''" class="rounded bg-gray-900 px-1 py-0.5 max-w-56"
        @change="update({ area: ($event.target as HTMLSelectElement).value || null })">
        <option value="">{{ t(':cards_all_areas') }}</option>
        <option v-for="a of areas" :key="a.ref" :value="a.ref">{{ a.name }} ({{ a.count }})</option>
      </select>
      <select :value="model.sort" class="rounded bg-gray-900 px-1 py-0.5"
        @change="update({ sort: ($event.target as HTMLSelectElement).value as CardSettings['sort'] })">
        <option value="rare">{{ t(':cards_sort_rare') }}</option>
        <option value="common">{{ t(':cards_sort_common') }}</option>
        <option value="name">{{ t(':cards_sort_name') }}</option>
      </select>
      <span class="flex-1"></span>
      <span class="text-gray-500">{{ t(':cards_count', [rows.length]) }}</span>
    </div>

    <!-- header -->
    <div class="flex items-center gap-2 px-3 py-1 text-xs text-gray-400 select-none" :class="$style.head">
      <span class="flex-1">{{ t(':cards_col_card') }}</span>
      <span class="w-10 text-center">{{ t(':cards_col_stack') }}</span>
      <span class="w-32 text-center">{{ t(':cards_col_tier') }}</span>
      <span class="w-20 text-right">{{ t(':cards_col_weight') }}</span>
      <span class="w-24 text-right">{{ t(':cards_col_chance') }}</span>
    </div>

    <div v-if="!rows.length" class="p-6 text-center text-gray-500">{{ t(':dust_empty') }}</div>
    <VirtualScroll v-else class="flex-1 min-h-0" :items="rows" :item-height="ROW_HEIGHT">
      <template #default="{ item: row, top }">
        <div :key="row.card.name" class="absolute inset-x-0 flex items-center gap-2 px-3" :class="$style.row"
          :style="{ top: `${top}px`, height: `${ROW_HEIGHT}px` }">
          <div class="flex-1 min-w-0 leading-tight">
            <div class="truncate font-poe" :title="row.card.name">{{ row.name }}</div>
            <div class="truncate text-xs text-gray-400" :title="row.card.reward">{{ row.card.reward }}</div>
            <div class="truncate text-xs text-gray-500" :title="row.where">{{ row.where }}</div>
          </div>
          <span class="w-10 text-center text-gray-400 text-sm">{{ row.card.stack }}</span>
          <span class="w-32 text-center"><span :class="[$style.tier, $style[row.tier]]">{{ t(`:card_tier_${row.tier}`) }}</span></span>
          <span class="w-20 text-right tabular-nums text-gray-300">{{ row.card.weight != null && row.tier !== 'disabled' ? row.card.weight.toLocaleString() : '—' }}</span>
          <span class="w-24 text-right tabular-nums" :title="row.chance ? t(':card_one_in', [row.chance.toLocaleString()]) : ''">{{ row.chance ? `1 / ${compact(row.chance)}` : '—' }}</span>
        </div>
      </template>
    </VirtualScroll>
    <div class="px-3 py-1 text-xs text-gray-500" :class="$style.foot">{{ t(':cards_note', [CARD_DATA.league, CARD_DATA.updated]) }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18nNs } from '@/web/i18n'
import VirtualScroll from '@/web/ui/VirtualScroll.vue'
import { cardTier, oneIn, TIER_LIMITS, type CardTier } from './cards'
import { CARD_DATA, areaDisplayName, cardDisplayName } from './data'
import type { CodexWidget } from './widget'

type CardSettings = CodexWidget['cards']

const props = defineProps<{
  modelValue: CardSettings
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: CardSettings): void
}>()
const model = computed(() => props.modelValue)
const { t } = useI18nNs('codex')

const ROW_HEIGHT = 52
const TIERS: CardTier[] = [...TIER_LIMITS.map(([tier]) => tier), 'boss', 'unknown', 'disabled']

function update (patch: Partial<CardSettings>) {
  emit('update:modelValue', { ...props.modelValue, ...patch })
}

const search = ref('')

const all = CARD_DATA.cards.map(card => {
  const sources = (card.sources ?? []).map(s =>
    s.kind === 'map' ? areaDisplayName(s.name)
      : s.kind === 'tag' ? t(':card_tag', [s.name])
        : s.name)
  return {
    card,
    name: cardDisplayName(card.name),
    tier: cardTier(card),
    chance: oneIn(card, CARD_DATA.totalWeight),
    where: sources.length ? sources.join(', ') : '',
    maps: new Set((card.sources ?? []).filter(s => s.kind === 'map').map(s => s.name))
  }
})

// maps of the Atlas and how many cards drop there
const areas = (() => {
  const count = new Map<string, number>()
  for (const row of all) {
    if (row.tier === 'disabled') continue
    for (const m of row.maps) count.set(m, (count.get(m) ?? 0) + 1)
  }
  return [...count].map(([ref, n]) => ({ ref, name: areaDisplayName(ref), count: n }))
    .sort((a, b) => a.name.localeCompare(b.name))
})()

const rows = computed(() => {
  const { sort, tier, area } = model.value
  const words = search.value.toLowerCase().split(/\s+/).filter(Boolean)
  const list = all
    .filter(r => tier ? r.tier === tier : r.tier !== 'disabled')
    .filter(r => !area || r.maps.has(area))
    .filter(r => {
      if (!words.length) return true
      const text = `${r.name} ${r.card.name} ${r.card.reward} ${r.where}`.toLowerCase()
      return words.every(w => text.includes(w))
    })
  const weight = (r: typeof all[number]) => r.chance == null ? null : r.card.weight!
  if (sort === 'name') {
    list.sort((a, b) => a.name.localeCompare(b.name))
  } else {
    const dir = sort === 'rare' ? 1 : -1
    // cards without a weight of the pool go last
    list.sort((a, b) => {
      const wa = weight(a)
      const wb = weight(b)
      if (wa == null || wb == null) return (wa == null ? 1 : 0) - (wb == null ? 1 : 0) || a.name.localeCompare(b.name)
      return dir * (wa - wb) || a.name.localeCompare(b.name)
    })
  }
  return list
})

function compact (n: number) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e4) return `${Math.round(n / 1e3)}k`
  return n.toLocaleString()
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
.foot {
  border-top: 1px solid #1d2560;
}
.tier {
  padding: 0 0.4rem;
  border-radius: 2px;
  font-size: 0.75rem;
  white-space: nowrap;
}
.t0 { background: #b91c1c; color: #fff; }
.t1 { background: #c2410c; color: #fff; }
.t2 { background: #a16207; color: #fff; }
.t3 { background: #1e3a8a; color: #dbeafe; }
.t4 { background: #374151; color: #e5e7eb; }
.boss { background: #6b21a8; color: #fff; }
.disabled { background: #111827; color: #9ca3af; border: 1px solid #374151; }
.unknown { background: #111827; color: #9ca3af; border: 1px solid #374151; }
</style>
