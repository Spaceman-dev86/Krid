import {
  pauseFitnessPlanAction,
  resumeFitnessPlanAction,
  startFitnessPlanAction,
} from '../../app/c/[slug]/actions'
import {
  PLAN_STATUS_LABELS,
  type ClientFitnessPlanRow,
  planProgramTitle,
} from '../../lib/client-portal/fitnessPlans'

type Props = {
  slug: string
  primaryColor: string
  plans: ClientFitnessPlanRow[]
  returnTo: string
  planError?: string | null
  planStarted?: boolean
}

function statusBadgeClass(status: string) {
  switch (status) {
    case 'started':
      return 'bg-emerald-50 text-emerald-800 ring-emerald-100'
    case 'paused':
      return 'bg-amber-50 text-amber-900 ring-amber-100'
    case 'done':
      return 'bg-black/5 text-black/55 ring-black/10'
    default:
      return 'bg-violet-50 text-violet-900 ring-violet-100'
  }
}

export function ClientFitnessPlansSection({
  slug,
  primaryColor,
  plans,
  returnTo,
  planError,
  planStarted,
}: Props) {
  return (
    <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xs font-extrabold uppercase tracking-wide text-black/45">Plans fitness</h2>
          <p className="mt-1 text-xs text-black/45">
            Achat ≠ démarrage — tu choisis quand commencer.
          </p>
        </div>
        <span
          className="rounded-lg bg-black/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-black/40"
          title="Gestion des plans"
        >
          Book
        </span>
      </div>

      {planStarted ? (
        <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-100">
          Programme démarré — les séances sont accessibles ci-dessous.
        </div>
      ) : null}

      {planError === 'already_active' ? (
        <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-100">
          Un plan est déjà <strong>en cours</strong>. Mets-le en pause avant d’en démarrer un autre.
        </div>
      ) : planError && planError !== 'already_active' ? (
        <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-100">
          {planError === 'invalid' ? 'Plan introuvable ou déjà démarré.' : planError}
        </div>
      ) : null}

      {!plans.length ? (
        <p className="mt-3 text-sm text-black/45">
          Aucun programme envoyé par ton coach pour l’instant.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-black/5">
          {plans.map((plan) => {
            const label = PLAN_STATUS_LABELS[plan.status as keyof typeof PLAN_STATUS_LABELS] ?? plan.status
            return (
              <li key={plan.id} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#1a1220]">{planProgramTitle(plan)}</p>
                    <p className="mt-0.5 text-xs text-black/45">
                      {plan.created_at
                        ? `Envoyé le ${new Date(plan.created_at).toLocaleDateString('fr-FR')}`
                        : ''}
                      {plan.start_date
                        ? ` · démarré le ${new Date(plan.start_date).toLocaleDateString('fr-FR')}`
                        : ''}
                      {plan.is_calendar ? ' · mode calendrier' : ' · mode séances'}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${statusBadgeClass(plan.status)}`}
                  >
                    {label}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  {plan.status === 'waiting' ? (
                    <form action={startFitnessPlanAction}>
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="plan_id" value={plan.id} />
                      <input type="hidden" name="return_to" value={returnTo} />
                      <button
                        type="submit"
                        className="rounded-lg px-3 py-1.5 text-xs font-bold text-white"
                        style={{ backgroundColor: primaryColor }}
                      >
                        Démarrer le plan
                      </button>
                    </form>
                  ) : null}

                  {plan.status === 'started' ? (
                    <form action={pauseFitnessPlanAction}>
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="plan_id" value={plan.id} />
                      <input type="hidden" name="return_to" value={returnTo} />
                      <button
                        type="submit"
                        className="rounded-lg border border-black/15 px-3 py-1.5 text-xs font-bold text-black/65"
                      >
                        Pause
                      </button>
                    </form>
                  ) : null}

                  {plan.status === 'paused' ? (
                    <form action={resumeFitnessPlanAction}>
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="plan_id" value={plan.id} />
                      <input type="hidden" name="return_to" value={returnTo} />
                      <button
                        type="submit"
                        className="rounded-lg px-3 py-1.5 text-xs font-bold text-white"
                        style={{ backgroundColor: primaryColor }}
                      >
                        Reprendre
                      </button>
                    </form>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
