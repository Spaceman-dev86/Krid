'use client'

import { memo } from 'react'

import { publishProgramFromEditor } from '../../app/dashboard/programs/[id]/actions'
import { compressProgramCoverImage } from '../../lib/compressProgramCoverImage'
import { flushProgramEditorPersistence, hasPendingProgramEditorPersistence } from '../../persistence/startProgramEditorPersistence'
import { useProgramMeta } from '../../store/program-editor'
import ProgramCoverDialog from './ProgramCoverDialog'

type Props = {
  open: boolean
  programId: string
  programTitle: string
  basePath?: string
  onClose: () => void
}

function ProgramPublishDialogInner({
  open,
  programId,
  programTitle,
  basePath = '/dashboard/programs',
  onClose,
}: Props) {
  const program = useProgramMeta()

  return (
    <ProgramCoverDialog
      open={open}
      title="Publier le programme"
      description={
        <>
          Ajoute la photo de couverture pour <span className="font-semibold">{programTitle}</span>. Elle sera affichée
          sur la page Programmes.
        </>
      }
      inputId="program-cover-publish"
      submitLabel="Publier"
      pendingLabel="Publication…"
      onClose={onClose}
      onSubmit={async (file) => {
        if (hasPendingProgramEditorPersistence()) {
          await flushProgramEditorPersistence()
        }

        const prepared = await compressProgramCoverImage(file)
        const formData = new FormData()
        formData.set('programId', programId)
        formData.set('coverImage', prepared)
        formData.set('goal', String(program?.goal ?? '').trim())
        formData.set('level', String(program?.level ?? '').trim())
        formData.set('duration', String(program?.duration ?? '').trim())
        formData.set('description', String(program?.description ?? '').trim())

        const result = await publishProgramFromEditor(null, formData)
        if (result && 'error' in result) return { error: result.error }
        if (result && 'success' in result) {
          onClose()
          window.location.assign(`${basePath}/${programId}`)
          return { success: true }
        }
        return null
      }}
    />
  )
}

export default memo(ProgramPublishDialogInner)
