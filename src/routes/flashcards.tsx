import { createFileRoute } from '@tanstack/react-router'
import { FlashcardWorkspace } from '@/components/workspace/flashcards'
export const Route = createFileRoute('/flashcards')({
  component: FlashcardWorkspace,
})
