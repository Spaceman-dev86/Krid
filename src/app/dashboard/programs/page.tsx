import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '../../../lib/supabase/server'
export default async function ProgramsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: myPrograms } = await supabase
    .from('programs')
    .select('id,title,level,duration,is_published,created_at')
    .eq('coach_id', user.id)
    .order('created_at', { ascending: false })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const isAdmin = profile?.role === 'admin'

  if (isAdmin) {
    redirect('/admin/programs')
  }

  const basePath = '/dashboard/programs'

  const cardStyle: React.CSSProperties = {
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: 14,
    background: '#ffffff',
    textDecoration: 'none',
    color: '#111827',
    display: 'grid',
    gap: 8,
    minWidth: 0,
  }

  const metaStyle: React.CSSProperties = {
    color: '#6b7280',
    display: 'grid',
    gap: 4,
    fontSize: 13,
  }

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gap: 12,
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  }

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Programmes</h1>
          <p style={{ color: '#6b7280', marginTop: 6 }}>Mes programmes</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link
            href={`${basePath}/new`}
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid #111827',
              background: '#111827',
              color: '#ffffff',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            Créer un programme
          </Link>
          <Link href="/dashboard" style={{ textDecoration: 'none', color: '#111827', fontSize: 20 }} title="Retour">
            ←
          </Link>
        </div>
      </div>

      <section style={{ marginTop: 22 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Liste</h2>

        {(myPrograms ?? []).length > 0 ? (
          <div style={{ marginTop: 12, ...gridStyle }}>
            {(myPrograms ?? []).map((p) => (
              <Link key={p.id} href={`${basePath}/${p.id}`} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 16, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.title}
                  </div>
                  <div style={{ color: '#6b7280', fontSize: 12, whiteSpace: 'nowrap' }}>{p.is_published ? 'Publié' : 'Brouillon'}</div>
                </div>
                <div style={metaStyle}>
                  <div>Niveau : {p.level ?? '—'}</div>
                  <div>Durée : {p.duration ?? '—'}</div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p style={{ color: '#6b7280', marginTop: 12 }}>Aucun programme pour le moment.</p>
        )}
      </section>
    </main>
  )
}
