import { readFile } from 'node:fs/promises';

const planningEditorFiles = [
  'src/components/planning-assignment-editor.tsx',
  'src/components/planning-assignment-editor.types.ts',
  'src/components/planning-assignment-editor.utils.ts',
  'src/components/planning-assignment-agent-field.tsx',
  'src/components/planning-assignment-primary-fields.tsx',
  'src/components/planning-assignment-advanced-fields.tsx',
  'src/components/use-planning-candidate-search.ts',
  'src/components/use-planning-dialog-focus.ts',
];

export async function readPlanningEditorSource() {
  return (
    await Promise.all(planningEditorFiles.map((file) => readFile(file, 'utf8')))
  ).join('\n');
}
