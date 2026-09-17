import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { PageTitle, Muted } from '@/src/components/ui'
import { CoachAppShell } from '../../components/coach/CoachAppShell'
import { CoachPublicProfileForm } from '../../components/coach/CoachPublicProfileForm'
import { CopyCodeButton } from '../../components/coach/CopyCodeButton'
import { CopyShareShowroomButton } from '../../components/coach/CopyShareShowroomButton'
import { ProfileChromeActions } from '../../components/coach/ProfileChromeActions'
import { ProfileSubnav } from '../../components/coach/ProfileSubnav'
import { canAccessCoachApp } from '../../lib/auth/roles'
import { DEFAULT_CLIENT_PRIMARY_COLOR } from '../../lib/coach/defaultClientPrimaryColor'
import { loadCoachShellContext } from '../../lib/coach/loadCoachShellContext'
import { createClient } from '../../lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function ProfilePublicPage({
  searchParams,
}: {
  searchParams?:
    | Promise<{ error?: string; saved?: string }>
    | { error?: string; saved?: string }
}) {
  const params = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const shell = await loadCoachShellContext(user.id)
  const slug = shell.branding?.slug?.trim()

  const { data: publicProfile } = await supabase
    .from('coach_public_profile')
    .select('public_name, tagline, bio, photo_url, cover_url, share_message')
    .eq('coach_id', user.id)
    .maybeSingle()

  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? 'http'
  const origin = `${proto}://${host}`
  const showroomUrl = slug ? `${origin}/c/${slug}/showroom` : null
  const brand = shell.branding?.primary_color?.trim() || DEFAULT_CLIENT_PRIMARY_COLOR

  return (
    <CoachAppShell appName={shell.branding?.app_name} trialLabel={shell.trialLabel} title="Profil public" savUnread={shell.savUnread}>
      <div className="mx-auto grid max-w-4xl gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <PageTitle className="text-2xl">Profil public</PageTitle>
            <Muted className="mt-1">Contenu de la showroom · distinct du branding PWA (Mon app)</Muted>
          </div>
          <div className="flex flex-col items-end gap-2">
            <ProfileChromeActions />
            <ProfileSubnav />
          </div>
        </div>

        {params.error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {params.error}
          </div>
        ) : null}
        {params.saved ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Profil enregistré.
          </div>
        ) : null}

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">
            Identité &amp; médias
          </h2>
          <div className="mt-4">
            <CoachPublicProfileForm
              primaryColor={brand}
              initial={{
                public_name: publicProfile?.public_name ?? '',
                tagline: publicProfile?.tagline ?? '',
                bio: publicProfile?.bio ?? '',
                share_message: publicProfile?.share_message ?? '',
                photo_url: publicProfile?.photo_url ?? null,
                cover_url: publicProfile?.cover_url ?? null,
              }}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">
            Lien showroom
          </h2>
          {showroomUrl ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <code className="max-w-full truncate rounded bg-[var(--accent)] px-2 py-1 text-xs text-[color:var(--fg)]">
                {showroomUrl}
              </code>
              <CopyCodeButton code={showroomUrl} />
              <CopyShareShowroomButton
                message={publicProfile?.share_message ?? ''}
                showroomUrl={showroomUrl}
              />
              <Link
                href={showroomUrl}
                target="_blank"
                className="text-sm font-semibold text-[color:var(--brand)] underline"
              >
                Voir
              </Link>
            </div>
          ) : (
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              Définis un slug dans{' '}
              <Link href="/profile/mon-app" className="font-semibold underline">
                Mon app
              </Link>
              .
            </p>
          )}
          <p className="mt-4 text-sm text-[color:var(--muted)]">
            Pour Instagram / WhatsApp / Facebook avec stats, crée une campagne dans{' '}
            <Link href="/profile/liens" className="font-semibold text-[color:var(--brand)] underline">
              Liens
            </Link>
            .
          </p>
        </section>
      </div>
    </CoachAppShell>
  )
}
