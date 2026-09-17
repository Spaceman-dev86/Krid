'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import { setProgramCatalogStatusAction } from '@/src/app/admin/programs/catalogActions'
import {
  addTrainlyLibrarySessionAction,
  appendLibraryBlockToProgramAction,
  appendLibraryExerciseToProgramAction,
  createEmptyProgramSessionAction,
  moveTrainlyProgramSessionAction,
} from '@/src/app/admin/programs/programSessionActions'
import {
  deleteTrainlyProgramWeekAction,
  duplicateTrainlyProgramWeekAction,
  renameTrainlyProgramWeekAction,
  syncTrainlyProgramWeekCountAction,
} from '@/src/app/admin/programs/programWeekActions'
import {
  ProgramBuilderPalette,
  type CatalogFilterOption,
  type PaletteBlockItem,
  type PaletteExerciseItem,
  type PaletteSessionItem,
} from '@/src/components/admin/ProgramBuilderPalette'
import {
  ProgramBuilderDayBoard,
  type BuilderSession,
} from '@/src/components/admin/ProgramBuilderDayBoard'
import {
  Button,
  ConfirmSubmitButton,
  IconBack,
  IconDuplicate,
  IconEdit,
  IconPlus,
  IconTrash,
} from '@/src/components/ui'

export type AdminProgramWeek = {
  id: string
  title: string | null
  week_order: number
}

export type AdminProgramBuilderData = {
  id: string
  title: string | null
  description: string | null
  goal: string | null
  level: string | null
  duration: string | null
  image_url: string | null
  is_calendar: boolean
  catalog_status: string | null
  allow_duplicate: boolean
  weeks: AdminProgramWeek[]
  sessions: BuilderSession[]
}

function statusLabel(status: string | null) {
  if (status === 'published') return 'Publié'
  if (status === 'review') return 'Review'
  return 'Brouillon'
}

function weekHref(programId: string, weekId: string) {
  return `/admin/programs/${programId}?week=${encodeURIComponent(weekId)}`
}

function chipBtnClass(disabled?: boolean) {
  return `inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[11px] font-bold transition ${
    disabled
      ? 'bg-[var(--accent)] text-[color:var(--muted)] opacity-40'
      : 'bg-[var(--accent)] text-[color:var(--fg)] hover:ring-1 hover:ring-[var(--border)]'
  }`
}

