import { createClient } from '../../lib/supabase/server'
import { Container, SectionHeading } from '../../components/marketing'
import { resolveProgramCoverUrls } from '../../lib/resolveProgramCoverUrl'
import ProgramsGridClient from './ProgramsGridClient'

/** Vitrine marketing — utilisée si visiteur non-coach sur /programs */
export default async function ProgramsMarketingPage() {
  const supabase = await createClient()

  const { data: fallbackImage } = supabase.storage.from('home_page').getPublicUrl('3-programs/muscu.jpg')
  const defaultImageUrl = (fallbackImage as unknown as { publicUrl?: string } | null)?.publicUrl ?? null

  const { data: programs } = await supabase
    .from('programs')
    .select('id,title,description,goal,level,duration,image_url,created_at')
    .eq('is_published', true)
    .eq('is_template', false)
    .order('created_at', { ascending: false })
    .limit(24)

  const typedPrograms = programs as unknown as {
    id: string
    title: string | null
    description: string | null
    goal: string | null
    level: string | null
    duration: string | null
    image_url: string | null
  }[] | null

  const programIds = (typedPrograms ?? []).map((p) => p.id)

  const { data: weeksRaw } = programIds.length
    ? await supabase.from('program_weeks').select('id,program_id').in('program_id', programIds)
    : { data: [] as unknown[] }

  const typedWeeks = (weeksRaw ?? []) as unknown as { id: string; program_id: string }[]
  const weekIds = typedWeeks.map((w) => w.id)

  const { data: sessionsRaw } = weekIds.length
    ? await supabase.from('sessions').select('id,week_id').in('week_id', weekIds)
    : { data: [] as unknown[] }

  const typedSessions = (sessionsRaw ?? []) as unknown as { id: string; week_id: string }[]

  const weeksCountByProgramId = new Map<string, number>()
  const programIdByWeekId = new Map<string, string>()
  for (const w of typedWeeks) {
    programIdByWeekId.set(w.id, w.program_id)
    weeksCountByProgramId.set(w.program_id, (weeksCountByProgramId.get(w.program_id) ?? 0) + 1)
  }

  const sessionsCountByProgramId = new Map<string, number>()
  for (const s of typedSessions) {
    const programId = programIdByWeekId.get(s.week_id)
    if (!programId) continue
    sessionsCountByProgramId.set(programId, (sessionsCountByProgramId.get(programId) ?? 0) + 1)
  }

  const coverUrlByProgramId = await resolveProgramCoverUrls(supabase, typedPrograms ?? [])

  const items = (typedPrograms ?? []).map((p) => {
    return {
      ...p,
      image_url: coverUrlByProgramId.get(p.id) ?? p.image_url,
      weeksCount: weeksCountByProgramId.get(p.id) ?? 0,
      sessionsCount: sessionsCountByProgramId.get(p.id) ?? 0,
    }
  })

  return (
    <main className="bg-white">
      <section>
        <Container className="py-12 md:py-16">
          <SectionHeading
            eyebrow="Programmes"
            eyebrowClassName="text-[color:var(--brand)]"
            title="Voici des exemples de programmes que tu peux créer avec ton app"
            subtitle="Une vitrine claire, des cartes premium, et une page de présentation pour chaque programme."
          />
        </Container>
      </section>

      <section>
        <Container className="py-12 md:py-16">
          {items.length > 0 ? (
            <ProgramsGridClient items={items} defaultImageUrl={defaultImageUrl} />
          ) : (
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
              <div className="text-sm font-semibold text-[color:var(--brand)]">Aucun programme public.</div>
              <div className="mt-2 text-sm text-black/70">Ajoute des programmes publics pour alimenter ta vitrine.</div>
            </div>
          )}
        </Container>
      </section>
    </main>
  )
}
