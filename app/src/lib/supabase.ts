import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          created_at?: string
          updated_at?: string
        }
      }
      jobs: {
        Row: {
          id: string
          user_id: string
          prompt: string
          status: 'queued' | 'processing' | 'completed' | 'failed'
          result_url: string | null
          error_message: string | null
          runpod_job_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          prompt: string
          status?: 'queued' | 'processing' | 'completed' | 'failed'
          result_url?: string | null
          error_message?: string | null
          runpod_job_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          prompt?: string
          status?: 'queued' | 'processing' | 'completed' | 'failed'
          result_url?: string | null
          error_message?: string | null
          runpod_job_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
