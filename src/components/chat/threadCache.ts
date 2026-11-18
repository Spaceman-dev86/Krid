import type { CoachThreadBundle } from '@/src/app/chat/threadActions'
import { loadCoachThreadBundleAction } from '@/src/app/chat/threadActions'

type CacheEntry = {
  data: CoachThreadBundle
  at: number
}

const TTL_MS = 90_000
const store = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<CoachThreadBundle | { ok: false; error: string }>>()

export function peekThreadCache(threadId: string): CoachThreadBundle | null {
  const hit = store.get(threadId)
  if (!hit) return null
  if (Date.now() - hit.at > TTL_MS) {
    store.delete(threadId)
    return null
  }
  return hit.data
}

export function putThreadCache(data: CoachThreadBundle) {
  store.set(data.threadId, { data, at: Date.now() })
}

export function invalidateThreadCache(threadId: string) {
  store.delete(threadId)
}

/** Prefetch / load avec dédup. Remplit le cache mémoire. */
export async function fetchThreadBundle(
  threadId: string,
  opts?: { force?: boolean }
): Promise<CoachThreadBundle | { ok: false; error: string }> {
  if (!opts?.force) {
    const cached = peekThreadCache(threadId)
    if (cached) return cached
  }

  const existing = inflight.get(threadId)
  if (existing && !opts?.force) return existing

  const promise = loadCoachThreadBundleAction(threadId).then((res) => {
    if (res.ok) putThreadCache(res)
    return res
  })
  inflight.set(threadId, promise)
  try {
    return await promise
  } finally {
    inflight.delete(threadId)
  }
}

export function prefetchThreadBundle(threadId: string) {
  if (peekThreadCache(threadId) || inflight.has(threadId)) return
  void fetchThreadBundle(threadId)
}
