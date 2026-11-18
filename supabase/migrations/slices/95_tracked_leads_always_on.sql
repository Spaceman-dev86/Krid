-- =============================================================================
-- TRANCHE 95 — Leads showroom toujours actifs
-- CTA « Je suis intéressé » = toujours on pour les campagnes actives.
-- =============================================================================

update public.coach_tracked_links
set capture_leads = true
where status = 'active'
  and capture_leads is distinct from true;
