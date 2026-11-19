<template>
  <div class="max-w-md p-2 flex flex-col gap-4">
    <HotkeysGeneric :hotkeys="hotkeys" />
    <div>
      <div class="mb-1">{{ t(':filter_path') }}</div>
      <input v-model.trim="filterPath"
        class="rounded bg-gray-900 px-1 block w-full font-sans"
        placeholder="...?/My Games/Path of Exile/NeverSink's filter - 2-SEMI-STRICT.filter">
    </div>
    <ui-checkbox v-model="reloadAfterHide">{{ t(':reload_after_hide') }}</ui-checkbox>
  </div>
</template>

<script lang="ts">
export default {
  name: 'loot_filter.name'
}
</script>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18nNs } from '@/web/i18n'
import { configProp, _configModelValue, findWidget } from '../settings/utils.js'
import type { LootFilterWidget } from './api'
import UiCheckbox from '@/web/ui/UiCheckbox.vue'
import HotkeysGeneric, { type HotkeySchema } from '../settings/HotkeysGeneric.vue'

const props = defineProps(configProp())
const { t } = useI18nNs('loot_filter')

const widget = computed(() => findWidget<LootFilterWidget>('loot-filter', props.config)!)

const hotkeys = computed<HotkeySchema[]>(() => [{
  translationKey: 'loot_filter.hotkey',
  config: _configModelValue(widget.value, 'hotkey')
}, {
  translationKey: 'loot_filter.browse_hotkey',
  config: _configModelValue(widget.value, 'browseHotkey')
}])

const filterPath = computed<string>({
  get: () => widget.value.filterPath ?? '',
  set: (value) => { widget.value.filterPath = value || null }
})

const reloadAfterHide = computed<boolean>({
  get: () => widget.value.reloadAfterHide,
  set: (value) => { widget.value.reloadAfterHide = value }
})
</script>
