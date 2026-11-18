'use client'

import Link from 'next/link'
import { createPortal } from 'react-dom'
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type RefObject,
} from 'react'

import { ShowroomWeekPreviewBlock } from '@/src/components/showroom/ShowroomWeekPreviewBlock'
import {
  contrastBrandFg,
  deriveSecondaryColor,
  normalizeBgStyle,
  normalizeThemeMode,
  type ClientBgStyle,
  type ClientThemeMode,
} from '@/src/lib/coach/clientBrandTheme'
import { DEFAULT_CLIENT_PRIMARY_COLOR } from '@/src/lib/coach/defaultClientPrimaryColor'
import { formatPriceCents } from '@/src/lib/prestations/modules'
import type { ShowroomWeekPreview } from '@/src/lib/prestations/loadShowroomWeekPreview'
import {
  parseVideoEmbed,
  type IncludedContentItem,
} from '@/src/lib/prestations/showroomPresentation'

export type PrestationShowroomVignetteProps = {
  name: string
  description?: string | null
  showroomDescription?: string | null
  priceCents: number
  pricingType: string
  photoUrl: string | null
  videoUrl?: string | null
  photoIsCover?: boolean
  videoRole?: 'cover' | 'inline' | null
  eyebrow?: string | null
  ctaLabel?: string | null
  /** Tags sur la card (déjà tronqués côté éditeur / page). */
  tags: string[]
  /** Tags dans la popup (défaut = tags card). */
  popupTags?: string[]
  /** Limite d’affichage card si tags non pré-tronqués (défaut : longueur de tags). */
  cardTagCount?: number
  included?: IncludedContentItem[]
  weekPreview?: ShowroomWeekPreview | null
  brandColor?: string | null
  secondaryColor?: string | null
  themeMode?: ClientThemeMode | string | null
  bgStyle?: ClientBgStyle | string | null
  appName?: string | null
  logoUrl?: string | null
  previewMode?: boolean
  compact?: boolean
  className?: string
  aspectClassName?: string
  /** portal = modal page · phone = fiche plein écran dans le mockup */
  sheetMode?: 'portal' | 'phone'
  /** Conteneur overlay mockup (hors zone scroll) si sheetMode=phone. */
  sheetContainerRef?: RefObject<HTMLElement | null>
  /** CTA popup (hors preview) → lien vers la fiche presta. */
  ctaHref?: string | null
  /** Ouvre la sheet au mount (ex. retour ?open= depuis page intérêt). */
  defaultOpen?: boolean
  /** Preview coach : CTA popup au lieu de fermer (ex. page infos prospect). */
  onPreviewCta?: () => void
  /** DnD réordonnancement (mockup showroom). */
  reorderable?: boolean
  dragging?: boolean
  dragOver?: boolean
  onReorderDragStart?: (e: DragEvent) => void
  onReorderDragOver?: (e: DragEvent) => void
  onReorderDrop?: (e: DragEvent) => void
  onReorderDragEnd?: (e: DragEvent) => void
}

