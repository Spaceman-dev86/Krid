'use client'

import { memo } from 'react'

import { EDITOR_TEXT_INPUT_X_DENSE } from './editorInputStyles'
import { handleSingleLineTextKeyDown } from './textFieldKeyboard'

type Props = {
  label: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  onStep: (delta: number) => void
  placeholder?: string
  inputMode?: 'numeric' | 'text'
}

function StepperInputInner({
  label,
  value,
  onChange,
  onBlur,
  onStep,
  placeholder,
  inputMode = 'numeric',
}: Props) {
  return (
    <div className="grid gap-1">
      <span className="text-[11px] font-semibold text-gray-600">{label}</span>
      <div className="relative">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className={`h-8 w-full rounded-lg border border-gray-200 bg-white pr-9 ${EDITOR_TEXT_INPUT_X_DENSE} text-sm`}
          placeholder={placeholder}
          inputMode={inputMode}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleSingleLineTextKeyDown}
        />
        <div className="absolute bottom-1 right-1 top-1 grid w-6 grid-rows-2 overflow-hidden rounded-md bg-white">
          <button
            type="button"
            className="flex items-center justify-center text-[11px] font-semibold leading-none text-gray-700 hover:text-gray-900"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              onStep(+1)
            }}
          >
            +
          </button>
          <button
            type="button"
            className="flex items-center justify-center text-[11px] font-semibold leading-none text-gray-700 hover:text-gray-900"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              onStep(-1)
            }}
          >
            −
          </button>
        </div>
      </div>
    </div>
  )
}

export default memo(StepperInputInner)
