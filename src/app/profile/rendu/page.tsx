import Link from 'next/link'
import { redirect } from 'next/navigation'

import { PageTitle, Muted } from '@/src/components/ui'
import { CoachAppShell } from '../../../components/coach/CoachAppShell'
import { ProfileChromeActions } from '../../../components/coach/ProfileChromeActions'
import { ProfileRenduPreview } from '../../../components/coach/ProfileRenduPreview'
import { ProfileSubnav } from '../../../components/coach/ProfileSubnav'
import { canAccessCoachApp } from '../../../lib/auth/roles'
import { listCoachOnboardingQuestions } from '../../../lib/client-portal/onboarding'
import { loadCoachShellContext } from '../../../lib/coach/loadCoachShellContext'
import { createClient } from '../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function ProfileRenduPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const shell = await loadCoachShellContext(user.id)
  const branding = shell.branding
  const slug = branding?.slug?.trim()

  if (!slug) {
    return (
      <CoachAppShell appName={branding?.app_name} trialLabel={shell.trialLabel} title="Voir le rendu" savUnread={shell.savUnread}>
        <div className="mx-auto grid max-w-4xl gap-6">
          <Header />
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Définis un slug dans{' '}
            <Link href="/profile/mon-app" className="font-semibold underline">
              Mon app
            </Link>{' '}
            pour prévisualiser le parcours prospect.
          </div>
        </div>
      </CoachAppShell>
    )
  }

  const [{ data: publicProfile }, questions, { data: prestations }] = await Promise.all([
    supabase
      .from('coach_public_profile')
      .select('public_name, tagline, bio, photo_url, cover_url')
      .eq('coach_id', user.id)
      .maybeSingle(),
    listCoachOnboardingQuestions(supabase, user.id).catch(() => []),
    supabase
      .from('prestations')
      .select('id, name, description, price_cents, pricing_type, modules')
      .eq('coach_id', user.id)
      .eq('showroom_visible', true)
      .eq('status', 'active')
      .is('deleted_at', null)
      .order('name', { ascending: true }),
  ])

  return (
    <CoachAppShell appName={branding?.app_name} trialLabel={shell.trialLabel} title="Voir le rendu" savUnread={shell.savUnread}>
      <div className="mx-auto grid max-w-5xl gap-6">
        <Header />
        <ProfileRenduPreview
          branding={{
            slug,
            app_name: branding?.app_name ?? null,
            logo_url: branding?.logo_url ?? null,
            primary_color: branding?.primary_color ?? null,
          }}
          publicProfile={publicProfile}
          questions={questions}
          prestations={prestations ?? []}
        />
        <p className="text-center text-sm text-[color:var(--muted)]">
          Showroom live :{' '}
          <Link href={`/c/${slug}/showroom`} target="_blank" className="font-semibold text-[color:var(--brand)] underline">
            /c/{slug}/showroom
          </Link>
        </p>
      </div>
    </CoachAppShell>
  )
}

function Header() {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <PageTitle className="text-2xl">Voir le rendu</PageTitle>
        <Muted className="mt-1">Parcours prospect dans le téléphone · données live</Muted>
      </div>
      <div className="flex flex-col items-end gap-2">
        <ProfileChromeActions />
        <ProfileSubnav />
      </div>
    </div>
  )
}
