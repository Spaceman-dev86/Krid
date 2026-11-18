'use client'

import { useRef, useState, useTransition } from 'react'

import { Button, IconClose } from '@/src/components/ui'
import { isPngOrGifMedia, normalizeStoragePath } from '@/src/lib/exerciseMedia'
import { createClient } from '@/src/lib/supabase/client'

const BUCKET = 'exercise-media'
const MAX_BYTES = 12 * 1024 * 1024
const ACCEPT = 'image/png,image/jpeg,image/gif,image/webp'

type Props = {
  coachId: string
  exerciseId?: string | null
  initialPath?: string | null
  initialSignedUrl?: string | null
}

function safeFileName(name: string) {
  return name
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 80)
}

export function CoachExerciseDemoMediaField({
  coachId,
  exerciseId,
  initialPath = null,
  initialSignedUrl = null,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [path, setPath] = useState(initialPath ?? '')
  const [previewUrl, setPreviewUrl] = useState(initialSignedUrl ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const ownsFile = path.startsWith(`${coachId}/`)

  function clearMedia() {
    startTransition(async () => {
      setError(null)
      if (ownsFile && path) {
        const supabase = createClient()
        await supabase.storage.from(BUCKET).remove([normalizeStoragePath(path, BUCKET)])
      }
      setPath('')
      setPreviewUrl('')
      if (inputRef.current) inputRef.current.value = ''
    })
  }

  function onPick(file: File | null) {
    if (!file) return
    if (!ACCEPT.split(',').includes(file.type)) {
      setError('Formats : PNG, JPG, GIF ou WebP')
      return
    }
    if (file.size > MAX_BYTES) {
      setError('Fichier trop lourd (max 12 Mo)')
      return
    }

    startTransition(async () => {
      setError(null)
      const supabase = createClient()
      const stamp = Date.now()
      const folder = exerciseId?.trim() || 'new'
      const storagePath = `${coachId}/${folder}/${stamp}-${safeFileName(file.name)}`

      const { error: upErr } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
        upsert: false,
        contentType: file.type,
      })
      if (upErr) {
        setError(upErr.message || 'Upload impossible')
        return
      }

      // Remplace l’ancien média perso si besoin
      if (ownsFile && path && path !== storagePath) {
        await supabase.storage.from(BUCKET).remove([normalizeStoragePath(path, BUCKET)])
      }

      const { data } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(normalizeStoragePath(storagePath, BUCKET), 60 * 60)

      setPath(storagePath)
      setPreviewUrl(data?.signedUrl ?? URL.createObjectURL(file))
    })
  }

  return (
    <div className="grid gap-2">
      <input type="hidden" name="demo_media_path" value={path} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-[color:var(--muted)]">Média démo</span>
        <span className="text-[11px] text-[color:var(--muted)]">PNG / JPG / GIF · max 12 Mo</span>
      </div>

      {previewUrl ? (
        <div className="relative overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--page-bg)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Aperçu média"
            className={
              isPngOrGifMedia(path || previewUrl)
                ? 'mx-auto max-h-56 w-full object-contain p-2'
                : 'h-48 w-full object-cover'
            }
          />
          <div className="absolute right-2 top-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="!rounded-full !px-2 !py-1"
              onClick={clearMedia}
              disabled={pending}
              aria-label="Supprimer le média"
            >
              <IconClose size={14} />
            </Button>
          </div>
        </div>
      ) : (
        <p className="rounded-[var(--radius-sm)] border border-dashed border-[var(--border)] px-3 py-4 text-center text-xs text-[color:var(--muted)]">
          Aucun média — utile pour montrer le mouvement à tes clients.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="!rounded-lg"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
        >
          {previewUrl ? 'Remplacer' : 'Ajouter un média'}
        </Button>
        {previewUrl ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={clearMedia}
          >
            Supprimer
          </Button>
        ) : null}
      </div>
      {error ? <p className="text-xs font-semibold text-[var(--danger)]">{error}</p> : null}
      {pending ? (
        <p className="text-[11px] text-[color:var(--muted)]">Traitement du média…</p>
      ) : null}
    </div>
  )
}
