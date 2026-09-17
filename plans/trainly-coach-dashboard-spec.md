# Trainly — Spec complète du dashboard coach

> Document de référence **modifiable**.  
> Stratégie : **tout construire pour Business**, puis gater Starter / ajouter Scale & Studio plus tard.  
> Remplace et enrichit [`trainly-routes-features.md`](./trainly-routes-features.md) comme source de vérité pour le dashboard coach.

**Comment lire ce doc :**

1. Chaque **Section** = entrée de la sidebar coach
2. Sous chaque section → **Sous-sections** (`####`)
3. Chaque ligne = **Fonctionnalité** · **Route** · **Détail** · **Redirection**

| Colonne | Contenu |
|---------|---------|
| **Fonctionnalité** | Nom court de la feature |
| **Route** | Chemin URL de la page ou de l’action |
| **Détail** | Description, comportement, notes |
| **Redirection** | Où ça renvoie après clic / alias / lien sortant (`—` si aucune) |

---

## Stratégie produit

| Étape | Action |
|-------|--------|
| **1. Build Business** | Toutes les fonctionnalités ci-dessous |
| **2. Gater Starter** | Bloquer modules + max 15 clients |
| **3. Ajouter Scale** | PWA, push, stats, Strava |
| **4. Ops Studio** | Domaine perso, stores, base isolée |

**Principe de build :** spécifier tout ici, coder ensuite par blocs. Comptabilité = UI prête, Stripe branché plus tard (données mock en attendant).

---

## Décisions techniques (validées pour la spec)

| Sujet | Décision |
|-------|----------|
| **Invitation client / showroom** | Page dédiée `/c/[coachSlug]/showroom` — distincte du portail client. Le client invité doit avoir un compte Trainly. Il choisit un programme public à rejoindre ; il rejoint automatiquement le groupe lié au programme. |
| **Bilans** | Templates dynamiques · assign clients/groupes · récurrence si prestation active · J+14 → Sans réponse + lock client · photos libres · flèche bilan précédent. |
| **Unités exercices custom** | Table `coach_exercise_units` (`coach_id`, `label`, `slug`) — unités perso du coach (tempo, charge, km, heure, etc.) en plus des unités par défaut. |
| **Types exercices** | Table `exercise_types` (`coach_id` nullable) — `coach_id = null` = type Trainly global ; `coach_id` renseigné = type perso du coach (maison, rééducation, fonctionnel, etc.). |
| **Stockage** | Quota **global** coach (Drive + chat + médias exos + covers…) consultable dans `/settings/storage`. Proposition : Starter 5 Go · Business 25 Go · Scale 100 Go · Studio devis. |
| **Corbeille** | Soft-delete **30 jours** transversal (Drive, exercices, programmes, nutrition, …) puis purge. |

---

## Shell coach (sidebar + topbar)

Sidebar gauche **repliable**. Remplace le header marketing sur `/dashboard/*`.  
**Exception :** program builder et nutrition builder = **plein écran**, sans sidebar.

### Ordre sidebar

| Section | Route racine | Redirection par défaut |
|---------|--------------|------------------------|
| Dashboard | `/dashboard` | — |
| Clients | `/clients` | `/clients/list` |
| Chat | `/chat` | `/chat` |
| Programme | `/dashboard/programs` | `/dashboard/programs/running` |
| Nutrition | `/nutrition/one-shot` | FIGÉ · one-shot / subscription / libs |
| Exercices | `/exercises` | `/exercises?tab=trainly` |
| Drive | `/drive` | `/drive` |
| Comptabilités | `/payments` | `/payments` |
| Profil public | `/profile` | 3 onglets + Voir le rendu + Codes pop-up | `/c/[slug]/showroom` |

### Topbar (toutes les pages dashboard sauf builders plein écran)

