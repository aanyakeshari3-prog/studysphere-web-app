export function searchTerms(query: string) {
  return query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(
      (w) =>
        w &&
        ![
          'find',
          'my',
          'notes',
          'about',
          'show',
          'me',
          'the',
          'on',
          'documents',
          'please',
        ].includes(w),
    )
}
export function matchesSearch(text: string, query: string) {
  const terms = searchTerms(query)
  return terms.length > 0 && terms.every((t) => text.toLowerCase().includes(t))
}
