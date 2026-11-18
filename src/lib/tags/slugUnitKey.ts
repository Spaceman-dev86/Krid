/** Slug stable pour units.key (max 40). */
export function slugUnitKey(label: string, fallback = 'unit') {
  return (
    label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 40) || fallback
  )
}
