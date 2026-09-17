import type { ReactNode } from 'react'

import { DesignDaSummary, DesignThemeToggle } from '../../../components/design/ThemeToggle'
import {
  Body,
  Button,
  Card,
  Container,
  Eyebrow,
  IconBack,
  IconButton,
  IconCheck,
  IconEdit,
  IconPlus,
  IconSearch,
  IconTrash,
  Input,
  Muted,
  PageTitle,
  SectionTitle,
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
                <p className="text-sm font-extrabold">Pattern label</p>
                <Muted>Label font-semibold brand · input h-14 · focus ring brand.</Muted>
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
                    <div className="app-shell-brand-mark h-7 w-7 rounded-[var(--radius-sm)]" />
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--shell-muted)]">
                        Trainly
                      </p>
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

          <Section id="feedback" title="Feedback" hint="Bannières / états — toujours ces tokens.">
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
