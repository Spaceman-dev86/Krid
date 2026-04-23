'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'

type Props = {
  initialTitle: string
  readOnly: boolean
  updateProgramTitleAction: (formData: FormData) => Promise<void>
}

export default function EditableProgramTitleClient(props: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const lastClickAtRef = useRef<number | null>(null)

  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(props.initialTitle)

  const displayTitle = String(value ?? '').trim() === '' ? 'Programme' : value

  if (props.readOnly) {
    return (
      <h1
        style={{
          fontSize: 24,
          fontWeight: 700,
          margin: 0,
          color: 'rgb(52, 28, 68)',
          maxWidth: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {displayTitle}
      </h1>
    )
  }

  async function commit(nextTitleBase: string) {
    const next = nextTitleBase.trim()
    setValue(next)

    const fd = new FormData()
    fd.set('title', next)
    fd.set('client', '1')

    await props.updateProgramTitleAction(fd)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0, maxWidth: '100%' }}>
      <input type="hidden" name="title" value={value} form="save-all-exercises" />

      {editing ? (
        <input
          value={value}
          autoFocus
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              setValue(props.initialTitle)
              setEditing(false)
              return
            }
            if (e.key === 'Enter') {
              e.preventDefault()
              setEditing(false)
              const nextTitle = value
              startTransition(async () => {
                await commit(nextTitle)
                router.refresh()
              })
            }
          }}
          onBlur={() => {
            setEditing(false)
            const nextTitle = value
            startTransition(async () => {
              await commit(nextTitle)
              router.refresh()
            })
          }}
          style={{
            fontSize: 24,
            fontWeight: 700,
            border: '1px solid #e5e7eb',
            outline: 'none',
            padding: '2px 6px',
            margin: 0,
            background: 'transparent',
            color: '#111827',
            minWidth: 120,
            borderRadius: 6,
          }}
          title="Modifier le titre"
        />
      ) : (
        <button
          type="button"
          onClick={(e) => {
            const now = Date.now()
            const last = lastClickAtRef.current
            lastClickAtRef.current = now

            if (last != null && now - last < 350) {
              e.preventDefault()
              setEditing(true)
            }
          }}
          style={{
            fontSize: 24,
            fontWeight: 700,
            border: 0,
            background: 'transparent',
            padding: 0,
            margin: 0,
            cursor: 'text',
            color: 'rgb(52, 28, 68)',
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textAlign: 'left',
          }}
          title="Modifier le titre"
        >
          {displayTitle}
        </button>
      )}
    </div>
  )
}
