import { createFileRoute } from '@tanstack/react-router'
import { DocumentLibrary } from '@/components/workspace/document-library'
export const Route = createFileRoute('/documents')({
  component: DocumentLibrary,
})