| Fonctionnalité | Route | Détail | Redirection |
|----------------|-------|--------|-------------|
| Icône paramètres | `/dashboard/settings` | Menu déroulant ou page settings | `/dashboard/settings` |
| Icône notifications | — | Badge si un client demande une action (RDV, paiement, bilan, message) | Liste notifications ou page concernée |
| Icône recherche | — | Recherche globale : clients, programmes, fonctionnalités de l’app | Résultat cliquable → route cible |

### Paramètres (depuis topbar) **(FIGÉ V1)**

| Fonctionnalité | Route | Détail |
|----------------|-------|--------|
| Compte coach | `/settings` | Nom, email, mot de passe · hub liens |
| Abonnement Trainly | `/settings/billing` | SaaS Stripe Billing |
| Stockage / quota | `/settings/storage` | Usage · corbeille J30 · 5/25/100 Go |
| **Statistiques** | `/settings/stats` | Funnel présence · A+B Business+ · C+D Scale · Starter teaser |
| Déconnexion | `/settings` | Menu |
| Branding / PWA | `/profile/mon-app` | Pas dans Settings |

**Stats ≠ Dashboard** : Stats = période / funnel (showroom, installs…) · Dashboard = KPI ops du jour.

Top-bar : cloche · recherche Ctrl/⌘K (clients, programmes, nutrition, drive).

**Connexion coach :** après login → redirection directe vers `/dashboard`.

---

## Routes publiques (marketing)

| Fonctionnalité | Route | Détail | Redirection |
|----------------|-------|--------|-------------|
| Accueil | `/` | Page d’accueil marketing | — |
| Mon app | `/mon-app` | Présentation app coach | — |
| Catalogue programmes | `/programs` | Programmes publiés Trainly | — |
| Détail programme | `/programme/[id]` | Fiche programme public | — |
| Simulation | `/simulation` | Simulateur + grilles tarifs | — |
| Contact | `/contact` | Demande d’offre | — |
| Login coach | `/login` | Connexion coach | `/dashboard` si déjà connecté |
| Login client | `/login` (ou `/c/[coachSlug]`) | Connexion client Trainly | Portail ou showroom selon contexte |
| Login admin | `/loginadmin` | Connexion admin | `/admin` si déjà connecté |

---

## Coach — Sections du dashboard

---

### `/home` — Dashboard **(FIGÉ V1)**

> Composition graphique / aérée + zone logo. ≠ `/settings/stats` (funnel).

| Élément | Détail |
|---------|--------|
| Layout | Logo/identité · hello · KPI légers · planning du jour · fil activité · aperçu paiements |
| KPI clients | Presta en cours |
| KPI programmes | Catalogue (transitoire) → En cours après alignement Gymkee |
| KPI nutrition | Plans En cours |
| KPI revenus | = Compta mois |
| Planning | RDV jour · groupe = réponse **individuelle** + détail visible coach |
| Fil activité | Séances / retours / bilans (pas d’IA) |
| Google Calendar | Hors V1 |

---

### `/clients` — Clients **(FIGÉ V1)**

> CRM coach. **4 onglets** : Liste · Groupes · Bilans · Notifications (hors V1, grisé).  
> Sidebar « Clients » → `/clients/list`.  
> *(Préfixe `/dashboard` éventuel côté app = même arbre.)*

**Règles transverses**

| Règle | Décision |
|-------|----------|
| Accès contenu | Via **prestation** (Profil public) uniquement |
| Prestations | Plusieurs prestations actives en parallèle = OK |
| Programme fitness | **Un seul démarré** à la fois (pause pour en démarrer un autre) |
| Nutrition | Peut coexister avec un fitness actif |
| Groupes | Auto = membres d’une prestation ; manuels = chat / drive / bilans — **pas** d’assign programme |
| Notifications hub | Hors V1 |

#### Navigation onglets