export function PrestationShowroomVignette({
  name,
  description,
  showroomDescription,
  priceCents,
  pricingType,
  photoUrl,
  videoUrl,
  photoIsCover = true,
  videoRole = null,
  eyebrow,
  ctaLabel,
  tags,
  popupTags,
  cardTagCount,
  included = [],
  weekPreview = null,
  brandColor,
  secondaryColor,
  themeMode: themeModeRaw,
  bgStyle: bgStyleRaw,
  previewMode = false,
  compact = false,
  className = '',
  aspectClassName,
  sheetMode = 'portal',
  sheetContainerRef,
  ctaHref = null,
  defaultOpen = false,
  onPreviewCta,
  reorderable = false,
  dragging = false,
  dragOver = false,
  onReorderDragStart,
  onReorderDragOver,
  onReorderDrop,
  onReorderDragEnd,
}: PrestationShowroomVignetteProps) {
  const [open, setOpen] = useState(Boolean(defaultOpen))
  const [mounted, setMounted] = useState(false)
  const didDragRef = useRef(false)
  const titleId = useId()

  useEffect(() => {
    if (defaultOpen) setOpen(true)
  }, [defaultOpen])
  const brand = brandColor?.trim() || DEFAULT_CLIENT_PRIMARY_COLOR
  const secondary = secondaryColor?.trim() || deriveSecondaryColor(brand)
  const brandFg = useMemo(() => contrastBrandFg(brand), [brand])
  const themeMode = normalizeThemeMode(themeModeRaw)
  const bgStyle = normalizeBgStyle(bgStyleRaw)
  const pageBg = bgStyle === 'carbon' ? 'bg-da-canvas' : 'bg-[var(--page-bg)]'
  const pricing = pricingType === 'renewable' ? 'Mensuel' : 'Paiement unique'
  const meta = [pricing, formatPriceCents(priceCents)].filter(Boolean).join(' · ')
  const bodyDescription = String(description ?? '').trim() || null
  const bodyNote = String(showroomDescription ?? '').trim() || null
  const kicker = String(eyebrow ?? '').trim() || null
  const cta = String(ctaLabel ?? '').trim() || 'Découvrir'
  const video = parseVideoEmbed(videoUrl)
  const hasVideo = Boolean(video.kind && video.embedUrl)
  const resolvedVideoRole = hasVideo ? videoRole ?? 'inline' : null
  const videoIsCover = resolvedVideoRole === 'cover'
  const videoIsInline = resolvedVideoRole === 'inline'
  const coverIsPhoto = Boolean(photoUrl) && photoIsCover && !videoIsCover
  const phone = sheetMode === 'phone'
  const aspect = aspectClassName ?? (phone ? 'aspect-[4/5]' : 'aspect-[16/10]')
  const cardLimit =
    typeof cardTagCount === 'number' && Number.isFinite(cardTagCount)
      ? Math.max(0, Math.min(6, Math.round(cardTagCount)))
      : tags.length
  const cardTags = tags.slice(0, cardLimit)
  const sheetTags = (popupTags ?? tags).slice()

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    if (!phone) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.removeEventListener('keydown', onKey)
        document.body.style.overflow = prev
      }
    }
    return () => document.removeEventListener('keydown', onKey)
  }, [open, phone])

  const fallbackBg = {
    background: `linear-gradient(145deg, ${brand} 0%, ${secondary} 55%, #1a1220 100%)`,
  }

  const brandVars = {
    ['--brand']: brand,
    ['--brand-secondary']: secondary,
    ['--brand-fg']: brandFg,
  } as CSSProperties

  const closeBtn = (
    <button
      type="button"
      onClick={() => setOpen(false)}
      className={`pointer-events-auto absolute z-40 inline-flex items-center justify-center rounded-full bg-black/45 font-bold text-white shadow-md backdrop-blur-sm hover:bg-black/60 ${
        phone ? 'right-2 top-2 h-8 w-8 text-lg' : 'right-3 top-3 h-10 w-10 text-xl'
      }`}
      aria-label="Fermer"
    >
      ×
    </button>
  )

  const sheet = open ? (
    <div
      data-theme={themeMode}
      className={
        phone
          ? `pointer-events-auto absolute inset-0 z-30 flex flex-col overflow-hidden text-[color:var(--fg)] ${pageBg}`
          : 'fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto p-4 sm:p-8'
      }
      style={brandVars}
    >
      {!phone ? (
        <button
          type="button"
          className="absolute inset-0 bg-black/55"
          aria-label="Fermer"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <div
        role={phone ? 'region' : 'dialog'}
        aria-modal={phone ? undefined : true}
        aria-labelledby={titleId}
        data-theme={themeMode}
        className={
          phone
            ? `relative flex h-full min-h-0 w-full flex-col overflow-hidden text-[color:var(--fg)] ${pageBg}`
            : `relative z-10 my-4 flex max-h-[min(92vh,880px)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl text-[color:var(--fg)] shadow-2xl ring-1 ring-[var(--border)] ${pageBg}`
        }
        style={brandVars}
      >
        {closeBtn}

        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div
            className={`relative ${
              phone ? 'min-h-[11.5rem]' : 'min-h-[240px] sm:min-h-[280px]'
            }`}
          >
            {videoIsCover && (video.kind === 'youtube' || video.kind === 'vimeo') ? (
              <iframe
                title="Vidéo prestation"
                src={video.embedUrl!}
                className="absolute inset-0 h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : videoIsCover && video.kind === 'file' ? (
              <video
                src={video.embedUrl!}
                controls
                playsInline
                poster={photoUrl ?? undefined}
                className="absolute inset-0 h-full w-full object-cover bg-black"
              />
            ) : coverIsPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl!} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0" style={fallbackBg} />
            )}
            {videoIsCover && (video.kind === 'youtube' || video.kind === 'vimeo') ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 to-transparent" />
            ) : (
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/10" />
            )}
            <div
              className={`absolute inset-x-0 bottom-0 z-[1] text-white ${
                phone ? 'p-3 pr-10' : 'p-5 pr-14 sm:p-6'
              }`}
            >
              {kicker ? (
                <p
                  className={`mb-1 font-extrabold uppercase tracking-[0.14em] text-white/75 ${
                    phone ? 'text-[9px]' : 'text-[11px]'
                  }`}
                >
                  {kicker}
                </p>
              ) : null}
              <h2
                id={titleId}
                className={`font-extrabold tracking-tight ${
                  phone ? 'text-lg leading-tight' : 'text-2xl sm:text-3xl'
                }`}
              >
                {name || 'Sans titre'}
              </h2>
              <p className={`mt-1 text-white/90 ${phone ? 'text-[11px]' : 'mt-2 text-sm'}`}>{meta}</p>
              {sheetTags.length ? (
                <div className={`flex flex-wrap gap-1 ${phone ? 'mt-2' : 'mt-3 gap-1.5'}`}>
                  {sheetTags.map((tag) => (
                    <span
                      key={tag}
                      className={`rounded-full font-semibold backdrop-blur-sm ${
                        phone ? 'px-2 py-0.5 text-[9px]' : 'px-2.5 py-1 text-xs'
                      }`}
                      style={{ background: `${brand}99`, color: brandFg }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div
            className={`bg-[var(--surface)] ${
              phone ? 'grid gap-3 px-3 py-3' : 'grid gap-5 px-5 py-6 sm:px-6'
            }`}
          >
            {videoIsInline && hasVideo ? (
              <div>
                <p
                  className={`font-extrabold uppercase tracking-wide ${phone ? 'text-[9px]' : 'text-xs'}`}
                  style={{ color: brand }}
                >
                  Vidéo
                </p>
                <div className="mt-1.5 aspect-video overflow-hidden rounded-xl bg-black">
                  {video.kind === 'youtube' || video.kind === 'vimeo' ? (
                    <iframe
                      title="Vidéo prestation"
                      src={video.embedUrl!}
                      className="h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <video
                      src={video.embedUrl!}
                      controls
                      playsInline
                      poster={photoUrl ?? undefined}
                      className="h-full w-full object-contain"
                    />
                  )}
                </div>
              </div>
            ) : null}

            {bodyDescription ? (
              <div>
                <p
                  className={`font-extrabold uppercase tracking-wide ${phone ? 'text-[9px]' : 'text-xs'}`}
                  style={{ color: brand }}
                >
                  À quoi t’attendre
                </p>
                <p
                  className={`mt-1.5 whitespace-pre-wrap leading-relaxed text-[color:var(--muted)] ${
                    phone ? 'text-[11px]' : 'text-sm'
                  }`}
                >
                  {bodyDescription}
                </p>
              </div>
            ) : null}

            {bodyNote ? (
              <div>
                <p
                  className={`font-extrabold uppercase tracking-wide ${phone ? 'text-[9px]' : 'text-xs'}`}
                  style={{ color: brand }}
                >
                  Note
                </p>
                <p
                  className={`mt-1.5 whitespace-pre-wrap leading-relaxed text-[color:var(--muted)] ${
                    phone ? 'text-[11px]' : 'text-sm'
                  }`}
                >
                  {bodyNote}
                </p>
              </div>
            ) : null}

            {weekPreview ? (
              <ShowroomWeekPreviewBlock
                week={weekPreview}
                brandColor={brand}
                compact={phone}
              />
            ) : null}

            {included.length ? (
              <div>
                <p
                  className={`font-extrabold uppercase tracking-wide ${phone ? 'text-[9px]' : 'text-xs'}`}
                  style={{ color: brand }}
                >
                  Inclus
                </p>
                <ul className={`mt-1.5 flex flex-wrap ${phone ? 'gap-1' : 'gap-2'}`}>
                  {included.map((item) => (
                    <li
                      key={item.id}
                      className={`rounded-full font-semibold ${
                        phone ? 'px-2 py-0.5 text-[9px]' : 'px-3 py-1 text-xs'
                      }`}
                      style={{ background: `${brand}18`, color: brand }}
                    >
                      {item.label}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {ctaHref && !previewMode ? (
              <Link
                href={ctaHref}
                className={`inline-flex w-full items-center justify-center rounded-full font-bold shadow-md ${
                  phone ? 'px-3 py-2 text-[11px]' : 'px-5 py-2.5 text-sm'
                }`}
                style={{ background: brand, color: brandFg }}
              >
                {cta}
              </Link>
            ) : (
              <button
                type="button"
                className={`inline-flex w-full items-center justify-center rounded-full font-bold shadow-md ${
                  phone ? 'px-3 py-2 text-[11px]' : 'px-5 py-2.5 text-sm'
                }`}
                style={{ background: brand, color: brandFg }}
                onClick={() => {
                  if (previewMode) {
                    if (onPreviewCta) {
                      setOpen(false)
                      onPreviewCta()
                    } else {
                      setOpen(false)
                    }
                  }
                }}
              >
                {cta}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  ) : null

  const phoneHost = sheetContainerRef?.current
  const sheetNode =
    mounted && open
      ? phone && phoneHost
        ? createPortal(sheet, phoneHost)
        : !phone
          ? createPortal(sheet, document.body)
          : null
      : null

  return (
    <>
      <button
        type="button"
        draggable={reorderable}
        onDragStart={(e) => {
          if (!reorderable) return
          didDragRef.current = true
          e.dataTransfer.effectAllowed = 'move'
          e.dataTransfer.setData('text/plain', name)
          onReorderDragStart?.(e)
        }}
        onDragOver={(e) => {
          if (!reorderable) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          onReorderDragOver?.(e)
        }}
        onDrop={(e) => {
          if (!reorderable) return
          e.preventDefault()
          onReorderDrop?.(e)
        }}
        onDragEnd={(e) => {
          if (!reorderable) return
          onReorderDragEnd?.(e)
          window.setTimeout(() => {
            didDragRef.current = false
          }, 40)
        }}
        onClick={() => {
          if (didDragRef.current) return
          setOpen(true)
        }}
        className={`group relative block w-full overflow-hidden rounded-2xl text-left shadow-da-md ring-1 ring-black/10 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${aspect} ${className} ${
          reorderable ? 'cursor-grab active:cursor-grabbing' : 'hover:-translate-y-0.5 hover:shadow-lg'
        } ${dragging ? 'opacity-55' : ''} ${dragOver ? 'outline outline-2 outline-offset-2' : ''}`}
        style={{ outlineColor: brand }}
        aria-haspopup="dialog"
      >
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0" style={fallbackBg} />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
        {hasVideo ? (
          <span
            className={`absolute inline-flex items-center gap-1 rounded-full font-semibold text-white backdrop-blur-sm ${
              phone || compact
                ? 'left-2 top-2 px-2 py-0.5 text-[9px]'
                : 'left-3 top-3 px-2.5 py-1 text-[11px]'
            }`}
            style={{ background: `${brand}cc` }}
          >
            <span aria-hidden>▶</span> Vidéo
          </span>
        ) : null}
        {reorderable ? (
          <span
            className={`absolute rounded-full bg-black/45 font-bold text-white backdrop-blur-sm ${
              phone || compact
                ? 'right-2 top-2 px-1.5 py-0.5 text-[9px]'
                : 'right-3 top-3 px-2 py-0.5 text-[10px]'
            }`}
            aria-hidden
          >
            ⋮⋮
          </span>
        ) : null}
        <div
          className={`pointer-events-none absolute inset-x-0 bottom-0 text-white ${
            phone || compact ? 'p-2.5' : 'p-4 sm:p-5'
          }`}
        >
          {kicker && !(phone || compact) ? (
            <p className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/75">
              {kicker}
            </p>
          ) : null}
          <p
            className={`font-extrabold tracking-tight drop-shadow-sm ${
              phone || compact ? 'text-sm leading-tight' : 'text-lg sm:text-xl'
            }`}
          >
            {name || 'Sans titre'}
          </p>
          <p
            className={`text-white/85 ${
              phone || compact ? 'mt-0.5 text-[10px]' : 'mt-1 text-xs sm:text-sm'
            }`}
          >
            {meta}
          </p>
          {cardTags.length ? (
            <div className={`flex flex-wrap gap-1 ${phone || compact ? 'mt-1.5' : 'mt-2.5'}`}>
              {cardTags.map((tag) => (
                <span
                  key={tag}
                  className={`rounded-full font-semibold backdrop-blur-sm ${
                    phone || compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'
                  }`}
                  style={{ background: `${brand}aa`, color: brandFg }}
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
          <p className={`font-semibold ${phone || compact ? 'mt-1.5 text-[11px]' : 'mt-2.5 text-sm'}`}>
            {cta} →
          </p>
        </div>
      </button>
      {sheetNode}
    </>
  )
}
