'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Send } from 'lucide-react'

export default function NewTicket() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        email: '',
        subject: '',
        message: '',
        language: 'en'
    })
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            // 1. Get or Create User
            let userId
            const { data: existingUser, error: userFetchError } = await supabase
                .from('users')
                .select('id')
                .eq('email', formData.email)
                .single()

            if (existingUser) {
                userId = existingUser.id
            } else {
                // Check if error is "Row not found" or something else
                if (userFetchError && userFetchError.code !== 'PGRST116') {
                    throw userFetchError
                }

                const { data: newUser, error: createUserError } = await supabase
                    .from('users')
                    .insert({ email: formData.email })
                    .select('id')
                    .single()

                if (createUserError) throw createUserError
                userId = newUser.id
            }

            // 2. Create Ticket
            const { data: ticket, error: createTicketError } = await supabase
                .from('tickets')
                .insert({
                    user_id: userId,
                    subject: formData.subject,
                    language: formData.language,
                    status: 'open'
                })
                .select('id')
                .single()

            if (createTicketError) throw createTicketError

            // 3. Create Initial Message
            const { error: createMessageError } = await supabase
                .from('messages')
                .insert({
                    ticket_id: ticket.id,
                    content: formData.message,
                    sender_type: 'user'
                })

            if (createMessageError) throw createMessageError

            // 4. Redirect
            router.push(`/tickets/${ticket.id}`)

        } catch (err: any) {
            console.error('Error creating ticket:', err)
            setError(err.message || 'An error occurred while creating the ticket.')
        } finally {
            setLoading(false)
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }))
    }

    return (
        <div className="max-w-2xl mx-auto p-8">
            <div className="mb-8">
                <Link href="/tickets" className="text-indigo-600 hover:text-indigo-800 flex items-center mb-4 transition-colors">
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Back to Tickets
                </Link>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Create New Ticket</h1>
                <p className="text-gray-500 dark:text-gray-400 mt-2">
                    Please provide the details of your issue below.
                </p>
            </div>

            <div className="bg-white dark:bg-gray-900 shadow-sm rounded-lg border p-6">
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Email Address
                        </label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            required
                            value={formData.email}
                            onChange={handleChange}
                            className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                            placeholder="you@example.com"
                        />
                    </div>

                    <div>
                        <label htmlFor="subject" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Subject
                        </label>
                        <input
                            type="text"
                            id="subject"
                            name="subject"
                            required
                            value={formData.subject}
                            onChange={handleChange}
                            className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                            placeholder="Brief summary of the issue"
                        />
                    </div>

                    <div>
                        <label htmlFor="language" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Language
                        </label>
                        <select
                            id="language"
                            name="language"
                            value={formData.language}
                            onChange={handleChange}
                            className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        >
                            <option value="en">English</option>
                            <option value="es">Spanish</option>
                            <option value="fr">French</option>
                            <option value="de">German</option>
                            <option value="it">Italian</option>
                            <option value="pt">Portuguese</option>
                            <option value="tr">Turkish</option>
                        </select>
                    </div>

                    <div>
                        <label htmlFor="message" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Message
                        </label>
                        <textarea
                            id="message"
                            name="message"
                            required
                            rows={5}
                            value={formData.message}
                            onChange={handleChange}
                            className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                            placeholder="Describe your issue in detail..."
                        />
                    </div>

                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex justify-center items-center bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <>
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2"></div>
                                    Creating Ticket...
                                </>
                            ) : (
                                <>
                                    <Send className="h-4 w-4 mr-2" />
                                    Submit Ticket
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
