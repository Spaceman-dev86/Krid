import { createClient } from '../../lib/supabase/server'
import CoachingToolsTimelineSectionClient, {
  type CoachingToolItem,
} from './CoachingToolsTimelineSectionClient'

function readPublicUrl(data: unknown): string | null {
  return (data as { publicUrl?: string } | null)?.publicUrl ?? null
}

function publicUrl(supabase: Awaited<ReturnType<typeof createClient>>, path: string) {
  return readPublicUrl(supabase.storage.from('home_page').getPublicUrl(path).data)
}

export default async function CoachingToolsTimelineSection() {
  const supabase = await createClient()
  const bucketPath = (path: string) => publicUrl(supabase, path)

  const laptopProgUrl = bucketPath('2-page_app/mock up ordi prog.png')
  const laptopNutriUrl = bucketPath('2-page_app/mock up ordi nutri.png')
  const laptopGestionUrl = bucketPath('2-page_app/mock up ordi gestion.png')

  const coachTools: CoachingToolItem[] = [
    {
      title: 'Création de programme',
      side: 'left',
      device: 'laptop',
      mockupUrl: laptopProgUrl,
    },
    {
      title: 'Plan nutrition',
      side: 'right',
      device: 'laptop',
      mockupUrl: laptopNutriUrl,
    },
    {
      title: 'Gestion de planning',
      side: 'left',
      device: 'laptop',
      mockupUrl: laptopGestionUrl,
    },
  ]

  const clientTools: CoachingToolItem[] = [
    {
      title: 'Program',
      side: 'right',
      device: 'phone',
      mockupUrl: bucketPath('2-page_app/programme.png'),
    },
    {
      title: 'Bibliothèque d’exercices',
      side: 'left',
      device: 'phone',
      mockupUrl: bucketPath('2-page_app/exercices.png'),
    },
    {
      title: 'Chat client',
      side: 'right',
      device: 'phone',
      mockupUrl: bucketPath('2-page_app/chat.png'),
    },
  ]

  return (
    <CoachingToolsTimelineSectionClient coachTools={coachTools} clientTools={clientTools} />
  )
}
