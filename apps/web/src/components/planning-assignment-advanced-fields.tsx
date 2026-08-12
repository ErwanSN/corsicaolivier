import type { Dispatch, SetStateAction } from 'react';

import type { PortCall, Position, Vessel } from '../lib/api/types';
import type {
  EditorBreak,
  EditorSegment,
} from './planning-assignment-editor.types';
import {
  appendExactBreak,
  appendPositionChange,
  callInstant,
  callTime,
  removePositionChange as removeSegment,
  totalBreakMinutes,
  updatePositionChange,
} from './planning-assignment-editor.utils';
import { PlatformSelect } from './ui/platform-select';
import styles from './planning-assignment-editor.module.css';

type PlanningAssignmentAdvancedFieldsProps = Readonly<{
  advancedOpen: boolean;
  breakMinutes: number;
  endsAt: string;
  isPending: boolean;
  positions: Position[];
  segments: EditorSegment[];
  setAdvancedOpen: Dispatch<SetStateAction<boolean>>;
  setBreakMinutes: Dispatch<SetStateAction<number>>;
  setSegments: Dispatch<SetStateAction<EditorSegment[]>>;
  setShiftBreaks: Dispatch<SetStateAction<EditorBreak[]>>;
  shiftBreaks: EditorBreak[];
  sortedCalls: PortCall[];
  startsAt: string;
  timeZone: string;
  vesselById: Map<string, Vessel>;
}>;

