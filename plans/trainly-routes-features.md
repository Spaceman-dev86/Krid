# Trainly — Routes & fonctionnalités

> **Spec détaillée coach :** voir [`trainly-coach-dashboard-spec.md`](./trainly-coach-dashboard-spec.md) (document de référence principal pour le dashboard coach).

> Document de référence **modifiable** (vue synthétique).  
> Stratégie : **tout construire pour Business**, puis gater Starter / ajouter Scale & Studio plus tard.

**Comment remplir ce doc :**

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

---

## Shell coach (sidebar)

Sidebar gauche repliable. Remplace le header marketing sur `/dashboard/*`.  
**Exception :** éditeur programme = plein écran, sans sidebar.

### Ordre sidebar

| Section | Route racine | Redirection par défaut |
|---------|--------------|------------------------|
| Dashboard | `/dashboard` | — |
| Clients | `/dashboard/clients` | — |
| Chat | `/dashboard/chat` | — |
| Programme | `/dashboard/programs` | — |
| Nutrition | `/dashboard/nutrition` | — |
| Exercices | `/dashboard/exercises` | — |
| Drive | `/dashboard/drive` | — |
| Comptabilités | `/dashboard/payments` | — |
| Profil public | `/dashboard/profile` | — |

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
| Login admin | `/loginadmin` | Connexion admin | `/admin` si déjà connecté |

---

## Coach — Sections du dashboard

> Copier un bloc `#### Sous-section` + tableau pour en ajouter une.

---

### `/dashboard` — Dashboard

> Vue d’ensemble, onboarding, paramètres coach.

#### Sous-section : Accueil

| Fonctionnalité | Route | Détail | Redirection |
|----------------|-------|--------|-------------|
| Vue d’ensemble (KPIs) | `/dashboard` | nb clients · programmes · messages · prochain RDV | — |
| Revenus des derniers mois | `/dashboard` | Graphique / tableau revenus | — |
| Mon offre / upgrade | `/dashboard` | Carte palier actuel | `/simulation` |

#### Sous-section : Paramètres

| Fonctionnalité | Route | Détail | Redirection |
|----------------|-------|--------|-------------|
| Profil coach | `/dashboard/settings` | Nom, email, mot de passe | — |
| Abonnement Trainly | `/dashboard/settings/billing` | Facturation abonnement SaaS | — |
| Branding white-label | `/dashboard/settings/branding` | Logo, couleurs, nom app | — |

#### Sous-section : Calendrier

| Fonctionnalité | Route | Détail | Redirection |
|----------------|-------|--------|-------------|
| | | | |

---

### `/clients` — Clients

> CRM coach : liste, fiches, invitation portail.

#### Sous-section : Liste & fiches

| Fonctionnalité | Route | Détail | Redirection |
|----------------|-------|--------|-------------|
| Liste clients | `/dashboard/clients` | Recherche, statut, tri | — |
| Ajouter client | `/dashboard/clients/new` | Email, nom | `/dashboard/clients/[id]` après création |
| Fiche client | `/dashboard/clients/[id]` | Programmes assignés, activité | — |
| Inviter (magic link) | `/dashboard/clients/[id]/invite` | Envoi lien portail client | — |

#### Sous-section : _[à compléter]_

| Fonctionnalité | Route | Détail | Redirection |
|----------------|-------|--------|-------------|
| | | | |

---

### `/chat` — Chat

> Messagerie coach ↔ client.

#### Sous-section : Conversations

| Fonctionnalité | Route | Détail | Redirection |
|----------------|-------|--------|-------------|
| Liste conversations | `/dashboard/chat` | Tous les fils actifs | `/dashboard/chat/[id]` au clic |
| Fil de discussion | `/dashboard/chat/[id]` | Réponses, réactions, pièces jointes | `/dashboard/calendar` (planifier séance) |

#### Sous-section : _[à compléter]_

| Fonctionnalité | Route | Détail | Redirection |
|----------------|-------|--------|-------------|
| | | | |

