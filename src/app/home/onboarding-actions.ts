'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '../../lib/supabase/server'

function clean(value: FormDataEntryValue | null) {
  const s = String(value ?? '').trim()
  return s.length ? s : null
}

export async function createOnboardingQuestionAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const returnTo = clean(formData.get('return_to')) ?? '/profile/mon-app'

  const label = clean(formData.get('label'))
  if (!label) redirect(`${returnTo}?error=` + encodeURIComponent('Libellé question requis'))

  const type = clean(formData.get('type')) ?? 'texte'
  if (!['texte', 'nombre', 'choix', 'oui_non'].includes(type)) {
    redirect(`${returnTo}?error=` + encodeURIComponent('Type invalide'))
  }

  const optionsRaw = clean(formData.get('options'))
  const options =
    type === 'choix' && optionsRaw
      ? optionsRaw
          .split(/[\n,]/)
          .map((s) => s.trim())
          .filter(Boolean)
      : null

  if (type === 'choix' && (!options || !options.length)) {
    redirect(`${returnTo}?error=` + encodeURIComponent('Ajoute des choix (séparés par des virgules)'))
  }

  const { data: maxRow } = await supabase
    .from('coach_onboarding_questions')
    .select('sort_order')
    .eq('coach_id', user.id)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await supabase.from('coach_onboarding_questions').insert({
    coach_id: user.id,
    label,
    type,
    required: formData.get('required') === 'on',
    sort_order: (maxRow?.sort_order ?? 0) + 1,
    options,
  })

  if (error) redirect(`${returnTo}?error=` + encodeURIComponent(error.message))

  revalidatePath('/home')
  revalidatePath('/profile/mon-app')
  redirect(`${returnTo}?question_saved=1`)
}

export async function deleteOnboardingQuestionAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const returnTo = clean(formData.get('return_to')) ?? '/profile/mon-app'
  const id = clean(formData.get('question_id'))
  if (!id) redirect(returnTo)

  await supabase.from('coach_onboarding_questions').delete().eq('id', id).eq('coach_id', user.id)

  revalidatePath('/home')
  revalidatePath('/profile/mon-app')
  redirect(`${returnTo}?question_deleted=1`)
}
