'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

export type CoachOfferIconPair = {
  default: string | null
  hover: string | null
}

export type CoachOfferIcons = {
  runner: CoachOfferIconPair
  bike: CoachOfferIconPair
  dumbbell: CoachOfferIconPair
}

type OfferItem = {
  href: string
  title: string
  description: string
  cta: string
  iconKey: keyof CoachOfferIcons
  fallbackIcon: ReactNode
}

const gradientClass = 'bg-gradient-to-r from-[#d6c4e8] via-[#9b6bb8] to-[#341c44]'
const mirrorClass =
  'ring-1 ring-[#d6c4e8] bg-clip-text text-transparent bg-gradient-to-r from-[#9b6bb8] to-[#341c44] bg-white hover:bg-[#faf7ff]'

function SportIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={52}
      height={52}
      aria-hidden
      className="block"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  )
}

const offers: OfferItem[] = [
  {
    href: '/mon-app',
    title: 'Une app à ton image',
    description:
      'Une application mobile brandée pour ton univers sportif : tes clients accèdent à leurs programmes avec une expérience fluide et professionnelle.',
    cta: 'Découvrir mon app',
    iconKey: 'runner',
    fallbackIcon: (
      <SportIcon>
        <circle cx="11" cy="5" r="2" />
        <path d="M8 21l2.5-7 2.5 1 2-4" />
        <path d="M6.5 12 9 10l3 1 2.5-2" />
        <path d="M14.5 9 17 12l1.5 6" />
      </SportIcon>
    ),
  },
  {
    href: '/simulation',
    title: 'Un prix adapté à ta structure',
    description:
      'Une offre pensée pour évoluer avec toi : tu choisis un plan selon le nombre de clients et les options dont tu as besoin (paiement, app, Strava…).',
    cta: 'Simuler mon offre',
    iconKey: 'bike',
    fallbackIcon: (
      <SportIcon>
        <circle cx="5.5" cy="17.5" r="3" />
        <circle cx="18.5" cy="17.5" r="3" />
        <path d="M5.5 17.5h4l2.5-6.5H15l2 3.5" />
        <path d="M12 11V8.5L9.5 6" />
        <path d="M9.5 6h4.5" />
      </SportIcon>
    ),
  },
  {
    href: '/login',
    title: 'Teste la démo gratuite',
    description:
      'Explore le program builder, structure tes séances et visualise le rendu client — sans engagement, pour valider le potentiel de ton offre.',
    cta: 'Essayer gratuitement',
    iconKey: 'dumbbell',
    fallbackIcon: (
      <SportIcon>
        <path d="M6.5 6a2.5 2.5 0 0 0-2.5 2.5v7a2.5 2.5 0 0 0 2.5 2.5" />
        <path d="M17.5 6a2.5 2.5 0 0 1 2.5 2.5v7a2.5 2.5 0 0 1-2.5 2.5" />
        <path d="M8 12h8" />
      </SportIcon>
    ),
  },
]

function OfferIcon({ icon, fallbackIcon }: { icon: CoachOfferIconPair; fallbackIcon: ReactNode }) {
  const hasImage = Boolean(icon.default || icon.hover)

  return (
    <div
      className={`mx-auto flex h-[7.5rem] w-[7.5rem] items-center justify-center rounded-full p-[3px] shadow-[0_10px_28px_rgba(52,28,68,0.14)] transition-all duration-300 group-hover:p-0 group-hover:shadow-[0_14px_36px_rgba(52,28,68,0.24)] ${gradientClass}`}
    >
      <div className="flex h-full w-full items-center justify-center rounded-full bg-white text-[#341c44] transition-all duration-300 group-hover:bg-transparent group-hover:text-white">
        {hasImage ? (
          <span className="relative block h-[4.25rem] w-[4.25rem]">
            {icon.default ? (
              <img
                src={icon.default}
                alt=""
                className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-300 ${icon.hover ? 'group-hover:opacity-0' : ''}`}
                loading="lazy"
              />
            ) : null}
            {icon.hover ? (
              <img
                src={icon.hover}
                alt=""
                className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-300 ${icon.default ? 'opacity-0 group-hover:opacity-100' : ''}`}
                loading="lazy"
              />
            ) : null}
          </span>
        ) : (
          fallbackIcon
        )}
      </div>
    </div>
  )
}

function OfferCta({ label, variant }: { label: string; variant: 'gradient' | 'mirror' }) {
  return (
    <span
      className={[
        'mt-5 inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-extrabold transition',
        variant === 'gradient'
          ? `${gradientClass} text-white shadow-[0_8px_24px_rgba(52,28,68,0.22)] hover:opacity-95`
          : mirrorClass,
      ].join(' ')}
    >
      {label}
    </span>
  )
}

type Props = {
  icons: CoachOfferIcons
}

export default function CoachOfferSectionClient({ icons }: Props) {
  return (
    <section className="bg-[var(--bg)]">
      <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-6 md:py-16">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-4xl font-extrabold tracking-tight text-[#9b6bb8] sm:text-5xl md:text-[3.25rem] md:leading-tight">
            Crée ta solution personnalisée pour ton sport et tes clients
          </h2>
          <p className="mt-5 text-base leading-relaxed text-[color:var(--muted)] md:text-lg">
            Que tu sois coach muscu, running, yoga ou autre, je t&apos;aide à lancer un site ou une app à ton nom — pour
            vendre tes programmes avec une présentation digne d&apos;un produit pro.
          </p>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-3 md:gap-6 lg:gap-10">
          {offers.map((offer) => (
            <Link
              key={offer.href}
              href={offer.href}
              className="group flex flex-col items-center rounded-[var(--radius-lg)] px-4 py-6 text-center transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#341c44]"
            >
              <OfferIcon icon={icons[offer.iconKey]} fallbackIcon={offer.fallbackIcon} />
              <h3 className="mt-6 text-lg font-extrabold text-[#341c44]">{offer.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[color:var(--muted)]">{offer.description}</p>
              <OfferCta label={offer.cta} variant="mirror" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
