"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { verifyPaymentTransaction } from "@/app/actions";
import { HeinzLoader } from "@/components/ui/HeinzLoader";
import { CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

function VerifyCheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reference = searchParams.get("reference");
  
  const [status, setStatus] = useState<"VERIFYING" | "SUCCESS" | "FAILED">("VERIFYING");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!reference) {
      setStatus("FAILED");
      setErrorMsg("No payment reference found.");
      return;
    }

    let isMounted = true;
    
    // We will poll the backend up to 5 times (in case the webhook takes a few seconds to process)
    const checkVerification = async (attempts = 0) => {
      try {
        const res = await verifyPaymentTransaction(reference);
        
        if (!isMounted) return;

        if (res.success && res.status === 'SUCCESS' && res.receipt) {
          setStatus("SUCCESS");
          // Redirect to receipt view or dashboard after 3 seconds
          setTimeout(() => {
            router.push("/receipts");
          }, 3000);
        } else if (res.success && res.status === 'PENDING') {
          if (attempts < 5) {
            setTimeout(() => checkVerification(attempts + 1), 2000);
          } else {
            setStatus("FAILED");
            setErrorMsg("Payment is taking longer than expected. We will notify you when it succeeds.");
          }
        } else {
          setStatus("FAILED");
          setErrorMsg(res.error || "Payment verification failed.");
        }
      } catch (err) {
        if (isMounted) {
          setStatus("FAILED");
          setErrorMsg("An unexpected error occurred verifying the payment.");
        }
      }
    };

    checkVerification();

    return () => {
      isMounted = false;
    };
  }, [reference, router]);

  return (
    <main className="min-h-screen bg-surface-subtle text-on-surface flex flex-col justify-center items-center max-w-md mx-auto w-full p-6 font-sans text-center">
      
      {status === "VERIFYING" && (
        <div className="space-y-4 flex flex-col items-center">
          <HeinzLoader size="large" />
          <h1 className="text-sm font-semibold text-on-surface uppercase tracking-wider mt-4">Verifying Payment...</h1>
          <p className="text-xs text-on-surface-muted max-w-[250px]">
            Please wait while we securely confirm your transaction with the treasury...
          </p>
        </div>
      )}

      {status === "SUCCESS" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-4 flex flex-col items-center"
        >
          <div className="w-16 h-16 bg-[#E6F4EA] rounded-full flex items-center justify-center mx-auto shadow-sm ring-4 ring-[#E6F4EA]/50">
            <CheckCircle2 className="w-8 h-8 text-[#188038]" />
          </div>
          <h1 className="text-base font-semibold text-on-surface">Payment Successful!</h1>
          <p className="text-xs text-on-surface-muted max-w-[250px]">
            Your municipal rate assessment has been settled. Redirecting to your official receipt...
          </p>
          <div className="pt-2 text-[10px] text-on-surface-muted flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" />
            <span>KKMA Treasury Encrypted</span>
          </div>
        </motion.div>
      )}

      {status === "FAILED" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-4 flex flex-col items-center"
        >
          <div className="w-16 h-16 bg-[#FCE8E6] rounded-full flex items-center justify-center mx-auto shadow-sm ring-4 ring-[#FCE8E6]/50">
            <AlertTriangle className="w-8 h-8 text-[#D93025]" />
          </div>
          <h1 className="text-base font-semibold text-on-surface">Payment Verification Failed</h1>
          <p className="text-xs text-on-surface-muted max-w-[280px]">
            {errorMsg}
          </p>
          <button
            onClick={() => router.push("/dashboard")}
            className="mt-4 px-5 py-2.5 rounded-xl bg-[#4B1426] hover:bg-[#558467] text-white font-medium text-xs transition-colors shadow-sm"
          >
            Return to Dashboard
          </button>
        </motion.div>
      )}

    </main>
  );
}

export default function VerifyCheckoutPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-surface-subtle text-on-surface flex flex-col justify-center items-center max-w-md mx-auto w-full p-6 font-sans text-center">
          <HeinzLoader size="large" />
          <h1 className="text-sm font-semibold text-on-surface uppercase tracking-wider mt-4">Loading Verification...</h1>
        </main>
      }
    >
      <VerifyCheckoutContent />
    </Suspense>
  );
}
