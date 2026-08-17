import { describe, expect, it } from 'vitest'
import { callTool, ToolError } from './tools.mjs'
import { emptyStore } from './store.mjs'

/**
 * The MCP tools write straight into the same file the app reads, so the rules
 * that matter are the ones the reducer also guarantees: promotion never moves
 * the plan, deletion is two steps, and nothing invalid reaches the store.
 */

const plan = {
  id: 'p1',
  kind: 'plan',
  title: '포트폴리오 리뉴얼',
  cat: 'work',
  start: '2026-07-06',
  end: '2026-07-10',
  startTime: null,
  endTime: null,
  note: '',
  done: false,
  actualId: null,
  sourceId: null,
  deleted: false,
  deletedAt: null,
}

const withItems = (items) => ({ ...emptyStore(), items })

/** Tools return `{ store, result }`; most assertions want one or the other. */
const run = (store, name, args) => callTool(store, name, args)

describe('create_item', () => {
  it('adds an all-day plan and fills in the rest of the record', () => {
    const { store, result } = run(withItems([]), 'create_item', {
      kind: 'plan',
      title: '  새 목표  ',
      start: '2026-08-17',
    })

    expect(store.items).toHaveLength(1)
    expect(result.item).toMatchObject({
      kind: 'plan',
      title: '새 목표',
      cat: 'etc',
      start: '2026-08-17',
      end: '2026-08-17',
      startTime: null,
      endTime: null,
      done: false,
      deleted: false,
    })
  })

  it('accepts an item that has only a note', () => {
    const { result } = run(withItems([]), 'create_item', {
      kind: 'actual',
      note: '병원 다녀옴',
      start: '2026-08-17',
    })
    expect(result.item).toMatchObject({ title: '', note: '병원 다녀옴' })
  })

  it('refuses an item with neither a title nor a note', () => {
    expect(() => run(withItems([]), 'create_item', { kind: 'plan', start: '2026-08-17' })).toThrow(
      ToolError,
    )
  })

  it('refuses a range that runs backwards, a bad date and an unknown category', () => {
    const base = { kind: 'plan', title: 'x', start: '2026-08-17' }
    expect(() => run(withItems([]), 'create_item', { ...base, end: '2026-08-01' })).toThrow(/before start/)
    expect(() => run(withItems([]), 'create_item', { ...base, start: '2026-02-30' })).toThrow(/real date/)
    expect(() => run(withItems([]), 'create_item', { ...base, category: 'nope' })).toThrow(/unknown category/)
  })

  it('refuses an end time earlier than the start time on the same day', () => {
    expect(() =>
      run(withItems([]), 'create_item', {
        kind: 'plan',
        title: 'x',
        start: '2026-08-17',
        start_time: '14:00',
        end_time: '09:00',
      }),
    ).toThrow(/before start_time/)
  })

  it('allows the same pair of times across two days', () => {
    const { result } = run(withItems([]), 'create_item', {
      kind: 'plan',
      title: 'x',
      start: '2026-08-17',
      end: '2026-08-18',
      start_time: '14:00',
      end_time: '09:00',
    })
    expect(result.item).toMatchObject({ startTime: '14:00', endTime: '09:00' })
  })

  it('reports a mistyped argument instead of ignoring it', () => {
    expect(() =>
      run(withItems([]), 'create_item', { kind: 'plan', title: 'x', start: '2026-08-17', starttime: '09:00' }),
    ).toThrow(/unknown argument/)
  })
})

describe('update_item', () => {
  it('touches only the fields it is given', () => {
    const { store, result } = run(withItems([plan]), 'update_item', { id: 'p1', title: '이름 변경' })
    expect(result.item).toMatchObject({ title: '이름 변경', start: '2026-07-06', end: '2026-07-10' })
    expect(store.items).toHaveLength(1)
  })

  it('keeps a single-day item single-day when only its start moves', () => {
    const single = [{ ...plan, end: plan.start }]
    const { result } = run(withItems(single), 'update_item', { id: 'p1', start: '2026-07-20' })
    expect(result.item).toMatchObject({ start: '2026-07-20', end: '2026-07-20' })
  })

  // Same as editing in the app: the form moves one end at a time, and only a
  // single-day item drags its end along.
  it('leaves a range end alone when only its start moves', () => {
    const { result } = run(withItems([plan]), 'update_item', { id: 'p1', start: '2026-07-08' })
    expect(result.item).toMatchObject({ start: '2026-07-08', end: '2026-07-10' })
  })

  it('clears the clock back to all-day with null', () => {
    const timed = [{ ...plan, startTime: '09:00', endTime: '10:00' }]
    const { result } = run(withItems(timed), 'update_item', { id: 'p1', start_time: null, end_time: null })
    expect(result.item).toMatchObject({ startTime: null, endTime: null })
  })

  it('refuses an id that is not in the store', () => {
    expect(() => run(withItems([plan]), 'update_item', { id: 'nope', title: 'x' })).toThrow(/no item with id/)
  })
})

