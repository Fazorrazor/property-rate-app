'use client';

import React, { useState } from 'react';
import { adminLogin } from '../app/actions';
import { Lock, User, Eye, EyeOff, Loader2, ShieldAlert } from 'lucide-react';

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

    setStatus('submitting');
    setErrorMessage('');

    try {
      const res = await adminLogin(cleanUsername, cleanPassword, rememberMe);
      if (res.success) {
        setStatus('success');
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
      className="space-y-4"
      onSubmit={handleSubmit}
      autoComplete="off"
      data-lpignore="true"
      data-1p-ignore="true"
      data-form-type="other"
    >
      {/* Anti-autofill Decoy Honeypots */}
      <input type="text" name="prevent_autofill_username" tabIndex={-1} aria-hidden="true" style={{ position: 'absolute', top: -9999, left: -9999, opacity: 0, height: 0, width: 0, pointerEvents: 'none' }} />
      <input type="password" name="prevent_autofill_password" tabIndex={-1} aria-hidden="true" style={{ position: 'absolute', top: -9999, left: -9999, opacity: 0, height: 0, width: 0, pointerEvents: 'none' }} />

      {/* Dynamic Error State */}
      {status === 'error' && errorMessage && (
        <div
          role="alert"
          className="border-l-4 border-[#F6465D] bg-[#F6465D]/10 p-2.5 text-xs text-[#F6465D] flex items-start gap-2 rounded-r-sm"
        >
          <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <div className="flex-1 leading-relaxed">
            <span className="font-semibold block mb-0.5">Authorization Failed</span>
            {errorMessage}
          </div>
        </div>
      )}

      {/* Officer Username Field */}
      <div>
        <label htmlFor="username" className="block text-[11px] font-semibold uppercase tracking-wider text-[#848E9C] mb-1.5 font-mono">
          Username
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <User className="h-4 w-4 text-[#848E9C]" />
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
            className="block w-full pl-9 pr-3 py-2 bg-[#0B0E11] border border-[#2B3139] text-sm text-[#EAECEF] placeholder:text-[#848E9C] focus:outline-none focus:border-[#FCD535] focus:ring-1 focus:ring-[#FCD535]/30 disabled:opacity-60 disabled:cursor-not-allowed transition-colors rounded-sm"
            placeholder="Enter username"
          />
        </div>
      </div>

      {/* Password Field */}
      <div>
        <label htmlFor="password" className="block text-[11px] font-semibold uppercase tracking-wider text-[#848E9C] mb-1.5 font-mono">
          Password
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Lock className="h-4 w-4 text-[#848E9C]" />
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
            className="block w-full pl-9 pr-10 py-2 bg-[#0B0E11] border border-[#2B3139] text-sm text-[#EAECEF] placeholder:text-[#848E9C] focus:outline-none focus:border-[#FCD535] focus:ring-1 focus:ring-[#FCD535]/30 disabled:opacity-60 disabled:cursor-not-allowed transition-colors rounded-sm"
            placeholder="••••••••••••"
          />
          <button
            type="button"
            tabIndex={-1}
            disabled={isPending}
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#848E9C] hover:text-[#EAECEF] disabled:opacity-50 cursor-pointer transition-colors"
            aria-label={showPassword ? 'Hide authorization key' : 'Show authorization key'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Remember Me */}
      <div className="flex items-center justify-between pt-0.5">
        <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-[#848E9C] hover:text-[#EAECEF] transition-colors">
          <input
            type="checkbox"
            checked={rememberMe}
            disabled={isPending}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="w-3.5 h-3.5 rounded-none border-[#2B3139] bg-[#0B0E11] text-[#FCD535] focus:ring-[#FCD535] focus:ring-offset-0 disabled:cursor-not-allowed cursor-pointer accent-[#FCD535]"
          />
          <span>Remember this terminal (7 days)</span>
        </label>
      </div>

      {/* Action Button */}
      <div className="pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="w-full h-10 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed transition-all bg-[#FCD535] text-[#181A20] hover:bg-[#F0C921] active:scale-[0.99] rounded-sm"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-[#181A20]" />
              <span>Logging in...</span>
            </>
          ) : (
            <span>Login</span>
          )}
        </button>
      </div>
    </form>
  );
}

