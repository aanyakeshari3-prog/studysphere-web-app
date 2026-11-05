import { createFileRoute } from '@tanstack/react-router'
import { NotesWorkspace } from '@/components/workspace/notes-workspace'
export const Route = createFileRoute('/notes')({ component: NotesWorkspace })
