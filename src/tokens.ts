import type { ColScale, ViewMode } from './types'

/** Design tokens — mirrors the handoff's token table one-for-one. */
const LIGHT = {
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
  /** Text sitting on a solid accent or category fill — white in both themes. */
  onFill: '#FFFFFF',
  /** The pill on a plan bar, which has to read over a tinted bar. */
  chip: 'rgba(255,255,255,0.85)',
  scrollThumb: '#C9CED4',
  /**
   * How far category colours are lifted towards white when used as text or
   * outline. The palette is tuned for a light surface; on a dark one the
   * darker categories would all but disappear.
   */
  lift: '0%',
} as const

type Palette = Record<keyof typeof LIGHT, string>

const DARK: Palette = {
  canvas: '#0E1012',
  surface: '#16181B',
  muted: '#1A1D20',
  footer: '#191C1F',
  input: '#1D2024',
  fill: '#23272B',
  borderStrong: '#30353B',
  border: '#2C3136',
  borderLight: '#272B30',
  borderLighter: '#23272B',
  borderRow: '#25292E',
  grid: '#212529',
  text: '#E6E8EB',
  text2: '#C0C5CB',
  text3: '#9AA1A9',
  text4: '#7E868F',
  text5: '#646B74',
  accent: '#D9694F',
  accentDark: '#E8907B',
  positive: '#5DAA9E',
  accentTint: '#2A1D19',
  accentTintBorder: '#4A2E26',
  destructiveBorder: '#4A2F29',
  positiveTint: '#16262A',
  weekend: 'rgba(255,255,255,0.025)',
  todayTint: 'rgba(217,105,79,0.10)',
  todayLine: 'rgba(217,105,79,0.55)',
  modalBackdrop: 'rgba(0,0,0,0.55)',
  drawerBackdrop: 'rgba(0,0,0,0.45)',
  dashedCard: '#3A4047',
  onFill: '#FFFFFF',
  chip: 'rgba(22,24,27,0.85)',
  scrollThumb: '#3A4047',
  lift: '38%',
}

const cssName = (key: string) => `--kir-${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`

/**
 * Components reference colours through CSS variables, so switching theme is a
 * single attribute on <html> rather than a re-render of every inline style.
 */
export const C = Object.fromEntries(
  Object.keys(LIGHT).map((key) => [key, `var(${cssName(key)})`]),
) as { readonly [K in keyof typeof LIGHT]: string }

const declarations = (palette: Palette) =>
  Object.entries(palette)
    .map(([key, value]) => `${cssName(key)}:${value};`)
    .join('')

/** Both palettes as a stylesheet, keyed on the resolved `data-theme`. */
export const THEME_CSS =
  `:root{color-scheme:light;${declarations(LIGHT)}}` +
  `:root[data-theme='dark']{color-scheme:dark;${declarations(DARK)}}`

/** Window background before the renderer paints, per resolved theme. */
export const CANVAS = { light: LIGHT.canvas, dark: DARK.canvas } as const

/** A category colour made legible as text or outline on the current surface. */
export const ink = (color: string): string => `color-mix(in srgb, #FFFFFF ${C.lift}, ${color})`

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

/** Height of the horizontal scrollbar, as styled in styles.css. */
export const SCROLLBAR_H = 10

/** A closed lane keeps just enough height to show its name and reopen it. */
export const LANE_CLOSED_H = 34
/** Bounds on the actual lane's share while both lanes are open. */
export const LANE_SPLIT = { min: 0.15, max: 0.85, default: 0.5, step: 0.05 } as const

export const clampLaneSplit = (n: number): number =>
  Number.isFinite(n) ? Math.min(LANE_SPLIT.max, Math.max(LANE_SPLIT.min, n)) : LANE_SPLIT.default
