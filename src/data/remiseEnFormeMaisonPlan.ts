/**
 * Plan « Remise en forme à la maison » (Top Body Challenge) — pages PDF séances ~14–37.
 * 12 semaines calendaires, 3 séances / semaine (Lundi, Mercredi, Vendredi), 3 circuits × 3 exercices.
 * Semaines dupliquées comme dans le PDF : 3=5, 4=6, 7=9, 8=10 ; 1, 2, 11 et 12 uniques.
 *
 * Les exercices sont référencés par `key` ; le script `seed-remise-en-forme-maison.ts` (optionnel)
 * les résout sur la table `exercise_library` via `TOP_BODY_PLAN_KEY_ALIASES`. Sinon ce fichier sert de référence pour saisie manuelle.
 */

export type PlanSlot = {
  /** Clé stable pour résolution fuzzy côté import */
  key: string
  /** Notes affichées (séries / reps / tempo du PDF) */
  notes?: string | null
  sets?: number | null
  reps?: number | null
}

export type PlanCircuit = readonly [PlanSlot, PlanSlot, PlanSlot]

export type PlanSession = {
  day: 'Lundi' | 'Mercredi' | 'Vendredi'
  focus: string
  circuits: readonly [PlanCircuit, PlanCircuit, PlanCircuit]
}

export type PlanWeekTemplate = {
  sessions: readonly [PlanSession, PlanSession, PlanSession]
}

/** Semaine calendaire 1 → index template 0..7 (8 grilles distinctes). */
export const CALENDAR_WEEK_TO_TEMPLATE_INDEX: readonly number[] = [
  0, 1, 2, 3, 2, 3, 4, 5, 4, 5, 6, 7,
]

/** Cardio hebdo (semaine calendaire 1–12) — synthèse du PDF pages 12–13. */
export const CARDIO_HINT_BY_CALENDAR_WEEK: readonly string[] = [
  "2 séances cardio : 30 min alternance marche 5 min / course 3 min (répéter).",
  "2 séances : 40 min alternance marche 3 min / course 3 min.",
  "2 séances : 40 min alternance marche 2 min / course 5 min.",
  "Séance 1 : 30 min course modérée (conversation possible). Séance 2 : 40 min course modérée.",
  "Séance 1 : 40 min course modérée. Séance 2 : 10 min modérée + 5×(2 min rapide / 2 min lent) + 10 min modérée.",
  "Séance 1 : 45 min modérée. Séance 2 : 10 min modérée + 5×(2 min rapide / 2 min lent) + 10 min modérée.",
  "Séance 1 : 50 min modérée. Séance 2 : 60 min allure lente.",
  "Séance 1 : 50 min modérée. Séance 2 : 10 min modérée + 5×(2 min rapide / 2 min modérée) + 10 min modérée.",
  "Séance 1 : 50 min modérée. Séance 2 : 70 min allure lente.",
  "Séance 1 : 50 min modérée. Séance 2 : 10 min modérée + 10×(1 min très rapide / 1 min lent) + 10 min modérée.",
  "Séance 1 : 60 min modérée. Séance 2 : 90 min allure lente.",
  "Séance 1 : 60 min modérée. Séance 2 : 10 min modérée + 2×(10 min rapide + 10 min lent) + 10 min modérée.",
]

const C = (a: PlanSlot, b: PlanSlot, c: PlanSlot): PlanCircuit => [a, b, c]

const slot = (key: string, notes?: string, reps?: number | null, sets?: number | null): PlanSlot => ({
  key,
  notes: notes ?? null,
  reps: reps ?? null,
  sets: sets ?? null,
})

