<template>
  <div class="flex flex-col gap-1 text-sm">
    <div class="flex items-center gap-2">
      <span :class="[$style.tier, $style[tier]]">{{ t(`:card_tier_${tier}`) }}</span>
      <span v-if="card.weight != null && tier !== 'disabled'" class="text-gray-400 text-xs">{{ t(':card_weight', [card.weight.toLocaleString()]) }}</span>
    </div>
    <div v-if="chance" class="leading-tight">
      {{ t(':card_one_in', [chance.toLocaleString()]) }}
      <div v-if="card.stack > 1" class="text-xs text-gray-400">{{ t(':card_stack_in', [card.stack, stackChance!.toLocaleString()]) }}</div>
    </div>
    <div v-else-if="card.stack > 1" class="text-xs text-gray-400">{{ t(':card_stack', [card.stack]) }}</div>
    <div v-if="card.reward" class="text-xs text-gray-300">{{ t(':card_reward') }}: {{ card.reward }}</div>
    <div v-if="sources.length" class="text-xs">
      <span class="text-gray-400">{{ t(':card_drops') }}:</span>
      {{ shownSources.join(', ') }}<template v-if="sources.length > shownSources.length">, {{ t(':card_more', [sources.length - shownSources.length]) }}</template>
    </div>
    <div v-else-if="tier !== 'disabled'" class="text-xs text-gray-500">{{ t(':card_drops_unknown') }}</div>
    <div v-if="card.minLevel" class="text-xs text-gray-500">{{ t(':card_min_level', [card.minLevel]) }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18nNs } from '@/web/i18n'
import { cardTier, oneIn, oneStackIn, type CardEntry } from './cards'
import { CARD_DATA, areaDisplayName } from './data'

const props = withDefaults(defineProps<{
  card: CardEntry
  maxSources?: number
}>(), { maxSources: 8 })

const { t } = useI18nNs('codex')

const tier = computed(() => cardTier(props.card))
const chance = computed(() => oneIn(props.card, CARD_DATA.totalWeight))
const stackChance = computed(() => oneStackIn(props.card, CARD_DATA.totalWeight))

const sources = computed(() => (props.card.sources ?? []).map(s =>
  s.kind === 'map' ? areaDisplayName(s.name)
    : s.kind === 'tag' ? t(':card_tag', [s.name])
      : s.name
))
const shownSources = computed(() => sources.value.slice(0, props.maxSources))
</script>

<style lang="postcss" module>
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
