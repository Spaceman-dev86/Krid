---
description: Reference: Program structure (weeks/sessions/items) + SQL introspection outputs + migration plan (timeline v2)
---

# Contexte produit (spécification)

- Hiérarchie:
  - `semaine` (`program_weeks`)
  - `training` / `session` (`sessions`)
  - Contenu d’un training: **alternance libre** entre
    - exercices “classiques”
    - blocs

- Types de blocs (objectif court-terme UI):
  - `warm up`
  - `crossfit`
  - `superset`

- Comportement attendu des blocs (comme un exercice):
  - création / édition / duplication / suppression
  - quand un bloc est ajouté, on arrive dans l’éditeur du bloc
  - dans l’éditeur de bloc, on ajoute des exercices depuis la table unique `exercise_library`

- UI souhaitée:
  - colonne gauche: palette des types de blocs (drag & drop) + bouton `+bloc`
  - colonne droite: bibliothèque `exercise_library`


# SQL — Résultats d’introspection fournis

## 1) Colonnes / types (information_schema.columns)

Tables analysées:
- `program_weeks`
- `sessions`
- `program_exercises`
- `session_blocks`
- `block_exercises`

### `program_weeks`
- `id uuid not null default gen_random_uuid()`
- `program_id uuid not null`
- `title text not null`
- `week_order integer not null`
- `created_at timestamptz null default now()`

### `sessions`
- `id uuid not null default gen_random_uuid()`
- `title text not null`
- `description text null`
- `session_order integer not null`
- `created_at timestamptz not null default now()`
- `week_id uuid not null`

### `program_exercises`
- `id uuid not null default gen_random_uuid()`
- `session_id uuid not null`
- `name text not null`
- `description text null`
- `sets integer null`
- `reps integer null`
- `rest_time text null`
- `tempo text null`
- `load text null`
- `video_url text null`
- `notes text null`
- `exercise_order integer not null default 1`
- `created_at timestamptz not null default now()`
- `exercise_id uuid null`

### `session_blocks`
- `id uuid not null default gen_random_uuid()`
- `program_session_id uuid not null`
- `position integer not null default 0`
- `type USER-DEFINED not null` (enum)
- `title text null`
- `notes text null`
- `crosstraining_style text null`
- `rounds integer null`
- `timecap_seconds integer null`
- `rest_seconds integer null`
- `warmup_duration_seconds integer null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### `block_exercises`
- `id uuid not null default gen_random_uuid()`
- `session_block_id uuid not null`
- `position integer not null default 0`
- `exercise_id uuid null`
- `exercise_name text null`
- `sets integer null`
- `reps integer null`
- `reps_min integer null`
- `reps_max integer null`
- `load_text text null`
- `rpe numeric null`
- `rest_seconds integer null`
- `tempo text null`
- `distance_m integer null`
- `duration_seconds integer null`
- `notes text null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`


## 2) Foreign Keys (information_schema.table_constraints)

- `program_weeks.program_id -> programs.id`
- `sessions.week_id -> program_weeks.id`
- `program_exercises.session_id -> sessions.id`
- `program_exercises.exercise_id -> exercise_library.id`
- `session_blocks.program_session_id -> sessions.id`
- `block_exercises.session_block_id -> session_blocks.id`
- `block_exercises.exercise_id -> exercise_library.id`


## 3) Enum `session_blocks.type`

Enum: `session_block_type`

Valeurs:
- `warmup`
- `strength`
- `powerlifting`
- `crosstraining`
- `run`
- `bike`
- `swim`
- `free_text`


# Diagnostic (écart avec la logique cible)

## Problème structurel

Le modèle actuel stocke 2 listes ordonnées indépendamment dans un même training:
- exercices: `program_exercises.exercise_order`
- blocs: `session_blocks.position`

Il n’existe pas de “source de vérité” unique décrivant l’ordre global du contenu d’un training.

Conséquence:
- impossible de représenter proprement une alternance: `exercice -> bloc -> exercice -> bloc`
- UI fragile: on doit bricoler la sélection et le rendu à partir de 2 listes


# Proposition V2: timeline unifiée via `session_items`

## Objectif
Avoir 1 seule liste ordonnée par training, contenant des items de différents types.

## Table proposée (minimal v2)

`session_items`
- `id uuid primary key default gen_random_uuid()`
- `session_id uuid not null references sessions(id) on delete cascade`
- `position integer not null`
- `kind text not null` (ou enum) avec au minimum: `exercise`, `block`
- `program_exercise_id uuid null references program_exercises(id) on delete cascade`
- `session_block_id uuid null references session_blocks(id) on delete cascade`

Contraintes:
- unique `(session_id, position)`
- check:
  - si `kind = 'exercise'` alors `program_exercise_id is not null` et `session_block_id is null`
  - si `kind = 'block'` alors `session_block_id is not null` et `program_exercise_id is null`

## Remarque
On pourra étendre plus tard `kind` pour intégrer d’autres items (`free_text`, etc.) sans casser l’existant.


# Stratégie de migration sans casser

## Règles confirmées (Milestone B)

- `session_items` devient la source de vérité de l'ordre global par `session`.
- À terme, l'UI n'utilise plus `program_exercises.exercise_order` ni `session_blocks.position` (on garde ces champs pour compat/migration).
- Ajout via `+bloc`: insertion en fin de training.
- Ajout via drag & drop: insertion à l'endroit du drop (position arbitraire).

## Milestone A — Feature flag UI (0 risque)
- Garder l’UI actuelle en production.
- Ajouter un mode V2 derrière un flag (ex: `?structure=v2`).
- Lire la timeline via `session_items` (initialement auto-générée) et afficher en readonly.

## Milestone B — Migration DB non destructive
- Créer `session_items`.
- Backfill initial:
  - pour chaque `session`:
    - insérer des items `exercise` selon `program_exercises.exercise_order`
    - insérer des items `block` selon `session_blocks.position`
  - règle temporaire si pas d’alternance historique: exercices puis blocs.

### SQL proposé — création table + contraintes + index

À exécuter dans Supabase SQL editor.

```sql
-- 1) Enum pour le kind de timeline (on peut l'étendre plus tard)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'session_item_kind') then
    create type public.session_item_kind as enum ('exercise', 'block');
  end if;
end $$;

-- 2) Table timeline
create table if not exists public.session_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  position integer not null,
  kind public.session_item_kind not null,
  program_exercise_id uuid null references public.program_exercises(id) on delete cascade,
  session_block_id uuid null references public.session_blocks(id) on delete cascade,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint session_items_kind_ref_check check (
    (kind = 'exercise' and program_exercise_id is not null and session_block_id is null)
    or
    (kind = 'block' and session_block_id is not null and program_exercise_id is null)
  )
);

