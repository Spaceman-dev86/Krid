'use client'

import { appUrl } from '@/lib/urls'
import Link from 'next/link'
import { useMemo, useState } from 'react'

import { computeSimulationOffer, type SimulationAnswers } from '../../lib/offerSimulation'

const TOTAL_STEPS = 4

function getClientSliderPercent(value: number): number {
  const v = Math.max(0, Math.min(500, value))
  // We want ticks (0, 15, 75, 200, 500) evenly spaced visually.
  // So we map each segment to 25% of the slider width.
  if (v <= 15) return (v / 15) * 25
  if (v <= 75) return 25 + ((v - 15) / (75 - 15)) * 25
  if (v <= 200) return 50 + ((v - 75) / (200 - 75)) * 25
  return 75 + ((v - 200) / (500 - 200)) * 25
}

function clientCountFromSliderPercent(percent: number): number {
  const p = Math.max(0, Math.min(100, percent))
  if (p <= 25) return Math.round((p / 25) * 15)
  if (p <= 50) return Math.round(15 + ((p - 25) / 25) * (75 - 15))
  if (p <= 75) return Math.round(75 + ((p - 50) / 25) * (200 - 75))
  return Math.round(200 + ((p - 75) / 25) * (500 - 200))
}

function GoalIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M5 16l2-4h10l2 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 4v4" strokeLinecap="round" />
      <path d="M9 12h6" strokeLinecap="round" />
    </svg>
  )
}

