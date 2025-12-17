// Force rebuild: 2024-12-08T23:55:00
'use client'

import { useEffect, useState, useRef, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { publicSupabase } from '@/lib/supabase-public'
import { useAuth } from '@/lib/auth'
import Link from 'next/link'
import {
    ChevronDown,
    Trash2,
    CheckSquare,
    Square,
    Calendar,
    Clock,
    Filter,
    MoreHorizontal,
    RefreshCw,
    Lock
} from 'lucide-react'

// Constants
const ITEMS_PER_PAGE = 50

const DATE_RANGES = [
    { label: 'All Time', value: 'all' },
    { label: 'Today', value: 'today' },
    { label: 'Yesterday', value: 'yesterday' },
    { label: 'Last 3 Days', value: '3days' },
    { label: 'Last 7 Days', value: '7days' },
    { label: 'Last 30 Days', value: '30days' },
    { label: 'Last 90 Days', value: '90days' },
    { label: 'Last 180 Days', value: '180days' },
    { label: 'Custom', value: 'custom' },
]

function TicketListContent() {
    // Data State
    const [tickets, setTickets] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [hasMore, setHasMore] = useState(true)
    const [page, setPage] = useState(0)
    const [totalCount, setTotalCount] = useState(0)
    const { isAuthenticated } = useAuth()
    const [showLoginModal, setShowLoginModal] = useState(false)

    // Filter State
    const [statusFilter, setStatusFilter] = useState('all')
    const [gameFilter, setGameFilter] = useState<string[]>([])
    const [gamesLoaded, setGamesLoaded] = useState(false)
    const [availableGames, setAvailableGames] = useState<{ id: string, name: string }[]>([])
    const [projectsMap, setProjectsMap] = useState<Record<string, string>>({})
    const [dateFilter, setDateFilter] = useState('all')
    const [customStartDate, setCustomStartDate] = useState('')
    const [customEndDate, setCustomEndDate] = useState('')
    const [showGameDropdown, setShowGameDropdown] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [importanceFilter, setImportanceFilter] = useState<string | null>(null)
    const searchParams = useSearchParams()

    // Selection State
    const [selectedTickets, setSelectedTickets] = useState<Set<string>>(new Set())
    const [bulkAction, setBulkAction] = useState('')
    const [showDeleteModal, setShowDeleteModal] = useState(false)

    // Refs
    const observerTarget = useRef<HTMLTableRowElement>(null)

    // Debounce Search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery)
        }, 500)
        return () => clearTimeout(timer)
    }, [searchQuery])

    // Read URL query parameters on mount
    useEffect(() => {
        const urlStatus = searchParams.get('status')
        const urlImportance = searchParams.get('importance')

        if (urlStatus) {
            setStatusFilter(urlStatus)
        }
        if (urlImportance === 'important') {
            setImportanceFilter('important')
        }
    }, [searchParams])

    // Fetch projects and unique games
    useEffect(() => {
        console.log('Tickets Page: Mounted, starting fetchData')
        async function fetchData() {
            console.log('Tickets Page: fetchData executing...')
            // 1. Fetch Projects Map
            const { data: projects } = await publicSupabase.from('projects').select('project_id, game_name')
            const map: Record<string, string> = {}
            if (projects) {
                projects.forEach(p => {
                    map[p.project_id] = p.game_name
                })
            }
            setProjectsMap(map)

            // 2. Fetch Unique Project IDs from Tickets
            const { data } = await publicSupabase
                .from('tickets')
                .select('project_id')
            // .not('project_id', 'is', null) // We want to include nulls to detect "Unknown"

            if (data) {
                const uniqueProjectIds = Array.from(new Set(data.map(t => t.project_id)))

                const gamesList = uniqueProjectIds.map(pid => {
                    if (!pid) return { id: 'Unknown', name: 'Unknown' }
                    return {
                        id: pid,
                        name: map[pid] || pid
                    }
                })

                const uniqueGamesMap = new Map()
                gamesList.forEach(g => uniqueGamesMap.set(g.id, g))
                const uniqueGames = Array.from(uniqueGamesMap.values())

                // Sort: Unknown first, then alphabetical
                uniqueGames.sort((a, b) => {
                    if (a.id === 'Unknown') return -1
                    if (b.id === 'Unknown') return 1
                    return a.name.localeCompare(b.name)
                })

                setAvailableGames(uniqueGames)
                setGameFilter(uniqueGames.map(g => g.id)) // Default Select All
            }
            setGamesLoaded(true)
        }
        fetchData()
    }, [])

    // Main Fetch Function
    const fetchTickets = useCallback(async (pageNum: number, isNewFilter = false) => {
        // Safety: Ensure we don't fetch if already loading same page
        // But allow if it's a new filter

        let isMounted = true
        const timeoutId = setTimeout(() => {
            if (isMounted) {
                console.warn('Fetch timeout - forcing stop')
                setLoading(false)
                setLoadingMore(false)
            }
        }, 15000)

        try {
            if (isNewFilter) {
                setLoading(true)
                setTickets([])
            } else {
                setLoadingMore(true)
            }

            let query = publicSupabase
                .from('tickets')
                .select('*, users(email)', { count: 'exact' })
                .order('created_at', { ascending: false })

            console.log('fetchTickets running:', {
                pageNum,
                isNewFilter,
                dateFilter,
                statusFilter,
                gameFilter: gameFilter.length,
                availableGames: availableGames.length,
                debouncedSearch
            })

            // Apply Search
            if (debouncedSearch) {
                const isNumber = !isNaN(Number(debouncedSearch))
                const conditions = [`subject.ilike.%${debouncedSearch}%`]

                // If number, search ticket_id
                if (isNumber) {
                    conditions.push(`ticket_id.eq.${debouncedSearch}`)
                }

                // Search by email (requires fetching user IDs first or using !inner join filter)
                // Since we used !inner join above, we can filter by users.email directly if Supabase supports it in 'or'
                // But 'or' across tables is tricky.
                // Alternative: Fetch matching user IDs first.
                const { data: users } = await publicSupabase.from('users').select('id').ilike('email', `%${debouncedSearch}%`)
                if (users && users.length > 0) {
                    const userIds = users.map(u => u.id).join(',')
                    conditions.push(`user_id.in.(${userIds})`)
                }

                query = query.or(conditions.join(','))
            }

            // Apply Status Filter
            if (statusFilter !== 'all') {
                query = query.eq('status', statusFilter)
            }

            // Apply Importance Filter
            if (importanceFilter === 'important') {
                query = query.eq('importance', 'important')
            }

            // Apply Game Filter - only if games have been loaded and filter has been set
            if (availableGames.length > 0 && gameFilter.length > 0) {
                const includeUnknown = gameFilter.includes('Unknown')
                const realProjectIds = gameFilter.filter(g => g !== 'Unknown')

                if (includeUnknown && realProjectIds.length > 0) {
                    // If 'Unknown' and other games are selected
                    const idsString = realProjectIds.map(g => `"${g}"`).join(',')
                    query = query.or(`project_id.in.(${idsString}),project_id.is.null,project_id.eq.""`)
                } else if (includeUnknown) {
                    // If only 'Unknown' is selected
                    query = query.or('project_id.is.null,project_id.eq.""')
                } else if (realProjectIds.length > 0) {
                    // If only specific games (no 'Unknown') are selected
                    query = query.in('project_id', realProjectIds)
                }
            }
            // If gameFilter is empty but we have available games, show nothing (user deselected all)
            // If availableGames is empty, don't filter by game at all (show all tickets)

            // Apply Date Filter
            const now = new Date()
            let startDate = null

            switch (dateFilter) {
                case 'today':
                    startDate = new Date(now.setHours(0, 0, 0, 0))
                    break
                case 'yesterday':
                    startDate = new Date(now.setDate(now.getDate() - 1))
                    startDate.setHours(0, 0, 0, 0)
                    // For yesterday we also need an end date (today 00:00)
                    break
                case '3days':
                    startDate = new Date(now.setDate(now.getDate() - 3))
                    break
                case '7days':
                    startDate = new Date(now.setDate(now.getDate() - 7))
                    break
                case '30days':
                    startDate = new Date(now.setDate(now.getDate() - 30))
                    break
                case '90days':
                    startDate = new Date(now.setDate(now.getDate() - 90))
                    break
                case '180days':
                    startDate = new Date(now.setDate(now.getDate() - 180))
                    break
                case 'custom':
                    if (customStartDate) startDate = new Date(customStartDate)
                    break
            }

            if (startDate) {
                query = query.gte('created_at', startDate.toISOString())
            }

            if (dateFilter === 'custom' && customEndDate) {
                const endDate = new Date(customEndDate)
                endDate.setHours(23, 59, 59, 999)
                query = query.lte('created_at', endDate.toISOString())
            } else if (dateFilter === 'yesterday') {
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                query = query.lt('created_at', today.toISOString())
            }

            // Pagination
            const from = pageNum * ITEMS_PER_PAGE
            const to = from + ITEMS_PER_PAGE - 1
            query = query.range(from, to)

            const { data, error, count } = await query

            if (error) throw error

            if (isMounted && data) {
                setTickets(prev => {
                    const newTickets = isNewFilter ? data : [...prev, ...data]
                    // Deduplicate by ID
                    const uniqueTickets = Array.from(new Map(newTickets.map(item => [item.id, item])).values())
                    return uniqueTickets
                })
                setTotalCount(count || 0)
                setHasMore(data.length === ITEMS_PER_PAGE)
            }
        } catch (error) {
            console.error('Error fetching tickets:', error)
            if (error && typeof error === 'object') {
                console.error('Error details:', JSON.stringify(error, null, 2))
            }
        } finally {
            if (isMounted) {
                clearTimeout(timeoutId)
                setLoading(false)
                setLoadingMore(false)
            }
            isMounted = false
        }
    }, [statusFilter, gameFilter, dateFilter, customStartDate, customEndDate, availableGames, debouncedSearch, importanceFilter])

    // Initial Fetch & Filter Changes - only run after games are loaded
    useEffect(() => {
        if (!gamesLoaded) return // Wait for games to load first
        setPage(0)
        fetchTickets(0, true)
    }, [fetchTickets, gamesLoaded])

    // Infinite Scroll Observer
    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
                    setPage(prev => {
                        const nextPage = prev + 1
                        fetchTickets(nextPage, false)
                        return nextPage
                    })
                }
            },
            { threshold: 1.0 }
        )

        if (observerTarget.current) {
            observer.observe(observerTarget.current)
        }

        return () => observer.disconnect()
    }, [hasMore, loading, loadingMore, fetchTickets])

    // Handlers
    const toggleTicketStatus = async (id: string, currentStatus: string) => {
        const statusOrder = ['open', 'closed', 'duplicated', 'pending']
        const currentIdx = statusOrder.indexOf(currentStatus)
        const nextStatus = statusOrder[(currentIdx + 1) % statusOrder.length]

        console.log(`Toggling status for ${id}: ${currentStatus} -> ${nextStatus}`)

        const { error } = await supabase
            .from('tickets')
            .update({ status: nextStatus })
            .eq('id', id)

        if (error) {
            console.error('Error updating status:', error)
            alert(`Failed to update status: ${error.message}`)
        } else {
            console.log('Status updated successfully')
            setTickets(prev => prev.map(t => t.id === id ? { ...t, status: nextStatus } : t))
        }
    }

    const handleSelectAll = () => {
        if (selectedTickets.size === tickets.length) {
            setSelectedTickets(new Set())
        } else {
            setSelectedTickets(new Set(tickets.map(t => t.id)))
        }
    }

    const handleSelectTicket = (id: string) => {
        const newSelected = new Set(selectedTickets)
        if (newSelected.has(id)) {
            newSelected.delete(id)
        } else {
            newSelected.add(id)
        }
        setSelectedTickets(newSelected)
    }

    const executeBulkAction = async () => {
        if (!bulkAction || selectedTickets.size === 0) return

        const ids = Array.from(selectedTickets)
        let error = null

        if (bulkAction === 'delete') {
            setShowDeleteModal(true)
            return
        }

        const { error: err } = await supabase
            .from('tickets')
            .update({ status: bulkAction })
            .in('id', ids)
        error = err

        if (!error) {
            setSelectedTickets(new Set())
            setBulkAction('')
            setPage(0)
            fetchTickets(0, true) // Refresh list
        } else {
            console.error('Bulk action error:', error)
        }
    }

    const confirmDelete = async () => {
        const ids = Array.from(selectedTickets)
        const { error } = await supabase.from('tickets').delete().in('id', ids)

        if (!error) {
            setSelectedTickets(new Set())
            setBulkAction('')
            setShowDeleteModal(false)
            setPage(0)
            fetchTickets(0, true)
        } else {
            console.error('Delete error:', error)
            alert('Failed to delete tickets') // Fallback alert
        }
    }

    const toggleGameFilter = (gameId: string) => {
        setGameFilter(prev => {
            if (prev.includes(gameId)) {
                return prev.filter(g => g !== gameId)
            } else {
                return [...prev, gameId]
            }
        })
    }

    const toggleAllGames = () => {
        if (gameFilter.length === availableGames.length) {
            setGameFilter([])
        } else {
            setGameFilter(availableGames.map(g => g.id))
        }
    }

    // Helper Functions

    const getGameName = (projectId: string | null) => {
        if (!projectId) return 'Unknown'
        return projectsMap[projectId] || projectId
    }

    const getGameColor = (projectId: string | null) => {
        if (!projectId) return 0
        const str = projectsMap[projectId] || projectId
        let hash = 0
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash)
        }
        return Math.abs(hash % 360)
    }

    return (
        <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-950">
            {/* Header & Actions */}
            <div className="flex flex-col gap-4 p-4 md:p-6 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                <div className="columns-1 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Tickets</h1>
                        <p className="text-gray-500 dark:text-gray-400">
                            {totalCount} tickets found
                        </p>
                    </div>
                    <Link
                        href="/tickets/new"
                        className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors font-medium"
                    >
                        New Ticket
                    </Link>
                </div>

                {/* Filters Bar */}
                <div className="flex flex-wrap gap-4 items-center">
                    {/* Search Input */}
                    <div className="relative flex-1 min-w-[200px]">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search subject, ID, or email..."
                            className="w-full rounded-md border-gray-300 pl-10 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-800 dark:border-gray-700"
                        />
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filters:</span>
                    </div>

                    {/* Game Filter (Multi-select) */}
                    <div className="relative">
                        <button
                            onClick={() => setShowGameDropdown(!showGameDropdown)}
                            className="flex items-center justify-between w-56 px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                            <span className="truncate">
                                {gameFilter.length === availableGames.length
                                    ? 'All Games'
                                    : gameFilter.length === 0
                                        ? 'Select Games'
                                        : `${gameFilter.length} Selected`}
                            </span>
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                        </button>

                        {showGameDropdown && (
                            <div className="absolute top-full left-0 z-50 w-64 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-80 overflow-auto">
                                <div className="p-2 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
                                    <label className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1 rounded">
                                        <input
                                            type="checkbox"
                                            checked={gameFilter.length === availableGames.length}
                                            onChange={toggleAllGames}
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className="text-sm font-medium">Select All</span>
                                    </label>
                                </div>
                                <div className="p-2 space-y-1">
                                    {availableGames.map(game => (
                                        <label key={game.id} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1 rounded">
                                            <input
                                                type="checkbox"
                                                checked={gameFilter.includes(game.id)}
                                                onChange={() => toggleGameFilter(game.id)}
                                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <span className="text-sm truncate" title={game.name}>{game.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Status Filter */}
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-800 dark:border-gray-700"
                    >
                        <option value="all">All Statuses</option>
                        <option value="open">Open</option>
                        <option value="closed">Closed</option>
                        <option value="duplicated">Duplicated</option>
                        <option value="pending">Pending</option>
                    </select>

                    {/* Date Filter */}
                    <select
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-800 dark:border-gray-700"
                    >
                        {DATE_RANGES.map(range => (
                            <option key={range.value} value={range.value}>{range.label}</option>
                        ))}
                    </select>

                    {dateFilter === 'custom' && (
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={customStartDate}
                                onChange={(e) => setCustomStartDate(e.target.value)}
                                className="rounded-md border-gray-300 text-sm shadow-sm dark:bg-gray-800 dark:border-gray-700"
                            />
                            <span className="text-gray-500">-</span>
                            <input
                                type="date"
                                value={customEndDate}
                                onChange={(e) => setCustomEndDate(e.target.value)}
                                className="rounded-md border-gray-300 text-sm shadow-sm dark:bg-gray-800 dark:border-gray-700"
                            />
                        </div>
                    )}

                    {/* Bulk Actions */}
                    {isAuthenticated && selectedTickets.size > 0 && (
                        <div className="ml-auto flex items-center gap-2 animate-in fade-in slide-in-from-right-5">
                            <span className="text-sm text-gray-500">{selectedTickets.size} selected</span>
                            <select
                                value={bulkAction}
                                onChange={(e) => setBulkAction(e.target.value)}
                                className="rounded-md border-indigo-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                            >
                                <option value="">Bulk Actions...</option>
                                <option value="open">Mark as Open</option>
                                <option value="closed">Mark as Closed</option>
                                <option value="duplicated">Mark as Duplicated</option>
                                <option value="pending">Mark as Pending</option>
                                <option value="delete">Delete Tickets</option>
                            </select>
                            <button
                                onClick={executeBulkAction}
                                disabled={!bulkAction}
                                className="bg-indigo-600 text-white p-2 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <CheckSquare className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Table Container - Desktop */}
            <div className="hidden md:flex flex-col flex-1 bg-white dark:bg-gray-900 shadow-sm border-t border-gray-200 dark:border-gray-800 overflow-hidden">
                <div className="overflow-x-auto flex-1 h-full">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                        <thead className="bg-gray-50 dark:bg-gray-950 sticky top-0 z-10">
                            <tr>
                                <th className="px-3 py-3 text-left w-8">
                                    {isAuthenticated ? (
                                        <input
                                            type="checkbox"
                                            checked={tickets.length > 0 && selectedTickets.size === tickets.length}
                                            onChange={handleSelectAll}
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                    ) : (
                                        <span className="text-gray-300"><Lock className="w-4 h-4" /></span>
                                    )}
                                </th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8">Imp.</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">ID</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Game</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">User</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">Created</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                            {tickets.length === 0 && !loading ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                                        No tickets found matching your filters.
                                    </td>
                                </tr>
                            ) : (
                                tickets.map((ticket) => (
                                    <tr
                                        key={ticket.id}
                                        onClick={() => handleSelectTicket(ticket.id)}
                                        className={`
                                            group border-b border-gray-100 dark:border-gray-800 last:border-0 transition-all duration-200 cursor-pointer
                                            ${selectedTickets.has(ticket.id) ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-900/50'}
                                        `}
                                    >
                                        <td className="px-3 py-4 whitespace-nowrap w-8">
                                            <div className="flex items-center justify-center">
                                                {isAuthenticated ? (
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedTickets.has(ticket.id)}
                                                        onChange={() => handleSelectTicket(ticket.id)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 dark:border-gray-700 dark:bg-gray-900 transition-colors"
                                                    />
                                                ) : (
                                                    <Lock className="w-3 h-3 text-gray-300" />
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-3 py-4 whitespace-nowrap w-8">
                                            <div
                                                className={`w-3 h-3 rounded-full mx-auto ${ticket.importance === 'important' ? 'bg-red-500' :
                                                    ticket.importance === 'not_important' ? 'bg-gray-200 dark:bg-gray-700' :
                                                        'bg-gray-400'
                                                    }`}
                                                title={ticket.importance === 'important' ? 'Important' : ticket.importance === 'not_important' ? 'Not Important' : 'Normal'}
                                            />
                                        </td>
                                        <td className="px-3 py-4 whitespace-nowrap w-16">
                                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">#{ticket.ticket_id}</span>
                                        </td>
                                        <td className="px-3 py-4 whitespace-nowrap w-24">
                                            <div className="flex flex-col items-start justify-center">
                                                <span
                                                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                                                    style={{
                                                        backgroundColor: `hsl(${getGameColor(ticket.project_id)}, 70%, 90%)`,
                                                        color: `hsl(${getGameColor(ticket.project_id)}, 80%, 30%)`,
                                                    }}
                                                >
                                                    {getGameName(ticket.project_id)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col max-w-[400px] relative group/subject overflow-hidden">
                                                <Link
                                                    href={`/tickets/${ticket.id}`}
                                                    className={`block text-sm font-semibold text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors whitespace-nowrap overflow-hidden text-ellipsis ${ticket.subject.length > 50 ? 'group-hover/subject:animate-marquee group-hover/subject:overflow-visible' : ''}`}
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    {ticket.subject}
                                                </Link>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap w-32">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    if (!isAuthenticated) {
                                                        setShowLoginModal(true)
                                                        return
                                                    }
                                                    toggleTicketStatus(ticket.id, ticket.status)
                                                }}
                                                className={`
                                                    inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border shadow-sm transition-all
                                                    ${ticket.status === 'open' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' :
                                                        ticket.status === 'closed' ? 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700' :
                                                            ticket.status === 'duplicated' ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800' :
                                                                'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800'}
                                                `}
                                            >
                                                {ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap w-48">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-medium text-gray-900 dark:text-white">
                                                    {ticket.users?.email || 'Unknown User'}
                                                </span>
                                                <span className="text-[10px] text-gray-500">
                                                    via Email
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500 dark:text-gray-400 w-40">
                                            <div className="flex flex-col items-end">
                                                <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                                                <span className="text-xs text-gray-400">
                                                    {new Date(ticket.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                            {/* Loading Skeleton / Infinite Scroll Target */}
                            {(loading || loadingMore) && (
                                <tr>
                                    <td colSpan={8} className="px-6 py-4 text-center">
                                        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
                                    </td>
                                </tr>
                            )}
                            <tr ref={observerTarget} className="h-4 w-full" />
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile List View - Cards */}
            <div className="md:hidden flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-950">
                {tickets.length === 0 && !loading ? (
                    <div className="text-center py-12 text-gray-500 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
                        No tickets found
                    </div>
                ) : (
                    tickets.map((ticket) => (
                        <Link
                            key={ticket.id}
                            href={`/tickets/${ticket.id}`}
                            className="block bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm active:scale-[0.99] transition-transform"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <span
                                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                                        style={{
                                            backgroundColor: `hsl(${getGameColor(ticket.project_id)}, 70%, 90%)`,
                                            color: `hsl(${getGameColor(ticket.project_id)}, 80%, 30%)`,
                                        }}
                                    >
                                        {getGameName(ticket.project_id)}
                                    </span>
                                    <span className="text-xs text-gray-400">#{ticket.ticket_id}</span>
                                </div>
                                <span className={`
                                    text-xs font-medium px-2 py-0.5 rounded-full border
                                    ${ticket.status === 'open' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' :
                                        ticket.status === 'closed' ? 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700' :
                                            ticket.status === 'duplicated' ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800' :
                                                'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800'}
                                `}>
                                    {ticket.status}
                                </span>
                            </div>

                            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1 line-clamp-2">
                                {ticket.subject}
                            </h3>

                            <div className="flex items-center gap-2 mb-3 text-xs text-gray-500 truncate">
                                <span>{ticket.users?.email || 'Unknown'}</span>
                            </div>

                            <div className="flex items-center justify-between text-xs text-gray-400 pt-3 border-t border-gray-100 dark:border-gray-800">
                                <div className="flex items-center gap-1">
                                    <div
                                        className={`w-2 h-2 rounded-full ${ticket.importance === 'important' ? 'bg-red-500' : 'bg-gray-300'}`}
                                    />
                                    <span>{ticket.importance === 'important' ? 'Important' : 'Normal'}</span>
                                </div>
                                <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                            </div>
                        </Link>
                    ))
                )}

                {/* Mobile Loading Skeleton */}
                {(loading || loadingMore) && (
                    <div className="py-4 text-center">
                        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
                    </div>
                )}

                {/* Observer Target for Infinite Scroll */}
                <div ref={observerTarget} className="h-4 w-full" />
            </div>

            <style jsx>{`
                @keyframes marquee {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-100%); }
                }
                .marquee-content {
                    display: inline-block;
                    white-space: nowrap;
                    will-change: transform;
                }
                .marquee-trigger:hover .marquee-content {
                    animation: marquee 10s linear infinite;
                    min-width: 100%;
                }
            `}</style>

            {/* Login Required Modal */}
            {
                showLoginModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowLoginModal(false)}>
                        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-sm w-full shadow-xl border border-gray-200 dark:border-gray-800" onClick={e => e.stopPropagation()}>
                            <div className="text-center">
                                <div className="mx-auto w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mb-4">
                                    <Lock className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Login Required</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">You need to sign in to change ticket status or perform bulk actions.</p>
                                <div className="flex gap-3">
                                    <button onClick={() => setShowLoginModal(false)} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                                        Cancel
                                    </button>
                                    <Link href="/login" className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-center">
                                        Sign In
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Delete Confirmation Modal */}
            {
                showDeleteModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDeleteModal(false)}>
                        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-sm w-full shadow-xl border border-gray-200 dark:border-gray-800 animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                            <div className="text-center">
                                <div className="mx-auto w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                                    <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete {selectedTickets.size} Tickets?</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                                    This action cannot be undone. These tickets will be permanently removed.
                                </p>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowDeleteModal(false)}
                                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={confirmDelete}
                                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium shadow-sm hover:shadow"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    )
}

export default function TicketList() {
    return (
        <Suspense fallback={
            <div className="h-full flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-950">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
                <p className="mt-4 text-gray-500 dark:text-gray-400">Loading tickets...</p>
            </div>
        }>
            <TicketListContent />
        </Suspense>
    )
}
