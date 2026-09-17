import { Container, SectionHeading } from '../../components/marketing'
import ContactFormClient from './ContactFormClient'

type PageProps = {
  searchParams: Promise<{ offer?: string; clients?: string }>
}

export default async function ContactPage({ searchParams }: PageProps) {
  const { offer, clients } = await searchParams

  return (
    <main className="bg-white">
      <section>
        <Container className="py-10 md:py-16">
          <div className="mx-auto grid max-w-xl gap-6">
            <SectionHeading
              eyebrow="Contact"
              title="Contact"
              subtitle="Un message et je te réponds rapidement."
            />

            <ContactFormClient offerId={offer} clientCount={clients} />
          </div>
        </Container>
      </section>
    </main>
  )
}
