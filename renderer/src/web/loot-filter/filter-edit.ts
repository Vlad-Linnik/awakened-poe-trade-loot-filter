import type { FilterBlock, FilterLine, ParsedFilter } from './filter-parser'

// BaseType line that lists this exact base type
export function findBaseTypeLine (block: FilterBlock, baseType: string): FilterLine | undefined {
  return block.conditions.find(c =>
    c.keyword === 'BaseType' &&
    c.op !== '!' && c.op !== '!=' &&
    c.values.includes(baseType))
}

// Blocks a base type can be moved to: FilterBlade/NeverSink tiers of the same `$type`
export function moveTargets (filter: ParsedFilter, from: FilterBlock): FilterBlock[] {
  const type = from.tags.type
  return filter.blocks.filter(b => {
    if (b.index === from.index) return false
    // only "tier list" blocks, i.e. ones that already list base types
    if (!b.conditions.some(c => c.keyword === 'BaseType' && c.op !== '!' && c.op !== '!=')) return false
    if (type) return b.tags.type === type
    return b.section != null && b.section === from.section
  })
}
