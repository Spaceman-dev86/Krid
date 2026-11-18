'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  contentIdsFromForm,
  singularFromIds,
} from '../../lib/prestations/contentLinks'
import {
  modulesFromContentLinks,
  showroomTagsFromForm,
} from '../../lib/prestations/modules'
import {
  hiddenProgramTagsFromForm,
  programShowroomTags,
} from '../../lib/prestations/showroomPresentation'
import { applyAlumniOnGrantEnd } from '../../lib/coach/linkedGroups'
import { removeClientFromAutoGroupIfIdle } from '../../lib/coach/syncAutoGroups'
import { deliverPrestationContentOnPaid } from '../../lib/prestations/deliverContent'
import { mediaLibraryPublicUrl } from '../../lib/mediaLibrary'
import { safeInternalPath } from '../../lib/navigation/safeReturnTo'
import { createClient } from '../../lib/supabase/server'
import { removePrestationPhoto, uploadPrestationPhoto } from '../../lib/uploadPrestationPhoto'

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

  const returnTo = safeInternalPath(formData.get('return_to'), '/profile/prestations')

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

  // Modules + contenu livré = réglés sur la fiche après création.
  const { data, error } = await supabase
    .from('prestations')
    .insert({
      coach_id: user.id,
      name,
      description: clean(formData.get('description')),
      pricing_type,
      price_cents: Math.round(priceEuros * 100),
      modules: [],
      showroom_visible: formData.get('showroom_visible') === 'on',
      status,
    })
    .select('id')
    .maybeSingle()

  if (error) redirect(`${returnTo}?error=${encodeURIComponent(error.message)}`)

  revalidatePath('/payments')
  revalidatePath('/payments/prestations')
  revalidatePath('/profile/prestations')
  redirect(`/profile/prestations/${data!.id}?created=1`)
}

export type PrestationSaveResult =
  | { ok: true; id: string; photoUploaded: boolean }
  | {
      ok: false
      error: string
      code?: 'auth' | 'missing' | 'name' | 'price' | 'cover_conflict' | 'upload'
      id?: string
    }

