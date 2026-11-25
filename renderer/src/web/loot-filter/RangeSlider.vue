<template>
  <!-- FilterBlade's slider: the value is on the handle, the matching part is filled -->
  <div ref="rootEl" :class="[$style.slider, { [$style.off]: disabled }]" @pointerdown="start" @pointermove="drag">
    <div :class="$style.track">
      <div v-if="fill" :class="$style.fill" :style="{ left: `${fill[0]}%`, right: `${100 - fill[1]}%` }"></div>
    </div>
    <button v-for="h of handles" :key="h.key" type="button" role="slider" :class="$style.handle"
      :style="{ left: `${h.pos}%` }" :disabled="disabled"
      :aria-valuemin="min" :aria-valuemax="max" :aria-valuenow="h.value"
      @keydown.left.prevent="set(h.key, h.value - 1)" @keydown.right.prevent="set(h.key, h.value + 1)">{{ disabled ? '' : h.value }}</button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{
  min: number
  max: number
  op: string
  value: number
  // the end of the range
  value2: number
}>()

const emit = defineEmits<{
  (e: 'update:value' | 'update:value2', value: number): void
}>()

const rootEl = ref<HTMLElement | null>(null)
const disabled = computed(() => props.op === 'any')

// values outside of the bounds can be typed
function pos (value: number) {
  return Math.max(0, Math.min(1, (value - props.min) / (props.max - props.min))) * 100
}

const handles = computed(() => [
  { key: 'value' as const, value: props.value, pos: pos(props.value) },
  ...(props.op === 'range' ? [{ key: 'value2' as const, value: props.value2, pos: pos(props.value2) }] : [])
])

const fill = computed<[number, number] | null>(() => {
  switch (props.op) {
    case '>':
    case '>=': return [pos(props.value), 100]
    case '<':
    case '<=': return [0, pos(props.value)]
    case 'range': return [pos(props.value), pos(props.value2)]
    default: return null
  }
})

function set (key: 'value' | 'value2', value: number) {
  value = Math.max(props.min, Math.min(props.max, value))
  if (props.op === 'range') {
    value = key === 'value' ? Math.min(value, props.value2) : Math.max(value, props.value)
  }
  if (key === 'value') emit('update:value', value)
  else emit('update:value2', value)
}

let dragged: 'value' | 'value2' | null = null

function valueAt (e: PointerEvent) {
  const track = rootEl.value!.firstElementChild!.getBoundingClientRect()
  const part = Math.max(0, Math.min(1, (e.clientX - track.left) / track.width))
  return Math.round(props.min + part * (props.max - props.min))
}

function start (e: PointerEvent) {
  if (disabled.value || e.button !== 0) return
  const value = valueAt(e)
  // the nearest handle; both at one place - the one that can move there
  dragged = (props.op === 'range' &&
    (Math.abs(value - props.value2) < Math.abs(value - props.value) ||
      (props.value === props.value2 && value >= props.value)))
    ? 'value2'
    : 'value'
  rootEl.value!.setPointerCapture(e.pointerId)
  set(dragged, value)
}

function drag (e: PointerEvent) {
  if (!dragged || !rootEl.value!.hasPointerCapture(e.pointerId)) return
  set(dragged, valueAt(e))
}
</script>

<style lang="postcss" module>
.slider {
  position: relative;
  height: 1.5rem;
  min-width: 7rem;
  cursor: pointer;
  touch-action: none;
  user-select: none;
}
.off {
  opacity: 0.35;
  cursor: default;
}
.track {
  position: absolute;
  left: 0;
  right: 0;
  top: 0.45rem;
  height: 0.6rem;
  background: #000;
  border: 1px solid #5a6390;
}
.fill {
  position: absolute;
  top: 0;
  bottom: 0;
  background: #1b8fc1;
}
.handle {
  position: absolute;
  top: 0;
  height: 1.5rem;
  min-width: 1.6rem;
  padding: 0 0.2rem;
  transform: translateX(-50%);
  background: #1b8fc1;
  border: 1px solid #2aa6dd;
  color: #fff;
  font-size: 0.75rem;
  cursor: inherit;
}
.handle:focus-visible {
  outline: 1px solid #fff;
}
</style>
