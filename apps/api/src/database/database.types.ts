export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      agent_contract_versions: {
        Row: {
          agent_id: string
          created_at: string
          effective_from: string
          effective_until: string | null
          full_time_equivalent: number
          id: string
          label: string | null
          monthly_target_minutes: number | null
          organization_id: string
          updated_at: string
          weekly_target_minutes: number
        }
        Insert: {
          agent_id: string
          created_at?: string
          effective_from: string
          effective_until?: string | null
          full_time_equivalent?: number
          id?: string
          label?: string | null
          monthly_target_minutes?: number | null
          organization_id: string
          updated_at?: string
          weekly_target_minutes: number
        }
        Update: {
          agent_id?: string
          created_at?: string
          effective_from?: string
          effective_until?: string | null
          full_time_equivalent?: number
          id?: string
          label?: string | null
          monthly_target_minutes?: number | null
          organization_id?: string
          updated_at?: string
          weekly_target_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "agent_contract_versions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_contract_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_contracts_agent_same_organization"
            columns: ["agent_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      agent_group_memberships: {
        Row: {
          agent_id: string
          created_at: string
          effective_from: string
          effective_until: string | null
          group_id: string
          id: string
          is_primary: boolean
          organization_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          effective_from: string
          effective_until?: string | null
          group_id: string
          id?: string
          is_primary?: boolean
          organization_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          effective_from?: string
          effective_until?: string | null
          group_id?: string
          id?: string
          is_primary?: boolean
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_group_memberships_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_group_memberships_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "agent_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_group_memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_agent_same_organization"
            columns: ["agent_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "memberships_group_same_organization"
            columns: ["group_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "agent_groups"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      agent_groups: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string | null
          id: string
          monthly_target_minutes: number | null
          name: string
          organization_id: string
          site_id: string | null
          updated_at: string
          weekly_target_minutes: number | null
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description?: string | null
          id?: string
          monthly_target_minutes?: number | null
          name: string
          organization_id: string
          site_id?: string | null
          updated_at?: string
          weekly_target_minutes?: number | null
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          monthly_target_minutes?: number | null
          name?: string
          organization_id?: string
          site_id?: string | null
          updated_at?: string
          weekly_target_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_groups_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_groups_site_same_organization"
            columns: ["site_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      agent_notifications: {
        Row: {
          acknowledged_at: string | null
          agent_id: string
          body: string
          channel: string
          created_at: string
          failed_reason: string | null
          id: string
          idempotency_key: string
          organization_id: string
          scenario_id: string | null
          sent_at: string | null
          site_id: string
          status: Database["public"]["Enums"]["notification_status"]
          subject: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          agent_id: string
          body: string
          channel: string
          created_at?: string
          failed_reason?: string | null
          id?: string
          idempotency_key: string
          organization_id: string
          scenario_id?: string | null
          sent_at?: string | null
          site_id: string
          status?: Database["public"]["Enums"]["notification_status"]
          subject: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          agent_id?: string
          body?: string
          channel?: string
          created_at?: string
          failed_reason?: string | null
          id?: string
          idempotency_key?: string
          organization_id?: string
          scenario_id?: string | null
          sent_at?: string | null
          site_id?: string
          status?: Database["public"]["Enums"]["notification_status"]
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_notifications_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_notifications_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "replanning_scenarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_notifications_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_agent_same_organization"
            columns: ["agent_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "notifications_scenario_same_organization"
            columns: ["scenario_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "replanning_scenarios"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "notifications_site_same_organization"
            columns: ["site_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      agent_offboarding_plans: {
        Row: {
          account_disabled_at: string | null
          account_disabled_by_offboarding: boolean
          agent_id: string
          auth_ban_applied_by_offboarding: boolean
          auth_ban_value: string | null
          cancelled_at: string | null
          completed_at: string | null
          effective_at: string
          failure_count: number
          id: string
          last_error_code: string | null
          last_failed_at: string | null
          organization_id: string
          prior_auth_banned_until: string | null
          reason: string
          requested_at: string
          requested_by: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          account_disabled_at?: string | null
          account_disabled_by_offboarding?: boolean
          agent_id: string
          auth_ban_applied_by_offboarding?: boolean
          auth_ban_value?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          effective_at: string
          failure_count?: number
          id?: string
          last_error_code?: string | null
          last_failed_at?: string | null
          organization_id: string
          prior_auth_banned_until?: string | null
          reason: string
          requested_at?: string
          requested_by: string
          status: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          account_disabled_at?: string | null
          account_disabled_by_offboarding?: boolean
          agent_id?: string
          auth_ban_applied_by_offboarding?: boolean
          auth_ban_value?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          effective_at?: string
          failure_count?: number
          id?: string
          last_error_code?: string | null
          last_failed_at?: string | null
          organization_id?: string
          prior_auth_banned_until?: string | null
          reason?: string
          requested_at?: string
          requested_by?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_offboarding_plans_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: true
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_offboarding_plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_offboarding_plans_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_offboarding_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_position_preferences: {
        Row: {
          agent_id: string
          created_at: string
          created_by: string
          id: string
          level: Database["public"]["Enums"]["position_preference_level"]
          note: string | null
          organization_id: string
          position_id: string
          priority: number
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          agent_id: string
          created_at?: string
          created_by: string
          id?: string
          level: Database["public"]["Enums"]["position_preference_level"]
          note?: string | null
          organization_id: string
          position_id: string
          priority?: number
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          agent_id?: string
          created_at?: string
          created_by?: string
          id?: string
          level?: Database["public"]["Enums"]["position_preference_level"]
          note?: string | null
          organization_id?: string
          position_id?: string
          priority?: number
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_position_preferences_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_position_preferences_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_position_preferences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_position_preferences_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preferences_agent_same_organization"
            columns: ["agent_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "preferences_position_same_organization"
            columns: ["position_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      agent_position_restrictions: {
        Row: {
          agent_id: string
          created_at: string
          created_by: string
          id: string
          organization_id: string
          position_id: string
          reason: string
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          agent_id: string
          created_at?: string
          created_by: string
          id?: string
          organization_id: string
          position_id: string
          reason: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          agent_id?: string
          created_at?: string
          created_by?: string
          id?: string
          organization_id?: string
          position_id?: string
          reason?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_position_restrictions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_position_restrictions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_position_restrictions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_position_restrictions_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restrictions_agent_same_organization"
            columns: ["agent_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "restrictions_position_same_organization"
            columns: ["position_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      agent_skills: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          level: number
          organization_id: string
          skill_id: string
          updated_at: string
          valid_from: string
          valid_until: string | null
          verified_by: string | null
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          level?: number
          organization_id: string
          skill_id: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
          verified_by?: string | null
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          level?: number
          organization_id?: string
          skill_id?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_skills_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_skills_agent_same_organization"
            columns: ["agent_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "agent_skills_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_skills_skill_same_organization"
            columns: ["skill_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "agent_skills_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_unavailability: {
        Row: {
          agent_id: string
          created_at: string
          created_by: string
          ends_at: string
          id: string
          kind: Database["public"]["Enums"]["unavailability_kind"]
          note: string | null
          organization_id: string
          site_id: string
          starts_at: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          created_by: string
          ends_at: string
          id?: string
          kind: Database["public"]["Enums"]["unavailability_kind"]
          note?: string | null
          organization_id: string
          site_id: string
          starts_at: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          created_by?: string
          ends_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["unavailability_kind"]
          note?: string | null
          organization_id?: string
          site_id?: string
          starts_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_unavailability_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_unavailability_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_unavailability_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_unavailability_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unavailability_agent_same_organization"
            columns: ["agent_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "unavailability_site_same_organization"
            columns: ["site_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      agents: {
        Row: {
          active: boolean
          created_at: string
          display_name: string
          employee_number: string
          hired_on: string | null
          id: string
          left_on: string | null
          organization_id: string
          primary_site_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_name: string
          employee_number: string
          hired_on?: string | null
          id?: string
          left_on?: string | null
          organization_id: string
          primary_site_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          display_name?: string
          employee_number?: string
          hired_on?: string | null
          id?: string
          left_on?: string | null
          organization_id?: string
          primary_site_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agents_primary_site_id_fkey"
            columns: ["primary_site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agents_site_same_organization"
            columns: ["primary_site_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "agents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      app_users: {
        Row: {
          created_at: string
          display_name: string
          email: string | null
          id: string
          status: Database["public"]["Enums"]["account_status"]
          status_changed_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          email?: string | null
          id: string
          status?: Database["public"]["Enums"]["account_status"]
          status_changed_at?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string | null
          id?: string
          status?: Database["public"]["Enums"]["account_status"]
          status_changed_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_events: {
        Row: {
          action: string
          actor_user_id: string | null
          after_state: Json | null
          before_state: Json | null
          id: number
          metadata: Json
          occurred_at: string
          organization_id: string | null
          reason: string | null
          request_id: string | null
          resource_id: string | null
          resource_type: string
          site_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          id?: never
          metadata?: Json
          occurred_at?: string
          organization_id?: string | null
          reason?: string | null
          request_id?: string | null
          resource_id?: string | null
          resource_type: string
          site_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          id?: never
          metadata?: Json
          occurred_at?: string
          organization_id?: string | null
          reason?: string | null
          request_id?: string | null
          resource_id?: string | null
          resource_type?: string
          site_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      call_load_forecast_overrides: {
        Row: {
          created_at: string
          created_by: string
          forecast_id: string
          id: string
          organization_id: string
          port_call_id: string
          previous_effective_forecast_id: string | null
          reason: string
          resumed_at: string | null
          resumed_reason: string | null
          site_id: string
          valid_until: string
        }
        Insert: {
          created_at?: string
          created_by: string
          forecast_id: string
          id?: string
          organization_id: string
          port_call_id: string
          previous_effective_forecast_id?: string | null
          reason: string
          resumed_at?: string | null
          resumed_reason?: string | null
          site_id: string
          valid_until: string
        }
        Update: {
          created_at?: string
          created_by?: string
          forecast_id?: string
          id?: string
          organization_id?: string
          port_call_id?: string
          previous_effective_forecast_id?: string | null
          reason?: string
          resumed_at?: string | null
          resumed_reason?: string | null
          site_id?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_load_forecast_overrides_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_load_forecast_overrides_forecast_id_fkey"
            columns: ["forecast_id"]
            isOneToOne: true
            referencedRelation: "call_load_forecasts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_load_forecast_overrides_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_load_forecast_overrides_port_call_id_fkey"
            columns: ["port_call_id"]
            isOneToOne: false
            referencedRelation: "port_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_load_forecast_overrides_previous_effective_forecast_i_fkey"
            columns: ["previous_effective_forecast_id"]
            isOneToOne: false
            referencedRelation: "call_load_forecasts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_load_forecast_overrides_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      call_load_forecast_source_policies: {
        Row: {
          active: boolean
          created_at: string
          ordered_updates_required: boolean
          organization_id: string
          priority: number
          source: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          ordered_updates_required?: boolean
          organization_id: string
          priority?: number
          source: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          ordered_updates_required?: boolean
          organization_id?: string
          priority?: number
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_load_forecast_source_policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      call_load_forecasts: {
        Row: {
          coach_count: number
          created_at: string
          freight_unit_count: number
          id: string
          organization_id: string
          passenger_count: number
          passenger_quota: number | null
          payload_fingerprint: string
          port_call_id: string
          received_at: string
          site_id: string
          source: string
          source_priority: number
          source_received_at: string
          source_revision: string | null
          source_sequence: number
          vehicle_count: number
        }
        Insert: {
          coach_count?: number
          created_at?: string
          freight_unit_count?: number
          id?: string
          organization_id: string
          passenger_count?: number
          passenger_quota?: number | null
          payload_fingerprint: string
          port_call_id: string
          received_at?: string
          site_id: string
          source?: string
          source_priority?: number
          source_received_at?: string
          source_revision?: string | null
          source_sequence: number
          vehicle_count?: number
        }
        Update: {
          coach_count?: number
          created_at?: string
          freight_unit_count?: number
          id?: string
          organization_id?: string
          passenger_count?: number
          passenger_quota?: number | null
          payload_fingerprint?: string
          port_call_id?: string
          received_at?: string
          site_id?: string
          source?: string
          source_priority?: number
          source_received_at?: string
          source_revision?: string | null
          source_sequence?: number
          vehicle_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "call_load_forecasts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_load_forecasts_port_call_id_fkey"
            columns: ["port_call_id"]
            isOneToOne: false
            referencedRelation: "port_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_load_forecasts_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forecasts_call_same_organization"
            columns: ["port_call_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "port_calls"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "forecasts_site_same_organization"
            columns: ["site_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      demand_profile_lines: {
        Row: {
          anchor: Database["public"]["Enums"]["demand_anchor"]
          base_agents: number
          coaches_per_extra_agent: number | null
          created_at: string
          demand_profile_id: string
          duration_minutes: number
          freight_units_per_extra_agent: number | null
          id: string
          maximum_agents: number | null
          minimum_agents: number
          organization_id: string
          passengers_per_extra_agent: number | null
          position_id: string
          site_id: string
          starts_offset_minutes: number
          vehicles_per_extra_agent: number | null
        }
        Insert: {
          anchor: Database["public"]["Enums"]["demand_anchor"]
          base_agents?: number
          coaches_per_extra_agent?: number | null
          created_at?: string
          demand_profile_id: string
          duration_minutes: number
          freight_units_per_extra_agent?: number | null
          id?: string
          maximum_agents?: number | null
          minimum_agents?: number
          organization_id: string
          passengers_per_extra_agent?: number | null
          position_id: string
          site_id: string
          starts_offset_minutes: number
          vehicles_per_extra_agent?: number | null
        }
        Update: {
          anchor?: Database["public"]["Enums"]["demand_anchor"]
          base_agents?: number
          coaches_per_extra_agent?: number | null
          created_at?: string
          demand_profile_id?: string
          duration_minutes?: number
          freight_units_per_extra_agent?: number | null
          id?: string
          maximum_agents?: number | null
          minimum_agents?: number
          organization_id?: string
          passengers_per_extra_agent?: number | null
          position_id?: string
          site_id?: string
          starts_offset_minutes?: number
          vehicles_per_extra_agent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "demand_lines_position_same_organization"
            columns: ["position_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "demand_lines_profile_same_organization"
            columns: ["demand_profile_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "demand_profiles"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "demand_lines_site_same_organization"
            columns: ["site_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "demand_profile_lines_demand_profile_id_fkey"
            columns: ["demand_profile_id"]
            isOneToOne: false
            referencedRelation: "demand_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_profile_lines_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_profile_lines_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_profile_lines_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      demand_profiles: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          name: string
          organization_id: string
          site_id: string
          updated_at: string
          version: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          name: string
          organization_id: string
          site_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          site_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "demand_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_profiles_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_profiles_site_same_organization"
            columns: ["site_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      disruption_events: {
        Row: {
          created_at: string
          created_by: string | null
          detected_at: string
          id: string
          kind: Database["public"]["Enums"]["disruption_kind"]
          new_arrival_at: string | null
          new_departure_at: string | null
          organization_id: string
          port_call_id: string
          previous_arrival_at: string | null
          previous_departure_at: string | null
          site_id: string
          source: string
          source_revision: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          detected_at?: string
          id?: string
          kind: Database["public"]["Enums"]["disruption_kind"]
          new_arrival_at?: string | null
          new_departure_at?: string | null
          organization_id: string
          port_call_id: string
          previous_arrival_at?: string | null
          previous_departure_at?: string | null
          site_id: string
          source: string
          source_revision?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          detected_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["disruption_kind"]
          new_arrival_at?: string | null
          new_departure_at?: string | null
          organization_id?: string
          port_call_id?: string
          previous_arrival_at?: string | null
          previous_departure_at?: string | null
          site_id?: string
          source?: string
          source_revision?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "disruption_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disruption_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disruption_events_port_call_id_fkey"
            columns: ["port_call_id"]
            isOneToOne: false
            referencedRelation: "port_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disruption_events_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disruptions_call_same_organization"
            columns: ["port_call_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "port_calls"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "disruptions_site_same_organization"
            columns: ["site_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      hour_target_overrides: {
        Row: {
          agent_id: string | null
          created_at: string
          created_by: string
          group_id: string | null
          id: string
          organization_id: string
          reason: string
          site_id: string | null
          target_minutes: number
          updated_at: string
          week_start: string
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          created_by: string
          group_id?: string | null
          id?: string
          organization_id: string
          reason: string
          site_id?: string | null
          target_minutes: number
          updated_at?: string
          week_start: string
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          created_by?: string
          group_id?: string | null
          id?: string
          organization_id?: string
          reason?: string
          site_id?: string | null
          target_minutes?: number
          updated_at?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "hour_target_overrides_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hour_target_overrides_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hour_target_overrides_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "agent_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hour_target_overrides_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hour_target_overrides_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hour_targets_agent_same_organization"
            columns: ["agent_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "hour_targets_group_same_organization"
            columns: ["group_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "agent_groups"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "hour_targets_site_same_organization"
            columns: ["site_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      outbox_dead_letters: {
        Row: {
          attempt_count: number
          dead_lettered_at: string
          event_id: string
          idempotency_key: string
          organization_id: string
          reason: string
          requeue_reason: string | null
          requeued_at: string | null
          site_id: string | null
          topic: string
        }
        Insert: {
          attempt_count: number
          dead_lettered_at?: string
          event_id: string
          idempotency_key: string
          organization_id: string
          reason: string
          requeue_reason?: string | null
          requeued_at?: string | null
          site_id?: string | null
          topic: string
        }
        Update: {
          attempt_count?: number
          dead_lettered_at?: string
          event_id?: string
          idempotency_key?: string
          organization_id?: string
          reason?: string
          requeue_reason?: string | null
          requeued_at?: string | null
          site_id?: string | null
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "outbox_dead_letters_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "outbox_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbox_dead_letters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbox_dead_letters_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      outbox_delivery_attempts: {
        Row: {
          attempt_number: number
          claimed_at: string
          error_message: string | null
          event_id: string
          finished_at: string | null
          id: number
          lease_token: string
          notification_count: number | null
          status: string
          worker_id: string
        }
        Insert: {
          attempt_number: number
          claimed_at?: string
          error_message?: string | null
          event_id: string
          finished_at?: string | null
          id?: never
          lease_token: string
          notification_count?: number | null
          status: string
          worker_id: string
        }
        Update: {
          attempt_number?: number
          claimed_at?: string
          error_message?: string | null
          event_id?: string
          finished_at?: string | null
          id?: never
          lease_token?: string
          notification_count?: number | null
          status?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outbox_delivery_attempts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "outbox_events"
            referencedColumns: ["id"]
          },
        ]
      }
      outbox_event_recipients: {
        Row: {
          agent_id: string
          captured_at: string
          event_id: string
          id: number
          organization_id: string
          scenario_id: string | null
          site_id: string
        }
        Insert: {
          agent_id: string
          captured_at?: string
          event_id: string
          id?: never
          organization_id: string
          scenario_id?: string | null
          site_id: string
        }
        Update: {
          agent_id?: string
          captured_at?: string
          event_id?: string
          id?: never
          organization_id?: string
          scenario_id?: string | null
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outbox_event_recipients_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbox_event_recipients_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "outbox_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbox_event_recipients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbox_event_recipients_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "replanning_scenarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbox_event_recipients_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      outbox_events: {
        Row: {
          aggregate_id: string
          aggregate_type: string
          attempt_count: number
          available_at: string
          created_at: string
          dead_letter_reason: string | null
          dead_lettered_at: string | null
          id: string
          idempotency_key: string
          last_error: string | null
          lease_token: string | null
          leased_by: string | null
          leased_until: string | null
          max_attempts: number
          organization_id: string
          payload: Json
          processed_at: string | null
          site_id: string | null
          topic: string
        }
        Insert: {
          aggregate_id: string
          aggregate_type: string
          attempt_count?: number
          available_at?: string
          created_at?: string
          dead_letter_reason?: string | null
          dead_lettered_at?: string | null
          id?: string
          idempotency_key: string
          last_error?: string | null
          lease_token?: string | null
          leased_by?: string | null
          leased_until?: string | null
          max_attempts?: number
          organization_id: string
          payload: Json
          processed_at?: string | null
          site_id?: string | null
          topic: string
        }
        Update: {
          aggregate_id?: string
          aggregate_type?: string
          attempt_count?: number
          available_at?: string
          created_at?: string
          dead_letter_reason?: string | null
          dead_lettered_at?: string | null
          id?: string
          idempotency_key?: string
          last_error?: string | null
          lease_token?: string | null
          leased_by?: string | null
          leased_until?: string | null
          max_attempts?: number
          organization_id?: string
          payload?: Json
          processed_at?: string | null
          site_id?: string | null
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "outbox_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbox_events_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      outbox_requeue_audit: {
        Row: {
          event_id: string
          id: number
          organization_id: string
          previous_attempt_count: number
          reason: string
          requeued_actor: string
          requeued_at: string
          requeued_by: string | null
        }
        Insert: {
          event_id: string
          id?: never
          organization_id: string
          previous_attempt_count: number
          reason: string
          requeued_actor?: string
          requeued_at?: string
          requeued_by?: string | null
        }
        Update: {
          event_id?: string
          id?: never
          organization_id?: string
          previous_attempt_count?: number
          reason?: string
          requeued_actor?: string
          requeued_at?: string
          requeued_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outbox_requeue_audit_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbox_requeue_audit_requeued_by_fkey"
            columns: ["requeued_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      planning_periods: {
        Row: {
          created_at: string
          ends_on: string
          id: string
          name: string
          organization_id: string
          site_id: string
          starts_on: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_on: string
          id?: string
          name: string
          organization_id: string
          site_id: string
          starts_on: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_on?: string
          id?: string
          name?: string
          organization_id?: string
          site_id?: string
          starts_on?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "planning_periods_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_periods_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_periods_site_same_organization"
            columns: ["site_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      planning_shift_breaks: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          label: string | null
          organization_id: string
          planning_shift_id: string
          site_id: string
          starts_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          label?: string | null
          organization_id: string
          planning_shift_id: string
          site_id: string
          starts_at: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          label?: string | null
          organization_id?: string
          planning_shift_id?: string
          site_id?: string
          starts_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "planning_shift_breaks_shift_same_organization"
            columns: ["planning_shift_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "planning_shifts"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "planning_shift_breaks_site_same_organization"
            columns: ["site_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      planning_shifts: {
        Row: {
          agent_id: string
          break_minutes: number
          created_at: string
          created_by: string
          ends_at: string
          id: string
          note: string | null
          organization_id: string
          origin: Database["public"]["Enums"]["shift_origin"]
          schedule_version_id: string
          site_id: string
          source_shift_id: string | null
          starts_at: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          break_minutes?: number
          created_at?: string
          created_by: string
          ends_at: string
          id?: string
          note?: string | null
          organization_id: string
          origin?: Database["public"]["Enums"]["shift_origin"]
          schedule_version_id: string
          site_id: string
          source_shift_id?: string | null
          starts_at: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          break_minutes?: number
          created_at?: string
          created_by?: string
          ends_at?: string
          id?: string
          note?: string | null
          organization_id?: string
          origin?: Database["public"]["Enums"]["shift_origin"]
          schedule_version_id?: string
          site_id?: string
          source_shift_id?: string | null
          starts_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "planning_shifts_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_shifts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_shifts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_shifts_schedule_version_id_fkey"
            columns: ["schedule_version_id"]
            isOneToOne: false
            referencedRelation: "schedule_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_shifts_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_shifts_source_same_organization"
            columns: ["source_shift_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "planning_shifts"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "planning_shifts_source_shift_id_fkey"
            columns: ["source_shift_id"]
            isOneToOne: false
            referencedRelation: "planning_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_agent_same_organization"
            columns: ["agent_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "shifts_schedule_same_organization"
            columns: ["schedule_version_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "schedule_versions"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "shifts_site_same_organization"
            columns: ["site_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      planning_workforce_conflicts: {
        Row: {
          agent_id: string
          conflict_kind: string
          created_at: string
          details: Json
          detected_at: string
          detection_generation: number
          id: string
          last_detected_at: string
          notified_generation: number
          organization_id: string
          planning_shift_id: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          schedule_version_id: string
          site_id: string
          status: string
          summary: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          conflict_kind: string
          created_at?: string
          details?: Json
          detected_at?: string
          detection_generation?: number
          id?: string
          last_detected_at?: string
          notified_generation?: number
          organization_id: string
          planning_shift_id: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          schedule_version_id: string
          site_id: string
          status?: string
          summary: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          conflict_kind?: string
          created_at?: string
          details?: Json
          detected_at?: string
          detection_generation?: number
          id?: string
          last_detected_at?: string
          notified_generation?: number
          organization_id?: string
          planning_shift_id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          schedule_version_id?: string
          site_id?: string
          status?: string
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "planning_workforce_conflicts_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_workforce_conflicts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_workforce_conflicts_planning_shift_id_fkey"
            columns: ["planning_shift_id"]
            isOneToOne: false
            referencedRelation: "planning_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_workforce_conflicts_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_workforce_conflicts_schedule_version_id_fkey"
            columns: ["schedule_version_id"]
            isOneToOne: false
            referencedRelation: "schedule_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_workforce_conflicts_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      port_call_revisions: {
        Row: {
          actual_arrival_at: string | null
          actual_departure_at: string | null
          demand_profile_id: string | null
          estimated_arrival_at: string | null
          estimated_departure_at: string | null
          id: number
          organization_id: string
          payload_fingerprint: string | null
          port_call_id: string
          recorded_at: string
          recorded_by: string | null
          revision_kind: string
          scheduled_arrival_at: string | null
          scheduled_departure_at: string | null
          site_id: string
          source: string
          source_priority: number
          source_revision: string | null
          source_sequence: number | null
          status: Database["public"]["Enums"]["port_call_status"]
          timing_lock_version: number
        }
        Insert: {
          actual_arrival_at?: string | null
          actual_departure_at?: string | null
          demand_profile_id?: string | null
          estimated_arrival_at?: string | null
          estimated_departure_at?: string | null
          id?: never
          organization_id: string
          payload_fingerprint?: string | null
          port_call_id: string
          recorded_at?: string
          recorded_by?: string | null
          revision_kind?: string
          scheduled_arrival_at?: string | null
          scheduled_departure_at?: string | null
          site_id: string
          source: string
          source_priority?: number
          source_revision?: string | null
          source_sequence?: number | null
          status: Database["public"]["Enums"]["port_call_status"]
          timing_lock_version?: number
        }
        Update: {
          actual_arrival_at?: string | null
          actual_departure_at?: string | null
          demand_profile_id?: string | null
          estimated_arrival_at?: string | null
          estimated_departure_at?: string | null
          id?: never
          organization_id?: string
          payload_fingerprint?: string | null
          port_call_id?: string
          recorded_at?: string
          recorded_by?: string | null
          revision_kind?: string
          scheduled_arrival_at?: string | null
          scheduled_departure_at?: string | null
          site_id?: string
          source?: string
          source_priority?: number
          source_revision?: string | null
          source_sequence?: number | null
          status?: Database["public"]["Enums"]["port_call_status"]
          timing_lock_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "port_call_revisions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "port_call_revisions_port_call_id_fkey"
            columns: ["port_call_id"]
            isOneToOne: false
            referencedRelation: "port_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "port_call_revisions_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "port_call_revisions_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revisions_call_same_organization"
            columns: ["port_call_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "port_calls"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "revisions_site_same_organization"
            columns: ["site_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      port_call_source_cursors: {
        Row: {
          accepted_count: number
          last_payload_fingerprint: string
          last_received_at: string
          last_revision: string | null
          last_sequence: number | null
          organization_id: string
          port_call_id: string
          site_id: string
          source: string
          source_priority: number
          updated_at: string
        }
        Insert: {
          accepted_count?: number
          last_payload_fingerprint: string
          last_received_at: string
          last_revision?: string | null
          last_sequence?: number | null
          organization_id: string
          port_call_id: string
          site_id: string
          source: string
          source_priority: number
          updated_at?: string
        }
        Update: {
          accepted_count?: number
          last_payload_fingerprint?: string
          last_received_at?: string
          last_revision?: string | null
          last_sequence?: number | null
          organization_id?: string
          port_call_id?: string
          site_id?: string
          source?: string
          source_priority?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "port_call_source_cursors_port_call_id_organization_id_fkey"
            columns: ["port_call_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "port_calls"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      port_call_source_overrides: {
        Row: {
          created_at: string
          created_by: string
          id: string
          organization_id: string
          override_state: Json
          port_call_id: string
          previous_state: Json
          reason: string
          resumed_at: string | null
          resumed_by_source: string | null
          site_id: string
          valid_until: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          organization_id: string
          override_state: Json
          port_call_id: string
          previous_state: Json
          reason: string
          resumed_at?: string | null
          resumed_by_source?: string | null
          site_id: string
          valid_until: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          organization_id?: string
          override_state?: Json
          port_call_id?: string
          previous_state?: Json
          reason?: string
          resumed_at?: string | null
          resumed_by_source?: string | null
          site_id?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "port_call_source_overrides_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "port_call_source_overrides_port_call_id_organization_id_fkey"
            columns: ["port_call_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "port_calls"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      port_call_source_policies: {
        Row: {
          active: boolean
          created_at: string
          ordered_updates_required: boolean
          organization_id: string
          priority: number
          source: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          ordered_updates_required?: boolean
          organization_id: string
          priority?: number
          source: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          ordered_updates_required?: boolean
          organization_id?: string
          priority?: number
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "port_call_source_policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      port_calls: {
        Row: {
          actual_arrival_at: string | null
          actual_departure_at: string | null
          created_at: string
          demand_profile_id: string | null
          estimated_arrival_at: string | null
          estimated_departure_at: string | null
          external_reference: string | null
          id: string
          organization_id: string
          received_at: string
          route_id: string | null
          scheduled_arrival_at: string | null
          scheduled_departure_at: string | null
          site_id: string
          source: string
          source_override_until: string | null
          source_priority: number
          source_received_at: string
          source_revision: string | null
          source_sequence: number | null
          status: Database["public"]["Enums"]["port_call_status"]
          timing_lock_version: number
          timing_payload_fingerprint: string | null
          updated_at: string
          vessel_id: string
        }
        Insert: {
          actual_arrival_at?: string | null
          actual_departure_at?: string | null
          created_at?: string
          demand_profile_id?: string | null
          estimated_arrival_at?: string | null
          estimated_departure_at?: string | null
          external_reference?: string | null
          id?: string
          organization_id: string
          received_at?: string
          route_id?: string | null
          scheduled_arrival_at?: string | null
          scheduled_departure_at?: string | null
          site_id: string
          source?: string
          source_override_until?: string | null
          source_priority?: number
          source_received_at?: string
          source_revision?: string | null
          source_sequence?: number | null
          status?: Database["public"]["Enums"]["port_call_status"]
          timing_lock_version?: number
          timing_payload_fingerprint?: string | null
          updated_at?: string
          vessel_id: string
        }
        Update: {
          actual_arrival_at?: string | null
          actual_departure_at?: string | null
          created_at?: string
          demand_profile_id?: string | null
          estimated_arrival_at?: string | null
          estimated_departure_at?: string | null
          external_reference?: string | null
          id?: string
          organization_id?: string
          received_at?: string
          route_id?: string | null
          scheduled_arrival_at?: string | null
          scheduled_departure_at?: string | null
          site_id?: string
          source?: string
          source_override_until?: string | null
          source_priority?: number
          source_received_at?: string
          source_revision?: string | null
          source_sequence?: number | null
          status?: Database["public"]["Enums"]["port_call_status"]
          timing_lock_version?: number
          timing_payload_fingerprint?: string | null
          updated_at?: string
          vessel_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "port_calls_demand_profile_id_fkey"
            columns: ["demand_profile_id"]
            isOneToOne: false
            referencedRelation: "demand_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "port_calls_demand_profile_same_organization"
            columns: ["demand_profile_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "demand_profiles"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "port_calls_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "port_calls_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "port_calls_route_same_organization"
            columns: ["route_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "port_calls_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "port_calls_site_same_organization"
            columns: ["site_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "port_calls_vessel_id_fkey"
            columns: ["vessel_id"]
            isOneToOne: false
            referencedRelation: "vessels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "port_calls_vessel_same_organization"
            columns: ["vessel_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "vessels"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      ports: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          name: string
          organization_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          name: string
          organization_id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      position_skill_requirements: {
        Row: {
          created_at: string
          id: string
          mandatory: boolean
          minimum_level: number
          organization_id: string
          position_id: string
          skill_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mandatory?: boolean
          minimum_level?: number
          organization_id: string
          position_id: string
          skill_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mandatory?: boolean
          minimum_level?: number
          organization_id?: string
          position_id?: string
          skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "position_requirements_position_same_organization"
            columns: ["position_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "position_requirements_skill_same_organization"
            columns: ["skill_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "position_skill_requirements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "position_skill_requirements_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "position_skill_requirements_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      positions: {
        Row: {
          active: boolean
          code: string
          color_token: string
          created_at: string
          description: string | null
          id: string
          name: string
          organization_id: string
          site_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          color_token?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          site_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          color_token?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          site_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "positions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positions_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positions_site_same_organization"
            columns: ["site_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      replanning_impacts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          agent_id: string | null
          created_at: string
          details: Json
          id: string
          impact_type: string
          organization_id: string
          planning_shift_id: string | null
          scenario_id: string
          severity: Database["public"]["Enums"]["impact_severity"]
          site_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          agent_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          impact_type: string
          organization_id: string
          planning_shift_id?: string | null
          scenario_id: string
          severity: Database["public"]["Enums"]["impact_severity"]
          site_id: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          agent_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          impact_type?: string
          organization_id?: string
          planning_shift_id?: string | null
          scenario_id?: string
          severity?: Database["public"]["Enums"]["impact_severity"]
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "impacts_agent_same_organization"
            columns: ["agent_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "impacts_scenario_same_organization"
            columns: ["scenario_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "replanning_scenarios"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "impacts_shift_same_organization"
            columns: ["planning_shift_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "planning_shifts"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "impacts_site_same_organization"
            columns: ["site_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "replanning_impacts_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replanning_impacts_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replanning_impacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replanning_impacts_planning_shift_id_fkey"
            columns: ["planning_shift_id"]
            isOneToOne: false
            referencedRelation: "planning_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replanning_impacts_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "replanning_scenarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replanning_impacts_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      replanning_scenarios: {
        Row: {
          applied_at: string | null
          approved_at: string | null
          approved_by: string | null
          base_schedule_version_id: string
          candidate_lock_version: number | null
          candidate_schedule_version_id: string | null
          created_at: string
          created_by: string
          disruption_event_id: string
          id: string
          organization_id: string
          site_id: string
          status: Database["public"]["Enums"]["scenario_status"]
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          applied_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          base_schedule_version_id: string
          candidate_lock_version?: number | null
          candidate_schedule_version_id?: string | null
          created_at?: string
          created_by: string
          disruption_event_id: string
          id?: string
          organization_id: string
          site_id: string
          status?: Database["public"]["Enums"]["scenario_status"]
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          applied_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          base_schedule_version_id?: string
          candidate_lock_version?: number | null
          candidate_schedule_version_id?: string | null
          created_at?: string
          created_by?: string
          disruption_event_id?: string
          id?: string
          organization_id?: string
          site_id?: string
          status?: Database["public"]["Enums"]["scenario_status"]
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "replanning_scenarios_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replanning_scenarios_base_schedule_version_id_fkey"
            columns: ["base_schedule_version_id"]
            isOneToOne: false
            referencedRelation: "schedule_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replanning_scenarios_candidate_schedule_version_id_fkey"
            columns: ["candidate_schedule_version_id"]
            isOneToOne: false
            referencedRelation: "schedule_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replanning_scenarios_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replanning_scenarios_disruption_event_id_fkey"
            columns: ["disruption_event_id"]
            isOneToOne: false
            referencedRelation: "disruption_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replanning_scenarios_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replanning_scenarios_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenarios_base_schedule_same_organization"
            columns: ["base_schedule_version_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "schedule_versions"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "scenarios_candidate_schedule_same_organization"
            columns: ["candidate_schedule_version_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "schedule_versions"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "scenarios_disruption_same_organization"
            columns: ["disruption_event_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "disruption_events"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "scenarios_site_same_organization"
            columns: ["site_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      routes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          destination_port_id: string
          id: string
          name: string
          organization_id: string
          origin_port_id: string
          site_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          destination_port_id: string
          id?: string
          name: string
          organization_id: string
          origin_port_id: string
          site_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          destination_port_id?: string
          id?: string
          name?: string
          organization_id?: string
          origin_port_id?: string
          site_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "routes_destination_port_id_fkey"
            columns: ["destination_port_id"]
            isOneToOne: false
            referencedRelation: "ports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routes_destination_same_organization"
            columns: ["destination_port_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "ports"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "routes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routes_origin_port_id_fkey"
            columns: ["origin_port_id"]
            isOneToOne: false
            referencedRelation: "ports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routes_origin_same_organization"
            columns: ["origin_port_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "ports"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "routes_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routes_site_same_organization"
            columns: ["site_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      schedule_requirement_snapshot_manifests: {
        Row: {
          capture_kind: string
          captured_at: string
          captured_by: string | null
          content_fingerprint: string
          organization_id: string
          planning_period_id: string
          requirement_count: number
          schedule_version_id: string
          schema_version: number
          site_id: string
        }
        Insert: {
          capture_kind: string
          captured_at?: string
          captured_by?: string | null
          content_fingerprint: string
          organization_id: string
          planning_period_id: string
          requirement_count: number
          schedule_version_id: string
          schema_version?: number
          site_id: string
        }
        Update: {
          capture_kind?: string
          captured_at?: string
          captured_by?: string | null
          content_fingerprint?: string
          organization_id?: string
          planning_period_id?: string
          requirement_count?: number
          schedule_version_id?: string
          schema_version?: number
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_requirement_snapshot_manifest_schedule_version_id_fkey"
            columns: ["schedule_version_id"]
            isOneToOne: true
            referencedRelation: "schedule_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_requirement_snapshots: {
        Row: {
          captured_at: string
          demand_profile_id: string | null
          demand_profile_line_id: string | null
          demand_profile_version: number | null
          ends_at: string
          id: string
          organization_id: string
          planning_period_id: string
          port_call_id: string | null
          position_id: string
          required_agents: number
          schedule_version_id: string
          site_id: string
          source_facts: Json
          source_revision: string | null
          source_staffing_requirement_id: string
          starts_at: string
        }
        Insert: {
          captured_at?: string
          demand_profile_id?: string | null
          demand_profile_line_id?: string | null
          demand_profile_version?: number | null
          ends_at: string
          id?: string
          organization_id: string
          planning_period_id: string
          port_call_id?: string | null
          position_id: string
          required_agents: number
          schedule_version_id: string
          site_id: string
          source_facts?: Json
          source_revision?: string | null
          source_staffing_requirement_id: string
          starts_at: string
        }
        Update: {
          captured_at?: string
          demand_profile_id?: string | null
          demand_profile_line_id?: string | null
          demand_profile_version?: number | null
          ends_at?: string
          id?: string
          organization_id?: string
          planning_period_id?: string
          port_call_id?: string | null
          position_id?: string
          required_agents?: number
          schedule_version_id?: string
          site_id?: string
          source_facts?: Json
          source_revision?: string | null
          source_staffing_requirement_id?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_requirement_snapshots_schedule_version_id_fkey"
            columns: ["schedule_version_id"]
            isOneToOne: false
            referencedRelation: "schedule_requirement_snapshot_manifests"
            referencedColumns: ["schedule_version_id"]
          },
        ]
      }
      schedule_versions: {
        Row: {
          change_reason: string | null
          created_at: string
          created_by: string
          id: string
          label: string
          lock_version: number
          organization_id: string
          parent_version_id: string | null
          planning_period_id: string
          published_at: string | null
          published_by: string | null
          site_id: string
          status: Database["public"]["Enums"]["schedule_status"]
          superseded_at: string | null
          updated_at: string
          validated_at: string | null
          validated_by: string | null
          version_number: number
        }
        Insert: {
          change_reason?: string | null
          created_at?: string
          created_by: string
          id?: string
          label: string
          lock_version?: number
          organization_id: string
          parent_version_id?: string | null
          planning_period_id: string
          published_at?: string | null
          published_by?: string | null
          site_id: string
          status?: Database["public"]["Enums"]["schedule_status"]
          superseded_at?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          version_number: number
        }
        Update: {
          change_reason?: string | null
          created_at?: string
          created_by?: string
          id?: string
          label?: string
          lock_version?: number
          organization_id?: string
          parent_version_id?: string | null
          planning_period_id?: string
          published_at?: string | null
          published_by?: string | null
          site_id?: string
          status?: Database["public"]["Enums"]["schedule_status"]
          superseded_at?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "schedule_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_versions_parent_version_id_fkey"
            columns: ["parent_version_id"]
            isOneToOne: false
            referencedRelation: "schedule_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_versions_planning_period_id_fkey"
            columns: ["planning_period_id"]
            isOneToOne: false
            referencedRelation: "planning_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_versions_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_versions_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_versions_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_parent_same_organization"
            columns: ["parent_version_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "schedule_versions"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "schedules_period_same_organization"
            columns: ["planning_period_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "planning_periods"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "schedules_site_same_organization"
            columns: ["site_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      shift_assignments: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          organization_id: string
          planning_shift_id: string
          port_call_id: string | null
          position_id: string
          site_id: string
          staffing_requirement_id: string | null
          starts_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          organization_id: string
          planning_shift_id: string
          port_call_id?: string | null
          position_id: string
          site_id: string
          staffing_requirement_id?: string | null
          starts_at: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          organization_id?: string
          planning_shift_id?: string
          port_call_id?: string | null
          position_id?: string
          site_id?: string
          staffing_requirement_id?: string | null
          starts_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_call_same_organization"
            columns: ["port_call_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "port_calls"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "assignments_position_same_organization"
            columns: ["position_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "assignments_shift_same_organization"
            columns: ["planning_shift_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "planning_shifts"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "assignments_site_same_organization"
            columns: ["site_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "shift_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_assignments_planning_shift_id_fkey"
            columns: ["planning_shift_id"]
            isOneToOne: false
            referencedRelation: "planning_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_assignments_port_call_id_fkey"
            columns: ["port_call_id"]
            isOneToOne: false
            referencedRelation: "port_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_assignments_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_assignments_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_assignments_staffing_requirement_id_fkey"
            columns: ["staffing_requirement_id"]
            isOneToOne: false
            referencedRelation: "staffing_requirements"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          name: string
          organization_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          name: string
          organization_id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      skills: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "skills_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      staffing_requirements: {
        Row: {
          created_at: string
          demand_profile_line_id: string | null
          ends_at: string
          id: string
          organization_id: string
          planning_period_id: string
          port_call_id: string | null
          position_id: string
          required_agents: number
          retired_at: string | null
          site_id: string
          source_revision: string | null
          starts_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          demand_profile_line_id?: string | null
          ends_at: string
          id?: string
          organization_id: string
          planning_period_id: string
          port_call_id?: string | null
          position_id: string
          required_agents: number
          retired_at?: string | null
          site_id: string
          source_revision?: string | null
          starts_at: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          demand_profile_line_id?: string | null
          ends_at?: string
          id?: string
          organization_id?: string
          planning_period_id?: string
          port_call_id?: string | null
          position_id?: string
          required_agents?: number
          retired_at?: string | null
          site_id?: string
          source_revision?: string | null
          starts_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "requirements_call_same_organization"
            columns: ["port_call_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "port_calls"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "requirements_period_same_organization"
            columns: ["planning_period_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "planning_periods"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "requirements_position_same_organization"
            columns: ["position_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "requirements_site_same_organization"
            columns: ["site_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "staffing_requirements_demand_profile_line_id_fkey"
            columns: ["demand_profile_line_id"]
            isOneToOne: false
            referencedRelation: "demand_profile_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staffing_requirements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staffing_requirements_planning_period_id_fkey"
            columns: ["planning_period_id"]
            isOneToOne: false
            referencedRelation: "planning_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staffing_requirements_port_call_id_fkey"
            columns: ["port_call_id"]
            isOneToOne: false
            referencedRelation: "port_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staffing_requirements_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staffing_requirements_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      time_ledger_entries: {
        Row: {
          adjustment_minutes: number
          adjustment_reason: string | null
          agent_id: string
          approved_by: string | null
          created_at: string
          id: string
          organization_id: string
          planned_minutes: number
          planning_shift_id: string | null
          site_id: string
          updated_at: string
          work_date: string
          worked_minutes: number | null
        }
        Insert: {
          adjustment_minutes?: number
          adjustment_reason?: string | null
          agent_id: string
          approved_by?: string | null
          created_at?: string
          id?: string
          organization_id: string
          planned_minutes?: number
          planning_shift_id?: string | null
          site_id: string
          updated_at?: string
          work_date: string
          worked_minutes?: number | null
        }
        Update: {
          adjustment_minutes?: number
          adjustment_reason?: string | null
          agent_id?: string
          approved_by?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          planned_minutes?: number
          planning_shift_id?: string | null
          site_id?: string
          updated_at?: string
          work_date?: string
          worked_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_agent_same_organization"
            columns: ["agent_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "ledger_shift_same_organization"
            columns: ["planning_shift_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "planning_shifts"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "ledger_site_same_organization"
            columns: ["site_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "time_ledger_entries_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_ledger_entries_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_ledger_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_ledger_entries_planning_shift_id_fkey"
            columns: ["planning_shift_id"]
            isOneToOne: false
            referencedRelation: "planning_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_ledger_entries_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      user_role_assignments: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          organization_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          site_id: string | null
          user_id: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          organization_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          site_id?: string | null
          user_id: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          organization_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          site_id?: string | null
          user_id?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_role_assignments_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_role_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_role_assignments_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_role_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      vessels: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          imo_number: string | null
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          imo_number?: string | null
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          imo_number?: string | null
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vessels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      effective_call_load_forecasts: {
        Row: {
          coach_count: number | null
          created_at: string | null
          freight_unit_count: number | null
          id: string | null
          organization_id: string | null
          passenger_count: number | null
          passenger_quota: number | null
          payload_fingerprint: string | null
          port_call_id: string | null
          received_at: string | null
          site_id: string | null
          source: string | null
          source_priority: number | null
          source_received_at: string | null
          source_revision: string | null
          source_sequence: number | null
          vehicle_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      acknowledge_my_notification: {
        Args: { target_notification_id: string }
        Returns: Json
      }
      apply_ordered_port_call_timing_update: {
        Args: {
          allow_priority_override: boolean
          enforce_compare_and_swap: boolean
          expected_current_source_revision: string
          expected_timing_lock_version: number
          new_estimated_arrival_at: string
          new_estimated_departure_at: string
          new_status: Database["public"]["Enums"]["port_call_status"]
          target_port_call_id: string
          update_received_at: string
          update_source: string
          update_source_revision: string
          update_source_sequence: number
        }
        Returns: Json
      }
      apply_port_call_timing_override: {
        Args: {
          expected_current_source_revision: string
          expected_timing_lock_version: number
          new_estimated_arrival_at: string
          new_estimated_departure_at: string
          new_status: Database["public"]["Enums"]["port_call_status"]
          override_reason: string
          override_source: string
          override_source_revision: string
          override_valid_until: string
          target_port_call_id: string
        }
        Returns: Json
      }
      approve_replanning_scenario: {
        Args: { approval_reason: string; target_scenario_id: string }
        Returns: Json
      }
      assert_agent_planning_rules: {
        Args: {
          candidate_ends_at?: string
          candidate_starts_at?: string
          excluded_shift_id?: string
          target_agent_id: string
          target_schedule_version_id: string
        }
        Returns: undefined
      }
      assert_workforce_agent_access: {
        Args: {
          allowed_roles: Database["public"]["Enums"]["app_role"][]
          target_agent_id: string
        }
        Returns: {
          active: boolean
          created_at: string
          display_name: string
          employee_number: string
          hired_on: string | null
          id: string
          left_on: string | null
          organization_id: string
          primary_site_id: string
          updated_at: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "agents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      build_replanning_candidate: {
        Args: { approval_reason: string; target_scenario_id: string }
        Returns: string
      }
      can_current_user_access_agent: {
        Args: { target_agent_id: string }
        Returns: boolean
      }
      capture_outbox_event_recipients: {
        Args: { target_event_id: string }
        Returns: number
      }
      capture_schedule_requirement_snapshot: {
        Args: {
          target_capture_kind?: string
          target_schedule_version_id: string
        }
        Returns: undefined
      }
      claim_outbox_events: {
        Args: {
          claim_batch_size?: number
          claim_lease_seconds?: number
          claim_worker_id: string
        }
        Returns: {
          aggregate_id: string
          aggregate_type: string
          attempt_count: number
          id: string
          idempotency_key: string
          lease_token: string
          leased_until: string
          max_attempts: number
          organization_id: string
          payload: Json
          site_id: string
          topic: string
        }[]
      }
      claim_outbox_events_unchecked_040: {
        Args: {
          claim_batch_size?: number
          claim_lease_seconds?: number
          claim_worker_id: string
        }
        Returns: {
          aggregate_id: string
          aggregate_type: string
          attempt_count: number
          id: string
          idempotency_key: string
          lease_token: string
          leased_until: string
          max_attempts: number
          organization_id: string
          payload: Json
          site_id: string
          topic: string
        }[]
      }
      complete_agent_offboarding: {
        Args: {
          actor_user_id: string
          offboarding_reason: string
          target_agent_id: string
          target_effective_at: string
        }
        Returns: undefined
      }
      create_agent_record: {
        Args: {
          new_active?: boolean
          new_display_name: string
          new_employee_number?: string
          new_hired_on?: string
          new_user_id?: string
          target_organization_id: string
          target_primary_site_id: string
        }
        Returns: Json
      }
      create_agent_unavailability: {
        Args: {
          new_ends_at: string
          new_kind: Database["public"]["Enums"]["unavailability_kind"]
          new_note?: string
          new_starts_at: string
          target_agent_id: string
          target_organization_id: string
          target_site_id: string
        }
        Returns: Json
      }
      create_manual_call_load_forecast: {
        Args: {
          new_coach_count: number
          new_freight_unit_count: number
          new_passenger_count: number
          new_passenger_quota: number
          new_vehicle_count: number
          target_organization_id: string
          target_port_call_id: string
          target_site_id: string
        }
        Returns: {
          coach_count: number
          created_at: string
          freight_unit_count: number
          id: string
          organization_id: string
          passenger_count: number
          passenger_quota: number | null
          payload_fingerprint: string
          port_call_id: string
          received_at: string
          site_id: string
          source: string
          source_priority: number
          source_received_at: string
          source_revision: string | null
          source_sequence: number
          vehicle_count: number
        }
        SetofOptions: {
          from: "*"
          to: "call_load_forecasts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_manual_port_call: {
        Args: {
          new_external_reference: string
          new_scheduled_arrival_at: string
          new_scheduled_departure_at: string
          target_organization_id: string
          target_route_id: string
          target_site_id: string
          target_vessel_id: string
        }
        Returns: {
          actual_arrival_at: string | null
          actual_departure_at: string | null
          created_at: string
          demand_profile_id: string | null
          estimated_arrival_at: string | null
          estimated_departure_at: string | null
          external_reference: string | null
          id: string
          organization_id: string
          received_at: string
          route_id: string | null
          scheduled_arrival_at: string | null
          scheduled_departure_at: string | null
          site_id: string
          source: string
          source_override_until: string | null
          source_priority: number
          source_received_at: string
          source_revision: string | null
          source_sequence: number | null
          status: Database["public"]["Enums"]["port_call_status"]
          timing_lock_version: number
          timing_payload_fingerprint: string | null
          updated_at: string
          vessel_id: string
        }
        SetofOptions: {
          from: "*"
          to: "port_calls"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_planning_shift:
        | {
            Args: {
              shift_break_minutes: number
              shift_ends_at: string
              shift_note?: string
              shift_starts_at: string
              target_agent_id: string
              target_port_call_id?: string
              target_position_id: string
              target_schedule_version_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              expected_lock_version: number
              shift_break_minutes: number
              shift_ends_at: string
              shift_note: string
              shift_starts_at: string
              target_agent_id: string
              target_port_call_id: string
              target_position_id: string
              target_schedule_version_id: string
            }
            Returns: Json
          }
      create_planning_shift_service: {
        Args: {
          expected_lock_version: number
          shift_breaks: Json
          shift_ends_at: string
          shift_note: string
          shift_segments: Json
          shift_starts_at: string
          target_agent_id: string
          target_schedule_version_id: string
        }
        Returns: Json
      }
      create_schedule_version: {
        Args: {
          target_planning_period_id: string
          version_label: string
          version_reason?: string
        }
        Returns: Json
      }
      delete_planning_assignment:
        | {
            Args: {
              target_assignment_id: string
              target_schedule_version_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              expected_lock_version: number
              target_assignment_id: string
              target_schedule_version_id: string
            }
            Returns: Json
          }
      delete_planning_shift_service: {
        Args: {
          expected_lock_version: number
          target_schedule_version_id: string
          target_shift_id: string
        }
        Returns: Json
      }
      end_agent_group_membership: {
        Args: {
          new_effective_until: string
          target_group_id: string
          target_membership_id: string
          target_organization_id: string
        }
        Returns: Json
      }
      end_agent_unavailability: {
        Args: {
          new_ends_at: string
          target_agent_id: string
          target_unavailability_id: string
        }
        Returns: Json
      }
      ensure_editable_schedule_for_period: {
        Args: { target_planning_period_id: string }
        Returns: string
      }
      ensure_planning_workspace_for_anchor: {
        Args: { target_anchor: string; target_port_call_id: string }
        Returns: Json
      }
      ensure_planning_workspace_for_port_call: {
        Args: { target_port_call_id: string }
        Returns: Json
      }
      fail_outbox_event: {
        Args: {
          failure_reason: string
          target_event_id: string
          target_lease_token: string
        }
        Returns: Json
      }
      fail_outbox_event_unchecked_040: {
        Args: {
          failure_reason: string
          target_event_id: string
          target_lease_token: string
        }
        Returns: Json
      }
      finalize_due_agent_offboardings: {
        Args: { reconciliation_batch_size?: number }
        Returns: Json
      }
      generate_staffing_requirements: {
        Args: { target_planning_period_id: string }
        Returns: Json
      }
      get_agent_hour_balance: {
        Args: {
          target_agent_id: string
          target_schedule_version_id?: string
          target_week_start: string
        }
        Returns: Json
      }
      get_agent_hour_balance_unchecked_043: {
        Args: {
          target_agent_id: string
          target_schedule_version_id?: string
          target_week_start: string
        }
        Returns: Json
      }
      get_agent_offboarding_plan: {
        Args: { target_agent_id: string; target_organization_id: string }
        Returns: Json
      }
      get_agent_planning_workforce_violations: {
        Args: { target_agent_id: string }
        Returns: {
          agent_id: string
          conflict_kind: string
          details: Json
          organization_id: string
          planning_shift_id: string
          schedule_version_id: string
          site_id: string
          summary: string
        }[]
      }
      get_agent_planning_workforce_violations_pre_040: {
        Args: { target_agent_id: string }
        Returns: {
          agent_id: string
          conflict_kind: string
          details: Json
          organization_id: string
          planning_shift_id: string
          schedule_version_id: string
          site_id: string
          summary: string
        }[]
      }
      get_latest_call_load_forecasts: {
        Args: { target_port_call_ids: string[] }
        Returns: {
          coach_count: number
          created_at: string
          freight_unit_count: number
          id: string
          organization_id: string
          passenger_count: number
          passenger_quota: number | null
          payload_fingerprint: string
          port_call_id: string
          received_at: string
          site_id: string
          source: string
          source_priority: number
          source_received_at: string
          source_revision: string | null
          source_sequence: number
          vehicle_count: number
        }[]
        SetofOptions: {
          from: "*"
          to: "call_load_forecasts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_my_access_context: { Args: never; Returns: Json }
      get_my_notifications: {
        Args: { notification_limit?: number; unread_only?: boolean }
        Returns: Json
      }
      get_outbox_health: { Args: never; Returns: Json }
      get_planning_agent_candidates: {
        Args: {
          excluded_shift_id?: string
          result_limit?: number
          result_offset?: number
          search_query?: string
          shift_breaks?: Json
          shift_ends_at: string
          shift_segments: Json
          shift_starts_at: string
          target_schedule_version_id: string
        }
        Returns: {
          agent_id: string
          display_name: string
          employee_number: string
          explanation: string
          preference_level: string
          projected_week_minutes: number
          recent_load_minutes: number
          recommendation_rank: number
          scheduled_week_minutes: number
          total_count: number
          weekly_deficit_minutes: number
          weekly_target_minutes: number
        }[]
      }
      get_planning_workforce_conflict_page: {
        Args: {
          include_resolved: boolean
          range_ends_on: string
          range_starts_on: string
          result_limit: number
          result_offset: number
          target_site_id: string
        }
        Returns: {
          agent_display_name: string
          agent_id: string
          conflict_kind: string
          details: Json
          detected_at: string
          editable_schedule_version_id: string
          id: string
          last_detected_at: string
          organization_id: string
          planning_period_id: string
          planning_period_starts_on: string
          planning_shift_id: string
          resolution_note: string
          resolved_at: string
          schedule_version_id: string
          shift_ends_at: string
          shift_starts_at: string
          site_id: string
          status: string
          summary: string
          total_count: number
        }[]
      }
      get_planning_workforce_conflicts: {
        Args: {
          include_resolved?: boolean
          range_ends_on?: string
          range_starts_on?: string
          result_limit?: number
          target_site_id: string
        }
        Returns: {
          agent_display_name: string
          agent_id: string
          conflict_kind: string
          details: Json
          detected_at: string
          editable_schedule_version_id: string
          id: string
          last_detected_at: string
          organization_id: string
          planning_period_id: string
          planning_period_starts_on: string
          planning_shift_id: string
          resolution_note: string
          resolved_at: string
          schedule_version_id: string
          shift_ends_at: string
          shift_starts_at: string
          site_id: string
          status: string
          summary: string
        }[]
      }
      get_schedule_content: {
        Args: { target_schedule_version_id: string }
        Returns: Json
      }
      get_schedule_requirements: {
        Args: { target_schedule_version_id: string }
        Returns: {
          demand_profile_line_id: string
          ends_at: string
          id: string
          is_snapshot: boolean
          organization_id: string
          planning_period_id: string
          port_call_id: string
          position_id: string
          required_agents: number
          site_id: string
          snapshot_captured_at: string
          snapshot_schema_version: number
          source_facts: Json
          source_revision: string
          starts_at: string
        }[]
      }
      has_organization_role: {
        Args: {
          allowed_roles: Database["public"]["Enums"]["app_role"][]
          target_organization_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          allowed_roles: Database["public"]["Enums"]["app_role"][]
          target_organization_id: string
          target_site_id: string
        }
        Returns: boolean
      }
      ingest_ordered_call_load_forecast: {
        Args: {
          new_coach_count: number
          new_freight_unit_count: number
          new_passenger_count: number
          new_passenger_quota: number
          new_vehicle_count: number
          target_organization_id: string
          target_port_call_id: string
          target_site_id: string
          update_source: string
          update_source_received_at: string
          update_source_revision: string
          update_source_sequence: number
        }
        Returns: {
          coach_count: number
          created_at: string
          freight_unit_count: number
          id: string
          organization_id: string
          passenger_count: number
          passenger_quota: number | null
          payload_fingerprint: string
          port_call_id: string
          received_at: string
          site_id: string
          source: string
          source_priority: number
          source_received_at: string
          source_revision: string | null
          source_sequence: number
          vehicle_count: number
        }
        SetofOptions: {
          from: "*"
          to: "call_load_forecasts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_agent_employment_active: {
        Args: { target_agent_id: string }
        Returns: boolean
      }
      is_current_app_user_active: { Args: never; Returns: boolean }
      is_current_human_aal2: { Args: never; Returns: boolean }
      is_role_assignment_available: {
        Args: { target_assignment_id: string }
        Returns: boolean
      }
      maritime_load_payload_fingerprint: {
        Args: {
          load_coach_count: number
          load_freight_unit_count: number
          load_passenger_count: number
          load_passenger_quota: number
          load_source: string
          load_source_revision: string
          load_source_sequence: number
          load_vehicle_count: number
        }
        Returns: string
      }
      maritime_revision_sequence: {
        Args: { source_revision: string }
        Returns: number
      }
      maritime_timing_payload_fingerprint: {
        Args: {
          timing_estimated_arrival_at: string
          timing_estimated_departure_at: string
          timing_source: string
          timing_source_revision: string
          timing_source_sequence: number
          timing_status: Database["public"]["Enums"]["port_call_status"]
        }
        Returns: string
      }
      materialize_outbox_event: {
        Args: { target_event_id: string; target_lease_token: string }
        Returns: Json
      }
      materialize_outbox_event_unchecked_040: {
        Args: { target_event_id: string; target_lease_token: string }
        Returns: Json
      }
      move_planning_assignment:
        | {
            Args: {
              target_assignment_id: string
              target_position_id: string
              target_schedule_version_id: string
              target_work_date: string
            }
            Returns: Json
          }
        | {
            Args: {
              expected_lock_version: number
              target_assignment_id: string
              target_position_id: string
              target_schedule_version_id: string
              target_work_date: string
            }
            Returns: Json
          }
      override_call_load_forecast: {
        Args: {
          expected_effective_forecast_id: string
          new_coach_count: number
          new_freight_unit_count: number
          new_passenger_count: number
          new_passenger_quota: number
          new_vehicle_count: number
          override_reason: string
          override_valid_until: string
          target_organization_id: string
          target_port_call_id: string
          target_site_id: string
        }
        Returns: {
          coach_count: number
          created_at: string
          freight_unit_count: number
          id: string
          organization_id: string
          passenger_count: number
          passenger_quota: number | null
          payload_fingerprint: string
          port_call_id: string
          received_at: string
          site_id: string
          source: string
          source_priority: number
          source_received_at: string
          source_revision: string | null
          source_sequence: number
          vehicle_count: number
        }
        SetofOptions: {
          from: "*"
          to: "call_load_forecasts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      override_port_call_timing:
        | {
            Args: {
              expected_current_source_revision: string
              expected_timing_lock_version: number
              new_estimated_arrival_at: string
              new_estimated_departure_at: string
              new_status: Database["public"]["Enums"]["port_call_status"]
              override_reason: string
              override_source: string
              override_source_revision: string
              override_valid_until: string
              target_port_call_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              expected_current_source_revision: string
              new_estimated_arrival_at: string
              new_estimated_departure_at: string
              new_status: Database["public"]["Enums"]["port_call_status"]
              override_reason: string
              override_source: string
              override_source_revision: string
              override_valid_until: string
              target_port_call_id: string
            }
            Returns: Json
          }
      planning_agent_satisfies_fundamental_rules: {
        Args: {
          candidate_ends_at: string
          candidate_starts_at: string
          excluded_shift_id?: string
          target_agent_id: string
          target_schedule_version_id: string
        }
        Returns: boolean
      }
      planning_shift_planned_minutes: {
        Args: { target_planning_shift_id: string }
        Returns: number
      }
      prepare_workforce_conflict_draft: {
        Args: { target_conflict_id: string }
        Returns: Json
      }
      prune_processed_outbox_events: {
        Args: { prune_batch_size?: number; retain_before: string }
        Returns: Json
      }
      prune_processed_outbox_events_unchecked_040: {
        Args: { prune_batch_size?: number; retain_before: string }
        Returns: Json
      }
      publish_replanning_change_set: {
        Args: {
          publication_reason: string
          target_candidate_schedule_version_id: string
        }
        Returns: Json
      }
      publish_schedule_version:
        | {
            Args: {
              publication_reason: string
              target_schedule_version_id: string
            }
            Returns: {
              change_reason: string | null
              created_at: string
              created_by: string
              id: string
              label: string
              lock_version: number
              organization_id: string
              parent_version_id: string | null
              planning_period_id: string
              published_at: string | null
              published_by: string | null
              site_id: string
              status: Database["public"]["Enums"]["schedule_status"]
              superseded_at: string | null
              updated_at: string
              validated_at: string | null
              validated_by: string | null
              version_number: number
            }
            SetofOptions: {
              from: "*"
              to: "schedule_versions"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              expected_lock_version: number
              publication_reason: string
              target_schedule_version_id: string
            }
            Returns: {
              change_reason: string | null
              created_at: string
              created_by: string
              id: string
              label: string
              lock_version: number
              organization_id: string
              parent_version_id: string | null
              planning_period_id: string
              published_at: string | null
              published_by: string | null
              site_id: string
              status: Database["public"]["Enums"]["schedule_status"]
              superseded_at: string | null
              updated_at: string
              validated_at: string | null
              validated_by: string | null
              version_number: number
            }
            SetofOptions: {
              from: "*"
              to: "schedule_versions"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      reactivate_agent_record: {
        Args: {
          reactivation_reason: string
          target_agent_id: string
          target_organization_id: string
        }
        Returns: Json
      }
      recompute_planning_workforce_conflicts: {
        Args: { target_agent_id: string }
        Returns: Json
      }
      reconcile_expired_call_load_forecast_overrides: {
        Args: { reconcile_batch_size?: number }
        Returns: Json
      }
      reconcile_expired_workforce_conflicts: {
        Args: { reconcile_batch_size?: number }
        Returns: Json
      }
      reject_replanning_scenario: {
        Args: { rejection_reason: string; target_scenario_id: string }
        Returns: Json
      }
      replace_agent_contract: {
        Args: {
          new_effective_from: string
          new_effective_until?: string
          new_full_time_equivalent?: number
          new_label?: string
          new_monthly_target_minutes?: number
          new_weekly_target_minutes: number
          target_agent_id: string
          target_organization_id: string
        }
        Returns: Json
      }
      replace_agent_group_membership: {
        Args: {
          new_effective_from: string
          new_effective_until?: string
          new_is_primary?: boolean
          target_agent_id: string
          target_group_id: string
          target_organization_id: string
        }
        Returns: Json
      }
      replace_agent_position_preference: {
        Args: {
          new_level: Database["public"]["Enums"]["position_preference_level"]
          new_note?: string
          new_priority: number
          new_valid_from?: string
          new_valid_until?: string
          target_agent_id: string
          target_organization_id: string
          target_position_id: string
        }
        Returns: Json
      }
      replace_agent_position_restriction: {
        Args: {
          new_reason: string
          new_valid_from?: string
          new_valid_until?: string
          target_agent_id: string
          target_organization_id: string
          target_position_id: string
        }
        Returns: Json
      }
      replace_agent_skill: {
        Args: {
          new_level: number
          new_valid_from?: string
          new_valid_until?: string
          target_agent_id: string
          target_organization_id: string
          target_skill_id: string
        }
        Returns: Json
      }
      replace_planning_shift_service: {
        Args: {
          expected_lock_version: number
          shift_breaks: Json
          shift_ends_at: string
          shift_note: string
          shift_segments: Json
          shift_starts_at: string
          target_agent_id: string
          target_schedule_version_id: string
          target_shift_id: string
        }
        Returns: Json
      }
      requeue_outbox_dead_letter: {
        Args: { requeue_reason: string; target_event_id: string }
        Returns: Json
      }
      requeue_outbox_dead_letter_unchecked_040: {
        Args: { requeue_reason: string; target_event_id: string }
        Returns: Json
      }
      resolve_planning_workforce_conflict: {
        Args: { resolution_reason: string; target_conflict_id: string }
        Returns: Json
      }
      retry_failed_agent_offboarding: {
        Args: {
          retry_reason: string
          target_agent_id: string
          target_organization_id: string
        }
        Returns: Json
      }
      revoke_user_auth_sessions: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      schedule_effective_requirements: {
        Args: { target_schedule_version_id: string }
        Returns: {
          demand_profile_line_id: string
          ends_at: string
          id: string
          organization_id: string
          planning_period_id: string
          port_call_id: string
          position_id: string
          required_agents: number
          site_id: string
          source_revision: string
          starts_at: string
        }[]
      }
      schedule_version_coverage_gaps: {
        Args: { target_schedule_version_id: string }
        Returns: {
          assigned_agents: number
          gap_ends_at: string
          gap_starts_at: string
          required_agents: number
          staffing_requirement_id: string
        }[]
      }
      set_call_load_forecast_source_policy_state: {
        Args: {
          new_active: boolean
          new_priority: number
          target_organization_id: string
          target_source: string
        }
        Returns: Json
      }
      set_hour_target_override: {
        Args: {
          new_reason: string
          new_target_minutes: number
          target_agent_id: string
          target_group_id: string
          target_organization_id: string
          target_site_id: string
          target_week_start: string
        }
        Returns: Json
      }
      shift_is_within_planning_period: {
        Args: {
          shift_ends_at: string
          shift_starts_at: string
          target_planning_period_id: string
        }
        Returns: boolean
      }
      update_agent_record: {
        Args: {
          changes: Json
          target_agent_id: string
          target_organization_id: string
        }
        Returns: Json
      }
      update_planning_assignment:
        | {
            Args: {
              shift_break_minutes: number
              shift_ends_at: string
              shift_note: string
              shift_starts_at: string
              target_agent_id: string
              target_assignment_id: string
              target_port_call_id: string
              target_position_id: string
              target_schedule_version_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              expected_lock_version: number
              shift_break_minutes: number
              shift_ends_at: string
              shift_note: string
              shift_starts_at: string
              target_agent_id: string
              target_assignment_id: string
              target_port_call_id: string
              target_position_id: string
              target_schedule_version_id: string
            }
            Returns: Json
          }
      update_planning_shift_service: {
        Args: {
          expected_lock_version: number
          shift_breaks: Json
          shift_ends_at: string
          shift_note: string
          shift_segments: Json
          shift_starts_at: string
          target_agent_id: string
          target_schedule_version_id: string
          target_shift_id: string
        }
        Returns: Json
      }
      update_port_call_timing:
        | {
            Args: {
              new_estimated_arrival_at: string
              new_estimated_departure_at: string
              new_status: Database["public"]["Enums"]["port_call_status"]
              target_port_call_id: string
              update_source: string
              update_source_revision?: string
            }
            Returns: Json
          }
        | {
            Args: {
              expected_current_source_revision: string
              new_estimated_arrival_at: string
              new_estimated_departure_at: string
              new_status: Database["public"]["Enums"]["port_call_status"]
              target_port_call_id: string
              update_received_at: string
              update_source: string
              update_source_revision: string
              update_source_sequence: number
            }
            Returns: Json
          }
        | {
            Args: {
              expected_current_source_revision: string
              expected_timing_lock_version: number
              new_estimated_arrival_at: string
              new_estimated_departure_at: string
              new_status: Database["public"]["Enums"]["port_call_status"]
              target_port_call_id: string
              update_received_at: string
              update_source: string
              update_source_revision: string
              update_source_sequence: number
            }
            Returns: Json
          }
      validate_planning_shift_timeline: {
        Args: { target_planning_shift_id: string }
        Returns: undefined
      }
      validate_replanning_change_set: {
        Args: { target_disruption_event_id: string }
        Returns: undefined
      }
      validate_schedule_shift_timelines: {
        Args: { target_schedule_version_id: string }
        Returns: undefined
      }
      validate_schedule_version_integrity: {
        Args: { target_schedule_version_id: string }
        Returns: undefined
      }
    }
    Enums: {
      account_status: "active" | "suspended" | "disabled"
      app_role:
        | "platform_admin"
        | "planning_admin"
        | "planner"
        | "approver"
        | "supervisor"
        | "agent"
        | "hr"
        | "auditor"
      demand_anchor: "arrival" | "departure"
      disruption_kind: "delay" | "advance" | "cancellation" | "time_correction"
      impact_severity: "information" | "warning" | "critical"
      notification_status:
        | "pending"
        | "sent"
        | "acknowledged"
        | "failed"
        | "cancelled"
      port_call_status:
        | "scheduled"
        | "delayed"
        | "advanced"
        | "arrived"
        | "departed"
        | "cancelled"
      position_preference_level: "preferred" | "neutral" | "avoid"
      scenario_status:
        | "draft"
        | "simulated"
        | "approved"
        | "rejected"
        | "applied"
      schedule_status: "draft" | "validated" | "published" | "archived"
      shift_origin: "manual" | "generated" | "replanned"
      unavailability_kind: "leave" | "training" | "medical" | "rest" | "other"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_status: ["active", "suspended", "disabled"],
      app_role: [
        "platform_admin",
        "planning_admin",
        "planner",
        "approver",
        "supervisor",
        "agent",
        "hr",
        "auditor",
      ],
      demand_anchor: ["arrival", "departure"],
      disruption_kind: ["delay", "advance", "cancellation", "time_correction"],
      impact_severity: ["information", "warning", "critical"],
      notification_status: [
        "pending",
        "sent",
        "acknowledged",
        "failed",
        "cancelled",
      ],
      port_call_status: [
        "scheduled",
        "delayed",
        "advanced",
        "arrived",
        "departed",
        "cancelled",
      ],
      position_preference_level: ["preferred", "neutral", "avoid"],
      scenario_status: [
        "draft",
        "simulated",
        "approved",
        "rejected",
        "applied",
      ],
      schedule_status: ["draft", "validated", "published", "archived"],
      shift_origin: ["manual", "generated", "replanned"],
      unavailability_kind: ["leave", "training", "medical", "rest", "other"],
    },
  },
} as const
