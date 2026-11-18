'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { AutoGrowTextarea, daFieldClass, daSelectClass } from '@/src/components/ui'
import type { MediaLibraryCover } from '@/src/lib/mediaLibrary'
import {
  includedFromContentLinks,
  mergeShowroomTags,
} from '@/src/lib/prestations/showroomPresentation'
import type { ShowroomWeekOption } from '@/src/lib/prestations/loadShowroomWeekPreview'
import type { ShowroomWeekPreview } from '@/src/lib/prestations/loadShowroomWeekPreview'

import { PrestationShowroomPhonePreview } from './PrestationShowroomPhonePreview'
import { PrestationShowroomTagsEditor } from './PrestationShowroomTagsEditor'
import { ShowroomCoverPickerModal } from './ShowroomCoverPickerModal'

type Props = {
  name: string
  description: string | null
  showroomDescription: string | null
  priceCents: number
  pricingType: string
  photoUrl: string | null
  videoUrl: string | null
  photoIsCover: boolean
  videoRole: 'cover' | 'inline' | null
  eyebrow: string | null
  ctaLabel: string | null
  /** Tags custom (legacy card + popup fusionnés côté page). */
  customTags: string[]
  /** @deprecated — fusionné dans customTags ; gardé pour compat props. */
  popupTags?: string[]
  hiddenProgramTags: string[]
  /** Nombre de tags sur la card (0–6). */
  cardTagCount?: number
  showroomWeekId: string | null
  weekOptions: ShowroomWeekOption[]
  weekPreviewById: Record<string, ShowroomWeekPreview>
  initialProgramIds: string[]
  initialNutritionIds: string[]
  initialDriveIds: string[]
  programTagsById: Record<string, string[]>
  programTitleById: Record<string, string>
  brandColor?: string | null
  secondaryColor?: string | null
  themeMode?: string | null
  bgStyle?: string | null
  appName?: string | null
  logoUrl?: string | null
  libraryCovers?: MediaLibraryCover[]
  /** Header showroom (sync /profile). */
  showroomPublicName?: string | null
  showroomTagline?: string | null
  showroomPhotoUrl?: string | null
  showroomCoverUrl?: string | null
  showroomHeaderTags?: string[]
}

