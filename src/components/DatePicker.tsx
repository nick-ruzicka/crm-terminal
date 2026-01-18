'use client'

import { useState, useRef, useEffect } from 'react'
import { DayPicker } from 'react-day-picker'
import { format, parse, isValid } from 'date-fns'
import 'react-day-picker/dist/style.css'

interface DatePickerProps {
  value: string // YYYY-MM-DD format
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Select date',
  disabled = false,
  className = '',
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Parse the value to a Date object
  const selectedDate = value ? parse(value, 'yyyy-MM-dd', new Date()) : undefined
  const isValidDate = selectedDate && isValid(selectedDate)

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      onChange(format(date, 'yyyy-MM-dd'))
    } else {
      onChange('')
    }
    setIsOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
  }

  return (
    <div ref={containerRef} className={`date-picker-container ${className}`}>
      <button
        type="button"
        className={`date-picker-trigger ${isOpen ? 'active' : ''} ${value ? 'has-value' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
      >
        <svg className="calendar-icon" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="1" y="2" width="12" height="11" rx="1" />
          <path d="M1 5h12M4 1v2M10 1v2" />
        </svg>
        <span className={value ? 'date-value' : 'date-placeholder'}>
          {isValidDate ? format(selectedDate, 'MMM d, yyyy') : placeholder}
        </span>
        {value && !disabled && (
          <button
            type="button"
            className="date-clear-btn"
            onClick={handleClear}
            aria-label="Clear date"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 3l6 6M9 3l-6 6" />
            </svg>
          </button>
        )}
      </button>

      {isOpen && (
        <div className="date-picker-popover">
          <DayPicker
            mode="single"
            selected={isValidDate ? selectedDate : undefined}
            onSelect={handleSelect}
            defaultMonth={isValidDate ? selectedDate : new Date()}
            showOutsideDays
          />
        </div>
      )}
    </div>
  )
}
