import { createClient } from '../../lib/supabase/server'
import ReadyModulesSectionClient, { type ModuleMockups } from './ReadyModulesSectionClient'

function readPublicUrl(data: unknown): string | null {
  return (data as { publicUrl?: string } | null)?.publicUrl ?? null
}

export default async function ReadyModulesSection() {
  const supabase = await createClient()
  const bucket = supabase.storage.from('home_page')

  const programmePhotoUrl = readPublicUrl(bucket.getPublicUrl('1-accueil/programme_photo.png').data)

  const mockups: ModuleMockups = {
    programs: readPublicUrl(bucket.getPublicUrl('1-accueil/prog4semaines.png').data),
    library: readPublicUrl(bucket.getPublicUrl('1-accueil/exercices.png').data),
    nutrition: programmePhotoUrl,
    gamification: programmePhotoUrl,
    chat: readPublicUrl(bucket.getPublicUrl('1-accueil/chat.png').data),
    rdv: readPublicUrl(bucket.getPublicUrl('1-accueil/calendrier.png').data),
  }

  const moduleCardIcons = {
    programs: {
      default: readPublicUrl(bucket.getPublicUrl('1-accueil/list.png').data),
      active: readPublicUrl(bucket.getPublicUrl('1-accueil/list2.png').data),
    },
    library: {
      default: readPublicUrl(bucket.getPublicUrl('1-accueil/dumbbell.png').data),
      active: readPublicUrl(bucket.getPublicUrl('1-accueil/dumbbell2.png').data),
    },
    nutrition: {
      default: readPublicUrl(bucket.getPublicUrl('1-accueil/apple_icon.png').data),
      active: readPublicUrl(bucket.getPublicUrl('1-accueil/apple_icon2.png').data),
    },
    gamification: {
      default: readPublicUrl(bucket.getPublicUrl('1-accueil/trophy.png').data),
      active: readPublicUrl(bucket.getPublicUrl('1-accueil/trophy2.png').data),
    },
    chat: {
      default: readPublicUrl(bucket.getPublicUrl('1-accueil/messages.png').data),
      active: readPublicUrl(bucket.getPublicUrl('1-accueil/messages2.png').data),
    },
    rdv: {
      default: readPublicUrl(bucket.getPublicUrl('1-accueil/calendar.png').data),
      active: readPublicUrl(bucket.getPublicUrl('1-accueil/calendar2.png').data),
    },
  }

  return (
    <ReadyModulesSectionClient
      programmePhotoUrl={programmePhotoUrl}
      mockups={mockups}
      moduleCardIcons={moduleCardIcons}
    />
  )
}
