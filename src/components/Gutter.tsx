import { C, MONO } from '../tokens'
import { useApp } from '../state/AppContext'
import { axisYearLabel, type Axis } from '../lib/axis'

export function Gutter({ axis }: { axis: Axis }) {
  const { state, t } = useApp()
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
        dot={<div style={{ width: 8, height: 8, borderRadius: '50%', background: C.text }} />}
        style={{ borderBottom: `1px solid ${C.borderStrong}` }}
      />
      <LaneLabel
        title={t.plan}
        count={t.items(planCount)}
        titleColor={C.text2}
        dot={<div style={{ width: 8, height: 8, borderRadius: '50%', border: `1.5px dashed ${C.text4}` }} />}
        style={{ background: C.muted }}
      />
    </div>
  )
}

function LaneLabel({
  title,
  count,
  dot,
  style,
  titleColor = C.text,
}: {
  title: string
  count: string
  dot: React.ReactNode
  style?: React.CSSProperties
  titleColor?: string
}) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 7,
        paddingLeft: 14,
        minHeight: 0,
        ...style,
      }}
    >
      {dot}
      <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em', color: titleColor }}>
        {title}
      </span>
      <span style={{ fontFamily: MONO, fontSize: 10, color: C.text5 }}>{count}</span>
    </div>
  )
}
