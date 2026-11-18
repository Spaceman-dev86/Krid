/** PostgREST / Data API — table exists in Postgres but not (yet) in schema cache. */
export function isSchemaCacheError(message: string | null | undefined): boolean {
  const msg = String(message ?? '')
  return /schema cache|could not find the table|could not find a relationship/i.test(msg)
}
