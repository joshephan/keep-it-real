import type { Item, Lang, ViewMode } from '../types'
import { COL_W } from '../tokens'
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
  colW: number
  /** Total pixel width of the track. */
  total: number
  /** Column index for a date, clamped into the axis range. */
  colIndex: (date: string) => number
}

/** Months of empty runway kept around today so there is always somewhere to scroll. */
const PAST_PADDING_MONTHS = 2
const FUTURE_PADDING_MONTHS = 6

/**
 * The visible time range is derived from the data plus a window around today —
 * the prototype's hard-coded 2026 range does not survive into the real app.
 */
export function axisRange(items: Item[], today: string): { start: string; end: string } {
  let lo = addMonths(today, -PAST_PADDING_MONTHS)
  let hi = addMonths(today, FUTURE_PADDING_MONTHS)
  for (const it of items) {
    if (it.deleted) continue
    lo = minDate(lo, it.start)
    hi = maxDate(hi, it.end || it.start)
  }
  return { start: startOfMonth(lo), end: endOfMonth(hi) }
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

export function createAxis(view: ViewMode, items: Item[], today: string, lang: Lang): Axis {
  const { start, end } = axisRange(items, today)
  const cols = buildColumns(view, start, end, lang)
  const colW = COL_W[view]

  const clamp = (date: string): string => (date < start ? start : date > end ? end : date)

  const colIndex = (date: string): number => {
    const s = clamp(date)
    let idx: number
    if (view === 'day') idx = diffDays(start, s)
    else if (view === 'week') idx = Math.floor(diffDays(startOfWeek(start), startOfWeek(s)) / 7)
    else idx = diffMonths(start, s)
    return Math.min(Math.max(idx, 0), Math.max(0, cols.length - 1))
  }

  return { view, rangeStart: start, rangeEnd: end, cols, colW, total: cols.length * colW, colIndex }
}

/** Year(s) shown in the gutter header cell. */
export function axisYearLabel(axis: Axis): string {
  const a = axis.rangeStart.slice(0, 4)
  const b = axis.rangeEnd.slice(0, 4)
  return a === b ? a : `${a}–${b.slice(2)}`
}
