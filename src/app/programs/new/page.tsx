import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Button, PageTitle } from '@/src/components/ui'
import { CoachAppShell } from '../../../components/coach/CoachAppShell'
import { canAccessCoachApp } from '../../../lib/auth/roles'
import { loadCoachShellContext } from '../../../lib/coach/loadCoachShellContext'
import { createClient } from '../../../lib/supabase/server'
import { createProgramAction } from '../actions'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams?: Promise<{ error?: string }> | { error?: string }
}

export default async function NewProgramPage({ searchParams }: Props) {
  const q = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const shell = await loadCoachShellContext(user.id)

  return (
    <CoachAppShell appName={shell.branding?.app_name} trialLabel={shell.trialLabel} title="Nouveau programme" savUnread={shell.savUnread}>
      <div className="mx-auto grid max-w-lg gap-6">
        <div>
          <Link href="/programs" className="text-xs font-semibold text-[color-mix(in_srgb,var(--brand)_70%,transparent)] hover:underline">
            ← Programmes
          </Link>
          <PageTitle className="mt-2 text-2xl">Nouveau programme</PageTitle>
          <p className="mt-1 text-sm text-[color:var(--muted)]">4 semaines · 4 séances / semaine (squelette éditeur)</p>
        </div>

        {q.error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{q.error}</div>
        ) : null}

        <form action={createProgramAction} className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm">
          <label className="grid gap-1 text-sm">
            <span className="font-semibold">Titre *</span>
            <input name="title" required className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2" placeholder="Hypertrophie 8 semaines" />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-semibold">Description</span>
            <textarea name="description" rows={2} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2" />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-semibold">Objectif</span>
            <input name="goal" className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2" />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-semibold">Niveau</span>
            <input name="level" className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2" placeholder="Débutant / Intermédiaire…" />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-semibold">Durée</span>
            <input name="duration" className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2" placeholder="8 semaines" />
          </label>
          <label className="inline-flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" name="is_template" defaultChecked className="rounded" />
            Enregistrer comme template (liaison presta)
          </label>
          <Button type="submit" className="!rounded-lg !px-4 !py-2 text-sm font-bold">Créer et ouvrir l’éditeur</Button>
        </form>
      </div>
    </CoachAppShell>
  )
}
