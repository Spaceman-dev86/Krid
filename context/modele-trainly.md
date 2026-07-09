# Modèle Trainly — SaaS + Studio + Rachat

## En une phrase

Tu loues d'abord ton outil au coach (**SaaS**). Les gros peuvent avoir **leur propre version** (**Studio**). Plus tard, ils peuvent **racheter** l'app et partir avec (**Rachat**).

---

## C'est quoi le « white-label » ?

Imagine une bouteille d'eau :

- **Sans white-label** : la bouteille dit « Trainly ». Le client voit Trainly.
- **Avec white-label** : tu colles l'étiquette du coach (« Coaching Remi »). Le client voit **son** coach, pas Trainly.

**Techniquement :** c'est la **même app**, le même code, le même serveur.  
Seul le **habillage** change : logo, couleurs, nom, adresse web (`remi.trainly.app`).

Le coach a **l'impression** d'avoir son app.  
Toi tu n'as **qu'une seule app** à maintenir.

> White-label = « étiquette blanche » qu'on remplace par la marque du coach.

---

## Les 3 niveaux — expliqué simplement

```
┌─────────────────────────────────────────────────────────┐
│  NIVEAU 1 — TRAINLY (SaaS)          → 39–179 €/mois   │
│  Le coach loue ton outil. Même immeuble pour tous.      │
│  Son logo sur la porte, mais l'immeuble est à toi.    │
├─────────────────────────────────────────────────────────┤
│  NIVEAU 2 — STUDIO                    → 299 €+/mois    │
│  Le coach a son propre appartement dans l'immeuble.     │
│  Plus d'espace, plus d'options. Tu entretiens.        │
├─────────────────────────────────────────────────────────┤
│  NIVEAU 3 — RACHAT                    → 15 000 €+      │
│  Le coach achète les clés. Il part avec son appart.    │
│  Tu n'as plus rien à faire (sauf passation 2 semaines).│
└─────────────────────────────────────────────────────────┘
```

---

## Niveau 1 — Trainly SaaS (90 % des coaches)

**Ce que le coach fait :** il paie chaque mois, il utilise ton site.

**Ce qu'il voit :** son logo, ses couleurs, ses clients, ses programmes.  
**Ce qu'il ne voit pas :** Trainly (ou une petite mention discrète).

**Ce que tu fais :** tu maintiens **1 seul site** pour tout le monde.

| Palier | Prix | Clients | Promesse |
|--------|------|---------|----------|
| Starter | 39 €/mois | 15 | Je démarre |
| Business ★ | 89 €/mois | 75 | J'ai mon app (white-label) + paiements |
| Scale | 179 €/mois | 200 | Je grandis (PWA mobile, Strava) |

**Pas de rachat possible.** C'est une location, comme Netflix.

### Strava & montres — où ça se place

