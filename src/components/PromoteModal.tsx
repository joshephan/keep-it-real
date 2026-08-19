import { C, MONO } from '../tokens'
import { useApp } from '../state/AppContext'
import { Modal } from '../ui/Overlay'
import { Field, dateInputStyle, neutralButton } from '../ui/primitives'
import { diffDays } from '../lib/date'
import { uid } from '../lib/uid'
import { clampDate, MAX_DATE, MIN_DATE } from '../lib/axis'

/** 계획 → 실제. Copies the plan onto the actual track; the plan keeps its dates. */
export function PromoteModal() {
  const { state, dispatch, t } = useApp()
  const pr = state.promote
  if (!pr) return null

  const close = () => dispatch({ type: 'closePromote' })
  const end = diffDays(pr.start, pr.end) < 0 ? pr.start : pr.end
  const drift = diffDays(pr.planEnd, end)

  const driftText = drift < 0 ? t.earlierBy(Math.abs(drift)) : t.laterBy(drift)
  const driftBg = drift < 0 ? C.positiveTint : C.accentTint
  const driftColor = drift < 0 ? C.positive : C.accent

  return (
    <Modal width={470} zIndex={70} onClose={close}>
      <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${C.borderLighter}` }}>
        <h3 style={{ margin: '0 0 5px', fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>
          {t.promoteTitle}
        </h3>
        <p style={{ margin: 0, fontSize: 12.5, color: C.text3, lineHeight: 1.55, textWrap: 'pretty' }}>
          {t.promoteBody}
        </p>
      </div>

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div
          style={{
            padding: '13px 15px',
            borderRadius: 10,
            background: C.muted,
            border: `1px dashed ${C.dashedCard}`,
          }}
        >
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              color: C.text4,
              letterSpacing: '0.05em',
              marginBottom: 6,
            }}
          >
            {t.planOriginal}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{pr.name}</div>
          <div style={{ fontFamily: MONO, fontSize: 11, color: C.text3, marginTop: 4 }}>{pr.planRange}</div>
        </div>

        <div style={{ display: 'flex', gap: 14 }}>
          <Field label={t.actualStart}>
            <input
              type="date"
              value={pr.start}
              min={MIN_DATE}
              max={MAX_DATE}
              onChange={(e) =>
                dispatch({
                  type: 'patchPromote',
                  patch: { start: clampDate(e.target.value || pr.start) },
                })
              }
              style={dateInputStyle}
            />
          </Field>
          <Field label={t.actualEnd}>
            <input
              type="date"
              value={pr.end}
              min={MIN_DATE}
              max={MAX_DATE}
              onChange={(e) =>
                dispatch({ type: 'patchPromote', patch: { end: clampDate(e.target.value || pr.end) } })
              }
              style={dateInputStyle}
            />
          </Field>
        </div>

        {drift !== 0 && (
          <div
            style={{
              padding: '11px 14px',
              borderRadius: 9,
              fontSize: 12.5,
              fontWeight: 600,
              background: driftBg,
              color: driftColor,
            }}
          >
            {driftText}
          </div>
        )}
      </div>

      <div
        style={{
          padding: '14px 24px',
          borderTop: `1px solid ${C.borderLighter}`,
          display: 'flex',
          gap: 10,
          justifyContent: 'flex-end',
          background: C.footer,
        }}
      >
        <button onClick={close} style={neutralButton}>
          {t.cancel}
        </button>
        <button
          onClick={() => dispatch({ type: 'confirmPromote', newId: uid() })}
          style={{
            height: 36,
            padding: '0 18px',
            borderRadius: 8,
            border: 'none',
            background: C.text,
            color: C.surface,
            fontSize: 12.5,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {t.promoteConfirm}
        </button>
      </div>
    </Modal>
  )
}
