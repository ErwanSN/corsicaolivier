import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import ts from 'typescript';

const source = await readFile('src/lib/sites.ts', 'utf8');
const javascript = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const { orderSites } = await import(
  `data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`
);

test('Joliette est affichée avant Janet dans les listes de zones', () => {
  const sites = [
    { name: 'Marseille Janet' },
    { name: 'Toulon' },
    { name: 'Marseille Joliette' },
  ];

  assert.deepEqual(
    orderSites(sites).map((site) => site.name),
    ['Marseille Joliette', 'Marseille Janet', 'Toulon'],
  );
  assert.equal(sites[0].name, 'Marseille Janet');
});
