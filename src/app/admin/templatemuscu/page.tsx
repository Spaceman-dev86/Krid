import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '../../../lib/supabase/server'

export default async function AdminTemplateMuscuListPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const typedProfile = profile as unknown as { role: string | null } | null
  if (typedProfile?.role !== 'admin') {
    redirect('/dashboard')
  }

  const { data: templates } = await supabase
    .from('programs')
    .select('id,title,created_at')
    .eq('coach_id', user.id)
    .eq('is_template', true)
    .order('created_at', { ascending: false })

  const typedTemplates = templates as unknown as { id: string; title: string | null }[] | null

  const firstTemplate = (typedTemplates ?? [])[0]
  if (firstTemplate?.id) {
    redirect(`/admin/templatemuscu/${firstTemplate.id}`)
  }

  type InsertedProgramRow = { id: string }
  type InsertedWeekRow = { id: string; week_order: number }
  type InsertedSessionRow = { id: string }

  type MinimalProgramsInsert = {
    from: (table: 'programs') => {
      insert: (values: {
        coach_id: string
        title: string
        description: string | null
        goal: string | null
        level: string | null
        duration: string | null
        is_template: boolean
        is_published: boolean
      }) => {
        select: (columns: 'id') => {
          maybeSingle: () => Promise<{ data: InsertedProgramRow | null; error: { message: string } | null }>
        }
      }
    }
  }

  type MinimalProgramWeeksInsert = {
    from: (table: 'program_weeks') => {
      insert: (values: { program_id: string; title: string; week_order: number }[]) => {
        select: (columns: 'id,week_order') => Promise<{ data: InsertedWeekRow[] | null; error: { message: string } | null }>
      }
    }
  }

  type MinimalSessionsInsert = {
    from: (table: 'sessions') => {
      insert: (values: { week_id: string; title: string; description?: string | null; session_order: number }[]) => {
        select: (columns: 'id') => Promise<{ data: InsertedSessionRow[] | null; error: { message: string } | null }>
      }
    }
  }

  const { data: insertedProgram, error: programInsertError } = await (supabase as unknown as MinimalProgramsInsert)
    .from('programs')
    .insert({
      coach_id: user.id,
      title: 'Template muscu',
      description: null,
      goal: null,
      level: 'Intermédiaire',
      duration: '4 semaines',
      is_template: true,
      is_published: false,
    })
    .select('id')
    .maybeSingle()

  if (!programInsertError && insertedProgram?.id) {
    const programId = String(insertedProgram.id)

    const { data: insertedWeeks, error: weeksInsertError } = await (supabase as unknown as MinimalProgramWeeksInsert)
      .from('program_weeks')
      .insert(
        Array.from({ length: 4 }).map((_, i) => ({
          program_id: programId,
          title: `Semaine ${i + 1}`,
          week_order: i + 1,
        }))
      )
      .select('id,week_order')

    if (!weeksInsertError && (insertedWeeks ?? []).length === 4) {
      const orderedWeeks = (insertedWeeks ?? []).slice().sort((a, b) => a.week_order - b.week_order)

      const sessionsToInsert = orderedWeeks.flatMap((w) =>
        Array.from({ length: 4 }).map((_, i) => ({
          week_id: w.id,
          title: `Séance ${i + 1}`,
          description: null,
          session_order: i + 1,
        }))
      )

      await (supabase as unknown as MinimalSessionsInsert).from('sessions').insert(sessionsToInsert).select('id')
    }

    redirect(`/admin/templatemuscu/${programId}`)
  }

  const iconButtonStyle: React.CSSProperties = {
    width: 40,
    height: 40,
    borderRadius: 12,
    border: '1px solid #111827',
    background: '#111827',
    color: '#ffffff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    textDecoration: 'none',
    fontWeight: 900,
    flex: '0 0 auto',
  }

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Template muscu</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link href="/admin" style={{ textDecoration: 'none', color: '#111827', fontWeight: 700 }} title="Retour">
            Retour
          </Link>
        </div>
      </div>

      <p style={{ color: '#6b7280', marginTop: 12 }}>Impossible de créer le template automatiquement.</p>
      <Link href="/admin/programs/new?scope=template" style={iconButtonStyle} aria-label="Créer" title="Créer">
        +
      </Link>
    </main>
  )
}
