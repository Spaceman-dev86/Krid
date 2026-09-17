export type CatalogStatus = 'draft' | 'review' | 'published'

export const CATALOG_STATUS_LABEL: Record<CatalogStatus, string> = {
  draft: 'Brouillon',
  review: 'Review',
  published: 'Publié',
}

export function parseCatalogStatus(value: unknown): CatalogStatus {
  if (value === 'review' || value === 'published' || value === 'draft') return value
  return 'draft'
}

export function catalogStatusFromPublished(isPublished: boolean | null | undefined): CatalogStatus {
  return isPublished ? 'published' : 'draft'
}
