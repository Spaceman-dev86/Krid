'use client'

import { useMemo, useState } from 'react'

import PhoneMockupFrameClient from '../PhoneMockupFrameClient'
import type { OnboardingQuestion } from '../../lib/client-portal/onboarding'
import { DEFAULT_CLIENT_PRIMARY_COLOR } from '../../lib/coach/defaultClientPrimaryColor'
import { formatPriceCents, parseModules } from '../../lib/prestations/modules'

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
  primary_color: string | null
}

export type RenduPrestation = {
  id: string
  name: string
  description: string | null
  price_cents: number
  pricing_type: string
  modules: unknown
}

type Step = 'splash' | 'onboarding' | 'showroom' | 'presta'

export function ProfileRenduPreview({
  branding,
  publicProfile,
  questions,
  prestations,
}: {
  branding: RenduBranding
  publicProfile: RenduPublicProfile | null
  questions: OnboardingQuestion[]
  prestations: RenduPrestation[]
}) {
  // Client-app brand fallback (not Trainly product chrome)
  const brand = branding.primary_color?.trim() || DEFAULT_CLIENT_PRIMARY_COLOR
  const appName = branding.app_name?.trim() || 'Mon app'
  const displayName = publicProfile?.public_name?.trim() || appName
  const [step, setStep] = useState<Step>('splash')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [prestaId, setPrestaId] = useState<string | null>(null)

  const presta = useMemo(
    () => prestations.find((p) => p.id === prestaId) ?? null,
    [prestations, prestaId]
  )

  function goShowroom() {
    setPrestaId(null)
    setStep('showroom')
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        <PhoneMockupFrameClient
          ariaLabel="Aperçu prospect"
          viewportStyle={{ top: '8.2%', bottom: '6.0%', left: '7.2%', right: '7.2%' }}
        >
          <div className="flex min-h-full flex-col bg-[#f6f4f8] text-[#1a1220]">
            {step === 'splash' ? (
              <SplashScreen
                brand={brand}
                appName={appName}
                logoUrl={branding.logo_url}
                onOpen={() => setStep(questions.length ? 'onboarding' : 'showroom')}
              />
            ) : null}

            {step === 'onboarding' ? (
              <OnboardingPreview
                brand={brand}
                questions={questions}
                answers={answers}
                onChange={(id, v) => setAnswers((prev) => ({ ...prev, [id]: v }))}
                onSkip={goShowroom}
                onContinue={goShowroom}
              />
            ) : null}

            {step === 'showroom' ? (
              <ShowroomPreview
                brand={brand}
                appName={appName}
                logoUrl={branding.logo_url}
                displayName={displayName}
                tagline={publicProfile?.tagline}
                bio={publicProfile?.bio}
                photoUrl={publicProfile?.photo_url}
                coverUrl={publicProfile?.cover_url}
                prestations={prestations}
                onOpenPresta={(id) => {
                  setPrestaId(id)
                  setStep('presta')
                }}
              />
            ) : null}

            {step === 'presta' && presta ? (
              <PrestaPreview
                brand={brand}
                presta={presta}
                onBack={goShowroom}
              />
            ) : null}
          </div>
        </PhoneMockupFrameClient>
      </div>

      <aside className="grid h-fit gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm shadow-da-sm">
        <p className="text-xs font-extrabold uppercase tracking-wide text-[color:var(--brand)]">Parcours</p>
        <ol className="grid gap-2 text-xs text-[color:var(--muted)]">
          <li className={step === 'splash' ? 'font-bold text-[color:var(--brand)]' : ''}>1. Écran d’accueil app</li>
          <li className={step === 'onboarding' ? 'font-bold text-[color:var(--brand)]' : ''}>
            2. Questionnaire (non sauvegardé)
          </li>
          <li className={step === 'showroom' || step === 'presta' ? 'font-bold text-[color:var(--brand)]' : ''}>
            3. Showroom / fiches
          </li>
        </ol>
        <p className="text-[11px] leading-relaxed text-[color:var(--muted)]">
          Preview prospect uniquement — pas de portail client. Remplir le questionnaire ne persiste rien.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setAnswers({})
              setPrestaId(null)
              setStep('splash')
            }}
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold text-[color:var(--muted)]"
          >
            Rejouer
          </button>
          <button
            type="button"
            onClick={goShowroom}
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold text-[color:var(--muted)]"
          >
            Aller au showroom
          </button>
        </div>
      </aside>
    </div>
  )
}

function SplashScreen({
  brand,
  appName,
  logoUrl,
  onOpen,
}: {
  brand: string
  appName: string
  logoUrl: string | null
  onOpen: () => void
}) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-5 px-6 py-10">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="h-20 w-20 rounded-[22px] object-cover shadow-md" />
      ) : (
        <div
          className="flex h-20 w-20 items-center justify-center rounded-[22px] text-2xl font-bold text-white shadow-md"
          style={{ background: brand }}
        >
          {appName.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/35">Installer</p>
        <p className="mt-1 text-lg font-extrabold" style={{ color: brand }}>
          {appName}
        </p>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-sm"
        style={{ background: brand }}
      >
        Ouvrir l’app
      </button>
    </div>
  )
}

