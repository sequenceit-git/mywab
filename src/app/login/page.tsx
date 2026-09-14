'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';
import {
  Bot,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in both email and password.');
      return;
    }

    setError(null);
    setLoading(true);

    const result = await login(email, password);
    setLoading(false);

    if (result.success) {
      router.push('/');
    } else {
      setError(result.error || 'Invalid credentials');
    }
  };

  const handleQuickFill = () => {
    setEmail('admin@sequenceit.software');
    setPassword('admin123456');
    setError(null);
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center p-4 bg-dark-950 relative overflow-hidden">
      {/* Background Decorative Ambient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-brand-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Main Glassmorphic Card */}
      <div className="w-full max-w-md z-10 space-y-6">
        {/* Brand Logo & Title */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-brand-400 text-white shadow-xl shadow-brand-500/25 mb-1">
            <Bot className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            WapBusiness <span className="text-brand-400">Admin</span>
          </h1>
          <p className="text-xs text-slate-400">
            Sign in to access the Operations Hub & AI Dispatch Panel
          </p>
        </div>

        {/* Form Container */}
        <div className="p-8 rounded-3xl bg-dark-900/90 border border-slate-800/90 shadow-2xl backdrop-blur-xl space-y-6">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder="admin@sequenceit.software"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/40 transition"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">Password</label>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/40 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-brand-500 to-emerald-500 hover:from-brand-400 hover:to-emerald-400 text-dark-950 font-bold text-xs tracking-wide transition-all duration-200 shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span>Signing in...</span>
              ) : (
                <>
                  <span>Sign In to Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Fill / Demo Credentials Hint */}
          <div className="pt-4 border-t border-slate-800/80">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 text-[11px]">Need default admin login?</span>
              <button
                type="button"
                onClick={handleQuickFill}
                className="text-[11px] font-semibold text-brand-400 hover:text-brand-300 hover:underline flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3 text-brand-400" />
                <span>Auto-fill Admin</span>
              </button>
            </div>
          </div>
        </div>

        {/* Security / Deployment Badge */}
        <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Protected by Encrypted Sessions & Supabase DB</span>
        </div>
      </div>
    </div>
  );
}
