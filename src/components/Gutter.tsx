import { C, MONO, SCROLLBAR_H } from '../tokens'
import { useApp } from '../state/AppContext'
import { axisYearLabel, type Axis } from '../lib/axis'
import { LaneChevron, LaneSplitter, laneFlex } from './LaneSplitter'

export function Gutter({ axis }: { axis: Axis }) {
  const { state, dispatch, t } = useApp()
  const visible = state.items.filter((i) => !i.deleted)
  const actualCount = visible.filter((i) => i.kind === 'actual').length
  const planCount = visible.filter((i) => i.kind === 'plan').length

  return (
    <div
      style={{
        width: 78,
        flex: '0 0 78px',
        display: 'flex',
        flexDirection: 'column',
        background: C.surface,
        borderRight: `1px solid ${C.borderStrong}`,
      }}
    >
      <div
        style={{
          height: 46,
          flex: '0 0 46px',
          borderBottom: `1px solid ${C.borderLight}`,
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 14,
        }}
      >
        <span style={{ fontFamily: MONO, fontSize: 10, color: C.text5, letterSpacing: '0.08em' }}>
          {axisYearLabel(axis)}
        </span>
      </div>

      <LaneLabel
        title={t.actual}
        count={t.items(actualCount)}
        open={state.laneOpen.actual}
        onToggle={() => dispatch({ type: 'toggleLane', track: 'actual' })}
        toggleLabel={state.laneOpen.actual ? t.laneClose : t.laneOpen}
        dot={<div style={{ width: 8, height: 8, borderRadius: '50%', background: C.text }} />}
        style={{ ...laneFlex('actual', state.laneOpen, state.laneSplit), borderBottom: `1px solid ${C.borderStrong}` }}
      />
      <LaneSplitter />
      <LaneLabel
        title={t.plan}
        count={t.items(planCount)}
        open={state.laneOpen.plan}
        onToggle={() => dispatch({ type: 'toggleLane', track: 'plan' })}
        toggleLabel={state.laneOpen.plan ? t.laneClose : t.laneOpen}
        titleColor={C.text2}
        dot={<div style={{ width: 8, height: 8, borderRadius: '50%', border: `1.5px dashed ${C.text4}` }} />}
        style={{ ...laneFlex('plan', state.laneOpen, state.laneSplit), background: C.muted }}
      />
      {/* Stands in for the timeline's horizontal scrollbar, so the lane
          labels share the same height to divide and the seams line up. */}
      <div style={{ flex: `0 0 ${SCROLLBAR_H}px` }} />
    </div>
  )
}

/**
 * The lane's name doubles as its open/close switch. Open, it shows the dot,
 * name and count stacked; closed, only the name on one line, sized to the strip.
 */
function LaneLabel({
  title,
  count,
  dot,
  open,
  onToggle,
  toggleLabel,
  style,
  titleColor = C.text,
}: {
  title: string
  count: string
  dot: React.ReactNode
  open: boolean
  onToggle: () => void
  toggleLabel: string
  style?: React.CSSProperties
  titleColor?: string
}) {
  return (
    <button
      onClick={onToggle}
      title={toggleLabel}
      aria-expanded={open}
      style={{
        display: 'flex',
        flexDirection: open ? 'column' : 'row',
        justifyContent: 'center',
        alignItems: open ? 'flex-start' : 'center',
        gap: open ? 7 : 6,
        padding: open ? '0 0 0 14px' : '0 8px 0 14px',
        minHeight: 0,
        width: '100%',
        border: 'none',
        borderRadius: 0,
        background: C.surface,
        color: 'inherit',
        textAlign: 'left',
        cursor: 'pointer',
        overflow: 'hidden',
        ...style,
      }}
    >
      {open && dot}
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          fontSize: open ? 13 : 12,
          fontWeight: 700,
          letterSpacing: '-0.01em',
          color: titleColor,
          whiteSpace: 'nowrap',
        }}
      >
        {title}
        <LaneChevron open={open} />
      </span>
      {open && <span style={{ fontFamily: MONO, fontSize: 10, color: C.text5 }}>{count}</span>}
    </button>
  )
}