function OnboardingPreview({
  brand,
  questions,
  answers,
  onChange,
  onSkip,
  onContinue,
}: {
  brand: string
  questions: OnboardingQuestion[]
  answers: Record<string, string>
  onChange: (id: string, v: string) => void
  onSkip: () => void
  onContinue: () => void
}) {
  return (
    <div className="flex min-h-full flex-col px-4 py-5">
      <h2 className="text-lg font-extrabold" style={{ color: brand }}>
        Bienvenue
      </h2>
      <p className="mt-1 text-xs text-black/50">Questionnaire d’onboarding · preview (non enregistré)</p>

      <div className="mt-4 flex-1 space-y-3">
        {questions.map((q) => (
          <label key={q.id} className="grid gap-1 text-xs">
            <span className="font-semibold text-black/70">
              {q.label}
              {q.required ? ' *' : ''}
            </span>
            {q.type === 'oui_non' ? (
              <select
                value={answers[q.id] ?? ''}
                onChange={(e) => onChange(q.id, e.target.value)}
                className="rounded-lg border border-black/15 bg-white px-2 py-1.5"
              >
                <option value="">—</option>
                <option value="oui">Oui</option>
                <option value="non">Non</option>
              </select>
            ) : q.type === 'choix' && q.options?.length ? (
              <select
                value={answers[q.id] ?? ''}
                onChange={(e) => onChange(q.id, e.target.value)}
                className="rounded-lg border border-black/15 bg-white px-2 py-1.5"
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
                className="rounded-lg border border-black/15 bg-white px-2 py-1.5"
              />
            )}
          </label>
        ))}
      </div>

      <div className="mt-4 grid gap-2">
        <button
          type="button"
          onClick={onContinue}
          className="rounded-xl py-2.5 text-sm font-bold text-white"
          style={{ background: brand }}
        >
          Continuer
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="rounded-xl border border-black/10 bg-white py-2 text-sm font-semibold text-black/55"
        >
          Passer le questionnaire
        </button>
      </div>
    </div>
  )
}

function ShowroomPreview({
  brand,
  appName,
  logoUrl,
  displayName,
  tagline,
  bio,
  photoUrl,
  coverUrl,
  prestations,
  onOpenPresta,
}: {
  brand: string
  appName: string
  logoUrl: string | null
  displayName: string
  tagline: string | null | undefined
  bio: string | null | undefined
  photoUrl: string | null | undefined
  coverUrl: string | null | undefined
  prestations: RenduPrestation[]
  onOpenPresta: (id: string) => void
}) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center gap-2 border-b border-black/10 bg-white px-3 py-2.5">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
        ) : (
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ background: brand }}
          >
            {appName.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-black/35">Showroom</p>
          <p className="text-xs font-bold text-black/70">{appName}</p>
        </div>
      </header>

      <div className="space-y-3 p-3">
        <section className="overflow-hidden rounded-xl border border-black/10 shadow-sm">
          <div className="relative min-h-[120px]">
            {coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0" style={{ background: brand }} />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />
            <div className="relative flex min-h-[120px] flex-col justify-end p-3 pt-10">
              <div className="flex items-end gap-2">
                {photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoUrl}
                    alt=""
                    className="h-12 w-12 rounded-full border-2 border-white object-cover"
                  />
                ) : (
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white text-sm font-bold text-white"
                    style={{ background: brand }}
                  >
                    {displayName.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 text-white">
                  <p className="text-sm font-extrabold leading-tight">{displayName}</p>
                  {tagline ? <p className="mt-0.5 text-[11px] text-white/85">{tagline}</p> : null}
                </div>
              </div>
              {bio ? (
                <p className="mt-2 line-clamp-3 text-[11px] leading-relaxed text-white/90">{bio}</p>
              ) : null}
            </div>
          </div>
        </section>

        <p className="text-[10px] font-extrabold uppercase tracking-wide text-black/40">Offres</p>
        {!prestations.length ? (
          <p className="rounded-xl border border-dashed border-black/15 bg-white px-3 py-6 text-center text-xs text-black/40">
            Aucune offre publiée
          </p>
        ) : (
          <ul className="grid gap-2">
            {prestations.map((p) => {
              const mods = parseModules(p.modules)
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onOpenPresta(p.id)}
                    className="w-full rounded-xl border border-black/10 bg-white p-3 text-left shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-extrabold" style={{ color: brand }}>
                        {p.name}
                      </p>
                      <p className="shrink-0 text-xs font-bold text-black/65">
                        {formatPriceCents(p.price_cents)}
                      </p>
                    </div>
                    {p.description ? (
                      <p className="mt-1 line-clamp-2 text-[11px] text-black/50">{p.description}</p>
                    ) : null}
                    <p className="mt-1 text-[10px] text-black/35">
                      {p.pricing_type === 'renewable' ? 'Mensuel' : 'Unique'}
                      {mods.length ? ` · ${mods.join(', ')}` : ''}
                    </p>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

function PrestaPreview({
  brand,
  presta,
  onBack,
}: {
  brand: string
  presta: RenduPrestation
  onBack: () => void
}) {
  const mods = parseModules(presta.modules)
  return (
    <div className="flex min-h-full flex-col px-4 py-4">
      <button type="button" onClick={onBack} className="text-left text-xs font-semibold" style={{ color: brand }}>
        ← Showroom
      </button>
      <h2 className="mt-3 text-lg font-extrabold" style={{ color: brand }}>
        {presta.name}
      </h2>
      <p className="mt-1 text-sm font-bold text-black/70">{formatPriceCents(presta.price_cents)}</p>
      <p className="mt-1 text-[11px] text-black/45">
        {presta.pricing_type === 'renewable' ? 'Mensuel' : 'Paiement unique'}
        {mods.length ? ` · ${mods.join(', ')}` : ''}
      </p>
      {presta.description ? (
        <p className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-black/60">{presta.description}</p>
      ) : null}
      <div className="mt-auto space-y-2 pt-6">
        <button
          type="button"
          disabled
          className="w-full cursor-not-allowed rounded-xl py-2.5 text-sm font-bold text-white opacity-60"
          style={{ background: brand }}
        >
          Payer (simulation hors preview)
        </button>
        <p className="text-center text-[10px] text-black/40">
          Stop avant portail — utilise le showroom live pour tester le paiement.
        </p>
      </div>
    </div>
  )
}
