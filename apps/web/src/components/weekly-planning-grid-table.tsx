import type {
  PortCall,
  Position,
  ShiftAssignment,
  StaffingRequirement,
} from '../lib/api/types';
import { PlanningDraggableAssignment, PlanningDropCell } from './planning-dnd';
import styles from './weekly-planning-grid.module.css';
import type {
  CalendarDay,
  PlanningData,
  PlanningInteractions,
} from './weekly-planning-grid.types';
import { cellKey, timeLabel } from './weekly-planning-grid.utils';

const MIN_VISIBLE_POSITION_ROWS = 8;

export function WeeklyTable({
  assignmentsByCell,
  coverageByRequirementId,
  data,
  days,
  highlightedAgentIds,
  interactions,
  siteName,
}: Readonly<{
  assignmentsByCell: Map<string, ShiftAssignment[]>;
  coverageByRequirementId: ReadonlyMap<string, number>;
  data: PlanningData;
  days: CalendarDay[];
  highlightedAgentIds: ReadonlySet<string> | null;
  interactions: PlanningInteractions;
  siteName: string;
}>) {
  const autoPositions = data.positions.filter(
    (position) => !position.code.startsWith('FRET-'),
  );
  const freightPositions = data.positions.filter((position) =>
    position.code.startsWith('FRET-'),
  );
  const emptyRowCount = Math.max(
    0,
    MIN_VISIBLE_POSITION_ROWS - data.positions.length,
  );

  return (
    <section aria-label="Planning de la semaine" className={styles.weekSheet}>
      <p className={styles.visuallyHidden} id="planning-week-help">
        Tableau de huit colonnes. Utilisez le défilement horizontal pour
        parcourir les sept jours de la semaine.
      </p>
      <div
        aria-colcount={8}
        aria-describedby="planning-week-help"
        aria-label={`Planning hebdomadaire ${siteName}`}
        className={styles.weekViewport}
        data-planning-week-viewport
        id="planning-week-grid"
        role="table"
        tabIndex={0}
      >
        <div className={styles.weekGrid} data-planning-week-row role="row">
          <div className={styles.cornerHeader} role="columnheader">
            <strong>{siteName}</strong>
          </div>
          {days.map((day) => (
            <div
              className={`${styles.dayColumnHeader} ${day.weekend ? styles.weekendHeader : ''}`}
              key={day.date}
              role="columnheader"
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
            coverageByRequirementId={coverageByRequirementId}
            data={data}
            days={days}
            highlightedAgentIds={highlightedAgentIds}
            interactions={interactions}
            key={position.id}
            position={position}
          />
        ))}
        {freightPositions.length ? (
          <>
            <WeekSectionRow days={days} label="Fret" />
            {freightPositions.map((position) => (
              <WeekPositionRow
                assignmentsByCell={assignmentsByCell}
                coverageByRequirementId={coverageByRequirementId}
                data={data}
                days={days}
                highlightedAgentIds={highlightedAgentIds}
                interactions={interactions}
                key={position.id}
                position={position}
              />
            ))}
          </>
        ) : null}
        {Array.from({ length: emptyRowCount }, (_, index) => (
          <EmptyWeekRow
            days={days}
            key={`empty-${index}`}
            showHint={index === 0 && data.positions.length === 0}
          />
        ))}
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
  const hasMovements = days.some((day) => {
    const calls =
      kind === 'arrival'
        ? data.arrivalCallsByDay.get(day.date)
        : data.departureCallsByDay.get(day.date);

    return Boolean(calls?.length);
  });

  if (!hasMovements) return null;

  return (
    <div className={styles.weekGrid} data-planning-week-row role="row">
      <div className={styles.stickyRowLabel} role="rowheader">
        {kind === 'arrival' ? 'Arrivées' : 'Départs'}
      </div>
      {days.map((day) => (
        <div
          className={`${styles.movementCell} ${day.weekend ? styles.weekendCell : ''}`}
          key={day.date}
          role="cell"
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
    <div className={styles.weekGrid} data-planning-week-row role="row">
      <div
        className={`${styles.sectionLabel} ${label === 'Fret' ? styles.freightBand : styles.autoBand}`}
        role="rowheader"
      >
        {label}
      </div>
      {days.map((day) => (
        <div
          className={`${styles.sectionBand} ${label === 'Fret' ? styles.freightBand : styles.autoBand}`}
          key={day.date}
          role="cell"
        />
      ))}
    </div>
  );
}

function WeekPositionRow({
  assignmentsByCell,
  coverageByRequirementId,
  data,
  days,
  highlightedAgentIds,
  interactions,
  position,
}: Readonly<{
  assignmentsByCell: Map<string, ShiftAssignment[]>;
  coverageByRequirementId: ReadonlyMap<string, number>;
  data: PlanningData;
  days: CalendarDay[];
  highlightedAgentIds: ReadonlySet<string> | null;
  interactions: PlanningInteractions;
  position: Position;
}>) {
  return (
    <div className={styles.weekGrid} data-planning-week-row role="row">
      <div className={styles.positionLabel} role="rowheader">
        {position.name}
      </div>
      {days.map((day) => {
        const key = cellKey(position.id, day.date);
        const assignments = assignmentsByCell.get(key) ?? [];
        const requirements = data.requirementsByCell.get(key) ?? [];

        return (
          <PlanningDropCell
            className={`${styles.positionCell} ${day.weekend ? styles.weekendCell : ''}`}
            disabled={interactions.moveDisabled}
            key={day.date}
            label={`${position.name}, ${day.label} ${day.shortNumber}`}
            positionId={position.id}
            workDate={day.date}
          >
            {interactions.canCreate(day.date) ? (
              <button
                aria-label={`Ajouter une affectation au poste ${position.name} le ${day.shortNumber}`}
                className={styles.addAssignment}
                data-svg-hide
                onClick={() => interactions.onCreate(position.id, day.date)}
                title="Ajouter une affectation"
                type="button"
              >
                +
              </button>
            ) : null}
            {assignments.map((assignment) => (
              <AssignmentEntry
                assignment={assignment}
                data={data}
                highlightedAgentIds={highlightedAgentIds}
                interactions={interactions}
                key={assignment.id}
              />
            ))}
            {requirements.map((requirement) => (
              <CoverageEntry
                covered={coverageByRequirementId.get(requirement.id) ?? 0}
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

function EmptyWeekRow({
  days,
  showHint,
}: Readonly<{ days: CalendarDay[]; showHint: boolean }>) {
  return (
    <div
      aria-hidden={!showHint}
      className={styles.weekGrid}
      data-empty-planning-row
      data-planning-week-row
      role={showHint ? 'row' : 'presentation'}
    >
      <div
        className={`${styles.positionLabel} ${styles.emptyPositionLabel}`}
        role={showHint ? 'rowheader' : 'presentation'}
      >
        {showHint ? 'Postes à configurer' : null}
      </div>
      {days.map((day) => (
        <div
          aria-label={
            showHint ? `${day.label} ${day.shortNumber}, vide` : undefined
          }
          className={`${styles.positionCell} ${styles.emptyPositionCell}`}
          key={day.date}
          role={showHint ? 'cell' : 'presentation'}
        />
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
  highlightedAgentIds,
  interactions,
}: Readonly<{
  assignment: ShiftAssignment;
  data: PlanningData;
  highlightedAgentIds: ReadonlySet<string> | null;
  interactions: PlanningInteractions;
}>) {
  const shift = data.shiftById.get(assignment.planning_shift_id);
  const editable = data.assignmentEditContextById.has(assignment.id);
  const draggable = data.assignmentMoveContextById.has(assignment.id);
  const agentName = shift
    ? (data.agentById.get(shift.agent_id)?.display_name ?? 'Agent')
    : 'Agent';

  return (
    <PlanningDraggableAssignment
      agentName={agentName}
      dragDisabled={interactions.moveDisabled}
      draggable={draggable}
      editDisabled={interactions.movingAssignmentId === assignment.id}
      editable={editable}
      id={assignment.id}
      onEdit={() => interactions.onEdit(assignment.id)}
      searchState={
        highlightedAgentIds
          ? shift && highlightedAgentIds.has(shift.agent_id)
            ? 'match'
            : 'muted'
          : undefined
      }
    >
      <strong>{agentName}</strong>
      {shift?.note?.startsWith('Dernière minute —') ? (
        <em className={styles.lastMinuteBadge}>Urgent</em>
      ) : null}
      <span>
        {timeLabel(assignment.starts_at, data.timeZone)}–
        {timeLabel(assignment.ends_at, data.timeZone)}
      </span>
    </PlanningDraggableAssignment>
  );
}

function CoverageEntry({
  covered,
  data,
  requirement,
}: Readonly<{
  covered: number;
  data: PlanningData;
  requirement: StaffingRequirement;
}>) {
  const missing = covered < requirement.required_agents;

  if (!missing) return null;

  return (
    <p className={styles.missingCoverage}>
      Besoin {timeLabel(requirement.starts_at, data.timeZone)}–
      {timeLabel(requirement.ends_at, data.timeZone)} ·{' '}
      {requirement.required_agents - covered} manquant
      {requirement.required_agents - covered > 1 ? 's' : ''}
    </p>
  );
}
