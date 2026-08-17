import { useCallback, useEffect, useState } from 'react'
import { bridge, type AutostartState } from '../lib/storage'

/**
 * Reads "launch at login" from the OS and writes it back through the main
 * process. Returns null when the app is not running under Electron (the
 * browser dev fallback), so the setting can be hidden rather than faked.
 */
export function useAutoLaunch() {
  const [state, setState] = useState<AutostartState | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const api = bridge()?.autostart
    if (!api) return
    let cancelled = false
    void api
      .get()
      .then((value) => {
        if (!cancelled) setState(value)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  const toggle = useCallback(async () => {
    const api = bridge()?.autostart
    if (!api || !state || busy) return
    setBusy(true)
    try {
      // The main process reports what the OS actually holds afterwards, so a
      // refused write shows up as the toggle snapping back.
      setState(await api.set(!state.enabled))
    } catch {
      setState(await api.get().catch(() => state))
    } finally {
      setBusy(false)
    }
  }, [state, busy])

  return { state, toggle, busy }
}
