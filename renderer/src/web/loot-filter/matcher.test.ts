import { describe, expect, test } from 'vitest'
import { parseFilter, parseLine } from './filter-parser'
import { evalCondition, matchItem, relatedBlocks } from './matcher'
import { NEVERSINK, currency, item, tierOf } from './__fixtures__/fixture'

describe('matchItem on NeverSink', () => {
  const filter = parseFilter(NEVERSINK)

  test.each([
    ['Chaos Orb', 1, 'currency/t4chaos'],
    ['Chaos Orb', 20, 'currency->stackedsix/t2'],
    ['Mirror of Kalandra', 1, 'currency/t1exalted'],
    ['Scroll of Wisdom', 1, 'currency/twisdom'],
    ['Scroll of Wisdom', 40, 'currency->stackedsupplieswisdom/t1'],
    ['Scroll Fragment', 1, 'currency/scrollfragments'],
    // not in any tier list: the "Rest" tier
    ['Some New Orb', 1, 'currency/restex']
  ])('%s x%i -> %s', (base, stack, expected) => {
    expect(tierOf(filter, currency(base, stack))).toBe(expected)
  })

  test('hidden tier', () => {
    expect(matchItem(filter, currency('Scroll Fragment')).final?.block.visibility).toBe('Hide')
  })

  test('divination cards', () => {
    const card = (baseType: string) => item({ baseType, class: 'Divination Cards', stackSize: 1 })
    expect(tierOf(filter, card('The Doctor'))).toBe('divination/t1')
    expect(tierOf(filter, card('Rain of Chaos'))).toBe('divination/t5c')
  })

  test('6 links before the rare tiers', () => {
    const armour = item({
      baseType: 'Vaal Regalia',
      class: 'Body Armours',
      rarity: 'Rare',
      itemLevel: 84,
      sockets: 'R-G-B-B-B-B',
      width: 2,
      height: 3,
      identified: false
    })
    expect(tierOf(filter, armour)).toBe('6l/hightier')
    expect(tierOf(filter, { ...armour, sockets: 'R-G-B B-B-B' })).not.toBe('6l/hightier')
  })

  test('Continue blocks are collected before the final one', () => {
    const ring = item({ baseType: 'Two-Stone Ring', class: 'Rings', rarity: 'Rare', itemLevel: 84, identified: false })
    const m = matchItem(filter, ring)
    expect(m.final?.block.tags.type).toBe('rr->amuring')
    expect(m.continued.every(c => c.block.continue)).toBe(true)
    expect(m.continued.length).toBeGreaterThan(0)
  })

  test('related blocks of a base: stacks first, then the tier, then stop', () => {
    const related = relatedBlocks(filter, currency('Chaos Orb'))
    expect(related.map(e => `${e.block.tags.type}/${e.block.tags.tier}`)).toEqual([
      'currency->stackedsix/t2', 'currency->stackedthree/t3', 'currency/t4chaos'
    ])
    expect(related.at(-1)!.result).toBe(true)
    expect(related[0].unknown.map(c => c.keyword)).toEqual(['StackSize'])
  })
})

describe('evalCondition', () => {
  const ev = (line: string, props: Parameters<typeof item>[0]) => evalCondition(parseLine(line)!, item(props))

  test('BaseType: `==` is the whole name, without it a part of the name', () => {
    expect(ev('BaseType == "Orb"', { baseType: 'Chaos Orb' })).toBe(false)
    expect(ev('BaseType "Orb"', { baseType: 'Chaos Orb' })).toBe(true)
    expect(ev('BaseType == "Chaos Orb"', { baseType: 'Chaos Orb' })).toBe(true)
    expect(ev('BaseType != "Chaos Orb"', { baseType: 'Chaos Orb' })).toBe(false)
  })

  test('numbers', () => {
    expect(ev('StackSize >= 3', { baseType: 'x', stackSize: 3 })).toBe(true)
    expect(ev('StackSize > 3', { baseType: 'x', stackSize: 3 })).toBe(false)
    expect(ev('ItemLevel 84 85', { baseType: 'x', itemLevel: 85 })).toBe(true)
    // can't tell from the item text
    expect(ev('ItemLevel >= 84', { baseType: 'x', itemLevel: undefined })).toBe(null)
  })

  test('rarity is ordered', () => {
    expect(ev('Rarity <= Rare', { baseType: 'x', rarity: 'Magic' })).toBe(true)
    expect(ev('Rarity <= Rare', { baseType: 'x', rarity: 'Unique' })).toBe(false)
    expect(ev('Rarity Normal Magic', { baseType: 'x', rarity: 'Rare' })).toBe(false)
  })

  test('sockets, links and colors', () => {
    const sockets = 'R-G-B-B W'
    expect(ev('Sockets >= 5', { baseType: 'x', sockets })).toBe(true)
    expect(ev('LinkedSockets >= 5', { baseType: 'x', sockets })).toBe(false)
    expect(ev('LinkedSockets 4', { baseType: 'x', sockets })).toBe(true)
    expect(ev('SocketGroup RGB', { baseType: 'x', sockets })).toBe(true)
    expect(ev('SocketGroup RGW', { baseType: 'x', sockets })).toBe(false)
    expect(ev('Sockets >= 6', { baseType: 'x', sockets: undefined })).toBe(false)
  })

  test('count of mods', () => {
    const explicitModNames = ['Tyrannical', 'Merciless', 'of Celebration']
    expect(ev('HasExplicitMod >=2 "Tyrannical" "Merciless"', { baseType: 'x', explicitModNames })).toBe(true)
    expect(ev('HasExplicitMod >=3 "Tyrannical" "Merciless"', { baseType: 'x', explicitModNames })).toBe(false)
    expect(ev('HasExplicitMod "Tyrannical"', { baseType: 'x', explicitModNames: undefined })).toBe(null)
  })

  test('a guessed (non-English) class only rules out what surely differs', () => {
    expect(ev('Class == "Stackable Currency"', { baseType: 'x', class: 'Currency', classIsGuess: true })).toBe(null)
    expect(ev('Class "Currency"', { baseType: 'x', class: 'Currency', classIsGuess: true })).toBe(true)
    expect(ev('Class == "Rings"', { baseType: 'x', class: 'Currency', classIsGuess: true })).toBe(false)
  })
})
