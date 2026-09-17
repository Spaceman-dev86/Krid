# Migrations SQL par tranche (nouveau projet Supabase uniquement)

| Fichier | Contenu | Statut |
|---------|---------|--------|
| `01_helpers_profiles.sql` | profiles, helpers RLS, login_logs | appliqué |
| `02_coach_tenancy.sql` | coach_subscriptions, coach_branding | appliqué |
| `03_clients.sql` | clients, groups, onboarding | appliqué |
| `03b_fix_groups_rls.sql` | fix recursion groups | appliqué |
| `04_prestations_grants.sql` | prestations, ledger, grants | appliqué |
| `05_invites_showroom.sql` | invites + redeem | appliqué |
| `06_portal_rls.sql` | RLS portail prestations | appliqué |
| `07_redeem_guard.sql` | garde coach ≠ client | appliqué |
| `08_claim_client_email.sql` | claim par email | appliqué |
| `09_client_user_unique.sql` | unique user_id / coach | appliqué |
| `10_programs.sql` | programmes + plans client | appliqué |
| `11a_exercise_library_trainly.sql` | import catalogue Trainly (81 exos) | appliqué |
| `11a_exercise_media_storage.sql` | bucket + policies exercise-media | appliqué |
| `11_session_runs.sql` | session_runs + RLS player / historique | appliqué |
| … | … | … |
| `36_catalog_workflow.sql` | catalog_status + droits programmes/exos | à confirmer |
| `37_trainly_vs_coach_programs.sql` | is_trainly_catalog | à confirmer |
| `38_coach_workspace_repair.sql` | coach_workspace + repair flags | à confirmer |
| `39_exercise_fiche_types_replacements.sql` | exercise_types · remplacements multi · common_mistakes | **à run** |
| `40_exercise_named_notes.sql` | named_notes jsonb (notes libres titrées) | **à run** |
| `41_crossfit_muscle_to_type.sql` | Crossfit muscle → type · review → draft | **à run** |

| `50_session_library_catalog.sql` | Catalogue séances + unités Rx séance | **à run** |
| `51_units_list_mode.sql` | units.value_mode=list + list_options | **à run** |
| `52_units_short_label_run_feedback.sql` | units.short_label + feedback session_runs | **à run** |
| `53_session_library_items_rest.sql` | item_kind=rest entre items de séance | **à run** |

Ne pas exécuter `../20260826_phase2_tenancy_clients.sql` d’un coup.
Voir aussi `/admin/spec/supabase` → SQL par tranches.
