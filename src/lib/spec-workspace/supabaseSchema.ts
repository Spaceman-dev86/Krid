/** Schéma cible SaaS Trainly — source pour le visualiseur /admin/spec/supabase */

export type SchemaCol = {
  name: string
  type: string
  pk?: boolean
  fk?: string // "table.column"
  unique?: boolean
  nullable?: boolean
  note?: string
}

export type SchemaTable = {
  id: string
  name: string
  domain: string
  status: 'existing' | 'extend' | 'create' | 'replace'
  columns: SchemaCol[]
}

export type SchemaEdge = {
  from: string // table.column
  to: string // table.column
}

export const SCHEMA_DOMAINS = [
  { id: 'all', label: 'Tout' },
  { id: 'auth', label: 'Identité' },
  { id: 'clients', label: 'Clients' },
  { id: 'payments', label: 'Prestations' },
  { id: 'programs', label: 'Programmes' },
  { id: 'nutrition', label: 'Nutrition' },
  { id: 'calendar', label: 'Calendrier' },
  { id: 'chat', label: 'Chat' },
  { id: 'drive', label: 'Drive' },
  { id: 'ops', label: 'Bilans / SAV' },
  { id: 'catalog', label: 'Catalogue Admin' },
] as const

export type SchemaDomainId = (typeof SCHEMA_DOMAINS)[number]['id']

