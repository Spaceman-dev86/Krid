import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Button, PageTitle, Muted } from '@/src/components/ui'
import { CoachAppShell } from '../../components/coach/CoachAppShell'
import { canAccessCoachApp } from '../../lib/auth/roles'
import { clientDisplayName } from '../../lib/chat/chat'
import { loadCoachShellContext } from '../../lib/coach/loadCoachShellContext'
import {
  listCoachClientNutritionPlans,
  listCoachNutritionPlans,
  NUT_PLAN_STATUS_LABELS,
} from '../../lib/nutrition/plans'
import { createClient } from '../../lib/supabase/server'
import { createNutritionPlanAction, softDeleteNutritionPlanAction } from './actions'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams?:
    | Promise<{ error?: string; deleted?: string }>
    | { error?: string; deleted?: string }
}

export default async function NutritionLandPage({ searchParams }: Props) {
  const q = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const shell = await loadCoachShellContext(user.id)

  let plans: Awaited<ReturnType<typeof listCoachNutritionPlans>> = []
  let clientPlans: Awaited<ReturnType<typeof listCoachClientNutritionPlans>> = []
  let loadError: string | null = null
  try {
    plans = await listCoachNutritionPlans(supabase, user.id)
    clientPlans = await listCoachClientNutritionPlans(supabase, user.id)
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'Erreur chargement'
  }

  const { data: clients } = await supabase
    .from('clients')
    .select('id, first_name, last_name, email')
    .eq('coach_id', user.id)
    .is('deleted_at', null)

  const names = new Map<string, string>()
  for (const c of clients ?? []) {
    names.set(
      c.id,
      clientDisplayName({
        first_name: c.first_name,
        last_name: c.last_name,
        email: c.email,
      })
    )
  }

  return (
    <CoachAppShell appName={shell.branding?.app_name} trialLabel={shell.trialLabel} title="Nutrition" savUnread={shell.savUnread}>
      <div className="mx-auto grid max-w-3xl gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <PageTitle className="text-2xl">Nutrition</PageTitle>
            <Muted className="mt-1">Plans · recettes · envoi client</Muted>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/nutrition/recipes"
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-bold text-[color:var(--brand)]"
            >
              Recettes
            </Link>
            <form action={createNutritionPlanAction}>
              <Button type="submit" className="!rounded-lg !px-4 !py-2 text-sm font-bold">+ Créer un plan</Button>
            </form>
          </div>
        </div>

        {q.error || loadError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {q.error || loadError}
          </div>
        ) : null}
        {q.deleted ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Plan archivé.
          </div>
        ) : null}

        <section className="grid gap-3">
          <h2 className="text-xs font-extrabold uppercase tracking-wide text-[color:var(--muted)]">
            Mes plans ({plans.length})
          </h2>
          {!plans.length ? (
            <p className="text-sm text-[color:var(--muted)]">Aucun plan — crée-en un pour commencer.</p>
          ) : (
            <ul className="grid gap-2">
              {plans.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-da-sm"
                >
                  <div>
                    <Link
                      href={`/nutrition/${p.id}`}
                      className="font-extrabold text-[color:var(--brand)] hover:underline"
                    >
                      {p.title}
                    </Link>
                    <p className="text-xs text-[color:var(--muted)]">
                      {p.status === 'template' ? 'Template' : 'Brouillon'} ·{' '}
                      {new Date(p.updated_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      href={`/nutrition/${p.id}`}
                      className="!rounded-lg !px-3 !py-1.5 text-xs font-bold"
                    >
                      Éditer
                    </Button>
                    <form action={softDeleteNutritionPlanAction}>
                      <input type="hidden" name="plan_id" value={p.id} />
                      <button type="submit" className="text-xs font-semibold text-red-700 hover:underline">
                        Archiver
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="grid gap-3">
          <h2 className="text-xs font-extrabold uppercase tracking-wide text-[color:var(--muted)]">
            Plans clients ({clientPlans.length})
          </h2>
          {!clientPlans.length ? (
            <p className="text-sm text-[color:var(--muted)]">Aucun envoi pour l’instant.</p>
          ) : (
            <ul className="grid gap-2">
              {clientPlans.map((cp) => (
                <li
                  key={cp.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-semibold text-[color:var(--brand)]">
                      {cp.title?.trim() || names.get(cp.client_id) || 'Plan'}
                    </p>
                    <p className="text-xs text-[color:var(--muted)]">
                      {names.get(cp.client_id) ?? 'Client'} · {NUT_PLAN_STATUS_LABELS[cp.status]}
                      {cp.start_date ? ` · début ${cp.start_date}` : ''}
                    </p>
                  </div>
                  {cp.source_plan_id ? (
                    <Link
                      href={`/nutrition/${cp.source_plan_id}`}
                      className="text-xs font-bold text-[color:var(--brand)] underline"
                    >
                      Voir template
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </CoachAppShell>
  )
}
