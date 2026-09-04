"use client";

import React, { useState, useRef, useEffect } from "react";

interface OTPInputProps {
  length?: number;
  onComplete: (otp: string) => void;
  disabled?: boolean;
}

export function OTPInput({ length = 6, onComplete, disabled = false }: OTPInputProps) {
  const [otp, setOtp] = useState<string[]>(new Array(length).fill(""));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (inputRefs.current[0] && !disabled) {
      inputRefs.current[0].focus();
    }
  }, [disabled]);

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    e.preventDefault();

    const pastedData = e.clipboardData.getData("text");
    const digits = pastedData.replace(/\D/g, "").slice(0, length);
    if (!digits) return;

    const newOtp = [...otp];
    const digitArray = digits.split("");

    for (let i = 0; i < length; i++) {
      if (i < digitArray.length) {
        newOtp[i] = digitArray[i];
      }
    }

    setOtp(newOtp);

    // Focus the box immediately after the last pasted digit (or the last box if full)
    const targetFocusIndex = Math.min(digitArray.length, length - 1);
    inputRefs.current[targetFocusIndex]?.focus();

    // Auto-trigger completion if all required digits are provided
    if (digitArray.length === length) {
      onComplete(newOtp.join(""));
    }
  };

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const value = e.target.value;
    const digitOnly = value.replace(/\D/g, "");

    const newOtp = [...otp];

    if (digitOnly.length > 1) {
      // Handle multi-character paste from mobile or browsers where onPaste was bypassed
      const pastedDigits = digitOnly.slice(0, length).split("");
      pastedDigits.forEach((d, i) => {
        newOtp[i] = d;
      });
      setOtp(newOtp);
      const nextIndex = Math.min(pastedDigits.length, length - 1);
      inputRefs.current[nextIndex]?.focus();
      if (newOtp.filter(Boolean).length === length) {
        onComplete(newOtp.join(""));
      }
      return;
    }

    newOtp[index] = digitOnly.slice(-1);
    setOtp(newOtp);

    // Auto-advance to next input
    if (digitOnly && index < length - 1 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit if all digits are entered
    const combinedOtp = newOtp.join("");
    if (combinedOtp.length === length && !newOtp.includes("")) {
      onComplete(combinedOtp);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === "Backspace") {
      if (!otp[index] && index > 0 && inputRefs.current[index - 1]) {
        // Move to previous and clear it
        const newOtp = [...otp];
        newOtp[index - 1] = "";
        setOtp(newOtp);
        inputRefs.current[index - 1]?.focus();
      } else if (otp[index]) {
        // Clear current
        const newOtp = [...otp];
        newOtp[index] = "";
        setOtp(newOtp);
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < length - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  return (
    <div className="w-full flex items-center justify-center gap-1.5 sm:gap-2.5">
      {otp.map((digit, index) => {
        const isMiddle = length === 6 && index === 3;
        return (
          <React.Fragment key={index}>
            {isMiddle && (
              <div className="w-2 h-0.5 bg-slate-400 rounded-full mx-0.5 shrink-0" />
            )}
            <input
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={1}
              value={digit}
              disabled={disabled}
              onPaste={handlePaste}
              onChange={(e) => handleChange(index, e)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              className={`flex-1 max-w-[52px] h-14 sm:h-16 text-center text-2xl font-black font-mono rounded-2xl border-2 transition-all duration-150 outline-none select-none ${
                disabled
                  ? "bg-slate-100 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed"
                  : digit
                  ? "bg-white border-slate-950 text-slate-950 shadow-xs ring-2 ring-slate-950/5"
                  : "bg-white border-slate-300 text-slate-950 hover:border-slate-400 focus:border-slate-950 focus:ring-4 focus:ring-slate-950/10 shadow-xs"
              }`}
            />
          </React.Fragment>
        );
      })}
    </div>
  );
}

