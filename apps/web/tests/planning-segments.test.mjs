import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { readPlanningEditorSource } from './planning-editor-source.mjs';

import { readPlanningGridSource } from './planning-grid-source.mjs';

test('les services multi-postes et pauses exactes restent dans un panneau progressif', async () => {
  const editor = await readPlanningEditorSource();

  assert.match(editor, /<details[\s\S]*Organisation du service/);
  assert.match(editor, /Changements de poste/);
  assert.match(editor, /Horaires des pauses/);
  assert.match(editor, /addPositionChange/);
  assert.match(editor, /addExactBreak/);
  assert.doesNotMatch(editor, /Organisation du service<\/h[1-6]>/);
});

test('une sauvegarde remplace atomiquement le service complet', async () => {
  const action = await readFile(
    'src/app/tools/planning/planning-editor-action.ts',
    'utf8',
  );
  const controller = await readFile(
    '../api/src/planning/planning.controller.ts',
    'utf8',
  );

  assert.match(
    action,
    /schedule-versions\/\$\{input\.scheduleVersionId\}\/services/,
  );
  assert.match(action, /segments: instants\.segments/);
  assert.match(action, /breaks: instants\.breaks/);
  assert.match(controller, /createShiftService/);
  assert.match(controller, /updateShiftService/);
  assert.match(controller, /deleteShiftService/);
});

test('un service multi-poste reste éditable sans glisser-déposer ambigu', async () => {
  const grid = await readPlanningGridSource();
  const drag = await readFile('src/components/planning-dnd.tsx', 'utf8');

  assert.match(grid, /assignmentEditContextById/);
  assert.match(
    grid,
    /assignmentCounts\.get\(assignment\.planning_shift_id\) === 1/,
  );
  assert.match(grid, /draggable=\{draggable\}/);
  assert.match(grid, /breaksByShiftId/);
  assert.match(grid, /shiftBreak\.starts_at/);
  assert.match(drag, /disabled: dragDisabled \|\| !draggable/);
  assert.match(drag, /\{draggable \? \(/);
});