| Fonctionnalité | Route | Détail | Redirection |
|----------------|-------|--------|-------------|
| Onglet Liste | `/clients/list` | CRM clients | — |
| Onglet Groupes | `/clients/groupes` | Auto-prestation + manuels | — |
| Onglet Bilans | `/clients/bilans` | Templates + instances | — |
| Onglet Notifications | `/clients/notifications` | Grisé hors V1 · libellé « Notifications » | — |

#### Liste (`/clients/list`)

| Fonctionnalité | Route | Détail | Redirection |
|----------------|-------|--------|-------------|
| Liste | `/clients/list` | Nom · prestation(s) · avancement fitness démarré · dernière séance | `/clients/list/[id]` |
| Filtres | `/clients/list` | Prestation, groupe, programme, nom | — |
| Inviter | `/clients/list` | Tunnel showroom | `/c/[coachSlug]/showroom` |

#### Fiche client (`/clients/list/[id]`)

| Fonctionnalité | Route | Détail | Redirection |
|----------------|-------|--------|-------------|
| Programme fitness | `/clients/list/[id]/program` | Filtres En cours / Passé / À venir / En pause | `/clients/list/[id]/program/[progId]` |
| Éditer programme | `/clients/list/[id]/program/[progId]` | **Global** = racine (tous les affectés + futurs) · **Ce client** = fork | — |
| Nutrition | `/clients/list/[id]/nutrition` | Avancement + retours | `/clients/list/[id]/nutrition/[nutId]` |
| Éditer nutrition | `/clients/list/[id]/nutrition/[nutId]` | Même logique global vs fork | — |
| Prestation | `/clients/list/[id]/prestation` | Accès, abonnements, modules | `/profile` (hub prestations) |
| Bilans client | `/clients/list/[id]/bilan` | Liste + badge non lu coach | `/clients/bilans/[id]` |
| Assigner bilan | — | Redirect hub assign | `/clients/bilans/envoyer` |
| Notification | `/clients/list/[id]/notif` | Grisé hors V1 | — |
| Message | `/chat/[threadId]` | 1 thread / client (`threadId = clientId`) | — |
| Ajouter RDV | pop-up sur fiche | Conflit → avertissement | `/home/calendar` (opt.) |

#### Groupes (`/clients/groupes`)

| Fonctionnalité | Route | Détail | Redirection |
|----------------|-------|--------|-------------|
| Liste | `/clients/groupes` | Auto (prestation) / manuel · membres | `/clients/groupes/[id]` |
| Ajouter | pop-up | Nom, membres, chat et/ou Drive — **pas** de programme | — |
| Détail | `/clients/groupes/[id]` | Membres · chat · Drive · envoyer bilan | `/clients/bilans/envoyer` |
| Assign programme | — | **Interdit** (passe par prestation) | — |

#### Bilans (`/clients/bilans`) — déjà figé

| Fonctionnalité | Route | Détail | Redirection |
|----------------|-------|--------|-------------|
| Hub Tous / Templates | `/clients/bilans` · `?tab=templates` | Instances · modèles | — |
| Créer template | pop-up `/clients/bilans/new` | Photos (toggle libre) · Mensurations · Questions | Templates ou brouillon |
| Compléter | `/clients/bilans/brouillon` | Brouillons template | — |
| Envoyer | pop-up `/clients/bilans/envoyer` | Clients + groupes · récurrence (ex. 3 du mois) si prestation active · apparition + 14 j | — |
| Détail | `/clients/bilans/[id]` | Résumé (+ questions) · Photos · Mensurations · flèche précédent · Sans réponse si lock J+14 | — |

#### Notifications (`/clients/notifications`)

| Fonctionnalité | Route | Détail | Redirection |
|----------------|-------|--------|-------------|
| Hub | `/clients/notifications` | **Hors V1** (grisé) | — |

---

### `/chat` — Chat **(FIGÉ V1 — UI 2 colonnes)**

