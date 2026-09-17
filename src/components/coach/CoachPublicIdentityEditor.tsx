'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import {
  clearCoachPublicMediaAction,
  saveCoachPublicMediaAction,
} from '../../app/profile/actions'
import { toEditableObjectUrl } from '../../lib/client/cropImage'
import type { CoachShowroomMediaKind } from '../../lib/coachShowroomStorage'
import { DEFAULT_CLIENT_PRIMARY_COLOR } from '../../lib/coach/defaultClientPrimaryColor'
import { CoverPanEditor } from './CoverPanEditor'
import { PhotoCropModal } from './PhotoCropModal'

type EditJob = {
  kind: CoachShowroomMediaKind
  source: string
}

export function CoachPublicIdentityEditor({
  primaryColor,
  publicName,
  tagline,
  bio,
  photoUrl,
  coverUrl,
  onPublicNameChange,
  onTaglineChange,
  onBioChange,
}: {
  primaryColor: string
  publicName: string
  tagline: string
  bio: string
  photoUrl: string | null
  coverUrl: string | null
  onPublicNameChange: (v: string) => void
  onTaglineChange: (v: string) => void
  onBioChange: (v: string) => void
}) {
  const router = useRouter()
  const [photo, setPhoto] = useState(photoUrl)
  const [cover, setCover] = useState(coverUrl)
  const [pending, startTransition] = useTransition()
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editJob, setEditJob] = useState<EditJob | null>(null)
  const [deleteKind, setDeleteKind] = useState<CoachShowroomMediaKind | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const objectUrlRef = useRef<string | null>(null)

  useEffect(() => {
    setPhoto(photoUrl)
  }, [photoUrl])

  useEffect(() => {
    setCover(coverUrl)
  }, [coverUrl])

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    }
  }, [])

  function startEditFromFile(kind: CoachShowroomMediaKind, file: File) {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    const url = URL.createObjectURL(file)
    objectUrlRef.current = url
    setEditJob({ kind, source: url })
  }

  async function startRecrop(kind: CoachShowroomMediaKind) {
    const url = kind === 'photo' ? photo : cover
    if (!url) {
      if (kind === 'photo') photoInputRef.current?.click()
      else coverInputRef.current?.click()
      return
    }
    setError(null)
    setStatus('Préparation du cadrage…')
    try {
      // Toujours blob local pour canvas + affichage fiable
      const local = await toEditableObjectUrl(url)
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
      if (local.startsWith('blob:')) objectUrlRef.current = local
      setEditJob({ kind, source: local })
      setStatus(null)
    } catch (err) {
      // Dernier recours : URL d’origine (affichage ok, export peut échouer)
      setEditJob({ kind, source: url })
      setStatus(null)
      setError(
        err instanceof Error
          ? `${err.message} — cadrage ouvert en mode limité.`
          : 'Cadrage ouvert en mode limité.'
      )
    }
  }

  function uploadCropped(kind: CoachShowroomMediaKind, file: File) {
    setEditJob(null)
    setError(null)
    setStatus('Enregistrement…')
    const preview = URL.createObjectURL(file)
    if (kind === 'photo') setPhoto(preview)
    else setCover(preview)

    const fd = new FormData()
    fd.set('kind', kind)
    fd.set('file', file)
    startTransition(() => {
      void saveCoachPublicMediaAction(fd).then((res) => {
        if (!res.ok) {
          setError(res.error)
          setStatus(null)
          if (kind === 'photo') setPhoto(photoUrl)
          else setCover(coverUrl)
          return
        }
        if (kind === 'photo') setPhoto(res.imageUrl)
        else setCover(res.imageUrl)
        setStatus('Enregistré')
        router.refresh()
        window.setTimeout(() => setStatus(null), 1500)
      })
    })
  }

  function clearMedia(kind: CoachShowroomMediaKind) {
    setDeleteKind(null)
    setError(null)
    setStatus('Suppression…')
    const fd = new FormData()
    fd.set('kind', kind)
    startTransition(() => {
      void clearCoachPublicMediaAction(fd).then((res) => {
        if (!res.ok) {
          setError(res.error)
          setStatus(null)
          return
        }
        if (kind === 'photo') setPhoto(null)
        else setCover(null)
        setStatus('Enregistré')
        router.refresh()
        window.setTimeout(() => setStatus(null), 1500)
      })
    })
  }

  const displayName = publicName.trim() || 'Nom public'
  // Client-app brand fallback (not Trainly product chrome)
  const brand = primaryColor || DEFAULT_CLIENT_PRIMARY_COLOR
  const editingCover = editJob?.kind === 'cover'
  const editingPhoto = editJob?.kind === 'photo'
  const showBanner = !editingCover

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[color:var(--muted)]">
          Aperçu showroom · glisse directement sur la cover / photo pour recadrer
        </p>
        {status || pending ? (
          <span className="text-xs font-semibold text-[color:var(--muted)]">{status ?? '…'}</span>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-da-sm">
        <div className="relative min-h-[220px] sm:min-h-[260px]">
          {/* Fond showroom — masqué seulement pendant édition photo plein écran */}
          {!editingCover ? (
            <>
              {cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cover}
                  alt=""
                  className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div className="pointer-events-none absolute inset-0" style={{ background: brand }} />
              )}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-black/25 to-black/10" />
            </>
          ) : null}

          {editingCover && editJob ? (
            <CoverPanEditor
              source={editJob.source}
              onCancel={() => {
                setEditJob(null)
                setError(null)
              }}
              onConfirm={(file) => uploadCropped('cover', file)}
            />
          ) : null}

          {showBanner ? (
            <div className="absolute right-3 top-3 z-30 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={pending || editingPhoto}
                onClick={() => coverInputRef.current?.click()}
                className="rounded-md bg-white/95 px-2.5 py-1 text-[11px] font-bold text-[color:var(--brand)] shadow-da-sm hover:bg-[var(--surface)] disabled:opacity-50"
              >
                {cover ? 'Changer cover' : 'Ajouter cover'}
              </button>
              {cover ? (
                <>
                  <button
                    type="button"
                    disabled={pending || editingPhoto}
                    onClick={() => void startRecrop('cover')}
                    className="rounded-md bg-white/95 px-2.5 py-1 text-[11px] font-bold text-[color:var(--brand)] shadow-da-sm hover:bg-[var(--surface)] disabled:opacity-50"
                  >
                    Recadrer
                  </button>
                  <button
                    type="button"
                    disabled={pending || editingPhoto}
                    onClick={() => setDeleteKind('cover')}
                    className="rounded-md bg-white/95 px-2.5 py-1 text-[11px] font-bold text-red-700 shadow-da-sm hover:bg-[var(--surface)] disabled:opacity-50"
                  >
                    Supprimer
                  </button>
                </>
              ) : null}
            </div>
          ) : null}

          {showBanner ? (
            <div className="relative z-10 flex min-h-[220px] flex-col justify-end px-5 pb-5 pt-14 sm:min-h-[260px]">
              <div className="flex flex-wrap items-end gap-4">
                <div className="relative h-20 w-20 shrink-0">
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo}
                      alt=""
                      className="h-20 w-20 rounded-full border-4 border-white object-cover shadow-md"
                    />
                  ) : (
                    <div
                      className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white text-2xl font-bold text-white shadow-md"
                      style={{ background: brand }}
                    >
                      {displayName.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={pending || editingPhoto}
                    onClick={() => photoInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 z-20 rounded-full bg-[var(--surface)] px-2 py-0.5 text-[10px] font-bold text-[color:var(--brand)] shadow"
                  >
                    Photo
                  </button>
                </div>
                <div className="min-w-0 flex-1 pb-1 text-white">
                  <p className="text-2xl font-extrabold tracking-tight drop-shadow-da-sm">{displayName}</p>
                  {tagline.trim() ? (
                    <p className="mt-1 text-sm text-white/85 drop-shadow-da-sm">{tagline}</p>
                  ) : (
                    <p className="mt-1 text-sm text-white/50">Accroche…</p>
                  )}
                </div>
              </div>

              {bio.trim() ? (
                <p className="mt-4 max-w-prose whitespace-pre-wrap text-sm leading-relaxed text-white/90">
                  {bio}
                </p>
              ) : null}

              {photo ? (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={pending || editingPhoto}
                    onClick={() => void startRecrop('photo')}
                    className="rounded-md bg-white/90 px-2 py-1 text-[11px] font-bold text-[color:var(--brand)]"
                  >
                    Recadrer photo
                  </button>
                  <button
                    type="button"
                    disabled={pending || editingPhoto}
                    onClick={() => setDeleteKind('photo')}
                    className="rounded-md bg-white/90 px-2 py-1 text-[11px] font-bold text-red-700"
                  >
                    Supprimer photo
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {editingCover ? <div className="min-h-[220px] sm:min-h-[260px]" aria-hidden /> : null}

          {editingPhoto && editJob ? (
            <PhotoCropModal
              source={editJob.source}
              onCancel={() => {
                setEditJob(null)
                setError(null)
              }}
              onConfirm={(file) => uploadCropped('photo', file)}
            />
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="font-semibold">Nom public</span>
          <input
            name="public_name"
            value={publicName}
            onChange={(e) => onPublicNameChange(e.target.value)}
            placeholder="Remi Coaching"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-semibold">Accroche</span>
          <input
            name="tagline"
            value={tagline}
            onChange={(e) => onTaglineChange(e.target.value)}
            placeholder="Transforme ton corps en 12 semaines"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
          />
        </label>
      </div>
      <label className="grid gap-1 text-sm">
        <span className="font-semibold">Bio</span>
        <textarea
          name="bio"
          rows={4}
          value={bio}
          onChange={(e) => onBioChange(e.target.value)}
          placeholder="Présente ton parcours, ton approche, pour qui tu coaches…"
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
        />
      </label>

      <input
        ref={photoInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) startEditFromFile('photo', file)
        }}
      />
      <input
        ref={coverInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) startEditFromFile('cover', file)
        }}
      />

      {deleteKind ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-media-title"
            className="w-full max-w-sm rounded-2xl bg-[var(--surface)] p-5 shadow-xl"
          >
            <h3 id="delete-media-title" className="text-sm font-extrabold text-[color:var(--brand)]">
              {deleteKind === 'cover' ? 'Supprimer la cover ?' : 'Supprimer la photo ?'}
            </h3>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              Cette action est immédiate. Tu pourras en ajouter une nouvelle ensuite.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteKind(null)}
                disabled={pending}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[color:var(--muted)]"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => clearMedia(deleteKind)}
                disabled={pending}
                className="rounded-lg bg-red-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
