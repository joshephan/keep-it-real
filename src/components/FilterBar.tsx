import type { CatFilter } from '../types'
import { C, COL_SCALE, MONO } from '../tokens'
import { useApp } from '../state/AppContext'
import { pill } from '../ui/primitives'
import { catLabel } from '../lib/categories'
import { useLayoutMode } from '../hooks/useLayoutMode'

export function FilterBar() {
  const { state, dispatch, t } = useApp()
  const layout = useLayoutMode()

  const filters: { id: CatFilter; label: string; color: string }[] = [
    { id: 'all', label: t.all, color: C.text2 },
    ...state.cats.map((c) => ({ id: c.id as CatFilter, label: catLabel(c, state.lang), color: c.color })),
  ]

  return (
    <div
      style={{
        height: 42,
        flex: '0 0 42px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: layout.tight ? '0 12px' : '0 18px',
        background: C.surface,
        borderBottom: `1px solid ${C.borderStrong}`,
        overflowX: 'auto',
        overflowY: 'hidden',
      }}
      className="kir-hscroll"
    >
      <input
        value={state.query}
        onChange={(e) => dispatch({ type: 'setQuery', query: e.target.value })}
        placeholder={t.search}
        style={{
          flex: '0 0 auto',
          width: layout.narrow ? 132 : layout.tight ? 160 : 200,
          height: 28,
          padding: '0 12px',
          borderRadius: 8,
          border: `1px solid ${C.border}`,
          background: C.input,
          fontSize: 12.5,
          color: C.text,
          outline: 'none',
        }}
      />
      <div style={{ width: 1, height: 18, background: C.borderLight, flex: '0 0 auto' }} />
      {/* Categories are user-defined, so this row can outgrow the bar — it
          scrolls instead of pushing anything off the edge. */}
      <div
        className="kir-hscroll"
        style={{
          display: 'flex',
          gap: 5,
          alignItems: 'center',
          flex: '1 1 auto',
          minWidth: 0,
          overflowX: 'auto',
          overflowY: 'hidden',
        }}
      >
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => dispatch({ type: 'setCat', cat: f.id })}
            style={pill(state.cat === f.id, f.color)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ width: 1, height: 18, background: C.borderLight, flex: '0 0 auto' }} />
      <ColWidthSlider />
    </div>
  )
}

/**
 * Stretches the columns of whichever view is on screen. Each view keeps its own
 * width, so widening the week view leaves the month view as it was.
 */
function ColWidthSlider() {
  const { state, dispatch, t } = useApp()
  const layout = useLayoutMode()
  const scale = state.colScale[state.view]
  const atDefault = scale === COL_SCALE.default

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 0 auto' }}>
      {!layout.compact && (
        <span style={{ fontSize: 11.5, fontWeight: 600, color: C.text3, whiteSpace: 'nowrap' }}>
          {t.colWidth}
        </span>
      )}
      <input
        type="range"
        className="kir-range"
        aria-label={t.colWidth}
        title={t.colWidthHint}
        min={COL_SCALE.min}
        max={COL_SCALE.max}
        step={COL_SCALE.step}
        value={scale}
        onChange={(e) => dispatch({ type: 'setColScale', scale: Number(e.target.value) })}
        style={{ width: layout.tight ? 84 : 116 }}
      />
      {/* Doubles as the reset: back to the width this view was designed at. */}
      <button
        onClick={() => dispatch({ type: 'setColScale', scale: COL_SCALE.default })}
        disabled={atDefault}
        title={t.colWidthReset}
        style={{
          fontFamily: MONO,
          fontSize: 10.5,
          fontWeight: 600,
          width: 38,
          height: 22,
          padding: 0,
          borderRadius: 6,
          border: `1px solid ${atDefault ? 'transparent' : C.border}`,
          background: atDefault ? 'transparent' : C.surface,
          color: atDefault ? C.text5 : C.text2,
          cursor: atDefault ? 'default' : 'pointer',
        }}
      >
        {Math.round(scale * 100)}%
      </button>
    </div>
  )
}
