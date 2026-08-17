import type { Item } from '../types'
import { dayText, rangeText } from './date'

/**
 * Items may be saved with only a note, so anywhere a title is displayed falls
 * back to the note's first line before giving up and showing "제목 없음".
 */
export function displayTitle(item: { title: string; note: string }, untitled: string): string {
  const title = item.title.trim()
  if (title) return title
  const firstLine = item.note.split('\n').map((l) => l.trim()).find(Boolean)
  return firstLine || untitled
}

export type Stamped = Pick<Item, 'start' | 'end' | 'startTime' | 'endTime'>

/**
 * The date stamp on a bar, with the clock folded in only when the item has one:
 * `07.20`, `07.20 14:00`, `07.20 14:00–15:30`, `07.20 14:00–07.28 18:00`.
 */
export function stampText(item: Stamped): string {
  if (!item.startTime && !item.endTime) return rangeText(item.start, item.end)

  const single = !item.end || item.end === item.start
  const from = item.startTime ? `${dayText(item.start)} ${item.startTime}` : dayText(item.start)
  if (single) return item.endTime ? `${from}–${item.endTime}` : from
  const to = item.endTime ? `${dayText(item.end)} ${item.endTime}` : dayText(item.end)
  return `${from}–${to}`
}
