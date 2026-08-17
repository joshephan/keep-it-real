import { contextBridge, ipcRenderer } from 'electron'

export type WindowAction = 'minimize' | 'toggle-maximize' | 'close'

const api = {
  isElectron: true as const,
  load: (): Promise<unknown | null> => ipcRenderer.invoke('kir:load'),
  save: (data: unknown): Promise<void> => ipcRenderer.invoke('kir:save', data),
  storePath: (): Promise<string> => ipcRenderer.invoke('kir:store-path'),
  window: (action: WindowAction): void => ipcRenderer.send('kir:window', action),
  autostart: {
    get: (): Promise<AutostartState> => ipcRenderer.invoke('kir:autostart-get'),
    set: (enabled: boolean): Promise<AutostartState> => ipcRenderer.invoke('kir:autostart-set', enabled),
  },
}

interface AutostartState {
  supported: boolean
  enabled: boolean
}

contextBridge.exposeInMainWorld('keepItReal', api)

export type KeepItRealApi = typeof api
