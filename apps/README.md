# Monorepo Krid

## Apps

| Package | Role | Dev | Vercel |
|---|---|---|---|
| **racine** (`Krid`) | Produit — coach, portail `/c/[slug]`, admin | `npm run dev:app` → :3000 | projet **`krid`** |
| **`@trainly/site`** (`apps/site`) | Site marketing | `npm run dev:site` → :3001 | projet **`krid-site`** (root `apps/site`) |

## Setup

```bash
npm install
cp .env.example .env.local   # fill Supabase + URLs
cp apps/site/.env.example apps/site/.env.local
```

Même `NEXT_PUBLIC_SUPABASE_*` (projet Krid) dans les deux `.env.local`.  
Assets marketing = bucket Storage **`home_page`** sur ce projet.

## Run

```bash
# Terminal 1 — product
npm run dev:app

# Terminal 2 — marketing site
npm run dev:site
```

CTAs site (Connexion / Essai gratuit / Démarrer l’essai gratuit) → `NEXT_PUBLIC_APP_URL/signup…`.  
Produit `/` : coach → `/home`, sinon → `NEXT_PUBLIC_SITE_URL`.

## Auth coach (parcours type Ekklo)

1. Site tarifs / simulation → **Démarrer l’essai gratuit** → `APP/signup?plan=business&mode=signup`
2. Header **Connexion** → `APP/signup?mode=login`
3. Inscription → mail Supabase de confirmation → `/auth/callback/coach` → `/home`
4. Paiement / abo → plus tard `/settings/billing`

Whitelister dans Supabase Auth : `APP_URL/auth/callback/coach` (+ previews).

## Prod env

- Site : `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- App : `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL` (+ Supabase déjà présents)

Plus tard : `.com` = site, `.app` = produit.
