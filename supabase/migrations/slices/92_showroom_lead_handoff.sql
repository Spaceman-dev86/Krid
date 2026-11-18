-- =============================================================================
-- TRANCHE 92 — Contacts coach + leads intérêt showroom (email, naissance, presta)
-- Prérequis : 30_tracked_links, coach_branding, prestations
-- Après Run : dis « 92 OK »
-- =============================================================================

alter table public.coach_branding
  add column if not exists contact_instagram text,
  add column if not exists contact_whatsapp text,
  add column if not exists contact_facebook text;

comment on column public.coach_branding.contact_instagram is
  'Handle Instagram (sans @) pour CTA Je suis intéressé';
comment on column public.coach_branding.contact_whatsapp is
  'Numéro WhatsApp international (digits) pour CTA Je suis intéressé';
comment on column public.coach_branding.contact_facebook is
  'Username / id page Messenger pour CTA Je suis intéressé';

alter table public.coach_tracked_leads
  add column if not exists email text,
  add column if not exists birthdate date,
  add column if not exists prestation_id uuid references public.prestations(id) on delete set null;

create index if not exists coach_tracked_leads_prestation_id_idx
  on public.coach_tracked_leads (prestation_id)
  where prestation_id is not null;

comment on column public.coach_tracked_leads.email is
  'Email volontaire (CTA intérêt / checkout)';
comment on column public.coach_tracked_leads.birthdate is
  'Date de naissance (page intérêt presta)';
comment on column public.coach_tracked_leads.prestation_id is
  'Presta ciblée si lead depuis CTA popup offre';

insert into public.schema_migrations_trainly (id)
values ('92_showroom_lead_handoff')
on conflict (id) do nothing;
