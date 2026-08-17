import { app } from 'electron'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * "Launch at login" lives in the OS, not in our JSON store — the OS is the
 * single source of truth, so the renderer always reads it back rather than
 * caching it.
 *
 * Windows / macOS use Electron's login-item API. Electron does nothing on
 * Linux, so there we write the freedesktop autostart entry ourselves.
 */

export interface AutostartState {
  supported: boolean
  enabled: boolean
}

const DESKTOP_FILE = 'keep-it-real.desktop'

const autostartDir = (): string =>
  path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'autostart')

const desktopEntryPath = (): string => path.join(autostartDir(), DESKTOP_FILE)

function desktopEntry(): string {
  const exec = app.isPackaged
    ? `"${process.execPath}"`
    : `"${process.execPath}" "${app.getAppPath()}"`
  return [
    '[Desktop Entry]',
    'Type=Application',
    'Name=Keep It Real',
    `Exec=${exec}`,
    'Terminal=false',
    'X-GNOME-Autostart-enabled=true',
    '',
  ].join('\n')
}

/**
 * An unpackaged run would otherwise register the bare Electron binary, which
 * starts without the app. Windows keys the login item by path + args, so the
 * exact same options must be passed when reading it back — omitting them here
 * makes `getLoginItemSettings` report `openAtLogin: false` right after a
 * successful write.
 */
function loginItemOptions(): { path?: string; args?: string[] } {
  if (process.platform !== 'win32' || app.isPackaged) return {}
  return { path: process.execPath, args: [app.getAppPath()] }
}

export function getAutostart(): AutostartState {
  try {
    if (process.platform === 'linux') {
      return { supported: true, enabled: fs.existsSync(desktopEntryPath()) }
    }
    return { supported: true, enabled: app.getLoginItemSettings(loginItemOptions()).openAtLogin }
  } catch (err) {
    console.error('[keep-it-real] failed to read autostart state:', err)
    return { supported: false, enabled: false }
  }
}

export function setAutostart(enabled: boolean): AutostartState {
  try {
    if (process.platform === 'linux') {
      if (enabled) {
        fs.mkdirSync(autostartDir(), { recursive: true })
        fs.writeFileSync(desktopEntryPath(), desktopEntry(), 'utf8')
      } else {
        fs.rmSync(desktopEntryPath(), { force: true })
      }
    } else {
      app.setLoginItemSettings({ ...loginItemOptions(), openAtLogin: enabled })
    }
  } catch (err) {
    console.error('[keep-it-real] failed to write autostart state:', err)
  }
  // Report what the OS actually holds now, not what was asked for.
  return getAutostart()
}
