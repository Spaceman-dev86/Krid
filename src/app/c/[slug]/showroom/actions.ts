'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { deliverPrestationContentOnPaid } from '../../../../lib/prestations/deliverContent'
import { createClient } from '../../../../lib/supabase/server'
import { createServiceRoleClient } from '../../../../lib/supabase/serviceRole'
import { getTrackedLinkIdFromCookie } from '../../../../lib/tracking/recordShowroomRef'

function clean(v: FormDataEntryValue | null) {
  const s = typeof v === 'string' ? v.trim() : ''
  return s || null
}

function currentPeriodYm() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

type CoachCodeRow = {
  id: string
  type: string
  code: string
  prestation_id: string | null
  amount_cents: number | null
  percent_off: number | null
  prestation_ids: string[] | null
  audience: string
  audience_client_id: string | null
  audience_group_id: string | null
  audience_prestation_id: string | null
  expires_at: string | null
  max_uses: number | null
  used_count: number
  status: string
}

function isCodeStillValid(row: CoachCodeRow, nowMs: number) {
  if (row.status !== 'active') return false
  if (row.expires_at && new Date(row.expires_at).getTime() < nowMs) return false
  if (row.max_uses != null && row.used_count >= row.max_uses) return false
  return true
}

async function audienceAllows(
  admin: NonNullable<ReturnType<typeof createServiceRoleClient>>,
  row: CoachCodeRow,
  clientId: string
) {
  if (row.audience === 'public') return true
  if (row.audience === 'client') return row.audience_client_id === clientId
  if (row.audience === 'group' && row.audience_group_id) {
    const { data } = await admin
      .from('client_group_members')
      .select('client_id')
      .eq('group_id', row.audience_group_id)
      .eq('client_id', clientId)
      .maybeSingle()
    return Boolean(data)
  }
  if (row.audience === 'presta_clients' && row.audience_prestation_id) {
    const { data } = await admin
      .from('client_grants')
      .select('id')
      .eq('client_id', clientId)
      .eq('prestation_id', row.audience_prestation_id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()
    return Boolean(data)
  }
  return false
}

async function markCodeUsed(
  admin: NonNullable<ReturnType<typeof createServiceRoleClient>>,
  row: CoachCodeRow,
  clientId: string,
  now: string
) {
  const nextUsed = row.used_count + 1
  const exhausted = row.max_uses != null && nextUsed >= row.max_uses
  await admin
    .from('coach_codes')
    .update({
      used_count: nextUsed,
      last_redeemed_at: now,
      last_redeemed_client_id: clientId,
      status: exhausted ? 'exhausted' : row.status,
    } as never)
    .eq('id', row.id)
    .eq('status', 'active')
}

function revalidateAfterPay(slug: string, clientId: string) {
  revalidatePath(`/c/${slug}/home`)
  revalidatePath(`/c/${slug}/profil/prestations`)
  revalidatePath('/payments')
  revalidatePath('/payments/suivi-clients')
  revalidatePath(`/clients/${clientId}`)
  revalidatePath('/clients/codes')
  revalidatePath('/programs')
  revalidatePath('/nutrition')
  revalidatePath('/drive')
}

/**
 * Simulation paiement showroom (avant Stripe) :
 * - code accès → ledger cash + grant
 * - code promo → remise sur montant showroom
 * - sinon prix catalogue
 */
export async function simulateShowroomPaymentAction(formData: FormData) {
  const slug = clean(formData.get('slug'))
  const prestationId = clean(formData.get('prestation_id'))
  const normalizeCode = (raw: string | null) =>
    raw ? raw.toUpperCase().replace(/\s+/g, '') : null
  const accessInput = normalizeCode(clean(formData.get('access_code')))
  const promoInput = normalizeCode(clean(formData.get('promo_code')))

  if (!slug || !prestationId) redirect('/login/client')

  const returnTo = `/c/${slug}/showroom/${prestationId}`
  const rejoindre = `/c/${slug}/rejoindre?presta=${encodeURIComponent(prestationId)}`

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(rejoindre)

  const { data: branding } = await supabase
    .from('coach_branding')
    .select('coach_id, slug')
    .eq('slug', slug)
    .maybeSingle()

  if (!branding) redirect(returnTo + '?error=' + encodeURIComponent('Showroom introuvable'))

  const { data: client } = await supabase
    .from('clients')
    .select('id, first_name, last_name, sex, birth_date')
    .eq('user_id', user.id)
    .eq('coach_id', branding.coach_id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!client) redirect(rejoindre)

  const profileOk = Boolean(
    client.first_name?.trim() &&
      client.last_name?.trim() &&
      client.sex?.trim() &&
      client.birth_date
  )
  if (!profileOk) redirect(rejoindre)

  const { data: prestation } = await supabase
    .from('prestations')
    .select('id, price_cents, modules, status, showroom_visible, pricing_type')
    .eq('id', prestationId)
    .eq('coach_id', branding.coach_id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!prestation || prestation.status !== 'active' || !prestation.showroom_visible) {
    redirect(returnTo + '?error=' + encodeURIComponent('Offre indisponible'))
  }

  const pricingType = prestation.pricing_type === 'renewable' ? 'renewable' : 'unique'
  const period = pricingType === 'renewable' ? currentPeriodYm() : null

  let dupQuery = supabase
    .from('payment_ledger')
    .select('id')
    .eq('coach_id', branding.coach_id)
    .eq('client_id', client.id)
    .eq('prestation_id', prestationId)
    .eq('status', 'paid')
    .limit(1)

  if (period) dupQuery = dupQuery.eq('period_ym', period)
  else dupQuery = dupQuery.is('period_ym', null)

  const { data: existingPaid } = await dupQuery.maybeSingle()
  if (existingPaid) {
    redirect(
      `${returnTo}?error=` +
        encodeURIComponent(
          pricingType === 'unique'
            ? 'Tu as déjà payé cette offre.'
            : `Ce mois (${period}) est déjà payé pour cette offre.`
        )
    )
  }

  const admin = createServiceRoleClient()
  if (!admin) {
    redirect(
      `${returnTo}?error=` +
        encodeURIComponent('Configuration serveur incomplète (SUPABASE_SERVICE_ROLE_KEY).')
    )
  }

  const nowMs = Date.now()
  const now = new Date(nowMs).toISOString()

  async function loadCode(codeInput: string) {
    const { data: found } = await admin
      .from('coach_codes')
      .select(
        'id, type, code, prestation_id, amount_cents, percent_off, prestation_ids, audience, audience_client_id, audience_group_id, audience_prestation_id, expires_at, max_uses, used_count, status'
      )
      .eq('coach_id', branding.coach_id)
      .ilike('code', codeInput)
      .maybeSingle()
    return found as CoachCodeRow | null
  }

  let accessCode: CoachCodeRow | null = null
  let promoCode: CoachCodeRow | null = null

  if (accessInput) {
    const row = await loadCode(accessInput)
    if (!row || row.type !== 'access' || !isCodeStillValid(row, nowMs)) {
      redirect(`${returnTo}?error=` + encodeURIComponent('Code d’accès invalide ou expiré.'))
    }
    if (row.prestation_id !== prestationId) {
      redirect(
        `${returnTo}?error=` + encodeURIComponent('Ce code d’accès n’est pas pour cette offre.')
      )
    }
    accessCode = row
  }

  if (promoInput) {
    const row = await loadCode(promoInput)
    if (!row || row.type !== 'promo' || !isCodeStillValid(row, nowMs)) {
      redirect(`${returnTo}?error=` + encodeURIComponent('Code promo invalide ou expiré.'))
    }
    const ids = row.prestation_ids ?? []
    if (!ids.includes(prestationId)) {
      redirect(
        `${returnTo}?error=` + encodeURIComponent('Ce code promo ne s’applique pas à cette offre.')
      )
    }
    if (!(await audienceAllows(admin, row, client.id))) {
      redirect(`${returnTo}?error=` + encodeURIComponent('Ce code promo ne t’est pas destiné.'))
    }
    promoCode = row
  }

  const catalogCents = Math.max(0, Number(prestation.price_cents) || 0)
  let amountCents = catalogCents
  let source: 'showroom' | 'cash' = 'showroom'

  if (accessCode) {
    amountCents = Math.max(0, Number(accessCode.amount_cents) || 0)
    source = 'cash'
  }
  if (promoCode?.percent_off) {
    const pct = Math.min(100, Math.max(0, promoCode.percent_off))
    amountCents = Math.round((amountCents * (100 - pct)) / 100)
  }

  const trackedLinkId = await getTrackedLinkIdFromCookie(branding.coach_id)

  const { data: ledger, error: ledgerError } = await admin
    .from('payment_ledger')
    .insert({
      coach_id: branding.coach_id,
      client_id: client.id,
      prestation_id: prestationId,
      amount_cents: amountCents,
      status: 'paid',
      source,
      paid_at: now,
      period_ym: period,
      tracked_link_id: trackedLinkId,
    } as never)
    .select('id')
    .maybeSingle()

  if (ledgerError || !ledger) {
    const msg = /duplicate|unique/i.test(ledgerError?.message ?? '')
      ? pricingType === 'unique'
        ? 'Tu as déjà payé cette offre.'
        : `Ce mois (${period}) est déjà payé pour cette offre.`
      : ledgerError?.message ?? 'Paiement impossible'
    redirect(`${returnTo}?error=${encodeURIComponent(msg)}`)
  }

  const { error: grantError } = await admin.from('client_grants').insert({
    coach_id: branding.coach_id,
    client_id: client.id,
    prestation_id: prestationId,
    modules: prestation.modules,
    status: 'active',
    starts_at: now,
    payment_ledger_id: ledger.id,
  })

  if (grantError) {
    redirect(`${returnTo}?error=${encodeURIComponent(grantError.message)}`)
  }

  if (accessCode) await markCodeUsed(admin, accessCode, client.id, now)
  if (promoCode) await markCodeUsed(admin, promoCode, client.id, now)

  await deliverPrestationContentOnPaid(admin, {
    coachId: branding.coach_id,
    clientId: client.id,
    prestationId,
  })

  revalidateAfterPay(slug, client.id)

  redirect(`${returnTo}?paid=1${accessCode ? '&via=code' : promoCode ? '&via=promo' : ''}`)
}
