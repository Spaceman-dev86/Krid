'use client'

import { createPortal } from 'react-dom'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { Card } from '../../../components/marketing'
import { createClient } from '../../../lib/supabase/client'

type Sex = 'male' | 'female'

type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very' | 'intense'

type Objective = 'maintien' | 'seche' | 'prise_de_masse'

const ACTIVITY_FACTORS: Record<ActivityLevel, { label: string; factor: number }> = {
  sedentary: { label: 'Sédentaire', factor: 1.2 },
  light: { label: 'Légèrement actif', factor: 1.375 },
  moderate: { label: 'Modérément actif', factor: 1.55 },
  very: { label: 'Très actif', factor: 1.725 },
  intense: { label: 'Sport intensif > 2h/j', factor: 1.9 },
}

function roundToInt(n: number) {
  if (!Number.isFinite(n)) return 0
  return Math.round(n)
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function computeMaintenanceKcal({
  sex,
  weightKg,
  heightCm,
  age,
  activityFactor,
}: {
  sex: Sex
  weightKg: number
  heightCm: number
  age: number
  activityFactor: number
}) {
  const base = weightKg * 10 + heightCm * 6.25 - age * 5 + (sex === 'male' ? 5 : -161)
  return base * activityFactor
}

type PostgrestErrorLike = {
  message?: string
}

type InsertSelectSingleResult = {
  data: Record<string, unknown> | null
  error: PostgrestErrorLike | null
}

type WriteResult = {
  error: PostgrestErrorLike | null
}

type PostgrestTableLike = {
  insert: (values: Record<string, unknown>) => {
    select: (columns: string) => {
      single: () => Promise<InsertSelectSingleResult>
    }
  }
  upsert: (values: Record<string, unknown>) => Promise<WriteResult>
  update: (values: Record<string, unknown>) => {
    eq: (column: string, value: string) => Promise<WriteResult>
  }
}

type SupabaseUntypedLike = {
  from: (table: string) => PostgrestTableLike
}

export default function AddClientModal() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const supabaseUntyped = supabase as unknown as SupabaseUntypedLike

  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [sex, setSex] = useState<Sex>('male')
  const [heightCm, setHeightCm] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [age, setAge] = useState('')
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate')
  const [objective, setObjective] = useState<Objective>('maintien')
  const [percent, setPercent] = useState(0)

  const bumpNumericString = (value: string, delta: number, decimals: number) => {
    const n = Number(value)
    const base = Number.isFinite(n) ? n : 0
    const next = Math.max(0, base + delta)
    if (decimals <= 0) return String(Math.round(next))
    return String(Number(next.toFixed(decimals)))
  }

  const activityFactor = ACTIVITY_FACTORS[activityLevel].factor

  const maintenance = useMemo(() => {
    const w = Number(weightKg)
    const h = Number(heightCm)
    const a = Number(age)
    if (!w || !h || !a) return null
    return computeMaintenanceKcal({ sex, weightKg: w, heightCm: h, age: a, activityFactor })
  }, [sex, weightKg, heightCm, age, activityFactor])

  const percentConstraints = useMemo(() => {
    if (objective === 'prise_de_masse') return { min: 0, max: 15 }
    if (objective === 'seche') return { min: -15, max: 0 }
    if (objective === 'maintien') return { min: 0, max: 0 }
    return { min: 0, max: 0 }
  }, [objective])

  const effectivePercent = useMemo(() => {
    return clamp(percent, percentConstraints.min, percentConstraints.max)
  }, [percent, percentConstraints.max, percentConstraints.min])

  const target = useMemo(() => {
    if (!maintenance) return null
    return maintenance * (1 + effectivePercent / 100)
  }, [maintenance, effectivePercent])

  async function onSubmit() {
    setError(null)

    const fn = firstName.trim()
    const ln = lastName.trim()
    const fullName = [fn, ln].filter(Boolean).join(' ').trim()

    const h = Number(heightCm)
    const w = Number(weightKg)
    const a = Number(age)

    if (!fn || !ln) return setError('Nom et prénom requis.')
    if (!Number.isFinite(h) || h <= 0) return setError('Taille invalide.')
    if (!Number.isFinite(w) || w <= 0) return setError('Poids invalide.')
    if (!Number.isFinite(a) || a <= 0) return setError('Âge invalide.')
    if (!maintenance || !target) return setError('Impossible de calculer le maintien/cible.')

    setLoading(true)
    try {
      const avatarSeed = fn.toLowerCase().slice(0, 24)

      const { data: insertedClient, error: clientErr } = await supabaseUntyped
        .from('demo_clients')
        .insert({
          full_name: fullName,
          avatar_seed: avatarSeed,
          first_name: fn,
          last_name: ln,
          sex,
          height_cm: roundToInt(h),
          weight_kg: w,
          age: roundToInt(a),
          activity_level: activityLevel,
          activity_factor: activityFactor,
        })
        .select('id')
        .single()

      if (clientErr) throw clientErr

      const clientId = String(insertedClient?.id ?? '')
      if (!clientId) throw new Error('Client créé sans id.')

      const { error: profileErr } = await supabaseUntyped
        .from('demo_clients')
        .update({
          objective,
          maintenance_kcal: roundToInt(maintenance),
          target_kcal: roundToInt(target),
          age: roundToInt(a),
          nutrition_profile_updated_at: new Date().toISOString(),
        })
        .eq('id', clientId)

      if (profileErr) throw profileErr

      const { error: planErr } = await supabaseUntyped
        .from('nutrition_week_plans')
        .insert({
          client_id: clientId,
          title: 'Semaine type',
          is_active: true,
        })
        .select('id')
        .single()

      if (planErr) throw planErr

      setOpen(false)
      router.push(`/dashboard/nutrition?client=${clientId}`)
      router.refresh()
    } catch (e) {
      const msg = e instanceof Error ? e.message : (e as { message?: string } | null)?.message ?? 'Erreur inconnue.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center justify-center rounded-2xl bg-[#341c44] px-4 text-sm font-extrabold text-white shadow-sm hover:opacity-90"
      >
        Ajouter un client
      </button>

      {mounted && open
        ? createPortal(
            <div className="fixed inset-0 z-[9999]">
              <button
                type="button"
                className="absolute inset-0 bg-black/30"
                aria-label="Fermer"
                onClick={() => (loading ? null : setOpen(false))}
              />
              <div className="absolute left-1/2 top-24 z-10 w-[min(520px,calc(100vw-2rem))] -translate-x-1/2">
                <Card className="relative overflow-hidden p-0">
                  <div className="flex items-center justify-between gap-3 border-b border-black/10 px-4 py-3">
                    <div className="text-sm font-extrabold text-[#341c44]">Ajouter un client</div>
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white text-[#341c44] ring-1 ring-black/10 hover:bg-[#f5f5f5]"
                      onClick={() => (loading ? null : setOpen(false))}
                      aria-label="Fermer"
                      title="Fermer"
                    >
                      ×
                    </button>
                  </div>

                  <div className="p-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="grid gap-1">
                        <span className="text-xs font-extrabold text-[#341c44]">Prénom</span>
                        <input
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          className="h-11 rounded-2xl bg-white px-3 text-sm font-semibold text-[#341c44] ring-1 ring-black/10 focus:outline-none focus:ring-2 focus:ring-[#341c44]/20"
                          placeholder="Prénom"
                        />
                      </label>

                      <label className="grid gap-1">
                        <span className="text-xs font-extrabold text-[#341c44]">Nom</span>
                        <input
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          className="h-11 rounded-2xl bg-white px-3 text-sm font-semibold text-[#341c44] ring-1 ring-black/10 focus:outline-none focus:ring-2 focus:ring-[#341c44]/20"
                          placeholder="Nom"
                        />
                      </label>

                      <label className="grid gap-1">
                        <span className="text-xs font-extrabold text-[#341c44]">Sexe</span>
                        <div className="relative">
                          <select
                            value={sex}
                            onChange={(e) => setSex(e.target.value as Sex)}
                            className="h-11 w-full appearance-none rounded-2xl bg-white px-3 pr-10 text-sm font-semibold text-[#341c44] ring-1 ring-black/10 focus:outline-none focus:ring-2 focus:ring-[#341c44]/20"
                          >
                            <option value="male">Homme</option>
                            <option value="female">Femme</option>
                          </select>
                          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-black/40">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        </div>
                      </label>

                      <label className="grid gap-1">
                        <span className="text-xs font-extrabold text-[#341c44]">Activité</span>
                        <div className="relative">
                          <select
                            value={activityLevel}
                            onChange={(e) => setActivityLevel(e.target.value as ActivityLevel)}
                            className="h-11 w-full appearance-none rounded-2xl bg-white px-3 pr-10 text-sm font-semibold text-[#341c44] ring-1 ring-black/10 focus:outline-none focus:ring-2 focus:ring-[#341c44]/20"
                          >
                            {Object.entries(ACTIVITY_FACTORS).map(([key, v]) => (
                              <option key={key} value={key}>
                                {v.label}
                              </option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-black/40">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        </div>
                      </label>
                    </div>

                    <div className="mt-3 grid gap-4 md:grid-cols-3">
                      <label className="grid gap-1">
                        <span className="text-xs font-extrabold text-[#341c44]">Taille (cm)</span>
                        <div className="relative">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={heightCm}
                            onChange={(e) => setHeightCm(e.target.value)}
                            className="no-native-spin h-10 w-full appearance-none rounded-2xl bg-white px-3 pr-12 text-sm font-semibold text-[#341c44] ring-1 ring-black/10 focus:outline-none focus:ring-2 focus:ring-[#341c44]/20"
                            placeholder="180"
                          />
                          <div className="absolute right-2 top-1/2 -translate-y-1/2">
                            <div className="grid overflow-hidden rounded-xl">
                              <button
                                type="button"
                                onClick={() => setHeightCm((v) => bumpNumericString(v, 1, 0))}
                                className="grid h-4 w-7 place-items-center bg-white text-black/60 hover:bg-[#f5f5f5]"
                                aria-label="Augmenter la taille"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                                  <path d="M6 14l6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => setHeightCm((v) => bumpNumericString(v, -1, 0))}
                                className="grid h-4 w-7 place-items-center bg-white text-black/60 hover:bg-[#f5f5f5]"
                                aria-label="Diminuer la taille"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                                  <path d="M6 10l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      </label>

                      <label className="grid gap-1">
                        <span className="text-xs font-extrabold text-[#341c44]">Poids (kg)</span>
                        <div className="relative">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={weightKg}
                            onChange={(e) => setWeightKg(e.target.value)}
                            className="no-native-spin h-10 w-full appearance-none rounded-2xl bg-white px-3 pr-12 text-sm font-semibold text-[#341c44] ring-1 ring-black/10 focus:outline-none focus:ring-2 focus:ring-[#341c44]/20"
                            placeholder="78"
                          />
                          <div className="absolute right-2 top-1/2 -translate-y-1/2">
                            <div className="grid overflow-hidden rounded-xl">
                              <button
                                type="button"
                                onClick={() => setWeightKg((v) => bumpNumericString(v, 0.1, 1))}
                                className="grid h-4 w-7 place-items-center bg-white text-black/60 hover:bg-[#f5f5f5]"
                                aria-label="Augmenter le poids"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                                  <path d="M6 14l6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => setWeightKg((v) => bumpNumericString(v, -0.1, 1))}
                                className="grid h-4 w-7 place-items-center bg-white text-black/60 hover:bg-[#f5f5f5]"
                                aria-label="Diminuer le poids"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                                  <path d="M6 10l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      </label>

                      <label className="grid gap-1">
                        <span className="text-xs font-extrabold text-[#341c44]">Âge</span>
                        <div className="relative">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={age}
                            onChange={(e) => setAge(e.target.value)}
                            className="no-native-spin h-10 w-full appearance-none rounded-2xl bg-white px-3 pr-12 text-sm font-semibold text-[#341c44] ring-1 ring-black/10 focus:outline-none focus:ring-2 focus:ring-[#341c44]/20"
                            placeholder="28"
                          />
                          <div className="absolute right-2 top-1/2 -translate-y-1/2">
                            <div className="grid overflow-hidden rounded-xl">
                              <button
                                type="button"
                                onClick={() => setAge((v) => bumpNumericString(v, 1, 0))}
                                className="grid h-4 w-7 place-items-center bg-white text-black/60 hover:bg-[#f5f5f5]"
                                aria-label="Augmenter l'âge"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                                  <path d="M6 14l6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => setAge((v) => bumpNumericString(v, -1, 0))}
                                className="grid h-4 w-7 place-items-center bg-white text-black/60 hover:bg-[#f5f5f5]"
                                aria-label="Diminuer l'âge"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                                  <path d="M6 10l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      </label>
                    </div>

                    <div className="mt-4">
                      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px] md:grid-rows-2">
                        <div className="rounded-2xl bg-white p-3 ring-1 ring-black/10 md:row-span-2">
                          <div className="text-xs font-extrabold text-[#341c44]">Objectif</div>

                          <div className="relative mt-2">
                            <select
                              value={objective}
                              onChange={(e) => {
                                const next = e.target.value as Objective
                                setObjective(next)
                                if (next === 'maintien') setPercent(0)
                                if (next === 'prise_de_masse' && percent < 0) setPercent(0)
                                if (next === 'seche' && percent > 0) setPercent(0)
                              }}
                              className="h-10 w-full appearance-none rounded-2xl bg-white px-3 pr-10 text-sm font-semibold text-[#341c44] ring-1 ring-black/10 focus:outline-none focus:ring-2 focus:ring-[#341c44]/20"
                            >
                              <option value="maintien">Maintien</option>
                              <option value="seche">Sèche</option>
                              <option value="prise_de_masse">Prise de masse</option>
                            </select>
                            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-black/40">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </div>
                          </div>

                          <div className="mt-2 flex items-center justify-between gap-3">
                            <div className="text-[11px] font-extrabold text-black/50">Déficit / surplus</div>
                            <div className="text-xs font-extrabold text-black/70">
                              {effectivePercent >= 0 ? '+' : ''}
                              {effectivePercent.toFixed(1)}%
                            </div>
                          </div>

                          <input
                            type="range"
                            min={percentConstraints.min}
                            max={percentConstraints.max}
                            step={2.5}
                            value={effectivePercent}
                            disabled={objective === 'maintien'}
                            onChange={(e) => setPercent(Number(e.target.value))}
                            className="mt-1 w-full"
                          />
                        </div>

                        <div className="rounded-2xl bg-white px-3 py-3 ring-1 ring-black/10">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-xs font-extrabold text-[#341c44]">Maintien</div>
                            <div className="text-sm font-extrabold text-black/80">{maintenance ? `${roundToInt(maintenance)} kcal/j` : '—'}</div>
                          </div>
                        </div>

                        <div className="rounded-2xl bg-white px-3 py-3 ring-1 ring-black/10">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-xs font-extrabold text-[#341c44]">Cible</div>
                            <div className="text-sm font-extrabold text-black/80">{target ? `${roundToInt(target)} kcal/j` : '—'}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {error ? <div className="mt-3 text-sm font-semibold text-red-600">{error}</div> : null}

                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        onClick={() => void onSubmit()}
                        disabled={loading}
                        className="inline-flex h-10 items-center justify-center rounded-2xl bg-[#341c44] px-4 text-sm font-extrabold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
                      >
                        {loading ? 'Ajout…' : 'Ajouter'}
                      </button>
                    </div>
                  </div>
                </Card>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  )
}
