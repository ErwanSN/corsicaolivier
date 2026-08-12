import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('la page Escales délègue recherche, filtres et pagination au serveur', async () => {
  const page = await readFile(
    'src/app/tools/planning/escales/page.tsx',
    'utf8',
  );

  assert.match(page, /apiFetch<PortCallSearchPage>\(`\/port-calls\/search\?/);
  assert.match(page, /pageSize: String\(CALLS_PER_PAGE\)/);
  assert.match(page, /callSearch\?\.set\('includeId', params\.call\)/);
  assert.match(page, /callSearch\?\.set\('status', status\)/);
  assert.match(page, /callSearch\?\.set\('from'/);
  assert.match(page, /callSearch\?\.set\('to'/);
  assert.match(page, /Pagination des escales/);
  assert.match(page, /Filtrer par période/);
  assert.doesNotMatch(page, /apiFetch<PortCall\[]>\(\s*`\/port-calls\?siteId=/);
});

test('le planning ne charge que les escales utiles à la semaine et ses marges', async () => {
  const planning = await readFile('src/app/tools/planning/page.tsx', 'utf8');

  assert.match(planning, /const maritimeWindow = new URLSearchParams/);
  assert.match(planning, /addDays\(range\.startsOn, -1\)/);
  assert.match(planning, /addDays\(range\.endsOn, 2\)/);
  assert.match(
    planning,
    /apiFetch<PortCall\[]>\(`\/port-calls\?\$\{maritimeWindow\.toString\(\)\}`\)/,
  );
  assert.doesNotMatch(
    planning,
    /apiFetch<PortCall\[]>\(`\/port-calls\?siteId=/,
  );
});

test('la correction maritime est temporaire, motivée et protégée par CAS', async () => {
  const page = await readFile(
    'src/app/tools/planning/escales/page.tsx',
    'utf8',
  );
  const controller = await readFile(
    '../api/src/port-calls/port-calls.controller.ts',
    'utf8',
  );
  const action = await readFile('src/app/tools/planning/actions.ts', 'utf8');
  const service = await readFile(
    '../api/src/port-calls/port-calls.service.ts',
    'utf8',
  );

  assert.match(page, /name="expectedCurrentSourceRevision"/);
  assert.match(page, /name="expectedTimingLockVersion"/);
  assert.match(page, /name="reason"/);
  assert.match(page, /name="validUntil"/);
  assert.match(service, /client\.rpc\(\s*'override_port_call_timing'/);
  assert.match(service, /override_source: 'tools-panel'/);
  assert.match(service, /override_source_revision: null/);
  assert.doesNotMatch(service, /randomUUID/);
  assert.match(service, /input\.expectedCurrentSourceRevision \?\? null/);
  assert.match(service, /input\.expectedTimingLockVersion/);
  assert.match(
    action,
    /expectedCurrentSourceRevision: expectedCurrentSourceRevision \|\| null/,
  );
  assert.match(action, /expectedTimingLockVersion,/);
  assert.match(action, /reason,/);
  assert.match(action, /validUntil,/);
  assert.doesNotMatch(
    action,
    /updatePortCallTiming[\s\S]{0,2200}source: 'tools-panel'/,
  );
  assert.doesNotMatch(controller, /timing\/ingest/);
  assert.doesNotMatch(service, /async ingestTiming/);
});

test('les créations maritimes ne transmettent jamais de provenance choisie par le navigateur', async () => {
  const action = await readFile('src/app/tools/planning/actions.ts', 'utf8');
  const page = await readFile(
    'src/app/tools/planning/escales/page.tsx',
    'utf8',
  );
  const portCallService = await readFile(
    '../api/src/port-calls/port-calls.service.ts',
    'utf8',
  );
  const operationsService = await readFile(
    '../api/src/operations/operations.service.ts',
    'utf8',
  );

  assert.match(portCallService, /rpc\(\s*'create_manual_port_call'/);
  assert.match(operationsService, /rpc\(\s*'create_manual_call_load_forecast'/);
  assert.match(operationsService, /rpc\(\s*'override_call_load_forecast'/);
  assert.match(operationsService, /rpc\('get_latest_call_load_forecasts'/);
  assert.match(page, /const effectiveForecast = forecasts\[0\] \?\? null/);
  assert.match(page, /Prévision effective/);
  assert.match(page, /effectiveForecast\.source_received_at/);
  assert.match(page, /Motif de la correction temporaire/);
  assert.match(page, /name="expectedEffectiveForecastId"/);
  assert.doesNotMatch(page, /forecasts\[0\]\.received_at/);
  assert.doesNotMatch(
    action,
    /createPortCall[\s\S]{0,1800}source:\s*['"](?:tools-panel|corsica-linea-feed)['"]/,
  );
  assert.doesNotMatch(
    action,
    /createLoadForecast[\s\S]{0,1800}source:\s*['"](?:tools-panel|corsica-linea-feed)['"]/,
  );
});
