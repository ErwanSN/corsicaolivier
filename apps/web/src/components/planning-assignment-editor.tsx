'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

import {
  deletePlanningAssignment,
  savePlanningAssignment,
} from '../app/tools/planning/planning-editor-action';
import type { Agent, PortCall, Position, Vessel } from '../lib/api/types';
import { PlatformSelect } from './ui/platform-select';
import styles from './planning-assignment-editor.module.css';

export type PlanningEditorTarget = Readonly<{
  mode: 'create' | 'update';
  assignmentId?: string;
  organizationId: string;
  siteId: string;
  scheduleVersionId: string;
  agentId: string;
  positionId: string;
  portCallId: string | null;
  startsAt: string;
  endsAt: string;
  breakMinutes: number;
  note: string;
}>;

type PlanningAssignmentEditorProps = Readonly<{
  agents: Agent[];
  calls: PortCall[];
  onClose: () => void;
  onMutation: (result: { kind: 'error' | 'success'; message: string }) => void;
  positions: Position[];
  target: PlanningEditorTarget;
  timeZone: string;
  vessels: Vessel[];
}>;

function callInstant(call: PortCall): string | null {
  return (
    call.estimated_arrival_at ??
    call.scheduled_arrival_at ??
    call.estimated_departure_at ??
    call.scheduled_departure_at
  );
}

function callTime(value: string | null, timeZone: string): string {
  if (!value) return 'heure inconnue';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(new Date(value));
}

function durationLabel(startsAt: string, endsAt: string, breakMinutes: number) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const totalMinutes = Math.round((end.getTime() - start.getTime()) / 60_000);

  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) {
    return 'Horaires à vérifier';
  }

  const paidMinutes = Math.max(0, totalMinutes - breakMinutes);
  const hours = Math.floor(paidMinutes / 60);
  const minutes = paidMinutes % 60;
  return `${hours} h ${String(minutes).padStart(2, '0')} de travail planifié`;
}

function normalizedSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr-FR')
    .trim();
}

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
  const [agentId, setAgentId] = useState(target.agentId);
  const [agentSearch, setAgentSearch] = useState('');
  const [positionId, setPositionId] = useState(target.positionId);
  const [portCallId, setPortCallId] = useState(target.portCallId ?? '');
  const [startsAt, setStartsAt] = useState(target.startsAt);
  const [endsAt, setEndsAt] = useState(target.endsAt);
  const [breakMinutes, setBreakMinutes] = useState(target.breakMinutes);
  const [note, setNote] = useState(target.note);
  const [lastMinuteChange, setLastMinuteChange] = useState(false);
  const [changeReason, setChangeReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, startTransition] = useTransition();
  const vesselById = useMemo(
    () => new Map(vessels.map((vessel) => [vessel.id, vessel])),
    [vessels],
  );
  const sortedCalls = useMemo(
    () =>
      [...calls]
        .filter((call) => call.status !== 'cancelled' || call.id === portCallId)
        .sort((left, right) =>
          (callInstant(left) ?? '').localeCompare(callInstant(right) ?? ''),
        ),
    [calls, portCallId],
  );
  const eligibleAgents = useMemo(
    () =>
      agents
        .filter((agent) => agent.active || agent.id === agentId)
        .sort((left, right) =>
          left.display_name.localeCompare(right.display_name, 'fr-FR', {
            sensitivity: 'base',
          }),
        ),
    [agentId, agents],
  );
  const matchingAgents = useMemo(() => {
    const query = normalizedSearch(agentSearch);
    if (!query) return eligibleAgents;

    return eligibleAgents.filter((agent) =>
      normalizedSearch(
        `${agent.display_name} ${agent.employee_number}`,
      ).includes(query),
    );
  }, [agentSearch, eligibleAgents]);
  const visibleAgents = useMemo(() => {
    const selectedAgent = eligibleAgents.find((agent) => agent.id === agentId);

    return selectedAgent &&
      !matchingAgents.some((agent) => agent.id === selectedAgent.id)
      ? [selectedAgent, ...matchingAgents]
      : matchingAgents;
  }, [agentId, eligibleAgents, matchingAgents]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isPending) onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPending, onClose]);

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const result = await savePlanningAssignment({
        mode: target.mode,
        assignmentId: target.assignmentId,
        organizationId: target.organizationId,
        siteId: target.siteId,
        scheduleVersionId: target.scheduleVersionId,
        agentId,
        positionId,
        portCallId: portCallId || null,
        startsAt,
        endsAt,
        breakMinutes,
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
    if (!target.assignmentId) return;
    setError(null);
    startTransition(async () => {
      const result = await deletePlanningAssignment({
        assignmentId: target.assignmentId!,
        organizationId: target.organizationId,
        siteId: target.siteId,
        scheduleVersionId: target.scheduleVersionId,
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
      aria-label="Fermer l’éditeur"
      className={styles.backdrop}
      data-print-hide
      data-svg-hide
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isPending) onClose();
      }}
      role="presentation"
    >
      <section
        aria-labelledby="assignment-editor-title"
        aria-modal="true"
        className={styles.panel}
        role="dialog"
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
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            handleSave();
          }}
        >
          <div className={styles.field}>
            <label htmlFor="planning-editor-agent">Agent affecté</label>
            <div className={styles.agentSearch}>
              <input
                aria-label="Rechercher un agent"
                autoComplete="off"
                autoFocus
                className="field-input"
                disabled={isPending}
                onChange={(event) => setAgentSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.preventDefault();
                }}
                placeholder="Rechercher par nom ou matricule"
                type="search"
                value={agentSearch}
              />
              {agentSearch ? (
                <button
                  disabled={isPending}
                  onClick={() => setAgentSearch('')}
                  type="button"
                >
                  Effacer
                </button>
              ) : null}
            </div>
            <p className={styles.agentResultCount} aria-live="polite">
              {agentSearch
                ? `${matchingAgents.length} résultat${matchingAgents.length > 1 ? 's' : ''}`
                : `${eligibleAgents.length} collaborateur${eligibleAgents.length > 1 ? 's' : ''} disponible${eligibleAgents.length > 1 ? 's' : ''}`}
            </p>
            <PlatformSelect
              disabled={isPending}
              id="planning-editor-agent"
              onChange={(event) => {
                setAgentId(event.target.value);
                setAgentSearch('');
              }}
              required
              value={agentId}
            >
              <option value="">Choisir un agent</option>
              {visibleAgents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.display_name} · {agent.employee_number}
                </option>
              ))}
            </PlatformSelect>
            <small>
              Changer l’agent conserve le poste et les horaires saisis.
            </small>
          </div>

          <div className={styles.field}>
            <label htmlFor="planning-editor-position">Poste</label>
            <PlatformSelect
              disabled={isPending}
              id="planning-editor-position"
              onChange={(event) => setPositionId(event.target.value)}
              required
              value={positionId}
            >
              <option value="">Choisir un poste</option>
              {positions
                .filter(
                  (position) => position.active || position.id === positionId,
                )
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
                onChange={(event) => setStartsAt(event.target.value)}
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
                onChange={(event) => setEndsAt(event.target.value)}
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
              onChange={(event) => setBreakMinutes(Number(event.target.value))}
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
              onChange={(event) => setPortCallId(event.target.value)}
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

          <aside className={styles.rules}>
            L’enregistrement contrôle automatiquement les chevauchements, les
            indisponibilités, les postes interdits, les habilitations et le
            repos : 11 h minimum, 6 jours consécutifs maximum et, après un
            service commencé à 06:00 ou avant, reprise le lendemain à 12:00 ou
            après.
          </aside>

          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}

          {confirmDelete ? (
            <div className={styles.deleteConfirmation} role="alert">
              <strong>Supprimer définitivement cette affectation ?</strong>
              <span>
                Cette action retire l’agent de cette case du brouillon.
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
