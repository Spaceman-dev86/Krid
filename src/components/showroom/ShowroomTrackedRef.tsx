'use client'

import { useEffect } from 'react'

import { trackShowroomRefAction } from '../../lib/tracking/trackActions'

type Props = {
  coachId: string
  refCode: string | null
  /** Conservé pour compat appelants — plus utilisé (plus de modal à l’arrivée). */
  brand?: string
}

/** Tracking silencieux : clic + cookie. Plus de popup leads à l’arrivée. */
export function ShowroomTrackedRef({ coachId, refCode }: Props) {
  useEffect(() => {
    if (!refCode) return
    let cancelled = false
    void trackShowroomRefAction({ coachId, ref: refCode }).then(() => {
      if (cancelled) return
    })
    return () => {
      cancelled = true
    }
  }, [coachId, refCode])

  return null
}
