<template>
  <!-- facts about the item from the codex: dust of a unique, weight of a divination card… -->
  <div v-if="dust || card || sockets || divine" :class="$style.panel" class="text-gray-200 shadow-lg flex flex-col gap-2 p-2">
    <template v-if="dust">
      <div :class="$style.head"><img src="/images/dust.png" class="w-5 h-5 object-contain"> {{ t(':facts_dust') }}</div>
      <template v-if="dust.kind === 'one'">
        <div class="text-lg leading-none tabular-nums">{{ dust.value.toLocaleString() }}</div>
        <div class="text-xs text-gray-400 leading-tight">
          {{ t(':facts_dust_item', [dust.itemLevel, dust.quality]) }}<template v-if="dust.extras">, +{{ dust.extras * 50 }}%</template>
          <div v-if="dust.best !== dust.value">{{ t(':facts_dust_best', [dust.best.toLocaleString()]) }}</div>
          <div>{{ t(':facts_dust_per_slot', [dust.perSlot.toLocaleString()]) }}</div>
        </div>
      </template>
      <template v-else>
        <div class="text-xs text-gray-400">{{ t(':facts_dust_unid', [dust.itemLevel, dust.quality]) }}</div>
        <div v-for="u of dust.list" :key="u.name" class="flex gap-2 text-sm leading-tight">
          <span class="flex-1 min-w-0 truncate font-poe" :class="$style.unique">{{ u.name }}</span>
          <span class="tabular-nums">{{ compact(u.value) }}</span>
        </div>
      </template>
    </template>
    <template v-if="card">
      <div :class="$style.head"><i class="fas fa-layer-group"></i> {{ t(':facts_card') }}</div>
      <CardFacts :card="card" :max-sources="6" />
      <div class="text-xs text-gray-600">{{ t(':facts_card_data', [CARD_DATA.league]) }}</div>
    </template>
    <!-- calculators open in the codex, in the middle of the screen -->
    <button v-if="sockets" :class="$style.toolBtn" @click="openSockets">
      <i class="fas fa-palette w-5 text-center"></i>
      <span class="flex-1 text-left">{{ t(':facts_sockets') }}</span>
      <span class="text-xs tabular-nums tracking-wider">{{ sockets.colors.join('') }}</span>
      <i class="fas fa-external-link-alt text-xs text-gray-500"></i>
    </button>
    <button v-if="divine" :class="$style.toolBtn" @click="openDivine">
      <img src="/images/divine.png" class="w-5 h-5 object-contain">
      <span class="flex-1 text-left">{{ t(':facts_divine') }}</span>
      <i class="fas fa-external-link-alt text-xs text-gray-500"></i>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, watch } from 'vue'
import { useI18nNs } from '@/web/i18n'
import { ItemCategory, ItemRarity, type ParsedItem } from '@/parser'
import { ModifierMechanic } from '@/parser/modifiers'
import { CLIENT_STRINGS as _$ } from '@/assets/data'
import { dustValue } from './dust'
import { parseSockets } from './sockets'
import { CARD_DATA, baseReqs, cardByName, dustEntriesOfBase } from './data'
import CardFacts from './CardFacts.vue'
import { isDivineable, parseDivineMods } from './divine/divine-mods'
import { rememberDivineItem } from './divine/last-item'
import { openDivineCalc, openSocketCalc } from './open-codex'
import type { WidgetManager } from '../overlay/interfaces'

const props = defineProps<{
  item: ParsedItem
}>()

const { t } = useI18nNs('codex')
const wm = inject<WidgetManager>('wm')!

const dust = computed(() => {
  const item = props.item
  if (item.rarity !== ItemRarity.Unique) return null
  const itemLevel = item.itemLevel ?? 84
  const quality = item.quality ?? 0
  const corruptions = item.isCorrupted
    ? item.newMods.filter(m => m.info.mechanic === ModifierMechanic.Corruption).length
    : 0
  const extras = item.influences.length + corruptions
  const value = item.info.unique?.disenchantValue
  if (value != null) {
    const base = item.uniqueBase ?? item.info
    const size = (base.w ?? 1) * (base.h ?? 1)
    const result = dustValue(value, { itemLevel, quality, extras })
    return {
      kind: 'one' as const,
      value: result,
      itemLevel,
      quality,
      extras,
      best: dustValue(value, { itemLevel: 84, quality: Math.max(20, quality), extras }),
      perSlot: Math.floor(result / size)
    }
  }
  if (!item.isUnidentified) return null
  // unidentified: any unique of the base
  const list = dustEntriesOfBase(item.info.refName)
    .map(e => ({ name: e.name, value: dustValue(e.disenchantValue, { itemLevel, quality, extras }) }))
    .sort((a, b) => b.value - a.value)
  if (!list.length) return null
  return { kind: 'many' as const, list: list.slice(0, 8), itemLevel, quality }
})

const card = computed(() => props.item.category === ItemCategory.DivinationCard
  ? cardByName(props.item.info.refName) ?? null
  : null)

// socket colours of an item that has sockets (weighted by the attribute requirements of its base)
const sockets = computed(() => {
  const item = props.item
  const line = item.rawText.split(/\r?\n/).find(l => l.startsWith(_$.SOCKETS))
  const colors = parseSockets(line?.slice(_$.SOCKETS.length))
  if (!colors.length) return null
  const baseRef = item.info.unique?.base ?? item.uniqueBase?.refName ?? item.info.refName
  const reqs = baseReqs(baseRef)
  if (!reqs) return null
  return { colors, baseRef, reqs, itemLevel: item.itemLevel ?? 84, quality: item.quality ?? 0 }
})

// re-roll calculator for an item a Divine Orb can be used on
const divine = computed(() => isDivineable(props.item) && parseDivineMods(props.item.rawText).length > 0)

watch(() => props.item, rememberDivineItem, { immediate: true })

function openSockets () {
  if (sockets.value) openSocketCalc(wm, sockets.value)
}

function openDivine () {
  openDivineCalc(wm, props.item)
}

function compact (n: number) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (n >= 1e4) return `${Math.round(n / 1e3)}k`
  return n.toLocaleString()
}
</script>

<style lang="postcss" module>
.panel {
  background: #05081a;
  border: 1px solid #2a3470;
}
.head {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: bold;
  color: #c3cbf0;
  border-bottom: 1px solid #1d2560;
  padding-bottom: 0.2rem;
}
.toolBtn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: bold;
  color: #c3cbf0;
  background: #0d1335;
  border: 1px solid #2a3470;
  border-radius: 0.25rem;
  padding: 0.25rem 0.4rem;
  &:hover {
    background: #1d2560;
    color: #fff;
  }
}
.unique {
  color: #af6025;
}
</style>
