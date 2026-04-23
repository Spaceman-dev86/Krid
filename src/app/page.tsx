import type { CSSProperties, ReactNode } from 'react'

import type { Metadata } from 'next'

import { Button, Container } from '../components/ui'
import { createClient } from '../lib/supabase/server'

export const metadata: Metadata = {
  title: 'Accueil',
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={22}
      height={22}
      aria-hidden
      style={{ display: 'block', overflow: 'visible' }}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  )
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

export default async function HomePage() {
  const HERO_IMAGE_ZOOM = 1.00
  const DASHBOARD_FLOAT_TOP_PX = 23
  const DASHBOARD_FLOAT_BOTTOM_PX = 70
  const DASHBOARD_FLOAT_DURATION_S = 5
  const DASHBOARD_SECTION_EXTRA_BOTTOM_PX = 5

  const supabase = await createClient()

  const { data: duoPhoneImage } = supabase.storage.from('home_page').getPublicUrl('duo_phone.png')
  const duoPhoneUrl = (duoPhoneImage as unknown as { publicUrl?: string } | null)?.publicUrl ?? null

  const { data: webDesignerImage } = supabase.storage.from('home_page').getPublicUrl('web-designer.png')
  const webDesignerUrl = (webDesignerImage as unknown as { publicUrl?: string } | null)?.publicUrl ?? null

  const { data: programsPreviewImage } = supabase.storage.from('home_page').getPublicUrl('prog4semaines.png')
  const programsPreviewUrl = (programsPreviewImage as unknown as { publicUrl?: string } | null)?.publicUrl ?? null

  const { data: exercisesPreviewImage } = supabase.storage.from('home_page').getPublicUrl('exercices.png')
  const exercisesPreviewUrl = (exercisesPreviewImage as unknown as { publicUrl?: string } | null)?.publicUrl ?? null

  const { data: calendarPreviewImage } = supabase.storage.from('home_page').getPublicUrl('calendrier.png')
  const calendarPreviewUrl = (calendarPreviewImage as unknown as { publicUrl?: string } | null)?.publicUrl ?? null

  const { data: chatPreviewImage } = supabase.storage.from('home_page').getPublicUrl('chat.png')
  const chatPreviewUrl = (chatPreviewImage as unknown as { publicUrl?: string } | null)?.publicUrl ?? null

  const quickCards = [
    {
      title: 'Deviens propriétaire de ton app',
      desc: 'Ton branding, ton expérience, un produit premium à toi.',
      icon: (
        <Icon>
          <path d="M4 10.5l8-6 8 6" />
          <path d="M6 9.5V20h12V9.5" />
          <path d="M9 20v-8h6v8" />
        </Icon>
      ),
    },
    {
      title: 'Gamification pour fidéliser',
      desc: 'Progression, challenges, suivi: un coaching qui retient.',
      icon: (
        <Icon>
          <path d="M8 21h8" />
          <path d="M12 17v4" />
          <path d="M7 4h10" />
          <path d="M17 4v6a5 5 0 0 1-10 0V4" />
        </Icon>
      ),
    },
    {
      title: 'Un dashboard sur-mesure',
      desc: 'Personnalise ton back-office selon tes besoins métier.',
      icon: (
        <Icon>
          <rect x="3" y="4" width="18" height="16" rx="3" />
          <path d="M7 8h4" />
          <path d="M7 12h10" />
          <path d="M7 16h7" />
        </Icon>
      ),
    },
  ] as const

  const dashboardCards = [
    {
      title: 'Création de programmes',
      desc: 'Semaines, séances, structure claire et actionnable.',
      imageUrl: programsPreviewUrl,
      previewHeightClass: 'h-[340px]',
      imageScale: 1.00,
    },
    {
      title: 'Bibliothèque d’exercices',
      desc: 'Ton contenu centralisé, réutilisable et scalable.',
      imageUrl: exercisesPreviewUrl,
      previewHeightClass: 'h-[340px]',
      imageScale: 1.00,
    },
    {
      title: 'Calendrier',
      desc: 'Planifie, organise et garde une vision claire.',
      imageUrl: calendarPreviewUrl,
      previewHeightClass: 'h-[340px]',
      imageScale: 1.00,
    },
    {
      title: 'Messagerie',
      desc: 'Échanges simples et rapides avec tes clients.',
      imageUrl: chatPreviewUrl,
      previewHeightClass: 'h-[340px]',
      imageScale: 1.00,
    },
  ] as const

  return (
    <main className="bg-[var(--bg)] text-[var(--text)]">
      <section className="bg-[var(--bg)]">
        <Container className="py-10 md:py-14">
          <div className="rounded-[var(--radius-lg)] bg-[var(--surface)] p-8 sm:p-10 md:p-12">
            <div className="grid gap-10 md:grid-cols-2 md:items-center">
              <div className="grid gap-6">
                <div className="grid gap-3">
                  <h1 className="text-3xl font-extrabold tracking-tight text-[var(--brand)] md:text-4xl">
                    Crée ton application de coaching et vends tes programmes en ligne
                  </h1>
                  <p className="text-base text-[var(--muted)]">
                    Un dashboard complet pour coachs : crée, personnalise et monétise tes programmes.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button href="/login" variant="primary">
                    tester la création de programme
                  </Button>
                  <Button href="/mon-app" variant="secondary">
                    Créer mon app
                  </Button>
                </div>
              </div>

              {duoPhoneUrl ? (
                <div className="relative overflow-hidden rounded-[var(--radius-lg)] bg-white">
                  <img
                    src={duoPhoneUrl}
                    alt=""
                    className="h-72 w-full object-contain md:h-96"
                    style={{ transform: `scale(${HERO_IMAGE_ZOOM})`, transformOrigin: 'center' }}
                    loading="lazy"
                  />
                </div>
              ) : (
                <ImagePlaceholder label="Image placeholder · mockup dashboard" className="h-72 md:h-96" />
              )}
            </div>
          </div>
        </Container>
      </section>

      <section className="bg-[var(--bg)]">
        <Container className="py-8 md:py-12">
          <div className="grid gap-6 md:grid-cols-3">
            {quickCards.map((c) => (
              <div
                key={c.title}
                className="rounded-[var(--radius-lg)] bg-[var(--surface)] p-7 ring-1 ring-[var(--border)]"
              >
                <div className="flex items-start gap-4">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--brand)]">
                    {c.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-[var(--brand)]">{c.title}</div>
                    <div className="mt-1 text-sm text-[var(--muted)]">{c.desc}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="bg-[var(--accent)]">
        <Container className="py-10 md:py-14">
          <div className="grid gap-10 md:grid-cols-2 md:items-center">
            {webDesignerUrl ? (
              <div className="relative overflow-hidden rounded-[var(--radius-lg)] bg-[var(--accent)]">
                <img src={webDesignerUrl} alt="" className="h-72 w-full object-contain md:h-96" loading="lazy" />
              </div>
            ) : (
              <ImagePlaceholder label="Image placeholder · coaching / produit" className="h-72 md:h-96" />
            )}
            <div className="grid gap-5">
              <h2 className="text-2xl font-extrabold tracking-tight text-[var(--brand)]">Présentation</h2>
              <p className="text-sm text-[var(--muted)]">
                Développeur spécialisé dans le sport, je crée des outils adaptés à ton activité (dashboard, suivi client,
                création de programmes) — par{' '}
                <a
                  href="https://spaceman-dev86.github.io/Portfolio-R-mi-SARRO/index.html"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-[var(--brand)] underline underline-offset-2"
                >
                  Rémi Sarro
                </a>
                .
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button href="/login" variant="primary">
                  Demander une clé
                </Button>
                <Button href="/mon-app" variant="secondary">
                  Voir mon app
                </Button>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <section className="bg-[var(--bg)]">
        <Container className="pt-4 pb-10 md:pt-6 md:pb-16">
          <div
            className="isolate relative overflow-hidden rounded-[var(--radius-lg)] bg-[var(--surface)] p-8 sm:p-10 md:p-10"
            style={{ paddingBottom: `${DASHBOARD_FLOAT_BOTTOM_PX + DASHBOARD_SECTION_EXTRA_BOTTOM_PX}px` }}
          >
            <div className="relative z-20 flex flex-wrap items-end justify-between gap-6">
              <div className="min-w-0">
                <h2 className="text-2xl font-extrabold tracking-tight text-[var(--brand)]">Aperçu dashboard</h2>
                <p className="mt-2 text-sm text-[var(--muted)]">Une base solide, puis des modules ajoutés au rythme de ton business.</p>
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
                      animationDelay: `${idx % 2 === 0 ? 0 : -(DASHBOARD_FLOAT_DURATION_S)}s`,
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
                    <div className="mt-1 text-sm text-[var(--muted)]">{c.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </Container>
      </section>

      <section className="bg-[var(--accent)]">
        <Container className="py-12 md:py-16">
          <div className="rounded-[var(--radius-lg)] bg-[var(--surface)] p-8 sm:p-10 md:p-12">
            <div className="grid gap-6 md:grid-cols-2 md:items-center">
              <div className="min-w-0">
                <h2 className="text-2xl font-extrabold tracking-tight text-[var(--brand)]">Passe au niveau supérieur en tant que coach</h2>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Un produit premium, pensé pour professionnaliser ton activité et monétiser ton expertise.
                </p>
              </div>
              <div className="flex md:justify-end">
                <Button href="/login" variant="primary">
                  Demander une clé
                </Button>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </main>
  )
}