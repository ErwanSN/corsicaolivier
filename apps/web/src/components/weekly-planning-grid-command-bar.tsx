import type { PlanningSummary } from './weekly-planning-grid.types';
import styles from './weekly-planning-grid.module.css';

export function PlanningCommandBar({
  agentSearch,
  deferredAgentSearch,
  highlightedAgentIds,
  matchingAssignmentCount,
  onAgentSearchChange,
  planningSummary,
  showSearch,
  showStats,
}: Readonly<{
  agentSearch: string;
  deferredAgentSearch: string;
  highlightedAgentIds: ReadonlySet<string> | null;
  matchingAssignmentCount: number;
  onAgentSearchChange: (value: string) => void;
  planningSummary: PlanningSummary;
  showSearch: boolean;
  showStats: boolean;
}>) {
  if (!showSearch && !showStats) return null;

  return (
    <section
      aria-label="Pilotage du planning"
      className={styles.commandBar}
      data-print-hide
    >
      {showSearch ? (
        <div className={styles.agentSearch}>
          <label
            className={styles.visuallyHidden}
            htmlFor="planning-agent-search"
          >
            Retrouver un collaborateur
          </label>
          <div className={styles.searchControl}>
            <input
              aria-controls="planning-week-grid"
              aria-describedby="planning-agent-search-result"
              autoComplete="off"
              id="planning-agent-search"
              onChange={(event) => onAgentSearchChange(event.target.value)}
              placeholder="Rechercher un agent"
              type="search"
              value={agentSearch}
            />
            {agentSearch ? (
              <button onClick={() => onAgentSearchChange('')} type="button">
                Effacer
              </button>
            ) : null}
          </div>
          {highlightedAgentIds ? (
            <p
              aria-busy={agentSearch !== deferredAgentSearch}
              aria-live="polite"
              id="planning-agent-search-result"
            >
              {matchingAssignmentCount
                ? `${matchingAssignmentCount} affectation${matchingAssignmentCount > 1 ? 's' : ''}`
                : 'Aucune affectation cette semaine'}
            </p>
          ) : (
            <p
              className={styles.visuallyHidden}
              id="planning-agent-search-result"
            >
              Saisissez un nom ou un matricule pour repérer ses affectations.
            </p>
          )}
        </div>
      ) : null}
      {showStats ? (
        <dl className={styles.planningStats}>
          <div>
            <dt>Agents planifiés</dt>
            <dd>
              {planningSummary.scheduledAgents}/{planningSummary.activeAgents}
            </dd>
          </div>
          <div
            className={
              planningSummary.missingAgentSlots
                ? styles.attentionStat
                : undefined
            }
          >
            <dt>Postes à couvrir</dt>
            <dd>{planningSummary.missingAgentSlots}</dd>
          </div>
        </dl>
      ) : null}
    </section>
  );
}
