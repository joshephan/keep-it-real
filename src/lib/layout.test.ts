import { describe, expect, it } from 'vitest'
import { createAxis, padToReveal, shiftByColumns } from './axis'
import { layoutBars } from './layout'
import { COL_SCALE, COL_W } from '../tokens'
import type { Item } from '../types'

const item = (id: string, start: string, end: string, startTime: string | null = null): Item => ({
  id,
  kind: 'plan',
  title: id,
  cat: 'work',
  start,
  end,
  startTime,
  endTime: null,
  note: '',
  done: false,
  actualId: null,
  sourceId: null,
  deleted: false,
  deletedAt: null,
})

const axis = createAxis('day', [], '2026-08-17', 'ko')

describe('axis', () => {
  it('covers today plus a per-view window, snapped to whole months', () => {
    // day view keeps a tight window; year view needs several years of runway
    expect(axis.rangeStart).toBe('2026-07-01')
    expect(axis.rangeEnd).toBe('2026-10-31')

    const years = createAxis('year', [], '2026-08-17', 'ko')
    expect(years.rangeStart).toBe('2023-08-01')
    expect(years.rangeEnd).toBe('2031-08-31')
  })

  it('grows to include items outside the default window', () => {
    const wide = createAxis('month', [item('x', '2025-11-02', '2025-11-04')], '2026-08-17', 'ko')
    expect(wide.rangeStart).toBe('2025-11-01')
  })

  it('extends into the past and future by the requested padding', () => {
    const back = createAxis('day', [], '2026-08-17', 'ko', { past: 6, future: 0 })
    expect(back.rangeStart).toBe('2026-01-01')
    expect(back.rangeEnd).toBe(axis.rangeEnd)

    const forward = createAxis('day', [], '2026-08-17', 'ko', { past: 0, future: 12 })
    expect(forward.rangeEnd).toBe('2027-10-31')
  })

  it('gives one column per year in year view', () => {
    const years = createAxis('year', [], '2026-08-17', 'ko')
    expect(years.cols.map((c) => c.label)).toEqual([
      '2023년',
      '2024년',
      '2025년',
      '2026년',
      '2027년',
      '2028년',
      '2029년',
      '2030년',
      '2031년',
    ])
    expect(years.colIndex('2026-05-05')).toBe(3)
    expect(years.colIndex('2029-12-31')).toBe(6)
  })

  it('reports the padding needed to reveal a date outside the range', () => {
    const current = { past: 0, future: 0 }
    expect(padToReveal(axis, current, '2026-08-01')).toBeNull()
    expect(padToReveal(axis, current, '2025-12-25')).toMatchObject({ past: 8 })
    expect(padToReveal(axis, current, '2027-03-02')).toMatchObject({ future: 6 })
  })

  it('scales the column width, and the track total with it', () => {
    const wide = createAxis('day', [], '2026-08-17', 'ko', undefined, 1.5)
    expect(wide.colW).toBe(Math.round(COL_W.day * 1.5))
    expect(wide.total).toBe(wide.cols.length * wide.colW)
    // Columns are unchanged, so a date still lands on the same one.
    expect(wide.colIndex('2026-08-17')).toBe(axis.colIndex('2026-08-17'))
  })

  it('refuses a width outside the slider range', () => {
    expect(createAxis('day', [], '2026-08-17', 'ko', undefined, 99).colW).toBe(
      Math.round(COL_W.day * COL_SCALE.max),
    )
  })

  it('clamps out-of-range dates onto the first and last column', () => {
    expect(axis.colIndex('2020-01-01')).toBe(0)
    expect(axis.colIndex('2030-01-01')).toBe(axis.cols.length - 1)
  })
})

describe('shifting an item by columns', () => {
  const span = item('x', '2026-08-17', '2026-08-20')

  it('moves by one column of whatever the view is showing', () => {
    expect(shiftByColumns(span, 'day', 3)).toEqual({ start: '2026-08-20', end: '2026-08-23' })
    expect(shiftByColumns(span, 'week', 1)).toEqual({ start: '2026-08-24', end: '2026-08-27' })
    expect(shiftByColumns(span, 'month', 1)).toEqual({ start: '2026-09-17', end: '2026-09-20' })
    expect(shiftByColumns(span, 'year', 1)).toEqual({ start: '2027-08-17', end: '2027-08-20' })
  })

  it('moves backwards too, and keeps the span in days', () => {
    expect(shiftByColumns(span, 'day', -2)).toEqual({ start: '2026-08-15', end: '2026-08-18' })
    expect(shiftByColumns(span, 'week', -2)).toEqual({ start: '2026-08-03', end: '2026-08-06' })
  })

  it('leaves a single-day item single-day', () => {
    expect(shiftByColumns(item('x', '2026-08-17', '2026-08-17'), 'day', 4)).toEqual({
      start: '2026-08-21',
      end: '2026-08-21',
    })
  })

  it('does not overflow a short month when moving by months', () => {
    expect(shiftByColumns(item('x', '2026-01-31', '2026-01-31'), 'month', 1)).toEqual({
      start: '2026-02-28',
      end: '2026-02-28',
    })
  })
})

describe('lane packing', () => {
  it('stacks overlapping bars onto separate lanes', () => {
    const { boxes, laneCount } = layoutBars(
      [item('a', '2026-08-10', '2026-08-20'), item('b', '2026-08-12', '2026-08-22')],
      axis,
    )
    expect(laneCount).toBe(2)
    expect(boxes.map((b) => b.lane)).toEqual([0, 1])
  })

  it('reuses a lane once the previous bar has ended', () => {
    const { boxes, laneCount } = layoutBars(
      [item('a', '2026-08-01', '2026-08-03'), item('b', '2026-08-20', '2026-08-22')],
      axis,
    )
    expect(laneCount).toBe(1)
    expect(boxes.every((b) => b.lane === 0)).toBe(true)
  })

  it('orders same-day bars by their start time, all-day first', () => {
    const { boxes } = layoutBars(
      [
        item('afternoon', '2026-08-17', '2026-08-17', '14:00'),
        item('allday', '2026-08-17', '2026-08-17'),
        item('morning', '2026-08-17', '2026-08-17', '09:00'),
      ],
      axis,
    )
    expect(boxes.map((b) => b.item.id)).toEqual(['allday', 'morning', 'afternoon'])
  })

  it('gives single-day bars a readable minimum width', () => {
    const { boxes } = layoutBars([item('a', '2026-08-17', '2026-08-17')], axis)
    expect(boxes[0].width).toBeGreaterThanOrEqual(52)
  })
})
