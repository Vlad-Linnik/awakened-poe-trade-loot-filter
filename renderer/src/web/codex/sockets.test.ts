import { describe, expect, test } from 'vitest'
import { bestOption, colorChances, dilute, parseSockets, recolorOptions, whiteChance, type Colors, type Reqs } from './sockets'
import baseReqs from './base-reqs.json'

const sum = (c: Colors) => c.r + c.g + c.b + c.w

describe('colour chances', () => {
  test('single requirement (Vaal Regalia, 194 int)', () => {
    const c = colorChances([0, 0, 194])
    expect(c.b).toBeCloseTo(0.9 * 204 / 214, 10)
    expect(c.r).toBeCloseTo(0.05 + 0.9 * 5 / 214, 10)
    expect(c.r).toBe(c.g)
    expect(sum(c)).toBeCloseTo(1, 10)
  })

  test('two requirements (Carnal Armour, 88 dex 122 int)', () => {
    const c = colorChances([0, 88, 122])
    expect(c.r).toBeCloseTo(0.1, 10)
    expect(c.g).toBeCloseTo(0.9 * 88 / 210, 10)
    expect(sum(c)).toBeCloseTo(1, 10)
  })

  test('three requirements split by weight', () => {
    expect(colorChances([10, 10, 10])).toEqual({ r: 1 / 3, g: 1 / 3, b: 1 / 3, w: 0 })
  })

  test('white chance grows down with item level and quality', () => {
    expect(whiteChance(84, 0)).toBeCloseTo(1 - 0.00375 * 70, 10)
    expect(whiteChance(84, 20)).toBeCloseTo(1 - 0.00375 * 70 * 1.2, 10)
    expect(whiteChance(100, 30)).toBeLessThan(whiteChance(84, 0))
    expect(whiteChance(1, 0)).toBeCloseTo(1 - 0.00375, 10)
    expect(sum(dilute(colorChances([0, 0, 194]), whiteChance(84, 0)))).toBeCloseTo(1, 10)
  })
})

// every colouring of `n` sockets, `rgbOnly` of them can't be white
function bruteForce (reqs: Reqs, n: number, rgbOnly: number, want: Colors, itemLevel: number, quality: number) {
  const rgb = colorChances(reqs)
  const full = dilute(rgb, whiteChance(itemLevel, quality))
  let total = 0
  const walk = (i: number, p: number, got: Colors) => {
    if (i === n) {
      if (got.r >= want.r && got.g >= want.g && got.b >= want.b) total += p
      return
    }
    const chances = i < rgbOnly ? rgb : full
    for (const k of ['r', 'g', 'b', 'w'] as const) {
      if (chances[k] > 0) walk(i + 1, p * chances[k], { ...got, [k]: got[k] + 1 })
    }
  }
  walk(0, 1, { r: 0, g: 0, b: 0, w: 0 })
  return total
}

describe('recolorOptions', () => {
  const want = (r: number, g: number, b: number): Colors => ({ r, g, b, w: 0 })
  const option = (opts: ReturnType<typeof recolorOptions>, key: string) => opts.find(o => o.key === key)

  test.each([
    [[0, 0, 194] as Reqs, 6, want(1, 1, 3), 84, 20],
    [[0, 88, 122] as Reqs, 4, want(2, 1, 0), 75, 0],
    [[155, 0, 0] as Reqs, 5, want(0, 0, 2), 86, 10],
    [[50, 50, 0] as Reqs, 3, want(1, 1, 1), 60, 0]
  ])('drop and bench recipes match a brute force: %j %i sockets %j', (reqs, n, w, ilvl, q) => {
    const opts = recolorOptions({ reqs, sockets: n, want: w, itemLevel: ilvl, quality: q })
    expect(option(opts, 'drop')!.chance).toBeCloseTo(bruteForce(reqs, n, 0, w, ilvl, q), 12)
    for (const [key, k] of [['nonwhite2', 2], ['nonwhite3', 3], ['nonwhite4', 4]] as const) {
      if (k > n) {
        expect(option(opts, key)).toBeUndefined()
        continue
      }
      expect(option(opts, key)!.chance, key).toBeCloseTo(bruteForce(reqs, n, k, w, ilvl, q), 12)
    }
  })

  test('a Chromatic Orb is better than a drop, worse than certain', () => {
    const opts = recolorOptions({ reqs: [0, 0, 194], sockets: 4, want: want(0, 0, 2), itemLevel: 84, quality: 0 })
    const chromatic = option(opts, 'chromatic')!
    expect(chromatic.chance).toBeGreaterThan(option(opts, 'drop')!.chance)
    expect(chromatic.chance).toBeLessThan(1)
    expect(chromatic.cost).toBeCloseTo(1 / chromatic.chance, 10)
    expect(bestOption(opts)!.cost).toBeLessThanOrEqual(chromatic.cost!)
  })

  test('off-colours are expensive', () => {
    const on = recolorOptions({ reqs: [0, 0, 194], sockets: 6, want: want(0, 0, 3), itemLevel: 84, quality: 20 })
    const off = recolorOptions({ reqs: [0, 0, 194], sockets: 6, want: want(3, 0, 0), itemLevel: 84, quality: 20 })
    expect(bestOption(off)!.cost!).toBeGreaterThan(bestOption(on)!.cost! * 10)
  })

  test('Omen of Trichromatism only with 3+ sockets and room for its colours', () => {
    expect(option(recolorOptions({ reqs: [0, 0, 194], sockets: 3, want: want(1, 1, 1), itemLevel: 84, quality: 0 }), 'trichromatism')!.chance)
      .toBeCloseTo(1, 10)
    expect(option(recolorOptions({ reqs: [0, 0, 194], sockets: 3, want: want(0, 0, 2), itemLevel: 84, quality: 0 }), 'trichromatism')).toBeUndefined()
  })

  test('nothing for impossible input', () => {
    expect(recolorOptions({ reqs: [0, 0, 194], sockets: 2, want: want(1, 1, 1), itemLevel: 84, quality: 0 })).toEqual([])
    expect(recolorOptions({ reqs: [0, 0, 194], sockets: 2, want: want(0, 0, 0), itemLevel: 84, quality: 0 })).toEqual([])
  })
})

test('parseSockets keeps the sockets that can be recoloured', () => {
  expect(parseSockets('R-G-B A-W D')).toEqual(['R', 'G', 'B', 'W'])
  expect(parseSockets(undefined)).toEqual([])
})

test('base requirements snapshot', () => {
  const reqs = baseReqs as Record<string, Reqs>
  expect(reqs['Vaal Regalia']).toEqual([0, 0, 194])
  expect(reqs['Carnal Armour']).toEqual([0, 88, 122])
  expect(Object.keys(reqs).length).toBeGreaterThan(800)
})
