export type PricingPlan = {
  id: string
  name: string
  clientRange: string
  tagline: string
  monthlyPrice?: number
  setupFee?: number
  pricePrefix?: string
  setupFeeLabel?: string
  clientsForPriceCalc?: number
  features: string[]
  highlighted?: boolean
}

export function getPlanById(id: string): PricingPlan | undefined {
  return PRICING_PLANS.find((plan) => plan.id === id)
}

export function buildContactOfferHref(plan: PricingPlan): string {
  const params = new URLSearchParams({ offer: plan.id })
  return `/contact?${params.toString()}`
}

export function getOfferContactSummary(plan: PricingPlan): { priceLabel: string; clientLabel: string } {
  return {
    priceLabel:
      plan.monthlyPrice !== undefined
        ? `${plan.pricePrefix ? `${plan.pricePrefix} ` : ''}${plan.monthlyPrice}€ / mois`
        : 'Sur devis',
    clientLabel: plan.clientRange,
  }
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    clientRange: 'Jusqu’à 15 clients',
    tagline: 'Pour démarrer avec un outil pro, simple et efficace.',
    monthlyPrice: 39,
    setupFee: 0,
    clientsForPriceCalc: 15,
    features: [
      'Création et gestion de programmes',
      'Bibliothèque d’exercices',
      'Espace client web responsive',
      'Planning et gestion client',
      'Calendrier basique',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    clientRange: 'Jusqu’à 75 clients',
    tagline: 'Ton app à ton image + paiements intégrés pour vendre plus facilement.',
    monthlyPrice: 89,
    setupFee: 0,
    clientsForPriceCalc: 75,
    highlighted: true,
    features: [
      'Tout Starter',
      'White-label (logo, couleurs, nom)',
      'Adresse perso (tonnom.trainly.app)',
      'Paiements Stripe (in-app)',
      'Nutrition & recettes',
      'Ta base d’exercices perso',
      'Chat coach ↔ client',
      'Rappels automatiques par email',
    ],
  },
  {
    id: 'scale',
    name: 'Scale',
    clientRange: 'Jusqu’à 200 clients',
    tagline: 'Une expérience mobile complète pour scaler sans friction.',
    monthlyPrice: 179,
    setupFee: 0,
    clientsForPriceCalc: 200,
    features: [
      'Tout Business',
      'App installable sur mobile (PWA)',
      'Notifications push web',
      'Sync Strava (montres compatibles Strava)',
      'Statistiques clients avancées',
      'Support prioritaire',
    ],
  },
  {
    id: 'studio',
    name: 'Studio',
    clientRange: '500+ clients',
    tagline: 'Ton actif : app 100% à ton nom, stores, isolation et option de rachat.',
    monthlyPrice: 299,
    setupFeeLabel: '+ 1 500€ de mise en place',
    clientsForPriceCalc: 500,
    features: [
      'Tout Scale',
      'Zéro mention Trainly (100% ta marque)',
      'Domaine perso (app.tonnom.fr)',
      'App Store & Google Play à ton nom',
      'Données isolées (base dédiée)',
      'Clause de rachat (prévue au contrat)',
      'Onboarding humain + support direct',
    ],
  },
]
