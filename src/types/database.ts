export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      ai_usage_events: {
        Row: {
          company_id: string
          created_at: string
          error_code: string | null
          id: number
          input_tokens: number
          insight_id: string
          latency_ms: number
          lead_id: string
          member_id: string
          model: string
          output_tokens: number
          provider: string
          status: string
        }
        Insert: {
          company_id: string
          created_at?: string
          error_code?: string | null
          id?: never
          input_tokens?: number
          insight_id: string
          latency_ms?: number
          lead_id: string
          member_id: string
          model: string
          output_tokens?: number
          provider: string
          status: string
        }
        Update: {
          company_id?: string
          created_at?: string
          error_code?: string | null
          id?: never
          input_tokens?: number
          insight_id?: string
          latency_ms?: number
          lead_id?: string
          member_id?: string
          model?: string
          output_tokens?: number
          provider?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_events_insight_id_fkey"
            columns: ["insight_id"]
            isOneToOne: true
            referencedRelation: "lead_ai_insights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_lead_fkey"
            columns: ["company_id", "lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "ai_usage_member_fkey"
            columns: ["company_id", "member_id"]
            isOneToOne: false
            referencedRelation: "company_members"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      appointments: {
        Row: {
          appointment_type: Database["public"]["Enums"]["appointment_type"]
          assigned_member_id: string
          cancelled_at: string | null
          company_id: string
          completed_at: string | null
          completed_by_member_id: string | null
          created_at: string
          created_by_member_id: string
          customer_name: string
          deleted_at: string | null
          ends_at: string | null
          id: string
          lead_id: string | null
          location: string | null
          notes: string | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        Insert: {
          appointment_type: Database["public"]["Enums"]["appointment_type"]
          assigned_member_id: string
          cancelled_at?: string | null
          company_id: string
          completed_at?: string | null
          completed_by_member_id?: string | null
          created_at?: string
          created_by_member_id: string
          customer_name: string
          deleted_at?: string | null
          ends_at?: string | null
          id?: string
          lead_id?: string | null
          location?: string | null
          notes?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Update: {
          appointment_type?: Database["public"]["Enums"]["appointment_type"]
          assigned_member_id?: string
          cancelled_at?: string | null
          company_id?: string
          completed_at?: string | null
          completed_by_member_id?: string | null
          created_at?: string
          created_by_member_id?: string
          customer_name?: string
          deleted_at?: string | null
          ends_at?: string | null
          id?: string
          lead_id?: string | null
          location?: string | null
          notes?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_assigned_member_fkey"
            columns: ["company_id", "assigned_member_id"]
            isOneToOne: false
            referencedRelation: "company_members"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "appointments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_completed_by_member_fkey"
            columns: ["company_id", "completed_by_member_id"]
            isOneToOne: false
            referencedRelation: "company_members"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "appointments_created_by_member_fkey"
            columns: ["company_id", "created_by_member_id"]
            isOneToOne: false
            referencedRelation: "company_members"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "appointments_lead_fkey"
            columns: ["company_id", "lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          business_email: string | null
          city: string | null
          created_at: string
          created_by_user_id: string
          deleted_at: string | null
          id: string
          name: string
          phone: string | null
          slug: string
          status: Database["public"]["Enums"]["company_status"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          business_email?: string | null
          city?: string | null
          created_at?: string
          created_by_user_id: string
          deleted_at?: string | null
          id?: string
          name: string
          phone?: string | null
          slug: string
          status?: Database["public"]["Enums"]["company_status"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          business_email?: string | null
          city?: string | null
          created_at?: string
          created_by_user_id?: string
          deleted_at?: string | null
          id?: string
          name?: string
          phone?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["company_status"]
          updated_at?: string
        }
        Relationships: []
      }
      company_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by_user_id: string | null
          company_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by_member_id: string
          role: Database["public"]["Enums"]["member_role"]
          status: Database["public"]["Enums"]["invitation_status"]
          token_hash: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          company_id: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by_member_id: string
          role: Database["public"]["Enums"]["member_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          token_hash: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          company_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by_member_id?: string
          role?: Database["public"]["Enums"]["member_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_invitations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_invitations_inviter_fkey"
            columns: ["company_id", "invited_by_member_id"]
            isOneToOne: false
            referencedRelation: "company_members"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      company_members: {
        Row: {
          company_id: string
          created_at: string
          id: string
          invited_by_member_id: string | null
          joined_at: string | null
          role: Database["public"]["Enums"]["member_role"]
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          invited_by_member_id?: string | null
          joined_at?: string | null
          role: Database["public"]["Enums"]["member_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          invited_by_member_id?: string | null
          joined_at?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_members_inviter_fkey"
            columns: ["company_id", "invited_by_member_id"]
            isOneToOne: false
            referencedRelation: "company_members"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      company_settings: {
        Row: {
          ai_settings: Json
          company_id: string
          created_at: string
          currency: string
          disabled_lead_sources: string[]
          disabled_services: string[]
          lead_scoring_rules: Json
          lead_sources: string[]
          notification_defaults: Json
          services: string[]
          timezone: string
          updated_at: string
          updated_by_member_id: string | null
        }
        Insert: {
          ai_settings?: Json
          company_id: string
          created_at?: string
          currency?: string
          disabled_lead_sources?: string[]
          disabled_services?: string[]
          lead_scoring_rules?: Json
          lead_sources?: string[]
          notification_defaults?: Json
          services?: string[]
          timezone?: string
          updated_at?: string
          updated_by_member_id?: string | null
        }
        Update: {
          ai_settings?: Json
          company_id?: string
          created_at?: string
          currency?: string
          disabled_lead_sources?: string[]
          disabled_services?: string[]
          lead_scoring_rules?: Json
          lead_sources?: string[]
          notification_defaults?: Json
          services?: string[]
          timezone?: string
          updated_at?: string
          updated_by_member_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_settings_updated_by_member_fkey"
            columns: ["company_id", "updated_by_member_id"]
            isOneToOne: false
            referencedRelation: "company_members"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      company_settings_audit: {
        Row: {
          action: string
          actor_member_id: string
          changed_fields: Json
          company_id: string
          id: number
          occurred_at: string
        }
        Insert: {
          action: string
          actor_member_id: string
          changed_fields?: Json
          company_id: string
          id?: never
          occurred_at?: string
        }
        Update: {
          action?: string
          actor_member_id?: string
          changed_fields?: Json
          company_id?: string
          id?: never
          occurred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_audit_actor_fkey"
            columns: ["company_id", "actor_member_id"]
            isOneToOne: false
            referencedRelation: "company_members"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "company_settings_audit_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_ups: {
        Row: {
          assigned_member_id: string
          cancelled_at: string | null
          company_id: string
          completed_at: string | null
          completed_by_member_id: string | null
          created_at: string
          created_by_member_id: string
          deleted_at: string | null
          due_at: string
          id: string
          lead_id: string
          notes: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          status: Database["public"]["Enums"]["follow_up_status"]
          updated_at: string
        }
        Insert: {
          assigned_member_id: string
          cancelled_at?: string | null
          company_id: string
          completed_at?: string | null
          completed_by_member_id?: string | null
          created_at?: string
          created_by_member_id: string
          deleted_at?: string | null
          due_at: string
          id?: string
          lead_id: string
          notes?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["follow_up_status"]
          updated_at?: string
        }
        Update: {
          assigned_member_id?: string
          cancelled_at?: string | null
          company_id?: string
          completed_at?: string | null
          completed_by_member_id?: string | null
          created_at?: string
          created_by_member_id?: string
          deleted_at?: string | null
          due_at?: string
          id?: string
          lead_id?: string
          notes?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["follow_up_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_ups_assigned_member_fkey"
            columns: ["company_id", "assigned_member_id"]
            isOneToOne: false
            referencedRelation: "company_members"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "follow_ups_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_completed_by_member_fkey"
            columns: ["company_id", "completed_by_member_id"]
            isOneToOne: false
            referencedRelation: "company_members"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "follow_ups_created_by_member_fkey"
            columns: ["company_id", "created_by_member_id"]
            isOneToOne: false
            referencedRelation: "company_members"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "follow_ups_lead_fkey"
            columns: ["company_id", "lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      lead_activities: {
        Row: {
          activity_type: Database["public"]["Enums"]["lead_activity_type"]
          actor_member_id: string | null
          company_id: string
          created_at: string
          description: string | null
          id: string
          lead_id: string
          metadata: Json
          occurred_at: string
          updated_at: string
        }
        Insert: {
          activity_type: Database["public"]["Enums"]["lead_activity_type"]
          actor_member_id?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          lead_id: string
          metadata?: Json
          occurred_at?: string
          updated_at?: string
        }
        Update: {
          activity_type?: Database["public"]["Enums"]["lead_activity_type"]
          actor_member_id?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          lead_id?: string
          metadata?: Json
          occurred_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_actor_fkey"
            columns: ["company_id", "actor_member_id"]
            isOneToOne: false
            referencedRelation: "company_members"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "lead_activities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activities_lead_fkey"
            columns: ["company_id", "lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      lead_ai_insights: {
        Row: {
          buying_intent: string | null
          company_id: string
          completed_at: string | null
          confidence: number | null
          correlation_id: string
          created_at: string
          error_code: string | null
          generated_by_member_id: string
          generation_expires_at: string | null
          generation_kind: string
          id: string
          input_fingerprint: string
          latency_ms: number | null
          lead_id: string
          missing_information: string[] | null
          model: string
          prompt_version: string
          provider: string
          recommended_next_action: string | null
          recommended_score: number | null
          recommended_temperature:
            | Database["public"]["Enums"]["lead_temperature"]
            | null
          risk_flags: string[] | null
          score_factors: string[] | null
          status: string
          suggested_reply: string | null
          summary: string | null
          tokens_input: number | null
          tokens_output: number | null
        }
        Insert: {
          buying_intent?: string | null
          company_id: string
          completed_at?: string | null
          confidence?: number | null
          correlation_id: string
          created_at?: string
          error_code?: string | null
          generated_by_member_id: string
          generation_expires_at?: string | null
          generation_kind?: string
          id?: string
          input_fingerprint: string
          latency_ms?: number | null
          lead_id: string
          missing_information?: string[] | null
          model: string
          prompt_version: string
          provider: string
          recommended_next_action?: string | null
          recommended_score?: number | null
          recommended_temperature?:
            | Database["public"]["Enums"]["lead_temperature"]
            | null
          risk_flags?: string[] | null
          score_factors?: string[] | null
          status: string
          suggested_reply?: string | null
          summary?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
        }
        Update: {
          buying_intent?: string | null
          company_id?: string
          completed_at?: string | null
          confidence?: number | null
          correlation_id?: string
          created_at?: string
          error_code?: string | null
          generated_by_member_id?: string
          generation_expires_at?: string | null
          generation_kind?: string
          id?: string
          input_fingerprint?: string
          latency_ms?: number | null
          lead_id?: string
          missing_information?: string[] | null
          model?: string
          prompt_version?: string
          provider?: string
          recommended_next_action?: string | null
          recommended_score?: number | null
          recommended_temperature?:
            | Database["public"]["Enums"]["lead_temperature"]
            | null
          risk_flags?: string[] | null
          score_factors?: string[] | null
          status?: string
          suggested_reply?: string | null
          summary?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_ai_insights_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_ai_insights_lead_fkey"
            columns: ["company_id", "lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "lead_ai_insights_member_fkey"
            columns: ["company_id", "generated_by_member_id"]
            isOneToOne: false
            referencedRelation: "company_members"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      lead_create_requests: {
        Row: {
          company_id: string
          created_at: string
          id: string
          lead_id: string | null
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id: string
          lead_id?: string | null
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          lead_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_create_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_create_requests_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_number_counters: {
        Row: {
          company_id: string
          next_number: number
          updated_at: string
        }
        Insert: {
          company_id: string
          next_number: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          next_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_number_counters_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_member_id: string | null
          budget_pkr: number
          company_id: string
          converted_at: string | null
          created_at: string
          created_by_member_id: string
          deleted_at: string | null
          email: string | null
          expected_timeline: string | null
          full_name: string
          id: string
          lead_number: string
          location: string
          notes: string | null
          phone: string
          property_size: string | null
          score: number
          service_required: string
          source: string
          stage: Database["public"]["Enums"]["lead_stage"]
          temperature: Database["public"]["Enums"]["lead_temperature"]
          updated_at: string
          updated_by_member_id: string | null
        }
        Insert: {
          assigned_member_id?: string | null
          budget_pkr?: number
          company_id: string
          converted_at?: string | null
          created_at?: string
          created_by_member_id: string
          deleted_at?: string | null
          email?: string | null
          expected_timeline?: string | null
          full_name: string
          id?: string
          lead_number: string
          location: string
          notes?: string | null
          phone: string
          property_size?: string | null
          score?: number
          service_required: string
          source: string
          stage?: Database["public"]["Enums"]["lead_stage"]
          temperature: Database["public"]["Enums"]["lead_temperature"]
          updated_at?: string
          updated_by_member_id?: string | null
        }
        Update: {
          assigned_member_id?: string | null
          budget_pkr?: number
          company_id?: string
          converted_at?: string | null
          created_at?: string
          created_by_member_id?: string
          deleted_at?: string | null
          email?: string | null
          expected_timeline?: string | null
          full_name?: string
          id?: string
          lead_number?: string
          location?: string
          notes?: string | null
          phone?: string
          property_size?: string | null
          score?: number
          service_required?: string
          source?: string
          stage?: Database["public"]["Enums"]["lead_stage"]
          temperature?: Database["public"]["Enums"]["lead_temperature"]
          updated_at?: string
          updated_by_member_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_member_fkey"
            columns: ["company_id", "assigned_member_id"]
            isOneToOne: false
            referencedRelation: "company_members"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_created_by_member_fkey"
            columns: ["company_id", "created_by_member_id"]
            isOneToOne: false
            referencedRelation: "company_members"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "leads_updated_by_member_fkey"
            columns: ["company_id", "updated_by_member_id"]
            isOneToOne: false
            referencedRelation: "company_members"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      membership_audit: {
        Row: {
          action: string
          actor_member_id: string | null
          company_id: string
          id: string
          invitation_id: string | null
          metadata: Json
          occurred_at: string
          target_member_id: string | null
        }
        Insert: {
          action: string
          actor_member_id?: string | null
          company_id: string
          id?: string
          invitation_id?: string | null
          metadata?: Json
          occurred_at?: string
          target_member_id?: string | null
        }
        Update: {
          action?: string
          actor_member_id?: string | null
          company_id?: string
          id?: string
          invitation_id?: string | null
          metadata?: Json
          occurred_at?: string
          target_member_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "membership_audit_actor_fkey"
            columns: ["company_id", "actor_member_id"]
            isOneToOne: false
            referencedRelation: "company_members"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "membership_audit_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_audit_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "company_invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_audit_target_fkey"
            columns: ["company_id", "target_member_id"]
            isOneToOne: false
            referencedRelation: "company_members"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      notifications: {
        Row: {
          appointment_id: string | null
          archived_at: string | null
          body: string
          company_id: string
          created_at: string
          event_key: string | null
          follow_up_id: string | null
          id: string
          lead_id: string | null
          notification_type: Database["public"]["Enums"]["notification_type"]
          payload: Json
          read_at: string | null
          recipient_member_id: string
          title: string
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          archived_at?: string | null
          body: string
          company_id: string
          created_at?: string
          event_key?: string | null
          follow_up_id?: string | null
          id?: string
          lead_id?: string | null
          notification_type: Database["public"]["Enums"]["notification_type"]
          payload?: Json
          read_at?: string | null
          recipient_member_id: string
          title: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          archived_at?: string | null
          body?: string
          company_id?: string
          created_at?: string
          event_key?: string | null
          follow_up_id?: string | null
          id?: string
          lead_id?: string | null
          notification_type?: Database["public"]["Enums"]["notification_type"]
          payload?: Json
          read_at?: string | null
          recipient_member_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_appointment_fkey"
            columns: ["company_id", "appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_follow_up_fkey"
            columns: ["company_id", "follow_up_id"]
            isOneToOne: false
            referencedRelation: "follow_ups"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "notifications_lead_fkey"
            columns: ["company_id", "lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "notifications_recipient_fkey"
            columns: ["company_id", "recipient_member_id"]
            isOneToOne: false
            referencedRelation: "company_members"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name: string
          id: string
          phone?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_notification_preferences: {
        Row: {
          company_id: string
          created_at: string
          member_id: string
          preferences: Json
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          member_id: string
          preferences?: Json
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          member_id?: string
          preferences?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_notification_preferences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_notification_preferences_member_fkey"
            columns: ["company_id", "member_id"]
            isOneToOne: true
            referencedRelation: "company_members"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      workflow_create_requests: {
        Row: {
          appointment_id: string | null
          company_id: string
          created_at: string
          follow_up_id: string | null
          id: string
          record_kind: string
          user_id: string
        }
        Insert: {
          appointment_id?: string | null
          company_id: string
          created_at?: string
          follow_up_id?: string | null
          id: string
          record_kind: string
          user_id: string
        }
        Update: {
          appointment_id?: string | null
          company_id?: string
          created_at?: string
          follow_up_id?: string | null
          id?: string
          record_kind?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_create_requests_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_create_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_create_requests_follow_up_id_fkey"
            columns: ["follow_up_id"]
            isOneToOne: false
            referencedRelation: "follow_ups"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_company_invitation: {
        Args: { raw_token: string }
        Returns: string
      }
      apply_ai_recommendation: {
        Args: {
          recommendation_kind: string
          target_company_id: string
          target_insight_id: string
          target_lead_id: string
        }
        Returns: boolean
      }
      begin_ai_generation: {
        Args: {
          force_regeneration?: boolean
          requested_fingerprint: string
          requested_model: string
          requested_prompt_version: string
          requested_provider: string
          target_company_id: string
          target_lead_id: string
        }
        Returns: Json
      }
      complete_ai_generation: {
        Args: {
          output_buying_intent: string
          output_confidence: number
          output_missing_information: string[]
          output_next_action: string
          output_risk_flags: string[]
          output_score: number
          output_score_factors: string[]
          output_suggested_reply: string
          output_summary: string
          output_temperature: Database["public"]["Enums"]["lead_temperature"]
          request_latency_ms: number
          target_company_id: string
          target_insight_id: string
          usage_input_tokens: number
          usage_output_tokens: number
        }
        Returns: boolean
      }
      convert_lead: {
        Args: { target_company_id: string; target_lead_id: string }
        Returns: boolean
      }
      create_appointment: {
        Args: {
          request_id: string
          target_appointment_type: Database["public"]["Enums"]["appointment_type"]
          target_assigned_member_id: string
          target_company_id: string
          target_customer_name: string
          target_ends_at: string
          target_lead_id: string
          target_location: string
          target_notes: string
          target_starts_at: string
        }
        Returns: string
      }
      create_company_invitation: {
        Args: {
          invitation_expires_at: string
          invitation_token_hash: string
          invited_email: string
          invited_role: Database["public"]["Enums"]["member_role"]
          target_company_id: string
        }
        Returns: string
      }
      create_follow_up: {
        Args: {
          request_id: string
          target_assigned_member_id: string
          target_company_id: string
          target_due_at: string
          target_lead_id: string
          target_notes: string
          target_priority: Database["public"]["Enums"]["task_priority"]
        }
        Returns: string
      }
      create_lead: {
        Args: {
          lead_assigned_member_id: string
          lead_budget_pkr: number
          lead_email: string
          lead_expected_timeline: string
          lead_full_name: string
          lead_location: string
          lead_notes: string
          lead_phone: string
          lead_property_size: string
          lead_score: number
          lead_service: string
          lead_source: string
          lead_temperature: Database["public"]["Enums"]["lead_temperature"]
          request_id: string
          target_company_id: string
        }
        Returns: string
      }
      fail_ai_generation: {
        Args: {
          request_latency_ms?: number
          safe_error_code: string
          target_company_id: string
          target_insight_id: string
        }
        Returns: boolean
      }
      get_ai_usage_summary: {
        Args: { target_company_id: string }
        Returns: Json
      }
      get_my_auth_context: {
        Args: never
        Returns: {
          avatar_url: string
          company_id: string
          company_name: string
          company_status: Database["public"]["Enums"]["company_status"]
          full_name: string
          member_id: string
          membership_status: Database["public"]["Enums"]["membership_status"]
          profile_id: string
          role: Database["public"]["Enums"]["member_role"]
        }[]
      }
      inspect_company_invitation: {
        Args: { raw_token: string }
        Returns: {
          company_name: string
          email: string
          expires_at: string
          invitation_status: Database["public"]["Enums"]["invitation_status"]
          is_valid: boolean
          role: Database["public"]["Enums"]["member_role"]
        }[]
      }
      list_company_invitations: {
        Args: { target_company_id: string }
        Returns: {
          created_at: string
          email: string
          expires_at: string
          invitation_id: string
          invitation_status: Database["public"]["Enums"]["invitation_status"]
          inviter_name: string
          role: Database["public"]["Enums"]["member_role"]
        }[]
      }
      list_company_members: {
        Args: { target_company_id: string }
        Returns: {
          created_at: string
          email: string
          full_name: string
          joined_at: string
          member_id: string
          membership_status: Database["public"]["Enums"]["membership_status"]
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }[]
      }
      list_my_tenants: {
        Args: never
        Returns: {
          company_id: string
          company_name: string
          member_id: string
          role: Database["public"]["Enums"]["member_role"]
        }[]
      }
      manage_company_member: {
        Args: {
          requested_action: string
          requested_role?: Database["public"]["Enums"]["member_role"]
          target_company_id: string
          target_member_id: string
        }
        Returns: undefined
      }
      mark_all_notifications_read: {
        Args: { target_company_id: string }
        Returns: number
      }
      mark_notification_read: {
        Args: { target_company_id: string; target_notification_id: string }
        Returns: boolean
      }
      process_follow_up_notifications: {
        Args: { reference_at?: string }
        Returns: {
          due_created: number
          overdue_created: number
        }[]
      }
      revoke_company_invitation: {
        Args: { target_company_id: string; target_invitation_id: string }
        Returns: undefined
      }
      rotate_company_invitation: {
        Args: {
          invitation_expires_at: string
          invitation_token_hash: string
          target_company_id: string
          target_invitation_id: string
        }
        Returns: undefined
      }
      set_appointment_archived: {
        Args: {
          archive_record: boolean
          target_appointment_id: string
          target_company_id: string
        }
        Returns: undefined
      }
      set_follow_up_archived: {
        Args: {
          archive_record: boolean
          target_company_id: string
          target_follow_up_id: string
        }
        Returns: undefined
      }
      set_lead_archived: {
        Args: {
          archive_lead: boolean
          target_company_id: string
          target_lead_id: string
        }
        Returns: undefined
      }
      transition_appointment: {
        Args: {
          target_appointment_id: string
          target_company_id: string
          target_status: Database["public"]["Enums"]["appointment_status"]
        }
        Returns: boolean
      }
      transition_follow_up: {
        Args: {
          target_company_id: string
          target_follow_up_id: string
          target_status: Database["public"]["Enums"]["follow_up_status"]
        }
        Returns: boolean
      }
      update_appointment: {
        Args: {
          expected_updated_at: string
          target_appointment_id: string
          target_appointment_type: Database["public"]["Enums"]["appointment_type"]
          target_assigned_member_id: string
          target_company_id: string
          target_customer_name: string
          target_ends_at: string
          target_location: string
          target_notes: string
          target_starts_at: string
        }
        Returns: string
      }
      update_company_ai_settings: {
        Args: {
          expected_updated_at: string
          requested_settings: Json
          target_company_id: string
        }
        Returns: string
      }
      update_company_settings: {
        Args: {
          company_address: string
          company_business_email: string
          company_city: string
          company_name: string
          company_phone: string
          expected_company_updated_at: string
          expected_settings_updated_at: string
          settings_currency: string
          settings_disabled_lead_sources: string[]
          settings_disabled_services: string[]
          settings_lead_sources: string[]
          settings_notification_defaults: Json
          settings_scoring_rules: Json
          settings_services: string[]
          settings_timezone: string
          target_company_id: string
        }
        Returns: {
          company_updated_at: string
          settings_updated_at: string
        }[]
      }
      update_follow_up: {
        Args: {
          expected_updated_at: string
          target_assigned_member_id: string
          target_company_id: string
          target_due_at: string
          target_follow_up_id: string
          target_notes: string
          target_priority: Database["public"]["Enums"]["task_priority"]
        }
        Returns: string
      }
      update_lead: {
        Args: {
          expected_updated_at: string
          lead_assigned_member_id: string
          lead_budget_pkr: number
          lead_email: string
          lead_expected_timeline: string
          lead_full_name: string
          lead_location: string
          lead_notes: string
          lead_phone: string
          lead_property_size: string
          lead_score: number
          lead_service: string
          lead_source: string
          lead_stage: Database["public"]["Enums"]["lead_stage"]
          lead_temperature: Database["public"]["Enums"]["lead_temperature"]
          target_company_id: string
          target_lead_id: string
        }
        Returns: string
      }
      update_my_notification_preferences: {
        Args: { requested_preferences: Json; target_company_id: string }
        Returns: string
      }
      update_my_profile: {
        Args: {
          expected_updated_at: string
          profile_full_name: string
          profile_phone: string
          profile_timezone: string
        }
        Returns: string
      }
    }
    Enums: {
      appointment_status: "pending" | "confirmed" | "completed" | "cancelled"
      appointment_type: "site_visit" | "consultation" | "meeting"
      company_status: "active" | "suspended"
      follow_up_status: "pending" | "completed" | "cancelled"
      invitation_status: "pending" | "accepted" | "expired" | "revoked"
      lead_activity_type:
        | "created"
        | "updated"
        | "assignment_changed"
        | "stage_changed"
        | "note_added"
        | "follow_up_scheduled"
        | "follow_up_completed"
        | "appointment_scheduled"
        | "converted"
        | "ai_insight_generated"
        | "ai_insight_regenerated"
        | "ai_score_applied"
        | "ai_temperature_applied"
      lead_stage:
        | "new_inquiry"
        | "contacted"
        | "qualified"
        | "proposal_sent"
        | "negotiation"
        | "site_visit"
        | "converted"
        | "lost"
      lead_temperature: "hot" | "warm" | "cold"
      member_role: "owner" | "admin" | "sales_manager" | "sales_representative"
      membership_status: "invited" | "active" | "suspended" | "removed"
      notification_type:
        | "lead_assigned"
        | "follow_up_due"
        | "appointment_reminder"
        | "invitation"
        | "system"
        | "lead_reassigned"
        | "lead_converted"
        | "follow_up_assigned"
        | "follow_up_rescheduled"
        | "follow_up_overdue"
        | "follow_up_completed"
        | "appointment_created"
        | "appointment_rescheduled"
        | "appointment_confirmed"
        | "appointment_cancelled"
        | "membership_event"
        | "ai_insight_completed"
        | "ai_generation_failed"
        | "ai_recommendation_applied"
      task_priority: "low" | "normal" | "high" | "urgent"
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
      appointment_status: ["pending", "confirmed", "completed", "cancelled"],
      appointment_type: ["site_visit", "consultation", "meeting"],
      company_status: ["active", "suspended"],
      follow_up_status: ["pending", "completed", "cancelled"],
      invitation_status: ["pending", "accepted", "expired", "revoked"],
      lead_activity_type: [
        "created",
        "updated",
        "assignment_changed",
        "stage_changed",
        "note_added",
        "follow_up_scheduled",
        "follow_up_completed",
        "appointment_scheduled",
        "converted",
        "ai_insight_generated",
        "ai_insight_regenerated",
        "ai_score_applied",
        "ai_temperature_applied",
      ],
      lead_stage: [
        "new_inquiry",
        "contacted",
        "qualified",
        "proposal_sent",
        "negotiation",
        "site_visit",
        "converted",
        "lost",
      ],
      lead_temperature: ["hot", "warm", "cold"],
      member_role: ["owner", "admin", "sales_manager", "sales_representative"],
      membership_status: ["invited", "active", "suspended", "removed"],
      notification_type: [
        "lead_assigned",
        "follow_up_due",
        "appointment_reminder",
        "invitation",
        "system",
        "lead_reassigned",
        "lead_converted",
        "follow_up_assigned",
        "follow_up_rescheduled",
        "follow_up_overdue",
        "follow_up_completed",
        "appointment_created",
        "appointment_rescheduled",
        "appointment_confirmed",
        "appointment_cancelled",
        "membership_event",
        "ai_insight_completed",
        "ai_generation_failed",
        "ai_recommendation_applied",
      ],
      task_priority: ["low", "normal", "high", "urgent"],
    },
  },
} as const
