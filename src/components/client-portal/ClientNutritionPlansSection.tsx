import {
  pauseNutritionPlanAction,
  resumeNutritionPlanAction,
  startNutritionPlanAction,
} from '../../app/c/[slug]/actions'
import {
  NUT_PLAN_STATUS_LABELS,
  type ClientNutritionPlanRow,
} from '../../lib/nutrition/plans'

type Props = {
  slug: string
  primaryColor: string
  plans: ClientNutritionPlanRow[]
  returnTo: string
  nutError?: string | null
  nutStarted?: boolean
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
      return 'bg-lime-50 text-lime-900 ring-lime-100'
  }
}

export function ClientNutritionPlansSection({
  slug,
  primaryColor,
  plans,
  returnTo,
  nutError,
  nutStarted,
}: Props) {
  return (
    <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-xs font-extrabold uppercase tracking-wide text-black/45">
          Plans nutrition
        </h2>
        <p className="mt-1 text-xs text-black/45">
          Indépendant du fitness — pause pour en changer.
        </p>
      </div>

      {nutStarted ? (
        <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-100">
          Plan nutrition démarré — filtre Repas sur le calendrier.
        </div>
      ) : null}

      {nutError === 'already_active' ? (
        <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-100">
          Un plan nutrition est déjà <strong>en cours</strong>. Mets-le en pause avant d’en démarrer un
          autre.
        </div>
      ) : nutError && nutError !== 'already_active' ? (
        <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-100">
          {nutError === 'invalid' ? 'Plan introuvable ou déjà démarré.' : nutError}
        </div>
      ) : null}

      {!plans.length ? (
        <p className="mt-3 text-sm text-black/45">Aucun plan nutrition pour l’instant.</p>
      ) : (
        <ul className="mt-3 divide-y divide-black/5">
          {plans.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <p className="text-sm font-semibold text-[#1a1220]">
                  {p.title?.trim() || 'Plan nutrition'}
                </p>
                <span
                  className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${statusBadgeClass(p.status)}`}
                >
                  {NUT_PLAN_STATUS_LABELS[p.status]}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {p.status === 'waiting' ? (
                  <form action={startNutritionPlanAction}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="plan_id" value={p.id} />
                    <input type="hidden" name="return_to" value={returnTo} />
                    <button
                      type="submit"
                      className="rounded-lg px-3 py-1.5 text-xs font-bold text-white"
                      style={{ backgroundColor: primaryColor }}
                    >
                      Démarrer
                    </button>
                  </form>
                ) : null}
                {p.status === 'started' ? (
                  <form action={pauseNutritionPlanAction}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="plan_id" value={p.id} />
                    <input type="hidden" name="return_to" value={returnTo} />
                    <button
                      type="submit"
                      className="rounded-lg border border-black/15 px-3 py-1.5 text-xs font-bold text-black/65"
                    >
                      Pause
                    </button>
                  </form>
                ) : null}
                {p.status === 'paused' ? (
                  <form action={resumeNutritionPlanAction}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="plan_id" value={p.id} />
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
          ))}
        </ul>
      )}
    </section>
  )
}
