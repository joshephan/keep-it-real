import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

/**
 * The MCP server edits the very same JSON file the desktop app writes, so it has
 * to resolve Electron's userData directory without Electron. The rules below are
 * what `app.getPath('userData')` resolves to for productName "Keep It Real".
 *
 * Every call is a fresh read-modify-write: the app may have saved in between, and
 * nothing here is allowed to be based on a stale copy.
 */

const APP_NAME = 'Keep It Real'
const FILE_NAME = 'keep-it-real.json'

function userDataDir() {
  const home = os.homedir()
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), APP_NAME)
  }
  if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', APP_NAME)
  }
  return path.join(process.env.XDG_CONFIG_HOME || path.join(home, '.config'), APP_NAME)
}

/** `KIR_STORE_PATH` points the server at another file — used by the tests, and by
 *  anyone keeping their store somewhere else. */
export function storePath() {
  return process.env.KIR_STORE_PATH || path.join(userDataDir(), FILE_NAME)
}

/** Mirrors `src/lib/categories.ts`; only used when there is no store file yet. */
export const BUILTIN_LABELS = {
  work: { ko: '일', en: 'Work' },
  health: { ko: '건강', en: 'Health' },
  life: { ko: '생활', en: 'Life' },
  study: { ko: '공부', en: 'Study' },
  etc: { ko: '기타', en: 'Other' },
}

const DEFAULT_COLORS = {
  work: '#B5442E',
  health: '#2E6B63',
  life: '#6B4A6E',
  study: '#A2761F',
  etc: '#4B535C',
}

export const DEFAULT_CATEGORIES = Object.keys(BUILTIN_LABELS).map((id) => ({
  id,
  name: null,
  color: DEFAULT_COLORS[id],
}))

export function emptyStore() {
  return {
    version: 1,
    items: [],
    cats: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
  }
}

/**
 * Returns the parsed file as-is. Keys this server does not understand (view,
 * colScale, showDiff, …) ride along untouched so writing back never drops a
 * setting the app owns.
 */
export async function readStore() {
  let raw
  try {
    raw = await fs.readFile(storePath(), 'utf8')
  } catch (err) {
    if (err.code === 'ENOENT') return emptyStore()
    throw err
  }
  const parsed = JSON.parse(raw)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return emptyStore()
  return parsed
}

/** Atomic like the app's own writer, but through its own tmp name so the two
 *  processes can never land on the same temporary file. */
export async function writeStore(store) {
  const target = storePath()
  const tmp = `${target}.mcp.tmp`
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(tmp, JSON.stringify(store, null, 2), 'utf8')
  await fs.rename(tmp, target)
}
