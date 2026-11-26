import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import type { BaseType } from '@/assets/data'
import { cardTier, oneIn, oneStackIn, type CardData, type CardEntry } from './cards'
import data from './div-cards.json'

const card = (props: Partial<CardEntry>): CardEntry => ({ name: 'x', stack: 1, reward: '', weight: null, ...props })

describe('cardTier', () => {
  test.each([
    [1, 't0'], [10, 't0'], [11, 't1'], [100, 't1'], [101, 't2'], [1000, 't2'], [1001, 't3'], [10000, 't3'], [121400, 't4']
  ])('weight %i -> %s', (weight, tier) => {
    expect(cardTier(card({ weight }))).toBe(tier)
  })
  test('special cases', () => {
    expect(cardTier(card({ weight: null }))).toBe('unknown')
    expect(cardTier(card({ weight: 0 }))).toBe('unknown')
    expect(cardTier(card({ weight: 50, boss: true }))).toBe('boss')
    expect(cardTier(card({ weight: 50, disabled: true }))).toBe('disabled')
  })
})

describe('chance', () => {
  test('one in N cards, a stack', () => {
    const c = card({ weight: 10, stack: 8 })
    expect(oneIn(c, 1000)).toBe(100)
    expect(oneStackIn(c, 1000)).toBe(800)
    expect(oneIn(card({ weight: 10, boss: true }), 1000)).toBe(null)
  })
})

describe('the snapshot', () => {
  const d = data as CardData

  test('has the cards and the total weight of the pool', () => {
    expect(d.cards.length).toBeGreaterThan(400)
    const pool = d.cards.reduce((sum, c) => sum + (c.disabled || c.boss ? 0 : c.weight ?? 0), 0)
    expect(d.totalWeight).toBe(pool)
    expect(new Set(d.cards.map(c => c.name)).size).toBe(d.cards.length)
  })

  test('well-known cards', () => {
    const doctor = d.cards.find(c => c.name === 'The Doctor')!
    expect(doctor).toMatchObject({ stack: 8, reward: 'Headhunter' })
    expect(cardTier(doctor)).toBe('t1')
    const rain = d.cards.find(c => c.name === 'Rain of Chaos')!
    expect(cardTier(rain)).toBe('t4')
    expect(rain.sources?.some(s => s.kind === 'act')).toBe(true)
  })

  test('every card the app knows is in the snapshot', () => {
    const records = readFileSync(join(__dirname, '../../../public/data/en/items.ndjson'), 'utf-8')
      .trim().split('\n').map(l => JSON.parse(l) as BaseType)
    const names = new Set(d.cards.map(c => c.name))
    const missing = records.filter(r => r.namespace === 'DIVINATION_CARD' && !names.has(r.refName)).map(r => r.refName)
    expect(missing).toEqual([])
  })
})
