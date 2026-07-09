import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Container } from '../../../../components/marketing'
import { createClient } from '../../../../lib/supabase/server'
import StickyHeader from '../../nutrition/StickyHeader'
import ChatProClient from './ChatProClient'
import ScheduleSessionFromChatClient from './ScheduleSessionFromChatClient'

type PageProps = {
  params: Promise<{ id: string }>
}

type ConversationRow = {
  id: string
  client_id: string
  client: {
    id: string
    full_name: string
    avatar_seed: string | null
    avatar_path?: string | null
  } | null
}

type MessageRow = {
  id: string
  sender: 'client' | 'coach' | 'system'
  body: string
  created_at: string
  reply_to_id?: string | null
}

type StorageListItem = {
  name: string
}

function hashToInt(input: string) {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

function fakeProgram(clientId: string) {
  const programs = [
    'Programme prise de masse — 4 semaines',
    'Programme perte de poids — 6 semaines',
    'Programme remise en forme — 4 semaines',
    'Programme mobilité — 3 semaines',
    'Programme force — 8 semaines',
  ]
  const h = hashToInt(clientId)
  const name = programs[h % programs.length]
  const progress = 10 + (h % 81)
  return { name, progress }
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

function localDateTimeToIso(date: string, time: string) {
  const [y, m, d] = date.split('-').map((x) => Number(x))
  const [hh, mm] = time.split(':').map((x) => Number(x))
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0)
  return dt.toISOString()
}

function addMinutesIso(iso: string, minutes: number) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Date(d.getTime() + minutes * 60 * 1000).toISOString()
}

const storageBucket = 'photo'

function normalizeStoragePath(p: string) {
  let out = p.trim()
  if (out.startsWith('/')) out = out.slice(1)
  if (out.startsWith(`${storageBucket}/`)) out = out.slice(storageBucket.length + 1)
  return out
}

function getStoragePathFromUrl(raw: string) {
  try {
    const u = new URL(raw)
    const parts = u.pathname.split('/').filter(Boolean)
    const idx = parts.findIndex((p) => p === 'object')
    if (idx === -1) return null
    const bucketIdx = idx + 2
    if (!parts[bucketIdx] || parts[bucketIdx] !== storageBucket) return null
    const internal = parts.slice(bucketIdx + 1).join('/')
    return internal || null
  } catch {
    return null
  }
}

