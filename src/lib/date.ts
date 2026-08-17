/**
 * Date helpers. Everything is a local-midnight `YYYY-MM-DD` string; no UTC, no
 * time-of-day, so ISO strings also sort lexicographically.
 */

export const pad = (n: number): string => String(n).padStart(2, '0')

export const iso = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export function parseISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export const todayISO = (): string => iso(new Date())

export function addDays(s: string, n: number): string {
  const d = parseISO(s)
  d.setDate(d.getDate() + n)
  return iso(d)
}

/** Whole days from `a` to `b`; negative when `b` is earlier. */
export function diffDays(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000)
}

/** Monday-based week start. */
export function startOfWeek(s: string): string {
  const d = parseISO(s)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return iso(d)
}

export function startOfMonth(s: string): string {
  const d = parseISO(s)
  return iso(new Date(d.getFullYear(), d.getMonth(), 1))
}

export function endOfMonth(s: string): string {
  const d = parseISO(s)
  return iso(new Date(d.getFullYear(), d.getMonth() + 1, 0))
}

export function addMonths(s: string, n: number): string {
  const d = parseISO(s)
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(d.getDate(), lastDay))
  return iso(target)
}

/** Months between the two dates' month starts. */
export function diffMonths(a: string, b: string): number {
  const x = parseISO(a)
  const y = parseISO(b)
  return (y.getFullYear() - x.getFullYear()) * 12 + (y.getMonth() - x.getMonth())
}

/** Monday = 0 … Sunday = 6. */
export function weekdayIndex(s: string): number {
  return (parseISO(s).getDay() + 6) % 7
}

/** ISO-8601 week number (the week containing that year's first Thursday). */
export function isoWeek(s: string): number {
  const d = parseISO(s)
  const thursday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const firstThursday = new Date(thursday.getFullYear(), 0, 4)
  const offset = (firstThursday.getDay() + 6) % 7
  firstThursday.setDate(firstThursday.getDate() - offset + 3)
  return 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * 86400000))
}

export const minDate = (a: string, b: string): string => (b < a ? b : a)
export const maxDate = (a: string, b: string): string => (b > a ? b : a)

/** `07.20` for a single day, `07.20–07.28` for a range. */
export function rangeText(start: string, end?: string | null): string {
  const s = start.slice(5).replace('-', '.')
  if (!end || end === start) return s
  return `${s}–${end.slice(5).replace('-', '.')}`
}
