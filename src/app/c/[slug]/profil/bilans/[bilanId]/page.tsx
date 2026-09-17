import Link from 'next/link'
import { redirect } from 'next/navigation'

import { ClientPortalShell } from '../../../../../../components/client-portal/ClientPortalShell'
import { requireClientPortal } from '../../../../../../lib/client-portal/context'
import {
  getInstance,
  isClientEditable,
  statusLabel,
} from '../../../../../../lib/bilans/bilans'
import { chatDb } from '../../../../../../lib/chat/chat'
import { createClient } from '../../../../../../lib/supabase/server'
import { createServiceRoleClient } from '../../../../../../lib/supabase/serviceRole'
import { submitBilanAction } from '../actions'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ slug: string; bilanId: string }> | { slug: string; bilanId: string }
  searchParams?: Promise<{ error?: string; saved?: string }> | { error?: string; saved?: string }
}

export default async function ClientBilanDetailPage({ params, searchParams }: Props) {
  const { slug, bilanId } = await Promise.resolve(params)
  const q = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const ctx = await requireClientPortal(supabase, slug, user?.id)
  const instance = await getInstance(supabase, bilanId)

  if (!instance || instance.client_id !== ctx.client.id) {
    redirect(`/c/${slug}/profil/bilans?error=` + encodeURIComponent('Bilan introuvable'))
  }

  // Marque ouvert
  if (!instance.client_opened_at) {
    const db = chatDb(supabase)
    await db
      .from('bilan_instances')
      .update({ client_opened_at: new Date().toISOString() })
      .eq('id', bilanId)
      .is('client_opened_at', null)
  }

  // Lock lazy
  if (
    (instance.status === 'waiting' || instance.status === 'in_progress') &&
    new Date(instance.due_at).getTime() < Date.now()
  ) {
    const db = chatDb(supabase)
    await db
      .from('bilan_instances')
      .update({ status: 'no_response', updated_at: new Date().toISOString() })
      .eq('id', bilanId)
      .in('status', ['waiting', 'in_progress'])
  }

  const editable = isClientEditable(instance.status, instance.due_at)
  const schema = instance.schema_snapshot
  const payload = instance.payload

  const photoUrls = await Promise.all(
    (payload.photos ?? []).map(async (p) => {
      const admin = createServiceRoleClient()
      if (!admin) return { ...p, url: null as string | null }
      const { data } = await admin.storage.from('bilans').createSignedUrl(p.path, 3600)
      return { ...p, url: data?.signedUrl ?? null }
    })
  )

  return (
    <ClientPortalShell slug={ctx.slug} appName={ctx.appName} primaryColor={ctx.primaryColor} logoUrl={ctx.logoUrl}>
      <div className="grid gap-5">
        <div>
          <Link
            href={`/c/${ctx.slug}/profil/bilans`}
            className="text-sm font-semibold"
            style={{ color: ctx.primaryColor }}
          >
            ← Bilans
          </Link>
          <h1 className="mt-2 text-2xl font-extrabold" style={{ color: ctx.primaryColor }}>
            {instance.title}
          </h1>
          <p className="mt-1 text-sm text-black/55">
            {statusLabel(instance.status)} · avant le {new Date(instance.due_at).toLocaleDateString('fr-FR')}
          </p>
        </div>

        {q.saved ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Bilan envoyé.
          </div>
        ) : null}
        {q.error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{q.error}</div>
        ) : null}

        {editable ? (
          <form action={submitBilanAction} className="grid gap-5">
            <input type="hidden" name="slug" value={ctx.slug} />
            <input type="hidden" name="instance_id" value={instance.id} />

            {schema.measurements.length ? (
              <section className="grid gap-3 rounded-2xl border border-black/10 bg-white p-4">
                <h2 className="text-sm font-extrabold uppercase tracking-wide text-black/40">Mensurations</h2>
                {schema.measurements.map((m) => (
                  <label key={m.id} className="grid gap-1 text-sm">
                    <span className="font-semibold">
                      {m.label} ({m.unit})
                    </span>
                    <input
                      name={`m_${m.id}`}
                      defaultValue={payload.measurements?.[m.id] ?? ''}
                      className="rounded-lg border border-black/15 px-3 py-2"
                    />
                  </label>
                ))}
              </section>
            ) : null}

            {schema.questions.length ? (
              <section className="grid gap-3 rounded-2xl border border-black/10 bg-white p-4">
                <h2 className="text-sm font-extrabold uppercase tracking-wide text-black/40">Questions</h2>
                {schema.questions.map((qq) => (
                  <label key={qq.id} className="grid gap-1 text-sm">
                    <span className="font-semibold">{qq.label}</span>
                    <textarea
                      name={`q_${qq.id}`}
                      rows={3}
                      defaultValue={payload.questions?.[qq.id] ?? ''}
                      className="rounded-lg border border-black/15 px-3 py-2"
                    />
                  </label>
                ))}
              </section>
            ) : null}

            {schema.photos ? (
              <section className="grid gap-3 rounded-2xl border border-black/10 bg-white p-4">
                <h2 className="text-sm font-extrabold uppercase tracking-wide text-black/40">Photos</h2>
                {photoUrls.length ? (
                  <ul className="grid grid-cols-2 gap-2">
                    {photoUrls.map((p, i) =>
                      p.url ? (
                        <li key={i}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.url} alt="" className="aspect-square w-full rounded-lg object-cover" />
                        </li>
                      ) : null
                    )}
                  </ul>
                ) : null}
                <input name="photo" type="file" accept="image/*" multiple className="text-xs" />
                <input
                  name="photo_label"
                  placeholder="Libellé optionnel"
                  className="rounded-lg border border-black/15 px-3 py-2 text-sm"
                />
              </section>
            ) : null}

            <button
              type="submit"
              className="rounded-xl px-4 py-3 text-sm font-bold text-white"
              style={{ backgroundColor: ctx.primaryColor }}
            >
              Envoyer le bilan
            </button>
          </form>
        ) : (
          <div className="grid gap-4">
            {schema.measurements.length ? (
              <section className="rounded-2xl border border-black/10 bg-white p-4">
                <h2 className="text-sm font-extrabold uppercase tracking-wide text-black/40">Mensurations</h2>
                <ul className="mt-2 grid gap-1 text-sm">
                  {schema.measurements.map((m) => (
                    <li key={m.id}>
                      <strong>{m.label}</strong> : {payload.measurements?.[m.id] || '—'} {m.unit}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {schema.questions.length ? (
              <section className="rounded-2xl border border-black/10 bg-white p-4">
                <h2 className="text-sm font-extrabold uppercase tracking-wide text-black/40">Questions</h2>
                <ul className="mt-2 grid gap-3 text-sm">
                  {schema.questions.map((qq) => (
                    <li key={qq.id}>
                      <p className="font-semibold text-black/50">{qq.label}</p>
                      <p>{payload.questions?.[qq.id] || '—'}</p>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {schema.photos && photoUrls.length ? (
              <section className="rounded-2xl border border-black/10 bg-white p-4">
                <h2 className="text-sm font-extrabold uppercase tracking-wide text-black/40">Photos</h2>
                <ul className="mt-2 grid grid-cols-2 gap-2">
                  {photoUrls.map((p, i) =>
                    p.url ? (
                      <li key={i}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.url} alt="" className="aspect-square w-full rounded-lg object-cover" />
                      </li>
                    ) : null
                  )}
                </ul>
              </section>
            ) : null}
            {instance.status === 'no_response' ? (
              <p className="text-sm text-red-700">Délai dépassé — formulaire verrouillé.</p>
            ) : null}
          </div>
        )}
      </div>
    </ClientPortalShell>
  )
}
