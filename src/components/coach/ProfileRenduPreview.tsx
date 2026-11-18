'use client'

import { useMemo, useState, type CSSProperties } from 'react'

import PhoneMockupFrameClient from '../PhoneMockupFrameClient'
import { IosStatusBar } from '../client-portal/IosStatusBar'
import type { OnboardingQuestion } from '../../lib/client-portal/onboarding'
import {
  contrastBrandFg,
  deriveSecondaryColor,
  normalizeBgStyle,
  normalizeThemeMode,
  type ClientBgStyle,
  type ClientThemeMode,
} from '../../lib/coach/clientBrandTheme'
import { DEFAULT_CLIENT_PRIMARY_COLOR } from '../../lib/coach/defaultClientPrimaryColor'
import type { ShowroomTestimonial } from '../../lib/coach/showroomTestimonials'
import type { HydratedShowroomOffer } from '../../lib/prestations/hydrateShowroomOfferCards'
import { formatPriceCents } from '../../lib/prestations/modules'
import { IconDumbbell, IconHome, IconList, IconUser, IconUsers } from '../ui/icons'
import { ShowroomProfilePhonePreview } from './ShowroomProfilePhonePreview'

/** Cadre vide — contenu derrière (uniquement /profile/rendu) */
const RENDU_IPHONE_FRAME = '/mockups/mockup_vide.png'

export type RenduPublicProfile = {
  public_name: string | null
  tagline: string | null
  bio: string | null
  photo_url: string | null
  cover_url: string | null
}

export type RenduBranding = {
  slug: string
  app_name: string | null
  logo_url: string | null
  pwa_icon_url?: string | null
  primary_color: string | null
  secondary_color?: string | null
  theme_mode?: string | null
  bg_style?: string | null
  app_showroom_title?: string | null
  app_showroom_pitch?: string | null
}

export type RenduShowroomExtras = {
  videoUrl?: string
  headerTags?: string[]
  testimonials?: ShowroomTestimonial[]
  appFeatures?: string[]
}

type Step = 'homescreen' | 'onboarding' | 'portal' | 'showroom' | 'presta'

