'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase, setStoredAgentEmail, getStoredAgentEmail } from './supabase'
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
    agentEmail: string  // Always available, even if profile is loading
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
    const [agentEmail, setAgentEmail] = useState<string>('')

    // Initialize agent email from localStorage
    useEffect(() => {
        const storedEmail = getStoredAgentEmail()
        if (storedEmail) {
            setAgentEmail(storedEmail)
        }
    }, [])

    useEffect(() => {
        let mounted = true
        let authTimeout: NodeJS.Timeout

        const initAuth = async () => {
            console.log('Auth: Initializing...')

            // Set a timeout to prevent infinite loading - 5s for reliable cross-tab session
            authTimeout = setTimeout(() => {
                if (mounted && isLoading) {
                    console.warn('Auth: Timeout - proceeding without session')
                    setIsLoading(false)
                }
            }, 5000) // 5 seconds for cross-tab reliability

            try {
                // Try to get session, retry once if it fails
                let sessionData = await supabase.auth.getSession()

                // If no session on first try, wait a moment and retry (helps with cross-tab sync)
                if (!sessionData.data?.session && !sessionData.error) {
                    await new Promise(resolve => setTimeout(resolve, 500))
                    sessionData = await supabase.auth.getSession()
                }

                const { data, error } = sessionData
                console.log('Auth: getSession result:', { hasSession: !!data?.session, error: error?.message })

                if (!mounted) return

                if (error) {
                    console.error('Auth: Session error:', error)
                    setIsLoading(false)
                    return
                }

                const currentSession = data?.session
                setSession(currentSession)
                setUser(currentSession?.user ?? null)

                if (currentSession?.user) {
                    // Store email immediately from session
                    if (currentSession.user.email) {
                        setAgentEmail(currentSession.user.email)
                        setStoredAgentEmail(currentSession.user.email)
                    }

                    // Set an optimistic profile from user metadata immediately
                    // This prevents the "User" fallback while the real profile loads
                    const metaName = currentSession.user.user_metadata?.name ||
                        currentSession.user.user_metadata?.full_name ||
                        currentSession.user.email?.split('@')[0] || 'User'
                    setProfile(prev => prev || {
                        id: currentSession.user.id,
                        name: metaName,
                        email: currentSession.user.email || '',
                        avatar_url: currentSession.user.user_metadata?.avatar_url || null
                    })

                    // Fetch actual profile (will update if different)
                    await fetchProfileSafe(currentSession.user.id)
                }
            } catch (err) {
                console.error('Auth: Init error:', err)
            } finally {
                if (mounted) {
                    clearTimeout(authTimeout)
                    setIsLoading(false)
                    console.log('Auth: Initialization complete')
                }
            }
        }

        initAuth()

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('Auth: State change:', event, { hasSession: !!session })

            if (!mounted) return

            setSession(session)
            setUser(session?.user ?? null)

            if (session?.user) {
                // Store email immediately
                if (session.user.email) {
                    setAgentEmail(session.user.email)
                    setStoredAgentEmail(session.user.email)
                }

                // Set optimistic profile immediately from user metadata
                const metaName = session.user.user_metadata?.name ||
                    session.user.user_metadata?.full_name ||
                    session.user.email?.split('@')[0] || 'User'
                setProfile(prev => prev || {
                    id: session.user.id,
                    name: metaName,
                    email: session.user.email || '',
                    avatar_url: session.user.user_metadata?.avatar_url || null
                })

                await fetchProfileSafe(session.user.id)
            } else {
                setProfile(null)
                setAgentEmail(getStoredAgentEmail()) // Fall back to stored email
            }
        })

        return () => {
            mounted = false
            clearTimeout(authTimeout)
            subscription.unsubscribe()
        }
    }, [])

    async function fetchProfileSafe(userId: string) {
        try {
            const { data, error } = await supabase
                .from('agent_profiles')
                .select('*')
                .eq('id', userId)
                .single()

            if (error) {
                console.error('Auth: Profile fetch error:', error)
                return
            }

            if (data) {
                setProfile(data)
                // Update stored email with profile email
                if (data.email) {
                    setAgentEmail(data.email)
                    setStoredAgentEmail(data.email)
                }
            } else {
                console.warn('Auth: No profile found for user', userId)
                // Attempt to create a default profile if none exists
                const user = await supabase.auth.getUser()
                if (user.data.user?.email) {
                    const splitName = user.data.user.email.split('@')[0]
                    const { data: newProfile, error: createError } = await supabase
                        .from('agent_profiles')
                        .insert({
                            id: userId,
                            email: user.data.user.email,
                            name: splitName.charAt(0).toUpperCase() + splitName.slice(1),
                            avatar_url: null
                        })
                        .select()
                        .single()

                    if (!createError && newProfile) {
                        console.log('Auth: Created default profile')
                        setProfile(newProfile)
                    }
                }
            }
        } catch (err) {
            console.error('Auth: Profile fetch exception:', err)
        }
    }

    async function signIn(email: string, password: string) {
        setIsLoading(true)
        try {
            // Increased timeout for slower networks (30 seconds)
            const timeoutPromise = new Promise<{ data: null, error: Error }>((_, reject) => {
                setTimeout(() => reject(new Error('Login timed out. Please check your connection and try again.')), 30000)
            })

            const authPromise = supabase.auth.signInWithPassword({ email, password })

            const { data, error } = await Promise.race([authPromise, timeoutPromise]) as any

            if (!error && data?.user && data?.session) {
                // Manually update state to avoid race conditions
                setSession(data.session)
                setUser(data.user)

                // Store email on successful login
                setAgentEmail(email)
                setStoredAgentEmail(email)
            }

            return { error }
        } catch (err: any) {
            return { error: err }
        } finally {
            setIsLoading(false)
        }
    }

    async function signUp(email: string, password: string, name: string) {
        setIsLoading(true)
        try {
            const { data, error } = await supabase.auth.signUp({ email, password })

            if (!error && data.user) {
                // Create profile
                const { error: profileError } = await supabase
                    .from('agent_profiles')
                    .insert({ id: data.user.id, name, email })

                if (profileError) {
                    return { error: profileError }
                }

                // Store email
                setAgentEmail(email)
                setStoredAgentEmail(email)
            }

            return { error }
        } finally {
            setIsLoading(false)
        }
    }

    async function signOut() {
        try {
            await supabase.auth.signOut()
            setUser(null)
            setProfile(null)
            setSession(null)
            // Keep agentEmail in localStorage for reference
            window.location.href = '/login'
        } catch (error) {
            console.error('Auth: Sign out error:', error)
            window.location.href = '/login'
        }
    }

    async function updateProfile(updates: Partial<AgentProfile>) {
        if (!user) return { error: new Error('Not authenticated') }

        const { error } = await supabase
            .from('agent_profiles')
            .update(updates)
            .eq('id', user.id)

        if (!error) {
            setProfile(prev => prev ? { ...prev, ...updates } : null)
            if (updates.email) {
                setAgentEmail(updates.email)
                setStoredAgentEmail(updates.email)
            }
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
            agentEmail,
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
