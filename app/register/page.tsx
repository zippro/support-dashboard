'use client'

import Link from 'next/link'

export default function Register() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div className="w-full max-w-md text-center space-y-8">
                <div>
                    <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                        Registration Suspended
                    </h2>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        New user registration is currently disabled. Please contact your administrator if you need access.
                    </p>
                </div>
                <div>
                    <Link
                        href="/login"
                        className="text-indigo-600 hover:text-indigo-500 font-medium"
                    >
                        Return to Login
                    </Link>
                </div>
            </div>
        </div>
    )
}
