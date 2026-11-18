'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'

import { Button, ConfirmSubmitButton, daFieldClass } from '@/src/components/ui'

function SaveBtn() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? '…' : 'OK'}
    </Button>
  )
}

export function TagsLabelRow({
  id,
  label,
  usageLabel,
  renameAction,
  archiveAction,
  tab,
}: {
  id: string
  label: string
  usageLabel?: string
  renameAction: (formData: FormData) => void | Promise<void>
  archiveAction: (formData: FormData) => void | Promise<void>
  tab: string
}) {
  const [editing, setEditing] = useState(false)

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2.5">
      <div className="min-w-0 flex-1">
        {editing ? (
          <form
            action={renameAction}
            className="flex flex-wrap items-center gap-2"
            onSubmit={() => setEditing(false)}
          >
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="tab" value={tab} />
            <input
              name="label"
              required
              defaultValue={label}
              className={`${daFieldClass} min-w-[10rem] flex-1`}
            />
            <SaveBtn />
            <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(false)}>
              Annuler
            </Button>
          </form>
        ) : (
          <div>
            <span className="text-sm font-semibold text-[color:var(--fg)]">{label}</span>
            {usageLabel ? (
              <span className="ml-2 text-[11px] text-[color:var(--muted)]">{usageLabel}</span>
            ) : null}
          </div>
        )}
      </div>
      {!editing ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(true)}>
            Renommer
          </Button>
          <form action={archiveAction}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="tab" value={tab} />
            <ConfirmSubmitButton
              confirmMessage={`Archiver « ${label} » ?`}
              variant="secondary"
              size="sm"
            >
              Archiver
            </ConfirmSubmitButton>
          </form>
        </div>
      ) : null}
    </li>
  )
}