> Messagerie pro : inbox gauche + fil droite (bulles orange / gris).  
> Sidebar → `/chat`. Deep-link fiche → `/chat/[threadId]` (1:1 : threadId = clientId).  
> **1:1 coach↔client toujours possible.** Une presta « sans messagerie » = pas de chat de **groupe auto** entre clients — ça ne coupe pas le DM avec le coach.

| Fonctionnalité | Route | Détail | Redirection |
|----------------|-------|--------|-------------|
| Badge sidebar Chat | sidebar | Compteur total non lus · disparaît quand tout est lu | `/chat` |
| Inbox | `/chat` | Liste 1:1 + groupes · extrait · horodatage · badge non lus / conversation | `/chat/[threadId]` |
| Recherche | `/chat` | Filtre nom client / groupe (pas full-text messages V1) | — |
| Créer (+) | `/chat/nouveau` (pop-up) | **1:1** = tout client · **Groupe** = nom + description + membres (manuel) | `/chat/[threadId]` |
| Fil | `/chat/[threadId]` | Bulles · dates · composer · menu ⋮ · ouverture = marque lu | — |
| Renommer groupe | `/chat/[threadId]` | Nom + description (sync `/clients/groupes/[id]`) | — |
| Supprimer l’historique | `/chat/[threadId]` | Confirmation · vide les messages · garde la conversation · **coach only**, effet global | — |
| Pièces jointes | `/chat/[threadId]` | PDF, photo, vidéo, vocal · stockage **chat** (pas Drive auto) | — |
| Reply (quote) | `/chat/[threadId]` | Style WhatsApp | — |
| Lien entité | header | 1:1 → fiche client · groupe → fiche groupe | `/clients/list/[id]` ou `/clients/groupes/[id]` |
| Ajouter RDV | pop-up | Même pop-up que fiche · visible calendrier + fiche | `/home/calendar` |
| Client archivé | `/chat/[threadId]` | Thread **lecture seule** · composer off | — |

---

### `/programs` — Programme **(aligné Nutrition / Gymkee)**

> Détail : `coach.json` menu `programs`. Land `/programs` (En cours).

| Élément | Route | Détail |
|---------|-------|--------|
| En cours | `/programs` | Plans clients (+ pause datée) · **offres showroom 0 client** |
| Templates hub | `/programs/template` | Programmes \| Séances (+ créer) \| Blocs (+ créer) |
| Créer | `/programs/new` | Partir d’un template ? → builder · Enregistrer / Envoyer / Brouillon |
| Builder | `/programs/new` | Jumeau Nutrition · instances détachées · 1 preview shell |
| Envoyer | — | Client + presta Fitness · évolution presta/prix dans `/profile/prestations` |

**Vues presta×prog×clients** : En cours (suivi) · Template (moule + compteurs) · Fiche presta (lié + qui a reçu). Snapshot-first · pas de sync live « pour tout le monde ».

---

### `/nutrition` — Nutrition **(FIGÉ V1)**

> Détail : `coach.json` menu `nutrition`. UI Gymkee · template / presta / plan client.

| Élément | Route | Détail |
|---------|-------|--------|
| En cours (land) | `/nutrition` | 1 ligne = 1 plan client · pastille retour |
| Terminées / Brouillons / Templates | `/nutrition/done` · `brouillon` · `template` | Hub : **Plans \| Recettes (+ créer) \| Aliments (+ ajouter)** |
| Créer | `/nutrition/new` | Partir d’un template ? → builder |
| Builder | `/nutrition/new` | Jumeau program builder · 4 étages · DnD · totaux · header kcal/macros |

**Sorties** : Enregistrer template · Envoyer (client+presta) · sinon Brouillon. Update template = futures only.

---

### `/exercises` — Exercices **(FIGÉ V1)**

> Shell à **3 onglets** : Librairie Trainly (défaut) · Ma bibliothèque · Brouillon.  
> **2 CTA globaux** (toujours visibles) : Ajouter un exercice · Ajouter un type.  
> Séries / reps / unités = **program builder** uniquement (pas sur la fiche exo).

