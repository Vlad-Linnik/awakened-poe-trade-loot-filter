<template>
  <!-- any base type of the game, found by a part of its name or by a unique item -->
  <div class="flex flex-col flex-1 min-w-0">
    <div class="flex gap-1">
      <input v-model="query" :placeholder="t(':custom_any_base')" :class="$style.input" class="flex-1 min-w-0"
        @keydown.enter.prevent="submit">
      <button :class="$style.btn" :disabled="disabled || !query.trim()" @click="submit">{{ t(':fb_add') }}</button>
    </div>
    <div v-if="hits.length || unknown" :class="$style.list">
      <button v-for="hit of hits" :key="hit.base.ref" class="flex items-center gap-1 text-left px-1 hover:bg-gray-700"
        :disabled="disabled" @click="pick(hit)">
        <img v-if="hit.base.icon" :src="hit.base.icon" class="w-6 h-6 object-contain">
        <span v-else class="w-6 h-6"></span>
        <span>{{ hit.base.ref }}</span>
        <span v-if="hit.base.name !== hit.base.ref" class="text-gray-500"> · {{ hit.base.name }}</span>
        <span v-if="hit.unique" class="text-orange-400"> · {{ hit.unique.name }}</span>
      </button>
      <div v-if="unknown" class="flex items-center gap-2 px-1 py-0.5 text-yellow-200">
        <span class="flex-1">{{ t(':custom_unknown', [unknown]) }}</span>
        <button :class="$style.btn" :disabled="disabled" @click="add({ ref: unknown, rarities: [] })">{{ t(':add_anyway') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18nNs } from '@/web/i18n'
import type { ParsedFilter } from './filter-parser'
import type { NewBase } from './apt-rules'
import { searchBases, type BaseHit } from './base-search'

const props = defineProps<{
  parsed: ParsedFilter
  disabled: boolean
}>()

const emit = defineEmits<{
  (e: 'add', base: NewBase): void
}>()

const { t } = useI18nNs('loot_filter')

const query = ref('')
const hits = computed(() => searchBases(query.value, { scope: () => true, withUniques: true, limit: 30, filter: props.parsed }))
// an unknown name makes the game reject the whole filter: add it only on purpose
const unknown = computed(() => {
  const name = query.value.replace(/"/g, '').trim()
  return name.length >= 2 && !hits.value.length ? name : ''
})

function add (base: NewBase) {
  query.value = ''
  emit('add', base)
}

function pick (hit: BaseHit) {
  // found by a unique: the unique is needed, otherwise - everything but uniques
  const { rarities } = hit.base
  const other = rarities.filter(r => r !== 'Unique')
  add({
    ref: hit.base.ref,
    rarities: hit.unique || !other.length
      ? rarities.filter(r => r === 'Unique')
      : other
  })
}

function submit () {
  if (hits.value.length && !props.disabled) pick(hits.value[0])
}
</script>

<style lang="postcss" module>
.input {
  background: #13235e;
  border: 1px solid #2a4fa8;
  color: #fff;
  padding: 0.25rem 0.5rem;
  font-size: 0.9rem;
}
.btn {
  background: #13235e;
  border: 1px solid #2a4fa8;
  color: #fff;
  font-size: 0.85rem;
  padding: 0.2rem 0.8rem;
  white-space: nowrap;
}
.btn:hover:not(:disabled) {
  background: #1d3787;
}
.btn:disabled {
  opacity: 0.5;
}
.list {
  display: flex;
  flex-direction: column;
  max-height: 14rem;
  overflow-y: auto;
  background: #05081a;
  border: 1px solid #3a4270;
  font-size: 0.85rem;
}
</style>
