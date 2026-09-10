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
  const [receiptData, setReceiptData] = useState<{ receiptNumber?: string; amount?: number } | null>(null);

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
          setReceiptData(res.receipt);
          setStatus("SUCCESS");
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
  }, [reference]);

  return (
    <main className="min-h-screen bg-surface-subtle text-on-surface flex flex-col justify-center items-center max-w-md mx-auto w-full p-6 font-sans text-center">
      
      {status === "VERIFYING" && (
        <div className="flex flex-col items-center justify-center p-12">
          <HeinzLoader size="large" />
        </div>
      )}

      {status === "SUCCESS" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-4 flex flex-col items-center w-full"
        >
          <div className="w-16 h-16 bg-[#E6F4EA] rounded-full flex items-center justify-center mx-auto shadow-sm ring-4 ring-[#E6F4EA]/50">
            <CheckCircle2 className="w-8 h-8 text-[#188038]" />
          </div>
          <h1 className="text-base font-semibold text-on-surface">Payment Confirmed!</h1>
          <p className="text-xs text-on-surface-muted max-w-[280px]">
            Your municipal rate assessment has been reconciled with KKMA Treasury.
          </p>

          {receiptData && (
            <div className="p-3.5 bg-surface border border-border-light rounded-xl text-left w-full text-xs space-y-2 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-on-surface-muted">Official Receipt</span>
                <span className="font-mono font-semibold text-foreground">{receiptData.receiptNumber}</span>
              </div>
              {receiptData.amount && (
                <div className="flex items-center justify-between">
                  <span className="text-on-surface-muted">Amount</span>
                  <span className="font-semibold text-foreground">GH₵ {receiptData.amount.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          <div className="w-full space-y-2 pt-2">
            <button
              onClick={() => window.print()}
              className="w-full h-11 rounded-xl bg-[#4B1426] hover:bg-[#3E101F] text-white font-medium text-xs flex items-center justify-center transition-colors cursor-pointer shadow-xs"
            >
              Print / Save Receipt
            </button>
            <button
              onClick={() => window.close()}
              className="w-full h-10 rounded-xl bg-surface border border-border-light text-foreground text-xs font-medium flex items-center justify-center transition-colors cursor-pointer"
            >
              Close Window
            </button>
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
            onClick={() => window.history.back()}
            className="mt-4 px-5 py-2.5 rounded-xl bg-[#4B1426] hover:bg-[#3E101F] text-white font-medium text-xs transition-colors shadow-sm"
          >
            Back to Payment
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
        <main className="min-h-screen bg-surface-subtle flex flex-col justify-center items-center max-w-md mx-auto w-full p-6">
          <HeinzLoader size="large" />
        </main>
      }
    >
      <VerifyCheckoutContent />
    </Suspense>
  );
}
