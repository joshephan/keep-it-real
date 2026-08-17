import { useEffect, useRef } from 'react'
import { C } from '../tokens'
import { useApp } from '../state/AppContext'
import { DEFAULT_END_TIME, DEFAULT_START_TIME, hasContent } from '../state/reducer'
import { catLabel } from '../lib/categories'
import { Modal } from '../ui/Overlay'
import {
  Field,
  choiceButton,
  dangerButton,
  dateInputStyle,
  inputStyle,
  neutralButton,
  pill,
  primaryButton,
  rowButton,
} from '../ui/primitives'
import { uid } from '../lib/uid'
import { todayISO } from '../lib/date'
import { clampDate, MAX_DATE, MIN_DATE } from '../lib/axis'

/**
 * The one item editor. Both calendars open this same component — the track
 * badge and the track picker are the only things that differ.
 */
export function ItemModal() {
  const { state, dispatch, t } = useApp()
  const form = state.form
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  if (!form) return null

  const source = form.id ? state.items.find((i) => i.id === form.id) : undefined
  const isPromotedPlan = !!source?.done
  const close = () => dispatch({ type: 'closeForm' })
  const patch = (p: Partial<typeof form>) => dispatch({ type: 'patchForm', patch: p })
  // A title or a note is enough; with neither there is nothing to save.
  const canSave = hasContent(form)
  const save = () => {
    if (canSave) dispatch({ type: 'saveForm', newId: uid() })
  }

  return (
    <Modal width={520} zIndex={60} onClose={close}>
      <div
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save()
        }}
      >
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: `1px solid ${C.borderLighter}`,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              padding: '3px 9px',
              borderRadius: 6,
              letterSpacing: '0.04em',
              background: form.kind === 'plan' ? C.fill : C.text,
              color: form.kind === 'plan' ? C.text2 : C.surface,
            }}
          >
            {form.kind === 'plan' ? t.plan : t.actual}
          </span>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>
            {form.id ? t.editTitle : t.addTitle}
          </h3>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Field label={t.fTitle}>
            <input
              ref={titleRef}
              value={form.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder={t.fTitlePh}
              style={inputStyle}
            />
          </Field>

          <Field label={t.fTrack}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => patch({ kind: 'actual' })} style={choiceButton(form.kind === 'actual')}>
                {t.actual}
              </button>
              <button onClick={() => patch({ kind: 'plan' })} style={choiceButton(form.kind === 'plan', true)}>
                {t.plan}
              </button>
            </div>
          </Field>

          <Field label={t.fCat}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {state.cats.map((c) => (
                <button key={c.id} onClick={() => patch({ cat: c.id })} style={pill(form.cat === c.id, c.color)}>
                  {catLabel(c, state.lang)}
                </button>
              ))}
            </div>
          </Field>

          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end' }}>
            <Field label={t.fStart}>
              <input
                type="date"
                value={form.start}
                min={MIN_DATE}
                max={MAX_DATE}
                onChange={(e) => patch({ start: clampDate(e.target.value || form.start) })}
                style={dateInputStyle}
              />
            </Field>
            <Field label={t.fEnd}>
              <input
                type="date"
                value={form.end}
                min={MIN_DATE}
                max={MAX_DATE}
                disabled={form.single}
                onChange={(e) => patch({ end: clampDate(e.target.value || form.end) })}
                style={{
                  ...dateInputStyle,
                  background: form.single ? '#F4F6F7' : C.surface,
                  color: form.single ? C.text5 : C.text,
                }}
              />
            </Field>
            <button
              onClick={() => patch({ single: !form.single, end: form.single ? form.end : form.start })}
              style={rowButton}
            >
              {form.single ? t.single : t.span}
            </button>
          </div>

          {/* Time is opt-in: until the user asks for it an item stays all-day. */}
          {form.timed ? (
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end' }}>
              <Field label={t.fStartTime}>
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => patch({ startTime: e.target.value })}
                  style={dateInputStyle}
                />
              </Field>
              <Field label={t.fEndTime}>
                <input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => patch({ endTime: e.target.value })}
                  style={dateInputStyle}
                />
              </Field>
              <button onClick={() => patch({ timed: false })} style={rowButton}>
                {t.timeRemove}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={() =>
                  patch({
                    timed: true,
                    startTime: form.startTime || DEFAULT_START_TIME,
                    endTime: form.endTime || DEFAULT_END_TIME,
                  })
                }
                style={{ ...rowButton, height: 32 }}
              >
                {t.timeAdd}
              </button>
              <span style={{ fontSize: 11.5, color: C.text5 }}>{t.allDay}</span>
            </div>
          )}

          <Field label={t.fNote}>
            <textarea
              value={form.note}
              onChange={(e) => patch({ note: e.target.value })}
              rows={2}
              placeholder={t.fNotePh}
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                border: `1px solid ${C.borderStrong}`,
                fontSize: 13,
                resize: 'none',
                outline: 'none',
                lineHeight: 1.5,
                color: C.text,
              }}
            />
          </Field>

          {isPromotedPlan && (
            <div
              style={{
                padding: '11px 13px',
                borderRadius: 9,
                background: C.accentTint,
                border: `1px solid ${C.accentTintBorder}`,
                fontSize: 12,
                color: C.accentDark,
                lineHeight: 1.5,
              }}
            >
              {t.promotedTo}
            </div>
          )}
        </div>

        <div
          style={{
            padding: '14px 24px',
            borderTop: `1px solid ${C.borderLighter}`,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: C.footer,
          }}
        >
          {form.id && (
            <button onClick={() => dispatch({ type: 'trashItem', at: todayISO() })} style={dangerButton}>
              {t.moveToTrash}
            </button>
          )}
          {isPromotedPlan && (
            <button onClick={() => dispatch({ type: 'unpromote' })} style={{ ...neutralButton, padding: '0 14px' }}>
              {t.undoPromote}
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button onClick={close} style={neutralButton}>
            {t.cancel}
          </button>
          <button
            onClick={save}
            disabled={!canSave}
            title={canSave ? undefined : t.saveHint}
            style={{
              ...primaryButton,
              opacity: canSave ? 1 : 0.45,
              cursor: canSave ? 'pointer' : 'default',
            }}
          >
            {t.save}
          </button>
        </div>
      </div>
    </Modal>
  )
}
