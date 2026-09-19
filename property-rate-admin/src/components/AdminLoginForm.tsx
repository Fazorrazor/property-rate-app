'use client';

import React, { useState } from 'react';
import { adminLogin } from '../app/actions';
import { Lock, User, Eye, EyeOff, Loader2, ShieldAlert, Info } from 'lucide-react';

export default function AdminLoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [errorTooltip, setErrorTooltip] = useState<string | null>(null);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('expired') === 'true') {
        setStatus('error');
        setErrorMessage('Session expired. Please sign in again.');
        setErrorTooltip('Sessions automatically expire after 10 minutes of inactivity to protect your account.');
      } else if (params.get('superseded') === 'true') {
        setStatus('error');
        setErrorMessage('Signed out: account active on another device.');
        setErrorTooltip('Single-session protection automatically ends earlier sessions when you sign in elsewhere.');
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
      setErrorMessage('Please enter your username.');
      setErrorTooltip(null);
      return;
    }

    if (/^(\+?233|0)\d{8,10}$/.test(cleanUsername) || /^\d{10,}$/.test(cleanUsername)) {
      setStatus('error');
      setErrorMessage('Please use your username, not a phone number.');
      setErrorTooltip(null);
      return;
    }

    if (!/^[a-zA-Z0-9_.-]{3,50}$/.test(cleanUsername)) {
      setStatus('error');
      setErrorMessage('Username can only contain letters, numbers, hyphens, or underscores.');
      setErrorTooltip(null);
      return;
    }

    if (!cleanPassword) {
      setStatus('error');
      setErrorMessage('Please enter your password.');
      setErrorTooltip(null);
      return;
    }

    setStatus('submitting');
    setErrorMessage('');
    setErrorTooltip(null);

    try {
      const res = await adminLogin(cleanUsername, cleanPassword, rememberMe);
      if (res.success) {
        setStatus('success');
        setTimeout(() => {
          window.location.href = '/';
        }, 400);
      } else {
        setStatus('error');
        setErrorMessage(res.error || 'Incorrect username or password.');
      }
    } catch (err) {
      setStatus('error');
      setErrorMessage('Unable to sign in. Please try again.');
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

      {/* Dynamic Error State */}
      {status === 'error' && errorMessage && (
        <div
          role="alert"
          className="border-l-3 border-[#FF3B30] bg-[#FF3B30]/8 px-3 py-2 text-xs text-[#FF3B30] flex items-center justify-between gap-2 rounded-r-lg"
        >
          <div className="flex items-center gap-2 min-w-0">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span className="text-[11px] font-medium leading-tight">{errorMessage}</span>
          </div>
          {errorTooltip && (
            <div className="relative group shrink-0">
              <button
                type="button"
                className="w-4 h-4 rounded-full text-[#FF3B30]/80 hover:text-[#FF3B30] flex items-center justify-center cursor-help focus:outline-none"
                aria-label="More information"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
              {/* Apple-style Hover Bubble */}
              <div className="pointer-events-none absolute right-0 bottom-full mb-1.5 w-56 rounded-lg bg-[#1C1C1E] text-white text-[11px] leading-snug p-2.5 shadow-xl opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all z-30 font-normal">
                {errorTooltip}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Officer Username Field */}
      <div>
        <label htmlFor="username" className="block text-[11px] font-medium text-[#6C6C70] mb-1">
          Username
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <User className="h-4 w-4 text-[#8E8E93]" />
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
            className="block w-full pl-9 pr-3 h-10 bg-[#F2F2F7] border border-[#E5E5EA] text-xs text-[#1C1C1E] placeholder:text-[#8E8E93] focus:outline-none focus:bg-white focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 disabled:opacity-60 disabled:cursor-not-allowed transition-all rounded-xl"
            placeholder="Enter username"
          />
        </div>
      </div>

      {/* Password Field */}
      <div>
        <label htmlFor="password" className="block text-[11px] font-medium text-[#6C6C70] mb-1">
          Password
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Lock className="h-4 w-4 text-[#8E8E93]" />
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
            className="block w-full pl-9 pr-10 h-10 bg-[#F2F2F7] border border-[#E5E5EA] text-xs text-[#1C1C1E] placeholder:text-[#8E8E93] focus:outline-none focus:bg-white focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 disabled:opacity-60 disabled:cursor-not-allowed transition-all rounded-xl"
            placeholder="••••••••••••"
          />
          <button
            type="button"
            tabIndex={-1}
            disabled={isPending}
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#8E8E93] hover:text-[#1C1C1E] disabled:opacity-50 cursor-pointer transition-colors"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Remember Me */}
      <div className="flex items-center justify-between pt-0.5">
        <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] text-[#6C6C70] hover:text-[#1C1C1E] transition-colors">
          <input
            type="checkbox"
            checked={rememberMe}
            disabled={isPending}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-[#E5E5EA] bg-[#F2F2F7] text-[#007AFF] focus:ring-[#007AFF] focus:ring-offset-0 disabled:cursor-not-allowed cursor-pointer accent-[#007AFF]"
          />
          <span>Remember me</span>
        </label>
      </div>

      {/* Action Button */}
      <div className="pt-1.5">
        <button
          type="submit"
          disabled={isPending}
          className="w-full h-10 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed transition-all bg-[#007AFF] text-white hover:bg-[#0071E3] active:scale-[0.98] rounded-xl shadow-xs"
        >
          {isPending ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
              <span>Signing in...</span>
            </>
          ) : (
            <span>Sign In</span>
          )}
        </button>
      </div>
    </form>
  );
}
