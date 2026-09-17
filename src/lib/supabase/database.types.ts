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
      profiles: {
        Row: {
          id: string
          role: string | null
          email: string | null
          full_name: string | null
          phone: string | null
          avatar_url: string | null
          password_set_at: string | null
          suspended_at: string | null
          admin_notes: string | null
          coach_workspace: boolean
          created_at: string | null
          updated_at: string | null
          deleted_at: string | null
        }
        Insert: {
          id: string
          role?: string | null
          email?: string | null
          full_name?: string | null
          phone?: string | null
          avatar_url?: string | null
          password_set_at?: string | null
          suspended_at?: string | null
          admin_notes?: string | null
          coach_workspace?: boolean
          created_at?: string | null
          updated_at?: string | null
          deleted_at?: string | null
        }
        Update: {
          id?: string
          role?: string | null
          email?: string | null
          full_name?: string | null
          phone?: string | null
          avatar_url?: string | null
          password_set_at?: string | null
          suspended_at?: string | null
          admin_notes?: string | null
          coach_workspace?: boolean
          created_at?: string | null
          updated_at?: string | null
          deleted_at?: string | null
        }
        Relationships: []
      }
      coach_subscriptions: {
        Row: {
          id: string
          coach_id: string
          plan_tier: string
          status: string
          trial_started_at: string | null
          trial_ends_at: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          current_period_end: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          coach_id: string
          plan_tier?: string
          status?: string
          trial_started_at?: string | null
          trial_ends_at?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          current_period_end?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          coach_id?: string
          plan_tier?: string
          status?: string
          trial_started_at?: string | null
          trial_ends_at?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          current_period_end?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'coach_subscriptions_coach_id_fkey'
            columns: ['coach_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      coach_branding: {
        Row: {
          coach_id: string
          slug: string
          app_name: string | null
          logo_url: string | null
          primary_color: string | null
          pwa_icon_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          coach_id: string
          slug: string
          app_name?: string | null
          logo_url?: string | null
          primary_color?: string | null
          pwa_icon_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          coach_id?: string
          slug?: string
          app_name?: string | null
          logo_url?: string | null
          primary_color?: string | null
          pwa_icon_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'coach_branding_coach_id_fkey'
            columns: ['coach_id']
            isOneToOne: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      coach_public_profile: {
        Row: {
          coach_id: string
          public_name: string | null
          tagline: string | null
          bio: string | null
          photo_url: string | null
          cover_url: string | null
          share_message: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          coach_id: string
          public_name?: string | null
          tagline?: string | null
          bio?: string | null
          photo_url?: string | null
          cover_url?: string | null
          share_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          coach_id?: string
          public_name?: string | null
          tagline?: string | null
          bio?: string | null
          photo_url?: string | null
          cover_url?: string | null
          share_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'coach_public_profile_coach_id_fkey'
            columns: ['coach_id']
            isOneToOne: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      login_logs: {
        Row: {
          id: string
          user_id: string
          email: string | null
          context: string | null
          login_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          email?: string | null
          context?: string | null
          login_at?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          email?: string | null
          context?: string | null
          login_at?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      client_invites: {
        Row: {
          id: string
          token: string
          coach_id: string
          client_id: string
          email: string
          expires_at: string
          accepted_at: string | null
          revoked_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          token: string
          coach_id: string
          client_id: string
          email: string
          expires_at: string
          accepted_at?: string | null
          revoked_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          token?: string
          coach_id?: string
          client_id?: string
          email?: string
          expires_at?: string
          accepted_at?: string | null
          revoked_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          id: string
          coach_id: string
          user_id: string | null
          email: string
          first_name: string | null
          last_name: string | null
          phone: string | null
          sex: string | null
          birth_date: string | null
          weight_kg: number | null
          height_cm: number | null
          status: string
          is_demo: boolean
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          coach_id: string
          user_id?: string | null
          email: string
          first_name?: string | null
          last_name?: string | null
          phone?: string | null
          sex?: string | null
          birth_date?: string | null
          weight_kg?: number | null
          height_cm?: number | null
          status?: string
          is_demo?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          coach_id?: string
          user_id?: string | null
          email?: string
          first_name?: string | null
          last_name?: string | null
          phone?: string | null
          sex?: string | null
          birth_date?: string | null
          weight_kg?: number | null
          height_cm?: number | null
          status?: string
          is_demo?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'clients_coach_id_fkey'
            columns: ['coach_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'clients_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      prestations: {
        Row: {
          id: string
          coach_id: string
          name: string
          description: string | null
          pricing_type: string
          price_cents: number
          modules: Json
          program_template_id: string | null
          nutrition_template_id: string | null
          showroom_visible: boolean
          status: string
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          coach_id: string
          name: string
          description?: string | null
          pricing_type?: string
          price_cents?: number
          modules?: Json
          program_template_id?: string | null
          nutrition_template_id?: string | null
          showroom_visible?: boolean
          status?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          coach_id?: string
          name?: string
          description?: string | null
          pricing_type?: string
          price_cents?: number
          modules?: Json
          program_template_id?: string | null
          nutrition_template_id?: string | null
          showroom_visible?: boolean
          status?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'prestations_coach_id_fkey'
            columns: ['coach_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      payment_ledger: {
        Row: {
          id: string
          coach_id: string
          client_id: string
          prestation_id: string
          amount_cents: number
          status: string
          source: string
          paid_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          coach_id: string
          client_id: string
          prestation_id: string
          amount_cents?: number
          status?: string
          source?: string
          paid_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          coach_id?: string
          client_id?: string
          prestation_id?: string
          amount_cents?: number
          status?: string
          source?: string
          paid_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'payment_ledger_client_id_fkey'
            columns: ['client_id']
            isOneToOne: false
            referencedRelation: 'clients'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'payment_ledger_prestation_id_fkey'
            columns: ['prestation_id']
            isOneToOne: false
            referencedRelation: 'prestations'
            referencedColumns: ['id']
          },
        ]
      }
      client_grants: {
        Row: {
          id: string
          client_id: string
          coach_id: string
          prestation_id: string
          modules: Json
          status: string
          starts_at: string | null
          ends_at: string | null
          payment_ledger_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          client_id: string
          coach_id: string
          prestation_id: string
          modules?: Json
          status?: string
          starts_at?: string | null
          ends_at?: string | null
          payment_ledger_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          coach_id?: string
          prestation_id?: string
          modules?: Json
          status?: string
          starts_at?: string | null
          ends_at?: string | null
          payment_ledger_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'client_grants_client_id_fkey'
            columns: ['client_id']
            isOneToOne: false
            referencedRelation: 'clients'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'client_grants_prestation_id_fkey'
            columns: ['prestation_id']
            isOneToOne: false
            referencedRelation: 'prestations'
            referencedColumns: ['id']
          },
        ]
      }
      client_groups: {
        Row: {
          id: string
          coach_id: string
          name: string
          type: string
          prestation_id: string | null
          chat_enabled: boolean
          drive_enabled: boolean
          created_at: string
        }
        Insert: {
          id?: string
          coach_id: string
          name: string
          type?: string
          prestation_id?: string | null
          chat_enabled?: boolean
          drive_enabled?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          coach_id?: string
          name?: string
          type?: string
          prestation_id?: string | null
          chat_enabled?: boolean
          drive_enabled?: boolean
          created_at?: string
        }
        Relationships: []
      }
      client_group_members: {
        Row: {
          group_id: string
          client_id: string
          created_at: string
        }
        Insert: {
          group_id: string
          client_id: string
          created_at?: string
        }
        Update: {
          group_id?: string
          client_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'client_group_members_group_id_fkey'
            columns: ['group_id']
            isOneToOne: false
            referencedRelation: 'client_groups'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'client_group_members_client_id_fkey'
            columns: ['client_id']
            isOneToOne: false
            referencedRelation: 'clients'
            referencedColumns: ['id']
          },
        ]
      }
      coach_onboarding_questions: {
        Row: {
          id: string
          coach_id: string
          label: string
          type: string
          required: boolean
          sort_order: number
          options: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          coach_id: string
          label: string
          type?: string
          required?: boolean
          sort_order?: number
          options?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          coach_id?: string
          label?: string
          type?: string
          required?: boolean
          sort_order?: number
          options?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      onboarding_answers: {
        Row: {
          id: string
          client_id: string
          coach_id: string
          question_id: string
          value: Json
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          coach_id: string
          question_id: string
          value?: Json
          updated_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          coach_id?: string
          question_id?: string
          value?: Json
          updated_at?: string
        }
        Relationships: []
      }
      programs: {
        Row: {
          id: string
          coach_id: string
          title: string | null
          description: string | null
          goal: string | null
          level: string | null
          duration: string | null
          image_url: string | null
          is_published: boolean
          is_template: boolean | null
          is_calendar: boolean
          start_date: string | null
          status: string
          catalog_status: string
          allow_duplicate: boolean
          allow_download: boolean
          is_trainly_catalog: boolean
          created_at: string | null
          updated_at: string | null
          deleted_at: string | null
        }
        Insert: {
          id?: string
          coach_id: string
          title?: string | null
          description?: string | null
          goal?: string | null
          level?: string | null
          duration?: string | null
          image_url?: string | null
          is_published?: boolean
          is_template?: boolean | null
          is_calendar?: boolean
          start_date?: string | null
          status?: string
          catalog_status?: string
          allow_duplicate?: boolean
          allow_download?: boolean
          is_trainly_catalog?: boolean
          created_at?: string | null
          updated_at?: string | null
          deleted_at?: string | null
        }
        Update: {
          id?: string
          coach_id?: string
          title?: string | null
          description?: string | null
          goal?: string | null
          level?: string | null
          duration?: string | null
          image_url?: string | null
          is_published?: boolean
          is_template?: boolean | null
          is_calendar?: boolean
          start_date?: string | null
          status?: string
          catalog_status?: string
          allow_duplicate?: boolean
          allow_download?: boolean
          is_trainly_catalog?: boolean
          created_at?: string | null
          updated_at?: string | null
          deleted_at?: string | null
        }
        Relationships: []
      }
      client_fitness_plans: {
        Row: {
          id: string
          client_id: string
          coach_id: string
          source_program_id: string | null
          grant_id: string | null
          status: string
          is_calendar: boolean
          start_date: string | null
          snapshot: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          coach_id: string
          source_program_id?: string | null
          grant_id?: string | null
          status?: string
          is_calendar?: boolean
          start_date?: string | null
          snapshot?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          coach_id?: string
          source_program_id?: string | null
          grant_id?: string | null
          status?: string
          is_calendar?: boolean
          start_date?: string | null
          snapshot?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      session_runs: {
        Row: {
          id: string
          client_id: string
          coach_id: string
          plan_id: string | null
          source_session_id: string | null
          source: string
          title: string | null
          scheduled_date: string | null
          actual_date: string | null
          style: string
          snapshot: Json | null
          realized: Json | null
          comment: string | null
          started_at: string | null
          finished_at: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          client_id: string
          coach_id: string
          plan_id?: string | null
          source_session_id?: string | null
          source?: string
          title?: string | null
          scheduled_date?: string | null
          actual_date?: string | null
          style?: string
          snapshot?: Json | null
          realized?: Json | null
          comment?: string | null
          started_at?: string | null
          finished_at?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          client_id?: string
          coach_id?: string
          plan_id?: string | null
          source_session_id?: string | null
          source?: string
          title?: string | null
          scheduled_date?: string | null
          actual_date?: string | null
          style?: string
          snapshot?: Json | null
          realized?: Json | null
          comment?: string | null
          started_at?: string | null
          finished_at?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
      program_weeks: {
        Row: {
          id: string
          program_id: string
          title: string | null
          week_order: number
        }
        Insert: {
          id?: string
          program_id: string
          title?: string | null
          week_order: number
        }
        Update: {
          id?: string
          program_id?: string
          title?: string | null
          week_order?: number
        }
        Relationships: []
      }
      sessions: {
        Row: {
          id: string
          week_id: string
          title: string | null
          description: string | null
          session_order: number
        }
        Insert: {
          id?: string
          week_id: string
          title?: string | null
          description?: string | null
          session_order: number
        }
        Update: {
          id?: string
          week_id?: string
          title?: string | null
          description?: string | null
          session_order?: number
        }
        Relationships: []
      }
      program_exercises: {
        Row: {
          id: string
          session_id: string
          exercise_id: string | null
          name: string | null
          exercise_order: number
          sets: number | null
          reps: number | null
          rest_time: string | null
          rpe: number | null
          tempo: string | null
          load: string | null
          notes: string | null
        }
        Insert: {
          id?: string
          session_id: string
          exercise_id?: string | null
          name?: string | null
          exercise_order: number
          sets?: number | null
          reps?: number | null
          rest_time?: string | null
          rpe?: number | null
          tempo?: string | null
          load?: string | null
          notes?: string | null
        }
        Update: {
          id?: string
          session_id?: string
          exercise_id?: string | null
          name?: string | null
          exercise_order?: number
          sets?: number | null
          reps?: number | null
          rest_time?: string | null
          rpe?: number | null
          tempo?: string | null
          load?: string | null
          notes?: string | null
        }
        Relationships: []
      }
      exercise_library: {
        Row: {
          id: string
          name: string
          muscle_group: string | null
          difficulty: string | null
          description: string | null
          video_url: string | null
          demo_media_path: string | null
          common_mistakes: string | null
          replacement_exercise_id: string | null
          coach_id: string | null
          status: string
          exercise_type: string | null
          allow_duplicate: boolean
          allow_download: boolean
          created_at: string | null
          updated_at: string | null
          deleted_at: string | null
        }
        Insert: {
          id?: string
          name: string
          muscle_group?: string | null
          difficulty?: string | null
          description?: string | null
          video_url?: string | null
          demo_media_path?: string | null
          common_mistakes?: string | null
          replacement_exercise_id?: string | null
          coach_id?: string | null
          status?: string
          exercise_type?: string | null
          allow_duplicate?: boolean
          allow_download?: boolean
          created_at?: string | null
          updated_at?: string | null
          deleted_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          muscle_group?: string | null
          difficulty?: string | null
          description?: string | null
          video_url?: string | null
          demo_media_path?: string | null
          common_mistakes?: string | null
          replacement_exercise_id?: string | null
          coach_id?: string | null
          status?: string
          exercise_type?: string | null
          allow_duplicate?: boolean
          allow_download?: boolean
          created_at?: string | null
          updated_at?: string | null
          deleted_at?: string | null
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      current_profile_role: { Args: Record<string, never>; Returns: string }
      current_coach_id: { Args: Record<string, never>; Returns: string }
      current_client_id: { Args: Record<string, never>; Returns: string }
      is_platform_admin: { Args: Record<string, never>; Returns: boolean }
      redeem_client_invite: { Args: { p_token: string }; Returns: string }
      claim_client_by_email_for_coach: { Args: { p_coach_id: string }; Returns: string }
      claim_client_rows_by_email: { Args: Record<string, never>; Returns: number }
      register_as_client_for_coach: {
        Args: { p_coach_id: string; p_first_name?: string | null; p_last_name?: string | null }
        Returns: string
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
