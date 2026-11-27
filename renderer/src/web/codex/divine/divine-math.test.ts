import { describe, it, expect } from 'vitest'
import { lineSuccessChance, avgAttempts, attemptsForConfidence, chanceWithAttempts, stepFromStrings, parseStatLine } from './divine-math'

describe('lineSuccessChance', () => {
  it('single integer roll', () => {
    // 31(28-32)% crit: 5 outcomes, 31 and 32 succeed
    expect(lineSuccessChance([{ value: 31, min: 28, max: 32, step: 1 }], 31, 'gte')).toBeCloseTo(2 / 5)
    expect(lineSuccessChance([{ value: 31, min: 28, max: 32, step: 1 }], 32, 'gte')).toBeCloseTo(1 / 5)
    expect(lineSuccessChance([{ value: 31, min: 28, max: 32, step: 1 }], 29, 'lte')).toBeCloseTo(2 / 5)
    expect(lineSuccessChance([{ value: 31, min: 28, max: 32, step: 1 }], 40, 'gte')).toBe(0)
  })

  it('decimal roll', () => {
    // 0.2..0.4 step 0.1 → 3 outcomes
    expect(lineSuccessChance([{ value: 0.4, min: 0.2, max: 0.4, step: 0.1 }], 0.3, 'gte')).toBeCloseTo(2 / 3)
  })

  it('average of two rolls ("Adds # to #")', () => {
    // 1-2 and 3-4: sums 4,5,5,6 → avg >= 2.5 in 3 of 4
    const rolls = [{ value: 1, min: 1, max: 2, step: 1 }, { value: 3, min: 3, max: 4, step: 1 }]
    expect(lineSuccessChance(rolls, 2.5, 'gte')).toBeCloseTo(3 / 4)
    expect(lineSuccessChance(rolls, 3, 'gte')).toBeCloseTo(1 / 4)
  })

  it('negative ranges', () => {
    expect(lineSuccessChance([{ value: -10, min: -15, max: -10, step: 1 }], -14, 'lte')).toBeCloseTo(2 / 6)
  })
})

describe('attempts', () => {
  it('average is 1/p', () => {
    expect(avgAttempts(0.25)).toBe(4)
    expect(avgAttempts(0)).toBe(Infinity)
  })
  it('n = ln(1-P)/ln(1-p)', () => {
    // 1/6, 90% → ln(0.1)/ln(5/6) = 12.63 → 13
    expect(attemptsForConfidence(1 / 6, 0.9)).toBe(13)
    expect(attemptsForConfidence(0.5, 0.9)).toBe(4)
    expect(attemptsForConfidence(1, 0.9)).toBe(1)
  })
  it('chance with n divines', () => {
    expect(chanceWithAttempts(0.5, 2)).toBeCloseTo(0.75)
    expect(chanceWithAttempts(1 / 6, 13)).toBeGreaterThan(0.9)
    expect(chanceWithAttempts(0.1, 0)).toBe(0)
  })
  it('step from strings', () => {
    expect(stepFromStrings('25', '25', '28')).toBe(1)
    expect(stepFromStrings('0.4', '0.2', '0.4')).toBeCloseTo(0.1)
  })
})

describe('parseStatLine', () => {
  it('reads hybrid "Adds # to #"', () => {
    const line = parseStatLine('Adds 178(149-203) to 332(302-351) Fire Damage')!
    expect(line.text).toBe('Adds 178 to 332 Fire Damage')
    expect(line.rolls).toEqual([
      { value: 178, min: 149, max: 203, step: 1 },
      { value: 332, min: 302, max: 351, step: 1 }
    ])
  })
  it('reads signed and decimal values, strips unscalable suffix', () => {
    const a = parseStatLine('+25(25-28) to Strength and Intelligence')!
    expect(a.rolls[0]).toMatchObject({ value: 25, min: 25, max: 28 })
    const b = parseStatLine('0.4(0.2-0.4)% of Physical Attack Damage Leeched as Life — Unscalable Value', ' — Unscalable Value')!
    expect(b.text).toBe('0.4% of Physical Attack Damage Leeched as Life')
    expect(b.rolls[0].step).toBeCloseTo(0.1)
    const c = parseStatLine('-10(-15--10)% to Fire Resistance')!
    expect(c.rolls[0]).toMatchObject({ value: -10, min: -15, max: -10 })
  })
  it('ignores fixed values', () => {
    expect(parseStatLine('Bow Attacks fire 2 additional Arrows')).toBeUndefined()
    expect(parseStatLine('+1(1-1) to Level of all Gems')).toBeUndefined()
  })
})
