-- =============================================================================
-- TRANCHE 58 — Copie bloc programme : champs figés + prescriptions jsonb
-- =============================================================================
-- session_blocks : timer / sport / unité résultat (comme block_library)
-- block_exercises : prescriptions = source de vérité (colonnes plates dérivées)
-- =============================================================================

alter table public.session_blocks
  add column if not exists timer_note text,
  add column if not exists sport_id uuid references public.sports(id) on delete set null,
  add column if not exists expected_result_unit_id uuid references public.units(id) on delete set null;

comment on column public.session_blocks.timer_note is
  'Timer coach figé (JSON) — copie programme, pas live catalogue.';
comment on column public.session_blocks.sport_id is
  'Sport du bloc figé dans le programme.';
comment on column public.session_blocks.expected_result_unit_id is
  'Unité du résultat attendu figée dans le programme.';

alter table public.block_exercises
  add column if not exists prescriptions jsonb not null default '[]'::jsonb;

comment on column public.block_exercises.prescriptions is
  'Source de vérité Rx du bloc programme ; sets/reps/… dérivés au write.';

-- -----------------------------------------------------------------------------
-- RPC replace : propager les nouveaux champs + prescriptions
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
  v_current int;
  v_expected int;
  v_next int;
  v_item jsonb;
  v_ex jsonb;
  v_timeline int := 0;
  v_block_pos int := 0;
  v_pe_id uuid;
  v_sb_id uuid;
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

  if p_payload->'items' is null or jsonb_typeof(p_payload->'items') <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'Composition invalide');
  end if;

  -- Vide autorisé (wipe)
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
        program_session_id, position, type, title, notes, objective,
        source_block_library_id, timer_note, sport_id, expected_result_unit_id
      ) values (
        p_session_id,
        v_block_pos,
        coalesce(nullif(v_item->>'type', ''), 'free_text'),
        coalesce(nullif(v_item->>'title', ''), 'Bloc'),
        nullif(v_item->>'notes', ''),
        nullif(v_item->>'objective', ''),
        nullif(v_item->>'source_block_library_id', '')::uuid,
        nullif(v_item->>'timer_note', ''),
        nullif(v_item->>'sport_id', '')::uuid,
        nullif(v_item->>'expected_result_unit_id', '')::uuid
      )
      returning id into v_sb_id;

      for v_ex in
        select value from jsonb_array_elements(coalesce(v_item->'exercises', '[]'::jsonb))
      loop
        insert into public.block_exercises (
          session_block_id, exercise_id, exercise_name, position,
          sets, reps, rest_time, load, rpe, notes, prescriptions
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
          nullif(v_ex->'flat'->>'notes', ''),
          coalesce(v_ex->'prescriptions', '[]'::jsonb)
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

  v_next := v_current + 1;
  update public.sessions
  set composition_version = v_next,
      updated_at = now()
  where id = p_session_id;

  return jsonb_build_object('ok', true, 'version', v_next);
end;
$$;

insert into public.schema_migrations_trainly (id)
values ('58_program_block_copy_fields')
on conflict (id) do nothing;

notify pgrst, 'reload schema';
