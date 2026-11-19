import fs from 'fs/promises'
import path from 'path'

// Steam libraries on other drives, e.g. "D:\SteamLibrary" (Windows only)
export async function steamLibraries (): Promise<string[]> {
  if (process.platform !== 'win32') return []
  const roots = [
    'C:\\Program Files (x86)\\Steam',
    'C:\\Program Files\\Steam'
  ]
  const out = new Set<string>()
  for (const root of roots) {
    try {
      const vdf = await fs.readFile(path.join(root, 'steamapps', 'libraryfolders.vdf'), 'utf-8')
      for (const m of vdf.matchAll(/"path"\s+"([^"]+)"/g)) {
        // vdf escapes backslashes: "D:\\SteamLibrary"
        out.add(m[1].replace(/\\\\/g, '\\'))
      }
    } catch {}
  }
  return [...out]
}

export async function guessFileLocation (entries: Iterable<string>): Promise<string | null> {
  let found: string | null = null
  for (const path of entries) {
    try {
      await fs.access(path, fs.constants.R_OK)
      if (found != null) {
        // don't allow multiple matches (i.e. standalone + Steam)
        return null
      } else {
        found = path
      }
    } catch {}
  }
  return found
}

// Client.txt next to the running game, wherever it is installed (standalone, Steam, Epic)
export async function poeLogFromProcess (): Promise<string | null> {
  if (process.platform !== 'win32') return null
  const { execFile } = await import('child_process')
  const exePaths = await new Promise<string[]>((resolve) => {
    execFile('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-Command',
      "Get-Process -Name 'PathOfExile*' -ErrorAction SilentlyContinue | ForEach-Object { $_.Path }"
    ], { timeout: 8000, windowsHide: true }, (err, stdout) => {
      resolve(err ? [] : stdout.split(/\r?\n/).map(s => s.trim()).filter(Boolean))
    })
  })
  for (const exe of exePaths) {
    // skip Path of Exile 2
    if (/Path of Exile 2/i.test(exe)) continue
    const logPath = path.join(path.dirname(exe), 'logs', 'Client.txt')
    try {
      await fs.access(logPath, fs.constants.R_OK)
      return logPath
    } catch {}
  }
  return null
}
