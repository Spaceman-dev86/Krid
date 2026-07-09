import {
  Button,
  Card,
  Container,
  FaqAccordion,
  ImagePlaceholder,
  SectionHeading,
} from '../../components/marketing'
import AppPricingSection from '../../components/marketing/AppPricingSection'
import OfferSimulatorClient from '../../components/marketing/OfferSimulatorClient'

const articles = [
  {
    title: 'Pourquoi créer une app de coaching',
    desc: 'Passe de coach “Excel + WhatsApp” à une expérience client premium.',
  },
  {
    title: 'Comment vendre ses programmes',
    desc: 'Structure ton catalogue, crée de la preuve, et convertis.',
  },
  {
    title: 'Comment fidéliser ses clients',
    desc: 'Progression, rétention, et une app installable sur mobile.',
  },
]

const faqItems = [
  {
    q: 'Est-ce que je peux vraiment vendre mes programmes avec cette app ?',
    a: "Oui. L'idée est de te donner une base pro: programmes, pages, parcours de conversion, et une app qui renforce ta valeur.",
  },
  {
    q: 'Combien de temps pour créer mon app ?',
    a: "Tu peux démarrer vite avec le SaaS, puis passer en Studio si tu veux aller plus loin (domaine, stores, isolation).",
  },
  {
    q: 'Est-ce personnalisable ?',
    a: "Oui via le white-label: logo, couleurs, nom. Pas de dev sur-mesure (sinon ça devient une agence).",
  },
  {
    q: 'Est-ce adapté à mon niveau ?',
    a: "Oui. Que tu débutes ou que tu aies déjà une audience, le but est d'augmenter ta crédibilité et de simplifier ta vente.",
  },
  {
    q: "Est-ce que je peux évoluer vers une app plus avancée ?",
    a: "Oui. Tu peux upgrader à tout moment (Starter → Business → Scale). Studio est disponible quand tu veux une app sur les stores + option de rachat.",
  },
]

export default function SimulationPage() {
  return (
    <main className="bg-white">
      <section>
        <Container className="py-12 md:py-16">
          <OfferSimulatorClient />
        </Container>
      </section>

      <AppPricingSection />

      <section>
        <Container className="py-12 md:py-16">
          <SectionHeading
            eyebrow="Conseils"
            eyebrowClassName="text-[#341c44]"
            title="Conseils business pour coachs"
            titleClassName="text-[#9b6bb8]"
            subtitle="Du contenu clair, orienté conversion, pour vendre plus et mieux avec une expérience premium."
          />

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {articles.map((a) => (
              <Card key={a.title} className="overflow-hidden">
                <div className="p-4">
                  <ImagePlaceholder label="Image placeholder · article" className="h-40" />
                </div>
                <div className="px-5 pb-5">
                  <div className="text-sm font-extrabold text-[#341c44]">{a.title}</div>
                  <div className="mt-2 text-sm text-black/70">{a.desc}</div>
                  <div className="mt-4">
                    <a
                      href="/login"
                      className="inline-flex h-11 w-full items-center justify-center rounded-full bg-white px-6 text-sm font-extrabold ring-1 ring-[#d6c4e8] transition hover:bg-[#f8f6fa] hover:ring-[#9b6bb8]/40 focus:outline-none focus:ring-2 focus:ring-[#9b6bb8] focus:ring-offset-2"
                    >
                      <span className="bg-gradient-to-r from-[#9b6bb8] to-[#341c44] bg-clip-text text-transparent">
                        Demander une clé
                      </span>
                    </a>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </Container>
      </section>

      <section>
        <Container className="py-12 md:py-16">
          <SectionHeading
            eyebrow="FAQ"
            eyebrowClassName="text-[#341c44]"
            title="Questions fréquentes"
            titleClassName="text-[#9b6bb8]"
            subtitle="Réponses rapides, orientées résultat, pour passer à l'action."
          />

          <div className="mt-6">
            <FaqAccordion items={faqItems} />
          </div>

          <div className="mt-8">
            <Button
              href="/login"
              className="bg-gradient-to-r from-[#d6c4e8] to-[#341c44] text-white shadow-[0_8px_24px_rgba(52,28,68,0.22)] transition hover:opacity-95 focus:ring-[#341c44]"
            >
              Demander une clé
            </Button>
          </div>
        </Container>
      </section>
    </main>
  )
}
