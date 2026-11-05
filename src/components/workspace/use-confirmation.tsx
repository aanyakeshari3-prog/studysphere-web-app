import { useState } from 'react'
import { ConfirmDialog } from '@/components/confirm-dialog'
export function useConfirmation() {
  const [pending, setPending] = useState<{
    title: string
    resolve: (value: boolean) => void
  } | null>(null)
  const finish = (value: boolean) => {
    pending?.resolve(value)
    setPending(null)
  }
  return {
    confirm: (title: string) =>
      new Promise<boolean>((resolve) => setPending({ title, resolve })),
    dialog: (
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(open) => {
          if (!open) finish(false)
        }}
        title={pending?.title || 'Confirm deletion'}
        description="Cancel to keep your content. Export a backup before permanently deleting important study materials."
        onConfirm={() => finish(true)}
      />
    ),
  }
}