export function ProfileRenduPreview({
  branding,
  publicProfile,
  questions,
  prestations,
  showroom,
}: {
  branding: RenduBranding
  publicProfile: RenduPublicProfile | null
  questions: OnboardingQuestion[]
  prestations: HydratedShowroomOffer[]
  showroom?: RenduShowroomExtras
}) {
  const brand = branding.primary_color?.trim() || DEFAULT_CLIENT_PRIMARY_COLOR
  const secondary = branding.secondary_color?.trim() || deriveSecondaryColor(brand)
  const themeMode = normalizeThemeMode(branding.theme_mode)
  const bgStyle = normalizeBgStyle(branding.bg_style)
  const appName = branding.app_name?.trim() || 'Mon app'
  const displayName = publicProfile?.public_name?.trim() || appName
  const pwaIcon = branding.pwa_icon_url?.trim() || null
  const appLogo = branding.logo_url?.trim() || pwaIcon || null
  const homeIcon = pwaIcon || appLogo
  const [step, setStep] = useState<Step>('homescreen')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [prestaId, setPrestaId] = useState<string | null>(null)

  const presta = useMemo(
    () => prestations.find((p) => p.id === prestaId) ?? null,
    [prestations, prestaId],
  )

  function openAppFromHome() {
    setStep(questions.length ? 'onboarding' : 'portal')
  }

  function goPortal() {
    setPrestaId(null)
    setStep('portal')
  }

  function goShowroom() {
    setPrestaId(null)
    setStep('showroom')
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        <PhoneMockupFrameClient
          ariaLabel="Aperçu client avec l’app"
          frameSrc={RENDU_IPHONE_FRAME}
          frameOnTop
          viewportStyle={{ top: '2.8%', bottom: '2.8%', left: '5.2%', right: '5.2%' }}
          viewportClassName="!bg-transparent !rounded-[12%]"
        >
          <div className="flex h-full min-h-full flex-col bg-[#0c0c0e] text-[#1a1220]">
            {step === 'homescreen' ? (
              <IosHomeScreen
                appName={appName}
                iconUrl={homeIcon}
                brand={brand}
                onOpenApp={openAppFromHome}
              />
            ) : step === 'showroom' ? (
              <ShowroomProfilePhonePreview
                embedded
                mode="client"
                publicName={displayName}
                tagline={publicProfile?.tagline?.trim() || ''}
                bio={publicProfile?.bio?.trim() || ''}
                photoUrl={publicProfile?.photo_url ?? null}
                coverUrl={publicProfile?.cover_url ?? null}
                videoUrl={showroom?.videoUrl ?? null}
                headerTags={showroom?.headerTags ?? []}
                testimonials={showroom?.testimonials ?? []}
                appName={appName}
                appTitle={branding.app_showroom_title?.trim() || ''}
                appPitch={branding.app_showroom_pitch?.trim() || ''}
                appFeatures={showroom?.appFeatures ?? []}
                logoUrl={appLogo}
                brandColor={brand}
                secondaryColor={secondary}
                themeMode={themeMode}
                bgStyle={bgStyle}
                prestations={prestations}
                onOfferSelect={(id) => {
                  setPrestaId(id)
                  setStep('presta')
                }}
              />
            ) : (
              <>
                <div
                  className={`relative z-[3] shrink-0 pt-[0.58rem] pb-1 ${
                    themeMode === 'light' ? 'bg-[#f3f3f5]' : 'bg-[#16161a]'
                  }`}
                >
                  <IosStatusBar light={themeMode !== 'light'} />
                </div>
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  {step === 'onboarding' ? (
                    <OnboardingPreview
                      brand={brand}
                      themeMode={themeMode}
                      bgStyle={bgStyle}
                      questions={questions}
                      answers={answers}
                      onChange={(id, v) => setAnswers((prev) => ({ ...prev, [id]: v }))}
                      onSkip={goPortal}
                      onContinue={goPortal}
                    />
                  ) : null}

                  {step === 'portal' ? (
                    <ClientPortalPreview
                      appName={appName}
                      logoUrl={appLogo}
                      brand={brand}
                      secondary={secondary}
                      themeMode={themeMode}
                      bgStyle={bgStyle}
                      onOpenShowroom={goShowroom}
                    />
                  ) : null}

                  {step === 'presta' && presta ? (
                    <PrestaPreview
                      brand={brand}
                      brandFg={contrastBrandFg(brand)}
                      themeMode={themeMode}
                      bgStyle={bgStyle}
                      presta={presta}
                      onBack={goShowroom}
                    />
                  ) : null}
                </div>
              </>
            )}
          </div>
        </PhoneMockupFrameClient>
      </div>

      <aside className="grid h-fit gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm shadow-da-sm">
        <p className="text-xs font-extrabold uppercase tracking-wide text-[color:var(--brand)]">Parcours</p>
        <p className="rounded-md bg-[var(--accent)] px-2 py-1 text-[10px] font-semibold text-[color:var(--muted)]">
          Parcours client (déjà l’app) — pas de tunnel prospect
        </p>
        <ol className="grid gap-2 text-xs text-[color:var(--muted)]">
          <li className={step === 'homescreen' ? 'font-bold text-[color:var(--brand)]' : ''}>
            1. Écran d’accueil iPhone
          </li>
          <li className={step === 'onboarding' ? 'font-bold text-[color:var(--brand)]' : ''}>
            2. Bienvenue
          </li>
          <li className={step === 'portal' ? 'font-bold text-[color:var(--brand)]' : ''}>
            3. Portail client
          </li>
          <li className={step === 'showroom' || step === 'presta' ? 'font-bold text-[color:var(--brand)]' : ''}>
            4. Showroom → popup → payer
          </li>
        </ol>
        <p className="text-[11px] leading-relaxed text-[color:var(--muted)]">
          Prospect (Je suis intéressé / page infos) = mockup sur /profile.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setAnswers({})
              setPrestaId(null)
              setStep('homescreen')
            }}
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold text-[color:var(--muted)]"
          >
            Rejouer
          </button>
          <button
            type="button"
            onClick={goPortal}
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold text-[color:var(--muted)]"
          >
            Portail client
          </button>
          <button
            type="button"
            onClick={goShowroom}
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold text-[color:var(--muted)]"
          >
            Showroom
          </button>
        </div>
      </aside>
    </div>
  )
}

