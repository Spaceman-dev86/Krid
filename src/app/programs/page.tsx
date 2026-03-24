import Link from 'next/link'

import { createClient } from '../../lib/supabase/server'
import { Card, Container, ImagePlaceholder, SectionHeading } from '../../components/marketing'

export default async function ProgramsMarketingPage() {
  const supabase = await createClient()

  const { data: programs } = await supabase
    .from('programs')
    .select('id,title,level,duration,created_at')
    .eq('is_published', true)
    .eq('is_template', false)
    .order('created_at', { ascending: false })
    .limit(24)

  return (
    <main className="bg-white">
      <section>
        <Container className="py-12 md:py-16">
          <SectionHeading
            eyebrow="Programmes"
            title="Voici des exemples de programmes que tu peux créer avec ton app"
            subtitle="Une vitrine claire, des cartes premium, et une page de présentation pour chaque programme."
          />
        </Container>
      </section>

      <section>
        <Container className="py-12 md:py-16">
          {(programs ?? []).length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(programs ?? []).map((p) => (
                <Link key={p.id} href={`/programme/${p.id}`} className="block">
                  <Card className="overflow-hidden hover:shadow-md transition">
                    <div className="p-4">
                      <ImagePlaceholder label="Image placeholder · programme" className="h-40" />
                    </div>
                    <div className="px-5 pb-5">
                      <div className="text-sm font-extrabold text-[#341c44] truncate">{p.title}</div>
                      <div className="mt-2 text-sm text-black/70 grid gap-1">
                        <div>Niveau : {p.level ?? '—'}</div>
                        <div>Durée : {p.duration ?? '—'}</div>
                      </div>
                      <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#341c44]">
                        Découvrir <span aria-hidden>→</span>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
              <div className="text-sm font-semibold text-[#341c44]">Aucun programme public.</div>
              <div className="mt-2 text-sm text-black/70">Ajoute des programmes publics pour alimenter ta vitrine.</div>
            </div>
          )}
        </Container>
      </section>
    </main>
  )
}