| Fonctionnalité | Route | Détail | Redirection |
|----------------|-------|--------|-------------|
| Shell / Trainly | `/exercises?tab=trainly` | Catalogue global lecture seule | `/exercises/[id]` |
| Rajouter à ma biblio | `/exercises/[id]/transfer` | Pop-up · **Transférer** → copie **détachée** `/mine` · pas d’autosave · Trainly intact | `/exercises/mine` |
| Ma bibliothèque | `/exercises/mine` | Exos publiés coach (utilisables builder) | `/exercises/mine/[id]` |
| Éditer mine | `/exercises/mine/[id]` | Autosave + bouton Sauvegarder (rassure) · remplacements multi (pas soi-même) | — |
| Brouillon | `/exercises/brouillon` | Non publiés · **pas** utilisables dans un programme | `/exercises/brouillon/[id]` |
| Éditer brouillon | `/exercises/brouillon/[id]` | Pas d’autosave · Sauvegarder → passe dans `/mine` | `/exercises/mine` |
| Ajouter un exercice | `/exercises/new` | Autosave **local** · **Sauvegarder** → `/mine` · quitter sans save → `/brouillon` · remplacements multi | — |
| Ajouter un type | pop-up | Pas de doublon de libellé (Trainly ou perso) · réutilisation OK · noms d’exo non uniques | — |

---

### `/drive` — Drive **(FIGÉ V1 — Ekklo-like)**

> 1 arbre coach + ACL portail. Client = **lecture seule**.  
> **Quota global** coach (pas Drive seul) dans `/settings/storage`.  
> **Corbeille J30** = règle plateforme (Drive, exos, programmes, nutrition…).  
> Chat médias ≠ Drive. Pas de lien public.

| Fonctionnalité | Route | Détail | Redirection |
|----------------|-------|--------|-------------|
| Racine | `/drive` | Recherche **globale** · filtres · liste/galerie · preview image/PDF/vidéo | `/drive/[folderId]` |
| Dossiers préconstruits | Admin (plus tard) | Packs poussés aux coaches depuis Admin — pas figés dans la spec coach V1 | — |
| Nouveau dossier | pop-up | Nom · dossier courant | — |
| Ouvrir dossier | `/drive/[folderId]` | Fil d’Ariane | — |
| Ajouter + | pop-up | DnD multi · 25 Mo image/PDF · 200 Mo vidéo | — |
| Partager | pop-up | **1 fichier ou 1 dossier** · clients+groupes · dossier = contenus futurs · pas zip/multi | `/c/[slug]/drive` |
| Supprimer | — | Corbeille **J30** (globale) | `/settings/storage` (corbeille) |
| Portail | `/c/[slug]/drive` | Preview + télécharger · pas d’écriture | — |
| Stockage | `/settings/storage` | Usage vs plafond · détail catégories · **5 / 25 / 100 Go** (Starter/Business/Scale) | — |

---

### `/payments` — Comptabilités **(aligné Trainly)**

> **Compta** = ledger + grants d’accès + renouvellements + factures.  
> **Catalogue d’offres** = `/profile/prestations` (création/édition).  
> Cash / chèque / CB chez le coach = marquage **Payé** lié à une prestation → **même grant** que Stripe.  
> Ledger **immuable** (statuts). Remboursement → accès coupé. Payeur = compte Trainly.  
> Stripe Connect = phase ultérieure ; UI + manuel + factures maison en V1.

