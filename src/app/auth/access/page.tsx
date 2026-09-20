"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, ShieldAlert, Smartphone, ArrowRight, RefreshCw, Loader2 } from "lucide-react";
import { claimAccessGrant, loginWithPhone } from "@/app/actions";

function AccessTokenProcessor() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"VERIFYING" | "DEVICE_MISMATCH" | "EXPIRED" | "ERROR">("VERIFYING");
  const [errorMessage, setErrorMessage] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("ERROR");
      setErrorMessage("No security access token was provided in the link.");
      return;
    }

    let isMounted = true;

    async function verify() {
      try {
        const res = await claimAccessGrant(token as string);
        if (!isMounted) return;

        if (res.success) {
          if (res.destination === "dashboard") {
            const param = res.accountNumber ? `?accountNumber=${encodeURIComponent(res.accountNumber)}` : "";
            router.replace(`/dashboard${param}`);
          } else {
            if (res.isMulti) {
              const param = res.accountNumber
                ? `?propertyId=ALL&accountNumber=${encodeURIComponent(res.accountNumber)}`
                : `?propertyId=ALL`;
              router.replace(`/checkout${param}`);
            } else {
              const param = res.accountNumber ? `?propertyId=${encodeURIComponent(res.accountNumber)}` : "";
              router.replace(`/checkout${param}`);
            }
          }
        } else {
          if (res.error === "DEVICE_MISMATCH") {
            setStatus("DEVICE_MISMATCH");
            setPhoneNumber(res.phoneNumber || "");
            setMaskedPhone(res.maskedPhoneNumber || res.phoneNumber || "your phone number");
            setErrorMessage(res.message || "This secure billing link was already activated on another device.");
          } else if (res.error === "EXPIRED") {
            setStatus("EXPIRED");
            setPhoneNumber(res.phoneNumber || "");
            setMaskedPhone(res.maskedPhoneNumber || "");
            setErrorMessage(res.message || "This billing access link has expired.");
          } else {
            setStatus("ERROR");
            setErrorMessage(res.message || "Invalid or unrecognized security link.");
          }
        }
      } catch (err) {
        if (!isMounted) return;
        setStatus("ERROR");
        setErrorMessage("An unexpected network error occurred while verifying the secure link.");
      }
    }

    verify();

    return () => {
      isMounted = false;
    };
  }, [token, router]);

  const handleRequestOtp = async () => {
    if (!phoneNumber || isSendingOtp) return;
    setIsSendingOtp(true);
    try {
      const res = await loginWithPhone(phoneNumber);
      if (res.success) {
        router.push("/auth/verify");
      } else {
        setErrorMessage(res.error || "Failed to dispatch verification code.");
      }
    } catch {
      setErrorMessage("Network error dispatching verification code.");
    } finally {
      setIsSendingOtp(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 flex flex-col items-center justify-center min-h-[70vh] text-center space-y-6">
      {status === "VERIFYING" && (
        <div className="space-y-4 flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-surface border border-border-light flex items-center justify-center text-primary shadow-xs">
            <Loader2 className="w-7 h-7 animate-spin text-[#4B1426]" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-bold tracking-tight text-on-surface">Verifying Device Security</h2>
            <p className="text-sm text-on-surface-muted max-w-xs">
              Validating your one-time municipal link and securing your session...
            </p>
          </div>
        </div>
      )}

      {status === "DEVICE_MISMATCH" && (
        <div className="w-full space-y-6 flex flex-col items-center text-left">
          <div className="w-14 h-14 rounded-2xl bg-[#FFF8E1] border border-[#FFE082] flex items-center justify-center text-[#B78103] shadow-xs">
            <ShieldAlert className="w-7 h-7" />
          </div>

          <div className="space-y-2 text-center w-full">
            <h2 className="text-2xl font-black tracking-tight text-on-surface">Device Verification Required</h2>
            <p className="text-sm text-on-surface-muted leading-relaxed">
              This billing link was already activated on another mobile device. To protect ratepayer privacy, access to financial records on this device requires a one-time verification.
            </p>
          </div>

          <div className="w-full bg-surface border border-border-light rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-surface-subtle border border-border-light flex items-center justify-center text-on-surface-muted shrink-0">
                <Smartphone className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-muted">Registered Ratepayer Phone</p>
                <p className="text-base font-bold font-mono text-on-surface truncate">{maskedPhone}</p>
              </div>
            </div>
          </div>

          <div className="w-full space-y-3 pt-2">
            <button
              type="button"
              onClick={handleRequestOtp}
              disabled={isSendingOtp}
              className="btn-3d-primary w-full h-13 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSendingOtp ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending Verification Code...
                </>
              ) : (
                <>
                  Send Verification Code
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => router.push("/auth/login")}
              className="w-full h-11 rounded-2xl bg-surface border border-border-light text-on-surface font-semibold text-xs hover:bg-surface-subtle transition-colors cursor-pointer text-center"
            >
              Sign In With Another Number
            </button>
          </div>
        </div>
      )}

      {(status === "EXPIRED" || status === "ERROR") && (
        <div className="w-full space-y-6 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600 shadow-xs">
            <ShieldAlert className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black tracking-tight text-on-surface">Link Inactive or Expired</h2>
            <p className="text-sm text-on-surface-muted max-w-xs leading-relaxed">
              {errorMessage}
            </p>
          </div>

          <div className="w-full space-y-3 pt-2 max-w-xs">
            <button
              type="button"
              onClick={() => router.push("/auth/login")}
              className="btn-3d-primary w-full h-13 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              Proceed to Citizen Sign In
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AccessTokenPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-md mx-auto p-6 flex flex-col items-center justify-center min-h-[70vh] text-center space-y-4">
          <Loader2 className="w-7 h-7 animate-spin text-[#4B1426]" />
          <p className="text-sm text-on-surface-muted">Loading secure portal...</p>
        </div>
      }
    >
      <AccessTokenProcessor />
    </Suspense>
  );
}
