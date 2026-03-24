'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

type Props = {
  action: (formData: FormData) => Promise<void>
  openWeek: string
  openSession: string
}

export default function SaveAllExercisesClient({ action, openWeek, openSession }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <form
      id="save-all-exercises"
      action={action}
      onSubmit={(e) => {
        e.preventDefault()

        const fd = new FormData(e.currentTarget)
        fd.set('client', '1')

        startTransition(async () => {
          await action(fd)
          router.replace('/dashboard')
        })
      }}
    >
      <input type="hidden" name="openWeek" value={openWeek} />
      <input type="hidden" name="openSession" value={openSession} />
      <input type="hidden" name="client" value="1" />
      <button
        type="submit"
        disabled={isPending}
        data-redirect-to-programs="1"
        style={{
          padding: '10px 12px',
          borderRadius: 10,
          border: '1px solid #111827',
          background: '#111827',
          color: '#ffffff',
          cursor: isPending ? 'not-allowed' : 'pointer',
        }}
        title="Valider les modifications"
      >
        ✓
      </button>
    </form>
  )
}
