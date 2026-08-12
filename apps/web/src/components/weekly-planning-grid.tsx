'use client';

import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useRouter } from 'next/navigation';
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';

import {
  movePlanningAssignment,
  type MovePlanningAssignmentResult,
} from '../app/tools/planning/planning-editor-action';
import {
  PlanningAssignmentEditor,
  type PlanningEditorTarget,
} from './planning-assignment-editor';
import { PlanningCommandBar } from './weekly-planning-grid-command-bar';
import {
  useAssignmentsByCell,
  useCoverageByRequirementId,
  usePlanningData,
} from './weekly-planning-grid.data';
import {
  assignmentEditorTarget,
  createEditorTarget,
} from './weekly-planning-grid.editor-target';
import styles from './weekly-planning-grid.module.css';
import { WeeklyTable } from './weekly-planning-grid-table';
import type {
  MoveFeedback,
  MoveOverride,
  PlanningGridProps,
  PlanningInteractions,
  PlanningSummary,
} from './weekly-planning-grid.types';
import {
  calendarDays,
  dateKey,
  normalizedSearch,
  pendingMoveOverride,
  planningCollisionDetection,
} from './weekly-planning-grid.utils';

export function PlanningGrid({
  activeAgentCount,
  agents,
  calls,
  contents,
  positions,
  range,
  requirements,
  siteName,
  timeZone,
  vessels,
}: PlanningGridProps) {
  const router = useRouter();
  const [movingAssignmentId, setMovingAssignmentId] = useState<string | null>(
    null,
  );
  const [moveFeedback, setMoveFeedback] = useState<MoveFeedback | null>(null);
  const [moveOverrides, setMoveOverrides] = useState<
    Record<string, MoveOverride>
  >({});
  const [editorTarget, setEditorTarget] = useState<PlanningEditorTarget | null>(
    null,
  );
  const [agentSearch, setAgentSearch] = useState('');
  const deferredAgentSearch = useDeferredValue(agentSearch);
  const [isPending, startTransition] = useTransition();
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
    }),
    useSensor(KeyboardSensor),
  );
  const days = useMemo(() => calendarDays(range), [range]);
  const data = usePlanningData({
    agents,
    calls,
    contents,
    positions,
    requirements,
    timeZone,
    vessels,
  });
  const assignmentsByCell = useAssignmentsByCell(
    data.assignments,
    moveOverrides,
    timeZone,
  );
  const coverageByRequirementId = useCoverageByRequirementId(
    assignmentsByCell,
    data,
    timeZone,
  );
  const normalizedAgentSearch = useMemo(
    () => normalizedSearch(deferredAgentSearch),
    [deferredAgentSearch],
  );
  const highlightedAgentIds = useMemo<Set<string> | null>(() => {
    if (!normalizedAgentSearch) return null;

    return new Set(
      agents
        .filter((agent) =>
          normalizedSearch(
            `${agent.display_name} ${agent.employee_number}`,
          ).includes(normalizedAgentSearch),
        )
        .map((agent) => agent.id),
    );
  }, [agents, normalizedAgentSearch]);
  const matchingAssignmentCount = useMemo(() => {
    if (!highlightedAgentIds) return 0;

    return data.assignments.reduce((count, assignment) => {
      const shift = data.shiftById.get(assignment.planning_shift_id);
      return count + (shift && highlightedAgentIds.has(shift.agent_id) ? 1 : 0);
    }, 0);
  }, [data.assignments, data.shiftById, highlightedAgentIds]);
  const planningSummary = useMemo<PlanningSummary>(() => {
    const scheduledAgentIds = new Set<string>();

    for (const assignment of data.assignments) {
      const shift = data.shiftById.get(assignment.planning_shift_id);
      if (shift) scheduledAgentIds.add(shift.agent_id);
    }

    let missingAgentSlots = 0;
    for (const requirement of data.requirements) {
      const covered = coverageByRequirementId.get(requirement.id) ?? 0;
      missingAgentSlots += Math.max(0, requirement.required_agents - covered);
    }

    return {
      activeAgents: activeAgentCount,
      missingAgentSlots,
      scheduledAgents: scheduledAgentIds.size,
    };
  }, [
    activeAgentCount,
    coverageByRequirementId,
    data.assignments,
    data.requirements,
    data.shiftById,
  ]);
  const showSearch =
    planningSummary.activeAgents > 0 || data.assignments.length > 0;
  const showStats =
    planningSummary.activeAgents > 0 || planningSummary.missingAgentSlots > 0;

  useEffect(() => {
    if (normalizedAgentSearch.length < 2 || matchingAssignmentCount === 0) {
      return;
    }

    const timeout = window.setTimeout(() => {
      document
        .querySelector<HTMLElement>('[data-search-state="match"]')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 180);

    return () => window.clearTimeout(timeout);
  }, [matchingAssignmentCount, normalizedAgentSearch]);

  const openEditAssignment = (assignmentId: string) => {
    const target = assignmentEditorTarget(assignmentId, data, timeZone);
    if (target) setEditorTarget(target);
  };

  const openCreateAssignment = (positionId: string, workDate: string) => {
    const target = createEditorTarget(
      positionId,
      workDate,
      agents,
      data,
      timeZone,
    );
    if (target) setEditorTarget(target);
  };

  const moveAssignment = useCallback(
    (assignmentId: string, positionId: string, workDate: string) => {
      const assignment = data.assignmentById.get(assignmentId);
      const context = data.assignmentMoveContextById.get(assignmentId);

      if (!assignment || !context || isPending) return;

      const previousOverride = pendingMoveOverride(
        assignment,
        moveOverrides,
        timeZone,
      );
      const currentPositionId =
        previousOverride?.positionId ?? assignment.position_id;
      const currentWorkDate =
        previousOverride?.workDate ?? dateKey(assignment.starts_at, timeZone);

      if (currentPositionId === positionId && currentWorkDate === workDate) {
        return;
      }

      setMoveOverrides((current) => ({
        ...current,
        [assignmentId]: { positionId, workDate },
      }));
      setMoveFeedback({
        kind: 'pending',
        message: 'Déplacement en cours…',
      });
      setMovingAssignmentId(assignmentId);

      startTransition(async () => {
        const result: MovePlanningAssignmentResult =
          await movePlanningAssignment({
            assignmentId,
            lockVersion: context.lockVersion,
            organizationId: context.organizationId,
            positionId,
            scheduleVersionId: context.scheduleVersionId,
            siteId: context.siteId,
            workDate,
          });

        if (!result.ok) {
          setMoveOverrides((current) => {
            const next = { ...current };

            if (previousOverride) next[assignmentId] = previousOverride;
            else delete next[assignmentId];

            return next;
          });
          setMoveFeedback({ kind: 'error', message: result.error });
          setMovingAssignmentId(null);
          return;
        }

        setMoveFeedback({
          kind: 'success',
          message: 'Affectation déplacée.',
        });
        setMovingAssignmentId(null);
        router.refresh();
      });
    },
    [
      data.assignmentById,
      data.assignmentMoveContextById,
      isPending,
      moveOverrides,
      router,
      startTransition,
      timeZone,
    ],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const assignmentId = event.active.data.current?.assignmentId;
      const positionId = event.over?.data.current?.positionId;
      const workDate = event.over?.data.current?.workDate;

      if (
        typeof assignmentId === 'string' &&
        typeof positionId === 'string' &&
        typeof workDate === 'string'
      ) {
        moveAssignment(assignmentId, positionId, workDate);
      }
    },
    [moveAssignment],
  );

  const interactions: PlanningInteractions = {
    canCreate: (workDate) =>
      agents.some((agent) => agent.active) &&
      data.draftContexts.some(
        (context) => workDate >= context.startsOn && workDate <= context.endsOn,
      ),
    onCreate: openCreateAssignment,
    moveDisabled: isPending,
    movingAssignmentId,
    onEdit: openEditAssignment,
  };

  return (
    <div className={styles.planningArea}>
      <PlanningCommandBar
        agentSearch={agentSearch}
        deferredAgentSearch={deferredAgentSearch}
        highlightedAgentIds={highlightedAgentIds}
        matchingAssignmentCount={matchingAssignmentCount}
        onAgentSearchChange={setAgentSearch}
        planningSummary={planningSummary}
        showSearch={showSearch}
        showStats={showStats}
      />
      {moveFeedback ? (
        <p
          className={
            moveFeedback.kind === 'error'
              ? styles.moveError
              : moveFeedback.kind === 'success'
                ? styles.moveSuccess
                : styles.movePending
          }
          data-svg-hide
          role={moveFeedback.kind === 'error' ? 'alert' : 'status'}
        >
          {moveFeedback.message}
        </p>
      ) : null}
      <DndContext
        autoScroll
        collisionDetection={planningCollisionDetection}
        onDragEnd={handleDragEnd}
        sensors={sensors}
      >
        <WeeklyTable
          assignmentsByCell={assignmentsByCell}
          coverageByRequirementId={coverageByRequirementId}
          data={data}
          days={days}
          highlightedAgentIds={highlightedAgentIds}
          interactions={interactions}
          siteName={siteName}
        />
      </DndContext>
      {editorTarget ? (
        <PlanningAssignmentEditor
          agents={agents}
          calls={calls}
          key={`${editorTarget.mode}:${editorTarget.shiftId ?? editorTarget.scheduleVersionId}:${editorTarget.startsAt}`}
          onClose={() => setEditorTarget(null)}
          onMutation={(result) => {
            setMoveFeedback(result);
            router.refresh();
          }}
          positions={positions}
          target={editorTarget}
          timeZone={timeZone}
          vessels={vessels}
        />
      ) : null}
    </div>
  );
}
