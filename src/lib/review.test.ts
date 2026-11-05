import { describe, it, expect } from 'vitest'
import { reviewCard } from './review'
import { matchesSearch } from './search'
import type { Flashcard } from './types'
const card: Flashcard = {
  id: '1',
  deck: 'Biology',
  front: 'What is a cell?',
  back: 'The basic unit of life',
  interval: 4,
  reviews: 2,
  due: '2026-11-05T12:00:00Z',
}
describe('spaced review', () => {
  it('schedules increasingly distant reviews without changing the original card', () => {
    const now = new Date('2026-11-05T12:00:00Z')
    expect(reviewCard(card, 'Difficult', now).due).toBe(
      '2026-11-06T12:00:00.000Z',
    )
    expect(reviewCard(card, 'Medium', now).interval).toBe(6)
    expect(reviewCard(card, 'Easy', now).due).toBe('2026-11-13T12:00:00.000Z')
    expect(reviewCard(card, 'Easy', now).reviews).toBe(3)
    expect(card.reviews).toBe(2)
  })
  it('understands natural search filler while retaining actual topic terms', () => {
    expect(
      matchesSearch(
        'Biology: photosynthesis in plants',
        'Find my notes about photosynthesis.',
      ),
    ).toBe(true)
    expect(
      matchesSearch('History of Rome', 'Find my notes about photosynthesis'),
    ).toBe(false)
    expect(matchesSearch('Anything', 'Find my notes')).toBe(false)
  })
})

import { workspaceSchema } from './workspace-validation'
it('rejects malformed persisted records rather than corrupting the cloud workspace', () => {
  const result = workspaceSchema.safeParse({
    tasks: [{ title: 'Missing required fields' }],
  })
  expect(result.success).toBe(false)
})
