import type { Dispatch, SetStateAction } from 'react';

import type { PortCall, Position, Vessel } from '../lib/api/types';
import type {
  EditorBreak,
  EditorSegment,
} from './planning-assignment-editor.types';
import {
  callInstant,
  callTime,
  durationLabel,
} from './planning-assignment-editor.utils';
import { PlatformSelect } from './ui/platform-select';
import styles from './planning-assignment-editor.module.css';

type PlanningAssignmentPrimaryFieldsProps = Readonly<{
  breakMinutes: number;
  endsAt: string;
  isPending: boolean;
  portCallId: string;
  positionId: string;
  positions: Position[];
  setBreakMinutes: Dispatch<SetStateAction<number>>;
  setEndsAt: Dispatch<SetStateAction<string>>;
  setPortCallId: Dispatch<SetStateAction<string>>;
  setPositionId: Dispatch<SetStateAction<string>>;
  setSegments: Dispatch<SetStateAction<EditorSegment[]>>;
  setShiftBreaks: Dispatch<SetStateAction<EditorBreak[]>>;
  setStartsAt: Dispatch<SetStateAction<string>>;
  sortedCalls: PortCall[];
  startsAt: string;
  timeZone: string;
  vesselById: Map<string, Vessel>;
}>;

export function PlanningAssignmentPrimaryFields({
  breakMinutes,
  endsAt,
  isPending,
  portCallId,
  positionId,
  positions,
  setBreakMinutes,
  setEndsAt,
  setPortCallId,
  setPositionId,
  setSegments,
  setShiftBreaks,
  setStartsAt,
  sortedCalls,
  startsAt,
  timeZone,
  vesselById,
}: PlanningAssignmentPrimaryFieldsProps) {
  const updatePrimarySegment = (
    update: Partial<Pick<EditorSegment, 'positionId' | 'portCallId'>>,
  ) => {
    setSegments((current) =>
      current.map((segment, index) =>
        index === 0
          ? { ...segment, ...update, staffingRequirementId: null }
          : segment,
      ),
    );
  };

  const updateShiftStart = (value: string) => {
    setStartsAt(value);
    setSegments((current) =>
      current.map((segment, index) =>
        index === 0
          ? { ...segment, startsAt: value, staffingRequirementId: null }
          : segment,
      ),
    );
  };

  const updateShiftEnd = (value: string) => {
    setEndsAt(value);
    setSegments((current) =>
      current.map((segment, index) =>
        index === current.length - 1
          ? { ...segment, endsAt: value, staffingRequirementId: null }
          : segment,
      ),
    );
  };

  return (
    <>
      <div className={styles.field}>
        <label htmlFor="planning-editor-position">Poste</label>
        <PlatformSelect
          disabled={isPending}
          id="planning-editor-position"
          onChange={(event) => {
            setPositionId(event.target.value);
            updatePrimarySegment({ positionId: event.target.value });
          }}
          required
          value={positionId}
        >
          <option value="">Choisir un poste</option>
          {positions
            .filter((position) => position.active || position.id === positionId)
            .map((position) => (
              <option key={position.id} value={position.id}>
                {position.name}
              </option>
            ))}
        </PlatformSelect>
      </div>

      <div className={styles.timeGrid}>
        <div className={styles.field}>
          <label htmlFor="planning-editor-start">Début</label>
          <input
            className="field-input"
            disabled={isPending}
            id="planning-editor-start"
            onChange={(event) => updateShiftStart(event.target.value)}
            required
            type="datetime-local"
            value={startsAt}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="planning-editor-end">Fin</label>
          <input
            className="field-input"
            disabled={isPending}
            id="planning-editor-end"
            onChange={(event) => updateShiftEnd(event.target.value)}
            required
            type="datetime-local"
            value={endsAt}
          />
        </div>
      </div>

      <div className={styles.durationSummary} role="status">
        {durationLabel(startsAt, endsAt, breakMinutes)}
      </div>

      <div className={styles.field}>
        <label htmlFor="planning-editor-break">Pause en minutes</label>
        <input
          className="field-input"
          disabled={isPending}
          id="planning-editor-break"
          max="720"
          min="0"
          onChange={(event) => {
            setBreakMinutes(Number(event.target.value));
            setShiftBreaks([]);
          }}
          required
          step="5"
          type="number"
          value={breakMinutes}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="planning-editor-call">Escale associée</label>
        <PlatformSelect
          disabled={isPending}
          id="planning-editor-call"
          onChange={(event) => {
            setPortCallId(event.target.value);
            updatePrimarySegment({ portCallId: event.target.value || null });
          }}
          value={portCallId}
        >
          <option value="">Aucune escale</option>
          {sortedCalls.map((call) => (
            <option key={call.id} value={call.id}>
              {vesselById.get(call.vessel_id)?.name ?? 'Navire'} ·{' '}
              {callTime(callInstant(call), timeZone)}
            </option>
          ))}
        </PlatformSelect>
      </div>
    </>
  );
}
