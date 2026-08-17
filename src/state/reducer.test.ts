import { describe, expect, it } from 'vitest'
import { editDraft, initialState, newDraft, reducer, type State } from './reducer'
import { COL_SCALE, defaultColScale } from '../tokens'
import { systemLang } from '../lib/locale'
import type { Item } from '../types'

const plan: Item = {
  id: 'p1',
  kind: 'plan',
  title: '포트폴리오 리뉴얼',
  cat: 'work',
  start: '2026-07-06',
  end: '2026-08-14',
  startTime: null,
  endTime: null,
  note: '',
  done: false,
  actualId: null,
  sourceId: null,
  deleted: false,
  deletedAt: null,
}

const withItems = (items: Item[]): State => ({ ...initialState, hydrated: true, items })

describe('item editing', () => {
  it('adds a new item from a draft', () => {
    let s = reducer(withItems([]), { type: 'openForm', draft: newDraft('plan', '2026-08-17', 'work') })
    s = reducer(s, { type: 'patchForm', patch: { title: '  새 목표  ' } })
    s = reducer(s, { type: 'saveForm', newId: 'new1' })

    expect(s.form).toBeNull()
    expect(s.items).toHaveLength(1)
    expect(s.items[0]).toMatchObject({ id: 'new1', kind: 'plan', title: '새 목표', start: '2026-08-17', end: '2026-08-17' })
  })

  it('saves an item that has only a note', () => {
    let s = reducer(withItems([]), { type: 'openForm', draft: newDraft('actual', '2026-08-17', 'work') })
    s = reducer(s, { type: 'patchForm', patch: { note: '병원 다녀옴' } })
    s = reducer(s, { type: 'saveForm', newId: 'new1' })

    expect(s.items).toHaveLength(1)
    expect(s.items[0]).toMatchObject({ title: '', note: '병원 다녀옴' })
  })

  it('saves nothing when both the title and the note are blank', () => {
    let s = reducer(withItems([]), { type: 'openForm', draft: newDraft('actual', '2026-08-17', 'work') })
    s = reducer(s, { type: 'patchForm', patch: { title: '   ', note: ' \n ' } })
    s = reducer(s, { type: 'saveForm', newId: 'new1' })
    expect(s.items).toHaveLength(0)
    expect(s.form).toBeNull()
  })

  it('keeps end pinned to start while single-day is on', () => {
    let s = reducer(withItems([]), { type: 'openForm', draft: newDraft('plan', '2026-08-17', 'work') })
    s = reducer(s, { type: 'patchForm', patch: { end: '2026-08-25' } })
    expect(s.form?.end).toBe('2026-08-17')
  })

  it('saves an all-day item when the time was never asked for', () => {
    let s = reducer(withItems([]), { type: 'openForm', draft: newDraft('plan', '2026-08-17', 'work') })
    expect(s.form?.timed).toBe(false)
    s = reducer(s, { type: 'patchForm', patch: { title: '산책' } })
    s = reducer(s, { type: 'saveForm', newId: 'new1' })
    expect(s.items[0]).toMatchObject({ startTime: null, endTime: null })
  })

  it('stores the times once the draft is timed', () => {
    let s = reducer(withItems([]), { type: 'openForm', draft: newDraft('plan', '2026-08-17', 'work') })
    s = reducer(s, {
      type: 'patchForm',
      patch: { title: '치과', timed: true, startTime: '14:00', endTime: '15:30' },
    })
    s = reducer(s, { type: 'saveForm', newId: 'new1' })
    expect(s.items[0]).toMatchObject({ startTime: '14:00', endTime: '15:30' })
  })

  it('pulls a single-day end time along when the start time passes it', () => {
    let s = reducer(withItems([]), { type: 'openForm', draft: newDraft('plan', '2026-08-17', 'work') })
    s = reducer(s, { type: 'patchForm', patch: { timed: true, startTime: '09:00', endTime: '10:00' } })
    s = reducer(s, { type: 'patchForm', patch: { startTime: '16:00' } })
    expect(s.form?.endTime).toBe('16:00')
  })

  it('leaves the times alone across a multi-day range', () => {
    let s = reducer(withItems([]), { type: 'openForm', draft: newDraft('plan', '2026-08-17', 'work') })
    s = reducer(s, {
      type: 'patchForm',
      patch: { single: false, end: '2026-08-19', timed: true, startTime: '22:00', endTime: '07:00' },
    })
    expect(s.form?.endTime).toBe('07:00')
  })

  it('drops the times again when the time is switched back off', () => {
    let s = reducer(withItems([{ ...plan, startTime: '14:00', endTime: '15:30' }]), {
      type: 'openForm',
      draft: editDraft({ ...plan, startTime: '14:00', endTime: '15:30' }),
    })
    expect(s.form?.timed).toBe(true)
    s = reducer(s, { type: 'patchForm', patch: { timed: false } })
    s = reducer(s, { type: 'saveForm', newId: 'unused' })
    expect(s.items[0]).toMatchObject({ startTime: null, endTime: null })
  })

  it('snaps an end date that precedes the start', () => {
    let s = reducer(withItems([plan]), { type: 'openForm', draft: editDraft(plan) })
    s = reducer(s, { type: 'patchForm', patch: { single: false, end: '2026-06-01' } })
    s = reducer(s, { type: 'saveForm', newId: 'unused' })
    expect(s.items[0].end).toBe('2026-07-06')
  })
})

