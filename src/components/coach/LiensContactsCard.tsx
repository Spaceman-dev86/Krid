'use client'

import { useFormStatus } from 'react-dom'

import { saveLiensContactsAction } from '@/src/app/profile/liens/actions'
import { FluidSpinner } from '@/src/components/admin/FluidSpinner'
import { Button, daFieldClass } from '@/src/components/ui'

function SaveContacts() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="!rounded-lg !px-4 !py-2 text-sm font-bold">
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <FluidSpinner size={12} className="text-[var(--brand-fg)]" />
          Enregistrement…
        </span>
      ) : (
        'Enregistrer'
      )}
    </Button>
  )
}

export function LiensContactsCard({
  contactInstagram,
  contactWhatsapp,
  contactFacebook,
  warnings,
}: {
  contactInstagram: string
  contactWhatsapp: string
  contactFacebook: string
  warnings: string[]
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-da-sm">
      <div className="border-b border-[var(--border)] px-5 py-3">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">
          WhatsApp (retour messagerie)
        </h2>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          Seul WhatsApp ouvre une vraie conversation après Envoyer. Sur Instagram / Facebook, le
          prospect est enregistré dans Prospects — Meta ne permet pas un DM fiable depuis le web.
        </p>
      </div>

      {warnings.length ? (
        <div className="border-b border-amber-200/60 bg-amber-50/80 px-5 py-3 dark:bg-amber-950/30">
          <ul className="space-y-1 text-sm text-amber-950 dark:text-amber-100">
            {warnings.map((w) => (
              <li key={w}>⚠ {w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <form action={saveLiensContactsAction} className="grid gap-3 px-5 py-4 sm:max-w-md">
        <input type="hidden" name="contact_instagram" value={contactInstagram} />
        <input type="hidden" name="contact_facebook" value={contactFacebook} />
        <label className="grid gap-1 text-sm">
          <span className="font-semibold text-[color:var(--fg)]">Numéro WhatsApp</span>
          <input
            name="contact_whatsapp"
            defaultValue={contactWhatsapp}
            placeholder="33601020304"
            className={daFieldClass}
            autoComplete="off"
          />
          <span className="text-[11px] text-[color:var(--muted)]">
            Indicatif pays inclus — obligatoire pour les campagnes WhatsApp.
          </span>
        </label>
        <div className="flex justify-end">
          <SaveContacts />
        </div>
      </form>
    </section>
  )
}
