<template>
  <div class="flex flex-col overflow-y-auto">
    <div class="px-3 py-2 text-sm flex items-center gap-2" :class="$style.bar">
      <img src="/images/divine.png" class="w-5 h-5 object-contain">
      <template v-if="item">
        <span class="text-gray-400">{{ t(':divine_item') }}</span>
        <span class="font-poe truncate">{{ item.info.name }}</span>
        <span class="flex-1"></span>
        <button class="text-xs text-gray-400 hover:text-white" @click="lastDivineItem = null">
          <i class="fas fa-times"></i> {{ t(':divine_clear') }}
        </button>
      </template>
      <span v-else class="text-gray-400">{{ t(':divine_no_item') }}</span>
    </div>
    <div class="p-3" style="max-width: 32rem;">
      <DivineCalc :item="item" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18nNs } from '@/web/i18n'
import DivineCalc from './divine/DivineCalc.vue'
import { lastDivineItem } from './divine/last-item'

const { t } = useI18nNs('codex')

const item = computed(() => lastDivineItem.value)
</script>

<style lang="postcss" module>
.bar {
  border-bottom: 1px solid #1d2560;
}
</style>
