import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Validate environment variables
if (!supabaseUrl || supabaseUrl === 'https://placeholder.supabase.co') {
    console.error('NEXT_PUBLIC_SUPABASE_URL is not configured properly!')
}
if (!supabaseAnonKey || supabaseAnonKey === 'placeholder') {
    console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured properly!')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'narcade-support-auth',
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
    db: {
        schema: 'public',
    },
    global: {
        headers: {
            'x-client-info': 'narcade-support-dashboard',
        },
    },
})

// Helper to get stored agent email from localStorage
export function getStoredAgentEmail(): string {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem('narcade-agent-email') || ''
}

// Helper to store agent email in localStorage
export function setStoredAgentEmail(email: string): void {
    if (typeof window === 'undefined') return
    localStorage.setItem('narcade-agent-email', email)
}
