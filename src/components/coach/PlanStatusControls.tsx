import { PendingFormButton } from '@/src/components/ui/PendingFormButton'

type Props = {
  action: (formData: FormData) => void | Promise<void>
  planId: string
  status: string
  clientId: string
  returnTo: string
}

/** Pause · Reprendre · Terminer — plan fitness ou nutrition (fiche client). */
export function PlanStatusControls({ action, planId, status, clientId, returnTo }: Props) {
  if (status === 'done') return null
  const intents: { intent: string; label: string }[] = []
  if (status === 'paused') intents.push({ intent: 'resume', label: 'Reprendre' })
  else intents.push({ intent: 'pause', label: 'Pause' })
  intents.push({ intent: 'done', label: 'Terminer' })

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {intents.map((it) => (
        <form key={it.intent} action={action}>
          <input type="hidden" name="plan_id" value={planId} />
          <input type="hidden" name="client_id" value={clientId} />
          <input type="hidden" name="intent" value={it.intent} />
          <input type="hidden" name="return_to" value={returnTo} />
          <PendingFormButton size="sm" variant="secondary" pendingLabel="…">
            {it.label}
          </PendingFormButton>
        </form>
      ))}
    </div>
  )
}
