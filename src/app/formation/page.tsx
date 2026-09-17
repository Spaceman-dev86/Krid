import { redirect } from 'next/navigation'

import { PageTitle, Muted, Button, Eyebrow, DaBanner } from '@/src/components/ui'
import { FORMATION_MEDIA_LABEL } from '../../lib/admin/trainlyMedia'
import { CoachAppShell } from '../../components/coach/CoachAppShell'
import { canAccessCoachApp } from '../../lib/auth/roles'
import { loadCoachShellContext } from '../../lib/coach/loadCoachShellContext'
import { createClient } from '../../lib/supabase/server'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams?: Promise<{ error?: string }> | { error?: string }
}

export default async function FormationPage({ searchParams }: Props) {
  const q = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const shell = await loadCoachShellContext(user.id)

  const { data: items, error } = await supabase
    .from('trainly_formation_items')
    .select('id, title, description, media_type, original_name, created_at')
    .eq('published', true)
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <CoachAppShell
      appName={shell.branding?.app_name}
      trialLabel={shell.trialLabel}
      title="Formation"
      savUnread={shell.savUnread}
    >
      <div className="mx-auto grid max-w-3xl gap-5">
        <div>
          <Eyebrow>Trainly</Eyebrow>
          <PageTitle className="mt-2 text-2xl">Formation</PageTitle>
          <Muted className="mt-1">Contenus plateforme · lecture seule · viewer in-app</Muted>
        </div>

        {q.error ? <DaBanner tone="danger">{q.error}</DaBanner> : null}

        {error ? (
          <DaBanner tone="warning">
            Formation pas encore dispo — applique <code>35_trainly_library_formation_sav.sql</code>.
          </DaBanner>
        ) : !items?.length ? (
          <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center text-sm text-[color:var(--muted)]">
            Aucun contenu publié pour le moment.
          </p>
        ) : (
          <ul className="grid gap-2">
            {items.map((item) => {
              const mediaLabel =
                FORMATION_MEDIA_LABEL[item.media_type as 'pdf' | 'video' | 'image'] || item.media_type
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-4 py-4 shadow-da-sm"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-[color:var(--fg)]">{item.title}</p>
                    {item.description ? (
                      <p className="mt-1 text-xs text-[color:var(--muted)]">{item.description}</p>
                    ) : null}
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                      {mediaLabel}
                    </p>
                  </div>
                  <Button href={`/formation/${item.id}`} size="sm">
                    Voir
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </CoachAppShell>
  )
}
