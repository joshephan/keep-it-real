import type { Category, CategoryId, Lang } from '../types'

/**
 * The five categories the app ships with. Their ids are stable, so existing
 * items keep resolving even after a rename, and `name: null` lets them stay
 * bilingual until the user overrides the label.
 */
export const BUILTIN_LABELS: Record<string, { ko: string; en: string }> = {
  work: { ko: '일', en: 'Work' },
  health: { ko: '건강', en: 'Health' },
  life: { ko: '생활', en: 'Life' },
  study: { ko: '공부', en: 'Study' },
  etc: { ko: '기타', en: 'Other' },
}

const DEFAULT_COLORS: Record<string, string> = {
  work: '#B5442E',
  health: '#2E6B63',
  life: '#6B4A6E',
  study: '#A2761F',
  etc: '#4B535C',
}

/** Offered to new categories, in order, skipping colours already in use. */
export const CATEGORY_PALETTE = [
  '#B5442E',
  '#2E6B63',
  '#6B4A6E',
  '#A2761F',
  '#4B535C',
  '#2F5D8A',
  '#7A4F3A',
  '#4E6B2E',
  '#8E3423',
  '#3F5B6B',
]

const FALLBACK_COLOR = '#4B535C'

export function defaultCategories(): Category[] {
  return Object.keys(BUILTIN_LABELS).map((id) => ({ id, name: null, color: DEFAULT_COLORS[id] }))
}

export function catLabel(cat: Category, lang: Lang): string {
  if (cat.name !== null) return cat.name
  const builtin = BUILTIN_LABELS[cat.id]
  return builtin ? builtin[lang] : cat.id
}

/** Never throws: an item pointing at a removed category still renders. */
export function findCategory(cats: Category[], id: CategoryId): Category {
  return cats.find((c) => c.id === id) ?? cats[0] ?? { id, name: null, color: FALLBACK_COLOR }
}

export function nextPaletteColor(cats: Category[]): string {
  const used = new Set(cats.map((c) => c.color.toLowerCase()))
  return CATEGORY_PALETTE.find((c) => !used.has(c.toLowerCase())) ?? FALLBACK_COLOR
}

/** How many non-deleted items still point at a category. */
export function categoryUsage(items: { cat: CategoryId; deleted: boolean }[], id: CategoryId): number {
  return items.filter((i) => !i.deleted && i.cat === id).length
}
