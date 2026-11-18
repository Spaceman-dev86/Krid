-- =============================================================================
-- TRANCHE 59 — Duplicate semaine : aligner champs figés slice 58
-- =============================================================================
-- duplicate_program_week_contents omettait :
--   session_blocks.timer_note / sport_id / expected_result_unit_id
--   block_exercises.prescriptions (SoT Rx — unités custom perdues)
-- =============================================================================

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
      id, program_session_id, position, type, title, notes, objective, source_block_library_id,
      timer_note, sport_id, expected_result_unit_id
    ) values (
      v_new_sb,
      (v_session_map ->> v_sb.program_session_id::text)::uuid,
      v_sb.position, v_sb.type, v_sb.title, v_sb.notes, v_sb.objective, v_sb.source_block_library_id,
      v_sb.timer_note, v_sb.sport_id, v_sb.expected_result_unit_id
    );

    for v_be in
      select * from public.block_exercises where session_block_id = v_sb.id order by position
    loop
      insert into public.block_exercises (
        id, session_block_id, position, exercise_id, exercise_name,
        sets, reps, rest_time, load, rpe, notes, prescriptions
      ) values (
        gen_random_uuid(), v_new_sb, v_be.position, v_be.exercise_id, v_be.exercise_name,
        v_be.sets, v_be.reps, v_be.rest_time, v_be.load, v_be.rpe, v_be.notes,
        coalesce(v_be.prescriptions, '[]'::jsonb)
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

insert into public.schema_migrations_trainly (id)
values ('59_duplicate_week_copy_fields')
on conflict (id) do nothing;

notify pgrst, 'reload schema';
