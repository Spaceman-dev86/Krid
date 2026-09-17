'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '../../../../../lib/supabase/server'

function portalBase(slug: string) {
  return `/c/${slug}`
}

export async function requestInvoiceAction(formData: FormData) {
  const slug = String(formData.get('slug') ?? '').trim()
  const prestationId = String(formData.get('prestation_id') ?? '').trim() || null
  const comment = String(formData.get('comment') ?? '').trim() || null
  const returnTo = String(formData.get('return_to') ?? '').trim() || `${portalBase(slug)}/profil/prestations`

  if (!slug) redirect('/login/client')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/login/client?redirectTo=${encodeURIComponent(returnTo)}`)
  }

  const { data: branding } = await supabase
    .from('coach_branding')
    .select('coach_id')
    .eq('slug', slug)
    .maybeSingle()
  if (!branding) redirect('/')

  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('coach_id', branding.coach_id)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()
  if (!client) redirect(`${portalBase(slug)}/showroom?error=not_your_coach`)

  const { data: pending } = await supabase
    .from('invoice_requests')
    .select('id')
    .eq('client_id', client.id)
    .eq('status', 'pending')
    .limit(1)
    .maybeSingle()

  if (pending) {
    redirect(`${returnTo}?error=` + encodeURIComponent('Une demande de facture est déjà en cours'))
  }

  if (prestationId) {
    const { data: presta } = await supabase
      .from('prestations')
      .select('id')
      .eq('id', prestationId)
      .eq('coach_id', branding.coach_id)
      .maybeSingle()
    if (!presta) {
      redirect(`${returnTo}?error=` + encodeURIComponent('Prestation invalide'))
    }
  }

  const { error } = await supabase.from('invoice_requests').insert({
    coach_id: branding.coach_id,
    client_id: client.id,
    prestation_id: prestationId,
    comment,
    status: 'pending',
  })

  if (error) {
    redirect(`${returnTo}?error=` + encodeURIComponent(error.message))
  }

  revalidatePath(`${portalBase(slug)}/profil/prestations`)
  revalidatePath('/payments/suivi-clients')
  redirect(`${returnTo}?invoice_requested=1`)
}
