import { useEffect, useId, useRef, useState } from 'react'
import { Icon } from './Icon'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  /** Shown as a muted placeholder when value is empty; also acts as a 0-value entry. */
  placeholder?: string
  disabled?: boolean
  required?: boolean
  /** Compact height, for filter bars. */
  size?: 'md' | 'sm'
  /** Monospace text (codes / ids). */
  mono?: boolean
  id?: string
  ariaLabel?: string
  className?: string
}

/**
 * Design-system select. Renders a custom listbox instead of the native control
 * so the option surface matches the `--gs-*` tokens on every browser, while
 * keeping full keyboard support (Enter/Space/Arrow/Escape/Home/End) and ARIA
 * combobox semantics.
 *
 * Repo rule: no UI framework — this is hand-built against the design tokens.
 */
export function Select({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  required = false,
  size = 'md',
  mono = false,
  id,
  ariaLabel,
  className = '',
}: SelectProps) {
  const autoId = useId()
  const selectId = id ?? autoId
  const listId = `${selectId}-listbox`

  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const allOptions: SelectOption[] = placeholder
    ? [{ value: '', label: placeholder }, ...options]
    : options

  const selected = allOptions.find((o) => o.value === value)
  const showPlaceholder = !selected || (selected.value === '' && Boolean(placeholder))

  // Close on outside click.
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  // When opening, start the active item on the current selection.
  useEffect(() => {
    if (open) {
      const idx = allOptions.findIndex((o) => o.value === value)
      setActiveIndex(idx >= 0 ? idx : 0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function commit(option: SelectOption) {
    if (option.disabled) return
    onChange(option.value)
    setOpen(false)
    buttonRef.current?.focus()
  }

  function move(delta: number) {
    if (allOptions.length === 0) return
    let next = activeIndex
    for (let i = 0; i < allOptions.length; i++) {
      next = (next + delta + allOptions.length) % allOptions.length
      if (!allOptions[next].disabled) break
    }
    setActiveIndex(next)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (open && activeIndex >= 0) commit(allOptions[activeIndex])
        else setOpen(true)
        break
      case 'ArrowDown':
        e.preventDefault()
        if (!open) setOpen(true)
        else move(1)
        break
      case 'ArrowUp':
        e.preventDefault()
        if (!open) setOpen(true)
        else move(-1)
        break
      case 'Escape':
        if (open) { e.preventDefault(); setOpen(false) }
        break
      case 'Home':
        if (open) { e.preventDefault(); setActiveIndex(0) }
        break
      case 'End':
        if (open) { e.preventDefault(); setActiveIndex(allOptions.length - 1) }
        break
      case 'Tab':
        setOpen(false)
        break
    }
  }

  const triggerClass = [
    'select-trigger',
    size === 'sm' ? 'select-trigger-sm' : '',
    mono ? 'mono' : '',
    open ? 'is-open' : '',
    showPlaceholder ? 'is-placeholder' : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <div className="select-root" ref={rootRef}>
      <button
        ref={buttonRef}
        id={selectId}
        type="button"
        className={triggerClass}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        aria-required={required || undefined}
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={onKeyDown}
      >
        <span className="select-value">{showPlaceholder ? placeholder : selected?.label ?? ''}</span>
        <Icon name="chevron-down" size={14} className="select-chevron" />
      </button>

      {open && (
        <ul className="select-menu" role="listbox" id={listId} aria-labelledby={selectId}>
          {allOptions.map((option, index) => (
            <li
              key={option.value || `__placeholder_${index}`}
              role="option"
              aria-selected={option.value === value}
              className={[
                'select-option',
                option.value === value ? 'is-selected' : '',
                index === activeIndex ? 'is-active' : '',
                option.disabled ? 'is-disabled' : '',
              ].filter(Boolean).join(' ')}
              onMouseEnter={() => !option.disabled && setActiveIndex(index)}
              onMouseDown={(e) => { e.preventDefault(); commit(option) }}
            >
              <span className="select-option-label">{option.label}</span>
              {option.value === value && <Icon name="check" size={14} className="select-option-check" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
