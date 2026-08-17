import { C, MONO } from '../tokens'
import { useApp } from '../state/AppContext'
import { Drawer } from '../ui/Overlay'
import { iconButton } from '../ui/primitives'
import { rangeText } from '../lib/date'
import { displayTitle } from '../lib/item'
import { useConfirm } from '../hooks/useConfirm'

/** Stage two of the two-stage delete: this is the only place records die. */
export function TrashDrawer() {
  const { state, dispatch, t } = useApp()
  const close = () => dispatch({ type: 'setTrashOpen', open: false })
  const trashed = state.items.filter((i) => i.deleted)
  const emptyAll = useConfirm(() => dispatch({ type: 'emptyTrash' }))

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
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>
            {t.trash}
          </h3>
          <p style={{ margin: 0, fontSize: 11.5, color: C.text4 }}>{t.trashHint}</p>
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={close} style={{ ...iconButton, color: C.text3 }} aria-label="close">
          ✕
        </button>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '14px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 9,
        }}
      >
        {trashed.map((item) => (
          <div
            key={item.id}
            style={{
              padding: '13px 14px',
              border: `1px solid ${C.borderRow}`,
              borderRadius: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 9,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: 5,
                  background: C.fill,
                  color: C.text3,
                  flex: '0 0 auto',
                }}
              >
                {item.kind === 'plan' ? t.plan : t.actual}
              </span>
              <span
                style={{
                  fontSize: 13.5,
                  fontWeight: 600,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {displayTitle(item, t.untitled)}
              </span>
            </div>
            <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.text4 }}>
              {rangeText(item.start, item.end)}
              {'  ·  '}
              {t.deletedAt(item.deletedAt ?? '')}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => dispatch({ type: 'restore', id: item.id })}
                style={{
                  height: 30,
                  padding: '0 12px',
                  borderRadius: 7,
                  border: `1px solid ${C.borderStrong}`,
                  background: C.surface,
                  color: C.text,
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {t.restore}
              </button>
              <button
                onClick={() => dispatch({ type: 'purge', id: item.id })}
                style={{
                  height: 30,
                  padding: '0 12px',
                  borderRadius: 7,
                  border: `1px solid ${C.destructiveBorder}`,
                  background: C.surface,
                  color: C.accent,
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {t.purge}
              </button>
            </div>
          </div>
        ))}

        {trashed.length === 0 && (
          <div style={{ padding: '44px 20px', textAlign: 'center', color: C.text5, fontSize: 12.5 }}>
            {t.trashEmpty}
          </div>
        )}
      </div>

      <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.borderLighter}`, background: C.footer }}>
        <button
          onClick={emptyAll.onClick}
          disabled={trashed.length === 0}
          style={{
            width: '100%',
            height: 36,
            borderRadius: 8,
            border: `1px solid ${C.destructiveBorder}`,
            background: emptyAll.armed ? C.accentTint : C.surface,
            color: C.accent,
            fontSize: 12.5,
            fontWeight: 600,
            cursor: trashed.length === 0 ? 'default' : 'pointer',
            opacity: trashed.length === 0 ? 0.5 : 1,
          }}
        >
          {emptyAll.armed ? t.confirmAgain : t.emptyTrashBtn}
        </button>
      </div>
    </Drawer>
  )
}
