# Prompt agent — QA Program Builder (multi-browser · multi-viewport · rapport Spec)

> **Spec** : visible / copiable sur [`/admin/spec/prompt`](/admin/spec/prompt) · fichier source `plans/qa/program-builder-qa-prompt.md`
>
> Colle ce prompt tel quel dans un agent Cursor qui a le skill `playwright-cli`.
> Adapte uniquement les placeholders `{{…}}` avant de lancer.

---

Utilise le skill **playwright-cli** ainsi que le **Playwright CLI** pour pouvoir lancer le program_builder dans `/admin` et le tester. N’oublie pas d’utiliser le **headed mode** et n’oublie pas de m’en faire une **vidéo**. Le rapport HTML doit être visible depuis **`/admin/spec`**. Lance le run (ne te contente pas de décrire).

---

Tu es un QA engineer. Tu testes **en live** le **Program Builder admin** de Trainly avec `playwright-cli` (skill + CLI), en **headed**, multi-browser et multi-viewport. Tu produis une **vidéo** + un **rapport HTML** consultable depuis `/admin/spec`.

## Contexte produit (ne pas inventer d’autres routes)

| Élément | Valeur |
|--------|--------|
| Base URL | `{{BASE_URL}}` (défaut `http://localhost:3000`) |
| Liste programmes | `/admin/programs` |
| Builder | `/admin/programs/{{PROGRAM_ID}}` |
| Auth safe | **Ne jamais demander / écrire le mot de passe dans le chat.** Charger `.playwright-auth/admin.auth-state.json` (gitignored). Si absent → ouvrir headed `/loginadmin`, attendre que l’humain se connecte, puis `state-save .playwright-auth/admin.auth-state.json`. |
| Breakpoints code | **Phone** ≤767 · **Tablet** 768–1099 · **Desktop** ≥1100 (`BUILDER_PHONE_MAX_PX` / `BUILDER_DESKTOP_MIN_PX`) |

### Viewports obligatoires (utiliser `playwright-cli resize W H`)

| Mode | Size | Note |
|------|------|------|
| Phone | `390 844` | chrome téléphone, semaine empilée, catalogue overlay |
| Tablet | `900 1200` | DnD + flèches, pas desktop side-by-side |
| Desktop | `1440 900` | jours côte à côte, catalogue collé |

### Browsers obligatoires (sessions séparées)

Pour chaque browser : session nommée `-s={{browser}}-{{mode}}`.

1. `chrome` (défaut)
2. `firefox`
3. `webkit`

Matrice minimale : **3 browsers × 3 viewports = 9 runs**. Si un browser manque, noter `SKIP` dans le rapport (ne pas inventer de résultat).

---

## Setup (toujours en premier)

```bash
# PATH Windows si besoin
# $env:Path = "$env:APPDATA\npm;$env:Path"

playwright-cli close-all

# Session chrome desktop (premier run)
playwright-cli -s=chrome-desktop open {{BASE_URL}}/loginadmin --browser=chrome --headed
# Si state existe :
playwright-cli -s=chrome-desktop state-load .playwright-auth/admin.auth-state.json
playwright-cli -s=chrome-desktop goto {{BASE_URL}}/admin/programs
# Sinon : laisser l’humain se connecter, puis state-save

playwright-cli -s=chrome-desktop video-start recordings/qa-program-builder-{{STAMP}}.webm --cursor --fps=60
playwright-cli -s=chrome-desktop video-show-actions --duration=700 --position=top-right \
  --highlight-style="outline: 3px solid #e85d26; background: rgba(232,93,38,.12)" \
  --point-style="width: 18px; height: 18px; border-radius: 50%; background: rgba(232,93,38,.75)"
```

Créer les dossiers si besoin : `recordings/`, `public/qa/`, `.playwright-auth/` (déjà gitignored).

---

## Règles d’interaction (OBLIGATOIRE à chaque action UI)

1. `playwright-cli -s=… snapshot` ou `find "…"` pour obtenir un **ref frais** (les refs expirent vite).
2. `playwright-cli -s=… highlight [ref] --style="outline: 3px solid #e85d26"` → attendre ~1s  
   (si ref stale : utiliser locator `getByRole(…)` / `getByText(…)`).
3. `playwright-cli -s=… mousemove` vers la zone (si coords disponibles via `snapshot --boxes`) → ~1s.
4. Ensuite seulement : `click` / `fill` / `type` / `press` / `mousewheel`.
5. Entre chaque **chapter** :  
   `playwright-cli -s=… video-chapter "[Titre]" --description="…" --duration=2500`
