import { useMemo, type Dispatch, type RefObject } from 'react'
import type { CategoryId, Item, Track } from '../types'
import { BAR_H, C, LANE_TOP, MONO, ROW_PITCH, SHADOW } from '../tokens'
import { useApp } from '../state/AppContext'
import type { Axis } from '../lib/axis'
import { layoutBars, laneHeight, type Box } from '../lib/layout'
import { diffDays } from '../lib/date'
import { findCategory } from '../lib/categories'
import { displayTitle, stampText } from '../lib/item'
import { editDraft, newDraft, type Action } from '../state/reducer'
import { useDragScroll } from '../hooks/useDragScroll'
import { useBarDrag, type BarDragHandlers, type BarPreview } from '../hooks/useBarDrag'
import type { Strings } from '../i18n'

interface Props {
  axis: Axis
  scrollerRef: RefObject<HTMLDivElement | null>
}

export function Timeline({ axis, scrollerRef }: Props) {
  const { state, dispatch, t, today } = useApp()

  const { actualLayout, planLayout } = useMemo(() => {
    const visible = state.items.filter((i) => !i.deleted)
    return {
      actualLayout: layoutBars(visible.filter((i) => i.kind === 'actual'), axis),
      planLayout: layoutBars(visible.filter((i) => i.kind === 'plan'), axis),
    }
  }, [state.items, axis])

  const todayIndex = axis.colIndex(today)
  const todayX = todayIndex * axis.colW + (axis.view === 'day' ? axis.colW / 2 : 0)

  const query = state.query.trim().toLowerCase()
  const matches = (item: Item): boolean => {
    const okQuery =
      !query || item.title.toLowerCase().includes(query) || (item.note ?? '').toLowerCase().includes(query)
    return okQuery && (state.cat === 'all' || item.cat === state.cat)
  }

  const colorOf = (id: CategoryId): string => findCategory(state.cats, id).color
  const defaultCat = state.cats[0]?.id ?? 'etc'

  const { dragging, didDrag, handlers: dragHandlers } = useDragScroll(scrollerRef)

  const {
    preview,
    handlers: barHandlers,
    didDragBar,
  } = useBarDrag(axis, (id, start, end) => dispatch({ type: 'moveItem', id, start, end }))

  /** Everything a bar needs to take part in the drag gesture. */
  const barDrag = (item: Item) => ({
    drag: barHandlers(item),
    preview: preview?.id === item.id ? preview : null,
    colW: axis.colW,
    suppressClick: () => didDrag() || didDragBar(),
  })

  /** True while the plan, or the actual it was promoted into, is being dragged. */
  const dragsThisPair = (plan: Item): boolean =>
    !!preview && (preview.id === plan.id || preview.id === plan.actualId)

  // Vertical wheel scrolls the timeline horizontally, unless the lane under the
  // pointer has its own overflow to consume.
  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    // Ctrl + wheel is a zoom gesture, not a pan.
    if (e.ctrlKey || e.metaKey) return
    if (e.deltaX !== 0 || e.deltaY === 0) return
    const lane = (e.target as HTMLElement).closest('[data-lane]') as HTMLElement | null
    if (!e.shiftKey && lane && lane.scrollHeight > lane.clientHeight) return
    const el = scrollerRef.current
    if (el) el.scrollLeft += e.deltaY
  }

  return (
    <div
      ref={scrollerRef}
      onWheel={onWheel}
      {...dragHandlers}
      className={dragging || preview ? 'kir-dragging' : undefined}
      style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', background: C.surface }}
    >
      <div
        style={{
          width: axis.total,
          minWidth: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        <ColumnHeader axis={axis} todayIndex={todayIndex} />

        <div
          data-lane="actual"
          style={{
            flex: 1,
            position: 'relative',
            overflowY: 'auto',
            borderBottom: `1px solid ${C.borderStrong}`,
            minHeight: 0,
          }}
        >
          <div
            style={{
              position: 'relative',
              width: axis.total,
              minHeight: '100%',
              height: laneHeight(actualLayout.laneCount),
            }}
          >
            <Cells
              axis={axis}
              kind="actual"
              showWeekend={state.showWeekend}
              dispatch={dispatch}
              defaultCat={defaultCat}
              didDrag={didDrag}
            />
            <TodayLine x={todayX} />
            {actualLayout.boxes.map((box) => (
              <ActualBar
                key={box.item.id}
                box={box}
                dim={!matches(box.item)}
                color={colorOf(box.item.cat)}
                dispatch={dispatch}
                t={t}
                {...barDrag(box.item)}
              />
            ))}
          </div>
        </div>

        <div
          data-lane="plan"
          style={{ flex: 1, position: 'relative', overflowY: 'auto', background: C.muted, minHeight: 0 }}
        >
          <div
            style={{
              position: 'relative',
              width: axis.total,
              minHeight: '100%',
              height: laneHeight(planLayout.laneCount),
            }}
          >
            <Cells
              axis={axis}
              kind="plan"
              showWeekend={state.showWeekend}
              dispatch={dispatch}
              defaultCat={defaultCat}
              didDrag={didDrag}
            />
            <TodayLine x={todayX} />
            {state.showDiff &&
              planLayout.boxes.map((box) =>
                // Either half of a pair being dragged would leave this drawn
                // against dates that no longer apply, so it sits the drag out.
                dragsThisPair(box.item) ? null : (
                  <DriftMarker
                    key={`${box.item.id}-drift`}
                    box={box}
                    axis={axis}
                    items={state.items}
                    dim={!matches(box.item)}
                    t={t}
                  />
                ),
              )}
            {planLayout.boxes.map((box) => (
              <PlanBar
                key={box.item.id}
                box={box}
                dim={!matches(box.item)}
                color={colorOf(box.item.cat)}
                dispatch={dispatch}
                t={t}
                today={today}
                {...barDrag(box.item)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ColumnHeader({ axis, todayIndex }: { axis: Axis; todayIndex: number }) {
  return (
    <div
      style={{
        height: 46,
        flex: '0 0 46px',
        display: 'flex',
        borderBottom: `1px solid ${C.borderLight}`,
        background: C.surface,
        position: 'relative',
      }}
    >
      {axis.cols.map((col, i) => {
        const isToday = i === todayIndex
        return (
          <div
            key={col.date}
            style={{
              position: 'absolute',
              left: i * axis.colW,
              width: axis.colW,
              top: 0,
              bottom: 0,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 2,
              padding: axis.colW < 96 ? '0 8px' : '0 12px',
              borderRight: `1px solid ${C.grid}`,
              background: isToday ? C.todayTint : 'transparent',
              // Narrow columns clip their label rather than bleeding into the
              // next one.
              overflow: 'hidden',
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '-0.01em',
                color: isToday ? C.accent : C.text,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {col.label}
            </span>
            {/* Year columns have nothing to say on the second line. */}
            {col.sub && (
              <span style={{ fontFamily: MONO, fontSize: 9.5, color: C.text5, letterSpacing: '0.06em' }}>
                {col.sub}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** Click targets behind the bars: one per column, per lane. */
function Cells({
  axis,
  kind,
  showWeekend,
  dispatch,
  defaultCat,
  didDrag,
}: {
  axis: Axis
  kind: Track
  showWeekend: boolean
  dispatch: Dispatch<Action>
  defaultCat: CategoryId
  didDrag: () => boolean
}) {
  return (
    <>
      {axis.cols.map((col, i) => (
        <div
          key={`${kind}-${col.date}`}
          onClick={() => {
            if (didDrag()) return
            dispatch({ type: 'openForm', draft: newDraft(kind, col.date, defaultCat) })
          }}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: i * axis.colW,
            width: axis.colW,
            borderRight: `1px solid ${C.grid}`,
            background: showWeekend && col.weekend ? C.weekend : 'transparent',
            cursor: 'copy',
          }}
        />
      ))}
    </>
  )
}

function TodayLine({ x }: { x: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: 0,
        bottom: 0,
        width: 1.5,
        background: C.todayLine,
        pointerEvents: 'none',
      }}
    />
  )
}

/** The drag gesture's half of a bar's props, handed over by `barDrag`. */
interface DragProps {
  drag: BarDragHandlers
  /** Non-null only while this very bar is being dragged. */
  preview: BarPreview | null
  colW: number
  suppressClick: () => boolean
}

/**
 * A bar being dragged is drawn at the column it would land on, lifted above its
 * neighbours. The item itself is untouched until the pointer is released.
 */
function dragStyle(preview: BarPreview | null, colW: number, resting: string) {
  if (!preview) return { cursor: 'grab' as const, boxShadow: resting }
  return {
    cursor: 'grabbing' as const,
    transform: `translateX(${preview.cols * colW}px)`,
    zIndex: 5,
    boxShadow: SHADOW.barDrag,
  }
}

/** The date stamp, reading ahead to where the drag would drop the item. */
function previewStamp(item: Item, preview: BarPreview | null): string {
  return stampText(preview ? { ...item, start: preview.start, end: preview.end } : item)
}

function ActualBar({
  box,
  dim,
  color,
  dispatch,
  t,
  drag,
  preview,
  colW,
  suppressClick,
}: DragProps & {
  box: Box
  dim: boolean
  color: string
  dispatch: Dispatch<Action>
  t: Strings
}) {
  const item = box.item
  const label = displayTitle(item, t.untitled)
  return (
    <div
      data-bar
      {...drag}
      onClick={(e) => {
        e.stopPropagation()
        if (suppressClick()) return
        dispatch({ type: 'openForm', draft: editDraft(item) })
      }}
      title={label}
      style={{
        position: 'absolute',
        left: box.left,
        width: box.width,
        top: LANE_TOP + box.lane * ROW_PITCH,
        height: BAR_H,
        borderRadius: 8,
        background: color,
        color: C.surface,
        display: 'flex',
        alignItems: 'center',
        padding: '0 11px',
        opacity: dim ? 0.2 : 1,
        overflow: 'hidden',
        ...dragStyle(preview, colW, SHADOW.bar),
      }}
    >
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: MONO,
          fontSize: 9.5,
          opacity: 0.75,
          whiteSpace: 'nowrap',
          marginLeft: 'auto',
          paddingLeft: 8,
        }}
      >
        {previewStamp(item, preview)}
        {item.sourceId ? '  ↑' : ''}
      </span>
    </div>
  )
}

function PlanBar({
  box,
  dim,
  color,
  dispatch,
  t,
  today,
  drag,
  preview,
  colW,
  suppressClick,
}: DragProps & {
  box: Box
  dim: boolean
  color: string
  dispatch: Dispatch<Action>
  t: Strings
  today: string
}) {
  const item = box.item
  const label = displayTitle(item, t.untitled)
  return (
    <div
      data-bar
      {...drag}
      onClick={(e) => {
        e.stopPropagation()
        if (suppressClick()) return
        dispatch({ type: 'openForm', draft: editDraft(item) })
      }}
      title={label}
      style={{
        position: 'absolute',
        left: box.left,
        width: box.width,
        top: LANE_TOP + box.lane * ROW_PITCH,
        height: BAR_H,
        borderRadius: 8,
        // A dragged plan bar needs to read against the actual bars it passes
        // over, so the translucent fill goes solid for the duration.
        background: preview ? C.surface : `${color}14`,
        color,
        border: `1.5px dashed ${color}99`,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '0 9px',
        opacity: dim ? 0.2 : 1,
        overflow: 'hidden',
        ...dragStyle(preview, colW, 'none'),
      }}
    >
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          textDecoration: item.done ? 'line-through' : 'none',
          opacity: item.done ? 0.55 : 1,
        }}
      >
        {label}
      </span>
      <span style={{ fontFamily: MONO, fontSize: 9.5, opacity: 0.7, whiteSpace: 'nowrap' }}>
        {previewStamp(item, preview)}
      </span>
      {item.done ? (
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 10,
            fontWeight: 700,
            color,
            opacity: 0.8,
            letterSpacing: '0.03em',
            flex: '0 0 auto',
          }}
        >
          {t.promoted}
        </span>
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation()
            // Opens the promote modal; the plan record itself is left alone.
            dispatch({
              type: 'openPromote',
              draft: {
                id: item.id,
                name: label,
                planRange: stampText(item),
                planEnd: item.end || item.start,
                start: today,
                end: today,
              },
            })
          }}
          style={{
            marginLeft: 'auto',
            height: 21,
            padding: '0 9px',
            borderRadius: 11,
            border: `1px solid ${color}`,
            background: 'rgba(255,255,255,0.85)',
            color,
            fontSize: 10.5,
            fontWeight: 700,
            cursor: 'pointer',
            flex: '0 0 auto',
          }}
        >
          {t.complete}
        </button>
      )}
    </div>
  )
}

/**
 * Dashed connector + diamond + signed day delta, drawn on the plan bar's own row.
 * Drift is always derived from the two records, never stored.
 */
function DriftMarker({
  box,
  axis,
  items,
  dim,
  t,
}: {
  box: Box
  axis: Axis
  items: Item[]
  dim: boolean
  t: Strings
}) {
  const plan = box.item
  if (!plan.actualId) return null
  const actual = items.find((i) => i.id === plan.actualId && !i.deleted)
  if (!actual) return null

  const top = LANE_TOP + box.lane * ROW_PITCH
  const actualX = axis.colIndex(actual.start) * axis.colW + axis.colW / 2
  const planX = box.left + box.width
  const drift = diffDays(plan.end || plan.start, actual.end || actual.start)
  const color = drift < 0 ? C.positive : C.accent
  const lo = Math.min(actualX, planX)
  const width = Math.max(2, Math.max(actualX, planX) - lo)

  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: lo,
          width,
          top: top + 14,
          height: 0,
          borderTop: `1.5px dashed ${color}`,
          opacity: dim ? 0.15 : 0.65,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: actualX - 4,
          top: top + 11,
          width: 8,
          height: 8,
          transform: 'rotate(45deg)',
          background: color,
          opacity: dim ? 0.2 : 1,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: lo + width / 2 - 26,
          width: 52,
          top: top + 18,
          textAlign: 'center',
          fontFamily: MONO,
          fontSize: 9.5,
          fontWeight: 600,
          color,
          background: C.muted,
          opacity: dim ? 0.2 : 1,
          pointerEvents: 'none',
        }}
      >
        {drift === 0 ? t.onTime : t.driftLabel(drift)}
      </div>
    </>
  )
}
