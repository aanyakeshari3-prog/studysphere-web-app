import type { Flashcard } from './types'
export function reviewCard(
  card: Flashcard,
  rating: 'Easy' | 'Medium' | 'Difficult',
  now = new Date(),
): Flashcard {
  const interval =
    rating === 'Difficult'
      ? 1
      : rating === 'Medium'
        ? Math.max(2, Math.round(card.interval * 1.5))
        : Math.max(4, card.interval * 2)
  const due = new Date(now)
  due.setDate(due.getDate() + interval)
  return {
    ...card,
    interval,
    due: due.toISOString(),
    reviews: card.reviews + 1,
    lastReviewed: now.toISOString(),
  }
}