---

### `/programme` — Programme

> Création et gestion des programmes sportifs. **Éditeur V2 : ne pas refondre.**

#### Sous-section : Mes programmes

| Fonctionnalité | Route | Détail | Redirection |
|----------------|-------|--------|-------------|
| Liste programmes | `/dashboard/programs` | Créer, dupliquer, publier | `/dashboard/programs/new` · `/dashboard/programs/[id]` |
| Créer programme | `/dashboard/programs/new` | Nouveau programme vide ou template | `/dashboard/programs/[id]` après création |
| Éditeur V2 | `/dashboard/programs/[id]` | Semaines, séances, blocs, exercices | — |
| Aperçu coach | `/dashboard/programs/[id]/preview` | Rendu tel que vu par le coach | — |
| Aperçu rendu public | `/dashboard/preview/[id]` | Mockup phone / structure read-only | — |

#### Sous-section : Publication & partage

| Fonctionnalité | Route | Détail | Redirection |
|----------------|-------|--------|-------------|
| Publier programme | `/dashboard/programs/[id]` | Dialog publish + cover | `/programme/[id]` si publié |
| Envoyer aperçu email | `/admin/programs/[id]/share` | Token + email Resend (admin) | `/preview/[token]` dans l’email |

#### Sous-section : _[à compléter]_

| Fonctionnalité | Route | Détail | Redirection |
|----------------|-------|--------|-------------|
| | | | |

---

### `/nutrition` — Nutrition

> Plans alimentaires et recettes.

#### Sous-section : Plans clients

| Fonctionnalité | Route | Détail | Redirection |
|----------------|-------|--------|-------------|
| Plan hebdo par client | `/dashboard/nutrition` | Calendrier repas, macros | — |

#### Sous-section : Recettes

| Fonctionnalité | Route | Détail | Redirection |
|----------------|-------|--------|-------------|
| Liste recettes | `/dashboard/nutrition/recipes` | Bibliothèque recettes coach | `/dashboard/nutrition/recipes/[id]` |
| Créer recette | `/dashboard/nutrition/recipes/new` | Formulaire nouvelle recette | `/dashboard/nutrition/recipes/[id]` après création |
| Éditer recette | `/dashboard/nutrition/recipes/[id]` | Ingrédients, macros, étapes | — |

#### Sous-section : _[à compléter]_

| Fonctionnalité | Route | Détail | Redirection |
|----------------|-------|--------|-------------|
| | | | |

---

### `/exercices` — Exercices

> Catalogue global + bibliothèque personnelle coach.

#### Sous-section : Catalogue global

| Fonctionnalité | Route | Détail | Redirection |
|----------------|-------|--------|-------------|
| Liste exercices | `/dashboard/exercises` | Catalogue Trainly, lecture seule | `/dashboard/exercises/[id]` |
| Fiche exercice | `/dashboard/exercises/[id]` | Démo, muscles, consignes | — |

#### Sous-section : Ma bibliothèque

| Fonctionnalité | Route | Détail | Redirection |
|----------------|-------|--------|-------------|
| Mes exercices | `/dashboard/exercises/mine` | CRUD exercices du coach | `/dashboard/exercises/mine/new` · fiche exercice |
| Créer exercice perso | `/dashboard/exercises/mine/new` | Nouvel exercice custom | `/dashboard/exercises/mine` ou fiche après création |

#### Sous-section : _[à compléter]_

| Fonctionnalité | Route | Détail | Redirection |
|----------------|-------|--------|-------------|
| | | | |

---

### `/drive` — Drive

> Fichiers, documents, médias partagés avec les clients.

#### Sous-section : _[à définir]_

| Fonctionnalité | Route | Détail | Redirection |
|----------------|-------|--------|-------------|
| | | | |

#### Sous-section : Calendrier _(à déplacer ? section dédiée)_

| Fonctionnalité | Route | Détail | Redirection |
|----------------|-------|--------|-------------|
| Vue calendrier | `/dashboard/calendar` | Mois, CRUD événements, lien client | — |

