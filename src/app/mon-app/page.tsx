import { Button, Container, ImagePlaceholder, SectionHeading, Timeline } from '../../components/marketing'

function FeatureIcon(props: { name: 'programs' | 'library' | 'nutrition' | 'gamification' | 'chat' | 'rdv' }) {
  const common = {
    className: 'h-5 w-5',
    viewBox: '0 0 24 24',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
  } as const

  switch (props.name) {
    case 'programs':
      return (
        <svg {...common}>
          <path d="M7 6h14M7 12h14M7 18h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        </svg>
      )
    case 'library':
      return (
        <svg {...common}>
          <path
            d="M5 5.5C5 4.12 6.12 3 7.5 3H20v18H7.5C6.12 21 5 19.88 5 18.5V5.5Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M8 7h8M8 11h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M5 17h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )
    case 'nutrition':
      return (
        <svg {...common}>
          <path
            d="M12 21c-4.97 0-9-4.03-9-9 0-4.4 3.15-8.06 7.32-8.83.37-.07.68.25.63.62C10.63 5.9 12.74 8 15.3 8c1.25 0 2.39-.5 3.22-1.32.27-.27.73-.19.86.16.4 1.02.62 2.13.62 3.28 0 4.97-4.03 11.88-8 11.88Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M9.5 14.5c1.5 1.5 3.5 1.5 5 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )
    case 'gamification':
      return (
        <svg {...common}>
          <path
            d="M8 21h8M12 17v4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M7 3h10v4a5 5 0 0 1-5 5 5 5 0 0 1-5-5V3Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M7 5H5a2 2 0 0 0 2 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M17 5h2a2 2 0 0 1-2 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )
    case 'chat':
      return (
        <svg {...common}>
          <path
            d="M21 12a8 8 0 0 1-8 8H8l-5 1 1.2-4.8A8 8 0 1 1 21 12Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M8 12h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )
    case 'rdv':
      return (
        <svg {...common}>
          <path
            d="M7 3v3M17 3v3M4 8h16"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M6 6h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M9 12h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )
  }
}

export default function MonAppPage() {
  const features = [
    { icon: 'programs' as const, title: 'Création de programmes', desc: 'Semaine / séance, organisation claire, expérience premium.' },
    { icon: 'library' as const, title: 'Bibliothèque d’exercices', desc: 'Ton contenu centralisé, réutilisable, scalable.' },
    { icon: 'nutrition' as const, title: 'Nutrition', desc: 'Suivi, progression, habitudes.' },
    { icon: 'gamification' as const, title: 'Gamification (placeholder)', desc: 'Progression, challenges, fidélisation.' },
    { icon: 'chat' as const, title: 'Chat client (placeholder)', desc: 'Support, suivi, relation premium.' },
    { icon: 'rdv' as const, title: 'RDV (placeholder)', desc: 'Booking, disponibilités, organisation.' },
  ]

  return (
    <main className="bg-white">
      <section>
        <Container className="py-10 md:py-14">
          <div className="grid gap-10 md:grid-cols-2 md:items-center">
            <div className="grid gap-6">
              <SectionHeading
                eyebrow="Mon app"
                title="Une application 100% personnalisée pour ton coaching"
                subtitle="Un produit premium, pensé pour professionnaliser ton activité et monétiser tes programmes."
              />
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button href="/contact">Demander une clé</Button>
                <Button href="/login" variant="secondary">
                  tester la création de programme
                </Button>
              </div>
            </div>
            <ImagePlaceholder label="Image placeholder · mockup app / dashboard" className="h-72 md:h-96" />
          </div>
        </Container>
      </section>

      <section>
        <Container className="py-10 md:py-14">
          <SectionHeading
            eyebrow="Features"
            title="Des modules pensés pour ton coaching"
            subtitle="Tout ce qu’il faut pour délivrer une expérience premium (et scaler)."
          />

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-2xl bg-white p-4 ring-1 ring-black/5">
                <div className="flex items-center gap-3">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#341c44]/5 text-[#341c44]">
                    <FeatureIcon name={f.icon} />
                  </div>
                  <div className="text-sm font-extrabold text-[#341c44]">{f.title}</div>
                </div>
                <div className="mt-2 text-sm text-black/70">{f.desc}</div>
                <div className="mt-4">
                  <ImagePlaceholder label="Image placeholder" className="h-28" />
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section>
        <Container className="py-10 md:py-14">
          <SectionHeading
            eyebrow="Process"
            title="Un process simple, en 4 étapes"
            subtitle="On avance vite, avec une timeline claire et une exécution premium."
          />

          <Timeline
            className="mt-6"
            steps={[
              { title: 'On définit tes besoins', description: 'Objectifs, modules, contraintes, roadmap.' },
              { title: 'On crée l’expérience utilisateur', description: 'UX/UI premium, mobile-first, orienté conversion.' },
              { title: 'On développe un MVP', description: 'Le coeur du produit, prêt à tester et itérer.' },
              { title: 'On lance ton application', description: 'Mise en ligne, accompagnement, évolution.' },
            ]}
          />

          <div className="mt-8">
            <Button href="/contact">Demander une clé</Button>
          </div>
        </Container>
      </section>
    </main>
  )
}
