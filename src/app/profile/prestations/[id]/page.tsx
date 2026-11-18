import Link from 'next/link'
import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'

import { AutoGrowTextarea, daFieldClass, daSelectClass } from '@/src/components/ui'
import { CoachQueryFlash } from '../../../../components/coach/CoachQueryFlash'
import { PrestationContentLinksFields } from '../../../../components/coach/PrestationContentLinksFields'
import { PrestationProfileSaveBar } from '../../../../components/coach/PrestationProfileSaveBar'
import { PrestationMiseEnFormeEditor } from '../../../../components/coach/PrestationMiseEnFormeEditor'
import { PrestationPricingFields } from '../../../../components/coach/PrestationPricingFields'
import { ProfileHubHeader } from '../../../../components/coach/ProfileHubHeader'
import { canAccessCoachApp } from '../../../../lib/auth/roles'
import { loadCoachShellContext } from '../../../../lib/coach/loadCoachShellContext'
import { listActiveMediaLibraryCovers } from '../../../../lib/mediaLibrary'
import {
  resolveDriveIds,
  resolveNutritionIds,
  resolveProgramIds,
} from '../../../../lib/prestations/contentLinks'
import { formatPriceCents, parseShowroomTags } from '../../../../lib/prestations/modules'
import {
  loadShowroomWeekOptions,
  loadShowroomWeekPreviews,
} from '../../../../lib/prestations/loadShowroomWeekPreview'
import { programShowroomTags } from '../../../../lib/prestations/showroomPresentation'
import { createClient } from '../../../../lib/supabase/server'
import { archivePrestationAction } from '../../../payments/actions'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }> | { id: string }
  searchParams?:
    | Promise<{ error?: string; saved?: string; created?: string }>
    | { error?: string; saved?: string; created?: string }
}

type PrestaRow = {
  id: string
  name: string
  description: string | null
  pricing_type: string
  price_cents: number
  status: string
  showroom_visible: boolean
  program_template_id: string | null
  nutrition_template_id: string | null
  drive_folder_id: string | null
  program_template_ids?: string[] | null
  nutrition_template_ids?: string[] | null
  drive_folder_ids?: string[] | null
  photo_url?: string | null
  showroom_tags?: unknown
  showroom_popup_tags?: unknown
  video_url?: string | null
  highlight_tag?: string | null
  showroom_description?: string | null
  showroom_week_id?: string | null
  showroom_cta_label?: string | null
  showroom_eyebrow?: string | null
  show_program_tags?: boolean | null
  showroom_hidden_program_tags?: unknown
  showroom_photo_is_cover?: boolean | null
  showroom_video_role?: string | null
}

