'use client'

import { useEffect, useRef, useState } from 'react'

import { Container, SectionHeading } from './index'

export type CoachingToolItem = {
  title: string
  side: 'left' | 'right'
  device: 'laptop' | 'phone'
  mockupUrl: string | null
}

type Props = {
  coachTools: CoachingToolItem[]
  clientTools: CoachingToolItem[]
}

function useReveal(delayMs = 0) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        window.setTimeout(() => setVisible(true), delayMs)
        observer.disconnect()
      },
      { threshold: 0.18, rootMargin: '0px 0px -6% 0px' }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [delayMs])

  return { ref, visible }
}

function TimelineFadeDots(props: { direction: 'to-dots' | 'from-dots'; className?: string }) {
  const sizes = props.direction === 'to-dots' ? [10, 8, 6, 4, 2] : [2, 4, 6, 8, 10]

  return (
    <div
      className={[
        'pointer-events-none absolute left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2',
        props.direction === 'to-dots' ? 'bottom-0' : 'top-0',
        props.className ?? '',
      ].join(' ')}
      aria-hidden
    >
      {sizes.map((size, index) => (
        <div
          key={`${props.direction}-${index}`}
          className="rounded-full bg-gradient-to-b from-[#d6c4e8] via-[#9b6bb8] to-[#341c44]"
          style={{
            width: size,
            height: size,
            opacity: props.direction === 'to-dots' ? 1 - index * 0.16 : 0.28 + index * 0.16,
          }}
        />
      ))}
    </div>
  )
}

function TimelineLine(props: { className?: string }) {
  return (
    <div
      className={[
        'pointer-events-none absolute left-1/2 z-0 w-px -translate-x-1/2 bg-gradient-to-b from-[#d6c4e8] via-[#9b6bb8] to-[#341c44]',
        props.className ?? '',
      ].join(' ')}
      aria-hidden
    />
  )
}

function DeviceMockup(props: { item: CoachingToolItem; visible: boolean }) {
  const { item, visible } = props

  if (!item.mockupUrl) {
    return (
      <div className="grid h-44 place-items-center text-xs font-semibold text-[#341c44]/50">
        {item.title}
      </div>
    )
  }

  return (
    <div
      className={[
        'tools-mockup-float',
        item.device === 'phone' ? 'mx-auto max-w-[220px]' : 'w-full',
        visible ? 'tools-reveal-visible' : 'tools-reveal-hidden',
      ].join(' ')}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.mockupUrl} alt={item.title} className="h-auto w-full object-contain" loading="lazy" />
    </div>
  )
}

function TimelineItemContent(props: { item: CoachingToolItem; visible: boolean }) {
  const { item, visible } = props
  const fromLeft = item.side === 'left'

  return (
    <div
      className={[
        visible ? (fromLeft ? 'tools-slide-in-left' : 'tools-slide-in-right') : 'tools-slide-out',
      ].join(' ')}
    >
      <h3 className="border-t border-black/10 pt-4 text-lg font-extrabold text-[#341c44] sm:text-xl">
        {item.title}
      </h3>
      <div className="mt-4">
        <DeviceMockup item={item} visible={visible} />
      </div>
    </div>
  )
}

function TimelineItemRow(props: { item: CoachingToolItem; index: number }) {
  const { item, index } = props
  const { ref, visible } = useReveal(index * 110)
  const fromLeft = item.side === 'left'

  return (
    <div
      ref={ref}
      className="relative grid grid-cols-1 py-8 md:grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)] md:grid-rows-[auto_auto] md:gap-y-4 md:py-12"
    >
      <div className="md:hidden">
        <TimelineItemContent item={item} visible={visible} />
      </div>

      <div
        className={[
          'hidden min-w-0 md:row-start-1 md:block',
          fromLeft ? 'md:col-start-1 md:pr-4' : 'md:col-start-3 md:pl-4',
        ].join(' ')}
      >
        <h3 className="border-t border-black/10 pt-4 text-lg font-extrabold text-[#341c44] sm:text-xl">
          {item.title}
        </h3>
      </div>

      <div
        className={[
          'hidden min-w-0 md:row-start-2 md:block',
          fromLeft ? 'md:col-start-1 md:pr-4' : 'md:col-start-3 md:pl-4',
          visible ? (fromLeft ? 'tools-slide-in-left' : 'tools-slide-in-right') : 'tools-slide-out',
        ].join(' ')}
      >
        <DeviceMockup item={item} visible={visible} />
      </div>

      <div className="relative z-10 hidden md:col-start-2 md:row-start-2 md:flex md:items-center md:justify-center md:self-stretch">
        <div
          className={[
            'h-3.5 w-3.5 shrink-0 rounded-full bg-gradient-to-br from-[#d6c4e8] to-[#341c44] shadow-[0_0_0_6px_rgba(255,255,255,1)] transition-all duration-700',
            visible ? 'scale-100 opacity-100' : 'scale-50 opacity-0',
          ].join(' ')}
        />
      </div>
    </div>
  )
}

function TimelineDivider() {
  const { ref, visible } = useReveal(0)

  return (
    <div ref={ref} className="relative z-20 py-10 md:py-14">
      <div
        className={[
          'relative mx-auto max-w-3xl px-4 text-center transition-all duration-700',
          visible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0',
        ].join(' ')}
      >
        <div className="relative inline-block max-w-full rounded-[2rem] bg-white px-6 py-8 shadow-[0_18px_48px_rgba(52,28,68,0.08)] ring-1 ring-black/10 sm:px-10 sm:py-10">
          <h3 className="text-3xl font-extrabold tracking-tight text-[#9b6bb8] sm:text-4xl md:text-5xl">
            Adapté pour tes clients
          </h3>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-black/60 sm:text-base">
            Une expérience mobile fluide et engageante pour suivre les programmes, consulter les exercices et
            échanger avec toi en temps réel.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function CoachingToolsTimelineSectionClient(props: Props) {
  const { coachTools, clientTools } = props
  const { ref: headingRef, visible: headingVisible } = useReveal(0)

  return (
    <section className="overflow-hidden bg-white">
      <Container className="py-10 md:py-14">
        <div
          ref={headingRef}
          className={[
            'transition-all duration-700',
            headingVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0',
          ].join(' ')}
        >
          <SectionHeading
            eyebrow="Outils"
            eyebrowClassName="text-[#341c44]"
            title="Des outils de coaching déjà prêts"
            subtitle="Une suite complète pour piloter ton activité côté coach, puis une expérience mobile pensée pour tes clients."
          />
        </div>

        <div className="relative mt-8 md:mt-12">
          <div className="relative pb-10 md:pb-14">
            <TimelineLine className="top-0 bottom-10 hidden md:block" />
            <TimelineFadeDots direction="to-dots" className="bottom-0" />

            {coachTools.map((item, index) => (
              <TimelineItemRow key={item.title} item={item} index={index} />
            ))}
          </div>

          <TimelineDivider />

          <div className="relative pt-10 md:pt-14">
            <TimelineFadeDots direction="from-dots" className="top-0" />
            <TimelineLine className="top-10 bottom-0 hidden md:block" />

            {clientTools.map((item, index) => (
              <TimelineItemRow key={item.title} item={item} index={index} />
            ))}
          </div>
        </div>
      </Container>
    </section>
  )
}
