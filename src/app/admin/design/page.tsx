 import type { ReactNode } from 'react'

import Link from 'next/link'

import { Button, Card, Container, Input } from '../../../components/ui'

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={22}
      height={22}
      aria-hidden
      style={{ display: 'block', overflow: 'visible' }}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  )
}

function IconTile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--brand)]">
            {children}
          </div>
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand)] text-white">
            {children}
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-sm font-extrabold">{label}</div>
          <div className="mt-1 text-xs text-[var(--muted)]">SVG inline</div>
        </div>
      </div>
    </Card>
  )
}

export default function AdminDesignPage() {
  return (
    <main className="bg-transparent text-[var(--text)]">
      <Container className="py-8 md:py-10">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-extrabold tracking-tight text-[var(--brand)]">Design</h1>
          <Link
            href="/admin"
            aria-label="Retour admin"
            title="Retour admin"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand)] text-white"
          >
            <Icon>
              <path d="M15 18l-6-6 6-6" />
            </Icon>
          </Link>
        </div>

        <p className="mt-4 text-sm text-[var(--muted)]">
          Page showroom: tokens + composants UI (Button, Card, Input, Container) + sections.
        </p>

        <section className="mt-8">
          <Card className="rounded-[var(--radius-lg)] p-8 ring-1 ring-[var(--border)]">
            <h2 className="text-lg font-extrabold tracking-tight">Direction artistique</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Style moderne, premium, minimaliste, inspiré fitness / coaching.
            </p>
            <div className="mt-5 grid gap-3 text-sm">
              <div>
                <span className="font-semibold">Ambiance</span>: calme, efficace, haut de gamme
              </div>
              <div>
                <span className="font-semibold">UI</span>: cartes simples, beaucoup d’air, actions en icônes, texte concis
              </div>
              <div>
                <span className="font-semibold">Couleurs</span>: brand (violet) pour les actions et la hiérarchie, accent pour les fonds secondaires
              </div>
              <div>
                <span className="font-semibold">Composants</span>: réutiliser Container/Card/Button/Input + icônes inline ci-dessous
              </div>
            </div>
          </Card>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-extrabold tracking-tight">Boutons</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">Bouton principal violet + variante négative (outline violet).</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button href="#" variant="primary">
              Action primaire
            </Button>
            <Button href="#" variant="secondary">
              Action négative
            </Button>
          </div>
        </section>

        <section id="colors" className="mt-10 scroll-mt-24">
          <h2 className="text-xl font-extrabold tracking-tight">Couleurs (3 couleurs principales)</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Les 3 couleurs de base utilisées partout (brand, accent, surface). Les valeurs viennent des variables CSS.
          </p>

          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <Card className="p-8">
              <div className="h-16 w-full bg-[var(--brand)]" />
              <div className="mt-4 text-sm font-extrabold">Brand</div>
              <div className="mt-1 text-xs text-[var(--muted)]">
                <div>
                  <span className="font-semibold">Token</span>: <code>var(--brand)</code>
                </div>
                <div>
                  <span className="font-semibold">RGB</span>: <code>rgb(52, 28, 68)</code>
                </div>
                <div>
                  <span className="font-semibold">Usage</span>: CTA, liens, icônes, focus
                </div>
              </div>
            </Card>

            <Card className="p-8">
              <div className="h-16 w-full bg-[var(--accent)]" />
              <div className="mt-4 text-sm font-extrabold">Accent</div>
              <div className="mt-1 text-xs text-[var(--muted)]">
                <div>
                  <span className="font-semibold">Token</span>: <code>var(--accent)</code>
                </div>
                <div>
                  <span className="font-semibold">RGB</span>: <code>rgb(245, 245, 245)</code>
                </div>
                <div>
                  <span className="font-semibold">Usage</span>: fonds secondaires, badges, tuiles
                </div>
              </div>
            </Card>

            <Card className="p-8">
              <div className="h-16 w-full bg-[var(--surface)] ring-1 ring-[var(--border)]" />
              <div className="mt-4 text-sm font-extrabold">Surface</div>
              <div className="mt-1 text-xs text-[var(--muted)]">
                <div>
                  <span className="font-semibold">Token</span>: <code>var(--surface)</code>
                </div>
                <div>
                  <span className="font-semibold">RGB</span>: <code>rgb(255, 255, 255)</code>
                </div>
                <div>
                  <span className="font-semibold">Usage</span>: cartes, inputs, panneaux
                </div>
              </div>
            </Card>
          </div>
        </section>

        <section id="icons" className="mt-14 scroll-mt-24">
          <h2 className="text-xl font-extrabold tracking-tight">Icônes (liste)</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">Icônes inline (SVG). À réutiliser dans les pages Admin.</p>

          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <IconTile label="Plus">
              <Icon>
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </Icon>
            </IconTile>
            <IconTile label="Retour">
              <Icon>
                <path d="M15 18l-6-6 6-6" />
              </Icon>
            </IconTile>
            <IconTile label="Dupliquer">
              <Icon>
                <rect x="9" y="9" width="11" height="11" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </Icon>
            </IconTile>
            <IconTile label="Rechercher">
              <Icon>
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </Icon>
            </IconTile>
            <IconTile label="Filtrer">
              <Icon>
                <path d="M4 6h16" />
                <path d="M7 12h10" />
                <path d="M10 18h4" />
              </Icon>
            </IconTile>
            <IconTile label="Éditer">
              <Icon>
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
              </Icon>
            </IconTile>
            <IconTile label="Supprimer">
              <Icon>
                <path d="M3 6h18" />
                <path d="M8 6V4h8v2" />
                <path d="M19 6l-1 14H6L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
              </Icon>
            </IconTile>
            <IconTile label="Note">
              <Icon>
                <path d="M7 3h10a2 2 0 0 1 2 2v16H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
                <path d="M9 7h6" />
                <path d="M9 11h6" />
                <path d="M9 15h5" />
                <path d="M8 3v18" />
              </Icon>
            </IconTile>
            <IconTile label="Valide">
              <Icon>
                <path d="M20 6L9 17l-5-5" />
              </Icon>
            </IconTile>
            <IconTile label="Note validé">
              <Icon>
                <g transform="translate(-1 1)">
                  <path d="M7 3h10a2 2 0 0 1 2 2v16H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
                  <path d="M9 7h6" />
                  <path d="M9 11h6" />
                  <path d="M9 15h5" />
                  <path d="M8 3v18" />
                </g>
                <circle cx="22" cy="2.5" r="5" />
                <path d="M19.9 2.7l1.8 1.8 4.2-4.6" />
              </Icon>
            </IconTile>
            <IconTile label="Stats">
              <Icon>
                <path d="M4 20V10" />
                <path d="M10 20V4" />
                <path d="M16 20v-8" />
                <path d="M22 20H2" />
              </Icon>
            </IconTile>
            <IconTile label="Réglages">
              <Icon>
                <path d="M4 6h10" />
                <path d="M18 6h2" />
                <path d="M14 6v0" />
                <path d="M4 12h2" />
                <path d="M10 12h10" />
                <path d="M6 12v0" />
                <path d="M4 18h8" />
                <path d="M16 18h4" />
                <path d="M12 18v0" />
                <circle cx="14" cy="6" r="2" />
                <circle cx="8" cy="12" r="2" />
                <circle cx="14" cy="18" r="2" />
              </Icon>
            </IconTile>
            <IconTile label="Profil">
              <Icon>
                <path d="M20 21a8 8 0 1 0-16 0" />
                <path d="M12 13a4 4 0 1 0-4-4 4 4 0 0 0 4 4z" />
              </Icon>
            </IconTile>
            <IconTile label="Instagram">
              <Icon>
                <rect x="6" y="6" width="12" height="12" rx="3" />
                <circle cx="12" cy="12" r="3" />
                <circle cx="16" cy="8" r="0.8" />
              </Icon>
            </IconTile>
            <IconTile label="Connexion / Déconnexion">
              <Icon>
                <path d="M20 21a8 8 0 1 0-16 0" />
                <path d="M12 13a4 4 0 1 0-4-4 4 4 0 0 0 4 4z" />
              </Icon>
            </IconTile>
          </div>
        </section>

        <section id="inputs" className="mt-14 scroll-mt-24">
          <h2 className="text-xl font-extrabold tracking-tight">Inputs (placeholders)</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">Exemples de champs qu’on retrouve souvent sur les sites.</p>

          <div className="mt-8 grid gap-8 md:grid-cols-2">
            <Card className="p-8">
              <div className="grid gap-4">
                <div className="text-sm font-extrabold">Recherche</div>
                <Input placeholder="Rechercher un exercice..." />
                <Input placeholder="Rechercher un programme..." />
              </div>
            </Card>
            <Card className="p-8">
              <div className="grid gap-4">
                <div className="text-sm font-extrabold">Compte</div>
                <Input type="email" placeholder="Email" autoComplete="email" />
                <Input type="password" placeholder="Mot de passe" autoComplete="current-password" />
              </div>
            </Card>
            <Card className="p-8">
              <div className="grid gap-4">
                <div className="text-sm font-extrabold">Contact</div>
                <Input placeholder="Prénom" autoComplete="given-name" />
                <Input placeholder="Nom" autoComplete="family-name" />
                <Input type="tel" placeholder="Téléphone" autoComplete="tel" />
              </div>
            </Card>
            <Card className="p-8">
              <div className="grid gap-4">
                <div className="text-sm font-extrabold">Divers</div>
                <Input type="url" placeholder="Lien (https://...)" />
                <Input placeholder="Code promo" />
                <Input placeholder="Désactivé" disabled />
              </div>
            </Card>
          </div>
        </section>

        <section id="tokens" className="mt-14 scroll-mt-24">
          <h2 className="text-xl font-extrabold tracking-tight">Tokens (référence)</h2>
          <Card className="mt-4 p-6">
            <div className="grid gap-3 text-sm">
              <div>
                <span className="font-semibold">brand</span>: <code>var(--brand)</code>
              </div>
              <div>
                <span className="font-semibold">bg</span>: <code>var(--bg)</code>
              </div>
              <div>
                <span className="font-semibold">accent</span>: <code>var(--accent)</code>
              </div>
              <div>
                <span className="font-semibold">radius</span>: <code>--radius-sm/md/lg</code>
              </div>
              <div>
                <span className="font-semibold">shadow</span>: <code>--shadow-sm/md</code>
              </div>
            </div>
          </Card>
        </section>
      </Container>
    </main>
  )
}
