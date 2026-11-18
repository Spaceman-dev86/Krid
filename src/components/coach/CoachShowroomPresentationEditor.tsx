'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { daFieldClass } from '@/src/components/ui'
import {
  autosaveCoachPublicProfileAction,
  clearCoachPublicMediaAction,
  saveCoachPublicMediaAction,
  setCoachShowroomCoverFromLibraryAction,
} from '@/src/app/profile/actions'
import type { ShowroomTestimonial } from '@/src/lib/coach/showroomTestimonials'
import type { MediaLibraryCover } from '@/src/lib/mediaLibrary'
import { CoachCustomRequestBanner } from './CoachCustomRequestBanner'
import { CoverPanEditor } from './CoverPanEditor'
import { ProfileFormSaveBar } from './ProfileFormSaveBar'
import { PhotoCropModal } from './PhotoCropModal'
import { ShowroomAppFeaturesEditor } from './ShowroomAppFeaturesEditor'
import { ShowroomCoverPickerModal } from './ShowroomCoverPickerModal'
import { ShowroomPastillesEditor } from './ShowroomPastillesEditor'
import {
  ShowroomProfilePhonePreview,
  type ShowroomPreviewPresta,
} from './ShowroomProfilePhonePreview'
import { ShowroomTestimonialsEditor } from './ShowroomTestimonialsEditor'

type Props = {
  primaryColor: string
  secondaryColor?: string | null
  themeMode?: string | null
  bgStyle?: string | null
  appName: string
  logoUrl: string | null
  libraryCovers?: MediaLibraryCover[]
  prestations: ShowroomPreviewPresta[]
  initial: {
    public_name: string
    tagline: string
    bio: string
    photo_url: string | null
    cover_url: string | null
    video_url: string
    app_showroom_pitch: string
    app_showroom_features: string[]
    showroom_header_tags: string[]
    showroom_testimonials: ShowroomTestimonial[]
    interest_discuss_title: string
    interest_discuss_body: string
  }
}

