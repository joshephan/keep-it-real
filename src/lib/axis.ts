import type { Item, Lang, ViewMode } from '../types'
import { clampColScale, COL_SCALE, COL_W } from '../tokens'
import {
  addDays,
  addMonths,
  diffDays,
  diffMonths,
  endOfMonth,
  isoWeek,
  maxDate,
  minDate,
  pad,
  parseISO,
  startOfMonth,
  startOfWeek,
  weekdayIndex,
  iso,
} from './date'

export interface Column {
  /** First date covered by the column. */
  date: string
  label: string
  sub: string
  weekend: boolean
}

export interface Axis {
  view: ViewMode
  /** First and last date the axis covers. */
  rangeStart: string
  rangeEnd: string
  /** How many columns the range covers. */
  count: number
  /** The column at `i`, built on demand rather than held in an array. */
  colAt: (i: number) => Column
  /** Width of one column in pixels, after the user's width setting. */
  colW: number
  /** Total pixel width of the track. */
  total: number
  /** Column index for a date, clamped into the axis range. */
  colIndex: (date: string) => number
  /** True once the range has reached the first / last date the app draws. */
  atMin: boolean
  atMax: boolean
}

/**
 * The two ends of the timeline. Scrolling grows the axis, but not for ever:
 * past these dates there is nothing worth planning against, and the column
 * count stops being something the renderer can carry.
 */
export const MIN_DATE = '1900-01-01'
export const MAX_DATE = '2100-12-31'

export const clampDate = (date: string): string =>
  date < MIN_DATE ? MIN_DATE : date > MAX_DATE ? MAX_DATE : date

/** Extra months the axis has grown by, past and future, from scrolling or jumping. */
export interface AxisPad {
  past: number
  future: number
}

export const NO_PAD: AxisPad = { past: 0, future: 0 }

/** Runway kept around today before any scrolling, in months. */
const BASE_PAD: Record<ViewMode, AxisPad> = {
  day: { past: 1, future: 2 },
  week: { past: 2, future: 6 },
  month: { past: 6, future: 12 },
  year: { past: 36, future: 60 },
}

/**
 * How much further the axis grows each time a scroll reaches an edge. Sized per
 * view so one step is roughly a screenful rather than a handful of columns.
 */
export const EXPAND_MONTHS: Record<ViewMode, number> = {
  day: 2,
  month: 24,
  week: 6,
  year: 120,
}

/**
 * The visible time range is derived from the data, a window around today, and
 * however far the user has scrolled beyond it. Reaching either end grows the
 * range rather than stopping the scroll, up to `MIN_DATE` / `MAX_DATE`.
 */
export function axisRange(
  items: Item[],
  today: string,
  view: ViewMode,
  extra: AxisPad = NO_PAD,
): { start: string; end: string } {
  const base = BASE_PAD[view]
  let lo = addMonths(clampDate(today), -(base.past + extra.past))
  let hi = addMonths(clampDate(today), base.future + extra.future)
  for (const it of items) {
    if (it.deleted) continue
    lo = minDate(lo, it.start)
    hi = maxDate(hi, it.end || it.start)
  }
  // Both edges are month aligned first, then clamped: the limits are themselves
  // a month start and a month end, so the alignment survives the clamp.
  return { start: maxDate(startOfMonth(lo), MIN_DATE), end: minDate(endOfMonth(hi), MAX_DATE) }
}

/**
 * Extra padding needed for `date` to fall inside the axis, or null when it
 * already does. Range edges are month aligned, so months are the unit. A date
 * outside the limits reveals nothing new — the nearest edge is as far as the
 * axis goes — so it reports null and the caller scrolls to that edge.
 */
export function padToReveal(axis: Axis, current: AxisPad, date: string): AxisPad | null {
  const target = clampDate(date)
  if (target >= axis.rangeStart && target <= axis.rangeEnd) return null
  if (target < axis.rangeStart) {
    return { ...current, past: current.past + diffMonths(target, axis.rangeStart) + 1 }
  }
  return { ...current, future: current.future + diffMonths(axis.rangeEnd, target) + 1 }
}

const DAY_NAMES: Record<Lang, string[]> = {
  ko: ['월', '화', '수', '목', '금', '토', '일'],
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
}

const MONTH_NAMES: Record<Lang, string[]> = {
  ko: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
  en: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
}

