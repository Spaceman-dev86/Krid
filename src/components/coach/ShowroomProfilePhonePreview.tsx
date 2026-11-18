'use client'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
} from 'react'

import { reorderShowroomPrestationsAction } from '@/src/app/profile/actions'
import PhoneMockupFrameClient from '@/src/components/PhoneMockupFrameClient'
import { IosStatusBar } from '@/src/components/client-portal/IosStatusBar'
import { ShowroomAppCard } from '@/src/components/showroom/ShowroomAppCard'
import { ShowroomTestimonialsCarousel } from '@/src/components/showroom/ShowroomTestimonialsCarousel'
import { ShowroomVideoEmbed } from '@/src/components/showroom/ShowroomVideoEmbed'
import {
  contrastBrandFg,
  deriveSecondaryColor,
  normalizeBgStyle,
  normalizeThemeMode,
  type ClientBgStyle,
  type ClientThemeMode,
} from '@/src/lib/coach/clientBrandTheme'
import type { ShowroomTestimonial } from '@/src/lib/coach/showroomTestimonials'
import { DEFAULT_CLIENT_PRIMARY_COLOR } from '@/src/lib/coach/defaultClientPrimaryColor'
import {
  resolveInterestDiscussBody,
  resolveInterestDiscussTitle,
} from '@/src/lib/coach/interestDiscussCopy'
import type { HydratedShowroomOffer } from '@/src/lib/prestations/hydrateShowroomOfferCards'

import { PrestationShowroomVignette } from './PrestationShowroomVignette'

const RENDU_IPHONE_FRAME = '/mockups/mockup_vide.png'

export type ShowroomPreviewPresta = HydratedShowroomOffer

type Props = {
  publicName: string
  tagline: string
  bio: string
  photoUrl: string | null
  coverUrl?: string | null
  videoUrl?: string | null
  /** Tags sous le header cover. */
  headerTags?: string[]
  testimonials?: ShowroomTestimonial[]
  appName: string
  appTitle: string
  appPitch: string
  appFeatures?: string[]
  logoUrl: string | null
  brandColor?: string | null
  secondaryColor?: string | null
  themeMode?: ClientThemeMode | string | null
  bgStyle?: ClientBgStyle | string | null
  interestDiscussTitle?: string | null
  interestDiscussBody?: string | null
  prestations: ShowroomPreviewPresta[]
  /** Sans cadre iPhone — à monter dans un mockup parent (ex. /profile/rendu). */
  embedded?: boolean
  /**
   * `editor` = mockup /profile (reorder + CTA intéressé).
   * `client` = parcours app déjà installée (pas de reorder / intéressé).
   */
  mode?: 'editor' | 'client'
  /** Mode client : CTA fiche → étape suivante du rendu. */
  onOfferSelect?: (prestaId: string) => void
}

function moveItem<T extends { id: string }>(list: T[], fromId: string, toId: string): T[] {
  if (fromId === toId) return list
  const from = list.findIndex((p) => p.id === fromId)
  const to = list.findIndex((p) => p.id === toId)
  if (from < 0 || to < 0) return list
  const next = list.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item!)
  return next
}