export const TARGET_SCHEMA_TABLES: SchemaTable[] = [
  // —— Auth / tenancy ——
  {
    id: 'profiles',
    name: 'profiles',
    domain: 'auth',
    status: 'extend',
    columns: [
      { name: 'id', type: 'uuid', pk: true, fk: 'auth.users.id' },
      { name: 'role', type: 'text', note: 'coach|client|platform_admin' },
      { name: 'email', type: 'text', nullable: true },
      { name: 'full_name', type: 'text', nullable: true },
      { name: 'phone', type: 'text', nullable: true },
      { name: 'avatar_url', type: 'text', nullable: true },
      { name: 'created_at', type: 'timestamptz', nullable: true },
      { name: 'updated_at', type: 'timestamptz', nullable: true },
      { name: 'deleted_at', type: 'timestamptz', nullable: true },
    ],
  },
  {
    id: 'coach_subscriptions',
    name: 'coach_subscriptions',
    domain: 'auth',
    status: 'create',
    columns: [
      { name: 'id', type: 'uuid', pk: true },
      { name: 'coach_id', type: 'uuid', fk: 'profiles.id' },
      { name: 'plan_tier', type: 'text', note: 'starter|business|scale|studio' },
      { name: 'status', type: 'text', note: 'trial|active|past_due|canceled|expired_trial' },
      { name: 'trial_started_at', type: 'timestamptz', nullable: true },
      { name: 'trial_ends_at', type: 'timestamptz', nullable: true },
      { name: 'stripe_customer_id', type: 'text', nullable: true },
      { name: 'stripe_subscription_id', type: 'text', nullable: true },
      { name: 'current_period_end', type: 'timestamptz', nullable: true },
      { name: 'created_at', type: 'timestamptz', nullable: true },
    ],
  },
  {
    id: 'coach_branding',
    name: 'coach_branding',
    domain: 'auth',
    status: 'create',
    columns: [
      { name: 'coach_id', type: 'uuid', pk: true, fk: 'profiles.id' },
      { name: 'slug', type: 'text', unique: true },
      { name: 'app_name', type: 'text', nullable: true },
      { name: 'logo_url', type: 'text', nullable: true },
      { name: 'primary_color', type: 'text', nullable: true },
      { name: 'pwa_icon_url', type: 'text', nullable: true },
    ],
  },
  {
    id: 'coach_public_profile',
    name: 'coach_public_profile',
    domain: 'auth',
    status: 'create',
    columns: [
      { name: 'coach_id', type: 'uuid', pk: true, fk: 'profiles.id' },
      { name: 'public_name', type: 'text', nullable: true },
      { name: 'tagline', type: 'text', nullable: true },
      { name: 'bio', type: 'text', nullable: true },
      { name: 'photo_url', type: 'text', nullable: true },
      { name: 'cover_url', type: 'text', nullable: true },
      { name: 'share_message', type: 'text', nullable: true },
    ],
  },
  {
    id: 'login_logs',
    name: 'login_logs',
    domain: 'auth',
    status: 'extend',
    columns: [
      { name: 'id', type: 'uuid', pk: true },
      { name: 'user_id', type: 'uuid', fk: 'auth.users.id' },
      { name: 'email', type: 'text', nullable: true },
      { name: 'context', type: 'text', nullable: true, note: 'app|site' },
      { name: 'login_at', type: 'timestamptz', nullable: true },
    ],
  },
  // —— Clients ——
  {
    id: 'clients',
    name: 'clients',
    domain: 'clients',
    status: 'create',
    columns: [
      { name: 'id', type: 'uuid', pk: true },
      { name: 'coach_id', type: 'uuid', fk: 'profiles.id' },
      { name: 'user_id', type: 'uuid', fk: 'profiles.id', nullable: true },
      { name: 'email', type: 'text' },
      { name: 'first_name', type: 'text', nullable: true },
      { name: 'last_name', type: 'text', nullable: true },
      { name: 'phone', type: 'text', nullable: true },
      { name: 'sex', type: 'text', nullable: true },
      { name: 'birth_date', type: 'date', nullable: true },
      { name: 'weight_kg', type: 'numeric', nullable: true },
      { name: 'height_cm', type: 'numeric', nullable: true },
      { name: 'status', type: 'text', note: 'invited|active|archived' },
      { name: 'is_demo', type: 'bool' },
      { name: 'created_at', type: 'timestamptz', nullable: true },
      { name: 'deleted_at', type: 'timestamptz', nullable: true },
    ],
  },
  {
    id: 'client_grants',
    name: 'client_grants',
    domain: 'clients',
    status: 'create',
    columns: [
      { name: 'id', type: 'uuid', pk: true },
      { name: 'client_id', type: 'uuid', fk: 'clients.id' },
      { name: 'coach_id', type: 'uuid', fk: 'profiles.id' },
      { name: 'prestation_id', type: 'uuid', fk: 'prestations.id' },
      { name: 'modules', type: 'jsonb', note: 'fitness,nutrition,drive…' },
      { name: 'status', type: 'text', note: 'active|ended' },
      { name: 'starts_at', type: 'timestamptz', nullable: true },
      { name: 'ends_at', type: 'timestamptz', nullable: true },
      { name: 'payment_ledger_id', type: 'uuid', fk: 'payment_ledger.id', nullable: true },
    ],
  },
  {
    id: 'client_groups',
    name: 'client_groups',
    domain: 'clients',
    status: 'create',
    columns: [
      { name: 'id', type: 'uuid', pk: true },
      { name: 'coach_id', type: 'uuid', fk: 'profiles.id' },
      { name: 'name', type: 'text' },
      { name: 'type', type: 'text', note: 'auto|manual' },
      { name: 'prestation_id', type: 'uuid', fk: 'prestations.id', nullable: true },
      { name: 'chat_enabled', type: 'bool' },
      { name: 'drive_enabled', type: 'bool' },
    ],
  },
  {
    id: 'client_group_members',
    name: 'client_group_members',
    domain: 'clients',
    status: 'create',
    columns: [
      { name: 'group_id', type: 'uuid', pk: true, fk: 'client_groups.id' },
      { name: 'client_id', type: 'uuid', pk: true, fk: 'clients.id' },
    ],
  },
  {
    id: 'coach_onboarding_questions',
    name: 'coach_onboarding_questions',
    domain: 'clients',
    status: 'create',
    columns: [
      { name: 'id', type: 'uuid', pk: true },
      { name: 'coach_id', type: 'uuid', fk: 'profiles.id' },
      { name: 'label', type: 'text' },
      { name: 'type', type: 'text', note: 'texte|nombre|choix|oui_non' },
      { name: 'required', type: 'bool' },
      { name: 'sort_order', type: 'int4' },
    ],
  },
  {
    id: 'onboarding_answers',
    name: 'onboarding_answers',
    domain: 'clients',
    status: 'create',
    columns: [
      { name: 'id', type: 'uuid', pk: true },
      { name: 'client_id', type: 'uuid', fk: 'clients.id' },
      { name: 'coach_id', type: 'uuid', fk: 'profiles.id' },
      { name: 'question_id', type: 'uuid', fk: 'coach_onboarding_questions.id' },
      { name: 'value', type: 'jsonb' },
      { name: 'updated_at', type: 'timestamptz', nullable: true },
    ],
  },
  // —— Payments ——
  {
    id: 'prestations',
    name: 'prestations',
    domain: 'payments',
    status: 'create',
    columns: [
      { name: 'id', type: 'uuid', pk: true },
      { name: 'coach_id', type: 'uuid', fk: 'profiles.id' },
      { name: 'name', type: 'text' },
      { name: 'description', type: 'text', nullable: true },
      { name: 'pricing_type', type: 'text', note: 'unique|renewable' },
      { name: 'price_cents', type: 'int4' },
      { name: 'modules', type: 'jsonb' },
      { name: 'program_template_id', type: 'uuid', fk: 'programs.id', nullable: true },
      { name: 'nutrition_template_id', type: 'uuid', fk: 'nutrition_plans.id', nullable: true },
      { name: 'drive_folder_id', type: 'uuid', fk: 'drive_folders.id', nullable: true },
      { name: 'showroom_visible', type: 'bool' },
      { name: 'status', type: 'text', note: 'draft|active|archived' },
    ],
  },
  {
    id: 'payment_ledger',
    name: 'payment_ledger',
    domain: 'payments',
    status: 'create',
    columns: [
      { name: 'id', type: 'uuid', pk: true },
      { name: 'coach_id', type: 'uuid', fk: 'profiles.id' },
      { name: 'client_id', type: 'uuid', fk: 'clients.id' },
      { name: 'prestation_id', type: 'uuid', fk: 'prestations.id' },
      { name: 'amount_cents', type: 'int4' },
      { name: 'status', type: 'text', note: 'pending|paid|failed|expired|refunded' },
      { name: 'source', type: 'text', note: 'manual|link|stripe|showroom' },
      { name: 'paid_at', type: 'timestamptz', nullable: true },
      { name: 'created_at', type: 'timestamptz', nullable: true },
    ],
  },
  {
    id: 'payment_links_24h',
    name: 'payment_links_24h',
    domain: 'payments',
    status: 'create',
    columns: [
      { name: 'id', type: 'uuid', pk: true },
      { name: 'token', type: 'text', unique: true },
      { name: 'coach_id', type: 'uuid', fk: 'profiles.id' },
      { name: 'client_id', type: 'uuid', fk: 'clients.id' },
      { name: 'amount_cents', type: 'int4' },
      { name: 'expires_at', type: 'timestamptz' },
      { name: 'status', type: 'text' },
    ],
  },
  {
    id: 'invoice_requests',
    name: 'invoice_requests',
    domain: 'payments',
    status: 'create',
    columns: [
      { name: 'id', type: 'uuid', pk: true },
      { name: 'client_id', type: 'uuid', fk: 'clients.id' },
      { name: 'coach_id', type: 'uuid', fk: 'profiles.id' },
      { name: 'prestation_id', type: 'uuid', fk: 'prestations.id' },
      { name: 'comment', type: 'text', nullable: true },
      { name: 'status', type: 'text', note: 'pending|done' },
    ],
  },
  // —— Programs ——
  {
    id: 'programs',
    name: 'programs',
    domain: 'programs',
    status: 'extend',
    columns: [
      { name: 'id', type: 'uuid', pk: true },
      { name: 'coach_id', type: 'uuid', fk: 'profiles.id' },
      { name: 'title', type: 'text', nullable: true },
      { name: 'description', type: 'text', nullable: true },
      { name: 'goal', type: 'text', nullable: true },
      { name: 'level', type: 'text', nullable: true },
      { name: 'duration_weeks', type: 'int4', nullable: true },
      { name: 'image_url', type: 'text', nullable: true },
      { name: 'is_published', type: 'bool' },
      { name: 'is_template', type: 'bool', nullable: true },
      { name: 'is_calendar', type: 'bool', nullable: true },
      { name: 'start_date', type: 'date', nullable: true },
      { name: 'status', type: 'text', nullable: true, note: 'draft|running|done…' },
      { name: 'catalog_id', type: 'uuid', fk: 'catalog_items.id', nullable: true },
      { name: 'deleted_at', type: 'timestamptz', nullable: true },
      { name: 'created_at', type: 'timestamptz', nullable: true },
    ],
  },
  {
    id: 'program_weeks',
    name: 'program_weeks',
    domain: 'programs',
    status: 'extend',
    columns: [
      { name: 'id', type: 'uuid', pk: true },
      { name: 'program_id', type: 'uuid', fk: 'programs.id' },
      { name: 'title', type: 'text', nullable: true },
      { name: 'week_order', type: 'int4' },
      { name: 'notes', type: 'text', nullable: true },
    ],
  },
  {
    id: 'sessions',
    name: 'sessions',
    domain: 'programs',
    status: 'extend',
    columns: [
      { name: 'id', type: 'uuid', pk: true },
      { name: 'week_id', type: 'uuid', fk: 'program_weeks.id' },
      { name: 'title', type: 'text', nullable: true },
      { name: 'description', type: 'text', nullable: true },
      { name: 'session_order', type: 'int4' },
      { name: 'sport', type: 'text', nullable: true },
    ],
  },
  {
    id: 'session_blocks',
    name: 'session_blocks',
    domain: 'programs',
    status: 'extend',
    columns: [
      { name: 'id', type: 'uuid', pk: true },
      { name: 'session_id', type: 'uuid', fk: 'sessions.id' },
      { name: 'title', type: 'text', nullable: true },
      { name: 'position', type: 'int4' },
      { name: 'objective', type: 'text', nullable: true, note: 'temps|charge|reps|tonnage|none' },
      { name: 'notes', type: 'text', nullable: true },
    ],
  },
  {
    id: 'block_exercises',
    name: 'block_exercises',
    domain: 'programs',
    status: 'extend',
    columns: [
      { name: 'id', type: 'uuid', pk: true },
      { name: 'session_block_id', type: 'uuid', fk: 'session_blocks.id' },
      { name: 'exercise_id', type: 'uuid', fk: 'exercise_library.id', nullable: true },
      { name: 'exercise_name', type: 'text', nullable: true },
      { name: 'position', type: 'int4' },
      { name: 'sets', type: 'int4', nullable: true },
      { name: 'reps', type: 'text', nullable: true },
      { name: 'rest_time', type: 'text', nullable: true },
      { name: 'load', type: 'text', nullable: true },
      { name: 'rpe', type: 'numeric', nullable: true },
      { name: 'notes', type: 'text', nullable: true },
    ],
  },
  {
    id: 'program_exercises',
    name: 'program_exercises',
    domain: 'programs',
    status: 'extend',
    columns: [
      { name: 'id', type: 'uuid', pk: true },
      { name: 'session_id', type: 'uuid', fk: 'sessions.id' },
      { name: 'exercise_id', type: 'uuid', fk: 'exercise_library.id', nullable: true },
      { name: 'name', type: 'text', nullable: true },
      { name: 'sets', type: 'int4', nullable: true },
      { name: 'reps', type: 'text', nullable: true },
      { name: 'rest_time', type: 'text', nullable: true },
      { name: 'tempo', type: 'text', nullable: true },
      { name: 'load', type: 'text', nullable: true },
      { name: 'rpe', type: 'numeric', nullable: true },
      { name: 'exercise_order', type: 'int4' },
      { name: 'notes', type: 'text', nullable: true },
    ],
  },
  {
    id: 'exercise_library',
    name: 'exercise_library',
    domain: 'programs',
    status: 'extend',
    columns: [
      { name: 'id', type: 'uuid', pk: true },
      { name: 'coach_id', type: 'uuid', fk: 'profiles.id', nullable: true, note: 'null = Trainly' },
      { name: 'name', type: 'text' },
      { name: 'description', type: 'text', nullable: true },
      { name: 'muscle_group', type: 'text', nullable: true },
      { name: 'difficulty', type: 'text', nullable: true },
      { name: 'video_url', type: 'text', nullable: true },
      { name: 'demo_media_path', type: 'text', nullable: true },
      { name: 'replacement_exercise_id', type: 'uuid', fk: 'exercise_library.id', nullable: true },
      { name: 'deleted_at', type: 'timestamptz', nullable: true },
    ],
  },
  {
    id: 'client_fitness_plans',
    name: 'client_fitness_plans',
    domain: 'programs',
    status: 'create',
    columns: [
      { name: 'id', type: 'uuid', pk: true },
      { name: 'client_id', type: 'uuid', fk: 'clients.id' },
      { name: 'coach_id', type: 'uuid', fk: 'profiles.id' },
      { name: 'source_program_id', type: 'uuid', fk: 'programs.id', nullable: true },
      { name: 'grant_id', type: 'uuid', fk: 'client_grants.id', nullable: true },
      { name: 'status', type: 'text', note: 'waiting|started|paused|done' },
      { name: 'is_calendar', type: 'bool' },
      { name: 'start_date', type: 'date', nullable: true },
      { name: 'snapshot', type: 'jsonb', nullable: true },
    ],
  },
  {
    id: 'session_runs',
    name: 'session_runs',
    domain: 'programs',
    status: 'create',
    columns: [
      { name: 'id', type: 'uuid', pk: true },
      { name: 'client_id', type: 'uuid', fk: 'clients.id' },
      { name: 'coach_id', type: 'uuid', fk: 'profiles.id' },
      { name: 'plan_id', type: 'uuid', fk: 'client_fitness_plans.id', nullable: true },
      { name: 'source', type: 'text', note: 'plan|libre|adapted' },
      { name: 'scheduled_date', type: 'date', nullable: true },
      { name: 'actual_date', type: 'date', nullable: true },
      { name: 'style', type: 'text', note: 'fait|fait_edite|libre|pas_fait|en_cours' },
      { name: 'realized', type: 'jsonb', nullable: true },
      { name: 'comment', type: 'text', nullable: true },
    ],
  },
  {
    id: 'program_share_links',
    name: 'program_share_links',
    domain: 'programs',
    status: 'existing',
    columns: [
      { name: 'token', type: 'uuid', pk: true },
      { name: 'program_id', type: 'uuid', fk: 'programs.id' },
      { name: 'created_by', type: 'uuid', fk: 'profiles.id' },
      { name: 'recipient_email', type: 'text' },
      { name: 'message', type: 'text', nullable: true },
      { name: 'expires_at', type: 'timestamptz' },
      { name: 'revoked_at', type: 'timestamptz', nullable: true },
    ],
  },
  {
    id: 'client_favorites',
    name: 'client_favorites',
    domain: 'programs',
    status: 'create',
    columns: [
      { name: 'id', type: 'uuid', pk: true },
      { name: 'client_id', type: 'uuid', fk: 'clients.id' },
      { name: 'target_type', type: 'text', note: 'exercise|block' },
      { name: 'target_id', type: 'uuid' },
    ],
  },
  // —— Nutrition ——
  {
    id: 'nutrition_week_plans',
    name: 'nutrition_week_plans',
    domain: 'nutrition',
    status: 'extend',
    columns: [
      { name: 'id', type: 'uuid', pk: true },
      { name: 'coach_id', type: 'uuid', fk: 'profiles.id', nullable: true },
      { name: 'title', type: 'text', nullable: true },
      { name: 'is_template', type: 'bool', nullable: true },
      { name: 'deleted_at', type: 'timestamptz', nullable: true },
    ],
  },
  {
    id: 'nutrition_recipes',
    name: 'nutrition_recipes',
    domain: 'nutrition',
    status: 'extend',
    columns: [
      { name: 'id', type: 'uuid', pk: true },
      { name: 'coach_id', type: 'uuid', fk: 'profiles.id', nullable: true },
      { name: 'name', type: 'text' },
      { name: 'deleted_at', type: 'timestamptz', nullable: true },
    ],
  },
  {
    id: 'nutrition_ingredients',
    name: 'nutrition_ingredients',
    domain: 'nutrition',
    status: 'extend',
    columns: [
      { name: 'id', type: 'uuid', pk: true },
      { name: 'coach_id', type: 'uuid', fk: 'profiles.id', nullable: true },
      { name: 'name', type: 'text' },
    ],
  },
  {
    id: 'client_nutrition_plans',
    name: 'client_nutrition_plans',
    domain: 'nutrition',
    status: 'create',
    columns: [
      { name: 'id', type: 'uuid', pk: true },
      { name: 'client_id', type: 'uuid', fk: 'clients.id' },
      { name: 'coach_id', type: 'uuid', fk: 'profiles.id' },
      { name: 'source_plan_id', type: 'uuid', fk: 'nutrition_week_plans.id', nullable: true },
      { name: 'status', type: 'text', note: 'waiting|started|paused|done' },
      { name: 'snapshot', type: 'jsonb', nullable: true },
    ],
  },
  {
    id: 'nutrition_day_logs',
    name: 'nutrition_day_logs',
    domain: 'nutrition',
    status: 'create',
    columns: [
      { name: 'id', type: 'uuid', pk: true },
      { name: 'plan_id', type: 'uuid', fk: 'client_nutrition_plans.id' },
      { name: 'day_date', type: 'date' },
      { name: 'meals_validated', type: 'jsonb', nullable: true },
      { name: 'day_comment', type: 'text', nullable: true },
    ],
  },
  // —— Calendar ——
  {
    id: 'calendar_events',
    name: 'calendar_events',
    domain: 'calendar',
    status: 'extend',
    columns: [
      { name: 'id', type: 'uuid', pk: true },
      { name: 'owner_coach_id', type: 'uuid', fk: 'profiles.id' },
      { name: 'title', type: 'text', nullable: true },
      { name: 'starts_at', type: 'timestamptz' },
      { name: 'ends_at', type: 'timestamptz', nullable: true },
      { name: 'location', type: 'text', nullable: true },
      { name: 'modality', type: 'text', nullable: true, note: 'physique|visio' },
      { name: 'status', type: 'text', nullable: true },
    ],
  },
  {
    id: 'calendar_event_responses',
    name: 'calendar_event_responses',
    domain: 'calendar',
    status: 'create',
    columns: [
      { name: 'id', type: 'uuid', pk: true },
      { name: 'event_id', type: 'uuid', fk: 'calendar_events.id' },
      { name: 'client_id', type: 'uuid', fk: 'clients.id' },
      { name: 'status', type: 'text', note: 'pending|accepted|refused' },
      { name: 'responded_at', type: 'timestamptz', nullable: true },
    ],
  },
  // —— Chat ——
  {
    id: 'chat_threads',
    name: 'chat_threads',
    domain: 'chat',
    status: 'create',
    columns: [
      { name: 'id', type: 'uuid', pk: true },
      { name: 'coach_id', type: 'uuid', fk: 'profiles.id' },
      { name: 'type', type: 'text', note: 'dm|group' },
      { name: 'group_id', type: 'uuid', fk: 'client_groups.id', nullable: true },
      { name: 'client_id', type: 'uuid', fk: 'clients.id', nullable: true },
      { name: 'title', type: 'text', nullable: true },
    ],
  },
  {
    id: 'chat_messages',
    name: 'chat_messages',
    domain: 'chat',
    status: 'create',
    columns: [
      { name: 'id', type: 'uuid', pk: true },
      { name: 'thread_id', type: 'uuid', fk: 'chat_threads.id' },
      { name: 'sender_id', type: 'uuid', fk: 'profiles.id' },
      { name: 'body', type: 'text', nullable: true },
      { name: 'tag', type: 'text', nullable: true, note: 'prise_de_rdv…' },
      { name: 'created_at', type: 'timestamptz', nullable: true },
    ],
  },
  // —— Drive ——
  {
    id: 'drive_folders',
    name: 'drive_folders',
    domain: 'drive',
    status: 'create',
    columns: [
      { name: 'id', type: 'uuid', pk: true },
      { name: 'coach_id', type: 'uuid', fk: 'profiles.id' },
      { name: 'parent_id', type: 'uuid', fk: 'drive_folders.id', nullable: true },
      { name: 'name', type: 'text' },
      { name: 'deleted_at', type: 'timestamptz', nullable: true },
    ],
  },
  {
    id: 'drive_files',
    name: 'drive_files',
    domain: 'drive',
    status: 'create',
    columns: [
      { name: 'id', type: 'uuid', pk: true },
      { name: 'coach_id', type: 'uuid', fk: 'profiles.id' },
      { name: 'folder_id', type: 'uuid', fk: 'drive_folders.id', nullable: true },
      { name: 'name', type: 'text' },
      { name: 'storage_path', type: 'text' },
      { name: 'size_bytes', type: 'int8', nullable: true },
      { name: 'deleted_at', type: 'timestamptz', nullable: true },
    ],
  },
  {
    id: 'trainly_drive_library',
    name: 'trainly_drive_library',
    domain: 'drive',
    status: 'create',
    columns: [
      { name: 'id', type: 'uuid', pk: true },
      { name: 'title', type: 'text' },
      { name: 'storage_path', type: 'text' },
      { name: 'status', type: 'text', note: 'draft|published' },
      { name: 'published_at', type: 'timestamptz', nullable: true },
    ],
  },
  // —— Bilans / SAV ——
  {
    id: 'bilan_templates',
    name: 'bilan_templates',
    domain: 'ops',
    status: 'create',
    columns: [
      { name: 'id', type: 'uuid', pk: true },
      { name: 'coach_id', type: 'uuid', fk: 'profiles.id' },
      { name: 'title', type: 'text' },
      { name: 'schema', type: 'jsonb' },
      { name: 'deleted_at', type: 'timestamptz', nullable: true },
    ],
  },
  {
    id: 'bilan_instances',
    name: 'bilan_instances',
    domain: 'ops',
    status: 'create',
    columns: [
      { name: 'id', type: 'uuid', pk: true },
      { name: 'template_id', type: 'uuid', fk: 'bilan_templates.id' },
      { name: 'client_id', type: 'uuid', fk: 'clients.id' },
      { name: 'coach_id', type: 'uuid', fk: 'profiles.id' },
      { name: 'status', type: 'text' },
      { name: 'due_at', type: 'timestamptz', nullable: true },
      { name: 'submitted_at', type: 'timestamptz', nullable: true },
      { name: 'payload', type: 'jsonb', nullable: true },
    ],
  },
  {
    id: 'support_tickets',
    name: 'support_tickets',
    domain: 'ops',
    status: 'exists',
    columns: [
      { name: 'id', type: 'uuid', pk: true },
      { name: 'coach_id', type: 'uuid', fk: 'profiles.id' },
      { name: 'category', type: 'text' },
      { name: 'status', type: 'text' },
      { name: 'subject', type: 'text', nullable: true },
      { name: 'created_at', type: 'timestamptz', nullable: true },
    ],
  },
  {
    id: 'support_messages',
    name: 'support_messages',
    domain: 'ops',
    status: 'exists',
    columns: [
      { name: 'id', type: 'uuid', pk: true },
      { name: 'ticket_id', type: 'uuid', fk: 'support_tickets.id' },
      { name: 'sender_id', type: 'uuid', fk: 'profiles.id' },
      { name: 'sender_role', type: 'text', note: 'coach|admin' },
      { name: 'body', type: 'text' },
      { name: 'created_at', type: 'timestamptz', nullable: true },
    ],
  },
  {
    id: 'notifications',
    name: 'notifications',
    domain: 'ops',
    status: 'create',
    columns: [
      { name: 'id', type: 'uuid', pk: true },
      { name: 'user_id', type: 'uuid', fk: 'profiles.id' },
      { name: 'type', type: 'text' },
      { name: 'payload', type: 'jsonb', nullable: true },
      { name: 'read_at', type: 'timestamptz', nullable: true },
      { name: 'created_at', type: 'timestamptz', nullable: true },
    ],
  },
  // —— Catalog Admin ——
  {
    id: 'catalog_items',
    name: 'catalog_items',
    domain: 'catalog',
    status: 'create',
    columns: [
      { name: 'id', type: 'uuid', pk: true },
      { name: 'kind', type: 'text', note: 'program|session|block|exercise|recipe|food|nutrition_plan' },
      { name: 'title', type: 'text' },
      { name: 'status', type: 'text', note: 'draft|review|published' },
      { name: 'payload', type: 'jsonb', nullable: true },
      { name: 'published_at', type: 'timestamptz', nullable: true },
      { name: 'created_by', type: 'uuid', fk: 'profiles.id', nullable: true },
    ],
  },
]

/** Dérive les edges FK depuis les colonnes */
export function buildSchemaEdges(tables: SchemaTable[] = TARGET_SCHEMA_TABLES): SchemaEdge[] {
  const tableNames = new Set(tables.map((t) => t.name))
  const edges: SchemaEdge[] = []
  for (const table of tables) {
    for (const col of table.columns) {
      if (!col.fk) continue
      const [toTable] = col.fk.split('.')
      if (toTable === 'auth') continue // external
      if (!tableNames.has(toTable) && toTable !== table.name) {
        // still draw if target exists in full set
        if (!TARGET_SCHEMA_TABLES.some((t) => t.name === toTable)) continue
      }
      edges.push({
        from: `${table.name}.${col.name}`,
        to: col.fk,
      })
    }
  }
  return edges
}

export const STATUS_LABEL: Record<SchemaTable['status'], string> = {
  existing: 'Existant',
  extend: 'Étendre',
  create: 'À créer',
  replace: 'Remplacer',
}
