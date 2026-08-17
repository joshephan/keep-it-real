import { describe, expect, it } from 'vitest'
import { stampText } from './item'

const day = { start: '2026-07-20', end: '2026-07-20' }
const span = { start: '2026-07-20', end: '2026-07-28' }

describe('stampText', () => {
  it('shows dates only for all-day items', () => {
    expect(stampText({ ...day, startTime: null, endTime: null })).toBe('07.20')
    expect(stampText({ ...span, startTime: null, endTime: null })).toBe('07.20–07.28')
  })

  it('folds the clock into a single day', () => {
    expect(stampText({ ...day, startTime: '14:00', endTime: null })).toBe('07.20 14:00')
    expect(stampText({ ...day, startTime: '14:00', endTime: '15:30' })).toBe('07.20 14:00–15:30')
  })

  it('repeats the date on both ends of a timed range', () => {
    expect(stampText({ ...span, startTime: '14:00', endTime: '18:00' })).toBe('07.20 14:00–07.28 18:00')
    expect(stampText({ ...span, startTime: null, endTime: '18:00' })).toBe('07.20–07.28 18:00')
  })
})