---

### `/comptabilités` — Comptabilités

> Paiements, ventes, facturation.

#### Sous-section : Paiements

| Fonctionnalité | Route | Détail | Redirection |
|----------------|-------|--------|-------------|
| Ventes & abonnements | `/dashboard/payments` | Stripe, historique paiements clients | — |
| Offres vendables | `/dashboard/payments/products` | Programmes et packs monétisables | — |

#### Sous-section : _[à compléter]_

| Fonctionnalité | Route | Détail | Redirection |
|----------------|-------|--------|-------------|
| | | | |

---

### `/profil-public` — Profil public

> Présence en ligne du coach, stats, intégrations.

#### Sous-section : Analytics

| Fonctionnalité | Route | Détail | Redirection |
|----------------|-------|--------|-------------|
| Statistiques clients | `/dashboard/analytics` | Adhérence, séances complétées | — |

#### Sous-section : Intégrations

| Fonctionnalité | Route | Détail | Redirection |
|----------------|-------|--------|-------------|
| Strava | `/dashboard/integrations/strava` | Sync activités montres | OAuth Strava → retour dashboard |
| Config PWA client | `/dashboard/settings/pwa` | Install prompt portail client | — |

#### Sous-section : _[à compléter]_

| Fonctionnalité | Route | Détail | Redirection |
|----------------|-------|--------|-------------|
| | | | |

---

## Routes client (portail sportif)

> Branding coach · sous-domaine `tonnom.trainly.app` · accès magic link

| Fonctionnalité | Route | Détail | Redirection |
|----------------|-------|--------|-------------|
| Landing / connexion | `/c/[coachSlug]` | Magic link, branding coach | `/c/[coachSlug]/programme` après auth |
| Programme assigné | `/c/[coachSlug]/programme` | Séances du programme actif | `/c/[coachSlug]/programme/[sessionId]` |
| Détail séance | `/c/[coachSlug]/programme/[sessionId]` | Exercices, consignes, validation | — |
| Calendrier | `/c/[coachSlug]/calendrier` | Prochains RDV et séances | — |
| Nutrition | `/c/[coachSlug]/nutrition` | Plan alimentaire, recettes | — |
| Messages | `/c/[coachSlug]/messages` | Chat avec le coach | — |
| Profil | `/c/[coachSlug]/profil` | Infos perso, déconnexion | `/c/[coachSlug]` après déconnexion |

**Hors portail :** `/preview/[token]` — aperçu programme partagé par email (admin).

---

## Routes admin (Trainly interne)

| Fonctionnalité | Route | Détail | Redirection |
|----------------|-------|--------|-------------|
| Hub admin | `/admin` | Accueil admin | — |
| Tous les programmes | `/admin/programs` | Liste globale | `/admin/programs/[id]/editor-v2` |
| Éditeur admin | `/admin/programs/[id]/editor-v2` | Même éditeur V2 | — |
| Catalogue global | `/admin/exercises` | Gestion exercices plateforme | — |
| Templates | `/admin/templatemuscu` | Programmes modèles | — |
| Design system | `/admin/design` | Tokens, composants | — |

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
| Comptabilités | ❌ | ✅ | ✅ | ✅ |
| Profil public / stats | basique | ✅ | ✅ + analytics | ✅ 100% |

---

## Ordre de build

1. Data — `clients`, `coach_subscriptions`, `coach_branding`, RLS
2. Business core — clients + programmes + portail + branding
3. Business+ — nutrition, chat, calendrier multi-tenant
4. Shell UI — sidebar depuis ce doc
5. Stripe + sous-domaine
6. Gating Starter
7. Scale / Studio

---

## Hors scope

- Gamification (marketing only)
- Automatisations type Zapier
- App Store (Studio signé)
- Multi-coach / équipes

---

*Pour une nouvelle sous-section : copier `#### Sous-section` + tableau Fonctionnalité · Route · Détail · Redirection.*