export function AdminProgramBuilderShell({
  program,
  catalogSessions,
  catalogBlocks,
  catalogExercises,
  catalogSports = [],
  catalogTypes = [],
  initialWeekId = null,
}: {
  program: AdminProgramBuilderData
  catalogSessions: PaletteSessionItem[]
  catalogBlocks: PaletteBlockItem[]
  catalogExercises: PaletteExerciseItem[]
  catalogSports?: CatalogFilterOption[]
  catalogTypes?: CatalogFilterOption[]
  initialWeekId?: string | null
}) {
  const weeks = useMemo(
    () => [...program.weeks].sort((a, b) => a.week_order - b.week_order),
    [program.weeks],
  )
  const [openWeekId, setOpenWeekId] = useState<string | null>(() => {
    if (initialWeekId && weeks.some((w) => w.id === initialWeekId)) return initialWeekId
    return weeks[0]?.id ?? null
  })
  const [infosOpen, setInfosOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [weekCountDraft, setWeekCountDraft] = useState(String(weeks.length || 1))
  const [focusedDay, setFocusedDay] = useState(0)
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [createDay, setCreateDay] = useState<number | null>(null)
  const [createTitle, setCreateTitle] = useState('')

  useEffect(() => {
    if (initialWeekId && weeks.some((w) => w.id === initialWeekId)) {
      setOpenWeekId(initialWeekId)
      return
    }
    if (openWeekId && weeks.some((w) => w.id === openWeekId)) return
    setOpenWeekId(weeks[0]?.id ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialWeekId, weeks])

  useEffect(() => {
    setWeekCountDraft(String(weeks.length || 1))
    setRenaming(false)
    setFocusedDay(0)
    setCatalogOpen(false)
    setCreateDay(null)
  }, [weeks.length, openWeekId])

  useEffect(() => {
    if (!catalogOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setCatalogOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [catalogOpen])

  const openIndex = weeks.findIndex((w) => w.id === openWeekId)
  const openWeek = (openIndex >= 0 ? weeks[openIndex] : weeks[0]) ?? null
  const prevWeek = openIndex > 0 ? weeks[openIndex - 1] : null
  const nextWeek = openIndex >= 0 && openIndex < weeks.length - 1 ? weeks[openIndex + 1] : null
  const isPublished = program.catalog_status === 'published'
  const returnTo = openWeek ? weekHref(program.id, openWeek.id) : `/admin/programs/${program.id}`
  const canDeleteWeek = weeks.length > 1
  const weekCountChanged = Number.parseInt(weekCountDraft, 10) !== weeks.length

  const weekSessions = useMemo(
    () =>
      program.sessions
        .filter((s) => s.week_id === openWeek?.id)
        .slice()
        .sort((a, b) => a.session_order - b.session_order),
    [program.sessions, openWeek?.id],
  )

  const targetLabel = program.is_calendar
    ? (['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const)[
        Math.min(Math.max(focusedDay, 0), 6)
      ]
    : `Slot ${focusedDay + 1}`

  function runAction(fn: () => Promise<void>) {
    if (pending) return
    setPending(true)
    void fn().finally(() => setPending(false))
  }

  function addLibrarySession(libraryId: string, day = focusedDay, intoSessionId?: string) {
    if (!openWeek) return
    const fd = new FormData()
    fd.set('program_id', program.id)
    fd.set('week_id', openWeek.id)
    fd.set('library_session_id', libraryId)
    fd.set('target_order', String(day))
    if (intoSessionId) fd.set('into_session_id', intoSessionId)
    runAction(() => addTrainlyLibrarySessionAction(fd))
  }

  function addLibraryBlock(blockId: string, day = focusedDay, intoSessionId?: string) {
    if (!openWeek) return
    const fd = new FormData()
    fd.set('program_id', program.id)
    fd.set('week_id', openWeek.id)
    fd.set('block_id', blockId)
    fd.set('target_order', String(day))
    if (intoSessionId) fd.set('session_id', intoSessionId)
    runAction(() => appendLibraryBlockToProgramAction(fd))
  }

  function addLibraryExercise(exerciseId: string, day = focusedDay, intoSessionId?: string) {
    if (!openWeek) return
    const fd = new FormData()
    fd.set('program_id', program.id)
    fd.set('week_id', openWeek.id)
    fd.set('exercise_id', exerciseId)
    fd.set('target_order', String(day))
    if (intoSessionId) fd.set('session_id', intoSessionId)
    runAction(() => appendLibraryExerciseToProgramAction(fd))
  }

  function moveSession(sessionId: string, day: number) {
    if (!openWeek) return
    const fd = new FormData()
    fd.set('program_id', program.id)
    fd.set('week_id', openWeek.id)
    fd.set('session_id', sessionId)
    fd.set('target_order', String(day))
    runAction(() => moveTrainlyProgramSessionAction(fd))
  }

  function submitCreateSession() {
    if (!openWeek || createDay == null) return
    const fd = new FormData()
    fd.set('program_id', program.id)
    fd.set('week_id', openWeek.id)
    fd.set('title', createTitle.trim() || 'Séance')
    fd.set('target_order', String(createDay))
    setCreateDay(null)
    setCreateTitle('')
    runAction(() => createEmptyProgramSessionAction(fd))
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--page-bg)]">
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur">
        <div className="mx-auto flex h-11 max-w-6xl items-center gap-2 px-3 md:px-4">
          <Link
            href="/admin/programs"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[color:var(--muted)] hover:bg-[var(--accent)] hover:text-[color:var(--fg)]"
            aria-label="Retour"
          >
            <IconBack size={16} />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <h1 className="truncate text-sm font-bold text-[color:var(--fg)]">
                {program.title?.trim() || 'Programme sans titre'}
              </h1>
              <span className="shrink-0 rounded bg-[var(--accent)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
                {statusLabel(program.catalog_status)}
              </span>
            </div>
            <p className="truncate text-[10px] text-[color:var(--muted)]">
              {[program.level, program.duration, program.is_calendar ? 'Calendrier' : 'Slots']
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="!h-7 !rounded-full !px-2.5 !py-0 !text-[11px] !leading-none"
              onClick={() => setInfosOpen((v) => !v)}
            >
              {infosOpen ? 'Masquer' : 'Infos'}
            </Button>
            <Button
              href={`/admin/programs/${program.id}/preview`}
              size="sm"
              variant="secondary"
              className="!h-7 !rounded-full !px-2.5 !py-0 !text-[11px] !leading-none"
            >
              Rendu
            </Button>
            {isPublished ? (
              <form action={setProgramCatalogStatusAction}>
                <input type="hidden" name="id" value={program.id} />
                <input type="hidden" name="status" value="draft" />
                <input type="hidden" name="return_to" value={returnTo} />
                <Button
                  type="submit"
                  size="sm"
                  variant="secondary"
                  className="!h-7 !rounded-full !px-2.5 !py-0 !text-[11px] !leading-none"
                >
                  Dépublier
                </Button>
              </form>
            ) : (
              <form action={setProgramCatalogStatusAction}>
                <input type="hidden" name="id" value={program.id} />
                <input type="hidden" name="status" value="published" />
                <input type="hidden" name="return_to" value={returnTo} />
                <ConfirmSubmitButton
                  size="sm"
                  className="!h-7 !rounded-full !px-2.5 !py-0 !text-[11px] !leading-none"
                  confirmMessage="Publier ce programme dans le catalogue Trainly ?"
                >
                  Publier
                </ConfirmSubmitButton>
              </form>
            )}
          </div>
        </div>
        {infosOpen ? (
          <div className="border-t border-[var(--border)] bg-[var(--surface)]">
            <div className="mx-auto grid max-w-6xl gap-3 px-3 py-2.5 md:grid-cols-[7rem_1fr] md:px-4">
              {program.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={program.image_url}
                  alt=""
                  className="h-20 w-24 rounded-[var(--radius-md)] object-cover ring-1 ring-[var(--border)]"
                />
              ) : (
                <div className="flex h-20 w-24 items-center justify-center rounded-[var(--radius-md)] border border-dashed border-[var(--border)] text-[10px] text-[color:var(--muted)]">
                  Pas d’image
                </div>
              )}
              <div className="text-sm text-[color:var(--fg)]">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                  Description
                </span>
                <br />
                {program.description?.trim() || '—'}
              </div>
            </div>
          </div>
        ) : null}
      </header>

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-2 px-4 py-3 md:px-6">
        <section className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 shadow-da-sm">
          <div className="flex items-center gap-1">
            {prevWeek ? (
              <Link
                href={weekHref(program.id, prevWeek.id)}
                className={chipBtnClass()}
                onClick={() => setOpenWeekId(prevWeek.id)}
              >
                ←
              </Link>
            ) : (
              <span className={chipBtnClass(true)}>←</span>
            )}
            <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
              {weeks.map((w, i) => {
                const active = openWeek?.id === w.id
                return (
                  <Link
                    key={w.id}
                    href={weekHref(program.id, w.id)}
                    onClick={() => setOpenWeekId(w.id)}
                    className={`shrink-0 rounded-[var(--radius-sm)] px-2 py-0.5 text-[11px] font-semibold ${
                      active
                        ? 'bg-[var(--brand)] text-[var(--brand-fg)]'
                        : 'bg-[var(--accent)] text-[color:var(--fg)]'
                    }`}
                  >
                    {w.title?.trim() || `S${i + 1}`}
                  </Link>
                )
              })}
            </div>
            {nextWeek ? (
              <Link
                href={weekHref(program.id, nextWeek.id)}
                className={chipBtnClass()}
                onClick={() => setOpenWeekId(nextWeek.id)}
              >
                →
              </Link>
            ) : (
              <span className={chipBtnClass(true)}>→</span>
            )}
            <div className="mx-0.5 h-4 w-px bg-[var(--border)]" />
            <form action={syncTrainlyProgramWeekCountAction} className="flex items-center gap-0.5">
              <input type="hidden" name="program_id" value={program.id} />
              {openWeek ? <input type="hidden" name="week_id" value={openWeek.id} /> : null}
              <input
                type="number"
                name="week_count"
                min={1}
                max={52}
                value={weekCountDraft}
                onChange={(e) => setWeekCountDraft(e.target.value)}
                className="h-6 w-9 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--page-bg)] px-1 text-center text-[10px] font-semibold"
              />
              <Button
                type="submit"
                size="sm"
                variant="secondary"
                disabled={!weekCountChanged}
                className="!h-6 !rounded-full !px-2 !py-0 !text-[10px]"
              >
                OK
              </Button>
            </form>
            {openWeek ? (
              <>
                <div className="mx-0.5 h-4 w-px bg-[var(--border)]" />
                {renaming ? (
                  <form action={renameTrainlyProgramWeekAction} className="flex items-center gap-0.5">
                    <input type="hidden" name="program_id" value={program.id} />
                    <input type="hidden" name="week_id" value={openWeek.id} />
                    <input
                      name="title"
                      defaultValue={openWeek.title?.trim() || `Semaine ${openIndex + 1}`}
                      autoFocus
                      className="h-6 w-28 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--page-bg)] px-1.5 text-[10px] font-semibold"
                    />
                    <Button type="submit" size="sm" className="!h-6 !rounded-full !px-2 !text-[10px]">
                      OK
                    </Button>
                    <button type="button" className={chipBtnClass()} onClick={() => setRenaming(false)}>
                      ×
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-0.5">
                    <button type="button" className={chipBtnClass()} onClick={() => setRenaming(true)}>
                      <IconEdit size={12} />
                    </button>
                    <form action={duplicateTrainlyProgramWeekAction}>
                      <input type="hidden" name="program_id" value={program.id} />
                      <input type="hidden" name="week_id" value={openWeek.id} />
                      <button type="submit" className={chipBtnClass()}>
                        <IconDuplicate size={12} />
                      </button>
                    </form>
                    <form action={deleteTrainlyProgramWeekAction}>
                      <input type="hidden" name="program_id" value={program.id} />
                      <input type="hidden" name="week_id" value={openWeek.id} />
                      {canDeleteWeek ? (
                        <ConfirmSubmitButton
                          size="sm"
                          variant="secondary"
                          className="!h-6 !w-6 !min-w-0 !rounded-[var(--radius-sm)] !p-0"
                          confirmMessage="Supprimer cette semaine ?"
                        >
                          <IconTrash size={12} />
                        </ConfirmSubmitButton>
                      ) : (
                        <button type="button" disabled className={chipBtnClass(true)}>
                          <IconTrash size={12} />
                        </button>
                      )}
                    </form>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </section>

        <section className="relative min-h-[420px] min-w-0 flex-1 overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-2.5 shadow-da-sm">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="truncate text-sm font-bold text-[color:var(--fg)]">
              {openWeek?.title?.trim() || `Semaine ${openIndex + 1}`}
              <span className="ml-1.5 text-[10px] font-normal text-[color:var(--muted)]">
                {openIndex >= 0 ? `${openIndex + 1}/${weeks.length}` : ''}
              </span>
            </h2>
            {catalogOpen ? (
              <button
                type="button"
                onClick={() => setCatalogOpen(false)}
                className="rounded-full bg-[var(--accent)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--fg)] hover:ring-1 hover:ring-[var(--border)]"
              >
                Voir la semaine
              </button>
            ) : (
              <span className="rounded bg-[var(--accent)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
                Clique un jour pour builder
              </span>
            )}
          </div>

          <div className={catalogOpen ? 'pl-0 md:pl-[18.5rem]' : undefined}>
            {openWeek ? (
              <ProgramBuilderDayBoard
                isCalendar={program.is_calendar}
                weekSessions={weekSessions}
                programId={program.id}
                weekId={openWeek.id}
                focusedDay={focusedDay}
                buildMode={catalogOpen}
                onFocusDay={(day) => {
                  setFocusedDay(day)
                  setCatalogOpen(true)
                }}
                pending={pending}
                onDropLibrarySession={(id, day, into) => addLibrarySession(id, day, into)}
                onDropLibraryBlock={(id, day, into) => addLibraryBlock(id, day, into)}
                onDropLibraryExercise={(id, day, into) => addLibraryExercise(id, day, into)}
                onMoveProgramSession={moveSession}
                onCreateSession={(day) => {
                  setFocusedDay(day)
                  setCatalogOpen(true)
                  setCreateTitle('')
                  setCreateDay(day)
                }}
              />
            ) : (
              <p className="py-10 text-center text-sm text-[color:var(--muted)]">Aucune semaine.</p>
            )}
          </div>

          {catalogOpen && openWeek ? (
            <div className="pointer-events-none absolute inset-y-2 left-2 z-20 flex w-[min(100%,18rem)] max-w-[calc(100%-1rem)] md:pointer-events-auto">
              <div className="pointer-events-auto flex h-full w-full">
                <ProgramBuilderPalette
                  sessions={catalogSessions}
                  blocks={catalogBlocks}
                  exercises={catalogExercises}
                  sports={catalogSports}
                  types={catalogTypes}
                  selectedTargetLabel={targetLabel}
                  addDisabled={pending}
                  onClose={() => setCatalogOpen(false)}
                  className="flex h-full w-full flex-col overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] shadow-da-md"
                  onAddSession={(id) => addLibrarySession(id)}
                  onAddBlock={(id) => addLibraryBlock(id)}
                  onAddExercise={(id) => addLibraryExercise(id)}
                />
              </div>
            </div>
          ) : null}
        </section>
      </div>

      {createDay != null ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setCreateDay(null)}
        >
          <div
            className="w-full max-w-sm rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold text-[color:var(--fg)]">Nouvelle séance</h3>
            <p className="mt-0.5 text-[11px] text-[color:var(--muted)]">
              Sur {program.is_calendar
                ? (['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'] as const)[
                    createDay
                  ]
                : `slot ${createDay + 1}`}
            </p>
            <input
              autoFocus
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
              placeholder="Nom de la séance"
              className="mt-3 h-9 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--page-bg)] px-3 text-sm text-[color:var(--fg)]"
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitCreateSession()
              }}
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => setCreateDay(null)}>
                Annuler
              </Button>
              <Button type="button" size="sm" onClick={submitCreateSession}>
                <IconPlus size={14} />
                Créer
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
