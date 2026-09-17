export type ClientFitnessPlanStatus = 'waiting' | 'started' | 'paused' | 'done'

export type ClientFitnessPlanRow = {
  id: string
  status: ClientFitnessPlanStatus
  is_calendar: boolean
  start_date: string | null
  source_program_id: string | null
  created_at: string
  programs: {
    id: string
    title: string | null
    description: string | null
    is_calendar: boolean | null
  } | null
}

export const PLAN_STATUS_LABELS: Record<ClientFitnessPlanStatus, string> = {
  waiting: 'En attente',
  started: 'En cours',
  paused: 'Pause',
  done: 'Terminé',
}

export function planProgramTitle(plan: ClientFitnessPlanRow): string {
  return plan.programs?.title?.trim() || 'Programme'
}

export function isActivePlanStatus(status: string): boolean {
  return status === 'started' || status === 'paused'
}

/** Plan utilisé pour l’Accueil : priorité au démarré, sinon pause. */
export function pickActiveFitnessPlan(plans: ClientFitnessPlanRow[]): ClientFitnessPlanRow | null {
  return plans.find((p) => p.status === 'started') ?? plans.find((p) => p.status === 'paused') ?? null
}
