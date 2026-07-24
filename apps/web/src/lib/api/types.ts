export type Site = Readonly<{
  id: string;
  organization_id: string;
  code: string;
  name: string;
  timezone: string;
  active: boolean;
}>;

export type Agent = Readonly<{
  id: string;
  organization_id: string;
  primary_site_id: string;
  employee_number: string;
  display_name: string;
  active: boolean;
  hired_on: string | null;
  left_on: string | null;
}>;

export type Position = Readonly<{
  id: string;
  organization_id: string;
  site_id: string | null;
  code: string;
  name: string;
  description: string | null;
  color_token: string;
  active: boolean;
}>;

export type PlanningPeriod = Readonly<{
  id: string;
  organization_id: string;
  site_id: string | null;
  name: string;
  starts_on: string;
  ends_on: string;
  timezone: string;
}>;

export type PortCall = Readonly<{
  id: string;
  site_id: string;
  vessel_id: string;
  demand_profile_id: string | null;
  status:
    'scheduled' | 'delayed' | 'advanced' | 'arrived' | 'departed' | 'cancelled';
  scheduled_arrival_at: string | null;
  scheduled_departure_at: string | null;
  estimated_arrival_at: string | null;
  estimated_departure_at: string | null;
  external_reference: string | null;
}>;

export type LoadForecast = Readonly<{
  id: string;
  port_call_id: string;
  passenger_count: number;
  passenger_quota: number | null;
  vehicle_count: number;
  freight_unit_count: number;
  coach_count: number;
  source: string;
  source_revision: string | null;
  received_at: string;
}>;

export type DemandProfile = Readonly<{
  id: string;
  organization_id: string;
  site_id: string;
  code: string;
  name: string;
  version: number;
  active: boolean;
}>;

export type DemandProfileLine = Readonly<{
  id: string;
  demand_profile_id: string;
  position_id: string;
  anchor: 'arrival' | 'departure';
  starts_offset_minutes: number;
  duration_minutes: number;
  base_agents: number;
  passengers_per_extra_agent: number | null;
  vehicles_per_extra_agent: number | null;
  minimum_agents: number;
  maximum_agents: number | null;
}>;

export type ScheduleVersion = Readonly<{
  id: string;
  planning_period_id: string;
  version_number: number;
  status: 'draft' | 'validated' | 'published' | 'archived';
  label: string;
  published_at: string | null;
}>;

export type AgentGroup = Readonly<{
  id: string;
  organization_id: string;
  site_id: string | null;
  code: string;
  name: string;
  description: string | null;
  weekly_target_minutes: number | null;
  monthly_target_minutes: number | null;
  active: boolean;
}>;

export type GroupMembership = Readonly<{
  id: string;
  group_id: string;
  agent_id: string;
  effective_from: string;
  effective_until: string | null;
  is_primary: boolean;
}>;

export type HourTarget = Readonly<{
  id: string;
  agent_id: string | null;
  group_id: string | null;
  week_start: string;
  target_minutes: number;
  reason: string;
}>;

export type AgentRules = Readonly<{
  preferences: ReadonlyArray<{
    id: string;
    position_id: string;
    level: 'preferred' | 'neutral' | 'avoid';
    priority: number;
    note: string | null;
    valid_from: string;
    valid_until: string | null;
  }>;
  restrictions: ReadonlyArray<{
    id: string;
    position_id: string;
    reason: string;
    valid_from: string;
    valid_until: string | null;
  }>;
  contracts: ReadonlyArray<{
    id: string;
    effective_from: string;
    effective_until: string | null;
    weekly_target_minutes: number;
    monthly_target_minutes: number | null;
    label: string | null;
  }>;
}>;

export type HourBalance = Readonly<{
  agentId: string;
  weekStart: string;
  weeklyTargetMinutes: number;
  weeklyTargetSource: string;
  scheduledWeekMinutes: number;
  weeklyVarianceMinutes: number;
  monthlyTargetMinutes: number | null;
  scheduledMonthMinutes: number;
  workedMonthMinutes: number;
  monthlyVarianceMinutes: number | null;
}>;

export type Skill = Readonly<{
  id: string;
  organization_id: string;
  code: string;
  name: string;
  description: string | null;
  active: boolean;
}>;

export type AgentSkill = Readonly<{
  id: string;
  agent_id: string;
  skill_id: string;
  level: number;
  valid_from: string;
  valid_until: string | null;
  verified_by: string | null;
}>;

export type PositionSkillRequirement = Readonly<{
  id: string;
  position_id: string;
  skill_id: string;
  minimum_level: number;
  mandatory: boolean;
}>;

export type Vessel = Readonly<{
  id: string;
  organization_id: string;
  code: string;
  name: string;
  imo_number: string | null;
  active: boolean;
}>;

export type PlanningShift = Readonly<{
  id: string;
  schedule_version_id: string;
  agent_id: string;
  starts_at: string;
  ends_at: string;
  break_minutes: number;
  origin: 'manual' | 'generated' | 'replanned';
  note: string | null;
}>;

export type ShiftAssignment = Readonly<{
  id: string;
  planning_shift_id: string;
  position_id: string;
  staffing_requirement_id: string | null;
  port_call_id: string | null;
  starts_at: string;
  ends_at: string;
}>;

export type ScheduleContent = Readonly<{
  version: ScheduleVersion &
    Readonly<{
      organization_id: string;
      site_id: string;
      planning_period_id: string;
    }>;
  period: PlanningPeriod;
  shifts: PlanningShift[];
  assignments: ShiftAssignment[];
}>;

export type StaffingRequirement = Readonly<{
  id: string;
  planning_period_id: string;
  port_call_id: string | null;
  position_id: string;
  starts_at: string;
  ends_at: string;
  required_agents: number;
}>;

export type ReplanningScenario = Readonly<{
  id: string;
  organization_id: string;
  site_id: string;
  base_schedule_version_id: string;
  candidate_schedule_version_id: string | null;
  status: 'draft' | 'simulated' | 'approved' | 'rejected' | 'applied';
  title: string;
  summary: string | null;
  created_at: string;
}>;

export type ReplanningScenarioDetail = Readonly<{
  scenario: ReplanningScenario;
  impacts: ReplanningImpact[];
}>;

export type ReplanningImpact = Readonly<{
  id: string;
  scenario_id: string;
  severity: 'information' | 'warning' | 'critical';
  impact_type: string;
  agent_id: string | null;
  planning_shift_id: string | null;
  details: Record<string, unknown>;
}>;
