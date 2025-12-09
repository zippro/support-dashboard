'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from './supabase'
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

        // 1. Initial Session Check
        const initAuth = async () => {
            try {
                const { data: { session }, error } = await supabase.auth.getSession()

                if (error) {
                    console.error('Auth: Error checking session:', error)
                    if (mounted) setIsLoading(false)
                    return
                }

                if (mounted) {
                    handleSession(session)
                }
            } catch (err) {
                console.error('Auth: Unexpected init error:', err)
                if (mounted) setIsLoading(false)
            }
        }

        initAuth()

        // 2. Listen for Auth Changes (Login, SignOut, Token Refresh)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            console.log('Auth: State changed:', _event)
            if (mounted) {
                await handleSession(session)
            }
        })

        return () => {
            mounted = false
            subscription.unsubscribe()
        }
    }, [])

    // Centralized Session Handler
    async function handleSession(currentSession: Session | null) {
        setSession(currentSession)
        setUser(currentSession?.user ?? null)

        if (currentSession?.user) {
            // Fetch profile whenever we have a user
            await fetchProfile(currentSession.user)
        } else {
            // Clear profile if no user
            setProfile(null)
            setIsLoading(false)
        }
    }

    async function fetchProfile(currentUser: User) {
        try {
            const { data, error } = await supabase
                .from('agent_profiles')
                .select('*')
                .eq('id', currentUser.id)
                .single()

            if (data) {
                setProfile(data)
            } else {
                console.warn('Auth: Profile missing, using metadata fallback')
                // Fallback to metadata if profile doesn't exist yet
                const metaName = currentUser.user_metadata?.name ||
                    currentUser.user_metadata?.full_name ||
                    currentUser.email?.split('@')[0] || 'User'

                setProfile({
                    id: currentUser.id,
                    name: metaName,
                    email: currentUser.email || '',
                    avatar_url: currentUser.user_metadata?.avatar_url || null
                })
            }
        } catch (err) {
            console.error('Auth: Failed to fetch profile:', err)
        } finally {
            setIsLoading(false)
        }
    }

    async function signIn(email: string, password: string) {
        setIsLoading(true) // Set loading UI immediately
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })

        if (error) {
            setIsLoading(false) // Only stop loading on error, success handled by onAuthStateChange
            return { error }
        }

        return { error: null }
    }

    async function signUp(email: string, password: string, name: string) {
        setIsLoading(true)
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { name } // Store name in metadata immediately
            }
        })

        if (!error && data.user) {
            // Optimistically create profile
            await supabase.from('agent_profiles').insert({
                id: data.user.id,
                email: data.user.email,
                name: name
            })
        } else {
            setIsLoading(false)
        }

        return { error }
    }

    async function signOut() {
        setIsLoading(true)
        try {
            await supabase.auth.signOut()
            // State updates handled by onAuthStateChange
            router.push('/login')
        } catch (error) {
            console.error('Auth: SignOut error:', error)
            // Force local clear even if API fails
            setSession(null)
            setUser(null)
            setProfile(null)
            setIsLoading(false)
            router.push('/login')
        }
    }

    async function updateProfile(updates: Partial<AgentProfile>) {
        if (!user) return { error: new Error('Not authenticated') }

        // Optimistic update
        setProfile(prev => prev ? { ...prev, ...updates } : null)

        const { error } = await supabase
            .from('agent_profiles')
            .update(updates)
            .eq('id', user.id)

        // Revert if error (optional, but good practice)
        if (error) {
            console.error('Auth: Update failed, reverting', error)
            // In a real app we might fetchProfile(user) here to reset
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
