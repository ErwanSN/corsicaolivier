'use client';

import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type DragEndEvent,
  type CollisionDetection,
} from '@dnd-kit/core';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState, useTransition } from 'react';

import {
  movePlanningAssignment,
  type MovePlanningAssignmentResult,
} from '../app/tools/planning/planning-editor-action';
import type {
  Agent,
  PortCall,
  Position,
  ScheduleContent,
  ShiftAssignment,
  StaffingRequirement,
  Vessel,
} from '../lib/api/types';
import { addDays, type WeeklyPlanningRange } from '../lib/planning-range';
import {
  PlanningAssignmentEditor,
  type PlanningEditorTarget,
} from './planning-assignment-editor';
import { PlanningDraggableAssignment, PlanningDropCell } from './planning-dnd';
import styles from './weekly-planning-grid.module.css';

type PlanningGridProps = Readonly<{
  agents: Agent[];
  calls: PortCall[];
  contents: ScheduleContent[];
  positions: Position[];
  range: WeeklyPlanningRange;
  requirements: StaffingRequirement[];
  siteName: string;
  timeZone: string;
  vessels: Vessel[];
}>;

type CalendarDay = Readonly<{
  date: string;
  label: string;
  shortNumber: string;
  weekend: boolean;
}>;

type PlanningData = Readonly<{
  agentById: Map<string, Agent>;
  assignmentById: Map<string, ShiftAssignment>;
  assignmentMoveContextById: Map<string, AssignmentMoveContext>;
  assignments: ShiftAssignment[];
  calls: PortCall[];
  draftContexts: DraftScheduleContext[];
  positions: Position[];
  requirements: StaffingRequirement[];
  requirementsByCell: Map<string, StaffingRequirement[]>;
  arrivalCallsByDay: Map<string, PortCall[]>;
  departureCallsByDay: Map<string, PortCall[]>;
  shiftById: Map<string, ScheduleContent['shifts'][number]>;
  timeZone: string;
  vesselById: Map<string, Vessel>;
}>;

type AssignmentMoveContext = Readonly<{
  organizationId: string;
  scheduleVersionId: string;
  siteId: string;
}>;

type DraftScheduleContext = AssignmentMoveContext &
  Readonly<{
    startsOn: string;
    endsOn: string;
  }>;

type MoveOverride = Readonly<{
  positionId: string;
  workDate: string;
}>;

type MoveFeedback = Readonly<{
  kind: 'error' | 'pending' | 'success';
  message: string;
}>;

type PlanningInteractions = Readonly<{
  canCreate: (workDate: string) => boolean;
  moveDisabled: boolean;
  movingAssignmentId: string | null;
  onCreate: (positionId: string, workDate: string) => void;
  onEdit: (assignmentId: string) => void;
}>;

function dateKey(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone,
  }).format(new Date(value));
}

function timeLabel(value: string | null, timeZone: string): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(new Date(value));
}

function localInputValue(value: string, timeZone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone,
    })
      .formatToParts(new Date(value))
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function calendarDays(range: WeeklyPlanningRange): CalendarDay[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(range.startsOn, index);
    const instant = new Date(`${date}T12:00:00.000Z`);
    const weekday = instant.getUTCDay();

    return {
      date,
      label: new Intl.DateTimeFormat('fr-FR', {
        weekday: 'long',
        timeZone: 'UTC',
      }).format(instant),
      shortNumber: new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        timeZone: 'UTC',
      }).format(instant),
      weekend: weekday === 0 || weekday === 6,
    };
  });
}

function cellKey(positionId: string, workDate: string): string {
  return `${positionId}:${workDate}`;
}

function appendToIndex<T>(index: Map<string, T[]>, key: string, value: T) {
  const current = index.get(key);
  if (current) current.push(value);
  else index.set(key, [value]);
}

const planningCollisionDetection: CollisionDetection = (arguments_) => {
  const pointerCollisions = pointerWithin(arguments_);
  return pointerCollisions.length
    ? pointerCollisions
    : rectIntersection(arguments_);
};

function pendingMoveOverride(
  assignment: ShiftAssignment,
  overrides: Readonly<Record<string, MoveOverride>>,
  timeZone: string,
): MoveOverride | undefined {
  const override = overrides[assignment.id];

  if (
    override?.positionId === assignment.position_id &&
    override.workDate === dateKey(assignment.starts_at, timeZone)
  ) {
    return undefined;
  }

  return override;
}

