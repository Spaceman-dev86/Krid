'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { modulesFromForm } from '../../lib/prestations/modules'
import { deliverPrestationContentOnPaid } from '../../lib/prestations/deliverContent'
import { createClient } from '../../lib/supabase/server'

function clean(value: FormDataEntryValue | null) {
  const s = String(value ?? '').trim()
  return s.length ? s : null
}

export async function createPrestationAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const returnTo = clean(formData.get('return_to')) ?? '/profile/prestations'

  const name = clean(formData.get('name'))
  if (!name) redirect(`${returnTo}?error=name`)

  const priceRaw = clean(formData.get('price_euros'))
  const priceEuros = priceRaw ? Number(priceRaw.replace(',', '.')) : 0
  if (!Number.isFinite(priceEuros) || priceEuros < 0) {
    redirect(`${returnTo}?error=price`)
  }

  const pricing_type = clean(formData.get('pricing_type')) ?? 'unique'
  if (!['unique', 'renewable'].includes(pricing_type)) {
    redirect(`${returnTo}?error=pricing`)
  }

  const status = clean(formData.get('status')) ?? 'draft'
  if (!['draft', 'active', 'archived'].includes(status)) {
    redirect(`${returnTo}?error=status`)
  }

  const { data, error } = await supabase
    .from('prestations')
    .insert({
      coach_id: user.id,
      name,
      description: clean(formData.get('description')),
      pricing_type,
      price_cents: Math.round(priceEuros * 100),
      modules: modulesFromForm(formData),
      showroom_visible: formData.get('showroom_visible') === 'on',
      status,
    })
    .select('id')
    .maybeSingle()

  if (error) redirect(`${returnTo}?error=${encodeURIComponent(error.message)}`)

  revalidatePath('/payments')
  revalidatePath('/payments/prestations')
  revalidatePath('/profile/prestations')
  redirect(`/payments/${data!.id}?created=1`)
}

