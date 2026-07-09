'use client'

import Link from 'next/link'

import { PRICING_PLANS, buildContactOfferHref, type PricingPlan } from '../../lib/appPricing'
import { Container, SectionHeading } from './index'

function PricingCard({
  plan,
}: {
  plan: PricingPlan
}) {
  const pricePerClient =
    plan.monthlyPrice !== undefined && plan.clientsForPriceCalc
      ? plan.monthlyPrice / plan.clientsForPriceCalc
      : null

  const formattedPricePerClient =
    pricePerClient !== null
      ? pricePerClient.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : null

  return (
    <article
      className={[
        'flex h-full flex-col rounded-[1.75rem] border bg-white p-5 shadow-[0_12px_32px_rgba(52,28,68,0.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(52,28,68,0.1)] sm:p-6',
        plan.highlighted
          ? 'border-[#9b6bb8] ring-2 ring-[#9b6bb8]/25'
          : 'border-black/10',
      ].join(' ')}
    >
      {plan.highlighted ? (
        <div className="mb-3 inline-flex w-fit rounded-full bg-[#9b6bb8]/15 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-[#9b6bb8]">
          Populaire
        </div>
      ) : (
        <div className="mb-3 h-6" />
      )}

      <h3 className="text-xl font-extrabold text-[#9b6bb8]">{plan.name}</h3>
      <div className="mt-2 inline-flex w-fit rounded-full bg-[#f8f6fa] px-3 py-1 text-xs font-extrabold text-[#341c44] ring-1 ring-black/10">
        {plan.clientRange}
      </div>
      <p className="mt-2 text-sm text-black/60">{plan.tagline}</p>

      <div className="mt-5 flex items-end gap-1">
        <div className="text-4xl font-extrabold tracking-tight text-[#341c44]">
          {plan.monthlyPrice !== undefined ? (
            <>
              {plan.pricePrefix ? (
                <span className="mr-2 text-sm font-extrabold uppercase tracking-wide text-black/45">
                  {plan.pricePrefix}
                </span>
              ) : null}
              {plan.monthlyPrice}€
            </>
          ) : (
            'Sur devis'
          )}
        </div>
        {plan.monthlyPrice !== undefined ? <div className="pb-1 text-sm font-semibold text-black/45">/ mois</div> : null}
      </div>

      <div className="mt-1 text-xs font-semibold text-black/45">
        {plan.setupFeeLabel ??
          (plan.setupFee && plan.setupFee > 0 ? `+ ${plan.setupFee}€ de mise en place` : 'Sans frais de mise en place')}
      </div>

      {formattedPricePerClient ? (
        <div className="mt-2 inline-flex w-fit rounded-full bg-[#faf9fb] px-3 py-1 text-xs font-extrabold text-black/55 ring-1 ring-black/10">
          {formattedPricePerClient}€ / client
        </div>
      ) : null}

      <ul className="mt-5 flex flex-1 flex-col gap-2">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-black/65">
            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#9b6bb8]/15 text-[11px] font-extrabold text-[#9b6bb8]">
              ✓
            </span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <Link
        href={buildContactOfferHref(plan)}
        className={[
          'mt-6 inline-flex h-11 items-center justify-center rounded-2xl text-sm font-extrabold transition',
          plan.highlighted
            ? 'bg-gradient-to-r from-[#d6c4e8] to-[#341c44] text-white shadow-[0_8px_20px_rgba(52,28,68,0.2)] hover:opacity-95'
            : 'bg-white ring-1 ring-[#d6c4e8] hover:bg-[#f8f6fa] hover:ring-[#9b6bb8]/40',
        ].join(' ')}
      >
        {plan.highlighted ? (
          <span className="text-white">
            {plan.id === 'studio' ? 'Candidater au Studio' : `Choisir ${plan.name}`}
          </span>
        ) : (
          <span className="bg-gradient-to-r from-[#9b6bb8] to-[#341c44] bg-clip-text text-transparent">
            {plan.id === 'studio' ? 'Candidater au Studio' : `Choisir ${plan.name}`}
          </span>
        )}
      </Link>
    </article>
  )
}

export default function AppPricingSection() {
  return (
    <section className="bg-white">
      <Container className="py-12 md:py-16">
        <div className="mx-auto max-w-3xl text-center">
          <SectionHeading
            title="Nos offres"
            titleClassName="text-[#9b6bb8]"
            subtitle="Des formules claires pour lancer ton app, la faire grandir, et passer en Studio quand tu veux construire un actif rachetable."
            className="[&_h2]:text-3xl [&_h2]:sm:text-4xl [&_h2]:md:text-5xl"
          />
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {PRICING_PLANS.map((plan) => (
            <PricingCard
              key={plan.id}
              plan={plan}
            />
          ))}
        </div>

        <p className="mx-auto mt-8 max-w-2xl text-center text-sm leading-relaxed text-black/60 sm:text-base">
          Si tu as des besoins particuliers pour ton application, n&apos;hésite pas à nous contacter — nous
          serons ravis de répondre à ta demande.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/contact"
            className="inline-flex h-11 items-center justify-center rounded-full bg-white px-6 text-sm font-extrabold ring-1 ring-[#d6c4e8] transition hover:bg-[#f8f6fa] hover:ring-[#9b6bb8]/40 focus:outline-none focus:ring-2 focus:ring-[#9b6bb8] focus:ring-offset-2"
          >
            <span className="bg-gradient-to-r from-[#9b6bb8] to-[#341c44] bg-clip-text text-transparent">
              Nous contacter
            </span>
          </Link>
          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center rounded-full bg-gradient-to-r from-[#d6c4e8] to-[#341c44] px-6 text-sm font-extrabold text-white shadow-[0_8px_24px_rgba(52,28,68,0.22)] transition hover:opacity-95"
          >
            Se connecter
          </Link>
        </div>
      </Container>
    </section>
  )
}
