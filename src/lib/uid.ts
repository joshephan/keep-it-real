export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `i${crypto.randomUUID()}`
  return `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}