| Fonctionnalité | Route | Détail | Redirection |
|----------------|-------|--------|-------------|
| Ledger paiements | `/payments` | Date · client · presta · montant · statut · source (Manuel/Lien/Stripe/Showroom) | fiche client |
| Paiement manuel | pop-up | Cash/chèque/TPE… · lier presta · Payé → grant auto | — |
| Lien 24h | pop-up | Compte Trainly requis · expiration stricte | — |
| Remboursement | action ligne | Statut Remboursé · retire accès · ligne conservée | — |
| Suivi clients | `/payments/suivi-clients` | Revenu = somme Payé · presta actives · échéances | — |
| Renouvellements | suivi | J-7 + J-1 in-app · **pas de notif** si déjà renouvelé/payé **avant J-5** | — |
| Factures | `/payments/factures` | Bouton **Générer facture** (pas d’auto) | — |
| Catalogue | `/profile/prestations` | Deep-link · presta libres (cours particulier…) | — |
| Stripe SaaS coach | `/settings/billing` | Abo Trainly (Billing) — distinct de Connect clients | — |

---

### `/profile` — Profil public

> **✅ FIGÉ** — détail dans `plans/workspace/coach.json` (menu `profile`). 0 ❓ ouvertes.

| Élément | Route | Détail |
|---------|-------|--------|
| Onglet Profil public | `/profile` | Contenu showroom · partager message+URL |
| Onglet Prestations | `/profile/prestations` | Catalogue · formulaire accès (modules, tarif unique/mensuel, 0..1 prog/nut) · Partager fiche · Lien 24h |
| Onglet Mon app | `/profile/mon-app` | Branding gated · questionnaire · lien install · upsell |
| Voir le rendu | `/profile?preview=1` | Mock prospect · questionnaire non sauvé · Passer → showroom |
| Codes promo | `/profile?popup=codes-promo` | Pop-up globale · showroom + lien 24h |
| Showroom | `/c/[slug]/showroom` | = invite Clients |
| Fiche presta | `/c/[slug]/showroom/[prestaId]` | Checkout |

**Presta V1** : modules Fitness · Nutrition · Drive · À la demande · Messagerie · Habitudes · abo = mensuel only · pas d’essai · pas booking Meet / produit fichier.

---

## Routes client (portail + showroom)

| Fonctionnalité | Route | Détail | Redirection |
|----------------|-------|--------|-------------|
| Landing / connexion | `/c/[coachSlug]` | Magic link, branding coach | `/c/[coachSlug]/programme` après auth |
| **Showroom (invitation / vitrine)** | `/c/[coachSlug]/showroom` | Profil public + prestations · checkout · = lien Partager Profil / Inviter | Grant → install → onboarding/login → portail |
| Fiche prestation | `/c/[coachSlug]/showroom/[prestaId]` | Détail + checkout 1 offre | Même suite post-pay |
| Programme assigné | `/c/[coachSlug]/programme` | Séances du programme actif | `/c/[coachSlug]/programme/[sessionId]` |
| Détail séance | `/c/[coachSlug]/programme/[sessionId]` | Exercices, consignes, validation | — |
| Calendrier | `/c/[coachSlug]/calendrier` | RDV ; accepter/refuser séances proposées | — |
| Nutrition | `/c/[coachSlug]/nutrition` | Plan alimentaire, recettes | — |
| Messages | `/c/[coachSlug]/messages` | Chat avec le coach | — |
| Profil | `/c/[coachSlug]/profil` | Infos perso, déconnexion | `/c/[coachSlug]` après déconnexion |
| Drive partagé | `/c/[coachSlug]/drive` | Fichiers partagés par le coach | — |
| Bilans | `/c/[coachSlug]/bilans` | Bilans à remplir | — |

**Hors portail :** `/preview/[token]` — aperçu programme partagé par email.

---

## Routes admin (Trainly interne)

| Fonctionnalité | Route | Détail | Redirection |
|----------------|-------|--------|-------------|
| Hub admin | `/admin` | Accueil admin | — |
| Tous les programmes | `/admin/programs` | Liste globale | `/admin/programs/[id]/editor-v2` |
| Éditeur admin | `/admin/programs/[id]/editor-v2` | Program builder (legacy route admin) | — |
| Envoyer aperçu email | `/admin/programs/[id]/share` | Token + email Resend | `/preview/[token]` dans l’email |
| Catalogue global | `/admin/exercises` | Gestion exercices plateforme | — |
| Templates | `/admin/templatemuscu` | Programmes modèles | — |
| Design system | `/admin/design` | Tokens, composants | — |

