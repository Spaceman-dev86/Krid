import { redirect } from 'next/navigation'

import { DaBanner } from '@/src/components/ui'
import { CoachAppShell } from '../../components/coach/CoachAppShell'
import { ActivityWeekBars } from '../../components/coach/dashboard/ActivityWeekBars'
import { ClientsByPrestaDonut } from '../../components/coach/dashboard/ClientsByPrestaDonut'
import { DashboardHero } from '../../components/coach/dashboard/DashboardHero'
import { DashboardKpiRow } from '../../components/coach/dashboard/DashboardKpiRow'
import { ProgramsSnap } from '../../components/coach/dashboard/ProgramsSnap'
import { TodayPanel } from '../../components/coach/dashboard/TodayPanel'
import { canAccessCoachApp } from '../../lib/auth/roles'
import { loadCoachHomeStats } from '../../lib/coach/loadCoachHomeStats'
import { loadCoachShellContext } from '../../lib/coach/loadCoachShellContext'
import { TRIAL_DAYS } from '../../lib/tenancy/ensureCoachTrial'
import { createClient } from '../../lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }> | { error?: string }
}) {
  const params = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, email, full_name')
    .eq('id', user.id)
    .maybeSingle()

  if (!canAccessCoachApp(profile?.role)) {
    redirect('/login')
  }

  const shell = await loadCoachShellContext(user.id)

  const [{ data: publicProfile }, stats] = await Promise.all([
    supabase
      .from('coach_public_profile')
      .select('public_name')
      .eq('coach_id', user.id)
      .maybeSingle(),
    loadCoachHomeStats(supabase, user.id),
  ])

  const greetName =
    publicProfile?.public_name?.trim() ||
    profile?.full_name?.trim() ||
    shell.branding?.app_name?.trim() ||
    null

  const logoUrl =
    shell.branding?.logo_url?.trim() || shell.branding?.pwa_icon_url?.trim() || null

  const dateLabel = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <CoachAppShell
      appName={shell.branding?.app_name}
      trialLabel={shell.trialLabel}
      title="Accueil"
      savUnread={shell.savUnread}
      chatUnread={shell.chatUnread}
      notifUnread={shell.notifUnread}
      notifHref={shell.notifHref}
    >
      <div className="coach-dash mx-auto grid max-w-6xl gap-5 sm:gap-6">
        <DashboardHero greetName={greetName} logoUrl={logoUrl} dateLabel={dateLabel} />

        {shell.trialCreated ? (
          <DaBanner tone="success">
            Essai Business démarré — <strong>{TRIAL_DAYS}</strong> jours calendaires.
          </DaBanner>
        ) : null}

        {shell.trialError ? <DaBanner tone="danger">Essai : {shell.trialError}</DaBanner> : null}

        {params.error ? <DaBanner tone="danger">{params.error}</DaBanner> : null}

        <DashboardKpiRow
          items={[
            {
              href: '/programs/encours',
              value: stats.sessionsYesterday,
              label: 'Séances hier',
              hint: stats.sessionsYesterday > 1 ? 'réalisées' : 'réalisée',
            },
            {
              href: '/clients',
              value: stats.clientsActive,
              label: 'Clients',
              hint: 'actifs',
            },
            {
              href: '/profile/liens',
              value: stats.leadsMonth,
              label: 'Leads',
              hint: 'ce mois',
            },
            {
              href: '/calendar',
              value: stats.rdvTodayCount,
              label: 'RDV',
              hint: 'aujourd’hui',
            },
          ]}
        />

        <div className="grid gap-5 lg:grid-cols-2 lg:items-stretch">
          <TodayPanel
            rdvs={stats.rdvToday}
            rdvTotal={stats.rdvTodayCount}
            chatUnread={shell.chatUnread}
            leadsMonth={stats.leadsMonth}
            bilansUnread={stats.bilansUnread}
          />
          <ClientsByPrestaDonut
            slices={stats.prestaSlices}
            clientsActive={stats.clientsActive}
            clientsNewMonth={stats.clientsNewMonth}
            bilansUnread={stats.bilansUnread}
          />
        </div>

        <div className="grid gap-5 lg:grid-cols-2 lg:items-stretch">
          <ActivityWeekBars days={stats.weekActivity} />
          <ProgramsSnap encours={stats.programsEncours} paused={stats.programsPaused} />
        </div>
      </div>
    </CoachAppShell>
  )
}
