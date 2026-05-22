'use client'

import React from 'react'
import { GripVertical } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS as DndCSS } from '@dnd-kit/utilities'
import {
  Item,
  riskOf,
  scoreOf,
  productTone,
  riskTone,
  priorityTone,
  clamp,
  dateFmt,
} from '@/shared/domain'
import { Badge } from '@/shared/components'

// ── Sortable Card (DnD) ────────────────────────────────────────────────────
export function SortableTaskCard({ item, onEdit }: { item: Item; onEdit: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style: React.CSSProperties = {
    transform: DndCSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  return (
    <article ref={setNodeRef} style={style} className={`task-card${isDragging ? ' dragging' : ''}`} {...attributes}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <button
          className="btn-drag"
          {...listeners}
          aria-label="Arrastar"
          style={{ cursor: 'grab', background: 'none', border: 'none', padding: '2px 0', color: 'var(--muted-2)', flexShrink: 0 }}
        >
          <GripVertical size={14} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="task-meta">
            <Badge label={item.product ?? 'Sem produto'} tone={productTone(item.product)} />
            <Badge label={riskOf(item)} tone={riskTone(riskOf(item))} />
            <Badge label={item.priority ?? 'Média'} tone={priorityTone(item.priority ?? 'Média')} />
          </div>
          <h4>{item.project ?? 'Sem projeto'}</h4>
          <p>{item.demand ?? item.definition ?? 'Sem demanda'}</p>
          <div><small>{dateFmt(item.dueDate)} · {item.owner ?? 'Sem responsável'}</small></div>
          <div className="progress-line">
            <i style={{ width: `${clamp(Number(item.progress ?? 0), 0, 100)}%` }} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
            <small>Score {scoreOf(item)}%</small>
            <button className="btn small" onClick={() => onEdit(item.id)}>Editar</button>
          </div>
        </div>
      </div>
    </article>
  )
}

// ── Droppable Lane wrapper ────────────────────────────────────────────────
export function DroppableLane({
  laneId,
  status,
  dot,
  count,
  children
}: {
  laneId: string
  status: string
  dot: string
  count: number
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: laneId })
  return (
    <div ref={setNodeRef} className={`lane${isOver ? ' lane-over' : ''}`}>
      <div className="lane-head">
        <div className={`lane-dot ${dot}`} />
        <h3>{status}</h3>
        <Badge label={String(count)} />
      </div>
      {children}
    </div>
  )
}

const BOARD_LANES: { status: string; dot: string }[] = [
  { status: 'A iniciar', dot: 'lane-dot-iniciar' },
  { status: 'Em andamento', dot: 'lane-dot-andamento' },
  { status: 'Em validação', dot: 'lane-dot-validacao' },
  { status: 'Bloqueado', dot: 'lane-dot-bloqueado' },
  { status: 'Concluído', dot: 'lane-dot-concluido' },
  { status: 'Entregue', dot: 'lane-dot-concluido' },
]

interface BoardViewProps {
  filtered: Item[]
  onEdit: (id: string) => void
  onStatusChange: (id: string, newStatus: string) => void
}

export function BoardView({ filtered, onEdit, onStatusChange }: BoardViewProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)
    if (activeId === overId) return

    let targetStatus: string | null = null

    // If dropped on a lane (lane IDs are prefixed with "lane-")
    if (overId.startsWith('lane-')) {
      const laneStatus = overId.replace('lane-', '')
      const lane = BOARD_LANES.find(l => l.status === laneStatus)
      if (lane) targetStatus = lane.status
    } else {
      // Dropped on another card — find which lane that card belongs to
      const targetItem = filtered.find(i => i.id === overId)
      if (targetItem) targetStatus = targetItem.status
    }

    if (targetStatus) {
      const item = filtered.find(i => i.id === activeId)
      if (item && item.status !== targetStatus) {
        onStatusChange(activeId, targetStatus)
      }
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="board">
        {BOARD_LANES.map(({ status, dot }) => {
          const rows = filtered.filter(it => it.status === status)
          const ids = rows.map(r => r.id)
          return (
            <SortableContext key={status} items={ids} strategy={verticalListSortingStrategy}>
              <DroppableLane laneId={`lane-${status}`} status={status} dot={dot} count={rows.length}>
                {rows.length === 0 ? (
                  <div className="empty" style={{ padding: 18 }}>Sem itens</div>
                ) : (
                  rows.map(it => (
                    <SortableTaskCard key={it.id} item={it} onEdit={onEdit} />
                  ))
                )}
              </DroppableLane>
            </SortableContext>
          )
        })}
      </div>
    </DndContext>
  )
}
