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
        }
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
          created_at: string | null
        }
      }
      program_weeks: {
        Row: {
          id: string
          program_id: string
          title: string | null
          week_order: number
        }
      }
      sessions: {
        Row: {
          id: string
          week_id: string
          title: string | null
          description: string | null
          session_order: number
        }
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
          tempo: string | null
          load: string | null
          notes: string | null
        }
      }
      exercise_library: {
        Row: {
          id: string
          name: string
          muscle_group: string | null
          difficulty: string | null
        }
      }
      login_logs: {
        Row: {
          id: string
          user_id: string
          email: string | null
          created_at: string | null
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