-- 3) Unicité de l'ordre
create unique index if not exists session_items_unique_position
  on public.session_items(session_id, position);

-- 4) Accélérer les lectures
create index if not exists session_items_session_id_idx
  on public.session_items(session_id);

create index if not exists session_items_program_exercise_id_idx
  on public.session_items(program_exercise_id);

create index if not exists session_items_session_block_id_idx
  on public.session_items(session_block_id);
```

### SQL proposé — backfill (safe, idempotent)

Ce backfill crée une timeline de base **sans alternance** (exercices puis blocs).
On pourra ensuite réordonner via l'UI V2.

```sql
-- Backfill uniquement pour les sessions qui n'ont pas encore de session_items.
with sessions_to_fill as (
  select s.id as session_id
  from public.sessions s
  left join public.session_items si on si.session_id = s.id
  where si.session_id is null
),
exercises_ranked as (
  select
    pe.session_id,
    pe.id as program_exercise_id,
    row_number() over (partition by pe.session_id order by pe.exercise_order, pe.created_at, pe.id) as rn
  from public.program_exercises pe
  join sessions_to_fill stf on stf.session_id = pe.session_id
),
blocks_ranked as (
  select
    sb.program_session_id as session_id,
    sb.id as session_block_id,
    row_number() over (partition by sb.program_session_id order by sb.position, sb.created_at, sb.id) as rn
  from public.session_blocks sb
  join sessions_to_fill stf on stf.session_id = sb.program_session_id
),
exercise_counts as (
  select session_id, count(*)::int as cnt
  from exercises_ranked
  group by session_id
),
items_to_insert as (
  select
    er.session_id,
    (er.rn - 1) as position,
    'exercise'::public.session_item_kind as kind,
    er.program_exercise_id,
    null::uuid as session_block_id
  from exercises_ranked er

  union all

  select
    br.session_id,
    (coalesce(ec.cnt, 0) + br.rn - 1) as position,
    'block'::public.session_item_kind as kind,
    null::uuid as program_exercise_id,
    br.session_block_id
  from blocks_ranked br
  left join exercise_counts ec on ec.session_id = br.session_id
)
insert into public.session_items (session_id, position, kind, program_exercise_id, session_block_id)
select session_id, position, kind, program_exercise_id, session_block_id
from items_to_insert
order by session_id, position;
```

## Milestone C — CRUD aligné sur “comme un exercice”
- Ajouter un exercice:
  - créer `program_exercises`
  - créer `session_items(kind='exercise')`
- Ajouter un bloc:
  - créer `session_blocks`
  - créer `session_items(kind='block')`
  - ouvrir l’éditeur du bloc

## Milestone D — Drag & drop
- DnD palette (warmup/crosstraining/superset)
- DnD reorder dans la timeline: update `session_items.position`

## Milestone E — Nettoyage
- Quand V2 est stable, l’ancienne UI devient fallback.


# Notes “suppression de tables”

Ne pas supprimer `program_exercises`, `session_blocks`, `block_exercises`:
- elles contiennent les données métier.

`session_items` ne fait que porter l’ordre global.

La suppression de tables ne doit être envisagée qu’après:
- migration complète
- période de stabilité
- et back-up.