/** Icône PWA + dock iOS (fond = PNG mockup). */
function IosHomeScreen({
  appName,
  iconUrl,
  brand,
  onOpenApp,
}: {
  appName: string
  iconUrl: string | null
  brand: string
  onOpenApp: () => void
}) {
  const letter = appName.slice(0, 1).toUpperCase()
  const brandFg = contrastBrandFg(brand)
  return (
    <div
      className="relative h-full min-h-full w-full"
      style={{
        background:
          'linear-gradient(165deg, #1a0a28 0%, #341c44 28%, #6b3d8f 55%, #9b6bb8 78%, #d6c4e8 100%)',
      }}
    >
      {/* Status bar dans les oreilles du notch */}
      <div className="relative z-[2] pt-[0.58rem]">
        <IosStatusBar light />
      </div>
      <button
        type="button"
        onClick={onOpenApp}
        className="absolute left-[6%] top-[11%] flex w-[22%] flex-col items-center gap-1 text-center transition active:scale-95"
      >
        {iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={iconUrl}
            alt=""
            className="aspect-square w-full rounded-[22%] object-cover shadow-lg shadow-black/35"
          />
        ) : (
          <div
            className="flex aspect-square w-full items-center justify-center rounded-[22%] text-[clamp(1rem,4vw,1.4rem)] font-bold shadow-lg shadow-black/35"
            style={{ background: brand, color: brandFg }}
          >
            {letter}
          </div>
        )}
        <span className="max-w-full truncate text-[clamp(8px,2.4vw,11px)] font-medium leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
          {appName}
        </span>
      </button>

      <div className="absolute inset-x-[5%] bottom-[2.2%]">
        <div className="flex items-center justify-around rounded-[22px] bg-white/22 px-2.5 py-2.5 shadow-inner backdrop-blur-md ring-1 ring-white/25">
          <DockIcon kind="phone" />
          <DockIcon kind="safari" />
          <DockIcon kind="messages" />
          <DockIcon kind="music" />
        </div>
      </div>
    </div>
  )
}

function DockIcon({ kind }: { kind: 'phone' | 'safari' | 'messages' | 'music' }) {
  const bg =
    kind === 'phone'
      ? 'bg-gradient-to-b from-lime-400 to-green-600'
      : kind === 'safari'
        ? 'bg-gradient-to-b from-sky-300 to-blue-600'
        : kind === 'messages'
          ? 'bg-gradient-to-b from-lime-300 to-green-500'
          : 'bg-gradient-to-b from-pink-400 to-rose-600'

  return (
    <span
      className={`flex h-11 w-11 items-center justify-center rounded-[11px] text-white shadow-sm ${bg}`}
      aria-hidden
    >
      {kind === 'phone' ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
          <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1.1-.2 1.2.4 2.5.6 3.8.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.6.6 3.8.1.4 0 .8-.3 1.1L6.6 10.8z" />
        </svg>
      ) : kind === 'safari' ? (
        <svg viewBox="0 0 24 24" className="h-6 w-6">
          <circle cx="12" cy="12" r="9" fill="white" opacity="0.95" />
          <path d="M12 5.5 14.2 14 12 12.5 9.8 14 12 5.5z" fill="#e11d48" />
          <path d="M12 18.5 9.8 10 12 11.5 14.2 10 12 18.5z" fill="#0ea5e9" />
        </svg>
      ) : kind === 'messages' ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16H9l-4 4v-4.2A2.5 2.5 0 0 1 4 13.5v-8z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
          <path d="M9 4v11.3A3.2 3.2 0 1 0 11 18V8.5l8-1.6V14a3.2 3.2 0 1 0 2 3V4.8L9 7V4z" />
        </svg>
      )}
    </span>
  )
}

const PORTAL_TABS = [
  { label: 'Profil', Icon: IconUser },
  { label: 'Histo', Icon: IconList },
  { label: 'Accueil', Icon: IconHome },
  { label: 'Séance', Icon: IconDumbbell },
  { label: 'Coach', Icon: IconUsers },
] as const

