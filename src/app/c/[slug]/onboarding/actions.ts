'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { listCoachOnboardingQuestions } from '../../../../lib/client-portal/onboarding'
import { createClient } from '../../../../lib/supabase/server'

function portalBase(slug: string) {
  return `/c/${slug}`
}

async function requireClient(slug: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login/client?redirectTo=${encodeURIComponent(portalBase(slug) + '/onboarding')}`)

  const { data: branding } = await supabase
    .from('coach_branding')
    .select('coach_id')
    .eq('slug', slug)
    .maybeSingle()
  if (!branding) redirect('/')

  const { data: client } = await supabase
    .from('clients')
    .select('id, onboarding_completed_at')
    .eq('coach_id', branding.coach_id)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!client) redirect(`${portalBase(slug)}/showroom?error=not_your_coach`)

  return { supabase, clientId: client.id, coachId: branding.coach_id, slug, completedAt: client.onboarding_completed_at }
}

export async function saveOnboardingAnswerAction(formData: FormData) {
  const slug = String(formData.get('slug') ?? '').trim()
  const questionId = String(formData.get('question_id') ?? '').trim()
  const step = Number(formData.get('step') ?? '0')
  const rawValue = String(formData.get('value') ?? '').trim()
  const restart = String(formData.get('restart') ?? '') === '1'

  if (!slug) redirect('/login/client')

  const { supabase, clientId, coachId } = await requireClient(slug)

  if (restart) {
    await supabase.from('onboarding_answers').delete().eq('client_id', clientId).eq('coach_id', coachId)
    redirect(`${portalBase(slug)}/onboarding?step=0`)
  }

  if (!questionId) redirect(`${portalBase(slug)}/onboarding`)

  const questions = await listCoachOnboardingQuestions(supabase, coachId)
  const q = questions.find((x) => x.id === questionId)
  if (!q) redirect(`${portalBase(slug)}/onboarding`)

  if (q.required && !rawValue) {
    redirect(`${portalBase(slug)}/onboarding?step=${step}&error=required`)
  }

  let value: string | number | boolean | null = rawValue
  if (q.type === 'nombre') {
    const n = Number(rawValue.replace(',', '.'))
    if (!Number.isFinite(n)) {
      redirect(`${portalBase(slug)}/onboarding?step=${step}&error=nombre`)
    }
    value = n
  } else if (q.type === 'oui_non') {
    value = rawValue === 'oui'
  }

  const { error } = await supabase.from('onboarding_answers').upsert(
    {
      client_id: clientId,
      coach_id: coachId,
      question_id: questionId,
      value,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'client_id,question_id' }
  )

  if (error) {
    redirect(`${portalBase(slug)}/onboarding?step=${step}&error=${encodeURIComponent(error.message)}`)
  }

  const next = step + 1
  if (next >= questions.length) {
    await supabase
      .from('clients')
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq('id', clientId)

    revalidatePath(`${portalBase(slug)}/home`)
    revalidatePath(`${portalBase(slug)}/profil`)
    redirect(`${portalBase(slug)}/home?onboarded=1`)
  }

  redirect(`${portalBase(slug)}/onboarding?step=${next}`)
}
