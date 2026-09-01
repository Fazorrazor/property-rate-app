"use client";

import { useState, useEffect, useContext } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, CheckCircle2, AlertTriangle, X } from "lucide-react";
import { OTPInput } from "@/components/ui/OTPInput";
import { AuthTransitionContext } from "../layout";
import { motion, AnimatePresence } from "framer-motion";
import { verifyOtpAndLogin, resendOtp } from "@/app/actions";

const STYLES = {
  pageContainer: "space-y-8",
  typographyHeader: "space-y-2.5",
  titleText: "text-3xl sm:text-4xl font-extrabold tracking-tight text-on-surface leading-tight",
  subtitleText: "text-on-surface-muted text-base leading-relaxed",
  editNumberButton: "text-[#4B1426] font-bold underline underline-offset-4 cursor-pointer hover:text-[#558467] inline",
  otpSection: "space-y-6 pt-2 h-[120px] flex flex-col justify-center",
  otpInputWrapper: "w-full space-y-6",
  otpInputPadding: "w-full py-2",
  verifyingState: "flex items-center justify-center gap-2 pt-2 text-sm font-bold text-[#4B1426] animate-pulse",
  spinner: "w-4 h-4 border-2 border-[#4B1426] border-t-transparent rounded-full animate-spin",
  resendRow: "flex items-center justify-between text-sm font-medium pt-1 px-1",
  resendTextNeutral: "text-on-surface-muted",
  resendButton: "inline-flex items-center gap-1.5 font-bold text-[#4B1426] hover:underline cursor-pointer",
  resendCountdownText: "text-on-surface-muted font-semibold",
  countdownNumber: "font-mono font-bold text-on-surface",
  successStateWrapper: "flex flex-col items-center justify-center space-y-3",
  successIconBadge: "w-20 h-20 bg-[#E6F4EA] rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/20",
  successIcon: "w-10 h-10 text-[#137333]",
  successText: "text-[#137333] font-black text-2xl tracking-tight",
};

export default function VerifyPage() {
  const router = useRouter();
  const { triggerDashboardExit } = useContext(AuthTransitionContext);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [countdown, setCountdown] = useState(45);
  const [canResend, setCanResend] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "error") => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  const handleResend = async () => {
    if (!canResend) return;
    setCanResend(false);
    showToast("Resending code...", "info");
    
    try {
      const res = await resendOtp();
      if (res.success) {
        showToast("A new code has been sent", "success");
        setCountdown(45);
      } else {
        showToast(res.error || "Failed to resend code", "error");
        setCanResend(true);
      }
    } catch (err) {
      showToast("Network error while resending", "error");
      setCanResend(true);
    }
  };

  const handleOtpComplete = async (otp: string) => {
    setIsVerifying(true);
    
    try {
      const res = await verifyOtpAndLogin(otp);

      if (res.success) {
        setIsVerifying(false);
        setIsSuccess(true);
        
        setTimeout(() => {
          triggerDashboardExit();
          setTimeout(() => {
            router.push("/dashboard");
          }, 200);
        }, 1000);
      } else {
        setIsVerifying(false);
        showToast(res.error || "Verification failed. Please try again.", "error");
      }
    } catch (err) {
      console.error(err);
      setIsVerifying(false);
      showToast("Verification error.", "error");
    }
  };

  return (
    <div className={STYLES.pageContainer}>
      {/* Title & Context */}
      <AnimatePresence>
        {!isSuccess && (
          <motion.header 
            initial={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0, overflow: "hidden", marginTop: 0, marginBottom: 0, paddingBottom: 0 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className={STYLES.typographyHeader}
          >
            <h1 className={STYLES.titleText}>
              Enter 6-Digit Code
            </h1>
            <p className={STYLES.subtitleText}>
              We sent a verification code to your phone.{" "}
              <button
                type="button"
                onClick={() => router.push("/auth/login")}
                className={STYLES.editNumberButton}
                disabled={isVerifying || isSuccess}
              >
                Edit number
              </button>
            </p>
          </motion.header>
        )}
      </AnimatePresence>

      {/* Spacious OTP Input Area with Enter Animation */}
      <motion.section 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className={STYLES.otpSection}
      >
        <AnimatePresence mode="wait">
          {!isSuccess ? (
            <motion.div 
              key="otp-input"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={STYLES.otpInputWrapper}
            >
              <div className={STYLES.otpInputPadding}>
                <OTPInput length={6} onComplete={handleOtpComplete} disabled={isVerifying} />
              </div>

              {isVerifying ? (
                <div className={STYLES.verifyingState}>
                  <div className={STYLES.spinner} />
                  <span>Verifying code...</span>
                </div>
              ) : (
                /* Clean Resend Row */
                <div className={STYLES.resendRow}>
                  <span className={STYLES.resendTextNeutral}>Didn&apos;t receive a code?</span>
                  {canResend ? (
                    <button
                      type="button"
                      onClick={handleResend}
                      className={STYLES.resendButton}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Resend Code</span>
                    </button>
                  ) : (
                    <span className={STYLES.resendCountdownText}>
                      Resend in <span className={STYLES.countdownNumber}>{countdown}s</span>
                    </span>
                  )}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="success-state"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className={STYLES.successStateWrapper}
            >
              <div className={STYLES.successIconBadge}>
                <CheckCircle2 className={STYLES.successIcon} strokeWidth={3} />
              </div>
              <span className={STYLES.successText}>Verified!</span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>
      {/* Google-Style Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm bg-[#17433F] text-white px-4 py-3 rounded-xl shadow-2xl border border-white/10 flex items-center justify-between gap-3 text-xs font-medium"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="w-4 h-4 text-[#F28B82] shrink-0" />
              <span className="text-[#F3F4F4] leading-tight">{toast.message}</span>
            </div>

            <button
              type="button"
              onClick={() => setToast(null)}
              className="text-[#9AA0A6] hover:text-white p-1 rounded cursor-pointer shrink-0"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
