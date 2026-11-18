-- =============================================================================
-- TRANCHE 99 — Units : retirer l’abrégé déjà présent dans le label
-- ex. « Calories (cal) » + short Cal → label « Calories », short inchangé
-- =============================================================================

update public.units u
set
  label = trim(regexp_replace(u.label, '\s*\([^)]*\)\s*$', '')),
  short_label = coalesce(
    nullif(trim(u.short_label), ''),
    nullif(trim(substring(u.label from '\(([^)]+)\)\s*$')), ''),
    u.short_label
  ),
  updated_at = now()
where u.deleted_at is null
  and u.label ~ '\([^)]+\)\s*$'
  and (
    u.short_label is null
    or lower(trim(u.short_label)) = lower(trim(substring(u.label from '\(([^)]+)\)\s*$')))
    or lower(u.label) like '%(' || lower(trim(u.short_label)) || ')%'
  );
