import type { ColScale, ViewMode } from './types'

/** Design tokens — mirrors the handoff's token table one-for-one. */
export const C = {
  canvas: '#EEF0F2',
  surface: '#FFFFFF',
  muted: '#FBFBFC',
  footer: '#FCFCFD',
  input: '#F7F8F9',
  fill: '#F1F3F5',
  borderStrong: '#DFE3E7',
  border: '#E1E5E9',
  borderLight: '#E9ECEF',
  borderLighter: '#EEF0F2',
  borderRow: '#EBEEF1',
  grid: '#EFF1F3',
  text: '#1A1D21',
  text2: '#4B535C',
  text3: '#6B7280',
  text4: '#8A9199',
  text5: '#A2A9B0',
  accent: '#B5442E',
  accentDark: '#8E3423',
  positive: '#2E6B63',
  accentTint: '#FBF2EF',
  accentTintBorder: '#F0D9D2',
  destructiveBorder: '#E7D4CF',
  positiveTint: '#EEF5F3',
  weekend: 'rgba(120,130,140,0.045)',
  todayTint: 'rgba(181,68,46,0.06)',
  todayLine: 'rgba(181,68,46,0.45)',
  modalBackdrop: 'rgba(18,21,25,0.42)',
  drawerBackdrop: 'rgba(18,21,25,0.32)',
  dashedCard: '#D4D9DE',
} as const

export const MONO = "'JetBrains Mono', ui-monospace, monospace"
export const SANS = "'Instrument Sans', system-ui, sans-serif"

export const SHADOW = {
  bar: '0 1px 2px rgba(16,20,26,0.16)',
  /** Lifted off the grid while a bar is being dragged to another column. */
  barDrag: '0 8px 20px rgba(16,20,26,0.26)',
  seg: '0 1px 2px rgba(16,20,26,0.10)',
  modal: '0 24px 64px rgba(16,20,26,0.28)',
  drawer: '-14px 0 46px rgba(16,20,26,0.18)',
} as const

/** Column widths per view, and the row geometry shared by both lanes. */
export const COL_W: Record<ViewMode, number> = { day: 128, week: 168, month: 300, year: 360 }

/**
 * How far the width slider may stretch a column, as a multiple of `COL_W`. The
 * floor is set by the day view's header label ("8월 17일"), the ceiling by how
 * much empty grid stays useful.
 */
export const COL_SCALE = { min: 0.6, max: 2.5, step: 0.05, default: 1 } as const

export const clampColScale = (n: number): number =>
  Number.isFinite(n) ? Math.min(COL_SCALE.max, Math.max(COL_SCALE.min, n)) : COL_SCALE.default

/** Every view starts at its designed width until the user drags the slider. */
export const defaultColScale = (): ColScale => ({
  day: COL_SCALE.default,
  week: COL_SCALE.default,
  month: COL_SCALE.default,
  year: COL_SCALE.default,
})
export const BAR_H = 30
export const ROW_PITCH = 36
export const LANE_TOP = 10
export const LANE_PAD_BOTTOM = 24
