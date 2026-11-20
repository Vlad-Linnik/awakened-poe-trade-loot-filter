import fs from 'fs/promises'
import path from 'path'
import ini from 'ini'
import { app } from 'electron'
import type { Server, IncomingMessage, ServerResponse } from 'http'
import { guessFileLocation, poeLogFromProcess } from './utils'
import { GAME_CONFIG_POSSIBLE_PATH, type GameConfig } from './GameConfig'
import type { Logger } from '../RemoteLogger'
import type { ServerEvents } from '../server'

export type LootFilterKind = 'local' | 'online' | 'managed'

interface FileData { path: string, contents: string, mtime: number }

export interface LootFilterSource extends FileData {
  kind: 'online' | 'local'
  // online filter id (`item_filter=Wa42ZyUE`) or local file name without extension
  id: string
  // name shown in game
  name: string
}

export interface LootFilterInfo extends FileData {
  filterDir: string
  kind: LootFilterKind
  name: string
  // original filter the APT copy is built from (for 'managed': as referenced in its header)
  source: LootFilterSource | null
}

const MAX_BACKUPS = 30
export const MANAGED_HEADER = '#APT-MANAGED-COPY'

async function readLogTail (logPath: string | null): Promise<string | null> {
  if (!logPath) return null
  let file: fs.FileHandle | null = null
  try {
    file = await fs.open(logPath, 'r')
    const { size } = await file.stat()
    const length = Math.min(size, 1024 * 1024)
    const buf = Buffer.alloc(length)
    await file.read(buf, 0, length, size - length)
    return buf.toString('utf-8')
  } catch {
    return null
  } finally {
    await file?.close()
  }
}

// The game logs when it (re)loads an online filter: selected in options, refreshed, or `/itemfilter <online>`.
// `2026/11/20 01:48:25 791532218 788474e5 [INFO Client 16048] [Item Filter] Finished reloading online filter D4gaYKCQ. Result: true. ...`
function lastOnlineFilterLoad (logText: string | null): { id: string, time: number } | null {
  if (!logText) return null
  const re = /^(\d{4})\/(\d\d)\/(\d\d) (\d\d):(\d\d):(\d\d) .*\[Item Filter\] Finished reloading online filter (\S+)\. Result: true/gm
  let last: { id: string, time: number } | null = null
  for (const m of logText.matchAll(re)) {
    const [, y, mo, d, h, mi, sec, id] = m
    last = { id, time: new Date(+y, +mo - 1, +d, +h, +mi, +sec).getTime() }
  }
  return last
}

