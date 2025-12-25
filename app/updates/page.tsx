'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, GripVertical, Trash2, Bug, Sparkles, ChevronDown, ChevronUp, CheckCircle2, Pencil, Check, X, Package, RotateCcw } from 'lucide-react'

interface TodoItem {
    id: string
    title: string
    type: 'new' | 'bug'
    done: boolean
}

interface VersionBlock {
    id: string
    title: string
    todos: TodoItem[]
    done: boolean
    collapsed: boolean
}

const STORAGE_KEY_VERSIONS = 'update-list-data'
const STORAGE_KEY_BACKLOG = 'update-list-backlog'

export default function UpdatesPage() {
    const [versions, setVersions] = useState<VersionBlock[]>([])
    const [backlog, setBacklog] = useState<TodoItem[]>([])
    const [newVersionTitle, setNewVersionTitle] = useState('')
    const [isLoaded, setIsLoaded] = useState(false)

    // Drag state
    const [draggedItem, setDraggedItem] = useState<{ type: 'version' | 'todo'; id: string; sourceVersionId?: string; todo?: TodoItem } | null>(null)
    const [dragOverTarget, setDragOverTarget] = useState<string | null>(null)

    // Load from localStorage
    useEffect(() => {
        const savedVersions = localStorage.getItem(STORAGE_KEY_VERSIONS)
        const savedBacklog = localStorage.getItem(STORAGE_KEY_BACKLOG)
        if (savedVersions) setVersions(JSON.parse(savedVersions))
        if (savedBacklog) setBacklog(JSON.parse(savedBacklog))
        setIsLoaded(true)
    }, [])

    // Save to localStorage
    useEffect(() => {
        if (!isLoaded) return
        localStorage.setItem(STORAGE_KEY_VERSIONS, JSON.stringify(versions))
    }, [versions, isLoaded])

    useEffect(() => {
        if (!isLoaded) return
        localStorage.setItem(STORAGE_KEY_BACKLOG, JSON.stringify(backlog))
    }, [backlog, isLoaded])

    // Generate unique ID
    const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Add version
    const addVersion = () => {
        if (!newVersionTitle.trim()) return
        const newVersion: VersionBlock = {
            id: generateId(),
            title: newVersionTitle.trim(),
            todos: [],
            done: false,
            collapsed: false,
        }
        setVersions([newVersion, ...versions])
        setNewVersionTitle('')
    }

    // Delete version
    const deleteVersion = (id: string) => {
        setVersions(versions.filter(v => v.id !== id))
    }

    // Toggle version collapsed
    const toggleVersionCollapsed = (id: string) => {
        setVersions(versions.map(v => v.id === id ? { ...v, collapsed: !v.collapsed } : v))
    }

    // Update version title
    const updateVersionTitle = (id: string, title: string) => {
        setVersions(versions.map(v => v.id === id ? { ...v, title } : v))
    }

    // Mark version as done
    const markVersionDone = (id: string) => {
        setVersions(versions.map(v => v.id === id ? { ...v, done: true, todos: v.todos.map(t => ({ ...t, done: true })) } : v))
    }

    // Mark version as undone
    const markVersionUndone = (id: string) => {
        setVersions(versions.map(v => v.id === id ? { ...v, done: false } : v))
    }

    // Add todo to version
    const addTodoToVersion = (versionId: string, type: 'new' | 'bug', title: string) => {
        if (!title.trim()) return
        const newTodo: TodoItem = { id: generateId(), title: title.trim(), type, done: false }
        setVersions(versions.map(v => v.id === versionId ? { ...v, todos: [...v.todos, newTodo] } : v))
    }

    // Delete todo
    const deleteTodo = (versionId: string | null, todoId: string) => {
        if (versionId) {
            setVersions(versions.map(v => v.id === versionId ? { ...v, todos: v.todos.filter(t => t.id !== todoId) } : v))
        } else {
            setBacklog(backlog.filter(t => t.id !== todoId))
        }
    }

    // Toggle todo done
    const toggleTodoDone = (versionId: string | null, todoId: string) => {
        if (versionId) {
            setVersions(versions.map(v => {
                if (v.id !== versionId) return v
                const updatedTodos = v.todos.map(t => t.id === todoId ? { ...t, done: !t.done } : t)
                // Removed auto-done logic: done status is now manual only
                return { ...v, todos: updatedTodos }
            }))
        } else {
            setBacklog(backlog.map(t => t.id === todoId ? { ...t, done: !t.done } : t))
        }
    }

    // Update todo title
    const updateTodoTitle = (versionId: string | null, todoId: string, title: string) => {
        if (versionId) {
            setVersions(versions.map(v => v.id === versionId ? { ...v, todos: v.todos.map(t => t.id === todoId ? { ...t, title } : t) } : v))
        } else {
            setBacklog(backlog.map(t => t.id === todoId ? { ...t, title } : t))
        }
    }

    // Add to backlog
    const addToBacklog = (type: 'new' | 'bug', title: string) => {
        if (!title.trim()) return
        const newTodo: TodoItem = { id: generateId(), title: title.trim(), type, done: false }
        setBacklog([...backlog, newTodo])
    }

    // Move version up/down
    const moveVersion = (id: string, direction: 'up' | 'down') => {
        const idx = versions.findIndex(v => v.id === id)
        if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === versions.length - 1)) return
        const newVersions = [...versions]
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1
            ;[newVersions[idx], newVersions[swapIdx]] = [newVersions[swapIdx], newVersions[idx]]
        setVersions(newVersions)
    }

    // Drag handlers
    const handleDragStart = (type: 'version' | 'todo', id: string, sourceVersionId?: string) => {
        // Find todo item immediately on drag start
        let todo: TodoItem | undefined
        if (sourceVersionId) {
            const sourceVersion = versions.find(v => v.id === sourceVersionId)
            todo = sourceVersion?.todos.find(t => t.id === id)
        } else {
            todo = backlog.find(t => t.id === id)
        }
        setDraggedItem({ type, id, sourceVersionId, todo })
    }

    const handleDragEnd = () => {
        setDraggedItem(null)
        setDragOverTarget(null)
    }

    const handleDragOver = (e: React.DragEvent, targetId?: string) => {
        e.preventDefault()
        if (targetId) setDragOverTarget(targetId)
    }

    const handleDragLeave = () => {
        setDragOverTarget(null)
    }

    const handleDropOnVersion = (targetVersionId: string) => {
        if (!draggedItem || draggedItem.type !== 'todo' || !draggedItem.todo) {
            setDragOverTarget(null)
            return
        }

        const todo = { ...draggedItem.todo }
        const sourceVersionId = draggedItem.sourceVersionId

        // Don't drop on same version
        if (sourceVersionId === targetVersionId) {
            setDragOverTarget(null)
            setDraggedItem(null)
            return
        }

        // Remove from source
        if (sourceVersionId) {
            setVersions(prev => prev.map(v =>
                v.id === sourceVersionId
                    ? { ...v, todos: v.todos.filter(t => t.id !== draggedItem.id) }
                    : v
            ))
        } else {
            // From backlog
            setBacklog(prev => prev.filter(t => t.id !== draggedItem.id))
        }

        // Add to target version after a tick
        setTimeout(() => {
            setVersions(prev => prev.map(v =>
                v.id === targetVersionId
                    ? { ...v, todos: [...v.todos, todo] }
                    : v
            ))
        }, 10)

        setDraggedItem(null)
        setDragOverTarget(null)
    }

    const handleDropOnBacklog = () => {
        if (!draggedItem || draggedItem.type !== 'todo' || !draggedItem.sourceVersionId || !draggedItem.todo) {
            setDragOverTarget(null)
            return
        }

        const todo = { ...draggedItem.todo }
        const sourceVersionId = draggedItem.sourceVersionId

        // Remove from version
        setVersions(prev => prev.map(v =>
            v.id === sourceVersionId
                ? { ...v, todos: v.todos.filter(t => t.id !== draggedItem.id) }
                : v
        ))

        // Add to backlog after a tick
        setTimeout(() => {
            setBacklog(prev => [...prev, todo])
        }, 10)

        setDraggedItem(null)
        setDragOverTarget(null)
    }

    const activeVersions = versions.filter(v => !v.done)
    const doneVersions = versions.filter(v => v.done)

    if (!isLoaded) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Update List</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Track version updates and feature todo lists</p>
                </div>

                {/* Add Version */}
                <div className="flex gap-3 mb-8">
                    <input
                        type="text"
                        value={newVersionTitle}
                        onChange={(e) => setNewVersionTitle(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addVersion()}
                        placeholder="New version number (e.g. v1.2.0)"
                        className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                    />
                    <button
                        onClick={addVersion}
                        className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Add Version
                    </button>
                </div>

                {/* Main Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Active Versions */}
                    <div className="lg:col-span-2 space-y-4">
                        {activeVersions.length === 0 ? (
                            <div className="text-center py-12 text-gray-400">
                                <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                <p>No active versions. Add one above!</p>
                            </div>
                        ) : (
                            activeVersions.map((version) => (
                                <VersionCard
                                    key={version.id}
                                    version={version}
                                    isDragOver={dragOverTarget === version.id}
                                    onDelete={() => deleteVersion(version.id)}
                                    onToggleCollapsed={() => toggleVersionCollapsed(version.id)}
                                    onUpdateTitle={(title) => updateVersionTitle(version.id, title)}
                                    onMarkDone={() => markVersionDone(version.id)}
                                    onAddTodo={(type, title) => addTodoToVersion(version.id, type, title)}
                                    onDeleteTodo={(todoId) => deleteTodo(version.id, todoId)}
                                    onToggleTodo={(todoId) => toggleTodoDone(version.id, todoId)}
                                    onUpdateTodoTitle={(todoId, title) => updateTodoTitle(version.id, todoId, title)}
                                    onMoveUp={() => moveVersion(version.id, 'up')}
                                    onMoveDown={() => moveVersion(version.id, 'down')}
                                    onDragStart={(todoId) => handleDragStart('todo', todoId, version.id)}
                                    onDragEnd={handleDragEnd}
                                    onDragOver={(e) => handleDragOver(e, version.id)}
                                    onDragLeave={handleDragLeave}
                                    onDrop={() => handleDropOnVersion(version.id)}
                                />
                            ))
                        )}
                    </div>

                    {/* Right Column */}
                    <div className="space-y-6">
                        {/* Backlog */}
                        <BacklogSection
                            backlog={backlog}
                            isDragOver={dragOverTarget === 'backlog'}
                            onAddTodo={addToBacklog}
                            onDeleteTodo={(todoId) => deleteTodo(null, todoId)}
                            onToggleTodo={(todoId) => toggleTodoDone(null, todoId)}
                            onUpdateTodoTitle={(todoId, title) => updateTodoTitle(null, todoId, title)}
                            onDragStart={(todoId) => handleDragStart('todo', todoId)}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => handleDragOver(e, 'backlog')}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDropOnBacklog}
                        />

                        {/* Done Section */}
                        <DoneSection
                            doneVersions={doneVersions}
                            onDeleteVersion={deleteVersion}
                            onMarkUndone={markVersionUndone}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}

