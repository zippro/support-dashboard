'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Activity, MessageSquare, Users, Clock, CheckCircle, AlertCircle, Inbox, TrendingUp, TrendingDown, Minus, Smile, Meh, Frown, Angry, Tag, AlertTriangle } from 'lucide-react'
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
const SENTIMENT_COLORS = { Positive: '#10B981', Neutral: '#6B7280', Negative: '#F59E0B', Angry: '#EF4444' }

function StatCard({ title, value, icon: Icon, color, trend, trendLabel, subtext }: any) {
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
        {(trendLabel || subtext) && <p className="text-xs text-gray-400 mt-2">{trendLabel || subtext}</p>}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState({
    total: 0, open: 0, closed: 0, pending: 0, totalTrend: 0, openTrend: 0, important: 0
  })
  const [gameStats, setGameStats] = useState<any[]>([])
  const [timelineData, setTimelineData] = useState<any[]>([])
  const [sentimentData, setSentimentData] = useState<any[]>([])
  const [comparisonData, setComparisonData] = useState<any[]>([])
  const [topTags, setTopTags] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000)
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

      const { data: tickets } = await supabase
        .from('tickets')
        .select('status, project_id, created_at, sentiment, importance, tags')
        .order('created_at', { ascending: true })

      if (tickets) {
        // 1. General Stats
        const total = tickets.length
        const open = tickets.filter(t => t.status === 'open').length
        const closed = tickets.filter(t => t.status === 'closed').length
        const pending = tickets.filter(t => t.status === 'pending').length
        const important = tickets.filter(t => t.importance === 'important').length

        // 2. Today vs Yesterday
        const todayTickets = tickets.filter(t => new Date(t.created_at) >= todayStart)
        const yesterdayTickets = tickets.filter(t => {
          const d = new Date(t.created_at)
          return d >= yesterdayStart && d < todayStart
        })

        const totalTrend = yesterdayTickets.length === 0 ? (todayTickets.length > 0 ? 100 : 0) :
          Math.round(((todayTickets.length - yesterdayTickets.length) / yesterdayTickets.length) * 100)

        const openToday = todayTickets.filter(t => t.status === 'open').length
        const openYesterday = yesterdayTickets.filter(t => t.status === 'open').length
        const openTrend = openYesterday === 0 ? (openToday > 0 ? 100 : 0) :
          Math.round(((openToday - openYesterday) / openYesterday) * 100)

        setStats({ total, open, closed, pending, totalTrend, openTrend, important })

        // 3. Comparison Data (Today vs Yesterday)
        setComparisonData([
          { name: 'Total', yesterday: yesterdayTickets.length, today: todayTickets.length },
          { name: 'Open', yesterday: yesterdayTickets.filter(t => t.status === 'open').length, today: todayTickets.filter(t => t.status === 'open').length },
          { name: 'Closed', yesterday: yesterdayTickets.filter(t => t.status === 'closed').length, today: todayTickets.filter(t => t.status === 'closed').length },
          { name: 'Important', yesterday: yesterdayTickets.filter(t => t.importance === 'important').length, today: todayTickets.filter(t => t.importance === 'important').length },
        ])

        // 4. Sentiment Distribution
        const sentimentCounts: Record<string, number> = { Positive: 0, Neutral: 0, Negative: 0, Angry: 0 }
        tickets.forEach(t => {
          const s = t.sentiment || 'Neutral'
          if (sentimentCounts[s] !== undefined) sentimentCounts[s]++
          else sentimentCounts['Neutral']++
        })
        setSentimentData(Object.entries(sentimentCounts).map(([name, value]) => ({ name, value })))

        // 5. Top Tags
        const tagCounts: Record<string, number> = {}
        tickets.forEach(t => {
          const tags = t.tags || []
          tags.forEach((tag: string) => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1
          })
        })
        const sortedTags = Object.entries(tagCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, value]) => ({ name, value }))
        setTopTags(sortedTags)

        // 6. Game Stats
        const projectCounts: Record<string, number> = {}
        tickets.forEach(t => {
          const pid = t.project_id || 'Unknown'
          projectCounts[pid] = (projectCounts[pid] || 0) + 1
        })

        const { data: projects } = await supabase.from('projects').select('project_id, game_name')
        const projectMap: Record<string, string> = {}
        projects?.forEach(p => projectMap[p.project_id] = p.game_name)

        const chartData = Object.entries(projectCounts).map(([pid, count]) => ({
          name: projectMap[pid] || pid.slice(0, 8) + '...',
          value: count
        })).sort((a, b) => b.value - a.value).slice(0, 5)
        setGameStats(chartData)

        // 7. Timeline Data (Last 7 Days)
        const daysMap: Record<string, number> = {}
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
          const key = d.toLocaleDateString('en-US', { weekday: 'short' })
          daysMap[key] = 0
        }

        tickets.forEach(t => {
          const d = new Date(t.created_at)
          if (d >= lastWeek) {
            const key = d.toLocaleDateString('en-US', { weekday: 'short' })
            if (daysMap[key] !== undefined) daysMap[key]++
          }
        })

        setTimelineData(Object.entries(daysMap).map(([date, count]) => ({ date, tickets: count })))
      }
      setLoading(false)
    }

    fetchStats()

    const channel = supabase
      .channel('dashboard-stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => fetchStats())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
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
          <p className="text-gray-500 dark:text-gray-400 mt-1">Support performance & insights</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 bg-white dark:bg-gray-900 px-3 py-1.5 rounded-md border dark:border-gray-800 shadow-sm">
          <Clock className="w-4 h-4" />
          <span>Updated: {new Date().toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Stats Grid - Row 1 */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Tickets" value={stats.total} icon={Inbox} color="bg-indigo-500" trend={stats.totalTrend} trendLabel="vs. yesterday" />
        <StatCard title="Open Tickets" value={stats.open} icon={AlertCircle} color="bg-red-500" trend={stats.openTrend} trendLabel="vs. yesterday" />
        <StatCard title="Important" value={stats.important} icon={AlertTriangle} color="bg-orange-500" subtext="Needs attention" />
        <StatCard title="Resolved" value={stats.closed} icon={CheckCircle} color="bg-green-500" subtext="Successfully closed" />
      </div>

      {/* Charts Row 1: Comparison + Sentiment */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Today vs Yesterday */}
        <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-gray-900">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Today vs Yesterday</h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} vertical={false} />
                <XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', color: '#fff' }} />
                <Bar dataKey="yesterday" fill="#9CA3AF" radius={[4, 4, 0, 0]} name="Yesterday" />
                <Bar dataKey="today" fill="#6366F1" radius={[4, 4, 0, 0]} name="Today" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sentiment Pie */}
        <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-gray-900">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Sentiment Distribution</h3>
          <div className="h-[250px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={sentimentData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={5} dataKey="value">
                  {sentimentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={SENTIMENT_COLORS[entry.name as keyof typeof SENTIMENT_COLORS] || '#6B7280'} strokeWidth={0} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', color: '#fff' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-4">
            {sentimentData.map((s, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SENTIMENT_COLORS[s.name as keyof typeof SENTIMENT_COLORS] }} />
                <span className="text-gray-600 dark:text-gray-300">{s.name}: {s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts Row 2: Timeline + Games + Tags */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Ticket Volume */}
        <div className="lg:col-span-2 rounded-xl border bg-white p-6 shadow-sm dark:bg-gray-900">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Weekly Volume</h3>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTickets" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} vertical={false} />
                <XAxis dataKey="date" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', color: '#fff' }} />
                <Area type="monotone" dataKey="tickets" stroke="#6366F1" strokeWidth={3} fillOpacity={1} fill="url(#colorTickets)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Tags */}
        <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-gray-900">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Top Tags</h3>
          {topTags.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No tags yet</div>
          ) : (
            <div className="space-y-3">
              {topTags.map((tag, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-sm font-medium">{tag.name}</span>
                  <span className="text-gray-900 dark:text-white font-semibold">{tag.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Games Pie */}
      <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-gray-900">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Tickets by Game</h3>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={gameStats} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} horizontal={false} />
              <XAxis type="number" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis dataKey="name" type="category" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} width={100} />
              <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', color: '#fff' }} />
              <Bar dataKey="value" fill="#6366F1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
