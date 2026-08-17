import { describe, expect, it } from 'vitest'
import { backupFileName, liveItemCount, parseBackup, serializeBackup } from './backup'
import { defaultCategories } from './categories'
import type { Item, PersistedState } from '../types'

function item(over: Partial<Item> = {}): Item {
  return {
    id: 'a',
    kind: 'plan',
    title: 'Write it down',
    cat: 'work',
    start: '2026-08-17',
    end: '2026-08-17',
    startTime: null,
    endTime: null,
    note: '',
    done: false,
    actualId: null,
    sourceId: null,
    deleted: false,
    deletedAt: null,
    ...over,
  }
}

function store(over: Partial<PersistedState> = {}): PersistedState {
  return {
    version: 1,
    items: [item()],
    cats: defaultCategories(),
    lang: 'ko',
    view: 'week',
    colScale: { day: 1, week: 1.5, month: 1, year: 1 },
    showDiff: true,
    showWeekend: false,
    ...over,
  }
}

describe('backup round trip', () => {
  it('brings every persisted field back unchanged', () => {
    const original = store()
    const back = parseBackup(serializeBackup(original, '2026-08-17'))
    expect(back).toEqual(original)
  })

  it('keeps times, notes and trashed items', () => {
    const original = store({
      items: [
        item({ id: 'x', startTime: '09:00', endTime: '10:30', note: 'with a note' }),
        item({ id: 'y', deleted: true, deletedAt: '2026-08-10' }),
      ],
    })
    expect(parseBackup(serializeBackup(original, '2026-08-17'))).toEqual(original)
  })

  it('reads the app store file itself, not just the export envelope', () => {
    const original = store()
    const back = parseBackup(JSON.stringify(original))
    expect(back).toEqual(original)
  })

  it('drops fields an older or hand-edited file got wrong', () => {
    const back = parseBackup(
      JSON.stringify({
        items: [{ id: 'a', title: 'kept', start: '2026-08-17', startTime: '25:00' }],
        cats: [],
        view: 'decade',
        colScale: { week: 99 },
      }),
    )
    expect(back?.items).toHaveLength(1)
    // Out-of-range time dropped, missing end filled in from start.
    expect(back?.items[0].startTime).toBeNull()
    expect(back?.items[0].end).toBe('2026-08-17')
    // Unknown view and an absurd column width fall back to the defaults.
    expect(back?.view).toBe('week')
    expect(back?.colScale.week).toBe(2.5)
    // An empty category list would leave items unassignable.
    expect(back?.cats.length).toBeGreaterThan(0)
  })
})

describe('parseBackup rejection', () => {
  it('rejects text that is not JSON', () => {
    expect(parseBackup('not json at all')).toBeNull()
  })

  it('rejects JSON that carries no items array', () => {
    expect(parseBackup('{"hello":"world"}')).toBeNull()
    expect(parseBackup('[1,2,3]')).toBeNull()
    expect(parseBackup('null')).toBeNull()
  })

  it('rejects an envelope whose state is missing', () => {
    expect(parseBackup('{"format":"keep-it-real.backup","version":1}')).toBeNull()
  })
})

describe('summary', () => {
  it('counts only items still on the timeline', () => {
    const s = store({ items: [item({ id: 'a' }), item({ id: 'b', deleted: true })] })
    expect(liveItemCount(s)).toBe(1)
  })

  it('names the file after the day it was written', () => {
    expect(backupFileName('2026-08-17')).toBe('keep-it-real-2026-08-17.json')
  })
})
