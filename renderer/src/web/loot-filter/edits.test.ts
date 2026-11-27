import { describe, expect, test } from 'vitest'
import { allBlocks, parseFilter, type ParsedFilter } from './filter-parser'
import {
  MANAGED_HEADER, ruleForBase, ruleForItem, SECTION_START, stackHideRuleOf, stackLimitOf, withStackLimit
} from './apt-rules'
import {
  applyEdits, buildCopy, emptyEdits, newId, selectorOf, withMove,
  type FilterEdits, type FilterSource, type TierPatch
} from './edits'
import { listsBase } from './filter-edit'
import { NEVERSINK, currency, finalBlock, tier, tierOf } from './__fixtures__/fixture'

const source = parseFilter(NEVERSINK)
const SOURCE: FilterSource = { kind: 'local', id: 'NeverSink.filter', name: 'NeverSink' }

function patch (filter: ParsedFilter, type: string, tierName: string, props: Partial<TierPatch>): TierPatch {
  return { id: newId(), selector: selectorOf(tier(filter, type, tierName)), label: tierName, updatedAt: 0, ...props }
}

function edits (props: Partial<FilterEdits>): FilterEdits {
  return { ...emptyEdits(), ...props }
}

function moveChaos (to: string): FilterEdits {
  return withMove(emptyEdits(), source, source, 'Chaos Orb',
    tier(source, 'currency', 't4chaos'), tier(source, 'currency', to), to)
}

describe('applyEdits', () => {
  test('no edits: the same text', () => {
    expect(applyEdits(NEVERSINK, emptyEdits())).toEqual({ text: NEVERSINK, orphans: [] })
  })

  test('only the edited block changes, line endings are kept', () => {
    const { text } = applyEdits(NEVERSINK, edits({ patches: [patch(source, 'currency', 't4chaos', { visibility: 'Hide' })] }))
    const before = NEVERSINK.split('\r\n')
    const after = text.split('\r\n')
    expect(after).toHaveLength(before.length)
    const changed = after.flatMap((l, i) => l === before[i] ? [] : [i])
    expect(changed).toEqual([tier(source, 'currency', 't4chaos').startLine])
    expect(text.includes('\n') && !/[^\r]\n/.test(text)).toBe(true)
  })

  test('visibility and style of a tier', () => {
    const p = patch(source, 'currency', 't4chaos', {
      visibility: 'Hide',
      actions: { SetFontSize: 'SetFontSize 30', PlayEffect: null }
    })
    const text = applyEdits(NEVERSINK, edits({ patches: [p] })).text
    const block = finalBlock(text, currency('Chaos Orb'))!
    expect(block.visibility).toBe('Hide')
    expect(block.actions.find(a => a.keyword === 'SetFontSize')?.values).toEqual(['30'])
    expect(block.actions.some(a => a.keyword === 'PlayEffect')).toBe(false)
  })

  test('adding and removing items of a tier', () => {
    const p = patch(source, 'currency', 't4chaos', { addBaseTypes: ['Some New Orb'], removeBaseTypes: ['Chaos Orb'] })
    const text = applyEdits(NEVERSINK, edits({ patches: [p] })).text
    expect(tierOf(text, currency('Some New Orb'))).toBe('currency/t4chaos')
    expect(tierOf(text, currency('Chaos Orb'))).toBe('currency/restex')
  })

  test('a tier left without items is commented out, not turned into a catch-all', () => {
    const t1 = tier(source, 'currency', 't1exalted')
    const bases = t1.conditions.find(c => c.keyword === 'BaseType')!.values
    const text = applyEdits(NEVERSINK, edits({ patches: [patch(source, 'currency', 't1exalted', { removeBaseTypes: bases })] })).text
    const filter = parseFilter(text)
    expect(filter.blocks.some(b => b.tags.type === 'currency' && b.tags.tier === 't1exalted')).toBe(false)
    // the other currency still goes to its own tiers
    expect(tierOf(filter, currency('Chaos Orb'))).toBe('currency/t4chaos')
    expect(tierOf(filter, currency('Mirror of Kalandra'))).toBe('currency/restex')
    // no block lost its BaseType line and kept the rest
    expect(filter.blocks.every(b => b.conditions.every(c => c.values.length > 0))).toBe(true)
  })

  test('disabled tier', () => {
    const text = applyEdits(NEVERSINK, edits({ patches: [patch(source, 'currency', 't4chaos', { disabled: true })] })).text
    expect(tierOf(text, currency('Chaos Orb'))).toBe('currency/restex')
    expect(parseFilter(text).disabled.some(b => b.tags.tier === 't4chaos')).toBe(true)
  })

  test('a tier disabled by FilterBlade can be enabled', () => {
    const untiered = source.disabled.find(b => b.tags.type === 'currency' && b.tags.tier === 'untiereditems')!
    const p: TierPatch = { id: newId(), selector: selectorOf(untiered), label: 'untiered', enabled: true, updatedAt: 0 }
    const text = applyEdits(NEVERSINK, edits({ patches: [p] })).text
    const block = finalBlock(text, currency('Some New Orb'))!
    expect(block.tags.tier).toBe('untiereditems')
    expect(block.visibility).toBe('Hide')
  })

  test('edits of a tier that is not in the filter are reported', () => {
    const p = patch(source, 'currency', 't4chaos', { visibility: 'Hide' })
    p.selector = { type: 'currency', tier: 'nosuchtier', header: 'x', fingerprint: 'y' }
    expect(applyEdits(NEVERSINK, edits({ patches: [p] })).orphans).toEqual([p.id])
  })
})

