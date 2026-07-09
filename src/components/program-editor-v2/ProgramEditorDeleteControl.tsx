'use client'

import DeleteProgramConfirmClient from '../DeleteProgramConfirmClient'
import { deleteProgramFromEditor } from '../../app/dashboard/programs/[id]/actions'

const DEFAULT_FORM_ID = 'delete-program-form-v2'

type Props = {
  programId: string
  formId?: string
  variant?: 'icon' | 'menu'
  onMenuAction?: () => void
}

export default function ProgramEditorDeleteControl({
  programId,
  formId = DEFAULT_FORM_ID,
  variant = 'icon',
  onMenuAction,
}: Props) {
  return (
    <>
      <form id={formId} action={deleteProgramFromEditor}>
        <input type="hidden" name="programId" value={programId} />
        <input type="hidden" name="client" value="1" />
      </form>
      <DeleteProgramConfirmClient formId={formId} variant={variant} onMenuAction={onMenuAction} />
    </>
  )
}
