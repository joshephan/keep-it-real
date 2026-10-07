import { useRef, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { C, LANE_CLOSED_H, LANE_SPLIT } from '../tokens'
import type { LaneOpen, Track } from '../types'
import { useApp } from '../state/AppContext'

/**
 * Flex sizing for one lane. The gutter and the timeline both size their lanes
 * through this, so the labels stay level with the lanes they name.
 */
export function laneFlex(track: Track, open: LaneOpen, split: number): CSSProperties {
  if (!open[track]) return { flex: `0 0 ${LANE_CLOSED_H}px` }
  const other: Track = track === 'actual' ? 'plan' : 'actual'
  if (!open[other]) return { flex: '1 1 0' }
  return { flex: `${track === 'actual' ? split : 1 - split} 1 0` }
}

/**
 * The draggable seam between the two lanes. It takes no height of its own:
 * it sits between the lanes as a zero-height row and its grab area overhangs
 * both by a few pixels. Rendered in the gutter and the timeline alike, so the
 * seam can be caught anywhere along its length.
 */
export function LaneSplitter() {
  const { state, dispatch, t } = useApp()
  const drag = useRef<{ y: number; split: number; total: number } | null>(null)

  if (!state.laneOpen.actual || !state.laneOpen.plan) return null

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    // The timeline pans on a press anywhere inside it; this one is ours.
    e.stopPropagation()
    e.preventDefault()
    const seam = e.currentTarget.parentElement
    const above = seam?.previousElementSibling as HTMLElement | null
    const below = seam?.nextElementSibling as HTMLElement | null
    const total = (above?.offsetHeight ?? 0) + (below?.offsetHeight ?? 0)
    if (total <= 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { y: e.clientY, split: state.laneSplit, total }
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    dispatch({ type: 'setLaneSplit', split: d.split + (e.clientY - d.y) / d.total })
  }

  const end = () => {
    drag.current = null
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowUp' ? -LANE_SPLIT.step : e.key === 'ArrowDown' ? LANE_SPLIT.step : 0
    if (!step) return
    e.preventDefault()
    dispatch({ type: 'setLaneSplit', split: state.laneSplit + step })
  }

  return (
    <div style={{ flex: '0 0 0px', height: 0, position: 'relative', zIndex: 6 }}>
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label={t.laneResize}
        aria-valuemin={LANE_SPLIT.min * 100}
        aria-valuemax={LANE_SPLIT.max * 100}
        aria-valuenow={Math.round(state.laneSplit * 100)}
        title={t.laneResize}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={end}
        onPointerCancel={end}
        // Double-click puts the seam back in the middle.
        onDoubleClick={() => dispatch({ type: 'setLaneSplit', split: LANE_SPLIT.default })}
        onKeyDown={onKeyDown}
        className="kir-seam"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: -4,
          height: 8,
          cursor: 'row-resize',
          touchAction: 'none',
          outline: 'none',
        }}
      />
    </div>
  )
}

/** Small disclosure triangle shared by the gutter labels. */
export function LaneChevron({ open }: { open: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block',
        fontSize: 9,
        color: C.text5,
        transform: open ? 'none' : 'rotate(-90deg)',
        transition: 'transform 120ms ease',
      }}
    >
      ▼
    </span>
  )
}
