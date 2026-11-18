# FIGÉ — Presta × Groupe × Grant

> Source de vérité produit. Ne pas réintroduire les groupes auto « offre = salon ».

## Phrases

- **Presta** = ce que tu vends (programme(s), kit Drive, nutrition…).
- **Grant** = clé on/off du client.
- **Groupe lié** = 0 ou 1 par presta · roster sync · salon opt-in.
- **Groupe libre** = membres manuels (+ tag presta optionnel, pas de sync).
- **DM 1:1** = toujours dès l’app.
- Programme = livrable **presta**, jamais propriétaire du groupe.

## Presta

- Création : pas de chat / groupe obligatoires.
- Livrables optionnels : 0..n programmes, nutrition, dossier Drive kit.
- Peut être Drive-only ou programme-only.
- Plus tard : **ajouter** un programme → push grants **actifs** (défaut ajouter ; option remplacer).
- Entrée UI push aussi depuis cockpit groupe lié (même action).

## Groupe lié (`type = linked`)

- Max 1 par `(coach, prestation)`.
- Backfill à la création : tous les grants actifs.
- Nouveaux grants → entrée sync (sauf exclusion coach sticky).
- Chat off par défaut ; activation = notif + fil.
- Drive collectif = **0..n dossiers** `/drive` (via `drive_shares`) · accès **actifs** seulement.
- Fin grant → **alumni** (reste membre, chat OK, plus Drive/program/nouveaux bilans).
- Retrait coach → exclusion sticky ; **repay** → revient.
- Archive presta → alumni ; groupe **supprimable** manuellement.
- Sans chat : invisible côté client (outil coach).

## Groupe libre (`type = manual`)

- Membres manuels ; tags classement optionnels (`client_group_tags`) : presta et/ou programme sport, **max 3** (pas de sync).
- `prestation_id` = 1er tag presta (rétrocompat).
- Chat / Drive opt-in.
- Challenge : programme assigné hors presta.

## Audiences envoi

- Presta Soft = grants actifs.
- Groupe = actifs by default (alumni toggle off).

## Hors scope V1

- Groupe lié à un **programme** (sync).
- Multi groupes liés par presta.
