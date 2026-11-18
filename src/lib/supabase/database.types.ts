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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      bilan_instances: {
        Row: {
          appears_at: string
          batch_id: string | null
          client_id: string
          client_opened_at: string | null
          coach_id: string
          coach_read_at: string | null
          created_at: string
          due_at: string
          id: string
          payload: Json
          recurrence_id: string | null
          schema_snapshot: Json
          source_group_id: string | null
          status: string
          submitted_at: string | null
          template_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          appears_at?: string
          batch_id?: string | null
          client_id: string
          client_opened_at?: string | null
          coach_id: string
          coach_read_at?: string | null
          created_at?: string
          due_at: string
          id?: string
          payload?: Json
          recurrence_id?: string | null
          schema_snapshot?: Json
          source_group_id?: string | null
          status?: string
          submitted_at?: string | null
          template_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          appears_at?: string
          batch_id?: string | null
          client_id?: string
          client_opened_at?: string | null
          coach_id?: string
          coach_read_at?: string | null
          created_at?: string
          due_at?: string
          id?: string
          payload?: Json
          recurrence_id?: string | null
          schema_snapshot?: Json
          source_group_id?: string | null
          status?: string
          submitted_at?: string | null
          template_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bilan_instances_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bilan_instances_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bilan_instances_recurrence_id_fkey"
            columns: ["recurrence_id"]
            isOneToOne: false
            referencedRelation: "bilan_recurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bilan_instances_source_group_id_fkey"
            columns: ["source_group_id"]
            isOneToOne: false
            referencedRelation: "client_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bilan_instances_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "bilan_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      bilan_recurrences: {
        Row: {
          active: boolean
          client_ids: string[]
          coach_id: string
          created_at: string
          day_of_month: number | null
          group_ids: string[]
          id: string
          next_appears_at: string | null
          template_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          client_ids?: string[]
          coach_id: string
          created_at?: string
          day_of_month?: number | null
          group_ids?: string[]
          id?: string
          next_appears_at?: string | null
          template_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          client_ids?: string[]
          coach_id?: string
          created_at?: string
          day_of_month?: number | null
          group_ids?: string[]
          id?: string
          next_appears_at?: string | null
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bilan_recurrences_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bilan_recurrences_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "bilan_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      bilan_templates: {
        Row: {
          coach_id: string
          created_at: string
          deleted_at: string | null
          id: string
          instructions: string | null
          schema: Json
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          instructions?: string | null
          schema?: Json
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          instructions?: string | null
          schema?: Json
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bilan_templates_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      block_exercises: {
        Row: {
          created_at: string
          exercise_id: string | null
          exercise_name: string | null
          id: string
          load: string | null
          notes: string | null
          position: number
          prescriptions: Json
          reps: string | null
          rest_time: string | null
          rpe: number | null
          session_block_id: string
          sets: number | null
        }
        Insert: {
          created_at?: string
          exercise_id?: string | null
          exercise_name?: string | null
          id?: string
          load?: string | null
          notes?: string | null
          position?: number
          prescriptions?: Json
          reps?: string | null
          rest_time?: string | null
          rpe?: number | null
          session_block_id: string
          sets?: number | null
        }
        Update: {
          created_at?: string
          exercise_id?: string | null
          exercise_name?: string | null
          id?: string
          load?: string | null
          notes?: string | null
          position?: number
          prescriptions?: Json
          reps?: string | null
          rest_time?: string | null
          rpe?: number | null
          session_block_id?: string
          sets?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "block_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercise_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "block_exercises_session_block_id_fkey"
            columns: ["session_block_id"]
            isOneToOne: false
            referencedRelation: "session_blocks"
            referencedColumns: ["id"]
          },
        ]
      }
      block_formats: {
        Row: {
          constraint_fields: string[]
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          key: string
          label: string
          position: number
          updated_at: string
        }
        Insert: {
          constraint_fields?: string[]
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          key: string
          label: string
          position?: number
          updated_at?: string
        }
        Update: {
          constraint_fields?: string[]
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          key?: string
          label?: string
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
      block_library: {
        Row: {
          allow_download: boolean
          allow_duplicate: boolean
          coach_id: string | null
          created_at: string
          deleted_at: string | null
          distance_m: number | null
          duration_seconds: number | null
          expected_result_unit_id: string | null
          format_id: string | null
          free_constraints: Json
          hub_visible: boolean
          id: string
          name: string
          notes: string | null
          rest_seconds: number | null
          rounds: number | null
          source_block_id: string | null
          source_kind: string
          sport_id: string | null
          status: string
          timer_note: string | null
          updated_at: string
          work_seconds: number | null
        }
        Insert: {
          allow_download?: boolean
          allow_duplicate?: boolean
          coach_id?: string | null
          created_at?: string
          deleted_at?: string | null
          distance_m?: number | null
          duration_seconds?: number | null
          expected_result_unit_id?: string | null
          format_id?: string | null
          free_constraints?: Json
          hub_visible?: boolean
          id?: string
          name: string
          notes?: string | null
          rest_seconds?: number | null
          rounds?: number | null
          source_block_id?: string | null
          source_kind?: string
          sport_id?: string | null
          status?: string
          timer_note?: string | null
          updated_at?: string
          work_seconds?: number | null
        }
        Update: {
          allow_download?: boolean
          allow_duplicate?: boolean
          coach_id?: string | null
          created_at?: string
          deleted_at?: string | null
          distance_m?: number | null
          duration_seconds?: number | null
          expected_result_unit_id?: string | null
          format_id?: string | null
          free_constraints?: Json
          hub_visible?: boolean
          id?: string
          name?: string
          notes?: string | null
          rest_seconds?: number | null
          rounds?: number | null
          source_block_id?: string | null
          source_kind?: string
          sport_id?: string | null
          status?: string
          timer_note?: string | null
          updated_at?: string
          work_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "block_library_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "block_library_expected_result_unit_id_fkey"
            columns: ["expected_result_unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "block_library_format_id_fkey"
            columns: ["format_id"]
            isOneToOne: false
            referencedRelation: "block_formats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "block_library_source_block_id_fkey"
            columns: ["source_block_id"]
            isOneToOne: false
            referencedRelation: "block_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "block_library_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      block_library_exercises: {
        Row: {
          block_id: string
          created_at: string
          exercise_id: string
          id: string
          position: number
          prescriptions: Json
        }
        Insert: {
          block_id: string
          created_at?: string
          exercise_id: string
          id?: string
          position?: number
          prescriptions?: Json
        }
        Update: {
          block_id?: string
          created_at?: string
          exercise_id?: string
          id?: string
          position?: number
          prescriptions?: Json
        }
        Relationships: [
          {
            foreignKeyName: "block_library_exercises_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "block_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "block_library_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercise_library"
            referencedColumns: ["id"]
          },
        ]
      }
      block_library_hidden_types: {
        Row: {
          block_id: string
          created_at: string
          exercise_type_id: string
        }
        Insert: {
          block_id: string
          created_at?: string
          exercise_type_id: string
        }
        Update: {
          block_id?: string
          created_at?: string
          exercise_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "block_library_hidden_types_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "block_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "block_library_hidden_types_exercise_type_id_fkey"
            columns: ["exercise_type_id"]
            isOneToOne: false
            referencedRelation: "exercise_types"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          batch_id: string | null
          client_id: string
          client_message: string | null
          coach_id: string
          created_at: string
          created_by: string
          deleted_at: string | null
          ends_at: string | null
          group_id: string | null
          id: string
          location: string | null
          modality: string | null
          notes: string | null
          responded_at: string | null
          starts_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          batch_id?: string | null
          client_id: string
          client_message?: string | null
          coach_id: string
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          ends_at?: string | null
          group_id?: string | null
          id?: string
          location?: string | null
          modality?: string | null
          notes?: string | null
          responded_at?: string | null
          starts_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Update: {
          batch_id?: string | null
          client_id?: string
          client_message?: string | null
          coach_id?: string
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          ends_at?: string | null
          group_id?: string | null
          id?: string
          location?: string | null
          modality?: string | null
          notes?: string | null
          responded_at?: string | null
          starts_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "client_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_message_hides: {
        Row: {
          created_at: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_message_hides_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_message_hides_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_message_reactions: {
        Row: {
          created_at: string
          emoji: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_message_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          body: string
          created_at: string
          deleted_at: string | null
          forwarded_from_id: string | null
          id: string
          media_bytes: number | null
          media_duration_ms: number | null
          media_kind: string | null
          media_mime: string | null
          media_name: string | null
          media_path: string | null
          mentions: string[]
          pinned_at: string | null
          reply_to_id: string | null
          sender_id: string
          tag: string | null
          thread_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          deleted_at?: string | null
          forwarded_from_id?: string | null
          id?: string
          media_bytes?: number | null
          media_duration_ms?: number | null
          media_kind?: string | null
          media_mime?: string | null
          media_name?: string | null
          media_path?: string | null
          mentions?: string[]
          pinned_at?: string | null
          reply_to_id?: string | null
          sender_id: string
          tag?: string | null
          thread_id: string
        }
        Update: {
          body?: string
          created_at?: string
          deleted_at?: string | null
          forwarded_from_id?: string | null
          id?: string
          media_bytes?: number | null
          media_duration_ms?: number | null
          media_kind?: string | null
          media_mime?: string | null
          media_name?: string | null
          media_path?: string | null
          mentions?: string[]
          pinned_at?: string | null
          reply_to_id?: string | null
          sender_id?: string
          tag?: string | null
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_forwarded_from_id_fkey"
            columns: ["forwarded_from_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_thread_reads: {
        Row: {
          last_read_at: string
          reader_id: string
          thread_id: string
        }
        Insert: {
          last_read_at?: string
          reader_id: string
          thread_id: string
        }
        Update: {
          last_read_at?: string
          reader_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_thread_reads_reader_id_fkey"
            columns: ["reader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_thread_reads_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_thread_user_state: {
        Row: {
          archived_at: string | null
          cleared_before: string | null
          pinned_at: string | null
          thread_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          cleared_before?: string | null
          pinned_at?: string | null
          thread_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          cleared_before?: string | null
          pinned_at?: string | null
          thread_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_thread_user_state_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_thread_user_state_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          client_id: string | null
          coach_id: string
          created_at: string
          deleted_at: string | null
          group_id: string | null
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          title: string | null
          type: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          coach_id: string
          created_at?: string
          deleted_at?: string | null
          group_id?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          title?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          coach_id?: string
          created_at?: string
          deleted_at?: string | null
          group_id?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          title?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_threads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_threads_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_threads_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "client_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      client_diy_sessions: {
        Row: {
          client_id: string
          coach_id: string
          created_at: string
          deleted_at: string | null
          id: string
          snapshot: Json
          title: string
          updated_at: string
        }
        Insert: {
          client_id: string
          coach_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          snapshot?: Json
          title?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          coach_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          snapshot?: Json
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_diy_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_diy_sessions_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_favorites: {
        Row: {
          client_id: string
          coach_id: string
          created_at: string
          id: string
          target_id: string
          target_type: string
        }
        Insert: {
          client_id: string
          coach_id: string
          created_at?: string
          id?: string
          target_id: string
          target_type: string
        }
        Update: {
          client_id?: string
          coach_id?: string
          created_at?: string
          id?: string
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_favorites_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_favorites_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_fitness_plans: {
        Row: {
          client_id: string
          coach_id: string
          created_at: string
          grant_id: string | null
          id: string
          is_calendar: boolean
          snapshot: Json | null
          source_program_id: string | null
          start_date: string | null
          status: string
          template_program_id: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          coach_id: string
          created_at?: string
          grant_id?: string | null
          id?: string
          is_calendar?: boolean
          snapshot?: Json | null
          source_program_id?: string | null
          start_date?: string | null
          status?: string
          template_program_id?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          coach_id?: string
          created_at?: string
          grant_id?: string | null
          id?: string
          is_calendar?: boolean
          snapshot?: Json | null
          source_program_id?: string | null
          start_date?: string | null
          status?: string
          template_program_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_fitness_plans_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_fitness_plans_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_fitness_plans_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "client_grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_fitness_plans_source_program_id_fkey"
            columns: ["source_program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_fitness_plans_template_program_id_fkey"
            columns: ["template_program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      client_grants: {
        Row: {
          client_id: string
          coach_id: string
          created_at: string
          ends_at: string | null
          id: string
          modules: Json
          payment_ledger_id: string | null
          prestation_id: string
          starts_at: string | null
          status: string
        }
        Insert: {
          client_id: string
          coach_id: string
          created_at?: string
          ends_at?: string | null
          id?: string
          modules?: Json
          payment_ledger_id?: string | null
          prestation_id: string
          starts_at?: string | null
          status?: string
        }
        Update: {
          client_id?: string
          coach_id?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          modules?: Json
          payment_ledger_id?: string | null
          prestation_id?: string
          starts_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_grants_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_grants_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_grants_payment_ledger_id_fkey"
            columns: ["payment_ledger_id"]
            isOneToOne: false
            referencedRelation: "payment_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_grants_prestation_id_fkey"
            columns: ["prestation_id"]
            isOneToOne: false
            referencedRelation: "prestations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_group_exclusions: {
        Row: {
          client_id: string
          created_at: string
          group_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          group_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          group_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_group_exclusions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_group_exclusions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "client_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      client_group_members: {
        Row: {
          client_id: string
          created_at: string
          group_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          group_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          group_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_group_members_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "client_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      client_group_pushed_content: {
        Row: {
          content_id: string
          created_at: string
          group_id: string
          id: string
          kind: string
          last_pushed_at: string
          last_pushed_count: number
        }
        Insert: {
          content_id: string
          created_at?: string
          group_id: string
          id?: string
          kind: string
          last_pushed_at?: string
          last_pushed_count?: number
        }
        Update: {
          content_id?: string
          created_at?: string
          group_id?: string
          id?: string
          kind?: string
          last_pushed_at?: string
          last_pushed_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_group_pushed_content_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "client_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      client_group_tags: {
        Row: {
          created_at: string
          group_id: string
          id: string
          kind: string
          ref_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          kind: string
          ref_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          kind?: string
          ref_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_group_tags_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "client_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      client_groups: {
        Row: {
          chat_enabled: boolean
          chat_title: string | null
          coach_id: string
          created_at: string
          description: string | null
          drive_enabled: boolean
          drive_folder_id: string | null
          id: string
          name: string
          prestation_id: string | null
          type: string
        }
        Insert: {
          chat_enabled?: boolean
          chat_title?: string | null
          coach_id: string
          created_at?: string
          description?: string | null
          drive_enabled?: boolean
          drive_folder_id?: string | null
          id?: string
          name: string
          prestation_id?: string | null
          type?: string
        }
        Update: {
          chat_enabled?: boolean
          chat_title?: string | null
          coach_id?: string
          created_at?: string
          description?: string | null
          drive_enabled?: boolean
          drive_folder_id?: string | null
          id?: string
          name?: string
          prestation_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_groups_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_groups_drive_folder_id_fkey"
            columns: ["drive_folder_id"]
            isOneToOne: false
            referencedRelation: "drive_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_groups_prestation_id_fkey"
            columns: ["prestation_id"]
            isOneToOne: false
            referencedRelation: "prestations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_invites: {
        Row: {
          accepted_at: string | null
          client_id: string
          coach_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          revoked_at: string | null
          token: string
        }
        Insert: {
          accepted_at?: string | null
          client_id: string
          coach_id: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          revoked_at?: string | null
          token: string
        }
        Update: {
          accepted_at?: string | null
          client_id?: string
          coach_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          revoked_at?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_invites_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_invites_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_nutrition_plans: {
        Row: {
          client_id: string
          coach_id: string
          created_at: string
          id: string
          snapshot: Json | null
          source_plan_id: string | null
          start_date: string | null
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          coach_id: string
          created_at?: string
          id?: string
          snapshot?: Json | null
          source_plan_id?: string | null
          start_date?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          coach_id?: string
          created_at?: string
          id?: string
          snapshot?: Json | null
          source_plan_id?: string | null
          start_date?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_nutrition_plans_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_nutrition_plans_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_nutrition_plans_source_plan_id_fkey"
            columns: ["source_plan_id"]
            isOneToOne: false
            referencedRelation: "nutrition_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          birth_date: string | null
          coach_id: string
          created_at: string
          deleted_at: string | null
          email: string
          first_name: string | null
          height_cm: number | null
          id: string
          is_demo: boolean
          last_name: string | null
          onboarding_completed_at: string | null
          phone: string | null
          sex: string | null
          status: string
          tracked_link_id: string | null
          updated_at: string
          user_id: string | null
          weight_kg: number | null
        }
        Insert: {
          birth_date?: string | null
          coach_id: string
          created_at?: string
          deleted_at?: string | null
          email: string
          first_name?: string | null
          height_cm?: number | null
          id?: string
          is_demo?: boolean
          last_name?: string | null
          onboarding_completed_at?: string | null
          phone?: string | null
          sex?: string | null
          status?: string
          tracked_link_id?: string | null
          updated_at?: string
          user_id?: string | null
          weight_kg?: number | null
        }
        Update: {
          birth_date?: string | null
          coach_id?: string
          created_at?: string
          deleted_at?: string | null
          email?: string
          first_name?: string | null
          height_cm?: number | null
          id?: string
          is_demo?: boolean
          last_name?: string | null
          onboarding_completed_at?: string | null
          phone?: string | null
          sex?: string | null
          status?: string
          tracked_link_id?: string | null
          updated_at?: string
          user_id?: string | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_tracked_link_id_fkey"
            columns: ["tracked_link_id"]
            isOneToOne: false
            referencedRelation: "coach_tracked_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_branding: {
        Row: {
          app_name: string | null
          app_showroom_features: Json
          app_showroom_pitch: string | null
          app_showroom_title: string | null
          bg_style: string
          coach_id: string
          contact_facebook: string | null
          contact_instagram: string | null
          contact_whatsapp: string | null
          created_at: string
          interest_discuss_body: string | null
          interest_discuss_title: string | null
          logo_url: string | null
          primary_color: string | null
          pwa_icon_url: string | null
          secondary_color: string | null
          slug: string
          theme_mode: string
          updated_at: string
        }
        Insert: {
          app_name?: string | null
          app_showroom_features?: Json
          app_showroom_pitch?: string | null
          app_showroom_title?: string | null
          bg_style?: string
          coach_id: string
          contact_facebook?: string | null
          contact_instagram?: string | null
          contact_whatsapp?: string | null
          created_at?: string
          interest_discuss_body?: string | null
          interest_discuss_title?: string | null
          logo_url?: string | null
          primary_color?: string | null
          pwa_icon_url?: string | null
          secondary_color?: string | null
          slug: string
          theme_mode?: string
          updated_at?: string
        }
        Update: {
          app_name?: string | null
          app_showroom_features?: Json
          app_showroom_pitch?: string | null
          app_showroom_title?: string | null
          bg_style?: string
          coach_id?: string
          contact_facebook?: string | null
          contact_instagram?: string | null
          contact_whatsapp?: string | null
          created_at?: string
          interest_discuss_body?: string | null
          interest_discuss_title?: string | null
          logo_url?: string | null
          primary_color?: string | null
          pwa_icon_url?: string | null
          secondary_color?: string | null
          slug?: string
          theme_mode?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_branding_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_codes: {
        Row: {
          amount_cents: number | null
          audience: string
          audience_client_id: string | null
          audience_group_id: string | null
          audience_prestation_id: string | null
          coach_id: string
          code: string
          created_at: string
          expires_at: string | null
          id: string
          last_redeemed_at: string | null
          last_redeemed_client_id: string | null
          max_uses: number | null
          percent_off: number | null
          prestation_id: string | null
          prestation_ids: string[]
          starts_at: string
          status: string
          type: string
          used_count: number
        }
        Insert: {
          amount_cents?: number | null
          audience?: string
          audience_client_id?: string | null
          audience_group_id?: string | null
          audience_prestation_id?: string | null
          coach_id: string
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          last_redeemed_at?: string | null
          last_redeemed_client_id?: string | null
          max_uses?: number | null
          percent_off?: number | null
          prestation_id?: string | null
          prestation_ids?: string[]
          starts_at?: string
          status?: string
          type: string
          used_count?: number
        }
        Update: {
          amount_cents?: number | null
          audience?: string
          audience_client_id?: string | null
          audience_group_id?: string | null
          audience_prestation_id?: string | null
          coach_id?: string
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          last_redeemed_at?: string | null
          last_redeemed_client_id?: string | null
          max_uses?: number | null
          percent_off?: number | null
          prestation_id?: string | null
          prestation_ids?: string[]
          starts_at?: string
          status?: string
          type?: string
          used_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "coach_codes_audience_client_id_fkey"
            columns: ["audience_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_codes_audience_group_id_fkey"
            columns: ["audience_group_id"]
            isOneToOne: false
            referencedRelation: "client_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_codes_audience_prestation_id_fkey"
            columns: ["audience_prestation_id"]
            isOneToOne: false
            referencedRelation: "prestations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_codes_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_codes_last_redeemed_client_id_fkey"
            columns: ["last_redeemed_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_codes_prestation_id_fkey"
            columns: ["prestation_id"]
            isOneToOne: false
            referencedRelation: "prestations"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_onboarding_questions: {
        Row: {
          coach_id: string
          created_at: string
          id: string
          label: string
          options: Json | null
          required: boolean
          sort_order: number
          type: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          id?: string
          label: string
          options?: Json | null
          required?: boolean
          sort_order?: number
          type?: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          id?: string
          label?: string
          options?: Json | null
          required?: boolean
          sort_order?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_onboarding_questions_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_public_profile: {
        Row: {
          bio: string | null
          coach_id: string
          cover_url: string | null
          created_at: string
          photo_url: string | null
          public_name: string | null
          share_message: string | null
          showroom_header_tags: Json
          showroom_tags: Json
          showroom_testimonials: Json
          tagline: string | null
          updated_at: string
          video_url: string | null
        }
        Insert: {
          bio?: string | null
          coach_id: string
          cover_url?: string | null
          created_at?: string
          photo_url?: string | null
          public_name?: string | null
          share_message?: string | null
          showroom_header_tags?: Json
          showroom_tags?: Json
          showroom_testimonials?: Json
          tagline?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          bio?: string | null
          coach_id?: string
          cover_url?: string | null
          created_at?: string
          photo_url?: string | null
          public_name?: string | null
          share_message?: string | null
          showroom_header_tags?: Json
          showroom_tags?: Json
          showroom_testimonials?: Json
          tagline?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_public_profile_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_subscriptions: {
        Row: {
          coach_id: string
          created_at: string
          current_period_end: string | null
          id: string
          plan_tier: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_tier?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_tier?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_subscriptions_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_tracked_leads: {
        Row: {
          birthdate: string | null
          channel: string
          click_id: string | null
          coach_id: string
          created_at: string
          email: string | null
          first_name: string | null
          handle: string | null
          id: string
          last_name: string | null
          link_id: string
          note: string | null
          phone: string | null
          prestation_id: string | null
        }
        Insert: {
          birthdate?: string | null
          channel: string
          click_id?: string | null
          coach_id: string
          created_at?: string
          email?: string | null
          first_name?: string | null
          handle?: string | null
          id?: string
          last_name?: string | null
          link_id: string
          note?: string | null
          phone?: string | null
          prestation_id?: string | null
        }
        Update: {
          birthdate?: string | null
          channel?: string
          click_id?: string | null
          coach_id?: string
          created_at?: string
          email?: string | null
          first_name?: string | null
          handle?: string | null
          id?: string
          last_name?: string | null
          link_id?: string
          note?: string | null
          phone?: string | null
          prestation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_tracked_leads_click_id_fkey"
            columns: ["click_id"]
            isOneToOne: false
            referencedRelation: "coach_tracked_link_clicks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_tracked_leads_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_tracked_leads_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "coach_tracked_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_tracked_leads_prestation_id_fkey"
            columns: ["prestation_id"]
            isOneToOne: false
            referencedRelation: "prestations"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_tracked_link_clicks: {
        Row: {
          coach_id: string
          created_at: string
          id: string
          link_id: string
          visitor_key: string | null
        }
        Insert: {
          coach_id: string
          created_at?: string
          id?: string
          link_id: string
          visitor_key?: string | null
        }
        Update: {
          coach_id?: string
          created_at?: string
          id?: string
          link_id?: string
          visitor_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_tracked_link_clicks_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_tracked_link_clicks_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "coach_tracked_links"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_tracked_links: {
        Row: {
          capture_leads: boolean
          channel: string
          coach_id: string
          code: string
          created_at: string
          id: string
          is_default: boolean
          label: string
          prestation_id: string | null
          promo_code_id: string | null
          share_message: string | null
          status: string
          target_kind: string
        }
        Insert: {
          capture_leads?: boolean
          channel?: string
          coach_id: string
          code: string
          created_at?: string
          id?: string
          is_default?: boolean
          label: string
          prestation_id?: string | null
          promo_code_id?: string | null
          share_message?: string | null
          status?: string
          target_kind?: string
        }
        Update: {
          capture_leads?: boolean
          channel?: string
          coach_id?: string
          code?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          prestation_id?: string | null
          promo_code_id?: string | null
          share_message?: string | null
          status?: string
          target_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_tracked_links_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_tracked_links_prestation_id_fkey"
            columns: ["prestation_id"]
            isOneToOne: false
            referencedRelation: "prestations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_tracked_links_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "coach_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      documentation_folders: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_system: boolean
          slug: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_system?: boolean
          slug: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_system?: boolean
          slug?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documentation_folders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      documentation_items: {
        Row: {
          allow_duplicate: boolean
          created_at: string
          created_by: string | null
          description: string | null
          file_path: string | null
          folder_id: string
          id: string
          media_type: string
          mime_type: string | null
          original_name: string | null
          published: boolean
          size_bytes: number | null
          storage_bucket: string
          title: string
          updated_at: string
        }
        Insert: {
          allow_duplicate?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_path?: string | null
          folder_id: string
          id?: string
          media_type: string
          mime_type?: string | null
          original_name?: string | null
          published?: boolean
          size_bytes?: number | null
          storage_bucket: string
          title: string
          updated_at?: string
        }
        Update: {
          allow_duplicate?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_path?: string | null
          folder_id?: string
          id?: string
          media_type?: string
          mime_type?: string | null
          original_name?: string | null
          published?: boolean
          size_bytes?: number | null
          storage_bucket?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documentation_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentation_items_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "documentation_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      drive_files: {
        Row: {
          coach_id: string
          created_at: string
          deleted_at: string | null
          folder_id: string | null
          id: string
          mime_type: string | null
          name: string
          size_bytes: number | null
          storage_path: string
          updated_at: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          deleted_at?: string | null
          folder_id?: string | null
          id?: string
          mime_type?: string | null
          name: string
          size_bytes?: number | null
          storage_path: string
          updated_at?: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          deleted_at?: string | null
          folder_id?: string | null
          id?: string
          mime_type?: string | null
          name?: string
          size_bytes?: number | null
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drive_files_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drive_files_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "drive_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      drive_folders: {
        Row: {
          coach_id: string
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drive_folders_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drive_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "drive_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      drive_shares: {
        Row: {
          client_id: string | null
          coach_id: string
          created_at: string
          file_id: string | null
          folder_id: string | null
          group_id: string | null
          id: string
        }
        Insert: {
          client_id?: string | null
          coach_id: string
          created_at?: string
          file_id?: string | null
          folder_id?: string | null
          group_id?: string | null
          id?: string
        }
        Update: {
          client_id?: string | null
          coach_id?: string
          created_at?: string
          file_id?: string | null
          folder_id?: string | null
          group_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drive_shares_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drive_shares_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drive_shares_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "drive_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drive_shares_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "drive_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drive_shares_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "client_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_library: {
        Row: {
          allow_download: boolean
          allow_duplicate: boolean
          coach_id: string | null
          common_mistakes: string | null
          created_at: string
          deleted_at: string | null
          demo_media_path: string | null
          description: string | null
          difficulty: string | null
          exercise_type: string | null
          exercise_type_id: string | null
          id: string
          muscle_group: string | null
          name: string
          named_notes: Json
          replacement_exercise_id: string | null
          source_exercise_id: string | null
          source_kind: string
          sport_id: string | null
          status: string | null
          updated_at: string
          video_url: string | null
        }
        Insert: {
          allow_download?: boolean
          allow_duplicate?: boolean
          coach_id?: string | null
          common_mistakes?: string | null
          created_at?: string
          deleted_at?: string | null
          demo_media_path?: string | null
          description?: string | null
          difficulty?: string | null
          exercise_type?: string | null
          exercise_type_id?: string | null
          id?: string
          muscle_group?: string | null
          name: string
          named_notes?: Json
          replacement_exercise_id?: string | null
          source_exercise_id?: string | null
          source_kind?: string
          sport_id?: string | null
          status?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          allow_download?: boolean
          allow_duplicate?: boolean
          coach_id?: string | null
          common_mistakes?: string | null
          created_at?: string
          deleted_at?: string | null
          demo_media_path?: string | null
          description?: string | null
          difficulty?: string | null
          exercise_type?: string | null
          exercise_type_id?: string | null
          id?: string
          muscle_group?: string | null
          name?: string
          named_notes?: Json
          replacement_exercise_id?: string | null
          source_exercise_id?: string | null
          source_kind?: string
          sport_id?: string | null
          status?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercise_library_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_library_exercise_type_id_fkey"
            columns: ["exercise_type_id"]
            isOneToOne: false
            referencedRelation: "exercise_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_library_replacement_exercise_id_fkey"
            columns: ["replacement_exercise_id"]
            isOneToOne: false
            referencedRelation: "exercise_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_library_source_exercise_id_fkey"
            columns: ["source_exercise_id"]
            isOneToOne: false
            referencedRelation: "exercise_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_library_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_replacements: {
        Row: {
          created_at: string
          exercise_id: string
          id: string
          note: string | null
          position: number
          replacement_id: string
          title: string | null
        }
        Insert: {
          created_at?: string
          exercise_id: string
          id?: string
          note?: string | null
          position?: number
          replacement_id: string
          title?: string | null
        }
        Update: {
          created_at?: string
          exercise_id?: string
          id?: string
          note?: string | null
          position?: number
          replacement_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercise_replacements_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercise_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_replacements_replacement_id_fkey"
            columns: ["replacement_id"]
            isOneToOne: false
            referencedRelation: "exercise_library"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_types: {
        Row: {
          coach_id: string | null
          created_at: string
          deleted_at: string | null
          id: string
          label: string
          source_id: string | null
          updated_at: string
        }
        Insert: {
          coach_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          label: string
          source_id?: string | null
          updated_at?: string
        }
        Update: {
          coach_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          label?: string
          source_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_types_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_types_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "exercise_types"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_requests: {
        Row: {
          client_id: string
          coach_id: string
          comment: string | null
          created_at: string
          id: string
          payment_ledger_id: string | null
          prestation_id: string | null
          resolved_at: string | null
          status: string
        }
        Insert: {
          client_id: string
          coach_id: string
          comment?: string | null
          created_at?: string
          id?: string
          payment_ledger_id?: string | null
          prestation_id?: string | null
          resolved_at?: string | null
          status?: string
        }
        Update: {
          client_id?: string
          coach_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          payment_ledger_id?: string | null
          prestation_id?: string | null
          resolved_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_requests_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_requests_payment_ledger_id_fkey"
            columns: ["payment_ledger_id"]
            isOneToOne: false
            referencedRelation: "payment_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_requests_prestation_id_fkey"
            columns: ["prestation_id"]
            isOneToOne: false
            referencedRelation: "prestations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_cents: number
          client_id: string
          coach_id: string
          created_at: string
          id: string
          invoice_request_id: string | null
          issued_at: string
          notes: string | null
          number: string
          payment_ledger_id: string
        }
        Insert: {
          amount_cents?: number
          client_id: string
          coach_id: string
          created_at?: string
          id?: string
          invoice_request_id?: string | null
          issued_at?: string
          notes?: string | null
          number: string
          payment_ledger_id: string
        }
        Update: {
          amount_cents?: number
          client_id?: string
          coach_id?: string
          created_at?: string
          id?: string
          invoice_request_id?: string | null
          issued_at?: string
          notes?: string | null
          number?: string
          payment_ledger_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_invoice_request_id_fkey"
            columns: ["invoice_request_id"]
            isOneToOne: false
            referencedRelation: "invoice_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_payment_ledger_id_fkey"
            columns: ["payment_ledger_id"]
            isOneToOne: false
            referencedRelation: "payment_ledger"
            referencedColumns: ["id"]
          },
        ]
      }
      login_logs: {
        Row: {
          context: string | null
          created_at: string | null
          email: string | null
          id: string
          login_at: string | null
          user_id: string
        }
        Insert: {
          context?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          login_at?: string | null
          user_id: string
        }
        Update: {
          context?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          login_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      media_library: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          id: string
          kind: string
          label: string | null
          sort_order: number
          storage_path: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          id?: string
          kind?: string
          label?: string | null
          sort_order?: number
          storage_path: string
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          id?: string
          kind?: string
          label?: string | null
          sort_order?: number
          storage_path?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          payload: Json | null
          read_at: string | null
          title: string | null
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          payload?: Json | null
          read_at?: string | null
          title?: string | null
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          payload?: Json | null
          read_at?: string | null
          title?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrition_day_logs: {
        Row: {
          client_id: string
          created_at: string
          day_comment: string | null
          day_date: string
          id: string
          meals_validated: Json
          plan_id: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          day_comment?: string | null
          day_date: string
          id?: string
          meals_validated?: Json
          plan_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          day_comment?: string | null
          day_date?: string
          id?: string
          meals_validated?: Json
          plan_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrition_day_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrition_day_logs_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "client_nutrition_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrition_plans: {
        Row: {
          coach_id: string
          created_at: string
          deleted_at: string | null
          id: string
          status: string
          structure: Json
          title: string
          updated_at: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          status?: string
          structure?: Json
          title?: string
          updated_at?: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          status?: string
          structure?: Json
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrition_plans_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrition_recipes: {
        Row: {
          carbs_g: number | null
          coach_id: string
          created_at: string
          deleted_at: string | null
          fat_g: number | null
          id: string
          kcal: number | null
          notes: string | null
          protein_g: number | null
          title: string
          updated_at: string
        }
        Insert: {
          carbs_g?: number | null
          coach_id: string
          created_at?: string
          deleted_at?: string | null
          fat_g?: number | null
          id?: string
          kcal?: number | null
          notes?: string | null
          protein_g?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          carbs_g?: number | null
          coach_id?: string
          created_at?: string
          deleted_at?: string | null
          fat_g?: number | null
          id?: string
          kcal?: number | null
          notes?: string | null
          protein_g?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrition_recipes_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_answers: {
        Row: {
          client_id: string
          coach_id: string
          id: string
          question_id: string
          updated_at: string
          value: Json
        }
        Insert: {
          client_id: string
          coach_id: string
          id?: string
          question_id: string
          updated_at?: string
          value?: Json
        }
        Update: {
          client_id?: string
          coach_id?: string
          id?: string
          question_id?: string
          updated_at?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_answers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_answers_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "coach_onboarding_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_ledger: {
        Row: {
          amount_cents: number
          client_id: string
          coach_id: string
          created_at: string
          id: string
          paid_at: string | null
          period_ym: string | null
          prestation_id: string
          source: string
          status: string
          tracked_link_id: string | null
        }
        Insert: {
          amount_cents?: number
          client_id: string
          coach_id: string
          created_at?: string
          id?: string
          paid_at?: string | null
          period_ym?: string | null
          prestation_id: string
          source?: string
          status?: string
          tracked_link_id?: string | null
        }
        Update: {
          amount_cents?: number
          client_id?: string
          coach_id?: string
          created_at?: string
          id?: string
          paid_at?: string | null
          period_ym?: string | null
          prestation_id?: string
          source?: string
          status?: string
          tracked_link_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_ledger_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_ledger_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_ledger_prestation_id_fkey"
            columns: ["prestation_id"]
            isOneToOne: false
            referencedRelation: "prestations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_ledger_tracked_link_id_fkey"
            columns: ["tracked_link_id"]
            isOneToOne: false
            referencedRelation: "coach_tracked_links"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_links_24h: {
        Row: {
          amount_cents: number
          client_id: string
          coach_id: string
          created_at: string
          description: string | null
          expires_at: string
          id: string
          payment_ledger_id: string | null
          prestation_id: string
          status: string
          title: string | null
          token: string
        }
        Insert: {
          amount_cents?: number
          client_id: string
          coach_id: string
          created_at?: string
          description?: string | null
          expires_at: string
          id?: string
          payment_ledger_id?: string | null
          prestation_id: string
          status?: string
          title?: string | null
          token: string
        }
        Update: {
          amount_cents?: number
          client_id?: string
          coach_id?: string
          created_at?: string
          description?: string | null
          expires_at?: string
          id?: string
          payment_ledger_id?: string | null
          prestation_id?: string
          status?: string
          title?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_links_24h_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_24h_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_24h_payment_ledger_id_fkey"
            columns: ["payment_ledger_id"]
            isOneToOne: false
            referencedRelation: "payment_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_24h_prestation_id_fkey"
            columns: ["prestation_id"]
            isOneToOne: false
            referencedRelation: "prestations"
            referencedColumns: ["id"]
          },
        ]
      }
      prestations: {
        Row: {
          coach_id: string
          created_at: string
          deleted_at: string | null
          description: string | null
          drive_folder_id: string | null
          drive_folder_ids: string[]
          highlight_tag: string | null
          id: string
          modules: Json
          name: string
          nutrition_template_id: string | null
          nutrition_template_ids: string[]
          photo_url: string | null
          price_cents: number
          pricing_type: string
          program_template_id: string | null
          program_template_ids: string[]
          show_program_tags: boolean
          showroom_cta_label: string | null
          showroom_description: string | null
          showroom_eyebrow: string | null
          showroom_hidden_program_tags: Json
          showroom_photo_is_cover: boolean
          showroom_popup_tags: Json
          showroom_sort_order: number
          showroom_tags: Json
          showroom_video_role: string | null
          showroom_visible: boolean
          showroom_week_id: string | null
          status: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          coach_id: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          drive_folder_id?: string | null
          drive_folder_ids?: string[]
          highlight_tag?: string | null
          id?: string
          modules?: Json
          name: string
          nutrition_template_id?: string | null
          nutrition_template_ids?: string[]
          photo_url?: string | null
          price_cents?: number
          pricing_type?: string
          program_template_id?: string | null
          program_template_ids?: string[]
          show_program_tags?: boolean
          showroom_cta_label?: string | null
          showroom_description?: string | null
          showroom_eyebrow?: string | null
          showroom_hidden_program_tags?: Json
          showroom_photo_is_cover?: boolean
          showroom_popup_tags?: Json
          showroom_sort_order?: number
          showroom_tags?: Json
          showroom_video_role?: string | null
          showroom_visible?: boolean
          showroom_week_id?: string | null
          status?: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          coach_id?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          drive_folder_id?: string | null
          drive_folder_ids?: string[]
          highlight_tag?: string | null
          id?: string
          modules?: Json
          name?: string
          nutrition_template_id?: string | null
          nutrition_template_ids?: string[]
          photo_url?: string | null
          price_cents?: number
          pricing_type?: string
          program_template_id?: string | null
          program_template_ids?: string[]
          show_program_tags?: boolean
          showroom_cta_label?: string | null
          showroom_description?: string | null
          showroom_eyebrow?: string | null
          showroom_hidden_program_tags?: Json
          showroom_photo_is_cover?: boolean
          showroom_popup_tags?: Json
          showroom_sort_order?: number
          showroom_tags?: Json
          showroom_video_role?: string | null
          showroom_visible?: boolean
          showroom_week_id?: string | null
          status?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prestations_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prestations_drive_folder_id_fkey"
            columns: ["drive_folder_id"]
            isOneToOne: false
            referencedRelation: "drive_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prestations_nutrition_template_id_fkey"
            columns: ["nutrition_template_id"]
            isOneToOne: false
            referencedRelation: "nutrition_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prestations_program_template_id_fkey"
            columns: ["program_template_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          admin_notes: string | null
          avatar_url: string | null
          coach_workspace: boolean
          created_at: string | null
          deleted_at: string | null
          email: string | null
          full_name: string | null
          id: string
          password_set_at: string | null
          phone: string | null
          role: string | null
          suspended_at: string | null
          updated_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          avatar_url?: string | null
          coach_workspace?: boolean
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          password_set_at?: string | null
          phone?: string | null
          role?: string | null
          suspended_at?: string | null
          updated_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          avatar_url?: string | null
          coach_workspace?: boolean
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          password_set_at?: string | null
          phone?: string | null
          role?: string | null
          suspended_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      program_exercises: {
        Row: {
          created_at: string
          exercise_id: string | null
          exercise_order: number
          id: string
          load: string | null
          name: string | null
          notes: string | null
          reps: string | null
          rest_time: string | null
          rpe: number | null
          session_id: string
          sets: number | null
          tempo: string | null
        }
        Insert: {
          created_at?: string
          exercise_id?: string | null
          exercise_order?: number
          id?: string
          load?: string | null
          name?: string | null
          notes?: string | null
          reps?: string | null
          rest_time?: string | null
          rpe?: number | null
          session_id: string
          sets?: number | null
          tempo?: string | null
        }
        Update: {
          created_at?: string
          exercise_id?: string | null
          exercise_order?: number
          id?: string
          load?: string | null
          name?: string | null
          notes?: string | null
          reps?: string | null
          rest_time?: string | null
          rpe?: number | null
          session_id?: string
          sets?: number | null
          tempo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "program_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercise_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_exercises_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      program_weeks: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          program_id: string
          title: string | null
          week_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          program_id: string
          title?: string | null
          week_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          program_id?: string
          title?: string | null
          week_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "program_weeks_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          allow_download: boolean
          allow_duplicate: boolean
          catalog_status: string
          coach_id: string
          created_at: string
          deleted_at: string | null
          description: string | null
          duration: string | null
          goal: string | null
          id: string
          image_url: string | null
          is_calendar: boolean
          is_client_instance: boolean
          is_published: boolean
          is_template: boolean
          is_trainly_catalog: boolean
          level: string | null
          parent_program_id: string | null
          source_kind: string
          start_date: string | null
          status: string
          template_program_id: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          allow_download?: boolean
          allow_duplicate?: boolean
          catalog_status?: string
          coach_id: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          duration?: string | null
          goal?: string | null
          id?: string
          image_url?: string | null
          is_calendar?: boolean
          is_client_instance?: boolean
          is_published?: boolean
          is_template?: boolean
          is_trainly_catalog?: boolean
          level?: string | null
          parent_program_id?: string | null
          source_kind?: string
          start_date?: string | null
          status?: string
          template_program_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          allow_download?: boolean
          allow_duplicate?: boolean
          catalog_status?: string
          coach_id?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          duration?: string | null
          goal?: string | null
          id?: string
          image_url?: string | null
          is_calendar?: boolean
          is_client_instance?: boolean
          is_published?: boolean
          is_template?: boolean
          is_trainly_catalog?: boolean
          level?: string | null
          parent_program_id?: string | null
          source_kind?: string
          start_date?: string | null
          status?: string
          template_program_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programs_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_parent_program_id_fkey"
            columns: ["parent_program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_template_program_id_fkey"
            columns: ["template_program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      schema_migrations_trainly: {
        Row: {
          applied_at: string
          id: string
        }
        Insert: {
          applied_at?: string
          id: string
        }
        Update: {
          applied_at?: string
          id?: string
        }
        Relationships: []
      }
      session_blocks: {
        Row: {
          created_at: string
          expected_result_unit_id: string | null
          id: string
          notes: string | null
          objective: string | null
          position: number
          program_session_id: string
          source_block_library_id: string | null
          sport_id: string | null
          timer_note: string | null
          title: string | null
          type: string | null
        }
        Insert: {
          created_at?: string
          expected_result_unit_id?: string | null
          id?: string
          notes?: string | null
          objective?: string | null
          position?: number
          program_session_id: string
          source_block_library_id?: string | null
          sport_id?: string | null
          timer_note?: string | null
          title?: string | null
          type?: string | null
        }
        Update: {
          created_at?: string
          expected_result_unit_id?: string | null
          id?: string
          notes?: string | null
          objective?: string | null
          position?: number
          program_session_id?: string
          source_block_library_id?: string | null
          sport_id?: string | null
          timer_note?: string | null
          title?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_blocks_expected_result_unit_id_fkey"
            columns: ["expected_result_unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_blocks_program_session_id_fkey"
            columns: ["program_session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_blocks_source_block_library_id_fkey"
            columns: ["source_block_library_id"]
            isOneToOne: false
            referencedRelation: "block_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_blocks_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      session_items: {
        Row: {
          created_at: string
          id: string
          kind: string
          position: number
          prescriptions: Json
          program_exercise_id: string | null
          session_block_id: string | null
          session_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          position?: number
          prescriptions?: Json
          program_exercise_id?: string | null
          session_block_id?: string | null
          session_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          position?: number
          prescriptions?: Json
          program_exercise_id?: string | null
          session_block_id?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_items_program_exercise_id_fkey"
            columns: ["program_exercise_id"]
            isOneToOne: false
            referencedRelation: "program_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_items_session_block_id_fkey"
            columns: ["session_block_id"]
            isOneToOne: false
            referencedRelation: "session_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_library: {
        Row: {
          allow_download: boolean
          allow_duplicate: boolean
          coach_id: string | null
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          notes: string | null
          objective_difficulty: boolean
          objective_note: boolean
          objective_ressenti: boolean
          source_kind: string
          source_session_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          allow_download?: boolean
          allow_duplicate?: boolean
          coach_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          notes?: string | null
          objective_difficulty?: boolean
          objective_note?: boolean
          objective_ressenti?: boolean
          source_kind?: string
          source_session_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          allow_download?: boolean
          allow_duplicate?: boolean
          coach_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          objective_difficulty?: boolean
          objective_note?: boolean
          objective_ressenti?: boolean
          source_kind?: string
          source_session_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_library_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_library_source_session_id_fkey"
            columns: ["source_session_id"]
            isOneToOne: false
            referencedRelation: "session_library"
            referencedColumns: ["id"]
          },
        ]
      }
      session_library_hidden_sports: {
        Row: {
          session_id: string
          sport_id: string
        }
        Insert: {
          session_id: string
          sport_id: string
        }
        Update: {
          session_id?: string
          sport_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_library_hidden_sports_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_library_hidden_sports_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      session_library_hidden_types: {
        Row: {
          exercise_type_id: string
          session_id: string
        }
        Insert: {
          exercise_type_id: string
          session_id: string
        }
        Update: {
          exercise_type_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_library_hidden_types_exercise_type_id_fkey"
            columns: ["exercise_type_id"]
            isOneToOne: false
            referencedRelation: "exercise_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_library_hidden_types_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_library"
            referencedColumns: ["id"]
          },
        ]
      }
      session_library_items: {
        Row: {
          block_id: string | null
          created_at: string
          exercise_id: string | null
          id: string
          item_kind: string
          position: number
          prescriptions: Json
          session_id: string
        }
        Insert: {
          block_id?: string | null
          created_at?: string
          exercise_id?: string | null
          id?: string
          item_kind: string
          position?: number
          prescriptions?: Json
          session_id: string
        }
        Update: {
          block_id?: string | null
          created_at?: string
          exercise_id?: string | null
          id?: string
          item_kind?: string
          position?: number
          prescriptions?: Json
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_library_items_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "block_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_library_items_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercise_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_library_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_library"
            referencedColumns: ["id"]
          },
        ]
      }
      session_runs: {
        Row: {
          actual_date: string | null
          client_id: string
          coach_comments: Json
          coach_id: string
          comment: string | null
          created_at: string
          deleted_at: string | null
          feedback_difficulty: number | null
          feedback_note: string | null
          feedback_ressenti: string | null
          finished_at: string | null
          id: string
          plan_id: string | null
          realized: Json | null
          scheduled_date: string | null
          snapshot: Json | null
          source: string
          source_session_id: string | null
          started_at: string | null
          style: string
          title: string | null
          updated_at: string
        }
        Insert: {
          actual_date?: string | null
          client_id: string
          coach_comments?: Json
          coach_id: string
          comment?: string | null
          created_at?: string
          deleted_at?: string | null
          feedback_difficulty?: number | null
          feedback_note?: string | null
          feedback_ressenti?: string | null
          finished_at?: string | null
          id?: string
          plan_id?: string | null
          realized?: Json | null
          scheduled_date?: string | null
          snapshot?: Json | null
          source?: string
          source_session_id?: string | null
          started_at?: string | null
          style?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          actual_date?: string | null
          client_id?: string
          coach_comments?: Json
          coach_id?: string
          comment?: string | null
          created_at?: string
          deleted_at?: string | null
          feedback_difficulty?: number | null
          feedback_note?: string | null
          feedback_ressenti?: string | null
          finished_at?: string | null
          id?: string
          plan_id?: string | null
          realized?: Json | null
          scheduled_date?: string | null
          snapshot?: Json | null
          source?: string
          source_session_id?: string | null
          started_at?: string | null
          style?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_runs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_runs_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_runs_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "client_fitness_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_runs_source_session_id_fkey"
            columns: ["source_session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          composition_version: number
          created_at: string
          description: string | null
          id: string
          notes: string | null
          objective_difficulty: boolean
          objective_note: boolean
          objective_ressenti: boolean
          session_order: number
          source_session_library_id: string | null
          sport: string | null
          title: string | null
          updated_at: string
          week_id: string
        }
        Insert: {
          composition_version?: number
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          objective_difficulty?: boolean
          objective_note?: boolean
          objective_ressenti?: boolean
          session_order?: number
          source_session_library_id?: string | null
          sport?: string | null
          title?: string | null
          updated_at?: string
          week_id: string
        }
        Update: {
          composition_version?: number
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          objective_difficulty?: boolean
          objective_note?: boolean
          objective_ressenti?: boolean
          session_order?: number
          source_session_library_id?: string | null
          sport?: string | null
          title?: string | null
          updated_at?: string
          week_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_source_session_library_id_fkey"
            columns: ["source_session_library_id"]
            isOneToOne: false
            referencedRelation: "session_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "program_weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      sports: {
        Row: {
          coach_id: string | null
          created_at: string
          deleted_at: string | null
          id: string
          label: string
          source_id: string | null
          updated_at: string
        }
        Insert: {
          coach_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          label: string
          source_id?: string | null
          updated_at?: string
        }
        Update: {
          coach_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          label?: string
          source_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sports_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sports_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          attachment_mime: string | null
          attachment_name: string | null
          attachment_path: string | null
          body: string
          created_at: string
          id: string
          sender_id: string
          sender_role: string
          ticket_id: string
        }
        Insert: {
          attachment_mime?: string | null
          attachment_name?: string | null
          attachment_path?: string | null
          body: string
          created_at?: string
          id?: string
          sender_id: string
          sender_role: string
          ticket_id: string
        }
        Update: {
          attachment_mime?: string | null
          attachment_name?: string | null
          attachment_path?: string | null
          body?: string
          created_at?: string
          id?: string
          sender_id?: string
          sender_role?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          admin_last_read_at: string | null
          category: string
          coach_id: string
          coach_last_read_at: string | null
          created_at: string
          id: string
          opened_by: string
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          admin_last_read_at?: string | null
          category?: string
          coach_id: string
          coach_last_read_at?: string | null
          created_at?: string
          id?: string
          opened_by?: string
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          admin_last_read_at?: string | null
          category?: string
          coach_id?: string
          coach_last_read_at?: string | null
          created_at?: string
          id?: string
          opened_by?: string
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trainly_drive_library: {
        Row: {
          allow_download: boolean
          allow_duplicate: boolean
          created_at: string
          created_by: string | null
          description: string | null
          file_path: string | null
          id: string
          mime_type: string | null
          original_name: string | null
          published: boolean
          size_bytes: number | null
          title: string
          updated_at: string
        }
        Insert: {
          allow_download?: boolean
          allow_duplicate?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_path?: string | null
          id?: string
          mime_type?: string | null
          original_name?: string | null
          published?: boolean
          size_bytes?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          allow_download?: boolean
          allow_duplicate?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_path?: string | null
          id?: string
          mime_type?: string | null
          original_name?: string | null
          published?: boolean
          size_bytes?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainly_drive_library_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trainly_formation_items: {
        Row: {
          allow_duplicate: boolean
          created_at: string
          created_by: string | null
          description: string | null
          file_path: string | null
          id: string
          media_type: string
          mime_type: string | null
          original_name: string | null
          published: boolean
          size_bytes: number | null
          title: string
          updated_at: string
        }
        Insert: {
          allow_duplicate?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_path?: string | null
          id?: string
          media_type: string
          mime_type?: string | null
          original_name?: string | null
          published?: boolean
          size_bytes?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          allow_duplicate?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_path?: string | null
          id?: string
          media_type?: string
          mime_type?: string | null
          original_name?: string | null
          published?: boolean
          size_bytes?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainly_formation_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          coach_id: string | null
          created_at: string
          deleted_at: string | null
          dimension: string
          id: string
          key: string
          label: string
          list_options: Json | null
          short_label: string | null
          source_id: string | null
          updated_at: string
          value_mode: string | null
        }
        Insert: {
          coach_id?: string | null
          created_at?: string
          deleted_at?: string | null
          dimension: string
          id?: string
          key: string
          label: string
          list_options?: Json | null
          short_label?: string | null
          source_id?: string | null
          updated_at?: string
          value_mode?: string | null
        }
        Update: {
          coach_id?: string | null
          created_at?: string
          deleted_at?: string | null
          dimension?: string
          id?: string
          key?: string
          label?: string
          list_options?: Json | null
          short_label?: string | null
          source_id?: string | null
          updated_at?: string
          value_mode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "units_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      append_session_item_block: {
        Args: { p_session_block_id: string; p_session_id: string }
        Returns: string
      }
      append_session_item_exercise: {
        Args: { p_program_exercise_id: string; p_session_id: string }
        Returns: string
      }
      can_access_chat_thread: {
        Args: { p_thread_id: string }
        Returns: boolean
      }
      claim_client_by_email_for_coach: {
        Args: { p_coach_id: string }
        Returns: string
      }
      claim_client_rows_by_email: { Args: never; Returns: number }
      clear_chat_thread_history: {
        Args: { p_thread_id: string }
        Returns: number
      }
      client_can_read_program: {
        Args: { p_program_id: string }
        Returns: boolean
      }
      current_client_id: { Args: never; Returns: string }
      current_coach_id: { Args: never; Returns: string }
      current_profile_role: { Args: never; Returns: string }
      duplicate_program_week_contents: {
        Args: { p_new_week_id: string; p_source_week_id: string }
        Returns: Json
      }
      ensure_dm_thread: { Args: { p_client_id: string }; Returns: string }
      ensure_group_thread: { Args: { p_group_id: string }; Returns: string }
      insert_program_exercise: {
        Args: { p_exercise_id: string; p_session_id: string }
        Returns: string
      }
      is_client_group_member: { Args: { p_group_id: string }; Returns: boolean }
      is_my_client_row: { Args: { p_client_id: string }; Returns: boolean }
      is_platform_admin: { Args: never; Returns: boolean }
      my_session_run_en_cours: {
        Args: never
        Returns: {
          actual_date: string | null
          client_id: string
          coach_comments: Json
          coach_id: string
          comment: string | null
          created_at: string
          deleted_at: string | null
          feedback_difficulty: number | null
          feedback_note: string | null
          feedback_ressenti: string | null
          finished_at: string | null
          id: string
          plan_id: string | null
          realized: Json | null
          scheduled_date: string | null
          snapshot: Json | null
          source: string
          source_session_id: string | null
          started_at: string | null
          style: string
          title: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "session_runs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      owns_client_group: { Args: { p_group_id: string }; Returns: boolean }
      owns_client_row: { Args: { p_client_id: string }; Returns: boolean }
      owns_prestation: { Args: { p_prestation_id: string }; Returns: boolean }
      owns_program: { Args: { p_program_id: string }; Returns: boolean }
      owns_session: { Args: { p_session_id: string }; Returns: boolean }
      owns_session_block: { Args: { p_block_id: string }; Returns: boolean }
      owns_session_via_week: { Args: { p_week_id: string }; Returns: boolean }
      redeem_client_invite: { Args: { p_token: string }; Returns: string }
      register_as_client_for_coach: {
        Args: {
          p_coach_id: string
          p_first_name?: string
          p_last_name?: string
        }
        Returns: string
      }
      reorder_week_sessions: {
        Args: { p_orders: Json; p_week_id: string }
        Returns: Json
      }
      replace_program_session_composition: {
        Args: { p_payload: Json; p_session_id: string }
        Returns: Json
      }
      soft_delete_chat_message: {
        Args: { p_message_id: string }
        Returns: undefined
      }
      toggle_pin_chat_message: {
        Args: { p_message_id: string }
        Returns: undefined
      }
      upsert_chat_thread_user_state: {
        Args: {
          p_archived?: boolean
          p_clear_now?: boolean
          p_pinned?: boolean
          p_thread_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