describe('promotion', () => {
  const promoted = (): State => {
    let s = withItems([plan])
    s = reducer(s, {
      type: 'openPromote',
      draft: { id: 'p1', name: plan.title, planRange: '07.06–08.14', planEnd: '2026-08-14', start: '2026-07-20', end: '2026-07-28' },
    })
    return reducer(s, { type: 'confirmPromote', newId: 'a1' })
  }

  it('copies the plan onto the actual track without touching the original', () => {
    const s = promoted()
    const p = s.items.find((i) => i.id === 'p1')!
    const a = s.items.find((i) => i.id === 'a1')!

    // Invariant 1: promotion never edits the plan's dates.
    expect(p.start).toBe('2026-07-06')
    expect(p.end).toBe('2026-08-14')
    expect(p.done).toBe(true)
    expect(p.actualId).toBe('a1')

    expect(a).toMatchObject({ kind: 'actual', start: '2026-07-20', end: '2026-07-28', sourceId: 'p1' })
    expect(a.title).toBe(plan.title)
  })

  it('carries the plan times onto the copy', () => {
    const timed = { ...plan, startTime: '09:30', endTime: '11:00' }
    let s = reducer(withItems([timed]), {
      type: 'openPromote',
      draft: { id: 'p1', name: timed.title, planRange: '', planEnd: '2026-08-14', start: '2026-07-20', end: '2026-07-20' },
    })
    s = reducer(s, { type: 'confirmPromote', newId: 'a1' })
    expect(s.items.find((i) => i.id === 'a1')).toMatchObject({ startTime: '09:30', endTime: '11:00' })
  })

  it('pulls the end along when the start moves past it', () => {
    let s = reducer(withItems([plan]), {
      type: 'openPromote',
      draft: { id: 'p1', name: plan.title, planRange: '', planEnd: '2026-08-14', start: '2026-07-20', end: '2026-07-28' },
    })
    s = reducer(s, { type: 'patchPromote', patch: { start: '2026-08-01' } })
    expect(s.promote?.end).toBe('2026-08-01')
  })

  it('undoes a promotion by removing the copy', () => {
    let s = promoted()
    s = reducer(s, { type: 'openForm', draft: editDraft(s.items.find((i) => i.id === 'p1')!) })
    s = reducer(s, { type: 'unpromote' })

    expect(s.items.find((i) => i.id === 'a1')).toBeUndefined()
    const p = s.items.find((i) => i.id === 'p1')!
    expect(p.done).toBe(false)
    expect(p.actualId).toBeNull()
    expect(p.start).toBe('2026-07-06')
  })
})

