export type SimulationAnswers = {
  clientCount: number
  paymentInApp: boolean | null
  appStore: boolean | null
  strava: boolean | null
}

export type SimulationOffer = {
  planId: 'starter' | 'business' | 'scale' | 'studio'
  planName: string
  monthlyPrice: number
  setupFee: number
  included: string[]
  summary: string
}

const BASE_FEATURES = [
  'Création et gestion de programmes',
  'Bibliothèque d’exercices',
  'Espace client web responsive',
] as const

export function computeSimulationOffer(answers: SimulationAnswers): SimulationOffer | null {
  if (answers.paymentInApp === null || answers.appStore === null || answers.strava === null) {
    return null
  }

  const included = [...BASE_FEATURES]
  let monthlyPrice = 39
  let setupFee = 0
  let planName: 'Starter' | 'Business' | 'Scale' | 'Studio' = 'Starter'
  let planId: SimulationOffer['planId'] = 'starter'

  // Studio is for app store + high volume (or explicit store need).
  const needsStudio = answers.appStore && answers.clientCount > 200
  if (needsStudio) {
    planName = 'Studio'
    planId = 'studio'
    monthlyPrice = 299
    setupFee = 1500
    included.push(
      'App Store & Google Play à ton nom',
      'Domaine perso (app.tonnom.fr)',
      'Données isolées (base dédiée)',
      'Clause de rachat (prévue au contrat)',
      'Onboarding humain + support direct',
    )
  } else if (answers.clientCount > 75 || answers.strava) {
    planName = 'Scale'
    planId = 'scale'
    monthlyPrice = 179
    included.push('App installable sur mobile (PWA)', 'Notifications push web')
    if (answers.strava) {
      included.push('Sync Strava (montres compatibles Strava)')
    }
  } else if (answers.paymentInApp || answers.clientCount > 15) {
    planName = 'Business'
    planId = 'business'
    monthlyPrice = 89
    included.push(
      'White-label (logo, couleurs, nom)',
      'Adresse perso (tonnom.trainly.app)',
      'Nutrition & recettes',
      'Ta base d’exercices perso',
      'Chat coach ↔ client',
      'Rappels automatiques par email',
    )
  } else {
    planName = 'Starter'
    planId = 'starter'
    monthlyPrice = 39
    included.push('Planning et gestion client', 'Calendrier basique')
  }

  if (answers.paymentInApp) {
    if (planName === 'Starter') {
      // force Business if they need payments
      planName = 'Business'
      planId = 'business'
      monthlyPrice = 89
      included.push(
        'White-label (logo, couleurs, nom)',
        'Adresse perso (tonnom.trainly.app)',
        'Nutrition & recettes',
        'Ta base d’exercices perso',
        'Chat coach ↔ client',
        'Rappels automatiques par email',
      )
    }
    included.push('Paiements Stripe (in-app)')
  } else {
    included.push('Paiement externe (si besoin)')
  }

  if (answers.appStore) {
    if (planName !== 'Studio') {
      included.push('Publication stores : disponible en Studio')
    }
  } else {
    if (planName === 'Scale' || planName === 'Studio') {
      // already included or irrelevant
    } else {
      included.push('App installable (PWA) à partir de Scale')
    }
  }

  const summary = `Offre recommandée pour environ ${answers.clientCount} client${
    answers.clientCount > 1 ? 's' : ''
  } actif${answers.clientCount > 1 ? 's' : ''}.`

  return {
    planId,
    planName: `Offre ${planName}`,
    monthlyPrice,
    setupFee,
    included,
    summary,
  }
}
