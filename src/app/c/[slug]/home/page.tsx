import Link from 'next/link'

import { ClientFitnessPlansSection } from '../../../../components/client-portal/ClientFitnessPlansSection'
import { ClientHomeBookPlansToggle } from '../../../../components/client-portal/ClientHomeBookPlansToggle'
import { ClientHomeWeekCalendar } from '../../../../components/client-portal/ClientHomeWeekCalendar'
import { ClientNutritionPlansSection } from '../../../../components/client-portal/ClientNutritionPlansSection'
import { ClientPortalShell } from '../../../../components/client-portal/ClientPortalShell'
import { startNutritionPlanAction } from '../actions'
import {
  formatRdvWhen,
  listClientEvents,
  rdvDateIso,
} from '../../../../lib/calendar/rdv'
import { hasPortalModule, requireClientPortal } from '../../../../lib/client-portal/context'
import {
  isActivePlanStatus,
  pickActiveFitnessPlan,
  planProgramTitle,
  type ClientFitnessPlanRow,
} from '../../../../lib/client-portal/fitnessPlans'
import {
  RUN_STYLE_LABELS,
  type SessionRunRow,
  type SessionRunStyle,
} from '../../../../lib/client-portal/sessionRuns'
import {
  startOfWeekMonday,
  toIsoDate,
  type CalendarSessionDot,
} from '../../../../lib/client-portal/weekCalendar'
import { fetchProgramPreviewStructure } from '../../../../lib/fetchProgramPreviewStructure'
import {
  dateIsoForPlanDay,
  listClientNutritionPlans,
  loadDayLogs,
  mealDisplayTitle,
  pickActiveNutritionPlan,
} from '../../../../lib/nutrition/plans'
import { listSharedFilesForClient } from '../../../../lib/drive/drive'
import { parseModules } from '../../../../lib/prestations/modules'
import { createClient } from '../../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ slug: string }> | { slug: string }
  searchParams?:
    | Promise<{
        plan_error?: string
        plan_started?: string
        book?: string
        nut_error?: string
        nut_started?: string
        module?: string
      }>
    | {
        plan_error?: string
        plan_started?: string
        book?: string
        nut_error?: string
        nut_started?: string
        module?: string
      }
}

