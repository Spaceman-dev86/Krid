-- Templates parent / enfant (Dupliquer → enfant rattaché).
alter table public.programs
  add column if not exists parent_program_id uuid references public.programs(id) on delete set null;

create index if not exists programs_parent_program_id_idx
  on public.programs (parent_program_id)
  where parent_program_id is not null and deleted_at is null;

comment on column public.programs.parent_program_id is
  'Template enfant : pointe vers le template parent (null = racine / parent)';
