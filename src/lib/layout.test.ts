import { describe, expect, it } from 'vitest'
import { createAxis } from './axis'
import { layoutBars } from './layout'
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
  it('covers today plus padding, snapped to whole months', () => {
    expect(axis.rangeStart).toBe('2026-06-01')
    expect(axis.rangeEnd).toBe('2027-02-28')
  })

  it('grows to include items outside the default window', () => {
    const wide = createAxis('month', [item('x', '2025-11-02', '2025-11-04')], '2026-08-17', 'ko')
    expect(wide.rangeStart).toBe('2025-11-01')
  })

  it('clamps out-of-range dates onto the first and last column', () => {
    expect(axis.colIndex('2020-01-01')).toBe(0)
    expect(axis.colIndex('2030-01-01')).toBe(axis.cols.length - 1)
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
