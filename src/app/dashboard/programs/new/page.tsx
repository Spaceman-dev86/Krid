import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '../../../../lib/supabase/server'

export default async function NewProgramPage({
  searchParams,
}: {
  searchParams?: { scope?: string | string[] }
}) {
  const supabaseForPage = await createClient()
  const {
    data: { user: userForPage },
  } = await supabaseForPage.auth.getUser()

  if (!userForPage) {
    redirect('/login')
  }

  const { data: profileForPage } = await supabaseForPage
    .from('profiles')
    .select('role')
    .eq('id', userForPage.id)
    .maybeSingle()

  const isAdminForPage = profileForPage?.role === 'admin'
  const backHrefForPage = isAdminForPage ? '/admin' : '/dashboard'

  async function createProgram(formData: FormData) {
    'use server'

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const isAdmin = profile?.role === 'admin'
    const basePath = isAdmin ? '/admin/programs' : '/dashboard/programs'

    const title = String(formData.get('title') ?? '').trim()
    const description = String(formData.get('description') ?? '').trim()
    const goal = String(formData.get('goal') ?? '').trim()
    const level = String(formData.get('level') ?? '').trim()
    const duration = String(formData.get('duration') ?? '').trim()

    const rawScope = searchParams?.scope
    const scopeValue = Array.isArray(rawScope) ? rawScope[0] : rawScope
    const scope = scopeValue === 'public' || scopeValue === 'private' || scopeValue === 'template' ? scopeValue : undefined

    if (!title) {
      redirect(scope ? `${basePath}/new?scope=${encodeURIComponent(scope)}` : `${basePath}/new`)
    }

    const { error } = await supabase.from('programs').insert({
      coach_id: user.id,
      title,
      description: description || null,
      goal: goal || null,
      level: level || null,
      duration: duration || null,
      is_template: scope === 'template',
      is_published: scope === 'public',
    })

    if (error) {
      const base = scope ? `${basePath}/new?scope=${encodeURIComponent(scope)}` : `${basePath}/new`
      redirect(`${base}&error=${encodeURIComponent(error.message)}`)
    }

    if (scope === 'public') {
      redirect(`${basePath}?view=public`)
    }
    if (scope === 'private') {
      if (isAdmin) {
        redirect('/admin')
      }
      redirect(`${basePath}?view=mine`)
    }
    if (scope === 'template') {
      redirect(`${basePath}?view=templates`)
    }
    redirect(basePath)
  }

  return (
    <main style={{ maxWidth: 700, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Nouveau programme</h1>
        <Link href={backHrefForPage} style={{ textDecoration: 'none', color: '#111827' }}>
          Retour
        </Link>
      </div>

      <form action={createProgram} style={{ marginTop: 24, display: 'grid', gap: 12 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span>Titre</span>
          <input
            name="title"
            required
            style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}
          />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span>Description</span>
          <textarea
            name="description"
            rows={4}
            style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}
          />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span>Objectif</span>
          <input name="goal" style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }} />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span>Niveau</span>
          <select
            name="level"
            defaultValue=""
            style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}
          >
            <option value="">Sélectionner…</option>
            <option value="Débutant">Débutant</option>
            <option value="Intermédiaire">Intermédiaire</option>
            <option value="Confirmé">Confirmé</option>
          </select>
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span>Durée</span>
          <input name="duration" style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }} />
        </label>

        <button
          type="submit"
          style={{
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid #111827',
            background: '#111827',
            color: '#ffffff',
            cursor: 'pointer',
          }}
        >
          Créer
        </button>
      </form>
    </main>
  )
}