export default async function ProfilePrestationDetailPage({ params, searchParams }: Props) {
  const { id } = await Promise.resolve(params)
  await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const [shell, { data: raw }, { data: publicProfile }, headerTagsProbe] = await Promise.all([
    loadCoachShellContext(user.id),
    supabase
      .from('prestations')
      .select('*')
      .eq('id', id)
      .eq('coach_id', user.id)
      .is('deleted_at', null)
      .maybeSingle(),
    supabase
      .from('coach_public_profile')
      .select('public_name, tagline, photo_url, cover_url')
      .eq('coach_id', user.id)
      .maybeSingle(),
    supabase
      .from('coach_public_profile')
      .select('showroom_header_tags')
      .eq('coach_id', user.id)
      .maybeSingle(),
  ])
  const showroomHeaderTags = !headerTagsProbe.error
    ? parseShowroomTags(
        (headerTagsProbe.data as { showroom_header_tags?: unknown } | null)
          ?.showroom_header_tags,
      )
    : []

  if (!raw) notFound()
  const p = raw as PrestaRow

  const pricingType = p.pricing_type === 'renewable' ? 'renewable' : 'unique'
  const legacyHighlight = p.highlight_tag?.trim() || null
  const tags = parseShowroomTags(p.showroom_tags)
  const popupTagsRaw = parseShowroomTags(p.showroom_popup_tags)
  if (legacyHighlight && !tags.some((t) => t.toLowerCase() === legacyHighlight.toLowerCase())) {
    tags.unshift(legacyHighlight)
  }
  // Avant tranche 86 : popup = card
  const popupTags = popupTagsRaw.length ? popupTagsRaw : [...tags]
  const cardTagCount = tags.length > 0 ? Math.min(6, tags.length) : 3
  const photoUrl = p.photo_url?.trim() || null
  const videoUrl = p.video_url?.trim() || null
  const showroomDescription = p.showroom_description?.trim() || null
  const showroomWeekId = p.showroom_week_id?.trim() || null
  const ctaLabel = p.showroom_cta_label?.trim() || null
  const eyebrow = p.showroom_eyebrow?.trim() || null
  const photoIsCover = p.showroom_photo_is_cover !== false
  const hiddenProgramTagsRaw = parseShowroomTags(p.showroom_hidden_program_tags)
  const hiddenProgramTags =
    hiddenProgramTagsRaw.includes('*') || p.show_program_tags === false
      ? ['*']
      : hiddenProgramTagsRaw
  const videoRole =
    p.showroom_video_role === 'cover' || p.showroom_video_role === 'inline'
      ? p.showroom_video_role
      : videoUrl
        ? 'cover'
        : null

  let programTemplatesQ = await supabase
    .from('programs')
    .select('id, title, is_template, level, goal, duration, parent_program_id')
    .eq('coach_id', user.id)
    .eq('is_template', true)
    .eq('is_client_instance', false)
    .is('deleted_at', null)
    .order('title', { ascending: true })
  if (
    programTemplatesQ.error &&
    /is_client_instance|parent_program_id/i.test(programTemplatesQ.error.message)
  ) {
    programTemplatesQ = await supabase
      .from('programs')
      .select('id, title, is_template, level, goal, duration')
      .eq('coach_id', user.id)
      .eq('is_template', true)
      .is('deleted_at', null)
      .order('title', { ascending: true })
  }
  const parentsWithKids = new Set(
    (programTemplatesQ.data ?? [])
      .map((p) => (p as { parent_program_id?: string | null }).parent_program_id)
      .filter((id): id is string => Boolean(id)),
  )
  // Pas de parent avec enfants : uniquement feuille / version personnalisée.
  const programTemplates = (programTemplatesQ.data ?? []).filter(
    (p) => !parentsWithKids.has(p.id),
  )

  const programIds = (programTemplates ?? []).map((prog) => prog.id)
  const { data: weeksRaw } = programIds.length
    ? await supabase.from('program_weeks').select('id, program_id').in('program_id', programIds)
    : { data: [] as { id: string; program_id: string }[] }
  const weeks = (weeksRaw ?? []) as { id: string; program_id: string }[]
  const weekIds = weeks.map((w) => w.id)
  const { data: sessionsRaw } = weekIds.length
    ? await supabase.from('sessions').select('id, week_id').in('week_id', weekIds)
    : { data: [] as { id: string; week_id: string }[] }
  const sessions = (sessionsRaw ?? []) as { id: string; week_id: string }[]

  const weeksCountByProgramId = new Map<string, number>()
  const programIdByWeekId = new Map<string, string>()
  for (const w of weeks) {
    programIdByWeekId.set(w.id, w.program_id)
    weeksCountByProgramId.set(w.program_id, (weeksCountByProgramId.get(w.program_id) ?? 0) + 1)
  }
  const sessionsCountByProgramId = new Map<string, number>()
  for (const s of sessions) {
    const programId = programIdByWeekId.get(s.week_id)
    if (!programId) continue
    sessionsCountByProgramId.set(programId, (sessionsCountByProgramId.get(programId) ?? 0) + 1)
  }

  const programTagsById: Record<string, string[]> = {}
  const programTitleById: Record<string, string> = {}
  for (const prog of programTemplates ?? []) {
    programTitleById[prog.id] = prog.title?.trim() || 'Sans titre'
    programTagsById[prog.id] = programShowroomTags({
      id: prog.id,
      title: prog.title,
      level: prog.level,
      goal: prog.goal,
      duration: prog.duration,
      weeksCount: weeksCountByProgramId.get(prog.id) ?? 0,
      sessionsCount: sessionsCountByProgramId.get(prog.id) ?? 0,
    })
  }

  const linkedProgramIds = resolveProgramIds(p)
  const linkedProgramTagKeys = new Set(
    linkedProgramIds.flatMap((id) =>
      (programTagsById[id] ?? []).map((t) => t.toLowerCase()),
    ),
  )
  // Tags custom = union card+popup, hors tags programme
  const customTagsMerged: string[] = []
  for (const t of [...popupTags, ...tags]) {
    if (linkedProgramTagKeys.has(t.toLowerCase())) continue
    if (!customTagsMerged.some((u) => u.toLowerCase() === t.toLowerCase())) {
      customTagsMerged.push(t)
    }
  }

  const weekOptions = await loadShowroomWeekOptions(supabase, programIds)
  const [weekPreviewById, libraryCovers] = await Promise.all([
    loadShowroomWeekPreviews(
      supabase,
      weekOptions.map((w) => w.id),
    ),
    listActiveMediaLibraryCovers(),
  ])

  const { data: nutritionTemplates } = await supabase
    .from('nutrition_plans')
    .select('id, title')
    .eq('coach_id', user.id)
    .is('deleted_at', null)
    .order('title', { ascending: true })

  const { data: driveFolders } = await supabase
    .from('drive_folders')
    .select('id, name, parent_id')
    .eq('coach_id', user.id)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  const { data: linkedGroup } = await supabase
    .from('client_groups')
    .select('id, name, chat_enabled')
    .eq('coach_id', user.id)
    .eq('type', 'linked')
    .eq('prestation_id', p.id)
    .maybeSingle()

  const { count: activeGrantCount } = await supabase
    .from('client_grants')
    .select('id', { count: 'exact', head: true })
    .eq('coach_id', user.id)
    .eq('prestation_id', p.id)
    .eq('status', 'active')

  return (
    <>
      <Suspense fallback={null}>
        <CoachQueryFlash
          overrides={{
            created: { tone: 'success', message: 'Prestation créée' },
            saved: { tone: 'success', message: 'Prestation enregistrée' },
            cover_conflict: {
              tone: 'danger',
              message: 'Une seule couverture popup : photo ou vidéo, pas les deux.',
            },
          }}
        />
      </Suspense>

      <div className="mx-auto grid max-w-5xl gap-5 sm:gap-6">
        <div>
          <ProfileHubHeader
            title={p.name}
            subtitle={
              <span className="flex flex-col gap-1.5">
                <span>
                  {formatPriceCents(p.price_cents)} ·{' '}
                  {pricingType === 'renewable' ? 'Mensuel' : 'Paiement unique'}
                </span>
                <Link
                  href="/profile/prestations"
                  className="w-fit text-xs font-semibold text-[color:var(--brand)] hover:underline"
                >
                  ← Prestations
                </Link>
              </span>
            }
            showChromeActions={false}
          />
        </div>

        <form id="prestation-edit-form" className="grid gap-5 sm:gap-6">
          <input type="hidden" name="id" value={p.id} />

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm sm:p-5">
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">
              Ta vitrine
            </h2>
            <p className="mt-1 text-xs text-[color:var(--muted)]">
              Ce que tes prospects lisent sur le showroom avant d’acheter.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm sm:col-span-2">
                <span className="font-semibold text-[color:var(--fg)]">Nom *</span>
                <input name="name" required defaultValue={p.name} className={daFieldClass} />
              </label>
              <label className="grid gap-1 text-sm sm:col-span-2">
                <span className="font-semibold text-[color:var(--fg)]">Description</span>
                <AutoGrowTextarea
                  name="description"
                  minRows={2}
                  defaultValue={p.description ?? ''}
                  placeholder="Ce que le prospect lit dans la popup"
                  className={daFieldClass}
                />
              </label>
              <PrestationPricingFields
                priceEuros={(p.price_cents / 100).toFixed(2)}
                pricingType={pricingType}
              />
              <label className="grid gap-1 text-sm">
                <span className="font-semibold text-[color:var(--fg)]">Statut</span>
                <select name="status" defaultValue={p.status} className={daSelectClass}>
                  <option value="draft">Brouillon</option>
                  <option value="active">Active</option>
                  <option value="archived">Archivée</option>
                </select>
              </label>
              <label className="inline-flex items-center gap-2 self-end text-sm font-semibold text-[color:var(--fg)]">
                <input
                  type="checkbox"
                  name="showroom_visible"
                  defaultChecked={p.showroom_visible}
                  className="rounded"
                />
                Visible sur ton showroom
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm sm:p-5">
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">
              Contenu envoyé à l’achat
            </h2>
            <p className="mt-1 text-xs text-[color:var(--muted)]">
              Optionnel · plusieurs possibles. Dès l’accès client, ces éléments sont préparés sur
              son compte (il démarre quand il veut). Tags programme + pastilles « Inclus » suivent
              la sélection.
            </p>
            <PrestationContentLinksFields
              programOptions={(programTemplates ?? []).map((prog) => ({
                id: prog.id,
                label: `${prog.title?.trim() || 'Sans titre'}${prog.is_template ? ' · template' : ''}`,
              }))}
              nutritionOptions={(nutritionTemplates ?? []).map((n) => ({
                id: n.id,
                label: n.title?.trim() || 'Sans titre',
              }))}
              driveOptions={(driveFolders ?? []).map((f) => ({
                id: f.id,
                label: f.name,
              }))}
              initialProgramIds={resolveProgramIds(p)}
              initialNutritionIds={resolveNutritionIds(p)}
              initialDriveIds={resolveDriveIds(p)}
            />
          </section>

          <PrestationMiseEnFormeEditor
            name={p.name}
            description={p.description}
            showroomDescription={showroomDescription}
            priceCents={p.price_cents}
            pricingType={p.pricing_type}
            photoUrl={photoUrl}
            videoUrl={videoUrl}
            photoIsCover={photoIsCover}
            videoRole={videoRole}
            eyebrow={eyebrow}
            ctaLabel={ctaLabel}
            customTags={customTagsMerged}
            hiddenProgramTags={hiddenProgramTags}
            cardTagCount={cardTagCount}
            showroomWeekId={showroomWeekId}
            weekOptions={weekOptions}
            weekPreviewById={weekPreviewById}
            initialProgramIds={resolveProgramIds(p)}
            initialNutritionIds={resolveNutritionIds(p)}
            initialDriveIds={resolveDriveIds(p)}
            programTagsById={programTagsById}
            programTitleById={programTitleById}
            brandColor={shell.branding?.primary_color}
            secondaryColor={shell.branding?.secondary_color}
            themeMode={shell.branding?.theme_mode}
            bgStyle={shell.branding?.bg_style}
            appName={shell.branding?.app_name}
            logoUrl={shell.branding?.logo_url}
            libraryCovers={libraryCovers}
            showroomPublicName={publicProfile?.public_name}
            showroomTagline={publicProfile?.tagline}
            showroomPhotoUrl={publicProfile?.photo_url}
            showroomCoverUrl={publicProfile?.cover_url}
            showroomHeaderTags={showroomHeaderTags}
          />

          <PrestationProfileSaveBar />
        </form>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm sm:p-5">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">
            Groupe lié
          </h2>
          <p className="mt-1 text-xs text-[color:var(--muted)]">
            Optionnel · 1 max. Tes clients avec un accès actif à cette presta y entrent auto (
            {activeGrantCount ?? 0} actifs). Chat / Drive du groupe se gèrent sur la fiche groupe.
          </p>
          {linkedGroup ? (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Link
                href={`/clients/groupes/${linkedGroup.id}`}
                className="text-sm font-bold text-[color:var(--brand)] hover:underline"
              >
                Ouvrir « {linkedGroup.name} »
              </Link>
              <span className="text-xs text-[color:var(--muted)]">
                {linkedGroup.chat_enabled ? 'Chat on' : 'Chat off'}
              </span>
            </div>
          ) : (
            <p className="mt-3 text-sm">
              <Link
                href={`/clients/groupes?nouveau=lie&presta=${p.id}`}
                className="font-bold text-[color:var(--brand)] hover:underline"
              >
                Créer le groupe lié →
              </Link>
            </p>
          )}
        </section>

        <form action={archivePrestationAction}>
          <input type="hidden" name="id" value={p.id} />
          <button
            type="submit"
            className="rounded-lg border border-[var(--danger-border)] px-4 py-2 text-sm font-semibold text-[var(--danger)] hover:bg-[var(--danger-bg)]"
          >
            Archiver la prestation
          </button>
        </form>
      </div>
    </>
  )
}
