'use client';

import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { ReactNode } from 'react';

import styles from './weekly-planning-grid.module.css';

export const ASSIGNMENT_DND_PREFIX = 'planning-assignment:';
export const CELL_DND_PREFIX = 'planning-cell:';

type PlanningDropCellProps = Readonly<{
  children: ReactNode;
  className: string;
  disabled: boolean;
  positionId: string;
  workDate: string;
}>;

type PlanningDraggableAssignmentProps = Readonly<{
  agentName: string;
  children: ReactNode;
  dragDisabled: boolean;
  editDisabled: boolean;
  editable: boolean;
  id: string;
  onEdit: () => void;
}>;

export function PlanningDropCell({
  children,
  className,
  disabled,
  positionId,
  workDate,
}: PlanningDropCellProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `${CELL_DND_PREFIX}${positionId}:${workDate}`,
    data: { positionId, workDate },
    disabled,
  });

  return (
    <div
      className={`${className} ${isOver ? styles.dropTargetActive : ''}`}
      ref={setNodeRef}
    >
      {children}
    </div>
  );
}

export function PlanningDraggableAssignment({
  agentName,
  children,
  dragDisabled,
  editDisabled,
  editable,
  id,
  onEdit,
}: PlanningDraggableAssignmentProps) {
  const { attributes, isDragging, listeners, setActivatorNodeRef, setNodeRef } =
    useDraggable({
      id: `${ASSIGNMENT_DND_PREFIX}${id}`,
      data: { assignmentId: id },
      disabled: dragDisabled || !editable,
    });

  return (
    <article
      className={`${styles.assignment} ${
        editable ? styles.draggableAssignment : ''
      } ${isDragging ? styles.draggingAssignment : ''}`}
      ref={setNodeRef}
    >
      <button
        aria-label={`Modifier l’affectation de ${agentName}`}
        className={styles.assignmentEdit}
        disabled={!editable || editDisabled}
        onClick={onEdit}
        title={
          editable
            ? 'Modifier l’agent, le poste ou les horaires'
            : 'Le planning publié ne peut pas être modifié'
        }
        type="button"
      >
        {children}
      </button>
      {editable ? (
        <button
          {...attributes}
          {...listeners}
          aria-label={`Déplacer l’affectation de ${agentName}`}
          className={styles.dragHandle}
          data-svg-hide
          disabled={dragDisabled}
          ref={setActivatorNodeRef}
          title="Maintenir puis déplacer"
          type="button"
        >
          Déplacer
        </button>
      ) : null}
    </article>
  );
}
