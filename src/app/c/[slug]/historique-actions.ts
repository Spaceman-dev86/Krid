'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '../../../lib/supabase/server'

function portalBase(slug: string) {
  return `/c/${slug}`
}

async function requireClientForPortal(slug: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login/client?redirectTo=${encodeURIComponent(portalBase(slug) + '/historique')}`)

  const { data: branding } = await supabase
    .from('coach_branding')
    .select('coach_id')
    .eq('slug', slug)
    .maybeSingle()

  if (!branding) redirect('/')

  const { data: client } = await supabase
    .from('clients')
    .select('id, coach_id')
    .eq('coach_id', branding.coach_id)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!client) redirect(`${portalBase(slug)}?error=not_your_coach`)

  return { supabase, clientId: client.id, coachId: client.coach_id as string, slug }
}

export async function toggleFavoriteAction(formData: FormData) {
  const slug = String(formData.get('slug') ?? '').trim()
  const targetType = String(formData.get('target_type') ?? '').trim()
  const targetId = String(formData.get('target_id') ?? '').trim()
  const returnTo = String(formData.get('return_to') ?? '').trim()

  if (!slug || !targetId || (targetType !== 'exercise' && targetType !== 'block')) {
    redirect('/login/client')
  }

  const { supabase, clientId, coachId } = await requireClientForPortal(slug)
  // Table not yet in generated Database types (slice 15).
  const db = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (a: string, b: string) => {
          eq: (a: string, b: string) => {
            eq: (a: string, b: string) => {
              maybeSingle: () => Promise<{ data: { id: string } | null }>
            }
          }
        }
      }
      insert: (v: Record<string, unknown>) => Promise<unknown>
      delete: () => { eq: (a: string, b: string) => Promise<unknown> }
    }
  }

  const { data: existing } = await db
    .from('client_favorites')
    .select('id')
    .eq('client_id', clientId)
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .maybeSingle()

  if (existing?.id) {
    await db.from('client_favorites').delete().eq('id', existing.id)
  } else {
    await db.from('client_favorites').insert({
      client_id: clientId,
      coach_id: coachId,
      target_type: targetType,
      target_id: targetId,
    })
  }

  const hist = `${portalBase(slug)}/historique`
  revalidatePath(hist)
  revalidatePath(`${hist}/favoris`)
  if (returnTo.startsWith(hist)) {
    revalidatePath(returnTo)
    redirect(returnTo)
  }
  redirect(hist)
}
