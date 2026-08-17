import { useCallback, useEffect, useMemo, useRef } from 'react'
import { C, SANS } from './tokens'
import { useApp } from './state/AppContext'
import { createAxis } from './lib/axis'
import { TopBar } from './components/TopBar'
import { FilterBar } from './components/FilterBar'
import { Gutter } from './components/Gutter'
import { Timeline } from './components/Timeline'
import { ItemModal } from './components/ItemModal'
import { PromoteModal } from './components/PromoteModal'
import { TrashDrawer } from './components/TrashDrawer'
import { SettingsDrawer } from './components/SettingsDrawer'

export default function App() {
  const { state, today } = useApp()
  const scrollerRef = useRef<HTMLDivElement>(null)

  const axis = useMemo(
    () => createAxis(state.view, state.items, today, state.lang),
    [state.view, state.items, today, state.lang],
  )

  const centerToday = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    el.scrollLeft = Math.max(0, axis.colIndex(today) * axis.colW - el.clientWidth / 2 + axis.colW / 2)
  }, [axis, today])

  // Raw scrollLeft is meaningless across column scales, so recenter on mount and
  // after every view change rather than trying to preserve the offset.
  const centerRef = useRef(centerToday)
  centerRef.current = centerToday
  useEffect(() => {
    const id = setTimeout(() => centerRef.current(), 60)
    return () => clearTimeout(id)
  }, [state.view, state.hydrated])

  const scrollByPage = (direction: -1 | 1) => {
    const el = scrollerRef.current
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: 'smooth' })
  }

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: C.canvas,
        fontFamily: SANS,
        color: C.text,
        overflow: 'hidden',
      }}
    >
      <TopBar onPrev={() => scrollByPage(-1)} onNext={() => scrollByPage(1)} onToday={centerToday} />
      <FilterBar />

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <Gutter axis={axis} />
        <Timeline axis={axis} scrollerRef={scrollerRef} />
      </div>

      {state.form && <ItemModal key={state.form.id ?? 'new'} />}
      {state.promote && <PromoteModal />}
      {state.trashOpen && <TrashDrawer />}
      {state.settingsOpen && <SettingsDrawer />}
    </div>
  )
}
