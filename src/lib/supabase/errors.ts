/** PostgREST / Data API — table/column exists in Postgres but not (yet) in schema cache. */
export function isSchemaCacheError(message: string | null | undefined): boolean {
  const msg = String(message ?? '')
  return /schema cache|could not find the table|could not find a relationship|column .+ does not exist|could not find the .+ column/i.test(
    msg,
  )
}
