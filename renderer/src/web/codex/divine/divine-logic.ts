// Logic over the lines of the calculator: "A and B or A and C", "not (A or B)"…
// Each letter is one line, true when its re-rolled values meet the targets.
// Lines roll independently, so the chance of a formula is exact when summed
// over every outcome of the letters it uses.

export type Expr =
  | { kind: 'var', name: string }
  | { kind: 'not', arg: Expr }
  | { kind: 'and' | 'or', left: Expr, right: Expr }

export type ParseError =
  | { code: 'empty' }
  | { code: 'unexpected', token: string }
  | { code: 'unknown_word', token: string }
  | { code: 'unclosed' }
  | { code: 'missing_operand' }

type Token =
  | { t: 'var', name: string }
  | { t: 'and' | 'or' | 'not' | '(' | ')' }

const AND_WORDS = ['and', 'и', '&', '&&', '*', '∧']
const OR_WORDS = ['or', 'или', '|', '||', '+', '∨']
const NOT_WORDS = ['not', 'не', '!', '¬']

// Cyrillic letters typed instead of Latin look-alikes
const LOOKALIKE: Record<string, string> = {
  А: 'A', В: 'B', С: 'C', Е: 'E', Н: 'H', К: 'K', М: 'M', О: 'O', Р: 'P', Т: 'T', Х: 'X'
}

export function tokenize (text: string): Token[] | ParseError {
  const tokens: Token[] = []
  const re = /\s*(\(|\)|&&|\|\||[&|*+!¬∧∨]|[\p{L}\d]+)/uy
  let pos = 0
  while (pos < text.length) {
    re.lastIndex = pos
    const m = re.exec(text)
    if (!m) {
      if (/^\s*$/.test(text.slice(pos))) break
      return { code: 'unexpected', token: text.slice(pos).trim()[0] }
    }
    pos = re.lastIndex
    const raw = m[1]
    const low = raw.toLowerCase()
    if (raw === '(' || raw === ')') tokens.push({ t: raw })
    else if (AND_WORDS.includes(low)) tokens.push({ t: 'and' })
    else if (OR_WORDS.includes(low)) tokens.push({ t: 'or' })
    else if (NOT_WORDS.includes(low)) tokens.push({ t: 'not' })
    else {
      const up = raw.toUpperCase()
      const name = up.length === 1 ? (LOOKALIKE[up] ?? up) : up
      if (!/^[A-Z]$/.test(name)) return { code: 'unknown_word', token: raw }
      tokens.push({ t: 'var', name })
    }
  }
  return tokens
}

/** Precedence: NOT, then AND, then OR (like multiplication before addition). */
export function parseExpr (text: string): Expr | ParseError {
  const parsed = tokenize(text)
  if (!Array.isArray(parsed)) return parsed
  if (!parsed.length) return { code: 'empty' }
  const tokens: Token[] = parsed

  let i = 0
  const peek = () => tokens[i]

  function primary (): Expr | ParseError {
    const tok = tokens[i++]
    if (!tok) return { code: 'missing_operand' }
    if (tok.t === 'var') return { kind: 'var', name: tok.name }
    if (tok.t === 'not') {
      const arg = primary()
      return 'code' in arg ? arg : { kind: 'not', arg }
    }
    if (tok.t === '(') {
      const inner = or()
      if ('code' in inner) return inner
      if (tokens[i]?.t !== ')') return { code: 'unclosed' }
      i++
      return inner
    }
    return { code: 'unexpected', token: tok.t === ')' ? ')' : tok.t }
  }

  function and (): Expr | ParseError {
    let left = primary()
    while (!('code' in left) && peek()?.t === 'and') {
      i++
      const right = primary()
      if ('code' in right) return right
      left = { kind: 'and', left, right }
    }
    return left
  }

  function or (): Expr | ParseError {
    let left = and()
    while (!('code' in left) && peek()?.t === 'or') {
      i++
      const right = and()
      if ('code' in right) return right
      left = { kind: 'or', left, right }
    }
    return left
  }

  const expr = or()
  if ('code' in expr) return expr
  if (i < tokens.length) {
    const tok = tokens[i]
    return { code: 'unexpected', token: tok.t === 'var' ? tok.name : tok.t }
  }
  return expr
}

export function isParseError (e: Expr | ParseError): e is ParseError {
  return 'code' in e
}

export function varsOf (expr: Expr, out = new Set<string>()): Set<string> {
  switch (expr.kind) {
    case 'var': out.add(expr.name); break
    case 'not': varsOf(expr.arg, out); break
    default: varsOf(expr.left, out); varsOf(expr.right, out)
  }
  return out
}

function evaluate (expr: Expr, values: Map<string, boolean>): boolean {
  switch (expr.kind) {
    case 'var': return values.get(expr.name)!
    case 'not': return !evaluate(expr.arg, values)
    case 'and': return evaluate(expr.left, values) && evaluate(expr.right, values)
    case 'or': return evaluate(expr.left, values) || evaluate(expr.right, values)
  }
}

/** Exact chance of the formula, the letters being independent with these chances. */
export function exprChance (expr: Expr, chances: Map<string, number>): number {
  const vars = [...varsOf(expr)]
  const values = new Map<string, boolean>()
  let total = 0
  const outcomes = 1 << vars.length
  for (let mask = 0; mask < outcomes; mask++) {
    let weight = 1
    for (let k = 0; k < vars.length; k++) {
      const on = Boolean(mask & (1 << k))
      const p = chances.get(vars[k]) ?? 0
      weight *= on ? p : 1 - p
      values.set(vars[k], on)
    }
    if (weight && evaluate(expr, values)) total += weight
  }
  return total
}

/** A, B, …, Z, then AA? Never needed: an item has at most a dozen lines. */
export function letterAt (index: number): string {
  return String.fromCharCode(65 + (index % 26))
}
