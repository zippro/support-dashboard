'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { User, Session } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

interface AgentProfile {
    id: string
    name: string
    email: string
    avatar_url: string | null
}

interface AuthContextType {
    user: User | null
    profile: AgentProfile | null
    session: Session | null
    isLoading: boolean
    isAuthenticated: boolean
    signIn: (email: string, password: string) => Promise<{ error: any }>
    signUp: (email: string, password: string, name: string) => Promise<{ error: any }>
    signOut: () => Promise<void>
    updateProfile: (updates: Partial<AgentProfile>) => Promise<{ error: any }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [profile, setProfile] = useState<AgentProfile | null>(null)
    const [session, setSession] = useState<Session | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const router = useRouter()

    useEffect(() => {
        let mounted = true

        async function getInitialSession() {
            try {
                const { data: { session }, error } = await supabase.auth.getSession()

                if (mounted) {
                    if (error) {
                        console.error('Auth: Error getting session', error)
                    }
                    if (session) {
                        console.log('Auth: Initial session found', session.user.email)
                        setSession(session)
                        setUser(session.user)
                        await fetchProfile(session.user, mounted)
                    } else {
                        console.log('Auth: No initial session')
                        setIsLoading(false)
                    }
                }
            } catch (err) {
                console.error('Auth: Unexpected init error', err)
                if (mounted) setIsLoading(false)
            }
        }

        getInitialSession()

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('Auth: State change event', event)

            if (mounted) {
                setSession(session)
                setUser(session?.user ?? null)
                setIsLoading(true) // Briefly set loading while we fetch profile

                if (session?.user) {
                    // Update profile but don't block
                    fetchProfile(session.user, mounted)
                } else {
                    setProfile(null)
                    setIsLoading(false)
                    if (event === 'SIGNED_OUT') {
                        router.refresh()
                        router.push('/login')
                    }
                }
            }
        })

        return () => {
            mounted = false
            subscription.unsubscribe()
        }
    }, [router])

    async function fetchProfile(currentUser: User, isMounted: boolean) {
        try {
            const { data, error } = await supabase
                .from('agent_profiles')
                .select('*')
                .eq('id', currentUser.id)
                .maybeSingle()

            if (isMounted) {
                if (data) {
                    setProfile(data)
                } else {
                    // Fallback to metadata
                    setProfile({
                        id: currentUser.id,
                        name: currentUser.user_metadata?.name || currentUser.email?.split('@')[0] || 'User',
                        email: currentUser.email || '',
                        avatar_url: currentUser.user_metadata?.avatar_url || null
                    })
                }
                setIsLoading(false)
            }
        } catch (error) {
            console.error('Auth: Profile fetch error', error)
            if (isMounted) setIsLoading(false)
        }
    }

    async function signIn(email: string, password: string) {
        // Return result, let onAuthStateChange handle state
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        return { error }
    }

    async function signUp(email: string, password: string, name: string) {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { name } }
        })

        if (!error && data.user) {
            // Optimistic profile creation
            await supabase.from('agent_profiles').insert({
                id: data.user.id,
                email: data.user.email,
                name: name
            })
        }
        return { error }
    }

    async function signOut() {
        await supabase.auth.signOut()
        // Router push handled by onAuthStateChange
    }

    async function updateProfile(updates: Partial<AgentProfile>) {
        if (!user) return { error: new Error('Not authenticated') }
        const { error } = await supabase
            .from('agent_profiles')
            .update(updates)
            .eq('id', user.id)

        if (!error) {
            setProfile(prev => prev ? { ...prev, ...updates } : null)
        }
        return { error }
    }

    return (
        <AuthContext.Provider value={{
            user,
            profile,
            session,
            isLoading,
            isAuthenticated: !!user,
            signIn,
            signUp,
            signOut,
            updateProfile
        }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