// Version Card Component
function VersionCard({
    version,
    isDragOver,
    onDelete,
    onToggleCollapsed,
    onUpdateTitle,
    onMarkDone,
    onAddTodo,
    onDeleteTodo,
    onToggleTodo,
    onUpdateTodoTitle,
    onMoveUp,
    onMoveDown,
    onDragStart,
    onDragEnd,
    onDragOver,
    onDragLeave,
    onDrop,
}: {
    version: VersionBlock
    isDragOver: boolean
    onDelete: () => void
    onToggleCollapsed: () => void
    onUpdateTitle: (title: string) => void
    onMarkDone: () => void
    onAddTodo: (type: 'new' | 'bug', title: string) => void
    onDeleteTodo: (todoId: string) => void
    onToggleTodo: (todoId: string) => void
    onUpdateTodoTitle: (todoId: string, title: string) => void
    onMoveUp: () => void
    onMoveDown: () => void
    onDragStart: (todoId: string) => void
    onDragEnd: () => void
    onDragOver: (e: React.DragEvent) => void
    onDragLeave: () => void
    onDrop: () => void
}) {
    const [isEditingTitle, setIsEditingTitle] = useState(false)
    const [editTitle, setEditTitle] = useState(version.title)
    const [newTodoTitle, setNewTodoTitle] = useState('')

    const handleSaveTitle = () => {
        if (editTitle.trim()) {
            onUpdateTitle(editTitle.trim())
        }
        setIsEditingTitle(false)
    }

    return (
        <div
            className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border overflow-hidden transition-all ${isDragOver
                ? 'border-emerald-500 ring-2 ring-emerald-500/30'
                : 'border-gray-100 dark:border-gray-700'
                }`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                <GripVertical className="w-4 h-4 text-gray-300 cursor-grab" />

                <button
                    onClick={onMarkDone}
                    className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600 hover:border-emerald-500 transition-colors flex items-center justify-center"
                >
                </button>

                {isEditingTitle ? (
                    <div className="flex-1 flex items-center gap-2">
                        <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
                            autoFocus
                            className="flex-1 px-2 py-1 text-lg font-semibold bg-transparent border-b-2 border-emerald-500 outline-none text-gray-900 dark:text-white"
                        />
                        <button onClick={handleSaveTitle} className="p-1 text-emerald-500 hover:text-emerald-600">
                            <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => setIsEditingTitle(false)} className="p-1 text-gray-400 hover:text-gray-500">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ) : (
                    <span className="flex-1 text-lg font-semibold text-gray-900 dark:text-white">{version.title}</span>
                )}

                <button onClick={() => { setEditTitle(version.title); setIsEditingTitle(true) }} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                    <Pencil className="w-4 h-4" />
                </button>
                <button onClick={onMoveUp} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                    <ChevronUp className="w-4 h-4" />
                </button>
                <button onClick={onMoveDown} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                    <ChevronDown className="w-4 h-4" />
                </button>
                <button onClick={onDelete} className="p-1.5 text-red-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>

            {/* Add Todo */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                <input
                    type="text"
                    value={newTodoTitle}
                    onChange={(e) => setNewTodoTitle(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && newTodoTitle.trim()) {
                            onAddTodo('new', newTodoTitle)
                            setNewTodoTitle('')
                        }
                    }}
                    placeholder="New todo item... (Enter to add)"
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                    onClick={() => { onAddTodo('new', newTodoTitle); setNewTodoTitle('') }}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                >
                    <Sparkles className="w-3.5 h-3.5" />
                    New
                </button>
                <button
                    onClick={() => { onAddTodo('bug', newTodoTitle); setNewTodoTitle('') }}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                    <Bug className="w-3.5 h-3.5" />
                    Bug
                </button>
            </div>

            {/* Todos */}
            {!version.collapsed && version.todos.length > 0 && (
                <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
                    {version.todos.map((todo) => (
                        <TodoRow
                            key={todo.id}
                            todo={todo}
                            onToggle={() => onToggleTodo(todo.id)}
                            onDelete={() => onDeleteTodo(todo.id)}
                            onUpdateTitle={(title) => onUpdateTodoTitle(todo.id, title)}
                            onDragStart={() => onDragStart(todo.id)}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

// Todo Row Component
function TodoRow({
    todo,
    onToggle,
    onDelete,
    onUpdateTitle,
    onDragStart,
}: {
    todo: TodoItem
    onToggle: () => void
    onDelete: () => void
    onUpdateTitle: (title: string) => void
    onDragStart: () => void
}) {
    const [isEditing, setIsEditing] = useState(false)
    const [editTitle, setEditTitle] = useState(todo.title)

    const handleSave = () => {
        if (editTitle.trim()) {
            onUpdateTitle(editTitle.trim())
        }
        setIsEditing(false)
    }

    return (
        <div
            draggable
            onDragStart={onDragStart}
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group"
        >
            <GripVertical className="w-3.5 h-3.5 text-gray-300 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity" />

            <button
                onClick={onToggle}
                className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${todo.done ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
            >
                {todo.done && <Check className="w-3 h-3 text-white" />}
            </button>

            <span className={`px-2 py-0.5 rounded text-xs font-medium ${todo.type === 'new'
                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                }`}>
                {todo.type === 'new' ? <Sparkles className="w-3 h-3 inline mr-1" /> : <Bug className="w-3 h-3 inline mr-1" />}
                {todo.type}
            </span>

            {isEditing ? (
                <div className="flex-1 flex items-center gap-2">
                    <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                        autoFocus
                        className="flex-1 px-2 py-1 text-sm bg-transparent border-b border-emerald-500 outline-none text-gray-900 dark:text-white"
                    />
                    <button onClick={handleSave} className="p-1 text-emerald-500"><Check className="w-3 h-3" /></button>
                    <button onClick={() => setIsEditing(false)} className="p-1 text-gray-400"><X className="w-3 h-3" /></button>
                </div>
            ) : (
                <span
                    className={`flex-1 text-sm ${todo.done ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}
                >
                    {todo.title}
                </span>
            )}

            <button
                onClick={() => { setEditTitle(todo.title); setIsEditing(true) }}
                className="p-1 text-gray-300 hover:text-emerald-500 opacity-0 group-hover:opacity-100 transition-all"
            >
                <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={onDelete} className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                <Trash2 className="w-3.5 h-3.5" />
            </button>
        </div>
    )
}

