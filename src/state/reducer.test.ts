import { describe, expect, it } from 'vitest'
import { editDraft, initialState, newDraft, reducer, type State } from './reducer'
import type { Item } from '../types'

const plan: Item = {
  id: 'p1',
  kind: 'plan',
  title: '포트폴리오 리뉴얼',
  cat: 'work',
  start: '2026-07-06',
  end: '2026-08-14',
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
