<template>
  <div :class="$style.bar">
    <div :class="$style.title">{{ t(':fb_visuals') }}</div>
    <div :class="$style.grid">
      <!-- text / border / background -->
      <div class="flex flex-col gap-1">
        <div v-for="c of colorRows" :key="c.key" class="flex items-stretch">
          <button :class="[$style.toggle, { [$style.on]: c.enabled }]" @click="toggleColor(c.key)">
            <i class="far" :class="c.enabled ? 'fa-check-square' : 'fa-square'"></i> {{ t(c.label) }}
          </button>
          <label :class="$style.swatch" :style="{ background: c.enabled ? cssColor(c.value) : 'transparent' }">
            <input type="color" class="opacity-0 w-0 h-0" :value="toHex(c.value)"
              @input="setColor(c.key, ($event.target as HTMLInputElement).value)">
          </label>
        </div>
      </div>

      <!-- preview + font size -->
      <div class="flex flex-col items-center justify-center gap-2 min-w-0">
        <div class="px-2 py-0.5 font-poe whitespace-nowrap max-w-full overflow-hidden" :style="previewCss">
          <span v-if="style.minimap" :style="{ color: effectColor(style.minimap.color) }">{{ shapeGlyph(style.minimap.shape) }}</span>
          {{ previewName }}
        </div>
        <div class="flex items-center gap-1 w-full">
          <input type="range" min="18" max="45" :value="style.fontSize ?? 32" class="flex-1 min-w-0"
            @input="update({ fontSize: Number(($event.target as HTMLInputElement).value) })">
          <span :class="$style.num">{{ style.fontSize ?? '—' }}</span>
        </div>
      </div>

      <!-- actions -->
      <div class="grid grid-cols-2 gap-1">
        <button :class="$style.btn" @click="copy">{{ t(':fb_copy') }}</button>
        <button :class="[$style.btn, { [$style.on]: panel === 'icon', [$style.active]: style.minimap }]" @click="togglePanel('icon')">
          <template v-if="style.minimap">{{ sizeLetter(style.minimap.size) }}
            <span :style="{ color: effectColor(style.minimap.color) }">{{ shapeGlyph(style.minimap.shape) }}</span></template>
          <template v-else>{{ t(':fb_icon') }}</template>
        </button>
        <button :class="$style.btn" :disabled="!clipboard" @click="paste">{{ t(':fb_paste') }}</button>
        <button :class="[$style.btn, { [$style.on]: panel === 'sound', [$style.active]: style.sound }]" @click="togglePanel('sound')">
          <template v-if="style.sound"><i class="fas fa-volume-up"></i> {{ style.sound.id }}</template>
          <template v-else>{{ t(':fb_sound') }}</template>
        </button>
        <button :class="$style.btn" @click="emit('update:modelValue', clone(initial))">{{ t(':fb_reset') }}</button>
        <button :class="[$style.btn, { [$style.on]: panel === 'beam', [$style.active]: style.effect }]" @click="togglePanel('beam')">
          <i class="fas fa-sun" :style="style.effect ? { color: effectColor(style.effect.color) } : {}"></i>
          <template v-if="!style.effect"> {{ t(':fb_beam') }}</template>
        </button>
      </div>
    </div>

    <!-- icon -->
    <div v-if="panel === 'icon'" :class="$style.panel">
      <span>{{ t(':minimap') }}:</span>
      <button :class="[$style.toggle, { [$style.on]: style.minimap }]" @click="update({ minimap: style.minimap ? null : { size: 1, color: 'White', shape: 'Circle' } })">
        <i class="far" :class="style.minimap ? 'fa-check-square' : 'fa-square'"></i> {{ t(':fb_active') }}
      </button>
      <template v-if="style.minimap">
        <select :class="$style.select" :value="style.minimap.size" @change="setIcon({ size: Number(($event.target as HTMLSelectElement).value) })">
          <option :value="0">{{ t(':fb_size') }}: 0 ({{ t(':size_big') }})</option>
          <option :value="1">{{ t(':fb_size') }}: 1 ({{ t(':size_mid') }})</option>
          <option :value="2">{{ t(':fb_size') }}: 2 ({{ t(':size_small') }})</option>
        </select>
        <select :class="$style.select" :value="style.minimap.color" @change="setIcon({ color: ($event.target as HTMLSelectElement).value })">
          <option v-for="c of EFFECT_COLORS" :key="c" :value="c">{{ t(':fb_color') }}: {{ c }}</option>
        </select>
        <select :class="$style.select" :value="style.minimap.shape" @change="setIcon({ shape: ($event.target as HTMLSelectElement).value })">
          <option v-for="s of ICON_SHAPES" :key="s" :value="s">{{ t(':fb_shape') }}: {{ s }}</option>
        </select>
      </template>
    </div>

    <!-- sound -->
    <div v-if="panel === 'sound'" :class="$style.panel">
      <button :class="[$style.toggle, { [$style.on]: style.sound }]" @click="update({ sound: style.sound ? null : { id: '1', volume: 300, positional: false } })">
        <i class="far" :class="style.sound ? 'fa-check-square' : 'fa-square'"></i> {{ t(':sound') }}
      </button>
      <template v-if="style.sound">
        <select :class="$style.select" :value="style.sound.positional ? 'pos' : 'normal'"
          @change="setSound({ positional: ($event.target as HTMLSelectElement).value === 'pos' })">
          <option value="normal">Normal</option>
          <option value="pos">Positional</option>
        </select>
        <select :class="$style.select" :value="style.sound.id" @change="setSound({ id: ($event.target as HTMLSelectElement).value })">
          <option v-if="!/^\d+$/.test(style.sound.id)" :value="style.sound.id">{{ style.sound.id }}</option>
          <option v-for="n in 16" :key="n" :value="String(n)">{{ n }}</option>
        </select>
        <span class="whitespace-nowrap">{{ t(':volume') }}: {{ style.sound.volume }}</span>
        <input type="range" min="0" max="300" :value="style.sound.volume" class="flex-1 min-w-0"
          @input="setSound({ volume: Number(($event.target as HTMLInputElement).value) })">
      </template>
      <button :class="[$style.toggle, { [$style.on]: style.dropSound }]" @click="update({ dropSound: !style.dropSound })">
        <i class="far" :class="style.dropSound ? 'fa-check-square' : 'fa-square'"></i> {{ t(':fb_drop') }}
      </button>
    </div>

    <!-- beam -->
    <div v-if="panel === 'beam'" :class="$style.panel">
      <span>{{ t(':beam') }}:</span>
      <button :class="[$style.toggle, { [$style.on]: style.effect }]" @click="update({ effect: style.effect ? null : { color: 'White', temp: false } })">
        <i class="far" :class="style.effect ? 'fa-check-square' : 'fa-square'"></i> {{ t(':fb_active') }}
      </button>
      <template v-if="style.effect">
        <select :class="$style.select" :value="style.effect.color" @change="setEffect({ color: ($event.target as HTMLSelectElement).value })">
          <option v-for="c of EFFECT_COLORS" :key="c" :value="c">{{ t(':fb_color') }}: {{ c }}</option>
        </select>
        <button :class="[$style.toggle, { [$style.on]: style.effect.temp }]" @click="setEffect({ temp: !style.effect.temp })">
          <i class="far" :class="style.effect.temp ? 'fa-check-square' : 'fa-square'"></i> {{ t(':beam_temp') }}
        </button>
      </template>
    </div>
  </div>
