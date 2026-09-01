"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronDown, Lock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { MtnMomoLogo, TelecelLogo, AirtelTigoLogo } from "@/components/icons/PaymentLogos";
import { identifyNetworkCarrier, NetworkProvider } from "@/lib/utils/network-detector";
import { motion, Variants, AnimatePresence } from "framer-motion";
import { loginWithPhone } from "@/app/actions";

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
};

const STYLES = {
  pageContainer: "space-y-8",
  typographyHeader: "space-y-2.5",
  titleText: "text-3xl sm:text-4xl font-extrabold tracking-tight text-on-surface leading-tight",
  subtitleText: "text-on-surface-muted text-base font-normal leading-relaxed",
  formSection: "space-y-6",
  inputGroup: "space-y-2",
  inputLabel: "block text-xs font-bold uppercase tracking-wider text-on-surface-muted",
  inputWrapper: "flex items-center gap-2.5",
  countryCodeButton: "h-14 px-3.5 rounded-2xl bg-surface border-2 border-border-light text-on-surface font-bold text-sm flex items-center gap-1.5 shadow-xs hover:border-border-light active:scale-95 transition-all cursor-pointer shrink-0",
  phoneInputContainer: "flex-1 rounded-2xl bg-surface border-2 border-border-light shadow-xs transition-all duration-150 focus-within:border-[#4B1426] focus-within:ring-4 focus-within:ring-[#4B1426]/5",
  phoneInput: "w-full h-14 px-4 bg-transparent text-lg sm:text-xl font-bold text-on-surface placeholder:text-[#80868B] outline-none font-mono tracking-wide",
  helpTextGroup: "flex items-center gap-1.5 text-xs text-on-surface-muted font-medium pt-1 px-0.5",
  submitButton: "btn-3d-primary w-full h-14 rounded-2xl font-bold text-base flex items-center justify-center gap-2 group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
};

export default function LoginPage() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState("024 400 0000");
  const [countryCode, setCountryCode] = useState("+233");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [detectedNetwork, setDetectedNetwork] = useState<NetworkProvider>(null);

  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const rawVal = e.target.value;
    setPhoneNumber(formatPhoneNumber(rawVal));
    setDetectedNetwork(identifyNetworkCarrier(rawVal));
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      const res = await loginWithPhone(phoneNumber);
      if (res.success) {
        router.push("/auth/verify");
      } else {
        setErrorMsg(res.error || "Authentication failed.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div 
      initial="hidden" 
      animate="visible" 
      variants={{
        visible: { transition: { staggerChildren: 0.03 } }
      }}
      className={STYLES.pageContainer}
    >
      <motion.header variants={itemVariants} className={STYLES.typographyHeader}>
        <h1 className={STYLES.titleText}>
          Sign In with Phone
        </h1>
        <p className={STYLES.subtitleText}>
          Enter your telephone number to authenticate and access your municipal property accounts.
        </p>
      </motion.header>

      <form onSubmit={handlePhoneSubmit} className={STYLES.formSection}>
        <motion.section variants={itemVariants} className={STYLES.inputGroup}>
          <label
            htmlFor="phone-input"
            className={STYLES.inputLabel}
          >
            Telephone Number
          </label>

          <div className={STYLES.inputWrapper}>
            <button
              type="button"
              className={STYLES.countryCodeButton}
            >
              <span className="text-base leading-none">🇬🇭</span>
              <span>{countryCode}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </button>

            <div className={STYLES.phoneInputContainer + " flex items-center pr-3"}>
              <input
                id="phone-input"
                type="tel"
                autoFocus
                required
                placeholder="024 400 0000"
                value={phoneNumber}
                onChange={handlePhoneChange}
                className={STYLES.phoneInput}
              />
              
              <AnimatePresence mode="popLayout">
                {detectedNetwork && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    className="shrink-0 pl-2 border-l border-border-light ml-1"
                  >
                    {detectedNetwork === "MTN" && <MtnMomoLogo className="w-8 h-8" />}
                    {detectedNetwork === "TELECEL" && <TelecelLogo className="w-8 h-8" />}
                    {detectedNetwork === "AIRTELTIGO" && <AirtelTigoLogo className="w-8 h-8" />}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {errorMsg && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-900 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed font-semibold">{errorMsg}</p>
            </div>
          )}

          <div className={STYLES.helpTextGroup}>
            <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>We will send an authentication code via SMS OTP.</span>
          </div>
        </motion.section>

        <motion.div variants={itemVariants}>
          <Button
            type="submit"
            size="lg"
            disabled={isLoading}
            className={STYLES.submitButton}
          >
            {isLoading ? (
              <span className="animate-pulse">Checking Registry...</span>
            ) : (
              <>
                <span>Continue</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </Button>
        </motion.div>
      </form>
    </motion.div>
  );
}