function YesNoOptions(props: {
  value: boolean | null
  onChange: (value: boolean) => void
}) {
  const { value, onChange } = props

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {[
        { label: 'Oui', choice: true },
        { label: 'Non', choice: false },
      ].map((option) => {
        const active = value === option.choice
        return (
          <button
            key={option.label}
            type="button"
            onClick={() => onChange(option.choice)}
            className={[
              'rounded-2xl border px-5 py-4 text-left text-sm font-extrabold transition',
              active
                ? 'border-[#9b6bb8] bg-[#9b6bb8]/10 text-[#341c44] ring-2 ring-[#9b6bb8]/30'
                : 'border-black/10 bg-white text-[#341c44] hover:border-[#9b6bb8]/40 hover:bg-[#f8f6fa]',
            ].join(' ')}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export default function OfferSimulatorClient() {
  const [step, setStep] = useState(1)
  const [answers, setAnswers] = useState<SimulationAnswers>({
    clientCount: 10,
    paymentInApp: null,
    appStore: null,
    strava: null,
  })

  const offer = useMemo(() => (step > TOTAL_STEPS ? computeSimulationOffer(answers) : null), [answers, step])

  function goNext() {
    setStep((current) => Math.min(current + 1, TOTAL_STEPS + 1))
  }

  function goBack() {
    setStep((current) => Math.max(current - 1, 1))
  }

  const canContinue =
    step === 1 ||
    (step === 2 && answers.paymentInApp !== null) ||
    (step === 3 && answers.appStore !== null) ||
    (step === 4 && answers.strava !== null)

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-[#9b6bb8] sm:text-4xl md:text-5xl">
          Simule ton offre idéale
        </h1>
        <p className="mt-3 text-sm text-black/60 sm:text-base">
          Réponds à 4 questions rapides pour savoir quelle offre te convient.
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-xs font-semibold text-black/50 sm:text-sm">
          <span className="inline-flex items-center gap-2 rounded-full bg-[#f8f6fa] px-3 py-1.5 ring-1 ring-black/10">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#9b6bb8]/15 text-[#9b6bb8]">?</span>
            4 questions rapides
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-[#f8f6fa] px-3 py-1.5 ring-1 ring-black/10">
            <span aria-hidden>⏱</span>
            Environ 1 min
          </span>
        </div>
      </div>

      <div className="mt-8 rounded-[1.75rem] border border-black/10 bg-white p-6 shadow-[0_12px_32px_rgba(52,28,68,0.06)] sm:p-8">
        {step <= TOTAL_STEPS ? (
          <>
            <div className="text-xs font-semibold text-black/45">
              Question {step} sur {TOTAL_STEPS}
            </div>

            {step === 1 ? (
              <div className="mt-4">
                <h2 className="text-xl font-extrabold text-[#9b6bb8] sm:text-2xl">
                  Combien de clients actifs coaches-tu aujourd&apos;hui ?
                </h2>
                <div className="mt-8 px-[0.625rem]">
                  <div className="relative pt-8">
                    {(() => {
                      const sliderPercent = getClientSliderPercent(answers.clientCount)
                      return (
                        <>
                    <div
                      className="pointer-events-none absolute -translate-x-1/2 rounded-full border border-[#9b6bb8]/40 bg-white px-3 py-1 text-xs font-extrabold text-[#9b6bb8] shadow-sm"
                      style={{ left: `${sliderPercent}%`, top: 0 }}
                    >
                      {answers.clientCount >= 500 ? '500+' : answers.clientCount}
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={sliderPercent}
                      onChange={(e) =>
                        setAnswers((prev) => ({
                          ...prev,
                          clientCount: clientCountFromSliderPercent(Number(e.target.value)),
                        }))
                      }
                      className="offer-simulator-range w-full"
                      style={{
                        ['--offer-range-progress' as string]: `${sliderPercent}%`,
                      }}
                    />
                        </>
                      )
                    })()}
                  </div>
                  <div className="mt-3 flex justify-between text-xs font-semibold text-black/40">
                    <span>0</span>
                    <span>15</span>
                    <span>75</span>
                    <span>200</span>
                    <span>500+</span>
                  </div>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="mt-4">
                <h2 className="text-xl font-extrabold text-[#9b6bb8] sm:text-2xl">
                  Tu veux que tes clients puissent payer depuis ton app ?
                </h2>
                <div className="mt-5">
                  <YesNoOptions
                    value={answers.paymentInApp}
                    onChange={(paymentInApp) => setAnswers((prev) => ({ ...prev, paymentInApp }))}
                  />
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="mt-4">
                <h2 className="text-xl font-extrabold text-[#9b6bb8] sm:text-2xl">
                  Tu veux une app publiée sur l&apos;App Store / Google Play à ton nom ?
                </h2>
                <div className="mt-5">
                  <YesNoOptions
                    value={answers.appStore}
                    onChange={(appStore) => setAnswers((prev) => ({ ...prev, appStore }))}
                  />
                </div>
              </div>
            ) : null}

            {step === 4 ? (
              <div className="mt-4">
                <h2 className="text-xl font-extrabold text-[#9b6bb8] sm:text-2xl">
                  Tu veux synchroniser l&apos;activité via Strava (course, vélo, etc.) ?
                </h2>
                <div className="mt-5">
                  <YesNoOptions
                    value={answers.strava}
                    onChange={(strava) => setAnswers((prev) => ({ ...prev, strava }))}
                  />
                </div>
              </div>
            ) : null}

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={goBack}
                disabled={step === 1}
                className="inline-flex h-12 items-center justify-center rounded-2xl bg-black/5 text-sm font-extrabold text-black/45 transition hover:bg-black/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Retour
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={!canContinue}
                className="inline-flex h-12 items-center justify-center rounded-2xl bg-gradient-to-r from-[#d6c4e8] to-[#341c44] text-sm font-extrabold text-white shadow-[0_8px_24px_rgba(52,28,68,0.22)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {step === TOTAL_STEPS ? 'Voir mon offre' : 'Question suivante'}
              </button>
            </div>
          </>
        ) : offer ? (
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9b6bb8]">Ton estimation</div>
            <h2 className="mt-2 text-2xl font-extrabold text-[#9b6bb8] sm:text-3xl">{offer.planName}</h2>
            <p className="mt-2 text-sm text-black/60">{offer.summary}</p>

            <div className="mt-6 rounded-[1.5rem] border border-black/10 bg-[#f8f6fa] p-5 sm:p-6">
              <div className="flex flex-wrap items-end gap-2">
                <div className="text-4xl font-extrabold text-[#341c44]">{offer.monthlyPrice}€</div>
                <div className="pb-1 text-sm font-semibold text-black/50">/ mois</div>
              </div>
              {offer.setupFee > 0 ? (
                <div className="mt-1 text-sm font-semibold text-black/50">
                  + {offer.setupFee}€ de mise en place
                </div>
              ) : (
                <div className="mt-1 text-sm font-semibold text-black/50">Sans frais de mise en place</div>
              )}
            </div>

            <div className="mt-6">
              <div className="text-sm font-extrabold text-[#341c44]">Options incluses dans cette offre</div>
              <ul className="mt-3 grid gap-2">
                {offer.included.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 rounded-xl bg-white px-3 py-2.5 text-sm text-black/70 ring-1 ring-black/10"
                  >
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#9b6bb8]/15 text-xs font-extrabold text-[#9b6bb8]">
                      ✓
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex h-12 items-center justify-center rounded-2xl bg-black/5 px-6 text-sm font-extrabold text-[#341c44] transition hover:bg-black/10"
              >
                Recommencer
              </button>
              <Link
                href={`/contact?offer=${offer.planId}`}
                className="inline-flex h-12 items-center justify-center rounded-2xl bg-white px-6 text-sm font-extrabold text-[#341c44] ring-1 ring-black/10 transition hover:bg-[#f5f5f5]"
              >
                Nous contacter
              </Link>
              <Link
                href={appUrl("/login")}
                className="inline-flex h-12 items-center justify-center rounded-2xl bg-gradient-to-r from-[#d6c4e8] to-[#341c44] px-6 text-sm font-extrabold text-white shadow-[0_8px_24px_rgba(52,28,68,0.22)] transition hover:opacity-95"
              >
                Se connecter
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
