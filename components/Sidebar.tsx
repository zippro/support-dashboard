'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Home, Inbox, Settings, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const navigation = [
    { name: 'Dashboard', href: '/', icon: Home },
    { name: 'Tickets', href: '/tickets', icon: Inbox },
    { name: 'Settings', href: '/settings', icon: Settings },
]

export function Sidebar() {
    const pathname = usePathname()
    const [openTicketCount, setOpenTicketCount] = useState(0)

    useEffect(() => {
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
                console.log('Open tickets count:', count)
                setOpenTicketCount(count)
            }
        }

        fetchOpenTicketCount()

        // Subscribe to changes to update count in real-time
        const channel = supabase
            .channel('sidebar-ticket-count')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => {
                console.log('Ticket change detected, refreshing count...')
                fetchOpenTicketCount()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

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
            <div className="border-t border-gray-800 p-6 bg-black/50">
                <div className="flex items-center group cursor-pointer">
                    <div className="relative h-10 w-10 rounded-full overflow-hidden ring-2 ring-gray-800 group-hover:ring-indigo-500 transition-all">
                        <Image
                            src="/owl-avatar.png"
                            alt="zip Agent"
                            fill
                            className="object-cover"
                        />
                    </div>
                    <div className="ml-3">
                        <p className="text-sm font-semibold text-white group-hover:text-indigo-400 transition-colors">zip Agent</p>
                        <p className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors">View Profile</p>
                    </div>
                </div>
            </div>
        </div>
    )
}
