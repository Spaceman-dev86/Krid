'use client'

import Link from 'next/link'
import { useFormStatus } from 'react-dom'

import { linkGroupDriveFolderAction } from '@/src/app/clients/groupes/actions'
import { FluidSpinner } from '@/src/components/admin/FluidSpinner'
import { Button, daSelectClass } from '@/src/components/ui'

type FolderOpt = { id: string; label: string }

function SubmitLink() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-fit !rounded-lg !px-4 !py-2 text-sm font-bold">
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <FluidSpinner size={12} className="text-[var(--brand-fg)]" />
          Liaison…
        </span>
      ) : (
        'Lier le dossier'
      )}
    </Button>
  )
}

type Props = {
  groupId: string
  /** Dossiers encore disponibles (pas déjà liés). */
  folders: FolderOpt[]
}

export function GroupDriveLinkForm({ groupId, folders }: Props) {
  return (
    <form action={linkGroupDriveFolderAction} className="mt-4 grid gap-3 sm:max-w-md">
      <input type="hidden" name="id" value={groupId} />
      <input type="hidden" name="return_to" value={`/clients/groupes/${groupId}/drive`} />
      <label className="grid gap-1 text-sm">
        <span className="font-semibold text-[color:var(--fg)]">Ajouter un dossier *</span>
        <select name="drive_folder_id" required defaultValue="" className={daSelectClass}>
          <option value="">Choisir…</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </label>
      {!folders.length ? (
        <p className="text-xs text-[color:var(--muted)]">
          Tous tes dossiers sont déjà liés, ou{' '}
          <Link href="/drive" className="font-semibold text-[color:var(--brand)] underline">
            crée-en un dans Drive
          </Link>
          .
        </p>
      ) : null}
      <SubmitLink />
    </form>
  )
}
