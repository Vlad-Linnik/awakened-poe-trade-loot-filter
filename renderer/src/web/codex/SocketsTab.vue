<template>
  <div class="flex flex-col overflow-y-auto">
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2 text-sm" :class="$style.bar">
      <label class="flex items-center gap-1">{{ t(':sockets_base') }}
        <input :value="baseText" list="codex-socket-bases" type="text" :placeholder="t(':sockets_base_hint')"
          class="rounded bg-gray-900 px-2 py-0.5 w-56" @change="pickBase(($event.target as HTMLInputElement).value)">
        <datalist id="codex-socket-bases">
          <option v-for="b of bases" :key="b.ref" :value="b.name" />
        </datalist>
      </label>
      <label v-for="(label, i) of REQ_LABELS" :key="label" class="flex items-center gap-1">{{ t(label) }}
        <input type="number" min="0" max="500" :value="model.reqs[i]" class="rounded bg-gray-900 px-1 w-14"
          @change="setReq(i, ($event.target as HTMLInputElement).value)">
      </label>
    </div>
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2 text-sm" :class="$style.bar">
      <label class="flex items-center gap-1">{{ t(':sockets_count') }}
        <select :value="model.count" class="rounded bg-gray-900 px-1 py-0.5"
          @change="update({ count: Number(($event.target as HTMLSelectElement).value) })">
          <option v-for="n in 6" :key="n" :value="n">{{ n }}</option>
        </select>
      </label>
      <label class="flex items-center gap-1">{{ t(':dust_ilvl') }}
        <input type="number" min="1" max="100" :value="model.itemLevel" class="rounded bg-gray-900 px-1 w-14"
          @change="update({ itemLevel: clampInt(($event.target as HTMLInputElement).value, 1, 100, 84) })">
      </label>
      <label class="flex items-center gap-1">{{ t(':dust_quality') }}
        <input type="number" min="0" max="30" :value="model.quality" class="rounded bg-gray-900 px-1 w-12"
          @change="update({ quality: clampInt(($event.target as HTMLInputElement).value, 0, 30, 0) })">
      </label>
    </div>
    <div class="p-3" style="max-width: 32rem;">
      <SocketCalc :reqs="model.reqs" :initial="initial" :item-level="model.itemLevel" :quality="model.quality" />
    </div>
    <div class="mt-auto px-3 py-1 text-xs text-gray-500" :class="$style.foot">{{ t(':sockets_note') }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18nNs } from '@/web/i18n'
import { ITEM_BY_REF } from '@/assets/data'
import SocketCalc from './SocketCalc.vue'
import { BASE_REQS } from './data'
import type { Reqs } from './sockets'
import type { CodexWidget } from './widget'
import { socketsFromItem } from './open-codex'

type SocketSettings = CodexWidget['sockets']

const props = defineProps<{
  modelValue: SocketSettings
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: SocketSettings): void
}>()
const model = computed(() => props.modelValue)
const { t } = useI18nNs('codex')

const REQ_LABELS = [':sockets_str', ':sockets_dex', ':sockets_int']

function update (patch: Partial<SocketSettings>) {
  if (patch.count != null && patch.count !== model.value.count) socketsFromItem.value = null
  emit('update:modelValue', { ...props.modelValue, ...patch })
}

// base types in the language of the game client
const bases = Object.keys(BASE_REQS)
  .map(ref => ({ ref, name: ITEM_BY_REF('ITEM', ref)?.[0]?.name ?? ref }))
  .sort((a, b) => a.name.localeCompare(b.name))

const baseText = computed(() => {
  const ref = model.value.base
  return ref ? (bases.find(b => b.ref === ref)?.name ?? ref) : ''
})

function pickBase (text: string) {
  const value = text.trim().toLowerCase()
  const base = bases.find(b => b.name.toLowerCase() === value || b.ref.toLowerCase() === value)
  if (base) update({ base: base.ref, reqs: [...BASE_REQS[base.ref]] as Reqs })
  else if (!value) update({ base: null })
}

function setReq (i: number, raw: string) {
  const reqs = [...model.value.reqs] as Reqs
  reqs[i] = clampInt(raw, 0, 500, 0)
  // typed in: no longer the requirements of the base
  update({ reqs, base: null })
}

// the item's own colours when opened from an item, white otherwise
const initial = computed(() => {
  const own = socketsFromItem.value
  if (own && own.length === model.value.count) return own
  return Array.from({ length: model.value.count }, () => 'W' as const)
})

function clampInt (raw: string, min: number, max: number, fallback: number) {
  const n = Math.round(Number(raw))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}
</script>

<style lang="postcss" module>
.bar {
  border-bottom: 1px solid #1d2560;
}
.foot {
  border-top: 1px solid #1d2560;
}
</style>
