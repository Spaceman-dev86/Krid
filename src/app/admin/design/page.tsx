import type { ReactNode } from 'react'

import { FluidSpinner } from '@/src/components/admin/FluidSpinner'
import { CompositionInsertMarker } from '@/src/components/admin/useCompositionLongPressReorder'
import { KridMark, KridWordmark } from '@/src/components/brand/KridLogo'
import { DocFolderDesignDemo } from '@/src/components/documentation/DocFolderDesignDemo'
import { DesignDaSummary, DesignThemeToggle } from '../../../components/design/ThemeToggle'
import {
  Body,
  Button,
  Card,
  Container,
  Eyebrow,
  IconBack,
  IconButton,
  IconCaret,
  IconCheck,
  IconEdit,
  IconGrip,
  IconPlus,
  IconRest,
  IconSearch,
  IconTrash,
  Input,
  Muted,
  PageTitle,
  SectionTitle,
  daFieldClass,
  daSelectClass,
} from '../../../components/ui'
import { DESIGN_RULES, DESIGN_TOKENS } from '../../../lib/design/tokens'

const TOC = [
  { id: 'da', label: 'DA active' },
  { id: 'rules', label: 'Règles' },
  { id: 'colors', label: 'Couleurs' },
  { id: 'type', label: 'Typo' },
  { id: 'shape', label: 'Forme' },
  { id: 'buttons', label: 'Boutons' },
  { id: 'forms', label: 'Formulaires' },
  { id: 'surfaces', label: 'Surfaces' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'builder', label: 'Builder' },
  { id: 'folders', label: 'Dossiers' },
  { id: 'icons', label: 'Icônes' },
] as const

function Section({
  id,
  title,
  hint,
  children,
}: {
  id: string
  title: string
  hint?: string
  children: ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-28">
      <SectionTitle>{title}</SectionTitle>
      {hint ? <Muted className="mt-2">{hint}</Muted> : null}
      <div className="mt-6">{children}</div>
    </section>
  )
}

function Swatch({
  name,
  cssVar,
  value,
  usage,
  bordered,
}: {
  name: string
  cssVar: string
  value?: string
  usage: string
  bordered?: boolean
}) {
  return (
    <Card className="overflow-hidden rounded-[var(--radius-lg)] ring-1 ring-[var(--border)]">
      <div
        className={`h-16 w-full ${bordered ? 'ring-1 ring-inset ring-[var(--border)]' : ''}`}
        style={{ background: `var(${cssVar})` }}
      />
      <div className="p-4">
        <div className="text-sm font-extrabold text-[color:var(--fg)]">{name}</div>
        <div className="mt-2 grid gap-1 text-xs text-[color:var(--muted)]">
          <div>
            <span className="font-semibold text-[color:var(--fg)]">Token</span>:{' '}
            <code className="rounded bg-[var(--accent)] px-1">var({cssVar})</code>
          </div>
          {value ? (
            <div>
              <span className="font-semibold text-[color:var(--fg)]">Valeur</span>: <code>{value}</code>
            </div>
          ) : null}
          <div>
            <span className="font-semibold text-[color:var(--fg)]">Usage</span>: {usage}
          </div>
        </div>
      </div>
    </Card>
  )
}

function IconTile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Card className="rounded-[var(--radius-md)] p-5 ring-1 ring-[var(--border)]">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <IconButton label={label} tone="soft">
            {children}
          </IconButton>
          <IconButton label={`${label} solid`} tone="solid">
            {children}
          </IconButton>
        </div>
        <div className="min-w-0">
          <div className="text-sm font-extrabold">{label}</div>
          <div className="mt-0.5 text-xs text-[color:var(--muted)]">IconButton soft · solid</div>
        </div>
      </div>
    </Card>
  )
}

