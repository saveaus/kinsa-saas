export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type AppRole = "admin" | "worker"
export type AppPermission =
  | "workers.manage"
  | "workers.read_all"
  | "documents.approve"
  | "documents.upload_own"
  | "documents.read_all"
  | "reminders.manage"
  | "reports.export"
  | "audit.read"
  | "settings.manage"

export type DocumentApprovalStatus = "pending" | "approved" | "rejected"
export type WorkerEmploymentStatus = "active" | "inactive"
export type StaffRole = "support" | "complex_care" | "leader" | "office"
export type ReminderCategory = "documents"
export type PolicyRecordStatus = "draft" | "accepted"
export type PolicyDrafter = "person" | "assistant"
export type ParticipantRecordKind = "service_agreement" | "support_plan"
export type ParticipantRecordStatus = "draft" | "accepted"
export type IncidentKind =
  "incident" | "complaint" | "risk" | "restrictive_practice"
export type IncidentStatus = "draft" | "accepted"
export type SupportPlanCheckStatus = "draft" | "accepted"
export type StaffTaskStatus = "open" | "done"

export type Database = {
  public: {
    Tables: {
      organisations: {
        Row: {
          id: string
          name: string
          logo_path: string | null
          abn: string | null
          registration_number: string | null
          registration_groups: string[]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          billing_plan: "staff" | "registered" | null
          billing_status:
            | "trialing"
            | "active"
            | "past_due"
            | "canceled"
            | "incomplete"
            | "paused"
            | null
          trial_ends_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          logo_path?: string | null
          abn?: string | null
          registration_number?: string | null
          registration_groups?: string[]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          billing_plan?: "staff" | "registered" | null
          billing_status?:
            | "trialing"
            | "active"
            | "past_due"
            | "canceled"
            | "incomplete"
            | "paused"
            | null
          trial_ends_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          logo_path?: string | null
          abn?: string | null
          registration_number?: string | null
          registration_groups?: string[]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          billing_plan?: "staff" | "registered" | null
          billing_status?:
            | "trialing"
            | "active"
            | "past_due"
            | "canceled"
            | "incomplete"
            | "paused"
            | null
          trial_ends_at?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          id: string
          email: string
          full_name: string | null
          created_at: string
          updated_at: string
        }
        Insert: { id: string; email: string; full_name?: string | null }
        Update: { email?: string; full_name?: string | null }
        Relationships: []
      }
      assistant_chats: {
        Row: {
          id: string
          organisation_id: string
          user_id: string
          title: string
          messages: Json
          created_at: string
          updated_at: string
          archived_at: string | null
          assignment_id: string | null
          purpose: string
        }
        Insert: {
          id?: string
          organisation_id: string
          user_id: string
          title: string
          messages?: Json
          created_at?: string
          updated_at?: string
          archived_at?: string | null
          assignment_id?: string | null
          purpose?: string
        }
        Update: {
          title?: string
          messages?: Json
          archived_at?: string | null
          assignment_id?: string | null
          purpose?: string
        }
        Relationships: []
      }
      assistant_usage: {
        Row: {
          organisation_id: string
          period_start: string
          tokens_used: number
          updated_at: string
        }
        Insert: {
          organisation_id: string
          period_start?: string
          tokens_used?: number
          updated_at?: string
        }
        Update: {
          period_start?: string
          tokens_used?: number
          updated_at?: string
        }
        Relationships: []
      }
      internal_audits: {
        Row: {
          id: string
          organisation_id: string
          title: string
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          organisation_id: string
          title: string
          created_by: string
          created_at?: string
        }
        Update: { title?: string }
        Relationships: []
      }
      internal_audit_assignments: {
        Row: {
          id: string
          organisation_id: string
          audit_id: string
          standard_code: string
          user_id: string
          assigned_by: string
          created_at: string
        }
        Insert: {
          id?: string
          organisation_id: string
          audit_id: string
          standard_code: string
          user_id: string
          assigned_by: string
          created_at?: string
        }
        Update: { standard_code?: string }
        Relationships: []
      }
      internal_audit_rating_proposals: {
        Row: {
          id: string
          organisation_id: string
          assignment_id: string
          user_id: string
          rating: string
          summary: string
          created_at: string
          used_at: string | null
          cancelled_at: string | null
        }
        Insert: {
          id?: string
          organisation_id: string
          assignment_id: string
          user_id: string
          rating: string
          summary: string
          created_at?: string
          used_at?: string | null
          cancelled_at?: string | null
        }
        Update: {
          used_at?: string | null
          cancelled_at?: string | null
        }
        Relationships: []
      }
      internal_audit_assessments: {
        Row: {
          assignment_id: string
          organisation_id: string
          rating: string
          source: string
          summary: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          assignment_id: string
          organisation_id: string
          rating: string
          source: string
          summary?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          rating?: string
          source?: string
          summary?: string | null
        }
        Relationships: []
      }
      memberships: {
        Row: {
          id: string
          user_id: string
          organisation_id: string
          role: AppRole
          created_at: string
        }
        Insert: { user_id: string; organisation_id: string; role: AppRole }
        Update: { role?: AppRole }
        Relationships: []
      }
      role_permissions: {
        Row: { role: AppRole; permission: AppPermission }
        Insert: { role: AppRole; permission: AppPermission }
        Update: { permission?: AppPermission }
        Relationships: []
      }
      teams: {
        Row: {
          id: string
          organisation_id: string
          name: string
          code: string
          built_in: boolean
          position: number
          created_at: string
          updated_at: string
        }
        Insert: {
          organisation_id: string
          name: string
          code: string
          built_in?: boolean
          position?: number
        }
        Update: { name?: string; position?: number }
        Relationships: []
      }
      team_permissions: {
        Row: { team_id: string; permission: AppPermission }
        Insert: { team_id: string; permission: AppPermission }
        Update: { permission?: AppPermission }
        Relationships: []
      }
      workers: {
        Row: {
          id: string
          organisation_id: string
          user_id: string | null
          first_name: string
          last_name: string
          email: string
          employment_status: WorkerEmploymentStatus
          staff_roles: string[]
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          organisation_id: string
          user_id?: string | null
          first_name: string
          last_name: string
          email: string
          employment_status?: WorkerEmploymentStatus
          staff_roles?: string[]
        }
        Update: {
          first_name?: string
          last_name?: string
          email?: string
          employment_status?: WorkerEmploymentStatus
          staff_roles?: string[]
          user_id?: string | null
          deleted_at?: string | null
        }
        Relationships: []
      }
      document_type_versions: {
        Row: {
          id: string
          code: string
          name: string
          description: string | null
          requires_expiry: boolean
          effective_from: string
          effective_to: string | null
          created_at: string
        }
        Insert: {
          code: string
          name: string
          description?: string | null
          requires_expiry?: boolean
        }
        Update: { name?: string; effective_to?: string | null }
        Relationships: []
      }
      organisation_document_types: {
        Row: {
          organisation_id: string
          document_type_version_id: string
          required: boolean
        }
        Insert: {
          organisation_id: string
          document_type_version_id: string
          required?: boolean
        }
        Update: { required?: boolean }
        Relationships: []
      }
      documents: {
        Row: {
          id: string
          organisation_id: string
          worker_id: string
          document_type_version_id: string
          storage_path: string
          original_filename: string
          mime_type: string
          file_size_bytes: number
          expires_on: string | null
          approval_status: DocumentApprovalStatus
          flagged: boolean
          review_note: string | null
          reviewed_by: string | null
          reviewed_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organisation_id: string
          worker_id: string
          document_type_version_id: string
          storage_path: string
          original_filename: string
          mime_type: string
          file_size_bytes: number
          expires_on?: string | null
          created_by?: string | null
        }
        Update: {
          approval_status?: DocumentApprovalStatus
          flagged?: boolean
          review_note?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
        }
        Relationships: []
      }
      policies: {
        Row: {
          id: string
          organisation_id: string
          name: string
          standard_code: string
          review_on: string
          status: PolicyRecordStatus
          body: string | null
          storage_path: string | null
          original_filename: string | null
          mime_type: string | null
          file_size_bytes: number | null
          drafted_by: PolicyDrafter
          template_key: string | null
          category: string | null
          file_id: string | null
          compliance_flagged: boolean
          compliance_note: string | null
          supersedes_policy_id: string | null
          created_by: string | null
          accepted_by: string | null
          accepted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organisation_id: string
          name: string
          standard_code: string
          review_on: string
          status?: PolicyRecordStatus
          body?: string | null
          storage_path?: string | null
          original_filename?: string | null
          mime_type?: string | null
          file_size_bytes?: number | null
          drafted_by?: PolicyDrafter
          template_key?: string | null
          category?: string | null
          file_id?: string | null
          compliance_flagged?: boolean
          compliance_note?: string | null
          supersedes_policy_id?: string | null
          created_by?: string | null
          accepted_by?: string | null
          accepted_at?: string | null
        }
        Update: {
          status?: PolicyRecordStatus
          accepted_by?: string | null
          accepted_at?: string | null
        }
        Relationships: []
      }
      policy_acknowledgements: {
        Row: {
          id: string
          organisation_id: string
          policy_id: string
          user_id: string
          acknowledged_at: string
        }
        Insert: {
          id?: string
          organisation_id: string
          policy_id: string
          user_id: string
          acknowledged_at?: string
        }
        Update: {
          acknowledged_at?: string
        }
        Relationships: []
      }
      policy_files: {
        Row: {
          id: string
          organisation_id: string
          category: string
          name: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organisation_id: string
          category: string
          name: string
          created_by?: string | null
        }
        Update: {
          name?: string
        }
        Relationships: []
      }
      participants: {
        Row: {
          id: string
          organisation_id: string
          name: string
          ndis_number: string
          active: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organisation_id: string
          name: string
          ndis_number: string
          active?: boolean
          created_by?: string | null
        }
        Update: {
          name?: string
          ndis_number?: string
          active?: boolean
        }
        Relationships: []
      }
      participant_records: {
        Row: {
          id: string
          organisation_id: string
          participant_id: string
          kind: ParticipantRecordKind
          starts_on: string | null
          ends_on: string | null
          review_on: string | null
          status: ParticipantRecordStatus
          storage_path: string
          original_filename: string
          mime_type: string
          file_size_bytes: number
          drafted_by: PolicyDrafter
          created_by: string | null
          accepted_by: string | null
          accepted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organisation_id: string
          participant_id: string
          kind: ParticipantRecordKind
          starts_on?: string | null
          ends_on?: string | null
          review_on?: string | null
          status?: ParticipantRecordStatus
          storage_path: string
          original_filename: string
          mime_type: string
          file_size_bytes: number
          drafted_by?: PolicyDrafter
          created_by?: string | null
          accepted_by?: string | null
          accepted_at?: string | null
        }
        Update: {
          status?: ParticipantRecordStatus
          accepted_by?: string | null
          accepted_at?: string | null
        }
        Relationships: []
      }
      incidents: {
        Row: {
          id: string
          organisation_id: string
          kind: IncidentKind
          summary: string
          occurred_on: string
          participant_id: string | null
          status: IncidentStatus
          storage_path: string
          original_filename: string
          mime_type: string
          file_size_bytes: number
          drafted_by: PolicyDrafter
          created_by: string | null
          accepted_by: string | null
          accepted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organisation_id: string
          kind: IncidentKind
          summary: string
          occurred_on: string
          participant_id?: string | null
          status?: IncidentStatus
          storage_path: string
          original_filename: string
          mime_type: string
          file_size_bytes: number
          drafted_by?: PolicyDrafter
          created_by?: string | null
          accepted_by?: string | null
          accepted_at?: string | null
        }
        Update: {
          status?: IncidentStatus
          accepted_by?: string | null
          accepted_at?: string | null
        }
        Relationships: []
      }
      staff_tasks: {
        Row: {
          id: string
          organisation_id: string
          title: string
          detail: string | null
          assignee_id: string
          created_by: string | null
          status: StaffTaskStatus
          due_on: string | null
          policy_id: string | null
          changes: string | null
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organisation_id: string
          title: string
          detail?: string | null
          assignee_id: string
          policy_id?: string | null
          changes?: string | null
          created_by?: string | null
          status?: StaffTaskStatus
          due_on?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          detail?: string | null
          assignee_id?: string
          status?: StaffTaskStatus
          due_on?: string | null
          completed_at?: string | null
        }
        Relationships: []
      }
      support_plan_checks: {
        Row: {
          id: string
          organisation_id: string
          participant_id: string
          plan_id: string
          note: string
          checked_on: string
          followed: boolean
          status: SupportPlanCheckStatus
          storage_path: string | null
          original_filename: string | null
          mime_type: string | null
          file_size_bytes: number | null
          drafted_by: PolicyDrafter
          created_by: string | null
          accepted_by: string | null
          accepted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organisation_id: string
          participant_id: string
          plan_id: string
          note: string
          checked_on: string
          followed: boolean
          status?: SupportPlanCheckStatus
          storage_path?: string | null
          original_filename?: string | null
          mime_type?: string | null
          file_size_bytes?: number | null
          drafted_by?: PolicyDrafter
          created_by?: string | null
          accepted_by?: string | null
          accepted_at?: string | null
        }
        Update: {
          status?: SupportPlanCheckStatus
          accepted_by?: string | null
          accepted_at?: string | null
        }
        Relationships: []
      }
      log_registers: {
        Row: {
          id: string
          organisation_id: string
          name: string
          slug: string
          visible: boolean
          scope: string
          subject: string
          participant_id: string | null
          worker_id: string | null
          built_in: string | null
          emoji: string
          evidence_area: string | null
          date_fields: Json
          template_key: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organisation_id: string
          name: string
          slug: string
          visible?: boolean
          scope: string
          subject: string
          participant_id?: string | null
          worker_id?: string | null
          built_in?: string | null
          emoji?: string
          evidence_area?: string | null
          date_fields?: Json
          template_key?: string | null
        }
        Update: {
          name?: string
          slug?: string
          visible?: boolean
          scope?: string
          subject?: string
          participant_id?: string | null
          worker_id?: string | null
          emoji?: string
          evidence_area?: string | null
          date_fields?: Json
          template_key?: string | null
        }
        Relationships: []
      }
      log_register_assignees: {
        Row: {
          id: string
          organisation_id: string
          register_id: string
          participant_id: string | null
          worker_id: string | null
        }
        Insert: {
          id?: string
          organisation_id: string
          register_id: string
          participant_id?: string | null
          worker_id?: string | null
        }
        Update: {
          participant_id?: string | null
          worker_id?: string | null
        }
        Relationships: []
      }
      log_entries: {
        Row: {
          id: string
          organisation_id: string
          register_id: string
          summary: string
          occurred_on: string
          participant_id: string | null
          worker_id: string | null
          status: IncidentStatus
          storage_path: string | null
          original_filename: string | null
          mime_type: string | null
          file_size_bytes: number | null
          due_on: string | null
          completed_at: string | null
          completed_by: string | null
          remind: boolean
          reminded_at: string | null
          drafted_by: PolicyDrafter
          created_by: string | null
          accepted_by: string | null
          accepted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organisation_id: string
          register_id: string
          summary: string
          occurred_on: string
          participant_id?: string | null
          worker_id?: string | null
          status?: IncidentStatus
          storage_path?: string | null
          original_filename?: string | null
          mime_type?: string | null
          file_size_bytes?: number | null
          due_on?: string | null
          remind?: boolean
          reminded_at?: string | null
          completed_at?: string | null
          completed_by?: string | null
          drafted_by?: PolicyDrafter
          created_by?: string | null
          accepted_by?: string | null
          accepted_at?: string | null
        }
        Update: {
          status?: IncidentStatus
          accepted_by?: string | null
          accepted_at?: string | null
          reminded_at?: string | null
          completed_at?: string | null
          completed_by?: string | null
        }
        Relationships: []
      }
      log_entry_people: {
        Row: {
          id: string
          organisation_id: string
          entry_id: string
          participant_id: string | null
          worker_id: string | null
        }
        Insert: {
          id?: string
          organisation_id: string
          entry_id: string
          participant_id?: string | null
          worker_id?: string | null
        }
        Update: {
          participant_id?: string | null
          worker_id?: string | null
        }
        Relationships: []
      }
      log_entry_files: {
        Row: {
          id: string
          organisation_id: string
          entry_id: string
          storage_path: string
          original_filename: string
          mime_type: string
          file_size_bytes: number
        }
        Insert: {
          id?: string
          organisation_id: string
          entry_id: string
          storage_path: string
          original_filename: string
          mime_type: string
          file_size_bytes: number
        }
        Update: {
          original_filename?: string
        }
        Relationships: []
      }
      log_entry_dates: {
        Row: {
          id: string
          organisation_id: string
          entry_id: string
          field_id: string
          label: string
          occurred_on: string
        }
        Insert: {
          id?: string
          organisation_id: string
          entry_id: string
          field_id: string
          label: string
          occurred_on: string
        }
        Update: {
          occurred_on?: string
        }
        Relationships: []
      }
      document_role_requirements: {
        Row: {
          organisation_id: string
          document_type_version_id: string
          staff_role: string
        }
        Insert: {
          organisation_id: string
          document_type_version_id: string
          staff_role: string
        }
        Update: { staff_role?: string }
        Relationships: []
      }
      reminder_rules: {
        Row: {
          id: string
          organisation_id: string
          category: ReminderCategory
          document_type_version_id: string | null
          document_id: string | null
          days_before: number
          subject: string
          body_template: string
          created_at: string
          updated_at: string
        }
        Insert: {
          organisation_id: string
          category: ReminderCategory
          document_type_version_id: string | null
          document_id: string | null
          days_before: number
          subject: string
          body_template: string
        }
        Update: {
          organisation_id?: string
          category?: ReminderCategory
          document_type_version_id?: string | null
          document_id?: string | null
          days_before?: number
          subject?: string
          body_template?: string
        }
        Relationships: []
      }
      reminder_dispatches: {
        Row: {
          id: string
          organisation_id: string
          reminder_rule_id: string
          document_id: string | null
          worker_id: string
          due_on: string
          sent_at: string
        }
        Insert: {
          organisation_id: string
          reminder_rule_id: string
          document_id?: string | null
          worker_id: string
          due_on: string
        }
        Update: Record<string, never>
        Relationships: []
      }
      audit_events: {
        Row: {
          id: string
          organisation_id: string
          actor_user_id: string | null
          actor_role: AppRole | null
          action: string
          target_type: string
          target_id: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          organisation_id: string
          actor_user_id?: string | null
          actor_role?: AppRole | null
          action: string
          target_type: string
          target_id?: string | null
          metadata?: Json
        }
        Update: Record<string, never>
        Relationships: []
      }
      document_access_events: {
        Row: {
          id: string
          organisation_id: string
          document_id: string
          actor_user_id: string | null
          action: string
          created_at: string
        }
        Insert: {
          organisation_id: string
          document_id: string
          actor_user_id?: string | null
          action?: string
        }
        Update: Record<string, never>
        Relationships: []
      }
      invites: {
        Row: {
          id: string
          organisation_id: string
          worker_id: string | null
          email: string
          token_hash: string
          expires_at: string
          accepted_at: string | null
          created_at: string
          role: AppRole
        }
        Insert: {
          organisation_id: string
          worker_id?: string | null
          email: string
          token_hash: string
          expires_at: string
          role?: AppRole
        }
        Update: { accepted_at?: string | null }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      accept_invite: { Args: { p_token_hash: string }; Returns: string }
      check_rate_limit: {
        Args: { p_key: string; p_max: number; p_window_seconds: number }
        Returns: boolean
      }
      create_organisation: {
        Args: { org_name: string; p_registration_groups?: string[] }
        Returns: string
      }
      current_user_is_inactive: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      peek_invite: {
        Args: { p_token_hash: string }
        Returns: { email: string; expires_at: string }[]
      }
      move_policy_to_file: {
        Args: { p_policy_id: string; p_file_id: string }
        Returns: undefined
      }
      record_audit: {
        Args: {
          p_action: string
          p_target_type: string
          p_target_id: string
          p_metadata?: Json
        }
        Returns: undefined
      }
      anonymize_worker_audit: {
        Args: { p_worker_id: string }
        Returns: undefined
      }
      record_assistant_tokens: {
        Args: { p_organisation_id: string; p_tokens: number }
        Returns: undefined
      }
      claim_assistant_trial_tokens: {
        Args: { p_organisation_id: string; p_tokens: number }
        Returns: number
      }
      settle_assistant_tokens: {
        Args: {
          p_organisation_id: string
          p_claimed: number
          p_actual: number
          p_claimed_at: string
        }
        Returns: undefined
      }
      append_interview_messages: {
        Args: {
          p_chat_id: string
          p_organisation_id: string
          p_user_id: string
          p_messages: Json
        }
        Returns: boolean
      }
      confirm_interview_rating: {
        Args: {
          p_proposal_id: string
          p_organisation_id: string
          p_user_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_permission: AppPermission
      app_role: AppRole
      document_approval_status: DocumentApprovalStatus
      reminder_category: ReminderCategory
      policy_record_status: PolicyRecordStatus
      participant_record_kind: ParticipantRecordKind
      participant_record_status: ParticipantRecordStatus
      incident_kind: IncidentKind
      incident_status: IncidentStatus
      support_plan_check_status: SupportPlanCheckStatus
      staff_task_status: StaffTaskStatus
      staff_role: StaffRole
      worker_employment_status: WorkerEmploymentStatus
    }
    CompositeTypes: Record<string, never>
  }
}