describe('dragging a bar to another column', () => {
  it('moves the dates and leaves everything else alone', () => {
    const s = reducer(withItems([plan]), {
      type: 'moveItem',
      id: 'p1',
      start: '2026-07-09',
      end: '2026-08-17',
    })
    expect(s.items[0]).toMatchObject({
      start: '2026-07-09',
      end: '2026-08-17',
      title: plan.title,
      cat: 'work',
      done: false,
    })
  })

  it('does not drag the other half of a promoted pair along', () => {
    let s = withItems([plan])
    s = reducer(s, {
      type: 'openPromote',
      draft: { id: 'p1', name: plan.title, planRange: '', planEnd: '2026-08-14', start: '2026-07-20', end: '2026-07-28' },
    })
    s = reducer(s, { type: 'confirmPromote', newId: 'a1' })
    s = reducer(s, { type: 'moveItem', id: 'a1', start: '2026-07-23', end: '2026-07-31' })

    // The actual moved; the plan it came from kept its own dates and its link.
    expect(s.items.find((i) => i.id === 'a1')).toMatchObject({ start: '2026-07-23', end: '2026-07-31' })
    expect(s.items.find((i) => i.id === 'p1')).toMatchObject({
      start: '2026-07-06',
      end: '2026-08-14',
      done: true,
      actualId: 'a1',
    })
  })

  it('ignores an id that is no longer there', () => {
    const s = reducer(withItems([plan]), { type: 'moveItem', id: 'gone', start: '2026-01-01', end: '2026-01-01' })
    expect(s.items).toEqual([plan])
  })
})

describe('categories', () => {
  it('renames and recolours without touching item links', () => {
    let s = reducer(withItems([plan]), { type: 'patchCategory', id: 'work', patch: { name: '업무' } })
    s = reducer(s, { type: 'patchCategory', id: 'work', patch: { color: '#123456' } })

    expect(s.cats.find((c) => c.id === 'work')).toMatchObject({ name: '업무', color: '#123456' })
    expect(s.items[0].cat).toBe('work')
  })

  it('adds a category', () => {
    const s = reducer(withItems([]), {
      type: 'addCategory',
      category: { id: 'c9', name: '취미', color: '#2F5D8A' },
    })
    expect(s.cats.at(-1)).toMatchObject({ id: 'c9', name: '취미' })
  })

  it('moves orphaned items to the first remaining category on removal', () => {
    const s = reducer(withItems([plan]), { type: 'removeCategory', id: 'work' })

    expect(s.cats.some((c) => c.id === 'work')).toBe(false)
    expect(s.items[0].cat).toBe(s.cats[0].id)
  })

  it('resets the category filter when the selected category is removed', () => {
    const s = reducer({ ...withItems([]), cat: 'work' }, { type: 'removeCategory', id: 'work' })
    expect(s.cat).toBe('all')
  })

  it('refuses to remove the last category', () => {
    const single = { ...withItems([]), cats: [{ id: 'work', name: null, color: '#B5442E' }] }
    expect(reducer(single, { type: 'removeCategory', id: 'work' }).cats).toHaveLength(1)
  })
})

describe('two-stage delete', () => {
  it('soft-deletes into the trash, keeping the record', () => {
    let s = reducer(withItems([plan]), { type: 'openForm', draft: editDraft(plan) })
    s = reducer(s, { type: 'trashItem', at: '2026-08-17' })

    expect(s.items).toHaveLength(1)
    expect(s.items[0]).toMatchObject({ deleted: true, deletedAt: '2026-08-17' })
  })

  it('restores a trashed item', () => {
    let s = reducer(withItems([{ ...plan, deleted: true, deletedAt: '2026-08-17' }]), {
      type: 'restore',
      id: 'p1',
    })
    expect(s.items[0]).toMatchObject({ deleted: false, deletedAt: null })
  })

  it('only destroys records from the trash', () => {
    const items = [plan, { ...plan, id: 'p2', deleted: true, deletedAt: '2026-08-17' }]
    expect(reducer(withItems(items), { type: 'purge', id: 'p2' }).items).toHaveLength(1)
    expect(reducer(withItems(items), { type: 'emptyTrash' }).items.map((i) => i.id)).toEqual(['p1'])
  })
})

