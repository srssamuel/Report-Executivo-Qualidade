'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, HelpCircle } from 'lucide-react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'danger'
  inputMode?: boolean
  inputPlaceholder?: string
  inputDefaultValue?: string
  onConfirm: (value?: string) => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'default',
  inputMode = false,
  inputPlaceholder = '',
  inputDefaultValue = '',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [inputValue, setInputValue] = useState(inputDefaultValue)

  // Reset input value when dialog opens with a new default
  useEffect(() => {
    if (open) {
      setInputValue(inputDefaultValue)
    }
  }, [open, inputDefaultValue])

  // Auto-focus input when dialog opens in inputMode
  useEffect(() => {
    if (open && inputMode) {
      // Small delay to ensure the DOM is painted before focusing
      const timer = setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [open, inputMode])

  const handleConfirm = useCallback(() => {
    onConfirm(inputMode ? inputValue : undefined)
  }, [onConfirm, inputMode, inputValue])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCancel()
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleConfirm()
      }
    },
    [onCancel, handleConfirm],
  )

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).classList.contains('modal-backdrop')) {
        onCancel()
      }
    },
    [onCancel],
  )

  if (!open) return null

  const isDanger = variant === 'danger'
  const Icon = isDanger ? AlertTriangle : HelpCircle

  return (
    <div
      className="modal-backdrop open"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        style={{ width: 'min(480px, 100%)', maxHeight: '80vh' }}
      >
        <div className="modal-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Icon
              size={20}
              style={{ color: isDanger ? 'var(--red)' : 'var(--blue-800)', flexShrink: 0 }}
            />
            <h2
              id="confirm-dialog-title"
              style={{ fontSize: 'var(--text-base)', margin: 0 }}
            >
              {title}
            </h2>
          </div>
        </div>

        <div className="modal-body" style={{ gap: '16px' }}>
          <p
            id="confirm-dialog-message"
            style={{
              margin: 0,
              color: 'var(--muted)',
              fontSize: 'var(--text-small)',
              lineHeight: 1.6,
            }}
          >
            {message}
          </p>

          {inputMode && (
            <input
              ref={inputRef}
              className="input"
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              placeholder={inputPlaceholder}
              style={{ width: '100%' }}
            />
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '8px',
              paddingTop: '4px',
            }}
          >
            <button
              type="button"
              className="btn ghost small"
              onClick={onCancel}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              className={`btn small ${isDanger ? 'danger' : 'primary'}`}
              onClick={handleConfirm}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
