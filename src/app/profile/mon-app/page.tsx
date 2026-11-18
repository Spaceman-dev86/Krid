import { headers } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Button } from '@/src/components/ui'
import { CoachBrandingLogoField } from '../../../components/coach/CoachBrandingLogoField'
import { CoachBrandingThemeFields } from '../../../components/coach/CoachBrandingThemeFields'
import { CoachCustomRequestBanner } from '../../../components/coach/CoachCustomRequestBanner'
import { CopyCodeButton } from '../../../components/coach/CopyCodeButton'
import { MonAppBrandingSaveBar } from '../../../components/coach/MonAppBrandingSaveBar'
import { ProfileHubHeader } from '../../../components/coach/ProfileHubHeader'
import { canAccessCoachApp } from '../../../lib/auth/roles'
import { listCoachOnboardingQuestions } from '../../../lib/client-portal/onboarding'
import { DEFAULT_CLIENT_PRIMARY_COLOR } from '../../../lib/coach/defaultClientPrimaryColor'
import { loadCoachShellContext } from '../../../lib/coach/loadCoachShellContext'
import { createClient } from '../../../lib/supabase/server'
import { selectFieldClass, selectFieldStyle } from '../../../lib/ui/selectField'
import { InstallQrCard } from '../../../components/coach/InstallQrCard'
import { clearCoachLogoAction } from '../../home/actions'
import {
  createOnboardingQuestionAction,
  deleteOnboardingQuestionAction,
} from '../../home/onboarding-actions'

export const dynamic = 'force-dynamic'

