-- =============================================================================
-- TRANCHE 101 — session_library : catalogue Krid visible coach + provenance fork
-- Prérequis : 50_session_library_catalog · 56_session_library_admin_only
-- =============================================================================

-- 1) Provenance fork (miroir exercise/block)
alter table public.session_library
  add column if not exists source_kind text not null default 'own',
  add column if not exists source_session_id uuid null references public.session_library(id) on delete set null;

do $$ begin
  alter table public.session_library
    drop constraint if exists session_library_source_kind_check;
  alter table public.session_library
    add constraint session_library_source_kind_check
    check (source_kind in ('own', 'krid', 'network'));
exception when others then null;
end $$;

comment on column public.session_library.source_kind is
  'Provenance coach-only: own | krid | network (V2). Jamais exposé au client.';
comment on column public.session_library.source_session_id is
  'Séance d’origine (fork Krid). Nullable.';

create index if not exists session_library_source_session_id_idx
  on public.session_library (source_session_id)
  where source_session_id is not null;

create index if not exists session_library_coach_source_krid_idx
  on public.session_library (coach_id, source_session_id)
  where source_kind = 'krid' and deleted_at is null;

-- 2) SELECT : coach voit ses séances + catalogue Krid published (coach_id null)
drop policy if exists "session_library_select" on public.session_library;
create policy "session_library_select"
on public.session_library for select to authenticated
using (
  deleted_at is null
  and (
    public.is_platform_admin()
    or coach_id = auth.uid()
    or (coach_id is null and status = 'published')
  )
);

drop policy if exists "session_library_items_select" on public.session_library_items;
create policy "session_library_items_select"
on public.session_library_items for select to authenticated
using (
  exists (
    select 1 from public.session_library s
    where s.id = session_id
      and s.deleted_at is null
      and (
        public.is_platform_admin()
        or s.coach_id = auth.uid()
        or (s.coach_id is null and s.status = 'published')
      )
  )
);

drop policy if exists "session_library_hidden_types_select" on public.session_library_hidden_types;
create policy "session_library_hidden_types_select"
on public.session_library_hidden_types for select to authenticated
using (
  exists (
    select 1 from public.session_library s
    where s.id = session_id
      and s.deleted_at is null
      and (
        public.is_platform_admin()
        or s.coach_id = auth.uid()
        or (s.coach_id is null and s.status = 'published')
      )
  )
);

drop policy if exists "session_library_hidden_sports_select" on public.session_library_hidden_sports;
create policy "session_library_hidden_sports_select"
on public.session_library_hidden_sports for select to authenticated
using (
  exists (
    select 1 from public.session_library s
    where s.id = session_id
      and s.deleted_at is null
      and (
        public.is_platform_admin()
        or s.coach_id = auth.uid()
        or (s.coach_id is null and s.status = 'published')
      )
  )
);

-- Write reste inchangé : admin plateforme OU coach sur ses lignes (slice 50).

insert into public.schema_migrations_trainly (id)
values ('101_session_library_coach_catalogue')
on conflict (id) do nothing;

notify pgrst, 'reload schema';