| Palier | Strava ? |
|--------|----------|
| Starter / Business | ❌ Non |
| Scale | ✅ Oui (seul palier SaaS) |
| Studio | ✅ Oui (hérite de Scale — ce n'est **pas** ce qui justifie Studio) |

**Comment le vendre :** « Sync **Strava** — montres compatibles Strava (Garmin, Apple Watch, etc.) »  
**Ne pas dire :** « Connexion montres connectées » (implique API directe Apple/Garmin = cauchemar maintenance).

**Alternative plus tard :** add-on **+25 €/mois** au lieu de l'inclure dans Scale, pour couvrir la maintenance.

**Ordre de build :** Strava **après** Business + PWA — pas avant d'avoir des clients payants.

---

## Niveau 2 — Trainly Studio (5–10 coaches max)

**Pour qui :** coach qui veut un **actif** (pas juste un outil), avec une **sortie possible** un jour.

> ⚠️ Studio ≠ « je customise ton app ».  
> Studio = **plus de liberté, plus d'isolation, droit de racheter un jour**.  
> Pas de dev sur-mesure — jamais.

### Ce que Studio apporte EN PLUS du Scale (179 €)

| Avantage Studio | Ce que le coach comprend | Ce que tu fais techniquement |
|-----------------|--------------------------|------------------------------|
| **Zéro mention Trainly** | « C'est 100 % mon app » | Tu retires footer / logo Trainly partout |
| **Domaine perso** | `app.remicoaching.fr` | DNS + certificat SSL |
| **Données isolées** | « Mes clients ne sont pas dans un pot commun » | Base Supabase dédiée |
| **Clause de rachat** | « Un jour je peux acheter et partir » | Contrat + prix fixé à l'avance |
| **App Store à son nom** | « Mon app sur l'iPhone » | Build Capacitor avec son bundle ID (pas du custom code) |
| **Onboarding humain** | « On m'installe tout » | Import programmes, config branding (setup 1 500 €+) |
| **Support prioritaire** | Réponse rapide, contact direct | Toi, pas une FAQ |
| **Limites levées** | 500+ clients | Quotas DB plus hauts |

### Ce que Studio n'est PAS

- ❌ Pas de nouvelles fonctionnalités inventées pour lui
- ❌ Pas de design custom (autre layout, autre UX)
- ❌ Pas de « ajoute-moi cette feature »
- ❌ Pas plus de modules que Scale — **les mêmes**, mais **mieux emballés + sortie possible**

### Pourquoi il paie plus cher alors que « ça ressemble pareil » ?

Il n'achète pas des boutons en plus. Il achète :

1. **L'actif** — une app qu'il pourra racheter (Ekklo ne propose jamais ça)
2. **La crédibilité** — domaine perso + App Store = plus pro face à ses clients
3. **La sécurité** — ses données à part, pas mélangées aux autres coaches
4. **Le service** — tu configures tout, il ne bricole pas

**Analogie :** Scale = voiture de location premium. Studio = même voiture, mais **contrat avec option d'achat** + **plaque perso** + **garage à ton nom**.

**Ce que tu fais :** tu maintiens tant qu'il paie (299 €+/mois + setup 1 500 €+).

**Ce que le coach n'a PAS :** le code source (tant qu'il n'a pas racheté).


---

## Niveau 3 — Rachat (option après 24 mois Studio)

**Le coach paie une grosse somme une fois** (ex. 15 000–40 000 €).

**Tu lui donnes :**
- Le code (version figée)
- Ses données
- 2 semaines pour lui expliquer à son nouveau dev

**Après :** plus d'abonnement, plus de support de ta part. C'est fini.

C'est comme racheter sa voiture après l'avoir louée longtemps.

---

## Pourquoi c'est différent d'Ekklo ?

| Ekklo | Trainly |
|-------|---------|
| Tu payes pour toujours | Tu peux **racheter et partir** |
| Plateforme généraliste | Meilleur sur les **programmes** |
| Lock-in | **Sortie prévue** au contrat |

---

## Ce que tu construis (technique)

**Une seule app. Toujours.**

```
coach clique « upgrade » → tu changes un flag en base → nouvelles fonctions débloquées
```

Pas de copier-coller manuel. Pas d'app différente par coach (sauf Studio = config isolée).

**3 choses à coder en priorité :**
1. `coach_subscriptions` — qui paie quoi
2. `coach_branding` — logo, couleurs, nom (white-label)
3. `export-coach.ts` — pour le jour du rachat

---

## Règles pour ne pas te noyer

| ✅ Oui | ❌ Non |
|--------|--------|
| 1 codebase | 1 app custom par coach |
| White-label = config | White-label = dev sur-mesure |
| Rachat = contrat + prix fixé | « Tu es propriétaire » à 49 €/mois |
| Studio max 10 clients | Studio en self-serve illimité |
| PWA pour le mobile | App Store par coach incluse |

---

## Copy marketing

| Ne pas dire | Dire |
|-------------|------|
| Deviens propriétaire de ton app | Lance ton app de coaching |
| App sur les stores | App installable sur mobile |
| (SaaS) Tu possèdes le code | (Studio) Ton app peut devenir rachetable |

---

## Ordre de build

1. **Business** — clients réels, white-label, Stripe
2. **Starter / Scale** — paliers autour
3. **Studio** — quand 3 coaches demandent plus
4. **Rachat** — script d'export + contrat (pas avant d'avoir 1 client Studio)

---

## SaaS vs Studio — qu'est-ce qui change techniquement ?

### SaaS (mode normal)

```
1 site Vercel (trainly.app)
1 base Supabase (tous les coaches dedans)
Chaque coach = des lignes en base avec son coach_id
URL : remi.trainly.app  →  le site lit coach_id de Remi
```

Tout le monde vit dans le **même immeuble**. Chaque coach a sa **clé d'appartement** (`coach_id`).

---

### Studio (mode isolé)

```
Même code source
+ son propre domaine (app.remicoaching.fr)
+ sa propre base Supabase (ou schéma dédié)
+ 1 déploiement Vercel avec COACH_ID fixe (optionnel au début)
```

Le coach a **son propre appartement** — murs plus épais, adresse perso, plus facile à « vendre » au moment du rachat.

---

### Tableau comparatif

| | SaaS | Studio |
|--|------|--------|
| Code | `apps/platform` | **Le même** |
| Base de données | Partagée (`coach_id`) | **Projet Supabase séparé** |
| URL | `remi.trainly.app` | `app.remicoaching.fr` |
| Config | `coach_branding` en base | + variables d'env dédiées |
| Maintenance pour toi | 1 deploy | 1 deploy par Studio (scripté) |
| Rachat possible | Non | Oui (export propre) |

