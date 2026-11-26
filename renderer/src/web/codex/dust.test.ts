import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import type { BaseType } from '@/assets/data'
import { dustEntries, dustValue } from './dust'

const at = (itemLevel: number, quality = 0, extras = 0) => ({ itemLevel, quality, extras })

describe('dustValue', () => {
  // values from poedb.tw/us/Kingsmarch (Disenchant table: ilvl 84 and ilvl 84 q20)
  test.each([
    ['Original Sin', 1128.89, 2822225, 3951115],
    ['Headhunter', 891.16, 2227900, 3119060],
    ['Starforge', 703.49, 1758725, 2462215],
    ['Severed in Sleep', 0.58, 1450, 2030]
  ])('%s', (_name, value, ilvl84, q20) => {
    expect(dustValue(value, at(84))).toBe(ilvl84)
    expect(dustValue(value, at(84, 20))).toBe(q20)
  })

  test('item level above 84 counts as 84', () => {
    expect(dustValue(100, at(86))).toBe(dustValue(100, at(84)))
  })

  test('lower item level gives less', () => {
    expect(dustValue(100, at(75))).toBeLessThan(dustValue(100, at(84)))
    expect(dustValue(100, at(1))).toBe(dustValue(100, at(46)))
  })

  test('+50% per influence or corruption implicit', () => {
    expect(dustValue(100, at(84, 0, 2))).toBe(dustValue(100, at(84)) * 2)
  })
})

describe('dustEntries on the app data', () => {
  const records = readFileSync(join(__dirname, '../../../public/data/en/items.ndjson'), 'utf-8')
    .trim().split('\n').map(l => JSON.parse(l) as BaseType)
  const bases = new Map(records.filter(r => r.namespace === 'ITEM').map(r => [r.refName, r]))
  const entries = dustEntries(records, ref => bases.get(ref))

  test('every unique with a dust value, once', () => {
    const withDust = new Set(records.filter(r => r.unique?.disenchantValue != null).map(r => `${r.refName}\n${r.unique!.base}`))
    expect(entries).toHaveLength(withDust.size)
    expect(entries.length).toBeGreaterThan(1000)
  })

  test('base type, size and class', () => {
    const hh = entries.find(e => e.refName === 'Headhunter')!
    expect(hh).toMatchObject({ baseRef: 'Leather Belt', w: 2, h: 1, category: 'Belt', disenchantValue: 891.16 })
    expect(entries.filter(e => e.category == null).map(e => e.refName)).toEqual([])
  })
})
