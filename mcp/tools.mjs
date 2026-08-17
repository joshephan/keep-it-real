import { BUILTIN_LABELS, DEFAULT_CATEGORIES } from './store.mjs'

/**
 * The tool surface, kept free of I/O: every handler takes the parsed store and
 * returns `{ store, result }`, where a null store means "nothing to write".
 * `mcp/server.mjs` does the reading, writing and JSON-RPC around it, and
 * `mcp/tools.test.mjs` exercises the rules directly.
 */

export class ToolError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ToolError'
  }
}

function fail(message) {
  throw new ToolError(message)
}

// ---------------------------------------------------------------- validation

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

function has(args, key) {
  return Object.prototype.hasOwnProperty.call(args, key) && args[key] !== undefined
}

function asString(value, field) {
  if (typeof value !== 'string') fail(`${field} must be a string`)
  return value
}

function asBool(value, field) {
  if (typeof value !== 'boolean') fail(`${field} must be true or false`)
  return value
}

function asEnum(value, allowed, field) {
  const s = asString(value, field)
  if (!allowed.includes(s)) fail(`${field} must be one of: ${allowed.join(', ')}`)
  return s
}

function asInt(value, min, max, field) {
  if (typeof value !== 'number' || !Number.isInteger(value)) fail(`${field} must be a whole number`)
  if (value < min || value > max) fail(`${field} must be between ${min} and ${max}`)
  return value
}

/** Local `YYYY-MM-DD`, the only date shape the app stores. */
function asDate(value, field) {
  const s = asString(value, field)
  if (!DATE_RE.test(s)) fail(`${field} must be a YYYY-MM-DD date, got "${s}"`)
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) {
    fail(`${field} is not a real date: ${s}`)
  }
  return s
}

/** `HH:MM` 24-hour, or null — null is what makes an item all-day. */
function asTimeOrNull(value, field) {
  if (value === null || value === '') return null
  const s = asString(value, field)
  if (!TIME_RE.test(s)) fail(`${field} must be a HH:MM 24-hour time, or null for an all-day item`)
  return s
}

