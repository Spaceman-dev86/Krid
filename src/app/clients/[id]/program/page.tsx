import Link from 'next/link'
import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'

import { PendingFormButton } from '@/src/components/ui/PendingFormButton'
import { CoachQueryFlash } from '@/src/components/coach/CoachQueryFlash'
import { canAccessCoachApp } from '../../../../lib/auth/roles'
import { createClient } from '../../../../lib/supabase/server'
import { PlanStatusControls } from '@/src/components/coach/PlanStatusControls'
import {
  assignProgramToClientAction,
  setClientFitnessPlanStatusAction,
} from '../../../programs/actions'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }> | { id: string }
  searchParams?:
    | Promise<{ filter?: string; assigned?: string; error?: string }>
    | { filter?: string; assigned?: string; error?: string }
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
    case 'completed':
    case 'ended':
    case 'archived':
      return 'Passé'
    default:
      return status
  }
}

function matchesFilter(status: string, filter: string) {
  if (filter === 'paused') return status === 'paused'
  // Statut canonique = done · legacy completed/ended/archived
  if (filter === 'passe') {
    return (
      status === 'done' ||
      status === 'completed' ||
      status === 'ended' ||
      status === 'archived'
    )
  }
  // en cours = démarré OU envoyé pas encore démarré
  return status === 'started' || status === 'waiting'
}

export default async function ClientProgramPage({ params, searchParams }: Props) {
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
    .select('id')
    .eq('id', id)
    .eq('coach_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()
  if (!client) notFound()

  const { data: fitnessPlans } = await supabase
    .from('client_fitness_plans')
    .select(
      'id, status, start_date, created_at, source_program_id, programs!client_fitness_plans_source_program_id_fkey(title)',
    )
    .eq('client_id', id)
    .eq('coach_id', user.id)
    .order('created_at', { ascending: false })

  const { loadSendableCoachTemplates } = await import(
    '@/src/lib/programs/loadSendableCoachTemplates'
  )
  const assignablePrograms = await loadSendableCoachTemplates(supabase, user.id)

  const visible = (fitnessPlans ?? []).filter((p) => matchesFilter(p.status, filter))
  const base = `/clients/${id}/program`

  return (
    <>
      <Suspense fallback={null}>
        <CoachQueryFlash />
      </Suspense>
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
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">
          Programme fitness
        </h2>
        <p className="mt-1 text-xs text-[color:var(--muted)]">
          Envoyer = plan en <strong>waiting</strong>. Achat ≠ démarrage (le client démarre côté portail).
        </p>

        {!visible.length ? (
          <p className="mt-3 text-sm text-[color:var(--muted)]">Aucun plan dans ce filtre.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--border)]">
            {visible.map((plan) => {
              const prog = plan.programs as { title?: string } | { title?: string }[] | null
              const progTitle = Array.isArray(prog) ? prog[0]?.title : prog?.title
              return (
                <li key={plan.id} className="flex items-center justify-between gap-3 text-sm">
                  <Link
                    href={`/programs/plans/${plan.id}`}
                    className="-mx-2 block min-w-0 flex-1 rounded-lg px-2 py-2 hover:bg-[var(--accent)]"
                  >
                    <p className="font-semibold text-[color:var(--brand)]">{progTitle ?? 'Programme'}</p>
                    <p className="text-xs text-[color:var(--muted)]">
                      {planStatusLabel(plan.status)}
                      {plan.created_at
                        ? ` · ${new Date(plan.created_at).toLocaleDateString('fr-FR')}`
                        : ''}
                    </p>
                  </Link>
                  <PlanStatusControls
                    action={setClientFitnessPlanStatusAction}
                    planId={plan.id}
                    status={plan.status}
                    clientId={id}
                    returnTo={filter === 'cours' ? base : `${base}?filter=${filter}`}
                  />
                </li>
              )
            })}
          </ul>
        )}

        <form action={assignProgramToClientAction} className="mt-4 flex flex-wrap items-end gap-2">
          <input type="hidden" name="client_id" value={id} />
          <input type="hidden" name="return_to" value={base} />
          <label className="grid min-w-[200px] flex-1 gap-1 text-sm">
            <span className="font-semibold">Envoyer un programme</span>
            <select
              name="program_id"
              required
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
            >
              <option value="">Choisir…</option>
              {(assignablePrograms ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title?.trim() || 'Sans titre'}
                  {p.is_template ? ' · template' : ''}
                </option>
              ))}
            </select>
          </label>
          <PendingFormButton
            pendingLabel="Envoi…"
            disabled={!assignablePrograms?.length}
            className="!rounded-lg !px-4 !py-2 text-sm font-bold disabled:opacity-40"
          >
            Envoyer
          </PendingFormButton>
        </form>
        {!assignablePrograms?.length ? (
          <p className="mt-2 text-xs text-[color:var(--muted)]">
            Crée un programme dans{' '}
            <Link href="/programs" className="font-semibold underline">
              Programme
            </Link>
            .
          </p>
        ) : null}
      </section>
    </>
  )
}
