'use client'

import { autosavePrestationAction } from '@/src/app/payments/actions'

import { ProfileFormSaveBar } from './ProfileFormSaveBar'

/** Save bar presta : autosave silencieux + « Enregistré » au clic. */
export function PrestationProfileSaveBar() {
  return (
    <ProfileFormSaveBar
      formId="prestation-edit-form"
      saveAction={async (fd) => {
        const res = await autosavePrestationAction(fd)
        if (res.ok && res.photoUploaded) {
          const form = document.getElementById('prestation-edit-form') as HTMLFormElement | null
          const photoInput = form?.querySelector<HTMLInputElement>(
            'input[type="file"][name="photo"]',
          )
          if (photoInput) photoInput.value = ''
        }
        return res.ok ? { ok: true } : { ok: false, error: res.error }
      }}
      validate={(fd) => {
        const name = String(fd.get('name') ?? '').trim()
        if (!name) return 'Nom requis'
        const photoIsCover = fd.get('showroom_photo_is_cover') === 'on'
        const videoUrl = String(fd.get('video_url') ?? '').trim()
        const videoRole = String(fd.get('showroom_video_role') ?? '')
        if (photoIsCover && videoUrl && videoRole === 'cover') {
          return 'Une seule couverture popup : photo ou vidéo'
        }
        return null
      }}
    />
  )
}
