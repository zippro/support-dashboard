'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { Trash2, Plus, Gamepad2, Tag, Settings, MessageSquare, Pencil, X, Check, Lock } from 'lucide-react'

interface Project {
    id: string
    project_id: string
    game_name: string
    created_at: string
}

interface TagDefinition {
    id: string
    name: string
    keywords: string[]
}

interface ImportanceSettings {
    id: string
    important_words: string[]
    not_important_threshold: number
}

type TabType = 'games' | 'tags' | 'replies' | 'ai'

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState<TabType>('games')
    const { isAuthenticated } = useAuth()

    const [quickReplies, setQuickReplies] = useState<{ id: string, title: string, reply: string }[]>([])
    const [newReplyTitle, setNewReplyTitle] = useState('')
    const [newReplyContent, setNewReplyContent] = useState('')
    const [addingReply, setAddingReply] = useState(false)
    const [editingReply, setEditingReply] = useState<string | null>(null)
    const [editReplyTitle, setEditReplyTitle] = useState('')
    const [editReplyContent, setEditReplyContent] = useState('')

    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const [newProjectId, setNewProjectId] = useState('')
    const [newGameName, setNewGameName] = useState('')
    const [adding, setAdding] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [editingProject, setEditingProject] = useState<string | null>(null)
    const [editGameName, setEditGameName] = useState('')

    const [tags, setTags] = useState<TagDefinition[]>([])
    const [newTagName, setNewTagName] = useState('')
    const [newTagKeywords, setNewTagKeywords] = useState('')
    const [addingTag, setAddingTag] = useState(false)
    const [editingTag, setEditingTag] = useState<string | null>(null)
    const [editTagName, setEditTagName] = useState('')
    const [editTagKeywords, setEditTagKeywords] = useState('')

    const [importanceSettings, setImportanceSettings] = useState<ImportanceSettings | null>(null)
    const [importantWords, setImportantWords] = useState('')
    const [threshold, setThreshold] = useState(10)
    const [savingImportance, setSavingImportance] = useState(false)

    useEffect(() => {
        fetchProjects()
        fetchQuickReplies()
        fetchTags()
        fetchImportanceSettings()
    }, [])

    async function fetchTags() {
        try {
            const { data, error } = await supabase.from('tag_definitions').select('*').order('created_at', { ascending: false })
            if (error) throw error
            setTags(data || [])
        } catch (err) {
            console.error('Error fetching tags:', err)
        }
    }

    async function fetchImportanceSettings() {
        try {
            const { data, error } = await supabase.from('importance_settings').select('*').single()
            if (error && error.code !== 'PGRST116') throw error
            if (data) {
                setImportanceSettings(data)
                setImportantWords(data.important_words.join(', '))
                setThreshold(data.not_important_threshold)
            }
        } catch (err) {
            console.error('Error fetching importance settings:', err)
        }
    }

    async function addTag(e: React.FormEvent) {
        e.preventDefault()
        if (!newTagName.trim()) return
        try {
            setAddingTag(true)
            const keywordsArray = newTagKeywords.split(',').map(k => k.trim()).filter(k => k)
            const { data, error } = await supabase.from('tag_definitions').insert({ name: newTagName.trim(), keywords: keywordsArray }).select().single()
            if (error) throw error
            setTags([data, ...tags])
            setNewTagName('')
            setNewTagKeywords('')
        } catch (err: any) {
            alert('Error adding tag: ' + err.message)
        } finally {
            setAddingTag(false)
        }
    }

    async function updateTag(id: string) {
        try {
            const keywordsArray = editTagKeywords.split(',').map(k => k.trim()).filter(k => k)
            const { error } = await supabase.from('tag_definitions').update({ name: editTagName.trim(), keywords: keywordsArray }).eq('id', id)
            if (error) throw error
            setTags(tags.map(t => t.id === id ? { ...t, name: editTagName.trim(), keywords: keywordsArray } : t))
            setEditingTag(null)
        } catch (err: any) {
            alert('Error updating tag: ' + err.message)
        }
    }

    async function deleteTag(id: string) {
        if (!confirm('Delete this tag?')) return
        try {
            const { error } = await supabase.from('tag_definitions').delete().eq('id', id)
            if (error) throw error
            setTags(tags.filter(t => t.id !== id))
        } catch (err: any) {
            alert('Error deleting tag: ' + err.message)
        }
    }

    async function saveImportanceSettings(e: React.FormEvent) {
        e.preventDefault()
        try {
            setSavingImportance(true)
            const wordsArray = importantWords.split(',').map(w => w.trim()).filter(w => w)
            const payload = { important_words: wordsArray, not_important_threshold: threshold }
            let result
            if (importanceSettings?.id) {
                result = await supabase.from('importance_settings').update(payload).eq('id', importanceSettings.id).select().single()
            } else {
                result = await supabase.from('importance_settings').insert(payload).select().single()
            }
            if (result.error) throw result.error
            setImportanceSettings(result.data)
            alert('Importance settings saved!')
        } catch (err: any) {
            alert('Error saving importance settings: ' + err.message)
        } finally {
            setSavingImportance(false)
        }
    }

    async function fetchQuickReplies() {
        try {
            const { data, error } = await supabase.from('quick_replies').select('*').order('created_at', { ascending: false })
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
            const { data, error } = await supabase.from('quick_replies').insert({ title: newReplyTitle.trim(), reply: newReplyContent.trim() }).select().single()
            if (error) throw error
            setQuickReplies([data, ...quickReplies])
            setNewReplyTitle('')
            setNewReplyContent('')
        } catch (err: any) {
            alert('Failed to add reply: ' + err.message)
        } finally {
            setAddingReply(false)
        }
    }

    async function updateQuickReply(id: string) {
        try {
            const { error } = await supabase.from('quick_replies').update({ title: editReplyTitle.trim(), reply: editReplyContent.trim() }).eq('id', id)
            if (error) throw error
            setQuickReplies(quickReplies.map(r => r.id === id ? { ...r, title: editReplyTitle.trim(), reply: editReplyContent.trim() } : r))
            setEditingReply(null)
        } catch (err: any) {
            alert('Failed to update reply: ' + err.message)
        }
    }

    async function deleteQuickReply(id: string) {
        if (!confirm('Delete this reply?')) return
        try {
            const { error } = await supabase.from('quick_replies').delete().eq('id', id)
            if (error) throw error
            setQuickReplies(quickReplies.filter(r => r.id !== id))
        } catch (err: any) {
            alert('Failed to delete reply: ' + err.message)
        }
    }

    async function fetchProjects() {
        try {
            setLoading(true)
            const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
            if (error) throw error
            setProjects(data || [])
        } catch (err: any) {
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
            const { data, error } = await supabase.from('projects').insert({ project_id: newProjectId.trim(), game_name: newGameName.trim() }).select().single()
            if (error) throw error
            setProjects([data, ...projects])
            setNewProjectId('')
            setNewGameName('')
        } catch (err: any) {
            setError(err.message)
        } finally {
            setAdding(false)
        }
    }

    async function updateProject(id: string) {
        try {
            const { error } = await supabase.from('projects').update({ game_name: editGameName.trim() }).eq('id', id)
            if (error) throw error
            setProjects(projects.map(p => p.id === id ? { ...p, game_name: editGameName.trim() } : p))
            setEditingProject(null)
        } catch (err: any) {
            alert('Failed to update: ' + err.message)
        }
    }

    async function deleteProject(id: string) {
        if (!confirm('Delete this mapping?')) return
        try {
            const { error } = await supabase.from('projects').delete().eq('id', id)
            if (error) throw error
            setProjects(projects.filter(p => p.id !== id))
        } catch (err: any) {
            alert('Failed to delete: ' + err.message)
        }
    }

    const tabs = [
        { id: 'games' as TabType, label: 'Games', icon: Gamepad2, count: projects.length },
        { id: 'tags' as TabType, label: 'Tags', icon: Tag, count: tags.length },
        { id: 'replies' as TabType, label: 'Quick Replies', icon: MessageSquare, count: quickReplies.length },
        { id: 'ai' as TabType, label: 'AI Settings', icon: Settings, count: null },
    ]

    return (
        <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-950">
            <div className="max-w-5xl mx-auto p-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your support system configuration</p>
                    {!isAuthenticated && (
                        <div className="mt-4 flex items-center gap-2 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-600 dark:text-yellow-400">
                            <Lock className="w-5 h-5" />
                            <span className="text-sm font-medium">Sign in to add or edit settings</span>
                        </div>
                    )}
                </div>

                {/* Tab Navigation */}
                <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-800 pb-4">
                    {tabs.map((tab) => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25' : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800'}`}>
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                            {tab.count !== null && <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === tab.id ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-800'}`}>{tab.count}</span>}
                        </button>
                    ))}
                </div>

                {/* Games Tab */}
                {activeTab === 'games' && (
                    <div className="bg-white dark:bg-gray-900 shadow-sm rounded-xl border border-gray-200 dark:border-gray-800">
                        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Game Projects</h2>
                            <p className="text-sm text-gray-500 mt-1">Map Unity Project IDs to readable game names</p>
                        </div>
                        <div className="p-6">
                            {isAuthenticated && (
                                <form onSubmit={addProject} className="flex gap-4 mb-6">
                                    <input type="text" value={newProjectId} onChange={(e) => setNewProjectId(e.target.value)} placeholder="Project ID (e.g. b7ac7b87-62fc-...)" className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                                    <input type="text" value={newGameName} onChange={(e) => setNewGameName(e.target.value)} placeholder="Game Name" className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                                    <button type="submit" disabled={adding || !newProjectId || !newGameName} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"><Plus className="w-4 h-4" /> Add</button>
                                </form>
                            )}
                            {error && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}
                            <div className="space-y-2">
                                {loading ? <div className="text-center py-8 text-gray-500">Loading...</div> : projects.length === 0 ? <div className="text-center py-8 text-gray-500">No games mapped yet</div> : projects.map((project) => (
                                    <div key={project.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                                        {editingProject === project.id ? (
                                            <div className="flex items-center gap-3 flex-1">
                                                <input type="text" value={editGameName} onChange={(e) => setEditGameName(e.target.value)} className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                                                <button onClick={() => updateProject(project.id)} className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg"><Check className="w-4 h-4" /></button>
                                                <button onClick={() => setEditingProject(null)} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><X className="w-4 h-4" /></button>
                                            </div>
                                        ) : (
                                            <>
                                                <div>
                                                    <p className="font-medium text-gray-900 dark:text-white">{project.game_name}</p>
                                                    <p className="text-xs text-gray-500 font-mono">{project.project_id}</p>
                                                </div>
                                                {isAuthenticated && (
                                                    <div className="flex items-center gap-1">
                                                        <button onClick={() => { setEditingProject(project.id); setEditGameName(project.game_name) }} className="p-2 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"><Pencil className="w-4 h-4" /></button>
                                                        <button onClick={() => deleteProject(project.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Tags Tab */}
                {activeTab === 'tags' && (
                    <div className="bg-white dark:bg-gray-900 shadow-sm rounded-xl border border-gray-200 dark:border-gray-800">
                        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Auto-Tags</h2>
                            <p className="text-sm text-gray-500 mt-1">Tickets containing keywords will be auto-tagged (checks translated message)</p>
                        </div>
                        <div className="p-6">
                            {isAuthenticated && (
                                <form onSubmit={addTag} className="flex gap-4 mb-6">
                                    <input type="text" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} placeholder="Tag name (e.g. Billing)" className="w-48 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                                    <input type="text" value={newTagKeywords} onChange={(e) => setNewTagKeywords(e.target.value)} placeholder="Keywords (comma separated)" className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                                    <button type="submit" disabled={addingTag || !newTagName} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"><Plus className="w-4 h-4" /> Add</button>
                                </form>
                            )}
                            <div className="space-y-2">
                                {tags.length === 0 ? <div className="text-center py-8 text-gray-500">No tags defined</div> : tags.map((tag) => (
                                    <div key={tag.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                                        {editingTag === tag.id ? (
                                            <div className="flex items-center gap-3 flex-1">
                                                <input type="text" value={editTagName} onChange={(e) => setEditTagName(e.target.value)} placeholder="Tag name" className="w-32 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                                                <input type="text" value={editTagKeywords} onChange={(e) => setEditTagKeywords(e.target.value)} placeholder="Keywords" className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                                                <button onClick={() => updateTag(tag.id)} className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg"><Check className="w-4 h-4" /></button>
                                                <button onClick={() => setEditingTag(null)} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><X className="w-4 h-4" /></button>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex items-center gap-3">
                                                    <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-sm font-medium">{tag.name}</span>
                                                    <span className="text-sm text-gray-500">{tag.keywords.join(', ')}</span>
                                                </div>
                                                {isAuthenticated && (
                                                    <div className="flex items-center gap-1">
                                                        <button onClick={() => { setEditingTag(tag.id); setEditTagName(tag.name); setEditTagKeywords(tag.keywords.join(', ')) }} className="p-2 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"><Pencil className="w-4 h-4" /></button>
                                                        <button onClick={() => deleteTag(tag.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Quick Replies Tab */}
                {activeTab === 'replies' && (
                    <div className="bg-white dark:bg-gray-900 shadow-sm rounded-xl border border-gray-200 dark:border-gray-800">
                        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Quick Replies</h2>
                            <p className="text-sm text-gray-500 mt-1">Canned responses for faster support</p>
                        </div>
                        <div className="p-6">
                            {isAuthenticated && (
                                <form onSubmit={addQuickReply} className="flex gap-4 mb-6">
                                    <input type="text" value={newReplyTitle} onChange={(e) => setNewReplyTitle(e.target.value)} placeholder="Title" className="w-48 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                                    <input type="text" value={newReplyContent} onChange={(e) => setNewReplyContent(e.target.value)} placeholder="Reply content" className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                                    <button type="submit" disabled={addingReply || !newReplyTitle || !newReplyContent} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"><Plus className="w-4 h-4" /> Add</button>
                                </form>
                            )}
                            <div className="space-y-2">
                                {quickReplies.length === 0 ? <div className="text-center py-8 text-gray-500">No quick replies yet</div> : quickReplies.map((reply) => (
                                    <div key={reply.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                                        {editingReply === reply.id ? (
                                            <div className="flex flex-col gap-2 flex-1 mr-4">
                                                <input type="text" value={editReplyTitle} onChange={(e) => setEditReplyTitle(e.target.value)} placeholder="Title" className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                                                <textarea value={editReplyContent} onChange={(e) => setEditReplyContent(e.target.value)} placeholder="Reply content" rows={2} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                                                <div className="flex gap-2 mt-1">
                                                    <button onClick={() => updateQuickReply(reply.id)} className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">Save</button>
                                                    <button onClick={() => setEditingReply(null)} className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">Cancel</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div>
                                                    <p className="font-medium text-gray-900 dark:text-white">{reply.title}</p>
                                                    <p className="text-sm text-gray-500 truncate max-w-xl">{reply.reply}</p>
                                                </div>
                                                {isAuthenticated && (
                                                    <div className="flex items-center gap-1">
                                                        <button onClick={() => { setEditingReply(reply.id); setEditReplyTitle(reply.title); setEditReplyContent(reply.reply) }} className="p-2 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"><Pencil className="w-4 h-4" /></button>
                                                        <button onClick={() => deleteQuickReply(reply.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* AI Settings Tab */}
                {activeTab === 'ai' && (
                    <div className="bg-white dark:bg-gray-900 shadow-sm rounded-xl border border-gray-200 dark:border-gray-800">
                        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">AI & Importance Rules</h2>
                            <p className="text-sm text-gray-500 mt-1">Configure automatic importance detection (checks original message)</p>
                        </div>
                        <div className="p-6">
                            <form onSubmit={saveImportanceSettings} className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Important Keywords</label>
                                    <p className="text-xs text-gray-500 mb-3">Tickets with these words → <span className="text-red-500 font-semibold">Important</span></p>
                                    <textarea value={importantWords} onChange={(e) => setImportantWords(e.target.value)} placeholder="urgent, error, crash, fail, broken, bug" rows={3} disabled={!isAuthenticated} className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white disabled:opacity-60 disabled:cursor-not-allowed" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Minimum Length Threshold</label>
                                    <p className="text-xs text-gray-500 mb-3">Tickets shorter than this → <span className="text-gray-500 font-semibold">Not Important</span></p>
                                    <input type="number" value={threshold} onChange={(e) => setThreshold(parseInt(e.target.value))} disabled={!isAuthenticated} className="w-32 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white disabled:opacity-60 disabled:cursor-not-allowed" />
                                    <span className="ml-2 text-sm text-gray-500">characters</span>
                                </div>
                                <button type="submit" disabled={savingImportance || !isAuthenticated} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors">{savingImportance ? 'Saving...' : 'Save Settings'}</button>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
