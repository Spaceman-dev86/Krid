# Krid — règles IA (court)

## Lire quoi (économie de tokens)
| Situation | Lire |
|---|---|
| Toujours | ce fichier + `docs/PROGRESS.md` |
| UI / pages | + `docs/DESIGN.md` (et rules design si besoin) |
| UI coach flash / transitions | rule `app-fluidity` · skill `.cursor/skills/coach-ux-feedback` si nouvelle page |
| Feature métier | + section concernée dans `docs/PRD.md` |
| Où placer le code | + `docs/ARCHITECTURE.md` |

Ne pas charger tout le dossier `docs/` par défaut.

## Produit (1 ligne)
SaaS marque blanche pour coachs : programmes, prestations, clients, app coach (logo/couleurs). Isolation stricte par `coach_id` + RLS.

## Stack
Next.js App Router · TypeScript · Tailwind · Supabase · Stripe · UI en français.

## Invariants
- Diffs minimaux, fichiers liés à la tâche seulement.
- Server Components par défaut ; `"use client"` seulement si nécessaire.
- Pas de secrets côté client. Stripe / webhooks = serveur.
- Thème coach = tokens CSS (`--brand`, `--brand-fg`, …), jamais couleurs en dur hors branding custom client.
- Dual routing : logique dans `src/app/…`, stubs plats dans `app/` (voir rule `dual-app-dir-stubs`).
- Details déjà couverts par `.cursor/rules/*` → ne pas les recopier ici.

## Méthode
1. Gros sujet (nouvelle surface, migration, RLS) → plan court puis validation.
2. Fix / micro-UI → coder directement.
3. Info manquante → demander, ne pas inventer.
4. Fin de chantier → mettre à jour `docs/PROGRESS.md` (3 listes max).
