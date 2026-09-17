-- =============================================================================
-- TRANCHE 11a — Catalogue Trainly exercise_library (import ancien projet)
-- Prérequis : 10_programs
-- Bucket : exercise-media (fichiers à la racine du bucket)
-- Après Run : dis « 11a OK »
-- =============================================================================

BEGIN;

-- Pass 1 : insert sans replacement_exercise_id (FK self)
INSERT INTO public.exercise_library (
  id,
  coach_id,
  name,
  description,
  muscle_group,
  difficulty,
  video_url,
  demo_media_path,
  replacement_exercise_id,
  created_at,
  updated_at,
  deleted_at
)
VALUES
  ('030b886b-f321-4fc6-ba51-76544a96efb2', NULL, 'Développé couché haltères', 'Tu gardes les omoplates serrées, les pieds stables et le buste légèrement ouvert. Les haltères descendent de façon contrôlée de part et d’autre de la poitrine, puis tu pousses en trajectoire légèrement arquée pour rester puissant, stable et symétrique.

laisser les coudes trop ouverts et perdre la stabilité.
Correction : garde les omoplates serrées et les coudes légèrement rentrés pour pousser en trajectoire propre et contrôlée.', 'Pectoraux', 'Intermédiaire', 'https://www.youtube.com/shorts/xoTdvzKWib8?feature=share', 'developpe-couche-halteres.gif', NULL, '2026-03-05 15:41:57.964166+00'::timestamptz, now(), NULL),
  ('04501b5b-50cf-4090-a254-adb4e227c50c', NULL, 'Rameur', 'Rameur Concept2 : poussée jambes puis bras, retour bras-jambes, cadence régulière.', 'Crossfit', 'Débutant', NULL, 'rameur.gif', NULL, '2026-04-22 13:02:16.069457+00'::timestamptz, now(), NULL),
  ('1241603a-4429-4040-8dcb-176019435e51', NULL, 'Rowing buste penché', 'Ce mouvement vise à développer les rhomboïdes et les dorsaux en faisant suivre la barre à vos jambes tout au long du mouvement, les coudes restant en arrière. Vous pouvez également ouvrir les coudes et suivre une trajectoire plus verticale pour solliciter davantage vos trapèzes.

arrondir le dos et tirer trop vertical.
Correction : garde le dos gainé, buste incliné fixe, et tire la barre vers le bas du ventre', 'Dos', 'Débutant', 'https://www.youtube.com/shorts/RNoHN2I0t1w?feature=share', 'rowing.gif', NULL, '2026-03-05 15:41:57.964166+00'::timestamptz, now(), NULL),
  ('1598a9dc-e2f6-4a8f-880d-97edcba53c8c', NULL, 'Devil press', 'Burpee + snatch double haltères : enchaîner planche puis tirer les haltères en overhead en un seul flux.', 'Crossfit', NULL, NULL, 'devil_press.webp', NULL, '2026-04-17 09:52:47.56526+00'::timestamptz, now(), NULL),
  ('17aa3d90-8d0d-48c6-b2e4-a3d1fd9112b7', NULL, 'Assault bike', 'Cardio haute intensité sur vélo assault : pédaler en puissance tout en maintenant une posture neutre.', 'Crossfit', NULL, NULL, 'assault_bike.gif', NULL, '2026-04-17 09:52:47.56526+00'::timestamptz, now(), NULL),
  ('19c09d27-7bf0-47a8-87c8-3e51bd7d4ba5', NULL, 'Curl biceps haltères', 'Exercice roi pour le dévellopement des biceps. Tu gardes les coudes légèrement collés au corps, le buste droit et les épaules stables. Tu montes et descends la charge de façon contrôlée sans tordre le poignet, en laissant le biceps faire le travail. Et tu privilégies les haltères pour éviter toute gêne au niveau du coude et respecter ta trajectoire naturelle.

balancer le buste pour aider la montée.
Correction : cale les coudes contre les flancs et pense à “monter avec le biceps”, pas avec le dos.', 'Biceps', 'Débutant', 'https://www.youtube.com/shorts/MKWBV29S6c0?feature=share', 'curl haltere.gif', NULL, '2026-03-05 15:41:57.964166+00'::timestamptz, now(), NULL),
  ('1afee6de-2ec3-4324-9fda-59356ff1085a', NULL, 'Raised Leg Sit Ups with Twist', 'Jambes posées sur une chaise, effectuer un sit up avec rotation pour amener la main vers le pied opposé. Alterner les côtés.', 'maison', 'Débutant', NULL, 'Raised_Leg_sit_ups_With_Twist.png', NULL, '2026-04-23 07:58:03.527982+00'::timestamptz, now(), NULL),
  ('22b4b56a-c3f5-4ccf-8e70-d2710385450e', NULL, 'Jump rope', NULL, 'maison', NULL, NULL, 'jump_rope.png', NULL, '2026-05-12 17:32:28.148112+00'::timestamptz, now(), NULL),
  ('22ed8f01-eef7-4fda-baba-7a1641a8d92e', NULL, 'Tirage horizontal', 'Mouvement clé pour le dos. Tu gardes le buste gainé, les épaules basses et les omoplates qui se resserrent à chaque tirage. Tu ramènes la poignée vers le bas des côtes en contrôlant le retour pour maximiser le travail du dos.

arrondir le dos et tirer trop haut.
Correction : garde la cage ouverte et vise le bas des côtes pour engager le grand dorsal.', 'Dos', 'Débutant', 'https://www.youtube.com/shorts/ywy47SjQ-_w?feature=share', 't horizontal.gif', NULL, '2026-03-05 15:41:57.964166+00'::timestamptz, now(), NULL),
  ('25b2effb-892b-4353-87b8-dc2f3e340f7a', NULL, 'Mountain Climber + Push Up', 'Depuis la planche, effectuer un mountain climber complet puis un push up. Une répétition combine les deux mouvements.', 'maison', 'Débutant', NULL, 'Mountain_Climber_Pushup.png', NULL, '2026-04-23 07:58:03.527982+00'::timestamptz, now(), NULL),
  ('26a41cc2-6f80-43e8-95aa-c8e4fe619961', NULL, 'Single Leg Hip Raise', 'Allongé sur le dos, une jambe tendue vers le plafond, pousser sur le talon de la jambe au sol pour décoller le bassin. Redescendre sans poser complètement.', 'maison', 'Débutant', NULL, 'Single_Leg_Hip_Raise.png', NULL, '2026-04-23 07:58:03.527982+00'::timestamptz, now(), NULL),
  ('26fa8bee-90ae-498a-9ccf-342787234758', NULL, 'Dips', 'Exercice puissant pour les triceps et les pectoraux. Tu restes gainé, les épaules stables et la poitrine légèrement ouverte. Tu descends en contrôle jusqu’à sentir l’étirement, puis tu pousses fort en gardant les coudes dans l’axe.

laisser les épaules monter et s’écraser vers l’avant.
Correction : garde les épaules basses et la poitrine ouverte, comme si tu voulais “t’éloigner des poignées” en descendant.', 'Triceps', 'Débutant', 'https://www.youtube.com/shorts/1UGPXksj2k4?feature=share', 'dips.gif', NULL, '2026-03-05 15:41:57.964166+00'::timestamptz, now(), NULL),
  ('28e157f6-affd-4e63-ab75-c6dcf2a6f128', NULL, 'Double unders', 'Corde à sauter : deux tours de corde par saut, coudes près du corps, rebond sur l’avant-pied.', 'Crossfit', NULL, NULL, 'double_unders.gif', NULL, '2026-04-17 09:52:47.56526+00'::timestamptz, now(), NULL),
  ('297f8b77-8e55-43a7-8a7e-4821f358c39b', NULL, 'Elevation latéral', 'Idéal pour cibler le deltoïde moyen. Tu gardes le buste fixe, les épaules basses et les bras légèrement fléchis. Tu montes les haltères sur les côtés sans élan, juste avec la force de l’épaule.

L''amplitude du mouvement est importante ici : lorsque votre bras est abaissé, la tension sur le deltoïde latéral disparaît. Essayez donc de maintenir une amplitude de mouvement active tout au long du mouvement.', 'Épaules', 'Intermédiaire', 'https://www.youtube.com/shorts/WXPqwHA2u9Q?feature=share', 'elevation lateral.gif', NULL, '2026-03-05 15:41:57.964166+00'::timestamptz, now(), NULL),
  ('2d7ca899-f903-4901-9ddf-8703fc17a04e', NULL, 'Pull over', 'Tu gardes la cage ouverte, les omoplates serrées et le buste stable. Tu tires la barre vers tes hanches en gardant les coudes serré, puis tu contrôles la remontée pour bien recruter le dos.

trop cambrer le dos et transformer le mouvement en développé.
Correction : garde les côtes rentrées et laisse les bras s’ouvrir en arc pour cibler le grand dorsal et les pecs.', 'Dos', 'Avancé', 'https://www.youtube.com/shorts/Vf_zUuI4QNQ?feature=share', 'pull over.gif', NULL, '2026-03-05 15:41:57.964166+00'::timestamptz, now(), NULL),
  ('2d89723f-6ede-4f3f-a29b-c60009b2774c', NULL, 'Leg curl', 'Exercice isolant pour les ischios. Tu gardes le bassin collé au siège et tu plies les jambes en contrôle. Tu contractes fort en bas du mouvement puis tu relâches lentement pour maximiser la tension.

décoller le bassin du siège pour tricher.
Correction : pense à “coller le nombril au banc” et contracte les ischios sans à-coups.', 'Jambes', 'Débutant', 'https://www.youtube.com/shorts/_lgE0gPvbik?feature=share', 'leg curl.gif', NULL, '2026-03-05 15:41:57.964166+00'::timestamptz, now(), NULL),
  ('347a3b9d-2321-4c6f-be08-46a4ed414f2a', NULL, 'Bridge', 'Allongé sur le dos, pieds au sol, pousser sur les talons pour monter le bassin. Serrer les fessiers en haut du mouvement.', 'maison', 'Débutant', NULL, 'Bridge.png', NULL, '2026-04-23 07:58:03.527982+00'::timestamptz, now(), NULL),
  ('34853054-c768-49bc-888d-d6e3270d5ccb', NULL, 'Leg extention', 'Parfait pour cibler le quadriceps. Tu restes bien calé dans le siège, les pointes de pieds neutres. Tu tends les jambes en contractant le quadriceps, puis tu redescends lentement pour garder la tension.

lancer la charge et verrouiller trop fort les genoux.
Correction : monte en contrôle, contracte en haut, puis redescends lentement pour garder la tension sur les quadriceps.', 'Jambes', 'Débutant', 'https://www.youtube.com/shorts/iQ92TuvBqRo?feature=share', 'leg extension.gif', NULL, '2026-03-05 15:41:57.964166+00'::timestamptz, now(), NULL),
  ('38f6bb2b-b449-4472-8a8f-51a621b13843', NULL, 'Power clean', 'Épaulé power depuis le sol : tirer la barre, recevoir en demi-squat, coudes rapides sous la barre.', 'Crossfit', NULL, NULL, 'power_clean.gif', NULL, '2026-04-17 09:52:47.56526+00'::timestamptz, now(), NULL),
  ('4305a983-42b9-4255-b7a6-9010d3a523ab', NULL, 'Handstand Push-ups', 'Pompes en équilibre (mur ou libre) : descendre la tête contrôlée, repousser bras tendus au verrouillage.', 'Crossfit', NULL, NULL, 'handstand_push_up.gif', NULL, '2026-04-17 09:52:47.56526+00'::timestamptz, now(), NULL),
  ('4643eeac-332b-4bb2-9da3-7ef5b9f96e63', NULL, 'Ski_erg', 'SkiErg : tirer les poignées vers le bas en engageant jambes et tronc, retour contrôlé.', 'Crossfit', NULL, NULL, 'ski_erg.gif', NULL, '2026-04-22 13:06:38.746109+00'::timestamptz, now(), NULL),
  ('47fd7e6f-7be3-4dad-ab73-a4357d061c00', NULL, 'Toes-to-bar', 'Pieds aux barres : suspendu, lever les jambes jusqu’au contact orteils-barre, contrôler la descente.', 'Crossfit', NULL, NULL, 'toes_to_bar.gif', NULL, '2026-04-17 09:52:47.56526+00'::timestamptz, now(), NULL),
  ('496fdaf0-989d-4123-8c83-9da4b235c8ef', NULL, 'Ab Bikes', 'Mouvement de pédalo en alternant coude droit vers genou gauche puis coude gauche vers genou droit. Garder le bas du dos stable.', 'maison', 'Débutant', NULL, 'AB_Bikes.png', NULL, '2026-04-23 07:58:03.527982+00'::timestamptz, now(), NULL),
  ('4b1518e2-a7ae-408f-b63e-6067141bb787', NULL, 'X-Hops', 'Alterner un saut entre position de squat et fente avant droite puis gauche. A chaque saut, changer de position en gardant le buste droit.', 'maison', 'Débutant', NULL, 'X Hops.png', NULL, '2026-04-23 07:58:03.527982+00'::timestamptz, now(), NULL),
  ('4b1fd7e5-8cb4-41e5-8f2a-3c185d77f15e', NULL, 'Side Lunge Stretch', 'Fente latérale, une jambe fléchie et l autre tendue, pour étirer l intérieur de cuisse. Garder le buste droit.', 'maison', 'Débutant', NULL, 'Side_Lunge_Stretch.png', NULL, '2026-04-23 07:58:03.527982+00'::timestamptz, now(), NULL),
  ('4c9b3d9b-92f0-4c2e-ace7-13d6b1da8349', NULL, 'Hang power clean', 'Épaulé hang power : barre au-dessus des genoux, extension explosive des hanches, réception en demi-squat coudes hauts.', 'Crossfit', NULL, NULL, 'hang_power_clean.gif', NULL, '2026-04-17 09:52:47.56526+00'::timestamptz, now(), NULL),
  ('4eccd51c-89ce-47a6-b465-8d3c39f9ab51', NULL, 'DB snatch', 'Arraché haltère un bras : trajectoire verticale près du corps, verrouillage bras tendu au-dessus de la tête.', 'Crossfit', NULL, NULL, 'db_snatch.gif', NULL, '2026-04-17 09:52:47.56526+00'::timestamptz, now(), NULL),
  ('511bccb9-06af-4d39-bd26-6b8c485103d7', NULL, 'Leg press', 'Tu places les pieds à largeur d’épaules, le dos bien plaqué. Tu descends en contrôle jusqu’à ce que les genoux forment un angle confortable, puis tu pousses fort sans verrouiller complètement les genoux.

Comme pour le squat, l''angle de la hanche et du genou pendant le mouvement influence les muscles sollicités. Une flexion plus importante des genoux sollicite davantage les quadriceps, tandis qu''une flexion plus importante des hanches recrute davantage la chaîne postérieure. Augmente la flexion des genoux en abaissant les pieds et en diminuant l''angle du dossier.', 'Jambes', 'Intermédiaire', 'https://www.youtube.com/shorts/EotSw18oR9w?feature=share', 'leg press.gif', NULL, '2026-03-05 15:41:57.964166+00'::timestamptz, now(), NULL),
  ('51b0d8a2-6256-4b0a-a5bb-591924000283', NULL, 'Plank', 'Position de planche, appui sur les avant bras ou les mains, corps aligné des épaules aux talons. Rentrer le ventre et ne pas creuser le bas du dos.', 'maison', 'Débutant', NULL, 'Planche.png', NULL, '2026-04-23 07:58:03.527982+00'::timestamptz, now(), NULL),
  ('5317e7d2-4b06-46ed-9d46-4d4902345b59', NULL, 'Fentes', 'Cet exercice peut être réalisé avec deux objectifs différents. Avec un pas plus court, la flexion du genou sera plus importante et les quadriceps seront davantage sollicités. Avec un pas plus long, la flexion de la hanche sera plus importante et les fessiers et les ischio-jambiers seront davantage sollicités.

Cet exercice peut être réalisé avec deux objectifs différents. Avec un pas plus court, la flexion du genou sera plus importante et les quadriceps seront davantage sollicités. Avec un pas plus long, la flexion de la hanche sera plus importante et les fessiers et les ischio-jambiers seront davantage sollicités.', 'Jambes', 'Débutant', 'https://www.youtube.com/shorts/L5PA1vsVnkE?feature=share', 'fentes.gif', NULL, '2026-03-05 15:41:57.964166+00'::timestamptz, now(), NULL),
  ('5780a1f1-4d27-495b-a3e2-319a444c3d3f', NULL, 'Sit Ups and Twist', 'Sit up avec rotation du buste pour toucher le genou opposé. Alterner les côtés à chaque répétition.', 'maison', 'Débutant', NULL, 'Sit_Ups_and_Twist.png', NULL, '2026-04-23 07:58:03.527982+00'::timestamptz, now(), NULL),
  ('578a9d3c-1efd-4f69-ae86-ed14881e8339', NULL, 'Sit Ups', 'Allongé sur le dos, remonter le buste en enroulant la colonne sans tirer sur la nuque. Le mouvement doit rester contrôlé et sans élan.', 'maison', 'Débutant', NULL, 'Sit_Ups.png', NULL, '2026-04-23 07:58:03.527982+00'::timestamptz, now(), NULL),
  ('5b5c1113-cd8d-4559-936e-4f78050f43bb', NULL, 'Curl', 'Debout avec haltères, fléchir les coudes pour amener les mains vers les épaules. Les coudes restent proches du corps sans bouger vers l avant.', 'maison', 'Débutant', NULL, 'Curl.png', NULL, '2026-04-23 07:58:03.527982+00'::timestamptz, now(), NULL),
  ('60a0344b-c2fb-42d6-8d7e-70c4e6806be1', NULL, 'Tirage vertical prise neutre', 'Tu restes gainé, les épaules basses et la poitrine ouverte. Tu tires la charge vers le haut de la poitrine en gardant les coudes dans l’axe, puis tu contrôles la montée pour garder la tension dans le dos.

tirer avec les biceps et laisser les épaules monter.
Correction : pense “épaules basses, cage ouverte” et tire les coudes vers les hanches.', 'Dos', 'Débutant', 'https://www.youtube.com/shorts/LXIAAgWZSM4?feature=share', 'tirage vertical pn.gif', NULL, '2026-03-05 15:41:57.964166+00'::timestamptz, now(), NULL),
  ('65db01f5-b3f6-40a8-99d9-98cc07d239dd', NULL, 'Burpees', 'Enchaînement squat-planche-pompe-saut : corps gainé en planche, poitrine qui frôle le sol, enchaînement fluide.', 'Crossfit', NULL, NULL, 'burpees.gif', NULL, '2026-04-17 09:52:47.56526+00'::timestamptz, now(), NULL),
  ('691b79f5-a72f-45d9-9a13-d07bbf16f054', NULL, 'Jump Lunges', 'Fentes sautées en alternant jambe avant et jambe arrière. Le mouvement est explosif tout en gardant le genou aligné avec la cheville.', 'maison', 'Débutant', NULL, 'Jump Lunge.png', NULL, '2026-04-23 07:58:03.527982+00'::timestamptz, now(), NULL),
  ('6c6faf79-5c6b-4531-b375-21f9d80d0542', NULL, 'Butterfly', 'Exercice d’isolation pour les pectoraux. Tu gardes la poitrine ouverte, les épaules basses et tu refermes les bras en arc contrôlé. Tu contractes fort en position serrée puis tu relâches lentement pour garder la tension.

arrondir le dos et pousser avec les épaules au lieu de contracter les pectoraux.
Correction : garde la poitrine ouverte et imagine que tu veux rapprocher tes biceps l’un de l’autre, ça recentre le travail sur les pecs.', 'Pectoraux', 'Intermédiaire', 'https://www.youtube.com/shorts/a9vQ_hwIksU?feature=share', 'butterfly.gif', NULL, '2026-03-05 15:41:57.964166+00'::timestamptz, now(), NULL),
  ('6e61d48d-9037-460d-95de-a12ad16b71f6', NULL, 'Développé couché barre', 'Tu gardes les omoplates serrées, les pieds bien ancrés et la poitrine haute. Tu descends la barre de façon contrôlée jusqu’au bas des pectoraux, puis tu pousses fort en gardant les coudes sous contrôle pour rester puissant et stable.

Tu peux avoir du mal à sentir tes pectoraux ; il peut donc être judicieux de réduire l’amplitude du mouvement ou d’écarter légèrement tes mains sur la barre. Dans les deux cas, tu amélioreras l’étirement des pectoraux et réduiras l’angle du coude, ce qui diminuera l’activation des triceps.', 'Pectoraux', 'Intermédiaire', 'https://www.youtube.com/shorts/5_O-pKzu5CQ?feature=share', 'developpe-couche.gif', NULL, '2026-03-05 15:41:57.964166+00'::timestamptz, now(), NULL),
  ('6f193748-4a35-4c93-a2bc-82509dfe1107', NULL, 'Traction', 'Mouvement roi pour le dos et les biceps. Tu gardes la cage ouverte, les épaules basses et tu tires la poitrine vers la barre. Tu contrôles la descente pour maximiser le recrutement du dos.

arrondir le dos et tirer trop vertical.
Correction : ouvre la cage, garde les coudes proches du corps et monte en cherchant la contraction du dos.', 'Dos', 'Débutant', 'https://www.youtube.com/shorts/ZZNUjqF9Xuo?feature=share', 'traction.gif', NULL, '2026-03-05 15:41:57.964166+00'::timestamptz, now(), NULL),
  ('71566dbc-2554-40e5-9a96-779b182710ea', NULL, 'Muscle-up', 'Traction explosive + transition au-dessus des barres ou anneaux : tirer la poitrine haute puis basculer les coudes au-dessus.', 'Crossfit', NULL, NULL, 'muscle_up.gif', NULL, '2026-04-17 09:52:47.56526+00'::timestamptz, now(), NULL),
  ('73a95ade-6e9e-4667-a6a6-8a949d375b53', NULL, 'Thruster', 'Squat front + développé : descendre en squat profond, monter et pousser la barre ou haltères overhead en un flux.', 'Crossfit', NULL, NULL, 'thruster.gif', NULL, '2026-04-17 09:52:47.56526+00'::timestamptz, now(), NULL),
  ('73b1df66-7137-4fba-beb6-29a8b93f78fc', NULL, 'Jump Squat', 'Même position que le squat mais avec un saut explosif en remontant. Remonter en expirant et sauter suffisamment haut pour décoller du sol.', 'maison', 'Débutant', NULL, 'Jump Squat.png', NULL, '2026-04-23 07:58:03.527982+00'::timestamptz, now(), NULL),
  ('758a2d4f-208f-4f04-9215-9a0e323e9b09', NULL, 'Développé incliné Haltère', 'Parfait pour le haut des pectoraux. Tu gardes les omoplates serrées, les pieds ancrés et tu descends les haltères en contrôle. Tu pousses en trajectoire légèrement convergente pour un travail propre et symétrique.

pousser avec les épaules et perdre l’ouverture de la cage.
Correction : serre les omoplates et imagine que tu veux “pousser vers le haut et légèrement vers l’intérieur” pour cibler le haut des pecs.', 'Pectoraux', 'Débutant', 'https://www.youtube.com/shorts/8fXfwG4ftaQ?feature=share', 'dev incline h.gif', NULL, '2026-03-05 15:41:57.964166+00'::timestamptz, now(), NULL),
  ('7cdc5961-3664-403e-b540-e70f7f88f659', NULL, 'Power snatch', 'Arraché power : recevoir la barre en demi-squat, barre proche du corps, verrouillage overhead.', 'Crossfit', NULL, NULL, 'power_snatch.gif', NULL, '2026-04-17 09:52:47.56526+00'::timestamptz, now(), NULL),
  ('7d38e861-d29b-4762-8add-766cd1a88ea8', NULL, 'Squat', 'Debout, jambes ouvertes largeur bassin, descendre en pliant les genoux en gardant le poids sur les talons. Les genoux ne doivent pas dépasser la pointe des pieds.', 'maison', 'Débutant', NULL, 'Squat.png', NULL, '2026-04-23 07:58:03.527982+00'::timestamptz, now(), NULL),
  ('7eb32fc3-fd14-4252-919a-9d1cc4f5df8a', NULL, 'Développé militaire', 'Exercice clé pour les épaules. Tu restes gainé, les fessiers serrés et la cage neutre. Tu pousses la barre au-dessus de la tête en gardant les coudes sous la charge et tu contrôles la descente.

cambrer le bas du dos pour aider la poussée.
Correction : serre les fessiers et rentre les côtes pour garder une ligne solide avant de pousser au-dessus de la tête.', 'Épaules', 'Débutant', 'https://www.youtube.com/shorts/rf_wTA6EDus?feature=share', 'dev militaire.gif', NULL, '2026-03-05 15:41:57.964166+00'::timestamptz, now(), NULL),
  ('7f43abc4-f0a5-4c8d-a88a-162810c01f9b', NULL, 'Burpees over bar', 'Burpee avec franchissement de barre : sauter ou step-over selon le niveau, garder les mains actives.', 'Crossfit', NULL, NULL, 'burpees.gif', NULL, '2026-04-17 09:52:47.56526+00'::timestamptz, now(), NULL),
  ('8317fd9b-c650-47a4-98af-57aaf73907fb', NULL, 'Weighted Squat Clean and Press', 'Squat avec haltères suivi d une extension des bras au dessus de la tête. Le mouvement enchaîne flexion de jambes et poussée des bras.', 'maison', 'Débutant', NULL, 'Weighted Squat Clean and Press.png', NULL, '2026-04-23 07:58:03.527982+00'::timestamptz, now(), NULL),
  ('83df4515-94bd-4532-a069-7fb9419cdc8a', NULL, 'Wall walk', 'Marche au mur en handstand : petits pas mains/pieds, regarder le mur, tronc gainé.', 'Crossfit', NULL, NULL, 'wall_walk.gif', NULL, '2026-04-17 09:52:47.56526+00'::timestamptz, now(), NULL),
  ('85bba763-8491-45c2-ba6a-f39a8d52660b', NULL, 'Squat', 'Mouvement fondamental pour tout le bas du corps. Tu gardes le dos gainé, les pieds stables et les genoux dans l’axe. Tu descends en contrôle jusqu’à une amplitude confortable, puis tu pousses fort dans les talons.

Il est important de savoir que plus l''angle de la hanche diminue, plus la chaîne postérieure est sollicitée. Inversement, plus l''angle du genou diminue pendant la descente, plus les quadriceps sont actifs.', 'Jambes', 'Débutant', 'https://www.youtube.com/shorts/dW3zj79xfrc?feature=share', 'squat.gif', NULL, '2026-03-05 15:41:57.964166+00'::timestamptz, now(), NULL),
  ('872b6985-db19-4f48-b73a-82c390f5bde9', NULL, 'Box jump', 'Saut sur box : amortir en squat partiel à l’atterrissage, genoux alignés avec les pieds, redescendre en contrôlé.', 'Crossfit', NULL, NULL, 'box_jump.gif', NULL, '2026-04-17 09:52:47.56526+00'::timestamptz, now(), NULL),
  ('8d25d4cd-1a99-47a9-a9ed-b93bd125476f', NULL, 'Toe Touches', 'Allongé, jambes tendues vers le haut, remonter les épaules pour toucher les orteils avec les mains. Le bas du dos reste collé au sol.', 'maison', 'Débutant', NULL, 'Toes_Touches.png', NULL, '2026-04-23 07:58:03.527982+00'::timestamptz, now(), NULL),
  ('912dbc2a-0d1c-4355-969b-2e7e9560b072', NULL, 'Extention triceps', 'Tu gardes les coudes serrés et fixes, le buste droit. Tu tends les bras en contractant le triceps, puis tu remontes lentement pour garder la tension sans bouger les épaules.

Pour les triceps, l''angle du poignet n''influence pas le recrutement des fibres musculaires, contrairement à l''angle du coude. Avec le coude abaissé, on sollicite davantage le chef latéral du triceps, tandis qu''avec le coude levé, on sollicite davantage le chef long.', 'Triceps', 'Intermédiaire', 'https://www.youtube.com/shorts/9Ark9S11uXw?feature=share', 'extention triceps.gif', NULL, '2026-03-05 15:41:57.964166+00'::timestamptz, now(), NULL),
  ('933c3c4f-196d-4f41-8082-fdaa9eb38c85', NULL, 'Triceps Dips', 'Appui sur une chaise, mains derrière soi, plier les coudes pour descendre les fessiers puis remonter en poussant sur les bras. Garder le dos proche de la chaise.', 'maison', 'Débutant', NULL, 'Triceps_Dips.png', NULL, '2026-04-23 07:58:03.527982+00'::timestamptz, now(), NULL),
  ('952e1c64-79e5-4267-9e1a-2b22aaa0eb9c', NULL, 'hip thrust', 'Exercice puissant pour les fessiers. Tu gardes le haut du dos calé sur le banc, le regard vers l’avant et les côtes rentrées. Tu pousses fort avec les talons pour monter les hanches jusqu’à aligner genoux–bassin–épaules, puis tu redescends en contrôle pour garder la tension sur les fessiers.

monter trop haut en cambrant le bas du dos.
Correction : garde les côtes rentrées et pense à “pousser le sol avec les talons” pour finir le mouvement avec les fessiers, pas le bas du dos', 'fessier', 'Intermédiaire', 'https://www.youtube.com/shorts/CvuVYMFd11g?feature=share', 'hip trust.gif', NULL, '2026-03-05 15:41:57.964166+00'::timestamptz, now(), NULL),
  ('974e7903-7a48-4408-9658-8f9c77842d1e', NULL, 'Écarté couché haltères', 'Idéal pour étirer et cibler les pectoraux. Tu gardes les omoplates serrées et les bras légèrement fléchis. Tu ouvres en arc contrôlé puis tu refermes en contractant la poitrine sans rapprocher les haltères trop haut.

descendre les haltères trop bas et laisser les épaules partir vers l’avant.
Correction : garde les omoplates serrées et arrête la descente quand tu sens l’étirement sans perdre la tension, comme si tu “enveloppais” la charge avec la poitrine.', 'Pectoraux', 'Débutant', 'https://www.youtube.com/shorts/rk8YayRoTRQ?feature=share', 'ecarte couche.gif', NULL, '2026-03-05 15:41:57.964166+00'::timestamptz, now(), NULL),
  ('98b8cd19-93a8-4e46-8ba5-d132ce696977', NULL, 'Rowing haltère un bras', 'Exercice efficace pour cibler le dos en unilatéral. Tu gardes le buste gainé, l’épaule basse et tu tires l’haltère vers la hanche en resserrant l’omoplate. Tu contrôles la descente pour garder la tension et corriger les déséquilibres côté par côté.

tirer avec le bras au lieu de resserrer l’omoplate.
Correction : pense à “ramener le coude vers la hanche” pour engager le dos et non le biceps.', 'Dos', 'Débutant', 'https://www.youtube.com/shorts/vu_YDt9nGv4?feature=share', 'rowing h.gif', NULL, '2026-03-05 15:41:57.964166+00'::timestamptz, now(), NULL),
  ('a3e4d5f4-c9bc-4e63-846b-199c48dbc8e9', NULL, 'Burpees box jump', 'Burpee suivi d’un saut sur box : même qualité de planche, réception souple en squat sur la box.', 'Crossfit', NULL, NULL, 'burpees.gif', NULL, '2026-04-17 09:52:47.56526+00'::timestamptz, now(), NULL),
  ('a6dda616-9836-4bed-abd5-b203aae066a0', NULL, 'Standing Butterfly', 'Bras levés à hauteur d épaule, plier les coudes et rapprocher les avant bras devant le visage puis ouvrir à nouveau. Garder les épaules basses.', 'maison', 'Débutant', NULL, 'Standing Butterfly.png', NULL, '2026-04-23 07:58:03.527982+00'::timestamptz, now(), NULL),
  ('ac3480ea-9a28-4364-b835-436b4ba19347', NULL, 'Snatch', 'Arraché barre : tirer verticalement, recevoir overhead en squat ou power selon la technique visée.', 'Crossfit', NULL, NULL, 'snatch.gif', NULL, '2026-04-17 09:52:47.56526+00'::timestamptz, now(), NULL),
  ('b3c22acd-4ce1-4739-97aa-981d549d2813', NULL, 'Soulevé de terre', 'Mouvement complet pour l’arrière du corps. Tu gardes le dos gainé, la barre proche des tibias et les hanches en arrière. Tu pousses dans le sol pour te redresser en bloc, puis tu redescends en contrôle.

arrondir le bas du dos au décollage.
Correction : imagine “casser la barre” vers toi pour engager le dos et pousser dans le sol avec les jambes.', 'Jambes', 'Avancé', 'https://www.youtube.com/shorts/K8a_Ab9R-aI?feature=share', 'SDT.gif', NULL, '2026-03-05 15:41:57.964166+00'::timestamptz, now(), NULL),
  ('b45da790-f856-4941-8f9a-771562eef20e', NULL, 'Sumo Squat', 'Jambes très écartées, buste droit, descendre puis remonter en serrant les fessiers. Les pieds sont légèrement ouverts vers l extérieur.', 'maison', 'Débutant', NULL, 'Sumo Squat.png', NULL, '2026-04-23 07:58:03.527982+00'::timestamptz, now(), NULL),
  ('b6551d83-ec3b-4de3-b7eb-199bd092bbb2', NULL, 'Romanian deadlift', 'Exercice ciblé pour les ischios et la chaîne postérieure. Tu gardes le dos bien gainé, les jambes presque tendues et les hanches qui reculent pour sentir l’étirement. Tu descends la barre en contrôle le long des cuisses, puis tu remontes en poussant les hanches vers l’avant sans arrondir le dos.

descendre trop bas et perdre la tension dans les ischios.
Correction : recule les hanches, garde les jambes presque tendues et arrête la descente quand l’étirement est maximal mais propre.', 'Jambes', 'Intermédiaire', 'https://www.youtube.com/shorts/K4sB7gD1GJE?feature=share', 'SDT tendu.gif', NULL, '2026-03-05 15:41:57.964166+00'::timestamptz, now(), NULL),
  ('b6a95beb-a962-4931-9062-625ef2a48d96', NULL, 'Crunch', 'Tu gardes le bas du dos collé au sol et tu enroules la cage vers le bassin. Tu montes juste assez pour contracter les abdos, puis tu redescends lentement sans relâcher complètement.

tirer sur la nuque ou monter en tirant avec les épaules.
Correction : pense à “rentrer les côtes vers le bassin” et garde les mains juste posées, pas actives.', 'Abdo', 'Débutant', 'https://www.youtube.com/shorts/rf_wTA6EDus?feature=share', 'crunch.gif', NULL, '2026-03-05 15:41:57.964166+00'::timestamptz, now(), NULL),
  ('b7afa862-f7f8-46f2-bf70-e1b7995833b0', NULL, 'Straight Leg Jackknifes', 'Allongé sur le dos, lever simultanément les jambes tendues et le buste pour essayer de toucher les orteils. Redescendre en contrôlant.', 'maison', 'Débutant', NULL, 'Straight_Leg_Jackknifes.png', NULL, '2026-04-23 07:58:03.527982+00'::timestamptz, now(), NULL),
  ('bf792539-7bc0-4f5c-a0d6-a537bcb8784d', NULL, 'Straight Leg Raises', 'Allongé sur le dos, lever les jambes tendues sans décoller le bas du dos du sol. Redescendre lentement sans poser complètement.', 'maison', 'Débutant', NULL, 'Straight_Leg_Raises.png', NULL, '2026-04-23 07:58:03.527982+00'::timestamptz, now(), NULL),
  ('c0275cd5-5d2a-42cf-bec7-06c313116aac', NULL, 'Donkey Side Kick', 'A quatre pattes, lever la jambe sur le côté jusqu à l aligner avec le sol sans bouger les hanches. Revenir en position de départ en contrôlant.', 'maison', 'Débutant', NULL, 'Donkey_Side_Kick.png', NULL, '2026-04-23 07:58:03.527982+00'::timestamptz, now(), NULL),
  ('c29c7689-c0cf-4375-a2b7-df9e767fbe07', NULL, 'Straight Leg Sit Ups', 'Sit up jambes tendues, remonter le buste en enroulant le dos vertèbre par vertèbre. Garder les jambes immobiles.', 'maison', 'Débutant', NULL, 'Straight_Leg_Sit_Ups.png', NULL, '2026-04-23 07:58:03.527982+00'::timestamptz, now(), NULL),
  ('c6816440-395e-438e-ac32-32e0de9436d9', NULL, 'reverse fly', 'Idéal pour l’arrière d’épaule et le haut du dos. Tu gardes le buste fixe, les épaules basses et une légère flexion des coudes. Tu ouvres les bras en arc contrôlé en cherchant à “écarter” les omoplates, puis tu reviens lentement pour maintenir la tension.

lever les bras en tirant avec les trapèzes et en haussant les épaules.
Correction : garde les épaules basses et imagine que tu veux “écarter les omoplates”, pas lever les bras, pour cibler l’arrière d’épaule.', 'Épaules', 'Intermédiaire', 'https://www.youtube.com/shorts/7tgx6QHB0-A?feature=share', 'reverse fly.gif', NULL, '2026-03-05 15:41:57.964166+00'::timestamptz, now(), NULL),
  ('c6f797cc-9218-46d6-81fa-368ada9a94bb', NULL, 'Curl marteau', 'Tu gardes les coudes proches du corps et les poignets neutres. Tu montes les haltères en contrôle pour cibler le brachial et l’avant-bras, puis tu redescends lentement sans balancer.

laisser les poignets casser ou tourner.
Correction : garde la prise neutre du début à la fin, comme si tu tenais un marteau que tu ne veux pas lâcher.', 'Biceps', 'Débutant', 'https://www.youtube.com/shorts/_aoad2yuP5w?feature=share', 'curl marteau.gif', NULL, '2026-03-05 15:41:57.964166+00'::timestamptz, now(), NULL),
  ('c9de022f-aa68-4d14-9035-8be797db6d8b', NULL, 'Barre au front', 'Tu gardes les coudes serrés et fixes, les bras légèrement inclinés vers l’arrière. Tu descends la barre en contrôle vers le front ou derrière la tête, puis tu tends les bras en contractant le triceps.

Pour les triceps, l''angle du poignet n''influence pas le recrutement des fibres musculaires, contrairement à l''angle du coude. Avec le coude abaissé, on sollicite davantage le chef latéral du triceps, tandis qu''avec le coude levé, on sollicite davantage le chef long.', 'Triceps', 'Intermédiaire', 'https://www.youtube.com/shorts/XqqEEBKYv-0?feature=share', 'barre au front.gif', NULL, '2026-03-05 15:41:57.964166+00'::timestamptz, now(), NULL),
  ('cc64020e-0ad6-483e-8116-bf7e19461ebd', NULL, 'Clean & Jerk', 'Enchaînement haltéro : épauler la barre puis développé-jerk overhead, extension complète des hanches et verrouillage stable.', 'Crossfit', NULL, NULL, 'clean_and_jerk.gif', NULL, '2026-04-17 13:51:56.70994+00'::timestamptz, now(), NULL),
  ('ce6295d8-6c3d-4ecf-af41-c4e27cdd007d', NULL, 'T-barre-row', 'Exercice puissant pour l’épaisseur du dos. Tu gardes le buste gainé, les épaules basses et tu tires la barre vers le bas des côtes en resserrant l’omoplate. Tu contrôles la descente pour garder la tension et éviter de tirer avec les bras.

tirer avec les bras et hausser les épaules.
Correction : garde les épaules basses et tire la poignée vers le bas des côtes en resserrant l’omoplate.', 'Dos', 'Intermédiaire', 'https://www.youtube.com/shorts/Sr2q7i-i8X0?feature=share', 'T barre.gif', NULL, '2026-03-05 15:41:57.964166+00'::timestamptz, now(), NULL),
  ('ceb07d55-b7f9-4252-b0c2-27c8d5746937', NULL, 'Mountain Climber', 'Depuis la planche, ramener un genou vers le coude du même côté en alternant droite et gauche. Garder les hanches stables.', 'maison', 'Débutant', NULL, 'Mountain_Climber.png', NULL, '2026-04-23 07:58:03.527982+00'::timestamptz, now(), NULL),
  ('d286eb4a-e151-42c5-b115-5c95c36bf175', NULL, 'Donkey Kick', 'A quatre pattes, pousser le talon vers le plafond en gardant le dos stable. Contracter fortement le fessier en haut du mouvement.', 'maison', 'Débutant', NULL, 'Donkey_Kick.png', NULL, '2026-04-23 07:58:03.527982+00'::timestamptz, now(), NULL),
  ('d4f42f67-862f-40e4-8c43-b007c04e5a9b', NULL, 'Butt Extension Stretch', 'Allongé sur le dos, ramener un genou vers la poitrine pour étirer le fessier. Maintenir quelques respirations avant de changer de côté.', 'maison', 'Débutant', NULL, 'Butt_Extension.png', NULL, '2026-04-23 07:58:03.527982+00'::timestamptz, now(), NULL),
  ('d8109c54-bcaa-4ad5-9f54-5c761e7cd0d0', NULL, 'Child Pose', 'A genoux, s asseoir sur les talons et allonger les bras vers l avant en posant le front au sol. Relâcher le dos et les épaules.', 'maison', 'Débutant', NULL, 'Child_Pose.png', NULL, '2026-04-23 07:58:03.527982+00'::timestamptz, now(), NULL),
  ('dae120e2-fe5c-40f9-aa3e-92a777b0dcda', NULL, 'Commando', 'Depuis la planche bras tendus, descendre sur les avant bras puis remonter bras tendus en alternant le bras qui commence. Les hanches restent stables.', 'maison', 'Débutant', NULL, 'Commandos.png', NULL, '2026-04-23 07:58:03.527982+00'::timestamptz, now(), NULL),
  ('e39e0271-9112-45c5-a0eb-d032c0557e45', NULL, 'Arm Extension', 'Debout ou assis, haltère au dessus de la tête, fléchir puis tendre les coudes pour travailler les triceps. Le bras reste proche de la tête.', 'maison', 'Débutant', NULL, 'Arm Extension.png', NULL, '2026-04-23 07:58:03.527982+00'::timestamptz, now(), NULL),
  ('e78af9cd-73e5-4347-925d-db818385e97f', NULL, 'Tractions pronation', 'Exercice complet pour le dos. Tu gardes les épaules basses, la cage ouverte et tu tires la poitrine vers la barre avec les coudes orientés vers l’extérieur. Tu contrôles la descente pour garder la tension dans le grand dorsal.

tirer avec les bras et se balancer.
Correction : bloque le gainage, garde les épaules basses et pense à “monter la poitrine vers la barre”.', 'Dos', 'Intermédiaire', 'https://www.youtube.com/shorts/wC8rD4xaHLM?feature=share', 'traction pronation.gif', NULL, '2026-03-05 15:41:57.964166+00'::timestamptz, now(), NULL),
  ('f501942b-c776-425d-b6db-dddc64f35706', NULL, 'Ham Stretch', 'Assis ou debout, jambe tendue, pencher le buste vers l avant en gardant le dos droit pour étirer l arrière de la cuisse.', 'maison', 'Débutant', NULL, 'Ham_Stretch.png', NULL, '2026-04-23 07:58:03.527982+00'::timestamptz, now(), NULL)
ON CONFLICT (id) DO UPDATE SET
  coach_id = EXCLUDED.coach_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  muscle_group = EXCLUDED.muscle_group,
  difficulty = EXCLUDED.difficulty,
  video_url = EXCLUDED.video_url,
  demo_media_path = EXCLUDED.demo_media_path,
  updated_at = now();

-- Pass 2 : replacement_exercise_id
UPDATE public.exercise_library SET replacement_exercise_id = '6e61d48d-9037-460d-95de-a12ad16b71f6'::uuid, updated_at = now() WHERE id = '030b886b-f321-4fc6-ba51-76544a96efb2'::uuid AND EXISTS (SELECT 1 FROM public.exercise_library x WHERE x.id = '6e61d48d-9037-460d-95de-a12ad16b71f6'::uuid);
UPDATE public.exercise_library SET replacement_exercise_id = 'ce6295d8-6c3d-4ecf-af41-c4e27cdd007d'::uuid, updated_at = now() WHERE id = '1241603a-4429-4040-8dcb-176019435e51'::uuid AND EXISTS (SELECT 1 FROM public.exercise_library x WHERE x.id = 'ce6295d8-6c3d-4ecf-af41-c4e27cdd007d'::uuid);
UPDATE public.exercise_library SET replacement_exercise_id = 'c6f797cc-9218-46d6-81fa-368ada9a94bb'::uuid, updated_at = now() WHERE id = '19c09d27-7bf0-47a8-87c8-3e51bd7d4ba5'::uuid AND EXISTS (SELECT 1 FROM public.exercise_library x WHERE x.id = 'c6f797cc-9218-46d6-81fa-368ada9a94bb'::uuid);
UPDATE public.exercise_library SET replacement_exercise_id = '1241603a-4429-4040-8dcb-176019435e51'::uuid, updated_at = now() WHERE id = '22ed8f01-eef7-4fda-baba-7a1641a8d92e'::uuid AND EXISTS (SELECT 1 FROM public.exercise_library x WHERE x.id = '1241603a-4429-4040-8dcb-176019435e51'::uuid);
UPDATE public.exercise_library SET replacement_exercise_id = '5317e7d2-4b06-46ed-9d46-4d4902345b59'::uuid, updated_at = now() WHERE id = '511bccb9-06af-4d39-bd26-6b8c485103d7'::uuid AND EXISTS (SELECT 1 FROM public.exercise_library x WHERE x.id = '5317e7d2-4b06-46ed-9d46-4d4902345b59'::uuid);
UPDATE public.exercise_library SET replacement_exercise_id = '511bccb9-06af-4d39-bd26-6b8c485103d7'::uuid, updated_at = now() WHERE id = '5317e7d2-4b06-46ed-9d46-4d4902345b59'::uuid AND EXISTS (SELECT 1 FROM public.exercise_library x WHERE x.id = '511bccb9-06af-4d39-bd26-6b8c485103d7'::uuid);
UPDATE public.exercise_library SET replacement_exercise_id = '6f193748-4a35-4c93-a2bc-82509dfe1107'::uuid, updated_at = now() WHERE id = '60a0344b-c2fb-42d6-8d7e-70c4e6806be1'::uuid AND EXISTS (SELECT 1 FROM public.exercise_library x WHERE x.id = '6f193748-4a35-4c93-a2bc-82509dfe1107'::uuid);
UPDATE public.exercise_library SET replacement_exercise_id = '974e7903-7a48-4408-9658-8f9c77842d1e'::uuid, updated_at = now() WHERE id = '6c6faf79-5c6b-4531-b375-21f9d80d0542'::uuid AND EXISTS (SELECT 1 FROM public.exercise_library x WHERE x.id = '974e7903-7a48-4408-9658-8f9c77842d1e'::uuid);
UPDATE public.exercise_library SET replacement_exercise_id = '030b886b-f321-4fc6-ba51-76544a96efb2'::uuid, updated_at = now() WHERE id = '6e61d48d-9037-460d-95de-a12ad16b71f6'::uuid AND EXISTS (SELECT 1 FROM public.exercise_library x WHERE x.id = '030b886b-f321-4fc6-ba51-76544a96efb2'::uuid);
UPDATE public.exercise_library SET replacement_exercise_id = '60a0344b-c2fb-42d6-8d7e-70c4e6806be1'::uuid, updated_at = now() WHERE id = '6f193748-4a35-4c93-a2bc-82509dfe1107'::uuid AND EXISTS (SELECT 1 FROM public.exercise_library x WHERE x.id = '60a0344b-c2fb-42d6-8d7e-70c4e6806be1'::uuid);
UPDATE public.exercise_library SET replacement_exercise_id = '511bccb9-06af-4d39-bd26-6b8c485103d7'::uuid, updated_at = now() WHERE id = '85bba763-8491-45c2-ba6a-f39a8d52660b'::uuid AND EXISTS (SELECT 1 FROM public.exercise_library x WHERE x.id = '511bccb9-06af-4d39-bd26-6b8c485103d7'::uuid);
UPDATE public.exercise_library SET replacement_exercise_id = 'c9de022f-aa68-4d14-9035-8be797db6d8b'::uuid, updated_at = now() WHERE id = '912dbc2a-0d1c-4355-969b-2e7e9560b072'::uuid AND EXISTS (SELECT 1 FROM public.exercise_library x WHERE x.id = 'c9de022f-aa68-4d14-9035-8be797db6d8b'::uuid);
UPDATE public.exercise_library SET replacement_exercise_id = '6c6faf79-5c6b-4531-b375-21f9d80d0542'::uuid, updated_at = now() WHERE id = '974e7903-7a48-4408-9658-8f9c77842d1e'::uuid AND EXISTS (SELECT 1 FROM public.exercise_library x WHERE x.id = '6c6faf79-5c6b-4531-b375-21f9d80d0542'::uuid);
UPDATE public.exercise_library SET replacement_exercise_id = '22ed8f01-eef7-4fda-baba-7a1641a8d92e'::uuid, updated_at = now() WHERE id = '98b8cd19-93a8-4e46-8ba5-d132ce696977'::uuid AND EXISTS (SELECT 1 FROM public.exercise_library x WHERE x.id = '22ed8f01-eef7-4fda-baba-7a1641a8d92e'::uuid);
UPDATE public.exercise_library SET replacement_exercise_id = '19c09d27-7bf0-47a8-87c8-3e51bd7d4ba5'::uuid, updated_at = now() WHERE id = 'c6f797cc-9218-46d6-81fa-368ada9a94bb'::uuid AND EXISTS (SELECT 1 FROM public.exercise_library x WHERE x.id = '19c09d27-7bf0-47a8-87c8-3e51bd7d4ba5'::uuid);
UPDATE public.exercise_library SET replacement_exercise_id = '912dbc2a-0d1c-4355-969b-2e7e9560b072'::uuid, updated_at = now() WHERE id = 'c9de022f-aa68-4d14-9035-8be797db6d8b'::uuid AND EXISTS (SELECT 1 FROM public.exercise_library x WHERE x.id = '912dbc2a-0d1c-4355-969b-2e7e9560b072'::uuid);
UPDATE public.exercise_library SET replacement_exercise_id = '22ed8f01-eef7-4fda-baba-7a1641a8d92e'::uuid, updated_at = now() WHERE id = 'ce6295d8-6c3d-4ecf-af41-c4e27cdd007d'::uuid AND EXISTS (SELECT 1 FROM public.exercise_library x WHERE x.id = '22ed8f01-eef7-4fda-baba-7a1641a8d92e'::uuid);
UPDATE public.exercise_library SET replacement_exercise_id = '60a0344b-c2fb-42d6-8d7e-70c4e6806be1'::uuid, updated_at = now() WHERE id = 'e78af9cd-73e5-4347-925d-db818385e97f'::uuid AND EXISTS (SELECT 1 FROM public.exercise_library x WHERE x.id = '60a0344b-c2fb-42d6-8d7e-70c4e6806be1'::uuid);

INSERT INTO public.schema_migrations_trainly (id)
VALUES ('11a_exercise_library_trainly')
ON CONFLICT (id) DO NOTHING;

COMMIT;
