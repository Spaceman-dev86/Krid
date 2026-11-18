'use client'

import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { useFormStatus } from 'react-dom'

import { updateGroupManualTagsAction } from '@/src/app/clients/groupes/actions'
import { FluidSpinner } from '@/src/components/admin/FluidSpinner'
import { Button, IconButton, IconClose, IconEdit } from '@/src/components/ui'

export type GroupTagOpt = {
  kind: 'prestation' | 'program'
  id: string
  label: string
}

export type GroupTagValue = {
  kind: 'prestation' | 'program'
  refId: string
  label: string
}

const MAX_TAGS = 3

function SubmitSave() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="!rounded-lg !px-4 !py-2 text-sm font-bold">
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <FluidSpinner size={12} className="text-[var(--brand-fg)]" />
          …
        </span>
      ) : (
        'Enregistrer'
      )}
    </Button>
  )
}

function ModalShell({
  title,
  titleId,
  onClose,
  children,
}: {
  title: string
  titleId: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Fermer"
        onClick={onClose}
      />
      <div className="relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-t-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-md sm:max-w-md sm:rounded-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-base font-extrabold text-[color:var(--fg)]">
            {title}
          </h2>
          <IconButton type="button" label="Fermer" tone="soft" size="sm" onClick={onClose}>
            <IconClose size={16} />
          </IconButton>
        </div>
        {children}
      </div>
    </div>
  )
}

type Props = {
  groupId: string
  tags: GroupTagValue[]
  prestations: GroupTagOpt[]
  programs: GroupTagOpt[]
}

export function GroupManualTagsCard({ groupId, tags, prestations, programs }: Props) {
  const titleId = useId()
  const [open, setOpen] = useState(false)
  const initialKeys = useMemo(
    () => tags.map((t) => `${t.kind}:${t.refId}`),
    [tags],
  )
  const [selected, setSelected] = useState<string[]>(initialKeys)

  useEffect(() => {
    if (open) setSelected(initialKeys)
  }, [open, initialKeys])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const options: GroupTagOpt[] = [
    ...prestations.map((p) => ({ ...p, kind: 'prestation' as const })),
    ...programs.map((p) => ({ ...p, kind: 'program' as const })),
  ]

  function toggle(key: string) {
    setSelected((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key)
      if (prev.length >= MAX_TAGS) return prev
      return [...prev, key]
    })
  }

  const summary =
    tags.length === 0
      ? 'Aucun tag pour l’instant.'
      : tags.length === 1
        ? `Le tag de ce groupe est ${tags[0].label}.`
        : `Les tags de ce groupe sont ${tags.map((t) => t.label).join(' · ')}.`

  return (
    <>
      <section className="rounded-xl border border-[color-mix(in_srgb,var(--brand)_35%,var(--border))] bg-[color-mix(in_srgb,var(--brand)_10%,var(--surface))] px-3.5 py-3 shadow-da-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-extrabold uppercase tracking-wide text-[color:var(--brand)]">
              Tags
            </p>
            <p className="mt-1 text-[13px] leading-snug text-[color:var(--fg)]">{summary}</p>
            {tags.length ? (
              <ul className="mt-2 flex flex-wrap gap-1">
                {tags.map((t) => (
                  <li
                    key={`${t.kind}:${t.refId}`}
                    className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--fg)] shadow-da-sm"
                  >
                    {t.kind === 'prestation' ? 'Presta' : 'Programme'} · {t.label}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <IconButton
            type="button"
            label="Modifier les tags"
            tone="soft"
            size="sm"
            onClick={() => setOpen(true)}
          >
            <IconEdit size={14} />
          </IconButton>
        </div>
      </section>

      {open ? (
        <ModalShell title="Tags du groupe" titleId={titleId} onClose={() => setOpen(false)}>
          <p className="mb-3 text-xs text-[color:var(--muted)]">
            Choisis jusqu’à {MAX_TAGS} tags (presta et/ou programme sport).
          </p>
          <form action={updateGroupManualTagsAction} className="grid gap-3">
            <input type="hidden" name="id" value={groupId} />
            <input type="hidden" name="return_to" value={`/clients/groupes/${groupId}/prestation`} />
            {selected.map((key) => (
              <input key={key} type="hidden" name="tag" value={key} />
            ))}

            {!options.length ? (
              <p className="text-sm text-[color:var(--muted)]">Aucune presta ni programme à taguer.</p>
            ) : (
              <ul className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-[var(--border)] p-2">
                {options.map((o) => {
                  const key = `${o.kind}:${o.id}`
                  const checked = selected.includes(key)
                  const disabled = !checked && selected.length >= MAX_TAGS
                  return (
                    <li key={key}>
                      <label
                        className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${
                          disabled ? 'opacity-40' : 'hover:bg-[color-mix(in_srgb,var(--brand)_8%,transparent)]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => toggle(key)}
                          className="size-4 accent-[var(--brand)]"
                        />
                        <span className="min-w-0 flex-1 truncate text-[color:var(--fg)]">
                          <span className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
                            {o.kind === 'prestation' ? 'Presta' : 'Prog'}
                          </span>{' '}
                          {o.label}
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}

            <p className="text-[11px] text-[color:var(--muted)]">
              {selected.length}/{MAX_TAGS} sélectionné{selected.length > 1 ? 's' : ''}
            </p>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                className="!rounded-lg !px-3 !py-1.5 text-xs"
                onClick={() => setOpen(false)}
              >
                Annuler
              </Button>
              <SubmitSave />
            </div>
          </form>
        </ModalShell>
      ) : null}
    </>
  )
}
