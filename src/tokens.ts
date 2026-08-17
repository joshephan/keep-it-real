import type { ViewMode } from './types'

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
  seg: '0 1px 2px rgba(16,20,26,0.10)',
  modal: '0 24px 64px rgba(16,20,26,0.28)',
  drawer: '-14px 0 46px rgba(16,20,26,0.18)',
} as const

/** Column widths per view, and the row geometry shared by both lanes. */
export const COL_W: Record<ViewMode, number> = { day: 128, week: 168, month: 300 }
export const BAR_H = 30
export const ROW_PITCH = 36
export const LANE_TOP = 10
export const LANE_PAD_BOTTOM = 24
