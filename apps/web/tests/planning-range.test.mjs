import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import ts from 'typescript';

const source = await readFile('src/lib/planning-range.ts', 'utf8');
const javascript = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const planningRange = await import(
  `data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`
);
const { addDays, resolveWeeklyRange } = planningRange;

test('une date choisie ouvre toujours la semaine du lundi au dimanche', () => {
  assert.deepEqual(resolveWeeklyRange('2026-07-22', '2026-01-01'), {
    startsOn: '2026-07-20',
    endsOn: '2026-07-26',
  });
});

test('les boutons précédent et suivant décalent exactement de sept jours', () => {
  assert.equal(addDays('2026-07-20', -7), '2026-07-13');
  assert.equal(addDays('2026-07-20', 7), '2026-07-27');
});