6. Après chaque mutation importante : `playwright-cli -s=… console` + noter erreurs/warnings.
7. Ne pas publier / supprimer de programmes réels sans confirmation. Préférer un programme **brouillon** dédié QA (`{{PROGRAM_ID}}`).

---

## Chapters à couvrir (ordre)

Répéter la logique pertinente sur **chaque viewport** (phone / tablet / desktop) au moins une fois sur **chrome**. Sur firefox + webkit : smoke (open builder + 2 interactions + console), sauf si le temps le permet pour le full matrix.

### 1. Auth & entrée catalogue
- Chapter : `"Auth & /admin/programs"`
- `goto` liste · console · screenshot `recordings/qa-{{STAMP}}-programs-list-{{viewport}}.png`
- Ouvrir `{{PROGRAM_ID}}` (lien titre programme)

### 2. Shell builder — audit visuel
- Chapter : `"Builder shell — {{viewport}}"`
- Vérifier : titre programme · badge BROUILLON/PUBLIÉ · strip semaines · boutons Infos / Rendu / Publier · Passer en calendrier|journées
- Console + screenshot

### 3. Navigation semaines
- Chapter : `"Semaines — nav / + / menu"`
- Click Semaine 2 → Semaine 1
- Desktop : boutons éditer / dupliquer / supprimer semaine visibles (pas de hint parasite)
- Phone : menu `⋯` semaine si présent
- Screenshot

### 4. Focus jour & séances
- Chapter : `"Jour focus — séances"`
- Ouvrir un jour (ex. JOUR 2) → URL `?day=`
- Vérifier accordion phone vs séances ouvertes desktop
- Click-outside / `data-builder-chrome` : click header/semaine **ne doit pas** fermer le jour par accident
- Screenshot jour ouvert

### 5. Catalogue (palette)
- Chapter : `"Catalogue — open / filtres / preview i"`
- Ouvrir catalogue (+ Séance / Insérer)
- Filtres texte + type/sport si présents
- Hover/click `i` preview séance/bloc (latence perçue)
- Phone : fermer catalogue (×) sans casser le jour
- `eval` avant/après ouverture catalogue (ex. présence overlay)

### 6. Composition (smoke non destructif)
- Chapter : `"Composition — lecture blocs/exos"`
- Scroll dans une séance avec blocs
- Vérifier Rx visibles (reps/kg/cal/timer)
- Desktop : pas de DnD requis ; tablet/phone : noter présence flèches / poignées DnD
- **Ne pas** supprimer de blocs sauf programme QA dédié

### 7. Infos programme
- Chapter : `"Panneau Infos"`
- Ouvrir Infos · vérifier champs Nom / Niveau / photo · Fermer / Masquer
- Screenshot

### 8. Mode calendrier (si dispo)
- Chapter : `"Mode calendrier"`
- Toggle Passer en calendrier ↔ journées
- Screenshot des deux modes (desktop au minimum)

### 9. Responsive matrix (chrome)
- Chapter : `"Matrix viewports chrome"`
- Enchaîner resize phone → tablet → desktop **sans** fermer la session
- À chaque resize : snapshot + screenshot + 1 click semaine + console
- Noter regress layout (overflow, catalogue coupé, jour non scrollable)

### 10. Smoke firefox + webkit
- Chapter : `"Smoke {{browser}}"`
- Nouvelle session `-s={{browser}}-desktop open … --browser={{browser}} --headed`
- `state-load` · goto builder · resize desktop · click semaine · console · screenshot
- Pas besoin de re-enregistrer toute la vidéo longue (optionnel : video séparée `…-{{browser}}.webm`)

### 11. Console & ressources
- Chapter : `"Console & images"`
- `console` (toutes erreurs + warnings)
- `mousewheel` pour lazy-load éventuel
- `eval` images cassées :
  ```js
  [...document.querySelectorAll('img')].filter(i=>!i.complete||i.naturalWidth===0).map(i=>i.src)
  ```

### 12. Fin
- Chapter : `"Rapport"`
- `video-stop` · `close` (ou `close-all`)

---

## Checklist fonctionnalités (cocher dans le rapport)

Pour chaque item : `OK` / `KO` / `PARTIAL` / `N/A` + viewport(s) + browser.

