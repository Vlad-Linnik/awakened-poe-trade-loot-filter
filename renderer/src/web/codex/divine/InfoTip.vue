<template>
  <!-- (i) that explains a term on hover -->
  <UiPopover trigger="mouseenter focus" placement="top" :delay="[150, 0]" class="inline-flex">
    <template #target>
      <i class="fas fa-info-circle text-xs text-gray-500 hover:text-gray-200 cursor-help" tabindex="0" />
    </template>
    <template #content>
      <div class="font-sans text-sm leading-snug whitespace-pre-line px-1" style="max-width: 20rem;">
        <slot>{{ text }}</slot>
      </div>
    </template>
  </UiPopover>
</template>

<script setup lang="ts">
import UiPopover from '@/web/ui/Popover.vue'

defineProps<{
  text?: string
}>()
</script>
