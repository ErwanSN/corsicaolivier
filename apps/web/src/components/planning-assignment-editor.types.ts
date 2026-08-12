import type { Agent, PortCall, Position, Vessel } from '../lib/api/types';

export type EditorSegment = {
  positionId: string;
  portCallId: string | null;
  staffingRequirementId: string | null;
  startsAt: string;
  endsAt: string;
};

export type EditorBreak = {
  startsAt: string;
  endsAt: string;
  label: string;
};

export type AgentOption = Readonly<{
  id: string;
  displayName: string;
  employeeNumber: string;
  explanation?: string;
  recommended: boolean;
}>;

export type PlanningEditorTarget = Readonly<{
  mode: 'create' | 'update';
  shiftId?: string;
  organizationId: string;
  siteId: string;
  scheduleVersionId: string;
  lockVersion: number;
  agentId: string;
  positionId: string;
  portCallId: string | null;
  startsAt: string;
  endsAt: string;
  breakMinutes: number;
  breaks: ReadonlyArray<Readonly<EditorBreak>>;
  segments: ReadonlyArray<Readonly<EditorSegment>>;
  note: string;
}>;

export type PlanningAssignmentEditorProps = Readonly<{
  agents: Agent[];
  calls: PortCall[];
  onClose: () => void;
  onMutation: (result: { kind: 'error' | 'success'; message: string }) => void;
  positions: Position[];
  target: PlanningEditorTarget;
  timeZone: string;
  vessels: Vessel[];
}>;