describe('moving items between tiers', () => {
  test('the item is in the new tier only', () => {
    const e = moveChaos('t2divine')
    expect(e.moves).toHaveLength(1)
    const filter = parseFilter(applyEdits(NEVERSINK, e).text)
    expect(tierOf(filter, currency('Chaos Orb'))).toBe('currency/t2divine')
    const lists = allBlocks(filter).filter(b => b.tags.type === 'currency' && listsBase(b, 'Chaos Orb'))
    expect(lists.map(b => b.tags.tier)).toEqual(['t2divine'])
  })

  test('stack rules keep the item', () => {
    const text = applyEdits(NEVERSINK, moveChaos('t5alchemy')).text
    expect(tierOf(text, currency('Chaos Orb'))).toBe('currency/t5alchemy')
    expect(tierOf(text, currency('Chaos Orb', 20))).toBe('currency->stackedsix/t2')
  })

  test('moved again: only the last move is kept', () => {
    const first = moveChaos('t2divine')
    const current = parseFilter(applyEdits(NEVERSINK, first).text)
    const second = withMove(first, current, source, 'Chaos Orb',
      tier(current, 'currency', 't2divine'), tier(current, 'currency', 't5alchemy'), 't5alchemy')
    expect(second.moves).toHaveLength(1)
    expect(tierOf(applyEdits(NEVERSINK, second).text, currency('Chaos Orb'))).toBe('currency/t5alchemy')
  })

  test('moved back home: no edits left', () => {
    const first = moveChaos('t2divine')
    const current = parseFilter(applyEdits(NEVERSINK, first).text)
    const back = withMove(first, current, source, 'Chaos Orb',
      tier(current, 'currency', 't2divine'), tier(current, 'currency', 't4chaos'), 't4chaos')
    expect(back.moves).toHaveLength(0)
    expect(applyEdits(NEVERSINK, back).text).toBe(NEVERSINK)
  })
})

