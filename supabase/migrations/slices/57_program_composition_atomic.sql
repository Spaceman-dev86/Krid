-- Composition atomique + versioning + reorder semaines (builder admin).

alter table public.sessions
  add column if not exists updated_at timestamptz not null default now();

alter table public.sessions
  add column if not exists composition_version integer not null default 0;

comment on column public.sessions.composition_version is
  'Incrémenté à chaque replace composition — optimistic concurrency builder.';

-- Backfill soft : blocs sans source dont le titre matche un block_library publié.
update public.session_blocks sb
set source_block_library_id = bl.id
from public.block_library bl
where sb.source_block_library_id is null
  and bl.coach_id is null
  and bl.deleted_at is null
  and bl.status = 'published'
  and nullif(trim(sb.title), '') is not null
  and lower(trim(sb.title)) = lower(trim(bl.name))
  and not exists (
    select 1
    from public.session_blocks other
    where other.id = sb.id
      and other.source_block_library_id is not null
  );

-- -----------------------------------------------------------------------------
-- replace_program_session_composition — wipe + rebuild en une transaction
-- p_payload: { expected_version?: int, items: [...] }
-- -----------------------------------------------------------------------------
create or replace function public.replace_program_session_composition(
  p_session_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expected int;
  v_current int;
  v_next int;
  v_item jsonb;
  v_timeline int := 0;
  v_block_pos int := 0;
  v_pe_id uuid;
  v_sb_id uuid;
  v_ex jsonb;
  v_rest_secs int;
begin
  if p_session_id is null then
    return jsonb_build_object('ok', false, 'error', 'session_id manquant');
  end if;

  if not public.is_platform_admin() and not public.owns_session(p_session_id) then
    return jsonb_build_object('ok', false, 'error', 'Accès refusé');
  end if;

  select composition_version into v_current
  from public.sessions
  where id = p_session_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Séance introuvable');
  end if;

  v_expected := nullif(p_payload->>'expected_version', '')::int;
  if v_expected is not null and v_expected <> v_current then
    return jsonb_build_object(
      'ok', false,
      'stale', true,
      'error', 'Composition modifiée ailleurs — recharge la page',
      'version', v_current
    );
  end if;

  if p_payload->'items' is null or jsonb_typeof(p_payload->'items') <> 'array'
     or jsonb_array_length(p_payload->'items') = 0 then
    return jsonb_build_object('ok', false, 'error', 'Composition vide');
  end if;

  delete from public.session_items where session_id = p_session_id;
  delete from public.program_exercises where session_id = p_session_id;
  delete from public.session_blocks where program_session_id = p_session_id;

  for v_item in
    select value from jsonb_array_elements(p_payload->'items')
  loop
    if v_item->>'kind' = 'rest' then
      v_rest_secs := coalesce(nullif(v_item->>'rest_seconds', '')::int, 60);
      insert into public.session_items (
        session_id, position, kind, program_exercise_id, session_block_id, prescriptions
      ) values (
        p_session_id, v_timeline, 'rest', null, null,
        jsonb_build_array(jsonb_build_object('rest_seconds', v_rest_secs))
      );
      v_timeline := v_timeline + 1;

    elsif v_item->>'kind' = 'exercise' then
      insert into public.program_exercises (
        session_id, exercise_id, name, exercise_order,
        sets, reps, rest_time, rpe, tempo, load, notes
      ) values (
        p_session_id,
        nullif(v_item->>'exercise_id', '')::uuid,
        coalesce(nullif(v_item->>'name', ''), 'Exercice'),
        v_timeline,
        nullif(v_item->'flat'->>'sets', '')::int,
        nullif(v_item->'flat'->>'reps', ''),
        nullif(v_item->'flat'->>'rest_time', ''),
        nullif(v_item->'flat'->>'rpe', '')::numeric,
        nullif(v_item->'flat'->>'tempo', ''),
        nullif(v_item->'flat'->>'load', ''),
        nullif(v_item->'flat'->>'notes', '')
      )
      returning id into v_pe_id;

      insert into public.session_items (
        session_id, position, kind, program_exercise_id, session_block_id, prescriptions
      ) values (
        p_session_id, v_timeline, 'exercise', v_pe_id, null,
        coalesce(v_item->'prescriptions', '[]'::jsonb)
      );
      v_timeline := v_timeline + 1;

    elsif v_item->>'kind' = 'block' then
      insert into public.session_blocks (
        program_session_id, position, type, title, notes, objective, source_block_library_id
      ) values (
        p_session_id,
        v_block_pos,
        coalesce(nullif(v_item->>'type', ''), 'free_text'),
        coalesce(nullif(v_item->>'title', ''), 'Bloc'),
        nullif(v_item->>'notes', ''),
        nullif(v_item->>'objective', ''),
        nullif(v_item->>'source_block_library_id', '')::uuid
      )
      returning id into v_sb_id;

      for v_ex in
        select value from jsonb_array_elements(coalesce(v_item->'exercises', '[]'::jsonb))
      loop
        insert into public.block_exercises (
          session_block_id, exercise_id, exercise_name, position,
          sets, reps, rest_time, load, rpe, notes
        ) values (
          v_sb_id,
          nullif(v_ex->>'exercise_id', '')::uuid,
          nullif(v_ex->>'exercise_name', ''),
          coalesce(nullif(v_ex->>'position', '')::int, 0),
          nullif(v_ex->'flat'->>'sets', '')::int,
          nullif(v_ex->'flat'->>'reps', ''),
          nullif(v_ex->'flat'->>'rest_time', ''),
          nullif(v_ex->'flat'->>'load', ''),
          nullif(v_ex->'flat'->>'rpe', '')::numeric,
          nullif(v_ex->'flat'->>'notes', '')
        );
      end loop;

      insert into public.session_items (
        session_id, position, kind, program_exercise_id, session_block_id, prescriptions
      ) values (
        p_session_id, v_timeline, 'block', null, v_sb_id, '[]'::jsonb
      );
      v_timeline := v_timeline + 1;
      v_block_pos := v_block_pos + 1;
    end if;
  end loop;

  if v_timeline = 0 then
    return jsonb_build_object('ok', false, 'error', 'Ajoute au moins un bloc ou un exercice');
  end if;

  v_next := v_current + 1;
  update public.sessions
  set composition_version = v_next,
      updated_at = now()
  where id = p_session_id;

  return jsonb_build_object('ok', true, 'version', v_next);
end;
$$;

revoke all on function public.replace_program_session_composition(uuid, jsonb) from public;
grant execute on function public.replace_program_session_composition(uuid, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- reorder_week_sessions — atomique (p_orders: [{id, session_order}, ...])
-- -----------------------------------------------------------------------------
create or replace function public.reorder_week_sessions(
  p_week_id uuid,
  p_orders jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
begin
  if p_week_id is null then
    return jsonb_build_object('ok', false, 'error', 'week_id manquant');
  end if;

  if not public.is_platform_admin() and not public.owns_session_via_week(p_week_id) then
    return jsonb_build_object('ok', false, 'error', 'Accès refusé');
  end if;

  if p_orders is null or jsonb_typeof(p_orders) <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'orders invalides');
  end if;

  for v_row in select value from jsonb_array_elements(p_orders)
  loop
    update public.sessions
    set session_order = (v_row->>'session_order')::int,
        updated_at = now()
    where id = (v_row->>'id')::uuid
      and week_id = p_week_id;
  end loop;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.reorder_week_sessions(uuid, jsonb) from public;
grant execute on function public.reorder_week_sessions(uuid, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- duplicate_program_week_contents — deep-copy atomique semaine → nouvelle semaine
-- -----------------------------------------------------------------------------
create or replace function public.duplicate_program_week_contents(
  p_source_week_id uuid,
  p_new_week_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_src record;
  v_new_session_id uuid;
  v_session_map jsonb := '{}'::jsonb;
  v_pe_map jsonb := '{}'::jsonb;
  v_sb_map jsonb := '{}'::jsonb;
  v_pe record;
  v_sb record;
  v_be record;
  v_item record;
  v_new_pe uuid;
  v_new_sb uuid;
begin
  if p_source_week_id is null or p_new_week_id is null then
    return jsonb_build_object('ok', false, 'error', 'week_id manquant');
  end if;

  if not public.is_platform_admin() and not public.owns_session_via_week(p_source_week_id) then
    return jsonb_build_object('ok', false, 'error', 'Accès refusé');
  end if;

  for v_src in
    select *
    from public.sessions
    where week_id = p_source_week_id
    order by session_order
  loop
    v_new_session_id := gen_random_uuid();
    v_session_map := v_session_map || jsonb_build_object(v_src.id::text, v_new_session_id::text);

    insert into public.sessions (
      id, week_id, title, description, session_order, notes,
      objective_ressenti, objective_note, objective_difficulty,
      composition_version, updated_at
    ) values (
      v_new_session_id, p_new_week_id, v_src.title, v_src.description, v_src.session_order, v_src.notes,
      coalesce(v_src.objective_ressenti, true),
      coalesce(v_src.objective_note, true),
      coalesce(v_src.objective_difficulty, true),
      0, now()
    );
  end loop;

  if v_session_map = '{}'::jsonb then
    return jsonb_build_object('ok', true);
  end if;

  -- Blocs (avant items / PE pour FK)
  for v_sb in
    select sb.*
    from public.session_blocks sb
    where sb.program_session_id in (
      select id from public.sessions where week_id = p_source_week_id
    )
  loop
    v_new_sb := gen_random_uuid();
    v_sb_map := v_sb_map || jsonb_build_object(v_sb.id::text, v_new_sb::text);
    insert into public.session_blocks (
      id, program_session_id, position, type, title, notes, objective, source_block_library_id
    ) values (
      v_new_sb,
      (v_session_map ->> v_sb.program_session_id::text)::uuid,
      v_sb.position, v_sb.type, v_sb.title, v_sb.notes, v_sb.objective, v_sb.source_block_library_id
    );

    for v_be in
      select * from public.block_exercises where session_block_id = v_sb.id order by position
    loop
      insert into public.block_exercises (
        id, session_block_id, position, exercise_id, exercise_name,
        sets, reps, rest_time, load, rpe, notes
      ) values (
        gen_random_uuid(), v_new_sb, v_be.position, v_be.exercise_id, v_be.exercise_name,
        v_be.sets, v_be.reps, v_be.rest_time, v_be.load, v_be.rpe, v_be.notes
      );
    end loop;
  end loop;

  for v_pe in
    select pe.*
    from public.program_exercises pe
    where pe.session_id in (select id from public.sessions where week_id = p_source_week_id)
  loop
    v_new_pe := gen_random_uuid();
    v_pe_map := v_pe_map || jsonb_build_object(v_pe.id::text, v_new_pe::text);
    insert into public.program_exercises (
      id, session_id, exercise_id, name, exercise_order,
      sets, reps, rest_time, rpe, tempo, load, notes
    ) values (
      v_new_pe,
      (v_session_map ->> v_pe.session_id::text)::uuid,
      v_pe.exercise_id, v_pe.name, v_pe.exercise_order,
      v_pe.sets, v_pe.reps, v_pe.rest_time, v_pe.rpe, v_pe.tempo, v_pe.load, v_pe.notes
    );
  end loop;

  for v_item in
    select si.*
    from public.session_items si
    where si.session_id in (select id from public.sessions where week_id = p_source_week_id)
    order by si.position
  loop
    insert into public.session_items (
      id, session_id, position, kind, program_exercise_id, session_block_id, prescriptions
    ) values (
      gen_random_uuid(),
      (v_session_map ->> v_item.session_id::text)::uuid,
      v_item.position,
      v_item.kind,
      case
        when v_item.program_exercise_id is null then null
        else (v_pe_map ->> v_item.program_exercise_id::text)::uuid
      end,
      case
        when v_item.session_block_id is null then null
        else (v_sb_map ->> v_item.session_block_id::text)::uuid
      end,
      coalesce(v_item.prescriptions, '[]'::jsonb)
    );
  end loop;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.duplicate_program_week_contents(uuid, uuid) from public;
grant execute on function public.duplicate_program_week_contents(uuid, uuid) to authenticated;

-- Legacy calendrier : session_order 0–6 (= jour) → encode Monday / day*1000.
update public.sessions s
set session_order = case
  when s.session_order = 0 then 10000
  when s.session_order between 1 and 6 then s.session_order * 1000
  else s.session_order
end
from public.program_weeks w
join public.programs p on p.id = w.program_id
where s.week_id = w.id
  and coalesce(p.is_calendar, false) = true
  and s.session_order between 0 and 6;

insert into public.schema_migrations_trainly (id)
values ('57_program_composition_atomic')
on conflict (id) do nothing;
