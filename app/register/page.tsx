'use client'

import { UserX, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function RegisterPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4">
            <div className="w-full max-w-md">
                <div className="bg-gray-900 rounded-2xl shadow-xl border border-gray-800 p-8">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-600/20 mb-4">
                            <UserX className="w-8 h-8 text-amber-500" />
                        </div>
                        <h1 className="text-2xl font-bold text-white">Registration Suspended</h1>
                        <p className="text-gray-400 mt-2">New account registration is currently not available</p>
                    </div>

                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm mb-6">
                        <p className="font-medium mb-1">Notice</p>
                        <p>Account creation has been temporarily suspended. If you need access to the support dashboard, please contact your administrator.</p>
                    </div>

                    <Link
                        href="/login"
                        className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Back to Sign In
                    </Link>
                </div>
            </div>
        </div>
    )
}
