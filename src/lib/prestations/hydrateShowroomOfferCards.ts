import type { SupabaseClient } from '@supabase/supabase-js'

import {
  resolveDriveIds,
  resolveNutritionIds,
  resolveProgramIds,
  type PrestationContentLinkRow,
} from './contentLinks'
import { loadProgramShowroomMeta } from './loadProgramShowroomMeta'
import {
  loadShowroomWeekPreviews,
  type ShowroomWeekPreview,
} from './loadShowroomWeekPreview'
import { parseShowroomTags } from './modules'
import {
  includedFromContentLinks,
  mergeShowroomTags,
  programShowroomTags,
  type IncludedContentItem,
} from './showroomPresentation'

export type ShowroomOfferRow = PrestationContentLinkRow & {
  id: string
  name: string
  description?: string | null
  price_cents: number
  pricing_type: string
  photo_url?: string | null
  video_url?: string | null
  showroom_tags?: unknown
  showroom_popup_tags?: unknown
  highlight_tag?: string | null
  showroom_eyebrow?: string | null
  showroom_cta_label?: string | null
  showroom_description?: string | null
  showroom_week_id?: string | null
  showroom_photo_is_cover?: boolean | null
  showroom_video_role?: string | null
  show_program_tags?: boolean | null
  showroom_hidden_program_tags?: unknown
}

export type HydratedShowroomOffer = {
  id: string
  name: string
  description: string | null
  price_cents: number
  pricing_type: string
  photo_url: string | null
  video_url: string | null
  showroom_eyebrow: string | null
  showroom_cta_label: string | null
  showroom_description: string | null
  showroom_photo_is_cover: boolean
  showroom_video_role: 'cover' | 'inline' | null
  /** Tags carte (mise en forme « Sur la carte »). */
  showroom_tags: string[]
  /** Tags popup = programme visibles + custom (comme mise en forme). */
  showroom_popup_tags: string[]
  included: IncludedContentItem[]
  weekPreview: ShowroomWeekPreview | null
}

function hiddenProgramTagsFor(row: ShowroomOfferRow): string[] {
  const raw = parseShowroomTags(row.showroom_hidden_program_tags)
  if (row.show_program_tags === false && raw.length === 0) return ['*']
  return raw
}

/** Enrichit les offres showroom : tags popup complets · inclus · aperçu semaine. */
export async function hydrateShowroomOfferCards(
  supabase: SupabaseClient,
  rows: ShowroomOfferRow[],
): Promise<HydratedShowroomOffer[]> {
  if (!rows.length) return []

  const allProgramIds = [
    ...new Set(rows.flatMap((row) => resolveProgramIds(row))),
  ]
  const programTagsById: Record<string, string[]> = {}
  await Promise.all(
    allProgramIds.map(async (programId) => {
      const meta = await loadProgramShowroomMeta(supabase, programId)
      programTagsById[programId] = programShowroomTags(meta)
    }),
  )

  const weekIds = rows
    .map((row) => String(row.showroom_week_id ?? '').trim())
    .filter(Boolean)
  const weekPreviewById = await loadShowroomWeekPreviews(supabase, weekIds)

  return rows.map((row) => {
    const programIds = resolveProgramIds(row)
    const nutritionIds = resolveNutritionIds(row)
    const driveIds = resolveDriveIds(row)

    const programTags: string[] = []
    for (const programId of programIds) {
      for (const tag of programTagsById[programId] ?? []) {
        if (!programTags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
          programTags.push(tag)
        }
      }
    }

    const cardTags = parseShowroomTags(row.showroom_tags)
    const legacy = row.highlight_tag?.trim() || null
    if (legacy && !cardTags.some((t) => t.toLowerCase() === legacy.toLowerCase())) {
      cardTags.unshift(legacy)
    }

    const popupCustomRaw = parseShowroomTags(row.showroom_popup_tags)
    const popupCustom = popupCustomRaw.length ? popupCustomRaw : [...cardTags]
    const popupTags = mergeShowroomTags({
      customTags: popupCustom,
      programTags,
      hiddenProgramTags: hiddenProgramTagsFor(row),
    })

    const videoRole =
      row.showroom_video_role === 'cover' || row.showroom_video_role === 'inline'
        ? row.showroom_video_role
        : null

    const weekId = String(row.showroom_week_id ?? '').trim()

    return {
      id: row.id,
      name: row.name,
      description: row.description ?? null,
      price_cents: row.price_cents,
      pricing_type: row.pricing_type,
      photo_url: row.photo_url?.trim() || null,
      video_url: row.video_url?.trim() || null,
      showroom_eyebrow: row.showroom_eyebrow?.trim() || null,
      showroom_cta_label: row.showroom_cta_label?.trim() || null,
      showroom_description: row.showroom_description?.trim() || null,
      showroom_photo_is_cover: row.showroom_photo_is_cover !== false,
      showroom_video_role: videoRole,
      showroom_tags: cardTags,
      showroom_popup_tags: popupTags,
      included: includedFromContentLinks({
        programTemplateIds: programIds,
        nutritionTemplateIds: nutritionIds,
        driveFolderIds: driveIds,
      }),
      weekPreview: weekId ? weekPreviewById[weekId] ?? null : null,
    }
  })
}
