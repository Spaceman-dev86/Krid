'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'

export type ModuleMockups = {
  programs: string | null
  library: string | null
  nutrition: string | null
  gamification: string | null
  chat: string | null
  rdv: string | null
}

type ModuleId = keyof ModuleMockups

type ModuleCardIconPair = {
  default: string | null
  active: string | null
}

type ModuleCardIcons = Record<ModuleId, ModuleCardIconPair>

type ModuleCard = {
  id: ModuleId
  title: string
  desc: string
  icon: ReactNode
  column: 'left' | 'right'
}

const MODULE_ACCENT = 'from-violet-500/20 to-[#341c44]/10'
const MODULE_COLUMN_HEIGHT_CLASS = 'h-[300px] sm:h-[380px] lg:h-[420px] xl:h-[450px]'
const MODULE_CTA_GRADIENT = 'bg-gradient-to-r from-[#d6c4e8] via-[#9b6bb8] to-[#341c44]'

type Props = {
  programmePhotoUrl: string | null
  mockups: ModuleMockups
  moduleCardIcons: ModuleCardIcons
}

type MockupSide = 'left' | 'right' | null

function ModuleIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={22}
      height={22}
      aria-hidden
      className="block shrink-0"
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

const modules: ModuleCard[] = [
  {
    id: 'programs',
    column: 'left',
    title: 'Création de programmes',
    desc: 'Structure tes semaines et séances en quelques clics, avec un rendu pro pour tes clients.',
    icon: (
      <ModuleIcon>
        <path d="M7 6h14M7 12h14M7 18h14" />
        <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" strokeWidth={4} />
      </ModuleIcon>
    ),
  },
  {
    id: 'library',
    column: 'left',
    title: 'Bibliothèque d’exercices',
    desc: 'Centralise ton catalogue, réutilise tes contenus et scale sans perdre en qualité.',
    icon: (
      <ModuleIcon>
        <path d="M5 5.5C5 4.12 6.12 3 7.5 3H20v18H7.5C6.12 21 5 19.88 5 18.5V5.5Z" />
        <path d="M8 7h8M8 11h8" />
      </ModuleIcon>
    ),
  },
  {
    id: 'nutrition',
    column: 'left',
    title: 'Nutrition',
    desc: 'Accompagne les habitudes alimentaires et relie nutrition et performance.',
    icon: (
      <ModuleIcon>
        <path d="M12 21c-4.97 0-9-4.03-9-9 0-4.4 3.15-8.06 7.32-8.83.37-.07.68.25.63.62C10.63 5.9 12.74 8 15.3 8c1.25 0 2.39-.5 3.22-1.32.27-.27.73-.19.86.16.4 1.02.62 2.13.62 3.28 0 4.97-4.03 11.88-8 11.88Z" />
      </ModuleIcon>
    ),
  },
  {
    id: 'gamification',
    column: 'right',
    title: 'Gamification',
    desc: 'Progression, challenges et récompenses pour fidéliser et motiver sur la durée.',
    icon: (
      <ModuleIcon>
        <path d="M8 21h8M12 17v4" />
        <path d="M7 3h10v4a5 5 0 0 1-5 5 5 5 0 0 1-5-5V3Z" />
      </ModuleIcon>
    ),
  },
  {
    id: 'chat',
    column: 'right',
    title: 'Chat client',
    desc: 'Reste proche de tes athlètes avec une messagerie intégrée, simple et réactive.',
    icon: (
      <ModuleIcon>
        <path d="M21 12a8 8 0 0 1-8 8H8l-5 1 1.2-4.8A8 8 0 1 1 21 12Z" />
      </ModuleIcon>
    ),
  },
  {
    id: 'rdv',
    column: 'right',
    title: 'Gestion RDV',
    desc: 'Organise tes créneaux, confirme les séances et garde le contrôle de ton planning.',
    icon: (
      <ModuleIcon>
        <path d="M7 3v3M17 3v3M4 8h16" />
        <path d="M6 6h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" />
      </ModuleIcon>
    ),
  },
]

const leftModules = modules.filter((m) => m.column === 'left')
const rightModules = modules.filter((m) => m.column === 'right')

function ModuleImageIcon({
  defaultUrl,
  activeUrl,
  active,
  alt,
}: {
  defaultUrl: string
  activeUrl: string
  active: boolean
  alt: string
}) {
  return (
    <img
      src={active ? activeUrl : defaultUrl}
      alt={alt}
      className="h-5 w-5 object-contain lg:h-6 lg:w-6"
      loading="eager"
    />
  )
}

