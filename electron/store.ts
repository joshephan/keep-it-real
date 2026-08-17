import { app } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * Single-file JSON store in the OS user-data directory.
 * Writes are atomic (tmp file + rename) and serialized through a promise
 * queue so overlapping saves can never interleave.
 */

const FILE_NAME = 'keep-it-real.json'

function filePath(): string {
  return path.join(app.getPath('userData'), FILE_NAME)
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

export function saveState(data: unknown): Promise<void> {
  queue = queue.then(async () => {
    const target = filePath()
    const tmp = `${target}.tmp`
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8')
    await fs.rename(tmp, target)
  })
  return queue.catch((err) => {
    console.error('[keep-it-real] failed to write store:', err)
  })
}

export function storePath(): string {
  return filePath()
}
