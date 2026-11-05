import { createFileRoute } from '@tanstack/react-router'
import { StudyAssistant } from '@/components/workspace/study-assistant'
export const Route = createFileRoute('/assistant')({
  component: StudyAssistant,
})
