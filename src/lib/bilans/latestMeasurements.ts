import { chatDb } from '../chat/chat'
import { parsePayload, parseSchema, type BilanPayload, type BilanSchema } from './bilans'

export type LatestBilanMeasurements = {
  instanceId: string
  title: string
  submittedAt: string
  schema: BilanSchema
  payload: BilanPayload
}

/** Dernier bilan soumis du client (pour Infos coach). */
export async function getLatestSubmittedBilanMeasurements(
  supabase: unknown,
  opts: { coachId: string; clientId: string }
): Promise<LatestBilanMeasurements | null> {
  const db = chatDb(supabase)
  const { data, error } = await db
    .from('bilan_instances')
    .select('id, title, submitted_at, schema_snapshot, payload, status')
    .eq('coach_id', opts.coachId)
    .eq('client_id', opts.clientId)
    .eq('status', 'submitted')
    .not('submitted_at', 'is', null)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data?.submitted_at) return null

  return {
    instanceId: data.id as string,
    title: (data.title as string) || 'Bilan',
    submittedAt: data.submitted_at as string,
    schema: parseSchema(data.schema_snapshot),
    payload: parsePayload(data.payload),
  }
}
