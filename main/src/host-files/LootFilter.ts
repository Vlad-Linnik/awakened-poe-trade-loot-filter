import fs from 'fs/promises'
import path from 'path'
import ini from 'ini'
import { app } from 'electron'
import type { Server, IncomingMessage, ServerResponse } from 'http'
import { guessFileLocation, poeLogFromProcess } from './utils'
import { GAME_CONFIG_POSSIBLE_PATH, type GameConfig } from './GameConfig'
import type { Logger } from '../RemoteLogger'

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

// Area level is not in the item text: take the last generated area from Client.txt
async function lastAreaLevel (logPath: string | null): Promise<number | null> {
  if (!logPath) return null
  let file: fs.FileHandle | null = null
  try {
    file = await fs.open(logPath, 'r')
    const { size } = await file.stat()
    const length = Math.min(size, 1024 * 1024)
    const buf = Buffer.alloc(length)
    await file.read(buf, 0, length, size - length)
    const text = buf.toString('utf-8')
    const re = /Generating level (\d+) area "/g
    let last: number | null = null
    for (const m of text.matchAll(re)) last = Number(m[1])
    return last
  } catch {
    return null
  } finally {
    await file?.close()
  }
}

export function addLootFilterRoutes (server: Server, gameConfig: GameConfig, logger: Logger, getLogPath: () => string | null) {
  const aptData = path.join(app.getPath('userData'), 'apt-data')
  const backupsPath = path.join(aptData, 'filter-backups')
  const rulesPath = path.join(aptData, 'loot-filter-rules.json')
  let logFromProcess: string | null = null

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

    const cfgText = stripBom(await fs.readFile(configFile, 'utf-8'))
    const parsed = ini.parse(cfgText) as Record<string, Record<string, unknown>>
    let filterName: string | null = null
    for (const section of Object.values(parsed)) {
      if (section && typeof section === 'object' && typeof section.item_filter === 'string') {
        filterName = section.item_filter
        break
      }
    }
    if (!filterName) {
      throw new Error('No item filter is selected in the game options.')
    }

    // online filters are selected by id: `item_filter=Wa42ZyUE` -> OnlineFilters/Wa42ZyUE
    const candidates = [
      path.join(filterDir, 'OnlineFilters', filterName),
      path.join(filterDir, filterName),
      path.join(filterDir, `${filterName}.filter`)
    ]
    const allowedDirs = [path.resolve(filterDir), path.resolve(filterDir, 'OnlineFilters')].map(d => d.toLowerCase())
    for (const candidate of candidates) {
      // the name comes from a config file, don't let it point outside the filter folder
      if (!allowedDirs.includes(path.dirname(path.resolve(candidate)).toLowerCase())) continue
      const file = await tryReadFile(candidate)
      if (file) return await classify(filterDir, file)
    }

    throw new Error(`Filter "${filterName}" was not found in "${filterDir}". If it is an online filter, press the refresh button next to it in the game options.`)
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
        areaLevel: await lastAreaLevel(await findLogFile())
      }))
    } else if (req.method === 'POST' && url.pathname === '/loot-filter/save') {
      readJson(req)
        .then(body => respond(res, () => saveFilter(body as Parameters<typeof saveFilter>[0])))
        .catch(e => respond(res, () => Promise.reject(e)))
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

function stripBom (text: string) {
  return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text
}
