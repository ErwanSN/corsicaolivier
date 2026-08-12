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
  label: string;
  positionId: string;
  workDate: string;
}>;

type PlanningDraggableAssignmentProps = Readonly<{
  agentName: string;
  children: ReactNode;
  dragDisabled: boolean;
  draggable: boolean;
  editDisabled: boolean;
  editable: boolean;
  id: string;
  onEdit: () => void;
  searchState?: 'match' | 'muted';
}>;

export function PlanningDropCell({
  children,
  className,
  disabled,
  label,
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
      aria-label={label}
      className={`${className} ${isOver ? styles.dropTargetActive : ''}`}
      ref={setNodeRef}
      role="cell"
    >
      {children}
    </div>
  );
}

export function PlanningDraggableAssignment({
  agentName,
  children,
  dragDisabled,
  draggable,
  editDisabled,
  editable,
  id,
  onEdit,
  searchState,
}: PlanningDraggableAssignmentProps) {
  const { attributes, isDragging, listeners, setActivatorNodeRef, setNodeRef } =
    useDraggable({
      id: `${ASSIGNMENT_DND_PREFIX}${id}`,
      data: { assignmentId: id },
      disabled: dragDisabled || !draggable,
    });

  return (
    <article
      className={`${styles.assignment} ${
        draggable ? styles.draggableAssignment : ''
      } ${isDragging ? styles.draggingAssignment : ''} ${
        searchState === 'match'
          ? styles.searchMatch
          : searchState === 'muted'
            ? styles.searchMuted
            : ''
      }`}
      data-search-state={searchState}
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
      {draggable ? (
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
          ⋮⋮
        </button>
      ) : null}
    </article>
  );
}