export async function updatePrestationAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const id = clean(formData.get('id'))
  if (!id) redirect('/payments')

  const name = clean(formData.get('name'))
  if (!name) redirect(`/payments/${id}?error=name`)

  const priceRaw = clean(formData.get('price_euros'))
  const priceEuros = priceRaw ? Number(priceRaw.replace(',', '.')) : 0
  if (!Number.isFinite(priceEuros) || priceEuros < 0) {
    redirect(`/payments/${id}?error=price`)
  }

  const pricing_type = clean(formData.get('pricing_type')) ?? 'unique'
  const status = clean(formData.get('status')) ?? 'draft'
  const programTemplateId = clean(formData.get('program_template_id'))
  const nutritionTemplateId = clean(formData.get('nutrition_template_id'))
  const driveFolderId = clean(formData.get('drive_folder_id'))

  const { error } = await supabase
    .from('prestations')
    .update({
      name,
      description: clean(formData.get('description')),
      pricing_type,
      price_cents: Math.round(priceEuros * 100),
      modules: modulesFromForm(formData),
      showroom_visible: formData.get('showroom_visible') === 'on',
      status,
      program_template_id: programTemplateId,
      nutrition_template_id: nutritionTemplateId,
      drive_folder_id: driveFolderId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('coach_id', user.id)

  if (error) redirect(`/payments/${id}?error=${encodeURIComponent(error.message)}`)

  revalidatePath('/payments')
  revalidatePath(`/payments/${id}`)
  redirect(`/payments/${id}?saved=1`)
}

export async function archivePrestationAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const id = clean(formData.get('id'))
  if (!id) redirect('/payments/prestations')

  const { error } = await supabase
    .from('prestations')
    .update({
      status: 'archived',
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('coach_id', user.id)

  if (error) redirect(`/payments/${id}?error=${encodeURIComponent(error.message)}`)

  revalidatePath('/payments')
  revalidatePath('/payments/prestations')
  redirect('/payments/prestations?archived=1')
}

/** Grant manuel : ledger Payé + grant actif (achat ≠ démarrage plan). */
export async function grantPrestationToClientAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const clientId = clean(formData.get('client_id'))
  const prestationId = clean(formData.get('prestation_id'))
  const returnTo = clean(formData.get('return_to')) ?? `/clients/${clientId}`
  const confirmPaid = clean(formData.get('confirm_paid'))
  const periodYm = clean(formData.get('period_ym'))
  const amountRaw = clean(formData.get('amount_cents'))

  if (!clientId || !prestationId) redirect(returnTo)
  if (confirmPaid !== '1') {
    redirect(`${returnTo}?error=` + encodeURIComponent('Confirmation de paiement requise'))
  }

  const amountCents =
    amountRaw != null && amountRaw !== '' && Number.isFinite(Number(amountRaw))
      ? Math.round(Number(amountRaw))
      : null
  if (amountCents == null || amountCents < 0) {
    redirect(`${returnTo}?error=` + encodeURIComponent('Montant invalide'))
  }

  const { data: prestation } = await supabase
    .from('prestations')
    .select('id, price_cents, modules, status, pricing_type')
    .eq('id', prestationId)
    .eq('coach_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!prestation || prestation.status === 'archived') {
    redirect(`${returnTo}?error=prestation`)
  }

  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .eq('coach_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!client) redirect(`${returnTo}?error=client`)

  const pricingType = prestation.pricing_type === 'renewable' ? 'renewable' : 'unique'
  let period: string | null = null

  if (pricingType === 'renewable') {
    if (!periodYm || !/^\d{4}-\d{2}$/.test(periodYm)) {
      redirect(`${returnTo}?error=` + encodeURIComponent('Indique le mois couvert (YYYY-MM)'))
    }
    period = periodYm
  }

  // Anti double paiement
  let dupQuery = supabase
    .from('payment_ledger')
    .select('id')
    .eq('coach_id', user.id)
    .eq('client_id', clientId)
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
            ? 'Cette prestation unique a déjà été payée pour ce client.'
            : `Ce mois (${period}) est déjà payé pour cette prestation.`
        )
    )
  }

  const now = new Date().toISOString()
  const { data: ledger, error: ledgerError } = await supabase
    .from('payment_ledger')
    .insert({
      coach_id: user.id,
      client_id: clientId,
      prestation_id: prestationId,
      amount_cents: amountCents,
      status: 'paid',
      source: 'manual',
      paid_at: now,
      period_ym: period,
    })
    .select('id')
    .maybeSingle()

  if (ledgerError) {
    const msg = /duplicate|unique/i.test(ledgerError.message)
      ? pricingType === 'unique'
        ? 'Cette prestation unique a déjà été payée pour ce client.'
        : `Ce mois (${period}) est déjà payé pour cette prestation.`
      : ledgerError.message
    redirect(`${returnTo}?error=` + encodeURIComponent(msg))
  }

  const { error: grantError } = await supabase.from('client_grants').insert({
    coach_id: user.id,
    client_id: clientId,
    prestation_id: prestationId,
    modules: prestation.modules,
    status: 'active',
    starts_at: now,
    payment_ledger_id: ledger!.id,
  })

  if (grantError) {
    redirect(`${returnTo}?error=${encodeURIComponent(grantError.message)}`)
  }

  await deliverPrestationContentOnPaid(supabase, {
    coachId: user.id,
    clientId,
    prestationId,
  })

  revalidatePath('/clients')
  revalidatePath(`/clients/${clientId}`)
  revalidatePath('/payments')
  revalidatePath('/payments/suivi-clients')
  revalidatePath('/programs')
  revalidatePath('/nutrition')
  revalidatePath('/drive')
  redirect(`${returnTo}?granted=1`)
}

export async function endClientGrantAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const grantId = clean(formData.get('grant_id'))
  const clientId = clean(formData.get('client_id'))
  if (!grantId || !clientId) redirect('/clients')

  const { error } = await supabase
    .from('client_grants')
    .update({
      status: 'ended',
      ends_at: new Date().toISOString(),
    })
    .eq('id', grantId)
    .eq('coach_id', user.id)

  if (error) redirect(`/clients/${clientId}?error=${encodeURIComponent(error.message)}`)

  revalidatePath(`/clients/${clientId}`)
  redirect(`/clients/${clientId}?ended=1`)
}

