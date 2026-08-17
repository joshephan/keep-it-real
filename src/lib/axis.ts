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
  cols: Column[]
  /** Width of one column in pixels, after the user's width setting. */
  colW: number
  /** Total pixel width of the track. */
  total: number
  /** Column index for a date, clamped into the axis range. */
  colIndex: (date: string) => number
}

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
 * however far the user has scrolled beyond it. There is no fixed edge: reaching
 * either end grows the range instead of stopping.
 */
export function axisRange(
  items: Item[],
  today: string,
  view: ViewMode,
  extra: AxisPad = NO_PAD,
): { start: string; end: string } {
  const base = BASE_PAD[view]
  let lo = addMonths(today, -(base.past + extra.past))
  let hi = addMonths(today, base.future + extra.future)
  for (const it of items) {
    if (it.deleted) continue
    lo = minDate(lo, it.start)
    hi = maxDate(hi, it.end || it.start)
  }
  return { start: startOfMonth(lo), end: endOfMonth(hi) }
}

/**
 * Extra padding needed for `date` to fall inside the axis, or null when it
 * already does. Range edges are month aligned, so months are the unit.
 */
export function padToReveal(axis: Axis, current: AxisPad, date: string): AxisPad | null {
  if (date >= axis.rangeStart && date <= axis.rangeEnd) return null
  if (date < axis.rangeStart) {
    return { ...current, past: current.past + diffMonths(date, axis.rangeStart) + 1 }
  }
  return { ...current, future: current.future + diffMonths(axis.rangeEnd, date) + 1 }
}

function buildColumns(view: ViewMode, start: string, end: string, lang: Lang): Column[] {
  const ko = lang === 'ko'
  const out: Column[] = []

  if (view === 'day') {
    const n = diffDays(start, end) + 1
    const names = ko ? ['월', '화', '수', '목', '금', '토', '일'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    for (let i = 0; i < n; i++) {
      const date = addDays(start, i)
      const d = parseISO(date)
      const wd = weekdayIndex(date)
      out.push({
        date,
        label: `${d.getMonth() + 1}${ko ? '월 ' : '/'}${d.getDate()}${ko ? '일' : ''}`,
        sub: names[wd],
        weekend: wd > 4,
      })
    }
    return out
  }

  if (view === 'week') {
    let date = startOfWeek(start)
    while (diffDays(date, end) >= 0) {
      const a = parseISO(date)
      const b = parseISO(addDays(date, 6))
      out.push({
        date,
        label: `${a.getMonth() + 1}${ko ? '월 ' : '/'}${a.getDate()} – ${b.getMonth() + 1}/${b.getDate()}`,
        sub: `W${pad(isoWeek(date))}`,
        weekend: false,
      })
      date = addDays(date, 7)
    }
    return out
  }

  if (view === 'year') {
    const first = parseISO(start).getFullYear()
    const last = parseISO(end).getFullYear()
    for (let y = first; y <= last; y++) {
      out.push({ date: `${y}-01-01`, label: ko ? `${y}년` : String(y), sub: '', weekend: false })
    }
    return out
  }

  const months = ko
    ? ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']
    : [
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
      ]
  const a = parseISO(start)
  const n = diffMonths(start, end) + 1
  for (let i = 0; i < n; i++) {
    const d = new Date(a.getFullYear(), a.getMonth() + i, 1)
    out.push({ date: iso(d), label: months[d.getMonth()], sub: String(d.getFullYear()), weekend: false })
  }
  return out
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
  const cols = buildColumns(view, start, end, lang)
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
    return Math.min(Math.max(idx, 0), Math.max(0, cols.length - 1))
  }

  return { view, rangeStart: start, rangeEnd: end, cols, colW, total: cols.length * colW, colIndex }
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
