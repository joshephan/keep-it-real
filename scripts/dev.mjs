import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { createServer } from 'vite'
import { runElectron } from './electron.mjs'

/**
 * Dev runner: owns the Vite server in this process, then launches Electron
 * against whatever port Vite actually got. Because the server is not a detached
 * grandchild, closing this process always frees the port — no zombie servers,
 * no "Port 5173 is already in use" on the next run.
 */

const require = createRequire(import.meta.url)

// The main process is plain CommonJS on disk, so compile it before launching.
const tsc = spawnSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', 'tsconfig.electron.json'], {
  stdio: 'inherit',
})
if (tsc.status !== 0) process.exit(tsc.status ?? 1)

// strictPort off: if something else holds 5173, take the next free port instead
// of failing, and tell Electron where we actually landed.
const server = await createServer({ server: { strictPort: false } })
await server.listen()
server.printUrls()

const url = server.resolvedUrls?.local?.[0]
if (!url) {
  console.error('[keep-it-real] Vite did not report a local URL')
  await server.close()
  process.exit(1)
}

const child = runElectron(['--dev'], { KIR_DEV_SERVER_URL: url })

let closing = false
const shutdown = async (code = 0) => {
  if (closing) return
  closing = true
  await server.close().catch(() => {})
  process.exit(code)
}

child.on('close', (code) => {
  console.log(`[keep-it-real] Electron exited (code ${code ?? 0}) — stopping the dev server`)
  void shutdown(code ?? 0)
})
process.on('SIGINT', () => {
  child.kill()
  void shutdown(0)
})
process.on('SIGTERM', () => {
  child.kill()
  void shutdown(0)
})
