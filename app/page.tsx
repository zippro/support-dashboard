'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Activity, MessageSquare, Users, Clock, CheckCircle, AlertCircle, Inbox, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts'

const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']

function StatCard({ title, value, icon: Icon, color, trend, trendLabel }: any) {
  const isPositive = trend > 0
  const isNeutral = trend === 0

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-gray-900 transition-all hover:shadow-md">
      <div className="flex items-center justify-between mb-4">
        <div className={`rounded-full p-3 ${color} bg-opacity-10`}>
          <Icon className={`h-6 w-6 ${color.replace('bg-', 'text-')}`} />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center text-xs font-medium px-2 py-1 rounded-full ${isPositive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
            isNeutral ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' :
              'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            }`}>
            {isPositive ? <TrendingUp className="w-3 h-3 mr-1" /> : isNeutral ? <Minus className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
        <h3 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">{value}</h3>
        {trendLabel && <p className="text-xs text-gray-400 mt-2">{trendLabel}</p>}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    closed: 0,
    pending: 0,
    totalTrend: 0,
    openTrend: 0
  })
  const [gameStats, setGameStats] = useState<any[]>([])
  const [timelineData, setTimelineData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      const now = new Date()
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

      // Fetch all tickets (optimize later with server-side aggregation if needed)
      const { data: tickets } = await supabase
        .from('tickets')
        .select('status, project_id, created_at')
        .order('created_at', { ascending: true })

      if (tickets) {
        // 1. General Stats
        const total = tickets.length
        const open = tickets.filter(t => t.status === 'open').length
        const closed = tickets.filter(t => t.status === 'closed').length
        const pending = tickets.filter(t => t.status === 'pending').length

        // 2. Trends (Last 24h vs Previous 24h)
        const last24h = tickets.filter(t => new Date(t.created_at) >= yesterday)
        const prev24h = tickets.filter(t => {
          const d = new Date(t.created_at)
          return d >= new Date(yesterday.getTime() - 24 * 60 * 60 * 1000) && d < yesterday
        })

        const totalTrend = prev24h.length === 0 ? 100 : Math.round(((last24h.length - prev24h.length) / prev24h.length) * 100)

        const openLast24h = last24h.filter(t => t.status === 'open').length
        const openPrev24h = prev24h.filter(t => t.status === 'open').length
        const openTrend = openPrev24h === 0 ? (openLast24h > 0 ? 100 : 0) : Math.round(((openLast24h - openPrev24h) / openPrev24h) * 100)

        setStats({ total, open, closed, pending, totalTrend, openTrend })

        // 3. Game Stats
        const projectCounts: Record<string, number> = {}
        tickets.forEach(t => {
          const pid = t.project_id || 'Unknown'
          projectCounts[pid] = (projectCounts[pid] || 0) + 1
        })

        const { data: projects } = await supabase.from('projects').select('project_id, game_name')
        const projectMap: Record<string, string> = {}
        projects?.forEach(p => projectMap[p.project_id] = p.game_name)

        const chartData = Object.entries(projectCounts).map(([pid, count]) => ({
          name: projectMap[pid] || pid,
          value: count
        })).sort((a, b) => b.value - a.value).slice(0, 5) // Top 5

        setGameStats(chartData)

        // 4. Timeline Data (Last 7 Days)
        const daysMap: Record<string, number> = {}
        // Initialize last 7 days with 0
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
          const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          daysMap[key] = 0
        }

        tickets.forEach(t => {
          const d = new Date(t.created_at)
          if (d >= lastWeek) {
            const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            if (daysMap[key] !== undefined) {
              daysMap[key]++
            }
          }
        })

        const timeline = Object.entries(daysMap).map(([date, count]) => ({
          date,
          tickets: count
        }))
        setTimelineData(timeline)
      }
      setLoading(false)
    }

    fetchStats()

    const channel = supabase
      .channel('dashboard-stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => {
        fetchStats()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-8 h-full overflow-y-auto bg-gray-50 dark:bg-gray-950">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Analytics Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Overview of support performance and key metrics.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 bg-white dark:bg-gray-900 px-3 py-1.5 rounded-md border dark:border-gray-800 shadow-sm">
          <Clock className="w-4 h-4" />
          <span>Last updated: {new Date().toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Tickets"
          value={stats.total}
          icon={Inbox}
          color="bg-indigo-500"
          trend={stats.totalTrend}
          trendLabel="vs. previous 24h"
        />
        <StatCard
          title="Open Tickets"
          value={stats.open}
          icon={AlertCircle}
          color="bg-red-500"
          trend={stats.openTrend}
          trendLabel="vs. previous 24h"
        />
        <StatCard
          title="Pending"
          value={stats.pending}
          icon={Clock}
          color="bg-yellow-500"
          subtext="Waiting for response"
        />
        <StatCard
          title="Resolved"
          value={stats.closed}
          icon={CheckCircle}
          color="bg-green-500"
          subtext="Successfully closed"
        />
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">

        {/* Line Chart: Volume Over Time */}
        <div className="col-span-4 rounded-xl border bg-white p-6 shadow-sm dark:bg-gray-900">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Ticket Volume (Last 7 Days)</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTickets" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#9CA3AF"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#9CA3AF"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value}`}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', color: '#fff', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                  itemStyle={{ color: '#fff' }}
                  cursor={{ stroke: '#6366F1', strokeWidth: 2 }}
                />
                <Area
                  type="monotone"
                  dataKey="tickets"
                  stroke="#6366F1"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorTickets)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart: Tickets by Game */}
        <div className="col-span-3 rounded-xl border bg-white p-6 shadow-sm dark:bg-gray-900">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Top Games by Volume</h3>
          <div className="h-[300px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={gameStats}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {gameStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-bold text-gray-900 dark:text-white">{stats.total}</span>
              <span className="text-xs text-gray-500 uppercase tracking-wider">Tickets</span>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            {gameStats.map((entry, index) => (
              <div key={index} className="flex items-center gap-1.5 text-xs">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="text-gray-600 dark:text-gray-300 font-medium">{entry.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
