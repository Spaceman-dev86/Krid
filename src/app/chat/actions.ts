'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { canAccessCoachApp } from '../../lib/auth/roles'
import {
  ensureDmThreadId,
  markThreadRead,
  sendChatMessage,
} from '../../lib/chat/chat'
import { createClient } from '../../lib/supabase/server'

async function requireCoach() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  return { supabase, userId: user.id }
}

export async function openDmWithClientAction(formData: FormData) {
  const clientId = String(formData.get('client_id') ?? '').trim()
  if (!clientId) redirect('/chat')

  const { supabase, userId } = await requireCoach()

  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .eq('coach_id', userId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!client) redirect('/chat?error=client')

  let threadId: string
  try {
    threadId = await ensureDmThreadId(supabase, clientId)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    redirect(`/chat?error=${encodeURIComponent(msg)}`)
  }

  revalidatePath('/chat')
  redirect(`/chat/${threadId}`)
}

export async function coachSendMessageAction(formData: FormData) {
  const threadId = String(formData.get('thread_id') ?? '').trim()
  const body = String(formData.get('body') ?? '')
  if (!threadId) redirect('/chat')

  const { supabase, userId } = await requireCoach()

  try {
    await sendChatMessage(supabase, threadId, userId, body)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    if (msg === 'empty') redirect(`/chat/${threadId}`)
    redirect(`/chat/${threadId}?error=${encodeURIComponent(msg)}`)
  }

  revalidatePath('/chat')
  revalidatePath(`/chat/${threadId}`)
  redirect(`/chat/${threadId}`)
}

export async function coachMarkReadAction(formData: FormData) {
  const threadId = String(formData.get('thread_id') ?? '').trim()
  if (!threadId) return
  const { supabase, userId } = await requireCoach()
  await markThreadRead(supabase, threadId, userId)
  revalidatePath('/chat')
  revalidatePath(`/chat/${threadId}`)
}
