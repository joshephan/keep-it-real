import type { CatFilter } from '../types'
import { C } from '../tokens'
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
      }}
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
    </div>
  )
}
