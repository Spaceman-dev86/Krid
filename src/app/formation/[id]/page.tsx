import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { PageTitle, Muted, Button, Eyebrow, DaBanner } from '@/src/components/ui'
import { FORMATION_MEDIA_LABEL } from '../../../lib/admin/trainlyMedia'
import { CoachAppShell } from '../../../components/coach/CoachAppShell'
import { canAccessCoachApp } from '../../../lib/auth/roles'
import { loadCoachShellContext } from '../../../lib/coach/loadCoachShellContext'
import { createClient } from '../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }> | { id: string }
}

export default async function FormationViewerPage({ params }: Props) {
  const { id } = await Promise.resolve(params)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const shell = await loadCoachShellContext(user.id)

  const { data: item } = await supabase
    .from('trainly_formation_items')
    .select('id, title, description, media_type, file_path, original_name, published')
    .eq('id', id)
    .eq('published', true)
    .maybeSingle()

  if (!item?.file_path) notFound()

  const { data: signed, error } = await supabase.storage
    .from('trainly-formation')
    .createSignedUrl(item.file_path, 3600)

  const url = signed?.signedUrl
  const mediaLabel =
    FORMATION_MEDIA_LABEL[item.media_type as 'pdf' | 'video' | 'image'] || item.media_type

  return (
    <CoachAppShell
      appName={shell.branding?.app_name}
      trialLabel={shell.trialLabel}
      title="Formation"
      savUnread={shell.savUnread}
    >
      <div className="mx-auto grid max-w-4xl gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href="/formation" className="text-sm font-semibold text-[var(--brand)] hover:underline">
              ← Formation
            </Link>
            <Eyebrow className="mt-3">{mediaLabel}</Eyebrow>
            <PageTitle className="mt-1 text-2xl">{item.title}</PageTitle>
            {item.description ? <Muted className="mt-1">{item.description}</Muted> : null}
          </div>
          {url ? (
            <Button href={url} variant="secondary" size="sm">
              Ouvrir dans un onglet
            </Button>
          ) : null}
        </div>

        {error || !url ? (
          <DaBanner tone="danger">{error?.message || 'Impossible de charger le média.'}</DaBanner>
        ) : item.media_type === 'video' ? (
          <video
            controls
            className="w-full rounded-[var(--radius-lg)] border border-[var(--border)] bg-black shadow-da-sm"
            src={url}
          >
            Ta vidéo
          </video>
        ) : item.media_type === 'image' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={item.title}
            className="max-h-[80vh] w-full rounded-[var(--radius-lg)] border border-[var(--border)] object-contain bg-[var(--surface)] shadow-da-sm"
          />
        ) : (
          <iframe
            title={item.title}
            src={url}
            className="h-[min(80vh,720px)] w-full rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-da-sm"
          />
        )}
      </div>
    </CoachAppShell>
  )
}
