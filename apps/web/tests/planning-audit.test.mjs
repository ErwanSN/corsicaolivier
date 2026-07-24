import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const planningPages = [
  'src/app/tools/planning/besoins/page.tsx',
  'src/app/tools/planning/escales/page.tsx',
  'src/app/tools/planning/referentiels/page.tsx',
];

test('les écrans opérationnels permettent de choisir explicitement la zone', async () => {
  for (const path of planningPages) {
    const source = await readFile(path, 'utf8');
    assert.match(source, /site\?: string/);
    assert.match(source, /params\.site/);
    assert.match(source, /SiteSwitcher/);
    assert.doesNotMatch(source, /sitesResult\.data\?\.at\(0\)/);
  }
});

test('la couverture est calculée par créneau concurrent et non par somme journalière', async () => {
  const source = await readFile(
    'src/components/weekly-planning-grid.tsx',
    'utf8',
  );

  assert.match(source, /minimumConcurrentCoverage/);
  assert.match(
    source,
    /assignment\.staffing_requirement_id === requirement\.id/,
  );
  assert.match(
    source,
    /assignment\.port_call_id === requirement\.port_call_id/,
  );
  assert.match(source, /Besoin \{timeLabel/);
  assert.doesNotMatch(source, /total \+ requirement\.required_agents/);
});

test('le calendrier opérationnel privilégie le brouillon éditable', async () => {
  const source = await readFile('src/app/tools/planning/page.tsx', 'utf8');

  assert.match(source, /draftVersion \?\?/);
  assert.match(source, /draftVersion \?\?\s+publishedVersion/);
});

test('la création manuelle des plannings a disparu du parcours', async () => {
  const planning = await readFile('src/app/tools/planning/page.tsx', 'utf8');
  const controller = await readFile(
    '../api/src/planning/planning.controller.ts',
    'utf8',
  );
  const actions = await readFile('src/app/tools/planning/actions.ts', 'utf8');

  assert.doesNotMatch(planning, /Créer une semaine|Préparer le planning/);
  assert.doesNotMatch(actions, /createShift|startPlanningWorkspace/);
  assert.doesNotMatch(controller, /planning-workspaces/);
  assert.doesNotMatch(controller, /@Post\('planning-periods'\)/);
  assert.doesNotMatch(controller, /planning-periods\/:id\/schedule-versions/);
});

test('les horaires modifiés affichent la valeur précédente barrée', async () => {
  const source = await readFile(
    'src/app/tools/planning/escales/page.tsx',
    'utf8',
  );

  assert.match(source, /function TimingDisplay/);
  assert.match(source, /line-through/);
  assert.match(source, /Ancien :/);
  assert.match(source, /Nouveau départ/);
});

test('les charges du corpus conservent le détail piétons, fret et autocars', async () => {
  const source = await readFile(
    'src/app/tools/planning/escales/page.tsx',
    'utf8',
  );

  assert.match(source, /name="passengerQuota"/);
  assert.match(source, /freight_unit_count/);
  assert.match(source, /coach_count/);
});

test('la fiche agent sépare clairement les postes appréciés et interdits', async () => {
  const page = await readFile(
    'src/app/tools/planning/agents/[id]/page.tsx',
    'utf8',
  );
  const actions = await readFile('src/app/tools/planning/actions.ts', 'utf8');

  assert.match(page, /Affectation aux postes/);
  assert.match(page, /Postes appréciés/);
  assert.match(page, /Postes déconseillés ou interdits/);
  assert.match(page, /name="kind" type="hidden" value="preference"/);
  assert.match(page, /name="kind" type="hidden" value="restriction"/);
  assert.doesNotMatch(page, /htmlFor="ruleKind"|htmlFor="ruleLevel"/);
  assert.doesNotMatch(page, /\{preference\.level\}/);
  assert.doesNotMatch(page, /Compétences|agentSkills|setAgentSkill/);
  assert.match(actions, /note: note \|\| undefined/);
});

test('le planning reprend le corpus dans une vue uniquement hebdomadaire', async () => {
  const page = await readFile('src/app/tools/planning/page.tsx', 'utf8');
  const grid = await readFile(
    'src/components/weekly-planning-grid.tsx',
    'utf8',
  );
  const styles = await readFile(
    'src/components/weekly-planning-grid.module.css',
    'utf8',
  );
  const ranges = await readFile('src/lib/planning-range.ts', 'utf8');

  assert.match(page, /visiblePeriods/);
  assert.match(page, /periodBundles/);
  assert.match(page, /Semaine précédente/);
  assert.match(page, /Semaine suivante/);
  assert.match(page, /Aujourd’hui/);
  assert.match(page, /name="date"/);
  assert.match(page, /Afficher cette semaine/);
  assert.match(
    page,
    /<a\s+className="secondary-button"\s+href=\{adjacentWeekHref/,
  );
  assert.doesNotMatch(page, /<Link[\s\S]{0,160}href=\{adjacentWeekHref/);
  assert.doesNotMatch(
    page,
    /PlanningPeriodSelector|month\?:|from\?:|to\?:|period\?:/,
  );
  assert.match(grid, /function WeeklyTable/);
  assert.match(grid, /Array\.from\(\{ length: 7 \}/);
  assert.doesNotMatch(grid, /CalendarOverview|CalendarDayCard/);
  assert.match(grid, /kind="arrival"/);
  assert.match(grid, /kind="departure"/);
  assert.match(styles, /grid-template-columns: 12rem repeat\(7,/);
  assert.match(ranges, /resolveWeeklyRange/);
  assert.doesNotMatch(ranges, /month|custom|MAX_CUSTOM_DAYS/);
});

test('l’éditeur explique les règles de repos et leurs erreurs', async () => {
  const editor = await readFile(
    'src/components/planning-assignment-editor.tsx',
    'utf8',
  );

  assert.match(editor, /6 jours consécutifs maximum/);
  assert.match(editor, /11 h minimum/);
  assert.match(editor, /06:00 ou avant/);
  assert.match(editor, /lendemain à 12:00/);
});

test('les affectations du brouillon se déplacent par glisser-déposer', async () => {
  const grid = await readFile(
    'src/components/weekly-planning-grid.tsx',
    'utf8',
  );
  const dnd = await readFile('src/components/planning-dnd.tsx', 'utf8');
  const styles = await readFile(
    'src/components/weekly-planning-grid.module.css',
    'utf8',
  );
  const actions = await readFile(
    'src/app/tools/planning/planning-editor-action.ts',
    'utf8',
  );

  assert.match(grid, /^'use client';/);
  assert.match(grid, /DndContext/);
  assert.match(grid, /MouseSensor/);
  assert.match(grid, /TouchSensor/);
  assert.match(grid, /KeyboardSensor/);
  assert.match(grid, /activationConstraint/);
  assert.match(grid, /handleDragEnd/);
  assert.match(grid, /movePlanningAssignment/);
  assert.match(grid, /content\.version\.status !== 'draft'/);
  assert.match(grid, /useMemo<PlanningData>/);
  assert.match(dnd, /useDraggable/);
  assert.match(dnd, /useDroppable/);
  assert.match(dnd, /setActivatorNodeRef/);
  assert.doesNotMatch(dnd, /style=\{/);
  assert.match(actions, /export async function movePlanningAssignment/);
  assert.match(styles, /\.dropTargetActive/);
  assert.match(styles, /\.draggableAssignment/);
  assert.match(styles, /touch-action: none/);
});

test('la grille indexe les affectations, besoins et escales sans filtrage par case', async () => {
  const grid = await readFile(
    'src/components/weekly-planning-grid.tsx',
    'utf8',
  );

  assert.match(grid, /assignmentsByCell = useMemo/);
  assert.match(grid, /requirementsByCell/);
  assert.match(grid, /arrivalCallsByDay/);
  assert.match(grid, /departureCallsByDay/);
  assert.match(grid, /assignmentsByCell\.get\(key\)/);
  assert.match(grid, /data\.requirementsByCell\.get\(key\)/);
  assert.doesNotMatch(grid, /function assignmentsForDay/);
  assert.doesNotMatch(grid, /function requirementsForDay/);
  assert.doesNotMatch(grid, /function callsForDay/);
  assert.doesNotMatch(grid, /onDragEnter|onDragLeave|onDragOver/);
});

test('le calendrier permet l’édition manuelle complète sans quitter la semaine', async () => {
  const grid = await readFile(
    'src/components/weekly-planning-grid.tsx',
    'utf8',
  );
  const editor = await readFile(
    'src/components/planning-assignment-editor.tsx',
    'utf8',
  );
  const action = await readFile(
    'src/app/tools/planning/planning-editor-action.ts',
    'utf8',
  );

  assert.match(grid, /PlanningAssignmentEditor/);
  assert.match(grid, /openCreateAssignment/);
  assert.match(grid, /openEditAssignment/);
  assert.match(grid, /\+ Ajouter/);
  assert.match(editor, /Agent affecté/);
  assert.match(editor, /Poste/);
  assert.match(editor, /type="datetime-local"/);
  assert.match(editor, /Pause en minutes/);
  assert.match(editor, /Escale associée/);
  assert.match(editor, /Note interne/);
  assert.match(editor, /Confirmer la suppression/);
  assert.match(action, /savePlanningAssignment/);
  assert.match(action, /deletePlanningAssignment/);
  assert.match(action, /method: input\.mode === 'create' \? 'POST' : 'PATCH'/);
  assert.match(action, /method: 'DELETE'/);
});

test('la semaine possède un export PDF en format A4 paysage', async () => {
  const page = await readFile('src/app/tools/planning/page.tsx', 'utf8');
  const button = await readFile(
    'src/components/planning-export-button.tsx',
    'utf8',
  );
  const globalStyles = await readFile('src/app/globals.css', 'utf8');
  const gridStyles = await readFile(
    'src/components/weekly-planning-grid.module.css',
    'utf8',
  );

  assert.match(page, /PlanningExportButton/);
  assert.match(page, /planning-print-root/);
  assert.match(button, /window\.print\(\)/);
  assert.match(button, /Exporter en PDF/);
  assert.match(globalStyles, /size: A4 landscape/);
  assert.match(globalStyles, /\[data-print-hide\]/);
  assert.match(gridStyles, /@media print/);
  assert.match(gridStyles, /grid-template-columns: 28mm repeat\(7,/);
});

test('le planning utilise la palette native du corpus Excel', async () => {
  const styles = await readFile(
    'src/components/weekly-planning-grid.module.css',
    'utf8',
  );

  for (const color of ['#ffffff', '#c0c0c0', '#969696', '#ffff00', '#99cc00']) {
    assert.match(styles.toLowerCase(), new RegExp(color));
  }
  assert.match(styles, /\.freightBand/);
  assert.match(styles, /\.missingCoverage/);
});

test('une version de planning peut être téléchargée en Excel', async () => {
  const planning = await readFile('src/app/tools/planning/page.tsx', 'utf8');
  const route = await readFile(
    'src/app/tools/planning/export/[id]/route.ts',
    'utf8',
  );

  assert.match(planning, /Exporter en Excel/);
  assert.match(planning, /activeVersionId/);
  assert.match(route, /export\.xlsx/);
  assert.match(
    route,
    /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/,
  );
});

test('le calendrier ne présente aucun workflow parallèle de replanification', async () => {
  const planning = await readFile('src/app/tools/planning/page.tsx', 'utf8');
  const actions = await readFile('src/app/tools/planning/actions.ts', 'utf8');

  assert.match(planning, /Publier cette semaine/);
  assert.match(planning, /publishSchedule/);
  assert.doesNotMatch(planning, /Horaires d’escale modifiés/);
  assert.doesNotMatch(planning, /Appliquer au planning/);
  assert.doesNotMatch(planning, /approveReplanningScenario/);
  assert.doesNotMatch(planning, /scenarioHref/);
  assert.doesNotMatch(planning, /Ouvrir le brouillon/);
  assert.doesNotMatch(actions, /approveReplanningScenario/);
  assert.doesNotMatch(actions, /\/tools\/planning\/replanification/);
  await assert.rejects(
    readFile('src/app/tools/planning/plannings/[id]/page.tsx', 'utf8'),
    { code: 'ENOENT' },
  );
  await assert.rejects(
    readFile('src/app/tools/planning/replanification/page.tsx', 'utf8'),
    { code: 'ENOENT' },
  );
  await assert.rejects(
    readFile('src/app/tools/planning/move-assignment-action.ts', 'utf8'),
    { code: 'ENOENT' },
  );
});
