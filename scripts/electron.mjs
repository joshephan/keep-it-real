import { spawn } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import electronModule from 'electron'

/**
 * Launches the Electron binary.
 *
 * Terminals spawned by VS Code (and other Electron hosts) inherit
 * ELECTRON_RUN_AS_NODE=1, which makes the binary boot as plain Node — the app
 * then crashes with "Cannot read properties of undefined (reading 'isPackaged')".
 * Stripping those two variables here makes `npm run dev` work in any terminal.
 */
export function runElectron(args = [], extraEnv = {}) {
  const binary = typeof electronModule === 'string' ? electronModule : electronModule.default

  const env = { ...process.env, ...extraEnv }
  delete env.ELECTRON_RUN_AS_NODE
  delete env.ELECTRON_NO_ATTACH_CONSOLE

  return spawn(binary, ['.', ...args], { stdio: 'inherit', env })
}

// `node scripts/electron.mjs [...args]` runs the app directly.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const child = runElectron(process.argv.slice(2))
  child.on('close', (code) => process.exit(code ?? 0))
}
