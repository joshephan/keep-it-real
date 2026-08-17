import { useEffect, type ReactNode } from 'react'
import { C, SHADOW } from '../tokens'

/** Centered modal over a dimmed backdrop. Backdrop click and Esc close it. */
export function Modal({
  width,
  zIndex,
  onClose,
  children,
}: {
  width: number
  zIndex: number
  onClose: () => void
  children: ReactNode
}) {
  useEscape(onClose)
  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: C.modalBackdrop,
        zIndex,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          // Never wider or taller than the window, however it is resized.
          width: `min(${width}px, calc(100vw - 48px))`,
          maxHeight: 'calc(100vh - 48px)',
          overflowY: 'auto',
          background: C.surface,
          borderRadius: 14,
          boxShadow: SHADOW.modal,
          animation: 'kirFade 0.18s ease',
        }}
      >
        {children}
      </div>
    </div>
  )
}

/** Right-hand drawer used by trash and settings. */
export function Drawer({
  zIndex,
  onClose,
  children,
}: {
  zIndex: number
  onClose: () => void
  children: ReactNode
}) {
  useEscape(onClose)
  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: C.drawerBackdrop,
        zIndex,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      <div
        style={{
          width: 'min(400px, calc(100vw - 72px))',
          height: '100%',
          background: C.surface,
          boxShadow: SHADOW.drawer,
          display: 'flex',
          flexDirection: 'column',
          animation: 'kirFade 0.18s ease',
        }}
      >
        {children}
      </div>
    </div>
  )
}

function useEscape(onClose: () => void): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])
}
