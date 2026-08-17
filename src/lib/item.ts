/**
 * Items may be saved with only a note, so anywhere a title is displayed falls
 * back to the note's first line before giving up and showing "제목 없음".
 */
export function displayTitle(item: { title: string; note: string }, untitled: string): string {
  const title = item.title.trim()
  if (title) return title
  const firstLine = item.note.split('\n').map((l) => l.trim()).find(Boolean)
  return firstLine || untitled
}
