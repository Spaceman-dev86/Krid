'use client'

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useRef } from 'react'

export type WeekPill = {
  id: string
  title: string | null
  week_order: number
}

type Props = {
  weeks: WeekPill[]
  openWeekId: string | null
  disabled?: boolean
  onSelectWeek: (weekId: string) => void
  /** Optimistic + persist ; ordre final + id de la semaine déplacée. */
  onReorder: (orderedWeekIds: string[], draggedWeekId: string) => void
}

function SortableWeekPill({
  week,
  index,
  active,
  disabled,
  onSelect,
}: {
  week: WeekPill
  index: number
  active: boolean
  disabled?: boolean
  onSelect: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: week.id,
    disabled: Boolean(disabled),
  })

  return (
    <button
      type="button"
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      {...attributes}
      {...listeners}
      onClick={() => onSelect()}
      title={week.title?.trim() || `Semaine ${index + 1}`}
      disabled={disabled}
      className={`shrink-0 touch-none rounded-full px-3 py-1 text-[11px] font-semibold transition max-[767px]:px-2 max-[767px]:py-0.5 max-[767px]:text-[10px] ${
        isDragging ? 'z-10 opacity-80 shadow-da-md ring-1 ring-[var(--brand)]' : ''
      } ${
        active
          ? 'bg-[var(--brand)] text-[var(--brand-fg)] shadow-da-sm'
          : 'bg-[var(--accent)] text-[color:var(--fg)] hover:ring-1 hover:ring-[var(--border)]'
      }`}
    >
      {week.title?.trim() || `S${index + 1}`}
    </button>
  )
}

/** Nav semaines horizontale sortable (DnD) — click = ouvrir, drag = réordonner. */
export function AdminProgramWeekPills({
  weeks,
  openWeekId,
  disabled,
  onSelectWeek,
  onReorder,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Distingue click (ouvrir) vs drag (reorder).
      activationConstraint: { distance: 8 },
    }),
  )
  const suppressClickRef = useRef(false)

  const ids = weeks.map((w) => w.id)

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from < 0 || to < 0) return
    suppressClickRef.current = true
    onReorder(arrayMove(ids, from, to), String(active.id))
  }

  return (
    <div className={`min-w-0 flex-1 ${disabled ? 'opacity-70' : ''}`}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={horizontalListSortingStrategy}>
          <div className="da-scrollbar flex min-w-0 items-center gap-1 overflow-x-auto py-0.5 max-[767px]:gap-1">
            {weeks.map((w, i) => (
              <SortableWeekPill
                key={w.id}
                week={w}
                index={i}
                active={openWeekId === w.id}
                disabled={disabled}
                onSelect={() => {
                  if (suppressClickRef.current) {
                    suppressClickRef.current = false
                    return
                  }
                  onSelectWeek(w.id)
                }}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