async function persistPrestationUpdate(formData: FormData): Promise<PrestationSaveResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non connecté', code: 'auth' }

  const id = clean(formData.get('id'))
  if (!id) return { ok: false, error: 'Prestation introuvable', code: 'missing' }

  const name = clean(formData.get('name'))
  if (!name) return { ok: false, error: 'Nom requis', code: 'name', id }

  const priceRaw = clean(formData.get('price_euros'))
  const priceEuros = priceRaw ? Number(priceRaw.replace(',', '.')) : 0
  if (!Number.isFinite(priceEuros) || priceEuros < 0) {
    return { ok: false, error: 'Prix invalide', code: 'price', id }
  }

  const pricing_type = clean(formData.get('pricing_type')) ?? 'unique'
  const status = clean(formData.get('status')) ?? 'draft'
  const programTemplateIds = contentIdsFromForm(formData, 'program_template_ids')
  const nutritionTemplateIds = contentIdsFromForm(formData, 'nutrition_template_ids')
  const driveFolderIds = contentIdsFromForm(formData, 'drive_folder_ids')
  const programTemplateId = singularFromIds(programTemplateIds)
  const nutritionTemplateId = singularFromIds(nutritionTemplateIds)
  const driveFolderId = singularFromIds(driveFolderIds)
  const showroomTags = showroomTagsFromForm(formData, 'showroom_tags')
  const showroomPopupTags = showroomTagsFromForm(formData, 'showroom_popup_tags')
  const videoUrlRaw = clean(formData.get('video_url'))
  const videoUrl =
    videoUrlRaw && /^https?:\/\//i.test(videoUrlRaw) ? videoUrlRaw.slice(0, 500) : null
  const videoRoleRaw = clean(formData.get('showroom_video_role'))
  let videoRole: 'cover' | 'inline' | null = null
  if (videoUrl) {
    videoRole = videoRoleRaw === 'cover' ? 'cover' : 'inline'
  }
  let photoIsCover = formData.get('showroom_photo_is_cover') === 'on'
  if (videoRole === 'cover' && photoIsCover) {
    return {
      ok: false,
      error: 'Une seule couverture popup : photo ou vidéo',
      code: 'cover_conflict',
      id,
    }
  }
  if (videoRole === 'cover') photoIsCover = false
  const showroomDescriptionRaw = clean(formData.get('showroom_description'))
  const showroomDescription = showroomDescriptionRaw
    ? showroomDescriptionRaw.slice(0, 1200)
    : null
  let showroomWeekId = clean(formData.get('showroom_week_id'))
  const showroomCtaLabelRaw = clean(formData.get('showroom_cta_label'))
  const showroomCtaLabel = showroomCtaLabelRaw ? showroomCtaLabelRaw.slice(0, 40) : null
  const showroomEyebrowRaw = clean(formData.get('showroom_eyebrow'))
  const showroomEyebrow = showroomEyebrowRaw ? showroomEyebrowRaw.slice(0, 40) : null
  if (showroomWeekId) {
    if (!programTemplateIds.length) {
      showroomWeekId = null
    } else {
      const { data: weekRow } = await supabase
        .from('program_weeks')
        .select('id, program_id')
        .eq('id', showroomWeekId)
        .maybeSingle()
      if (!weekRow || !programTemplateIds.includes(weekRow.program_id)) {
        showroomWeekId = null
      }
    }
  }

  const { data: existing } = await supabase
    .from('prestations')
    .select('photo_url')
    .eq('id', id)
    .eq('coach_id', user.id)
    .maybeSingle()

  let photoUrl: string | null = (existing as { photo_url?: string | null } | null)?.photo_url ?? null
  let photoUploaded = false
  const removePhoto = formData.get('remove_photo') === 'on'
  const photoFile = formData.get('photo')
  const photoLibraryId = clean(formData.get('photo_library_id'))
  if (removePhoto) {
    try {
      await removePrestationPhoto(user.id, id)
    } catch {
      /* non-bloquant */
    }
    photoUrl = null
  } else if (photoFile instanceof File && photoFile.size > 0) {
    const uploaded = await uploadPrestationPhoto(user.id, id, photoFile)
    if (!uploaded.ok) {
      return { ok: false, error: uploaded.error, code: 'upload', id }
    }
    photoUrl = uploaded.imageUrl
    photoUploaded = true
  } else if (photoLibraryId) {
    const { data: libRow, error: libError } = await supabase
      .from('media_library')
      .select('storage_path, active, kind')
      .eq('id', photoLibraryId)
      .maybeSingle()
    if (libError && !/media_library|schema cache/i.test(libError.message)) {
      return { ok: false, error: libError.message, code: 'upload', id }
    }
    const path = (libRow as { storage_path?: string; active?: boolean; kind?: string } | null)
      ?.storage_path
    const active = (libRow as { active?: boolean } | null)?.active
    const kind = (libRow as { kind?: string } | null)?.kind
    const libraryUrl = path && active && kind === 'cover' ? mediaLibraryPublicUrl(path) : ''
    if (!libraryUrl) {
      return { ok: false, error: 'Image catalogue introuvable.', code: 'upload', id }
    }
    try {
      await removePrestationPhoto(user.id, id)
    } catch {
      /* non-bloquant */
    }
    photoUrl = libraryUrl
    photoUploaded = true
  }

  const modules = modulesFromContentLinks({
    programTemplateIds,
    nutritionTemplateIds,
    driveFolderIds,
  })

  let programTagLabels: string[] = []
  if (programTemplateIds.length) {
    const { data: progs } = await supabase
      .from('programs')
      .select('id, title, level, goal, duration')
      .in('id', programTemplateIds)
      .eq('coach_id', user.id)
      .is('deleted_at', null)
    for (const prog of progs ?? []) {
      const { data: weeksRaw } = await supabase
        .from('program_weeks')
        .select('id')
        .eq('program_id', prog.id)
      const weeks = (weeksRaw ?? []) as { id: string }[]
      let sessionsCount = 0
      if (weeks.length) {
        const { count } = await supabase
          .from('sessions')
          .select('id', { count: 'exact', head: true })
          .in(
            'week_id',
            weeks.map((w) => w.id),
          )
        sessionsCount = count ?? 0
      }
      for (const tag of programShowroomTags({
        id: prog.id,
        title: prog.title,
        level: prog.level,
        goal: prog.goal,
        duration: prog.duration,
        weeksCount: weeks.length,
        sessionsCount,
      })) {
        if (!programTagLabels.some((t) => t.toLowerCase() === tag.toLowerCase())) {
          programTagLabels.push(tag)
        }
      }
    }
  }
  const hiddenProgramTags = hiddenProgramTagsFromForm(formData, programTagLabels)

  const { error } = await supabase
    .from('prestations')
    .update({
      name,
      description: clean(formData.get('description')),
      pricing_type,
      price_cents: Math.round(priceEuros * 100),
      modules,
      showroom_visible: formData.get('showroom_visible') === 'on',
      status,
      program_template_id: programTemplateId,
      nutrition_template_id: nutritionTemplateId,
      drive_folder_id: driveFolderId,
      program_template_ids: programTemplateIds,
      nutrition_template_ids: nutritionTemplateIds,
      drive_folder_ids: driveFolderIds,
      photo_url: photoUrl,
      showroom_tags: showroomTags,
      showroom_popup_tags: showroomPopupTags,
      video_url: videoUrl,
      highlight_tag: null,
      showroom_description: showroomDescription,
      showroom_week_id: showroomWeekId,
      showroom_cta_label: showroomCtaLabel,
      showroom_eyebrow: showroomEyebrow,
      show_program_tags: hiddenProgramTags.length < programTagLabels.length || !programTagLabels.length,
      showroom_hidden_program_tags: hiddenProgramTags,
      showroom_photo_is_cover: photoIsCover,
      showroom_video_role: videoRole,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', id)
    .eq('coach_id', user.id)

  if (error) return { ok: false, error: error.message, id }

  revalidatePath('/payments')
  revalidatePath('/profile/prestations')
  revalidatePath(`/profile/prestations/${id}`)
  revalidatePath('/c', 'layout')
  return { ok: true, id, photoUploaded }
}

export async function updatePrestationAction(formData: FormData) {
  const result = await persistPrestationUpdate(formData)
  if (!result.ok) {
    if (result.code === 'auth') redirect('/login')
    if (result.code === 'missing') redirect('/profile/prestations')
    const id = result.id ?? clean(formData.get('id'))
    if (!id) redirect('/profile/prestations')
    if (result.code === 'cover_conflict') {
      redirect(`/profile/prestations/${id}?cover_conflict=1`)
    }
    if (result.code === 'name') redirect(`/profile/prestations/${id}?error=name`)
    if (result.code === 'price') redirect(`/profile/prestations/${id}?error=price`)
    redirect(`/profile/prestations/${id}?error=${encodeURIComponent(result.error)}`)
  }
  redirect(`/profile/prestations/${result.id}?saved=1`)
}

/** Autosave silencieux (pas de redirect) — debounce côté client. */
export async function autosavePrestationAction(formData: FormData): Promise<PrestationSaveResult> {
  return persistPrestationUpdate(formData)
}

export async function archivePrestationAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const id = clean(formData.get('id'))
  if (!id) redirect('/profile/prestations')

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('prestations')
    .update({
      status: 'archived',
      deleted_at: now,
      updated_at: now,
    })
    .eq('id', id)
    .eq('coach_id', user.id)

  if (error) redirect(`/profile/prestations/${id}?error=${encodeURIComponent(error.message)}`)

  // Archive → alumni : termine grants actifs + coupe Drive/program
  const { data: activeGrants } = await supabase
    .from('client_grants')
    .update({ status: 'ended', ends_at: now })
    .eq('prestation_id', id)
    .eq('coach_id', user.id)
    .eq('status', 'active')
    .select('client_id, prestation_id')

  for (const g of activeGrants ?? []) {
    if (!g.client_id || !g.prestation_id) continue
    try {
      await applyAlumniOnGrantEnd(supabase, {
        coachId: user.id,
        clientId: g.client_id,
        prestationId: g.prestation_id,
      })
    } catch {
      /* non-bloquant */
    }
  }

  revalidatePath('/payments')
  revalidatePath('/payments/prestations')
  revalidatePath('/profile/prestations')
  revalidatePath('/clients/groupes')
  redirect('/profile/prestations?archived=1')
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
  const returnTo = safeInternalPath(formData.get('return_to'), `/clients/${clientId}`)
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
  revalidatePath('/clients/groupes')
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
  const returnTo = safeInternalPath(formData.get('return_to'), `/clients/${clientId}`)
  if (!grantId || !clientId) redirect('/clients')

  const { data: grantRow } = await supabase
    .from('client_grants')
    .select('prestation_id')
    .eq('id', grantId)
    .eq('coach_id', user.id)
    .maybeSingle()

  const { error } = await supabase
    .from('client_grants')
    .update({
      status: 'ended',
      ends_at: new Date().toISOString(),
    })
    .eq('id', grantId)
    .eq('coach_id', user.id)

  if (error) redirect(`${returnTo}?error=${encodeURIComponent(error.message)}`)

  if (grantRow?.prestation_id) {
    try {
      await applyAlumniOnGrantEnd(supabase, {
        coachId: user.id,
        clientId,
        prestationId: grantRow.prestation_id,
      })
    } catch {
      /* non-bloquant */
    }
    try {
      await removeClientFromAutoGroupIfIdle(supabase, {
        coachId: user.id,
        clientId,
        prestationId: grantRow.prestation_id,
      })
    } catch {
      /* non-bloquant */
    }
  }

  revalidatePath(`/clients/${clientId}`)
  revalidatePath('/clients/groupes')
  revalidatePath(returnTo)
  redirect(`${returnTo}?ended=1`)
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
    const { error: grantError } = await supabase.from('client_grants').insert({
      coach_id: user.id,
      client_id: clientId,
      prestation_id: prestationId,
      modules: prestation.modules,
      status: 'active',
      starts_at: now,
      payment_ledger_id: ledger.id,
    })
    if (grantError) {
      redirect(
        '/payments?error=' +
          encodeURIComponent(
            `Paiement enregistré mais accès non créé : ${grantError.message}`,
          ),
      )
    }
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

  const { error: grantError } = await supabase.from('client_grants').insert({
    coach_id: user.id,
    client_id: row.client_id,
    prestation_id: row.prestation_id,
    modules: prestation?.modules ?? [],
    status: 'active',
    starts_at: now,
    payment_ledger_id: id,
  })
  if (grantError) {
    redirect(
      '/payments?error=' +
        encodeURIComponent(
          `Paiement marqué Payé mais accès non créé : ${grantError.message}`,
        ),
    )
  }

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

  const { data: endedGrants } = await supabase
    .from('client_grants')
    .update({ status: 'ended', ends_at: now })
    .eq('payment_ledger_id', id)
    .eq('coach_id', user.id)
    .eq('status', 'active')
    .select('client_id, prestation_id')

  for (const g of endedGrants ?? []) {
    if (!g.prestation_id || !g.client_id) continue
    try {
      await applyAlumniOnGrantEnd(supabase, {
        coachId: user.id,
        clientId: g.client_id,
        prestationId: g.prestation_id,
      })
      await removeClientFromAutoGroupIfIdle(supabase, {
        coachId: user.id,
        clientId: g.client_id,
        prestationId: g.prestation_id,
      })
    } catch {
      /* non-bloquant */
    }
  }

  revalidatePath('/payments')
  revalidatePath('/payments/suivi-clients')
  revalidatePath('/clients/groupes')
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

  const { data: existingInvoice } = await supabase
    .from('invoices')
    .select('id')
    .eq('coach_id', user.id)
    .eq('payment_ledger_id', ledgerId)
    .maybeSingle()
  if (existingInvoice) {
    redirect('/payments/factures?error=' + encodeURIComponent('Facture déjà générée pour ce paiement'))
  }

  const year = new Date().getFullYear()
  const yearStart = `${year}-01-01T00:00:00.000Z`
  const { count } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('coach_id', user.id)
    .gte('created_at', yearStart)

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
    const msg = /duplicate|unique/i.test(error.message)
      ? 'Facture déjà générée pour ce paiement'
      : error.message
    redirect('/payments/factures?error=' + encodeURIComponent(msg))
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