export default async function ClientHomePage({ params, searchParams }: Props) {
  const { slug } = await Promise.resolve(params)
  const q = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const ctx = await requireClientPortal(supabase, slug, user?.id)

  const displayEmail = user?.email ?? ctx.client.email
  const returnTo = `/c/${ctx.slug}/home`

  const { data: profileRow } = user?.id
    ? await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
    : { data: null }

  // Si prénom CRM vide mais full_name profil renseigné à l’inscription → backfill léger
  if (user?.id && !ctx.client.first_name?.trim() && profileRow?.full_name?.trim()) {
    const parts = profileRow.full_name.trim().split(/\s+/)
    const fn = parts[0] ?? null
    const ln = parts.slice(1).join(' ') || null
    if (fn) {
      await supabase
        .from('clients')
        .update({
          first_name: fn,
          last_name: ln ?? ctx.client.last_name,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ctx.client.id)
      ctx.client.first_name = fn
      if (ln) ctx.client.last_name = ln
    }
  }

  const { data: grants } = await supabase
    .from('client_grants')
    .select('id, modules, starts_at, prestations(name, status)')
    .eq('client_id', ctx.client.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

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

  const { data: runsRaw } = await supabase
    .from('session_runs')
    .select(
      'id, title, style, source_session_id, scheduled_date, actual_date, started_at, finished_at, source, plan_id'
    )
    .eq('client_id', ctx.client.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100)

  const runs = (runsRaw ?? []) as unknown as SessionRunRow[]

  const sessionDots = runs
    .map((run): CalendarSessionDot | null => {
      const dateIso = run.actual_date || run.scheduled_date
      if (!dateIso) return null
      const href = run.source_session_id
        ? `/c/${ctx.slug}/programme/seance/${run.source_session_id}${
            run.style === 'en_cours' ? `?run=${run.id}` : ''
          }`
        : `/c/${ctx.slug}/seance`
      return {
        id: run.id,
        title: run.title?.trim() || 'Séance',
        style: run.style as SessionRunStyle,
        href,
        dateIso,
        kind: 'session',
      }
    })
    .filter((d): d is CalendarSessionDot => Boolean(d))

  const dots: CalendarSessionDot[] = [...sessionDots]

  let rdvEvents: Awaited<ReturnType<typeof listClientEvents>> = []
  let rdvLoadError: string | null = null
  try {
    rdvEvents = await listClientEvents(supabase, ctx.client.id)
  } catch (e) {
    rdvLoadError = e instanceof Error ? e.message : 'Erreur RDV'
  }

  for (const ev of rdvEvents) {
    // Confirmés + créneaux en attente (demande client ou proposition coach)
    if (ev.status !== 'accepted' && ev.status !== 'pending' && ev.status !== 'requested') continue
    const dateIso = rdvDateIso(ev.starts_at)
    if (!dateIso) continue
    dots.push({
      id: `rdv-${ev.id}`,
      title: ev.title?.trim() || formatRdvWhen(ev.starts_at),
      style: ev.status === 'accepted' ? 'rdv' : 'rdv_pending',
      href: `/c/${ctx.slug}/calendrier`,
      dateIso,
      kind: 'rdv',
    })
  }

  let nutritionPlans: Awaited<ReturnType<typeof listClientNutritionPlans>> = []
  try {
    nutritionPlans = await listClientNutritionPlans(supabase, ctx.client.id)
  } catch {
    nutritionPlans = []
  }

  const activeNutPlan = pickActiveNutritionPlan(nutritionPlans)
  let nextMeal: { title: string; dateIso: string } | null = null
  let sharedDocsCount = 0
  if (hasPortalModule(ctx, 'drive')) {
    try {
      sharedDocsCount = (await listSharedFilesForClient(supabase, ctx.client.id)).length
    } catch {
      sharedDocsCount = 0
    }
  }

  if (activeNutPlan?.start_date && activeNutPlan.snapshot) {
    const start = activeNutPlan.start_date
    const week0 = activeNutPlan.snapshot.weeks[0]
    const lastWeekIndex = Math.max(0, (activeNutPlan.snapshot.weeks.length || 1) - 1)
    const fromIso = dateIsoForPlanDay(start, 0, 0)
    const toIso = dateIsoForPlanDay(start, 6, lastWeekIndex)
    let logs: Awaited<ReturnType<typeof loadDayLogs>> = []
    try {
      logs = await loadDayLogs(supabase, activeNutPlan.id, fromIso, toIso)
    } catch {
      logs = []
    }
    const validatedByDay = new Map<string, Record<string, boolean>>()
    for (const log of logs) {
      validatedByDay.set(log.day_date, (log.meals_validated as Record<string, boolean>) ?? {})
    }

    const todayIso = toIsoDate(new Date())
    for (const week of activeNutPlan.snapshot.weeks) {
      for (const day of week.days) {
        const dateIso = dateIsoForPlanDay(start, day.day_index, week.week_index)
        const validated = validatedByDay.get(dateIso) ?? {}
        for (const meal of day.meals) {
          const done = Boolean(validated[meal.id])
          dots.push({
            id: `meal-${activeNutPlan.id}-${meal.id}-${dateIso}`,
            title: mealDisplayTitle(meal),
            style: done ? 'meal_done' : 'meal',
            href: `/c/${ctx.slug}/home`,
            dateIso,
            kind: 'meal',
            mealMeta: {
              planId: activeNutPlan.id,
              mealId: meal.id,
              dayDate: dateIso,
              validated: done,
            },
          })
          if (!done && !nextMeal && dateIso >= todayIso) {
            nextMeal = { title: mealDisplayTitle(meal), dateIso }
          }
        }
      }
    }
    if (!nextMeal && week0) {
      for (const day of week0.days) {
        const dateIso = dateIsoForPlanDay(start, day.day_index, 0)
        const validated = validatedByDay.get(dateIso) ?? {}
        for (const meal of day.meals) {
          if (!validated[meal.id]) {
            nextMeal = { title: mealDisplayTitle(meal), dateIso }
            break
          }
        }
        if (nextMeal) break
      }
    }
  }

  const startedSessionIds = new Set(
    runs
      .filter((r) => r.plan_id === activePlan?.id && r.source_session_id)
      .map((r) => r.source_session_id as string)
  )

  const sortedSessions = programStructure
    ? programStructure.sessions.slice().sort((a, b) => {
        const weekA = programStructure!.weeks.find((w) => w.id === a.week_id)
        const weekB = programStructure!.weeks.find((w) => w.id === b.week_id)
        const weekOrderDiff = (weekA?.week_order ?? 0) - (weekB?.week_order ?? 0)
        if (weekOrderDiff !== 0) return weekOrderDiff
        return (a.session_order ?? 0) - (b.session_order ?? 0)
      })
    : []

  const pendingSessions =
    planStarted && programStructure
      ? sortedSessions
          .filter((s) => !startedSessionIds.has(s.id))
          .slice(0, 8)
          .map((s) => ({
            id: s.id,
            title: s.title?.trim() || `Séance ${(s.session_order ?? 0) + 1}`,
            href: `/c/${ctx.slug}/programme/seance/${s.id}`,
          }))
      : []

  const nextSession = pendingSessions[0] ?? null
  const enCours = runs.find((r) => r.style === 'en_cours') ?? null

  const firstName = ctx.client.first_name?.trim() || null
  const lastName = ctx.client.last_name?.trim() || null
  const fullName =
    [firstName, lastName].filter(Boolean).join(' ').trim() ||
    profileRow?.full_name?.trim() ||
    ''
  const greetName =
    firstName ||
    fullName.split(/\s+/).filter(Boolean)[0] ||
    (displayEmail.includes('@') ? displayEmail.split('@')[0] : null) ||
    'toi'

  const weekStartIso = toIsoDate(startOfWeekMonday(new Date()))
  const waitingNutPlans = nutritionPlans.filter((p) => p.status === 'waiting')
  const openBook =
    q.book === '1' ||
    q.plan_started === '1' ||
    Boolean(q.plan_error) ||
    q.nut_started === '1' ||
    Boolean(q.nut_error) ||
    waitingNutPlans.length > 0

  return (
    <ClientPortalShell slug={ctx.slug} appName={ctx.appName} primaryColor={ctx.primaryColor} logoUrl={ctx.logoUrl}>
      <div className="grid gap-5">
        <div>
          <h1 className="text-2xl font-extrabold" style={{ color: ctx.primaryColor }}>
            Bonjour {greetName}
          </h1>
          <p className="mt-1 text-sm text-black/55">
            Accueil · {ctx.appName}
            <span className="block text-xs text-black/40">Connecté : {displayEmail}</span>
          </p>
        </div>

        {q.module === 'locked' ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Cette fonctionnalité n’est pas incluse dans tes accès actuels. Voir les offres sur le{' '}
            <Link href={`/c/${ctx.slug}/showroom`} className="font-semibold underline">
              showroom
            </Link>
            .
          </div>
        ) : null}

        {waitingNutPlans.length && hasPortalModule(ctx, 'nutrition') ? (
          <section className="rounded-2xl border border-lime-200 bg-lime-50/70 p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wide text-lime-900">
              Nouveau plan nutrition
            </p>
            <ul className="mt-2 grid gap-3">
              {waitingNutPlans.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-extrabold text-[#1a1220]">
                      {p.title?.trim() || 'Plan nutrition'}
                    </p>
                    <p className="text-xs text-lime-900/70">Envoyé par ton coach — à démarrer</p>
                  </div>
                  <form action={startNutritionPlanAction}>
                    <input type="hidden" name="slug" value={ctx.slug} />
                    <input type="hidden" name="plan_id" value={p.id} />
                    <input type="hidden" name="return_to" value={returnTo} />
                    <button
                      type="submit"
                      className="rounded-xl px-4 py-2 text-sm font-bold text-white"
                      style={{ backgroundColor: ctx.primaryColor }}
                    >
                      Démarrer
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <ClientHomeBookPlansToggle primaryColor={ctx.primaryColor} defaultOpen={openBook}>
          <div className="grid gap-4">
            <ClientFitnessPlansSection
              slug={ctx.slug}
              primaryColor={ctx.primaryColor}
              plans={hasPortalModule(ctx, 'fitness') ? fitnessPlans : []}
              returnTo={returnTo}
              planError={q.plan_error}
              planStarted={q.plan_started === '1'}
            />
            {hasPortalModule(ctx, 'nutrition') ? (
              <ClientNutritionPlansSection
                slug={ctx.slug}
                primaryColor={ctx.primaryColor}
                plans={nutritionPlans}
                returnTo={returnTo}
                nutError={q.nut_error}
                nutStarted={q.nut_started === '1'}
              />
            ) : null}
          </div>
        </ClientHomeBookPlansToggle>

        {enCours?.source_session_id ? (
          <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wide text-black/40">
              Reprendre
            </p>
            <p className="mt-1 font-semibold text-[#1a1220]">
              {enCours.title?.trim() || 'Séance en cours'}
            </p>
            <p className="text-xs text-black/45">
              {RUN_STYLE_LABELS.en_cours}
              {enCours.started_at
                ? ` · depuis ${new Date(enCours.started_at).toLocaleString('fr-FR')}`
                : ''}
            </p>
            <Link
              href={`/c/${ctx.slug}/programme/seance/${enCours.source_session_id}?run=${enCours.id}`}
              className="mt-2 inline-block text-sm font-bold"
              style={{ color: ctx.primaryColor }}
            >
              Continuer →
            </Link>
          </section>
        ) : null}

        {rdvLoadError ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Calendrier RDV : {rdvLoadError}
          </div>
        ) : null}

        <ClientHomeWeekCalendar
          slug={ctx.slug}
          primaryColor={ctx.primaryColor}
          dots={dots}
          pendingSessions={pendingSessions}
          initialWeekStartIso={weekStartIso}
          nextMeal={nextMeal}
        />

        {activePlan && planStarted && nextSession ? (
          <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
            <h2 className="text-xs font-extrabold uppercase tracking-wide text-black/45">
              Prochaine séance
            </h2>
            <p className="mt-1 text-xs text-black/45">{planProgramTitle(activePlan)}</p>
            <p className="mt-1 font-semibold text-[#1a1220]">{nextSession.title}</p>
            <Link
              href={nextSession.href}
              className="mt-2 inline-block text-sm font-bold"
              style={{ color: ctx.primaryColor }}
            >
              Ouvrir →
            </Link>
          </section>
        ) : activePlan && !planStarted ? (
          <section className="rounded-2xl border border-dashed border-black/15 bg-white/70 p-4 text-sm text-black/50">
            Plan <strong className="text-[#1a1220]">{planProgramTitle(activePlan)}</strong> en
            attente —{' '}
            <Link
              href={`/c/${ctx.slug}/home?book=1`}
              className="font-semibold underline"
              style={{ color: ctx.primaryColor }}
            >
              ouvre Plans
            </Link>{' '}
            pour démarrer.
          </section>
        ) : null}

        {hasPortalModule(ctx, 'drive') ? (
          <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-xs font-extrabold uppercase tracking-wide text-black/45">Docs</h2>
                <p className="mt-1 text-sm text-black/55">
                  {sharedDocsCount
                    ? `${sharedDocsCount} document${sharedDocsCount > 1 ? 's' : ''} partagé${sharedDocsCount > 1 ? 's' : ''}`
                    : 'Documents partagés par ton coach'}
                </p>
              </div>
              <Link
                href={`/c/${ctx.slug}/drive`}
                className="rounded-lg px-3 py-2 text-xs font-bold text-white"
                style={{ backgroundColor: ctx.primaryColor }}
              >
                Ouvrir →
              </Link>
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
          <h2 className="text-xs font-extrabold uppercase tracking-wide text-black/45">Accès actifs</h2>
          {!grants?.length ? (
            <p className="mt-3 text-sm text-black/45">
              Aucun accès pour l’instant. Voir les offres sur{' '}
              <Link
                href={`/c/${ctx.slug}/showroom`}
                className="font-semibold underline"
                style={{ color: ctx.primaryColor }}
              >
                le showroom
              </Link>
              .
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-black/5">
              {grants.map((g) => {
                const presta = g.prestations as { name?: string } | { name?: string }[] | null
                const prestaName = Array.isArray(presta) ? presta[0]?.name : presta?.name
                const mods = parseModules(g.modules)
                return (
                  <li key={g.id} className="py-3">
                    <p className="font-semibold text-[#1a1220]">{prestaName ?? 'Prestation'}</p>
                    <p className="text-xs text-black/45">
                      {mods.length ? mods.join(' · ') : 'Modules inclus'}
                      {g.starts_at
                        ? ` · depuis ${new Date(g.starts_at).toLocaleDateString('fr-FR')}`
                        : ''}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </ClientPortalShell>
  )
}
