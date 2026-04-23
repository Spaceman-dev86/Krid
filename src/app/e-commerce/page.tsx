import { Button, Card, Container, ImagePlaceholder, SectionHeading, Timeline } from '../../components/marketing'

export default function EcommercePage() {
  return (
    <main className="bg-white">
      <section className="bg-[#f5f5f5]">
        <Container className="py-12 md:py-16">
          <div className="grid gap-8 md:grid-cols-2 md:items-center">
            <div className="grid gap-5">
              <SectionHeading
                eyebrow="Mon site"
                title="Lance ton business en ligne rapidement"
                subtitle="Commence avec un site simple pour vendre tes programmes et évoluer vers une app."
              />

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button href="/programs">Voir les programmes</Button>
                <Button href="/login" variant="secondary">
                  Demander une clé
                </Button>
              </div>
            </div>

            <ImagePlaceholder label="Image placeholder · mockup site / boutique" className="h-64 md:h-80" />
          </div>
        </Container>
      </section>

      <section>
        <Container className="py-12 md:py-16">
          <div className="grid gap-8 md:grid-cols-2 md:items-center">
            <ImagePlaceholder label="Image placeholder · exemple page programme" className="h-64 md:h-80" />
            <div className="grid gap-5">
              <SectionHeading
                eyebrow="Explication"
                title="Une vitrine claire pour vendre, puis scaler"
                subtitle="Commence avec un site simple pour vendre tes programmes et évoluer vers une app."
              />

              <div className="grid gap-3">
                <Card>
                  <div className="text-sm font-extrabold text-[#341c44]">Vente en ligne</div>
                  <div className="mt-1 text-sm text-black/70">Une page claire + programmes visibles, prêts à être monétisés.</div>
                </Card>
                <Card>
                  <div className="text-sm font-extrabold text-[#341c44]">Branding personnalisé</div>
                  <div className="mt-1 text-sm text-black/70">Ton style, ton positionnement, une image pro.</div>
                </Card>
                <Card>
                  <div className="text-sm font-extrabold text-[#341c44]">Mise en place rapide</div>
                  <div className="mt-1 text-sm text-black/70">On va droit au but: un site premium, sans complexité inutile.</div>
                </Card>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <section className="bg-[#f5f5f5]">
        <Container className="py-12 md:py-16">
          <SectionHeading
            eyebrow="Process"
            title="Un lancement rapide, sans perdre la qualité"
            subtitle="3 étapes, simples et visuelles, pour mettre ton business en ligne."
          />

          <Timeline
            className="mt-6"
            steps={[
              { title: 'On définit ton positionnement', description: 'Offre, persona, messages, branding.' },
              { title: 'On développe ta boutique de programme', description: 'Pages, catalogues, parcours de conversion.' },
              { title: 'Mise en ligne et accompagnement', description: 'Optimisation, itérations, montée en puissance.' },
            ]}
          />

          <div className="mt-8">
            <Button href="/programs">Voir les programmes</Button>
          </div>
        </Container>
      </section>
    </main>
  )
}
