<template>
  <!-- FilterBlade's "Endgame - Highlight specific bases": rules made from scratch -->
  <div class="flex flex-col gap-2">
    <div v-if="!scope" class="text-xs text-gray-400">{{ t(':custom_hint') }}</div>
    <div v-if="!scope" class="flex gap-2 items-start">
      <BaseInput :parsed="parsed" :disabled="busy || !canAdd" @add="emit('add', $event)" />
      <button :class="$style.add" :disabled="busy || !canAdd" :title="t(':custom_add_hint')" @click="emit('add')">{{ t(':custom_add') }}</button>
    </div>
    <div v-if="!shown.length && rules.length" class="text-gray-400 text-sm">{{ t(':browse_nothing') }}</div>
    <div v-for="rule of shown" :key="rule.id" :class="[$style.rule, { [$style.ruleOpen]: opened.has(rule.id) }]" :data-rule="rule.id">
      <div :class="$style.head" @click="toggle(rule.id)">
        <button :class="[$style.check, { [$style.checkOn]: !rule.disabled }]" :disabled="busy"
          :title="rule.disabled ? t(':custom_disabled') : t(':fb_disable')"
          @click.stop="emit('save', blockOf(rule), { disabled: !rule.disabled })">
          <i :class="rule.disabled ? 'far fa-square' : rule.visibility === 'Hide' ? 'fas fa-eye-slash' : 'far fa-check-square'"></i>
        </button>
        <input v-if="renaming === rule.id" :ref="focusInput" :value="rule.label" :class="$style.name" class="flex-1 min-w-0"
          @click.stop @keydown.enter="rename(rule, $event)" @keydown.esc.stop="renaming = null" @blur="rename(rule, $event)">
        <div v-else class="flex-1 min-w-0">
          <div :class="$style.title" class="truncate">{{ rule.label }}</div>
          <div v-if="!opened.has(rule.id)" class="text-xs text-gray-500 truncate">{{ [...conditionHints(blockOf(rule), t)].join(' · ') }}</div>
          <div v-if="hiddenAbove(allRules, rule).length" class="text-xs text-yellow-300 truncate">
            <i class="fas fa-eye-slash"></i> {{ t(':custom_hidden', [hiddenAbove(allRules, rule).join(', ')]) }}
          </div>
        </div>
        <span v-if="!opened.has(rule.id)" class="px-1.5 font-poe text-xs whitespace-nowrap overflow-hidden max-w-48" :style="chipStyle(rule)">{{ sampleName(blockOf(rule)) }}</span>
        <div class="flex" @click.stop>
          <button :class="$style.tool" :disabled="busy" :title="t(':custom_copy')" @click="emit('action', rule.id, 'copy')"><i class="far fa-copy"></i></button>
          <button :class="$style.tool" :disabled="busy || isLast(rule)" :title="t(':custom_down')" @click="emit('action', rule.id, 'down')"><i class="fas fa-arrow-down"></i></button>
          <button :class="$style.tool" :disabled="busy || isFirst(rule)" :title="t(':custom_up')" @click="emit('action', rule.id, 'up')"><i class="fas fa-arrow-up"></i></button>
          <button :class="$style.tool" :disabled="busy" :title="t(':delete_rule')" @click="emit('action', rule.id, 'delete')"><i class="fas fa-trash-alt"></i></button>
          <button :class="$style.tool" :disabled="busy" :title="t(':custom_rename')" @click="renaming = rule.id"><i class="far fa-edit"></i></button>
        </div>
      </div>
      <TierEditor v-if="opened.has(rule.id)"
        :key="JSON.stringify(rule)"
        :parsed="parsed" :block="blockOf(rule)" :block-text="ruleLines(rule).join('\n')"
        :item-name="sampleName(blockOf(rule))" :has-patch="false" :busy="busy"
        :rule-title="() => rule.label" :rules="rules" is-rule :custom="rule" :highlight="highlight"
        @save="emit('save', blockOf(rule), $event)" @unsaved="emit('unsaved', blockOf(rule), $event)"
        @close="toggle(rule.id)" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18nNs } from '@/web/i18n'
import type { FilterBlock, ParsedFilter } from './filter-parser'
import { hiddenAbove, ruleBlock, ruleLines, type AptRule, type NewBase } from './apt-rules'
import { styleFromActions, styleCss } from './style'
import { sampleName } from './fb'
import { conditionHints } from './names'
import BaseInput from './BaseInput.vue'
import TierEditor, { type TierChange } from './TierEditor.vue'