---

## Passage SaaS → Studio : étape par étape

**Côté coach :** il clique « Passer en Studio » (ou tu le fais manuellement). Il paie le setup.  
**Côté toi :** un script tourne (pas à la main).

```
1. Export     →  tu récupères toutes les données du coach (clients, programmes, branding…)
2. Provision  →  tu crées sa base Supabase + tu configures son domaine
3. Import     →  tu injectes ses données dans sa nouvelle base
4. Deploy     →  tu déploies le même code, avec COACH_ID=remi en env
5. DNS        →  app.remicoaching.fr pointe vers ce deploy
6. Bascule    →  remi.trainly.app redirige vers app.remicoaching.fr
7. Fini       →  le coach se reconnecte, tout est là
```

**Le coach ne recrée rien.** Ses clients, programmes et clients restent. Seule l'adresse change.

Durée cible : **automatisé en 30 min**, pas 2 jours de travail manuel.

---

## Ce que tu dois rajouter dans le code (par priorité)

### Déjà nécessaire pour le SaaS
- `coach_subscriptions` (plan, statut Stripe)
- `coach_branding` (logo, couleurs, sous-domaine)
- RLS : chaque coach ne voit que ses données

### À rajouter pour le Studio (quand tu en as besoin)

| Élément | À quoi ça sert |
|---------|----------------|
| `deployment_mode` | `'shared'` ou `'dedicated'` sur l'abonnement |
| `coach_instances` | domaine, URL Supabase, statut migration |
| `export-coach.ts` | sort toutes les données d'un coach en JSON |
| `import-coach.ts` | injecte ce JSON dans une base vide |
| `provision-studio.ts` | enchaîne export → créa base → import → deploy |
| Middleware domaine | `app.remicoaching.fr` → charge le bon coach |
| Redirect | ancien sous-domaine → nouveau domaine |

### Ce que tu ne rajoutes PAS
- Pas de nouveau produit à coder
- Pas de features différentes (mêmes modules, plus isolés)
- Pas de code custom par coach

---

## Astuce : Studio en 2 temps

**Studio léger (phase 1)** — sans clone, pour tester :
- Même base partagée
- Juste le **domaine custom** + contrat rachat
- Coût dev : 1–2 jours

**Studio complet (phase 2)** — quand un client paie vraiment :
- Base Supabase dédiée + script de migration
- Prêt pour le rachat plus tard
- Coût dev : 1–2 semaines

Ne build la phase 2 **que** quand tu as un client Studio signé.

---

# Proposition offres — copy site (vue coach)

*Texte prêt à adapter sur `/simulation` ou une page Tarifs.*

---

## En-tête section

**Eyebrow :** Offres  
**Titre :** Lance ton app de coaching  
**Sous-titre :** Des formules qui évoluent avec toi — de tes premiers clients jusqu'à ton app sur l'App Store, avec une sortie possible si tu veux un jour racheter ton outil.

**CTA secondaire :** Essayer gratuitement · **CTA principal :** Choisir Business

---

## Carte 1 — Starter

**39 € / mois** · sans engagement

**Pour qui :** tu démarres et tu veux un outil pro sans te ruiner.

**Jusqu'à 15 clients actifs**

✓ Éditeur de programmes  
✓ Bibliothèque d'exercices  
✓ Portail client web  
✓ Planning & gestion client  
✓ Calendrier basique  

✗ White-label (marque Trainly visible)  
✗ Paiement in-app  
✗ Nutrition  

**Bouton :** Choisir Starter

---

## Carte 2 — Business ★ Populaire

**89 € / mois** · sans engagement

**Pour qui :** tu veux **ton app à ton image** et faire payer tes clients directement.

**Jusqu'à 75 clients actifs**

✓ Tout Starter  
✓ **White-label** — logo, couleurs, nom de ton app  
✓ Adresse perso `tonnom.trainly.app`  
✓ **Paiements Stripe** — tes clients paient dans ton app  
✓ Nutrition & recettes  
✓ Ta base d'exercices perso  
✓ Chat coach ↔ client  
✓ Rappels automatiques par email  

✗ App installable mobile (PWA)  
✗ Sync Strava  

**Bouton :** Choisir Business

> *« Mes clients voient mon logo, pas Trainly. Je facture sans courir après les virements. »*

---

## Carte 3 — Scale

**179 € / mois** · sans engagement

**Pour qui :** tu scales et tu veux une expérience mobile complète pour tes clients.

**Jusqu'à 200 clients actifs**

✓ Tout Business  
✓ **App installable** sur mobile (PWA — icône à ton nom)  
✓ Notifications push web  
✓ **Sync Strava** — activités cardio (montres compatibles Strava)  
✓ Statistiques clients avancées  
✓ Support prioritaire  