export default async function ProfileMonAppPage({
  searchParams,
}: {
  searchParams?:
    | Promise<{
        error?: string
        saved?: string
        question_saved?: string
        question_deleted?: string
        request_sent?: string
      }>
    | {
        error?: string
        saved?: string
        question_saved?: string
        question_deleted?: string
        request_sent?: string
      }
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
  const branding = shell.branding
  const plan = shell.subscription?.plan_tier ?? 'starter'
  const slug = branding?.slug?.trim()

  let onboardingQuestions: Awaited<ReturnType<typeof listCoachOnboardingQuestions>> = []
  try {
    onboardingQuestions = await listCoachOnboardingQuestions(supabase, user.id)
  } catch {
    onboardingQuestions = []
  }

  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? 'http'
  const origin = `${proto}://${host}`
  const installUrl = slug ? `${origin}/c/${slug}/install` : null

  return (
    <div className="mx-auto grid max-w-4xl gap-6">
        <ProfileHubHeader
          title="Mon app"
          subtitle={
            <>
              Logo &amp; couleurs de l’app · présentation showroom dans{' '}
              <Link href="/profile" className="font-semibold text-[color:var(--brand)] hover:underline">
                Showroom
              </Link>
            </>
          }
          actions={
            slug ? (
              <Button href="/profile/rendu" className="!rounded-lg !px-3 !py-1.5 text-xs font-bold">
                Voir le rendu
              </Button>
            ) : null
          }
          showChromeActions={false}
        />

        {params.request_sent ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-[color:var(--fg)]">
            Demande envoyée — l’équipe Krid te répond bientôt.
          </div>
        ) : null}

        {params.error ? (
          <div className="rounded-xl border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-xs font-semibold text-[var(--danger)]">
            {params.error === 'slug' ? 'Slug invalide.' : params.error}
          </div>
        ) : null}

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-da-sm sm:p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">
              DA de l’app
            </h2>
            <p className="text-[11px] text-[color:var(--muted)]">
              Plan {plan} · showroom &amp; portail
              {branding?.primary_color ? (
                <span
                  className="ml-2 inline-block h-3 w-3 translate-y-0.5 rounded-full border border-[var(--border)] align-middle"
                  style={{ background: branding.primary_color }}
                  title={branding.primary_color}
                />
              ) : null}
            </p>
          </div>

          <form id="coach-branding-form" className="mt-3">
            <input type="hidden" name="return_to" value="/profile/mon-app" />
            <CoachBrandingThemeFields
              initialThemeMode={branding?.theme_mode}
              initialBgStyle={branding?.bg_style}
              initialPrimaryColor={branding?.primary_color}
              initialSecondaryColor={branding?.secondary_color}
              appName={branding?.app_name}
              logoUrl={branding?.logo_url}
              leadingFields={
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="grid gap-0.5 text-sm">
                    <span className="text-xs font-semibold text-[color:var(--fg)]">Nom de l’app</span>
                    <input
                      name="app_name"
                      defaultValue={branding?.app_name ?? ''}
                      placeholder="Studio Remi"
                      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-sm"
                    />
                  </label>
                  <label className="grid gap-0.5 text-sm">
                    <span className="text-xs font-semibold text-[color:var(--fg)]">Slug</span>
                    <input
                      name="slug"
                      defaultValue={branding?.slug ?? ''}
                      placeholder="studio-remi"
                      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 font-mono text-xs"
                    />
                    <span className="text-[10px] text-[color:var(--muted)]">
                      /c/<span className="font-mono">{slug || 'slug'}</span>/showroom
                      {slug ? (
                        <>
                          {' · '}
                          <Link
                            href={`/c/${slug}/showroom`}
                            className="font-semibold text-[color:var(--brand)] hover:underline"
                          >
                            ouvrir
                          </Link>
                        </>
                      ) : null}
                    </span>
                  </label>
                </div>
              }
              trailingFields={
                <>
                  <CoachBrandingLogoField
                    logoUrl={branding?.logo_url ?? null}
                    appName={branding?.app_name?.trim() || 'T'}
                    primaryColor={
                      branding?.primary_color?.trim() || DEFAULT_CLIENT_PRIMARY_COLOR
                    }
                  />
                  <CoachCustomRequestBanner kind="logo" returnTo="/profile/mon-app" />
                  <MonAppBrandingSaveBar />
                </>
              }
            />
          </form>
          <form id="clear-coach-logo" action={clearCoachLogoAction} className="hidden">
            <input type="hidden" name="return_to" value="/profile/mon-app" />
          </form>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">
            Lien d’installation
          </h2>
          <p className="mt-1 text-xs text-[color:var(--muted)]">
            Client connecté + presta active → page d’install PWA (Ajouter à l’écran d’accueil) puis
            portail.
          </p>
          {installUrl ? (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <code className="max-w-full truncate rounded bg-[var(--accent)] px-2 py-1 text-xs text-[color:var(--fg)]">
                  {installUrl}
                </code>
                <CopyCodeButton code={installUrl} label="Copier" />
              </div>
              <InstallQrCard installUrl={installUrl} />
            </>
          ) : (
            <p className="mt-3 text-sm text-[color:var(--muted)]">Définis un slug pour activer le lien.</p>
          )}
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">
            Questionnaire onboarding
          </h2>
          <p className="mt-1 text-xs text-[color:var(--muted)]">
            Nouveaux comptes client (1ʳᵉ ouverture). Types : texte · nombre · choix · oui/non.
          </p>

          {!onboardingQuestions.length ? (
            <p className="mt-3 text-sm text-[color:var(--muted)]">
              Aucune question — le client ira directement à l’Accueil.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--border)]">
              {onboardingQuestions.map((qq, i) => (
                <li key={qq.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <div>
                    <p className="font-semibold text-[color:var(--brand)]">
                      {i + 1}. {qq.label}
                      {qq.required ? ' *' : ''}
                    </p>
                    <p className="text-xs text-[color:var(--muted)]">
                      {qq.type}
                      {qq.options?.length ? ` · ${qq.options.join(', ')}` : ''}
                    </p>
                  </div>
                  <form action={deleteOnboardingQuestionAction}>
                    <input type="hidden" name="return_to" value="/profile/mon-app" />
                    <input type="hidden" name="question_id" value={qq.id} />
                    <button type="submit" className="text-xs font-semibold text-red-600 hover:underline">
                      Supprimer
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}

          <form action={createOnboardingQuestionAction} className="mt-4 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="return_to" value="/profile/mon-app" />
            <label className="grid gap-1 text-sm sm:col-span-2">
              <span className="font-semibold">Nouvelle question *</span>
              <input name="label" required className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold">Type</span>
              <select name="type" defaultValue="texte" className={selectFieldClass} style={selectFieldStyle}>
                <option value="texte">Texte</option>
                <option value="nombre">Nombre</option>
                <option value="oui_non">Oui / Non</option>
                <option value="choix">Choix</option>
              </select>
            </label>
            <label className="inline-flex items-center gap-2 self-end text-sm font-semibold">
              <input type="checkbox" name="required" defaultChecked className="rounded" />
              Obligatoire
            </label>
            <label className="grid gap-1 text-sm sm:col-span-2">
              <span className="font-semibold">Choix (si type Choix)</span>
              <input
                name="options"
                placeholder="Débutant, Intermédiaire, Avancé"
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
              />
            </label>
            <div className="sm:col-span-2">
              <Button type="submit" className="!rounded-lg !px-4 !py-2 text-sm font-bold">Ajouter</Button>
            </div>
          </form>
        </section>
      </div>
  )
}
