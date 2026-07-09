import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Card, Container } from '../../../components/marketing'
import { createClient } from '../../../lib/supabase/server'
import StickyHeader from '../nutrition/StickyHeader'

type ClientRow = {
  id: string
  full_name: string
  avatar_seed: string | null
  avatar_path?: string | null
}

type ConversationRow = {
  id: string
  client_id: string
  client: ClientRow | null
}

type MessageRow = {
  conversation_id: string
  body: string
  created_at: string
  sender: 'client' | 'coach' | 'system'
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

function fakeProgramName(clientId: string) {
  const programs = [
    'Programme prise de masse — 4 semaines',
    'Programme perte de poids — 6 semaines',
    'Programme remise en forme — 4 semaines',
    'Programme mobilité — 3 semaines',
    'Programme force — 8 semaines',
  ]
  const h = hashToInt(clientId)
  return programs[h % programs.length]
}

function shiftIsoByMinutes(iso: string, minutesDelta: number) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Date(d.getTime() + minutesDelta * 60 * 1000).toISOString()
}

function formatTimeOnly(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(d)
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

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DashboardChatPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: conversationsRaw, error: convErr } = await supabase
    .from('demo_conversations')
    .select('id,client_id,client:demo_clients(id,full_name,avatar_seed,avatar_path)')
    .order('created_at', { ascending: true })

  if (convErr) {
    redirect(`/dashboard?error=${encodeURIComponent(convErr.message)}`)
  }

  const conversations = (conversationsRaw ?? []) as unknown as ConversationRow[]
  const conversationIds = conversations.map((c) => c.id)

  const { data: messagesRaw } = conversationIds.length
    ? await supabase
        .from('demo_messages')
        .select('conversation_id,body,created_at,sender')
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: false })
    : { data: [] as unknown[] }

  const messages = (messagesRaw ?? []) as unknown as MessageRow[]
  const lastByConversation = new Map<string, MessageRow>()
  for (const m of messages) {
    if (!lastByConversation.has(m.conversation_id)) {
      lastByConversation.set(m.conversation_id, m)
    }
  }

  const ordered = [...conversations].sort((a, b) => {
    const la = lastByConversation.get(a.id)?.created_at
    const lb = lastByConversation.get(b.id)?.created_at
    if (!la && !lb) return 0
    if (!la) return 1
    if (!lb) return -1
    return new Date(lb).getTime() - new Date(la).getTime()
  })

  const uniqueClientIds = Array.from(new Set(ordered.map((c) => c.client_id).filter(Boolean)))

  const { data: avatarFilesRaw } = await supabase.storage.from(storageBucket).list('messagerie', {
    limit: 200,
    offset: 0,
    sortBy: { column: 'name', order: 'asc' },
  })

  const avatarFiles = ((avatarFilesRaw ?? []) as unknown as StorageListItem[])
    .map((f) => String(f?.name ?? '').trim())
    .filter(Boolean)

  const avatarUrlByClientId = new Map<string, string>()

  const avatarPathByClientId = new Map<string, string>()
  for (const c of ordered) {
    const p = c.client?.avatar_path
    if (typeof p === 'string' && p.trim().length > 0) {
      avatarPathByClientId.set(c.client_id, p.trim())
    }
  }

  const uniqueAvatarPaths = Array.from(new Set(Array.from(avatarPathByClientId.values())))
  await Promise.all(
    uniqueAvatarPaths.map(async (rawPathOrUrl) => {
      const raw = String(rawPathOrUrl).trim()
      if (!raw) return

      const isHttp = /^https?:\/\//i.test(raw)
      const internalFromUrl = isHttp ? getStoragePathFromUrl(raw) : null
      const internalPath = internalFromUrl ?? (isHttp ? null : raw)

      if (!internalPath) return

      const { data } = await supabase.storage
        .from(storageBucket)
        .createSignedUrl(normalizeStoragePath(internalPath), 60 * 60)
      if (!data?.signedUrl) return

      for (const [clientId, p] of avatarPathByClientId.entries()) {
        if (p === rawPathOrUrl) avatarUrlByClientId.set(clientId, data.signedUrl)
      }
    })
  )

  if (avatarFiles.length > 0 && uniqueClientIds.length > 0) {
    await Promise.all(
      uniqueClientIds.map(async (clientId) => {
        if (avatarUrlByClientId.has(clientId)) return

        const idx = hashToInt(clientId) % avatarFiles.length
        const fileName = avatarFiles[idx]
        if (!fileName) return

        const rawPathOrUrl = `messagerie/${fileName}`
        const raw = String(rawPathOrUrl).trim()
        const isHttp = /^https?:\/\//i.test(raw)
        const internalFromUrl = isHttp ? getStoragePathFromUrl(raw) : null
        const internalPath = internalFromUrl ?? (isHttp ? null : raw)

        if (!internalPath) return

        const { data } = await supabase.storage
          .from(storageBucket)
          .createSignedUrl(normalizeStoragePath(internalPath), 60 * 60)

        const url = data?.signedUrl
        if (url) avatarUrlByClientId.set(clientId, url)
      })
    )
  }

  return (
    <main className="min-h-screen bg-transparent">
      <Container className="py-6 sm:py-10">
        <StickyHeader opaquePageBackdrop>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold tracking-tight text-[#341c44]">Chat client</h1>
              <p className="mt-1 text-sm text-black/60">{ordered.length} conversation(s)</p>
            </div>
            <Link
              href="/dashboard"
              aria-label="Retour dashboard"
              title="Retour dashboard"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-[#341c44] ring-1 ring-black/10 hover:bg-[#f5f5f5]"
            >
              ←
            </Link>
          </div>
        </StickyHeader>

        <div className="mt-5 grid gap-3 pt-2">
          {ordered.length > 0 ? (
            ordered.map((c, idx) => {
              const clientName = c.client?.full_name ?? 'Client'
              const programName = fakeProgramName(c.client_id)
              const last = lastByConversation.get(c.id)
              const h = hashToInt(c.id)

              const lastDate = (() => {
                if (idx < 2) {
                  const baseIso = last?.created_at ?? new Date().toISOString()
                  const offsetMin = (h % 50) + idx * 37
                  return formatTimeOnly(shiftIsoByMinutes(baseIso, -offsetMin))
                }

                const days = idx - 1
                return `${days} jour${days > 1 ? 's' : ''}`
              })()
              const lastPreview = last?.body ?? ''
              return (
                <Link
                  key={c.id}
                  href={`/dashboard/chat/${c.id}`}
                  className="block"
                >
                  <Card className="flex h-[78px] items-center overflow-hidden p-3 shadow-none ring-1 ring-black/10 sm:h-[86px] sm:p-4">
                    <div className="grid w-full grid-cols-[44px_minmax(0,1fr)_2.75rem] items-start gap-3">
                      {(() => {
                        const avatarUrl = avatarUrlByClientId.get(c.client_id)
                        return avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt=""
                            className="h-11 w-11 rounded-2xl object-cover ring-1 ring-black/10"
                            loading="lazy"
                          />
                        ) : (
                          <div className="h-11 w-11 rounded-2xl bg-black/5 ring-1 ring-black/10" />
                        )
                      })()}

                      <div className="min-w-0">
                        <div className="truncate text-sm font-extrabold text-[#341c44]">{clientName}</div>
                        <div className="mt-0.5 truncate text-xs font-semibold leading-4 text-black/50">{programName}</div>
                        {lastPreview ? (
                          <div className="mt-0.5 truncate text-[11px] font-semibold leading-4 text-black/50">{lastPreview}</div>
                        ) : null}
                      </div>

                      {lastDate ? (
                        <div className="pt-0.5 text-left text-xs font-semibold tabular-nums text-black/40">{lastDate}</div>
                      ) : null}
                    </div>
                  </Card>
                </Link>
              )
            })
          ) : (
            <Card>
              <div className="text-sm text-black/60">Aucune conversation.</div>
            </Card>
          )}
        </div>
      </Container>
    </main>
  )
}
