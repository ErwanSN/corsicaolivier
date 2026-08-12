import { useEffect, useMemo, useState } from 'react';

import {
  findPlanningCandidateRecommendations,
  type PlanningCandidateRecommendation,
} from '../app/tools/planning/planning-editor-action';
import type { Agent } from '../lib/api/types';
import type {
  AgentOption,
  EditorBreak,
  EditorSegment,
  PlanningEditorTarget,
} from './planning-assignment-editor.types';

type CandidateSearchInput = Readonly<{
  agents: Agent[];
  breakMinutes: number;
  endsAt: string;
  segments: EditorSegment[];
  shiftBreaks: EditorBreak[];
  startsAt: string;
  target: PlanningEditorTarget;
  timeZone: string;
}>;

export function usePlanningCandidateSearch({
  agents,
  breakMinutes,
  endsAt,
  segments,
  shiftBreaks,
  startsAt,
  target,
  timeZone,
}: CandidateSearchInput) {
  const [agentId, setAgentId] = useState(target.agentId);
  const [agentSearch, setAgentSearch] = useState('');
  const [agentSearchResults, setAgentSearchResults] = useState<
    PlanningCandidateRecommendation[]
  >([]);
  const [agentSearchTotal, setAgentSearchTotal] = useState(0);
  const [agentSearchError, setAgentSearchError] = useState<string | null>(null);
  const [isAgentSearchPending, setIsAgentSearchPending] = useState(false);
  const [resolvedRecommendationKey, setResolvedRecommendationKey] = useState<
    string | null
  >(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentOption | undefined>(
    () => {
      const agent = agents.find((item) => item.id === target.agentId);
      return agent
        ? {
            id: agent.id,
            displayName: agent.display_name,
            employeeNumber: agent.employee_number,
            recommended: false,
          }
        : undefined;
    },
  );
  const hasAgentSearch = agentSearch.trim().length >= 2;
  const recommendationContextKey = useMemo(
    () =>
      JSON.stringify({
        breakMinutes,
        breaks: shiftBreaks,
        endsAt,
        query: agentSearch.trim(),
        segments,
        startsAt,
      }),
    [agentSearch, breakMinutes, endsAt, segments, shiftBreaks, startsAt],
  );
  const isRecommendationPending =
    isAgentSearchPending ||
    resolvedRecommendationKey !== recommendationContextKey;
  const candidateOptions = useMemo<AgentOption[]>(
    () =>
      resolvedRecommendationKey === recommendationContextKey
        ? agentSearchResults.map((candidate) => ({
            id: candidate.id,
            displayName: candidate.displayName,
            employeeNumber: candidate.employeeNumber,
            explanation: candidate.explanation,
            recommended:
              candidate.rank <= 3 && candidate.preferenceLevel !== 'avoid',
          }))
        : [],
    [agentSearchResults, recommendationContextKey, resolvedRecommendationKey],
  );
  const visibleAgents = useMemo(() => {
    return selectedAgent &&
      !candidateOptions.some((agent) => agent.id === selectedAgent.id)
      ? [selectedAgent, ...candidateOptions]
      : candidateOptions;
  }, [candidateOptions, selectedAgent]);
  const selectedRecommendation = candidateOptions.find(
    (candidate) => candidate.id === agentId && candidate.recommended,
  );

  useEffect(() => {
    const query = agentSearch.trim();
    const hasInvalidContext =
      query.length === 1 ||
      !startsAt ||
      !endsAt ||
      startsAt >= endsAt ||
      !segments.length ||
      segments.some(
        (segment) =>
          !segment.positionId ||
          !segment.startsAt ||
          !segment.endsAt ||
          segment.startsAt >= segment.endsAt,
      );

    let cancelled = false;
    const timeout = window.setTimeout(
      () => {
        if (hasInvalidContext) {
          setAgentSearchResults([]);
          setAgentSearchTotal(0);
          setIsAgentSearchPending(false);
          setResolvedRecommendationKey(recommendationContextKey);
          return;
        }

        setIsAgentSearchPending(true);
        setAgentSearchError(null);
        void findPlanningCandidateRecommendations({
          organizationId: target.organizationId,
          siteId: target.siteId,
          scheduleVersionId: target.scheduleVersionId,
          shiftId: target.shiftId,
          startsAt,
          endsAt,
          breakMinutes,
          breaks: shiftBreaks,
          segments,
          query,
          timeZone,
        }).then(
          (result) => {
            if (cancelled) return;
            setIsAgentSearchPending(false);

            if (!result.ok) {
              setAgentSearchResults([]);
              setAgentSearchTotal(0);
              setAgentSearchError(result.error);
              setResolvedRecommendationKey(recommendationContextKey);
              return;
            }

            setAgentSearchResults(result.candidates);
            setAgentSearchTotal(result.total);
            setResolvedRecommendationKey(recommendationContextKey);
          },
          () => {
            if (cancelled) return;
            setIsAgentSearchPending(false);
            setAgentSearchResults([]);
            setAgentSearchTotal(0);
            setAgentSearchError('La recherche est momentanément indisponible.');
            setResolvedRecommendationKey(recommendationContextKey);
          },
        );
      },
      hasInvalidContext ? 0 : 300,
    );

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [
    agentSearch,
    breakMinutes,
    endsAt,
    recommendationContextKey,
    segments,
    shiftBreaks,
    startsAt,
    target.organizationId,
    target.scheduleVersionId,
    target.shiftId,
    target.siteId,
    timeZone,
  ]);

  const updateAgentSearch = (value: string) => {
    setAgentSearch(value);
    setAgentSearchError(null);

    if (value.trim().length === 0 || value.trim().length >= 2) {
      setIsAgentSearchPending(true);
      return;
    }

    setAgentSearchResults([]);
    setAgentSearchTotal(0);
    setIsAgentSearchPending(false);
  };

  const selectAgent = (nextAgentId: string) => {
    setAgentId(nextAgentId);
    setSelectedAgent(visibleAgents.find((agent) => agent.id === nextAgentId));
    updateAgentSearch('');
  };

  return {
    agentId,
    agentSearch,
    agentSearchError,
    agentSearchResultCount: agentSearchResults.length,
    agentSearchTotal,
    hasAgentSearch,
    isRecommendationPending,
    selectedRecommendation,
    selectAgent,
    updateAgentSearch,
    visibleAgents,
  };
}

export type PlanningCandidateSearchState = ReturnType<
  typeof usePlanningCandidateSearch
>;