</template>

<script lang="ts">
import type { FilterStyle } from './style'
// shared between all style bars: FilterBlade's Copy / Paste
let clipboardStyle: FilterStyle | null = null
</script>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18nNs } from '@/web/i18n'
import {
  styleCss, toHex, fromHex, EFFECT_COLORS, ICON_SHAPES, DEFAULT_TEXT, DEFAULT_BACKGROUND,
  type RGBA
} from './style'
import { shapeGlyph, effectColor, sizeLetter } from './fb'

const props = defineProps<{
  modelValue: FilterStyle
  initial: FilterStyle
  previewName: string
  hidden: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', style: FilterStyle): void
}>()

const { t } = useI18nNs('loot_filter')

const style = computed(() => props.modelValue)
const panel = ref<'icon' | 'sound' | 'beam' | null>(null)
const clipboard = ref<FilterStyle | null>(clipboardStyle)

function clone (s: FilterStyle): FilterStyle {
  return JSON.parse(JSON.stringify(s)) as FilterStyle
}

function update (patch: Partial<FilterStyle>) {
  emit('update:modelValue', { ...clone(style.value), ...patch })
}

type ColorKey = 'text' | 'border' | 'background'
const FALLBACK: Record<ColorKey, RGBA> = {
  text: DEFAULT_TEXT,
  border: { r: 255, g: 255, b: 255, a: 255 },
  background: DEFAULT_BACKGROUND
}
const colorRows = computed(() => ([
  { key: 'text' as const, label: ':fb_text' },
  { key: 'border' as const, label: ':fb_border' },
  { key: 'background' as const, label: ':fb_bg' }
]).map(r => ({
  ...r,
  enabled: style.value[r.key] != null,
  value: style.value[r.key] ?? props.initial[r.key] ?? FALLBACK[r.key]
})))

