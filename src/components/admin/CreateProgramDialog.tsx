'use client'

import { useEffect, useId, useState } from 'react'
import { createPortal, useFormStatus } from 'react-dom'

import { createTrainlyProgramAction } from '@/src/app/admin/programs/programCreateActions'
import { Button, IconPlus, daFieldClass, daSelectClass } from '@/src/components/ui'

type Props = {
  /** Ouvre la pop-up au montage (ex. ?create=1). */
  autoOpen?: boolean
}

function CompactCoverPick() {
  const id = useId()
  const [fileName, setFileName] = useState<string | null>(null)
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <input
        id={id}
        name="coverImage"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
      />
      <label
        htmlFor={id}
        className="inline-flex h-10 min-w-[11rem] shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-md)] border border-dashed border-[color-mix(in_srgb,var(--brand)_45%,var(--border))] bg-[color-mix(in_srgb,var(--brand)_10%,var(--page-bg))] px-4 text-xs font-bold text-[var(--brand)] hover:bg-[color-mix(in_srgb,var(--brand)_18%,var(--page-bg))]"
      >
        Choisir une image
      </label>
      <span className="min-w-0 truncate text-[11px] text-[color:var(--muted)]">
        {fileName ? (
          <span className="font-semibold text-[color:var(--fg)]">{fileName}</span>
        ) : (
          'JPG, PNG, WebP ou GIF · max 5 Mo · optionnel'
        )}
      </span>
    </div>
  )
}

function CreateProgramSubmit() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Création…' : 'Créer et ouvrir'}
    </Button>
  )
}

export function CreateProgramDialogTrigger({ autoOpen = false }: Props) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])
  useEffect(() => {
    if (autoOpen) setOpen(true)
  }, [autoOpen])

  return (
    <>
      <button
        type="button"
        aria-label="Créer un programme"
        title="Créer un programme"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--brand)] text-[var(--brand-fg)] ring-1 ring-[var(--border)] hover:opacity-90"
      >
        <IconPlus size={20} />
      </button>

      {open && mounted
        ? createPortal(
            <div className="fixed inset-0 z-[9999]">
              <button
                type="button"
                className="absolute inset-0 bg-black/50"
                aria-label="Fermer"
                onClick={() => setOpen(false)}
              />
              <div
                className="absolute left-1/2 top-1/2 z-10 w-[min(640px,calc(100vw-1.5rem))] -translate-x-1/2 -translate-y-1/2"
                role="dialog"
                aria-modal="true"
                aria-labelledby="create-program-title"
              >
                <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-da-md">
                  <div className="border-b border-[var(--border)] px-4 py-2.5">
                    <h2
                      id="create-program-title"
                      className="text-sm font-bold text-[color:var(--fg)]"
                    >
                      Nouveau programme
                    </h2>
                  </div>

                  <form className="grid gap-2.5 p-4" action={createTrainlyProgramAction}>
                    <label className="grid gap-0.5">
                      <span className="text-[11px] font-semibold text-[color:var(--muted)]">
                        Nom *
                      </span>
                      <input
                        name="title"
                        required
                        className={daFieldClass}
                        placeholder="Ex. Force 8 semaines"
                        autoFocus
                      />
                    </label>

                    <div className="grid gap-2.5 sm:grid-cols-2">
                      <label className="grid min-w-0 gap-0.5 sm:col-span-2">
                        <span className="text-[11px] font-semibold text-[color:var(--muted)]">
                          Description
                        </span>
                        <input
                          name="description"
                          className={daFieldClass}
                          placeholder="Contexte, matériel, fréquence…"
                        />
                      </label>
                      <label className="grid min-w-0 gap-0.5">
                        <span className="text-[11px] font-semibold text-[color:var(--muted)]">
                          Objectif
                        </span>
                        <input
                          name="goal"
                          className={daFieldClass}
                          placeholder="Hypertrophie, reprise…"
                        />
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="grid min-w-0 gap-0.5">
                          <span className="text-[11px] font-semibold text-[color:var(--muted)]">
                            Niveau *
                          </span>
                          <select
                            name="level"
                            required
                            defaultValue=""
                            className={daSelectClass}
                          >
                            <option value="" disabled>
                              Choisir…
                            </option>
                            <option value="débutant">Débutant</option>
                            <option value="intermédiaire">Intermédiaire</option>
                            <option value="avancé">Avancé</option>
                          </select>
                        </label>
                        <label className="grid min-w-0 gap-0.5">
                          <span className="text-[11px] font-semibold text-[color:var(--muted)]">
                            Semaines *
                          </span>
                          <input
                            name="duration_weeks"
                            type="number"
                            required
                            min={1}
                            max={52}
                            defaultValue={4}
                            className={daFieldClass}
                          />
                        </label>
                      </div>
                    </div>

                    <fieldset className="grid gap-1">
                      <legend className="text-[11px] font-semibold text-[color:var(--muted)]">
                        Organisation *
                      </legend>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="flex min-w-0 cursor-pointer items-start gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--page-bg)] px-2.5 py-2 has-[:checked]:border-[var(--brand)] has-[:checked]:bg-[color-mix(in_srgb,var(--brand)_14%,var(--page-bg))] has-[:checked]:ring-1 has-[:checked]:ring-[var(--brand)]">
                          <input
                            type="radio"
                            name="is_calendar"
                            value="1"
                            defaultChecked
                            className="mt-0.5 shrink-0 accent-[var(--brand)]"
                          />
                          <span className="min-w-0">
                            <span className="block text-xs font-semibold text-[color:var(--fg)]">
                              Suivre un calendrier
                            </span>
                            <span className="mt-0.5 block text-[10px] leading-snug text-[color:var(--muted)]">
                              7 jours / semaine (Lun → Dim)
                            </span>
                          </span>
                        </label>
                        <label className="flex min-w-0 cursor-pointer items-start gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--page-bg)] px-2.5 py-2 has-[:checked]:border-[var(--brand)] has-[:checked]:bg-[color-mix(in_srgb,var(--brand)_14%,var(--page-bg))] has-[:checked]:ring-1 has-[:checked]:ring-[var(--brand)]">
                          <input
                            type="radio"
                            name="is_calendar"
                            value="0"
                            className="mt-0.5 shrink-0 accent-[var(--brand)]"
                          />
                          <span className="min-w-0">
                            <span className="block text-xs font-semibold text-[color:var(--fg)]">
                              Sans calendrier (slots)
                            </span>
                            <span className="mt-0.5 block text-[10px] leading-snug text-[color:var(--muted)]">
                              Max 6 séances / semaine, ordre libre
                            </span>
                          </span>
                        </label>
                      </div>
                    </fieldset>

                    <div className="grid gap-0.5">
                      <span className="text-[11px] font-semibold text-[color:var(--muted)]">
                        Sticker / image de mise en avant
                      </span>
                      <CompactCoverPick />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                      <p className="text-[11px] text-[color:var(--muted)]">
                        Toujours{' '}
                        <span className="font-semibold text-[color:var(--fg)]">duplicable</span> par
                        les coaches
                      </p>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => setOpen(false)}
                        >
                          Annuler
                        </Button>
                        <CreateProgramSubmit />
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
