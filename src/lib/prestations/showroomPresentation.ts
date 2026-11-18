import {
  formatProgramDurationLabel,
  formatProgramGoalLabel,
} from '../formatProgramDuration'
import { parseShowroomTags } from './modules'

export type ProgramShowroomMeta = {
  id: string
  title: string | null
  level: string | null
  goal: string | null
  duration: string | null
  weeksCount: number
  sessionsCount: number
}

export type IncludedContentItem = {
  id: 'fitness' | 'nutrition' | 'drive'
  label: string
}

/** Tags dérivés du programme lié (niveau · objectif · durée · séances). */
export function programShowroomTags(meta: ProgramShowroomMeta | null | undefined): string[] {
  if (!meta) return []
  const tags: string[] = []
  const level = String(meta.level ?? '').trim()
  if (level) tags.push(`Niveau ${level}`)

  const goalRaw = String(meta.goal ?? '').trim()
  if (goalRaw) {
    const goalLabel = formatProgramGoalLabel(goalRaw)
    if (goalLabel && goalLabel !== 'Objectif —') tags.push(goalLabel)
  }

  const duration = formatProgramDurationLabel({
    duration: meta.duration,
    weeksCount: meta.weeksCount,
  })
  if (duration && duration !== '—') tags.push(duration)

  if (meta.sessionsCount > 0) {
    tags.push(`${meta.sessionsCount} séance${meta.sessionsCount > 1 ? 's' : ''}`)
  }
  return tags
}

/** Éléments inclus d’après « Contenu envoyé à l’achat ». */
export function includedFromContentLinks(opts: {
  programTemplateId?: string | null
  nutritionTemplateId?: string | null
  driveFolderId?: string | null
  programTemplateIds?: string[] | null
  nutritionTemplateIds?: string[] | null
  driveFolderIds?: string[] | null
}): IncludedContentItem[] {
  const items: IncludedContentItem[] = []
  const programCount =
    opts.programTemplateIds?.length || (opts.programTemplateId ? 1 : 0)
  const nutritionCount =
    opts.nutritionTemplateIds?.length || (opts.nutritionTemplateId ? 1 : 0)
  const driveCount = opts.driveFolderIds?.length || (opts.driveFolderId ? 1 : 0)
  if (programCount) {
    items.push({
      id: 'fitness',
      label: programCount > 1 ? `Programmes (${programCount})` : 'Programme sport',
    })
  }
  if (nutritionCount) {
    items.push({
      id: 'nutrition',
      label: nutritionCount > 1 ? `Nutrition (${nutritionCount})` : 'Plan nutrition',
    })
  }
  if (driveCount) {
    items.push({
      id: 'drive',
      label: driveCount > 1 ? `Drive (${driveCount})` : 'Drive',
    })
  }
  return items
}

/** Tags programme visibles (hors liste de masquage unitaire). */
export function visibleProgramTags(opts: {
  programTags?: string[]
  hiddenProgramTags?: unknown
}): string[] {
  const program = (opts.programTags ?? []).map((t) => t.trim()).filter(Boolean)
  const hidden = parseShowroomTags(opts.hiddenProgramTags)
  if (hidden.some((h) => h === '*')) return []
  const hiddenSet = new Set(hidden.map((h) => h.toLowerCase()))
  return program.filter((t) => !hiddenSet.has(t.toLowerCase()))
}

/** Ligne méta card : tags programme visibles + tags custom (dédupliqués). */
export function mergeShowroomTags(opts: {
  customTags: unknown
  programTags?: string[]
  hiddenProgramTags?: unknown
  max?: number
}): string[] {
  const custom = parseShowroomTags(opts.customTags)
  const program = visibleProgramTags({
    programTags: opts.programTags,
    hiddenProgramTags: opts.hiddenProgramTags,
  })
  const max = opts.max ?? 8
  const out: string[] = []
  for (const t of [...program, ...custom]) {
    if (out.length >= max) break
    if (!out.some((u) => u.toLowerCase() === t.toLowerCase())) out.push(t)
  }
  return out
}

export function hiddenProgramTagsFromForm(formData: FormData, programTags: string[]): string[] {
  const visible = new Set(
    formData
      .getAll('program_tag_visible')
      .map((v) => String(v ?? '').trim().toLowerCase())
      .filter(Boolean),
  )
  return programTags
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => !visible.has(t.toLowerCase()))
}

export function parseVideoEmbed(url: string | null | undefined): {
  kind: 'youtube' | 'vimeo' | 'file' | null
  embedUrl: string | null
  raw: string
} {
  const raw = String(url ?? '').trim()
  if (!raw) return { kind: null, embedUrl: null, raw: '' }

  try {
    const u = new URL(raw)
    const host = u.hostname.replace(/^www\./, '').toLowerCase()

    if (host === 'youtu.be') {
      const id = u.pathname.split('/').filter(Boolean)[0]
      if (id) {
        return { kind: 'youtube', embedUrl: `https://www.youtube.com/embed/${id}`, raw }
      }
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      const id = u.searchParams.get('v') || u.pathname.split('/').filter(Boolean).pop()
      if (id && id !== 'watch' && id !== 'embed') {
        return { kind: 'youtube', embedUrl: `https://www.youtube.com/embed/${id}`, raw }
      }
      if (u.pathname.includes('/embed/')) {
        return { kind: 'youtube', embedUrl: raw, raw }
      }
    }
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const id = u.pathname.split('/').filter(Boolean).pop()
      if (id && /^\d+$/.test(id)) {
        return { kind: 'vimeo', embedUrl: `https://player.vimeo.com/video/${id}`, raw }
      }
    }
  } catch {
    /* URL invalide → file fallback si ça ressemble à un média */
  }

  if (/\.(mp4|webm|ogg)(\?|$)/i.test(raw) || raw.startsWith('blob:')) {
    return { kind: 'file', embedUrl: raw, raw }
  }
  return { kind: 'file', embedUrl: raw, raw }
}