/** Présentation showroom : mockup iPhone + champs compacts (style presta). */
export function CoachShowroomPresentationEditor({
  primaryColor,
  secondaryColor,
  themeMode,
  bgStyle,
  appName,
  logoUrl,
  libraryCovers = [],
  prestations,
  initial,
}: Props) {
  const router = useRouter()
  const [publicName, setPublicName] = useState(initial.public_name)
  const [tagline, setTagline] = useState(initial.tagline)
  const [bio, setBio] = useState(initial.bio)
  const [appPitch, setAppPitch] = useState(initial.app_showroom_pitch)
  const [interestTitle, setInterestTitle] = useState(initial.interest_discuss_title)
  const [interestBody, setInterestBody] = useState(initial.interest_discuss_body)
  const [appFeatures, setAppFeatures] = useState(initial.app_showroom_features)
  const [headerTags, setHeaderTags] = useState(initial.showroom_header_tags)
  const [testimonials, setTestimonials] = useState(initial.showroom_testimonials)
  const [photo, setPhoto] = useState(initial.photo_url)
  const [cover, setCover] = useState(initial.cover_url)
  const [videoUrl, setVideoUrl] = useState(initial.video_url)
  const [pending, startTransition] = useTransition()
  const [editPhotoSource, setEditPhotoSource] = useState<string | null>(null)
  const [editCoverSource, setEditCoverSource] = useState<string | null>(null)
  const [coverPickerOpen, setCoverPickerOpen] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const objectUrlRef = useRef<string | null>(null)

  useEffect(() => {
    setPhoto(initial.photo_url)
  }, [initial.photo_url])

  useEffect(() => {
    setCover(initial.cover_url)
  }, [initial.cover_url])

  useEffect(() => {
    setVideoUrl(initial.video_url)
  }, [initial.video_url])

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    }
  }, [])

  function takeObjectUrl(file: File) {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    const url = URL.createObjectURL(file)
    objectUrlRef.current = url
    return url
  }

  function uploadCropped(kind: 'photo' | 'cover', file: File) {
    const preview = URL.createObjectURL(file)
    if (kind === 'photo') {
      setPhoto(preview)
      setEditPhotoSource(null)
    } else {
      setCover(preview)
      setEditCoverSource(null)
    }
    setStatus('Enregistrement…')
    setError(null)
    const fd = new FormData()
    fd.set('kind', kind)
    fd.set('file', file)
    startTransition(async () => {
      const res = await saveCoachPublicMediaAction(fd)
      if (!res.ok) {
        if (kind === 'photo') setPhoto(initial.photo_url)
        else setCover(initial.cover_url)
        setError(res.error)
        setStatus(null)
        return
      }
      if (kind === 'photo') setPhoto(res.imageUrl)
      else setCover(res.imageUrl)
      setStatus(kind === 'photo' ? 'Photo enregistrée' : 'Cover enregistrée')
      router.refresh()
    })
  }

  function removeMedia(kind: 'photo' | 'cover') {
    setStatus('Suppression…')
    setError(null)
    const fd = new FormData()
    fd.set('kind', kind)
    startTransition(async () => {
      const res = await clearCoachPublicMediaAction(fd)
      if (!res.ok) {
        setError(res.error)
        setStatus(null)
        return
      }
      if (kind === 'photo') setPhoto(null)
      else setCover(null)
      setStatus(kind === 'photo' ? 'Photo retirée' : 'Cover retirée')
      router.refresh()
    })
  }

  function pickLibraryCover(item: MediaLibraryCover) {
    setCoverPickerOpen(false)
    setCover(item.publicUrl)
    setStatus('Enregistrement…')
    setError(null)
    const fd = new FormData()
    fd.set('library_id', item.id)
    startTransition(async () => {
      const res = await setCoachShowroomCoverFromLibraryAction(fd)
      if (!res.ok) {
        setCover(initial.cover_url)
        setError(res.error)
        setStatus(null)
        return
      }
      setCover(res.imageUrl)
      setStatus('Cover enregistrée')
      router.refresh()
    })
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-da-sm sm:p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">
          Contenu showroom
        </h2>
        <p className="text-[11px] text-[color:var(--muted)]">
          Aperçu live · offres déjà marquées visibles
        </p>
      </div>

      <div className="mt-3">
        <CoachCustomRequestBanner kind="site" returnTo="/profile" />
      </div>

      <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(240px,280px)_minmax(0,1fr)] lg:items-start">
        <div className="mx-auto w-full max-w-[280px] lg:sticky lg:top-16 lg:z-20 lg:mx-0 lg:self-start">
          <ShowroomProfilePhonePreview
            publicName={publicName}
            tagline={tagline}
            bio={bio}
            photoUrl={photo}
            coverUrl={cover}
            videoUrl={videoUrl}
            headerTags={headerTags}
            testimonials={testimonials}
            appName={appName}
            appTitle={appName}
            appPitch={appPitch}
            appFeatures={appFeatures}
            logoUrl={logoUrl?.trim() || null}
            brandColor={primaryColor}
            secondaryColor={secondaryColor}
            themeMode={themeMode}
            bgStyle={bgStyle}
            interestDiscussTitle={interestTitle}
            interestDiscussBody={interestBody}
            prestations={prestations}
          />
        </div>

        <form id="coach-showroom-presentation-form" className="grid gap-2.5 content-start">
          <input type="hidden" name="return_to" value="/profile" />

          {/* Médias : cover en fond + photo coach par-dessus */}
          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-da-sm">
            <div className="relative min-h-[140px] sm:min-h-[160px]">
              {cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cover}
                  alt=""
                  className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{ background: primaryColor }}
                />
              )}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/15" />

              <div className="relative z-10 flex min-h-[140px] items-end gap-3 px-3 pb-3 pt-10 sm:min-h-[160px]">
                <div className="relative h-16 w-16 shrink-0">
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo}
                      alt=""
                      className="h-16 w-16 rounded-full border-[3px] border-white object-cover shadow-md"
                    />
                  ) : (
                    <div
                      className="flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-white text-lg font-bold text-white shadow-md"
                      style={{ background: primaryColor }}
                    >
                      {(publicName.trim() || appName).slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => photoInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 z-20 rounded-full bg-[var(--surface)] px-1.5 py-0.5 text-[9px] font-bold text-[color:var(--brand)] shadow disabled:opacity-50"
                  >
                    Photo
                  </button>
                </div>
                <div className="min-w-0 flex-1 pb-0.5 text-white">
                  <p className="truncate text-sm font-extrabold drop-shadow-sm">
                    {publicName.trim() || 'Nom public'}
                  </p>
                  {tagline.trim() ? (
                    <p className="truncate text-[11px] text-white/85">{tagline}</p>
                  ) : (
                    <p className="text-[11px] text-white/50">Accroche…</p>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                    {photo ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => removeMedia('photo')}
                        className="text-[10px] font-semibold text-white/80 underline hover:text-white disabled:opacity-50"
                      >
                        Retirer photo
                      </button>
                    ) : null}
                    {cover ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => removeMedia('cover')}
                        className="text-[10px] font-semibold text-white/80 underline hover:text-white disabled:opacity-50"
                      >
                        Retirer cover
                      </button>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setCoverPickerOpen(true)}
                  className="absolute bottom-3 right-3 z-20 rounded-full bg-[var(--surface)] px-2 py-0.5 text-[9px] font-bold text-[color:var(--brand)] shadow disabled:opacity-50"
                >
                  changer cover
                </button>
              </div>
            </div>

            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={pending}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  setEditPhotoSource(takeObjectUrl(file))
                  setError(null)
                }
                e.target.value = ''
              }}
            />
            <input
              ref={coverInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={pending}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  setEditCoverSource(takeObjectUrl(file))
                  setError(null)
                }
                e.target.value = ''
              }}
            />

            {(status || error) && (
              <div className="border-t border-[var(--border)] px-2.5 py-1.5">
                {status ? (
                  <p className="text-[10px] text-[color:var(--muted)]">{status}</p>
                ) : null}
                {error ? (
                  <p className="text-[10px] font-semibold text-[var(--danger)]">{error}</p>
                ) : null}
              </div>
            )}
          </div>

          <ShowroomPastillesEditor
            title="Tag du header"
            fieldName="showroom_header_tags"
            initialTags={initial.showroom_header_tags}
            brandColor={primaryColor}
            compact
            showProgramTags={false}
            onChange={({ customTags }) => setHeaderTags(customTags)}
          />

          <div className="grid gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--accent)]/35 p-2.5">
            <p className="text-xs font-semibold text-[color:var(--fg)]">Vidéo showroom</p>
            <label className="grid gap-0.5 text-sm">
              <span className="text-[11px] font-semibold text-[color:var(--muted)]">URL</span>
              <input
                name="video_url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value.slice(0, 500))}
                placeholder="youtu.be/… ou MP4"
                className={daFieldClass}
              />
            </label>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-0.5 text-sm">
              <span className="text-xs font-semibold text-[color:var(--fg)]">Nom public</span>
              <input
                name="public_name"
                value={publicName}
                onChange={(e) => setPublicName(e.target.value.slice(0, 80))}
                placeholder="Ton nom"
                className={daFieldClass}
              />
            </label>
            <label className="grid gap-0.5 text-sm">
              <span className="text-xs font-semibold text-[color:var(--fg)]">Accroche</span>
              <input
                name="tagline"
                value={tagline}
                onChange={(e) => setTagline(e.target.value.slice(0, 120))}
                placeholder="Coach sport · en ligne"
                className={daFieldClass}
              />
            </label>
          </div>

          <label className="grid gap-0.5 text-sm">
            <span className="text-xs font-semibold text-[color:var(--fg)]">Bio courte</span>
            <textarea
              name="bio"
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 800))}
              placeholder="Qui tu es, pour qui…"
              className={daFieldClass}
            />
          </label>

          <div className="grid gap-2">
            <div className="grid gap-0.5 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                <span className="text-xs font-semibold text-[color:var(--fg)]">Nom de l’app</span>
                <Link
                  href="/profile/mon-app"
                  className="text-[11px] font-semibold text-[color:var(--brand)] hover:underline"
                >
                  Modifier dans Mon app →
                </Link>
              </div>
              <p className="rounded-lg border border-[var(--border)] bg-[var(--accent)]/35 px-3 py-2 text-sm font-semibold text-[color:var(--fg)]">
                {appName.trim() || 'Mon app'}
              </p>
            </div>
            <label className="grid gap-0.5 text-sm">
              <span className="text-xs font-semibold text-[color:var(--fg)]">Texte card app</span>
              <textarea
                name="app_showroom_pitch"
                rows={2}
                value={appPitch}
                onChange={(e) => setAppPitch(e.target.value.slice(0, 600))}
                placeholder="Les programmes vivent dans l’app…"
                className={daFieldClass}
              />
            </label>
          </div>

          <ShowroomAppFeaturesEditor
            initial={initial.app_showroom_features}
            brandColor={primaryColor}
            onChange={setAppFeatures}
          />

          <ShowroomTestimonialsEditor
            initial={initial.showroom_testimonials}
            onChange={setTestimonials}
          />

          <div className="grid gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
            <p
              className="text-xs font-extrabold uppercase tracking-wide"
              style={{ color: primaryColor }}
            >
              Écran « Je suis intéressé »
            </p>
            <p className="text-[11px] text-[color:var(--muted)]">
              Texte vu par le prospect après le bouton bas du showroom.
            </p>
            <label className="grid gap-0.5 text-sm">
              <span className="text-xs font-semibold text-[color:var(--fg)]">Titre</span>
              <input
                name="interest_discuss_title"
                value={interestTitle}
                onChange={(e) => setInterestTitle(e.target.value.slice(0, 120))}
                placeholder="On reste en contact ?"
                className={daFieldClass}
              />
            </label>
            <label className="grid gap-0.5 text-sm">
              <span className="text-xs font-semibold text-[color:var(--fg)]">Texte</span>
              <textarea
                name="interest_discuss_body"
                rows={3}
                value={interestBody}
                onChange={(e) => setInterestBody(e.target.value.slice(0, 600))}
                placeholder="Laisse-moi tes coordonnées…"
                className={daFieldClass}
              />
            </label>
          </div>

          <ProfileFormSaveBar
            formId="coach-showroom-presentation-form"
            saveAction={autosaveCoachPublicProfileAction}
          />
        </form>
      </div>

      {editPhotoSource ? (
        <PhotoCropModal
          source={editPhotoSource}
          onCancel={() => {
            setEditPhotoSource(null)
            setError(null)
          }}
          onConfirm={(file) => uploadCropped('photo', file)}
        />
      ) : null}

      {editCoverSource ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="relative h-[min(70vh,420px)] w-full max-w-3xl overflow-hidden rounded-2xl">
            <CoverPanEditor
              source={editCoverSource}
              onCancel={() => {
                setEditCoverSource(null)
                setError(null)
              }}
              onConfirm={(file) => uploadCropped('cover', file)}
            />
          </div>
        </div>
      ) : null}

      <ShowroomCoverPickerModal
        open={coverPickerOpen}
        covers={libraryCovers}
        pending={pending}
        onClose={() => setCoverPickerOpen(false)}
        onPickLibrary={pickLibraryCover}
        onPickUpload={() => {
          setCoverPickerOpen(false)
          coverInputRef.current?.click()
        }}
      />
    </section>
  )
}