export function PrestationMiseEnFormeEditor({
  name: initialName,
  description: initialDescription,
  showroomDescription: initialShowroomDescription,
  priceCents,
  pricingType,
  photoUrl: savedPhotoUrl,
  videoUrl: initialVideoUrl,
  photoIsCover: initialPhotoIsCover,
  videoRole: initialVideoRole,
  eyebrow: initialEyebrow,
  ctaLabel: initialCta,
  customTags: initialCustomTags,
  hiddenProgramTags: initialHiddenProgramTags,
  cardTagCount: initialCardTagCount = 3,
  showroomWeekId: initialWeekId,
  weekOptions,
  weekPreviewById,
  initialProgramIds,
  initialNutritionIds,
  initialDriveIds,
  programTagsById,
  programTitleById,
  brandColor,
  secondaryColor,
  themeMode,
  bgStyle,
  appName,
  logoUrl,
  libraryCovers = [],
  showroomPublicName,
  showroomTagline,
  showroomPhotoUrl,
  showroomCoverUrl,
  showroomHeaderTags = [],
}: Props) {
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription ?? '')
  const [showroomDescription, setShowroomDescription] = useState(
    initialShowroomDescription ?? '',
  )
  const [videoUrl, setVideoUrl] = useState(initialVideoUrl ?? '')
  const [photoIsCover, setPhotoIsCover] = useState(initialPhotoIsCover)
  const [videoRole, setVideoRole] = useState<'cover' | 'inline'>(
    initialVideoRole === 'cover' ? 'cover' : 'inline',
  )
  const [eyebrow, setEyebrow] = useState(initialEyebrow ?? '')
  const [ctaLabel, setCtaLabel] = useState(initialCta ?? '')
  const [customTags, setCustomTags] = useState(initialCustomTags)
  const [hiddenProgramTags, setHiddenProgramTags] = useState(initialHiddenProgramTags)
  const [cardTagCount, setCardTagCount] = useState(initialCardTagCount)
  const [weekId, setWeekId] = useState(initialWeekId ?? '')
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(savedPhotoUrl)
  const [removePhoto, setRemovePhoto] = useState(false)
  const [photoLibraryId, setPhotoLibraryId] = useState('')
  const [photoPickerOpen, setPhotoPickerOpen] = useState(false)
  const [programIds, setProgramIds] = useState(initialProgramIds)
  const [nutritionIds, setNutritionIds] = useState(initialNutritionIds)
  const [driveIds, setDriveIds] = useState(initialDriveIds)
  const photoInputRef = useRef<HTMLInputElement>(null)

  function bumpFormChange() {
    const form = document.getElementById('prestation-edit-form')
    setTimeout(() => {
      form?.dispatchEvent(new Event('change', { bubbles: true }))
    }, 0)
  }

  const hasVideo = Boolean(videoUrl.trim())
  const coverConflict = photoIsCover && hasVideo && videoRole === 'cover'
  const resolvedVideoRole = hasVideo ? videoRole : null

  // Sync contenu lié (hors inputs contrôlés mise en forme) — change only, pas input
  // (sinon chaque frappe re-render et peut bloquer la saisie).
  useEffect(() => {
    const form = document.getElementById('prestation-edit-form')
    if (!form) return

    const sync = () => {
      const fd = new FormData(form as HTMLFormElement)
      setName(String(fd.get('name') ?? '').trim() || initialName)
      setDescription(String(fd.get('description') ?? ''))
      setProgramIds(
        fd
          .getAll('program_template_ids')
          .map((v) => String(v ?? '').trim())
          .filter(Boolean),
      )
      setNutritionIds(
        fd
          .getAll('nutrition_template_ids')
          .map((v) => String(v ?? '').trim())
          .filter(Boolean),
      )
      setDriveIds(
        fd
          .getAll('drive_folder_ids')
          .map((v) => String(v ?? '').trim())
          .filter(Boolean),
      )
    }

    form.addEventListener('change', sync)
    return () => {
      form.removeEventListener('change', sync)
    }
  }, [initialName])

  useEffect(() => {
    return () => {
      if (previewPhoto?.startsWith('blob:')) URL.revokeObjectURL(previewPhoto)
    }
  }, [previewPhoto])

  useEffect(() => {
    if (!weekId) return
    const opt = weekOptions.find((w) => w.id === weekId)
    if (opt && programIds.length && !programIds.includes(opt.programId)) {
      setWeekId('')
    }
  }, [programIds, weekId, weekOptions])

  const programTags = useMemo(() => {
    const out: string[] = []
    for (const id of programIds) {
      for (const tag of programTagsById[id] ?? []) {
        if (!out.some((t) => t.toLowerCase() === tag.toLowerCase())) out.push(tag)
      }
    }
    return out
  }, [programIds, programTagsById])

  const programTitle =
    programIds.length === 1
      ? programTitleById[programIds[0]!] ?? null
      : programIds.length > 1
        ? `${programIds.length} programmes`
        : null
  const allTags = mergeShowroomTags({
    customTags,
    programTags,
    hiddenProgramTags,
  })
  const cardTags = allTags.slice(0, Math.max(0, Math.min(6, cardTagCount)))
  const popupDisplayTags = allTags
  const included = includedFromContentLinks({
    programTemplateIds: programIds,
    nutritionTemplateIds: nutritionIds,
    driveFolderIds: driveIds,
  })
  const photoForCard = removePhoto ? null : previewPhoto
  const weeksForProgram = useMemo(
    () =>
      weekOptions.filter((w) => !programIds.length || programIds.includes(w.programId)),
    [weekOptions, programIds],
  )
  const weekPreview = weekId ? weekPreviewById[weekId] ?? null : null

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-da-sm sm:p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">
          Mise en forme
        </h2>
        <p className="text-[11px] text-[color:var(--muted)]">
          Clique la carte dans l’iPhone pour ouvrir la fiche
        </p>
      </div>

      <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(240px,280px)_minmax(0,1fr)] lg:items-start">
        <div className="relative z-0 mx-auto w-full max-w-[280px] lg:mx-0">
          <PrestationShowroomPhonePreview
            publicName={showroomPublicName}
            tagline={showroomTagline}
            coachPhotoUrl={showroomPhotoUrl}
            coverUrl={showroomCoverUrl}
            headerTags={showroomHeaderTags}
            appName={appName}
            logoUrl={logoUrl}
            name={name}
            description={description}
            showroomDescription={showroomDescription}
            priceCents={priceCents}
            pricingType={pricingType}
            photoUrl={photoForCard}
            videoUrl={videoUrl}
            photoIsCover={photoIsCover && !coverConflict}
            videoRole={coverConflict ? 'inline' : resolvedVideoRole}
            eyebrow={eyebrow}
            ctaLabel={ctaLabel || 'Découvrir'}
            tags={cardTags}
            popupTags={popupDisplayTags}
            included={included}
            weekPreview={weekPreview}
            brandColor={brandColor}
            secondaryColor={secondaryColor}
            themeMode={themeMode}
            bgStyle={bgStyle}
          />
          {(programTitle || included.length) ? (
            <p className="mt-2 text-center text-[10px] leading-snug text-[color:var(--muted)] lg:text-left">
              {programTitle ? (
                <>
                  <span className="font-semibold text-[color:var(--fg)]">{programTitle}</span>
                  {included.length ? ' · ' : null}
                </>
              ) : null}
              {included.length ? included.map((i) => i.label).join(' · ') : null}
            </p>
          ) : null}
        </div>

        <div className="relative z-20 grid gap-2.5 content-start">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-0.5 text-sm">
              <span className="text-xs font-semibold text-[color:var(--fg)]">Sur-titre</span>
              <input
                name="showroom_eyebrow"
                value={eyebrow}
                onChange={(e) => setEyebrow(e.target.value.slice(0, 40))}
                placeholder="Programme signature"
                className={daFieldClass}
              />
            </label>
            <label className="grid gap-0.5 text-sm">
              <span className="text-xs font-semibold text-[color:var(--fg)]">Bouton</span>
              <input
                name="showroom_cta_label"
                value={ctaLabel}
                onChange={(e) => setCtaLabel(e.target.value.slice(0, 40))}
                placeholder="Découvrir"
                className={daFieldClass}
              />
            </label>
          </div>

          <div className="grid gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--accent)]/35 p-2.5">
            <p className="text-xs font-semibold text-[color:var(--fg)]">Médias</p>

            <div className="grid gap-3 sm:grid-cols-2 sm:items-start">
              <div className="grid gap-1.5">
                <span className="text-[11px] font-semibold text-[color:var(--muted)]">Photo</span>
                <div className="flex items-start gap-2.5">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                    {photoForCard ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photoForCard}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-[color:var(--muted)]">
                        —
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 grid gap-1">
                    <input type="hidden" name="photo_library_id" value={photoLibraryId} />
                    <input
                      ref={photoInputRef}
                      type="file"
                      name="photo"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        setRemovePhoto(false)
                        setPhotoLibraryId('')
                        if (previewPhoto?.startsWith('blob:')) URL.revokeObjectURL(previewPhoto)
                        if (file) setPreviewPhoto(URL.createObjectURL(file))
                        else setPreviewPhoto(savedPhotoUrl)
                        bumpFormChange()
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setPhotoPickerOpen(true)}
                      className="w-fit rounded-full bg-[var(--surface)] px-2 py-0.5 text-[9px] font-bold text-[color:var(--brand)] shadow ring-1 ring-[var(--border)]"
                    >
                      changer photo
                    </button>
                    {photoForCard ? (
                      <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[color:var(--fg)]">
                        <input
                          type="checkbox"
                          name="showroom_photo_is_cover"
                          checked={photoIsCover}
                          onChange={(e) => {
                            const next = e.target.checked
                            setPhotoIsCover(next)
                            if (next && videoRole === 'cover') setVideoRole('inline')
                          }}
                          className="rounded"
                        />
                        Couverture popup
                      </label>
                    ) : (
                      <input type="hidden" name="showroom_photo_is_cover" value="" />
                    )}
                    {savedPhotoUrl || photoLibraryId || previewPhoto ? (
                      <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--danger)]">
                        <input
                          type="checkbox"
                          name="remove_photo"
                          checked={removePhoto}
                          onChange={(e) => {
                            setRemovePhoto(e.target.checked)
                            if (e.target.checked) {
                              if (previewPhoto?.startsWith('blob:')) {
                                URL.revokeObjectURL(previewPhoto)
                              }
                              setPreviewPhoto(null)
                              setPhotoLibraryId('')
                              setPhotoIsCover(false)
                              if (photoInputRef.current) photoInputRef.current.value = ''
                            } else {
                              setPreviewPhoto(savedPhotoUrl)
                            }
                            bumpFormChange()
                          }}
                          className="rounded"
                        />
                        Retirer photo
                      </label>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid gap-1.5">
                <span className="text-[11px] font-semibold text-[color:var(--muted)]">
                  Vidéo (URL)
                </span>
                <input
                  name="video_url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="youtu.be/… ou MP4"
                  className={daFieldClass}
                />
                {hasVideo ? (
                  <div className="grid gap-1">
                    <span className="text-[11px] text-[color:var(--muted)]">Emplacement</span>
                    <div
                      className="inline-flex w-fit items-center gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5 text-[11px]"
                      role="group"
                      aria-label="Emplacement vidéo"
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          const form = e.currentTarget.closest('form')
                          setVideoRole('cover')
                          if (photoIsCover) setPhotoIsCover(false)
                          setTimeout(() => {
                            form?.dispatchEvent(new Event('change', { bubbles: true }))
                          }, 0)
                        }}
                        className={`rounded-md px-2.5 py-1 font-semibold ${
                          videoRole === 'cover'
                            ? 'bg-[var(--brand)] text-[var(--brand-fg)]'
                            : 'text-[color:var(--muted)] hover:text-[color:var(--fg)]'
                        }`}
                      >
                        Cover
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          const form = e.currentTarget.closest('form')
                          setVideoRole('inline')
                          setTimeout(() => {
                            form?.dispatchEvent(new Event('change', { bubbles: true }))
                          }, 0)
                        }}
                        className={`rounded-md px-2.5 py-1 font-semibold ${
                          videoRole === 'inline'
                            ? 'bg-[var(--brand)] text-[var(--brand-fg)]'
                            : 'text-[color:var(--muted)] hover:text-[color:var(--fg)]'
                        }`}
                      >
                        Inline
                      </button>
                      <input type="hidden" name="showroom_video_role" value={videoRole} />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {coverConflict ? (
              <p
                role="alert"
                className="rounded-lg border border-[var(--danger-border)] bg-[var(--danger-bg)] px-2 py-1 text-[11px] font-semibold text-[var(--danger)]"
              >
                Une seule couverture : photo ou vidéo, pas les deux.
              </p>
            ) : null}
          </div>

          <label className="grid gap-0.5 text-sm">
            <span className="text-xs font-semibold text-[color:var(--fg)]">
              Note popup
              <span className="ml-1 font-normal text-[color:var(--muted)]">
                · en plus de la description « Ta vitrine »
              </span>
            </span>
            <AutoGrowTextarea
              name="showroom_description"
              minRows={2}
              value={showroomDescription}
              onChange={(e) => setShowroomDescription(e.target.value.slice(0, 1200))}
              placeholder="Note complémentaire (optionnel)"
              className={daFieldClass}
            />
          </label>

          <PrestationShowroomTagsEditor
            initialCustomTags={initialCustomTags}
            programTags={programTags}
            initialHiddenProgramTags={initialHiddenProgramTags}
            initialCardCount={initialCardTagCount}
            brandColor={brandColor}
            onChange={({ customTags: nextCustom, hiddenProgramTags: nextHidden, cardCount }) => {
              setCustomTags(nextCustom)
              setHiddenProgramTags(nextHidden)
              setCardTagCount(cardCount)
            }}
          />

          <label className="grid gap-0.5 text-sm">
            <span className="text-xs font-semibold text-[color:var(--fg)]">
              Aperçu semaine
              {!programIds.length ? (
                <span className="ml-1 font-normal text-[color:var(--muted)]">
                  · lie un programme d’abord
                </span>
              ) : null}
            </span>
            <select
              name="showroom_week_id"
              value={weekId}
              onChange={(e) => setWeekId(e.target.value)}
              className={daSelectClass}
              disabled={!programIds.length || !weeksForProgram.length}
            >
              <option value="">Aucune</option>
              {weeksForProgram.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.title}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <ShowroomCoverPickerModal
        open={photoPickerOpen}
        covers={libraryCovers}
        title="Changer photo"
        uploadLabel="Importer mon image…"
        onClose={() => setPhotoPickerOpen(false)}
        onPickLibrary={(item) => {
          setPhotoPickerOpen(false)
          setRemovePhoto(false)
          setPhotoLibraryId(item.id)
          if (previewPhoto?.startsWith('blob:')) URL.revokeObjectURL(previewPhoto)
          setPreviewPhoto(item.publicUrl)
          if (!photoIsCover) setPhotoIsCover(true)
          if (photoInputRef.current) photoInputRef.current.value = ''
          bumpFormChange()
        }}
        onPickUpload={() => {
          setPhotoPickerOpen(false)
          photoInputRef.current?.click()
        }}
      />
    </section>
  )
}