✗ App Store iOS / Android  
✗ Rachat de l'app  

**Bouton :** Choisir Scale

---

## Carte 4 — Studio

**À partir de 299 € / mois** · sur candidature  
**+ 1 500 € de mise en place** (installation, import, branding)

**Pour qui :** tu construis un **vrai actif** — app 100 % à ton nom, avec la possibilité de **racheter** ton outil un jour.

**500+ clients · instance dédiée**

✓ Tout Scale  
✓ **Zéro mention Trainly** — 100 % ta marque  
✓ **Domaine perso** `app.tonnom.fr`  
✓ **App Store & Google Play** à ton nom  
✓ Données isolées (base dédiée)  
✓ **Clause de rachat** — prix fixé dès le contrat  
✓ Onboarding humain — on configure tout pour toi  
✓ Support direct & prioritaire  

**Bouton :** Candidater au Studio

> *« Comme Ekklo, mais avec une sortie. Un jour, tu peux racheter et partir avec ton app. »*

---

## Bandeau rachat (sous les cartes)

**Tu es en Studio depuis 24 mois ?**

Tu peux **racheter ton app** (code + données + passation).  
Prix indicatif : **15 000 à 40 000 €** selon modules — fixé à la signature du contrat Studio.

**Bouton :** En savoir plus sur le rachat

---

## Message sous les cartes

Si tu as des besoins particuliers (studio multi-coachs, volume 500+ clients, intégrations spécifiques), contacte-nous — on te répond rapidement avec une proposition sur mesure.

**Boutons :** Nous contacter · Se connecter

---

## FAQ courte (sous la grille)

**C'est quoi le white-label ?**  
Ton logo, tes couleurs, ton nom — tes clients voient **ton** coaching, pas Trainly.

**Je peux changer d'offre ?**  
Oui, à tout moment. Upgrade instantané, tes données restent.

**Starter vs Business ?**  
Starter = tu utilises Trainly. Business = **c'est ton app** aux yeux de tes clients + paiements intégrés.

**Scale vs Studio ?**  
Scale = tu loues une super app. Studio = **ton app sur ton domaine et les stores**, avec option de rachat un jour.

**L'app mobile, c'est quoi exactement ?**  
Scale = app installable depuis le navigateur (PWA). Studio = publication **App Store & Play Store** à ton nom.

**Strava, ça marche avec quelles montres ?**  
Toutes celles qui synchronisent avec Strava (Garmin, Apple Watch via Strava, etc.).

**Je possède le code ?**  
En SaaS (Starter → Scale), non — tu loues. En Studio, tu peux **racheter** après 24 mois si c'est prévu au contrat.

**Ekklo vs Trainly ?**  
Ekklo = location à vie. Trainly = même qualité d'outil, **meilleur éditeur de programmes**, et une **sortie possible** en Studio.

---

## Comparatif rapide (tableau site)

| | Starter | Business ★ | Scale | Studio |
|--|---------|------------|-------|--------|
| Prix/mois | 39 € | 89 € | 179 € | 299 €+ |
| Clients | 15 | 75 | 200 | 500+ |
| White-label | — | ✅ | ✅ | ✅ 100 % |
| Paiements in-app | — | ✅ | ✅ | ✅ |
| App mobile | Web | Web | PWA | App Store |
| Strava | — | — | ✅ | ✅ |
| Domaine perso | — | sous-domaine | sous-domaine | `app.tonnom.fr` |
| Rachat possible | — | — | — | ✅ |
| Setup | — | — | — | 1 500 €+ |

---

## Accroche hero alternative (page `/mon-app`)

**Titre :** Lance ton app de coaching à ton image  
**Sous-titre :** Programmes, clients, paiements — tout au même endroit. Passe en Studio quand tu es prêt à construire un actif rachetable.  
**CTA :** Essayer Business gratuitement · Voir les offres

offre:

Starter — 39 €/mois · 15 clients
Pour démarrer. Programmes, portail client, planning. Marque Trainly visible. Pas de white-label ni paiements.

Business ★ — 89 €/mois · 75 clients
L’offre qu’on pousse. Ton app (logo, couleurs, tonnom.trainly.app), Stripe, nutrition, exercices perso, chat, emails auto.

Scale — 179 €/mois · 200 clients
Tout Business + PWA mobile, push, Strava, stats avancées. Pas d’App Store, pas de rachat.

Studio — 299 €+/mois · sur candidature (+ 1 500 € setup)
Tout Scale + zéro Trainly, domaine perso, App Store, base isolée, clause de rachat, onboarding humain.


#9b6bb8 
#341c44