function ModuleCardButton({
  module: m,
  active,
  visible,
  delayMs,
  onEnter,
  moduleCardIcons,
}: {
  module: ModuleCard
  active: boolean
  visible: boolean
  delayMs: number
  onEnter: (id: ModuleId) => void
  moduleCardIcons: ModuleCardIcons
}) {
  const cardIcons = moduleCardIcons[m.id]
  const hasImageIcons = Boolean(cardIcons?.default && cardIcons?.active)
  return (
    <article
      onMouseEnter={() => onEnter(m.id)}
      onFocus={() => onEnter(m.id)}
      tabIndex={0}
      className={[
        'group relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-white p-3.5 ring-1 transition-all duration-500 ease-out sm:p-4',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#341c44]',
        active
          ? 'scale-[1.02] shadow-lg ring-[#341c44]/30'
          : 'shadow-sm ring-black/5 hover:shadow-md hover:ring-[#341c44]/15',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0',
      ].join(' ')}
      style={{ transitionDelay: visible ? `${delayMs}ms` : '0ms' }}
    >
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${MODULE_ACCENT} opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-focus-visible:opacity-100 ${active ? 'opacity-100' : ''}`}
        aria-hidden
      />
      <div className="relative flex flex-1 items-start gap-3">
        <div
          className={[
            'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition-all duration-300 lg:h-11 lg:w-11',
            active
              ? 'bg-[#9b6bb8] text-white shadow-md'
              : 'bg-[#341c44]/8 text-[#341c44] group-hover:bg-[#9b6bb8] group-hover:text-white',
          ].join(' ')}
        >
          {hasImageIcons ? (
            <ModuleImageIcon
              defaultUrl={cardIcons.default!}
              activeUrl={cardIcons.active!}
              active={active}
              alt=""
            />
          ) : (
            m.icon
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-extrabold leading-snug text-[#341c44]">{m.title}</h3>
          <p className="mt-1 line-clamp-2 text-xs leading-snug text-black/60 sm:text-sm">{m.desc}</p>
        </div>
      </div>
      <div
        className={[
          'relative mt-auto h-0.5 w-full rounded-full bg-gradient-to-r from-violet-500/40 via-[#9b6bb8] to-[#341c44] transition-transform duration-500',
          active ? 'scale-x-100' : 'origin-left scale-x-0 group-hover:scale-x-100',
        ].join(' ')}
        aria-hidden
      />
    </article>
  )
}

function MockupPanel({
  title,
  imageUrl,
  enterFrom,
}: {
  title: string
  imageUrl: string
  enterFrom: 'left' | 'right'
}) {
  return (
    <div
      className={[
        'module-mockup-panel absolute inset-0 flex items-center justify-center',
        enterFrom === 'right' ? 'module-mockup-from-right' : 'module-mockup-from-left',
      ].join(' ')}
    >
      <img
        src={imageUrl}
        alt={`Aperçu ${title}`}
        className="module-mockup-float h-full w-full object-contain"
        loading="eager"
      />
    </div>
  )
}

function ModuleColumn({
  side,
  cards,
  visible,
  activeId,
  mockupSide,
  mockups,
  onCardEnter,
  moduleCardIcons,
}: {
  side: 'left' | 'right'
  cards: ModuleCard[]
  visible: boolean
  activeId: ModuleId | null
  mockupSide: MockupSide
  mockups: ModuleMockups
  onCardEnter: (id: ModuleId) => void
  moduleCardIcons: ModuleCardIcons
}) {
  const showMockupHere = mockupSide === side
  const activeModule = activeId ? modules.find((m) => m.id === activeId) ?? null : null
  const mockupUrl = activeId ? mockups[activeId] : null
  const cardsHidden = showMockupHere

  const cardsExitClass =
    side === 'left' ? 'module-cards-exit-left' : 'module-cards-exit-right'

  return (
    <div className={['relative', MODULE_COLUMN_HEIGHT_CLASS].join(' ')}>
      <div
        className={[
          'flex h-full flex-col gap-3.5 transition-all duration-500 ease-out sm:gap-4 lg:gap-5',
          cardsHidden ? `pointer-events-none absolute inset-0 ${cardsExitClass}` : 'relative opacity-100',
        ].join(' ')}
        aria-hidden={cardsHidden}
      >
        {cards.map((m, idx) => (
          <ModuleCardButton
            key={m.id}
            module={m}
            active={activeId === m.id}
            visible={visible}
            delayMs={120 + idx * 70}
            onEnter={onCardEnter}
            moduleCardIcons={moduleCardIcons}
          />
        ))}
      </div>

      {showMockupHere && mockupUrl && activeModule ? (
        <MockupPanel
          key={activeId}
          title={activeModule.title}
          imageUrl={mockupUrl}
          enterFrom={side === 'left' ? 'right' : 'left'}
        />
      ) : null}
    </div>
  )
}

export default function ReadyModulesSectionClient({ programmePhotoUrl, mockups, moduleCardIcons }: Props) {
  const [visible, setVisible] = useState(false)
  const [activeId, setActiveId] = useState<ModuleId | null>(null)
  const [mockupSide, setMockupSide] = useState<MockupSide>(null)

  useEffect(() => {
    const t = window.setTimeout(() => setVisible(true), 80)
    return () => window.clearTimeout(t)
  }, [])

  useEffect(() => {
    Object.values(mockups).forEach((url) => {
      if (!url) return
      const img = new Image()
      img.src = url
    })
    if (programmePhotoUrl) {
      const img = new Image()
      img.src = programmePhotoUrl
    }
    Object.values(moduleCardIcons).forEach((pair) => {
      if (pair.default) {
        const img = new Image()
        img.src = pair.default
      }
      if (pair.active) {
        const img = new Image()
        img.src = pair.active
      }
    })
  }, [mockups, programmePhotoUrl, moduleCardIcons])

  function handleCardEnter(id: ModuleId) {
    const mod = modules.find((m) => m.id === id)
    if (!mod) return
    setActiveId(id)
    setMockupSide(mod.column === 'right' ? 'left' : 'right')
  }

  function handleSectionLeave() {
    setActiveId(null)
    setMockupSide(null)
  }

  return (
    <section className="relative overflow-hidden bg-[var(--bg)]">
      <div className="lg:grid lg:min-h-[min(100vh,920px)] lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-stretch">
        <div
          className={[
            'relative min-h-[44vh] w-full overflow-hidden lg:min-h-0 lg:h-full',
            'transition-opacity duration-700 ease-out',
            visible ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
        >
          {programmePhotoUrl ? (
            <img
              src={programmePhotoUrl}
              alt="Coach présentant son application de coaching"
              className="module-photo-float absolute inset-0 h-full w-full object-cover object-top"
              loading="eager"
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center bg-[var(--accent)] text-sm font-semibold text-[var(--brand)]">
              programme_photo.png
            </div>
          )}
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent lg:bg-gradient-to-r lg:from-transparent lg:to-[var(--bg)]/50"
            aria-hidden
          />
          <div className="module-badge-float absolute right-4 top-6 rounded-2xl bg-[#341c44] px-3 py-2 text-xs font-extrabold text-white shadow-lg lg:left-6 lg:right-auto">
            Clé en main
          </div>
          <div className="module-badge-float-delayed absolute bottom-8 left-4 rounded-2xl bg-white/95 px-3 py-2 text-xs font-extrabold text-[#341c44] shadow-md backdrop-blur-sm">
            +6 modules
          </div>
        </div>

        <div className="relative flex flex-col px-4 py-10 md:px-8 md:py-12 lg:px-8 lg:py-10 xl:px-10">
          <div
            className={[
              'relative mb-8 lg:mb-6',
              'transition-all duration-700 ease-out',
              visible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0',
            ].join(' ')}
          >
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#341c44]">Modules</p>
            <h2 className="mt-2 max-w-2xl text-2xl font-extrabold tracking-tight text-[#9b6bb8] md:text-3xl">
              Des modules clés en main pour ton application
            </h2>
            <p className="mt-3 max-w-xl text-sm text-[color:var(--muted)] md:text-base">
              Des modules pros et personnalisables pour lancer ton application rapidement.
            </p>
          </div>

          <div
            className="relative grid min-h-0 flex-1 items-stretch gap-4 sm:grid-cols-2 sm:gap-5 lg:gap-6"
            onMouseLeave={handleSectionLeave}
          >
            <ModuleColumn
              side="left"
              cards={leftModules}
              visible={visible}
              activeId={activeId}
              mockupSide={mockupSide}
              mockups={mockups}
              onCardEnter={handleCardEnter}
              moduleCardIcons={moduleCardIcons}
            />
            <ModuleColumn
              side="right"
              cards={rightModules}
              visible={visible}
              activeId={activeId}
              mockupSide={mockupSide}
              mockups={mockups}
              onCardEnter={handleCardEnter}
              moduleCardIcons={moduleCardIcons}
            />
          </div>

          <div
            className={[
              'mt-6 flex justify-center lg:mt-7',
              'transition-all duration-700 ease-out delay-150',
              visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
            ].join(' ')}
          >
            <Link
              href="/login"
              className={`inline-flex items-center justify-center rounded-full px-7 py-3 text-sm font-extrabold text-white shadow-[0_8px_24px_rgba(52,28,68,0.22)] transition hover:opacity-95 hover:shadow-[0_10px_28px_rgba(52,28,68,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#341c44] focus-visible:ring-offset-2 sm:px-8 sm:py-3.5 sm:text-base ${MODULE_CTA_GRADIENT}`}
            >
              Tester les modules
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