/** Mockup iPhone = showroom live (status sticky · cover scroll · offres = vignettes presta). */
export function ShowroomProfilePhonePreview({
  publicName,
  tagline,
  bio,
  photoUrl,
  coverUrl = null,
  videoUrl = null,
  headerTags = [],
  testimonials = [],
  appName,
  appTitle,
  appPitch,
  appFeatures = [],
  logoUrl,
  brandColor,
  secondaryColor,
  themeMode: themeModeRaw,
  bgStyle: bgStyleRaw,
  interestDiscussTitle = null,
  interestDiscussBody = null,
  prestations,
  embedded = false,
  mode = 'editor',
  onOfferSelect,
}: Props) {
  const isClient = mode === 'client'
  const canReorder = !isClient
  const sheetHostRef = useRef<HTMLDivElement>(null)
  const dragIdRef = useRef<string | null>(null)
  const itemsRef = useRef(prestations)
  const [items, setItems] = useState(prestations)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [orderStatus, setOrderStatus] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  /** Parcours prospect (mockup /profile) — pas le parcours client app. */
  const [prospectStep, setProspectStep] = useState<'list' | 'discuss' | 'interesse'>('list')
  const [interestPrestaName, setInterestPrestaName] = useState<string | null>(null)
  const [discussCoachHint, setDiscussCoachHint] = useState(false)
  const [discussFirstName, setDiscussFirstName] = useState('')
  const [discussLastName, setDiscussLastName] = useState('')
  const [discussEmail, setDiscussEmail] = useState('')

  const discussEmailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(discussEmail.trim())
  const discussCanSend =
    Boolean(discussFirstName.trim()) &&
    Boolean(discussLastName.trim()) &&
    discussEmailOk

  function resetDiscussForm() {
    setDiscussCoachHint(false)
    setDiscussFirstName('')
    setDiscussLastName('')
    setDiscussEmail('')
  }

  useEffect(() => {
    setItems(prestations)
    itemsRef.current = prestations
  }, [prestations])

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  const brand = brandColor?.trim() || DEFAULT_CLIENT_PRIMARY_COLOR
  const secondary = secondaryColor?.trim() || deriveSecondaryColor(brand)
  const brandFg = contrastBrandFg(brand)
  const themeMode = normalizeThemeMode(themeModeRaw)
  const bgStyle = normalizeBgStyle(bgStyleRaw)
  const pageBg = bgStyle === 'carbon' ? 'bg-da-canvas' : 'bg-[var(--page-bg)]'
  const coach = publicName.trim() || appName.trim() || 'Coach'
  const letter = coach.slice(0, 1).toUpperCase()
  const hasCover = Boolean(coverUrl?.trim())

  const shellStyle = useMemo(
    () =>
      ({
        ['--brand']: brand,
        ['--brand-secondary']: secondary,
        ['--brand-fg']: brandFg,
      }) as CSSProperties,
    [brand, secondary, brandFg],
  )

  function persistOrder(next: ShowroomPreviewPresta[]) {
    if (!canReorder) return
    const ids = next.map((p) => p.id)
    setOrderStatus('Ordre…')
    startTransition(() => {
      void (async () => {
        const res = await reorderShowroomPrestationsAction(ids)
        if (!res.ok) {
          setOrderStatus(res.error)
          setItems(prestations)
          itemsRef.current = prestations
          return
        }
        setOrderStatus('Ordre enregistré')
        window.setTimeout(() => setOrderStatus(null), 1600)
      })()
    })
  }

  const shell = (
      <div
        data-theme={themeMode}
        className={`relative h-full min-h-0 overflow-hidden text-[color:var(--fg)] ${pageBg}`}
        style={shellStyle}
      >
        {!isClient && prospectStep !== 'list' ? (
          <div
            className={`absolute inset-x-0 bottom-0 top-[1.85rem] z-[40] flex flex-col overflow-y-auto px-3 py-3 ${pageBg}`}
          >
            {prospectStep === 'discuss' ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    resetDiscussForm()
                    setProspectStep('list')
                  }}
                  className="text-left text-[10px] font-semibold"
                  style={{ color: brand }}
                >
                  ← Showroom
                </button>
                <h3 className="mt-2 text-sm font-extrabold text-[color:var(--fg)]">
                  {resolveInterestDiscussTitle(interestDiscussTitle)}
                </h3>
                <p className="mt-1.5 whitespace-pre-wrap text-[10px] leading-snug text-[color:var(--muted)]">
                  {resolveInterestDiscussBody(interestDiscussBody)}
                </p>
                <div className="mt-3 grid gap-1.5">
                  <label className="grid gap-0.5 text-[10px]">
                    <span className="font-semibold">Prénom</span>
                    <input
                      value={discussFirstName}
                      onChange={(e) => {
                        setDiscussCoachHint(false)
                        setDiscussFirstName(e.target.value)
                      }}
                      className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[10px]"
                    />
                  </label>
                  <label className="grid gap-0.5 text-[10px]">
                    <span className="font-semibold">Nom</span>
                    <input
                      value={discussLastName}
                      onChange={(e) => {
                        setDiscussCoachHint(false)
                        setDiscussLastName(e.target.value)
                      }}
                      className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[10px]"
                    />
                  </label>
                  <label className="grid gap-0.5 text-[10px]">
                    <span className="font-semibold">Email</span>
                    <input
                      type="email"
                      value={discussEmail}
                      onChange={(e) => {
                        setDiscussCoachHint(false)
                        setDiscussEmail(e.target.value)
                      }}
                      className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[10px]"
                    />
                    {discussEmail.trim() && !discussEmailOk ? (
                      <span className="text-[9px] text-red-600">Email invalide</span>
                    ) : null}
                  </label>
                </div>
                {discussCoachHint ? (
                  <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--accent)] px-2.5 py-2 text-[9px] leading-snug text-[color:var(--muted)]">
                    <p className="font-bold text-[color:var(--brand)]">Pour toi, coach</p>
                    <p className="mt-1">
                      Après Envoyer : le prospect est enregistré dans Liens → Prospects. Tu
                      récupères ses infos même s’il n’achète pas tout de suite.
                    </p>
                  </div>
                ) : null}
                <div className="mt-auto grid gap-1.5 pt-4">
                  <button
                    type="button"
                    disabled={!discussCanSend}
                    onClick={() => {
                      if (!discussCanSend) return
                      setDiscussCoachHint(true)
                    }}
                    className="inline-flex w-full justify-center rounded-full px-4 py-2 text-[11px] font-bold shadow-md disabled:cursor-not-allowed disabled:opacity-40"
                    style={{ background: brand, color: brandFg }}
                  >
                    Envoyer
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      resetDiscussForm()
                      setProspectStep('list')
                    }}
                    className="text-center text-[11px] font-semibold text-[color:var(--muted)]"
                  >
                    Passer
                  </button>
                </div>
              </>
            ) : null}
            {prospectStep === 'interesse' ? (
              <>
                <p className="text-[9px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                  {appName.trim() || 'App'}
                </p>
                <h3 className="mt-1 text-sm font-extrabold text-[color:var(--fg)]">Tes infos</h3>
                <p className="mt-1 text-[10px] text-[color:var(--muted)]">
                  Avant checkout
                  {interestPrestaName ? (
                    <>
                      {' '}
                      pour <span className="font-semibold text-[color:var(--fg)]">{interestPrestaName}</span>
                    </>
                  ) : null}
                  .
                </p>
                <div className="mt-3 grid gap-1.5">
                  {['Prénom *', 'Nom *', 'Email *', 'Naissance *'].map((label) => (
                    <label key={label} className="grid gap-0.5 text-[10px]">
                      <span className="font-semibold">{label}</span>
                      <input
                        readOnly
                        className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[10px]"
                      />
                    </label>
                  ))}
                </div>
                <div className="mt-auto grid gap-1.5 pt-4">
                  <span
                    className="inline-flex justify-center rounded-full px-3 py-2 text-[11px] font-bold"
                    style={{ background: brand, color: brandFg }}
                  >
                    Poursuivre vers le checkout
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setInterestPrestaName(null)
                      setProspectStep('list')
                    }}
                    className="text-center text-[11px] font-semibold text-[color:var(--muted)]"
                  >
                    Passer
                  </button>
                </div>
              </>
            ) : null}
          </div>
        ) : null}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[60] pt-[0.58rem] pb-1">
          <IosStatusBar
            light
            className="!pl-[1.35rem] !pr-[1.15rem] !text-[10px] drop-shadow-[0_1px_1px_rgba(0,0,0,0.55)]"
          />
        </div>

        <div
          className={`no-scrollbar absolute inset-0 z-[2] overflow-y-auto overflow-x-hidden ${
            !isClient && prospectStep !== 'list' ? 'invisible' : ''
          }`}
          aria-hidden={!isClient && prospectStep !== 'list'}
        >
          <div className="relative h-[6.4rem] overflow-hidden">
            {hasCover ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={coverUrl!}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/25 to-black/75" />
              </>
            ) : (
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(160deg, ${brand} 0%, #121218 70%)`,
                }}
              />
            )}
            <div className="relative z-[1] flex h-full items-end gap-2 px-3 pb-2 pt-6">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoUrl}
                  alt=""
                  className="h-8 w-8 shrink-0 rounded-full object-cover ring-2 ring-white/90"
                />
              ) : (
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ring-2 ring-white/90"
                  style={{ background: brand, color: brandFg }}
                >
                  {letter}
                </div>
              )}
              <div className="min-w-0 text-white">
                <p className="truncate text-[11px] font-bold drop-shadow-sm">{coach}</p>
                {tagline.trim() ? (
                  <p className="truncate text-[9px] text-white/85">{tagline}</p>
                ) : null}
              </div>
            </div>
          </div>

          <div className={`relative z-[1] px-3 py-3 ${pageBg}`}>
            {headerTags.length ? (
              <div className="mb-2.5 flex flex-wrap gap-1">
                {headerTags.slice(0, 8).map((tag) => (
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

            {bio.trim() ? (
              <p className="mb-2 whitespace-pre-wrap text-[10px] leading-snug text-[color:var(--muted)]">
                {bio}
              </p>
            ) : null}

            {videoUrl?.trim() ? (
              <ShowroomVideoEmbed
                url={videoUrl}
                title="Vidéo showroom"
                className="mb-2 !rounded-xl"
              />
            ) : null}

            <ShowroomAppCard
              appName={appName.trim() || 'App'}
              title={appTitle.trim() || null}
              pitch={appPitch.trim() || null}
              features={appFeatures}
              logoUrl={logoUrl}
              brand={brand}
              brandFg={brandFg}
              compact
            />

            {testimonials.length ? (
              <div className="mt-4">
                <p className="mb-2 text-[13px] font-extrabold tracking-tight text-[color:var(--fg)]">
                  Témoignages
                </p>
                <ShowroomTestimonialsCarousel items={testimonials} compact />
              </div>
            ) : null}

            <div className="mt-4 flex items-baseline justify-between gap-2">
              <p className="text-[13px] font-extrabold tracking-tight text-[color:var(--fg)]">
                Mes offres
              </p>
              {canReorder && items.length > 1 ? (
                <p className="text-[9px] font-semibold text-[color:var(--muted)]">Glisser pour ordonner</p>
              ) : null}
            </div>
            {orderStatus ? (
              <p className="mt-1 text-[9px] font-semibold text-[color:var(--muted)]">{orderStatus}</p>
            ) : null}
            {!items.length ? (
              <p className="mt-1.5 rounded-xl border border-dashed border-[var(--border)] px-2 py-4 text-center text-[10px] text-[color:var(--muted)]">
                Aucune presta visible showroom
              </p>
            ) : (
              <ul className="pointer-events-auto mt-1.5 grid gap-3.5">
                {items.map((p) => {
                  return (
                    <li key={p.id}>
                      <PrestationShowroomVignette
                        name={p.name}
                        description={p.description}
                        showroomDescription={p.showroom_description}
                        priceCents={p.price_cents}
                        pricingType={p.pricing_type}
                        photoUrl={p.photo_url}
                        videoUrl={p.video_url}
                        photoIsCover={p.showroom_photo_is_cover}
                        videoRole={p.showroom_video_role}
                        eyebrow={p.showroom_eyebrow}
                        ctaLabel={p.showroom_cta_label || 'Découvrir'}
                        tags={p.showroom_tags}
                        popupTags={p.showroom_popup_tags}
                        included={p.included}
                        weekPreview={p.weekPreview}
                        brandColor={brand}
                        secondaryColor={secondary}
                        themeMode={themeMode}
                        bgStyle={bgStyle}
                        appName={appName}
                        logoUrl={logoUrl}
                        previewMode
                        compact
                        sheetMode="phone"
                        sheetContainerRef={sheetHostRef}
                        aspectClassName="aspect-[16/10]"
                        onPreviewCta={() => {
                          if (isClient) {
                            onOfferSelect?.(p.id)
                            return
                          }
                          setInterestPrestaName(p.name)
                          setProspectStep('interesse')
                        }}
                        reorderable={canReorder && items.length > 1}
                        dragging={dragId === p.id}
                        dragOver={overId === p.id && dragId !== p.id}
                        onReorderDragStart={() => {
                          if (!canReorder) return
                          dragIdRef.current = p.id
                          setDragId(p.id)
                          setOverId(null)
                        }}
                        onReorderDragOver={() => {
                          if (!canReorder) return
                          const from = dragIdRef.current
                          if (!from || from === p.id) return
                          setOverId(p.id)
                          setItems((prev) => moveItem(prev, from, p.id))
                        }}
                        onReorderDrop={() => {
                          setOverId(null)
                        }}
                        onReorderDragEnd={() => {
                          if (!canReorder) return
                          dragIdRef.current = null
                          setDragId(null)
                          setOverId(null)
                          const current = itemsRef.current
                          const same =
                            current.length === prestations.length &&
                            current.every((row, i) => row.id === prestations[i]?.id)
                          if (!same) {
                            // Hors du cycle render (évite startTransition pendant setState)
                            window.setTimeout(() => persistOrder(current), 0)
                          }
                        }}
                      />
                    </li>
                  )
                })}
              </ul>
            )}

            {!isClient ? (
              <div className="mt-3 px-1 pb-1">
                <button
                  type="button"
                  onClick={() => {
                    resetDiscussForm()
                    setProspectStep('discuss')
                  }}
                  className="inline-flex w-full justify-center rounded-full px-4 py-2 text-[11px] font-bold shadow-md"
                  style={{ background: brand, color: brandFg }}
                >
                  Je suis intéressé
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {/* Overlay popup hors scroll — pointer-events gérés par la sheet */}
        <div
          ref={sheetHostRef}
          className="pointer-events-none absolute inset-0 z-40 overflow-hidden"
        />
      </div>
  )

  if (embedded) return shell

  return (
    <PhoneMockupFrameClient
      ariaLabel="Aperçu showroom prospect"
      frameSrc={RENDU_IPHONE_FRAME}
      frameOnTop
      scrollable={false}
      className="max-w-[280px] sm:max-w-[300px]"
      viewportStyle={{ top: '2.8%', bottom: '2.8%', left: '5.2%', right: '5.2%' }}
      viewportClassName="!bg-transparent !rounded-[12%]"
    >
      {shell}
    </PhoneMockupFrameClient>
  )
}
