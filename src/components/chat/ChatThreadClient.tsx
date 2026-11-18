'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { usePathname, useRouter } from 'next/navigation'

import {
  chatDayKey,
  chatDayLabel,
  formatChatTime,
  type ChatMessageRow,
} from '../../lib/chat/chat'
import { DEFAULT_CLIENT_PRIMARY_COLOR } from '../../lib/coach/defaultClientPrimaryColor'
import { IconCaret, IconPlus } from '../ui/icons'
import { ChatAudioBubble } from './ChatAudioBubble'
import { useChatRealtime } from './useChatRealtime'

const URL_IN_TEXT = /(https?:\/\/[^\s]+|\/c\/[^\s]+)/g
const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const

function ChatBodyText({ text, mine, coachUi }: { text: string; mine: boolean; coachUi: boolean }) {
  const parts = text.split(URL_IN_TEXT)
  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null
        const isUrl = /^https?:\/\//.test(part) || part.startsWith('/c/')
        if (!isUrl) return <span key={i}>{part}</span>
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className={`underline underline-offset-2 ${
              mine ? 'text-[var(--brand-fg)]/90' : 'text-[color:var(--brand)]'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        )
      })}
    </>
  )
}

function mediaLabel(kind: string | null | undefined): string {
  if (kind === 'image' || kind === 'gif' || kind === 'sticker') return '📷 Photo'
  if (kind === 'audio') return '🎤 Audio'
  if (kind === 'video') return '🎬 Vidéo'
  if (kind === 'file') return '📎 Document'
  return ''
}

type PendingAttach = {
  file: File
  previewUrl: string | null
  kind: 'image' | 'video' | 'file'
  mediaAs?: 'sticker' | 'gif'
}

type Props = {
  messages: ChatMessageRow[]
  currentUserId: string
  primaryColor?: string
  sendAction: (formData: FormData) => void | Promise<unknown>
  uploadAction?: (formData: FormData) => void | Promise<unknown>
  reactionAction?: (formData: FormData) => void | Promise<void>
  deleteAction?: (formData: FormData) => void | Promise<unknown>
  pinAction?: (formData: FormData) => void | Promise<unknown>
  forwardAction?: (formData: FormData) => void | Promise<void>
  saveDriveAction?: (formData: FormData) => void | Promise<void>
  threadId: string
  hiddenFields?: Record<string, string>
  draft?: string
  variant?: 'coach' | 'portal'
  mediaUrls?: Record<string, string>
  senderNames?: Record<string, string>
  /** Peer last_read_at ISO — double coche bleue si message vu */
  peerLastReadAt?: string | null
  threadSearch?: string
  mediaFilter?: 'all' | 'image' | 'video' | 'file'
  forwardTargets?: Array<{ threadId: string; title: string }>
  /** Candidats @mention (label = prénom/nom) */
  mentionCandidates?: Array<{ id: string; label: string }>
  /** Client archivé (coach) — pas d’envoi */
  readOnly?: boolean
  readOnlyReason?: string | null
  jumpToMessageId?: string | null
  onJumpHandled?: () => void
  /** Preferé à router.refresh() pour éviter un re-SSR layout lourd */
  onMessagesRefresh?: () => void
}

export function ChatThreadClient({
  messages,
  currentUserId,
  primaryColor = DEFAULT_CLIENT_PRIMARY_COLOR,
  sendAction,
  uploadAction,
  reactionAction,
  deleteAction,
  pinAction,
  forwardAction,
  saveDriveAction,
  threadId,
  hiddenFields,
  draft = '',
  variant = 'portal',
  mediaUrls = {},
  senderNames = {},
  peerLastReadAt = null,
  threadSearch = '',
  mediaFilter = 'all',
  forwardTargets = [],
  mentionCandidates = [],
  readOnly = false,
  readOnlyReason = null,
  jumpToMessageId = null,
  onJumpHandled,
  onMessagesRefresh,
}: Props) {
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const formRef = useRef<HTMLFormElement | null>(null)
  const attachRef = useRef<HTMLDivElement | null>(null)
  const [body, setBody] = useState(draft)
  const [replyTo, setReplyTo] = useState<ChatMessageRow | null>(null)
  const [attachOpen, setAttachOpen] = useState(false)
  const [pending, setPending] = useState<PendingAttach | null>(null)
  const [recording, setRecording] = useState(false)
  const [keyboardPad, setKeyboardPad] = useState(0)
  const [menuMsgId, setMenuMsgId] = useState<string | null>(null)
  const [reactMsgId, setReactMsgId] = useState<string | null>(null)
  const [forwardMsgId, setForwardMsgId] = useState<string | null>(null)
  const [deleteMsgId, setDeleteMsgId] = useState<string | null>(null)
  const [emojiMore, setEmojiMore] = useState(false)
  const [sending, setSending] = useState(false)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [optimistic, setOptimistic] = useState<ChatMessageRow[]>([])
  const [localMediaUrls, setLocalMediaUrls] = useState<Record<string, string>>({})
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [livePeerReadAt, setLivePeerReadAt] = useState(peerLastReadAt)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recordStartedAt = useRef(0)
  const router = useRouter()
  const pathname = usePathname()
  const cleanedDraft = useRef(false)
  /** À l’ouverture d’un fil (popup / switch) : forcer le bas même si scrollTop=0. */
  const pinBottomOnOpen = useRef(true)
  const coachUi = variant === 'coach'
  const softReload = useCallback(() => {
    if (onMessagesRefresh) onMessagesRefresh()
    else router.refresh()
  }, [onMessagesRefresh, router])

  useEffect(() => {
    pinBottomOnOpen.current = true
  }, [threadId])

  useEffect(() => {
    setLivePeerReadAt(peerLastReadAt)
  }, [peerLastReadAt, threadId])

  const onPeerRead = useCallback((at: string) => {
    setLivePeerReadAt((prev) => {
      if (!prev) return at
      return new Date(at).getTime() >= new Date(prev).getTime() ? at : prev
    })
  }, [])

  const onPeerMessage = useCallback(
    (msg: ChatMessageRow) => {
      if (msg.thread_id !== threadId || msg.sender_id === currentUserId) return
      setOptimistic((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev
        return [...prev, msg]
      })
    },
    [threadId, currentUserId]
  )

  const { peerTyping, signalTyping, signalRead } = useChatRealtime(
    threadId,
    currentUserId,
    softReload,
    onPeerRead,
    onPeerMessage
  )

  // Re-annonce « lu » quand un message du pair arrive (sans softRefresh)
  const lastMsgId = messages[messages.length - 1]?.id
  const lastMsgSender = messages[messages.length - 1]?.sender_id
  useEffect(() => {
    if (!lastMsgId || lastMsgSender === currentUserId) return
    const t = window.setTimeout(() => signalRead(), 500)
    return () => window.clearTimeout(t)
  }, [lastMsgId, lastMsgSender, currentUserId, signalRead])

  // Drop optimistic bubbles once SSR/realtime a rattrapé
  useEffect(() => {
    if (!optimistic.length) return
    setOptimistic((prev) => {
      const keep: ChatMessageRow[] = []
      const dropIds: string[] = []
      for (const o of prev) {
        const matched = messages.some(
          (m) =>
            m.id === o.id ||
            (m.sender_id === o.sender_id &&
              ((o.body && m.body === o.body) ||
                (o.media_kind && m.media_kind === o.media_kind && m.sender_id === o.sender_id)) &&
              Math.abs(new Date(m.created_at).getTime() - new Date(o.created_at).getTime()) < 120_000)
        )
        if (matched) dropIds.push(o.id)
        else keep.push(o)
      }
      if (dropIds.length) {
        setLocalMediaUrls((urls) => {
          const next = { ...urls }
          for (const id of dropIds) {
            const key = `local:${id}`
            const u = next[key]
            if (u?.startsWith('blob:')) URL.revokeObjectURL(u)
            delete next[key]
          }
          return next
        })
      }
      return keep
    })
  }, [messages, optimistic.length])

  useEffect(() => {
    setOptimistic([])
    setLocalMediaUrls({})
  }, [threadId])

  const mergedMessages = useMemo(() => {
    if (!optimistic.length) return messages
    const ids = new Set(messages.map((m) => m.id))
    return [...messages, ...optimistic.filter((o) => !ids.has(o.id))]
  }, [messages, optimistic])

  const resolvedMediaUrls = useMemo(
    () => ({ ...mediaUrls, ...localMediaUrls }),
    [mediaUrls, localMediaUrls]
  )

  const filtered = useMemo(() => {
    const q = threadSearch.trim().toLowerCase()
    return mergedMessages.filter((m) => {
      if (mediaFilter === 'image') {
        if (!(m.media_kind === 'image' || m.media_kind === 'gif' || m.media_kind === 'sticker')) {
          return false
        }
      } else if (mediaFilter === 'video') {
        if (m.media_kind !== 'video') return false
      } else if (mediaFilter === 'file') {
        if (m.media_kind !== 'file') return false
      }
      if (!q) return true
      return (
        m.body.toLowerCase().includes(q) ||
        (m.media_name ?? '').toLowerCase().includes(q) ||
        (senderNames[m.sender_id] ?? '').toLowerCase().includes(q)
      )
    })
  }, [mergedMessages, threadSearch, senderNames, mediaFilter])

  const blocks = useMemo(() => {
    const out: Array<
      | { kind: 'day'; key: string; label: string }
      | { kind: 'msg'; key: string; message: ChatMessageRow }
    > = []
    let lastDay = ''
    for (const m of filtered) {
      const day = chatDayKey(m.created_at)
      if (day !== lastDay) {
        lastDay = day
        out.push({ kind: 'day', key: `day-${day}`, label: chatDayLabel(m.created_at) })
      }
      out.push({ kind: 'msg', key: m.id, message: m })
    }
    return out
  }, [filtered])

  // Ouverture → bas immédiat ; ensuite auto-scroll seulement si déjà près du bas
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (mergedMessages.length === 0) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    const jump = pinBottomOnOpen.current
    if (!jump && !nearBottom) return
    pinBottomOnOpen.current = false
    const goBottom = () => {
      el.scrollTop = el.scrollHeight
    }
    // Double rAF : hauteur modal / layout stable avant le jump
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(goBottom)
    })
    return () => cancelAnimationFrame(id)
  }, [mergedMessages.length, replyTo?.id, pending?.file.name, threadId])

  // Trackpad / molette : forcer le scroll sur le fil (overflow:hidden des parents Windows)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    function onWheel(e: WheelEvent) {
      if (!el) return
      if (el.scrollHeight <= el.clientHeight + 1) return
      const nested = (e.target as HTMLElement | null)?.closest?.(
        'textarea, select, [data-scroll-nest], .coach-chat__composer'
      )
      if (nested && nested !== el) return
      const next = el.scrollTop + e.deltaY
      const max = el.scrollHeight - el.clientHeight
      if (next <= 0 && el.scrollTop <= 0) return
      if (next >= max && el.scrollTop >= max - 1) return
      el.scrollTop = Math.max(0, Math.min(max, next))
      e.preventDefault()
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [threadId])

  useEffect(() => {
    if (!draft || cleanedDraft.current) return
    cleanedDraft.current = true
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    if (!url.searchParams.has('draft')) return
    url.searchParams.delete('draft')
    router.replace(`${url.pathname}${url.search}${url.hash}` || pathname, { scroll: false })
  }, [draft, pathname, router])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return
    const vv = window.visualViewport
    function sync() {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      setKeyboardPad(inset > 40 ? inset : 0)
    }
    vv.addEventListener('resize', sync)
    vv.addEventListener('scroll', sync)
    sync()
    return () => {
      vv.removeEventListener('resize', sync)
      vv.removeEventListener('scroll', sync)
    }
  }, [])

  useEffect(() => {
    if (!keyboardPad) return
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [keyboardPad])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as HTMLElement | null
      if (!t?.closest?.('[data-msg-chrome]')) {
        setMenuMsgId(null)
        setReactMsgId(null)
        setDeleteMsgId(null)
        setEmojiMore(false)
      }
      if (attachOpen && attachRef.current && !attachRef.current.contains(t as Node)) {
        setAttachOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [attachOpen])

  useEffect(() => {
    if (!highlightId) return
    const t = window.setTimeout(() => setHighlightId(null), 1600)
    return () => window.clearTimeout(t)
  }, [highlightId])

  const mentionMatches = useMemo(() => {
    if (!mentionOpen || !mentionCandidates.length) return []
    const q = mentionQuery.toLowerCase()
    return mentionCandidates
      .filter((c) => !q || c.label.toLowerCase().includes(q))
      .slice(0, 6)
  }, [mentionOpen, mentionQuery, mentionCandidates])

  function jumpToMessage(id: string) {
    const el = scrollRef.current?.querySelector(`[data-msg-id="${id}"]`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlightId(id)
  }

  useEffect(() => {
    if (!jumpToMessageId) return
    const t = window.setTimeout(() => {
      jumpToMessage(jumpToMessageId)
      onJumpHandled?.()
    }, 40)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpToMessageId])

  function resizeTextarea(el: HTMLTextAreaElement | null) {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }

  useEffect(() => {
    resizeTextarea(textareaRef.current)
  }, [body])

  function onBodyChange(value: string) {
    setBody(value)
    signalTyping()
    const cursorAt = value.length
    const before = value.slice(0, cursorAt)
    const at = before.lastIndexOf('@')
    if (at >= 0 && (at === 0 || /\s/.test(before[at - 1] ?? ''))) {
      const q = before.slice(at + 1)
      if (!/\s/.test(q) && mentionCandidates.length) {
        setMentionOpen(true)
        setMentionQuery(q)
        return
      }
    }
    setMentionOpen(false)
    setMentionQuery('')
  }

  const pinnedMsg = useMemo(
    () => messages.find((m) => m.pinned_at) ?? null,
    [messages]
  )

  function insertMention(label: string) {
    const at = body.lastIndexOf('@')
    if (at < 0) {
      setBody((b) => `${b}@${label} `)
    } else {
      setBody((b) => `${b.slice(0, at)}@${label} `)
    }
    setMentionOpen(false)
    setMentionQuery('')
  }

  useEffect(() => {
    return () => {
      if (pending?.previewUrl) URL.revokeObjectURL(pending.previewUrl)
    }
  }, [pending?.previewUrl])

  const stopRecording = useCallback(async () => {
    const rec = mediaRecorderRef.current
    if (!rec) return
    setRecording(false)
    await new Promise<void>((resolve) => {
      rec.onstop = () => resolve()
      rec.stop()
    })
    rec.stream.getTracks().forEach((t) => t.stop())
    mediaRecorderRef.current = null
    const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
    chunksRef.current = []
    if (!uploadAction || blob.size < 200) return
    const durationMs = Date.now() - recordStartedAt.current
    const file = new File([blob], `audio-${Date.now()}.webm`, { type: blob.type })
    const fd = new FormData()
    fd.set('thread_id', threadId)
    fd.set('file', file)
    fd.set('duration_ms', String(durationMs))
    if (replyTo) fd.set('reply_to_id', replyTo.id)
    if (hiddenFields) {
      for (const [k, v] of Object.entries(hiddenFields)) fd.set(k, v)
    }
    setReplyTo(null)
    setSending(true)
    try {
      await uploadAction(fd)
    } finally {
      setSending(false)
    }
  }, [hiddenFields, replyTo, threadId, uploadAction])

  async function startRecording() {
    if (!uploadAction || recording) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      chunksRef.current = []
      rec.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data)
      }
      mediaRecorderRef.current = rec
      recordStartedAt.current = Date.now()
      rec.start()
      setRecording(true)
    } catch {
      // mic denied
    }
  }

  function clearPending() {
    if (pending?.previewUrl) URL.revokeObjectURL(pending.previewUrl)
    setPending(null)
  }

  const pickAsRef = useRef<'sticker' | 'gif' | null>(null)

  function onPickFile(accept: string, mediaAs?: 'sticker' | 'gif') {
    setAttachOpen(false)
    pickAsRef.current = mediaAs ?? null
    if (!fileRef.current) return
    fileRef.current.accept = accept
    fileRef.current.click()
  }

  function onFileChange() {
    const input = fileRef.current
    if (!input?.files?.[0]) return
    const file = input.files[0]
    input.value = ''
    const mime = file.type || ''
    const kind: PendingAttach['kind'] = mime.startsWith('image/')
      ? 'image'
      : mime.startsWith('video/')
        ? 'video'
        : 'file'
    const previewUrl =
      kind === 'image' || kind === 'video' ? URL.createObjectURL(file) : null
    if (pending?.previewUrl) URL.revokeObjectURL(pending.previewUrl)
    const mediaAs =
      pickAsRef.current ??
      (mime === 'image/gif' || file.name.toLowerCase().endsWith('.gif') ? 'gif' : undefined)
    pickAsRef.current = null
    setPending({ file, previewUrl, kind, mediaAs })
  }

  async function submitOutgoing(e?: FormEvent) {
    e?.preventDefault()
    if (sending) return
    const text = body.trim()
    if (!text && !pending) return

    const optimisticId = `opt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const nowIso = new Date().toISOString()
    const pendingSnap = pending
    const replySnap = replyTo

    const optimisticRow: ChatMessageRow = {
      id: optimisticId,
      thread_id: threadId,
      sender_id: currentUserId,
      body: text,
      created_at: nowIso,
      reply_to_id: replySnap?.id ?? null,
      reply: replySnap
        ? {
            id: replySnap.id,
            body: replySnap.body,
            sender_id: replySnap.sender_id,
            media_kind: replySnap.media_kind,
          }
        : null,
      media_kind: pendingSnap
        ? pendingSnap.mediaAs === 'gif'
          ? 'gif'
          : pendingSnap.kind === 'image'
            ? 'image'
            : pendingSnap.kind === 'video'
              ? 'video'
              : 'file'
        : null,
      media_path: pendingSnap?.previewUrl ? `local:${optimisticId}` : null,
      media_name: pendingSnap?.file.name ?? null,
      media_mime: pendingSnap?.file.type ?? null,
      reactions: [],
    }

    if (pendingSnap?.previewUrl) {
      setLocalMediaUrls((u) => ({ ...u, [`local:${optimisticId}`]: pendingSnap.previewUrl! }))
    }
    setOptimistic((prev) => [...prev, optimisticRow])
    setBody('')
    setReplyTo(null)
    // Ne pas revoke le blob : réutilisé par la bulle optimiste
    setPending(null)
    setSending(true)

    try {
      if (pendingSnap && uploadAction) {
        const fd = new FormData()
        fd.set('thread_id', threadId)
        fd.set('file', pendingSnap.file)
        if (text) fd.set('body', text)
        if (pendingSnap.mediaAs) fd.set('media_as', pendingSnap.mediaAs)
        if (replySnap) fd.set('reply_to_id', replySnap.id)
        if (hiddenFields) {
          for (const [k, v] of Object.entries(hiddenFields)) fd.set(k, v)
        }
        await uploadAction(fd)
      } else {
        const fd = new FormData()
        fd.set('thread_id', threadId)
        fd.set('body', text)
        if (replySnap) fd.set('reply_to_id', replySnap.id)
        if (hiddenFields) {
          for (const [k, v] of Object.entries(hiddenFields)) fd.set(k, v)
        }
        await sendAction(fd)
      }
      // Soft reload messages (évite re-SSR layout chat)
      softReload()
    } catch {
      setOptimistic((prev) => prev.filter((m) => m.id !== optimisticId))
      setBody(text)
      if (replySnap) setReplyTo(replySnap)
    } finally {
      setSending(false)
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== 'Enter' || e.shiftKey) return
    // Ordi : Enter envoie ; mobile garde saut de ligne (clavier soft)
    const fine = typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches
    if (!fine) return
    e.preventDefault()
    void submitOutgoing()
  }

  function isReadByPeer(m: ChatMessageRow): boolean {
    if (!livePeerReadAt || m.sender_id !== currentUserId) return false
    return new Date(m.created_at).getTime() <= new Date(livePeerReadAt).getTime()
  }

  /** 1 swoosh = envoi · 2 = reçu (persisté) · 2 colorés = lu. */
  function deliveryStatus(m: ChatMessageRow): 'sending' | 'delivered' | 'read' {
    if (m.id.startsWith('opt-')) return 'sending'
    if (isReadByPeer(m)) return 'read'
    return 'delivered'
  }

  return (
    <div
      className="coach-chat__thread flex min-h-0 flex-1 flex-col"
      style={keyboardPad > 0 ? { paddingBottom: keyboardPad } : undefined}
    >
      {pinnedMsg ? (
        <button
          type="button"
          onClick={() => jumpToMessage(pinnedMsg.id)}
          className="flex shrink-0 items-start gap-2 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--brand)_10%,var(--surface))] px-3 py-2 text-left"
        >
          <span className="text-xs" aria-hidden>
            📌
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-bold uppercase tracking-wide text-[color:var(--brand)]">
              Message épinglé
            </span>
            <span className="line-clamp-1 text-xs text-[color:var(--fg)]">
              {pinnedMsg.media_kind
                ? mediaLabel(pinnedMsg.media_kind)
                : pinnedMsg.body || '…'}
            </span>
          </span>
        </button>
      ) : null}

      <div
        ref={scrollRef}
        className="coach-chat__thread-scroll min-h-0 flex-1 space-y-1.5 px-3 py-3 sm:px-4"
      >
        {!filtered.length ? (
          <p className="py-10 text-center text-sm text-[color:var(--muted)]">
            {threadSearch || mediaFilter !== 'all'
              ? 'Aucun message pour ce filtre.'
              : 'Écris le premier message.'}
          </p>
        ) : (
          blocks.map((block) => {
            if (block.kind === 'day') {
              return (
                <div key={block.key} className="flex justify-center py-2">
                  <span className="coach-chat__day-pill">{block.label}</span>
                </div>
              )
            }
            const m = block.message
            const mine = m.sender_id === currentUserId
            const mediaUrl = m.media_path ? resolvedMediaUrls[m.media_path] : null
            const replyName = m.reply
              ? senderNames[m.reply.sender_id] ||
                (m.reply.sender_id === currentUserId ? 'Vous' : 'Message')
              : ''
            const replyContent = m.reply
              ? m.reply.media_kind
                ? mediaLabel(m.reply.media_kind)
                : m.reply.body
              : ''
            const menuOpen = menuMsgId === m.id
            const reactOpen = reactMsgId === m.id

            const delivery = mine ? deliveryStatus(m) : null
            return (
              <div
                key={block.key}
                data-msg-id={m.id}
                className={`group/msg relative flex scroll-mt-8 ${mine ? 'justify-end' : 'justify-start'} ${
                  highlightId === m.id ? 'coach-chat__msg-flash' : ''
                }`}
                data-msg-chrome
              >
                <div className="flex max-w-[min(88%,28rem)] items-start gap-1">
                  <div className="relative min-w-0 flex-1">
                    <div
                      className={`relative rounded-2xl px-3 py-1.5 text-sm shadow-da-sm ${
                        mine
                          ? 'rounded-br-md bg-[var(--brand)] text-[var(--brand-fg)]'
                          : 'rounded-bl-md bg-[var(--surface)] text-[color:var(--fg)] ring-1 ring-[var(--border)]'
                      }`}
                      style={
                        !coachUi && mine && primaryColor
                          ? ({ ['--brand']: primaryColor } as CSSProperties)
                          : undefined
                      }
                    >
                      {/* Triangle options (comme builder) */}
                      <button
                        type="button"
                        data-msg-chrome
                        onClick={(e) => {
                          e.stopPropagation()
                          setReactMsgId(null)
                          setDeleteMsgId(null)
                          setMenuMsgId((id) => (id === m.id ? null : m.id))
                        }}
                        className={`absolute right-1.5 top-1.5 z-[1] inline-flex h-5 w-5 items-center justify-center rounded opacity-0 transition group-hover/msg:opacity-100 focus:opacity-100 ${
                          mine ? 'text-[var(--brand-fg)]/75' : 'text-[color:var(--muted)]'
                        }`}
                        aria-label="Options du message"
                      >
                        <IconCaret dir="left" />
                      </button>

                      {m.forwarded_from_id ? (
                        <p
                          className={`mb-1 text-[10px] font-bold italic ${
                            mine ? 'text-[var(--brand-fg)]/65' : 'text-[color:var(--muted)]'
                          }`}
                        >
                          Transféré
                        </p>
                      ) : null}

                      {m.reply ? (
                        <button
                          type="button"
                          onClick={() => jumpToMessage(m.reply!.id)}
                          className={`mb-1.5 w-full rounded-lg border-l-[3px] px-2 py-1 text-left text-[11px] transition hover:brightness-110 ${
                            mine
                              ? 'border-[var(--brand-fg)]/55 bg-[var(--brand-fg)]/12'
                              : 'border-[var(--brand)] bg-[var(--accent)]'
                          }`}
                        >
                          <p
                            className={`font-bold ${
                              mine ? 'text-[var(--brand-fg)]' : 'text-[color:var(--brand)]'
                            }`}
                          >
                            {replyName}
                          </p>
                          <p className="line-clamp-2 opacity-80">{replyContent || '…'}</p>
                        </button>
                      ) : null}

                      {(m.media_kind === 'image' || m.media_kind === 'gif' || m.media_kind === 'sticker') &&
                      mediaUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={mediaUrl}
                          alt={m.media_name || 'Photo'}
                          className="mb-1 max-h-56 w-full rounded-xl object-cover"
                        />
                      ) : null}
                      {m.media_kind === 'video' && mediaUrl ? (
                        <video src={mediaUrl} controls className="mb-1 max-h-56 w-full rounded-xl" />
                      ) : null}
                      {m.media_kind === 'audio' && mediaUrl ? (
                        <ChatAudioBubble
                          src={mediaUrl}
                          durationMs={m.media_duration_ms}
                          mine={mine}
                          coachUi={coachUi}
                          seed={m.id}
                        />
                      ) : null}
                      {m.media_kind === 'file' && mediaUrl ? (
                        <a
                          href={mediaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mb-1 inline-flex items-center gap-1.5 rounded-lg bg-black/10 px-2 py-1 text-xs font-bold underline"
                        >
                          📎 {m.media_name || 'Document'}
                        </a>
                      ) : null}

                      {m.body ? (
                        <p className="whitespace-pre-wrap break-words pr-3">
                          <ChatBodyText text={m.body} mine={mine} coachUi={coachUi} />
                        </p>
                      ) : null}
                      <p
                        className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] ${
                          mine ? 'text-[var(--brand-fg)]/65' : 'text-[color:var(--muted)]'
                        }`}
                      >
                        <span>{formatChatTime(m.created_at)}</span>
                        {delivery ? (
                          <span
                            aria-label={
                              delivery === 'read'
                                ? 'Lu'
                                : delivery === 'delivered'
                                  ? 'Reçu'
                                  : 'Envoi…'
                            }
                            title={
                              delivery === 'read'
                                ? 'Lu'
                                : delivery === 'delivered'
                                  ? 'Reçu'
                                  : 'Envoi…'
                            }
                            className={`font-bold tracking-tighter ${
                              delivery === 'read'
                                ? 'text-[#53bdeb]'
                                : 'text-[var(--brand-fg)]/55'
                            }`}
                          >
                            {delivery === 'sending' ? '✓' : '✓✓'}
                          </span>
                        ) : null}
                      </p>

                      {/* Menu message */}
                      {menuOpen ? (
                        <div
                          data-msg-chrome
                          className={`absolute z-20 w-52 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] py-1 shadow-da-md ${
                            mine ? 'right-0 top-6' : 'left-0 top-6'
                          }`}
                        >
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[color:var(--fg)] hover:bg-[var(--accent)]"
                            onClick={() => {
                              setReplyTo(m)
                              setMenuMsgId(null)
                            }}
                          >
                            <span aria-hidden>↩</span> Répondre
                          </button>
                          {pinAction ? (
                            <form action={pinAction}>
                              <input type="hidden" name="thread_id" value={threadId} />
                              <input type="hidden" name="message_id" value={m.id} />
                              {hiddenFields
                                ? Object.entries(hiddenFields).map(([k, v]) => (
                                    <input key={k} type="hidden" name={k} value={v} />
                                  ))
                                : null}
                              <button
                                type="submit"
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[color:var(--fg)] hover:bg-[var(--accent)]"
                                onClick={() => setMenuMsgId(null)}
                              >
                                <span aria-hidden>📌</span>{' '}
                                {m.pinned_at ? 'Désépingler' : 'Épingler'}
                              </button>
                            </form>
                          ) : null}
                          {forwardAction && forwardTargets.length ? (
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[color:var(--fg)] hover:bg-[var(--accent)]"
                              onClick={() => {
                                setForwardMsgId(m.id)
                                setMenuMsgId(null)
                              }}
                            >
                              <span aria-hidden>↪</span> Transférer
                            </button>
                          ) : null}
                          {saveDriveAction && m.media_path && coachUi ? (
                            <form action={saveDriveAction}>
                              <input type="hidden" name="thread_id" value={threadId} />
                              <input type="hidden" name="message_id" value={m.id} />
                              {hiddenFields
                                ? Object.entries(hiddenFields).map(([k, v]) => (
                                    <input key={k} type="hidden" name={k} value={v} />
                                  ))
                                : null}
                              <button
                                type="submit"
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[color:var(--fg)] hover:bg-[var(--accent)]"
                                onClick={() => setMenuMsgId(null)}
                              >
                                <span aria-hidden>💾</span> Sauver au Drive
                              </button>
                            </form>
                          ) : null}
                          {deleteAction ? (
                            deleteMsgId === m.id ? (
                              <div className="border-t border-[var(--border)] py-1">
                                <p className="px-3 py-1 text-[10px] font-bold uppercase text-[color:var(--muted)]">
                                  Supprimer
                                </p>
                                <form action={deleteAction}>
                                  <input type="hidden" name="thread_id" value={threadId} />
                                  <input type="hidden" name="message_id" value={m.id} />
                                  <input type="hidden" name="scope" value="me" />
                                  {hiddenFields
                                    ? Object.entries(hiddenFields).map(([k, v]) => (
                                        <input key={k} type="hidden" name={k} value={v} />
                                      ))
                                    : null}
                                  <button
                                    type="submit"
                                    className="flex w-full px-3 py-2 text-left text-sm hover:bg-[var(--accent)]"
                                    onClick={() => setMenuMsgId(null)}
                                  >
                                    Effacer pour moi
                                  </button>
                                </form>
                                {mine || coachUi ? (
                                  <form action={deleteAction}>
                                    <input type="hidden" name="thread_id" value={threadId} />
                                    <input type="hidden" name="message_id" value={m.id} />
                                    <input type="hidden" name="scope" value="everyone" />
                                    {hiddenFields
                                      ? Object.entries(hiddenFields).map(([k, v]) => (
                                          <input key={k} type="hidden" name={k} value={v} />
                                        ))
                                      : null}
                                    <button
                                      type="submit"
                                      className="flex w-full px-3 py-2 text-left text-sm text-[color:var(--danger)] hover:bg-[var(--accent)]"
                                      onClick={() => setMenuMsgId(null)}
                                    >
                                      Effacer pour tout le monde
                                    </button>
                                  </form>
                                ) : null}
                                <button
                                  type="button"
                                  className="flex w-full px-3 py-1.5 text-left text-[11px] text-[color:var(--muted)]"
                                  onClick={() => setDeleteMsgId(null)}
                                >
                                  Annuler
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[color:var(--danger)] hover:bg-[var(--accent)]"
                                onClick={() => setDeleteMsgId(m.id)}
                              >
                                <span aria-hidden>🗑</span> Supprimer
                              </button>
                            )
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    {/* Réactions existantes */}
                    <div className="mt-1 flex flex-wrap items-center gap-1 px-0.5">
                      {(m.reactions ?? []).map((r) => (
                        <form key={r.emoji} action={reactionAction}>
                          <input type="hidden" name="thread_id" value={threadId} />
                          <input type="hidden" name="message_id" value={m.id} />
                          <input type="hidden" name="emoji" value={r.emoji} />
                          {hiddenFields
                            ? Object.entries(hiddenFields).map(([k, v]) => (
                                <input key={k} type="hidden" name={k} value={v} />
                              ))
                            : null}
                          <button
                            type="submit"
                            className={`rounded-full px-1.5 py-0.5 text-[11px] ring-1 ${
                              r.mine
                                ? 'bg-[color-mix(in_srgb,var(--brand)_22%,transparent)] ring-[var(--brand)]'
                                : 'bg-[var(--accent)] ring-[var(--border)]'
                            }`}
                          >
                            {r.emoji}
                            {r.count > 1 ? ` ${r.count}` : ''}
                          </button>
                        </form>
                      ))}
                    </div>

                    {/* Barre réactions (photo 4) */}
                    {reactOpen && reactionAction ? (
                      <div
                        data-msg-chrome
                        className={`absolute z-20 ${mine ? 'right-0' : 'left-0'} top-full mt-1`}
                      >
                        <div className="flex items-center gap-0.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-1.5 py-1 shadow-da-md">
                          {QUICK_EMOJIS.map((emoji) => (
                            <form key={emoji} action={reactionAction}>
                              <input type="hidden" name="thread_id" value={threadId} />
                              <input type="hidden" name="message_id" value={m.id} />
                              <input type="hidden" name="emoji" value={emoji} />
                              {hiddenFields
                                ? Object.entries(hiddenFields).map(([k, v]) => (
                                    <input key={k} type="hidden" name={k} value={v} />
                                  ))
                                : null}
                              <button
                                type="submit"
                                className="rounded-full px-1.5 text-base leading-none hover:bg-[var(--accent)]"
                                onClick={() => setReactMsgId(null)}
                              >
                                {emoji}
                              </button>
                            </form>
                          ))}
                          <button
                            type="button"
                            className="rounded-full px-1.5 text-sm font-bold text-[color:var(--fg)] hover:bg-[var(--accent)]"
                            onClick={() => setEmojiMore((v) => !v)}
                            aria-label="Plus d’emojis"
                          >
                            +
                          </button>
                        </div>
                        {emojiMore ? (
                          <div className="mt-1 flex flex-wrap gap-0.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-da-md">
                            {['🔥', '💪', '✅', '🎉', '👀', '🙌', '💯', '🤝'].map((emoji) => (
                              <form key={emoji} action={reactionAction}>
                                <input type="hidden" name="thread_id" value={threadId} />
                                <input type="hidden" name="message_id" value={m.id} />
                                <input type="hidden" name="emoji" value={emoji} />
                                {hiddenFields
                                  ? Object.entries(hiddenFields).map(([k, v]) => (
                                      <input key={k} type="hidden" name={k} value={v} />
                                    ))
                                  : null}
                                <button
                                  type="submit"
                                  className="rounded-full px-1.5 text-base hover:bg-[var(--accent)]"
                                  onClick={() => {
                                    setReactMsgId(null)
                                    setEmojiMore(false)
                                  }}
                                >
                                  {emoji}
                                </button>
                              </form>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  {/* Smiley hors bulle (photo 4) */}
                  {reactionAction ? (
                    <button
                      type="button"
                      data-msg-chrome
                      onClick={(e) => {
                        e.stopPropagation()
                        setMenuMsgId(null)
                        setReactMsgId((id) => (id === m.id ? null : m.id))
                        setEmojiMore(false)
                      }}
                      className="mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm text-[color:var(--muted)] opacity-0 ring-1 ring-[var(--border)] transition hover:bg-[var(--accent)] group-hover/msg:opacity-100 focus:opacity-100"
                      aria-label="Réagir"
                      title="Réagir"
                    >
                      🙂
                    </button>
                  ) : null}
                </div>
              </div>
            )
          })
        )}
        {peerTyping ? (
          <p className="px-2 text-xs italic text-[color:var(--muted)]">écrit…</p>
        ) : null}
        <div ref={bottomRef} />
      </div>

      {readOnly ? (
        <div className="border-t border-[var(--border)] bg-[var(--accent)] px-4 py-3 text-center text-xs font-semibold text-[color:var(--muted)]">
          {readOnlyReason || 'Lecture seule'}
        </div>
      ) : null}

      {!readOnly && replyTo ? (
        <div className="flex items-start gap-2 border-t border-[var(--border)] bg-[var(--accent)] px-3 py-2">
          <div className="min-w-0 flex-1 border-l-[3px] border-[var(--brand)] pl-2">
            <p className="text-[11px] font-bold text-[color:var(--brand)]">
              {senderNames[replyTo.sender_id] ||
                (replyTo.sender_id === currentUserId ? 'Vous' : 'Réponse')}
            </p>
            <p className="truncate text-xs text-[color:var(--muted)]">
              {replyTo.media_kind ? mediaLabel(replyTo.media_kind) : replyTo.body}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setReplyTo(null)}
            className="rounded-full px-2 text-sm font-bold text-[color:var(--muted)]"
            aria-label="Annuler la réponse"
          >
            ×
          </button>
        </div>
      ) : null}

      {!readOnly && pending ? (
        <div className="flex items-center gap-2 border-t border-[var(--border)] bg-[var(--surface)] px-3 py-2">
          {pending.previewUrl && pending.kind === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pending.previewUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
          ) : pending.previewUrl && pending.kind === 'video' ? (
            <video src={pending.previewUrl} className="h-12 w-12 rounded-lg object-cover" muted />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--accent)] text-lg">
              📄
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-[color:var(--fg)]">{pending.file.name}</p>
            <p className="text-[10px] text-[color:var(--muted)]">Ajoute un message puis Envoyer</p>
          </div>
          <button
            type="button"
            onClick={clearPending}
            className="rounded-full px-2 text-sm font-bold text-[color:var(--muted)]"
            aria-label="Retirer le fichier"
          >
            ×
          </button>
        </div>
      ) : null}

      {!readOnly ? (
      <div
        className="coach-chat__composer relative border-t border-[var(--border)] bg-[var(--surface)] px-2 py-2 sm:px-3"
      >
        <form
          ref={formRef}
          onSubmit={(e) => void submitOutgoing(e)}
          className="flex items-center gap-1.5"
        >
          {uploadAction ? (
            <div ref={attachRef} className="relative shrink-0">
              {attachOpen ? (
                <div className="absolute bottom-full left-0 mb-2 grid w-44 gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-2 shadow-da-md">
                  <button
                    type="button"
                    className="rounded-lg px-2 py-1.5 text-left text-xs font-bold hover:bg-[var(--accent)]"
                    onClick={() => onPickFile('image/*,.gif')}
                  >
                    📷 Photo / GIF
                  </button>
                  <button
                    type="button"
                    className="rounded-lg px-2 py-1.5 text-left text-xs font-bold hover:bg-[var(--accent)]"
                    onClick={() => onPickFile('video/*')}
                  >
                    🎬 Vidéo
                  </button>
                  <button
                    type="button"
                    className="rounded-lg px-2 py-1.5 text-left text-xs font-bold hover:bg-[var(--accent)]"
                    onClick={() => onPickFile('.pdf,.doc,.docx,.xls,.xlsx,.txt,application/pdf')}
                  >
                    📄 Document
                  </button>
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => setAttachOpen((v) => !v)}
                className="coach-chat__composer-attach"
                aria-label="Joindre"
                aria-expanded={attachOpen}
              >
                <IconPlus size={20} />
              </button>
              <input ref={fileRef} type="file" className="hidden" onChange={onFileChange} />
            </div>
          ) : null}

          <div className="relative min-w-0 flex-1">
            {mentionMatches.length ? (
              <ul className="absolute bottom-full left-0 right-0 z-20 mb-1 max-h-40 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] py-1 shadow-da-md">
                {mentionMatches.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="flex w-full px-3 py-1.5 text-left text-xs font-bold hover:bg-[var(--accent)]"
                      onClick={() => insertMention(c.label)}
                    >
                      @{c.label}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <textarea
              ref={textareaRef}
              name="body"
              rows={1}
              value={body}
              onChange={(e) => onBodyChange(e.target.value)}
              onKeyDown={onKeyDown}
              autoComplete="off"
              spellCheck={false}
              data-gramm="false"
              data-gramm_editor="false"
              data-enable-grammarly="false"
              placeholder={pending ? 'Légende (optionnel)…' : 'Entrez un message'}
              className="coach-chat__composer-input max-h-40 w-full resize-none overflow-hidden rounded-[1.25rem] border border-[var(--border)] bg-[var(--page-bg)] px-3.5 py-2.5 text-sm leading-5 outline-none focus:ring-2 focus:ring-[var(--brand)]"
            />
          </div>

          {uploadAction && !pending && !body.trim() ? (
            <button
              type="button"
              onClick={() => (recording ? void stopRecording() : void startRecording())}
              disabled={sending}
              className={`inline-flex h-10 w-10 shrink-0 items-center justify-center self-center rounded-full text-base ${
                recording
                  ? 'bg-[var(--danger)] text-[color:var(--page-bg)]'
                  : 'text-[color:var(--fg)] hover:bg-[var(--accent)]'
              }`}
              aria-label={recording ? 'Stop audio' : 'Message vocal'}
            >
              {recording ? '■' : '🎤'}
            </button>
          ) : (
            <button
              type="submit"
              disabled={sending || (!body.trim() && !pending)}
              className="shrink-0 self-center rounded-full bg-[var(--brand)] px-4 py-2.5 text-sm font-bold text-[var(--brand-fg)] shadow-da-sm disabled:opacity-50"
              style={
                !coachUi && primaryColor
                  ? ({ ['--brand']: primaryColor } as CSSProperties)
                  : undefined
              }
            >
              {sending ? '…' : 'Envoyer'}
            </button>
          )}
        </form>
      </div>
      ) : null}

      {forwardMsgId && forwardAction && forwardTargets.length ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-da-md">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-extrabold text-[color:var(--fg)]">Transférer vers…</p>
              <button type="button" className="px-2 text-lg" onClick={() => setForwardMsgId(null)}>
                ×
              </button>
            </div>
            <ul className="max-h-64 space-y-1 overflow-y-auto">
              {forwardTargets.map((t) => (
                <li key={t.threadId}>
                  <form action={forwardAction}>
                    <input type="hidden" name="thread_id" value={threadId} />
                    <input type="hidden" name="message_id" value={forwardMsgId} />
                    <input type="hidden" name="target_thread_id" value={t.threadId} />
                    {hiddenFields
                      ? Object.entries(hiddenFields).map(([k, v]) => (
                          <input key={k} type="hidden" name={k} value={v} />
                        ))
                      : null}
                    <button
                      type="submit"
                      className="w-full rounded-xl px-3 py-2 text-left text-sm font-bold hover:bg-[var(--accent)]"
                      onClick={() => setForwardMsgId(null)}
                    >
                      {t.title}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  )
}
