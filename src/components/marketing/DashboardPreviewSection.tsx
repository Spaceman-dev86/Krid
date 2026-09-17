import type { CSSProperties } from 'react'

import { createClient } from '../../lib/supabase/server'
import { Container } from './index'

const DASHBOARD_FLOAT_TOP_PX = 23
const DASHBOARD_FLOAT_BOTTOM_PX = 70
const DASHBOARD_FLOAT_DURATION_S = 5
const DASHBOARD_SECTION_EXTRA_BOTTOM_PX = 5

function readPublicUrl(data: unknown): string | null {
  return (data as { publicUrl?: string } | null)?.publicUrl ?? null
}

function ImagePlaceholder({ label, className }: { label: string; className?: string }) {
  return (
    <div
      className={
        `grid place-items-center rounded-[var(--radius-lg)] bg-[var(--accent)] text-sm font-semibold text-[var(--brand)] ring-1 ring-[var(--border)] ${className ?? ''}`.trim()
      }
    >
      <span className="px-6 text-center">{label}</span>
    </div>
  )
}

export default async function DashboardPreviewSection() {
  const supabase = await createClient()

  const programsPreviewUrl = readPublicUrl(
    supabase.storage.from('home_page').getPublicUrl('1-accueil/prog4semaines.png').data
  )
  const exercisesPreviewUrl = readPublicUrl(
    supabase.storage.from('home_page').getPublicUrl('1-accueil/exercices.png').data
  )
  const calendarPreviewUrl = readPublicUrl(
    supabase.storage.from('home_page').getPublicUrl('1-accueil/calendrier.png').data
  )
  const chatPreviewUrl = readPublicUrl(
    supabase.storage.from('home_page').getPublicUrl('1-accueil/chat.png').data
  )

  const dashboardCards = [
    {
      title: 'Création de programmes',
      desc: 'Semaines, séances, structure claire et actionnable.',
      imageUrl: programsPreviewUrl,
      previewHeightClass: 'h-[340px]',
      imageScale: 1.0,
    },
    {
      title: 'Bibliothèque d’exercices',
      desc: 'Ton contenu centralisé, réutilisable et scalable.',
      imageUrl: exercisesPreviewUrl,
      previewHeightClass: 'h-[340px]',
      imageScale: 1.0,
    },
    {
      title: 'Calendrier',
      desc: 'Planifie, organise et garde une vision claire.',
      imageUrl: calendarPreviewUrl,
      previewHeightClass: 'h-[340px]',
      imageScale: 1.0,
    },
    {
      title: 'Messagerie',
      desc: 'Échanges simples et rapides avec tes clients.',
      imageUrl: chatPreviewUrl,
      previewHeightClass: 'h-[340px]',
      imageScale: 1.0,
    },
  ] as const

  return (
    <section className="bg-[var(--bg)]">
      <Container className="pt-4 pb-10 md:pt-6 md:pb-16">
        <div
          className="isolate relative overflow-hidden rounded-[var(--radius-lg)] bg-[var(--surface)] p-8 sm:p-10 md:p-10"
          style={{ paddingBottom: `${DASHBOARD_FLOAT_BOTTOM_PX + DASHBOARD_SECTION_EXTRA_BOTTOM_PX}px` }}
        >
          <div className="relative z-20 flex flex-wrap items-end justify-between gap-6">
            <div className="min-w-0">
              <h2 className="text-2xl font-extrabold tracking-tight text-[var(--brand)]">Aperçu dashboard</h2>
              <p className="mt-2 text-sm text-[color:var(--muted)]">
                Une base solide, puis des modules ajoutés au rythme de ton business.
              </p>
            </div>
          </div>

          <div className="relative z-10 mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {dashboardCards.map((c, idx) => (
              <div
                key={c.title}
                className="dash-float relative min-w-0 overflow-hidden rounded-[var(--radius-lg)] bg-[var(--surface)] ring-1 ring-[var(--border)] transform-gpu"
                style={
                  {
                    ['--base-y']: '0px',
                    ['--dash-float-top']: `${DASHBOARD_FLOAT_TOP_PX}px`,
                    ['--dash-float-bottom']: `${DASHBOARD_FLOAT_BOTTOM_PX}px`,
                    animationDuration: `${DASHBOARD_FLOAT_DURATION_S}s`,
                    animationDelay: `${idx % 2 === 0 ? 0 : -DASHBOARD_FLOAT_DURATION_S}s`,
                  } as CSSProperties
                }
              >
                <div className="p-4">
                  {c.imageUrl ? (
                    <div className="relative overflow-hidden rounded-[var(--radius-lg)] bg-white">
                      <img
                        src={c.imageUrl}
                        alt=""
                        className={`${c.previewHeightClass} w-full object-contain`}
                        style={{ transform: `scale(${c.imageScale})`, transformOrigin: 'center' }}
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <ImagePlaceholder label="Image placeholder" className={c.previewHeightClass} />
                  )}
                </div>
                <div className="px-6 pb-6">
                  <div className="text-sm font-extrabold text-[var(--brand)]">{c.title}</div>
                  <div className="mt-1 text-sm text-[color:var(--muted)]">{c.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  )
}
