import { C } from '../tokens'
import type { Category } from '../types'
import { useApp } from '../state/AppContext'
import { Drawer } from '../ui/Overlay'
import { choiceButton, iconButton } from '../ui/primitives'
import { useConfirm } from '../hooks/useConfirm'
import { useAutoLaunch } from '../hooks/useAutoLaunch'
import { useBackup, type BackupStatus, type PendingImport } from '../hooks/useBackup'
import { REORDER_ROW_ATTR, useRowReorder } from '../hooks/useRowReorder'
import { catLabel, categoryUsage, nextPaletteColor } from '../lib/categories'
import { sampleItems } from '../lib/sample'
import { uid } from '../lib/uid'
import type { Strings } from '../i18n'
import { useCallback, type Dispatch, type KeyboardEvent, type PointerEvent } from 'react'
import type { Action } from '../state/reducer'

export function SettingsDrawer() {
  const { state, dispatch, t, today } = useApp()
  const close = () => dispatch({ type: 'setSettingsOpen', open: false })
  const reset = useConfirm(() => dispatch({ type: 'resetAll' }))
  const loadSample = useConfirm(() =>
    dispatch({ type: 'loadSample', items: sampleItems(today, state.lang) }),
  )
  const autoLaunch = useAutoLaunch()
  const backup = useBackup()
  const reorder = useRowReorder(
    useCallback((from: number, to: number) => dispatch({ type: 'moveCategory', from, to }), [dispatch]),
  )
  const ko = state.lang === 'ko'

  const fileButtonStyle: React.CSSProperties = {
    flex: 1,
    height: 36,
    borderRadius: 8,
    border: `1px solid ${C.borderStrong}`,
    background: C.surface,
    color: C.text2,
    fontSize: 12.5,
    fontWeight: 600,
    cursor: backup.busy ? 'default' : 'pointer',
    opacity: backup.busy ? 0.6 : 1,
  }

  const toggleStyle = (on: boolean): React.CSSProperties => ({
    height: 38,
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 12.5,
    fontWeight: 600,
    textAlign: 'left',
    padding: '0 14px',
    border: `1px solid ${C.borderStrong}`,
    background: on ? C.fill : C.surface,
    color: on ? C.text : C.text4,
  })

  const destructiveStyle = (armed: boolean): React.CSSProperties => ({
    height: 36,
    borderRadius: 8,
    border: `1px solid ${C.destructiveBorder}`,
    background: armed ? C.accentTint : C.surface,
    color: C.accent,
    fontSize: 12.5,
    fontWeight: 600,
    cursor: 'pointer',
  })

  return (
    <Drawer zIndex={65} onClose={close}>
      <div
        style={{
          padding: '22px 24px 16px',
          borderBottom: `1px solid ${C.borderLighter}`,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>{t.settings}</h3>
        <div style={{ flex: 1 }} />
        <button onClick={close} style={{ ...iconButton, color: C.text3 }} aria-label="close">
          ✕
        </button>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 22,
        }}
      >
        <Section title={t.sLanguage}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => dispatch({ type: 'setLang', lang: 'ko' })} style={choiceButton(ko)}>
              한국어
            </button>
            <button onClick={() => dispatch({ type: 'setLang', lang: 'en' })} style={choiceButton(!ko)}>
              English
            </button>
          </div>
        </Section>

        <Section title={t.sCategories}>
          <p style={{ margin: '0 0 2px', fontSize: 11.5, color: C.text4, lineHeight: 1.5 }}>
            {t.sCategoriesHint}
          </p>
          <div ref={reorder.listRef} style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {state.cats.map((cat, index) => (
              <CategoryRow
                key={cat.id}
                cat={cat}
                usage={categoryUsage(state.items, cat.id)}
                canRemove={state.cats.length > 1}
                canReorder={state.cats.length > 1}
                dragging={reorder.dragging === index}
                onGrab={reorder.start(index)}
                onNudge={(e) => reorder.nudge(index, e)}
                lang={state.lang}
                t={t}
                dispatch={dispatch}
              />
            ))}
          </div>
          <button
            onClick={() =>
              dispatch({
                type: 'addCategory',
                category: { id: uid(), name: t.catNew, color: nextPaletteColor(state.cats) },
              })
            }
            style={{
              height: 34,
              borderRadius: 8,
              border: `1px dashed ${C.borderStrong}`,
              background: C.surface,
              color: C.text2,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {t.catAdd}
          </button>
        </Section>

        <Section title={t.sDisplay}>
          <button onClick={() => dispatch({ type: 'toggleDiff' })} style={toggleStyle(state.showDiff)}>
            {state.showDiff ? t.diffOn : t.diffOff}
          </button>
          <button onClick={() => dispatch({ type: 'toggleWeekend' })} style={toggleStyle(state.showWeekend)}>
            {state.showWeekend ? t.weekendOn : t.weekendOff}
          </button>
        </Section>

        {autoLaunch.state?.supported && (
          <Section title={t.sStartup}>
            <button
              onClick={() => void autoLaunch.toggle()}
              disabled={autoLaunch.busy}
              style={{ ...toggleStyle(autoLaunch.state.enabled), opacity: autoLaunch.busy ? 0.6 : 1 }}
            >
              {autoLaunch.state.enabled ? t.autoLaunchOn : t.autoLaunchOff}
            </button>
          </Section>
        )}

        <Section title={t.sData}>
          <p style={{ margin: 0, fontSize: 12, color: C.text3, lineHeight: 1.6, textWrap: 'pretty' }}>
            {t.sDataBody}
          </p>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => void backup.exportNow()} disabled={backup.busy} style={fileButtonStyle}>
              {t.sExport}
            </button>
            <button onClick={() => void backup.pick()} disabled={backup.busy} style={fileButtonStyle}>
              {t.sImport}
            </button>
          </div>
          <p style={{ margin: '-2px 0 0', fontSize: 11.5, color: C.text4, lineHeight: 1.5, textWrap: 'pretty' }}>
            {t.sBackupHint}
          </p>

          {backup.pending ? (
            <ImportConfirm
              pending={backup.pending}
              t={t}
              onConfirm={backup.confirm}
              onCancel={backup.cancel}
            />
          ) : (
            <StatusNote status={backup.status} t={t} />
          )}

          {/* Below the line the data goes away rather than to a file. */}
          <hr style={{ margin: '2px 0 0', border: 'none', borderTop: `1px solid ${C.borderLighter}` }} />

          {/* Sample data is an empty-timeline offer: once anything has been
              written — trashed items included — it would only be in the way. */}
          {state.items.length === 0 && (
            <button
              onClick={loadSample.onClick}
              style={{
                height: 36,
                borderRadius: 8,
                border: `1px solid ${C.borderStrong}`,
                background: loadSample.armed ? C.fill : C.surface,
                color: C.text2,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {loadSample.armed ? t.confirmAgain : t.sSample}
            </button>
          )}
          <button onClick={reset.onClick} style={destructiveStyle(reset.armed)}>
            {reset.armed ? t.confirmAgain : t.sReset}
          </button>
        </Section>
      </div>
    </Drawer>
  )
}

/**
 * A picked file is described before it is applied, never after: the count comes
 * from the file itself, so the user confirms against what is really in there.
 */
function ImportConfirm({
  pending,
  t,
  onConfirm,
  onCancel,
}: {
  pending: PendingImport
  t: Strings
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: '12px 13px',
        borderRadius: 10,
        border: `1px solid ${C.accentTintBorder}`,
        background: C.accentTint,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: C.text,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {t.backupPending(pending.name)}
        </span>
        <span style={{ fontSize: 11.5, color: C.text3, lineHeight: 1.5, textWrap: 'pretty' }}>
          {t.backupPendingBody(pending.items)}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onConfirm}
          style={{
            flex: 1,
            height: 34,
            borderRadius: 8,
            border: 'none',
            background: C.accent,
            color: C.surface,
            fontSize: 12.5,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {t.backupApply}
        </button>
        <button
          onClick={onCancel}
          style={{
            flex: '0 0 auto',
            height: 34,
            padding: '0 16px',
            borderRadius: 8,
            border: `1px solid ${C.borderStrong}`,
            background: C.surface,
            color: C.text2,
            fontSize: 12.5,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {t.cancel}
        </button>
      </div>
    </div>
  )
}

/** One line of feedback after a file was written, read, or rejected. */
function StatusNote({ status, t }: { status: BackupStatus; t: Strings }) {
  if (!status) return null
  const bad = status.kind === 'invalid' || status.kind === 'failed'
  const text =
    status.kind === 'exported'
      ? t.backupExported
      : status.kind === 'imported'
        ? t.backupImported(status.items)
        : status.kind === 'invalid'
          ? t.backupInvalid
          : t.backupFailed
  return (
    <p
      role="status"
      style={{
        margin: 0,
        fontSize: 11.5,
        fontWeight: 600,
        lineHeight: 1.5,
        color: bad ? C.accent : C.positive,
        textWrap: 'pretty',
      }}
    >
      {text}
    </p>
  )
}

/** Drag handle + colour swatch + editable name + delete, one row per category. */
function CategoryRow({
  cat,
  usage,
  canRemove,
  canReorder,
  dragging,
  onGrab,
  onNudge,
  lang,
  t,
  dispatch,
}: {
  cat: Category
  usage: number
  canRemove: boolean
  canReorder: boolean
  dragging: boolean
  onGrab: (e: PointerEvent<HTMLElement>) => void
  onNudge: (e: KeyboardEvent) => void
  lang: 'ko' | 'en'
  t: Strings
  dispatch: Dispatch<Action>
}) {
  return (
    <div
      {...{ [REORDER_ROW_ATTR]: '' }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        // The row stays in the flow while it is dragged; only the tint says
        // which one is moving, and the order on screen is already the real one.
        background: dragging ? C.fill : 'transparent',
        borderRadius: 8,
        boxShadow: dragging ? `0 0 0 4px ${C.fill}` : 'none',
      }}
    >
      <button
        onPointerDown={canReorder ? onGrab : undefined}
        onKeyDown={canReorder ? onNudge : undefined}
        disabled={!canReorder}
        title={t.catReorder}
        aria-label={t.catReorder}
        style={{
          width: 18,
          height: 30,
          border: 'none',
          background: 'transparent',
          color: dragging ? C.text3 : C.text5,
          fontSize: 13,
          lineHeight: 1,
          letterSpacing: '-0.14em',
          padding: 0,
          flex: '0 0 auto',
          cursor: !canReorder ? 'default' : dragging ? 'grabbing' : 'grab',
          opacity: canReorder ? 1 : 0.35,
          // The gesture is the button's whole job; a browser drag would fight it.
          touchAction: 'none',
        }}
      >
        ⋮⋮
      </button>

      <label
        title={t.catColor}
        style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          background: cat.color,
          border: `1px solid ${C.border}`,
          cursor: 'pointer',
          flex: '0 0 auto',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <input
          type="color"
          value={cat.color}
          onChange={(e) => dispatch({ type: 'patchCategory', id: cat.id, patch: { color: e.target.value } })}
          style={{ opacity: 0, width: '100%', height: '100%', cursor: 'pointer', border: 'none', padding: 0 }}
        />
      </label>

      <input
        value={catLabel(cat, lang)}
        onChange={(e) => dispatch({ type: 'patchCategory', id: cat.id, patch: { name: e.target.value } })}
        placeholder={t.catNamePh}
        style={{
          flex: 1,
          minWidth: 0,
          height: 30,
          padding: '0 10px',
          borderRadius: 8,
          border: `1px solid ${C.borderStrong}`,
          fontSize: 12.5,
          color: C.text,
          background: C.surface,
          outline: 'none',
        }}
      />

      <span
        style={{
          fontSize: 10.5,
          color: C.text5,
          width: 40,
          textAlign: 'right',
          flex: '0 0 auto',
          whiteSpace: 'nowrap',
        }}
      >
        {t.items(usage)}
      </span>

      <button
        onClick={() => dispatch({ type: 'removeCategory', id: cat.id })}
        disabled={!canRemove}
        title={t.catDelete}
        aria-label={t.catDelete}
        style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          border: `1px solid ${canRemove ? C.destructiveBorder : C.border}`,
          background: C.surface,
          color: canRemove ? C.accent : C.text5,
          fontSize: 12,
          cursor: canRemove ? 'pointer' : 'default',
          flex: '0 0 auto',
          padding: 0,
          opacity: canRemove ? 1 : 0.5,
        }}
      >
        ✕
      </button>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: C.text4, letterSpacing: '0.06em' }}>{title}</span>
      {children}
    </div>
  )
}
