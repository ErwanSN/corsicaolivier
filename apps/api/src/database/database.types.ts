export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AppRole =
  | 'platform_admin'
  | 'planning_admin'
  | 'planner'
  | 'approver'
  | 'supervisor'
  | 'agent'
  | 'hr'
  | 'auditor';

type Relationship = Readonly<{
  foreignKeyName: string;
  columns: string[];
  isOneToOne?: boolean;
  referencedRelation: string;
  referencedColumns: string[];
}>;

type Table<Row, Insert, Update = Partial<Insert>> = Readonly<{
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: Relationship[];
}>;

type OrganizationRow = Readonly<{
  id: string;
  slug: string;
  name: string;
  created_at: string;
  updated_at: string;
}>;

type SiteRow = Readonly<{
  id: string;
  organization_id: string;
  code: string;
  name: string;
  timezone: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}>;

type AgentRow = Readonly<{
  id: string;
  organization_id: string;
  primary_site_id: string;
  user_id: string | null;
  employee_number: string;
  display_name: string;
  active: boolean;
  hired_on: string | null;
  left_on: string | null;
  created_at: string;
  updated_at: string;
}>;

type PositionRow = Readonly<{
  id: string;
  organization_id: string;
  site_id: string;
  code: string;
  name: string;
  description: string | null;
  color_token: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}>;

type PortCallStatus =
  'scheduled' | 'delayed' | 'advanced' | 'arrived' | 'departed' | 'cancelled';

type PortCallRow = Readonly<{
  id: string;
  organization_id: string;
  site_id: string;
  vessel_id: string;
  route_id: string | null;
  demand_profile_id: string | null;
  external_reference: string | null;
  status: PortCallStatus;
  scheduled_arrival_at: string | null;
  scheduled_departure_at: string | null;
  estimated_arrival_at: string | null;
  estimated_departure_at: string | null;
  actual_arrival_at: string | null;
  actual_departure_at: string | null;
  source: string;
  source_revision: string | null;
  received_at: string;
  created_at: string;
  updated_at: string;
}>;

type AgentGroupRow = Readonly<{
  id: string;
  organization_id: string;
  site_id: string | null;
  code: string;
  name: string;
  description: string | null;
  weekly_target_minutes: number | null;
  monthly_target_minutes: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}>;

type HourTargetOverrideRow = Readonly<{
  id: string;
  organization_id: string;
  site_id: string | null;
  agent_id: string | null;
  group_id: string | null;
  week_start: string;
  target_minutes: number;
  reason: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}>;

type PlanningPeriodRow = Readonly<{
  id: string;
  organization_id: string;
  site_id: string;
  name: string;
  starts_on: string;
  ends_on: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}>;

type ScheduleVersionRow = Readonly<{
  id: string;
  organization_id: string;
  site_id: string;
  planning_period_id: string;
  parent_version_id: string | null;
  version_number: number;
  status: 'draft' | 'validated' | 'published' | 'archived';
  label: string;
  change_reason: string | null;
  created_by: string;
  validated_by: string | null;
  validated_at: string | null;
  published_by: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}>;

type SkillRow = Readonly<{
  id: string;
  organization_id: string;
  code: string;
  name: string;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}>;

type VesselRow = Readonly<{
  id: string;
  organization_id: string;
  code: string;
  name: string;
  imo_number: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}>;

