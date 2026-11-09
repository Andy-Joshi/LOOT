import { createClient } from '@supabase/supabase-js'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

// Load environment variables if available
if (typeof process.loadEnvFile === 'function') {
  try {
    const envPath = join(process.cwd(), '.env')
    if (existsSync(envPath)) {
      process.loadEnvFile(envPath)
    }
  } catch {
    // Environment variables might already be present in container or process
  }
}

const supabaseUrl = process.env.SUPABASE_URL || 'https://bryfubbfsuhihbsvxfep.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_CNNT7DkWfUGPmiHwu8lydA_pIXKR9v3'
export const publicAppUrl = process.env.PUBLIC_APP_URL || 'http://localhost:5173'

export const isSupabaseConfigured = () => Boolean(supabaseUrl && supabaseKey)

// Create reusable Supabase client for backend operations
export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })
  : null

/**
 * Safe health check that verifies connectivity without exposing credentials.
 * @returns {Promise<{ ok: boolean, supabaseConnected: boolean, tableReady: boolean, message: string }>}
 */
export async function getSupabaseHealth() {
  if (!supabase) {
    return {
      ok: false,
      supabaseConnected: false,
      tableReady: false,
      message: 'Supabase credentials are not configured.'
    }
  }

  try {
    const { error } = await supabase.from('parent_requests').select('id').limit(1)

    if (error) {
      if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
        return {
          ok: true,
          supabaseConnected: true,
          tableReady: false,
          message: 'Supabase connected successfully. Database migration for table public.parent_requests is pending in the SQL Editor.'
        }
      }

      return {
        ok: true,
        supabaseConnected: true,
        tableReady: false,
        message: `Supabase reached: ${error.message}`
      }
    }

    return {
      ok: true,
      supabaseConnected: true,
      tableReady: true,
      message: 'Supabase connected and parent_requests table is ready.'
    }
  } catch (err) {
    return {
      ok: false,
      supabaseConnected: false,
      tableReady: false,
      message: `Failed to connect to Supabase: ${err.message}`
    }
  }
}
