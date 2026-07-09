import type { Metadata } from 'next'

import { Button, Container } from '../components/ui'
import CoachOfferSection from '../components/marketing/CoachOfferSection'
import ReadyModulesSection from '../components/marketing/ReadyModulesSection'
import { createClient } from '../lib/supabase/server'

export const metadata: Metadata = {
  title: 'Accueil',
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
  const HERO_IMAGE_ZOOM = 1.0

  const supabase = await createClient()

  const duoPhoneUrl = supabase.storage.from('home_page').getPublicUrl('duo_phone.png').data.publicUrl

  const { data: webDesignerImage } = supabase.storage
    .from('home_page')
    .getPublicUrl('1-accueil/web-designer.png')
  const webDesignerUrl = (webDesignerImage as unknown as { publicUrl?: string } | null)?.publicUrl ?? null

  return (
    <main className="bg-[var(--bg)] text-[var(--text)]">
      <section className="bg-[var(--bg)]">
        <Container className="py-10 md:py-14">
          <div className="rounded-[var(--radius-lg)] bg-[var(--surface)] p-8 sm:p-10 md:p-12">
            <div className="grid gap-10 md:grid-cols-2 md:items-center">
              <div className="grid gap-6">
                <div className="grid gap-3">
                  <h1 className="text-3xl font-extrabold tracking-tight text-[#9b6bb8] md:text-4xl">
                    Crée ton application de coaching et vends tes programmes en ligne
                  </h1>
                  <p className="text-base text-[var(--muted)]">
                    Un dashboard complet pour coachs : crée, personnalise et monétise tes programmes.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button href="/login" variant="gradient">
                    tester la création de programme
                  </Button>
                  <Button href="/mon-app" variant="mirror">
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

      <CoachOfferSection />

      <ReadyModulesSection />

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
              <h2 className="text-2xl font-extrabold tracking-tight text-[#9b6bb8]">Présentation</h2>
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
                <Button href="/login" variant="gradient">
                  Demander une clé
                </Button>
                <Button href="/mon-app" variant="mirror">
                  Voir mon app
                </Button>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <section className="bg-[var(--accent)]">
        <Container className="py-12 md:py-16">
          <div className="rounded-[var(--radius-lg)] bg-[var(--surface)] p-8 sm:p-10 md:p-12">
            <div className="grid gap-6 md:grid-cols-2 md:items-center">
              <div className="min-w-0">
                <h2 className="text-2xl font-extrabold tracking-tight text-[#9b6bb8]">Passe au niveau supérieur en tant que coach</h2>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Un produit premium, pensé pour professionnaliser ton activité et monétiser ton expertise.
                </p>
              </div>
              <div className="flex md:justify-end">
                <Button href="/login" variant="gradient">
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