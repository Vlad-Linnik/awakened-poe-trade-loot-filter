// Divine Orb re-roll math.
// A Divine Orb re-rolls every random explicit value independently and
// uniformly within its tier range. All numbers here are pure, no game data.

export interface RollRange {
  value: number
  min: number
  max: number
  // smallest increment of the value, 1 for integers, 0.1 / 0.01 for decimals
  step: number
}

export type Compare = 'gte' | 'lte'

// Ways a single uniform roll can land: an array of counts indexed by
// (roll - min) / step, all ones.
function scaled (r: RollRange, scale: number) {
  const lo = Math.round(Math.min(r.min, r.max) * scale)
  const hi = Math.round(Math.max(r.min, r.max) * scale)
  const step = Math.max(1, Math.round(r.step * scale))
  return { lo, hi, step }
}

/**
 * Probability that one divine makes the AVERAGE of `rolls` satisfy `target`.
 * For a single roll it's just the share of the range at/above (or below) the target.
 * For "Adds X to Y" style lines the values are independent, so the
 * distribution of their sum is a convolution.
 */
export function lineSuccessChance (rolls: RollRange[], target: number, cmp: Compare): number {
  if (!rolls.length) return 1
  const decimals = Math.max(...rolls.map(r => decimalsOf(r.step)))
  const scale = Math.pow(10, decimals)

  // distribution of the sum, in scaled integer units
  let offset = 0
  let dist: number[] = [1]
  let total = 1
  for (const r of rolls) {
    const { lo, hi, step } = scaled(r, scale)
    const n = Math.floor((hi - lo) / step) + 1
    const next = new Array<number>((dist.length - 1) + (n - 1) * step + 1).fill(0)
    for (let i = 0; i < dist.length; i++) {
      if (!dist[i]) continue
      for (let k = 0; k < n; k++) {
        next[i + k * step] += dist[i]
      }
    }
    dist = next
    offset += lo
    total *= n
  }

  // average >= target  <=>  sum >= target * count
  const sumTarget = target * scale * rolls.length
  const EPS = 1e-6
  let good = 0
  for (let i = 0; i < dist.length; i++) {
    const sum = offset + i
    if (cmp === 'gte' ? sum >= sumTarget - EPS : sum <= sumTarget + EPS) {
      good += dist[i]
    }
  }
  return good / total
}

/** Expected number of divines until success (geometric distribution). */
export function avgAttempts (p: number): number {
  if (p <= 0) return Infinity
  return 1 / p
}

/**
 * Divines needed to hit success with probability `confidence` (0..1):
 *   P = 1 - (1 - p)^n  =>  n = ln(1 - P) / ln(1 - p)
 */
export function attemptsForConfidence (p: number, confidence: number): number {
  if (p <= 0) return Infinity
  if (p >= 1) return 1
  if (confidence <= 0) return 0
  if (confidence >= 1) return Infinity
  return Math.ceil(Math.log(1 - confidence) / Math.log(1 - p))
}

/** Chance to succeed at least once in `n` divines: P = 1 - (1 - p)^n */
export function chanceWithAttempts (p: number, n: number): number {
  if (n <= 0) return 0
  if (p >= 1) return 1
  return 1 - Math.pow(1 - p, n)
}

export function decimalsOf (n: number): number {
  const s = String(n)
  const dot = s.indexOf('.')
  if (s.includes('e-')) return Number(s.split('e-')[1])
  return dot === -1 ? 0 : s.length - dot - 1
}

export function stepFromStrings (...nums: string[]): number {
  const d = Math.max(0, ...nums.map(s => {
    const dot = s.indexOf('.')
    return dot === -1 ? 0 : s.length - dot - 1
  }))
  return Math.pow(10, -d)
}

export interface DivineLine {
  // stat text with the ranges stripped, as shown in game
  text: string
  rolls: RollRange[]
}

const NUM = String.raw`[+-]?\d+(?:\.\d+)?`
// 178(149-203) / -10(-15--5) / 0.4(0.2-0.4)
const ROLL_RE = new RegExp(String.raw`(?<!\d|\))(${NUM})\((${NUM})-(${NUM})\)`, 'g')

/** Pulls every "value(min-max)" out of one advanced stat line. */
export function parseStatLine (line: string, unscalableSuffix = ''): DivineLine | undefined {
  if (unscalableSuffix && line.endsWith(unscalableSuffix)) {
    line = line.slice(0, -unscalableSuffix.length)
  }
  const rolls: RollRange[] = []
  const text = line.replace(ROLL_RE, (_, value: string, min: string, max: string) => {
    let lo = Number(min)
    let hi = Number(max)
    if (lo > hi) [lo, hi] = [hi, lo]
    if (lo !== hi) {
      rolls.push({ value: Number(value), min: lo, max: hi, step: stepFromStrings(value, min, max) })
    }
    return value
  })
  if (!rolls.length) return undefined
  return { text, rolls }
}
