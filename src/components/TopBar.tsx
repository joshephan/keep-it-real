import { useState } from 'react'
import type { ViewMode } from '../types'
import { C, MONO } from '../tokens'
import { useApp } from '../state/AppContext'
import { ghostButton, iconButton, segButton } from '../ui/primitives'
import { newDraft } from '../state/reducer'
import { useLayoutMode } from '../hooks/useLayoutMode'
import { WindowControls } from './WindowControls'

interface Props {
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  onGoToDate: (date: string) => void
}

export function TopBar({ onPrev, onNext, onToday, onGoToDate }: Props) {
  const { state, dispatch, t, today } = useApp()
  const layout = useLayoutMode()
  const [jumpDate, setJumpDate] = useState(today)
  const trashCount = state.items.filter((i) => i.deleted).length

  const views: { id: ViewMode; label: string }[] = [
    { id: 'day', label: t.day },
    { id: 'week', label: t.week },
    { id: 'month', label: t.month },
    { id: 'year', label: t.year },
  ]

  return (
    <div
      // The frameless window is dragged by this bar; controls opt back out below.
      className="kir-hscroll"
      style={{
        height: 60,
        flex: '0 0 60px',
        display: 'flex',
        alignItems: 'center',
        gap: layout.tight ? 12 : 20,
        padding: layout.tight ? '0 12px' : '0 18px',
        background: C.surface,
        borderBottom: `1px solid ${C.borderStrong}`,
        // Nothing here shrinks, so at heavy zoom the row scrolls rather than
        // hiding the window controls off the right edge.
        overflowX: 'auto',
        overflowY: 'hidden',
        WebkitAppRegion: 'drag',
      } as React.CSSProperties}
    >
      <div
        style={{
          flex: '0 0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          paddingRight: 6,
          whiteSpace: 'nowrap',
        }}
      >
        <div style={{ width: 11, height: 11, borderRadius: '50%', background: C.accent }} />
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
          <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em' }}>Keep It Real</span>
          {!layout.compact && (
            <span style={{ fontSize: 10, color: C.text4, letterSpacing: '0.04em' }}>{t.tagline}</span>
          )}
        </div>
      </div>

      <div style={noDrag({ flex: '0 0 auto', display: 'flex', background: C.fill, border: `1px solid ${C.border}`, borderRadius: 8, padding: 2, gap: 2, whiteSpace: 'nowrap' })}>
        {views.map((v) => (
          <button
            key={v.id}
            onClick={() => dispatch({ type: 'setView', view: v.id })}
            style={segButton(state.view === v.id, layout.tight)}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Jump straight to a date; the axis grows to reach it if it is outside. */}
      <input
        type="date"
        value={jumpDate}
        title={t.goToDate}
        aria-label={t.goToDate}
        onChange={(e) => {
          const value = e.target.value
          if (!value) return
          setJumpDate(value)
          onGoToDate(value)
        }}
        style={noDrag({
          flex: '0 0 auto',
          height: 30,
          width: layout.tight ? 122 : 136,
          padding: layout.tight ? '0 6px' : '0 9px',
          borderRadius: 7,
          border: `1px solid ${C.border}`,
          background: C.surface,
          color: C.text2,
          fontFamily: MONO,
          fontSize: layout.tight ? 11 : 11.5,
          outline: 'none',
        })}
      />

      <div
        style={noDrag({
          flex: '0 0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: layout.tight ? 4 : 6,
          whiteSpace: 'nowrap',
        })}
      >
        <button onClick={onPrev} style={iconButton} aria-label="previous">
          ‹
        </button>
        <button onClick={onToday} style={{ ...ghostButton, padding: '0 12px', color: C.text }}>
          {t.today}
        </button>
        <button onClick={onNext} style={iconButton} aria-label="next">
          ›
        </button>
      </div>

      <div style={{ flex: 1, minWidth: 8 }} />

      <div
        style={noDrag({
          flex: '0 0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: layout.tight ? 6 : 8,
        })}
      >
        {/* Language lives in Settings → Language, not up here. */}
        <button onClick={() => dispatch({ type: 'setTrashOpen', open: true })} style={ghostButton}>
          {t.trash}
          {trashCount ? ` ${trashCount}` : ''}
        </button>
        <button onClick={() => dispatch({ type: 'setSettingsOpen', open: true })} style={ghostButton}>
          {t.settings}
        </button>
        <button
          onClick={() =>
            dispatch({ type: 'openForm', draft: newDraft('plan', today, state.cats[0]?.id ?? 'etc') })
          }
          style={{ ...ghostButton, padding: '0 13px', border: 'none', background: C.accent, color: C.surface }}
        >
          {t.newItem}
        </button>
        <WindowControls />
      </div>
    </div>
  )
}

/** Marks a cluster as interactive inside the draggable title bar. */
function noDrag(style: React.CSSProperties): React.CSSProperties {
  return { ...style, WebkitAppRegion: 'no-drag' } as React.CSSProperties
}