export type CustomAction = 'copy' | 'up' | 'down' | 'delete' | 'rename'

const props = defineProps<{
  parsed: ParsedFilter
  rules: AptRule[] // all the custom ones
  allRules: AptRule[]
  // only the rules of this category; they are added in some other way
  scope?: string
  shown: AptRule[]
  busy: boolean
  canAdd: boolean
  // open this rule
  focus?: string
  highlight?: string
}>()

const emit = defineEmits<{
  (e: 'add', base?: NewBase): void
  (e: 'action', id: string, action: CustomAction, label?: string): void
  (e: 'save' | 'unsaved', block: FilterBlock, change: TierChange): void
}>()

const { t } = useI18nNs('loot_filter')

const opened = ref(new Set<string>())
const renaming = ref<string | null>(null)

const blocks = computed(() => new Map(props.rules.map(r => [r.id, ruleBlock(r)])))
function blockOf (rule: AptRule) {
  return blocks.value.get(rule.id) ?? ruleBlock(rule)
}

function open (id: string) {
  opened.value = new Set([...opened.value, id])
  nextTick(() => document.querySelector(`[data-rule="${id}"]`)?.scrollIntoView({ block: 'nearest' }))
}

function toggle (id: string) {
  const next = new Set(opened.value)
  if (!next.delete(id)) next.add(id)
  opened.value = next
}

// a rule just added (or copied) is to be edited
watch(() => props.rules.map(r => r.id), (now, before) => {
  const added = props.rules.filter(r => !before.includes(r.id))
  if (added.length === 1 && added[0].scope === props.scope) open(added[0].id)
})
watch(() => props.focus, (id) => { if (id) open(id) }, { immediate: true })

function isFirst (rule: AptRule) {
  return props.rules[0]?.id === rule.id
}
function isLast (rule: AptRule) {
  return props.rules[props.rules.length - 1]?.id === rule.id
}

function focusInput (el: unknown) {
  if (el && document.activeElement !== el) (el as HTMLInputElement).select()
}

function rename (rule: AptRule, e: Event) {
  if (renaming.value !== rule.id) return
  renaming.value = null
  const label = (e.target as HTMLInputElement).value.trim()
  if (label && label !== rule.label) emit('action', rule.id, 'rename', label)
}

function chipStyle (rule: AptRule) {
  const css = styleCss(styleFromActions(blockOf(rule).actions), rule.visibility === 'Hide')
  return { ...css, fontSize: '0.8rem', borderWidth: '1px', ...(rule.disabled ? { opacity: 0.4 } : {}) }
}
</script>

<style lang="postcss" module>
.rule {
  border: 1px solid #333;
  background: #0f0f0f;
}
.ruleOpen {
  border-color: #2f7fd0;
}
.head {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-height: 2.9rem;
  padding: 0.3rem 0.5rem;
  background: #000;
  border-bottom: 1px solid #2f7fd0;
  cursor: pointer;
}
.head:hover {
  background: #0a1230;
}
.title {
  color: #fff;
  font-size: 1.1rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-family: 'Fontin', sans-serif;
}
.name {
  background: #05081a;
  border: 1px solid #1b8fc1;
  color: #fff;
  padding: 0.1rem 0.3rem;
}
.check {
  width: 2rem;
  height: 2rem;
  flex-shrink: 0;
  border: 1px solid #2a4fa8;
  background: #0b2a6e;
  color: #fff;
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
}
.checkOn {
  background: #1b8fc1;
}
.tool {
  background: #13235e;
  border: 1px solid #2a4fa8;
  color: #fff;
  width: 1.8rem;
  height: 1.7rem;
  font-size: 0.8rem;
}
.tool:hover:not(:disabled) {
  background: #1b8fc1;
}
.tool:disabled {
  opacity: 0.4;
}
.add {
  background: #0b2a6e;
  border: 1px solid #2a4fa8;
  color: #fff;
  font-size: 0.9rem;
  padding: 0.25rem 1rem;
  white-space: nowrap;
}
.add:hover:not(:disabled) {
  background: #1d3787;
}
.add:disabled {
  opacity: 0.45;
}
</style>
