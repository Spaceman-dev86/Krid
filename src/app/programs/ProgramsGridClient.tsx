'use client'

import { createPortal } from 'react-dom'
import { useMemo, useState } from 'react'
import Link from 'next/link'

import { Card, ImagePlaceholder } from '../../components/marketing'

type ProgramItem = {
  id: string
  title: string | null
  level: string | null
  duration: string | null
  description: string | null
  goal: string | null
  image_url: string | null
  weeksCount: number
  sessionsCount: number
}

export default function ProgramsGridClient({
  items,
  defaultImageUrl,
}: {
  items: ProgramItem[]
  defaultImageUrl: string | null
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const active = useMemo(() => items.find((i) => i.id === openId) ?? null, [items, openId])
  const canUseDom = typeof document !== 'undefined'

  function resolveImageUrl(raw: string | null) {
    const v = String(raw ?? '').trim()
    if (v) return v
    const fallback = String(defaultImageUrl ?? '').trim()
    return fallback || null
  }

  function hasDurationLabel(p: { duration: string | null }) {
    return Boolean(String(p.duration ?? '').trim())
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setOpenId(p.id)}
            className="block text-left"
          >
            <Card className="overflow-hidden p-0 transition hover:shadow-md">
              <div className="relative">
                {resolveImageUrl(p.image_url) ? (
                  <img
                    src={resolveImageUrl(p.image_url) ?? ''}
                    alt=""
                    className="h-56 w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <ImagePlaceholder label="Image placeholder · programme" className="h-56 rounded-none" />
                )}

                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                <div className="absolute inset-x-0 bottom-0 p-5">
                  <div className="truncate text-base font-extrabold text-white">{p.title ?? 'Programme'}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-white/85">
                    <div>{p.level ? `Niveau ${p.level}` : 'Niveau —'}</div>
                    <div aria-hidden>·</div>
                    <div>{hasDurationLabel(p) ? p.duration : 'Durée —'}</div>
                    {!hasDurationLabel(p) ? (
                      <>
                        <div aria-hidden>·</div>
                        <div>
                          {p.weeksCount} semaine{p.weeksCount > 1 ? 's' : ''}
                        </div>
                      </>
                    ) : null}
                    <div aria-hidden>·</div>
                    <div>
                      {p.sessionsCount} séance{p.sessionsCount > 1 ? 's' : ''}
                    </div>
                  </div>
                  <div className="mt-3 inline-flex items-center gap-2 text-sm font-extrabold text-white">
                    Découvrir <span aria-hidden>→</span>
                  </div>
                </div>
              </div>
            </Card>
          </button>
        ))}
      </div>

      {canUseDom && active
        ? createPortal(
            <div className="fixed inset-0 z-[9999]">
              <button type="button" className="absolute inset-0 bg-black/30" aria-label="Fermer" onClick={() => setOpenId(null)} />

              <div className="absolute left-1/2 top-10 z-10 w-[min(980px,calc(100vw-2rem))] -translate-x-1/2">
                <Card className="relative overflow-hidden p-0">
                  <div className="relative">
                    {resolveImageUrl(active.image_url) ? (
                      <img src={resolveImageUrl(active.image_url) ?? ''} alt="" className="h-[420px] w-full object-cover" loading="lazy" />
                    ) : (
                      <ImagePlaceholder label="Image placeholder · programme" className="h-[420px] rounded-none" />
                    )}

                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />

                    <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
                      <div className="text-xs font-extrabold uppercase tracking-wide text-white/80">Programme</div>
                      <button
                        type="button"
                        className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-black/30 text-white ring-1 ring-white/20 hover:bg-black/40"
                        onClick={() => setOpenId(null)}
                        aria-label="Fermer"
                        title="Fermer"
                      >
                        ×
                      </button>
                    </div>

                    <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
                      <div className="max-w-2xl">
                        <div className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">{active.title ?? 'Programme'}</div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-white/85">
                          <div>{active.level ? `Niveau ${active.level}` : 'Niveau —'}</div>
                          <div aria-hidden>·</div>
                          <div>{hasDurationLabel(active) ? active.duration : 'Durée —'}</div>
                          {!hasDurationLabel(active) ? (
                            <>
                              <div aria-hidden>·</div>
                              <div>
                                {active.weeksCount} semaine{active.weeksCount > 1 ? 's' : ''}
                              </div>
                            </>
                          ) : null}
                          <div aria-hidden>·</div>
                          <div>
                            {active.sessionsCount} séance{active.sessionsCount > 1 ? 's' : ''}
                          </div>
                        </div>

                        <div className="mt-4 text-sm font-semibold leading-relaxed text-white/90">
                          {active.description ??
                            active.goal ??
                            'Découvre le programme en détail dans l’app. En te connectant, tu recevras une clé d’accès qui te permettra de visualiser le programme complet.'}
                        </div>

                        <div className="mt-5">
                          <div className="inline-flex rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-white ring-1 ring-white/20">
                            Connecte-toi à l’application pour recevoir une clé d’accès. Une fois la clé obtenue, tu pourras consulter le programme complet.
                          </div>
                        </div>

                        <div className="pointer-events-auto mt-6 flex flex-wrap items-center gap-2">
                          <Link
                            href="/login"
                            className="inline-flex h-11 items-center justify-center rounded-2xl bg-white px-5 text-sm font-extrabold text-[#341c44] shadow-sm hover:bg-white/90"
                          >
                            Demander une clé
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 border-t border-black/10 bg-white p-5 sm:p-7">
                    <div className="text-xs font-extrabold uppercase tracking-wide text-[#341c44]/70">À quoi t’attendre</div>
                    <div className="text-sm font-semibold text-black/70">
                      Tu accèdes à une application complète pour suivre tes programmes, consulter la bibliothèque d’exercices, et échanger avec ton coach. La clé te donne accès à la lecture du programme depuis ton espace.
                    </div>
                  </div>
                </Card>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  )
}
