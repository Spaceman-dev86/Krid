'use client'

import { useEffect, useRef, useState, useTransition } from 'react'

import { removeSpecImage, saveSpecBlock, uploadSpecImage } from '../../app/admin/spec/actions'
import type { SpecBlock } from '../../lib/spec-workspace/types'
import { CritiqueAside } from './CritiqueAside'
import { markSpecClean, markSpecDirty } from './SpecShell'

type Props = {
  sectionId: string
  blockId: string
  title: string
  route?: string
  initial: SpecBlock
  /** Nested inside PageShellCard — lighter chrome */
  embedded?: boolean
}

export function EditableBlock({ sectionId, blockId, title, route, initial, embedded }: Props) {
  const editorRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const dirtyRef = useRef(false)
  const [images, setImages] = useState(initial.images)
  const [critiqueHtml, setCritiqueHtml] = useState(initial.critiqueHtml ?? '')
  const [status, setStatus] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const dirtyId = `${sectionId}:block:${blockId}`

  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    el.innerHTML = initial.bodyHtml || '<p></p>'
    setImages(initial.images)
    setCritiqueHtml(initial.critiqueHtml ?? '')
    dirtyRef.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockId])

  const persist = async () => {
    if (!dirtyRef.current) return
    const html = editorRef.current?.innerHTML ?? ''
    const critique =
      (document.querySelector(`[data-block-critique="${blockId}"]`) as HTMLElement | null)?.innerHTML ??
      critiqueHtml
    setError(null)
    setStatus('saving')
    try {
      await saveSpecBlock(sectionId, blockId, html, critique)
      setCritiqueHtml(critique)
      dirtyRef.current = false
      markSpecClean(dirtyId)
      setStatus('saved')
      window.setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), 1500)
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : 'Erreur sauvegarde')
    }
  }

  useEffect(() => {
    const onFlush = () => {
      startTransition(() => {
        void persist()
      })
    }
    window.addEventListener('spec-flush-save', onFlush)
    return () => window.removeEventListener('spec-flush-save', onFlush)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId, blockId])

  function markDirty() {
    dirtyRef.current = true
    setStatus('pending')
    markSpecDirty(dirtyId)
  }

  function handleUpload(file: File) {
    const fd = new FormData()
    fd.set('file', file)
    setError(null)
    setStatus('saving')
    startTransition(async () => {
      try {
        const res = await uploadSpecImage(sectionId, blockId, fd)
        setImages((prev) => [...prev, res.url])
        setStatus('saved')
        window.setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), 1500)
      } catch (e) {
        setStatus('error')
        setError(e instanceof Error ? e.message : 'Erreur upload')
      }
    })
  }

  function handleRemoveImage(url: string) {
    setError(null)
    startTransition(async () => {
      try {
        await removeSpecImage(sectionId, blockId, url)
        setImages((prev) => prev.filter((u) => u !== url))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur suppression')
      }
    })
  }

  const shell = embedded
    ? 'rounded-lg border border-dashed border-[var(--border)] bg-white p-3'
    : 'scroll-mt-28 rounded-[var(--radius-lg)] border border-[var(--border)] bg-white/70 p-5 shadow-sm'

  const statusLabel =
    status === 'saving'
      ? 'Enregistrement…'
      : status === 'pending'
        ? 'Non sauvé'
        : status === 'saved'
          ? 'Enregistré'
          : status === 'error'
            ? 'Erreur'
            : ''

  return (
    <div
      id={embedded ? undefined : blockId}
      className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(200px,260px)] lg:items-start"
    >
      <section className={shell}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3
              className={
                embedded
                  ? 'text-sm font-extrabold tracking-tight text-[color:var(--fg)]'
                  : 'text-lg font-extrabold tracking-tight text-[var(--brand)]'
              }
            >
              {title}
            </h3>
            {!embedded && route ? <code className="mt-1 block text-xs text-[color:var(--muted)]">{route}</code> : null}
            {statusLabel ? <p className="mt-1 text-[10px] font-semibold text-[color:var(--muted)]">{statusLabel}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={pending}
              className="rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--brand)] disabled:opacity-50"
            >
              Ajouter une photo
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) handleUpload(file)
              }}
            />
          </div>
        </div>

        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={markDirty}
          className="prose prose-sm mt-3 max-w-none min-h-[5rem] rounded-lg border border-dashed border-[var(--border)] bg-white px-3 py-2 outline-none focus:border-[var(--brand)] [&_code]:rounded [&_code]:bg-[var(--accent)] [&_code]:px-1 [&_table]:w-full [&_td]:border [&_td]:border-[var(--border)] [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-[var(--border)] [&_th]:px-2 [&_th]:py-1"
        />

        {images.length > 0 ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {images.map((url) => (
              <figure key={url} className="relative overflow-hidden rounded-lg border border-[var(--border)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="max-h-64 w-full object-contain bg-[var(--accent)]/30" />
                <button
                  type="button"
                  onClick={() => handleRemoveImage(url)}
                  disabled={pending}
                  className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[10px] font-semibold text-white"
                >
                  Retirer
                </button>
              </figure>
            ))}
          </div>
        ) : null}

        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </section>

      <CritiqueAside
        entityId={blockId}
        initialHtml={critiqueHtml}
        dataAttr="data-block-critique"
        dataValue={blockId}
        onInput={markDirty}
      />
    </div>
  )
}
