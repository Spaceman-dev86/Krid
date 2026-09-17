'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  ensureDmThreadId,
  markThreadRead,
  sendChatMessage,
} from '../../../../lib/chat/chat'
import { createClient } from '../../../../lib/supabase/server'

function portalBase(slug: string) {
  return `/c/${slug}`
}

async function requirePortalClient(slug: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/login/client?redirectTo=${encodeURIComponent(portalBase(slug) + '/messages')}`)
  }

  const { data: branding } = await supabase
    .from('coach_branding')
    .select('coach_id, app_name')
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

  if (!client) redirect(`${portalBase(slug)}/showroom?error=not_your_coach`)

  const { data: grants } = await supabase
    .from('client_grants')
    .select('modules')
    .eq('client_id', client.id)
    .eq('coach_id', branding.coach_id)
    .eq('status', 'active')

  const modules = new Set(
    (grants ?? []).flatMap((g) => (Array.isArray(g.modules) ? g.modules : [])).filter((m) => typeof m === 'string')
  )
  if (!modules.has('messaging')) {
    redirect(`${portalBase(slug)}/home?module=locked`)
  }

  return {
    supabase,
    userId: user.id,
    clientId: client.id,
    coachId: client.coach_id as string,
    slug,
    appName: branding.app_name as string | null,
  }
}

export async function startCoachDmAction(formData: FormData) {
  const slug = String(formData.get('slug') ?? '').trim()
  if (!slug) redirect('/login/client')

  const ctx = await requirePortalClient(slug)

  let threadId: string
  try {
    threadId = await ensureDmThreadId(ctx.supabase, ctx.clientId)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    redirect(`${portalBase(slug)}/coach?error=${encodeURIComponent(msg)}`)
  }

  revalidatePath(`${portalBase(slug)}/messages`)
  redirect(`${portalBase(slug)}/messages/${threadId}`)
}

export async function clientSendMessageAction(formData: FormData) {
  const slug = String(formData.get('slug') ?? '').trim()
  const threadId = String(formData.get('thread_id') ?? '').trim()
  const body = String(formData.get('body') ?? '')
  if (!slug || !threadId) redirect('/login/client')

  const ctx = await requirePortalClient(slug)

  try {
    await sendChatMessage(ctx.supabase, threadId, ctx.userId, body)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    if (msg === 'empty') redirect(`${portalBase(slug)}/messages/${threadId}`)
    redirect(`${portalBase(slug)}/messages/${threadId}?error=${encodeURIComponent(msg)}`)
  }

  revalidatePath(`${portalBase(slug)}/messages`)
  revalidatePath(`${portalBase(slug)}/messages/${threadId}`)
  redirect(`${portalBase(slug)}/messages/${threadId}`)
}

export async function clientMarkReadAction(formData: FormData) {
  const slug = String(formData.get('slug') ?? '').trim()
  const threadId = String(formData.get('thread_id') ?? '').trim()
  if (!slug || !threadId) return
  const ctx = await requirePortalClient(slug)
  await markThreadRead(ctx.supabase, threadId, ctx.userId)
  revalidatePath(`${portalBase(slug)}/messages`)
  revalidatePath(`${portalBase(slug)}/messages/${threadId}`)
}
