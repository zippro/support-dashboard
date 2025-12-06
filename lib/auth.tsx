'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from './supabase'
import { User, Session } from '@supabase/supabase-js'

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

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
            setUser(session?.user ?? null)
            if (session?.user) {
                fetchProfile(session.user.id)
            } else {
                setIsLoading(false)
            }
        })

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            setSession(session)
            setUser(session?.user ?? null)
            if (session?.user) {
                await fetchProfile(session.user.id)
            } else {
                setProfile(null)
            }
            setIsLoading(false)
        })

        return () => subscription.unsubscribe()
    }, [])

    async function fetchProfile(userId: string) {
        try {
            const { data, error } = await supabase
                .from('agent_profiles')
                .select('*')
                .eq('id', userId)
                .single()

            if (!error && data) {
                setProfile(data)
            }
        } catch (err) {
            console.error('Error fetching profile:', err)
        } finally {
            setIsLoading(false)
        }
    }

    async function signIn(email: string, password: string) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return { error }
    }

    async function signUp(email: string, password: string, name: string) {
        const { data, error } = await supabase.auth.signUp({ email, password })

        if (!error && data.user) {
            // Create profile
            const { error: profileError } = await supabase
                .from('agent_profiles')
                .insert({ id: data.user.id, name, email })

            if (profileError) {
                return { error: profileError }
            }
        }

        return { error }
    }

    async function signOut() {
        await supabase.auth.signOut()
        setUser(null)
        setProfile(null)
        setSession(null)
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
