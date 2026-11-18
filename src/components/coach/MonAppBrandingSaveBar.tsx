'use client'

import { autosaveCoachBrandingAction } from '@/src/app/home/actions'

import { ProfileFormSaveBar } from './ProfileFormSaveBar'

/** Save bar DA Mon app : autosave silencieux + « Enregistré » au clic. */
export function MonAppBrandingSaveBar() {
  return (
    <ProfileFormSaveBar
      formId="coach-branding-form"
      saveAction={autosaveCoachBrandingAction}
    />
  )
}
