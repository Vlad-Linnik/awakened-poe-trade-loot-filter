import { describe, expect, test } from 'vitest'
import { allBlocks, disabledLines, enabledLines, parseFilter, parseLine } from './filter-parser'
import { NEVERSINK, tier } from './__fixtures__/fixture'

describe('parseFilter on NeverSink', () => {
  const filter = parseFilter(NEVERSINK)

  test('keeps the text and line endings', () => {
    expect(filter.eol).toBe('\r\n')
    expect(filter.lines.join(filter.eol)).toBe(NEVERSINK)
  })

  test('finds the enabled and the commented out blocks', () => {
    const starts = filter.lines.filter(l => /^(Show|Hide|Minimal)\b/.test(l)).length
    expect(filter.blocks).toHaveLength(starts)
    // FilterBlade comments out blocks by strictness: `#Show # … $type->…`
    expect(filter.disabled.length).toBeGreaterThan(50)
    expect(filter.disabled.every(b => b.isDisabled && b.index < 0)).toBe(true)
  })

  test('blocks don\'t overlap and are in order', () => {
    const blocks = allBlocks(filter)
    for (let i = 0; i < blocks.length; ++i) {
      expect(blocks[i].endLine).toBeGreaterThan(blocks[i].startLine)
      if (i > 0) expect(blocks[i].startLine).toBeGreaterThanOrEqual(blocks[i - 1].endLine)
    }
    expect(filter.blocks.map(b => b.index)).toEqual(filter.blocks.map((_, i) => i))
  })

  test('every block has conditions or actions', () => {
    for (const b of allBlocks(filter)) {
      expect(b.conditions.length + b.actions.length, filter.lines[b.startLine]).toBeGreaterThan(0)
    }
  })

  test('reads tags, sections, conditions and actions', () => {
    const t4 = tier(filter, 'currency', 't4chaos')
    expect(t4.visibility).toBe('Show')
    expect(t4.topSection).toBe('Currency - Regular Currency Tiering')
    expect(t4.conditions.map(c => c.keyword)).toEqual(['Class', 'BaseType'])
    const bases = t4.conditions[1]
    expect(bases.op).toBe('==')
    expect(bases.values).toContain('Chaos Orb')
    expect(t4.actions.find(a => a.keyword === 'SetFontSize')?.values).toEqual(['45'])
    expect(t4.actions.find(a => a.keyword === 'MinimapIcon')?.values).toEqual(['2', 'White', 'Circle'])
  })

  test('reads the blocks commented out by FilterBlade', () => {
    const untiered = filter.disabled.find(b => b.tags.type === 'currency' && b.tags.tier === 'untiereditems')!
    expect(untiered.visibility).toBe('Hide')
    expect(untiered.conditions.map(c => c.keyword)).toEqual(['Class'])
    expect(enabledLines(filter, untiered)[0]).toMatch(/^Hide # \$type->currency \$tier->untiereditems/)
  })

  test('a block commented out again reads the same', () => {
    const t4 = tier(filter, 'currency', 't4chaos')
    const lines = disabledLines(enabledLines(filter, t4))
    const again = parseFilter(lines.join('\n'))
    expect(again.blocks).toHaveLength(0)
    expect(again.disabled).toHaveLength(1)
    expect(again.disabled[0].tags).toEqual(t4.tags)
    expect(again.disabled[0].conditions.map(c => c.values)).toEqual(t4.conditions.map(c => c.values))
  })
})

describe('parseLine', () => {
  test('operator glued to the value', () => {
    expect(parseLine('StackSize >=3')).toMatchObject({ keyword: 'StackSize', op: '>=', values: ['3'] })
  })
  test('count of listed values', () => {
    expect(parseLine('HasExplicitMod >=2 "Tyrannical" "Merciless"')).toMatchObject({
      keyword: 'HasExplicitMod', op: '', count: { op: '>=', n: 2 }, values: ['Tyrannical', 'Merciless']
    })
  })
  test('a number as the only BaseType value is not a count', () => {
    expect(parseLine('BaseType "2"')?.count).toBeUndefined()
  })
  test('# inside quotes is not a comment', () => {
    expect(parseLine('BaseType == "A#B" # comment')?.values).toEqual(['A#B'])
  })
})
