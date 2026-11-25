<template>
  <!-- all conditions of the game by groups, so that there is no need to know their names -->
  <Teleport :to="host">
    <div :class="$style.overlay" @keydown.esc.stop="emit('close')">
      <div class="flex items-stretch">
        <input ref="searchEl" v-model="query" :placeholder="t(':cond_search')" :class="$style.search"
          @keydown.enter.prevent="pickOnly">
        <button :class="$style.close" :title="t(':cancel')" @click="emit('close')"><i class="fas fa-times"></i></button>
      </div>
      <div class="flex flex-col gap-3 p-3 overflow-y-auto">
        <div v-for="group of groups" :key="group.id" class="flex flex-col gap-1">
          <div :class="$style.title">{{ t(`:condgroup_${group.id}`) }}</div>
          <div :class="$style.grid">
            <button v-for="c of group.conditions" :key="c.keyword" :class="[$style.item, { [$style.used]: isUsed(c) }]"
              :disabled="isUsed(c)" :title="isUsed(c) ? t(':cond_used') : ''" @click="emit('pick', c)">
              <div class="font-bold truncate"><i v-if="isUsed(c)" class="fas fa-check text-xs"></i> {{ c.keyword }}</div>
              <div class="text-xs text-gray-400 truncate" :title="t(`:cond_${c.keyword}`)">{{ t(`:cond_${c.keyword}`) }}</div>
            </button>
          </div>
        </div>
        <div v-if="!groups.length" class="text-gray-400 text-sm">{{ t(':browse_nothing') }}</div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18nNs } from '@/web/i18n'
import { CONDITION_GROUPS, type ConditionDef } from './conditions'

const props = defineProps<{
  // the window to cover
  host: HTMLElement
  // conditions that the rule already has
  used: string[]
}>()

const emit = defineEmits<{
  (e: 'pick', def: ConditionDef): void
  (e: 'close'): void
}>()

const { t } = useI18nNs('loot_filter')

const query = ref('')
const searchEl = ref<HTMLInputElement | null>(null)
onMounted(() => { searchEl.value?.focus() })

function fold (text: string) {
  return text.toLowerCase().replace(/ё/g, 'е')
}

// by the name of the game or by the description
const groups = computed(() => {
  const words = fold(query.value).split(/\s+/).filter(Boolean)
  return CONDITION_GROUPS.map(g => ({
    ...g,
    conditions: g.conditions.filter(c => {
      const text = fold(`${c.keyword} ${t(`:cond_${c.keyword}`)} ${t(`:condgroup_${g.id}`)}`)
      return words.every(w => text.includes(w))
    })
  })).filter(g => g.conditions.length)
})

function isUsed (def: ConditionDef) {
  return !def.repeatable && props.used.includes(def.keyword)
}

function pickOnly () {
  const found = groups.value.flatMap(g => g.conditions).filter(c => !isUsed(c))
  if (found.length === 1) emit('pick', found[0])
}
</script>

<style lang="postcss" module>
.overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  background: #05070f;
  color: #fff;
}
.search {
  flex: 1;
  min-width: 0;
  background: #0b0f2e;
  color: #fff;
  padding: 0.4rem 0.75rem;
  font-size: 0.9rem;
  border-bottom: 1px solid #2a4fa8;
}
.close {
  background: #13235e;
  border: 1px solid #2a4fa8;
  padding: 0 0.9rem;
  font-size: 1.1rem;
}
.close:hover {
  background: #1d3787;
}
.title {
  background: #131d2b;
  border-left: 3px solid #4d8fd1;
  padding: 0.3rem 0.75rem;
  font-size: 1.05rem;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
}
.item {
  background: #0b2a6e;
  border: 1px solid #2a4fa8;
  padding: 0.2rem 0.5rem;
  font-size: 0.85rem;
  min-width: 0;
}
.item:hover:not(:disabled) {
  background: #1b8fc1;
}
.used {
  background: #101a3a;
  color: #8fa0d8;
}
</style>