export type Database = {
  public: {
    Tables: {
      organizations: Table<
        OrganizationRow,
        { id?: string; slug: string; name: string }
      >;
      sites: Table<
        SiteRow,
        {
          id?: string;
          organization_id: string;
          code: string;
          name: string;
          timezone?: string;
          active?: boolean;
        }
      >;
      agents: Table<
        AgentRow,
        {
          id?: string;
          organization_id: string;
          primary_site_id: string;
          user_id?: string | null;
          employee_number: string;
          display_name: string;
          active?: boolean;
          hired_on?: string | null;
          left_on?: string | null;
        }
      >;
      agent_contract_versions: Table<
        {
          id: string;
          organization_id: string;
          agent_id: string;
          effective_from: string;
          effective_until: string | null;
          weekly_target_minutes: number;
          monthly_target_minutes: number | null;
          full_time_equivalent: number;
          label: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          organization_id: string;
          agent_id: string;
          effective_from: string;
          effective_until?: string | null;
          weekly_target_minutes: number;
          monthly_target_minutes?: number | null;
          full_time_equivalent?: number;
          label?: string | null;
        }
      >;
      skills: Table<
        SkillRow,
        {
          id?: string;
          organization_id: string;
          code: string;
          name: string;
          description?: string | null;
          active?: boolean;
        }
      >;
      agent_skills: Table<
        {
          id: string;
          organization_id: string;
          agent_id: string;
          skill_id: string;
          level: number;
          valid_from: string;
          valid_until: string | null;
          verified_by: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          organization_id: string;
          agent_id: string;
          skill_id: string;
          level?: number;
          valid_from?: string;
          valid_until?: string | null;
          verified_by?: string | null;
        }
      >;
      position_skill_requirements: Table<
        {
          id: string;
          organization_id: string;
          position_id: string;
          skill_id: string;
          minimum_level: number;
          mandatory: boolean;
          created_at: string;
        },
        {
          id?: string;
          organization_id: string;
          position_id: string;
          skill_id: string;
          minimum_level?: number;
          mandatory?: boolean;
        }
      >;
      vessels: Table<
        VesselRow,
        {
          id?: string;
          organization_id: string;
          code: string;
          name: string;
          imo_number?: string | null;
          active?: boolean;
        }
      >;
      agent_groups: Table<
        AgentGroupRow,
        {
          id?: string;
          organization_id: string;
          site_id?: string | null;
          code: string;
          name: string;
          description?: string | null;
          weekly_target_minutes?: number | null;
          monthly_target_minutes?: number | null;
          active?: boolean;
        }
      >;
      agent_group_memberships: Table<
        {
          id: string;
          organization_id: string;
          group_id: string;
          agent_id: string;
          effective_from: string;
          effective_until: string | null;
          is_primary: boolean;
          created_at: string;
        },
        {
          id?: string;
          organization_id: string;
          group_id: string;
          agent_id: string;
          effective_from: string;
          effective_until?: string | null;
          is_primary?: boolean;
        }
      >;
      hour_target_overrides: Table<
        HourTargetOverrideRow,
        {
          id?: string;
          organization_id: string;
          site_id?: string | null;
          agent_id?: string | null;
          group_id?: string | null;
          week_start: string;
          target_minutes: number;
          reason: string;
          created_by: string;
        }
      >;
      agent_position_preferences: Table<
        {
          id: string;
          organization_id: string;
          agent_id: string;
          position_id: string;
          level: 'preferred' | 'neutral' | 'avoid';
          priority: number;
          note: string | null;
          valid_from: string;
          valid_until: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          organization_id: string;
          agent_id: string;
          position_id: string;
          level: 'preferred' | 'neutral' | 'avoid';
          priority?: number;
          note?: string | null;
          valid_from?: string;
          valid_until?: string | null;
          created_by: string;
        }
      >;
      agent_position_restrictions: Table<
        {
          id: string;
          organization_id: string;
          agent_id: string;
          position_id: string;
          reason: string;
          valid_from: string;
          valid_until: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          organization_id: string;
          agent_id: string;
          position_id: string;
          reason: string;
          valid_from?: string;
          valid_until?: string | null;
          created_by: string;
        }
      >;
      positions: Table<
        PositionRow,
        {
          id?: string;
          organization_id: string;
          site_id?: string | null;
          code: string;
          name: string;
          description?: string | null;
          color_token?: string;
          active?: boolean;
        }
      >;
      port_calls: Table<
        PortCallRow,
        {
          id?: string;
          organization_id: string;
          site_id: string;
          vessel_id: string;
          route_id?: string | null;
          demand_profile_id?: string | null;
          external_reference?: string | null;
          status?: PortCallStatus;
          scheduled_arrival_at?: string | null;
          scheduled_departure_at?: string | null;
          estimated_arrival_at?: string | null;
          estimated_departure_at?: string | null;
          actual_arrival_at?: string | null;
          actual_departure_at?: string | null;
          source?: string;
          source_revision?: string | null;
        }
      >;
      call_load_forecasts: Table<
        {
          id: string;
          organization_id: string;
          site_id: string;
          port_call_id: string;
          passenger_count: number;
          passenger_quota: number | null;
          vehicle_count: number;
          freight_unit_count: number;
          coach_count: number;
          source: string;
          source_revision: string | null;
          received_at: string;
          created_at: string;
        },
        {
          id?: string;
          organization_id: string;
          site_id: string;
          port_call_id: string;
          passenger_count?: number;
          passenger_quota?: number | null;
          vehicle_count?: number;
          freight_unit_count?: number;
          coach_count?: number;
          source?: string;
          source_revision?: string | null;
          received_at?: string;
        }
      >;
      demand_profiles: Table<
        {
          id: string;
          organization_id: string;
          site_id: string;
          code: string;
          name: string;
          version: number;
          active: boolean;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          organization_id: string;
          site_id: string;
          code: string;
          name: string;
          version?: number;
          active?: boolean;
        }
      >;
      demand_profile_lines: Table<
        {
          id: string;
          organization_id: string;
          site_id: string;
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
          created_at: string;
        },
        {
          id?: string;
          organization_id: string;
          site_id: string;
          demand_profile_id: string;
          position_id: string;
          anchor: 'arrival' | 'departure';
          starts_offset_minutes: number;
          duration_minutes: number;
          base_agents?: number;
          passengers_per_extra_agent?: number | null;
          vehicles_per_extra_agent?: number | null;
          minimum_agents?: number;
          maximum_agents?: number | null;
        }
      >;
      staffing_requirements: Table<
        {
          id: string;
          organization_id: string;
          site_id: string;
          planning_period_id: string;
          port_call_id: string | null;
          demand_profile_line_id: string | null;
          position_id: string;
          starts_at: string;
          ends_at: string;
          required_agents: number;
          source_revision: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          organization_id: string;
          site_id: string;
          planning_period_id: string;
          port_call_id?: string | null;
          demand_profile_line_id?: string | null;
          position_id: string;
          starts_at: string;
          ends_at: string;
          required_agents: number;
          source_revision?: string | null;
        }
      >;
      planning_periods: Table<
        PlanningPeriodRow,
        {
          id?: string;
          organization_id: string;
          site_id: string;
          name: string;
          starts_on: string;
          ends_on: string;
          timezone?: string;
        }
      >;
      schedule_versions: Table<
        ScheduleVersionRow,
        {
          id?: string;
          organization_id: string;
          site_id: string;
          planning_period_id: string;
          parent_version_id?: string | null;
          version_number: number;
          status?: ScheduleVersionRow['status'];
          label: string;
          change_reason?: string | null;
          created_by: string;
        }
      >;
      planning_shifts: Table<
        {
          id: string;
          organization_id: string;
          site_id: string;
          schedule_version_id: string;
          agent_id: string;
          starts_at: string;
          ends_at: string;
          break_minutes: number;
          origin: 'manual' | 'generated' | 'replanned';
          note: string | null;
          source_shift_id: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          organization_id: string;
          site_id: string;
          schedule_version_id: string;
          agent_id: string;
          starts_at: string;
          ends_at: string;
          break_minutes?: number;
          origin?: 'manual' | 'generated' | 'replanned';
          note?: string | null;
          source_shift_id?: string | null;
          created_by: string;
        }
      >;
      shift_assignments: Table<
        {
          id: string;
          organization_id: string;
          site_id: string;
          planning_shift_id: string;
          position_id: string;
          staffing_requirement_id: string | null;
          port_call_id: string | null;
          starts_at: string;
          ends_at: string;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          organization_id: string;
          site_id: string;
          planning_shift_id: string;
          position_id: string;
          staffing_requirement_id?: string | null;
          port_call_id?: string | null;
          starts_at: string;
          ends_at: string;
        }
      >;
      replanning_scenarios: Table<
        {
          id: string;
          organization_id: string;
          site_id: string;
          disruption_event_id: string;
          base_schedule_version_id: string;
          candidate_schedule_version_id: string | null;
          status: 'draft' | 'simulated' | 'approved' | 'rejected' | 'applied';
          title: string;
          summary: string | null;
          created_by: string;
          approved_by: string | null;
          approved_at: string | null;
          applied_at: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          organization_id: string;
          site_id: string;
          disruption_event_id: string;
          base_schedule_version_id: string;
          candidate_schedule_version_id?: string | null;
          status?: 'draft' | 'simulated' | 'approved' | 'rejected' | 'applied';
          title: string;
          summary?: string | null;
          created_by: string;
        }
      >;
      replanning_impacts: Table<
        {
          id: string;
          organization_id: string;
          site_id: string;
          scenario_id: string;
          severity: 'information' | 'warning' | 'critical';
          impact_type: string;
          agent_id: string | null;
          planning_shift_id: string | null;
          details: Json;
          acknowledged_by: string | null;
          acknowledged_at: string | null;
          created_at: string;
        },
        {
          id?: string;
          organization_id: string;
          site_id: string;
          scenario_id: string;
          severity: 'information' | 'warning' | 'critical';
          impact_type: string;
          agent_id?: string | null;
          planning_shift_id?: string | null;
          details?: Json;
        }
      >;
      audit_events: Table<
        {
          id: number;
          occurred_at: string;
          actor_user_id: string | null;
          organization_id: string | null;
          site_id: string | null;
          action: string;
          resource_type: string;
          resource_id: string | null;
          request_id: string | null;
          reason: string | null;
          before_state: Json | null;
          after_state: Json | null;
          metadata: Json;
        },
        {
          actor_user_id?: string | null;
          organization_id?: string | null;
          site_id?: string | null;
          action: string;
          resource_type: string;
          resource_id?: string | null;
          request_id?: string | null;
          reason?: string | null;
          before_state?: Json | null;
          after_state?: Json | null;
          metadata?: Json;
        }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      get_my_access_context: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      publish_schedule_version: {
        Args: {
          target_schedule_version_id: string;
          publication_reason: string;
        };
        Returns: Json;
      };
      update_port_call_timing: {
        Args: {
          target_port_call_id: string;
          new_estimated_arrival_at: string | null;
          new_estimated_departure_at: string | null;
          new_status: PortCallStatus;
          update_source: string;
          update_source_revision?: string | null;
        };
        Returns: Json;
      };
      create_schedule_version: {
        Args: {
          target_planning_period_id: string;
          version_label: string;
          version_reason?: string | null;
        };
        Returns: Json;
      };
      create_planning_shift: {
        Args: {
          target_schedule_version_id: string;
          target_agent_id: string;
          shift_starts_at: string;
          shift_ends_at: string;
          shift_break_minutes: number;
          target_position_id: string;
          target_port_call_id?: string | null;
          shift_note?: string | null;
        };
        Returns: Json;
      };
      move_planning_assignment: {
        Args: {
          target_schedule_version_id: string;
          target_assignment_id: string;
          target_work_date: string;
          target_position_id: string;
        };
        Returns: Json;
      };
      update_planning_assignment: {
        Args: {
          target_schedule_version_id: string;
          target_assignment_id: string;
          target_agent_id: string;
          target_position_id: string;
          target_port_call_id: string | null;
          shift_starts_at: string;
          shift_ends_at: string;
          shift_break_minutes: number;
          shift_note: string | null;
        };
        Returns: Json;
      };
      delete_planning_assignment: {
        Args: {
          target_schedule_version_id: string;
          target_assignment_id: string;
        };
        Returns: Json;
      };
      get_agent_hour_balance: {
        Args: {
          target_agent_id: string;
          target_week_start: string;
          target_schedule_version_id?: string | null;
        };
        Returns: Json;
      };
      generate_staffing_requirements: {
        Args: { target_planning_period_id: string };
        Returns: Json;
      };
      approve_replanning_scenario: {
        Args: { target_scenario_id: string; approval_reason: string };
        Returns: Json;
      };
    };
    Enums: {
      account_status: 'active' | 'suspended' | 'disabled';
      app_role: AppRole;
      port_call_status: PortCallStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
