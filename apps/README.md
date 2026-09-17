# Monorepo Trainly

## Apps

| Package | Role | Dev |
|---|---|---|
| **racine** (`fitness_app`) | Produit — coach, portail `/c/[slug]`, admin/spec | `npm run dev:app` → :3000 |
| **`@trainly/site`** (`apps/site`) | Site marketing | `npm run dev:site` → :3001 |

## Setup

```bash
npm install
cp .env.example .env.local   # fill Supabase + URLs
cp apps/site/.env.example apps/site/.env.local
```

Use the same `NEXT_PUBLIC_SUPABASE_*` in both `.env.local` files (site = public reads only).

## Run

```bash
# Terminal 1 — product
npm run dev:app

# Terminal 2 — marketing site
npm run dev:site
```

CTAs on the site (login / essai) point to `NEXT_PUBLIC_APP_URL`.
Product root `/` redirects coaches to `/home`, others to `NEXT_PUBLIC_SITE_URL`.

## Later (.com / .app)

Set production env:

- `NEXT_PUBLIC_SITE_URL=https://yourdomain.com`
- `NEXT_PUBLIC_APP_URL=https://yourdomain.app`

Add both origins to Supabase Auth redirect URLs.
