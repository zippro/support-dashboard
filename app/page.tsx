'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Clock, CheckCircle, AlertCircle, Inbox, TrendingUp, TrendingDown, Minus, AlertTriangle, Sparkles, ArrowUp, ArrowDown } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
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
  const [todaySentiment, setTodaySentiment] = useState<any[]>([])
  const [comparisonData, setComparisonData] = useState<any[]>([])
  const [topTags, setTopTags] = useState<any[]>([])
  const [insights, setInsights] = useState<any[]>([])
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

        // 3. Comparison Data
        setComparisonData([
          { name: 'Total', yesterday: yesterdayTickets.length, today: todayTickets.length },
          { name: 'Open', yesterday: yesterdayTickets.filter(t => t.status === 'open').length, today: todayTickets.filter(t => t.status === 'open').length },
          { name: 'Closed', yesterday: yesterdayTickets.filter(t => t.status === 'closed').length, today: todayTickets.filter(t => t.status === 'closed').length },
          { name: 'Important', yesterday: yesterdayTickets.filter(t => t.importance === 'important').length, today: todayTickets.filter(t => t.importance === 'important').length },
        ])

        // 4. Today's Sentiment (only today)
        const todaySentimentCounts: Record<string, number> = { Positive: 0, Neutral: 0, Negative: 0, Angry: 0 }
        todayTickets.forEach(t => {
          const s = t.sentiment || 'Neutral'
          if (todaySentimentCounts[s] !== undefined) todaySentimentCounts[s]++
          else todaySentimentCounts['Neutral']++
        })
        setTodaySentiment(Object.entries(todaySentimentCounts).map(([name, value]) => ({ name, value })))

        // 5. Top Tags
        const tagCounts: Record<string, number> = {}
        tickets.forEach(t => {
          const tags = t.tags || []
          tags.forEach((tag: string) => { tagCounts[tag] = (tagCounts[tag] || 0) + 1 })
        })
        setTopTags(Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, value]) => ({ name, value })))

        // 6. Game Stats
        const projectCounts: Record<string, number> = {}
        tickets.forEach(t => { projectCounts[t.project_id || 'Unknown'] = (projectCounts[t.project_id || 'Unknown'] || 0) + 1 })

        const { data: projects } = await supabase.from('projects').select('project_id, game_name')
        const projectMap: Record<string, string> = {}
        projects?.forEach(p => projectMap[p.project_id] = p.game_name)

        setGameStats(Object.entries(projectCounts).map(([pid, count]) => ({
          name: projectMap[pid] || 'Unknown',
          value: count
        })).sort((a, b) => b.value - a.value).slice(0, 5))

        // 7. Timeline (Last 7 Days)
        const daysMap: Record<string, number> = {}
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
          daysMap[d.toLocaleDateString('en-US', { weekday: 'short' })] = 0
        }
        tickets.forEach(t => {
          const d = new Date(t.created_at)
          if (d >= lastWeek) {
            const key = d.toLocaleDateString('en-US', { weekday: 'short' })
            if (daysMap[key] !== undefined) daysMap[key]++
          }
        })
        setTimelineData(Object.entries(daysMap).map(([date, count]) => ({ date, tickets: count })))

        // 8. AI Insights
        const newInsights: any[] = []

        // Volume change alert
        if (totalTrend > 50) newInsights.push({ type: 'warning', icon: ArrowUp, message: `Ticket volume up ${totalTrend}% today`, color: 'text-orange-500' })
        else if (totalTrend < -30) newInsights.push({ type: 'success', icon: ArrowDown, message: `Ticket volume down ${Math.abs(totalTrend)}% today`, color: 'text-green-500' })

        // Angry sentiment alert
        const angryToday = todayTickets.filter(t => t.sentiment === 'Angry').length
        if (angryToday > 0) newInsights.push({ type: 'alert', icon: AlertTriangle, message: `${angryToday} angry customer${angryToday > 1 ? 's' : ''} today - needs attention!`, color: 'text-red-500' })

        // Important tickets
        const importantOpen = tickets.filter(t => t.importance === 'important' && t.status === 'open').length
        if (importantOpen > 0) newInsights.push({ type: 'alert', icon: AlertCircle, message: `${importantOpen} important ticket${importantOpen > 1 ? 's' : ''} still open`, color: 'text-red-500' })

        // Resolution rate
        const resolutionRate = total > 0 ? Math.round((closed / total) * 100) : 0
        if (resolutionRate > 80) newInsights.push({ type: 'success', icon: CheckCircle, message: `Great job! ${resolutionRate}% resolution rate`, color: 'text-green-500' })
        else if (resolutionRate < 50) newInsights.push({ type: 'warning', icon: AlertTriangle, message: `Resolution rate at ${resolutionRate}% - needs improvement`, color: 'text-orange-500' })

        if (newInsights.length === 0) newInsights.push({ type: 'info', icon: CheckCircle, message: 'No alerts - everything looks good!', color: 'text-green-500' })

        setInsights(newInsights)
      }
      setLoading(false)
    }

    fetchStats()
    const channel = supabase.channel('dashboard-stats').on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => fetchStats()).subscribe()
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
    <div className="p-8 space-y-6 h-full overflow-y-auto bg-gray-50 dark:bg-gray-950">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Analytics Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Support performance & insights</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 bg-white dark:bg-gray-900 px-3 py-1.5 rounded-md border dark:border-gray-800 shadow-sm">
          <Clock className="w-4 h-4" />
          <span>{new Date().toLocaleTimeString()}</span>
        </div>
      </div>

      {/* AI Insights */}
      <div className="rounded-xl border bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 p-4 dark:border-gray-800">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-indigo-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">AI Insights</h3>
        </div>
        <div className="flex flex-wrap gap-3">
          {insights.map((insight, i) => (
            <div key={i} className="flex items-center gap-2 bg-white dark:bg-gray-900 px-3 py-2 rounded-lg border dark:border-gray-800 shadow-sm">
              <insight.icon className={`w-4 h-4 ${insight.color}`} />
              <span className="text-sm text-gray-700 dark:text-gray-300">{insight.message}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Tickets" value={stats.total} icon={Inbox} color="bg-indigo-500" trend={stats.totalTrend} trendLabel="vs. yesterday" />
        <StatCard title="Open Tickets" value={stats.open} icon={AlertCircle} color="bg-red-500" trend={stats.openTrend} trendLabel="vs. yesterday" />
        <StatCard title="Important" value={stats.important} icon={AlertTriangle} color="bg-orange-500" subtext="Needs attention" />
        <StatCard title="Resolved" value={stats.closed} icon={CheckCircle} color="bg-green-500" subtext="Successfully closed" />
      </div>

      {/* Charts Row 1: Games Pie + Today's Sentiment */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Games Pie Chart */}
        <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-gray-900">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Tickets by Game</h3>
          <div className="h-[220px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={gameStats} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                  {gameStats.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', color: '#fff' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</span>
              <span className="text-xs text-gray-500">Total</span>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-3 mt-2">
            {gameStats.map((g, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-gray-600 dark:text-gray-300">{g.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Today's Sentiment */}
        <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-gray-900">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Today's Sentiment</h3>
          <div className="h-[220px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={todaySentiment} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                  {todaySentiment.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={SENTIMENT_COLORS[entry.name as keyof typeof SENTIMENT_COLORS] || '#6B7280'} strokeWidth={0} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', color: '#fff' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-2">
            {todaySentiment.map((s, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SENTIMENT_COLORS[s.name as keyof typeof SENTIMENT_COLORS] }} />
                <span className="text-gray-600 dark:text-gray-300">{s.name}: {s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts Row 2: Comparison + Weekly Volume */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Today vs Yesterday */}
        <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-gray-900">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Today vs Yesterday</h3>
          <div className="h-[200px] w-full">
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

        {/* Weekly Volume */}
        <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-gray-900">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Weekly Volume</h3>
          <div className="h-[200px] w-full">
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
      </div>

      {/* Top Tags */}
      <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-gray-900">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Top Tags</h3>
        {topTags.length === 0 ? (
          <div className="text-center py-4 text-gray-500">No tags yet</div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {topTags.map((tag, i) => (
              <div key={i} className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 px-4 py-2 rounded-full">
                <span className="text-indigo-700 dark:text-indigo-300 font-medium">{tag.name}</span>
                <span className="bg-indigo-200 dark:bg-indigo-800 text-indigo-800 dark:text-indigo-200 text-xs px-2 py-0.5 rounded-full font-bold">{tag.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
