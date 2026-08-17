import { app } from 'electron'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'

/**
 * Single-file JSON store in the OS user-data directory.
 * Writes are atomic (tmp file + rename) and serialized through a promise
 * queue so overlapping saves can never interleave.
 */

const FILE_NAME = 'keep-it-real.json'

/** `KIR_STORE_PATH` moves the store somewhere else; the MCP server reads the same
 *  variable, so the two always end up on one file. */
function filePath(): string {
  return process.env.KIR_STORE_PATH || path.join(app.getPath('userData'), FILE_NAME)
}

export async function loadState(): Promise<unknown | null> {
  try {
    const raw = await fs.readFile(filePath(), 'utf8')
    return JSON.parse(raw)
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT') return null
    // Corrupt file: keep a copy so nothing is silently lost, then start clean.
    if (err instanceof SyntaxError) {
      try {
        await fs.rename(filePath(), `${filePath()}.corrupt`)
      } catch {
        /* best effort */
      }
      return null
    }
    console.error('[keep-it-real] failed to read store:', err)
    return null
  }
}

let queue: Promise<void> = Promise.resolve()

/** The last thing this process wrote, so its own saves can be told apart from
 *  someone else's edit of the same file. */
let lastWritten: string | null = null

export function saveState(data: unknown): Promise<void> {
  queue = queue.then(async () => {
    const target = filePath()
    const tmp = `${target}.tmp`
    const json = JSON.stringify(data, null, 2)
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(tmp, json, 'utf8')
    await fs.rename(tmp, target)
    lastWritten = json
  })
  return queue.catch((err) => {
    console.error('[keep-it-real] failed to write store:', err)
  })
}

export function storePath(): string {
  return filePath()
}

const WATCH_DEBOUNCE_MS = 150

/**
 * Anything else may edit the same file while a window is open — the MCP server,
 * an editor, a file sync. Without this the window would keep its stale copy and
 * bury those edits on its next save.
 *
 * The directory is watched rather than the file: every writer here replaces the
 * file by renaming a temporary one over it, which leaves a file watch pointing
 * at an inode nobody writes to again.
 */
export function watchStore(onExternalChange: () => void): void {
  const target = filePath()
  const dir = path.dirname(target)
  // Not FILE_NAME: KIR_STORE_PATH may have renamed the file out from under it.
  const name = path.basename(target)

  let timer: NodeJS.Timeout | null = null

  const check = async (): Promise<void> => {
    try {
      const content = await fs.readFile(target, 'utf8')
      if (content === lastWritten) return // our own save coming back around
      lastWritten = content
      onExternalChange()
    } catch {
      // Gone or half-written: the next event settles it.
    }
  }

  try {
    fsSync.mkdirSync(dir, { recursive: true })
    fsSync.watch(dir, (_event, changed) => {
      if (changed && changed !== name) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => void check(), WATCH_DEBOUNCE_MS)
    })
  } catch (err) {
    // Not every filesystem supports watching; the app just loses live reload.
    console.error('[keep-it-real] could not watch the store directory:', err)
  }
}
