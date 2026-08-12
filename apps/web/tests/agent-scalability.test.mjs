import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { readAgentDetailSource } from './agent-detail-source.mjs';
import { readPlanningEditorSource } from './planning-editor-source.mjs';

test('la liste collaborateurs délègue recherche, statuts et pagination au serveur', async () => {
  const page = await readFile('src/app/tools/planning/agents/page.tsx', 'utf8');

  assert.match(page, /apiFetch<AgentSearchPage>\(`\/agents\/search\?/);
  assert.match(page, /pageSize: String\(AGENTS_PER_PAGE\)/);
  assert.match(page, /pageData\?\.counts\.active/);
  assert.match(page, /pageData\?\.totalPages/);
  assert.doesNotMatch(page, /visibleAgents\.slice/);
  assert.doesNotMatch(page, /agents\.filter\(\(agent\) => \{/);
});

test('le planning garde les agents affectés et recommande les candidats éligibles à la demande', async () => {
  const page = await readFile('src/app/tools/planning/page.tsx', 'utf8');
  const editor = await readPlanningEditorSource();
  const action = await readFile(
    'src/app/tools/planning/planning-editor-action.ts',
    'utf8',
  );

  assert.match(page, /assignedAgentIds/);
  assert.match(page, /includeIds\.join\(','\)/);
  assert.match(page, /activeAgentCount/);
  assert.match(action, /findPlanningCandidateRecommendations/);
  assert.match(action, /agent-candidates\/query/);
  assert.match(editor, /window\.setTimeout\(\s*\(\) => \{/);
  assert.match(editor, /findPlanningCandidateRecommendations\(\{/);
  assert.match(editor, /Recommandé/);
  assert.match(editor, /meilleurs choix en premier/);
  assert.match(editor, /selectedAgent/);
  assert.match(editor, /aria-busy=\{search\.isRecommendationPending\}/);
});

test('les groupes recherchent progressivement les collaborateurs sans liste géante', async () => {
  const page = await readFile(
    'src/app/tools/planning/groupes/page.tsx',
    'utf8',
  );

  assert.match(page, /apiFetch<AgentSearchPage>\(`\/agents\/search\?/);
  assert.match(page, /pageSize: index === 0 \? '10' : '1'/);
  assert.match(page, /name="agentQ"/);
  assert.match(page, /agentPage\?\.hasMore/);
  assert.doesNotMatch(page, /apiFetch<Agent\[\]>\(\s*`\/agents\?/);
  assert.doesNotMatch(page, /<PlatformSelect[^>]*groupAgent/);
});

test('les limites métiers sont visibles et paginées selon leur contexte', async () => {
  const planning = await readFile('src/app/tools/planning/page.tsx', 'utf8');
  const detail = await readAgentDetailSource();
  const references = await readFile(
    'src/app/tools/planning/referentiels/page.tsx',
    'utf8',
  );

  assert.match(planning, /pageSize: '3'/);
  assert.match(planning, /status: 'simulated'/);
  assert.match(planning, /baseScheduleVersionIds/);
  assert.match(planning, /scenariosResult\.data\?\.hasMore/);
  assert.doesNotMatch(planning, /\.slice\(0, 3\)/);
  assert.match(detail, /scope=upcoming&pageSize=10&page=/);
  assert.match(detail, /scope: 'past'/);
  assert.match(detail, /pastPage\?\.hasMore/);
  assert.match(references, /pageSize: '24'/);
  assert.match(references, /name="positionQ"/);
  assert.match(references, /positionsResult\.data\?\.hasMore/);
});
