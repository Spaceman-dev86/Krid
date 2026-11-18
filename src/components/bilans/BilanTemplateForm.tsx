'use client'

import { Button } from '@/src/components/ui'
import type { BilanSchema } from '../../lib/bilans/bilans'
import { BilanTemplateFormFields } from './BilanTemplateFormFields'

type Props = {
  action: (formData: FormData) => Promise<void>
  initial?: {
    title?: string
    instructions?: string | null
    schema?: BilanSchema
  }
  templateId?: string
  submitLabel?: string
  titleRequired?: boolean
  secondaryAction?: (formData: FormData) => Promise<void>
  secondaryLabel?: string
}

export function BilanTemplateForm({
  action,
  initial,
  templateId,
  submitLabel = 'Enregistrer',
  titleRequired = true,
  secondaryAction,
  secondaryLabel = 'Brouillon',
}: Props) {
  return (
    <form action={action} className="grid gap-5">
      <BilanTemplateFormFields
        initial={initial}
        templateId={templateId}
        titleRequired={titleRequired}
      />
      <div className="flex flex-wrap gap-2">
        {secondaryAction ? (
          <Button
            type="submit"
            formAction={secondaryAction}
            variant="secondary"
            className="!rounded-lg !px-4 !py-2 text-sm"
          >
            {secondaryLabel}
          </Button>
        ) : null}
        <Button type="submit" className="!rounded-lg !px-4 !py-2.5 text-sm font-bold">
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
