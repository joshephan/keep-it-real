import { useCallback, useState } from 'react'
import type { PersistedState } from '../types'
import { bridge } from '../lib/storage'
import { backupFileName, liveItemCount, parseBackup, serializeBackup } from '../lib/backup'
import { toPersisted } from '../state/reducer'
import { useApp } from '../state/AppContext'

/**
 * Export writes the whole store to a file the user picks; import reads one back.
 * Under Electron both go through the main process's native dialogs; in the
 * browser dev build they fall back to a download and a file input.
 *
 * Import never applies straight away — a picked file is held as `pending` until
 * the user confirms, because it replaces everything currently in the app.
 */

export type BackupStatus =
  | { kind: 'exported' }
  | { kind: 'imported'; items: number }
  /** The file parsed, but it is not a Keep It Real store. */
  | { kind: 'invalid' }
  | { kind: 'failed' }
  | null

export interface PendingImport {
  state: PersistedState
  name: string
  items: number
}

export function useBackup() {
  const { state, dispatch, today } = useApp()
  const [status, setStatus] = useState<BackupStatus>(null)
  const [pending, setPending] = useState<PendingImport | null>(null)
  const [busy, setBusy] = useState(false)

  const exportNow = useCallback(async () => {
    if (busy) return
    setBusy(true)
    setStatus(null)
    setPending(null)
    const json = serializeBackup(toPersisted(state), today)
    const name = backupFileName(today)
    try {
      const api = bridge()?.backup
      if (api) {
        const result = await api.save(json, name)
        // A cancelled dialog is not a failure, and says nothing worth showing.
        if (result.status === 'saved') setStatus({ kind: 'exported' })
        else if (result.status === 'failed') setStatus({ kind: 'failed' })
      } else {
        downloadInBrowser(json, name)
        setStatus({ kind: 'exported' })
      }
    } catch {
      setStatus({ kind: 'failed' })
    } finally {
      setBusy(false)
    }
  }, [state, today, busy])

  const pick = useCallback(async () => {
    if (busy) return
    setBusy(true)
    setStatus(null)
    setPending(null)
    try {
      const api = bridge()?.backup
      const file = api ? await api.open() : await pickInBrowser()
      if (file.status === 'canceled') return
      if (file.status === 'failed') {
        setStatus({ kind: 'failed' })
        return
      }
      const parsed = parseBackup(file.text)
      if (!parsed) {
        setStatus({ kind: 'invalid' })
        return
      }
      setPending({ state: parsed, name: file.name, items: liveItemCount(parsed) })
    } catch {
      setStatus({ kind: 'failed' })
    } finally {
      setBusy(false)
    }
  }, [busy])

  const confirm = useCallback(() => {
    if (!pending) return
    dispatch({ type: 'importState', payload: pending.state })
    setStatus({ kind: 'imported', items: pending.items })
    setPending(null)
  }, [pending, dispatch])

  const cancel = useCallback(() => setPending(null), [])

  return { status, pending, busy, exportNow, pick, confirm, cancel }
}

/** Browser fallback for export: hand the file to the download manager. */
function downloadInBrowser(json: string, name: string): void {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

type PickedFile = { status: 'opened'; text: string; name: string } | { status: 'canceled' }

/** Browser fallback for import: a throwaway file input, resolved on change. */
function pickInBrowser(): Promise<PickedFile> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json'
    // Dismissing the picker fires no event in older browsers; `cancel` covers
    // the ones that do, and the promise simply never settles otherwise.
    input.addEventListener('cancel', () => resolve({ status: 'canceled' }))
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (!file) {
        resolve({ status: 'canceled' })
        return
      }
      void file.text().then((text) => resolve({ status: 'opened', text, name: file.name }))
    })
    input.click()
  })
}