// Area level is not in the item text: take the last generated area from Client.txt
function lastAreaLevel (logText: string | null): number | null {
  if (!logText) return null
  let last: number | null = null
  for (const m of logText.matchAll(/Generating level (\d+) area "/g)) last = Number(m[1])
  return last
}

export function addLootFilterRoutes (
  server: Server,
  gameConfig: GameConfig,
  logger: Logger,
  getLogPath: () => string | null,
  events: ServerEvents
) {
  const aptData = path.join(app.getPath('userData'), 'apt-data')
  const backupsPath = path.join(aptData, 'filter-backups')
  const rulesPath = path.join(aptData, 'loot-filter-rules.json')
  const statePath = path.join(aptData, 'loot-filter-state.json')
  let logFromProcess: string | null = null

  // `/itemfilter` doesn't update production_Config.ini right away, so remember what we switched to.
  // `iniValue` is what the config said at that moment: a different value later means
  // the filter was changed in the game options after our switch.
  interface Switch { name: string, time: number, iniValue: string | null }
  let lastSwitch: Switch | null = null
  let stateLoaded = false
  async function loadState () {
    if (stateLoaded) return
    stateLoaded = true
    try {
      lastSwitch = (JSON.parse(await fs.readFile(statePath, 'utf-8')) as { lastSwitch?: Switch }).lastSwitch ?? null
    } catch {}
  }
  events.onEventAnyClient('CLIENT->MAIN::user-action', (e) => {
    if (e.action !== 'paste-in-chat' || !e.text.startsWith('/itemfilter ')) return
    const name = e.text.slice('/itemfilter '.length).trim()
    ;(async () => {
      await loadState()
      const configFile = await findGameConfigFile()
      const iniValue = configFile ? await readIniFilter(configFile) : null
      lastSwitch = { name, time: Date.now(), iniValue }
      await fs.mkdir(aptData, { recursive: true })
      await fs.writeFile(statePath, JSON.stringify({ lastSwitch }), 'utf-8')
    })().catch(() => {})
  })

  async function readIniFilter (configFile: string): Promise<string | null> {
    const cfgText = stripBom(await fs.readFile(configFile, 'utf-8'))
    const parsed = ini.parse(cfgText) as Record<string, Record<string, unknown>>
    for (const section of Object.values(parsed)) {
      if (section && typeof section === 'object' && typeof section.item_filter === 'string') {
        return section.item_filter
      }
    }
    return null
  }

  async function findLogFile () {
    const known = getLogPath()
    if (known) return known
    // log path not configured and not in a default location: ask the running game
    logFromProcess ??= await poeLogFromProcess()
    return logFromProcess
  }

  async function findGameConfigFile () {
    return gameConfig.actualPath ?? await guessFileLocation(GAME_CONFIG_POSSIBLE_PATH)
  }

  async function readFile (filePath: string) {
    const stat = await fs.stat(filePath)
    if (!stat.isFile()) throw new Error(`Not a file: ${filePath}`)
    return { path: filePath, contents: stripBom(await fs.readFile(filePath, 'utf-8')), mtime: stat.mtimeMs }
  }

  async function tryReadFile (filePath: string) {
    try { return await readFile(filePath) } catch { return null }
  }

  async function classify (filterDir: string, file: FileData): Promise<LootFilterInfo> {
    const isOnlineCache = path.basename(path.dirname(file.path)).toLowerCase() === 'onlinefilters'
    if (isOnlineCache) {
      const id = path.basename(file.path)
      const name = headerValue(file.contents, 'name') ?? id
      return { filterDir, kind: 'online', name, ...file, source: { kind: 'online', id, name, ...file } }
    }

    const name = path.basename(file.path).replace(/\.filter$/i, '')
    if (file.contents.startsWith(MANAGED_HEADER)) {
      const header = file.contents.slice(0, 500)
      let source: LootFilterSource | null = null
      const online = /source=online:(\S+)/.exec(header)?.[1]
      const local = /source=local:(\S+)/.exec(header)?.[1]
      if (online) {
        const data = await tryReadFile(path.join(filterDir, 'OnlineFilters', online))
        if (data) source = { kind: 'online', id: online, name: headerValue(data.contents, 'name') ?? online, ...data }
      } else if (local) {
        const localName = decodeURIComponent(local)
        const data = await tryReadFile(path.join(filterDir, `${localName}.filter`))
        if (data) source = { kind: 'local', id: localName, name: localName, ...data }
      }
      return { filterDir, kind: 'managed', name, ...file, source }
    }
    return { filterDir, kind: 'local', name, ...file, source: { kind: 'local', id: name, name, ...file } }
  }

  async function getActiveFilter (overridePath: string | null): Promise<LootFilterInfo> {
    const configFile = await findGameConfigFile()
    if (!configFile) {
      throw new Error('Game config file (production_Config.ini) not found. Set it in Settings → General.')
    }
    const filterDir = path.dirname(configFile)

    if (overridePath) {
      return await classify(filterDir, await readFile(overridePath))
    }

    await loadState()
    const iniValue = await readIniFilter(configFile)
    const iniTime = (await fs.stat(configFile)).mtimeMs
    const onlineLoad = lastOnlineFilterLoad(await readLogTail(await findLogFile()))

    // the most recent of: config (if it changed after our last switch), our last `/itemfilter`,
    // the last online filter loaded by the game
    const candidates: Array<{ name: string, time: number }> = []
    if (iniValue) {
      const unchangedSinceSwitch = lastSwitch != null && lastSwitch.iniValue === iniValue
      candidates.push({ name: iniValue, time: unchangedSinceSwitch ? 0 : iniTime })
    }
    if (lastSwitch) candidates.push({ name: lastSwitch.name, time: lastSwitch.time })
    // log timestamps have 1s precision
    if (onlineLoad) candidates.push({ name: onlineLoad.id, time: onlineLoad.time + 999 })
    candidates.sort((a, b) => b.time - a.time)

    if (!candidates.length) {
      throw new Error('No item filter is selected in the game options.')
    }
    for (const { name } of candidates) {
      const file = await resolveFilter(filterDir, name)
      if (file) return await classify(filterDir, file)
    }
    throw new Error(`Filter "${candidates[0].name}" was not found in "${filterDir}". If it is an online filter, press the refresh button next to it in the game options.`)
  }

  // `name` is a local file name (with or without .filter), an online filter id, or an online filter name
  async function resolveFilter (filterDir: string, name: string) {
    const onlineDir = path.join(filterDir, 'OnlineFilters')
    const candidates = [
      path.join(onlineDir, name),
      path.join(filterDir, name),
      path.join(filterDir, `${name}.filter`)
    ]
    const allowedDirs = [path.resolve(filterDir), path.resolve(onlineDir)].map(d => d.toLowerCase())
    for (const candidate of candidates) {
      // the name comes from a config file / chat command, don't let it point outside the filter folder
      if (!allowedDirs.includes(path.dirname(path.resolve(candidate)).toLowerCase())) continue
      const file = await tryReadFile(candidate)
      if (file) return file
    }
    // `/itemfilter <online filter name>`: find the cached online filter by its `#name:`
    let entries: string[] = []
    try { entries = await fs.readdir(onlineDir) } catch {}
    for (const entry of entries) {
      const file = await tryReadFile(path.join(onlineDir, entry))
      if (file && headerValue(file.contents, 'name') === name) return file
    }
    return null
  }

  async function loadRules () {
    try {
      return JSON.parse(await fs.readFile(rulesPath, 'utf-8')) as unknown
    } catch {
      return {}
    }
  }

  async function saveRules (rules: unknown) {
    await fs.mkdir(aptData, { recursive: true })
    const tmp = `${rulesPath}.tmp`
    await fs.writeFile(tmp, JSON.stringify(rules, null, 2), 'utf-8')
    await fs.rename(tmp, rulesPath)
    return {}
  }

  async function saveFilter (body: { path: string, contents: string, expectedMtime?: number }) {
    const configFile = await findGameConfigFile()
    if (!configFile) throw new Error('Game config file not found.')
    const filterDir = path.resolve(path.dirname(configFile))

    const target = path.resolve(body.path)
    if (path.dirname(target).toLowerCase() !== filterDir.toLowerCase() ||
        !target.toLowerCase().endsWith('.filter')) {
      throw new Error('Only .filter files in the game\'s filter folder can be written.')
    }

    let oldContents: string | null = null
    try {
      const stat = await fs.stat(target)
      if (body.expectedMtime != null && Math.abs(stat.mtimeMs - body.expectedMtime) > 1) {
        throw new Error('The filter file was changed by another program. Reopen the widget and try again.')
      }
      oldContents = await fs.readFile(target, 'utf-8')
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
    }

    if (oldContents != null) {
      await fs.mkdir(backupsPath, { recursive: true })
      const stamp = new Date().toISOString().replace(/[:.]/g, '-')
      await fs.writeFile(path.join(backupsPath, `${stamp} ${path.basename(target)}`), oldContents, 'utf-8')
      await pruneBackups()
    }

    await fs.writeFile(target, body.contents, 'utf-8')
    const stat = await fs.stat(target)
    logger.write(`info [LootFilter] Saved "${target}".`)
    return { path: target, mtime: stat.mtimeMs }
  }

  async function exportChanges (body: { fileName: string, text: string }) {
    if (typeof body.text !== 'string' || typeof body.fileName !== 'string') throw new Error('Bad request')
    // only a plain file name, always .txt
    let name = path.basename(body.fileName).replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim()
    if (!name.toLowerCase().endsWith('.txt')) name += '.txt'
    if (name === '.txt') name = 'APT changes.txt'
    const dir = app.getPath('downloads')
    await fs.mkdir(dir, { recursive: true })
    const target = path.join(dir, name)
    // BOM: Notepad and other editors detect UTF-8 (item names, Russian text)
    await fs.writeFile(target, '﻿' + body.text, 'utf-8')
    logger.write(`info [LootFilter] Saved the list of changes "${target}".`)
    const { shell } = await import('electron')
    shell.showItemInFolder(target)
    await shell.openPath(target)
    return { path: target }
  }

  async function pruneBackups () {
    const files = (await fs.readdir(backupsPath)).sort()
    for (const file of files.slice(0, Math.max(0, files.length - MAX_BACKUPS))) {
      await fs.rm(path.join(backupsPath, file), { force: true })
    }
  }

  server.addListener('request', (req, res) => {
    if (!req.url?.startsWith('/loot-filter/')) return

    // filter files are written to disk: never allow this from other machines (see `--listen`)
    const remote = req.socket.remoteAddress ?? ''
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote)) {
      res.statusCode = 403
      res.end()
      return
    }

    const url = new URL(req.url, 'http://localhost')
    if (req.method === 'GET' && url.pathname === '/loot-filter/active') {
      respond(res, async () => ({
        ...await getActiveFilter(url.searchParams.get('path') || null),
        areaLevel: lastAreaLevel(await readLogTail(await findLogFile()))
      }))
    } else if (req.method === 'POST' && url.pathname === '/loot-filter/save') {
      readJson(req)
        .then(body => respond(res, () => saveFilter(body as Parameters<typeof saveFilter>[0])))
        .catch(e => respond(res, () => Promise.reject(e)))
    } else if (req.method === 'GET' && url.pathname === '/loot-filter/sounds') {
      // custom alert sounds: audio files in the filter folder
      respond(res, async () => {
        const configFile = await findGameConfigFile()
        if (!configFile) return []
        const entries = await fs.readdir(path.dirname(configFile))
        return entries.filter(name => SOUND_EXT.test(name)).sort((a, b) => a.localeCompare(b))
      })
    } else if (req.method === 'GET' && url.pathname === '/loot-filter/sound') {
      (async () => {
        const configFile = await findGameConfigFile()
        const name = url.searchParams.get('name') ?? ''
        // only a file name from the filter folder
        if (!configFile || !name || name !== path.basename(name) || !SOUND_EXT.test(name)) throw new Error('bad name')
        const filePath = path.join(path.dirname(configFile), name)
        const data = await fs.readFile(filePath)
        res.setHeader('content-type', soundType(name))
        res.end(data)
      })().catch(() => {
        res.statusCode = 404
        res.end()
      })
    } else if (req.method === 'GET' && url.pathname === '/loot-filter/builtin-sound') {
      // built-in alert sounds 1..16 are inside the game archives; the files hosted by FilterBlade
      // are downloaded on first use and kept in the app data (not shipped with the app)
      (async () => {
        const id = Number(url.searchParams.get('id'))
        if (!Number.isInteger(id) || id < 1 || id > 16) throw new Error('bad id')
        const dir = path.join(aptData, 'alert-sounds')
        const file = path.join(dir, `AlertSound${id}.mp3`)
        let data: Buffer
        try {
          data = await fs.readFile(file)
        } catch {
          const resp = await fetch(`https://www.filterblade.xyz/assets/sounds/AlertSound${id}.mp3`)
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
          data = Buffer.from(await resp.arrayBuffer())
          await fs.mkdir(dir, { recursive: true })
          await fs.writeFile(file, data)
        }
        res.setHeader('content-type', 'audio/mpeg')
        res.end(data)
      })().catch(() => {
        res.statusCode = 404
        res.end()
      })
    } else if (req.method === 'GET' && url.pathname === '/loot-filter/stat') {
      respond(res, async () => {
        const stat = await fs.stat(url.searchParams.get('path')!)
        return { mtime: stat.mtimeMs }
      })
    } else if (req.method === 'GET' && url.pathname === '/loot-filter/rules') {
      respond(res, () => loadRules())
    } else if (req.method === 'POST' && url.pathname === '/loot-filter/rules') {
      readJson(req)
        .then(body => respond(res, () => saveRules(body)))
        .catch(e => respond(res, () => Promise.reject(e)))
    } else if (req.method === 'POST' && url.pathname === '/loot-filter/export-changes') {
      // list of the user's changes: saved to Downloads and opened in the default text editor
      readJson(req)
        .then(body => respond(res, () => exportChanges(body as { fileName: string, text: string })))
        .catch(e => respond(res, () => Promise.reject(e)))
    } else if (req.method === 'POST' && url.pathname === '/loot-filter/open-backups') {
      respond(res, async () => {
        await fs.mkdir(backupsPath, { recursive: true })
        const { shell } = await import('electron')
        await shell.openPath(backupsPath)
        return {}
      })
    } else {
      res.statusCode = 404
      res.end()
    }
  })
}

function respond (res: ServerResponse, fn: () => Promise<unknown>) {
  res.setHeader('content-type', 'application/json')
  fn().then(data => {
    res.end(JSON.stringify({ ok: true, data }))
  }).catch((e: unknown) => {
    res.end(JSON.stringify({ ok: false, error: (e instanceof Error) ? e.message : String(e) }))
  })
}

function readJson (req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > 32_000_000) {
        reject(new Error('Request is too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.once('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8'))) } catch (e) { reject(e) }
    })
    req.once('error', reject)
  })
}

function headerValue (contents: string, key: string): string | null {
  const m = new RegExp(`^#${key}:(.*)$`, 'm').exec(contents.slice(0, 2000))
  return m ? m[1].trim() : null
}

const SOUND_EXT = /\.(mp3|wav|ogg|mpeg|flac|m4a)$/i

function soundType (name: string) {
  const ext = name.toLowerCase().split('.').pop()
  return ext === 'wav' ? 'audio/wav' : ext === 'ogg' ? 'audio/ogg' : ext === 'flac' ? 'audio/flac' : ext === 'm4a' ? 'audio/mp4' : 'audio/mpeg'
}

function stripBom (text: string) {
  return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text
}
