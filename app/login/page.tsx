"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function LoginPage() {
    const supabase = createClient();
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError("");
        setLoading(true);

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        setLoading(false);

        if (error) {
            setError("Login failed. Check your email and password.");
            return;
        }

        router.replace("/tracker");
        router.refresh();
    }

    return (
        <main className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-linear-to-br from-slate-50 via-emerald-50/20 to-teal-50/30 text-slate-800 font-sans antialiased">
            <div className="w-full max-w-md">
                {/* Brand / Header info above form for visual engagement */}
                <div className="text-center mb-8 space-y-2">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 mb-2">
                        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                        Prayer Tracker
                    </h1>
                </div>

                <form
                    onSubmit={handleLogin}
                    className="bg-white border border-slate-200/80 rounded-3xl shadow-xl shadow-emerald-950/5 p-8 space-y-5 backdrop-blur-xl"
                >
                    <div className="space-y-1.5">
                        <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                            Email Address
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoComplete="username"
                            required
                            placeholder="you@example.com"
                            className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:bg-white transition-all shadow-xs"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                            Password
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="current-password"
                            required
                            placeholder="••••••••"
                            className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:bg-white transition-all shadow-xs"
                        />
                    </div>

                    {error && (
                        <div role="alert" className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2.5 animate-fade-in">
                            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>{error}</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white text-sm font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all duration-200 disabled:opacity-60 disabled:cursor-wait cursor-pointer flex items-center justify-center gap-2"
                    >
                        {loading && (
                            <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                        )}
                        {loading ? "Signing in..." : "Sign in"}
                    </button>
                </form>
            </div>
        </main>
    );
}