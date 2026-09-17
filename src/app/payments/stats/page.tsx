import { redirect } from 'next/navigation'

import { PageTitle, Muted, Eyebrow, DaBanner } from '@/src/components/ui'
import { CoachAppShell } from '../../../components/coach/CoachAppShell'
import { PaymentsSubnav } from '../../../components/coach/PaymentsSubnav'
import { canAccessCoachApp } from '../../../lib/auth/roles'
import { loadCoachShellContext } from '../../../lib/coach/loadCoachShellContext'
import { createClient } from '../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function PaymentsStatsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const shell = await loadCoachShellContext(user.id)

  return (
    <CoachAppShell
      appName={shell.branding?.app_name}
      trialLabel={shell.trialLabel}
      title="Statistiques"
      savUnread={shell.savUnread}
    >
      <div className="mx-auto grid max-w-3xl gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Eyebrow>Comptabilités</Eyebrow>
            <PageTitle className="mt-2 text-2xl">Statistiques</PageTitle>
            <Muted className="mt-1">Acquisition · App · Conversion · Engagement</Muted>
          </div>
          <PaymentsSubnav />
        </div>

        <DaBanner tone="warning">
          Stub V1 — les blocs Analytics (filtrés 7/30/90 j, gated par plan) seront branchés ici, sous
          Comptabilités (plus dans Settings).
        </DaBanner>

        <div className="grid gap-3 sm:grid-cols-2">
          {['Acquisition', 'App (PWA)', 'Conversion', 'Engagement'].map((label) => (
            <section
              key={label}
              className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm"
            >
              <Eyebrow>{label}</Eyebrow>
              <p className="mt-3 text-sm text-[color:var(--muted)]">Bientôt disponible</p>
            </section>
          ))}
        </div>
      </div>
    </CoachAppShell>
  )
}
