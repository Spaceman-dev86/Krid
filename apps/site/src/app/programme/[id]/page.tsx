import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '../../../lib/supabase/server'
import { Container } from '../../../components/marketing'

type PageProps = {
  params: Promise<{ id: string }>
}

/** Simplified public program detail on the marketing site. */
export default async function PublicProgramDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: program } = await supabase
    .from('programs')
    .select('id, title, description, goal, level, duration, image_url, is_published')
    .eq('id', id)
    .eq('is_published', true)
    .maybeSingle()

  if (!program) redirect('/programs')

  return (
    <main className="bg-white text-[#111827]">
      <Container className="py-10 md:py-14">
        <Link href="/programs" className="text-sm font-semibold text-[#341c44] hover:underline">
          ← Tous les programmes
        </Link>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-[#341c44]">
          {program.title || 'Programme'}
        </h1>
        {program.description ? (
          <p className="mt-3 max-w-2xl whitespace-pre-wrap text-sm leading-relaxed text-black/65">
            {program.description}
          </p>
        ) : null}
        <dl className="mt-6 grid gap-2 text-sm sm:grid-cols-3">
          {program.level ? (
            <div>
              <dt className="text-black/45">Niveau</dt>
              <dd className="font-semibold">{program.level}</dd>
            </div>
          ) : null}
          {program.duration ? (
            <div>
              <dt className="text-black/45">Durée</dt>
              <dd className="font-semibold">{program.duration}</dd>
            </div>
          ) : null}
          {program.goal ? (
            <div>
              <dt className="text-black/45">Objectif</dt>
              <dd className="font-semibold">{program.goal}</dd>
            </div>
          ) : null}
        </dl>
      </Container>
    </main>
  )
}