describe('edits survive a new version of the filter', () => {
  // an economy update: the tier gets other items and another FilterBlade header,
  // and there are new lines above it
  const updated = NEVERSINK
    .replace('Show # %H6 $type->currency $tier->t4chaos !currency_c', 'Show # %H5 $type->currency $tier->t4chaos !currency_c')
    .replace('"Chromatic Orb" "Eldritch Exalted Orb"', '"Eldritch Exalted Orb" "Orb of Regret"')
    .replace('# [[4200]] Remaining Currency', '# [[4200]] Remaining Currency\r\n# a new comment\r\n#')

  test('a tier patch and a move are applied to the new version', () => {
    const e = edits({
      patches: [patch(source, 'currency', 't4chaos', { actions: { SetFontSize: 'SetFontSize 33' } })],
      moves: moveChaos('t2divine').moves
    })
    const { text, orphans } = applyEdits(updated, e)
    expect(orphans).toEqual([])
    const filter = parseFilter(text)
    expect(tierOf(filter, currency('Chaos Orb'))).toBe('currency/t2divine')
    const t4 = tier(filter, 'currency', 't4chaos')
    expect(t4.actions.find(a => a.keyword === 'SetFontSize')?.values).toEqual(['33'])
    expect(listsBase(t4, 'Orb of Regret')).toBe(true)
  })
})

describe('buildCopy', () => {
  test('header, then my rules, then the filter', () => {
    const rule = ruleForItem(currency('Chaos Orb'), 'Hide')
    const { text } = buildCopy(SOURCE, NEVERSINK, edits({ rules: [rule] }))
    const lines = text.split('\r\n')
    expect(lines[0].startsWith(`${MANAGED_HEADER} source=local:NeverSink.filter version=fnv`)).toBe(true)
    expect(lines.findIndex(l => l.startsWith(SECTION_START))).toBeLessThan(lines.findIndex(l => l.startsWith('# NeverSink')))
    expect(finalBlock(text, currency('Chaos Orb'))?.visibility).toBe('Hide')
    expect(tierOf(text, currency('Exalted Orb'))).toBe('currency/t4chaos')
  })

  test('a rule of a tier item stands right before its tier: stack rules above it still work', () => {
    const rule = ruleForBase('Chaos Orb', tier(source, 'currency', 't4chaos'), { visibility: 'Hide', isGear: false })
    const { text } = buildCopy(SOURCE, NEVERSINK, edits({ rules: [rule] }))
    const filter = parseFilter(text)
    expect(finalBlock(filter, currency('Chaos Orb'))?.visibility).toBe('Hide')
    expect(tierOf(filter, currency('Chaos Orb', 20))).toBe('currency->stackedsix/t2')
    const ruleAt = filter.blocks.findIndex(b => b.headerComment.includes(`[apt:${rule.id}]`))
    expect(filter.blocks[ruleAt + 1].tags.tier).toBe('t4chaos')
  })
})

describe('hidden item shown in big stacks', () => {
  test('"Hide this item" with a stack limit hides only the smaller stacks', () => {
    const rule = withStackLimit(ruleForItem(currency('Orb of Alchemy'), 'Hide'), 20)
    expect(stackLimitOf(rule)).toBe(20)
    const { text } = buildCopy(SOURCE, NEVERSINK, edits({ rules: [rule] }))
    expect(finalBlock(text, currency('Orb of Alchemy', 5))?.visibility).toBe('Hide')
    const big = finalBlock(text, currency('Orb of Alchemy', 20))
    expect(big?.visibility).toBe('Show')
    expect(big?.headerComment).not.toContain(`[apt:${rule.id}]`)
    // the rule is still found for a big stack, so it can be changed from it
    expect(stackHideRuleOf([rule], currency('Orb of Alchemy', 25))?.id).toBe(rule.id)
    expect(stackHideRuleOf([rule], currency('Chaos Orb', 25))).toBeNull()
  })

  test('the limit is replaced or removed, other stack conditions stay', () => {
    const rule = { ...ruleForItem(currency('Orb of Alchemy'), 'Hide'), conditions: ['BaseType == "Orb of Alchemy"', 'StackSize >= 3'] }
    const limited = withStackLimit(withStackLimit(rule, 10), 30)
    expect(limited.conditions).toEqual(['BaseType == "Orb of Alchemy"', 'StackSize >= 3', 'StackSize < 30'])
    expect(withStackLimit(limited, null).conditions).toEqual(rule.conditions)
  })
})
