import { redirect } from 'next/navigation'

import { requireClientPortal } from '../../../../lib/client-portal/context'
import { listCoachOnboardingQuestions } from '../../../../lib/client-portal/onboarding'
import { selectFieldClass, selectFieldStyle } from '../../../../lib/ui/selectField'
import { createClient } from '../../../../lib/supabase/server'
import { saveOnboardingAnswerAction } from './actions'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ slug: string }> | { slug: string }
  searchParams?:
    | Promise<{ step?: string; error?: string; resume?: string }>
    | { step?: string; error?: string; resume?: string }
}

export default async function ClientOnboardingPage({ params, searchParams }: Props) {
  const { slug } = await Promise.resolve(params)
  const q = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const ctx = await requireClientPortal(supabase, slug, user?.id, { skipOnboardingGate: true })
  const questions = await listCoachOnboardingQuestions(supabase, ctx.coachId)

  if (!questions.length || ctx.client.onboarding_completed_at) {
    if (!ctx.client.onboarding_completed_at) {
      await supabase
        .from('clients')
        .update({ onboarding_completed_at: new Date().toISOString() })
        .eq('id', ctx.client.id)
    }
    redirect(`/c/${ctx.slug}/home`)
  }

  const { data: answers } = await supabase
    .from('onboarding_answers')
    .select('question_id, value')
    .eq('client_id', ctx.client.id)

  const answeredIds = new Set((answers ?? []).map((a) => a.question_id))
  const firstUnanswered = questions.findIndex((qq) => !answeredIds.has(qq.id))
  const hasPartial = answeredIds.size > 0 && firstUnanswered > 0

  let step = Number(q.step ?? '')
  if (!Number.isFinite(step) || step < 0) {
    step = firstUnanswered >= 0 ? firstUnanswered : 0
  }
  if (step >= questions.length) step = Math.max(0, questions.length - 1)

  const showResumeChoice = q.resume !== '0' && hasPartial && q.step == null
  const brand = ctx.primaryColor
  const current = questions[step]
  const progress = questions.length ? Math.round(((step + 1) / questions.length) * 100) : 100

  if (showResumeChoice) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f4f8] px-4">
        <div className="w-full max-w-md rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-extrabold" style={{ color: brand }}>
            Reprendre le questionnaire ?
          </h1>
          <p className="mt-2 text-sm text-black/55">
            Tu avais commencé ({answeredIds.size}/{questions.length}). Que veux-tu faire ?
          </p>
          <div className="mt-5 grid gap-2">
            <a
              href={`/c/${ctx.slug}/onboarding?step=${firstUnanswered}&resume=0`}
              className="rounded-lg px-4 py-3 text-center text-sm font-bold text-white"
              style={{ background: brand }}
            >
              Reprendre
            </a>
            <form action={saveOnboardingAnswerAction}>
              <input type="hidden" name="slug" value={ctx.slug} />
              <input type="hidden" name="restart" value="1" />
              <button
                type="submit"
                className="w-full rounded-lg border border-black/15 px-4 py-3 text-sm font-semibold text-black/60"
              >
                Recommencer
              </button>
            </form>
          </div>
        </div>
      </main>
    )
  }

  const existing = answers?.find((a) => a.question_id === current.id)?.value
  const existingStr =
    existing === true ? 'oui' : existing === false ? 'non' : existing == null ? '' : String(existing)

  return (
    <main className="min-h-screen bg-[#f6f4f8] text-[#1a1220]">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col px-4 py-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/40">{ctx.appName}</p>
        <h1 className="mt-2 text-2xl font-extrabold" style={{ color: brand }}>
          Quelques questions
        </h1>
        <p className="mt-1 text-sm text-black/50">
          {step + 1} / {questions.length}
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/10">
          <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: brand }} />
        </div>

        {q.error === 'required' ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            Réponse requise.
          </p>
        ) : null}
        {q.error === 'nombre' ? (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            Entre un nombre valide.
          </p>
        ) : q.error && q.error !== 'required' ? (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{q.error}</p>
        ) : null}

        <form action={saveOnboardingAnswerAction} className="mt-8 flex flex-1 flex-col">
          <input type="hidden" name="slug" value={ctx.slug} />
          <input type="hidden" name="question_id" value={current.id} />
          <input type="hidden" name="step" value={String(step)} />

          <label className="grid gap-3">
            <span className="text-lg font-bold text-[#1a1220]">
              {current.label}
              {current.required ? ' *' : ''}
            </span>

            {current.type === 'oui_non' ? (
              <select
                name="value"
                required={current.required}
                defaultValue={existingStr || ''}
                className={selectFieldClass}
                style={selectFieldStyle}
              >
                <option value="">Choisir…</option>
                <option value="oui">Oui</option>
                <option value="non">Non</option>
              </select>
            ) : current.type === 'choix' ? (
              <select
                name="value"
                required={current.required}
                defaultValue={existingStr || ''}
                className={selectFieldClass}
                style={selectFieldStyle}
              >
                <option value="">Choisir…</option>
                {(current.options ?? []).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : (
              <input
                name="value"
                type={current.type === 'nombre' ? 'number' : 'text'}
                required={current.required}
                defaultValue={existingStr}
                className="rounded-lg border border-black/15 px-3 py-3 text-base"
                step={current.type === 'nombre' ? 'any' : undefined}
              />
            )}
          </label>

          <div className="mt-auto pt-10">
            <button
              type="submit"
              className="w-full rounded-xl px-4 py-3 text-sm font-bold text-white"
              style={{ background: brand }}
            >
              {step + 1 >= questions.length ? 'Terminer' : 'Continuer'}
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}