export async function createManualPaymentAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const clientId = clean(formData.get('client_id'))
  const prestationId = clean(formData.get('prestation_id'))
  const status = clean(formData.get('status')) ?? 'paid'
  const amountRaw = clean(formData.get('amount_euros'))
  const amountEuros = amountRaw ? Number(amountRaw.replace(',', '.')) : NaN
  const periodYm = clean(formData.get('period_ym'))

  if (!clientId || !prestationId) {
    redirect('/payments?error=' + encodeURIComponent('Client et prestation requis'))
  }
  if (!Number.isFinite(amountEuros) || amountEuros < 0) {
    redirect('/payments?error=' + encodeURIComponent('Montant invalide'))
  }
  if (!['pending', 'paid'].includes(status)) {
    redirect('/payments?error=' + encodeURIComponent('Statut invalide'))
  }

  const { data: prestation } = await supabase
    .from('prestations')
    .select('id, modules, status, pricing_type')
    .eq('id', prestationId)
    .eq('coach_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()
  if (!prestation) redirect('/payments?error=' + encodeURIComponent('Prestation introuvable'))

  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .eq('coach_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()
  if (!client) redirect('/payments?error=' + encodeURIComponent('Client introuvable'))

  const pricingType = prestation.pricing_type === 'renewable' ? 'renewable' : 'unique'
  let period: string | null = null
  if (pricingType === 'renewable') {
    if (!periodYm || !/^\d{4}-\d{2}$/.test(periodYm)) {
      redirect('/payments?error=' + encodeURIComponent('Indique le mois couvert pour une presta mensuelle'))
    }
    period = periodYm
  }

  if (status === 'paid') {
    let dupQuery = supabase
      .from('payment_ledger')
      .select('id')
      .eq('coach_id', user.id)
      .eq('client_id', clientId)
      .eq('prestation_id', prestationId)
      .eq('status', 'paid')
      .limit(1)
    if (period) dupQuery = dupQuery.eq('period_ym', period)
    else dupQuery = dupQuery.is('period_ym', null)
    const { data: existingPaid } = await dupQuery.maybeSingle()
    if (existingPaid) {
      redirect(
        '/payments?error=' +
          encodeURIComponent(
            pricingType === 'unique'
              ? 'Cette prestation unique a déjà été payée pour ce client.'
              : `Ce mois (${period}) est déjà payé pour cette prestation.`
          )
      )
    }
  }

  const now = new Date().toISOString()
  const amount_cents = Math.round(amountEuros * 100)
  const { data: ledger, error } = await supabase
    .from('payment_ledger')
    .insert({
      coach_id: user.id,
      client_id: clientId,
      prestation_id: prestationId,
      amount_cents,
      status,
      source: 'manual',
      paid_at: status === 'paid' ? now : null,
      period_ym: period,
    })
    .select('id')
    .maybeSingle()

  if (error || !ledger?.id) {
    const msg = error && /duplicate|unique/i.test(error.message)
      ? 'Paiement déjà enregistré pour cette période.'
      : error?.message || 'Création impossible'
    redirect('/payments?error=' + encodeURIComponent(msg))
  }

  if (status === 'paid') {
    await supabase.from('client_grants').insert({
      coach_id: user.id,
      client_id: clientId,
      prestation_id: prestationId,
      modules: prestation.modules,
      status: 'active',
      starts_at: now,
      payment_ledger_id: ledger.id,
    })
    await deliverPrestationContentOnPaid(supabase, {
      coachId: user.id,
      clientId,
      prestationId,
    })
  }

  revalidatePath('/payments')
  revalidatePath('/payments/suivi-clients')
  revalidatePath(`/clients/${clientId}`)
  revalidatePath('/programs')
  revalidatePath('/nutrition')
  revalidatePath('/drive')
  redirect('/payments?created=1')
}

export async function markPaymentPaidAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const id = clean(formData.get('ledger_id'))
  if (!id) redirect('/payments')

  const { data: row } = await supabase
    .from('payment_ledger')
    .select('id, client_id, prestation_id, status, period_ym')
    .eq('id', id)
    .eq('coach_id', user.id)
    .maybeSingle()

  if (!row || row.status !== 'pending') {
    redirect('/payments?error=' + encodeURIComponent('Paiement non éligible'))
  }

  let dupQuery = supabase
    .from('payment_ledger')
    .select('id')
    .eq('coach_id', user.id)
    .eq('client_id', row.client_id)
    .eq('prestation_id', row.prestation_id)
    .eq('status', 'paid')
    .neq('id', id)
    .limit(1)
  if (row.period_ym) dupQuery = dupQuery.eq('period_ym', row.period_ym)
  else dupQuery = dupQuery.is('period_ym', null)
  const { data: existingPaid } = await dupQuery.maybeSingle()
  if (existingPaid) {
    redirect(
      '/payments?error=' +
        encodeURIComponent(
          row.period_ym
            ? `Ce mois (${row.period_ym}) est déjà payé pour cette prestation.`
            : 'Cette prestation unique a déjà été payée pour ce client.'
        )
    )
  }

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('payment_ledger')
    .update({ status: 'paid', paid_at: now })
    .eq('id', id)
    .eq('coach_id', user.id)

  if (error) {
    const msg = /duplicate|unique/i.test(error.message)
      ? 'Paiement déjà enregistré pour cette période.'
      : error.message
    redirect('/payments?error=' + encodeURIComponent(msg))
  }

  const { data: prestation } = await supabase
    .from('prestations')
    .select('modules')
    .eq('id', row.prestation_id)
    .eq('coach_id', user.id)
    .maybeSingle()

  await supabase.from('client_grants').insert({
    coach_id: user.id,
    client_id: row.client_id,
    prestation_id: row.prestation_id,
    modules: prestation?.modules ?? [],
    status: 'active',
    starts_at: now,
    payment_ledger_id: id,
  })

  await deliverPrestationContentOnPaid(supabase, {
    coachId: user.id,
    clientId: row.client_id,
    prestationId: row.prestation_id,
  })

  revalidatePath('/payments')
  revalidatePath('/payments/suivi-clients')
  revalidatePath(`/clients/${row.client_id}`)
  revalidatePath('/programs')
  revalidatePath('/nutrition')
  revalidatePath('/drive')
  redirect('/payments?paid=1')
}

