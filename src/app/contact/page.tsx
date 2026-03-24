import { Card, Container, SectionHeading } from '../../components/marketing'

export default function ContactPage() {
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

            <Card>
              <form className="grid gap-4">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-[#341c44]">Nom</span>
                  <input
                    className="h-11 rounded-xl bg-white px-4 text-sm ring-1 ring-black/10 focus:outline-none focus:ring-2 focus:ring-[#341c44]"
                    name="name"
                    placeholder="Ton nom"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-[#341c44]">Email</span>
                  <input
                    className="h-11 rounded-xl bg-white px-4 text-sm ring-1 ring-black/10 focus:outline-none focus:ring-2 focus:ring-[#341c44]"
                    name="email"
                    placeholder="ton@email.com"
                    type="email"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-[#341c44]">Message</span>
                  <textarea
                    className="min-h-28 rounded-xl bg-white px-4 py-3 text-sm ring-1 ring-black/10 focus:outline-none focus:ring-2 focus:ring-[#341c44]"
                    name="message"
                    placeholder="Ton message..."
                  />
                </label>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="inline-flex w-full items-center justify-center rounded-full bg-[#341c44] px-5 py-3 text-sm font-semibold text-white transition shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#341c44] focus:ring-offset-2 sm:px-6"
                  >
                    Envoyer
                  </button>
                </div>
              </form>
            </Card>
          </div>
        </Container>
      </section>
    </main>
  )
}
