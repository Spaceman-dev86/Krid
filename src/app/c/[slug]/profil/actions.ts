'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '../../../../lib/supabase/server'

function clean(value: FormDataEntryValue | null) {
  const s = String(value ?? '').trim()
  return s.length ? s : null
}

export async function updateClientProfilAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const slug = clean(formData.get('slug'))
  const clientId = clean(formData.get('client_id'))
  const returnTo = clean(formData.get('return_to')) ?? (slug ? `/c/${slug}/profil/infos` : '/')
  if (!slug || !clientId) redirect('/')

  const sex = clean(formData.get('sex'))
  const birthDate = clean(formData.get('birth_date'))

  const { error } = await supabase
    .from('clients')
    .update({
      first_name: clean(formData.get('first_name')),
      last_name: clean(formData.get('last_name')),
      phone: clean(formData.get('phone')),
      sex: sex && ['F', 'M', 'X', 'Autre'].includes(sex) ? (sex === 'Autre' ? 'X' : sex) : null,
      birth_date: birthDate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', clientId)
    .eq('user_id', user.id)

  if (error) {
    redirect(`${returnTo}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/c/${slug}/profil`)
  revalidatePath(`/c/${slug}/profil/infos`)
  redirect(`${returnTo}?saved=1`)
}
