import React from 'react'

interface BadgeProps {
  label: string
  tone?: string
}

export function Badge({ label, tone = 'tone-gray' }: BadgeProps) {
  return <span className={`badge ${tone}`}>{label}</span>
}