export function PlanningAssignmentAdvancedFields({
  advancedOpen,
  breakMinutes,
  endsAt,
  isPending,
  positions,
  segments,
  setAdvancedOpen,
  setBreakMinutes,
  setSegments,
  setShiftBreaks,
  shiftBreaks,
  sortedCalls,
  startsAt,
  timeZone,
  vesselById,
}: PlanningAssignmentAdvancedFieldsProps) {
  const addPositionChange = () => {
    setSegments((current) => appendPositionChange(current));
  };

  const updateSegmentChange = (
    index: number,
    update: Partial<
      Pick<EditorSegment, 'startsAt' | 'positionId' | 'portCallId'>
    >,
  ) => {
    setSegments((current) => updatePositionChange(current, index, update));
  };

  const removePositionChange = (index: number) => {
    setSegments((current) => removeSegment(current, index));
  };

  const setExactBreaks = (next: EditorBreak[]) => {
    setShiftBreaks(next);
    setBreakMinutes(Math.round(totalBreakMinutes(next)));
  };

  const addExactBreak = () => {
    const next = appendExactBreak(shiftBreaks, startsAt, endsAt, breakMinutes);
    if (next !== shiftBreaks) setExactBreaks(next);
  };

  return (
    <details
      className={styles.advancedService}
      onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}
      open={advancedOpen}
    >
      <summary>
        Organisation du service
        <span>
          {segments.length} poste{segments.length > 1 ? 's' : ''} ·{' '}
          {shiftBreaks.length
            ? `${shiftBreaks.length} pause${shiftBreaks.length > 1 ? 's' : ''} précise${shiftBreaks.length > 1 ? 's' : ''}`
            : breakMinutes
              ? 'pause centrée automatiquement'
              : 'sans pause'}
        </span>
      </summary>
      <div className={styles.advancedBody}>
        <section className={styles.advancedSection}>
          <div className={styles.advancedHeading}>
            <div>
              <strong>Changements de poste</strong>
              <small>Le premier poste reste celui choisi ci-dessus.</small>
            </div>
            <button
              disabled={isPending || segments.length >= 20}
              onClick={addPositionChange}
              type="button"
            >
              Ajouter
            </button>
          </div>
          {segments.slice(1).map((segment, offset) => {
            const index = offset + 1;
            return (
              <div className={styles.advancedRow} key={index}>
                <div className={styles.field}>
                  <label htmlFor={`planning-segment-start-${index}`}>
                    À partir de
                  </label>
                  <input
                    className="field-input"
                    disabled={isPending}
                    id={`planning-segment-start-${index}`}
                    max={segment.endsAt}
                    min={segments[index - 1]?.startsAt}
                    onChange={(event) =>
                      updateSegmentChange(index, {
                        startsAt: event.target.value,
                      })
                    }
                    required
                    type="datetime-local"
                    value={segment.startsAt}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor={`planning-segment-position-${index}`}>
                    Poste
                  </label>
                  <PlatformSelect
                    disabled={isPending}
                    id={`planning-segment-position-${index}`}
                    onChange={(event) =>
                      updateSegmentChange(index, {
                        positionId: event.target.value,
                      })
                    }
                    required
                    value={segment.positionId}
                  >
                    {positions
                      .filter(
                        (position) =>
                          position.active || position.id === segment.positionId,
                      )
                      .map((position) => (
                        <option key={position.id} value={position.id}>
                          {position.name}
                        </option>
                      ))}
                  </PlatformSelect>
                </div>
                <div className={styles.field}>
                  <label htmlFor={`planning-segment-call-${index}`}>
                    Escale
                  </label>
                  <PlatformSelect
                    disabled={isPending}
                    id={`planning-segment-call-${index}`}
                    onChange={(event) =>
                      updateSegmentChange(index, {
                        portCallId: event.target.value || null,
                      })
                    }
                    value={segment.portCallId ?? ''}
                  >
                    <option value="">Aucune</option>
                    {sortedCalls.map((call) => (
                      <option key={call.id} value={call.id}>
                        {vesselById.get(call.vessel_id)?.name ?? 'Navire'} ·{' '}
                        {callTime(callInstant(call), timeZone)}
                      </option>
                    ))}
                  </PlatformSelect>
                </div>
                <button
                  aria-label={`Supprimer le changement de poste ${index}`}
                  className={styles.removeAdvancedRow}
                  disabled={isPending}
                  onClick={() => removePositionChange(index)}
                  type="button"
                >
                  Retirer
                </button>
              </div>
            );
          })}
          {segments.length === 1 ? (
            <p className={styles.advancedEmpty}>
              Aucun changement : le poste couvre tout le service.
            </p>
          ) : null}
        </section>

        <section className={styles.advancedSection}>
          <div className={styles.advancedHeading}>
            <div>
              <strong>Horaires des pauses</strong>
              <small>
                Sans précision, la durée saisie est placée au milieu du service.
              </small>
            </div>
            <button
              disabled={isPending || shiftBreaks.length >= 10}
              onClick={addExactBreak}
              type="button"
            >
              {shiftBreaks.length ? 'Ajouter' : 'Préciser'}
            </button>
          </div>
          {shiftBreaks.map((shiftBreak, index) => (
            <div className={styles.breakRow} key={index}>
              <div className={styles.field}>
                <label htmlFor={`planning-break-start-${index}`}>Début</label>
                <input
                  className="field-input"
                  disabled={isPending}
                  id={`planning-break-start-${index}`}
                  max={endsAt}
                  min={startsAt}
                  onChange={(event) => {
                    const next = shiftBreaks.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, startsAt: event.target.value }
                        : item,
                    );
                    setExactBreaks(next);
                  }}
                  required
                  type="datetime-local"
                  value={shiftBreak.startsAt}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor={`planning-break-end-${index}`}>Fin</label>
                <input
                  className="field-input"
                  disabled={isPending}
                  id={`planning-break-end-${index}`}
                  max={endsAt}
                  min={shiftBreak.startsAt}
                  onChange={(event) => {
                    const next = shiftBreaks.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, endsAt: event.target.value }
                        : item,
                    );
                    setExactBreaks(next);
                  }}
                  required
                  type="datetime-local"
                  value={shiftBreak.endsAt}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor={`planning-break-label-${index}`}>Libellé</label>
                <input
                  className="field-input"
                  disabled={isPending}
                  id={`planning-break-label-${index}`}
                  maxLength={120}
                  onChange={(event) =>
                    setShiftBreaks((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, label: event.target.value }
                          : item,
                      ),
                    )
                  }
                  placeholder="Facultatif"
                  value={shiftBreak.label}
                />
              </div>
              <button
                aria-label={`Supprimer la pause ${index + 1}`}
                className={styles.removeAdvancedRow}
                disabled={isPending}
                onClick={() =>
                  setExactBreaks(
                    shiftBreaks.filter(
                      (_item, itemIndex) => itemIndex !== index,
                    ),
                  )
                }
                type="button"
              >
                Retirer
              </button>
            </div>
          ))}
        </section>
      </div>
    </details>
  );
}
