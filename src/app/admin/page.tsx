import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '../../lib/supabase/server'
import { Button, Card, Container } from '../../components/ui'

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
    redirect('/login')
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()

  if (profile?.role !== 'admin') {
    redirect('/dashboard')
  }

  const { data: program4Weeks } = await supabase
    .from('programs')
    .select('id,title')
    .eq('is_published', true)
    .ilike('title', '%semaine%')
    .or('title.ilike.%4%,title.ilike.%quatre%')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: privatePrograms } = await supabase
    .from('programs')
    .select('id,title,created_at,is_template')
    .eq('coach_id', user.id)
    .eq('is_published', false)
    .eq('is_template', false)
    .order('created_at', { ascending: false })

  const { data: templates } = await supabase
    .from('programs')
    .select('id,title,created_at')
    .eq('is_template', true)
    .order('created_at', { ascending: false })

  const templateMuscu = (templates ?? []).find((t) => (t.title ?? '').toLowerCase().includes('muscu')) ?? (templates ?? [])[0]

  return (
    <main className="bg-[var(--bg)] text-[var(--text)]">
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
                <p className="mt-1 text-sm text-[var(--muted)]">Accès rapide au programme phare (4 semaines).</p>
              </div>
              <Link
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand)] text-white"
                href="/admin/exercises/new"
                aria-label="Créer un exercice"
                title="Créer un exercice"
              >
                <PlusIcon />
              </Link>
            </div>

            <div className="mt-6">
              {program4Weeks ? (
                <Button href={`/admin/programs/${program4Weeks.id}`} variant="primary" className="w-full justify-between">
                  <span>{program4Weeks.title || 'Programme 4 semaines'}</span>
                  <span aria-hidden>→</span>
                </Button>
              ) : (
                <p className="text-sm text-[var(--muted)]">Aucun programme public trouvé.</p>
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
                href="/admin/exercises/new"
                aria-label="Créer un exercice"
                title="Créer un exercice"
              >
                <PlusIcon />
              </Link>
            </div>

            <div className="mt-6">
              {privatePrograms && privatePrograms.length > 0 ? (
                <ul className="grid gap-3">
                  {privatePrograms.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3">
                      <Link className="min-w-0 truncate text-base font-semibold text-[var(--brand)]" href={`/admin/programs/${p.id}`}>
                        {p.title || 'Programme privé'}
                      </Link>
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
            <h2 className="text-lg font-extrabold tracking-tight">Templates</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Modèles réutilisables.</p>
            <div className="mt-6">
              {templateMuscu ? (
                <Button href={`/admin/programs/${templateMuscu.id}`} variant="primary" className="w-full justify-between">
                  <span>{templateMuscu.title || 'Template muscu'}</span>
                  <span aria-hidden>→</span>
                </Button>
              ) : null}

              {templates && templates.length > 0 ? (
                <ul className="mt-3 grid gap-3">
                  {templates
                    .filter((t) => t.id !== templateMuscu?.id)
                    .map((t) => (
                      <li key={t.id}>
                        <Link className="text-base font-semibold text-[var(--brand)]" href={`/admin/programs/${t.id}`}>
                          {t.title || 'Template'}
                        </Link>
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="text-sm text-[var(--muted)]">Aucun template.</p>
              )}
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
