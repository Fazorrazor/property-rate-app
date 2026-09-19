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
          className="border border-[#FF3B30]/30 bg-[#FF3B30]/10 p-3 text-xs text-[#FF3B30] flex items-start gap-2.5 rounded-xl"
        >
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1 leading-relaxed">
            <span className="font-semibold block mb-0.5">Authorization Failed</span>
            {errorMessage}
          </div>
        </div>
      )}

      {/* Officer Username Field */}
      <div>
        <label htmlFor="username" className="block text-xs font-medium text-[#6C6C70] mb-1.5">
          Username
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
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
            className="block w-full pl-10 pr-3.5 h-11 bg-[#F2F2F7] border border-[#E5E5EA] text-sm text-[#1C1C1E] placeholder:text-[#8E8E93] focus:outline-none focus:bg-white focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 disabled:opacity-60 disabled:cursor-not-allowed transition-all rounded-xl"
            placeholder="Enter username"
          />
        </div>
      </div>

      {/* Password Field */}
      <div>
        <label htmlFor="password" className="block text-xs font-medium text-[#6C6C70] mb-1.5">
          Password
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
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
            className="block w-full pl-10 pr-11 h-11 bg-[#F2F2F7] border border-[#E5E5EA] text-sm text-[#1C1C1E] placeholder:text-[#8E8E93] focus:outline-none focus:bg-white focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 disabled:opacity-60 disabled:cursor-not-allowed transition-all rounded-xl"
            placeholder="••••••••••••"
          />
          <button
            type="button"
            tabIndex={-1}
            disabled={isPending}
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#8E8E93] hover:text-[#1C1C1E] disabled:opacity-50 cursor-pointer transition-colors"
            aria-label={showPassword ? 'Hide authorization key' : 'Show authorization key'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Remember Me */}
      <div className="flex items-center justify-between pt-1">
        <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-[#6C6C70] hover:text-[#1C1C1E] transition-colors">
          <input
            type="checkbox"
            checked={rememberMe}
            disabled={isPending}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="w-4 h-4 rounded-md border-[#E5E5EA] bg-[#F2F2F7] text-[#007AFF] focus:ring-[#007AFF] focus:ring-offset-0 disabled:cursor-not-allowed cursor-pointer accent-[#007AFF]"
          />
          <span>Remember this session (7 days)</span>
        </label>
      </div>

      {/* Action Button */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="w-full h-11 text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed transition-all bg-[#007AFF] text-white hover:bg-[#0071E3] active:scale-[0.98] rounded-xl shadow-xs"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>Authorizing...</span>
            </>
          ) : (
            <span>Sign In</span>
          )}
        </button>
      </div>
    </form>
  );
}
