/**
 * Règle catalogue utilisable (builder coach, candidats blocs, search, ponts) :
 * non soft-deleted + status published (null status = legacy traité comme publié).
 * Les drafts restent visibles uniquement dans l’admin catalogue.
 */

export type CatalogVisibilityRow = {
  status?: string | null
  deleted_at?: string | null
}

export function isCatalogPublished(row: CatalogVisibilityRow): boolean {
  if (row.deleted_at) return false
  return !row.status || row.status === 'published'
}

/** Filtre post-query quand le select n’a pas pu appliquer .eq('status','published'). */
export function filterCatalogPublished<T extends CatalogVisibilityRow>(rows: T[]): T[] {
  return rows.filter(isCatalogPublished)
}
