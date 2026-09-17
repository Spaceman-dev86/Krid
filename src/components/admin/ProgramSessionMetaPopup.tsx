'use client'

import { Button, daFieldClass } from '@/src/components/ui'
import {
  createEmptyProgramSessionAction,
  updateTrainlyProgramSessionMetaAction,
} from '@/src/app/admin/programs/programSessionActions'

export type SessionMetaDefaults = {
  title?: string | null
  notes?: string | null
  objective_ressenti?: boolean
  objective_note?: boolean
  objective_difficulty?: boolean
}

type SharedFields = {
  programId: string
  weekId: string
  pending?: boolean
  onClose: () => void
  defaults?: SessionMetaDefaults
}

type CreateProps = SharedFields & {
  mode: 'create'
  day: number
  dayLabel: string
}

type EditProps = SharedFields & {
  mode: 'edit'
  sessionId: string
}

type Props = CreateProps | EditProps

export function ProgramSessionMetaPopup(props: Props) {
  const { programId, weekId, pending, onClose, defaults } = props
  const isCreate = props.mode === 'create'

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-[color:var(--fg)]">
              {isCreate ? 'Nouvelle séance' : 'Infos séance'}
            </h4>
            {isCreate ? (
              <p className="mt-0.5 text-[11px] text-[color:var(--muted)]">Sur {props.dayLabel}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[color:var(--muted)] hover:bg-[var(--accent)]"
            onClick={onClose}
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <form
          action={isCreate ? createEmptyProgramSessionAction : updateTrainlyProgramSessionMetaAction}
          className="space-y-3"
        >
          <input type="hidden" name="program_id" value={programId} />
          <input type="hidden" name="week_id" value={weekId} />
          {isCreate ? (
            <input type="hidden" name="target_order" value={String(props.day)} />
          ) : (
            <input type="hidden" name="session_id" value={props.sessionId} />
          )}

          <label className="grid gap-1">
            <span className="text-xs font-semibold text-[color:var(--muted)]">Nom *</span>
            <input
              name="title"
              required
              autoFocus
              defaultValue={defaults?.title?.trim() || (isCreate ? '' : '')}
              placeholder="Nom de la séance"
              className={daFieldClass}
            />
          </label>

          <label className="grid gap-1">
            <span className="text-xs font-semibold text-[color:var(--muted)]">Notes</span>
            <textarea
              name="notes"
              rows={3}
              defaultValue={defaults?.notes?.trim() || ''}
              placeholder="Consignes coach…"
              className={daFieldClass}
            />
          </label>

          <section className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--page-bg)] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
              Feedback client (fin de séance)
            </p>
            <p className="mt-1 text-[11px] text-[color:var(--muted)]">
              Hors composition — questions après la séance.
            </p>
            <div className="mt-2 flex flex-wrap gap-3 text-sm text-[color:var(--fg)]">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  name="objective_ressenti"
                  defaultChecked={defaults?.objective_ressenti !== false}
                  className="accent-[var(--brand)]"
                />
                Ressenti
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  name="objective_note"
                  defaultChecked={defaults?.objective_note !== false}
                  className="accent-[var(--brand)]"
                />
                Note
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  name="objective_difficulty"
                  defaultChecked={defaults?.objective_difficulty !== false}
                  className="accent-[var(--brand)]"
                />
                Difficulté (5 smileys)
              </label>
            </div>
          </section>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="!h-8 !rounded-full !px-3 !text-[12px]"
              onClick={onClose}
            >
              Annuler
            </Button>
            <Button type="submit" size="sm" className="!h-8 !rounded-full !px-3 !text-[12px]" disabled={pending}>
              {isCreate ? 'Créer' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
