'use client'

import { appUrl } from '@/lib/urls'
import Link from 'next/link'
import { type ReactNode, useEffect, useRef, useState } from 'react'

import { Container, SectionHeading } from './index'

type ProcessStep = {
  title: string
  description: string
  icon: ReactNode
}

const steps: ProcessStep[] = [
  {
    title: 'Définis tes besoins',
    description: 'Modules, fonctionnalités, nombre de clients : on cadrer ensemble ton projet.',
    icon: (
      <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" strokeLinecap="round" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <path d="M9 12h6M9 16h4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: 'Importe ton univers',
    description: 'Logo, couleurs, images : ton branding prend vie dans l’application.',
    icon: (
      <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden fill="none" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="9" />
        <path d="M8 16l2.5-3 2 2.5L14 13l4 5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="9" cy="9" r="1.2" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    title: 'Reçois ton application rapidement',
    description: 'On t’envoie ton application personnalisée en peu de temps, prête à être testée.',
    icon: (
      <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M13 2L4 14h7l-1 8 10-14h-7l0-6z" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: 'Commence à générer des revenus',
    description: 'Mise en ligne, accompagnement et évolution pour développer ton activité.',
    icon: (
      <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M4 18V6" strokeLinecap="round" />
        <path d="M4 18h16" strokeLinecap="round" />
        <path d="M8 14V10M12 14V7M16 14v-4" strokeLinecap="round" />
      </svg>
    ),
  },
]

function useReveal(delayMs = 0) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        window.setTimeout(() => setVisible(true), delayMs)
        observer.disconnect()
      },
      { threshold: 0.15, rootMargin: '0px 0px -5% 0px' }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [delayMs])

  return { ref, visible }
}

function ProcessStepCard(props: { step: ProcessStep; index: number }) {
  const { step, index } = props
  const { ref, visible } = useReveal(index * 100)

  return (
    <div
      ref={ref}
      className={[
        'process-step-card group relative',
        visible ? 'process-step-visible' : 'process-step-hidden',
      ].join(' ')}
      style={{ transitionDelay: `${index * 80}ms` }}
    >
      <div className="relative h-full rounded-[1.75rem] bg-white p-5 shadow-[0_14px_40px_rgba(52,28,68,0.08)] ring-1 ring-black/10 transition duration-500 group-hover:-translate-y-1 group-hover:shadow-[0_20px_48px_rgba(52,28,68,0.14)] sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#d6c4e8] to-[#341c44] text-white shadow-[0_8px_20px_rgba(52,28,68,0.22)]">
            {step.icon}
          </div>
          <div className="text-3xl font-extrabold tabular-nums text-[#341c44]/15">{String(index + 1).padStart(2, '0')}</div>
        </div>

        <h3 className="text-base font-extrabold text-[#341c44] sm:text-lg">{step.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-black/60">{step.description}</p>

        <div className="process-step-shine pointer-events-none absolute inset-x-5 bottom-0 h-px bg-gradient-to-r from-transparent via-[#9b6bb8]/50 to-transparent opacity-0 transition duration-500 group-hover:opacity-100" />
      </div>
    </div>
  )
}

export default function AppProcessSection() {
  const { ref: headingRef, visible: headingVisible } = useReveal(0)
  const { ref: ctaRef, visible: ctaVisible } = useReveal(200)

  return (
    <section className="relative overflow-hidden bg-[#f7f5fa]">
      <div
        className="pointer-events-none absolute -left-24 top-10 h-64 w-64 rounded-full bg-[#d6c4e8]/30 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-16 bottom-0 h-72 w-72 rounded-full bg-[#341c44]/10 blur-3xl"
        aria-hidden
      />

      <Container className="relative py-12 md:py-16">
        <div
          ref={headingRef}
          className={[
            'transition-all duration-700',
            headingVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0',
          ].join(' ')}
        >
          <SectionHeading
            eyebrow="Process"
            eyebrowClassName="text-[#341c44]"
            title="Un process simple, en 4 étapes"
            subtitle="De l’idée à une application qui génère des revenus, sans complexité inutile."
          />
        </div>

        <div className="relative mt-10 md:mt-12">
          <div
            className="pointer-events-none absolute left-[12.5%] right-[12.5%] top-14 hidden h-px bg-gradient-to-r from-[#d6c4e8] via-[#9b6bb8] to-[#341c44] lg:block"
            aria-hidden
          />

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
            {steps.map((step, index) => (
              <ProcessStepCard key={step.title} step={step} index={index} />
            ))}
          </div>
        </div>

        <div
          ref={ctaRef}
          className={[
            'mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4 md:mt-12',
            'transition-all duration-700',
            ctaVisible ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0',
          ].join(' ')}
        >
          <Link
            href="/contact"
            className="inline-flex h-11 w-full items-center justify-center rounded-full bg-white px-6 text-sm font-extrabold ring-1 ring-[#d6c4e8] bg-clip-text text-transparent bg-gradient-to-r from-[#9b6bb8] to-[#341c44] transition hover:bg-[#faf7ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#341c44] focus-visible:ring-offset-2 sm:w-auto"
          >
            Nous contacter
          </Link>
          <Link
            href={appUrl("/login")}
            className="inline-flex h-11 w-full items-center justify-center rounded-full bg-gradient-to-r from-[#d6c4e8] via-[#9b6bb8] to-[#341c44] px-6 text-sm font-extrabold text-white shadow-[0_8px_24px_rgba(52,28,68,0.28)] transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#341c44] focus-visible:ring-offset-2 sm:w-auto"
          >
            Se connecter
          </Link>
        </div>
      </Container>
    </section>
  )
}
