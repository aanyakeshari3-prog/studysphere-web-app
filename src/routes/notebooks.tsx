import { createFileRoute } from '@tanstack/react-router'
import { NotebooksWorkspace } from '@/components/workspace/notebooks'
export const Route = createFileRoute('/notebooks')({
  component: NotebooksWorkspace,
})