function toggleColor (key: ColorKey) {
  update({ [key]: style.value[key] ? null : (props.initial[key] ?? FALLBACK[key]) })
}
function setColor (key: ColorKey, hex: string) {
  const prev = style.value[key] ?? props.initial[key] ?? FALLBACK[key]
  update({ [key]: fromHex(hex, prev.a) })
}
function setIcon (patch: Partial<NonNullable<FilterStyle['minimap']>>) {
  update({ minimap: { ...style.value.minimap!, ...patch } })
}
function setSound (patch: Partial<NonNullable<FilterStyle['sound']>>) {
  update({ sound: { ...style.value.sound!, ...patch } })
}
function setEffect (patch: Partial<NonNullable<FilterStyle['effect']>>) {
  update({ effect: { ...style.value.effect!, ...patch } })
}

function togglePanel (p: 'icon' | 'sound' | 'beam') {
  panel.value = panel.value === p ? null : p
}

function copy () {
  clipboardStyle = clone(style.value)
  clipboard.value = clipboardStyle
}
function paste () {
  if (clipboardStyle) emit('update:modelValue', clone(clipboardStyle))
}

function cssColor (c: RGBA) {
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a / 255})`
}

const previewCss = computed(() => styleCss(style.value, props.hidden))
</script>

<style lang="postcss" module>
.bar {
  background: #0b1235;
  border: 1px solid #1d2c6b;
  border-radius: 2px;
  display: flex;
  flex-direction: column;
}
.title {
  background: #13235e;
  color: #fff;
  text-align: center;
  font-size: 0.8rem;
  padding: 0.15rem;
}
.grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.4rem;
  align-items: center;
}
.grid > :nth-child(2) {
  flex: 1 1 9rem;
}
.toggle {
  background: #13235e;
  color: #dfe6ff;
  padding: 0.1rem 0.4rem;
  font-size: 0.8rem;
  text-align: left;
  min-width: 5.2rem;
  white-space: nowrap;
}
.toggle.on {
  background: #1b8fc1;
  color: #fff;
}
.swatch {
  width: 2rem;
  border: 2px solid #fff;
  cursor: pointer;
  background-image: linear-gradient(45deg, #333 25%, transparent 25%), linear-gradient(-45deg, #333 25%, transparent 25%);
  background-size: 8px 8px;
}
.btn {
  background: #13235e;
  border: 1px solid #2a4fa8;
  color: #fff;
  font-size: 0.8rem;
  padding: 0.15rem 0.5rem;
  min-width: 3.5rem;
  white-space: nowrap;
}
.btn:hover:not(:disabled) {
  background: #1d3787;
}
.btn:disabled {
  opacity: 0.5;
}
.btn.active {
  background: #1b8fc1;
}
.btn.on {
  outline: 1px solid #fff;
}
.num {
  background: #13235e;
  color: #fff;
  font-size: 0.75rem;
  padding: 0 0.3rem;
  min-width: 1.6rem;
  text-align: center;
}
.panel {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.4rem;
  border-top: 1px solid #1d2c6b;
  font-size: 0.8rem;
  color: #dfe6ff;
}
.select {
  background: #13235e;
  color: #fff;
  padding: 0.1rem 0.25rem;
  font-size: 0.8rem;
}
</style>