- [ ] Auth state-load → accès `/admin/programs`
- [ ] Liste programmes (filtre / créer visible)
- [ ] Ouverture builder programme
- [ ] Strip semaines (nav + indicateur actif)
- [ ] Ajout semaine (`+`) — smoke seulement
- [ ] Focus jour (`?day=`)
- [ ] Multi-séances / jour
- [ ] Blocs + exos affichés avec Rx
- [ ] Catalogue open/close
- [ ] Preview `i` catalogue
- [ ] Infos programme open/close
- [ ] Toggle calendrier / journées
- [ ] Phone ≤767 : layout empilé, menu semaine
- [ ] Tablet 768–1099 : scroll horizontal jours / catalogue
- [ ] Desktop ≥1100 : side days + catalogue
- [ ] Click-outside ne ferme pas le jour via chrome builder
- [ ] Console propre (0 error bloquante)
- [ ] Aucune image cassée critique

---

## Rapport HTML → visible depuis `/admin/spec`

### A. Fichier rapport (servi en static)

Écrire :

`public/qa/program-builder-{{STAMP}}.html`

URL locale : `{{BASE_URL}}/qa/program-builder-{{STAMP}}.html`

Contenu HTML autonome (inline CSS, DA sombre Trainly ok) avec :

1. **Header** : URL · `{{STAMP}}` · browsers · viewports · env (dev)
2. **4 métriques** : pages/vues testées · erreurs console · bugs · warnings
3. **Vidéo** : chemin relatif `../` ou note `recordings/qa-program-builder-{{STAMP}}.webm` + liste des chapters
4. **Matrice** : tableau Browser × Viewport → OK/KO/SKIP
5. **Bugs** : badge `Bloquant` / `Warning` / `Info` + repro + ref/locator
6. **✅ OK** : ce qui marche
7. **Screenshots** : images en **base64** (2 colonnes) — toutes les captures `recordings/qa-{{STAMP}}-*.png`
8. **Footer** : `Généré par Cursor + playwright-cli · {{STAMP}}`

### B. Branche Spec admin (obligatoire)

Mettre à jour `plans/workspace/admin.json` pour que le rapport soit visible dans Spec :

1. Sous le menu Catalogue / feature **Programmes & séances** (`f-adm-cat-programs`), ajouter (ou mettre à jour) un enfant feature :

```json
{
  "id": "f-adm-cat-programs-qa",
  "label": "QA — Program builder (rapports)",
  "route": "/qa/program-builder-{{STAMP}}.html",
  "bodyHtml": "<p><strong>Dernier rapport QA</strong> — {{STAMP}}</p><p><a href=\"/qa/program-builder-{{STAMP}}.html\" target=\"_blank\" rel=\"noopener\">Ouvrir le rapport HTML</a></p><p>Vidéo locale : <code>recordings/qa-program-builder-{{STAMP}}.webm</code> (non servie par Next — ouvrir dans l’IDE).</p><iframe src=\"/qa/program-builder-{{STAMP}}.html\" style=\"width:100%;min-height:70vh;border:1px solid var(--border,#333);border-radius:12px;background:#0c0c0e\" title=\"QA Program Builder\"></iframe>",
  "images": [],
  "children": [],
  "critiqueHtml": "<p>Généré automatiquement par le prompt QA Program Builder. Ne pas y coller de secrets.</p>"
}
```

2. Après write JSON : l’humain ouvre **`/admin/spec/admin`** → Catalogue → Programmes & séances → **QA — Program builder (rapports)**.

Ne pas committer `.playwright-auth/` ni secrets. `public/qa/*.html` et `recordings/` : selon `.gitignore` du repo (`recordings/` est ignoré ; les HTML `public/qa/` peuvent être commités si l’équipe le souhaite).

---

## Livrables attendus (fin de run)

1. Vidéo : `recordings/qa-program-builder-{{STAMP}}.webm`
2. Screenshots : `recordings/qa-{{STAMP}}-*.png`
3. Rapport : `public/qa/program-builder-{{STAMP}}.html`
4. Spec : feature mise à jour dans `plans/workspace/admin.json`
5. Résumé chat : 5–10 lignes (bugs bloquants d’abord) + lien `/admin/spec/admin` + `/qa/program-builder-{{STAMP}}.html`

## Placeholders à remplir avant lancement

```
BASE_URL=http://localhost:3000
PROGRAM_ID=________
STAMP=2026-10-20-1400   # ou date ISO courte
```
