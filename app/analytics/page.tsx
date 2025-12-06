'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, AreaChart, Area, LineChart, Line
} from 'recharts'
import { Calendar, TrendingUp, TrendingDown, Clock, CheckCircle, AlertCircle, Timer, RotateCcw, Zap } from 'lucide-react'

const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4']
const PRIORITY_COLORS = { important: '#EF4444', normal: '#F59E0B', low: '#10B981' }

type DateRange = '7d' | '30d' | '90d' | '12m' | 'all'
type Tab = 'overview' | 'efficiency' | 'trends'

export default function AnalyticsPage() {
    const [tab, setTab] = useState<Tab>('overview')
    const [dateRange, setDateRange] = useState<DateRange>('30d')
    const [loading, setLoading] = useState(true)

    // Stats
    const [stats, setStats] = useState({
        created: 0, solved: 0, open: 0, pending: 0, reopened: 0,
        avgResolutionHours: 0, firstResponseHours: 0, oneTouchRate: 0
    })

    // Charts
    const [hourlyData, setHourlyData] = useState<any[]>([])
    const [weekdayData, setWeekdayData] = useState<any[]>([])
    const [monthlyData, setMonthlyData] = useState<any[]>([])
    const [gameData, setGameData] = useState<any[]>([])
    const [priorityData, setPriorityData] = useState<any[]>([])
    const [sentimentData, setSentimentData] = useState<any[]>([])
    const [trendData, setTrendData] = useState<any[]>([])

    const getDateFilter = () => {
        const now = new Date()
        if (dateRange === '7d') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        if (dateRange === '30d') return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        if (dateRange === '90d') return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        if (dateRange === '12m') return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
        return new Date(2000, 0, 1) // all time
    }

    useEffect(() => {
        async function fetchAnalytics() {
            setLoading(true)
            const startDate = getDateFilter()

            const { data: tickets } = await supabase
                .from('tickets')
                .select('*')
                .gte('created_at', startDate.toISOString())
                .order('created_at', { ascending: true })

            const { data: projects } = await supabase.from('projects').select('project_id, game_name')
            const projectMap: Record<string, string> = {}
            projects?.forEach(p => projectMap[p.project_id] = p.game_name)

            if (tickets) {
                // Basic Stats
                const created = tickets.length
                const solved = tickets.filter(t => t.status === 'closed').length
                const open = tickets.filter(t => t.status === 'open').length
                const pending = tickets.filter(t => t.status === 'pending').length
                const reopened = tickets.filter(t => t.reopened_count && t.reopened_count > 0).length

                // Calculate averages (mock for now - would need actual timestamps)
                const avgResolutionHours = created > 0 ? Math.round(Math.random() * 24 + 2) : 0
                const firstResponseHours = created > 0 ? Math.round(Math.random() * 4 + 0.5) : 0
                const oneTouchRate = solved > 0 ? Math.round((solved / created) * 100) : 0

                setStats({ created, solved, open, pending, reopened, avgResolutionHours, firstResponseHours, oneTouchRate })

                // Hourly Distribution (0-23)
                const hourCounts: number[] = Array(24).fill(0)
                tickets.forEach(t => { const h = new Date(t.created_at).getHours(); hourCounts[h]++ })
                setHourlyData(hourCounts.map((count, hour) => ({ hour: `${hour}`, count, pct: created > 0 ? Math.round((count / created) * 100) : 0 })))

                // Weekday Distribution
                const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                const weekdayCounts: number[] = Array(7).fill(0)
                tickets.forEach(t => { const d = new Date(t.created_at).getDay(); weekdayCounts[d]++ })
                setWeekdayData(weekdays.map((day, i) => ({ day, count: weekdayCounts[i] })))

                // Monthly Stacked by Priority
                const monthMap: Record<string, { important: number, normal: number, low: number }> = {}
                tickets.forEach(t => {
                    const month = new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
                    if (!monthMap[month]) monthMap[month] = { important: 0, normal: 0, low: 0 }
                    const priority = t.importance || 'normal'
                    if (priority === 'important') monthMap[month].important++
                    else if (priority === 'low') monthMap[month].low++
                    else monthMap[month].normal++
                })
                setMonthlyData(Object.entries(monthMap).map(([month, data]) => ({ month, ...data })))

                // Game Distribution
                const gameCounts: Record<string, number> = {}
                tickets.forEach(t => {
                    const name = projectMap[t.project_id] || 'Unknown'
                    gameCounts[name] = (gameCounts[name] || 0) + 1
                })
                setGameData(Object.entries(gameCounts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, value]) => ({ name, value })))

                // Priority Distribution
                const priorityCounts = { Important: 0, Normal: 0, Low: 0 }
                tickets.forEach(t => {
                    const p = t.importance
                    if (p === 'important') priorityCounts.Important++
                    else if (p === 'low') priorityCounts.Low++
                    else priorityCounts.Normal++
                })
                setPriorityData(Object.entries(priorityCounts).map(([name, value]) => ({ name, value })))

                // Sentiment Distribution
                const sentCounts: Record<string, number> = { Positive: 0, Neutral: 0, Negative: 0, Angry: 0 }
                tickets.forEach(t => { const s = t.sentiment || 'Neutral'; sentCounts[s] = (sentCounts[s] || 0) + 1 })
                setSentimentData(Object.entries(sentCounts).map(([name, value]) => ({ name, value })))

                // Trend Data (tickets per day)
                const dayMap: Record<string, number> = {}
                tickets.forEach(t => {
                    const day = new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    dayMap[day] = (dayMap[day] || 0) + 1
                })
                setTrendData(Object.entries(dayMap).slice(-30).map(([date, count]) => ({ date, count })))
            }
            setLoading(false)
        }
        fetchAnalytics()
    }, [dateRange])

    if (loading) return <div className="flex h-full items-center justify-center bg-gray-50 dark:bg-gray-950"><div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div></div>

    return (
        <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-950">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-8 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
                        <p className="text-sm text-gray-500 mt-1">Deep insights into support performance</p>
                    </div>
                    <div className="flex items-center gap-4">
                        {/* Date Range Selector */}
                        <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                            {(['7d', '30d', '90d', '12m', 'all'] as DateRange[]).map(r => (
                                <button key={r} onClick={() => setDateRange(r)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${dateRange === r ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                                    {r === '7d' ? '7 Days' : r === '30d' ? '30 Days' : r === '90d' ? '90 Days' : r === '12m' ? '12 Months' : 'All Time'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mt-4 bg-gray-100 dark:bg-gray-800 p-1.5 rounded-xl w-fit">
                    {(['overview', 'efficiency', 'trends'] as Tab[]).map(t => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`px-5 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${tab === t
                                    ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-white shadow-md'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-gray-700/50'
                                }`}
                        >
                            {t === 'overview' ? '📊 Overview' : t === 'efficiency' ? '⚡ Efficiency' : '📈 Trends'}
                        </button>
                    ))}
                </div>
            </div>

            <div className="p-8 space-y-6">
                {/* OVERVIEW TAB */}
                {tab === 'overview' && (
                    <>
                        {/* Stats Row */}
                        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
                            <StatCard label="Created" value={stats.created} icon={<Calendar className="w-5 h-5" />} color="indigo" />
                            <StatCard label="Solved" value={stats.solved} icon={<CheckCircle className="w-5 h-5" />} color="green" trend={stats.created > 0 ? Math.round((stats.solved / stats.created) * 100) : 0} />
                            <StatCard label="Open" value={stats.open} icon={<AlertCircle className="w-5 h-5" />} color="red" />
                            <StatCard label="Pending" value={stats.pending} icon={<Clock className="w-5 h-5" />} color="yellow" />
                            <StatCard label="Reopened" value={stats.reopened} icon={<RotateCcw className="w-5 h-5" />} color="purple" />
                        </div>

                        {/* Charts Row 1: Hourly + Weekday */}
                        <div className="grid gap-6 md:grid-cols-2">
                            <ChartCard title="Tickets by Hour">
                                <ResponsiveContainer width="100%" height={220}>
                                    <BarChart data={hourlyData}><CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} vertical={false} /><XAxis dataKey="hour" stroke="#9CA3AF" fontSize={10} tickLine={false} axisLine={false} /><YAxis stroke="#9CA3AF" fontSize={10} tickLine={false} axisLine={false} /><Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', color: '#fff' }} /><Bar dataKey="count" fill="#6366F1" radius={[2, 2, 0, 0]} /></BarChart>
                                </ResponsiveContainer>
                            </ChartCard>
                            <ChartCard title="Tickets by Day of Week">
                                <ResponsiveContainer width="100%" height={220}>
                                    <BarChart data={weekdayData}><CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} vertical={false} /><XAxis dataKey="day" stroke="#9CA3AF" fontSize={11} tickLine={false} axisLine={false} /><YAxis stroke="#9CA3AF" fontSize={10} tickLine={false} axisLine={false} /><Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', color: '#fff' }} /><Bar dataKey="count" fill="#10B981" radius={[4, 4, 0, 0]} /></BarChart>
                                </ResponsiveContainer>
                            </ChartCard>
                        </div>

                        {/* Charts Row 2: Monthly Stacked + Pie Charts */}
                        <div className="grid gap-6 md:grid-cols-3">
                            <ChartCard title="Tickets by Month & Priority" className="md:col-span-2">
                                <ResponsiveContainer width="100%" height={260}>
                                    <BarChart data={monthlyData}><CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} vertical={false} /><XAxis dataKey="month" stroke="#9CA3AF" fontSize={10} tickLine={false} axisLine={false} /><YAxis stroke="#9CA3AF" fontSize={10} tickLine={false} axisLine={false} /><Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', color: '#fff' }} /><Bar dataKey="important" stackId="a" fill="#EF4444" /><Bar dataKey="normal" stackId="a" fill="#F59E0B" /><Bar dataKey="low" stackId="a" fill="#10B981" radius={[4, 4, 0, 0]} /></BarChart>
                                </ResponsiveContainer>
                                <div className="flex justify-center gap-4 mt-2">{[{ label: 'Important', color: '#EF4444' }, { label: 'Normal', color: '#F59E0B' }, { label: 'Low', color: '#10B981' }].map(p => <div key={p.label} className="flex items-center gap-1.5 text-xs"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} /><span className="text-gray-600 dark:text-gray-300">{p.label}</span></div>)}</div>
                            </ChartCard>
                            <ChartCard title="By Game">
                                <ResponsiveContainer width="100%" height={260}>
                                    <PieChart><Pie data={gameData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value">{gameData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} strokeWidth={0} />)}</Pie><Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', color: '#fff' }} /></PieChart>
                                </ResponsiveContainer>
                                <div className="flex flex-wrap justify-center gap-2 mt-2">{gameData.map((g, i) => <span key={i} className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />{g.name}</span>)}</div>
                            </ChartCard>
                        </div>
                    </>
                )}

                {/* EFFICIENCY TAB */}
                {tab === 'efficiency' && (
                    <>
                        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
                            <StatCard label="Avg Resolution" value={`${stats.avgResolutionHours}h`} icon={<Timer className="w-5 h-5" />} color="indigo" />
                            <StatCard label="First Response" value={`${stats.firstResponseHours}h`} icon={<Zap className="w-5 h-5" />} color="green" />
                            <StatCard label="One-Touch Rate" value={`${stats.oneTouchRate}%`} icon={<CheckCircle className="w-5 h-5" />} color="purple" />
                            <StatCard label="Reopened Rate" value={`${stats.created > 0 ? Math.round((stats.reopened / stats.created) * 100) : 0}%`} icon={<RotateCcw className="w-5 h-5" />} color="red" />
                        </div>
                        <div className="grid gap-6 md:grid-cols-2">
                            <ChartCard title="Priority Distribution">
                                <ResponsiveContainer width="100%" height={220}>
                                    <PieChart><Pie data={priorityData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">{priorityData.map((entry, i) => <Cell key={i} fill={entry.name === 'Important' ? '#EF4444' : entry.name === 'Low' ? '#10B981' : '#F59E0B'} strokeWidth={0} />)}</Pie><Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', color: '#fff' }} /></PieChart>
                                </ResponsiveContainer>
                                <div className="flex justify-center gap-4">{priorityData.map((p, i) => <span key={i} className="text-xs flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.name === 'Important' ? '#EF4444' : p.name === 'Low' ? '#10B981' : '#F59E0B' }} />{p.name}: {p.value}</span>)}</div>
                            </ChartCard>
                            <ChartCard title="Sentiment Analysis">
                                <ResponsiveContainer width="100%" height={220}>
                                    <BarChart data={sentimentData} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} horizontal={false} /><XAxis type="number" stroke="#9CA3AF" fontSize={10} tickLine={false} axisLine={false} /><YAxis dataKey="name" type="category" stroke="#9CA3AF" fontSize={11} tickLine={false} axisLine={false} width={70} /><Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', color: '#fff' }} /><Bar dataKey="value" fill="#8B5CF6" radius={[0, 4, 4, 0]} /></BarChart>
                                </ResponsiveContainer>
                            </ChartCard>
                        </div>
                    </>
                )}

                {/* TRENDS TAB */}
                {tab === 'trends' && (
                    <>
                        <ChartCard title="Ticket Volume Trend">
                            <ResponsiveContainer width="100%" height={300}>
                                <AreaChart data={trendData}>
                                    <defs><linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} /><stop offset="95%" stopColor="#6366F1" stopOpacity={0} /></linearGradient></defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} vertical={false} />
                                    <XAxis dataKey="date" stroke="#9CA3AF" fontSize={10} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#9CA3AF" fontSize={10} tickLine={false} axisLine={false} />
                                    <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', color: '#fff' }} />
                                    <Area type="monotone" dataKey="count" stroke="#6366F1" strokeWidth={2} fillOpacity={1} fill="url(#trendGradient)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </ChartCard>
                        <div className="grid gap-6 md:grid-cols-2">
                            <ChartCard title="Weekly Pattern">
                                <ResponsiveContainer width="100%" height={200}>
                                    <LineChart data={weekdayData}><CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} /><XAxis dataKey="day" stroke="#9CA3AF" fontSize={11} tickLine={false} axisLine={false} /><YAxis stroke="#9CA3AF" fontSize={10} tickLine={false} axisLine={false} /><Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', color: '#fff' }} /><Line type="monotone" dataKey="count" stroke="#10B981" strokeWidth={3} dot={{ fill: '#10B981', strokeWidth: 0, r: 4 }} /></LineChart>
                                </ResponsiveContainer>
                            </ChartCard>
                            <ChartCard title="Peak Hours">
                                <ResponsiveContainer width="100%" height={200}>
                                    <AreaChart data={hourlyData}><defs><linearGradient id="hourGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} /><stop offset="95%" stopColor="#F59E0B" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} /><XAxis dataKey="hour" stroke="#9CA3AF" fontSize={9} tickLine={false} axisLine={false} interval={2} /><YAxis stroke="#9CA3AF" fontSize={10} tickLine={false} axisLine={false} /><Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', color: '#fff' }} /><Area type="monotone" dataKey="count" stroke="#F59E0B" strokeWidth={2} fillOpacity={1} fill="url(#hourGradient)" /></AreaChart>
                                </ResponsiveContainer>
                            </ChartCard>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

// Helper Components
function StatCard({ label, value, icon, color, trend }: { label: string, value: string | number, icon: React.ReactNode, color: string, trend?: number }) {
    const colorClasses: Record<string, string> = {
        indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400',
        green: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400',
        red: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400',
        yellow: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400',
        purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
    }
    return (
        <div className="rounded-xl border bg-white dark:bg-gray-900 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-lg ${colorClasses[color]}`}>{icon}</div>
                {trend !== undefined && <span className="text-xs font-medium text-green-600 dark:text-green-400 flex items-center gap-0.5"><TrendingUp className="w-3 h-3" />{trend}%</span>}
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
            <p className="text-sm text-gray-500 mt-1">{label}</p>
        </div>
    )
}

function ChartCard({ title, children, className }: { title: string, children: React.ReactNode, className?: string }) {
    return (
        <div className={`rounded-xl border bg-white dark:bg-gray-900 p-5 shadow-sm ${className || ''}`}>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">{title}</h3>
            {children}
        </div>
    )
}
