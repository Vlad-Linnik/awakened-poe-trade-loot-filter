<template>
  <div :class="$style.bar">
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
      <div class="flex flex-col items-center justify-center gap-2 min-w-0" style="container-type: inline-size;">
        <div v-if="notice" class="text-center text-sm px-2" style="color: #e0762b;">{{ notice }}</div>
        <div v-else class="px-2 py-0.5 font-poe-sc whitespace-nowrap max-w-full overflow-hidden" :style="previewCss">
          <span v-if="shown.minimap" :style="{ color: effectColor(shown.minimap.color) }">{{ shapeGlyph(shown.minimap.shape) }}</span>
          {{ previewName }}
        </div>
        <div v-if="!notice && decorators" class="text-xs text-gray-300 max-w-full truncate" :title="t(':preview_decorators', [decorators])">+ {{ decorators }}</div>
        <RangeSlider class="self-stretch mx-4" :title="t(':font_size')" :min="18" :max="45" op="=" :value="style.fontSize ?? 32" :value2="45"
          @update:value="update({ fontSize: $event })" />
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
          <template v-if="style.sound"><i class="fas fa-volume-up"></i> {{ style.sound.custom != null ? '♪' : style.sound.id }}</template>
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
        <select :class="$style.select" :value="soundKind" @change="setSoundKind(($event.target as HTMLSelectElement).value)">
          <option value="normal">Normal</option>
          <option value="pos">Positional</option>
          <option value="custom">Custom</option>
        </select>
        <select v-if="style.sound.custom == null" :class="$style.select" :value="style.sound.id" @change="setSound({ id: ($event.target as HTMLSelectElement).value })">
          <option v-if="!/^\d+$/.test(style.sound.id)" :value="style.sound.id">{{ style.sound.id }}</option>
          <option v-for="n in 16" :key="n" :value="String(n)">{{ n }}</option>
        </select>
        <select v-else :class="$style.select" class="max-w-48" :value="style.sound.custom" @change="setSound({ custom: ($event.target as HTMLSelectElement).value })">
          <option v-if="style.sound.custom && !soundFiles.includes(style.sound.custom)" :value="style.sound.custom">{{ style.sound.custom }}</option>
          <option v-if="!soundFiles.length && !style.sound.custom" value="" disabled>{{ t(':fb_no_sounds') }}</option>
          <option v-for="f of soundFiles" :key="f" :value="f">{{ f }}</option>
        </select>
        <button :class="$style.btn" :disabled="!canPlay" :title="canPlay ? t(':fb_play') : t(':fb_builtin_sound')" @click="play">
          <i class="fas fa-play"></i>
        </button>
        <div class="flex items-center gap-1" style="flex: 1 1 11rem; min-width: 11rem;">
          <span class="whitespace-nowrap">{{ t(':volume') }}: {{ style.sound.volume }}</span>
          <input type="range" min="0" max="300" :value="style.sound.volume" class="flex-1" style="min-width: 5rem;"
            @input="setSound({ volume: Number(($event.target as HTMLInputElement).value) })">
        </div>
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
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18nNs } from '@/web/i18n'
import {
  layerStyle, styleCss, toHex, fromHex, EFFECT_COLORS, ICON_SHAPES, DEFAULT_TEXT, DEFAULT_BACKGROUND,
  type RGBA
} from './style'
import { shapeGlyph, effectColor, sizeLetter } from './fb'
import { listSounds, soundUrl, builtinSoundUrl } from './api'
import RangeSlider from './RangeSlider.vue'

const props = defineProps<{
  modelValue: FilterStyle
  initial: FilterStyle
  previewName: string
  // what the rule is drawn over: the color of the item and the decorators
  below?: FilterStyle
  // names of the decorators
  decorators?: string
  hidden: boolean
  // instead of the preview
  notice?: string
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

// ---- sound preview: custom sounds are files in the filter folder ----

const soundFiles = ref<string[]>([])
listSounds().then(files => { soundFiles.value = files }).catch(() => {})

const soundKind = computed(() => {
  const snd = style.value.sound
  if (!snd) return 'normal'
  return snd.custom != null ? 'custom' : snd.positional ? 'pos' : 'normal'
})
function setSoundKind (kind: string) {
  const snd = style.value.sound!
  if (kind === 'custom') setSound({ custom: snd.custom ?? soundFiles.value[0] ?? '', positional: false })
  else setSound({ custom: null, positional: kind === 'pos' })
}

// custom files from the filter folder, or built-in sounds 1..16
const soundSrc = computed(() => {
  const snd = style.value.sound
  if (!snd) return null
  if (snd.custom != null) return snd.custom ? soundUrl(snd.custom) : null
  return /^(1[0-6]|[1-9])$/.test(snd.id) ? builtinSoundUrl(snd.id) : null
})
const canPlay = computed(() => soundSrc.value != null)
let audio: HTMLAudioElement | null = null
function play () {
  const snd = style.value.sound
  if (!snd || !soundSrc.value) return
  audio?.pause()
  audio = new Audio(soundSrc.value)
  // filter volume is 0..300
  audio.volume = Math.max(0, Math.min(1, snd.volume / 300))
  audio.play().catch(() => {})
}
// hear the change: a new file or volume (debounced while dragging the slider)
let playTimer: ReturnType<typeof setTimeout> | null = null
watch(() => [style.value.sound?.custom, style.value.sound?.id, style.value.sound?.volume], (now, before) => {
  if (!canPlay.value || before === undefined) return
  if (playTimer) clearTimeout(playTimer)
  playTimer = setTimeout(play, 250)
})
onBeforeUnmount(() => audio?.pause())

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

// about the size it has in the game
const shown = computed(() => props.below ? layerStyle(props.below, style.value) : style.value)
const previewCss = computed(() => ({
  ...styleCss(shown.value, props.hidden),
  // a long name fits into a narrow window
  fontSize: `clamp(11px, ${140 / (props.previewName.length + (shown.value.minimap ? 3 : 1))}cqi, ${(shown.value.fontSize ?? 32) * 0.7}px)`,
  lineHeight: 1.25
}))
</script>

<style lang="postcss" module>
/* dark ground, to see the item as in the game */
.bar {
  background:
    radial-gradient(ellipse at 20% 30%, rgba(92, 104, 112, 0.35), transparent 45%),
    radial-gradient(ellipse at 75% 70%, rgba(60, 72, 80, 0.45), transparent 50%),
    linear-gradient(#2a333a, #1d252b);
  border: 1px solid #4a5560;
  border-radius: 2px;
  display: flex;
  flex-direction: column;
}
.grid {
  display: grid;
  grid-template-columns: minmax(7.4rem, 10.6rem) minmax(8rem, 1fr) minmax(7rem, 10.6rem);
  gap: 0.5rem;
  padding: 0.4rem;
  align-items: center;
}
.toggle {
  background: #13235e;
  color: #dfe6ff;
  padding: 0.1rem 0.4rem;
  font-size: 0.8rem;
  text-align: left;
  flex: 0 0 5.4rem;
  white-space: nowrap;
}
.toggle.on {
  background: #1b8fc1;
  color: #fff;
}
.swatch {
  flex: 1;
  min-width: 1.8rem;
  border: 3px solid #fff;
  box-shadow: inset 0 0 0 1px #000;
  cursor: pointer;
  background-image: linear-gradient(45deg, #333 25%, transparent 25%), linear-gradient(-45deg, #333 25%, transparent 25%);
  background-size: 8px 8px;
}
.btn {
  background: #13235e;
  border: 1px solid #2a4fa8;
  color: #fff;
  font-size: 0.8rem;
  padding: 0.15rem 0.35rem;
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