export default async function DashboardChatConversationPage(props: PageProps) {
  const { id: conversationId } = await props.params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: conversationRaw, error: convErr } = await supabase
    .from('demo_conversations')
    .select('id,client_id,client:demo_clients(id,full_name,avatar_seed,avatar_path)')
    .eq('id', conversationId)
    .maybeSingle()

  if (convErr) {
    redirect(`/dashboard/chat?error=${encodeURIComponent(convErr.message)}`)
  }

  const conversation = conversationRaw as unknown as ConversationRow | null

  if (!conversation) {
    redirect('/dashboard/chat')
  }

  let messagesRaw: unknown[] | null = null
  const { data: messagesWithReply, error: messagesWithReplyErr } = await supabase
    .from('demo_messages')
    .select('id,sender,body,created_at,reply_to_id')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (messagesWithReplyErr) {
    const msg = messagesWithReplyErr.message ?? ''
    if (/reply_to_id/i.test(msg) && /(does not exist|unknown column|column)/i.test(msg)) {
      const { data: messagesNoReply, error: messagesNoReplyErr } = await supabase
        .from('demo_messages')
        .select('id,sender,body,created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (messagesNoReplyErr) {
        redirect(`/dashboard/chat?error=${encodeURIComponent(messagesNoReplyErr.message)}`)
      }

      messagesRaw = messagesNoReply as unknown as unknown[]
    } else {
      redirect(`/dashboard/chat?error=${encodeURIComponent(messagesWithReplyErr.message)}`)
    }
  } else {
    messagesRaw = messagesWithReply as unknown as unknown[]
  }

  const messages = (messagesRaw ?? []) as unknown as MessageRow[]

  const clientName = conversation.client?.full_name ?? 'Client'
  const { name: progName, progress } = fakeProgram(conversation.client_id)

  let avatarUrl: string | null = null

  const avatarPath = conversation.client?.avatar_path
  if (typeof avatarPath === 'string' && avatarPath.trim().length > 0) {
    const raw = avatarPath.trim()
    const isHttp = /^https?:\/\//i.test(raw)
    const internalFromUrl = isHttp ? getStoragePathFromUrl(raw) : null
    const internalPath = internalFromUrl ?? (isHttp ? null : raw)
    if (internalPath) {
      const { data } = await supabase.storage
        .from(storageBucket)
        .createSignedUrl(normalizeStoragePath(internalPath), 60 * 60)
      avatarUrl = data?.signedUrl ?? null
    }
  }

  if (!avatarUrl) {
    const { data: avatarFilesRaw } = await supabase.storage.from(storageBucket).list('messagerie', {
      limit: 200,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' },
    })

    const avatarFiles = ((avatarFilesRaw ?? []) as unknown as StorageListItem[])
      .map((f) => String(f?.name ?? '').trim())
      .filter(Boolean)

    if (avatarFiles.length > 0) {
      const idx = hashToInt(conversation.client_id) % avatarFiles.length
      const fileName = avatarFiles[idx]
      if (fileName) {
        const rawPathOrUrl = `messagerie/${fileName}`
        const raw = String(rawPathOrUrl).trim()
        const isHttp = /^https?:\/\//i.test(raw)
        const internalFromUrl = isHttp ? getStoragePathFromUrl(raw) : null
        const internalPath = internalFromUrl ?? (isHttp ? null : raw)

        if (internalPath) {
          const { data } = await supabase.storage
            .from(storageBucket)
            .createSignedUrl(normalizeStoragePath(internalPath), 60 * 60)
          avatarUrl = data?.signedUrl ?? null
        }
      }
    }
  }

  async function sendMessage(formData: FormData) {
    'use server'

    const body = String(formData.get('body') ?? '').trim()
    const replyToIdRaw = String(formData.get('reply_to_id') ?? '').trim()
    const replyToId = replyToIdRaw.length > 0 ? replyToIdRaw : null
    if (!body) return

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    if (replyToId) {
      const { data: replyRow } = await supabase
        .from('demo_messages')
        .select('id')
        .eq('id', replyToId)
        .eq('conversation_id', conversationId)
        .maybeSingle()

      if (!replyRow) {
        redirect(`/dashboard/chat/${conversationId}`)
      }
    }

    const insertPayloadBase = {
      conversation_id: conversationId,
      owner_coach_id: user.id,
      sender: 'coach' as const,
      body,
    }

    const insertPayloadBaseRecord = insertPayloadBase as unknown as Record<string, unknown>

    const demoMessagesInsert = (
      supabase as unknown as {
        from: (
          table: string
        ) => {
          insert: (values: unknown) => Promise<{ error: { message: string } | null }>
        }
      }
    ).from('demo_messages')

    if (replyToId) {
      const { error: insertErr } = await demoMessagesInsert.insert({
        ...insertPayloadBaseRecord,
        reply_to_id: replyToId,
      })

      if (insertErr) {
        const msg = insertErr.message ?? ''
        if (/reply_to_id/i.test(msg) && /(does not exist|unknown column|column)/i.test(msg)) {
          const { error: retryErr } = await demoMessagesInsert.insert(insertPayloadBaseRecord)
          if (retryErr) {
            redirect(`/dashboard/chat/${conversationId}?error=${encodeURIComponent(retryErr.message)}`)
          }
        } else {
          redirect(`/dashboard/chat/${conversationId}?error=${encodeURIComponent(insertErr.message)}`)
        }
      }
    } else {
      const { error: insertErr } = await demoMessagesInsert.insert(insertPayloadBaseRecord)
      if (insertErr) {
        redirect(`/dashboard/chat/${conversationId}?error=${encodeURIComponent(insertErr.message)}`)
      }
    }

    return
  }

  async function createSessionFromChat(formData: FormData) {
    'use server'

    const clientId = String(formData.get('client_id') ?? '').trim()
    const date = String(formData.get('date') ?? '').trim()
    const time = String(formData.get('time') ?? '').trim()
    const durationMin = Number(String(formData.get('duration_min') ?? '60'))
    const notes = String(formData.get('notes') ?? '').trim()

    if (!clientId || !date || !time || !Number.isFinite(durationMin) || durationMin <= 0) return

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const startAt = localDateTimeToIso(date, time)
    const endAt = addMinutesIso(startAt, durationMin)

    const { data: clientRow } = await supabase
      .from('demo_clients')
      .select('id,full_name')
      .eq('id', clientId)
      .maybeSingle()

    const clientName = (clientRow as unknown as { full_name?: string } | null)?.full_name ?? 'Client'
    const title = `Séance présentiel — ${clientName}`

    const calendarInsert = (
      supabase as unknown as {
        from: (
          table: string
        ) => {
          insert: (values: unknown) => Promise<{ error: { message: string } | null }>
        }
      }
    ).from('calendar_events')

    const { error: insertEventErr } = await calendarInsert.insert({
      owner_coach_id: user.id,
      client_id: clientId,
      type: 'in_person',
      title,
      start_at: startAt,
      end_at: endAt,
      notes: notes.length > 0 ? notes : null,
    })

    if (insertEventErr) {
      return
    }

    const hh = time.split(':')[0] ?? ''
    const mm = time.split(':')[1] ?? ''
    const prettyDate = `${date.split('-')[2] ?? ''}/${date.split('-')[1] ?? ''}/${date.split('-')[0] ?? ''}`
    const prettyDuration = `${durationMin} min`
    const body = `📅 Demande de séance : ${prettyDate} à ${hh}:${mm} (${prettyDuration}).${notes.length > 0 ? ` Note : ${notes}` : ''}`

    const demoMessagesInsert = (
      supabase as unknown as {
        from: (
          table: string
        ) => {
          insert: (values: unknown) => Promise<{ error: { message: string } | null }>
        }
      }
    ).from('demo_messages')

    await demoMessagesInsert.insert({
      conversation_id: conversationId,
      owner_coach_id: user.id,
      sender: 'system',
      body,
    })
  }

  return (
    <main className="min-h-screen bg-transparent">
      <Container className="py-6 sm:py-10">
        <StickyHeader opaquePageBackdrop>
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="mt-0.5 h-11 w-11 shrink-0 rounded-2xl object-cover ring-1 ring-black/10" />
              ) : (
                <div className="mt-0.5 h-11 w-11 shrink-0 rounded-2xl bg-black/5 ring-1 ring-black/10" />
              )}
              <div className="min-w-0">
                <div className="mt-1 truncate text-lg font-extrabold text-[#341c44]">{clientName}</div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <div className="rounded-full bg-black/5 px-3 py-1 text-xs font-extrabold text-[#341c44]">{progress}%</div>
                  <div className="truncate text-xs font-semibold text-black/50">{progName}</div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <ScheduleSessionFromChatClient clientId={conversation.client_id} createSessionAction={createSessionFromChat} />

              <Link
                href="/dashboard/chat"
                aria-label="Retour chat"
                title="Retour chat"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-[#341c44] ring-1 ring-black/10 hover:bg-[#f5f5f5]"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none">
                  <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
          </div>
        </StickyHeader>

        <div className="mt-5">
          <div className="mt-5 grid gap-3">
            <ChatProClient messages={messages} sendMessageAction={sendMessage} fixedComposer />
          </div>
        </div>
      </Container>
    </main>
  )
}