---

## Entités données (référence build)

| Entité | Rôle |
|--------|------|
| `clients` | Clients réels liés à `coach_id` (remplace `demo_clients`) |
| `client_groups` | Groupes coach |
| `coach_subscriptions` | Palier Trainly du coach |
| `coach_branding` | White-label |
| `programs` | + champs `status` (running/public/done/brouillon), `type`, `progress` |
| `nutrition_plans` | Même logique statuts que programmes |
| `bilan_templates` / `bilan_assignments` / `bilan_responses` | Bilans dynamiques |
| `notifications` / `habits` | Notifs et habitudes client/groupe |
| `calendar_events` | RDV avec statut pending/accepted/refused |
| `conversations` / `messages` | Chat (remplace demo_*) |
| `drive_folders` / `drive_files` | Drive avec partage |
| `payments` / `invoices` / `subscriptions` | Mock puis Stripe |
| `exercise_types` | Types globaux + perso coach |
| `coach_exercise_units` | Unités perso coach |

---

## Gating futur (référence — pas à coder maintenant)

| Section | Starter | Business | Scale | Studio |
|---------|:-------:|:--------:|:-----:|:------:|
| Dashboard | ✅ | ✅ | ✅ | ✅ |
| Clients | max 15 | max 75 | max 200 | 500+ |
| Chat | ❌ | ✅ | ✅ | ✅ |
| Programme | ✅ | ✅ | ✅ | ✅ |
| Nutrition | ❌ | ✅ | ✅ | ✅ |
| Exercices perso | ❌ | ✅ | ✅ | ✅ |
| Drive | ❌ | ✅ | ✅ | ✅ |
| Comptabilités | ❌ | ✅ (UI) | ✅ + Stripe | ✅ |
| Profil public / stats | basique | ✅ | ✅ + analytics | ✅ 100% |

---

## Ordre de build recommandé

1. **Spec validée** — ce document
2. **Schéma Supabase** — entités ci-dessus, RLS multi-tenant, régénérer `database.types.ts`
3. **Shell coach** — sidebar, topbar, layout, redirections par défaut
4. **Dashboard home** — KPIs (mock puis réel)
5. **Clients** — liste, fiche, groupes, invitation → showroom
6. **Programmes** — 5 onglets + program builder refondu
7. **Chat** — messagerie pro multi-tenant
8. **Calendrier** — RDV + accept/refuse + notifs
9. **Nutrition** — 5 onglets + nutrition builder
10. **Exercices** — 3 onglets + types + unités
11. **Drive** — dossiers, upload, partage
12. **Bilans + Notifications** — templates, assignation, habitudes
13. **Comptabilités** — UI GymPay (mock)
14. **Portail client** — `/c/[coachSlug]/*` + showroom
15. **Stripe** — brancher paiements réels
16. **Gating Starter** — puis Scale / Studio

---

## Hors scope (V1 Business)

- Gamification (marketing only)
- Automatisations type Zapier
- App Store (Studio signé)
- Multi-coach / équipes
- Strava (Scale)
- PWA push (Scale)

---

## Conventions routes

| Pattern | Exemple |
|---------|---------|
| Liste avec onglets | `/dashboard/clients/list`, `/dashboard/programs/running` |
| Fiche avec sous-pages | `/dashboard/clients/list/[id]/infos` |
| Builder plein écran | `/dashboard/programs/new`, `/dashboard/nutrition/new` |
| Portail client | `/c/[coachSlug]/...` |
| Showroom invitation | `/c/[coachSlug]/showroom` |

---

*Pour une nouvelle sous-section : copier `#### Sous-section` + tableau Fonctionnalité · Route · Détail · Redirection.*
