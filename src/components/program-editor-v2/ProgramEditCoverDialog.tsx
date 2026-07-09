'use client'

import { memo } from 'react'

import { updateProgramCoverFromEditor } from '../../app/dashboard/programs/[id]/actions'
import { compressProgramCoverImage } from '../../lib/compressProgramCoverImage'
import { useProgramDocumentStore } from '../../store/program-editor/documentStore'
import ProgramCoverDialog from './ProgramCoverDialog'

type Props = {
  open: boolean
  programId: string
  programTitle: string
  currentImageUrl?: string | null
  onClose: () => void
}

function ProgramEditCoverDialogInner({
  open,
  programId,
  programTitle,
  currentImageUrl,
  onClose,
}: Props) {
  const patchProgramMeta = useProgramDocumentStore((s) => s.patchProgramMeta)

  return (
    <ProgramCoverDialog
      open={open}
      title="Éditer la photo"
      description={
        <>
          Photo de couverture de <span className="font-semibold">{programTitle}</span>. Glisse une nouvelle image ou
          clique pour la remplacer.
        </>
      }
      inputId="program-cover-edit"
      currentImageUrl={currentImageUrl}
      submitLabel="Enregistrer"
      pendingLabel="Enregistrement…"
      onClose={onClose}
      onSubmit={async (file) => {
        const prepared = await compressProgramCoverImage(file)
        const formData = new FormData()
        formData.set('programId', programId)
        formData.set('coverImage', prepared)

        const result = await updateProgramCoverFromEditor(null, formData)
        if (result && 'error' in result) return { error: result.error }
        if (result && 'success' in result && result.imageUrl) {
          patchProgramMeta({ imageUrl: result.imageUrl })
          onClose()
          return { success: true }
        }
        return null
      }}
    />
  )
}

export default memo(ProgramEditCoverDialogInner)
