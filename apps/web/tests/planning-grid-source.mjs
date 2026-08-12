import { readFile } from 'node:fs/promises';

const planningGridModules = [
  'src/components/weekly-planning-grid.tsx',
  'src/components/weekly-planning-grid-command-bar.tsx',
  'src/components/weekly-planning-grid-table.tsx',
  'src/components/weekly-planning-grid.data.ts',
  'src/components/weekly-planning-grid.editor-target.ts',
  'src/components/weekly-planning-grid.types.ts',
  'src/components/weekly-planning-grid.utils.ts',
];

export async function readPlanningGridSource() {
  const sources = await Promise.all(
    planningGridModules.map((path) => readFile(path, 'utf8')),
  );

  return sources.join('\n');
}
