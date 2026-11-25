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
  // negative for the disabled ones
  index: number
  visibility: Visibility
  // commented out: by the strictness of the filter (FilterBlade) or by the user
  isDisabled: boolean
  startLine: number // line with Show/Hide/Minimal
  endLine: number // exclusive
  headerComment: string
  tags: Record<string, string> // NeverSink: `$type->divination $tier->t1`
  section: string | null // nearest section title above the block (subsection if any)
  topSection: string | null // top level section: `[[4100]] Divination Cards` -> "Divination Cards"
  conditions: FilterLine[]
  actions: FilterLine[]
  continue: boolean
}

export interface ParsedFilter {
  lines: string[]
  eol: string
  // the ones that work
  blocks: FilterBlock[]
  // the ones that are commented out
  disabled: FilterBlock[]
}

// `#Show # # %D3 $type->rr $tier->t2 !rares_t12` - disabled by FilterBlade,
// `#APT-disabled# Show # …` - by the user, `#APT-empty# Show # …` - has no items left
const DISABLED_START = /^#\s?(Show|Hide|Minimal)\b(\s*#.*\$type->.*)$/
const APT_DISABLED = /^#APT-(disabled|empty)# ?(.*)$/

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
  const disabled: FilterBlock[] = []

  let current: FilterBlock | null = null
  let lastSection: string | null = null
  let lastTop: string | null = null
  let lastContentLine = -1

  const finish = () => {
    if (current) {
      current.endLine = lastContentLine + 1
      ;(current.isDisabled ? disabled : blocks).push(current)
      current = null
    }
  }

  for (let i = 0; i < lines.length; ++i) {
    const rawLine = lines[i]
    const trimmed = rawLine.trim()
    if (!trimmed) {
      // a comment after an empty line is not a part of it
      if (current?.isDisabled) finish()
      continue
    }

    const aptDisabled = APT_DISABLED.exec(rawLine)
    const disabledMatch = aptDisabled ? BLOCK_START.exec(aptDisabled[2]) : DISABLED_START.exec(rawLine)
    const startMatch = disabledMatch ?? BLOCK_START.exec(rawLine)
    if (startMatch) {
      finish()
      // the comment of a disabled one starts with one more #
      const headerComment = disabledMatch
        ? extractComment(startMatch[2]).replace(/^#\s*/, '')
        : extractComment(startMatch[2])
      current = {
        index: disabledMatch ? -1 - disabled.length : blocks.length,
        visibility: startMatch[1] as Visibility,
        isDisabled: disabledMatch != null,
        startLine: i,
        endLine: i + 1,
        headerComment,
        tags: parseTags(headerComment),
        section: lastSection,
        topSection: lastTop,
        conditions: [],
        actions: [],
        continue: false
      }
      lastContentLine = i
      continue
    }

    if (current?.isDisabled) {
      const line = enabledLine(rawLine)
      const tokens = line != null ? tokenize(stripComment(line)) : []
      if (tokens.length && /^[A-Z][A-Za-z]+$/.test(tokens[0])) {
        lastContentLine = i
        addRule(current, i, tokens, line!, /^#APT-empty#/.test(rawLine))
        continue
      }
      finish()
    }

    if (trimmed.startsWith('#')) {
      const title = sectionTitle(trimmed)
      if (title) {
        finish()
        if (title.top) {
          lastTop = title.text
          lastSection = title.text
        } else {
          lastSection = title.text
        }
      }
      continue
    }

    if (!current) continue
    lastContentLine = i

    const tokens = tokenize(stripComment(rawLine))
    if (tokens.length) addRule(current, i, tokens, rawLine)
  }
  finish()

  return { lines, eol, blocks, disabled }
}

function addRule (block: FilterBlock, line: number, tokens: string[], raw: string, isEmpty = false) {
  const keyword = tokens[0]
  if (keyword === 'Continue') {
    block.continue = true
    return
  }
  const parsed = parseRule(line, keyword, tokens.slice(1), raw)
  if (isEmpty && keyword === 'BaseType' && parsed.op !== '!' && parsed.op !== '!=') parsed.values = []
  if (ACTION_KEYWORDS.has(keyword)) {
    block.actions.push(parsed)
  } else {
    block.conditions.push(parsed)
  }
}

// ---- disabled blocks ----

// in the order of the file
export function allBlocks (filter: ParsedFilter): FilterBlock[] {
  if (!filter.disabled.length) return filter.blocks
  return [...filter.blocks, ...filter.disabled].sort((a, b) => a.startLine - b.startLine)
}

// a line of a disabled block without the comment
function enabledLine (line: string): string | null {
  const apt = APT_DISABLED.exec(line)
  if (apt) return apt[2]
  return line.startsWith('#') ? line.slice(1) : null
}

// lines of the block as if it is not disabled
export function enabledLines (filter: ParsedFilter, block: FilterBlock): string[] {
  const lines = filter.lines.slice(block.startLine, block.endLine)
  if (!block.isDisabled) return lines
  return lines.map((line, i) => {
    const out = enabledLine(line) ?? line
    return i === 0 ? out.trimStart().replace(/^(Show|Hide|Minimal)\s*#\s*(#\s*)?/, '$1 # ') : out
  })
}

// the block disabled in the same way as FilterBlade does
export function disabledLines (lines: string[]): string[] {
  return lines.map((line, i) => i === 0 ? `#${line.replace('#', '# #')}` : `#${line}`)
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

// NeverSink / FilterBlade style headers: `# [[4100]] Divination Cards` (top level),
// `#   [4101] Divination Cards` or `# !! Waypoint c9.divination.t4 : "Tierlist - Cards - T4" : ...` (subsections)
function sectionTitle (comment: string): { top: boolean, text: string } | null {
  const top = /^#\s*\[\[(\d+)\]\]\s*(.+?)\s*$/.exec(comment)
  if (top) return { top: true, text: top[2] }
  const sub = /^#\s*\[(\d+)\]\s*(.+?)\s*$/.exec(comment)
  if (sub) return { top: false, text: sub[2] }
  const wp = /^#\s*!!\s*Waypoint\s+\S+\s*:\s*"([^"]+)"/.exec(comment)
  if (wp) return { top: false, text: wp[1] }
  return null
}

export function blockText (filter: ParsedFilter, block: FilterBlock) {
  return enabledLines(filter, block).join('\n')
}