export default function AdminDesignPage() {
  return (
    <main className="bg-da-canvas relative z-0 text-[color:var(--fg)]">
      <Container className="relative z-[2] py-8 md:py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-3xl">
            <Eyebrow>Verrou design system</Eyebrow>
            <PageTitle className="mt-2">Design</PageTitle>
            <Muted className="mt-3">
              Deux DA — le toggle n’affiche que la DA active.{' '}
              <strong className="text-[color:var(--fg)]">Black</strong> : <code>#d6c4e8</code> · carbon · sidebar
              quasi-noir. <strong className="text-[color:var(--fg)]">White</strong> : <code>#9b6bb8</code> · traits soft
              · sidebar gris clair.
            </Muted>
          </div>
          <DesignThemeToggle />
        </div>

        <nav className="mt-6 flex flex-wrap gap-2">
          {TOC.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="rounded-[var(--radius-pill)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--brand)] ring-1 ring-[var(--border)] hover:bg-[var(--accent)]"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="mt-10 grid gap-14">
          <Section id="da" title="DA active" hint="Résumé de la direction artistique du mode sélectionné.">
            <DesignDaSummary />
          </Section>

          <Section id="rules" title="Règles (obligatoires)" hint="Checklist avant d’ouvrir un nouvel écran.">
            <Card className="rounded-[var(--radius-lg)] p-6 ring-1 ring-[var(--border)]">
              <ol className="grid list-decimal gap-3 pl-5 text-sm text-[color:var(--fg)]">
                {DESIGN_RULES.map((rule) => (
                  <li key={rule} className="pl-1 leading-relaxed">
                    {rule}
                  </li>
                ))}
              </ol>
              <p className="mt-5 text-xs text-[color:var(--muted)]">
                Code : <code>src/app/globals.css</code> · <code>src/lib/design/tokens.ts</code> ·{' '}
                <code>@/components/ui</code> · règle <code>design-system.mdc</code>
              </p>
            </Card>
          </Section>

          <Section
            id="colors"
            title="Couleurs"
            hint="La swatch --brand suit le mode actif. Dark = #d6c4e8 · White = #9b6bb8."
          >
            <h3 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-[color:var(--muted)]">Brand</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Swatch name="brand (principal)" cssVar="--brand" usage="Dark #d6c4e8 · White #9b6bb8" />
              <Swatch name="brand-mid" cssVar="--brand-mid" value="#9b6bb8" usage="Secondaire / dégradés" />
              <Swatch name="brand-soft" cssVar="--brand-soft" usage="Dark #e8dff2 · White #d6c4e8" />
              <Swatch name="brand-fg" cssVar="--brand-fg" value="theme" usage="Texte sur brand · black=#1a1a1e · white=#fff" />
            </div>
            <Card className="mt-4 rounded-[var(--radius-lg)] p-4 ring-1 ring-[var(--border)]">
              <p className="text-sm font-extrabold text-[color:var(--fg)]">.on-brand</p>
              <Muted className="mt-1">
                Fond brand + encre <code>--brand-fg</code> — jamais <code>text-white</code> en black mode.
              </Muted>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="on-brand inline-flex rounded-full px-3 py-1.5 text-xs font-bold">
                  Chip on-brand
                </span>
                <span className="inline-flex rounded-full bg-[var(--brand)] px-3 py-1.5 text-xs font-bold text-[var(--brand-fg)]">
                  bg-brand + text-brand-fg
                </span>
              </div>
            </Card>
            <h3 className="mb-3 mt-8 text-sm font-extrabold uppercase tracking-wide text-[color:var(--muted)]">
              Surfaces & texte
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries({ ...DESIGN_TOKENS.surfaces, ...DESIGN_TOKENS.text }).map(([key, t]) => (
                <Swatch
                  key={key}
                  name={key}
                  cssVar={t.css}
                  value={'value' in t && typeof t.value === 'string' ? t.value : undefined}
                  usage={t.usage}
                  bordered={key === 'bg' || key === 'surface' || key === 'pageBg' || key === 'accent'}
                />
              ))}
            </div>
          </Section>

          <Section id="type" title="Typographie" hint="Composants @/components/ui/Typography.">
            <Card className="grid gap-4 rounded-[var(--radius-lg)] p-6 ring-1 ring-[var(--border)]">
              <PageTitle>PageTitle</PageTitle>
              <SectionTitle>SectionTitle</SectionTitle>
              <Body>Body — corps lisible.</Body>
              <Muted>Muted — secondaire / aide.</Muted>
              <Eyebrow>Eyebrow</Eyebrow>
            </Card>
          </Section>

          <Section id="shape" title="Radii & ombres">
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="rounded-[var(--radius-lg)] p-6 ring-1 ring-[var(--border)]">
                <div className="flex flex-wrap items-end gap-3">
                  <div
                    className="flex h-16 w-16 items-center justify-center bg-[var(--brand)] text-xs font-bold text-[var(--brand-fg)]"
                    style={{ borderRadius: 'var(--radius-sm)' }}
                  >
                    sm
                  </div>
                  <div
                    className="flex h-16 w-16 items-center justify-center bg-[var(--brand)] text-xs font-bold text-[var(--brand-fg)]"
                    style={{ borderRadius: 'var(--radius-md)' }}
                  >
                    md
                  </div>
                  <div
                    className="flex h-16 w-20 items-center justify-center bg-[var(--brand)] text-xs font-bold text-[var(--brand-fg)]"
                    style={{ borderRadius: 'var(--radius-lg)' }}
                  >
                    lg
                  </div>
                  <div
                    className="flex h-12 w-24 items-center justify-center bg-[var(--brand)] text-xs font-bold text-[var(--brand-fg)]"
                    style={{ borderRadius: 'var(--radius-pill)' }}
                  >
                    pill
                  </div>
                </div>
                <p className="mt-4 text-xs text-[color:var(--muted)]">
                  Cartes → <code>--radius-lg</code> · inputs → <code>--radius-md</code> · boutons → pill
                </p>
              </Card>
              <Card className="rounded-[var(--radius-lg)] p-6 ring-1 ring-[var(--border)]">
                <div className="grid gap-4">
                  <div className="rounded-[var(--radius-md)] bg-[var(--surface)] p-4 shadow-da-sm ring-1 ring-[var(--border)]">
                    shadow-sm
                  </div>
                  <div className="rounded-[var(--radius-md)] bg-[var(--surface)] p-4 shadow-da-md">
                    shadow-md
                  </div>
                  <div className="rounded-[var(--radius-md)] bg-[var(--brand)] p-4 text-[var(--brand-fg)] shadow-da-brand">
                    shadow-brand
                  </div>
                </div>
              </Card>
            </div>
          </Section>

          <Section
            id="buttons"
            title="Boutons"
            hint="Minimum validé : 2 par mode. Black = mist (CTA) + beam (secondaire). White = cta + secondary."
          >
            <div className="da-only-dark grid gap-4">
              <Eyebrow>Black DA · 2 boutons</Eyebrow>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="mist">
                  Mist · CTA
                </Button>
                <Button type="button" variant="beam">
                  Beam · secondaire
                </Button>
              </div>
              <ul className="grid gap-2 text-xs text-[color:var(--muted)] sm:grid-cols-2">
                <li className="rounded-[var(--radius-md)] bg-[var(--surface)] p-3 ring-1 ring-[var(--border)]">
                  <span className="font-bold text-[#d6c4e8]">mist</span>
                  <p className="mt-1">Action principale (créer, sauver, valider)</p>
                </li>
                <li className="rounded-[var(--radius-md)] bg-[var(--surface)] p-3 ring-1 ring-[var(--border)]">
                  <span className="font-bold text-[#d6c4e8]">beam</span>
                  <p className="mt-1">Action secondaire (annuler, alternatif)</p>
                </li>
              </ul>
            </div>

              <div className="da-only-light grid gap-4">
              <Eyebrow>White DA · 2 boutons</Eyebrow>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="cta">
                  Se connecter
                </Button>
                <Button type="button" variant="secondary">
                  Secondary
                </Button>
              </div>
              <ul className="grid gap-2 text-xs text-[color:var(--muted)] sm:grid-cols-2">
                <li className="rounded-[var(--radius-md)] bg-[var(--surface)] p-3 ring-1 ring-[var(--border)]">
                  <span className="font-bold text-[#9b6bb8]">cta</span>
                  <p className="mt-1">Action principale · dégradé violet marqué</p>
                </li>
                <li className="rounded-[var(--radius-md)] bg-[var(--surface)] p-3 ring-1 ring-[var(--border)]">
                  <span className="font-bold text-[#9b6bb8]">secondary</span>
                  <p className="mt-1">Action secondaire · blanc + ring</p>
                </li>
              </ul>
            </div>

            <div className="mt-8 grid gap-3">
              <Eyebrow>Toolbar compact (builder)</Eyebrow>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" className="!h-8 !rounded-full !px-3 !text-[12px]">
                  <IconPlus size={14} />
                  Séance
                </Button>
                <Button type="button" size="sm" variant="secondary" className="!h-8 !rounded-full !px-3 !text-[12px]">
                  Infos
                </Button>
                <Button type="button" size="sm" className="!h-7 !gap-1.5 !rounded-full !px-3 !text-[11px]">
                  <FluidSpinner size={12} className="text-[var(--brand-fg)]" />
                  Enregistrement…
                </Button>
                <Button type="button" size="sm" variant="ghost">
                  Ghost
                </Button>
                <Button type="button" size="sm" variant="danger">
                  Danger
                </Button>
              </div>
            </div>
          </Section>

          <Section id="forms" title="Formulaires">
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="grid gap-3 rounded-[var(--radius-lg)] p-6 ring-1 ring-[var(--border)]">
                <label className="grid gap-1 text-sm font-semibold text-[var(--brand)]">
                  Email
                  <Input type="email" placeholder="toi@exemple.com" autoComplete="email" />
                </label>
                <label className="grid gap-1 text-sm font-semibold text-[var(--brand)]">
                  Mot de passe
                  <Input type="password" placeholder="••••••••" autoComplete="current-password" />
                </label>
                <Input placeholder="Désactivé" disabled />
              </Card>
              <Card className="grid gap-3 rounded-[var(--radius-lg)] p-6 ring-1 ring-[var(--border)]">
                <p className="text-sm font-extrabold">Builder · daField / daSelect</p>
                <Muted>
                  Champs densifiés Infos / Rx — <code>daFieldClass</code> · <code>daSelectClass</code>.
                </Muted>
                <input className={daFieldClass} placeholder="Titre séance" />
                <select className={daSelectClass} defaultValue="">
                  <option value="" disabled>
                    Unité
                  </option>
                  <option value="reps">Reps</option>
                  <option value="kg">Kg</option>
                </select>
              </Card>
            </div>
          </Section>

          <Section
            id="surfaces"
            title="Surfaces app"
            hint="Black = carbon + sidebar quasi-noir + ombre · White = traits + sidebar #f5f5f7 + ombre intérieure"
          >
            <div className="overflow-hidden rounded-[var(--radius-lg)] ring-1 ring-[var(--border)]">
              <div className="flex min-h-[240px]">
                <div className="app-shell-aside hidden w-44 shrink-0 p-3 sm:block">
                  <div className="mb-3 flex items-center gap-2 px-1">
                    <KridMark size="sm" />
                    <div>
                      <KridWordmark className="!text-[11px]" />
                      <p className="text-xs font-extrabold text-[var(--shell-fg)]">
                        <span className="da-only-dark">Shell dark</span>
                        <span className="da-only-light">Shell light</span>
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-1">
                    <div className="app-shell-nav-link" data-active="true">
                      <span className="app-shell-nav-dot" />
                      Actif
                    </div>
                    <div className="app-shell-nav-link" data-active="false">
                      <span className="app-shell-nav-dot" />
                      Lien
                    </div>
                  </div>
                </div>
                <div className="bg-da-canvas relative z-0 flex-1 overflow-hidden p-4">
                  <div className="relative z-[1]">
                    <p className="text-sm font-extrabold text-[var(--brand)]">Page · canvas DA</p>
                    <div className="mt-3 rounded-[var(--radius-lg)] bg-[var(--surface)] p-4 shadow-da-sm ring-1 ring-[var(--border)]">
                      <p className="text-sm font-bold">Carte · --surface</p>
                      <p className="mt-1 text-xs text-[color:var(--muted)]">Contenu métier</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Section>

          <Section
            id="feedback"
            title="Feedback"
            hint="Bannières / états / conformité programme — toujours ces tokens (pas de hex ad hoc)."
          >
            <div className="grid gap-3">
              <div className="rounded-[var(--radius-md)] border border-[var(--success-border)] bg-[var(--success-bg)] px-4 py-3 text-sm text-[var(--success)]">
                Succès — enregistrement OK
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--warning-border)] bg-[var(--warning-bg)] px-4 py-3 text-sm text-[var(--warning)]">
                Attention — essai bientôt terminé
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger)]">
                Erreur — action impossible
              </div>
            </div>
            <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
              <p className="text-xs font-extrabold uppercase tracking-wide text-[color:var(--muted)]">
                Conformité programme — pastilles
              </p>
              <p className="mt-1 text-[11px] text-[color:var(--muted)]">
                Alias : --status-ok / --status-warn / --status-bad (= success / warning / danger)
              </p>
              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                <span className="inline-flex items-center gap-2 text-[var(--status-ok)]">
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--status-ok)]" /> conforme
                </span>
                <span className="inline-flex items-center gap-2 text-[var(--status-warn)]">
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--status-warn)]" /> adapté
                </span>
                <span className="inline-flex items-center gap-2 text-[var(--status-bad)]">
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--status-bad)]" /> non fait
                </span>
              </div>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Card className="rounded-[var(--radius-lg)] p-4 ring-1 ring-[var(--border)]">
                <p className="text-sm font-extrabold">Soft flash (builder)</p>
                <Muted className="mt-1">Succès discret dans le header — pas de bannière.</Muted>
                <p className="mt-3 truncate text-sm font-bold text-[color:var(--fg)]">
                  Programme sans titre
                  <span className="ml-1.5 text-[10px] font-medium text-[var(--success)]">
                    · Séance enregistrée
                  </span>
                </p>
              </Card>
              <Card className="rounded-[var(--radius-lg)] p-4 ring-1 ring-[var(--border)]">
                <p className="text-sm font-extrabold">FluidSpinner</p>
                <Muted className="mt-1">CTA / overlay — tailles 10 · 12 · 14.</Muted>
                <div className="mt-3 flex items-center gap-4">
                  <FluidSpinner size={10} />
                  <FluidSpinner size={12} />
                  <FluidSpinner size={14} />
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand)] px-3 py-1.5 text-[11px] font-bold text-[var(--brand-fg)]">
                    <FluidSpinner size={12} className="text-[var(--brand-fg)]" />
                    Sauvegarde…
                  </span>
                </div>
              </Card>
            </div>
          </Section>

          <Section
            id="builder"
            title="Builder programme"
            hint="Patterns figés du program builder admin — réutiliser tels quels (fluidité + chrome)."
          >
            <div className="grid gap-6">
              <Card className="relative min-h-[120px] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4">
                <p className="text-sm font-extrabold">Pending board overlay</p>
                <Muted className="mt-1">Zone seule — pas de freeze page entière.</Muted>
                <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--page-bg)] p-6">
                  Contenu board…
                </div>
                <div
                  className="absolute inset-0 z-10 flex items-center justify-center rounded-[var(--radius-lg)] bg-[var(--page-bg)]/55 backdrop-blur-[1px]"
                  aria-hidden
                >
                  <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 shadow-da-sm">
                    <FluidSpinner size={14} />
                    <span className="text-[11px] font-semibold text-[color:var(--muted)]">
                      Sauvegarde…
                    </span>
                  </div>
                </div>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                <Card className="rounded-[var(--radius-lg)] p-4 ring-1 ring-[var(--border)]">
                  <p className="text-sm font-extrabold">Week chips · day pills</p>
                  <div className="da-scrollbar mt-3 flex gap-1.5 overflow-x-auto py-0.5">
                    <span className="shrink-0 rounded-full bg-[var(--brand)] px-2.5 py-1 text-[11px] font-semibold text-[var(--brand-fg)] shadow-da-sm">
                      S1
                    </span>
                    <span className="shrink-0 rounded-full bg-[var(--accent)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--fg)] hover:ring-1 hover:ring-[var(--border)]">
                      S2
                    </span>
                    <span className="shrink-0 rounded-full bg-[var(--accent)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--fg)]">
                      S3
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    <span className="rounded-full bg-[var(--brand)] px-2.5 py-1 text-[11px] font-semibold text-[var(--brand-fg)] shadow-da-sm">
                      Lun
                    </span>
                    <span className="rounded-full bg-[var(--accent)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--fg)]">
                      Mar
                    </span>
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--accent)] text-[color:var(--muted)]">
                      <IconCaret dir="left" />
                    </span>
                    <span className="rounded bg-[var(--accent)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
                      Brouillon
                    </span>
                  </div>
                </Card>

                <Card className="rounded-[var(--radius-lg)] p-4 ring-1 ring-[var(--border)]">
                  <p className="text-sm font-extrabold">Kind badges · filtres</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-[var(--brand)]/20 px-2 py-0.5 text-[10px] font-bold text-[var(--brand)]">
                      Bloc
                    </span>
                    <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-bold text-[color:var(--muted)] ring-1 ring-[var(--border)]">
                      Exo
                    </span>
                    <span className="rounded-full bg-[var(--brand)] px-2.5 py-1 text-[10px] font-semibold text-[var(--brand-fg)]">
                      Force
                    </span>
                    <span className="rounded-full bg-[var(--accent)] px-2.5 py-1 text-[10px] font-semibold text-[color:var(--muted)] ring-1 ring-[var(--border)]">
                      Cardio
                    </span>
                  </div>
                </Card>
              </div>

              <Card className="rounded-[var(--radius-lg)] p-4 ring-1 ring-[var(--border)]">
                <p className="text-sm font-extrabold">Insert marker · grip · repos</p>
                <Muted className="mt-1">
                  Catalogue + reorder composition — même look « Insérer ».
                </Muted>
                <ul className="mt-3 grid gap-2">
                  <CompositionInsertMarker />
                  <li className="flex list-none items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--page-bg)] px-3 py-2">
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 cursor-grab items-center justify-center rounded-[var(--radius-sm)] text-[color:var(--muted)] hover:text-[var(--brand)]"
                      aria-label="Poignée reorder"
                    >
                      <IconGrip size={16} />
                    </button>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">Squat</span>
                    <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-bold text-[color:var(--muted)] ring-1 ring-[var(--border)]">
                      Exo
                    </span>
                  </li>
                  <li className="flex list-none items-center gap-2 rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[var(--page-bg)] px-3 py-2">
                    <IconRest size={14} className="shrink-0 text-[color:var(--muted)]" />
                    <span className="text-[12px] font-semibold text-[color:var(--fg)]">Pause 60s</span>
                  </li>
                </ul>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                <Card className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] bg-[var(--page-bg)] p-4">
                  <p className="text-sm font-extrabold">Drop zone vide</p>
                  <p className="mt-2 text-center text-[13px] text-[color:var(--muted)]">
                    Glisser un bloc / exo ici
                  </p>
                  <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--brand)] bg-[var(--brand)]/15 px-3 py-2 text-center text-[12px] font-semibold text-[var(--brand)]">
                    Survol drop → brand /15
                  </div>
                </Card>
                <Card className="rounded-[var(--radius-lg)] border border-[var(--brand)] bg-[var(--surface)] p-4 shadow-da-md ring-1 ring-[var(--brand)]/40">
                  <p className="text-sm font-extrabold">Jour focus</p>
                  <Muted className="mt-1">
                    <code>data-builder-day-focus</code> · ring brand · shadow-da-md
                  </Muted>
                  <div className="mt-3 flex h-16 items-center justify-center rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[var(--page-bg)] text-[12px] text-[color:var(--muted)] opacity-70">
                    Jour compact dimmé
                  </div>
                </Card>
              </div>

              <Card className="rounded-[var(--radius-lg)] p-4 ring-1 ring-[var(--border)]">
                <p className="text-sm font-extrabold">Chrome click-outside</p>
                <Muted className="mt-1">
                  Zones qui <strong className="text-[color:var(--fg)]">ne</strong> ferment pas le mode
                  jour : <code>data-builder-chrome</code>, catalogue, compact day, pills, dialogs.
                  Top bar / bandeau semaines ferment volontairement.
                </Muted>
              </Card>
            </div>
          </Section>

          <Section
            id="folders"
            title="Dossiers documentation"
            hint="Forme figée admin + coach — DocFolderCard · onglet gauche · feuille peek · hover léger. Dark/light via tokens."
          >
            <Card className="rounded-[var(--radius-lg)] p-4 ring-1 ring-[var(--border)] md:p-6">
              <p className="text-sm font-extrabold text-[color:var(--fg)]">DocFolderCard</p>
              <Muted className="mt-1">
                Composant <code>src/components/documentation/DocFolderCard.tsx</code> · styles{' '}
                <code>.doc-folder-real*</code> dans <code>globals.css</code>. Ne pas réinventer une silhouette
                dossier ailleurs.
              </Muted>
              <div className="mt-5">
                <DocFolderDesignDemo />
              </div>
            </Card>
          </Section>

          <Section
            id="icons"
            title="Icônes"
            hint="IconButton soft/solid · set @/components/ui/icons (extensible)."
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <IconTile label="Plus">
                <IconPlus />
              </IconTile>
              <IconTile label="Retour">
                <IconBack />
              </IconTile>
              <IconTile label="Rechercher">
                <IconSearch />
              </IconTile>
              <IconTile label="Éditer">
                <IconEdit />
              </IconTile>
              <IconTile label="Supprimer">
                <IconTrash />
              </IconTile>
              <IconTile label="Valide">
                <IconCheck />
              </IconTile>
              <IconTile label="Grip">
                <IconGrip />
              </IconTile>
              <IconTile label="Repos">
                <IconRest />
              </IconTile>
            </div>
          </Section>
        </div>

        <Muted className="mt-14 text-center text-xs">
          Migration app : remplacer les hex en dur par tokens + Button/IconButton DA.
        </Muted>
      </Container>
    </main>
  )
}
