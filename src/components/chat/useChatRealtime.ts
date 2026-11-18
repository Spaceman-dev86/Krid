'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import type { ChatMediaKind, ChatMessageRow } from '../../lib/chat/chat'
import { createClient } from '../../lib/supabase/client'

type PgMessage = {
  id?: string
  thread_id?: string
  sender_id?: string
  body?: string | null
  created_at?: string
  reply_to_id?: string | null
  forwarded_from_id?: string | null
  media_kind?: string | null
  media_path?: string | null
  media_mime?: string | null
  media_name?: string | null
  media_bytes?: number | null
  media_duration_ms?: number | null
  tag?: string | null
  pinned_at?: string | null
  deleted_at?: string | null
}

function rowFromPg(row: PgMessage): ChatMessageRow | null {
  if (!row?.id || !row.thread_id || !row.sender_id || !row.created_at) return null
  if (row.deleted_at) return null
  return {
    id: row.id,
    thread_id: row.thread_id,
    sender_id: row.sender_id,
    body: String(row.body ?? ''),
    created_at: row.created_at,
    reply_to_id: row.reply_to_id ?? null,
    forwarded_from_id: row.forwarded_from_id ?? null,
    media_kind: (row.media_kind as ChatMediaKind | null) ?? null,
    media_path: row.media_path ?? null,
    media_mime: row.media_mime ?? null,
    media_name: row.media_name ?? null,
    media_bytes: row.media_bytes ?? null,
    media_duration_ms: row.media_duration_ms ?? null,
    tag: row.tag ?? null,
    pinned_at: row.pinned_at ?? null,
    reactions: [],
  }
}

/** Realtime messages + typing / read (broadcast). Ne touche pas à la session auth. */
export function useChatRealtime(
  threadId: string,
  currentUserId: string,
  onRefresh?: () => void,
  onPeerRead?: (at: string) => void,
  onPeerMessage?: (msg: ChatMessageRow) => void
) {
  const router = useRouter()
  const [peerTyping, setPeerTyping] = useState(false)
  const [onlineCount, setOnlineCount] = useState(0)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onRefreshRef = useRef(onRefresh)
  const onPeerReadRef = useRef(onPeerRead)
  const onPeerMessageRef = useRef(onPeerMessage)
  onRefreshRef.current = onRefresh
  onPeerReadRef.current = onPeerRead
  onPeerMessageRef.current = onPeerMessage

  useEffect(() => {
    let cancelled = false
    let supabase: ReturnType<typeof createClient>
    try {
      supabase = createClient()
    } catch {
      return
    }

    function softRefresh(delayMs = 250) {
      if (cancelled) return
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
      refreshTimer.current = setTimeout(() => {
        if (cancelled) return
        if (onRefreshRef.current) onRefreshRef.current()
        else router.refresh()
      }, delayMs)
    }

    const channel = supabase
      .channel(`chat:${threadId}`, {
        config: { presence: { key: currentUserId } },
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_messages', filter: `thread_id=eq.${threadId}` },
        (payload) => {
          if (cancelled) return
          const eventType = (payload as { eventType?: string }).eventType
          const row = (payload as { new?: PgMessage }).new
          const senderId = row?.sender_id
          // Nos inserts : déjà optimistes — pas de refresh immédiat
          if (senderId && senderId === currentUserId) return

          // Affiche tout de suite le message pair (évite 3–5 s de softReload)
          if (eventType === 'INSERT' || !eventType) {
            const mapped = row ? rowFromPg(row) : null
            if (mapped) {
              onPeerMessageRef.current?.(mapped)
              setPeerTyping(false)
            }
          }
          // Sync différé (URLs média signées, replies, reactions)
          softRefresh(eventType === 'DELETE' ? 100 : 280)
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_message_reactions' },
        () => softRefresh(200)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_thread_reads',
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          const row = (payload as { new?: { reader_id?: string; last_read_at?: string } }).new
          // Ignore nos propres reads (markThreadRead à chaque load) — sinon boucle POST infinie
          if (!row?.reader_id || row.reader_id === currentUserId) return
          if (row.last_read_at) onPeerReadRef.current?.(row.last_read_at)
        }
      )
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const uid = (payload as { userId?: string })?.userId
        if (!uid || uid === currentUserId) return
        setPeerTyping(true)
        if (typingTimer.current) clearTimeout(typingTimer.current)
        typingTimer.current = setTimeout(() => setPeerTyping(false), 2200)
      })
      .on('broadcast', { event: 'read' }, ({ payload }) => {
        const uid = (payload as { userId?: string; at?: string })?.userId
        const at = (payload as { userId?: string; at?: string })?.at
        if (!uid || uid === currentUserId || !at) return
        // Ticks bleus en local — pas de softRefresh (évite re-mark + boucle)
        onPeerReadRef.current?.(at)
      })
      .on('presence', { event: 'sync' }, () => {
        try {
          const state = channel.presenceState()
          setOnlineCount(Object.keys(state).length)
        } catch {
          // ignore
        }
      })

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        try {
          await channel.track({ userId: currentUserId, at: Date.now() })
        } catch {
          // ignore presence errors
        }
        // Annonce lecture dès que le canal est prêt (ticks bleus live côté pair)
        void channel.send({
          type: 'broadcast',
          event: 'read',
          payload: { userId: currentUserId, at: new Date().toISOString() },
        })
      }
    })

    channelRef.current = channel

    return () => {
      cancelled = true
      if (typingTimer.current) clearTimeout(typingTimer.current)
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
      void supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [threadId, currentUserId, router])

  const signalTyping = useCallback(() => {
    const ch = channelRef.current
    if (!ch) return
    void ch.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: currentUserId },
    })
  }, [currentUserId])

  /** Annonce lecture au pair (ticks bleus sans refresh manuel). */
  const signalRead = useCallback(() => {
    const ch = channelRef.current
    if (!ch) return
    void ch.send({
      type: 'broadcast',
      event: 'read',
      payload: { userId: currentUserId, at: new Date().toISOString() },
    })
  }, [currentUserId])

  return { peerTyping, onlineCount, signalTyping, signalRead }
}
