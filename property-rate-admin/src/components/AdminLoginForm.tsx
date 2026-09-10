'use client';

import React, { useState } from 'react';
import { adminLogin } from '../app/actions';
import { Lock, User, Eye, EyeOff, Loader2, CheckCircle2, ShieldAlert } from 'lucide-react';

export default function AdminLoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('superseded') === 'true') {
        setStatus('error');
        setErrorMessage('Your session was closed because this administrator account signed in from another device.');
      }
    }
  }, []);

  const isPending = status === 'submitting' || status === 'success';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPending) return;

    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    // Client-side Input Validation
    if (!cleanUsername) {
      setStatus('error');
      setErrorMessage('Please enter your municipal officer username.');
      return;
    }

    if (/^(\+?233|0)\d{8,10}$/.test(cleanUsername) || /^\d{10,}$/.test(cleanUsername)) {
      setStatus('error');
      setErrorMessage('Telephone numbers are not accepted. Please sign in using your official administration username.');
      return;
    }

    if (!/^[a-zA-Z0-9_.-]{3,50}$/.test(cleanUsername)) {
      setStatus('error');
      setErrorMessage('Username must contain only letters, numbers, hyphens, or underscores (3 to 50 characters).');
      return;
    }

    if (!cleanPassword) {
      setStatus('error');
      setErrorMessage('Please enter your authorization password.');
      return;
    }

    // Instant Doherty Threshold feedback (<100ms)
    setStatus('submitting');
    setErrorMessage('');

    try {
      const res = await adminLogin(cleanUsername, cleanPassword, rememberMe);
      if (res.success) {
        setStatus('success');
        // Optimistic transition into the console
        setTimeout(() => {
          window.location.href = '/';
        }, 400);
      } else {
        setStatus('error');
        setErrorMessage(res.error || 'Invalid municipal officer username or authorization password.');
      }
    } catch (err) {
      setStatus('error');
      setErrorMessage('Municipal authentication gateway unavailable. Please check your network connection.');
    }
  };

  return (
    <form
      className="space-y-3"
      onSubmit={handleSubmit}
      autoComplete="off"
      data-lpignore="true"
      data-1p-ignore="true"
      data-form-type="other"
    >
      {/* Anti-autofill Decoy Honeypots */}
      <input type="text" name="prevent_autofill_username" tabIndex={-1} aria-hidden="true" style={{ position: 'absolute', top: -9999, left: -9999, opacity: 0, height: 0, width: 0, pointerEvents: 'none' }} />
      <input type="password" name="prevent_autofill_password" tabIndex={-1} aria-hidden="true" style={{ position: 'absolute', top: -9999, left: -9999, opacity: 0, height: 0, width: 0, pointerEvents: 'none' }} />

      {/* Dynamic Error State (Strictly Zero Pills) */}
      {status === 'error' && errorMessage && (
        <div
          role="alert"
          className="border-l-4 border-[#C5221F] bg-[#FCE8E6]/80 p-2 sm:p-2.5 text-xs text-[#C5221F] flex items-start gap-2 transition-opacity duration-150"
        >
          <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#C5221F]" />
          <div className="flex-1 leading-relaxed">
            <span className="font-semibold block mb-0.5">Authorization Failed</span>
            {errorMessage}
          </div>
        </div>
      )}

      {/* Officer Username Field */}
      <div>
        <label htmlFor="username" className="block text-[11px] font-semibold uppercase tracking-wider text-[#5F6368] mb-0.5">
          Officer Username
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <User className="h-4 w-4 text-[#717171]" />
          </div>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="off"
            data-lpignore="true"
            data-1p-ignore="true"
            data-form-type="other"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
            required
            disabled={isPending}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="block w-full pl-9 pr-3 py-1.5 sm:py-2 bg-white border border-[#DADCE0] text-xs sm:text-sm text-[#2C2C2C] placeholder:text-[#9AA0A6] focus:outline-none focus:border-[#612D53] focus:ring-1 focus:ring-[#612D53] disabled:bg-[#F8F9FA] disabled:text-[#717171] disabled:cursor-not-allowed transition-colors [&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_white] [&:-webkit-autofill]:text-fill-[#2C2C2C]"
            placeholder="Enter officer username"
          />
        </div>
        <p className="mt-0.5 text-[10px] text-[#717171]">Enter your registered municipal administration username</p>
      </div>

      {/* Password Field */}
      <div>
        <div className="flex items-center justify-between mb-0.5">
          <label htmlFor="password" className="block text-[11px] font-semibold uppercase tracking-wider text-[#5F6368]">
            Authorization Key
          </label>
        </div>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Lock className="h-4 w-4 text-[#717171]" />
          </div>
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            data-lpignore="true"
            data-1p-ignore="true"
            data-form-type="other"
            required
            disabled={isPending}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="block w-full pl-9 pr-10 py-1.5 sm:py-2 bg-white border border-[#DADCE0] text-xs sm:text-sm text-[#2C2C2C] placeholder:text-[#9AA0A6] focus:outline-none focus:border-[#612D53] focus:ring-1 focus:ring-[#612D53] disabled:bg-[#F8F9FA] disabled:text-[#717171] disabled:cursor-not-allowed transition-colors [&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_white] [&:-webkit-autofill]:text-fill-[#2C2C2C]"
            placeholder="••••••••••••"
          />
          <button
            type="button"
            tabIndex={-1}
            disabled={isPending}
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#717171] hover:text-[#2C2C2C] disabled:opacity-50 cursor-pointer transition-colors"
            aria-label={showPassword ? 'Hide authorization key' : 'Show authorization key'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Remember Me / Session Persistence */}
      <div className="flex items-center justify-between pt-0.5">
        <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-[#5F6368]">
          <input
            type="checkbox"
            checked={rememberMe}
            disabled={isPending}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-[#DADCE0] text-[#612D53] focus:ring-[#612D53] disabled:cursor-not-allowed cursor-pointer"
          />
          <span>Remember this terminal (7 days)</span>
        </label>
      </div>

      {/* Action Button with Multi-Phase Loading State Management */}
      <div className="pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="btn-3d-primary w-full h-9 sm:h-10 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed transition-all"
        >
          {status === 'submitting' ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
              <span>Verifying Officer Credentials...</span>
            </>
          ) : status === 'success' ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Access Granted &bull; Redirecting...</span>
            </>
          ) : (
            <span>Login</span>
          )}
        </button>
      </div>
    </form>
  );
}
