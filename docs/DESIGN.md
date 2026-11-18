# Design (rappel court)

Source complète : `/admin/design` + `.cursor/rules/design-system.mdc` + `src/app/globals.css`.

## Produit
- Admin / Coach : dark défaut, light dispo
- App client : DA du coach, base dark

## Tokens (obligatoire)
- Couleurs via `--brand`, `--brand-fg`, `--fg`, `--muted`, `--border`, `--surface`
- Sur fond brand : `text-[var(--brand-fg)]` ou `.on-brand` — **jamais** `text-white` en dark
- Boutons : composants `@/components/ui` (mist/beam dark · cta/secondary light)
- Ombres : `shadow-da-sm` / `shadow-da-md` / `shadow-da-brand`

## Copy
- Français
- Marque : **Krid**
