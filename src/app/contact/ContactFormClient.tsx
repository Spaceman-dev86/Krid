'use client'

import { Card } from '../../components/marketing'
import { Button } from '../../components/ui'
import {
  getOfferContactSummary,
  getPlanById,
} from '../../lib/appPricing'

type Props = {
  offerId?: string
  clientCount?: string
}

export default function ContactFormClient({ offerId, clientCount }: Props) {
  const plan = offerId ? getPlanById(offerId) : undefined
  const offerSummary = plan ? getOfferContactSummary(plan) : null

  return (
    <Card>
      {plan && offerSummary ? (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-[#9b6bb8]/25 bg-[#9b6bb8]/8 px-4 py-3">
          <span className="inline-flex shrink-0 rounded-full bg-[#9b6bb8]/15 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-[#9b6bb8]">
            Offre
          </span>
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-[#341c44]">Offre {plan.name}</p>
            <p className="mt-0.5 text-xs font-semibold text-black/55">
              {offerSummary.clientLabel} · {offerSummary.priceLabel}
            </p>
          </div>
        </div>
      ) : null}

      <form className="grid gap-4">
        {plan ? (
          <>
            <input type="hidden" name="offer" value={plan.id} />
            {clientCount ? <input type="hidden" name="clients" value={clientCount} /> : null}
          </>
        ) : null}

        <label className="grid gap-2">
          <span className="text-sm font-semibold text-[#341c44]">Nom</span>
          <input
            className="h-11 rounded-xl bg-white px-4 text-sm ring-1 ring-black/10 focus:outline-none focus:ring-2 focus:ring-[#341c44]"
            name="name"
            placeholder="Ton nom"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-semibold text-[#341c44]">Email</span>
          <input
            className="h-11 rounded-xl bg-white px-4 text-sm ring-1 ring-black/10 focus:outline-none focus:ring-2 focus:ring-[#341c44]"
            name="email"
            placeholder="ton@email.com"
            type="email"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-semibold text-[#341c44]">Message</span>
          <textarea
            className="min-h-28 rounded-xl bg-white px-4 py-3 text-sm ring-1 ring-black/10 focus:outline-none focus:ring-2 focus:ring-[#341c44]"
            name="message"
            placeholder="Ton message..."
          />
        </label>

        <div className="pt-2">
          <Button
            type="submit"
            variant="gradient"
            className="w-full px-5 py-3 text-sm sm:px-6 sm:py-3.5"
          >
            Envoyer
          </Button>
        </div>
      </form>
    </Card>
  )
}