describe('promotion', () => {
  it('copies the plan onto the actual track without moving the plan', () => {
    const { store, result } = run(withItems([plan]), 'promote_plan', {
      id: 'p1',
      start: '2026-06-20',
      end: '2026-06-24',
    })

    const saved = store.items.find((i) => i.id === 'p1')
    expect(saved).toMatchObject({ start: '2026-07-06', end: '2026-07-10', done: true })
    expect(saved.actualId).toBe(result.actual.id)
    expect(result.actual).toMatchObject({
      kind: 'actual',
      title: plan.title,
      cat: plan.cat,
      start: '2026-06-20',
      end: '2026-06-24',
      sourceId: 'p1',
    })
    expect(result.driftDays).toBe(-16)
  })

  it('uses the planned dates when none are given', () => {
    const { result } = run(withItems([plan]), 'promote_plan', { id: 'p1' })
    expect(result.actual).toMatchObject({ start: '2026-07-06', end: '2026-07-10' })
  })

  it('keeps the planned length when only a start is given', () => {
    const { result } = run(withItems([plan]), 'promote_plan', { id: 'p1', start: '2026-08-01' })
    expect(result.actual).toMatchObject({ start: '2026-08-01', end: '2026-08-05' })
  })

  it('refuses to promote twice, or to promote an actual', () => {
    const { store } = run(withItems([plan]), 'promote_plan', { id: 'p1' })
    expect(() => run(store, 'promote_plan', { id: 'p1' })).toThrow(/already promoted/)
    const actualId = store.items.find((i) => i.kind === 'actual').id
    expect(() => run(store, 'promote_plan', { id: actualId })).toThrow(/only plans can be promoted/)
  })

  it('unpromoting removes the copy and clears the link', () => {
    const promoted = run(withItems([plan]), 'promote_plan', { id: 'p1' }).store
    const { store } = run(promoted, 'unpromote_plan', { id: 'p1' })

    expect(store.items).toHaveLength(1)
    expect(store.items[0]).toMatchObject({ id: 'p1', done: false, actualId: null })
  })
})

describe('trash', () => {
  it('deletes in two steps and restores in between', () => {
    const trashed = run(withItems([plan]), 'delete_item', { id: 'p1' }).store
    expect(trashed.items[0].deleted).toBe(true)
    expect(trashed.items[0].deletedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    const restored = run(trashed, 'restore_item', { id: 'p1' }).store
    expect(restored.items[0]).toMatchObject({ deleted: false, deletedAt: null })

    const purged = run(trashed, 'delete_item', { id: 'p1', permanent: true }).store
    expect(purged.items).toHaveLength(0)
  })
})

describe('list_items', () => {
  const items = [
    { ...plan, id: 'a', kind: 'actual', title: '운동', cat: 'health', start: '2026-08-01', end: '2026-08-01' },
    { ...plan, id: 'b', title: '보고서', start: '2026-08-10', end: '2026-08-20' },
    { ...plan, id: 'c', title: '지운 것', start: '2026-08-12', end: '2026-08-12', deleted: true },
  ]
  const store = withItems(items)

  it('hides the trash and sorts by date', () => {
    const { result } = run(store, 'list_items', {})
    expect(result.items.map((i) => i.id)).toEqual(['a', 'b'])
    expect(result.total).toBe(2)
  })

  it('includes the trash when asked', () => {
    const { result } = run(store, 'list_items', { include_deleted: true })
    expect(result.items.map((i) => i.id)).toEqual(['a', 'b', 'c'])
  })

  it('matches a date window against the whole range, not just the start', () => {
    const { result } = run(store, 'list_items', { from: '2026-08-15', to: '2026-08-16' })
    expect(result.items.map((i) => i.id)).toEqual(['b'])
  })

  it('filters by track, category and text', () => {
    expect(run(store, 'list_items', { track: 'actual' }).result.items.map((i) => i.id)).toEqual(['a'])
    expect(run(store, 'list_items', { category: 'health' }).result.items.map((i) => i.id)).toEqual(['a'])
    expect(run(store, 'list_items', { query: '보고' }).result.items.map((i) => i.id)).toEqual(['b'])
  })

  it('never writes', () => {
    expect(run(store, 'list_items', {}).store).toBeNull()
    expect(run(store, 'list_categories', {}).store).toBeNull()
  })
})

describe('the store file', () => {
  it('keeps settings this server does not know about', () => {
    const store = { ...withItems([]), view: 'month', colScale: { week: 1.4 }, futureSetting: true }
    const { store: next } = run(store, 'create_item', { kind: 'plan', title: 'x', start: '2026-08-17' })
    expect(next).toMatchObject({ view: 'month', colScale: { week: 1.4 }, futureSetting: true })
  })

  it('reads the categories the user actually has', () => {
    const store = { ...emptyStore(), cats: [{ id: 'mine', name: '내 것', color: '#123456' }], items: [] }
    const { result } = run(store, 'list_categories', {})
    expect(result.categories).toEqual([{ id: 'mine', name: '내 것', label: '내 것', color: '#123456' }])
    // With no `etc` to fall back on, a new item lands in the only category there is.
    const created = run(store, 'create_item', { kind: 'plan', title: 'x', start: '2026-08-17' })
    expect(created.result.item.cat).toBe('mine')
  })
})
