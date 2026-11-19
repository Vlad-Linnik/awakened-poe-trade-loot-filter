import { Host } from '@/web/background/IPC'
import type { Widget } from '@/web/overlay/interfaces'

export interface LootFilterWidget extends Widget {
  hotkey: string | null
  // opens the editor of the whole filter (no item needed)
  browseHotkey: string | null
  // manual path to a .filter file; null = use the filter selected in game options
  filterPath: string | null
  reloadAfterHide: boolean
}

export type LootFilterKind = 'local' | 'online' | 'managed'

interface FileData { path: string, contents: string, mtime: number }

export interface LootFilterSource extends FileData {
  kind: 'online' | 'local'
  id: string
  name: string
}

export interface LootFilterInfo extends FileData {
  filterDir: string
  kind: LootFilterKind
  name: string
  // original filter the APT copy is built from
  source: LootFilterSource | null
  // last area level from Client.txt
  areaLevel?: number | null
}

type ApiResponse<T> = { ok: true, data: T } | { ok: false, error: string }

async function call<T> (url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const body = await res.json() as ApiResponse<T>
  if (!body.ok) throw new Error(body.error)
  return body.data
}

export function loadActiveFilter (overridePath: string | null) {
  const query = overridePath ? `?path=${encodeURIComponent(overridePath)}` : ''
  return call<LootFilterInfo>(`/loot-filter/active${query}`)
}

export function saveFilter (path: string, contents: string, expectedMtime?: number) {
  return call<{ path: string, mtime: number }>('/loot-filter/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, contents, expectedMtime })
  })
}

export function statFile (path: string) {
  return call<{ mtime: number }>(`/loot-filter/stat?path=${encodeURIComponent(path)}`)
}

export function loadRules () {
  return call<unknown>('/loot-filter/rules')
}

export function saveRules (rules: unknown) {
  return call<unknown>('/loot-filter/rules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rules)
  })
}

export function openBackupsFolder () {
  return call<unknown>('/loot-filter/open-backups', { method: 'POST' })
}

export function sendChatCommand (text: string) {
  Host.sendEvent({
    name: 'CLIENT->MAIN::user-action',
    payload: { action: 'paste-in-chat', text, send: true }
  })
}

// Area level is not part of the item text, so we take it from Client.txt
let lastAreaLevel: number | undefined
let lastAreaName: string | undefined
let subscribed = false
export function trackAreaLevel () {
  if (subscribed) return
  subscribed = true
  Host.onEvent('MAIN->CLIENT::game-log', (e) => {
    for (const line of e.lines) {
      const m = /Generating level (\d+) area "([^"]+)"/.exec(line)
      if (m) {
        lastAreaLevel = Number(m[1])
        lastAreaName = m[2]
      }
    }
  })
}
export function currentArea () {
  return { level: lastAreaLevel, name: lastAreaName }
}
