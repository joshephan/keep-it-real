import { app, dialog, type BrowserWindow } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * The two native file dialogs behind Settings → Data. The renderer never sees a
 * path it did not pick here: it hands over a string to write, or gets one back.
 */

export type BackupSaveResult =
  | { status: 'saved'; path: string }
  | { status: 'canceled' }
  | { status: 'failed' }

export type BackupOpenResult =
  | { status: 'opened'; text: string; name: string }
  | { status: 'canceled' }
  | { status: 'failed' }

const FILTERS = [{ name: 'Keep It Real backup', extensions: ['json'] }]

/** A whole store is a few hundred KB at worst; past this it is not one of ours. */
const MAX_IMPORT_BYTES = 32 * 1024 * 1024

function defaultDir(): string {
  try {
    return app.getPath('documents')
  } catch {
    // Not every desktop defines a documents folder; the dialog picks its own.
    return app.getPath('userData')
  }
}

export async function saveBackup(
  win: BrowserWindow | null,
  json: string,
  suggestedName: string,
): Promise<BackupSaveResult> {
  try {
    // basename() so the renderer's suggestion can only ever name a file.
    const name = path.basename(suggestedName) || 'keep-it-real.json'
    const options = { defaultPath: path.join(defaultDir(), name), filters: FILTERS }
    const result = win
      ? await dialog.showSaveDialog(win, options)
      : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) return { status: 'canceled' }
    await fs.writeFile(result.filePath, json, 'utf8')
    return { status: 'saved', path: result.filePath }
  } catch (err) {
    console.error('[keep-it-real] export failed:', err)
    return { status: 'failed' }
  }
}

export async function openBackup(win: BrowserWindow | null): Promise<BackupOpenResult> {
  try {
    const options = {
      filters: FILTERS,
      properties: ['openFile' as const],
    }
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    const file = result.filePaths[0]
    if (result.canceled || !file) return { status: 'canceled' }

    const stat = await fs.stat(file)
    if (stat.size > MAX_IMPORT_BYTES) return { status: 'failed' }

    // Parsing stays in the renderer, which owns the store's shape.
    return { status: 'opened', text: await fs.readFile(file, 'utf8'), name: path.basename(file) }
  } catch (err) {
    console.error('[keep-it-real] import failed:', err)
    return { status: 'failed' }
  }
}
