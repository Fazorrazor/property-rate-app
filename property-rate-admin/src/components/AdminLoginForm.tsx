'use client';

import React, { useState } from 'react';
import { adminLogin } from '../app/actions';
import { Lock, Phone, Eye, EyeOff, Loader2, CheckCircle2, ShieldAlert, ArrowRight } from 'lucide-react';

export default function AdminLoginForm() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const isPending = status === 'submitting' || status === 'success';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPending) return;

    // Instant Doherty Threshold feedback (<100ms)
    setStatus('submitting');
    setErrorMessage('');

    try {
      const res = await adminLogin(phoneNumber, password, rememberMe);
      if (res.success) {
        setStatus('success');
        // Optimistic transition into the console
        setTimeout(() => {
          window.location.href = '/';
        }, 400);
      } else {
        setStatus('error');
        setErrorMessage(res.error || 'Invalid municipal phone number or security authorization password.');
      }
    } catch (err) {
      setStatus('error');
      setErrorMessage('Municipal authentication gateway unavailable. Please check your network connection.');
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {/* Dynamic Error State (Strictly Zero Pills) */}
      {status === 'error' && errorMessage && (
        <div
          role="alert"
          className="border-l-4 border-[#C5221F] bg-[#FCE8E6]/80 p-3 text-xs text-[#C5221F] flex items-start gap-2.5 transition-opacity duration-150"
        >
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-[#C5221F]" />
          <div className="flex-1 leading-relaxed">
            <span className="font-semibold block mb-0.5">Authorization Failed</span>
            {errorMessage}
          </div>
        </div>
      )}

      {/* Phone Number Field */}
      <div>
        <label htmlFor="phone" className="block text-[11px] font-semibold uppercase tracking-wider text-[#5F6368] mb-1">
          Staff Phone Number
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Phone className="h-4 w-4 text-[#717171]" />
          </div>
          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            required
            disabled={isPending}
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            className="block w-full pl-9 pr-3 py-2 bg-white border border-[#DADCE0] text-sm text-[#2C2C2C] placeholder:text-[#9AA0A6] focus:outline-none focus:border-[#612D53] focus:ring-1 focus:ring-[#612D53] disabled:bg-[#F8F9FA] disabled:text-[#717171] disabled:cursor-not-allowed transition-colors [&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_white] [&:-webkit-autofill]:text-fill-[#2C2C2C]"
            placeholder="e.g. 0244123456 or +233..."
          />
        </div>
        <p className="mt-1 text-[10px] text-[#717171]">Enter your registered municipal administration phone contact</p>
      </div>

      {/* Password Field */}
      <div>
        <div className="flex items-center justify-between mb-1">
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
            autoComplete="current-password"
            required
            disabled={isPending}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="block w-full pl-9 pr-10 py-2 bg-white border border-[#DADCE0] text-sm text-[#2C2C2C] placeholder:text-[#9AA0A6] focus:outline-none focus:border-[#612D53] focus:ring-1 focus:ring-[#612D53] disabled:bg-[#F8F9FA] disabled:text-[#717171] disabled:cursor-not-allowed transition-colors [&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_white] [&:-webkit-autofill]:text-fill-[#2C2C2C]"
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
      <div className="pt-1.5">
        <button
          type="submit"
          disabled={isPending}
          className="btn-3d-primary w-full h-10 sm:h-11 text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed transition-all"
        >
          {status === 'submitting' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>Verifying Municipal Credentials...</span>
            </>
          ) : status === 'success' ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Access Granted &bull; Redirecting...</span>
            </>
          ) : (
            <>
              <span>Authorize & Access Console</span>
              <ArrowRight className="w-4 h-4 ml-0.5" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
