'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import { Send, ChevronDown, MessageSquare, Languages, X, Paperclip, CheckCircle } from 'lucide-react'

export default function TicketDetail() {
    const { id } = useParams()
    const [ticket, setTicket] = useState<any>(null)
    const [messages, setMessages] = useState<any[]>([])
    const [newMessage, setNewMessage] = useState('')
    const [sendEmail, setSendEmail] = useState(false)
    const [loading, setLoading] = useState(true)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const [quickReplies, setQuickReplies] = useState<{ title: string, reply: string }[]>([])
    const [showQuickReplies, setShowQuickReplies] = useState(false)
    const [isTranslating, setIsTranslating] = useState(false)
    const [showCloseModal, setShowCloseModal] = useState(false)
    const [pendingMessage, setPendingMessage] = useState<{ content: string, translate: boolean } | null>(null)
    const [attachment, setAttachment] = useState<File | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        async function fetchQuickReplies() {
            const { data } = await supabase
                .from('quick_replies')
                .select('title, reply')
                .order('created_at', { ascending: false })

            if (data) setQuickReplies(data)
        }
        fetchQuickReplies()
    }, [])

    useEffect(() => {
        async function fetchTicketData() {
            if (!id) return

            // Fetch ticket details
            const { data: ticketData, error: ticketError } = await supabase
                .from('tickets')
                .select('*, users(email)')
                .eq('id', id)
                .single()

            if (ticketError) {
                console.error('Error fetching ticket:', ticketError)
                setLoading(false)
                return
            }

            // Fetch Game Name if project_id exists
            if (ticketData.project_id) {
                const { data: projectData } = await supabase
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

            setTicket(ticketData)

            // Fetch messages
            const { data: messagesData, error: messagesError } = await supabase
                .from('messages')
                .select('*')
                .eq('ticket_id', id)
                .order('created_at', { ascending: true })

            if (messagesError) console.error('Error fetching messages:', messagesError)
            else setMessages(messagesData || [])

            setLoading(false)
        }

        fetchTicketData()

        // Subscribe to new messages
        const channel = supabase
            .channel('messages')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `ticket_id=eq.${id}` }, (payload) => {
                setMessages((prev) => [...prev, payload.new])
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [id])

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const toggleStatus = async () => {
        if (!ticket) return

        const statusOrder = ['open', 'closed', 'pending']
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

    const sendMessage = async (e: React.FormEvent, closeTicket = false, translate = false) => {
        e.preventDefault()
        if (!newMessage.trim() || !id) return

        // Send email via n8n (always enabled now)
        let finalContent = newMessage
        let translatedContent = null

        if (ticket?.users?.email) {
            if (translate) setIsTranslating(true)
            try {
                const response = await fetch('https://zipmcp.app.n8n.cloud/webhook/6501cd11-963e-4a6d-9d53-d5e522f8c7c3', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ticket_id: id,
                        message: newMessage,
                        user_email: ticket.users.email,
                        subject: ticket.subject,
                        language: ticket.language,
                        translate: translate,
                        game_name: ticket.game_name || 'Support'
                    })
                })

                if (translate && response.ok) {
                    try {
                        const data = await response.json()
                        if (data.message) {
                            finalContent = data.message
                            translatedContent = newMessage // Store original English as "translated" (source)
                        }
                    } catch (e) {
                        console.warn('No JSON returned from webhook, using original message')
                    }
                }
            } catch (err) {
                console.error('Error triggering email webhook:', err)
                alert('Failed to trigger webhook: ' + err)
            } finally {
                if (translate) setIsTranslating(false)
            }
        }

        const { error } = await supabase
            .from('messages')
            .insert({
                ticket_id: id,
                content: finalContent,
                content_translated: translatedContent,
                sender_type: 'agent',
            })

        if (error) {
            console.error('Error saving message:', error)
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
        <div className="flex h-full">
            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col border-r border-gray-200 dark:border-gray-800 relative">
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
                                {ticket.importance === 'important' && (
                                    <span className="flex-shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-800">
                                        Important
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center flex-wrap gap-2 text-sm text-gray-500">
                                <span>{ticket.users?.email}</span>
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
                                className={`px-3 py-1.5 text-xs font-semibold rounded-full cursor-pointer transition-colors hover:opacity-80 flex items-center gap-1
                  ${ticket.status === 'open' ? 'bg-green-100 text-green-800' :
                                        ticket.status === 'closed' ? 'bg-gray-100 text-gray-800' :
                                            'bg-yellow-100 text-yellow-800'}`}
                            >
                                <span className="capitalize">{ticket.status}</span>
                                <ChevronDown className="w-3 h-3" />
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

                                    <div className={`text-[10px] mt-1.5 opacity-70 ${isAgent ? 'text-indigo-100' : 'text-gray-400'}`}>
                                        {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        {isAgent ? ' • Agent' : ' • User'}
                                    </div>
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
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Type your reply..."
                            className="flex-1 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        />
                        {/* Attachment Button */}
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                            className="hidden"
                            accept="image/*,.pdf,.doc,.docx,.txt"
                        />
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
                                    setPendingMessage({ content: newMessage, translate: false })
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
                            onClick={() => {
                                if (newMessage.trim()) {
                                    setPendingMessage({ content: newMessage, translate: true })
                                    setShowCloseModal(true)
                                }
                            }}
                            disabled={!newMessage.trim() || isTranslating}
                            className="inline-flex items-center justify-center rounded-md bg-purple-600 px-3 py-2 text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
                            title="Translate & Send"
                        >
                            <Languages className="h-4 w-4" />
                        </button>
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
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
                        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                    {pendingMessage?.translate ? '🌐 Translate & Send' : '📤 Send Message'}
                                </h3>
                                <button
                                    onClick={() => { setShowCloseModal(false); setPendingMessage(null) }}
                                    className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                >
                                    <X className="h-5 w-5 text-gray-500" />
                                </button>
                            </div>
                            <div className="p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className={`p-3 rounded-full ${pendingMessage?.translate ? 'bg-purple-100 dark:bg-purple-900/30' : 'bg-indigo-100 dark:bg-indigo-900/30'}`}>
                                        {pendingMessage?.translate ? <Languages className="h-6 w-6 text-purple-600 dark:text-purple-400" /> : <Send className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />}
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900 dark:text-white">
                                            {pendingMessage?.translate ? 'Translate and send this message?' : 'Send this message?'}
                                        </p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">To: {ticket.users?.email}</p>
                                    </div>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4">
                                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{pendingMessage?.content}</p>
                                </div>
                                {pendingMessage?.translate && (
                                    <p className="text-xs text-purple-600 dark:text-purple-400 italic">Message will be translated to {ticket.language || 'user language'}</p>
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
                                            setShowCloseModal(false)
                                            await sendMessage(e as any, false, pendingMessage.translate)
                                            setPendingMessage(null)
                                        }
                                    }}
                                    className={`flex-1 px-4 py-2.5 text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2 ${pendingMessage?.translate ? 'bg-purple-600 hover:bg-purple-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                                >
                                    {pendingMessage?.translate ? <Languages className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                                    Send
                                </button>
                                <button
                                    onClick={async (e) => {
                                        if (pendingMessage) {
                                            setShowCloseModal(false)
                                            await sendMessage(e as any, true, pendingMessage.translate)
                                            setPendingMessage(null)
                                        }
                                    }}
                                    className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-2"
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
            <div className="w-80 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 overflow-y-auto p-4">
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
            </div>
        </div>
    )
}
