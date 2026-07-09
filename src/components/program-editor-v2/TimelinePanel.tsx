'use client'

import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { memo, useCallback, useMemo } from 'react'

import { createTempId } from '../../domain/program-editor'
import { useApplyCommand, useWeeks } from '../../store/program-editor'
import { useProgramEditorUiStore } from '../../store/program-editor/uiStore'
import SortableWeekSection from './SortableWeekSection'
import EditorAddButton from './ui/EditorAddButton'

function TimelinePanelInner() {
  const weeks = useWeeks()
  const weekIds = useMemo(() => weeks.map((w) => w.id), [weeks])
  const applyCommand = useApplyCommand()
  const setWeekOpen = useProgramEditorUiStore((s) => s.setWeekOpen)

  const addWeek = useCallback(() => {
    const weekId = createTempId('week')
    applyCommand({ type: 'week.add', weekId, title: 'Semaine' })
    setWeekOpen(weekId, true)
  }, [applyCommand, setWeekOpen])

  return (
    <div id="program-editor-timeline-scroll" className="px-1 py-1">
      <SortableContext items={weekIds} strategy={verticalListSortingStrategy}>
        <div className="grid w-full gap-3 pb-6">
          {weeks.map((week) => (
            <SortableWeekSection key={week.id} week={week} />
          ))}
          <EditorAddButton panelShadow onClick={addWeek}>+ Ajouter une semaine</EditorAddButton>
        </div>
      </SortableContext>
    </div>
  )
}

export default memo(TimelinePanelInner)
