'use client'

import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { User, Mail, Camera, Lock, Save, Loader2, UserPlus, Shield, Key } from 'lucide-react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

export default function ProfilePage() {
    const { user, profile, updateProfile, isAuthenticated, isLoading } = useAuth()
    const router = useRouter()
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Pre-fill name from profile OR auth metadata
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')

    const [saving, setSaving] = useState(false)
    const [uploadingAvatar, setUploadingAvatar] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
    const [creatingProfile, setCreatingProfile] = useState(false)

    // Password change
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [changingPassword, setChangingPassword] = useState(false)

    // Initialize state from user/profile data
    useEffect(() => {
        if (profile?.name) {
            setName(profile.name)
        } else if (user?.user_metadata?.name || user?.user_metadata?.full_name) {
            setName(user.user_metadata.name || user.user_metadata.full_name)
        }

        if (user?.email) {
            setEmail(user.email)
        }
    }, [profile, user])

    // Redirect if not authenticated
    if (!isLoading && !isAuthenticated) {
        router.push('/login')
        return null
    }

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center bg-gray-950">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-gray-500 text-sm animate-pulse">Loading profile...</p>
                </div>
            </div>
        )
    }

    // Create profile if it doesn't exist
    async function handleCreateProfile(e: React.FormEvent) {
        e.preventDefault()
        if (!user || !name.trim()) return

        setCreatingProfile(true)
        setMessage(null)

        const { error } = await supabase
            .from('agent_profiles')
            .insert({
                id: user.id,
                name: name.trim(),
                email: user.email
            })

        if (error) {
            setMessage({ type: 'error', text: error.message })
        } else {
            setMessage({ type: 'success', text: 'Profile created successfully! reloading...' })
            setTimeout(() => window.location.reload(), 1000)
        }
        setCreatingProfile(false)
    }

    async function handleSaveProfile(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)
        setMessage(null)

        const { error } = await updateProfile({ name })

        if (error) {
            setMessage({ type: 'error', text: error.message })
        } else {
            setMessage({ type: 'success', text: 'Profile updated successfully!' })
            setTimeout(() => setMessage(null), 3000)
        }
        setSaving(false)
    }

    async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file || !user) return

        setUploadingAvatar(true)
        setMessage(null)

        const fileExt = file.name.split('.').pop()
        const fileName = `${user.id}/avatar-${Date.now()}.${fileExt}`

        // Upload to storage
        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, file, { upsert: true })

        if (uploadError) {
            setMessage({ type: 'error', text: uploadError.message })
            setUploadingAvatar(false)
            return
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName)

        // Update profile
        const { error: updateError } = await updateProfile({ avatar_url: publicUrl })

        if (updateError) {
            setMessage({ type: 'error', text: updateError.message })
        } else {
            setMessage({ type: 'success', text: 'Avatar updated!' })
            setTimeout(() => setMessage(null), 3000)
        }
        setUploadingAvatar(false)
    }

    async function handleChangePassword(e: React.FormEvent) {
        e.preventDefault()
        setMessage(null)

        if (newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: 'Passwords do not match' })
            return
        }

        if (newPassword.length < 6) {
            setMessage({ type: 'error', text: 'Password must be at least 6 characters' })
            return
        }

        setChangingPassword(true)

        const { error } = await supabase.auth.updateUser({ password: newPassword })

        if (error) {
            setMessage({ type: 'error', text: error.message })
        } else {
            setMessage({ type: 'success', text: 'Password changed successfully!' })
            setNewPassword('')
            setConfirmPassword('')
            setTimeout(() => setMessage(null), 3000)
        }
        setChangingPassword(false)
    }

    // No Profile State - "Complete Your Profile"
    if (!profile) {
        return (
            <div className="h-full overflow-y-auto bg-gray-950 p-6 md:p-12 flex items-center justify-center">
                <div className="w-full max-w-lg">
                    <div className="bg-gray-900 rounded-3xl border border-gray-800 shadow-2xl overflow-hidden">
                        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-8 py-10 text-center relative overflow-hidden">
                            <div className="absolute inset-0 bg-white/5 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '20px 20px' }}></div>
                            <div className="relative z-10">
                                <div className="mx-auto w-20 h-20 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-inner mb-4 border border-white/20">
                                    <UserPlus className="w-10 h-10 text-white" />
                                </div>
                                <h1 className="text-3xl font-bold text-white mb-2">Welcome Aboard!</h1>
                                <p className="text-indigo-100 font-medium">Let's set up your profile to get you started.</p>
                            </div>
                        </div>

                        <div className="p-8 space-y-6">
                            {message && (
                                <div className={`p-4 rounded-xl flex items-center gap-3 ${message.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
                                    {message.type === 'success' ? <Shield className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
                                    <span className="text-sm font-medium">{message.text}</span>
                                </div>
                            )}

                            <form onSubmit={handleCreateProfile} className="space-y-5">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-gray-300 ml-1">Full Name</label>
                                    <div className="relative group">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-indigo-500 transition-colors" />
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="John Doe"
                                            required
                                            className="w-full pl-11 pr-4 py-3.5 bg-gray-950/50 border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-gray-300 ml-1">Email Address</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                                        <input
                                            type="email"
                                            value={user?.email || ''}
                                            disabled
                                            className="w-full pl-11 pr-4 py-3.5 bg-gray-800/50 border border-gray-800 rounded-xl text-gray-400 cursor-not-allowed font-medium"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={creatingProfile || !name.trim()}
                                    className="w-full relative overflow-hidden group flex items-center justify-center gap-2 px-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/20 mt-4"
                                >
                                    <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                                    {creatingProfile ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
                                    <span>Create Profile</span>
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // Main Profile View
    return (
        <div className="h-full overflow-y-auto bg-gray-950 p-6 md:p-10">
            <div className="max-w-4xl mx-auto space-y-10">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-gray-800 pb-8">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Profile Settings</h1>
                        <p className="text-gray-400 mt-2 text-lg">Manage your personal information and security preferences</p>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400 text-sm font-medium">
                        <Shield className="w-4 h-4" />
                        <span>Authenticated</span>
                    </div>
                </div>

                {message && (
                    <div className={`p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300 shadow-lg ${message.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-400 shadow-green-900/10' : 'bg-red-500/10 border border-red-500/20 text-red-400 shadow-red-900/10'}`}>
                        {message.type === 'success' ? <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> : <div className="w-2 h-2 rounded-full bg-red-500" />}
                        <span className="font-medium">{message.text}</span>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Left Column: Avatar & Basic Info Card */}
                    <div className="lg:col-span-1 space-y-6 h-fit">
                        <div className="bg-gray-900 rounded-3xl border border-gray-800 p-6 shadow-xl relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-indigo-900/20 to-transparent opacity-50"></div>

                            <div className="relative flex flex-col items-center text-center">
                                <div className="relative mb-6">
                                    <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-800 ring-4 ring-gray-950 shadow-2xl relative z-10 group-hover:ring-indigo-500/30 transition-all duration-500">
                                        {profile.avatar_url ? (
                                            <Image src={profile.avatar_url} alt={profile.name} fill className="object-cover transition-transform duration-700 group-hover:scale-110" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-600 to-violet-700">
                                                <span className="text-4xl font-bold text-white shadow-sm">{profile.name.charAt(0).toUpperCase()}</span>
                                            </div>
                                        )}

                                        {/* Loading Overlay */}
                                        {uploadingAvatar && (
                                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm z-20">
                                                <Loader2 className="w-8 h-8 text-white animate-spin" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Edit Button */}
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="absolute bottom-1 right-1 p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-lg ring-4 ring-gray-900 transition-all transform hover:scale-110 z-20"
                                        disabled={uploadingAvatar}
                                    >
                                        <Camera className="w-4 h-4" />
                                    </button>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={handleAvatarUpload}
                                        className="hidden"
                                    />
                                </div>

                                <h2 className="text-xl font-bold text-white mb-1 px-4 truncate w-full">{profile.name}</h2>
                                <p className="text-gray-500 text-sm mb-6 px-4 truncate w-full">{profile.email}</p>

                                <div className="w-full pt-6 border-t border-gray-800 grid grid-cols-2 divide-x divide-gray-800">
                                    <div className="text-center px-2">
                                        <span className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Role</span>
                                        <span className="font-semibold text-indigo-400">Agent</span>
                                    </div>
                                    <div className="text-center px-2">
                                        <span className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Status</span>
                                        <span className="font-semibold text-emerald-400">Active</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Edit Forms */}
                    <div className="lg:col-span-2 space-y-8">

                        {/* Personal Info Form */}
                        <section className="bg-gray-900 rounded-3xl border border-gray-800 p-8 shadow-sm">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                                    <User className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-white">Personal Information</h2>
                                    <p className="text-sm text-gray-400">Update your public profile details</p>
                                </div>
                            </div>

                            <form onSubmit={handleSaveProfile} className="space-y-6">
                                <div className="grid grid-cols-1 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-300 ml-1">Full Name</label>
                                        <div className="relative group">
                                            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
                                            <input
                                                type="text"
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                className="w-full pl-11 pr-4 py-3 bg-gray-950 border border-gray-800 rounded-xl text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-300 ml-1">Email Address</label>
                                        <div className="relative">
                                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                                            <input
                                                type="email"
                                                value={email}
                                                disabled
                                                className="w-full pl-11 pr-4 py-3 bg-gray-950/50 border border-gray-800 rounded-xl text-gray-500 cursor-not-allowed font-medium"
                                            />
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-800/50 border border-gray-700/50">
                                                <Lock className="w-3 h-3 text-gray-400" />
                                                <span className="text-xs text-gray-400">Locked</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 flex justify-end">
                                    <button
                                        type="submit"
                                        disabled={saving || name === profile.name}
                                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:grayscale hover:shadow-lg hover:shadow-blue-900/20 active:scale-95"
                                    >
                                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                        Save Changes
                                    </button>
                                </div>
                            </form>
                        </section>

                        {/* Security Form */}
                        <section className="bg-gray-900 rounded-3xl border border-gray-800 p-8 shadow-sm">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                                    <Key className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-white">Security</h2>
                                    <p className="text-sm text-gray-400">Update your password securely</p>
                                </div>
                            </div>

                            <form onSubmit={handleChangePassword} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-300 ml-1">New Password</label>
                                        <div className="relative group">
                                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-indigo-500 transition-colors" />
                                            <input
                                                type="password"
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                placeholder="Min. 6 characters"
                                                className="w-full pl-11 pr-4 py-3 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-300 ml-1">Confirm Password</label>
                                        <div className="relative group">
                                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-indigo-500 transition-colors" />
                                            <input
                                                type="password"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                placeholder="Repeat password"
                                                className="w-full pl-11 pr-4 py-3 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 flex justify-end">
                                    <button
                                        type="submit"
                                        disabled={changingPassword || !newPassword || !confirmPassword}
                                        className="flex items-center gap-2 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-xl transition-all disabled:opacity-50 hover:shadow-lg hover:shadow-gray-900/20 active:scale-95"
                                    >
                                        {changingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                                        Update Password
                                    </button>
                                </div>
                            </form>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    )
}

