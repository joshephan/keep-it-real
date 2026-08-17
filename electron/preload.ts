import { contextBridge, ipcRenderer } from 'electron'
import type { BackupOpenResult, BackupSaveResult } from './backup'

export type WindowAction = 'minimize' | 'toggle-maximize' | 'close'

const api = {
  isElectron: true as const,
  load: (): Promise<unknown | null> => ipcRenderer.invoke('kir:load'),
  save: (data: unknown): Promise<void> => ipcRenderer.invoke('kir:save', data),
  storePath: (): Promise<string> => ipcRenderer.invoke('kir:store-path'),
  window: (action: WindowAction): void => ipcRenderer.send('kir:window', action),
  /** Fires when the store file was changed by something other than this window. */
  onExternalChange: (listener: () => void): (() => void) => {
    const handler = (): void => listener()
    ipcRenderer.on('kir:external-change', handler)
    return () => ipcRenderer.removeListener('kir:external-change', handler)
  },
  autostart: {
    get: (): Promise<AutostartState> => ipcRenderer.invoke('kir:autostart-get'),
    set: (enabled: boolean): Promise<AutostartState> => ipcRenderer.invoke('kir:autostart-set', enabled),
  },
  /** Export and import, each behind the OS file dialog the main process owns. */
  backup: {
    save: (json: string, suggestedName: string): Promise<BackupSaveResult> =>
      ipcRenderer.invoke('kir:backup-save', json, suggestedName),
    open: (): Promise<BackupOpenResult> => ipcRenderer.invoke('kir:backup-open'),
  },
}

interface AutostartState {
  supported: boolean
  enabled: boolean
}

contextBridge.exposeInMainWorld('keepItReal', api)

export type KeepItRealApi = typeof api
