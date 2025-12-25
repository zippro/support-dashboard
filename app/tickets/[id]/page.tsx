'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { publicSupabase } from '@/lib/supabase-public'
import { useAuth } from '@/lib/auth'
import { useParams } from 'next/navigation'
import { Send, ChevronDown, MessageSquare, Languages, X, Paperclip, CheckCircle, Lock, Pencil, Check } from 'lucide-react'

export default function TicketDetail() {
    const { id } = useParams()
    const { isAuthenticated, user, profile } = useAuth()
    const [ticket, setTicket] = useState<any>(null)
    const [messages, setMessages] = useState<any[]>([])
    const [newMessage, setNewMessage] = useState('')
    const [loading, setLoading] = useState(true)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const [quickReplies, setQuickReplies] = useState<{ title: string, reply: string }[]>([])
    const [showQuickReplies, setShowQuickReplies] = useState(false)
    const [isTranslating, setIsTranslating] = useState(false)
    const [showCloseModal, setShowCloseModal] = useState(false)
    const [pendingMessage, setPendingMessage] = useState<{ original: string, translated: string | null, translate: boolean } | null>(null)
    const [attachment, setAttachment] = useState<File | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [isEditingEmail, setIsEditingEmail] = useState(false)
    const [editedEmail, setEditedEmail] = useState('')
    const [savingEmail, setSavingEmail] = useState(false)
    const [notes, setNotes] = useState('')
    const [isSavingNotes, setIsSavingNotes] = useState(false)



    useEffect(() => {
        async function fetchQuickReplies() {
            const { data } = await supabase
                .from('quick_replies')
                .select('title, reply')
                .order('created_at', { ascending: false })

            if (data) setQuickReplies(data)
        }
        if (isAuthenticated) {
            fetchQuickReplies()
        }
    }, [isAuthenticated])

    useEffect(() => {
        let isMounted = true

        // Safety timeout
        const loadingTimeout = setTimeout(() => {
            if (isMounted && loading) {
                console.warn('Ticket detail: Loading timeout')
                setLoading(false)
            }
        }, 15000)

        async function fetchTicketData() {
            if (!id) {
                setLoading(false)
                return
            }

            console.log('Ticket detail: Fetching ticket', id)

            try {
                // Fetch ticket details
                const { data: ticketData, error: ticketError } = await publicSupabase
                    .from('tickets')
                    .select('*, users(email)')
                    .eq('id', id)
                    .single()

                if (!isMounted) return
                console.log('Ticket detail: Ticket fetched', { hasData: !!ticketData, error: ticketError?.message })

                if (ticketError) {
                    console.error('Error fetching ticket:', ticketError)
                    setLoading(false)
                    return
                }

                // Fetch Game Name if project_id exists
                if (ticketData.project_id) {
                    const { data: projectData } = await publicSupabase
                        .from('projects')
                        .select('game_name')
                        .eq('project_id', ticketData.project_id)
                        .single()

                    if (projectData) {
                        ticketData.game_name = projectData.game_name
                    } else {
                        ticketData.game_name = ticketData.project_id
                    }
                }

                if (isMounted) {
                    setTicket(ticketData)
                    setNotes(ticketData.notes || '')
                }

                // Fetch messages
                const { data: messagesData, error: messagesError } = await publicSupabase
                    .from('messages')
                    .select('*')
                    .eq('ticket_id', id)
                    .order('created_at', { ascending: true })

                if (!isMounted) return
                console.log('Ticket detail: Messages fetched', { count: messagesData?.length })

                if (messagesError) console.error('Error fetching messages:', messagesError)
                else if (isMounted) setMessages(messagesData || [])

            } catch (err) {
                console.error('Ticket detail: Fetch error', err)
            } finally {
                if (isMounted) {
                    setLoading(false)
                    console.log('Ticket detail: Loading complete')
                }
            }
        }

        fetchTicketData()

        // Subscribe to new messages
        const channel = supabase
            .channel('messages')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `ticket_id=eq.${id}` }, (payload) => {
                setMessages((prev) => {
                    // Check if message with same ID already exists
                    if (prev.some(m => m.id === payload.new.id)) return prev

                    // Check if we have a temp message with same content (optimistic update)
                    // If so, replace it with real message
                    const tempMatchIndex = prev.findIndex(m =>
                        m.id.toString().startsWith('temp-') &&
                        m.content === payload.new.content &&
                        // Optional: check creation time tolerance if needed, but content match for agent is usually enough
                        m.sender_type === payload.new.sender_type
                    )

                    if (tempMatchIndex !== -1) {
                        const newMessages = [...prev]
                        newMessages[tempMatchIndex] = payload.new
                        return newMessages
                    }

                    // Otherwise append
                    return [...prev, payload.new]
                })
            })
            .subscribe()

        return () => {
            isMounted = false
            clearTimeout(loadingTimeout)
            supabase.removeChannel(channel)
        }
    }, [id])

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const toggleStatus = async () => {
        if (!ticket || !isAuthenticated) return

        const statusOrder = ['open', 'closed', 'duplicated', 'pending']
        const currentIdx = statusOrder.indexOf(ticket.status)
        const nextStatus = statusOrder[(currentIdx + 1) % statusOrder.length]

        const { error } = await supabase
            .from('tickets')
            .update({ status: nextStatus })
            .eq('id', id)

        if (error) {
            console.error('Error updating status:', error)
        } else {
            setTicket((prev: any) => ({ ...prev, status: nextStatus }))
        }
    }

    const updateUserEmail = async () => {
        if (!ticket?.user_id || !editedEmail.trim() || !isAuthenticated) return

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(editedEmail.trim())) {
            alert('Please enter a valid email address')
            return
        }

        setSavingEmail(true)
        try {
            const { error } = await supabase
                .from('users')
                .update({ email: editedEmail.trim() })
                .eq('id', ticket.user_id)

            if (error) {
                console.error('Error updating email:', error)
                alert('Failed to update email: ' + error.message)
            } else {
                setTicket((prev: any) => ({
                    ...prev,
                    users: { ...prev.users, email: editedEmail.trim() }
                }))
                setIsEditingEmail(false)
            }
        } catch (err) {
            console.error('Error updating email:', err)
        } finally {
            setSavingEmail(false)
        }
    }

    const saveNotes = async () => {
        if (!ticket || !isAuthenticated) return
        setIsSavingNotes(true)
        try {
            const { error } = await supabase
                .from('tickets')
                .update({ notes })
                .eq('id', id)

            if (error) {
                console.error('Error saving notes:', error)
            }
        } catch (err) {
            console.error('Error saving notes:', err)
        } finally {
            setIsSavingNotes(false)
        }
    }

    const sendMessage = async (e: React.FormEvent, closeTicket = false, translate = false, explicitContent?: string) => {
        e.preventDefault()
        if ((!newMessage.trim() && !attachment && !explicitContent) || !id) return

        let attachmentUrls: string[] = []

        // Upload attachment if exists
        if (attachment) {
            const fileExt = attachment.name.split('.').pop()
            const fileName = `${id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

            const { error: uploadError } = await supabase.storage
                .from('ticket-attachments')
                .upload(fileName, attachment)

            if (uploadError) {
                console.error('Error uploading attachment:', uploadError)
                alert('Failed to upload attachment: ' + uploadError.message)
                return
            }

            const { data: { publicUrl } } = supabase.storage
                .from('ticket-attachments')
                .getPublicUrl(fileName)

            attachmentUrls.push(publicUrl)
        }

        // Logic to construct final message: Prefer explicit content (e.g. translated text) if provided
        let finalContent = explicitContent || newMessage

        // Note: "Translated to Language" info is now shown in Discord notifications instead of email

        let translatedContent = translate ? finalContent : null // If translating, the content IS the translation

        // Translation Logic
        // We trigger the webhook if there is content to send.
        if (ticket?.users?.email && finalContent) {
            if (translate) setIsTranslating(true)

            console.log('Agent email being sent:', user?.email)

            try {
                // If translate=true, we are sending a Translated message (which is already in finalContent).
                // If translate=false, we are sending original English message.
                // We pass `translate` flag to backend mostly for metadata or if backend needs to know source language.
                // But for the email body, we send `finalContent`.

                // Format message for HTML email (replace newlines with <br>)
                const attachmentHtml = attachmentUrls.length > 0 ? `<br><br>Attachments:<br>${attachmentUrls.join('<br>')}` : ''
                const messageHtml = finalContent.replace(/\n/g, '<br>') + attachmentHtml

                const response = await fetch('https://zipmcp.app.n8n.cloud/webhook/send-reply', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ticket_id: id,
                        message: messageHtml, // Send HTML formatted message
                        user_email: ticket.users.email,
                        agent_email: user?.email || 'support@narcade.com', // Fallback to support email
                        subject: ticket.subject,
                        language: ticket.language,
                        translate: translate && !explicitContent, // if we have explicit content (like translated text), we don't need backend to translate it again
                        preview_only: false, // Ensure we are SENDING
                        game_name: ticket.game_name || 'Support',
                        attachments: attachmentUrls
                    })
                })

            } catch (err) {
                console.error('Error triggering email webhook:', err)
            } finally {
                if (translate) setIsTranslating(false)
            }
        }

        // Optimistic Update
        const agentName = profile?.name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Agent'
        const optimisticMessage = {
            id: 'temp-' + Date.now(),
            ticket_id: id,
            content: newMessage,
            content_translated: translate ? explicitContent : null,
            sender_type: 'agent',
            attachments: attachmentUrls,
            agent_name: agentName,
            created_at: new Date().toISOString()
        }
        setMessages(prev => [...prev, optimisticMessage])

        const { error } = await supabase
            .from('messages')
            .insert({
                ticket_id: id,
                content: newMessage,
                content_translated: translate ? explicitContent : null,
                sender_type: 'agent',
                attachments: attachmentUrls,
                agent_name: agentName
            })

        if (error) {
            console.error('Error saving message:', error)
            // Rollback optimistic update if needed, but for now just log
        }

        // Close ticket if requested
        if (closeTicket) {
            const { error: updateError } = await supabase
                .from('tickets')
                .update({ status: 'closed' })
                .eq('id', id)

            if (updateError) {
                console.error('Error closing ticket:', updateError)
            } else {
                setTicket((prev: any) => ({ ...prev, status: 'closed' }))
            }
        }

        setNewMessage('')
        setAttachment(null)
    }

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
            </div>
        )
    }

    if (!ticket) {
        return (
            <div className="flex h-full items-center justify-center text-gray-500">
                Ticket not found
            </div>
        )
    }

    return (
        <div className="flex flex-col lg:flex-row h-full">
            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-800 relative min-h-[500px] lg:min-h-0">
                {/* Loading Overlay */}
                {isTranslating && (
                    <div className="absolute inset-0 bg-white/60 dark:bg-gray-900/60 flex items-center justify-center z-50 backdrop-blur-[2px] rounded-lg">
                        <div className="flex flex-col items-center gap-3 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700">
                            <div className="relative">
                                <div className="h-12 w-12 animate-spin rounded-full border-4 border-purple-200 dark:border-purple-900 border-t-purple-600 dark:border-t-purple-400"></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Languages className="h-5 w-5 text-purple-600 dark:text-purple-400 animate-pulse" />
                                </div>
                            </div>
                            <span className="text-lg font-bold text-purple-600 dark:text-purple-400 animate-pulse tracking-wide">
                                Çevir.zip...
                            </span>
                        </div>
                    </div>
                )}

                <div className="border-b bg-white dark:bg-gray-900 p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0 mr-4">
                            <div className="flex items-center gap-3 mb-1">
                                <span className="text-2xl" title={ticket.sentiment || 'Unknown'}>
                                    {ticket.sentiment === 'Positive' ? '😊' :
                                        ticket.sentiment === 'Negative' ? '😟' :
                                            ticket.sentiment === 'Angry' ? '😡' : '😐'}
                                </span>
                                <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">
                                    #{ticket.ticket_id} - {ticket.subject}
                                </h1>
                                <button
                                    onClick={async () => {
                                        const newImportance = ticket.importance === 'important' ? 'normal' : 'important'
                                        const { error } = await supabase
                                            .from('tickets')
                                            .update({ importance: newImportance })
                                            .eq('id', id)
                                        if (!error) {
                                            setTicket((prev: any) => ({ ...prev, importance: newImportance }))
                                        }
                                    }}
                                    className={`flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${ticket.importance === 'important'
                                        ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-800 hover:bg-red-200 dark:hover:bg-red-900/50'
                                        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700'
                                        }`}
                                    title="Click to toggle importance"
                                >
                                    {ticket.importance === 'important' ? '🔴' : '⚪'}
                                    {ticket.importance === 'important' ? 'Important' : 'Normal'}
                                </button>
                            </div>
                            <div className="flex items-center flex-wrap gap-2 text-sm text-gray-500">
                                {isEditingEmail ? (
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="email"
                                            value={editedEmail}
                                            onChange={(e) => setEditedEmail(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') updateUserEmail()
                                                if (e.key === 'Escape') setIsEditingEmail(false)
                                            }}
                                            className="px-2 py-0.5 text-sm border border-indigo-300 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            autoFocus
                                            disabled={savingEmail}
                                        />
                                        <button
                                            onClick={updateUserEmail}
                                            disabled={savingEmail}
                                            className="p-1 text-green-600 hover:text-green-700 disabled:opacity-50"
                                            title="Save"
                                        >
                                            {savingEmail ? (
                                                <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                                <Check className="w-4 h-4" />
                                            )}
                                        </button>
                                        <button
                                            onClick={() => setIsEditingEmail(false)}
                                            disabled={savingEmail}
                                            className="p-1 text-gray-500 hover:text-gray-700"
                                            title="Cancel"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <span
                                        onClick={() => {
                                            if (isAuthenticated) {
                                                setEditedEmail(ticket.users?.email || '')
                                                setIsEditingEmail(true)
                                            }
                                        }}
                                        className={`flex items-center gap-1 ${isAuthenticated ? 'cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400' : ''}`}
                                        title={isAuthenticated ? 'Click to edit email' : 'Sign in to edit'}
                                    >
                                        {ticket.users?.email}
                                        {isAuthenticated && <Pencil className="w-3 h-3 opacity-50" />}
                                    </span>
                                )}
                                <span>•</span>
                                <span>{ticket.language || 'Unknown Language'}</span>
                                {ticket.tags && ticket.tags.length > 0 && (
                                    <>
                                        <span>•</span>
                                        <div className="flex items-center gap-1">
                                            {ticket.tags.map((tag: string, idx: number) => (
                                                <span key={idx} className="px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </>
                                )}
                                {ticket.keywords && ticket.keywords.length > 0 && (
                                    <>
                                        <span>•</span>
                                        <div className="flex items-center gap-1">
                                            {ticket.keywords.map((keyword: string, idx: number) => (
                                                <span key={idx} className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800">
                                                    🔑 {keyword}
                                                </span>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center space-x-2 flex-shrink-0">
                            <button
                                onClick={toggleStatus}
                                disabled={!isAuthenticated}
                                title={!isAuthenticated ? 'Sign in to change status' : 'Click to change status'}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors flex items-center gap-1
                                    ${!isAuthenticated ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:opacity-80'}
                                    ${ticket.status === 'open' ? 'bg-green-100 text-green-800' :
                                        ticket.status === 'closed' ? 'bg-gray-100 text-gray-800' :
                                            ticket.status === 'duplicated' ? 'bg-purple-100 text-purple-800' :
                                                'bg-yellow-100 text-yellow-800'}`}
                            >
                                <span className="capitalize">{ticket.status}</span>
                                {isAuthenticated ? <ChevronDown className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50 dark:bg-gray-950">
                    {messages.map((message) => {
                        const isAgent = message.sender_type === 'agent'
                        return (
                            <div
                                key={message.id}
                                className={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`
                                        max-w-[80%] rounded-2xl px-5 py-3 shadow-sm text-sm leading-relaxed
                                        ${isAgent
                                            ? 'bg-indigo-600 text-white rounded-br-none'
                                            : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-bl-none'
                                        }
                                    `}
                                >
                                    <p className="whitespace-pre-wrap">{message.content}</p>

                                    {!isAgent && message.content_translated && (
                                        <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                                            <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                                                {message.content_translated}
                                            </p>
                                        </div>
                                    )}

                                    {message.attachments && message.attachments.length > 0 && (
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {message.attachments.map((url: string, idx: number) => (
                                                <a
                                                    key={idx}
                                                    href={url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="block relative group overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 transition-transform hover:scale-105"
                                                >
                                                    <img
                                                        src={url}
                                                        alt="Attachment"
                                                        className="object-cover w-32 h-32"
                                                        onError={(e) => {
                                                            // Fallback for non-image files
                                                            e.currentTarget.style.display = 'none'
                                                            e.currentTarget.nextElementSibling?.classList.remove('hidden')
                                                        }}
                                                    />
                                                    <div className="hidden absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 p-2 text-center text-xs text-gray-500">
                                                        <Paperclip className="w-6 h-6 mb-1 mx-auto opacity-50" />
                                                        <span className="truncate w-full block">File</span>
                                                    </div>
                                                </a>
                                            ))}
                                        </div>
                                    )}

                                    <div className={`text-[10px] mt-1.5 opacity-70 ${isAgent ? 'text-indigo-100' : 'text-gray-400'}`}>
                                        {new Date(message.created_at).toLocaleDateString([], { year: 'numeric', month: 'numeric', day: 'numeric' })} {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        {isAgent ? ` • ${message.agent_name || 'Agent'}` : ' • User'}
                                    </div>
                                    {isAgent && message.content_translated && ticket.language && ticket.language.toLowerCase() !== 'english' && (
                                        <div className="text-[9px] mt-0.5 opacity-60 text-indigo-200">
                                            Translated to {ticket.language}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                    <div ref={messagesEndRef} />
                </div>

                <div className="bg-white dark:bg-gray-900 p-4">
                    <form onSubmit={(e) => sendMessage(e, false)} className="flex space-x-2">
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setShowQuickReplies(!showQuickReplies)}
                                className={`inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 ${showQuickReplies ? 'bg-gray-100 dark:bg-gray-700' : ''}`}
                                title="Canned Responses"
                            >
                                <MessageSquare className="h-4 w-4" />
                            </button>
                            {showQuickReplies && (
                                <div className="absolute bottom-full left-0 mb-1 w-64 rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800 z-50">
                                    <div className="p-2 text-xs font-semibold text-gray-500 dark:text-gray-400 border-b dark:border-gray-700 flex justify-between items-center">
                                        <span>Quick Replies</span>
                                        <button
                                            type="button"
                                            onClick={() => setShowQuickReplies(false)}
                                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                        >
                                            &times;
                                        </button>
                                    </div>
                                    <div className="py-1 max-h-60 overflow-y-auto">
                                        {quickReplies.length === 0 ? (
                                            <div className="px-4 py-2 text-sm text-gray-500 italic">No quick replies</div>
                                        ) : (
                                            quickReplies.map((reply, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => {
                                                        setNewMessage(reply.reply)
                                                        setShowQuickReplies(false)
                                                    }}
                                                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                                                >
                                                    {reply.title}
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        {!isAuthenticated ? (
                            <div className="flex-1 flex items-center gap-2 px-4 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-md text-yellow-600 dark:text-yellow-400">
                                <Lock className="h-4 w-4" />
                                <span className="text-sm">Sign in to reply to tickets</span>
                            </div>
                        ) : (
                            <textarea
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder="Type your reply..."
                                rows={3}
                                onKeyDown={(e) => {
                                    // Submit on Cmd+Enter or Ctrl+Enter
                                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                                        e.preventDefault()
                                        sendMessage(e as any, false)
                                    }
                                }}
                                className="flex-1 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white resize-none"
                            />
                        )}
                        {/* Attachment Button */}
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                            className="hidden"
                            accept="image/*,.pdf,.doc,.docx,.txt"
                        />
                        {isAuthenticated && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`inline-flex items-center justify-center rounded-md border px-3 py-2 transition-colors ${attachment ? 'bg-green-50 border-green-300 text-green-700 dark:bg-green-900/20 dark:border-green-700 dark:text-green-400' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}
                                    title={attachment ? attachment.name : 'Add Attachment'}
                                >
                                    <Paperclip className="h-4 w-4" />
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        if (newMessage.trim()) {
                                            setPendingMessage({ original: newMessage, translated: null, translate: false })
                                            setShowCloseModal(true)
                                        }
                                    }}
                                    disabled={!newMessage.trim() || isTranslating}
                                    className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-3 py-2 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                                    title="Send"
                                >
                                    <Send className="h-4 w-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        if (newMessage.trim() && ticket?.users?.email) {
                                            setIsTranslating(true)
                                            try {
                                                // Convert newlines to <br> for Translation webhook
                                                const messageHtml = newMessage.replace(/\n/g, '<br>')

                                                // Use friendly path 'send-reply' instead of specific UUID which might change
                                                const response = await fetch('https://zipmcp.app.n8n.cloud/webhook/send-reply', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({
                                                        ticket_id: id,
                                                        message: messageHtml, // Send HTML formatted message
                                                        user_email: ticket.users.email,
                                                        agent_email: user?.email || 'support@narcade.com',
                                                        subject: ticket.subject,
                                                        language: ticket.language,
                                                        translate: true,
                                                        preview_only: true, // Preview Only = Just Translate
                                                        game_name: ticket.game_name || 'Support'
                                                    })
                                                })

                                                if (response.ok) {
                                                    try {
                                                        const data = await response.json()
                                                        console.log('Creates Ticket Translation Response:', data)
                                                        let translatedText = data.message || data.output || data.text || data.result || data.content || newMessage

                                                        // Convert <br> back to \n for display in textarea/preview
                                                        if (translatedText) {
                                                            translatedText = translatedText.replace(/<br\s*\/?>/gi, '\n')
                                                        }

                                                        setPendingMessage({ original: newMessage, translated: translatedText, translate: true })
                                                    } catch (e) {
                                                        console.error('Translation JSON parse error:', e)
                                                        // Fallback to text if JSON fails but response was OK (rare but possible)
                                                        const text = await response.text().catch(() => '')
                                                        console.log('Raw response:', text)
                                                        throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`)
                                                    }
                                                } else {
                                                    console.error('Translation failed:', response.status, response.statusText)
                                                    const errorText = await response.text().catch(() => '')
                                                    console.error('Error body:', errorText)
                                                    alert(`Translation failed: Server returned ${response.status} ${response.statusText}\n\n${errorText.substring(0, 100)}`)
                                                    setPendingMessage(null)
                                                    return
                                                }
                                            } catch (err: any) {
                                                console.error('Translation error:', err)
                                                alert(`Translation error: ${err.message || 'Failed to connect to translation server.'}`)
                                                return
                                            } finally {
                                                setIsTranslating(false)
                                            }
                                            // Only open modal if we successfully set the message
                                            setShowCloseModal(true)
                                        }
                                    }}
                                    disabled={!newMessage.trim() || isTranslating}
                                    className="inline-flex items-center justify-center rounded-md bg-purple-600 px-3 py-2 text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
                                    title="Translate & Send"
                                >
                                    <Languages className="h-4 w-4" />
                                </button>
                            </>
                        )}
                    </form>

                    {/* Attachment Preview */}
                    {attachment && (
                        <div className="mt-2 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <Paperclip className="h-3 w-3" />
                            <span className="truncate max-w-xs">{attachment.name}</span>
                            <button onClick={() => setAttachment(null)} className="text-red-500 hover:text-red-700">
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                    )}
                </div>

                {/* Send Confirmation Modal */}
                {showCloseModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
                        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
                            <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                    {pendingMessage?.translate ? '🌐 Translate & Send' : '📤 Send Message'}
                                </h3>
                                <button
                                    onClick={() => { setShowCloseModal(false); setPendingMessage(null) }}
                                    className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
                                >
                                    <X className="h-5 w-5 text-gray-500" />
                                </button>
                            </div>
                            <div className="p-6 overflow-y-auto flex-1 min-h-0">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className={`p-3 rounded-full ${pendingMessage?.translate ? 'bg-purple-100 dark:bg-purple-900/30' : 'bg-indigo-100 dark:bg-indigo-900/30'}`}>
                                        {pendingMessage?.translate ? <Languages className="h-6 w-6 text-purple-600 dark:text-purple-400" /> : <Send className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />}
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900 dark:text-white">
                                            {pendingMessage?.translate ? 'Send translated message?' : 'Send this message?'}
                                        </p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">To: {ticket.users?.email}</p>
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Internal Notes</label>
                                    <textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        onBlur={saveNotes}
                                        placeholder="Add notes about this ticket..."
                                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 resize-none"
                                        rows={3}
                                    />
                                    <p className="text-[10px] text-gray-500 mt-1 text-right">
                                        {isSavingNotes ? 'Saving...' : 'Auto-saved on blur'}
                                    </p>
                                </div>

                                {pendingMessage?.translate && pendingMessage?.translated ? (
                                    <div className="space-y-3">
                                        <div>
                                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Original (English)</p>
                                            <div className="bg-gray-100 dark:bg-gray-800/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                                                <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{pendingMessage.original}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                                            <Languages className="h-4 w-4" />
                                            <span className="text-xs font-medium">Translated from English → {ticket.language || 'User Language'}</span>
                                        </div>
                                        <div>
                                            <p className="text-xs font-medium text-purple-600 dark:text-purple-400 mb-1">Translated to {ticket.language || 'User Language'}</p>
                                            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 border border-purple-200 dark:border-purple-800">
                                                <textarea
                                                    value={pendingMessage.translated || ''}
                                                    onChange={(e) => pendingMessage && setPendingMessage({ ...pendingMessage, translated: e.target.value })}
                                                    className="w-full bg-transparent border-none focus:ring-0 text-sm text-gray-700 dark:text-gray-300 resize-none p-0"
                                                    rows={4}
                                                />
                                            </div>
                                            <div className="flex justify-end mt-2">
                                                <button
                                                    onClick={async () => {
                                                        if (!pendingMessage.original) return
                                                        setIsTranslating(true)
                                                        try {
                                                            const messageHtml = pendingMessage.original.replace(/\n/g, '<br>')
                                                            const response = await fetch('https://zipmcp.app.n8n.cloud/webhook/send-reply', {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({
                                                                    ticket_id: id,
                                                                    message: messageHtml,
                                                                    user_email: ticket.users.email,
                                                                    agent_email: user?.email || 'support@narcade.com',
                                                                    subject: ticket.subject,
                                                                    language: ticket.language,
                                                                    translate: true,
                                                                    preview_only: true, // Re-translate is also preview only
                                                                    game_name: ticket.game_name || 'Support'
                                                                })
                                                            })

                                                            if (response.ok) {
                                                                const data = await response.json()
                                                                let translatedText = data.message || data.output || data.text || data.result || data.content || pendingMessage.original
                                                                if (translatedText) {
                                                                    translatedText = translatedText.replace(/<br\s*\/?>/gi, '\n')
                                                                }
                                                                setPendingMessage(prev => prev ? { ...prev, translated: translatedText } : null)
                                                            }
                                                        } catch (err) {
                                                            console.error('Retranslation error:', err)
                                                        } finally {
                                                            setIsTranslating(false)
                                                        }
                                                    }}
                                                    disabled={isTranslating}
                                                    className="text-xs text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1 disabled:opacity-50"
                                                >
                                                    <Languages className="h-3 w-3" />
                                                    {isTranslating ? 'Translating...' : 'Retranslate'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{pendingMessage?.original}</p>
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-3 px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-800">
                                <button
                                    onClick={() => { setShowCloseModal(false); setPendingMessage(null) }}
                                    className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={async (e) => {
                                        if (pendingMessage) {
                                            // Calculate content BEFORE state updates
                                            const contentToSend = pendingMessage.translate && pendingMessage.translated
                                                ? pendingMessage.translated
                                                : pendingMessage.original

                                            // Send message first
                                            await sendMessage(e as any, false, pendingMessage.translate, contentToSend)

                                            // Then close and clear
                                            setShowCloseModal(false)
                                            setPendingMessage(null)
                                        }
                                    }}
                                    disabled={isTranslating}
                                    className={`flex-1 px-4 py-2.5 text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2 ${pendingMessage?.translate ? 'bg-purple-600 hover:bg-purple-700' : 'bg-indigo-600 hover:bg-indigo-700'} ${isTranslating ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {pendingMessage?.translate ? <Languages className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                                    Send
                                </button>
                                <button
                                    onClick={async (e) => {
                                        if (pendingMessage) {
                                            // Calculate content BEFORE state updates
                                            const contentToSend = pendingMessage.translate && pendingMessage.translated
                                                ? pendingMessage.translated
                                                : pendingMessage.original

                                            // Send message first
                                            await sendMessage(e as any, true, pendingMessage.translate, contentToSend)

                                            // Then close and clear
                                            setShowCloseModal(false)
                                            setPendingMessage(null)
                                        }
                                    }}
                                    disabled={isTranslating}
                                    className={`flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-2 ${isTranslating ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <CheckCircle className="h-4 w-4" />
                                    Send & Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Sidebar for Game Data */}
            <div className="w-full lg:w-80 bg-white dark:bg-gray-900 lg:border-l border-gray-200 dark:border-gray-800 overflow-y-auto p-4 h-auto lg:h-full shrink-0">



                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{ticket.game_name || 'Game Data'}</h2>
                    {ticket.project_id && ticket.unity_report_id && (
                        <a
                            href={`https://cloud.unity.com/home/organizations/10024/projects/${ticket.project_id}/cloud-diagnostics/user-reports/${ticket.unity_report_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            Unity Cloud
                        </a>
                    )}
                </div>

                {/* Key Stats */}
                <div className="space-y-4 mb-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                            <p className="text-xs text-gray-500 uppercase">Level</p>
                            <p className="text-lg font-bold text-gray-900 dark:text-white">{ticket.level ?? 'N/A'}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                            <p className="text-xs text-gray-500 uppercase">Coins</p>
                            <p className="text-lg font-bold text-gray-900 dark:text-white">{ticket.coins ?? 'N/A'}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                            <p className="text-xs text-gray-500 uppercase">Stars</p>
                            <p className="text-lg font-bold text-gray-900 dark:text-white">{ticket.stars ?? 'N/A'}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                            <p className="text-xs text-gray-500 uppercase">Is Buyer</p>
                            <div className="flex items-center h-7">
                                {(ticket.game_data?.is_buyer || ticket.game_data?.Is_Buyer || ticket.game_data?.IsBuyer) ? (
                                    <div className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center">
                                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                ) : (
                                    <span className="text-lg font-bold text-gray-900 dark:text-white">-</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>


                {/* Tags Section */}
                {ticket.tags && ticket.tags.length > 0 && (
                    <div className="mb-6">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 border-b pb-2">Tags</h3>
                        <div className="flex flex-wrap gap-2">
                            {ticket.tags.map((tag: string, idx: number) => (
                                <span key={idx} className="px-2 py-1 text-xs font-medium rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Device Info */}
                <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 border-b pb-2">Device Info</h3>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-500">Platform:</span>
                            <span className="text-gray-900 dark:text-white font-medium">{ticket.platform || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Version:</span>
                            <span className="text-gray-900 dark:text-white font-medium">{ticket.app_version || 'N/A'}</span>
                        </div>
                        <div className="flex flex-col mt-2">
                            <span className="text-gray-500 text-xs mb-1">Device ID:</span>
                            <span className="text-gray-900 dark:text-white font-mono text-[10px] break-all bg-gray-50 dark:bg-gray-800 p-1 rounded">
                                {ticket.device_id || 'N/A'}
                            </span>
                        </div>
                        <div className="flex flex-col mt-2">
                            <span className="text-gray-500 text-xs mb-1">Nakama User ID:</span>
                            <span className="text-gray-900 dark:text-white font-mono text-[10px] break-all bg-gray-50 dark:bg-gray-800 p-1 rounded">
                                {ticket.nakama_user_id || 'N/A'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Raw Data (Collapsible) */}
                <div className="space-y-3">
                    {ticket.game_data && (
                        <details className="group border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                            <summary className="flex cursor-pointer items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 hover:from-indigo-100 hover:to-purple-100 dark:hover:from-indigo-900/30 dark:hover:to-purple-900/30 transition-colors">
                                <div className="flex items-center gap-2">
                                    <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                    <span className="text-sm font-semibold text-gray-900 dark:text-white">Full Game Data</span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">({Object.keys(ticket.game_data).length} fields)</span>
                                </div>
                                <svg className="w-5 h-5 text-gray-400 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </summary>
                            <div className="px-4 py-3 bg-white dark:bg-gray-900 max-h-96 overflow-y-auto">
                                <div className="space-y-2">
                                    {ticket.project_id && (
                                        <div className="flex items-start gap-3 py-2 border-b border-gray-100 dark:border-gray-800">
                                            <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400 min-w-[120px] flex-shrink-0 font-semibold">project_id:</span>
                                            <span className="text-xs font-mono text-gray-900 dark:text-gray-100 break-all">
                                                {ticket.project_id}
                                            </span>
                                        </div>
                                    )}
                                    {Object.entries(ticket.game_data).map(([key, value]) => (
                                        <div key={key} className="flex items-start gap-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                                            <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400 min-w-[120px] flex-shrink-0 font-semibold">{key}:</span>
                                            <span className="text-xs font-mono text-gray-900 dark:text-gray-100 break-all">
                                                {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </details>
                    )}

                    {ticket.device_info && (
                        <details className="group border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                            <summary className="flex cursor-pointer items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 hover:from-blue-100 hover:to-cyan-100 dark:hover:from-blue-900/30 dark:hover:to-cyan-900/30 transition-colors">
                                <div className="flex items-center gap-2">
                                    <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                    <span className="text-sm font-semibold text-gray-900 dark:text-white">Full Device Info</span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">({Object.keys(ticket.device_info).length} fields)</span>
                                </div>
                                <svg className="w-5 h-5 text-gray-400 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </summary>
                            <div className="px-4 py-3 bg-white dark:bg-gray-900 max-h-96 overflow-y-auto">
                                <div className="space-y-2">
                                    {Object.entries(ticket.device_info).map(([key, value]) => (
                                        <div key={key} className="flex items-start gap-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                                            <span className="text-xs font-mono text-blue-600 dark:text-blue-400 min-w-[120px] flex-shrink-0 font-semibold">{key}:</span>
                                            <span className="text-xs font-mono text-gray-900 dark:text-gray-100 break-all">
                                                {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </details>
                    )}
                </div>

                {/* Notes Section (Moved to Bottom) */}
                <div className="mt-6 border-t pt-4 border-gray-200 dark:border-gray-800">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Internal Notes</h3>
                    <div className="relative">
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            onBlur={saveNotes}
                            placeholder="Add notes..."
                            className="w-full rounded-lg border border-gray-300 bg-yellow-50/50 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-yellow-900/10 dark:text-gray-200 resize-y min-h-[100px]"
                        />
                        <div className="absolute bottom-2 right-2 flex items-center gap-1">
                            {isSavingNotes && <span className="text-[10px] text-gray-400 animate-pulse">Saving...</span>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
