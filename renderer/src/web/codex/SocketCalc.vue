<template>
  <div class="flex flex-col gap-1">
    <!-- sockets: a click changes the colour wanted, white = any -->
    <div class="flex items-center gap-1 flex-wrap">
      <button v-for="(c, i) of colors" :key="i" :class="[$style.socket, $style[c]]" :title="t(':sockets_click')"
        @click="cycle(i)">{{ c === 'W' ? '' : c }}</button>
      <span class="text-xs text-gray-400 ml-1">{{ t(':sockets_want', [wantText]) }}</span>
    </div>
    <div class="text-xs text-gray-500 tabular-nums">
      <span :class="$style.r">R {{ pct(chances.r) }}</span> ·
      <span :class="$style.g">G {{ pct(chances.g) }}</span> ·
      <span :class="$style.b">B {{ pct(chances.b) }}</span> ·
      <span>W {{ pct(chances.w) }}</span>
    </div>

    <div v-if="!wanted" class="text-xs text-gray-500">{{ t(':sockets_pick') }}</div>
    <table v-else class="text-xs w-full tabular-nums">
      <tr class="text-gray-500">
        <th class="text-left font-normal">{{ t(':sockets_col_way') }}</th>
        <th class="text-right font-normal">{{ t(':sockets_col_chance') }}</th>
        <th class="text-right font-normal">{{ t(':sockets_col_tries') }}</th>
        <th class="text-right font-normal">{{ t(':sockets_col_cost') }}</th>
      </tr>
      <tr v-for="o of options" :key="o.key" :class="{ [$style.best]: best?.key === o.key }">
        <td class="pr-1 truncate" style="max-width: 9rem;" :title="label(o.key)">{{ label(o.key) }}</td>
        <td class="text-right pr-1">{{ pct(o.chance) }}</td>
        <td class="text-right pr-1">{{ num(o.tries) }}</td>
        <td class="text-right">{{ o.cost == null ? '—' : num(o.cost) }}</td>
      </tr>
    </table>
    <div v-if="wanted" class="text-xs text-gray-500">{{ t(':sockets_cost_hint', [chromaticName]) }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18nNs } from '@/web/i18n'
import { ITEM_BY_REF } from '@/assets/data'
import { bestOption, colorChances, dilute, recolorOptions, whiteChance, type RecipeKey, type Reqs } from './sockets'

type Color = 'R' | 'G' | 'B' | 'W'

const props = defineProps<{
  reqs: Reqs
  // the colours to start from (the item's own)
  initial: Color[]
  itemLevel: number
  quality: number
}>()

const { t } = useI18nNs('codex')

const colors = ref<Color[]>([...props.initial])
watch(() => props.initial.join(''), () => { colors.value = [...props.initial] })

const NEXT: Record<Color, Color> = { R: 'G', G: 'B', B: 'W', W: 'R' }
function cycle (i: number) {
  colors.value = colors.value.map((c, k) => k === i ? NEXT[c] : c)
}

const want = computed(() => ({
  r: colors.value.filter(c => c === 'R').length,
  g: colors.value.filter(c => c === 'G').length,
  b: colors.value.filter(c => c === 'B').length,
  w: 0
}))
const wanted = computed(() => want.value.r + want.value.g + want.value.b)
const wantText = computed(() => {
  const parts = [['R', want.value.r], ['G', want.value.g], ['B', want.value.b]]
    .filter(([, n]) => n).map(([c, n]) => `${n}${c}`)
  return parts.length ? parts.join(' ') : '—'
})

const chances = computed(() => dilute(colorChances(props.reqs), whiteChance(props.itemLevel, props.quality)))

const options = computed(() => recolorOptions({
  reqs: props.reqs,
  sockets: colors.value.length,
  want: want.value,
  itemLevel: props.itemLevel,
  quality: props.quality
}))
const best = computed(() => bestOption(options.value))

// names of the currency in the language of the game client
function itemName (ref: string) {
  return ITEM_BY_REF('ITEM', ref)?.[0]?.name ?? ref
}
const chromaticName = computed(() => itemName('Chromatic Orb'))

function label (key: RecipeKey) {
  switch (key) {
    case 'drop': return t(':sockets_way_drop')
    case 'chromatic': return chromaticName.value
    case 'trichromatism': return itemName('Omen of Trichromatism')
    case 'tainted': return itemName('Tainted Chromatic Orb')
    case 'nonwhite2': return t(':sockets_way_bench', [2])
    case 'nonwhite3': return t(':sockets_way_bench', [3])
    case 'nonwhite4': return t(':sockets_way_bench', [4])
  }
}

function pct (x: number) {
  const p = x * 100
  return `${p >= 10 ? p.toFixed(1) : p >= 0.1 ? p.toFixed(2) : p.toPrecision(2)}%`
}
function num (x: number) {
  return x >= 100 ? Math.round(x).toLocaleString() : x.toFixed(1)
}
</script>

<style lang="postcss" module>
.socket {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 9999px;
  font-size: 0.7rem;
  font-weight: bold;
  color: #fff;
  border: 2px solid #000;
  box-shadow: 0 0 0 1px #555;
}
.socket:hover {
  transform: scale(1.1);
}
.R { background: #c03030; }
.G { background: #3c9a3c; }
.B { background: #3c5ec8; }
.W { background: #d8d8d8; }
.r { color: #e05555; }
.g { color: #5ac85a; }
.b { color: #6f8cff; }
.best td {
  color: #9ae6b4;
  font-weight: bold;
}
</style>
