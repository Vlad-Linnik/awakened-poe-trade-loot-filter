import { describe, it, expect } from 'vitest'
import { parseExpr, exprChance, isParseError, varsOf, type Expr } from './divine-logic'

function chance (text: string, ps: Record<string, number>) {
  const e = parseExpr(text)
  if (isParseError(e)) throw new Error(JSON.stringify(e))
  return exprChance(e, new Map(Object.entries(ps)))
}

describe('parseExpr', () => {
  it('reads Russian and English words, symbols and look-alike Cyrillic letters', () => {
    for (const text of ['A и B', 'a and b', 'A & B', 'А И В', 'A && b']) {
      expect(parseExpr(text)).toEqual({ kind: 'and', left: { kind: 'var', name: 'A' }, right: { kind: 'var', name: 'B' } })
    }
  })
  it('AND binds tighter than OR', () => {
    const e = parseExpr('A или B и C') as Expr
    expect(e).toMatchObject({ kind: 'or', left: { name: 'A' }, right: { kind: 'and' } })
  })
  it('parens and not', () => {
    const e = parseExpr('не (A или B) и C') as Expr
    expect(e).toMatchObject({ kind: 'and', left: { kind: 'not', arg: { kind: 'or' } }, right: { name: 'C' } })
    expect([...varsOf(e)].sort()).toEqual(['A', 'B', 'C'])
  })
  it('errors', () => {
    expect(parseExpr('')).toEqual({ code: 'empty' })
    expect(parseExpr('A и')).toEqual({ code: 'missing_operand' })
    expect(parseExpr('(A или B')).toEqual({ code: 'unclosed' })
    expect(parseExpr('A B')).toEqual({ code: 'unexpected', token: 'B' })
    expect(parseExpr('A и Б')).toEqual({ code: 'unknown_word', token: 'Б' })
    expect(parseExpr('life и A')).toEqual({ code: 'unknown_word', token: 'life' })
  })
})

describe('exprChance', () => {
  it('and / or / not of independent lines', () => {
    expect(chance('A и B', { A: 0.5, B: 0.2 })).toBeCloseTo(0.1)
    expect(chance('A или B', { A: 0.5, B: 0.2 })).toBeCloseTo(0.6)
    expect(chance('не A', { A: 0.3 })).toBeCloseTo(0.7)
  })
  it('a letter used twice is the same roll', () => {
    // A and B or A and C = A and (B or C)
    expect(chance('A и B или A и C', { A: 0.5, B: 0.5, C: 0.5 })).toBeCloseTo(0.5 * 0.75)
    expect(chance('A или не A', { A: 0.3 })).toBeCloseTo(1)
  })
})
