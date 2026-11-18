# Progress

## Done
- `/profile` : Showroom · Prestations · Liens · Codes · Mon app · Rendu
- Liens lead-only (pas de handoff messagerie) · promo attachable · notif « Je suis intéressé »
- Slice SQL 95 : `capture_leads` toujours on (campagnes actives)
- `/exercises` hub V1 : chrome Clients-like · Catalogue Krid / Ma biblio / Brouillons · fork Krid→brouillon · provenance · confirm delete
- Création exo/bloc coach = fiche style admin (adaptée) · CTA `+` icône
- Hub **Blocs** : même cycle · composition Krid+Ma biblio · slice 97 provenance
- Média exo coach : preview détail Krid · upload/suppression en édition · textes coach discrets
- Publish → redirect liste Ma biblio · delete Ma biblio = ✕ · vignettes média en liste · filtre Muscle retiré
- Exos : colonne + filtre Sport · détail bloc Krid via `/exercises/blocks/view/[id]` (fix 404)
- Blocs : types hérités en liste/filtre · détail riche (exos/média/timer/RX) · hint type dans éditeur
- Consistance UX coach : rule `app-fluidity` + skill `coach-ux-feedback` · flash unique hubs exo/bloc
- Hub `/exercises` et `/exercises/blocks` → Ma biblio ; catalogue Krid = `/catalogue`
- Hub Exercices · Blocs · **Tags** (`/exercises/tags`) : Sports/Types/Unités · même chrome/transitions
- Seed copies Krid → coach · CRUD perso · archive si usage=0 · remap fork · slice 98 `source_id`
- Hub Programmes chrome (En cours / Templates / Catalogue / Brouillon) · Envoyer unifié popup · listes sans Pause
- Hub séances coach library : Ma biblio / Catalogue Krid / Brouillons · + SessionFicheEditor · fork · modal bloc coach (slice 101)
- Compteurs Utilisé + popup + guard delete (exos/blocs) · returnTo · séances usages programmes (slice 102)
- Bloc depuis séance : Ajouter = usage (`hub_visible=false`) · → Ma biblio = modèle (slice 103) · **pas** de → Brouillon depuis le parent

## Now
- Auth SaaS : billing simu / paywall trial (suite plan)
- Code d’accès coach admin + garde signup (étape suivante)

## Done (récent)
- Auth coach : plus de carte Session active · redirect serveur `/login` `/signup` `/loginadmin` si déjà connecté · `emailRedirectTo` via `appUrl` · filet `/?code=` → `/auth/callback/coach` · checklist Site URL dans `apps/README.md`
- Schema cache PostgREST : env Vercel ychq… · `NOTIFY reload` · soft-fail UI (`isSchemaCacheError`) home/clients/catalogues/mine · smoke Remi `Spaceman_Coach` + catalogues Krid OK
- Auth `/signup` split 50/50 DA Krid + legal CGU/privacy · copy Trainly → Krid (UI visible) · publish site/app
- Séparation site/app Krid : Vercel projet `krid` (ex-trainly) + `krid-site` · CTAs site « Essai gratuit » / Connexion → `/signup` · bucket `home_page` OK
- Catalogue programmes Krid : RLS SELECT coach (slice 107) · publié admin = preview lecture seule · édition = fork → brouillon (catalogue immuable)
- Catalogue Krid : preview `/programs/catalogue/[id]` = builder lecture seule + CTA → Brouillon · clic nom / Voir depuis la liste
- Suite audit : `/dashboard/*` → redirects app actuelle · preview share invalid · grant errors checkés · facture anti-doublon · notifHref shells · chat mark-read par thread · bilan notif lue · message modèle bilan · admin pe sans colonne prescriptions · templatemuscu sans `is_trainly_catalog`
- Audit coach : fix takeover `/rejoindre` (plus de reset mdp/rôle compte existant) · notif `bilan_submitted` (service role + href) · nutrition « Passé » = `done` · `/chat` mobile = inbox · picker séance sans brouillons · fiche presta `shell` · KPI séances sans `pas_fait`
- Dashboard `/home` V1 : logo app · KPI suivi (séances hier, clients, leads, RDV) · Aujourd’hui · donut clients/presta · activité 7j · programmes
- Nav Clients/Profil : layout partagé · subnav `useTransition` (comme Programmes↔Séances) · sans beginNav/skeleton · `+` Prestations/Liens à gauche
- Sidebar coach : hover-expand en overlay (pas de décalage) · pin déplié décale toujours le contenu
- Programmes polish : compteurs clients actifs · blocage instance→Template · pickers sans parents · groupe pushed_content · alumni multi · fluidité listes
- Programmes Partie 4 : Envoyer Clients (multi) · Groupe · Presta (lien offre)
- Programmes Partie 3 : statut plan canonique `done` · fiche client Passé · embed En cours FK explicite
- Programmes Partie 2 : envoi = photocopie instance (`is_client_instance`, slice 106) · éditable En cours · hubs exclus
- Programmes Partie 1 : feuille = actions enfant · 1ʳᵉ Dupliquer → parent + 2 enfants · frère = copie · guards parent
- Hubs programmes : → Template · → Brouillon · Dupliquer · Envoyer (client/presta) · Ajouter Krid · archive En cours/plans · CTAs builder coach
- Coach programme builder : popup + (sans photo) · day-board partagé · palette Krid+Ma biblio · plein cadre sans top bar
- Guards builder : ownership coach ou catalogue Trainly admin
- Créer bloc depuis séance : plus de → Brouillon · Ajouter / → Ma biblio only · confirm publish séance sans warning drafts
- Feedback coach : Publier/brouillon = redirect silencieux · skill + rule fluidity maj
- Séances : Garder brouillon → liste ; filtres zone = ids ; CTAs justify-end
- Admin day-board : DnD reorder semaines (pills)

## Next
- (libre)

## Done (hotfix)
- Templates parent/enfant : `parent_program_id` (slice 105) · Dupliquer → enfant + reste sur `/programs/templates` · compteurs
- → Template : `status=draft` · Origine brouillon · omit `?saved=` hubs · slice 104 `source_kind`

## Décisions figées
- Rendu accessible uniquement depuis Mon app
- CTA showroom « Je suis intéressé » toujours visible (lien défaut si pas de `?ref=`)
- Promo expirée : attachable ; le client final voit « code expiré »
- Marque produit : **Krid** (pas Trainly dans les copy coach/client)
- Catalogue Krid **immuable** : fork = copie ; original toujours visible (pas d’auto-hide)
- Cycle : Krid → brouillon (fork) → Publier → Ma biblio ; Ma biblio → brouillon = move
- `session_library` plateforme published = Catalogue Krid coach (fork → brouillon) · label admin « Publié admin »
- Hubs = templates ; programme = photocopie
- Créer bloc depuis parent : **Ajouter** (éphémère) · **→ Ma biblio** — pas de → Brouillon (picker = publiés only) · même logique programme

## Pièges connus
- Dual `app/` + `src/app/` : ne jamais mettre de `(auth)` sous root `app/`
- Ne pas re-introduire sélection de canal / message d’aperçu dans création Liens