// Backlog Section Component
function BacklogSection({
    backlog,
    isDragOver,
    onAddTodo,
    onDeleteTodo,
    onToggleTodo,
    onUpdateTodoTitle,
    onDragStart,
    onDragEnd,
    onDragOver,
    onDragLeave,
    onDrop,
}: {
    backlog: TodoItem[]
    isDragOver: boolean
    onAddTodo: (type: 'new' | 'bug', title: string) => void
    onDeleteTodo: (todoId: string) => void
    onToggleTodo: (todoId: string) => void
    onUpdateTodoTitle: (todoId: string, title: string) => void
    onDragStart: (todoId: string) => void
    onDragEnd: () => void
    onDragOver: (e: React.DragEvent) => void
    onDragLeave: () => void
    onDrop: () => void
}) {
    const [newTitle, setNewTitle] = useState('')

    return (
        <div
            className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border overflow-hidden transition-all ${isDragOver
                ? 'border-emerald-500 ring-2 ring-emerald-500/30'
                : 'border-gray-100 dark:border-gray-700'
                }`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                <span className="text-lg">📦</span>
                <span className="font-semibold text-gray-900 dark:text-white">Backlog</span>
                <span className="text-sm text-gray-400">({backlog.length})</span>
            </div>

            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && newTitle.trim()) {
                            onAddTodo('new', newTitle)
                            setNewTitle('')
                        }
                    }}
                    placeholder="Add to backlog... (Enter to add)"
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm outline-none"
                />
                <button
                    onClick={() => { onAddTodo('new', newTitle); setNewTitle('') }}
                    className="p-2 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg"
                >
                    <Sparkles className="w-4 h-4" />
                </button>
                <button
                    onClick={() => { onAddTodo('bug', newTitle); setNewTitle('') }}
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                >
                    <Bug className="w-4 h-4" />
                </button>
            </div>

            {backlog.length > 0 && (
                <div className="divide-y divide-gray-50 dark:divide-gray-700/50 max-h-64 overflow-y-auto">
                    {backlog.map((todo) => (
                        <TodoRow
                            key={todo.id}
                            todo={todo}
                            onToggle={() => onToggleTodo(todo.id)}
                            onDelete={() => onDeleteTodo(todo.id)}
                            onUpdateTitle={(title) => onUpdateTodoTitle(todo.id, title)}
                            onDragStart={() => onDragStart(todo.id)}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

// Done Section Component
function DoneSection({
    doneVersions,
    onDeleteVersion,
    onMarkUndone,
}: {
    doneVersions: VersionBlock[]
    onDeleteVersion: (id: string) => void
    onMarkUndone: (id: string) => void
}) {
    const [isExpanded, setIsExpanded] = useState(true)
    const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set())

    const toggleVersion = (id: string) => {
        const newSet = new Set(expandedVersions)
        if (newSet.has(id)) {
            newSet.delete(id)
        } else {
            newSet.add(id)
        }
        setExpandedVersions(newSet)
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-2 w-full px-4 py-3 border-b border-gray-100 dark:border-gray-700 text-left"
            >
                <CheckCircle2 className="w-4 h-4 text-gray-400" />
                <span className="font-semibold text-gray-900 dark:text-white">Done</span>
                <span className="text-sm text-gray-400">({doneVersions.length})</span>
                <div className="flex-1" />
                {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>

            {isExpanded && doneVersions.length > 0 && (
                <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
                    {doneVersions.map((version) => (
                        <div key={version.id}>
                            <div
                                className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                                onClick={() => toggleVersion(version.id)}
                            >
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300">{version.title}</span>
                                <span className="text-xs text-gray-400">{version.todos.length} todos</span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onMarkUndone(version.id) }}
                                    className="p-1 text-gray-300 hover:text-emerald-500 mr-1"
                                    title="Move back to active"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDeleteVersion(version.id) }}
                                    className="p-1 text-gray-300 hover:text-red-500"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                            {expandedVersions.has(version.id) && (
                                <div className="bg-gray-50 dark:bg-gray-900/50 pl-10 pr-4 py-2">
                                    {version.todos.map((todo) => (
                                        <div key={todo.id} className="flex items-center gap-2 py-1 text-sm text-gray-500">
                                            {todo.type === 'new' ? <Sparkles className="w-3 h-3 text-emerald-400" /> : <Bug className="w-3 h-3 text-red-400" />}
                                            <span className="line-through">{todo.title}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
