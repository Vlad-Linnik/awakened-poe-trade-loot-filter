<template>
  <!-- what can be done with one item of a tier: another tier in one click, or a rule of its own -->
  <div class="flex flex-wrap items-center gap-1">
    <span class="text-xs text-gray-300">{{ baseType }} →</span>
    <template v-if="ladder.length">
      <button v-for="b of ladder" :key="b.index" :class="[$style.tier, { [$style.current]: b.index === block.index }]"
        :disabled="busy || b.index === block.index" :style="tierStyle(b)"
        :title="b.index === block.index ? t(':this_tier') : ruleTitle(b)" @click="emit('move', b)">
        <i v-if="b.index === up?.index" class="fas fa-arrow-up text-xs"></i>
        <i v-if="b.visibility === 'Hide'" class="fas fa-eye-slash text-xs"></i>
        {{ blockTierName(b, t) }}
      </button>
    </template>
    <template v-else-if="others.length">
      <select v-model="target" :class="$style.input" class="flex-1 min-w-0">
        <option :value="null" disabled>{{ t(':move_to') }}</option>
        <option v-for="b of others" :key="b.index" :value="b.index">{{ b.visibility }} · {{ ruleTitle(b) }}</option>
      </select>
      <button :class="$style.btn" :disabled="target == null || busy" @click="moveToSelected">{{ t(':move') }}</button>
    </template>
    <button v-if="!block.continue" :class="$style.btn" :disabled="busy" :title="t(':own_rule_hint')" @click="emit('own-rule')">
      <i class="fas fa-star text-xs"></i> {{ hasOwnRule ? t(':own_rule_open') : t(':own_rule') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18nNs } from '@/web/i18n'
import type { FilterBlock, ParsedFilter } from './filter-parser'
import { higherTier, moveTargets, tierLadder } from './filter-edit'
import { styleCss, styleFromActions } from './style'
import { blockTierName } from './names'

const props = defineProps<{
  parsed: ParsedFilter
  block: FilterBlock
  baseType: string
  hasOwnRule: boolean
  busy: boolean
  ruleTitle: (block: FilterBlock) => string
}>()

const emit = defineEmits<{
  (e: 'move', target: FilterBlock): void
  (e: 'own-rule'): void
}>()

const { t } = useI18nNs('loot_filter')

const ladder = computed(() => tierLadder(props.parsed, props.block))
const up = computed(() => higherTier(ladder.value, props.block))
const others = computed(() => moveTargets(props.parsed, props.block))
const target = ref<number | null>(null)

function moveToSelected () {
  const b = others.value.find(x => x.index === target.value)
  if (b) emit('move', b)
}

function tierStyle (b: FilterBlock) {
  return { ...styleCss(styleFromActions(b.actions), b.visibility === 'Hide'), fontSize: '0.75rem', borderWidth: '1px' }
}
</script>

<style lang="postcss" module>
.tier {
  padding: 0.1rem 0.45rem;
  white-space: nowrap;
}
.tier:hover:not(:disabled) {
  box-shadow: 0 0 0 1px #fff;
}
.current {
  box-shadow: 0 0 0 2px #1b8fc1;
}
.btn {
  background: #13235e;
  border: 1px solid #2a4fa8;
  color: #fff;
  font-size: 0.8rem;
  padding: 0.1rem 0.5rem;
  white-space: nowrap;
}
.btn:hover:not(:disabled) {
  background: #1d3787;
}
.btn:disabled {
  opacity: 0.5;
}
.input {
  background: #13235e;
  color: #fff;
  padding: 0.1rem 0.3rem;
  font-size: 0.8rem;
}
</style>
