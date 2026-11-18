import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { PlanStatusControls } from '@/src/components/coach/PlanStatusControls'
import { PendingFormButton } from '@/src/components/ui/PendingFormButton'
import { canAccessCoachApp } from '../../../../lib/auth/roles'
import {
  listClientNutritionPlans,
  listCoachNutritionPlans,
} from '../../../../lib/nutrition/plans'
import { createClient } from '../../../../lib/supabase/server'
import {
  assignNutritionToClientAction,
  setClientNutritionPlanStatusAction,
} from '../../../nutrition/actions'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }> | { id: string }
  searchParams?: Promise<{ filter?: string }> | { filter?: string }
}

function planStatusLabel(status: string) {
  switch (status) {
    case 'started':
      return 'En cours'
    case 'waiting':
      return 'En attente'
    case 'paused':
      return 'En pause'
    case 'done':
      return 'Passé'
    default:
      return status
  }
}

function matchesFilter(status: string, filter: string) {
  if (filter === 'paused') return status === 'paused'
  if (filter === 'passe') return status === 'done'
  return status === 'started' || status === 'waiting'
}

export default async function ClientNutritionPage({ params, searchParams }: Props) {
  const { id } = await Promise.resolve(params)
  const q = await Promise.resolve(searchParams ?? {})
  const filter = q.filter === 'paused' || q.filter === 'passe' ? q.filter : 'cours'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const { data: client } = await supabase
    .from('clients')
    .select('id, sex, birth_date')
    .eq('id', id)
    .eq('coach_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()
  if (!client) notFound()

  let plans: Awaited<ReturnType<typeof listClientNutritionPlans>> = []
  let templates: Awaited<ReturnType<typeof listCoachNutritionPlans>> = []
  try {
    plans = await listClientNutritionPlans(supabase, id)
    templates = await listCoachNutritionPlans(supabase, user.id)
  } catch {
    plans = []
    templates = []
  }

  const visible = plans.filter((p) => matchesFilter(p.status, filter))
  const base = `/clients/${id}/nutrition`

  return (
    <>
      <div className="flex flex-wrap gap-1 rounded-xl bg-[var(--accent)] p-1">
        {(
          [
            { key: 'cours', label: 'En cours' },
            { key: 'paused', label: 'En pause' },
            { key: 'passe', label: 'Passé' },
          ] as const
        ).map((tab) => {
          const href = tab.key === 'cours' ? base : `${base}?filter=${tab.key}`
          const active = filter === tab.key
          return (
            <Link
              key={tab.key}
              href={href}
              className={
                active
                  ? 'rounded-lg bg-[var(--surface)] px-3 py-1.5 text-sm font-bold text-[color:var(--brand)] shadow-da-sm'
                  : 'rounded-lg px-3 py-1.5 text-sm font-semibold text-[color:var(--muted)] hover:text-[color:var(--brand)]'
              }
            >
              {tab.label}
            </Link>
          )
        })}
      </div>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">Nutrition</h2>
        <p className="mt-1 text-xs text-[color:var(--muted)]">
          Envoyer = plan en attente · Pause / Reprendre / Terminer depuis la liste.
        </p>

        {!visible.length ? (
          <p className="mt-3 text-sm text-[color:var(--muted)]">Aucun plan dans ce filtre.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--border)]">
            {visible.map((plan) => (
              <li key={plan.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold text-[color:var(--brand)]">{plan.title}</p>
                  <p className="text-xs text-[color:var(--muted)]">
                    {planStatusLabel(plan.status)}
                    {plan.created_at
                      ? ` · ${new Date(plan.created_at).toLocaleDateString('fr-FR')}`
                      : ''}
                  </p>
                </div>
                <PlanStatusControls
                  action={setClientNutritionPlanStatusAction}
                  planId={plan.id}
                  status={plan.status}
                  clientId={id}
                  returnTo={filter === 'cours' ? base : `${base}?filter=${filter}`}
                />
              </li>
            ))}
          </ul>
        )}

        <form action={assignNutritionToClientAction} className="mt-4 flex flex-wrap items-end gap-2">
          <input type="hidden" name="client_id" value={id} />
          <input type="hidden" name="return_to" value={base} />
          <label className="grid min-w-[200px] flex-1 gap-1 text-sm">
            <span className="font-semibold">Envoyer un plan</span>
            <select
              name="plan_id"
              required
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
            >
              <option value="">Choisir…</option>
              {templates.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title?.trim() || 'Sans titre'}
                </option>
              ))}
            </select>
          </label>
          <PendingFormButton
            pendingLabel="Envoi…"
            disabled={!templates.length}
            className="!rounded-lg !px-4 !py-2 text-sm font-bold disabled:opacity-40"
          >
            Envoyer
          </PendingFormButton>
        </form>
        {!templates.length ? (
          <p className="mt-2 text-xs text-[color:var(--muted)]">
            Crée un plan dans{' '}
            <Link href="/nutrition" className="font-semibold underline">
              Nutrition
            </Link>
            .
          </p>
        ) : null}
      </section>
    </>
  )
}