/** How many columns of this view it takes to cover `start`…`end`. */
function columnCount(view: ViewMode, start: string, end: string): number {
  if (view === 'day') return diffDays(start, end) + 1
  if (view === 'week') return Math.floor(diffDays(startOfWeek(start), end) / 7) + 1
  if (view === 'year') return parseISO(end).getFullYear() - parseISO(start).getFullYear() + 1
  return diffMonths(start, end) + 1
}

/**
 * The column at `i`, built on demand. Nothing holds them all: at day scale a
 * range stretched back to 1900 is tens of thousands of columns, and only the
 * few dozen under the viewport are ever worth the allocation.
 */
function columnAt(view: ViewMode, start: string, lang: Lang, i: number): Column {
  const ko = lang === 'ko'

  if (view === 'day') {
    const date = addDays(start, i)
    const d = parseISO(date)
    const wd = weekdayIndex(date)
    return {
      date,
      label: `${d.getMonth() + 1}${ko ? '월 ' : '/'}${d.getDate()}${ko ? '일' : ''}`,
      sub: DAY_NAMES[lang][wd],
      weekend: wd > 4,
    }
  }

  if (view === 'week') {
    const date = addDays(startOfWeek(start), i * 7)
    const a = parseISO(date)
    const b = parseISO(addDays(date, 6))
    return {
      date,
      label: `${a.getMonth() + 1}${ko ? '월 ' : '/'}${a.getDate()} – ${b.getMonth() + 1}/${b.getDate()}`,
      sub: `W${pad(isoWeek(date))}`,
      weekend: false,
    }
  }

  if (view === 'year') {
    const y = parseISO(start).getFullYear() + i
    return { date: `${y}-01-01`, label: ko ? `${y}년` : String(y), sub: '', weekend: false }
  }

  const a = parseISO(start)
  const d = new Date(a.getFullYear(), a.getMonth() + i, 1)
  return {
    date: iso(d),
    label: MONTH_NAMES[lang][d.getMonth()],
    sub: String(d.getFullYear()),
    weekend: false,
  }
}

export function createAxis(
  view: ViewMode,
  items: Item[],
  today: string,
  lang: Lang,
  extra: AxisPad = NO_PAD,
  scale: number = COL_SCALE.default,
): Axis {
  const { start, end } = axisRange(items, today, view, extra)
  const count = columnCount(view, start, end)
  // Whole pixels only: a fractional column width makes the grid lines shimmer
  // as the timeline scrolls.
  const colW = Math.round(COL_W[view] * clampColScale(scale))

  const clamp = (date: string): string => (date < start ? start : date > end ? end : date)

  const colIndex = (date: string): number => {
    const s = clamp(date)
    let idx: number
    if (view === 'day') idx = diffDays(start, s)
    else if (view === 'week') idx = Math.floor(diffDays(startOfWeek(start), startOfWeek(s)) / 7)
    else if (view === 'year') idx = parseISO(s).getFullYear() - parseISO(start).getFullYear()
    else idx = diffMonths(start, s)
    return Math.min(Math.max(idx, 0), Math.max(0, count - 1))
  }

  return {
    view,
    rangeStart: start,
    rangeEnd: end,
    count,
    colAt: (i) => columnAt(view, start, lang, i),
    colW,
    total: count * colW,
    colIndex,
    atMin: start <= MIN_DATE,
    atMax: end >= MAX_DATE,
  }
}

/**
 * Where an item lands after being dragged `cols` columns sideways. A column is
 * whatever the current view calls one, so the same gesture nudges a day, a
 * week, a month or a year. The span in days rides along unchanged.
 */
export function shiftByColumns(
  item: Pick<Item, 'start' | 'end'>,
  view: ViewMode,
  cols: number,
): { start: string; end: string } {
  const from = item.start
  const start =
    view === 'day'
      ? addDays(from, cols)
      : view === 'week'
        ? addDays(from, cols * 7)
        : view === 'month'
          ? addMonths(from, cols)
          : addMonths(from, cols * 12)
  const span = Math.max(0, diffDays(item.start, item.end || item.start))
  return { start, end: addDays(start, span) }
}

/** Year(s) shown in the gutter header cell. */
export function axisYearLabel(axis: Axis): string {
  const a = axis.rangeStart.slice(0, 4)
  const b = axis.rangeEnd.slice(0, 4)
  return a === b ? a : `${a}–${b.slice(2)}`
}
