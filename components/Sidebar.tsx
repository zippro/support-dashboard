'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Home, Inbox, Settings, BarChart2, LogIn, LogOut, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

const navigation = [
    { name: 'Dashboard', href: '/', icon: Home },
    { name: 'Tickets', href: '/tickets', icon: Inbox },
    { name: 'Analytics', href: '/analytics', icon: BarChart2 },
    { name: 'Settings', href: '/settings', icon: Settings },
]

export function Sidebar() {
    const pathname = usePathname()
    const [openTicketCount, setOpenTicketCount] = useState(0)
    const { isAuthenticated, profile, signOut, isLoading } = useAuth()

    useEffect(() => {
        // Skip fetching if on login/register pages
        if (pathname === '/login' || pathname === '/register') return

        async function fetchOpenTicketCount() {
            const { count, error } = await supabase
                .from('tickets')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'open')

            if (error) {
                console.error('Error fetching open ticket count:', error)
                return
            }

            if (count !== null) {
                setOpenTicketCount(count)
            }
        }

        fetchOpenTicketCount()

        const channel = supabase
            .channel('sidebar-ticket-count')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => {
                fetchOpenTicketCount()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [pathname])

    // Don't show sidebar on login/register pages
    if (pathname === '/login' || pathname === '/register') {
        return null
    }

    return (
        <div className="flex h-full w-72 flex-col bg-black border-r border-gray-800 text-white shadow-xl">
            <div className="flex h-20 items-center px-6 border-b border-gray-800 bg-black/50 backdrop-blur-sm">
                <div className="relative h-14 w-full">
                    <Image
                        src="/narcade-logo-v2.png"
                        alt="Narcade Support"
                        fill
                        className="object-contain object-left"
                        priority
                    />
                </div>
            </div>
            <nav className="flex-1 space-y-2 px-4 py-6">
                {navigation.map((item) => {
                    const isActive = pathname === item.href
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                'group flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200',
                                isActive
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20'
                                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                            )}
                        >
                            <div className="flex items-center">
                                <item.icon
                                    className={cn(
                                        'mr-3 h-5 w-5 flex-shrink-0 transition-colors',
                                        isActive ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'
                                    )}
                                />
                                {item.name}
                            </div>
                            {item.name === 'Tickets' && openTicketCount > 0 && (
                                <span className="flex items-center justify-center rounded-full bg-red-500 px-2.5 py-0.5 text-xs font-bold text-white shadow-sm">
                                    {openTicketCount}
                                </span>
                            )}
                        </Link>
                    )
                })}
            </nav>
            <div className="border-t border-gray-800 p-4 bg-black/50">
                {isLoading ? (
                    <div className="flex items-center justify-center py-3">
                        <div className="w-5 h-5 border-2 border-gray-600 border-t-indigo-500 rounded-full animate-spin" />
                    </div>
                ) : isAuthenticated && profile ? (
                    <div className="space-y-3">
                        <Link href="/profile" className="flex items-center group cursor-pointer hover:bg-gray-800/50 rounded-xl p-2 -m-2 transition-colors">
                            <div className="relative h-10 w-10 rounded-full overflow-hidden ring-2 ring-gray-800 group-hover:ring-indigo-500 transition-all bg-indigo-600 flex items-center justify-center">
                                {profile.avatar_url ? (
                                    <Image src={profile.avatar_url} alt={profile.name} fill className="object-cover" />
                                ) : (
                                    <span className="text-white font-semibold text-sm">{profile.name.charAt(0).toUpperCase()}</span>
                                )}
                            </div>
                            <div className="ml-3 flex-1 min-w-0">
                                <p className="text-sm font-semibold text-white group-hover:text-indigo-400 transition-colors truncate">{profile.name}</p>
                                <p className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors truncate">{profile.email}</p>
                            </div>
                        </Link>
                        <button
                            onClick={() => signOut()}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                            Sign Out
                        </button>
                    </div>
                ) : (
                    <Link
                        href="/login"
                        className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors"
                    >
                        <LogIn className="w-4 h-4" />
                        Sign In
                    </Link>
                )}
            </div>
        </div>
    )
}
