// The app's data for the codex, read once when first needed.

import { ITEM_BY_REF, ITEMS_ITERATOR } from '@/assets/data'
import { dustEntries, type DustEntry } from './dust'
import type { CardData, CardEntry } from './cards'
import type { Reqs } from './sockets'
import cardsJson from './div-cards.json'
import baseReqsJson from './base-reqs.json'

// ---- dust ----

let dust: DustEntry[] | null = null

export function allDustEntries (): DustEntry[] {
  dust ??= dustEntries(
    ITEMS_ITERATOR('"disenchantValue"'),
    ref => ITEM_BY_REF('ITEM', ref)?.[0]
  )
  return dust
}

// uniques of a base type: an unidentified unique can be any of them
export function dustEntriesOfBase (baseRef: string): DustEntry[] {
  return allDustEntries().filter(e => e.baseRef === baseRef)
}

// ---- divination cards ----

export const CARD_DATA = cardsJson as CardData

let cardIndex: Map<string, CardEntry> | null = null

export function cardByName (refName: string): CardEntry | undefined {
  cardIndex ??= new Map(CARD_DATA.cards.map(c => [c.name, c]))
  return cardIndex.get(refName)
}

// in the language of the game client, English when the app doesn't know the name
export function cardDisplayName (refName: string): string {
  return ITEM_BY_REF('DIVINATION_CARD', refName)?.[0]?.name ?? refName
}

export function areaDisplayName (refName: string): string {
  return ITEM_BY_REF('AREA', refName)?.[0]?.name ?? refName
}

// ---- sockets ----

export const BASE_REQS = baseReqsJson as Record<string, Reqs>

// attribute requirements of a base type that can have sockets (English name)
export function baseReqs (baseRef: string): Reqs | undefined {
  return BASE_REQS[baseRef]
}
