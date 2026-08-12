import { PlatformSelect } from './ui/platform-select';
import type { PlanningCandidateSearchState } from './use-planning-candidate-search';
import styles from './planning-assignment-editor.module.css';

type PlanningAssignmentAgentFieldProps = Readonly<{
  isPending: boolean;
  search: PlanningCandidateSearchState;
}>;

export function PlanningAssignmentAgentField({
  isPending,
  search,
}: PlanningAssignmentAgentFieldProps) {
  return (
    <div className={styles.field}>
      <label htmlFor="planning-editor-agent">Agent affecté</label>
      <div className={styles.agentSearch}>
        <input
          aria-controls="planning-editor-agent"
          aria-label="Rechercher un agent"
          autoComplete="off"
          autoFocus
          className="field-input"
          disabled={isPending}
          onChange={(event) => search.updateAgentSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.preventDefault();
          }}
          placeholder="Rechercher par nom ou matricule"
          type="search"
          value={search.agentSearch}
        />
        {search.agentSearch ? (
          <button
            disabled={isPending}
            onClick={() => search.updateAgentSearch('')}
            type="button"
          >
            Effacer
          </button>
        ) : null}
      </div>
      <p
        aria-live="polite"
        className={
          search.agentSearchError
            ? styles.agentSearchError
            : styles.agentResultCount
        }
        role={search.agentSearchError ? 'alert' : 'status'}
      >
        {search.agentSearchError
          ? search.agentSearchError
          : search.isRecommendationPending
            ? 'Recherche en cours…'
            : search.agentSearch && !search.hasAgentSearch
              ? 'Saisissez au moins deux caractères.'
              : search.hasAgentSearch
                ? `${search.agentSearchTotal} agent${search.agentSearchTotal > 1 ? 's' : ''} éligible${search.agentSearchTotal > 1 ? 's' : ''}${search.agentSearchTotal > search.agentSearchResultCount ? ` · ${search.agentSearchResultCount} affichés` : ''}`
                : `${search.agentSearchTotal} agent${search.agentSearchTotal > 1 ? 's' : ''} éligible${search.agentSearchTotal > 1 ? 's' : ''} · meilleurs choix en premier`}
      </p>
      <PlatformSelect
        aria-busy={search.isRecommendationPending}
        disabled={isPending || search.isRecommendationPending}
        id="planning-editor-agent"
        onChange={(event) => search.selectAgent(event.target.value)}
        required
        value={search.agentId}
      >
        <option value="">Choisir un agent</option>
        {search.visibleAgents.map((agent) => (
          <option key={agent.id} value={agent.id}>
            {agent.displayName} · {agent.employeeNumber}
            {agent.recommended ? ' · Recommandé' : ''}
          </option>
        ))}
      </PlatformSelect>
      <small
        className={
          search.selectedRecommendation ? styles.recommendationHint : undefined
        }
      >
        {search.selectedRecommendation
          ? `Recommandé — ${search.selectedRecommendation.explanation}`
          : 'Seuls les agents éligibles pour ce service sont proposés.'}
      </small>
    </div>
  );
}
