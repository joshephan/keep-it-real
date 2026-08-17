import { useState } from 'react'
import { C } from '../tokens'
import { bridge } from '../lib/storage'

/**
 * The design specifies a frameless window with no OS chrome, so the app has to
 * supply its own minimise / maximise / close. Rendered only under Electron.
 */
export function WindowControls() {
  const api = bridge()
  const [hover, setHover] = useState<string | null>(null)
  if (!api) return null

  const base: React.CSSProperties = {
    width: 26,
    height: 26,
    borderRadius: 6,
    border: `1px solid ${C.border}`,
    background: C.surface,
    color: C.text4,
    cursor: 'pointer',
    fontSize: 11,
    lineHeight: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    flex: '0 0 auto',
  }

  const button = (id: string, glyph: string, label: string, onClick: () => void, danger = false) => (
    <button
      key={id}
      aria-label={label}
      title={label}
      onClick={onClick}
      onMouseEnter={() => setHover(id)}
      onMouseLeave={() => setHover((h) => (h === id ? null : h))}
      style={{
        ...base,
        background: hover === id ? (danger ? C.accent : C.fill) : C.surface,
        color: hover === id && danger ? C.surface : C.text4,
        borderColor: hover === id && danger ? C.accent : C.border,
      }}
    >
      {glyph}
    </button>
  )

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 4 }}>
      {button('min', '−', 'Minimize', () => api.window('minimize'))}
      {button('max', '▢', 'Maximize', () => api.window('toggle-maximize'))}
      {button('close', '✕', 'Close', () => api.window('close'), true)}
    </div>
  )
}
