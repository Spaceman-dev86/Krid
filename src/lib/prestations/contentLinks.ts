/** Ids de contenu lié (programmes / nutrition / drive) — multi + fallback singulier. */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function parseUuidList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const raw of value) {
    const id = String(raw ?? '').trim()
    if (!UUID_RE.test(id)) continue
    if (!out.includes(id)) out.push(id)
  }
  return out
}

/** Form multi-checkbox `name` → liste d’uuids uniques. */
export function contentIdsFromForm(formData: FormData, field: string): string[] {
  const out: string[] = []
  for (const raw of formData.getAll(field)) {
    const id = String(raw ?? '').trim()
    if (!UUID_RE.test(id)) continue
    if (!out.includes(id)) out.push(id)
  }
  return out
}

export type PrestationContentLinkRow = {
  program_template_id?: string | null
  nutrition_template_id?: string | null
  drive_folder_id?: string | null
  program_template_ids?: unknown
  nutrition_template_ids?: unknown
  drive_folder_ids?: unknown
}

export function resolveProgramIds(row: PrestationContentLinkRow | null | undefined): string[] {
  const multi = parseUuidList(row?.program_template_ids)
  if (multi.length) return multi
  const one = String(row?.program_template_id ?? '').trim()
  return UUID_RE.test(one) ? [one] : []
}

export function resolveNutritionIds(row: PrestationContentLinkRow | null | undefined): string[] {
  const multi = parseUuidList(row?.nutrition_template_ids)
  if (multi.length) return multi
  const one = String(row?.nutrition_template_id ?? '').trim()
  return UUID_RE.test(one) ? [one] : []
}

export function resolveDriveIds(row: PrestationContentLinkRow | null | undefined): string[] {
  const multi = parseUuidList(row?.drive_folder_ids)
  if (multi.length) return multi
  const one = String(row?.drive_folder_id ?? '').trim()
  return UUID_RE.test(one) ? [one] : []
}

/** Sync colonnes singulières = 1er id (compat livraison / anciennes lectures). */
export function singularFromIds(ids: string[]): string | null {
  return ids[0] ?? null
}