const pad = (n) => String(n).padStart(2, '0')

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function parseISO(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function addDays(s, n) {
  const d = parseISO(s)
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function diffDays(a, b) {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000)
}

function uid() {
  return `i${crypto.randomUUID()}`
}

// --------------------------------------------------------------- store access

function itemsOf(store) {
  return Array.isArray(store.items) ? store.items : []
}

function catsOf(store) {
  const cats = (Array.isArray(store.cats) ? store.cats : []).filter(
    (c) => c && typeof c === 'object' && typeof c.id === 'string' && c.id,
  )
  return cats.length ? cats : DEFAULT_CATEGORIES
}

function withItems(store, items) {
  return { ...store, items }
}

function findItem(store, id) {
  const item = itemsOf(store).find((i) => i.id === id)
  if (!item) fail(`no item with id "${id}" — call list_items to see the ids in use`)
  return item
}

/** Categories are user data, so an unknown id is a mistake worth reporting rather
 *  than silently inventing one. */
function resolveCategory(store, value) {
  const cats = catsOf(store)
  const id = asString(value, 'category')
  if (!cats.some((c) => c.id === id)) {
    fail(`unknown category "${id}". Available: ${cats.map((c) => c.id).join(', ')}`)
  }
  return id
}

function defaultCategory(store) {
  const cats = catsOf(store)
  return cats.some((c) => c.id === 'etc') ? 'etc' : cats[0].id
}

// ------------------------------------------------------------------ item rules

/** The same two invariants the reducer enforces: a range never runs backwards,
 *  and within one day neither does the clock. */
function checkOrder(item) {
  if (item.end < item.start) fail(`end (${item.end}) is before start (${item.start})`)
  if (item.start === item.end && item.startTime && item.endTime && item.endTime < item.startTime) {
    fail(`end_time (${item.endTime}) is before start_time (${item.startTime}) on the same day`)
  }
}

/** A title is optional as long as there is a note to identify the item by. */
function checkContent(item) {
  if (!item.title.trim() && !item.note.trim()) fail('an item needs a title, a note, or both')
}

function sortItems(items) {
  return [...items].sort(
    (a, b) =>
      a.start.localeCompare(b.start) ||
      (a.startTime ?? '').localeCompare(b.startTime ?? '') ||
      a.title.localeCompare(b.title),
  )
}

// ----------------------------------------------------------------------- tools

const TRACK_NOTE =
  'Tracks: "plan" is what was intended, "actual" is what happened. Promoting a plan copies it onto the actual track and leaves the plan where it is — the gap between the two is the whole point of the app.'

export const TOOLS = [
  {
    name: 'list_categories',
    description:
      'List the categories items can be filed under. Category ids are stable; a null name means the app is showing its own bilingual label for that built-in id.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run(store) {
      const cats = catsOf(store).map((c) => ({
        id: c.id,
        name: typeof c.name === 'string' ? c.name : null,
        label: typeof c.name === 'string' && c.name ? c.name : BUILTIN_LABELS[c.id]?.en ?? c.id,
        color: typeof c.color === 'string' ? c.color : null,
      }))
      return { store: null, result: { categories: cats } }
    },
  },

  {
    name: 'list_items',
    description: `Read schedule entries from either track, filtered by date range, category or text. ${TRACK_NOTE} Dates are local YYYY-MM-DD and times are HH:MM; an item with no times is all-day.`,
    inputSchema: {
      type: 'object',
      properties: {
        track: {
          type: 'string',
          enum: ['plan', 'actual', 'all'],
          description: 'Which track to read. Defaults to all.',
        },
        from: { type: 'string', description: 'Only items overlapping this date or later (YYYY-MM-DD).' },
        to: { type: 'string', description: 'Only items overlapping this date or earlier (YYYY-MM-DD).' },
        category: { type: 'string', description: 'Category id, as returned by list_categories.' },
        query: { type: 'string', description: 'Case-insensitive substring match on title and note.' },
        include_deleted: {
          type: 'boolean',
          description: 'Include items sitting in the trash. Defaults to false.',
        },
        limit: { type: 'integer', minimum: 1, maximum: 1000, description: 'Defaults to 200.' },
      },
      additionalProperties: false,
    },
    run(store, args) {
      const track = has(args, 'track') ? asEnum(args.track, ['plan', 'actual', 'all'], 'track') : 'all'
      const from = has(args, 'from') ? asDate(args.from, 'from') : null
      const to = has(args, 'to') ? asDate(args.to, 'to') : null
      if (from && to && to < from) fail(`to (${to}) is before from (${from})`)
      const category = has(args, 'category') ? resolveCategory(store, args.category) : null
      const query = has(args, 'query') ? asString(args.query, 'query').trim().toLowerCase() : ''
      const includeDeleted = has(args, 'include_deleted')
        ? asBool(args.include_deleted, 'include_deleted')
        : false
      const limit = has(args, 'limit') ? asInt(args.limit, 1, 1000, 'limit') : 200

      const matched = itemsOf(store).filter((i) => {
        if (!includeDeleted && i.deleted) return false
        if (track !== 'all' && i.kind !== track) return false
        if (category && i.cat !== category) return false
        // An item counts as being in the window when its range overlaps it.
        if (from && (i.end || i.start) < from) return false
        if (to && i.start > to) return false
        if (query) {
          const hay = `${i.title ?? ''}\n${i.note ?? ''}`.toLowerCase()
          if (!hay.includes(query)) return false
        }
        return true
      })

      const sorted = sortItems(matched)
      return {
        store: null,
        result: {
          total: sorted.length,
          returned: Math.min(sorted.length, limit),
          items: sorted.slice(0, limit),
        },
      }
    },
  },

  {
    name: 'create_item',
    description: `Add one entry to the plan or actual track. ${TRACK_NOTE} Give a title, a note, or both.`,
    inputSchema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['plan', 'actual'], description: 'Which track to add to.' },
        title: { type: 'string' },
        note: { type: 'string' },
        category: {
          type: 'string',
          description: 'Category id from list_categories. Defaults to "etc".',
        },
        start: { type: 'string', description: 'Start date, YYYY-MM-DD.' },
        end: { type: 'string', description: 'End date for a multi-day item. Defaults to start.' },
        start_time: {
          type: ['string', 'null'],
          description: 'HH:MM on the start date. Omit for an all-day item.',
        },
        end_time: { type: ['string', 'null'], description: 'HH:MM on the end date.' },
      },
      required: ['kind', 'start'],
      additionalProperties: false,
    },
    run(store, args) {
      const start = asDate(args.start, 'start')
      const item = {
        id: uid(),
        kind: asEnum(args.kind, ['plan', 'actual'], 'kind'),
        title: has(args, 'title') ? asString(args.title, 'title').trim() : '',
        cat: has(args, 'category') ? resolveCategory(store, args.category) : defaultCategory(store),
        start,
        end: has(args, 'end') ? asDate(args.end, 'end') : start,
        startTime: has(args, 'start_time') ? asTimeOrNull(args.start_time, 'start_time') : null,
        endTime: has(args, 'end_time') ? asTimeOrNull(args.end_time, 'end_time') : null,
        note: has(args, 'note') ? asString(args.note, 'note') : '',
        done: false,
        actualId: null,
        sourceId: null,
        deleted: false,
        deletedAt: null,
      }
      checkContent(item)
      checkOrder(item)
      return { store: withItems(store, [...itemsOf(store), item]), result: { item } }
    },
  },

  {
    name: 'update_item',
    description:
      'Change an existing entry. Only the fields you pass are touched; pass null for start_time or end_time to make the item all-day again.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        note: { type: 'string' },
        category: { type: 'string', description: 'Category id from list_categories.' },
        start: { type: 'string', description: 'YYYY-MM-DD.' },
        end: { type: 'string', description: 'YYYY-MM-DD.' },
        start_time: { type: ['string', 'null'], description: 'HH:MM, or null to clear.' },
        end_time: { type: ['string', 'null'], description: 'HH:MM, or null to clear.' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    run(store, args) {
      const id = asString(args.id, 'id')
      const current = findItem(store, id)
      const next = { ...current }
      if (has(args, 'title')) next.title = asString(args.title, 'title').trim()
      if (has(args, 'note')) next.note = asString(args.note, 'note')
      if (has(args, 'category')) next.cat = resolveCategory(store, args.category)
      if (has(args, 'start')) next.start = asDate(args.start, 'start')
      // Moving a single-day item's start alone keeps it single-day.
      if (has(args, 'start') && !has(args, 'end') && current.start === current.end) {
        next.end = next.start
      }
      if (has(args, 'end')) next.end = asDate(args.end, 'end')
      if (has(args, 'start_time')) next.startTime = asTimeOrNull(args.start_time, 'start_time')
      if (has(args, 'end_time')) next.endTime = asTimeOrNull(args.end_time, 'end_time')

      checkContent(next)
      checkOrder(next)
      const items = itemsOf(store).map((i) => (i.id === id ? next : i))
      return { store: withItems(store, items), result: { item: next } }
    },
  },

  {
    name: 'delete_item',
    description:
      'Send an entry to the trash, where the app can still restore it. Pass permanent: true to drop it for good — that cannot be undone.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        permanent: { type: 'boolean', description: 'Defaults to false (trash).' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    run(store, args) {
      const id = asString(args.id, 'id')
      const current = findItem(store, id)
      const permanent = has(args, 'permanent') ? asBool(args.permanent, 'permanent') : false

      if (permanent) {
        const items = itemsOf(store).filter((i) => i.id !== id)
        return { store: withItems(store, items), result: { purged: id } }
      }
      if (current.deleted) return { store: null, result: { item: current, note: 'already in the trash' } }

      const next = { ...current, deleted: true, deletedAt: todayISO() }
      const items = itemsOf(store).map((i) => (i.id === id ? next : i))
      return { store: withItems(store, items), result: { item: next } }
    },
  },

  {
    name: 'restore_item',
    description: 'Bring an entry back out of the trash.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
      additionalProperties: false,
    },
    run(store, args) {
      const id = asString(args.id, 'id')
      const current = findItem(store, id)
      if (!current.deleted) return { store: null, result: { item: current, note: 'was not in the trash' } }
      const next = { ...current, deleted: false, deletedAt: null }
      const items = itemsOf(store).map((i) => (i.id === id ? next : i))
      return { store: withItems(store, items), result: { item: next } }
    },
  },

  {
    name: 'promote_plan',
    description:
      'Mark a plan as done: a copy of it lands on the actual track with the dates it really took, while the plan itself stays exactly where it was planned. Give start (and end) when reality differed; leave them out to use the planned dates. Passing only start keeps the planned length.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Id of a plan item.' },
        start: { type: 'string', description: 'Date it actually started, YYYY-MM-DD.' },
        end: { type: 'string', description: 'Date it actually ended, YYYY-MM-DD.' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    run(store, args) {
      const id = asString(args.id, 'id')
      const plan = findItem(store, id)
      if (plan.kind !== 'plan') fail(`item "${id}" is on the actual track; only plans can be promoted`)
      if (plan.deleted) fail(`item "${id}" is in the trash — restore it first`)
      if (plan.actualId) {
        fail(`plan "${id}" was already promoted (actual "${plan.actualId}"); use unpromote_plan first`)
      }

      const start = has(args, 'start') ? asDate(args.start, 'start') : plan.start
      const end = has(args, 'end')
        ? asDate(args.end, 'end')
        : // Only a start given: the item keeps the length it was planned for.
          addDays(start, Math.max(0, diffDays(plan.start, plan.end || plan.start)))
      if (end < start) fail(`end (${end}) is before start (${start})`)

      const actual = {
        id: uid(),
        kind: 'actual',
        title: plan.title,
        cat: plan.cat,
        start,
        end,
        // Promotion moves dates only; the plan's clock rides along.
        startTime: plan.startTime ?? null,
        endTime: plan.endTime ?? null,
        note: plan.note ?? '',
        done: false,
        actualId: null,
        sourceId: plan.id,
        deleted: false,
        deletedAt: null,
      }
      const items = [
        ...itemsOf(store).map((i) => (i.id === plan.id ? { ...i, done: true, actualId: actual.id } : i)),
        actual,
      ]
      return {
        store: withItems(store, items),
        result: { actual, plan: items.find((i) => i.id === plan.id), driftDays: diffDays(plan.start, start) },
      }
    },
  },

  {
    name: 'unpromote_plan',
    description: 'Undo a promotion: the actual copy is removed and the plan goes back to not done.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Id of the plan item.' } },
      required: ['id'],
      additionalProperties: false,
    },
    run(store, args) {
      const id = asString(args.id, 'id')
      const plan = findItem(store, id)
      if (plan.kind !== 'plan') fail(`item "${id}" is on the actual track`)
      if (!plan.actualId) fail(`plan "${id}" has not been promoted`)
      const removed = plan.actualId
      const items = itemsOf(store)
        .filter((i) => i.id !== removed)
        .map((i) => (i.id === id ? { ...i, done: false, actualId: null } : i))
      return {
        store: withItems(store, items),
        result: { plan: items.find((i) => i.id === id), removedActual: removed },
      }
    },
  },
]

/** Unknown argument names are almost always a typo for a real one, so they are
 *  reported rather than ignored. */
function rejectUnknownArgs(tool, args) {
  const known = Object.keys(tool.inputSchema.properties ?? {})
  const unknown = Object.keys(args).filter((k) => !known.includes(k))
  if (unknown.length) {
    fail(`unknown argument${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}. Accepted: ${known.join(', ') || 'none'}`)
  }
}

export function callTool(store, name, rawArgs) {
  const tool = TOOLS.find((t) => t.name === name)
  if (!tool) fail(`unknown tool "${name}"`)
  const args = rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs) ? rawArgs : {}
  rejectUnknownArgs(tool, args)
  for (const required of tool.inputSchema.required ?? []) {
    if (!has(args, required)) fail(`${required} is required`)
  }
  return tool.run(store, args)
}
