-- Seed shared demo calendar sessions for the 5 pre-registered clients across 2026.
-- Pattern similar to April 2026 in demo_chat_schema_seed.sql.
--
-- Run in Supabase SQL editor. Safe to re-run: replaces shared demo events for 2026 only
-- (owner_coach_id IS NULL). Coach-private events are untouched.
--
-- Why SQL (not the app)?
-- - Bulk demo data (~800 rows) in one shot
-- - Deterministic, versioned, repeatable for all environments
-- - No need to wire a one-off admin script in Next.js

delete from public.calendar_events
where owner_coach_id is null
  and start_at >= timestamptz '2026-01-01 00:00:00+01:00'
  and start_at < timestamptz '2027-01-01 00:00:00+01:00';

with clients as (
  select id, full_name, sessions_per_week
  from (values
    ('11111111-1111-1111-1111-111111111111'::uuid, 'Sarah Martin', 5),
    ('22222222-2222-2222-2222-222222222222'::uuid, 'Mehdi Benali', 4),
    ('33333333-3333-3333-3333-333333333333'::uuid, 'Camille Dubois', 3),
    ('44444444-4444-4444-4444-444444444444'::uuid, 'Lucas Morel', 4),
    ('55555555-5555-5555-5555-555555555555'::uuid, 'Nina Garcia', 5)
  ) as t(id, full_name, sessions_per_week)
),
days as (
  select d::date as day
  from generate_series(date '2026-01-01', date '2026-12-31', interval '1 day') as d
),
slots as (
  select *
  from (values
    (7, 45, 60),
    (8, 0, 60),
    (8, 30, 60),
    (8, 45, 60),
    (9, 0, 60),
    (10, 0, 60),
    (10, 30, 60),
    (12, 0, 60),
    (12, 15, 45),
    (18, 0, 60),
    (18, 15, 60),
    (18, 30, 60),
    (19, 0, 60),
    (19, 15, 60)
  ) as t(start_hour, start_min, duration_min)
),
notes_pool as (
  select *
  from (values
    ('Full body + technique.'),
    ('Haut du corps + gainage.'),
    ('Séance courte, focus technique.'),
    ('Jambes + mobilité hanches.'),
    ('Circuit sans matériel.'),
    ('Progression sur les charges.'),
    ('Échauffement + technique épaules.'),
    ('Deload contrôlé.'),
    ('Technique squat + gainage.'),
    ('Full body + cardio léger.'),
    ('Incliné haltères + dos.'),
    ('Upper body + posture.'),
    ('Jambes : volume modéré.'),
    ('Renfo + mobilité dos.'),
    ('Bilan mensuel + ajustements.'),
    ('Mobilité + renforcement.'),
    ('Cardio léger + core.')
  ) as n(note)
),
week_days as (
  select
    c.id as client_id,
    c.full_name,
    c.sessions_per_week,
    d.day,
    extract(isoyear from d.day)::int as iso_year,
    extract(week from d.day)::int as iso_week,
    abs(hashtext(c.id::text || d.day::text)) as h
  from clients c
  cross join days d
  where extract(isodow from d.day) between 1 and 6
),
picked as (
  select client_id, full_name, day, h, sessions_per_week
  from (
    select
      wd.*,
      row_number() over (
        partition by client_id, iso_year, iso_week
        order by h
      ) as week_rank
    from week_days wd
  ) ranked
  where week_rank <= sessions_per_week
),
scheduled as (
  select
    p.client_id,
    p.full_name,
    p.day,
    p.h,
    s.start_hour,
    s.start_min,
    s.duration_min
  from picked p
  join lateral (
    select start_hour, start_min, duration_min
    from slots
    order by abs(hashtext(p.client_id::text || p.day::text || slots.start_hour::text || slots.start_min::text))
    limit 1
  ) s on true
)
insert into public.calendar_events (owner_coach_id, client_id, type, title, start_at, end_at, notes)
select
  null,
  s.client_id,
  'in_person',
  'Séance présentiel — ' || s.full_name,
  (
    make_timestamp(
      extract(year from s.day)::int,
      extract(month from s.day)::int,
      extract(day from s.day)::int,
      s.start_hour,
      s.start_min,
      0
    ) at time zone 'Europe/Paris'
  )::timestamptz,
  (
    make_timestamp(
      extract(year from s.day)::int,
      extract(month from s.day)::int,
      extract(day from s.day)::int,
      s.start_hour,
      s.start_min,
      0
    ) at time zone 'Europe/Paris'
    + (s.duration_min || ' minutes')::interval
  )::timestamptz,
  (
    select note
    from notes_pool
    order by abs(hashtext(s.client_id::text || s.day::text || note))
    limit 1
  )
from scheduled s;

-- Optional sanity check:
-- select c.full_name, count(*) as sessions_2026
-- from public.calendar_events e
-- join public.demo_clients c on c.id = e.client_id
-- where e.owner_coach_id is null
--   and e.start_at >= '2026-01-01'
--   and e.start_at < '2027-01-01'
-- group by c.full_name
-- order by c.full_name;
