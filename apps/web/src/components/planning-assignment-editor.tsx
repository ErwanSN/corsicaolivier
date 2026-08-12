'use client';

import { useMemo, useState, useTransition } from 'react';

import {
  deletePlanningAssignment,
  savePlanningAssignment,
} from '../app/tools/planning/planning-editor-action';
import { PlanningAssignmentAdvancedFields } from './planning-assignment-advanced-fields';
import { PlanningAssignmentAgentField } from './planning-assignment-agent-field';
import { PlanningAssignmentPrimaryFields } from './planning-assignment-primary-fields';
import type {
  EditorBreak,
  EditorSegment,
  PlanningAssignmentEditorProps,
} from './planning-assignment-editor.types';
import { availableCalls } from './planning-assignment-editor.utils';
import { usePlanningCandidateSearch } from './use-planning-candidate-search';
import { usePlanningDialogFocus } from './use-planning-dialog-focus';
import styles from './planning-assignment-editor.module.css';

export type { PlanningEditorTarget } from './planning-assignment-editor.types';

export function PlanningAssignmentEditor({
  agents,
  calls,
  onClose,
  onMutation,
  positions,
  target,
  timeZone,
  vessels,
}: PlanningAssignmentEditorProps) {
  const [positionId, setPositionId] = useState(target.positionId);
  const [portCallId, setPortCallId] = useState(target.portCallId ?? '');
  const [startsAt, setStartsAt] = useState(target.startsAt);
  const [endsAt, setEndsAt] = useState(target.endsAt);
  const [breakMinutes, setBreakMinutes] = useState(target.breakMinutes);
  const [segments, setSegments] = useState<EditorSegment[]>(() =>
    target.segments.map((segment) => ({ ...segment })),
  );
  const [shiftBreaks, setShiftBreaks] = useState<EditorBreak[]>(() =>
    target.breaks.map((shiftBreak) => ({ ...shiftBreak })),
  );
  const [note, setNote] = useState(target.note);
  const [lastMinuteChange, setLastMinuteChange] = useState(false);
  const [changeReason, setChangeReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(
    target.segments.length > 1 || target.breaks.length > 1,
  );
  const [isPending, startTransition] = useTransition();
  const panelRef = usePlanningDialogFocus(isPending, onClose);
  const vesselById = useMemo(
    () => new Map(vessels.map((vessel) => [vessel.id, vessel])),
    [vessels],
  );
  const sortedCalls = useMemo(
    () => availableCalls(calls, portCallId),
    [calls, portCallId],
  );
  const candidateSearch = usePlanningCandidateSearch({
    agents,
    breakMinutes,
    endsAt,
    segments,
    shiftBreaks,
    startsAt,
    target,
    timeZone,
  });

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const result = await savePlanningAssignment({
        mode: target.mode,
        shiftId: target.shiftId,
        organizationId: target.organizationId,
        siteId: target.siteId,
        scheduleVersionId: target.scheduleVersionId,
        lockVersion: target.lockVersion,
        agentId: candidateSearch.agentId,
        positionId,
        portCallId: portCallId || null,
        startsAt,
        endsAt,
        breakMinutes,
        breaks: shiftBreaks,
        segments,
        changeReason: lastMinuteChange ? changeReason : '',
        note,
        timeZone,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      onMutation({ kind: 'success', message: result.message });
      onClose();
    });
  };

  const handleDelete = () => {
    const shiftId = target.shiftId;
    if (!shiftId) return;

    setError(null);
    startTransition(async () => {
      const result = await deletePlanningAssignment({
        shiftId,
        organizationId: target.organizationId,
        siteId: target.siteId,
        scheduleVersionId: target.scheduleVersionId,
        lockVersion: target.lockVersion,
      });

      if (!result.ok) {
        setError(result.error);
        setConfirmDelete(false);
        return;
      }

      onMutation({ kind: 'success', message: result.message });
      onClose();
    });
  };

  return (
    <div
      className={styles.backdrop}
      data-print-hide
      data-svg-hide
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isPending) onClose();
      }}
      role="presentation"
    >
      <section
        aria-describedby="assignment-editor-rules"
        aria-labelledby="assignment-editor-title"
        aria-modal="true"
        className={styles.panel}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Planning manuel</p>
            <h2 id="assignment-editor-title">
              {target.mode === 'create'
                ? 'Ajouter une affectation'
                : 'Modifier l’affectation'}
            </h2>
          </div>
          <button
            aria-label="Fermer"
            className={styles.closeButton}
            disabled={isPending}
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>

        <form
          aria-busy={isPending}
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            handleSave();
          }}
        >
          <PlanningAssignmentAgentField
            isPending={isPending}
            search={candidateSearch}
          />
          <PlanningAssignmentPrimaryFields
            breakMinutes={breakMinutes}
            endsAt={endsAt}
            isPending={isPending}
            portCallId={portCallId}
            positionId={positionId}
            positions={positions}
            setBreakMinutes={setBreakMinutes}
            setEndsAt={setEndsAt}
            setPortCallId={setPortCallId}
            setPositionId={setPositionId}
            setSegments={setSegments}
            setShiftBreaks={setShiftBreaks}
            setStartsAt={setStartsAt}
            sortedCalls={sortedCalls}
            startsAt={startsAt}
            timeZone={timeZone}
            vesselById={vesselById}
          />
          <PlanningAssignmentAdvancedFields
            advancedOpen={advancedOpen}
            breakMinutes={breakMinutes}
            endsAt={endsAt}
            isPending={isPending}
            positions={positions}
            segments={segments}
            setAdvancedOpen={setAdvancedOpen}
            setBreakMinutes={setBreakMinutes}
            setSegments={setSegments}
            setShiftBreaks={setShiftBreaks}
            shiftBreaks={shiftBreaks}
            sortedCalls={sortedCalls}
            startsAt={startsAt}
            timeZone={timeZone}
            vesselById={vesselById}
          />

          <fieldset className={styles.lastMinuteChange}>
            <label className={styles.lastMinuteToggle}>
              <input
                checked={lastMinuteChange}
                disabled={isPending}
                onChange={(event) => setLastMinuteChange(event.target.checked)}
                type="checkbox"
              />
              <span>
                <strong>Modification de dernière minute</strong>
                <small>
                  Remplacement, absence soudaine ou ajustement opérationnel.
                </small>
              </span>
            </label>
            {lastMinuteChange ? (
              <div className={styles.field}>
                <label htmlFor="planning-editor-change-reason">
                  Motif opérationnel
                </label>
                <input
                  className="field-input"
                  disabled={isPending}
                  id="planning-editor-change-reason"
                  maxLength={200}
                  minLength={3}
                  onChange={(event) => setChangeReason(event.target.value)}
                  placeholder="Ex. absence signalée à 06:15"
                  required
                  value={changeReason}
                />
                <small>
                  Le motif sera conservé dans la note et dans l’audit du
                  changement.
                </small>
              </div>
            ) : null}
          </fieldset>

          <div className={styles.field}>
            <label htmlFor="planning-editor-note">Note interne</label>
            <textarea
              className="field-input"
              disabled={isPending}
              id="planning-editor-note"
              maxLength={500}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Consigne ou information utile"
              rows={3}
              value={note}
            />
          </div>

          <div
            className={styles.rules}
            id="assignment-editor-rules"
            role="note"
          >
            L’enregistrement contrôle automatiquement les chevauchements, les
            indisponibilités, les postes interdits, les habilitations et le
            repos : 11 h minimum, 6 jours consécutifs maximum et, après un
            service commencé à 06:00 ou avant, reprise le lendemain à 12:00 ou
            après.
          </div>

          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}

          {confirmDelete ? (
            <div className={styles.deleteConfirmation} role="alert">
              <strong>Supprimer définitivement ce service ?</strong>
              <span>
                Cette action retire tous ses postes et pauses du brouillon.
              </span>
              <div>
                <button
                  className="secondary-button"
                  disabled={isPending}
                  onClick={() => setConfirmDelete(false)}
                  type="button"
                >
                  Annuler
                </button>
                <button
                  className={styles.confirmDeleteButton}
                  disabled={isPending}
                  onClick={handleDelete}
                  type="button"
                >
                  Confirmer la suppression
                </button>
              </div>
            </div>
          ) : null}

          <footer className={styles.footer}>
            {target.mode === 'update' && !confirmDelete ? (
              <button
                className={styles.deleteButton}
                disabled={isPending}
                onClick={() => setConfirmDelete(true)}
                type="button"
              >
                Supprimer
              </button>
            ) : (
              <span />
            )}
            <div>
              <button
                className="secondary-button"
                disabled={isPending}
                onClick={onClose}
                type="button"
              >
                Annuler
              </button>
              <button
                className="primary-button"
                disabled={isPending}
                type="submit"
              >
                {isPending ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  );
}
