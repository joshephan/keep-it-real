import type { CSSProperties, ReactNode } from 'react'
import { C, MONO, SHADOW } from '../tokens'

/** Shared style builders so both calendars — and both modals — stay identical. */

export const segButton = (active: boolean, tight = false): CSSProperties => ({
  height: 26,
  padding: tight ? '0 9px' : '0 13px',
  borderRadius: 6,
  border: 'none',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
  background: active ? C.surface : 'transparent',
  color: active ? C.text : C.text4,
  boxShadow: active ? SHADOW.seg : 'none',
})

export const pill = (active: boolean, color: string): CSSProperties => ({
  height: 26,
  padding: '0 10px',
  borderRadius: 20,
  cursor: 'pointer',
  fontSize: 11.5,
  fontWeight: 600,
  border: `1px solid ${active ? color : C.border}`,
  background: active ? color : C.surface,
  color: active ? C.surface : C.text3,
  whiteSpace: 'nowrap',
})

export const ghostButton: CSSProperties = {
  height: 30,
  padding: '0 11px',
  borderRadius: 7,
  border: `1px solid ${C.border}`,
  background: C.surface,
  color: C.text2,
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
  whiteSpace: 'nowrap',
  flex: '0 0 auto',
}

export const iconButton: CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 7,
  border: `1px solid ${C.border}`,
  background: C.surface,
  color: C.text2,
  cursor: 'pointer',
  fontSize: 14,
  flex: '0 0 auto',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
}

export const primaryButton: CSSProperties = {
  height: 36,
  padding: '0 18px',
  borderRadius: 8,
  border: 'none',
  background: C.accent,
  color: C.surface,
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
}

export const neutralButton: CSSProperties = {
  height: 36,
  padding: '0 16px',
  borderRadius: 8,
  border: `1px solid ${C.borderStrong}`,
  background: C.surface,
  color: C.text2,
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
}

export const dangerButton: CSSProperties = {
  height: 36,
  padding: '0 14px',
  borderRadius: 8,
  border: `1px solid ${C.destructiveBorder}`,
  background: C.surface,
  color: C.accent,
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
}

/** Two-state picker used for track, language, and any binary choice. */
export const choiceButton = (active: boolean, dashed = false): CSSProperties => ({
  height: 34,
  padding: '0 16px',
  borderRadius: 8,
  cursor: 'pointer',
  fontSize: 12.5,
  fontWeight: 600,
  border: `1px ${dashed ? 'dashed' : 'solid'} ${active ? (dashed ? C.text2 : C.text) : C.borderStrong}`,
  background: active ? (dashed ? C.fill : C.text) : C.surface,
  color: active ? (dashed ? C.text : C.surface) : C.text3,
})

export const inputStyle: CSSProperties = {
  height: 38,
  padding: '0 12px',
  borderRadius: 8,
  border: `1px solid ${C.borderStrong}`,
  fontSize: 13.5,
  color: C.text,
  background: C.surface,
  outline: 'none',
  width: '100%',
}

export const dateInputStyle: CSSProperties = {
  ...inputStyle,
  fontSize: 13,
  fontFamily: MONO,
}

/** Sits on the baseline of a field row — the single/range and time toggles. */
export const rowButton: CSSProperties = {
  height: 38,
  padding: '0 14px',
  borderRadius: 8,
  border: `1px solid ${C.borderStrong}`,
  background: C.surface,
  color: C.text2,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  flex: '0 0 auto',
}

export const fieldLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: C.text3,
  letterSpacing: '0.04em',
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 1, minWidth: 0 }}>
      <label style={fieldLabelStyle}>{label}</label>
      {children}
    </div>
  )
}

export const mono = (size: number, extra: CSSProperties = {}): CSSProperties => ({
  fontFamily: MONO,
  fontSize: size,
  ...extra,
})