export function PlanningGrid({
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
  const [isPending, startTransition] = useTransition();
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
    }),
    useSensor(KeyboardSensor),
  );
  const days = useMemo(() => calendarDays(range), [range]);
  const data = useMemo<PlanningData>(() => {
    const shifts = contents.flatMap((content) => content.shifts);
    const assignments = contents.flatMap((content) => content.assignments);
    const assignmentMoveContextById = new Map<string, AssignmentMoveContext>();
    const draftContexts: DraftScheduleContext[] = [];

    for (const content of contents) {
      if (content.version.status !== 'draft') continue;

      draftContexts.push({
        organizationId: content.version.organization_id,
        scheduleVersionId: content.version.id,
        siteId: content.version.site_id,
        startsOn: content.period.starts_on,
        endsOn: content.period.ends_on,
      });

      const assignmentCounts = new Map<string, number>();
      for (const assignment of content.assignments) {
        assignmentCounts.set(
          assignment.planning_shift_id,
          (assignmentCounts.get(assignment.planning_shift_id) ?? 0) + 1,
        );
      }

      for (const assignment of content.assignments) {
        if (assignmentCounts.get(assignment.planning_shift_id) !== 1) continue;
        assignmentMoveContextById.set(assignment.id, {
          organizationId: content.version.organization_id,
          scheduleVersionId: content.version.id,
          siteId: content.version.site_id,
        });
      }
    }

    const activeCalls = calls.filter((call) => call.status !== 'cancelled');
    const activeCallIds = new Set(activeCalls.map((call) => call.id));
    const filteredRequirements = requirements.filter(
      (requirement) =>
        !requirement.port_call_id ||
        activeCallIds.has(requirement.port_call_id),
    );
    const requirementsByCell = new Map<string, StaffingRequirement[]>();
    const arrivalCallsByDay = new Map<string, PortCall[]>();
    const departureCallsByDay = new Map<string, PortCall[]>();

    for (const requirement of filteredRequirements) {
      appendToIndex(
        requirementsByCell,
        cellKey(
          requirement.position_id,
          dateKey(requirement.starts_at, timeZone),
        ),
        requirement,
      );
    }

    for (const call of calls) {
      const arrival = call.estimated_arrival_at ?? call.scheduled_arrival_at;
      const departure =
        call.estimated_departure_at ?? call.scheduled_departure_at;
      if (arrival) {
        appendToIndex(arrivalCallsByDay, dateKey(arrival, timeZone), call);
      }
      if (departure) {
        appendToIndex(departureCallsByDay, dateKey(departure, timeZone), call);
      }
    }

    return {
      agentById: new Map(agents.map((agent) => [agent.id, agent])),
      assignmentById: new Map(
        assignments.map((assignment) => [assignment.id, assignment]),
      ),
      assignmentMoveContextById,
      assignments,
      calls,
      draftContexts,
      positions: [...positions].sort((left, right) =>
        left.code.localeCompare(right.code, 'fr'),
      ),
      requirements: filteredRequirements,
      requirementsByCell,
      arrivalCallsByDay,
      departureCallsByDay,
      shiftById: new Map(shifts.map((shift) => [shift.id, shift])),
      timeZone,
      vesselById: new Map(vessels.map((vessel) => [vessel.id, vessel])),
    };
  }, [agents, calls, contents, positions, requirements, timeZone, vessels]);

  const assignmentsByCell = useMemo(() => {
    const index = new Map<string, ShiftAssignment[]>();

    for (const assignment of data.assignments) {
      const override = pendingMoveOverride(assignment, moveOverrides, timeZone);
      appendToIndex(
        index,
        cellKey(
          override?.positionId ?? assignment.position_id,
          override?.workDate ?? dateKey(assignment.starts_at, timeZone),
        ),
        assignment,
      );
    }

    return index;
  }, [data.assignments, moveOverrides, timeZone]);

  const openEditAssignment = (assignmentId: string) => {
    const assignment = data.assignmentById.get(assignmentId);
    const shift = assignment
      ? data.shiftById.get(assignment.planning_shift_id)
      : undefined;
    const context = data.assignmentMoveContextById.get(assignmentId);

    if (!assignment || !shift || !context) return;

    setEditorTarget({
      mode: 'update',
      assignmentId,
      ...context,
      agentId: shift.agent_id,
      positionId: assignment.position_id,
      portCallId: assignment.port_call_id,
      startsAt: localInputValue(shift.starts_at, timeZone),
      endsAt: localInputValue(shift.ends_at, timeZone),
      breakMinutes: shift.break_minutes,
      note: shift.note ?? '',
    });
  };

  const openCreateAssignment = (positionId: string, workDate: string) => {
    const context = data.draftContexts.find(
      (item) => workDate >= item.startsOn && workDate <= item.endsOn,
    );
    const suggestedRequirement = data.requirements
      .filter(
        (requirement) =>
          requirement.position_id === positionId &&
          dateKey(requirement.starts_at, timeZone) === workDate,
      )
      .sort((left, right) => left.starts_at.localeCompare(right.starts_at))[0];
    const hasActiveAgent = agents.some((agent) => agent.active);

    if (!context || !hasActiveAgent) return;

    setEditorTarget({
      mode: 'create',
      ...context,
      agentId: '',
      positionId,
      portCallId: suggestedRequirement?.port_call_id ?? null,
      startsAt: suggestedRequirement
        ? localInputValue(suggestedRequirement.starts_at, timeZone)
        : `${workDate}T08:00`,
      endsAt: suggestedRequirement
        ? localInputValue(suggestedRequirement.ends_at, timeZone)
        : `${workDate}T15:00`,
      breakMinutes: 0,
      note: '',
    });
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

  const hasEditableAssignments =
    data.assignmentMoveContextById.size > 0 || data.draftContexts.length > 0;

  return (
    <div className={styles.planningArea}>
      {hasEditableAssignments ? (
        <div className={styles.dragHint}>
          <p>
            Cliquez pour modifier · utilisez « Déplacer » pour changer de case.
          </p>
          <span>
            Agent, poste, heures, pause, escale et note sont modifiables.
          </span>
        </div>
      ) : null}
      {moveFeedback ? (
        <p
          className={
            moveFeedback.kind === 'error'
              ? styles.moveError
              : moveFeedback.kind === 'success'
                ? styles.moveSuccess
                : styles.movePending
          }
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
          data={data}
          days={days}
          interactions={interactions}
          siteName={siteName}
        />
      </DndContext>
      {editorTarget ? (
        <PlanningAssignmentEditor
          agents={agents}
          calls={calls}
          key={`${editorTarget.mode}:${editorTarget.assignmentId ?? editorTarget.scheduleVersionId}:${editorTarget.startsAt}`}
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

function WeeklyTable({
  assignmentsByCell,
  data,
  days,
  interactions,
  siteName,
}: Readonly<{
  assignmentsByCell: Map<string, ShiftAssignment[]>;
  data: PlanningData;
  days: CalendarDay[];
  interactions: PlanningInteractions;
  siteName: string;
}>) {
  const autoPositions = data.positions.filter(
    (position) => !position.code.startsWith('FRET-'),
  );
  const freightPositions = data.positions.filter((position) =>
    position.code.startsWith('FRET-'),
  );

  return (
    <section className={styles.weekSheet} aria-label="Planning de la semaine">
      <div className={styles.weekViewport}>
        <div className={styles.weekGrid}>
          <div className={styles.cornerHeader}>
            <span>Centre Autos</span>
            <strong>{siteName}</strong>
          </div>
          {days.map((day) => (
            <div
              className={`${styles.dayColumnHeader} ${day.weekend ? styles.weekendHeader : ''}`}
              key={day.date}
            >
              <span>{day.label}</span>
              <strong>{day.shortNumber}</strong>
            </div>
          ))}
        </div>

        <WeekMovementRow data={data} days={days} kind="arrival" />
        <WeekMovementRow data={data} days={days} kind="departure" />
        <WeekSectionRow days={days} label="Centre Autos" />
        {autoPositions.map((position) => (
          <WeekPositionRow
            assignmentsByCell={assignmentsByCell}
            data={data}
            days={days}
            interactions={interactions}
            key={position.id}
            position={position}
          />
        ))}
        {!autoPositions.length ? <EmptyWeekRow days={days} /> : null}
        {freightPositions.length ? (
          <>
            <WeekSectionRow days={days} label="Fret" />
            {freightPositions.map((position) => (
              <WeekPositionRow
                assignmentsByCell={assignmentsByCell}
                data={data}
                days={days}
                interactions={interactions}
                key={position.id}
                position={position}
              />
            ))}
          </>
        ) : null}
      </div>
    </section>
  );
}

function WeekMovementRow({
  data,
  days,
  kind,
}: Readonly<{
  data: PlanningData;
  days: CalendarDay[];
  kind: 'arrival' | 'departure';
}>) {
  return (
    <div className={styles.weekGrid}>
      <div className={styles.stickyRowLabel}>
        {kind === 'arrival' ? 'Arrivées' : 'Départs'}
      </div>
      {days.map((day) => (
        <div
          className={`${styles.movementCell} ${day.weekend ? styles.weekendCell : ''}`}
          key={day.date}
        >
          <MovementList data={data} day={day} kind={kind} />
        </div>
      ))}
    </div>
  );
}

function WeekSectionRow({
  days,
  label,
}: Readonly<{ days: CalendarDay[]; label: string }>) {
  return (
    <div className={styles.weekGrid}>
      <div
        className={`${styles.sectionLabel} ${label === 'Fret' ? styles.freightBand : styles.autoBand}`}
      >
        {label}
      </div>
      {days.map((day) => (
        <div
          className={`${styles.sectionBand} ${label === 'Fret' ? styles.freightBand : styles.autoBand}`}
          key={day.date}
        />
      ))}
    </div>
  );
}

function WeekPositionRow({
  assignmentsByCell,
  data,
  days,
  interactions,
  position,
}: Readonly<{
  assignmentsByCell: Map<string, ShiftAssignment[]>;
  data: PlanningData;
  days: CalendarDay[];
  interactions: PlanningInteractions;
  position: Position;
}>) {
  return (
    <div className={styles.weekGrid}>
      <div className={styles.positionLabel}>{position.name}</div>
      {days.map((day) => {
        const key = cellKey(position.id, day.date);
        const assignments = assignmentsByCell.get(key) ?? [];
        const requirements = data.requirementsByCell.get(key) ?? [];

        return (
          <PlanningDropCell
            className={`${styles.positionCell} ${day.weekend ? styles.weekendCell : ''}`}
            disabled={interactions.moveDisabled}
            key={day.date}
            positionId={position.id}
            workDate={day.date}
          >
            {interactions.canCreate(day.date) ? (
              <button
                aria-label={`Ajouter une affectation au poste ${position.name} le ${day.shortNumber}`}
                className={styles.addAssignment}
                onClick={() => interactions.onCreate(position.id, day.date)}
                title="Ajouter une affectation"
                type="button"
              >
                + Ajouter
              </button>
            ) : null}
            {assignments.map((assignment) => (
              <AssignmentEntry
                assignment={assignment}
                data={data}
                interactions={interactions}
                key={assignment.id}
              />
            ))}
            {requirements.map((requirement) => (
              <CoverageEntry
                assignments={assignments}
                data={data}
                key={requirement.id}
                requirement={requirement}
              />
            ))}
          </PlanningDropCell>
        );
      })}
    </div>
  );
}

function EmptyWeekRow({ days }: Readonly<{ days: CalendarDay[] }>) {
  return (
    <div className={styles.weekGrid}>
      <div className={styles.positionLabel}>Postes à configurer</div>
      {days.map((day) => (
        <div className={styles.positionCell} key={day.date} />
      ))}
    </div>
  );
}

function MovementList({
  data,
  day,
  kind,
}: Readonly<{
  data: PlanningData;
  day: CalendarDay;
  kind: 'arrival' | 'departure';
}>) {
  const calls =
    (kind === 'arrival'
      ? data.arrivalCallsByDay.get(day.date)
      : data.departureCallsByDay.get(day.date)) ?? [];

  return calls.length ? (
    <div className={styles.movementList}>
      {calls.map((call) => (
        <MovementEntry call={call} data={data} key={call.id} kind={kind} />
      ))}
    </div>
  ) : (
    <span className={styles.emptyValue}>—</span>
  );
}

function MovementEntry({
  call,
  data,
  kind,
}: Readonly<{
  call: PortCall;
  data: PlanningData;
  kind: 'arrival' | 'departure';
}>) {
  const scheduled =
    kind === 'arrival'
      ? call.scheduled_arrival_at
      : call.scheduled_departure_at;
  const estimated =
    kind === 'arrival'
      ? call.estimated_arrival_at
      : call.estimated_departure_at;
  const changed = Boolean(estimated && scheduled && estimated !== scheduled);

  return (
    <div
      className={`${styles.movementEntry} ${
        call.status === 'cancelled'
          ? styles.cancelled
          : changed
            ? styles.changed
            : ''
      }`}
    >
      <p>
        <strong>{data.vesselById.get(call.vessel_id)?.name ?? 'Navire'}</strong>
        <span>{timeLabel(estimated ?? scheduled, data.timeZone)}</span>
      </p>
      {changed ? (
        <small>
          Prévu <del>{timeLabel(scheduled, data.timeZone)}</del>
        </small>
      ) : null}
    </div>
  );
}

function AssignmentEntry({
  assignment,
  data,
  interactions,
}: Readonly<{
  assignment: ShiftAssignment;
  data: PlanningData;
  interactions: PlanningInteractions;
}>) {
  const shift = data.shiftById.get(assignment.planning_shift_id);
  const editable = data.assignmentMoveContextById.has(assignment.id);
  const agentName = shift
    ? (data.agentById.get(shift.agent_id)?.display_name ?? 'Agent')
    : 'Agent';

  return (
    <PlanningDraggableAssignment
      agentName={agentName}
      dragDisabled={interactions.moveDisabled}
      editDisabled={interactions.movingAssignmentId === assignment.id}
      editable={editable}
      id={assignment.id}
      onEdit={() => interactions.onEdit(assignment.id)}
    >
      <strong>{agentName}</strong>
      <span>
        {timeLabel(assignment.starts_at, data.timeZone)}–
        {timeLabel(assignment.ends_at, data.timeZone)}
      </span>
    </PlanningDraggableAssignment>
  );
}

function CoverageEntry({
  assignments,
  data,
  requirement,
}: Readonly<{
  assignments: ShiftAssignment[];
  data: PlanningData;
  requirement: StaffingRequirement;
}>) {
  const matchingAssignments = assignments.filter(
    (assignment) =>
      assignment.staffing_requirement_id === requirement.id ||
      (!assignment.staffing_requirement_id &&
        assignment.port_call_id === requirement.port_call_id),
  );
  const covered = minimumConcurrentCoverage(requirement, matchingAssignments);
  const missing = covered < requirement.required_agents;

  return (
    <p className={missing ? styles.missingCoverage : styles.coverage}>
      Besoin {timeLabel(requirement.starts_at, data.timeZone)}–
      {timeLabel(requirement.ends_at, data.timeZone)} · {covered}/
      {requirement.required_agents}
    </p>
  );
}

function minimumConcurrentCoverage(
  requirement: StaffingRequirement,
  assignments: ScheduleContent['assignments'],
): number {
  const requirementStart = new Date(requirement.starts_at).getTime();
  const requirementEnd = new Date(requirement.ends_at).getTime();
  const relevant = assignments
    .map((assignment) => ({
      start: Math.max(
        requirementStart,
        new Date(assignment.starts_at).getTime(),
      ),
      end: Math.min(requirementEnd, new Date(assignment.ends_at).getTime()),
    }))
    .filter((interval) => interval.end > interval.start);
  const boundaries = [
    requirementStart,
    requirementEnd,
    ...relevant.flatMap((interval) => [interval.start, interval.end]),
  ].sort((left, right) => left - right);
  let minimum = Number.POSITIVE_INFINITY;

  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const start = boundaries[index];
    const end = boundaries[index + 1];
    if (end <= start) continue;
    const midpoint = start + (end - start) / 2;
    const coverage = relevant.filter(
      (interval) => interval.start <= midpoint && interval.end >= midpoint,
    ).length;
    minimum = Math.min(minimum, coverage);
  }

  return Number.isFinite(minimum) ? minimum : 0;
}
