import { app, BrowserWindow, ipcMain, session, shell, type WebContents } from 'electron'
import path from 'node:path'
import { loadState, saveState, storePath } from './store'
import { getAutostart, setAutostart } from './autostart'

// scripts/dev.mjs passes --dev and the port Vite actually bound to; every other
// launch loads the built bundle from disk.
const DEV_SERVER_URL = process.env.KIR_DEV_SERVER_URL ?? 'http://127.0.0.1:5173'
const isDev = !app.isPackaged && process.argv.includes('--dev')

let win: BrowserWindow | null = null

/** One step is a 1.2x change; the clamp keeps the two fixed bars usable. */
const ZOOM_STEP = 0.5
const ZOOM_MIN = -2.5
const ZOOM_MAX = 3

function zoomBy(contents: WebContents, delta: number): void {
  const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, contents.getZoomLevel() + delta))
  contents.setZoomLevel(next)
}

/**
 * Zoom is handled here rather than left to the default menu. The menu's zoom-in
 * accelerator is Ctrl+Plus, which needs Shift on most layouts, so Ctrl+= (what
 * people actually press) did nothing while Ctrl+- worked. preventDefault also
 * stops the menu accelerator, so each press applies exactly one step.
 */
function attachZoomShortcuts(contents: WebContents): void {
  contents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || input.alt) return
    if (!input.control && !input.meta) return

    const zoomIn = input.code === 'Equal' || input.code === 'NumpadAdd' || input.key === '+'
    const zoomOut = input.code === 'Minus' || input.code === 'NumpadSubtract' || input.key === '-'
    const reset = input.code === 'Digit0' || input.code === 'Numpad0'

    if (zoomIn) zoomBy(contents, ZOOM_STEP)
    else if (zoomOut) zoomBy(contents, -ZOOM_STEP)
    else if (reset) contents.setZoomLevel(0)
    else return

    event.preventDefault()
  })

  // Ctrl + wheel reports the intent but leaves the zoom to us.
  contents.on('zoom-changed', (_event, direction) => {
    zoomBy(contents, direction === 'in' ? ZOOM_STEP : -ZOOM_STEP)
  })
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    // The renderer degrades gracefully down to roughly this size; below it the
    // two fixed bars would start clipping, so the window refuses to go smaller.
    minWidth: 960,
    minHeight: 600,
    // The design is a frameless surface — the app's own top bar is the title bar.
    frame: false,
    backgroundColor: '#EEF0F2',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
    },
  })

  attachZoomShortcuts(win.webContents)

  win.once('ready-to-show', () => win?.show())
  win.on('closed', () => {
    win = null
  })

  // This app is local-only: nothing may navigate away or open a second window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (!isDev || !url.startsWith(DEV_SERVER_URL)) event.preventDefault()
  })

  if (isDev) {
    void win.loadURL(DEV_SERVER_URL)
  } else {
    void win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

function applyCsp(): void {
  if (isDev) return // the Vite dev server needs websockets + eval for HMR
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
            "font-src 'self' data:; img-src 'self' data:; connect-src 'none'",
        ],
      },
    })
  })
}

// One window per machine in production. In dev the lock is skipped so a stale
// instance can never make `npm run dev` exit silently.
const gotLock = isDev || app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.focus()
  })

  void app.whenReady().then(() => {
    applyCsp()

    ipcMain.handle('kir:load', () => loadState())
    ipcMain.handle('kir:save', (_event, data: unknown) => saveState(data))
    ipcMain.handle('kir:store-path', () => storePath())
    ipcMain.handle('kir:autostart-get', () => getAutostart())
    ipcMain.handle('kir:autostart-set', (_event, enabled: boolean) => setAutostart(enabled === true))
    ipcMain.on('kir:window', (_event, action: string) => {
      if (!win) return
      if (action === 'minimize') win.minimize()
      else if (action === 'toggle-maximize') win.isMaximized() ? win.unmaximize() : win.maximize()
      else if (action === 'close') win.close()
    })

    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
