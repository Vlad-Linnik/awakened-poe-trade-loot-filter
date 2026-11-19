// @ts-check
import child_process from 'child_process'
import electron from 'electron'
import esbuild from 'esbuild'

const isDev = !process.argv.includes('--prod')

const electronRunner = (() => {
  /** @type {child_process.ChildProcess | null} */
  let handle = null
  return {
    restart () {
      console.info('Restarting Electron process.')

      if (handle) handle.kill()
      const args = ['.']
      if (process.platform === 'linux') {
        args.unshift('--ozone-platform', 'x11')
      }
      handle = child_process.spawn(String(electron), args, {
        stdio: 'inherit'
      })
    }
  }
})()

const visionBuild = await esbuild.build({
  entryPoints: ['src/vision/link-worker.ts'],
  bundle: true,
  platform: 'node',
  outfile: 'dist/vision.js'
})

const mainContext = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  minify: !isDev,
  platform: 'node',
  external: ['electron', 'uiohook-napi', 'electron-overlay-window'],
  outfile: 'dist/main.js',
  define: {
    'process.env.STATIC': (isDev) ? '"../build/icons"' : '"."',
    'process.env.VITE_DEV_SERVER_URL': (isDev) ? '"http://localhost:5173"' : 'null',
    // "owner/repo" of the fork that publishes releases with the loot filter editor (set by CI)
    'process.env.APT_UPDATES_REPO': JSON.stringify(process.env.APT_UPDATES_REPO ?? '')
  },
  plugins: (isDev) ? [{
    name: 'electron-runner',
    setup (build) {
      build.onEnd((result) => {
        if (!result.errors.length) electronRunner.restart()
      })
    }
  }] : []
})

if (isDev) {
  await mainContext.watch()
} else {
  await mainContext.rebuild()
  mainContext.dispose()
}
