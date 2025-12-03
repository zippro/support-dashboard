'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Trash2, Plus } from 'lucide-react'

interface Project {
    id: string
    project_id: string
    game_name: string
    created_at: string
}

export default function SettingsPage() {
    const [quickReplies, setQuickReplies] = useState<{ id: string, title: string, reply: string }[]>([])
    const [newReplyTitle, setNewReplyTitle] = useState('')
    const [newReplyContent, setNewReplyContent] = useState('')
    const [addingReply, setAddingReply] = useState(false)

    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const [newProjectId, setNewProjectId] = useState('')
    const [newGameName, setNewGameName] = useState('')
    const [adding, setAdding] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        fetchProjects()
        fetchQuickReplies()
    }, [])

    async function fetchQuickReplies() {
        try {
            const { data, error } = await supabase
                .from('quick_replies')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) throw error
            setQuickReplies(data || [])
        } catch (err: any) {
            console.error('Error fetching quick replies:', err)
        }
    }

    async function addQuickReply(e: React.FormEvent) {
        e.preventDefault()
        if (!newReplyTitle.trim() || !newReplyContent.trim()) return

        try {
            setAddingReply(true)
            const { data, error } = await supabase
                .from('quick_replies')
                .insert({
                    title: newReplyTitle.trim(),
                    reply: newReplyContent.trim()
                })
                .select()
                .single()

            if (error) throw error

            setQuickReplies([data, ...quickReplies])
            setNewReplyTitle('')
            setNewReplyContent('')
        } catch (err: any) {
            console.error('Error adding quick reply:', err)
            alert('Failed to add reply: ' + err.message)
        } finally {
            setAddingReply(false)
        }
    }

    async function deleteQuickReply(id: string) {
        if (!confirm('Are you sure you want to delete this reply?')) return

        try {
            const { error } = await supabase
                .from('quick_replies')
                .delete()
                .eq('id', id)

            if (error) throw error

            setQuickReplies(quickReplies.filter(r => r.id !== id))
        } catch (err: any) {
            console.error('Error deleting quick reply:', err)
            alert('Failed to delete reply: ' + err.message)
        }
    }

    async function fetchProjects() {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('projects')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) throw error
            setProjects(data || [])
        } catch (err: any) {
            console.error('Error fetching projects:', err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    async function addProject(e: React.FormEvent) {
        e.preventDefault()
        if (!newProjectId.trim() || !newGameName.trim()) return

        try {
            setAdding(true)
            setError(null)
            const { data, error } = await supabase
                .from('projects')
                .insert({
                    project_id: newProjectId.trim(),
                    game_name: newGameName.trim()
                })
                .select()
                .single()

            if (error) throw error

            setProjects([data, ...projects])
            setNewProjectId('')
            setNewGameName('')
        } catch (err: any) {
            console.error('Error adding project:', err)
            setError(err.message)
        } finally {
            setAdding(false)
        }
    }

    async function deleteProject(id: string) {
        if (!confirm('Are you sure you want to delete this mapping?')) return

        try {
            const { error } = await supabase
                .from('projects')
                .delete()
                .eq('id', id)

            if (error) throw error

            setProjects(projects.filter(p => p.id !== id))
        } catch (err: any) {
            console.error('Error deleting project:', err)
            alert('Failed to delete project: ' + err.message)
        }
    }

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Settings</h1>

            {/* Quick Replies Section */}
            <div className="bg-white dark:bg-gray-900 shadow rounded-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                    <h2 className="text-lg font-medium text-gray-900 dark:text-white">Quick Replies</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Manage canned responses for support tickets.
                    </p>
                </div>

                <div className="p-6">
                    <form onSubmit={addQuickReply} className="flex gap-4 mb-8 items-end">
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Title
                            </label>
                            <input
                                type="text"
                                value={newReplyTitle}
                                onChange={(e) => setNewReplyTitle(e.target.value)}
                                placeholder="e.g. Greeting"
                                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                            />
                        </div>
                        <div className="flex-[2]">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Reply Content
                            </label>
                            <input
                                type="text"
                                value={newReplyContent}
                                onChange={(e) => setNewReplyContent(e.target.value)}
                                placeholder="e.g. Hello, how can I help you?"
                                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={addingReply || !newReplyTitle || !newReplyContent}
                            className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                        >
                            <Plus className="h-5 w-5 mr-1" />
                            Add
                        </button>
                    </form>

                    <div className="border rounded-md border-gray-200 dark:border-gray-800 overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                            <thead className="bg-gray-50 dark:bg-gray-900/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reply</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                                {quickReplies.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">No quick replies yet.</td>
                                    </tr>
                                ) : (
                                    quickReplies.map((reply) => (
                                        <tr key={reply.id}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                                {reply.title}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-md truncate">
                                                {reply.reply}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <button
                                                    onClick={() => deleteQuickReply(reply.id)}
                                                    className="text-red-600 hover:text-red-900 dark:hover:text-red-400 transition-colors"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Game Projects Section */}
            <div className="bg-white dark:bg-gray-900 shadow rounded-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                    <h2 className="text-lg font-medium text-gray-900 dark:text-white">Game Projects</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Map Project IDs to human-readable Game Names.
                    </p>
                </div>

                <div className="p-6">
                    {/* Add New Form */}
                    <form onSubmit={addProject} className="flex gap-4 mb-8 items-end">
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Project ID
                            </label>
                            <input
                                type="text"
                                value={newProjectId}
                                onChange={(e) => setNewProjectId(e.target.value)}
                                placeholder="e.g. com.narcade.zen"
                                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Game Name
                            </label>
                            <input
                                type="text"
                                value={newGameName}
                                onChange={(e) => setNewGameName(e.target.value)}
                                placeholder="e.g. Zen Master"
                                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={adding || !newProjectId || !newGameName}
                            className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                        >
                            <Plus className="h-5 w-5 mr-1" />
                            Add
                        </button>
                    </form>

                    {error && (
                        <div className="mb-4 p-3 rounded-md bg-red-50 text-red-700 text-sm">
                            {error}
                        </div>
                    )}

                    {/* List */}
                    <div className="border rounded-md border-gray-200 dark:border-gray-800 overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                            <thead className="bg-gray-50 dark:bg-gray-900/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Game Name</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                                {loading ? (
                                    <tr>
                                        <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">Loading...</td>
                                    </tr>
                                ) : projects.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">No projects mapped yet.</td>
                                    </tr>
                                ) : (
                                    projects.map((project) => (
                                        <tr key={project.id}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                                {project.project_id}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                {project.game_name}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <button
                                                    onClick={() => deleteProject(project.id)}
                                                    className="text-red-600 hover:text-red-900 dark:hover:text-red-400 transition-colors"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}