/** Alias textuels (normalisation sans accents côté script) → noms dans `exercise_library`. */
export const TOP_BODY_PLAN_KEY_ALIASES: Record<string, readonly string[]> = {
  bridge: ['bridge', 'pont', 'hip thrust', 'bassin', 'soulevement de bassin', 'glute bridge'],
  ab_bikes: ['ab bike', 'velo', 'vélo', 'bicycle', 'abdos vélo', 'air bike', 'pedalo'],
  plank: ['planche', 'plank', 'gainage'],
  sumo_squat: ['sumo squat', 'squat sumo', 'squat ecart', 'écarté'],
  squat: ['squat', 'squat classique'],
  sit_up: ['sit up', 'sit-up', 'situp', 'relevé', 'releve'],
  sit_up_twist: ['twist', 'rotation', 'oblique', 'russian'],
  single_leg_hip_raise: ['single leg', 'une jambe', 'hip raise', 'pont une jambe', 'unilateral'],
  triceps_dips: ['dip', 'triceps chaise', 'rebord', 'cuisse'],
  standing_butterfly: ['butterfly', 'élévation', 'elevation', 'oiseau', 'lateral', 'latéral'],
  curl: ['curl', 'biceps'],
  arms_extension: ['extension', 'triceps', 'kickback', 'arrière bras'],
  donkey_kick: ['donkey kick', 'coup de pied', 'quatre pattes'],
  donkey_side_kick: ['donkey side', 'latéral', 'lateral', 'fourchette'],
  mountain_climber: ['mountain climber', 'grimpeur', 'genou poitrine'],
  mountain_climber_pushup: ['mountain climber', 'push up', 'pompe', 'combined', 'combo'],
  push_up: ['pompe', 'push-up', 'push up', 'pompes'],
  jump_squat: ['jump squat', 'squat saut', 'saut'],
  jump_lunge: ['jump lunge', 'fente saut', 'fentes sautées', 'fente sautee'],
  alternate_lunge: ['fente', 'lunge', 'alternance', 'alternées'],
  commando: ['commando', 'planche', 'militaire'],
  straight_leg_jackknife: ['jackknife', 'v-sit', 'v sit', 'relevé jambes', 'releve jambe'],
  straight_leg_sit_up: ['straight leg sit', 'jambes tendues', 'tendu'],
  raised_leg_sit_up_twist: ['raised leg', 'twist', 'relevé', 'jambe relevée'],
  toe_touches: ['toe touch', 'orteils', 'touchées'],
  straight_leg_raises: ['leg raise', 'relevé jambe', 'lever de jambe', 'jambes tendues'],
  x_hops: ['x hop', 'saut', 'écart', 'ecart'],
  thruster: ['thruster', 'squat press', 'clean', 'press', 'squat et extension'],
  jump_rope: [
    'jump rope',
    'jumping rope',
    'skipping',
    'rope skip',
    'corde',
    'cordes',
    'corde a sauter',
    'corde à sauter',
    'saut a la corde',
    'saut à la corde',
    'sauts a la corde',
    'sauts à la corde',
  ],
  weighted_squat_clean_press: ['thruster', 'squat', 'press', 'développé', 'developpe'],
}

/** @deprecated Utiliser TOP_BODY_PLAN_KEY_ALIASES (même contenu). */
export const MAISON_EXERCISE_KEY_ALIASES = TOP_BODY_PLAN_KEY_ALIASES

/** Texte programme (méta). */
export const REMISE_EN_FORME_MAISON_PROGRAM_META = {
  title: 'Remise en forme maison',
  description:
    "Programme 12 semaines inspiré du Top Body Challenge (pages séances du PDF) : 3 séances de renforcement par semaine en circuits (3 × 10 minutes), complétées par du cardio. Les mouvements sont ceux de ta bibliothèque `exercise_library`.",
  goal: 'Retrouver tonus, silhouette harmonieuse et endurance — sans salle de sport.',
  level: 'Intermédiaire',
  duration: '12 semaines',
} as const

