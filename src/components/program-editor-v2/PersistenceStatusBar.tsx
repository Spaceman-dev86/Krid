'use client'

import { memo } from 'react'

import { retryProgramEditorPersistence } from '../../persistence/startProgramEditorPersistence'
import { useProgramDocumentStore } from '../../store/program-editor/documentStore'
import { useProgramEditorPersistenceStore } from '../../store/program-editor/persistenceStore'

type Props = {
  variant?: 'inline' | 'menu'
}

function PersistenceStatusBarInner({ variant = 'inline' }: Props) {
  const status = useProgramEditorPersistenceStore((s) => s.status)
  const lastError = useProgramEditorPersistenceStore((s) => s.lastError)
  const isOnline = useProgramEditorPersistenceStore((s) => s.isOnline)
  const revision = useProgramDocumentStore((s) => s.revision)
  const lastSyncedRevision = useProgramDocumentStore((s) => s.lastSyncedRevision)

  const unsynced = revision > lastSyncedRevision
  const menuShell = variant === 'menu' ? 'rounded-xl bg-[#f5f5f5] px-3 py-2.5' : ''

  if (status === 'saved' && !unsynced && !lastError) {
    return (
      <div
        className={`flex items-center gap-2 text-xs font-semibold text-emerald-700 ${menuShell}`}
        aria-live="polite"
      >
        <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
        Enregistré
      </div>
    )
  }

  if (status === 'error' || !isOnline) {
    return (
      <div
        className={`flex flex-wrap items-center gap-2 text-xs font-semibold ${menuShell}`}
        aria-live="polite"
      >
        <span className="text-amber-800">
          {!isOnline ? 'Hors ligne' : 'Erreur de sauvegarde'}
          {lastError?.message ? ` — ${lastError.message}` : null}
        </span>
        <button
          type="button"
          className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-amber-900 hover:bg-amber-100"
          onClick={() => retryProgramEditorPersistence()}
        >
          Réessayer
        </button>
      </div>
    )
  }

  return (
    <div
      className={`flex items-center gap-2 text-xs font-semibold text-black/55 ${menuShell}`}
      aria-live="polite"
    >
      <span className="inline-block h-2 w-2 shrink-0 animate-pulse rounded-full bg-[var(--brand)]" />
      Enregistrement…
    </div>
  )
}

export default memo(PersistenceStatusBarInner)
