'use client'

import { useEffect, useState } from 'react'
import type { MinimalProgramDocument } from '../../domain/program-editor'
import { validateMinimalDocument } from '../../domain/program-editor'
import {
  clearExerciseLibraryCatalog,
  registerExerciseLibraryCatalog,
} from '../../domain/program-editor/devExerciseLibrary'
import { startProgramEditorPersistence, stopProgramEditorPersistence } from '../../persistence/startProgramEditorPersistence'
import { useProgramDocumentStore } from '../../store/program-editor/documentStore'
import { useProgramEditorUiStore } from '../../store/program-editor/uiStore'
import type { HydrateRejectReason } from '../../store/program-editor/hydrationContract'
import { EDITOR_SHELL_CLASS } from './editorLayoutConstants'
import { ExerciseLibraryProvider } from './ExerciseLibraryContext'
import ProgramEditorLayout from './ProgramEditorLayout'
import ProgramEditorPersistenceGuard from './ProgramEditorPersistenceGuard'
import type { ExerciseLibraryCatalog } from '../../lib/fetchExerciseLibrary'

type Props = {
  programId: string
  basePath?: string
  backHref?: string
  initialDocument: MinimalProgramDocument
  exerciseLibrary: ExerciseLibraryCatalog
}

export default function ProgramEditorShell({
  programId,
  basePath,
  backHref,
  initialDocument,
  exerciseLibrary,
}: Props) {
  useEffect(() => {
    registerExerciseLibraryCatalog(exerciseLibrary.exercises)
  }, [exerciseLibrary])

  const hydrate = useProgramDocumentStore((s) => s.hydrate)
  const hydrationEpoch = useProgramDocumentStore((s) => s.hydrationEpoch)
  const document = useProgramDocumentStore((s) => s.document)
  const [hydrateError, setHydrateError] = useState<HydrateRejectReason | 'validation' | null>(null)

  useEffect(() => {
    const doc = { ...initialDocument, programId }
    const validationIssues = validateMinimalDocument(doc)
    if (validationIssues.length > 0) {
      console.error('[ProgramEditor] invalid document from server:', validationIssues)
      setHydrateError('validation')
      return
    }

    let result = hydrate(doc, { mode: 'initial' })
    if (!result.applied && result.reason === 'dirty-document') {
      const { revision, lastSyncedRevision } = useProgramDocumentStore.getState()
      if (revision <= lastSyncedRevision) {
        result = hydrate(doc, { mode: 'force-replace' })
      }
    }

    if (!result.applied) {
      console.warn('[ProgramEditor] hydrate skipped:', result.reason)
      setHydrateError(result.reason)
      return
    }

    setHydrateError(null)
  }, [hydrate, initialDocument, programId])

  useEffect(() => {
    return () => {
      stopProgramEditorPersistence()
      clearExerciseLibraryCatalog()
      useProgramEditorUiStore.getState().resetProgramEditorUi()
      useProgramDocumentStore.getState().resetEditor()
    }
  }, [])

  useEffect(() => {
    if (hydrationEpoch === 0) return
    startProgramEditorPersistence({ programId })
    return () => {
      stopProgramEditorPersistence()
    }
  }, [programId, hydrationEpoch])

  if (hydrateError) {
    const message =
      hydrateError === 'dirty-document'
        ? 'Des modifications sont encore en cours de sauvegarde. Attendez « Enregistré » ou rechargez la page pour repartir du serveur.'
        : hydrateError === 'validation'
          ? 'La structure du programme chargée depuis le serveur est invalide. Consultez la console pour le détail.'
          : 'Le document du programme n’a pas pu être initialisé.'

    return (
      <div
        className={`${EDITOR_SHELL_CLASS} items-center justify-center gap-3 px-6 text-center text-sm font-semibold text-black/70`}
      >
        <p>{message}</p>
        <button
          type="button"
          className="rounded-lg bg-[var(--brand)] px-4 py-2 text-white"
          onClick={() => window.location.reload()}
        >
          Recharger
        </button>
      </div>
    )
  }

  if (!document) {
    return (
      <div className={`${EDITOR_SHELL_CLASS} items-center justify-center text-sm font-semibold text-black/55`}>
        Chargement de l’éditeur…
      </div>
    )
  }

  return (
    <ExerciseLibraryProvider catalog={exerciseLibrary}>
      <ProgramEditorPersistenceGuard />
      <ProgramEditorLayout programId={programId} basePath={basePath} backHref={backHref} />
    </ExerciseLibraryProvider>
  )
}
