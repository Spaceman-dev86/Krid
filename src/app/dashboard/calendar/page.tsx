import { redirect } from 'next/navigation'

import { Container } from '../../../components/marketing'
import { createClient } from '../../../lib/supabase/server'
import CalendarClient from './CalendarClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

type ClientRow = {
  id: string
  full_name: string
}

type CalendarEventRow = {
  id: string
  owner_coach_id: string | null
  client_id: string | null
  title: string
  start_at: string
  end_at: string | null
  notes: string | null
}

function localDateTimeToIso(date: string, time: string) {
  const [y, m, d] = date.split('-').map((x) => Number(x))
  const [hh, mm] = time.split(':').map((x) => Number(x))
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0)
  return dt.toISOString()
}

function addMinutesIso(iso: string, minutes: number) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Date(d.getTime() + minutes * 60 * 1000).toISOString()
}

export default async function DashboardCalendarPage(props: PageProps) {
  const sp = await props.searchParams

  const monthRaw = typeof sp.month === 'string' ? sp.month : undefined
  const openRaw = typeof sp.open === 'string' ? sp.open : undefined
  const clientIdRaw = typeof sp.clientId === 'string' ? sp.clientId : undefined

  const initialMonthIso = (() => {
    if (!monthRaw) return new Date().toISOString()
    const d = new Date(monthRaw)
    if (Number.isNaN(d.getTime())) return new Date().toISOString()
    return d.toISOString()
  })()

  const initialOpen = openRaw === '1'
  const initialClientId = clientIdRaw && clientIdRaw.length > 0 ? clientIdRaw : null

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: clientsRaw, error: clientsErr } = await supabase
    .from('demo_clients')
    .select('id,full_name')
    .order('created_at', { ascending: true })

  if (clientsErr) {
    redirect(`/dashboard?error=${encodeURIComponent(clientsErr.message)}`)
  }

  const { data: eventsRaw, error: eventsErr } = await supabase
    .from('calendar_events')
    .select('id,owner_coach_id,client_id,title,start_at,end_at,notes')
    .order('start_at', { ascending: true })

  if (eventsErr) {
    redirect(`/dashboard?error=${encodeURIComponent(eventsErr.message)}`)
  }

  const clients = (clientsRaw ?? []) as unknown as ClientRow[]
  const initialEvents = (eventsRaw ?? []) as unknown as CalendarEventRow[]

  async function createSession(formData: FormData) {
    'use server'

    const clientId = String(formData.get('client_id') ?? '').trim()
    const date = String(formData.get('date') ?? '').trim()
    const time = String(formData.get('time') ?? '').trim()
    const durationMin = Number(String(formData.get('duration_min') ?? '60'))
    const notes = String(formData.get('notes') ?? '').trim()

    if (!clientId || !date || !time || !Number.isFinite(durationMin) || durationMin <= 0) return

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const startAt = localDateTimeToIso(date, time)
    const endAt = addMinutesIso(startAt, durationMin)

    const { data: clientRowRaw, error: clientErr } = await supabase
      .from('demo_clients')
      .select('id,full_name')
      .eq('id', clientId)
      .maybeSingle()

    const clientRow = clientRowRaw as unknown as ClientRow | null

    if (clientErr || !clientRow) {
      redirect(`/dashboard/calendar?error=${encodeURIComponent(clientErr?.message ?? 'Client introuvable')}`)
    }

    const title = `Séance présentiel — ${clientRow.full_name}`

    const calendarInsert = (
      supabase as unknown as {
        from: (
          table: string
        ) => {
          insert: (values: unknown) => Promise<{ error: { message: string } | null }>
        }
      }
    ).from('calendar_events')

    const { error: insertEventErr } = await calendarInsert.insert({
      owner_coach_id: user.id,
      client_id: clientId,
      type: 'in_person',
      title,
      start_at: startAt,
      end_at: endAt,
      notes: notes.length > 0 ? notes : null,
    })

    if (insertEventErr) {
      redirect(`/dashboard/calendar?error=${encodeURIComponent(insertEventErr.message)}`)
    }

    const { data: convRowRaw, error: convErr } = await supabase
      .from('demo_conversations')
      .select('id')
      .eq('client_id', clientId)
      .maybeSingle()

    const convRow = convRowRaw as unknown as { id: string } | null

    if (convErr || !convRow) {
      return
    }

    const hh = time.split(':')[0] ?? ''
    const mm = time.split(':')[1] ?? ''
    const prettyDate = `${date.split('-')[2] ?? ''}/${date.split('-')[1] ?? ''}/${date.split('-')[0] ?? ''}`
    const prettyDuration = `${durationMin} min`
    const body = `📅 Demande de séance : ${prettyDate} à ${hh}:${mm} (${prettyDuration}).${notes.length > 0 ? ` Note : ${notes}` : ''}`

    const demoMessagesInsert = (
      supabase as unknown as {
        from: (
          table: string
        ) => {
          insert: (values: unknown) => Promise<{ error: { message: string } | null }>
        }
      }
    ).from('demo_messages')

    await demoMessagesInsert.insert({
      conversation_id: convRow.id,
      owner_coach_id: user.id,
      sender: 'system',
      body,
    })

    return
  }

  async function deleteSession(formData: FormData) {
    'use server'

    const id = String(formData.get('id') ?? '').trim()
    if (!id) return

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { error } = await supabase.from('calendar_events').delete().eq('id', id).eq('owner_coach_id', user.id)
    if (error) {
      return
    }
  }

  return (
    <main className="min-h-screen bg-white">
      <Container className="py-6 sm:py-10">
        <CalendarClient
          clients={clients}
          initialEvents={initialEvents}
          createSessionAction={createSession}
          deleteSessionAction={deleteSession}
          currentUserId={user.id}
          initialMonthIso={initialMonthIso}
          initialOpen={initialOpen}
          initialClientId={initialClientId}
        />
      </Container>
    </main>
  )
}
