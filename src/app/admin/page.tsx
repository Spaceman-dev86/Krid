import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '../../lib/supabase/server'
import { Button, Card, Container } from '../../components/ui'
import { ProgramEditorLink } from '../../components/ProgramEditorNavigationClient'

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={22}
      height={22}
      aria-hidden
      style={{ display: 'block', overflow: 'visible' }}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  )
}

export default async function AdminIndexPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/loginadmin')
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()

  const typedProfile = profile as unknown as { role: string | null } | null
  if (typedProfile?.role !== 'admin') {
    redirect('/dashboard')
  }

  const { data: publicProgramsRaw } = await supabase
    .from('programs')
    .select('id,title,created_at')
    .eq('is_published', true)
    .eq('is_template', false)
    .order('created_at', { ascending: false })

  const publicPrograms = publicProgramsRaw as unknown as { id: string; title: string | null }[] | null

  const { data: privateProgramsRaw } = await supabase
    .from('programs')
    .select('id,title,created_at,is_template')
    .eq('coach_id', user.id)
    .eq('is_published', false)
    .eq('is_template', false)
    .order('created_at', { ascending: false })

  const privatePrograms = privateProgramsRaw as unknown as { id: string; title: string | null }[] | null

  return (
    <main className="bg-transparent text-[var(--text)]">
      <Container className="py-10 md:py-12">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <h1 className="text-3xl font-extrabold tracking-tight text-[var(--brand)]">Admin</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">Pilotage du contenu (programmes, exercices) et pages internes.</p>
          </div>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <Card className="rounded-[var(--radius-lg)] p-8 ring-1 ring-[var(--border)]">
            <div className="flex items-start justify-between gap-6">
              <div className="min-w-0">
                <h2 className="text-lg font-extrabold tracking-tight">Programme public</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">Programmes publiés visibles sur la vitrine.</p>
              </div>
            </div>

            <div className="mt-6">
              {publicPrograms && publicPrograms.length > 0 ? (
                <ul className="grid gap-3">
                  {publicPrograms.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3">
                      <ProgramEditorLink
                        className="min-w-0 truncate text-base font-semibold text-[var(--brand)] disabled:opacity-60"
                        href={`/admin/programs/${p.id}`}
                      >
                        {p.title || 'Programme public'}
                      </ProgramEditorLink>
                      <span className="shrink-0 rounded-full bg-[var(--brand)] px-3 py-1 text-xs font-semibold text-white">
                        Public
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[var(--muted)]">Aucun programme public.</p>
              )}
            </div>
          </Card>

          <Card className="rounded-[var(--radius-lg)] p-8 ring-1 ring-[var(--border)]">
            <div className="flex items-start justify-between gap-6">
              <div className="min-w-0">
                <h2 className="text-lg font-extrabold tracking-tight">Programme privé</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">Brouillons / programmes internes.</p>
              </div>
              <Link
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand)] text-white"
                href="/admin/new?scope=private"
                aria-label="Créer un programme privé"
                title="Créer un programme privé"
              >
                <PlusIcon />
              </Link>
            </div>

            <div className="mt-6">
              {privatePrograms && privatePrograms.length > 0 ? (
                <ul className="grid gap-3">
                  {privatePrograms.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3">
                      <ProgramEditorLink
                        className="min-w-0 truncate text-base font-semibold text-[var(--brand)] disabled:opacity-60"
                        href={`/admin/programs/${p.id}`}
                      >
                        {p.title || 'Programme privé'}
                      </ProgramEditorLink>
                      <span className="shrink-0 rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-[var(--brand)]">
                        Brouillon
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[var(--muted)]">Aucun programme privé.</p>
              )}
            </div>
          </Card>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <Card className="rounded-[var(--radius-lg)] p-8 ring-1 ring-[var(--border)]">
            <h2 className="text-lg font-extrabold tracking-tight">Dashboard coach</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Accéder à l’interface coach (démo).</p>
            <div className="mt-6">
              <Button href="/dashboard" variant="primary" className="w-full justify-between">
                <span>Ouvrir le dashboard</span>
                <span aria-hidden>→</span>
              </Button>
            </div>
          </Card>

          <Card className="rounded-[var(--radius-lg)] p-8 ring-1 ring-[var(--border)]">
            <h2 className="text-lg font-extrabold tracking-tight">Bibliothèque</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Exercices, démos et médias.</p>
            <div className="mt-6">
              <Button href="/admin/exercises" variant="primary" className="w-full justify-between">
                <span>Bibliothèque d&apos;exercices</span>
                <span aria-hidden>→</span>
              </Button>
            </div>
          </Card>

          <Card className="rounded-[var(--radius-lg)] p-8 ring-1 ring-[var(--border)]">
            <h2 className="text-lg font-extrabold tracking-tight">Design system</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Référence UI & tokens.</p>
            <div className="mt-6 grid gap-3">
              <Button href="/admin/design" variant="primary" className="w-full justify-between">
                <span>Design</span>
                <span aria-hidden>→</span>
              </Button>
              <Button href="/admin/stats" variant="primary" className="w-full justify-between">
                <span>Stats</span>
                <span aria-hidden>→</span>
              </Button>
            </div>
          </Card>
        </div>
      </Container>
    </main>
  )
}
