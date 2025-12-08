import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// This client is specifically configured for PUBLIC data fetching
// It does NOT persist session, does NOT handle auth, and does NOT use realtime
// This ensures that data loading is never blocked by auth state or socket issues
export const publicSupabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
    },
    db: {
        schema: 'public',
    },
    global: {
        headers: {
            'x-client-info': 'narcade-public-client',
        },
        fetch: (url, options) => {
            return fetch(url, {
                ...options,
                // Add a reasonable timeout to native fetch
                signal: AbortSignal.timeout(15000),
                cache: 'no-store'
            })
        }
    },
})
