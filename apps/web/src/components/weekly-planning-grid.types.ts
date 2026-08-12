import type {
  Agent,
  PortCall,
  Position,
  ScheduleContent,
  ShiftAssignment,
  StaffingRequirement,
  Vessel,
} from '../lib/api/types';
import type { WeeklyPlanningRange } from '../lib/planning-range';

export type PlanningGridProps = Readonly<{
  activeAgentCount: number;
  agents: Agent[];
  calls: PortCall[];
  contents: ScheduleContent[];
  positions: Position[];
  range: WeeklyPlanningRange;
  requirements: StaffingRequirement[];
  siteName: string;
  timeZone: string;
  vessels: Vessel[];
}>;

export type CalendarDay = Readonly<{
  date: string;
  label: string;
  shortNumber: string;
  weekend: boolean;
}>;

export type AssignmentMoveContext = Readonly<{
  lockVersion: number;
  organizationId: string;
  scheduleVersionId: string;
  siteId: string;
}>;

export type DraftScheduleContext = AssignmentMoveContext &
  Readonly<{
    startsOn: string;
    endsOn: string;
  }>;

export type PlanningData = Readonly<{
  agentById: Map<string, Agent>;
  assignmentById: Map<string, ShiftAssignment>;
  assignmentEditContextById: Map<string, AssignmentMoveContext>;
  assignmentMoveContextById: Map<string, AssignmentMoveContext>;
  assignments: ShiftAssignment[];
  breaksByShiftId: Map<string, ScheduleContent['breaks']>;
  calls: PortCall[];
  draftContexts: DraftScheduleContext[];
  positions: Position[];
  requirements: StaffingRequirement[];
  requirementsByCell: Map<string, StaffingRequirement[]>;
  arrivalCallsByDay: Map<string, PortCall[]>;
  departureCallsByDay: Map<string, PortCall[]>;
  shiftById: Map<string, ScheduleContent['shifts'][number]>;
  timeZone: string;
  vesselById: Map<string, Vessel>;
}>;

export type MoveOverride = Readonly<{
  positionId: string;
  workDate: string;
}>;

export type MoveFeedback = Readonly<{
  kind: 'error' | 'pending' | 'success';
  message: string;
}>;

export type PlanningInteractions = Readonly<{
  canCreate: (workDate: string) => boolean;
  moveDisabled: boolean;
  movingAssignmentId: string | null;
  onCreate: (positionId: string, workDate: string) => void;
  onEdit: (assignmentId: string) => void;
}>;

export type PlanningSummary = Readonly<{
  activeAgents: number;
  missingAgentSlots: number;
  scheduledAgents: number;
}>;