/** 8 grilles distinctes (indices 0..7). */
export const WEEK_TEMPLATES: readonly PlanWeekTemplate[] = [
  // —— Template 0 : semaine calendaire 1 ——
  {
    sessions: [
      {
        day: 'Lundi',
        focus: 'Abdos & cuisses',
        circuits: [
          C(slot('bridge', '20 lents puis 20 rapides'), slot('ab_bikes', '20 répétitions'), slot('plank', '3 × 20 s, 20 s repos entre')),
          C(slot('ab_bikes', '20 rapides'), slot('sumo_squat', '20 reps'), slot('squat', '20 reps')),
          C(slot('squat', '20 reps'), slot('plank', '20 reps'), slot('single_leg_hip_raise', '20 reps / jambe')),
        ],
      },
      {
        day: 'Mercredi',
        focus: 'Bras & fessiers',
        circuits: [
          C(slot('triceps_dips', '15 reps'), slot('sumo_squat', '30 reps'), slot('thruster', '10 lents + 10 rapides — option 2 kg')),
          C(slot('standing_butterfly', '20 lents / haltères option'), slot('curl', '10 lents + 10 rapides'), slot('single_leg_hip_raise', '12 / jambe')),
          C(slot('single_leg_hip_raise', '30 / jambe'), slot('donkey_side_kick', '20 lents + 30 rapides'), slot('donkey_kick', '30 / jambe')),
        ],
      },
      {
        day: 'Vendredi',
        focus: 'Total corps',
        circuits: [
          C(slot('sumo_squat', '30 reps'), slot('arms_extension', '25 reps / bras'), slot('bridge', '40 reps')),
          C(slot('donkey_side_kick', '10 lents + 10 tendus'), slot('straight_leg_sit_up', '20 reps'), slot('sumo_squat', '20 reps')),
          C(slot('triceps_dips', '20 reps'), slot('mountain_climber_pushup', 'Voir PDF — pompes sur genoux OK'), slot('donkey_kick', '20 reps')),
        ],
      },
    ],
  },
  // —— Template 1 : semaine 2 ——
  {
    sessions: [
      {
        day: 'Lundi',
        focus: 'Abdos & cuisses',
        circuits: [
          C(slot('squat', '25 reps'), slot('ab_bikes', '15 reps'), slot('jump_squat', '15 reps')),
          C(slot('jump_squat', '15 reps'), slot('sit_up_twist', '15 / côté'), slot('commando', '2×8, 1 min repos')),
          C(slot('raised_leg_sit_up_twist', '2×10'), slot('jump_lunge', '2×10 sauts'), slot('sumo_squat', '15 reps')),
        ],
      },
      {
        day: 'Mercredi',
        focus: 'Bras & fessiers',
        circuits: [
          C(slot('bridge', '2×8'), slot('thruster', '2×8 — 2 kg option'), slot('arms_extension', '10 / bras')),
          C(slot('curl', '20 lents + 10 rapides'), slot('single_leg_hip_raise', '12 / jambe'), slot('donkey_side_kick', '30 / jambe')),
          C(slot('thruster', '2×8'), slot('donkey_kick', '30 / jambe'), slot('standing_butterfly', '30 reps')),
        ],
      },
      {
        day: 'Vendredi',
        focus: 'Total corps',
        circuits: [
          C(slot('sit_up', '20 reps'), slot('jump_lunge', '10 reps'), slot('plank', '4×30 s')),
          C(slot('sit_up_twist', '2×20'), slot('x_hops', '10 reps'), slot('commando', '2×6, 1 min repos')),
          C(slot('standing_butterfly', '30 — charge option'), slot('x_hops', '2×6'), slot('jump_rope', '5×30 s')),
        ],
      },
    ],
  },
  // —— Template 2 : semaines 3 & 5 ——
  {
    sessions: [
      {
        day: 'Lundi',
        focus: 'Abdos & cuisses',
        circuits: [
          C(slot('sit_up_twist', '30 reps'), slot('alternate_lunge', '20 sans saut'), slot('straight_leg_jackknife', '10 reps')),
          C(slot('plank', '3×45 s jambes tendues'), slot('jump_lunge', '40 reps'), slot('sit_up', '20 reps')),
          C(slot('alternate_lunge', '20 sans saut'), slot('toe_touches', '15 reps'), slot('straight_leg_sit_up', '20 reps')),
        ],
      },
      {
        day: 'Mercredi',
        focus: 'Bras & fessiers',
        circuits: [
          C(slot('thruster', '25 reps — 2 kg'), slot('curl', '20 / jambe'), slot('single_leg_hip_raise', '35 / jambe')),
          C(slot('donkey_side_kick', '20 lents + 30 rapides'), slot('standing_butterfly', '40 reps'), slot('squat', '35 reps')),
          C(slot('donkey_kick', '35 / jambe'), slot('squat', '35 reps'), slot('bridge', '30 lents + 10 rapides')),
        ],
      },
      {
        day: 'Vendredi',
        focus: 'Total corps',
        circuits: [
          C(slot('commando', '2×6, 1 min repos'), slot('mountain_climber_pushup', 'Voir PDF'), slot('x_hops', '2×15')),
          C(slot('sumo_squat', '10 reps'), slot('straight_leg_raises', '10 reps'), slot('plank', '2×1 min')),
          C(slot('jump_rope', '3×1 min'), slot('straight_leg_raises', '10 reps'), slot('triceps_dips', '20 reps')),
        ],
      },
    ],
  },
  // —— Semaines calendaires 4 & 6 ——
  {
    sessions: [
      {
        day: 'Lundi',
        focus: 'Abdos & cuisses',
        circuits: [
          C(slot('sit_up', '40 reps'), slot('squat', '40 reps'), slot('raised_leg_sit_up_twist', '20 reps')),
          C(slot('raised_leg_sit_up_twist', '20 reps'), slot('jump_squat', '2×10'), slot('sumo_squat', 'Série longue')),
          C(slot('sumo_squat', '3×1 min planche'), slot('plank', '3×1 min'), slot('jump_rope', '3×1 min')),
        ],
      },
      {
        day: 'Mercredi',
        focus: 'Bras & fessiers',
        circuits: [
          C(slot('bridge', '25 reps — charge bassin option'), slot('standing_butterfly', '40 reps'), slot('single_leg_hip_raise', '25 / jambe')),
          C(slot('curl', '2×15, 1 min repos'), slot('donkey_kick', '25 / jambe'), slot('single_leg_hip_raise', '25 / jambe')),
          C(slot('donkey_side_kick', '25 / jambe'), slot('standing_butterfly', '40 reps'), slot('arms_extension', '25 / jambe')),
        ],
      },
      {
        day: 'Vendredi',
        focus: 'Total corps',
        circuits: [
          C(slot('straight_leg_raises', '3×10'), slot('x_hops', '30 reps'), slot('sit_up', '30 reps haltères option')),
          C(slot('standing_butterfly', 'mountain + pompe 2×10'), slot('mountain_climber_pushup', '2×10'), slot('squat', '40 reps')),
          C(slot('curl', '2×10'), slot('jump_lunge', '30 reps'), slot('thruster', '40 reps')),
        ],
      },
    ],
  },
  // —— Template 4 : semaines 7 & 9 ——
  {
    sessions: [
      {
        day: 'Lundi',
        focus: 'Abdos & cuisses',
        circuits: [
          C(slot('sit_up_twist', '40 reps'), slot('straight_leg_jackknife', '30 reps'), slot('jump_lunge', '3×10')),
          C(slot('squat', '2×25, 10 s repos'), slot('jump_squat', '2×15'), slot('jump_squat', '2×10')),
          C(slot('sumo_squat', '2×20'), slot('mountain_climber', '2×20'), slot('ab_bikes', '2×30')),
        ],
      },
      {
        day: 'Mercredi',
        focus: 'Bras & fessiers',
        circuits: [
          C(slot('single_leg_hip_raise', '2×20 / jambe'), slot('donkey_side_kick', '20 / jambe'), slot('curl', '50 reps')),
          C(slot('commando', '30 / jambe'), slot('mountain_climber_pushup', '2×10'), slot('thruster', '30 lents + 30 rapides')),
          C(slot('bridge', '2×15'), slot('jump_lunge', '2×25'), slot('ab_bikes', '2 min non-stop')),
        ],
      },
      {
        day: 'Vendredi',
        focus: 'Total corps',
        circuits: [
          C(slot('straight_leg_raises', '30 reps'), slot('donkey_kick', '20 lents + 20 rapides'), slot('squat', '2×25')),
          C(slot('curl', '50 reps'), slot('mountain_climber_pushup', '15 reps'), slot('jump_rope', '4×1 min')),
          C(slot('plank', 'Gainage'), slot('sit_up', '30 reps'), slot('x_hops', '15 reps')),
        ],
      },
    ],
  },
  // —— Template 5 : semaines 8 & 10 ——
  {
    sessions: [
      {
        day: 'Lundi',
        focus: 'Abdos & cuisses',
        circuits: [
          C(slot('sit_up', '2×30'), slot('raised_leg_sit_up_twist', '30 reps'), slot('jump_squat', '2×30')),
          C(slot('sumo_squat', '2×20'), slot('toe_touches', '40 reps'), slot('plank', '2×1 min')),
          C(slot('straight_leg_jackknife', '30 reps'), slot('sumo_squat', '3×30'), slot('jump_rope', '3×1 min')),
        ],
      },
      {
        day: 'Mercredi',
        focus: 'Bras & fessiers',
        circuits: [
          C(slot('bridge', '20 lents + 30 rapides'), slot('standing_butterfly', '40 reps'), slot('single_leg_hip_raise', '30 / jambe')),
          C(slot('arms_extension', '30 / bras'), slot('donkey_kick', '30 / jambe'), slot('donkey_side_kick', '20 reps')),
          C(slot('mountain_climber_pushup', '20 reps'), slot('bridge', 'série longue'), slot('curl', '50 reps')),
        ],
      },
      {
        day: 'Vendredi',
        focus: 'Total corps',
        circuits: [
          C(slot('x_hops', '2×15'), slot('squat', '2×30'), slot('thruster', '40 reps')),
          C(slot('curl', '50 reps'), slot('straight_leg_jackknife', '30 reps'), slot('plank', '2×1 min')),
          C(slot('toe_touches', '40 reps'), slot('bridge', '2×30 / jambe'), slot('donkey_kick', '2×30 / jambe')),
        ],
      },
    ],
  },
  // —— Template 6 : semaine 11 ——
  {
    sessions: [
      {
        day: 'Lundi',
        focus: 'Abdos & cuisses',
        circuits: [
          C(slot('squat', 'Série 1'), slot('plank', '3×1 min'), slot('toe_touches', '40 reps')),
          C(slot('jump_squat', '2×15'), slot('jump_lunge', '50 + 20 reps'), slot('straight_leg_sit_up', '40 reps')),
          C(slot('sit_up_twist', '50 reps'), slot('straight_leg_raises', '30 reps'), slot('plank', 'Gainage')),
        ],
      },
      {
        day: 'Mercredi',
        focus: 'Bras & fessiers',
        circuits: [
          C(slot('bridge', '2×30 lents + 30 rapides'), slot('single_leg_hip_raise', '40 / jambe'), slot('curl', '50 reps')),
          C(slot('standing_butterfly', '40 reps'), slot('donkey_side_kick', '40 lents / jambe'), slot('donkey_kick', '30 / jambe')),
          C(slot('bridge', '50 lents'), slot('donkey_kick', '40 lents / jambe'), slot('triceps_dips', '30 reps')),
        ],
      },
      {
        day: 'Vendredi',
        focus: 'Total corps',
        circuits: [
          C(slot('jump_lunge', '20 reps'), slot('sumo_squat', '30 reps'), slot('commando', '20 reps')),
          C(slot('triceps_dips', '20 reps'), slot('donkey_kick', '30 lents + 20 rapides'), slot('plank', '2×1 min')),
          C(slot('jump_squat', '2×20'), slot('straight_leg_jackknife', '2×20'), slot('bridge', 'charge bassin option')),
        ],
      },
    ],
  },
  // —— Template 7 : semaine 12 ——
  {
    sessions: [
      {
        day: 'Lundi',
        focus: 'Cuisses & finition',
        circuits: [
          C(slot('sit_up_twist', '40 reps'), slot('plank', '2×1 min'), slot('jump_lunge', '30 reps')),
          C(slot('raised_leg_sit_up_twist', '40 reps'), slot('jump_lunge', '40 reps'), slot('straight_leg_raises', '40 reps')),
          C(slot('jump_squat', '2×15'), slot('plank', '3×1 min'), slot('sumo_squat', '50 reps')),
        ],
      },
      {
        day: 'Mercredi',
        focus: 'Bras & fessiers',
        circuits: [
          C(slot('bridge', '40 lents + 20 rapides'), slot('single_leg_hip_raise', '30 / jambe'), slot('donkey_side_kick', '30 reps')),
          C(slot('triceps_dips', '30 reps'), slot('donkey_kick', '30 lents + 30 rapides'), slot('commando', '2×30')),
          C(slot('bridge', '50 lents'), slot('sumo_squat', '40 reps'), slot('mountain_climber_pushup', '2×20')),
        ],
      },
      {
        day: 'Vendredi',
        focus: 'Total corps — clôture',
        circuits: [
          C(slot('mountain_climber_pushup', '25 reps'), slot('squat', '30 reps'), slot('triceps_dips', '25 reps')),
          C(slot('commando', '25 reps'), slot('sumo_squat', '30 reps'), slot('jump_squat', '30 reps')),
          C(slot('straight_leg_jackknife', '40 reps'), slot('plank', '3×1 min'), slot('toe_touches', '50 reps')),
        ],
      },
    ],
  },
]
