import { readFile } from 'node:fs/promises';

const AGENT_DETAIL_FILES = [
  'src/app/tools/planning/agents/[id]/page.tsx',
  'src/app/tools/planning/agents/[id]/agent-overview.tsx',
  'src/app/tools/planning/agents/[id]/agent-position-rules-section.tsx',
  'src/app/tools/planning/agents/[id]/agent-skills-section.tsx',
  'src/app/tools/planning/agents/[id]/agent-unavailability-section.tsx',
  'src/app/tools/planning/agents/[id]/agent-work-time-section.tsx',
];

export async function readAgentDetailSource() {
  return (
    await Promise.all(AGENT_DETAIL_FILES.map((path) => readFile(path, 'utf8')))
  ).join('\n');
}
