import { Button, Card, Container, FaqAccordion, ImagePlaceholder, SectionHeading } from '../../components/marketing'

export default function BlogPage() {
  const articles = [
    {
      title: 'Pourquoi créer une app de coaching',
      desc: 'Deviens propriétaire de ton offre et augmente la valeur perçue.',
    },
    {
      title: 'Comment vendre ses programmes',
      desc: 'Structure ton catalogue, crée de la preuve, et convertis.',
    },
    {
      title: 'Comment fidéliser ses clients',
      desc: 'Gamification, progression, et expérience premium.',
    },
  ]

  const faqItems = [
    {
      q: 'Est-ce que je peux vraiment vendre mes programmes avec cette app ?',
      a: "Oui. L'idée est de te donner une base pro: programmes, pages, parcours de conversion, et une app qui renforce ta valeur.",
    },
    {
      q: 'Combien de temps pour créer mon app ?',
      a: "On avance par étapes: cadrage, UX, MVP. Le délai dépend de ton besoin, mais l'objectif est d'aller vite sans sacrifier la qualité.",
    },
    {
      q: 'Est-ce personnalisable ?',
      a: "Oui. Ton dashboard, tes modules, ton branding: on adapte à ton coaching et à ta méthode.",
    },
    {
      q: 'Est-ce adapté à mon niveau ?',
      a: "Oui. Que tu débutes ou que tu aies déjà une audience, le but est d'augmenter ta crédibilité et de simplifier ta vente.",
    },
    {
      q: "Est-ce que je peux évoluer vers une app plus avancée ?",
      a: "Oui. Tu peux démarrer simple, puis ajouter des modules (nutrition, gamification, chat, RDV, etc.) au rythme de ton business.",
    },
  ]

  return (
    <main className="bg-white">
      <section>
        <Container className="py-12 md:py-16">
          <SectionHeading
            eyebrow="Blog"
            title="Conseils business pour coachs"
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
                    <Button href="/contact" variant="secondary" className="w-full">
                      Demander une clé
                    </Button>
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
            title="Questions fréquentes"
            subtitle="Réponses rapides, orientées résultat, pour passer à l'action."
          />

          <div className="mt-6">
            <FaqAccordion items={faqItems} />
          </div>

          <div className="mt-8">
            <Button href="/contact">Demander une clé</Button>
          </div>
        </Container>
      </section>
    </main>
  )
}
