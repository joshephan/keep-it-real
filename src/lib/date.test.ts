import { describe, expect, it } from 'vitest'
import { addDays, diffDays, isoWeek, rangeText, startOfWeek, endOfMonth, addMonths } from './date'

describe('date helpers', () => {
  it('adds and subtracts days across month boundaries', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('measures signed day differences', () => {
    expect(diffDays('2026-08-14', '2026-07-28')).toBe(-17)
    expect(diffDays('2026-08-14', '2026-08-19')).toBe(5)
    expect(diffDays('2026-08-14', '2026-08-14')).toBe(0)
  })

  it('starts weeks on Monday', () => {
    expect(startOfWeek('2026-08-17')).toBe('2026-08-17') // a Monday
    expect(startOfWeek('2026-08-23')).toBe('2026-08-17') // the Sunday after
  })

  it('computes ISO week numbers', () => {
    expect(isoWeek('2026-08-17')).toBe(34)
    expect(isoWeek('2026-01-01')).toBe(1)
    expect(isoWeek('2025-12-29')).toBe(1) // belongs to 2026's first week
  })

  it('formats single days and ranges', () => {
    expect(rangeText('2026-07-20', '2026-07-20')).toBe('07.20')
    expect(rangeText('2026-07-20', '2026-07-28')).toBe('07.20–07.28')
  })

  it('handles month arithmetic without overflowing', () => {
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28')
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
  })
})
