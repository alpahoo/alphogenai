import { createClient } from '@supabase/supabase-js'

export type Database = {
  public: {
    Tables: {
      jobs: {
        Row: {
          id: string
          user_id: string
          prompt: string
          status: 'queued' | 'running' | 'done' | 'error'
          progress: number
          result_r2_key: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          prompt: string
          status?: 'queued' | 'running' | 'done' | 'error'
          progress?: number
          result_r2_key?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          prompt?: string
          status?: 'queued' | 'running' | 'done' | 'error'
          progress?: number
          result_r2_key?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
