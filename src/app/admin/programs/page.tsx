import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '../../../lib/supabase/server'
import { Button, Card, Container } from '../../../components/ui'

export default async function AdminProgramsPage({
  searchParams,
}: {
  searchParams?: { view?: string | string[] }
}) {
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

  const rawView = searchParams?.view
  const view = Array.isArray(rawView) ? rawView[0] : rawView
  const normalizedView = view === 'public' || view === 'drafts' || view === 'templates' ? view : 'all'

  let query = supabase
    .from('programs')
    .select('id,title,coach_id,is_published,is_template,created_at')
    .order('created_at', { ascending: false })

  if (normalizedView === 'public') {
    query = query.eq('is_published', true).eq('is_template', false)
  }
  if (normalizedView === 'drafts') {
    query = query.eq('is_published', false).eq('is_template', false)
  }
  if (normalizedView === 'templates') {
    query = query.eq('is_template', true)
  }

  const { data: programsRaw } = await query
  const programs = programsRaw as unknown as { id: string; title: string | null; is_template: boolean | null; is_published: boolean | null }[] | null

  const tabs = [
    { key: 'all', label: 'Tous', href: '/admin/programs' },
    { key: 'public', label: 'Publics', href: '/admin/programs?view=public' },
    { key: 'drafts', label: 'Brouillons', href: '/admin/programs?view=drafts' },
    { key: 'templates', label: 'Templates', href: '/admin/programs?view=templates' },
  ] as const

  return (
    <main className="bg-[var(--bg)] text-[var(--text)]">
      <Container className="py-14 md:py-16">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <p className="text-sm text-[var(--muted)]">
              <Link className="font-semibold text-[var(--brand)]" href="/admin">
                Retour admin
              </Link>
            </p>
            <div className="mt-3">
              <Link
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand)] text-base font-extrabold text-white"
                href="/admin/new?scope=private"
                aria-label="Créer un programme"
                title="Créer un programme"
              >
                +
              </Link>
            </div>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[var(--brand)]">Programmes</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">Liste et accès rapide</p>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          {tabs.map((t) => (
            <Button key={t.key} href={t.href} variant={normalizedView === t.key ? 'primary' : 'secondary'}>
              {t.label}
            </Button>
          ))}
        </div>

        <section className="mt-10">
          <Card className="p-8">
            {(programs ?? []).length > 0 ? (
              <ul className="grid gap-4">
                {(programs ?? []).map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-3">
                    <Link className="text-sm font-semibold text-[var(--brand)]" href={`/admin/programs/${p.id}`}>
                      {p.title || 'Programme'}
                    </Link>
                    <span className="text-xs font-semibold text-[var(--muted)]">
                      {p.is_template ? 'Template' : p.is_published ? 'Public' : 'Brouillon'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--muted)]">Aucun programme.</p>
            )}
          </Card>
        </section>
      </Container>
    </main>
  )
}
