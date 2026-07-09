-- Descriptions (+ demo_media_path si vide) pour TES exercices Crossfit uniquement.
-- Ne remplace PAS un demo_media_path déjà renseigné (ex. devil_press.webp, rameur.gif).
-- À exécuter dans l’éditeur SQL Supabase.

BEGIN;

WITH crossfit_catalog AS (
  SELECT *
  FROM (
    VALUES
      -- name EXACT (comme en base) | demo_media_path si vide | description
      ('Assault bike', 'assault_bike.gif', 'Cardio haute intensité sur vélo assault : pédaler en puissance tout en maintenant une posture neutre.'),
      ('Box jump', 'box_jump.gif', 'Saut sur box : amortir en squat partiel à l’atterrissage, genoux alignés avec les pieds, redescendre en contrôlé.'),
      ('Burpees', 'burpees.gif', 'Enchaînement squat-planche-pompe-saut : corps gainé en planche, poitrine qui frôle le sol, enchaînement fluide.'),
      ('Burpees box jump', 'burpees_box_jump.gif', 'Burpee suivi d’un saut sur box : même qualité de planche, réception souple en squat sur la box.'),
      ('Burpees over bar', 'burpees_over_bar.gif', 'Burpee avec franchissement de barre : sauter ou step-over selon le niveau, garder les mains actives.'),
      ('Clean & Jerk', 'clean_and_jerk.gif', 'Enchaînement haltéro : épauler la barre puis développé-jerk overhead, extension complète des hanches et verrouillage stable.'),
      ('DB snatch', 'db_snatch.gif', 'Arraché haltère un bras : trajectoire verticale près du corps, verrouillage bras tendu au-dessus de la tête.'),
      ('Devil press', NULL, 'Burpee + snatch double haltères : enchaîner planche puis tirer les haltères en overhead en un seul flux.'),
      ('Double unders', 'double_unders.gif', 'Corde à sauter : deux tours de corde par saut, coudes près du corps, rebond sur l’avant-pied.'),
      ('Handstand Push-ups', 'handstand_push_ups.gif', 'Pompes en équilibre (mur ou libre) : descendre la tête contrôlée, repousser bras tendus au verrouillage.'),
      ('Hang power clean', 'hang_power_clean.gif', 'Épaulé hang power : barre au-dessus des genoux, extension explosive des hanches, réception en demi-squat coudes hauts.'),
      ('Muscle-up', 'muscle_up.gif', 'Traction explosive + transition au-dessus des barres ou anneaux : tirer la poitrine haute puis basculer les coudes au-dessus.'),
      ('Power clean', 'power_clean.gif', 'Épaulé power depuis le sol : tirer la barre, recevoir en demi-squat, coudes rapides sous la barre.'),
      ('Power snatch', 'power_snatch.gif', 'Arraché power : recevoir la barre en demi-squat, barre proche du corps, verrouillage overhead.'),
      ('Rameur', NULL, 'Rameur Concept2 : poussée jambes puis bras, retour bras-jambes, cadence régulière.'),
      ('Ski_erg', NULL, 'SkiErg : tirer les poignées vers le bas en engageant jambes et tronc, retour contrôlé.'),
      ('Snatch', 'snatch.gif', 'Arraché barre : tirer verticalement, recevoir overhead en squat ou power selon la technique visée.'),
      ('Thruster', 'thruster.gif', 'Squat front + développé : descendre en squat profond, monter et pousser la barre ou haltères overhead en un flux.'),
      ('Toes-to-bar', 'toes_to_bar.gif', 'Pieds aux barres : suspendu, lever les jambes jusqu’au contact orteils-barre, contrôler la descente.'),
      ('Wall walk', 'wall_walk.gif', 'Marche au mur en handstand : petits pas mains/pieds, regarder le mur, tronc gainé.')
  ) AS t(exercise_name, demo_media_path_if_empty, description)
),
matched AS (
  SELECT
    el.id,
    c.description,
    c.demo_media_path_if_empty
  FROM exercise_library el
  INNER JOIN crossfit_catalog c
    ON trim(el.name) = trim(c.exercise_name)
  WHERE lower(trim(el.muscle_group)) = 'crossfit'
)
UPDATE exercise_library el
SET
  description = m.description,
  demo_media_path = COALESCE(
    NULLIF(trim(el.demo_media_path), ''),
    m.demo_media_path_if_empty
  )
FROM matched m
WHERE el.id = m.id;

COMMIT;

-- Vérification
SELECT name, muscle_group, demo_media_path, left(description, 100) AS description_preview
FROM exercise_library
WHERE lower(trim(muscle_group)) = 'crossfit'
ORDER BY name;
