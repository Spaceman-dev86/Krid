import Link from 'next/link'

import { ClientPortalShell } from '../../../../components/client-portal/ClientPortalShell'
import { ClientProgramSessionsList } from '../../../../components/client-portal/ClientProgramSessionsList'
import { requireClientPortal } from '../../../../lib/client-portal/context'
import {
  isActivePlanStatus,
  pickActiveFitnessPlan,
  planProgramTitle,
  type ClientFitnessPlanRow,
} from '../../../../lib/client-portal/fitnessPlans'
import { chatDb } from '../../../../lib/chat/chat'
import { fetchProgramPreviewStructure } from '../../../../lib/fetchProgramPreviewStructure'
import { createClient } from '../../../../lib/supabase/server'
import { deleteDiyDraftAction, startDiySessionAction } from '../seance-actions'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ slug: string }> | { slug: string }
  searchParams?:
    | Promise<{ saved?: string; error?: string }>
    | { saved?: string; error?: string }
}

export default async function ClientSeancePage({ params, searchParams }: Props) {
  const { slug } = await Promise.resolve(params)
  const q = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const ctx = await requireClientPortal(supabase, slug, user?.id)

  const { data: fitnessPlansRaw } = await supabase
    .from('client_fitness_plans')
    .select(
      'id, status, is_calendar, start_date, source_program_id, created_at, programs:source_program_id(id, title, description, is_calendar)'
    )
    .eq('client_id', ctx.client.id)
    .order('created_at', { ascending: false })

  const fitnessPlans = (fitnessPlansRaw ?? []) as unknown as ClientFitnessPlanRow[]
  const activePlan = pickActiveFitnessPlan(fitnessPlans)
  const planStarted = isActivePlanStatus(activePlan?.status ?? '')

  let programStructure: Awaited<ReturnType<typeof fetchProgramPreviewStructure>> | null = null
  if (activePlan?.source_program_id) {
    programStructure = await fetchProgramPreviewStructure(supabase, activePlan.source_program_id)
  }

  const { data: enCours } = await supabase
    .from('session_runs')
    .select('id, title, source, source_session_id')
    .eq('client_id', ctx.client.id)
    .eq('style', 'en_cours')
    .is('deleted_at', null)
    .maybeSingle()

  const db = chatDb(supabase)
  const { data: draftsRaw } = await db
    .from('client_diy_sessions')
    .select('id, title, updated_at, snapshot')
    .eq('client_id', ctx.client.id)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(20)

  const drafts = (draftsRaw ?? []) as Array<{
    id: string
    title: string
    updated_at: string
    snapshot: { items?: unknown[] } | null
  }>

  const { data: libreRunsRaw } = await supabase
    .from('session_runs')
    .select('id, title, style, finished_at, actual_date, created_at')
    .eq('client_id', ctx.client.id)
    .eq('source', 'libre')
    .neq('style', 'en_cours')
    .is('deleted_at', null)
    .order('finished_at', { ascending: false })
    .limit(20)

  const libreRuns = (libreRunsRaw ?? []) as Array<{
    id: string
    title: string | null
    style: string
    finished_at: string | null
    actual_date: string | null
    created_at: string
  }>

  const resumeHref = enCours
    ? enCours.source === 'libre' || !enCours.source_session_id
      ? `/c/${ctx.slug}/seance/run/${enCours.id}`
      : `/c/${ctx.slug}/programme/seance/${enCours.source_session_id}?run=${enCours.id}`
    : null

  return (
    <ClientPortalShell slug={ctx.slug} appName={ctx.appName} primaryColor={ctx.primaryColor} logoUrl={ctx.logoUrl}>
      <div className="grid gap-5">
        <div>
          <h1 className="text-2xl font-extrabold" style={{ color: ctx.primaryColor }}>
            Séance
          </h1>
          <p className="mt-1 text-sm text-black/55">Créer · libre · programme</p>
        </div>

        {q.error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {q.error}
          </div>
        ) : null}
        {q.saved ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Brouillon enregistré.
          </div>
        ) : null}

        {enCours && resumeHref ? (
          <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
            <h2 className="text-xs font-extrabold uppercase tracking-wide text-black/45">
              Séance en cours
            </h2>
            <p className="mt-1 font-semibold text-[#1a1220]">
              {enCours.title?.trim() || 'Séance'}
              {enCours.source === 'libre' ? ' · libre' : ''}
            </p>
            <Link
              href={resumeHref}
              className="mt-2 inline-block text-sm font-bold"
              style={{ color: ctx.primaryColor }}
            >
              Reprendre →
            </Link>
          </section>
        ) : null}

        <Link
          href={`/c/${ctx.slug}/seance/new`}
          className="rounded-2xl px-4 py-3 text-center text-sm font-bold text-white shadow-sm"
          style={{ backgroundColor: ctx.primaryColor }}
        >
          + Créer une séance libre
        </Link>

        <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
          <h2 className="text-xs font-extrabold uppercase tracking-wide text-black/45">
            Mes séances
          </h2>

          {drafts.length ? (
            <div className="mt-3">
              <p className="text-[11px] font-bold uppercase text-black/35">Brouillons</p>
              <ul className="mt-1 divide-y divide-black/5">
                {drafts.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[#1a1220]">{d.title}</p>
                      <p className="text-xs text-black/40">
                        {(d.snapshot?.items?.length ?? 0)} exo
                        {(d.snapshot?.items?.length ?? 0) !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Link
                        href={`/c/${ctx.slug}/seance/new?draft=${d.id}`}
                        className="text-xs font-bold text-black/50"
                      >
                        Éditer
                      </Link>
                      <form action={startDiySessionAction}>
                        <input type="hidden" name="slug" value={ctx.slug} />
                        <input type="hidden" name="draft_id" value={d.id} />
                        <button
                          type="submit"
                          className="text-xs font-bold"
                          style={{ color: ctx.primaryColor }}
                        >
                          Démarrer
                        </button>
                      </form>
                      <form action={deleteDiyDraftAction}>
                        <input type="hidden" name="slug" value={ctx.slug} />
                        <input type="hidden" name="draft_id" value={d.id} />
                        <button type="submit" className="text-xs font-bold text-black/35">
                          ×
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {libreRuns.length ? (
            <div className="mt-4">
              <p className="text-[11px] font-bold uppercase text-black/35">Terminées (libre)</p>
              <ul className="mt-1 divide-y divide-black/5">
                {libreRuns.map((r) => {
                  const when = r.finished_at || r.actual_date || r.created_at
                  return (
                    <li key={r.id}>
                      <Link
                        href={`/c/${ctx.slug}/historique/seance/${r.id}`}
                        className="flex items-center justify-between gap-2 py-2.5 hover:bg-black/[0.02]"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[#1a1220]">
                            {r.title?.trim() || 'Séance libre'}
                          </p>
                          <p className="text-xs text-black/40">
                            {when ? new Date(when).toLocaleDateString('fr-FR') : ''} · {r.style}
                          </p>
                        </div>
                        <span className="text-xs font-bold text-black/30">→</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}

          {!drafts.length && !libreRuns.length ? (
            <p className="mt-2 text-sm text-black/45">
              Pas encore de séance libre. Crée-en une ci-dessus.
            </p>
          ) : null}
        </section>

        {activePlan && programStructure ? (
          <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
            <h2 className="text-xs font-extrabold uppercase tracking-wide text-black/45">
              Séances du programme
            </h2>
            <p className="mt-1 font-semibold text-[#1a1220]">{planProgramTitle(activePlan)}</p>
            {!planStarted ? (
              <p className="mt-2 text-sm text-black/45">
                <Link
                  href={`/c/${ctx.slug}/home`}
                  className="font-semibold underline"
                  style={{ color: ctx.primaryColor }}
                >
                  Démarre le plan
                </Link>{' '}
                depuis l’accueil pour ouvrir les séances.
              </p>
            ) : null}
            <ClientProgramSessionsList
              slug={ctx.slug}
              primaryColor={ctx.primaryColor}
              weeks={programStructure.weeks}
              sessions={programStructure.sessions}
              planStarted={planStarted}
            />
          </section>
        ) : (
          <section className="rounded-2xl border border-black/10 bg-white p-4 text-sm text-black/50 shadow-sm">
            Aucun programme actif. Tu peux quand même créer une séance libre.
          </section>
        )}
      </div>
    </ClientPortalShell>
  )
}