/** Mini portail client (thème mon-app) dans le téléphone. */
function ClientPortalPreview({
  appName,
  logoUrl,
  brand,
  secondary,
  themeMode,
  bgStyle,
  onOpenShowroom,
}: {
  appName: string
  logoUrl: string | null
  brand: string
  secondary: string
  themeMode: ClientThemeMode
  bgStyle: ClientBgStyle
  onOpenShowroom: () => void
}) {
  const brandFg = contrastBrandFg(brand)
  const secondaryFg = contrastBrandFg(secondary)
  const letter = appName.slice(0, 1).toUpperCase()
  const mutedNav = themeMode === 'dark' ? 'rgba(236,236,240,0.45)' : 'rgba(0,0,0,0.4)'

  return (
    <div
      data-theme={themeMode}
      className={`flex h-full min-h-0 flex-1 flex-col text-[color:var(--fg)] ${
        bgStyle === 'carbon' ? 'bg-da-canvas' : 'bg-[var(--page-bg)]'
      }`}
      style={
        {
          ['--brand']: brand,
          ['--brand-secondary']: secondary,
          ['--brand-fg']: brandFg,
        } as CSSProperties
      }
    >
      <header className="relative z-[2] shrink-0 border-b border-[var(--border)] bg-[var(--surface)]/95 px-3 py-2.5">
        <div className="flex items-center gap-2">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-8 w-8 rounded-xl object-cover" />
          ) : (
            <div
              className="flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold"
              style={{ background: brand, color: brandFg }}
            >
              {letter}
            </div>
          )}
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
              Portail
            </p>
            <p className="text-xs font-extrabold" style={{ color: brand }}>
              {appName}
            </p>
          </div>
        </div>
      </header>
      <div className="relative z-[2] flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
          <p className="text-[10px] text-[color:var(--muted)]">Accueil client</p>
          <p className="mt-0.5 text-sm font-extrabold text-[color:var(--fg)]">Bonjour 👋</p>
          <p className="mt-1 text-[10px] text-[color:var(--muted)]">
            Thème {themeMode} · fond {bgStyle}
          </p>
          <span
            className="mt-2 inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold"
            style={{ background: secondary, color: secondaryFg }}
          >
            Badge secondaire
          </span>
        </div>
        <button
          type="button"
          onClick={onOpenShowroom}
          className="rounded-lg py-2.5 text-[11px] font-bold"
          style={{ background: brand, color: brandFg }}
        >
          Voir le showroom →
        </button>
      </div>
      <nav className="relative z-[2] shrink-0 border-t border-[var(--border)] bg-[var(--surface)]/95 pb-1 pt-1">
        <ul className="flex items-stretch justify-between px-0.5">
          {PORTAL_TABS.map((tab, i) => {
            const Icon = tab.Icon
            return (
              <li key={tab.label} className="flex-1">
                <span
                  className="flex flex-col items-center gap-0.5 px-0.5 py-1 text-[9px] font-bold"
                  style={{ color: i === 2 ? brand : mutedNav }}
                >
                  <Icon size={20} />
                  {tab.label}
                </span>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}

function OnboardingPreview({
  brand,
  themeMode,
  bgStyle,
  questions,
  answers,
  onChange,
  onSkip,
  onContinue,
}: {
  brand: string
  themeMode: ClientThemeMode
  bgStyle: ClientBgStyle
  questions: OnboardingQuestion[]
  answers: Record<string, string>
  onChange: (id: string, v: string) => void
  onSkip: () => void
  onContinue: () => void
}) {
  const brandFg = contrastBrandFg(brand)
  const pageBg = bgStyle === 'carbon' ? 'bg-da-canvas' : 'bg-[var(--page-bg)]'
  return (
    <div
      data-theme={themeMode}
      className={`flex min-h-full flex-col px-4 py-5 text-[color:var(--fg)] ${pageBg}`}
      style={{ ['--brand']: brand, ['--brand-fg']: brandFg } as CSSProperties}
    >
      <h2 className="text-lg font-extrabold" style={{ color: brand }}>
        Bienvenue
      </h2>
      <p className="mt-1 text-xs text-[color:var(--muted)]">
        Questionnaire d’onboarding · preview (non enregistré)
      </p>

      <div className="mt-4 flex-1 space-y-3">
        {questions.map((q) => (
          <label key={q.id} className="grid gap-1 text-xs">
            <span className="font-semibold text-[color:var(--fg)]">
              {q.label}
              {q.required ? ' *' : ''}
            </span>
            {q.type === 'oui_non' ? (
              <select
                value={answers[q.id] ?? ''}
                onChange={(e) => onChange(q.id, e.target.value)}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5"
              >
                <option value="">—</option>
                <option value="oui">Oui</option>
                <option value="non">Non</option>
              </select>
            ) : q.type === 'choix' && q.options?.length ? (
              <select
                value={answers[q.id] ?? ''}
                onChange={(e) => onChange(q.id, e.target.value)}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5"
              >
                <option value="">—</option>
                {q.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={q.type === 'nombre' ? 'number' : 'text'}
                value={answers[q.id] ?? ''}
                onChange={(e) => onChange(q.id, e.target.value)}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5"
              />
            )}
          </label>
        ))}
      </div>

      <div className="mt-4 grid gap-2">
        <button
          type="button"
          onClick={onContinue}
          className="rounded-xl py-2.5 text-sm font-bold"
          style={{ background: brand, color: brandFg }}
        >
          Continuer
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] py-2 text-sm font-semibold text-[color:var(--muted)]"
        >
          Passer le questionnaire
        </button>
      </div>
    </div>
  )
}

function PrestaPreview({
  brand,
  brandFg,
  themeMode,
  bgStyle,
  presta,
  onBack,
}: {
  brand: string
  brandFg: string
  themeMode: ClientThemeMode
  bgStyle: ClientBgStyle
  presta: HydratedShowroomOffer
  onBack: () => void
}) {
  const pageBg = bgStyle === 'carbon' ? 'bg-da-canvas' : 'bg-[var(--page-bg)]'
  const blurb = presta.showroom_description?.trim() || presta.description?.trim() || null
  const tags = presta.showroom_popup_tags.length
    ? presta.showroom_popup_tags
    : presta.showroom_tags
  return (
    <div
      data-theme={themeMode}
      className={`relative z-[2] flex min-h-full flex-col overflow-y-auto px-4 py-4 text-[color:var(--fg)] ${pageBg}`}
      style={{ ['--brand']: brand, ['--brand-fg']: brandFg } as CSSProperties}
    >
      <button
        type="button"
        onClick={onBack}
        className="text-left text-xs font-semibold"
        style={{ color: brand }}
      >
        ← Showroom
      </button>
      {presta.photo_url?.trim() ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={presta.photo_url}
          alt=""
          className="mt-3 aspect-[16/10] w-full rounded-xl object-cover"
        />
      ) : null}
      {presta.showroom_eyebrow?.trim() ? (
        <p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
          {presta.showroom_eyebrow}
        </p>
      ) : null}
      <h2 className="mt-1 text-lg font-extrabold" style={{ color: brand }}>
        {presta.name}
      </h2>
      <p className="mt-1 text-sm font-bold text-[color:var(--fg)]">
        {formatPriceCents(presta.price_cents)}
      </p>
      <p className="mt-1 text-[11px] text-[color:var(--muted)]">
        {presta.pricing_type === 'renewable' ? 'Mensuel' : 'Paiement unique'}
      </p>
      {tags.length ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {tags.slice(0, 8).map((tag) => (
            <span
              key={tag}
              className="rounded-full px-2 py-0.5 text-[9px] font-bold"
              style={{ background: brand, color: brandFg }}
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}
      {blurb ? (
        <p className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-[color:var(--muted)]">
          {blurb}
        </p>
      ) : null}
      {presta.included.length ? (
        <ul className="mt-3 grid gap-1">
          {presta.included.slice(0, 6).map((item) => (
            <li key={`${item.id}-${item.label}`} className="text-[11px] text-[color:var(--fg)]">
              · {item.label}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-auto space-y-2 pt-6">
        <button
          type="button"
          disabled
          className="w-full cursor-not-allowed rounded-xl py-2.5 text-sm font-bold opacity-60"
          style={{ background: brand, color: brandFg }}
        >
          {presta.showroom_cta_label?.trim() || 'Payer'} (simulation)
        </button>
        <p className="text-center text-[10px] text-[color:var(--muted)]">
          Preview — paiement sur le showroom live.
        </p>
      </div>
    </div>
  )
}
