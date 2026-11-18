-- Instance client (photocopie à l’envoi) + provenance template.
alter table public.programs
  add column if not exists is_client_instance boolean not null default false;

alter table public.programs
  add column if not exists template_program_id uuid references public.programs(id) on delete set null;

create index if not exists programs_client_instance_idx
  on public.programs (coach_id)
  where is_client_instance = true and deleted_at is null;

create index if not exists programs_template_program_id_idx
  on public.programs (template_program_id)
  where template_program_id is not null and deleted_at is null;

comment on column public.programs.is_client_instance is
  'true = photocopie envoyée à un client (hors hubs Templates/Brouillon)';
comment on column public.programs.template_program_id is
  'Instance client : pointe vers le template source (feuille/enfant)';

-- Sur le plan : dédup / fin / compteurs par template (pas par instance).
alter table public.client_fitness_plans
  add column if not exists template_program_id uuid references public.programs(id) on delete set null;

create index if not exists client_fitness_plans_template_program_id_idx
  on public.client_fitness_plans (coach_id, template_program_id)
  where template_program_id is not null;

comment on column public.client_fitness_plans.template_program_id is
  'Template hub d’origine ; source_program_id = instance figée éditable';