describe('hydration', () => {
  const stored = {
    version: 1 as const,
    items: [],
    cats: [],
    lang: 'en' as const,
    view: 'month' as const,
    colScale: { ...defaultColScale(), month: 1.5 },
    showDiff: false,
    showWeekend: false,
  }

  it('restores the saved view, language and display settings', () => {
    const s = reducer(initialState, { type: 'hydrate', payload: stored })
    expect(s).toMatchObject({ hydrated: true, view: 'month', lang: 'en', showDiff: false, showWeekend: false })
    expect(s.colScale.month).toBe(1.5)
  })

  it('keeps the chosen view after switching it', () => {
    const s = reducer(reducer(initialState, { type: 'hydrate', payload: stored }), {
      type: 'setView',
      view: 'day',
    })
    expect(s.view).toBe('day')
  })

  it('falls back to defaults when there is nothing stored yet', () => {
    const s = reducer(initialState, { type: 'hydrate', payload: null })
    expect(s).toMatchObject({ hydrated: true, view: 'week', lang: systemLang(), langPref: null })
  })

  it('follows the desktop language until one is picked in Settings', () => {
    const s = reducer(initialState, { type: 'hydrate', payload: { ...stored, lang: null } })
    expect(s).toMatchObject({ lang: systemLang(), langPref: null })
    expect(reducer(s, { type: 'setLang', lang: 'ko' })).toMatchObject({ lang: 'ko', langPref: 'ko' })
  })
})

describe('axis window', () => {
  it('grows into the past a step at a time', () => {
    let s = reducer(initialState, { type: 'expandAxis', direction: 'past' })
    expect(s.axisPad).toMatchObject({ past: 6, future: 0 }) // week view step
    s = reducer(s, { type: 'expandAxis', direction: 'past' })
    expect(s.axisPad).toMatchObject({ past: 12, future: 0 })
  })

  it('uses a step sized for the current view', () => {
    const day = reducer({ ...initialState, view: 'day' }, { type: 'expandAxis', direction: 'future' })
    expect(day.axisPad).toMatchObject({ past: 0, future: 2 })

    const year = reducer({ ...initialState, view: 'year' }, { type: 'expandAxis', direction: 'past' })
    expect(year.axisPad).toMatchObject({ past: 120, future: 0 })
  })

  it('forgets how far it scrolled when the view changes', () => {
    const scrolled = reducer(initialState, { type: 'expandAxis', direction: 'past' })
    const switched = reducer(scrolled, { type: 'setView', view: 'month' })
    expect(switched.axisPad).toMatchObject({ past: 0, future: 0 })
  })
})

describe('column width', () => {
  it('applies the width to the view on screen only', () => {
    const s = reducer(initialState, { type: 'setColScale', scale: 1.8 })
    expect(s.colScale).toMatchObject({ week: 1.8, day: 1, month: 1, year: 1 })
  })

  it('clamps a width outside the slider range', () => {
    expect(reducer(initialState, { type: 'setColScale', scale: 12 }).colScale.week).toBe(COL_SCALE.max)
    expect(reducer(initialState, { type: 'setColScale', scale: 0 }).colScale.week).toBe(COL_SCALE.min)
  })

  it('keeps each view at its own width when switching between them', () => {
    let s = reducer(initialState, { type: 'setColScale', scale: 1.5 })
    s = reducer(s, { type: 'setView', view: 'day' })
    expect(s.colScale.day).toBe(1)
    s = reducer(s, { type: 'setView', view: 'week' })
    expect(s.colScale.week).toBe(1.5)
  })
})
