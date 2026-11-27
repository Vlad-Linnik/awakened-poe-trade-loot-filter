<template>
  <Widget :config="{ ...config, anchor: { pos: 'cc', x: 50, y: 50 } }" move-handles="none" :removable="false" :inline-edit="false">
    <div :class="$style.window" class="text-gray-200 shadow-lg flex flex-col" style="width: 52rem; max-width: 96vw; height: 86vh;">
      <div :class="$style.titlebar" class="px-3 py-2 flex items-center gap-2">
        <i class="fas fa-book-open text-gray-400"></i>
        <span class="font-bold">{{ t(':title') }}</span>
        <div class="flex gap-1 ml-4">
          <button v-for="tab of TABS" :key="tab.id" :class="[$style.tab, { [$style.on]: config.tab === tab.id }]"
            @click="config.tab = tab.id">{{ t(tab.label) }}</button>
        </div>
        <span class="flex-1"></span>
        <button class="text-gray-400 hover:text-white px-1" :title="t(':close')" @click="wm.hide(config.wmId)"><i class="fas fa-times"></i></button>
      </div>
      <DustTab v-if="config.tab === 'dust'" v-model="config.dust" class="flex-1 min-h-0" />
      <CardsTab v-else-if="config.tab === 'cards'" v-model="config.cards" class="flex-1 min-h-0" />
      <SocketsTab v-else-if="config.tab === 'sockets'" v-model="config.sockets" class="flex-1 min-h-0" />
      <DivineTab v-else class="flex-1 min-h-0" />
    </div>
  </Widget>
</template>

<script lang="ts">
import type { WidgetSpec } from '../overlay/interfaces'
import { codexDefaults, type CodexWidget } from './widget'

export default {
  widget: {
    type: 'codex',
    instances: 'single',
    initInstance: (): CodexWidget => {
      return {
        wmId: 0,
        wmType: 'codex',
        wmTitle: '{icon=fa-book-open}',
        wmWants: 'hide',
        wmZorder: 'exclusive',
        wmFlags: ['hide-on-blur'],
        ...codexDefaults()
      }
    }
  } satisfies WidgetSpec
}
</script>

<script setup lang="ts">
import { inject } from 'vue'
import { useI18nNs } from '@/web/i18n'
import { MainProcess } from '@/web/background/IPC'
import type { WidgetManager } from '../overlay/interfaces'
import Widget from '../overlay/Widget.vue'
import DustTab from './DustTab.vue'
import CardsTab from './CardsTab.vue'
import SocketsTab from './SocketsTab.vue'
import DivineTab from './DivineTab.vue'

const props = defineProps<{
  config: CodexWidget
}>()

const wm = inject<WidgetManager>('wm')!
const { t } = useI18nNs('codex')

const TABS = [
  { id: 'dust' as const, label: ':tab_dust' },
  { id: 'cards' as const, label: ':tab_cards' },
  { id: 'sockets' as const, label: ':tab_sockets' },
  { id: 'divine' as const, label: ':tab_divine' }
]

// configs saved by older versions
const defaults = codexDefaults()
props.config.tab ??= defaults.tab
props.config.dust = { ...defaults.dust, ...props.config.dust }
props.config.cards = { ...defaults.cards, ...props.config.cards }
props.config.sockets = { ...defaults.sockets, ...props.config.sockets }

MainProcess.onEvent('MAIN->CLIENT::widget-action', (e) => {
  if (e.target !== 'codex') return
  if (props.config.wmWants === 'show') {
    wm.hide(props.config.wmId)
  } else {
    wm.show(props.config.wmId)
  }
})
</script>

<style lang="postcss" module>
.window {
  background: #05081a;
  border: 1px solid #2a3470;
}
.titlebar {
  background: #0a0f3a;
  border-bottom: 1px solid #2a3470;
}
.tab {
  padding: 0.15rem 0.7rem;
  border: 1px solid #2a3470;
  color: #9aa3c7;
}
.tab:hover {
  color: #fff;
}
.tab.on {
  background: #1b2a7a;
  color: #fff;
}
</style>
