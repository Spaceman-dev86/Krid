'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import { toggleFavoriteAction } from '../../app/c/[slug]/historique-actions'
import type { ItemHistory } from '../../lib/client-portal/historyLand'

type Props = {
  slug: string
  primaryColor: string
  item: ItemHistory
  isFavorite: boolean
  about: {
    name: string
    description: string | null
    muscleGroup: string | null
    difficulty: string | null
    videoUrl: string | null
    demoMediaPath: string | null
  } | null
}

type Tab = 'historique' | 'records' | 'apropos'

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path
        d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8 6.8 19.5l1-5.8L3.6 9.6l5.8-.8L12 3.5z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function MiniBars({
  values,
  primaryColor,
  unit,
}: {
  values: Array<{ label: string; value: number }>
  primaryColor: string
  unit?: string
}) {
  const max = Math.max(1, ...values.map((v) => v.value))
  if (!values.length) return <p className="text-sm text-black/45">Pas encore de données.</p>
  return (
    <ul className="grid gap-2">
      {values.map((v) => (
        <li key={v.label} className="grid gap-1">
          <div className="flex justify-between text-xs text-black/55">
            <span>{v.label}</span>
            <span className="font-semibold text-black/70">
              {Math.round(v.value * 10) / 10}
              {unit ? ` ${unit}` : ''}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-black/5">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.round((v.value / max) * 100)}%`, backgroundColor: primaryColor }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

function RecordCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-black/10 bg-white px-3 py-2.5 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-wide text-black/40">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-[#1a1220]">{value}</p>
    </div>
  )
}

export function ClientHistoryItemClient({
  slug,
  primaryColor,
  item,
  isFavorite,
  about,
}: Props) {
  const [tab, setTab] = useState<Tab>('historique')
  const base = `/c/${slug}/historique`

  const weeklySets = useMemo(
    () => item.weekly.map((w) => ({ label: w.label, value: w.setsCount })),
    [item.weekly]
  )
  const weeklyTonnage = useMemo(
    () => item.weekly.map((w) => ({ label: w.label, value: w.tonnage })),
    [item.weekly]
  )

  return (
    <div className="grid gap-4">
      <div>
        <Link href={base} className="text-xs font-bold text-black/45 hover:text-black/65">
          ← Historique
        </Link>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold" style={{ color: primaryColor }}>
              {item.name}
            </h1>
            <p className="mt-1 text-sm text-black/55">
              {item.kind === 'block' ? `Bloc · ${item.type}` : 'Exercice'}
            </p>
          </div>
          <form action={toggleFavoriteAction}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="target_type" value={item.kind} />
            <input type="hidden" name="target_id" value={item.targetId} />
            <input type="hidden" name="return_to" value={`${base}/${item.itemId}`} />
            <button
              type="submit"
              className="rounded-full p-2 transition hover:bg-black/5"
              style={{ color: isFavorite ? primaryColor : 'rgba(0,0,0,0.35)' }}
              aria-label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            >
              <StarIcon filled={isFavorite} />
            </button>
          </form>
        </div>
      </div>

      <div className="flex gap-1 rounded-xl bg-black/[0.04] p-1">
        {(
          [
            ['historique', 'Historique'],
            ['records', 'Records'],
            ['apropos', 'À propos'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className="flex-1 rounded-lg px-2 py-2 text-xs font-bold transition"
            style={
              tab === id
                ? { backgroundColor: 'white', color: primaryColor, boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }
                : { color: 'rgba(0,0,0,0.45)' }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'historique' ? (
        <div className="grid gap-4">
          {item.kind === 'exercise' ? (
            <>
              <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
                <h2 className="mb-3 text-sm font-bold text-[#1a1220]">Séries / semaine</h2>
                <MiniBars values={weeklySets} primaryColor={primaryColor} />
              </section>
              {weeklyTonnage.some((v) => v.value > 0) ? (
                <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
                  <h2 className="mb-3 text-sm font-bold text-[#1a1220]">Tonnage / semaine</h2>
                  <MiniBars values={weeklyTonnage} primaryColor={primaryColor} unit="kg" />
                </section>
              ) : null}
              {item.estimated1Rm != null ? (
                <p className="text-sm text-black/55">
                  Estim. 1RM (Epley) :{' '}
                  <span className="font-semibold text-[#1a1220]">{item.estimated1Rm} kg</span>
                  {item.bestSetPreview ? ` · best set ${item.bestSetPreview}` : ''}
                </p>
              ) : null}
            </>
          ) : (
            <>
              <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
                <h2 className="mb-3 text-sm font-bold text-[#1a1220]">
                  {item.objective
                    ? `Objectif · ${item.objective}`
                    : 'Complétions / semaine'}
                </h2>
                <MiniBars values={weeklySets} primaryColor={primaryColor} />
                {item.completionRate != null ? (
                  <p className="mt-3 text-sm text-black/55">
                    Taux de complétion :{' '}
                    <span className="font-semibold text-[#1a1220]">{item.completionRate}%</span>
                  </p>
                ) : null}
              </section>
              {item.children.length ? (
                <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
                  <h2 className="mb-2 text-sm font-bold text-[#1a1220]">Exercices du bloc</h2>
                  <ul className="divide-y divide-black/5">
                    {item.children.map((c) => (
                      <li key={c.name + (c.itemId ?? '')}>
                        {c.itemId ? (
                          <Link
                            href={`${base}/${c.itemId}`}
                            className="block py-2 text-sm font-medium hover:text-black/70"
                            style={{ color: primaryColor }}
                          >
                            {c.name} →
                          </Link>
                        ) : (
                          <span className="block py-2 text-sm text-black/70">{c.name}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          )}

          <section className="rounded-2xl border border-black/10 bg-white shadow-sm">
            <h2 className="border-b border-black/5 px-4 py-3 text-sm font-bold text-[#1a1220]">
              Séances
            </h2>
            <ul className="divide-y divide-black/5">
              {item.occurrences.map((o) => (
                <li key={`${o.runId}-${o.at}`}>
                  <Link
                    href={`${base}/seance/${o.runId}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-black/[0.02]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#1a1220]">
                        {o.runTitle?.trim() || 'Séance'}
                      </p>
                      <p className="text-xs text-black/45">
                        {new Date(o.at).toLocaleString('fr-FR')} · {o.preview}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-black/35">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}

      {tab === 'records' ? (
        <div className="grid grid-cols-2 gap-2">
          {item.kind === 'exercise' ? (
            <>
              <RecordCard
                label="Estim. 1RM"
                value={item.estimated1Rm != null ? `${item.estimated1Rm} kg` : '—'}
              />
              <RecordCard
                label="Charge max"
                value={item.maxLoad != null ? `${item.maxLoad} kg` : '—'}
              />
              <RecordCard
                label="Max reps / série"
                value={item.maxReps != null ? String(item.maxReps) : '—'}
              />
              <RecordCard
                label="Tonnage max séance"
                value={
                  item.maxSessionTonnage != null
                    ? `${Math.round(item.maxSessionTonnage)} kg`
                    : '—'
                }
              />
              <RecordCard
                label="Séries max / sem."
                value={item.maxSetsPerWeek != null ? String(item.maxSetsPerWeek) : '—'}
              />
              <RecordCard label="Best set" value={item.bestSetPreview ?? '—'} />
            </>
          ) : (
            <>
              <RecordCard
                label={item.objective ? `Record · ${item.objective}` : 'Complétion'}
                value={
                  item.maxCompletionsPerWeek != null
                    ? `${item.maxCompletionsPerWeek} / sem.`
                    : '—'
                }
              />
              <RecordCard
                label="Taux complétion"
                value={item.completionRate != null ? `${item.completionRate}%` : '—'}
              />
              <RecordCard
                label="Tonnage max"
                value={
                  item.maxSessionTonnage != null
                    ? `${Math.round(item.maxSessionTonnage)} kg`
                    : '—'
                }
              />
              <RecordCard label="1RM bloc" value="N/A" />
            </>
          )}
        </div>
      ) : null}

      {tab === 'apropos' ? (
        <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
          {item.kind === 'exercise' ? (
            <div className="grid gap-3 text-sm">
              <p className="font-semibold text-[#1a1220]">{about?.name ?? item.name}</p>
              {about?.muscleGroup ? (
                <p className="text-black/55">
                  Muscle : <span className="text-black/80">{about.muscleGroup}</span>
                </p>
              ) : null}
              {about?.difficulty ? (
                <p className="text-black/55">
                  Niveau : <span className="text-black/80">{about.difficulty}</span>
                </p>
              ) : null}
              {about?.description ? (
                <p className="whitespace-pre-wrap text-black/70">{about.description}</p>
              ) : item.notes ? (
                <p className="whitespace-pre-wrap text-black/70">{item.notes}</p>
              ) : (
                <p className="text-black/45">Pas de fiche détaillée.</p>
              )}
              {about?.videoUrl ? (
                <a
                  href={about.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold underline-offset-2 hover:underline"
                  style={{ color: primaryColor }}
                >
                  Voir la vidéo
                </a>
              ) : null}
              {about?.demoMediaPath ? (
                <p className="text-xs text-black/40">Média : {about.demoMediaPath}</p>
              ) : null}
            </div>
          ) : (
            <div className="grid gap-3 text-sm">
              <p className="font-semibold text-[#1a1220]">{item.name}</p>
              {item.objective ? (
                <p className="text-black/55">
                  Objectif : <span className="text-black/80">{item.objective}</span>
                </p>
              ) : null}
              {item.notes ? (
                <p className="whitespace-pre-wrap text-black/70">{item.notes}</p>
              ) : (
                <p className="text-black/45">Pas de description.</p>
              )}
              {item.children.length ? (
                <ul className="mt-1 divide-y divide-black/5 rounded-xl border border-black/10">
                  {item.children.map((c) => (
                    <li key={c.name + (c.itemId ?? '')} className="px-3 py-2">
                      {c.itemId ? (
                        <Link href={`${base}/${c.itemId}`} style={{ color: primaryColor }}>
                          {c.name}
                        </Link>
                      ) : (
                        c.name
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
        </section>
      ) : null}
    </div>
  )
}
