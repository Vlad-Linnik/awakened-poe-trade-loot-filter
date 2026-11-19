// Parser for Path of Exile `.filter` files.
// Keeps line positions so that blocks can be edited in place without
// reformatting the rest of the file (important for FilterBlade/NeverSink filters).

export type Visibility = 'Show' | 'Hide' | 'Minimal'

export interface FilterLine {
  line: number // 0-based index in the file
  keyword: string
  op: string // '' when not specified
  values: string[]
  // e.g. `HasExplicitMod >=2 "A" "B"` -> { op: '>=', n: 2 }
  count?: { op: string, n: number }
  raw: string
}

export interface FilterBlock {
  index: number
  visibility: Visibility
  isDisabled: false
  startLine: number // line with Show/Hide/Minimal
  endLine: number // exclusive
  headerComment: string
  tags: Record<string, string> // NeverSink: `$type->divination $tier->t1`
  section: string | null // nearest section title above the block
  conditions: FilterLine[]
  actions: FilterLine[]
  continue: boolean
}

export interface ParsedFilter {
  lines: string[]
  eol: string
  blocks: FilterBlock[]
}

const BLOCK_START = /^\s*(Show|Hide|Minimal)\b(.*)$/

export const ACTION_KEYWORDS = new Set([
  'SetTextColor', 'SetBorderColor', 'SetBackgroundColor', 'SetFontSize',
  'PlayAlertSound', 'PlayAlertSoundPositional', 'CustomAlertSound', 'CustomAlertSoundOptional',
  'DisableDropSound', 'EnableDropSound', 'DisableDropSoundIfAlertSound', 'EnableDropSoundIfAlertSound',
  'MinimapIcon', 'PlayEffect'
])

// condition keywords that may start with a number meaning "how many of the listed values"
const COUNTABLE = new Set(['HasExplicitMod', 'HasEnchantment', 'BaseType', 'Class'])

export function parseFilter (text: string): ParsedFilter {
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const lines = text.split(/\r?\n/)
  const blocks: FilterBlock[] = []

  let current: FilterBlock | null = null
  let lastSection: string | null = null
  let lastContentLine = -1

  const finish = () => {
    if (current) {
      current.endLine = lastContentLine + 1
      blocks.push(current)
      current = null
    }
  }

  for (let i = 0; i < lines.length; ++i) {
    const rawLine = lines[i]
    const trimmed = rawLine.trim()
    if (!trimmed) continue

    const startMatch = BLOCK_START.exec(rawLine)
    if (startMatch) {
      finish()
      const headerComment = extractComment(startMatch[2])
      current = {
        index: blocks.length,
        visibility: startMatch[1] as Visibility,
        isDisabled: false,
        startLine: i,
        endLine: i + 1,
        headerComment,
        tags: parseTags(headerComment),
        section: lastSection,
        conditions: [],
        actions: [],
        continue: false
      }
      lastContentLine = i
      continue
    }

    if (trimmed.startsWith('#')) {
      const title = sectionTitle(trimmed)
      if (title) {
        finish()
        lastSection = title
      }
      continue
    }

    if (!current) continue
    lastContentLine = i

    const tokens = tokenize(stripComment(rawLine))
    if (!tokens.length) continue
    const keyword = tokens[0]
    if (keyword === 'Continue') {
      current.continue = true
      continue
    }
    const parsed = parseRule(i, keyword, tokens.slice(1), rawLine)
    if (ACTION_KEYWORDS.has(keyword)) {
      current.actions.push(parsed)
    } else {
      current.conditions.push(parsed)
    }
  }
  finish()

  return { lines, eol, blocks }
}

function parseRule (line: number, keyword: string, rest: string[], raw: string): FilterLine {
  let op = ''
  const values: string[] = []
  let count: FilterLine['count']

  rest = [...rest]
  if (rest.length) {
    const m = /^(==|!=|<=|>=|<|>|=|!)(.*)$/.exec(rest[0])
    if (m && !rest[0].startsWith('"')) {
      op = m[1]
      rest.shift()
      if (m[2]) rest.unshift(m[2])
    }
  }
  if (COUNTABLE.has(keyword) && rest.length > 1 && /^\d+$/.test(rest[0])) {
    count = { op: op || '>=', n: Number(rest.shift()) }
    op = ''
  }
  for (const token of rest) values.push(unquote(token))
  return { line, keyword, op, values, count, raw }
}

// parse a single condition/action line (outside of a block)
export function parseLine (raw: string, line = 0): FilterLine | null {
  const tokens = tokenize(stripComment(raw))
  if (!tokens.length) return null
  return parseRule(line, tokens[0], tokens.slice(1), raw)
}

export function tokenize (text: string): string[] {
  const out: string[] = []
  const re = /"([^"]*)"|(\S+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    out.push(m[1] != null ? `"${m[1]}"` : m[2])
  }
  return out
}

function unquote (token: string) {
  return (token.startsWith('"') && token.endsWith('"') && token.length >= 2)
    ? token.slice(1, -1)
    : token
}

export function stripComment (line: string) {
  let inQuote = false
  for (let i = 0; i < line.length; ++i) {
    const ch = line[i]
    if (ch === '"') inQuote = !inQuote
    else if (ch === '#' && !inQuote) return line.slice(0, i)
  }
  return line
}

function extractComment (rest: string) {
  const idx = rest.indexOf('#')
  return idx >= 0 ? rest.slice(idx + 1).trim() : ''
}

function parseTags (comment: string): Record<string, string> {
  const tags: Record<string, string> = {}
  const re = /\$(\w+)->(\S+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(comment))) {
    tags[m[1]] = m[2]
  }
  return tags
}

// NeverSink / FilterBlade style headers: `# [[4200]] Divination Cards` or `#   [4201] Divination Cards`
function sectionTitle (comment: string): string | null {
  const m = /^#\s*\[\[?(\d+)\]?\]\s*(.+?)\s*$/.exec(comment)
  if (m) return `[${m[1]}] ${m[2]}`
  // NeverSink: `# !! Waypoint c9.divination.t4 : "Tierlist - Cards - T4, T4c and lower" : "Divination Cards"`
  const wp = /^#\s*!!\s*Waypoint\s+\S+\s*:\s*"([^"]+)"/.exec(comment)
  if (wp) return wp[1]
  return null
}

export function blockText (filter: ParsedFilter, block: FilterBlock) {
  return filter.lines.slice(block.startLine, block.endLine).join('\n')
}