export async function refundPaymentAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const id = clean(formData.get('ledger_id'))
  if (!id) redirect('/payments')

  const { data: row } = await supabase
    .from('payment_ledger')
    .select('id, client_id, status')
    .eq('id', id)
    .eq('coach_id', user.id)
    .maybeSingle()

  if (!row || row.status !== 'paid') {
    redirect('/payments?error=' + encodeURIComponent('Seul un paiement Payé peut être remboursé'))
  }

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('payment_ledger')
    .update({ status: 'refunded' })
    .eq('id', id)
    .eq('coach_id', user.id)

  if (error) redirect('/payments?error=' + encodeURIComponent(error.message))

  await supabase
    .from('client_grants')
    .update({ status: 'ended', ends_at: now })
    .eq('payment_ledger_id', id)
    .eq('coach_id', user.id)
    .eq('status', 'active')

  revalidatePath('/payments')
  revalidatePath('/payments/suivi-clients')
  revalidatePath(`/clients/${row.client_id}`)
  redirect('/payments?refunded=1')
}

export async function generateInvoiceAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const ledgerId = clean(formData.get('ledger_id'))
  const requestId = clean(formData.get('request_id'))
  if (!ledgerId) redirect('/payments/factures?error=' + encodeURIComponent('Paiement requis'))

  const { data: row } = await supabase
    .from('payment_ledger')
    .select('id, client_id, amount_cents, status')
    .eq('id', ledgerId)
    .eq('coach_id', user.id)
    .maybeSingle()

  if (!row || row.status !== 'paid') {
    redirect('/payments/factures?error=' + encodeURIComponent('Facture = paiement Payé uniquement'))
  }

  const { count } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('coach_id', user.id)

  const year = new Date().getFullYear()
  const seq = String((count ?? 0) + 1).padStart(4, '0')
  const number = `${year}-${seq}`

  const { error } = await supabase.from('invoices').insert({
    coach_id: user.id,
    client_id: row.client_id,
    payment_ledger_id: ledgerId,
    invoice_request_id: requestId,
    number,
    amount_cents: row.amount_cents,
  })

  if (error) {
    redirect('/payments/factures?error=' + encodeURIComponent(error.message))
  }

  if (requestId) {
    await supabase
      .from('invoice_requests')
      .update({ status: 'done', resolved_at: new Date().toISOString() })
      .eq('id', requestId)
      .eq('coach_id', user.id)
  }

  revalidatePath('/payments/factures')
  revalidatePath('/payments/suivi-clients')
  redirect('/payments/factures?created=1')
}
