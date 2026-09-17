import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Button, PageTitle, Muted } from '@/src/components/ui'
import { CoachAppShell } from '../../components/coach/CoachAppShell'
import { canAccessCoachApp } from '../../lib/auth/roles'
import { loadCoachShellContext } from '../../lib/coach/loadCoachShellContext'
import { createClient } from '../../lib/supabase/server'
import { siteUrl } from '../../lib/urls'
import { softDeleteProgramAction } from './actions'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams?:
    | Promise<{ deleted?: string; error?: string; mode?: string }>
    | { deleted?: string; error?: string; mode?: string }
}

export default async function ProgramsPage({ searchParams }: Props) {
  const q = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?redirectTo=${encodeURIComponent('/programs')}`)
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) {
    redirect(siteUrl('/programs'))
  }

  // Admin qui tape /programs?mode=coach → vue catalogue admin (pas l’espace perso)
  if (q.mode === 'coach' && (profile?.role === 'admin' || profile?.role === 'platform_admin')) {
    redirect('/admin/programs?mode=coach')
  }

  const shell = await loadCoachShellContext(user.id)

  const { data: programs } = await supabase
    .from('programs')
    .select('id, title, description, status, is_template, is_published, updated_at, created_at')
    .eq('coach_id', user.id)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })

  const isAdmin = profile?.role === 'admin' || profile?.role === 'platform_admin'

  return (
    <CoachAppShell appName={shell.branding?.app_name} trialLabel={shell.trialLabel} title="Programmes" savUnread={shell.savUnread}>
      <div className="mx-auto grid max-w-3xl gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <PageTitle className="text-2xl">Mes programmes</PageTitle>
            <Muted className="mt-1">
              Biblio perso (coach)
              {isAdmin ? ' · tes créations ici restent hors catalogue Trainly' : ''}
            </Muted>
          </div>
          <div className="flex flex-wrap gap-2">
            {isAdmin ? (
              <Button
                href="/admin/programs?mode=coach"
                variant="secondary"
                className="!rounded-xl !h-11 !px-4 text-sm font-bold"
              >
                Voir tous les coaches
              </Button>
            ) : null}
            <Button href="/programs/new" className="!rounded-xl !h-11 !px-4 text-sm font-bold">
              + Créer un programme
            </Button>
          </div>
        </div>

        {q.deleted ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Programme archivé.
          </div>
        ) : null}
        {q.error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{q.error}</div>
        ) : null}

        {!programs?.length ? (
          <p className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-8 text-center text-sm text-[color:var(--muted)]">
            Aucun programme pour l’instant.
          </p>
        ) : (
          <ul className="grid gap-3">
            {programs.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-da-sm"
              >
                <div className="min-w-0">
                  <Link href={`/programs/${p.id}`} className="font-bold text-[color:var(--brand)] hover:underline">
                    {p.title || 'Sans titre'}
                  </Link>
                  <p className="mt-0.5 text-xs text-[color:var(--muted)]">
                    {p.is_template ? 'Template' : 'Plan'} · {p.status || '—'}
                    {p.is_published ? ' · publié' : ''}
                  </p>
                </div>
                <form action={softDeleteProgramAction}>
                  <input type="hidden" name="id" value={p.id} />
                  <button type="submit" className="text-xs font-semibold text-red-700 hover:underline">
                    Archiver
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>
    </CoachAppShell>
  )
}
