"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  CheckCircle2,
  Check,
  ReceiptText as ReceiptIcon,
  AlertTriangle,
  X,
} from "lucide-react";
import { HeinzLoader } from "@/components/ui/HeinzLoader";
import { CheckoutSkeleton } from "@/components/ui/Skeletons";
import { motion, AnimatePresence } from "framer-motion";
import {
  getCheckoutData,
  chargeMobileMoneyAction,
  verifyPaymentTransaction,
  initializePayment,
  verifySubscriberAction,
} from "@/app/actions";
import { identifyNetworkCarrier } from "@/lib/utils/network-detector";

type Step = "CHANNELS" | "DETAILS" | "PROCESSING" | "CONFIRMATION" | "FAILED";
type Channel = "MOMO" | "CARD";
type MoMoNetwork = "MTN" | "TELECEL" | "AIRTELTIGO";
type SettlementType = "TOTAL" | "ARREARS" | "CURRENT_FEE" | "PARTIAL";

interface CheckoutState {
  title: string;
  subtitle: string;
  accountNumber?: string;
  ownerName?: string;
  arrearsFormatted?: string;
  annualRateFormatted?: string;
  amountDueFormatted?: string;
  settlementType?: SettlementType;
  settlementLabel?: string;
  fiscalYear: number;
  actualAmountDue?: number;
  actualAmountDueFormatted?: string;
  minPartialAmount?: number;
  maxPartialAmount?: number;
  subtotal: number;
  subtotalFormatted: string;
  processingFee: number;
  processingFeeFormatted: string;
  totalAmount: number;
  totalAmountFormatted: string;
  verifiedSubscriberName?: string | null;
  isHubtelVerified?: boolean;
  preferredDisplayName?: string;
  portfolioProperties?: Array<{
    id: string;
    accountNumber: string;
    ownerDigitalAddress: string;
    propertyClassification: string;
    arrears: number;
    currentFee: number;
    totalAmountDue: number;
    status: string;
  }>;
  user: {
    id: string;
    name: string | null;
    phoneNumber: string;
  };
}

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawPropId = searchParams.get("propertyId") || searchParams.get("accountNumber") || "ALL";
  const propertyId = rawPropId.startsWith("ALL:") ? "ALL" : rawPropId;
  const rawAccountNumber = searchParams.get("accountNumber") || (rawPropId.startsWith("ALL:") ? rawPropId.substring(4) : undefined);
  const settlementTypeParam = (searchParams.get("type") as SettlementType) || "TOTAL";
  const amountParamStr = searchParams.get("amount");
  const customAmount = amountParamStr ? parseFloat(amountParamStr) : undefined;

  const [paymentMode, setPaymentMode] = useState<"FULL" | "PARTIAL">(customAmount ? "PARTIAL" : "FULL");
  const [customSubtotal, setCustomSubtotal] = useState<string>(customAmount ? String(customAmount) : "");
  const [tempAmount, setTempAmount] = useState<string>("");
  const [isEditingAmount, setIsEditingAmount] = useState(false);
  const [step, setStep] = useState<Step>("CHANNELS");
  const [channel, setChannel] = useState<Channel>("MOMO");
  const [network, setNetwork] = useState<MoMoNetwork>("MTN");
  
  // Input states
  const [phoneNumber, setPhoneNumber] = useState("");
  const [payerName, setPayerName] = useState("");
  const [cardholderName, setCardholderName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [isVerifyingSubscriber, setIsVerifyingSubscriber] = useState(false);
  const [isHubtelVerified, setIsHubtelVerified] = useState(false);

  const [checkoutData, setCheckoutData] = useState<CheckoutState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [receiptResult, setReceiptResult] = useState<{
    receiptNumber: string;
    receiptId: string;
    amountFormatted: string;
    paymentMethod: string;
    timestamp: string;
  } | null>(null);
  const [activeReference, setActiveReference] = useState<string | null>(null);
  const [pollingAttempts, setPollingAttempts] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);

  const showToast = (message: string, type: "success" | "error" | "info" = "error") => {
    setToast({ message, type });
  };

  const isMultiPropertyMode = Boolean(checkoutData?.portfolioProperties && checkoutData.portfolioProperties.length > 1);

  const selectedPropertiesSum = useMemo(() => {
    if (!isMultiPropertyMode || !checkoutData?.portfolioProperties) return 0;
    return checkoutData.portfolioProperties
      .filter((p) => selectedPropertyIds.includes(p.id))
      .reduce((sum, p) => sum + p.totalAmountDue, 0);
  }, [isMultiPropertyMode, checkoutData, selectedPropertyIds]);

  const actualBill = isMultiPropertyMode 
    ? (selectedPropertiesSum || checkoutData?.actualAmountDue || 0)
    : (checkoutData?.actualAmountDue ?? checkoutData?.subtotal ?? 0);

  const minPartialAmount = checkoutData?.minPartialAmount ?? Number((actualBill * 0.4).toFixed(2));
  const maxPartialAmount = checkoutData?.maxPartialAmount ?? actualBill;

  const activeSubtotal = paymentMode === "FULL" 
    ? (isMultiPropertyMode ? selectedPropertiesSum : (checkoutData?.subtotal || 0))
    : (parseFloat(customSubtotal) || checkoutData?.subtotal || 0);

  const activeTotalAmount = Math.ceil(activeSubtotal / 0.98);
  const activeProcessingFee = Number((activeTotalAmount - activeSubtotal).toFixed(2));

  const activeSubtotalFormatted = `GH₵ ${activeSubtotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const activeProcessingFeeFormatted = `GH₵ ${activeProcessingFee.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const activeTotalAmountFormatted = `GH₵ ${activeTotalAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const parsedTemp = parseFloat(tempAmount);
  let tempValidationError: string | null = null;
  if (!tempAmount.trim() || isNaN(parsedTemp)) {
    tempValidationError = "Please enter an amount";
  } else if (parsedTemp < minPartialAmount) {
    tempValidationError = `Minimum payment is 40% (GH₵ ${minPartialAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
  } else if (parsedTemp > maxPartialAmount) {
    tempValidationError = `Amount cannot exceed total bill of GH₵ ${maxPartialAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  const isTempValid = !tempValidationError && parsedTemp >= minPartialAmount && parsedTemp <= maxPartialAmount;

  const openEditAmountModal = () => {
    const currentVal = paymentMode === "PARTIAL" && customSubtotal ? customSubtotal : actualBill.toString();
    setTempAmount(currentVal);
    setIsEditingAmount(true);
  };

  const handleApplyCustom = () => {
    if (!isTempValid) return;
    const num = parseFloat(tempAmount);
    setCustomSubtotal(num.toString());
    setPaymentMode(num >= maxPartialAmount ? "FULL" : "PARTIAL");
    setIsEditingAmount(false);
  };

  const handleResetToFull = () => {
    setPaymentMode("FULL");
    setCustomSubtotal("");
    setTempAmount("");
    setIsEditingAmount(false);
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const tokenParam = searchParams.get("token") || undefined;

  useEffect(() => {
    async function load() {
      try {
        if (tokenParam) {
          router.replace(`/auth/access?token=${encodeURIComponent(tokenParam)}`);
          return;
        }

        const data = await getCheckoutData(propertyId, settlementTypeParam, customAmount, rawAccountNumber);
        if (data) {
          setCheckoutData(data);
          if (data.portfolioProperties && data.portfolioProperties.length > 0) {
            setSelectedPropertyIds(data.portfolioProperties.map((p) => p.id));
          }
          if (customAmount && data.minPartialAmount && data.maxPartialAmount) {
            const clamped = Math.min(Math.max(customAmount, data.minPartialAmount), data.maxPartialAmount);
            setCustomSubtotal(clamped.toString());
          }

          const userPhone = data.user?.phoneNumber || "";
          const resolvedName = data.verifiedSubscriberName || data.preferredDisplayName || data.user?.name || "";

          if (userPhone) {
            setPhoneNumber(userPhone);
            const detectedCarrier = identifyNetworkCarrier(userPhone);
            if (detectedCarrier) {
              setNetwork(detectedCarrier);
            }
          }

          if (resolvedName) {
            setPayerName(resolvedName);
            setCardholderName(resolvedName);
          }

          if (data.isHubtelVerified) {
            setIsHubtelVerified(true);
          }
        }
      } catch (err) {
        console.error("Failed to load checkout data:", err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [propertyId, settlementTypeParam, customAmount, rawAccountNumber, tokenParam, router]);

  // Debounced re-verification when user changes the mobile phone number
  useEffect(() => {
    const cleanDigits = phoneNumber.replace(/\D/g, "");
    const isPotentiallyComplete =
      (cleanDigits.length === 10 && cleanDigits.startsWith("0")) ||
      (cleanDigits.length === 12 && cleanDigits.startsWith("233"));

    if (!isPotentiallyComplete) {
      return;
    }

    const timer = setTimeout(async () => {
      setIsVerifyingSubscriber(true);
      try {
        const res = await verifySubscriberAction(phoneNumber);
        if (res.success && res.subscriberName) {
          setPayerName(res.subscriberName);
          setCardholderName(res.subscriberName);
          setIsHubtelVerified(true);
          if (res.network) {
            setNetwork(res.network);
          }
        } else {
          setIsHubtelVerified(false);
        }
      } catch {
        setIsHubtelVerified(false);
      } finally {
        setIsVerifyingSubscriber(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [phoneNumber]);

  // Polling Effect for Processing
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (step === "PROCESSING" && activeReference) {
      intervalId = setInterval(async () => {
        try {
          const res = await verifyPaymentTransaction(activeReference);
          
          if (res.success) {
            if (res.status === "SUCCESS") {
              clearInterval(intervalId);
              setReceiptResult({
                receiptNumber: res.receipt?.receiptNumber || "PENDING-GENERATION",
                receiptId: res.receipt?.receiptId || "PENDING",
                amountFormatted: checkoutData?.totalAmountFormatted || activeTotalAmountFormatted,
                paymentMethod: `${network} Mobile Money`,
                timestamp: new Date().toLocaleString(),
              });
              setStep("CONFIRMATION");
            } else if (res.status === "FAILED" || res.status === "ABANDONED") {
              clearInterval(intervalId);
              setStep("FAILED");
            } else {
              setPollingAttempts((prev) => {
                if (prev > 40) {
                  clearInterval(intervalId);
                  setStep("FAILED");
                  return prev;
                }
                return prev + 1;
              });
            }
          }
        } catch (err) {
          console.error("Polling verification error:", err);
        }
      }, 3000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [step, activeReference, checkoutData, network, activeTotalAmountFormatted]);

  const handleBack = () => {
    if (step === "DETAILS") {
      setStep("CHANNELS");
    } else if (step === "CHANNELS") {
      if (typeof window !== "undefined" && window.history.length > 1) {
        router.back();
      } else {
        const acc = rawAccountNumber || (propertyId !== "ALL" ? propertyId : "");
        router.push(acc ? `/dashboard?accountNumber=${encodeURIComponent(acc)}` : "/dashboard");
      }
    }
  };

  const handleProceedToDetails = () => {
    if (isMultiPropertyMode && selectedPropertyIds.length === 0) {
      showToast("Please select at least one property to settle.", "error");
      return;
    }
    if (paymentMode === "PARTIAL") {
      if (activeSubtotal < minPartialAmount || activeSubtotal > maxPartialAmount) {
        showToast(
          `Partial payment must be between GH₵ ${minPartialAmount.toFixed(2)} and GH₵ ${maxPartialAmount.toFixed(2)}`,
          "error"
        );
        return;
      }
    }
    setStep("DETAILS");
  };

  const executePayment = async (totalAmount: number, subtotal: number, processingFee: number) => {
    if (!checkoutData || isSubmitting) return;

    if (paymentMode === "PARTIAL") {
      if (subtotal < minPartialAmount || subtotal > maxPartialAmount) {
        showToast(
          `Partial payment must be between GH₵ ${minPartialAmount.toFixed(2)} and GH₵ ${maxPartialAmount.toFixed(2)}`,
          "error"
        );
        return;
      }
    }
    setIsSubmitting(true);
    
    try {
      const res = await chargeMobileMoneyAction({
        propertyId: propertyId || "ALL",
        settlementType: paymentMode === "PARTIAL" ? "PARTIAL" : settlementTypeParam,
        amount: totalAmount,
        subtotal: subtotal,
        processingFee: processingFee,
        phone: phoneNumber,
        network: network,
        targetPropertyIds: isMultiPropertyMode && selectedPropertyIds.length > 0 ? selectedPropertyIds : undefined,
        accountNumberOverride: rawAccountNumber,
      });

      if (res.success && res.reference) {
        setActiveReference(res.reference);
        setStep("PROCESSING");
        setPollingAttempts(0);
      } else {
        showToast(res.error || "Payment initialization failed.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("An unexpected error occurred initiating payment.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 19);
    const formatted = raw.replace(/(\d{4})(?=\d)/g, "$1 ");
    setCardNumber(formatted);
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 4);
    if (raw.length >= 3) {
      setCardExpiry(`${raw.slice(0, 2)}/${raw.slice(2)}`);
    } else {
      setCardExpiry(raw);
    }
  };

  const handleCvcChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 4);
    setCardCvc(raw);
  };

  const handleCompletePayment = async () => {
    if (!checkoutData || isSubmitting) return;

    if (channel === "MOMO") {
      if (!phoneNumber.trim()) {
        showToast("Please enter your Mobile Money phone number.", "error");
        return;
      }
      await executePayment(activeTotalAmount, activeSubtotal, activeProcessingFee);
    } else if (channel === "CARD") {
      if (!cardholderName.trim()) {
        showToast("Please enter the cardholder name.", "error");
        return;
      }
      const cleanCard = cardNumber.replace(/\s/g, "");
      if (cleanCard.length < 15) {
        showToast("Please enter a valid card number (15–16 digits).", "error");
        return;
      }
      if (cardExpiry.length < 5 || !cardExpiry.includes("/")) {
        showToast("Please enter a valid card expiry date (MM/YY).", "error");
        return;
      }
      if (cardCvc.length < 3) {
        showToast("Please enter a valid 3 or 4-digit CVC.", "error");
        return;
      }

      setIsSubmitting(true);
      try {
        const res = await initializePayment({
          propertyId: propertyId || "ALL",
          settlementType: paymentMode === "PARTIAL" ? "PARTIAL" : settlementTypeParam,
          amount: activeTotalAmount,
          channel: "CARD",
          callbackUrl: `${window.location.origin}/checkout/verify`,
          metadata: {
            cardholderName: cardholderName.trim(),
            cardLast4: cleanCard.slice(-4),
            oneTimePayment: true,
            isSubscription: false,
            subtotal: activeSubtotal,
            processingFee: activeProcessingFee,
          },
        });

        if (res.success && res.authorizationUrl) {
          window.location.href = res.authorizationUrl;
        } else {
          showToast(res.error || "Card payment initialization failed.", "error");
        }
      } catch (err) {
        console.error("Card payment error:", err);
        showToast("An unexpected error occurred authorizing card.", "error");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleCancelPayment = () => {
    setStep("FAILED");
  };

  if (isLoading) {
    return <CheckoutSkeleton />;
  }

  if (!checkoutData || checkoutData.totalAmount <= 0) {
    const accToView = rawAccountNumber || (propertyId !== "ALL" ? propertyId : undefined);
    return (
      <main className="min-h-screen bg-background text-foreground flex flex-col max-w-md mx-auto w-full font-sans">
        <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border-light/60 h-11 flex items-center justify-between px-4">
          <div className="w-16" />
          <h1 className="text-base font-semibold text-foreground tracking-tight text-center flex-1">
            KKMA
          </h1>
          <div className="w-16" />
        </header>

        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#E6F4EA] text-[#188038] flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-foreground">No Outstanding Balance</h2>
            <p className="text-xs text-on-surface-muted max-w-xs">
              This municipal property rate assessment has already been settled in full.
            </p>
          </div>
          <div className="flex flex-col gap-2.5 w-full max-w-xs pt-4">
            {accToView && (
              <button
                type="button"
                onClick={() => router.push(`/dashboard?accountNumber=${encodeURIComponent(accToView)}`)}
                className="w-full h-11 rounded-xl bg-[#007AFF] hover:bg-[#0062CC] text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                View Property Bill &amp; Receipts
              </button>
            )}
            <button
              type="button"
              onClick={() => window.close()}
              className="w-full h-11 rounded-xl bg-surface border border-border-light/70 text-foreground font-medium text-xs hover:bg-surface-subtle transition-colors cursor-pointer"
            >
              Close Window
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (isCompleted) {
    return (
      <main className="min-h-screen bg-background text-foreground flex flex-col max-w-md mx-auto w-full font-sans">
        <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border-light/60 h-11 flex items-center justify-between px-4">
          <div className="w-16" />
          <h1 className="text-base font-semibold text-foreground tracking-tight text-center flex-1">
            KKMA
          </h1>
          <div className="w-16" />
        </header>

        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
          <div className="w-16 h-16 bg-[#E6F4EA] rounded-full flex items-center justify-center mx-auto ring-4 ring-[#E6F4EA]/50">
            <CheckCircle2 className="w-8 h-8 text-[#188038]" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-foreground">
              Rate Settlement Complete
            </h2>
            <p className="text-xs text-on-surface-muted leading-relaxed max-w-xs">
              Your payment has been credited to Kpone-Katamanso Municipal Assembly.
            </p>
          </div>
          <div className="bg-surface rounded-xl border border-border-light/70 overflow-hidden divide-y divide-border-light/60 w-full text-xs">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-on-surface-muted">Payment Reference</span>
              <span className="font-mono font-semibold text-foreground">
                {receiptResult?.receiptNumber || checkoutData.title}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-on-surface-muted">Settlement Status</span>
              <span className="text-[#188038] font-medium">&bull; Reconciled</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => window.close()}
            className="w-full h-11 rounded-xl bg-[#007AFF] hover:bg-[#0062CC] text-white font-semibold text-xs transition-colors cursor-pointer"
          >
            Close Window
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col max-w-md mx-auto w-full font-sans">
      {/* GLOBAL APPLE FLAT NAVIGATION BAR */}
      {step !== "PROCESSING" && (
        <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border-light/60 h-11 flex items-center justify-between px-4">
          <div className="w-16 flex items-center">
            {step !== "CONFIRMATION" ? (
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center text-sm font-normal text-[#007AFF] hover:opacity-70 transition-opacity cursor-pointer p-0 bg-transparent border-0"
                aria-label="Back"
              >
                <ChevronLeft className="w-5 h-5 -ml-1 text-[#007AFF]" />
                <span>Back</span>
              </button>
            ) : null}
          </div>

          <h1 className="text-base font-semibold text-foreground tracking-tight text-center flex-1">
            KKMA
          </h1>

          <div className="w-16" />
        </header>
      )}

      {/* SCREEN 1: BILL INFO SCREEN */}
      {step === "CHANNELS" && (
        <motion.div
          key="step-bill-info"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex-1 flex flex-col"
        >
          <div className="flex-1 px-4 py-3 space-y-4">
            {/* Prominent Clean Initial Amount */}
            <div className="pt-3 pb-2 text-center">
              <span className="text-xs text-on-surface-muted block mb-1">Total Assessment</span>
              <span className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground block tabular-nums">
                {activeSubtotalFormatted}
              </span>
              {paymentMode === "PARTIAL" && (
                <span className="text-xs text-on-surface-muted block mt-1">
                  Custom installment of {checkoutData.actualAmountDueFormatted || checkoutData.subtotalFormatted}
                </span>
              )}
              <button
                type="button"
                onClick={openEditAmountModal}
                className="mt-2 text-xs text-[#007AFF] hover:underline font-medium cursor-pointer"
              >
                {paymentMode === "PARTIAL" ? "Edit Installment" : "Pay in Installments"}
              </button>
            </div>

            {/* Inset-Grouped Bill Metadata Rows */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-on-surface-muted uppercase tracking-wider px-3">
                Bill Information
              </p>
              <div className="bg-surface rounded-xl border border-border-light/70 overflow-hidden divide-y divide-border-light/60">
                <div className="flex items-center justify-between px-4 py-3 text-xs">
                  <span className="text-on-surface-muted">Ratepayer Name</span>
                  <span className="font-medium text-foreground">{checkoutData.ownerName || "—"}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3 text-xs">
                  <span className="text-on-surface-muted">Account Number</span>
                  <span className="font-mono font-semibold text-foreground">{checkoutData.accountNumber || "—"}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3 text-xs">
                  <span className="text-on-surface-muted">Billing Period</span>
                  <span className="font-medium text-foreground">{checkoutData.fiscalYear} Fiscal Year</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3 text-xs">
                  <span className="text-on-surface-muted">Prior Arrears</span>
                  <span className="font-medium text-foreground">{checkoutData.arrearsFormatted || "GH₵ 0.00"}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3 text-xs">
                  <span className="text-on-surface-muted">Current Assessment</span>
                  <span className="font-medium text-foreground">{checkoutData.annualRateFormatted || "GH₵ 0.00"}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3 text-xs">
                  <span className="text-on-surface-muted">Due Date</span>
                  <span className="font-medium text-foreground">Dec 31, {checkoutData.fiscalYear}</span>
                </div>
              </div>
            </div>

            {/* Multi-Property Portfolio Inset Group (if applicable) */}
            {isMultiPropertyMode && checkoutData.portfolioProperties && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-3">
                  <p className="text-[11px] font-medium text-on-surface-muted uppercase tracking-wider">
                    Properties in Assessment
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedPropertyIds.length === checkoutData.portfolioProperties!.length) {
                        setSelectedPropertyIds([]);
                      } else {
                        setSelectedPropertyIds(checkoutData.portfolioProperties!.map((p) => p.id));
                      }
                    }}
                    className="text-xs text-[#007AFF] hover:underline font-medium cursor-pointer"
                  >
                    {selectedPropertyIds.length === checkoutData.portfolioProperties.length
                      ? "Deselect All"
                      : "Select All"}
                  </button>
                </div>

                <div className="bg-surface rounded-xl border border-border-light/70 overflow-hidden divide-y divide-border-light/60">
                  {checkoutData.portfolioProperties.map((prop) => {
                    const isChecked = selectedPropertyIds.includes(prop.id);
                    return (
                      <div
                        key={prop.id}
                        onClick={() => {
                          setSelectedPropertyIds((prev) =>
                            prev.includes(prop.id) ? prev.filter((id) => id !== prop.id) : [...prev, prop.id]
                          );
                        }}
                        className={`p-3 transition-colors cursor-pointer flex items-center justify-between ${
                          isChecked ? "bg-surface" : "bg-surface-subtle/50 opacity-60 hover:opacity-100"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            readOnly
                            className="w-4 h-4 rounded border-border-light text-[#007AFF] focus:ring-0 cursor-pointer pointer-events-none"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-semibold text-foreground text-xs">
                                {prop.accountNumber}
                              </span>
                              <span className="text-[10px] text-on-surface-muted truncate">
                                ({prop.ownerDigitalAddress})
                              </span>
                            </div>
                            <div className="text-[10px] text-on-surface-muted">
                              {prop.arrears > 0 ? `Arrears: GH₵ ${prop.arrears.toFixed(2)} | ` : ""}Rate: GH₵{" "}
                              {prop.currentFee.toFixed(2)}
                            </div>
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-foreground tabular-nums shrink-0 ml-2">
                          GH₵{" "}
                          {prop.totalAmountDue.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Sticky Bottom CTA: Continue to Payment Details */}
          <div className="sticky bottom-0 bg-background/95 backdrop-blur-md px-4 py-3 border-t border-border-light/40 mt-auto">
            <button
              type="button"
              onClick={handleProceedToDetails}
              className="w-full h-12 rounded-xl bg-[#007AFF] hover:bg-[#0062CC] active:bg-[#0051A8] text-white font-semibold text-sm transition-colors cursor-pointer flex items-center justify-center shadow-xs"
            >
              Continue to Payment Details
            </button>
          </div>
        </motion.div>
      )}

      {/* SCREEN 2: PAYMENT DETAILS SCREEN */}
      {step === "DETAILS" && (
        <motion.div
          key="step-details"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex-1 flex flex-col"
        >
          <div className="flex-1 px-4 py-3 space-y-4">
            {/* Integrated Payment Mode Segmented Control */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-on-surface-muted uppercase tracking-wider px-3">
                Payment Method
              </p>
              <div className="bg-[#E5E5EA] p-1 rounded-lg flex items-center">
                <button
                  type="button"
                  onClick={() => setChannel("MOMO")}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    channel === "MOMO"
                      ? "bg-surface text-foreground shadow-xs"
                      : "text-on-surface-muted hover:text-foreground"
                  }`}
                >
                  Mobile Money
                </button>
                <button
                  type="button"
                  onClick={() => setChannel("CARD")}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    channel === "CARD"
                      ? "bg-surface text-foreground shadow-xs"
                      : "text-on-surface-muted hover:text-foreground"
                  }`}
                >
                  Credit / Debit Card
                </button>
              </div>
            </div>

            {/* Dynamic Inset Form for Mobile Money */}
            {channel === "MOMO" && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium text-on-surface-muted uppercase tracking-wider px-3">
                  Account Details
                </p>
                <div className="bg-surface rounded-xl border border-border-light/70 overflow-hidden divide-y divide-border-light/60">
                  {/* Carrier / Network Selector */}
                  <div className="px-4 py-2.5 flex items-center justify-between text-xs">
                    <span className="text-on-surface-muted font-normal">Network</span>
                    <div className="flex items-center gap-1.5">
                      {(["MTN", "TELECEL", "AIRTELTIGO"] as const).map((net) => (
                        <button
                          key={net}
                          type="button"
                          onClick={() => setNetwork(net)}
                          className={`px-2.5 py-1 text-xs rounded-md transition-all cursor-pointer ${
                            network === net
                              ? "bg-[#007AFF] text-white font-semibold shadow-xs"
                              : "bg-surface-subtle text-on-surface-muted hover:text-foreground hover:bg-[#E5E5EA]"
                          }`}
                        >
                          {net === "MTN" ? "MTN" : net === "TELECEL" ? "Telecel" : "AT"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Mobile Phone Number */}
                  <div className="px-4 py-2.5 space-y-1">
                    <label htmlFor="momo-phone" className="text-[11px] font-medium text-on-surface-muted block">
                      Mobile Number
                    </label>
                    <input
                      id="momo-phone"
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPhoneNumber(val);
                        const detected = identifyNetworkCarrier(val);
                        if (detected) setNetwork(detected);
                      }}
                      placeholder="024 000 0000"
                      className="w-full h-10 px-3 rounded-lg bg-surface-subtle border border-border-light/80 text-xs font-medium text-foreground focus:outline-none focus:border-[#007AFF] focus:bg-surface focus:ring-1 focus:ring-[#007AFF] transition-all placeholder:text-on-surface-muted/50"
                    />
                  </div>

                  {/* Account Name with Subtle Status */}
                  <div className="px-4 py-2.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <label htmlFor="momo-name" className="text-[11px] font-medium text-on-surface-muted">
                        Account Name
                      </label>
                      {isVerifyingSubscriber ? (
                        <span className="text-[10px] text-on-surface-muted animate-pulse">Verifying...</span>
                      ) : isHubtelVerified ? (
                        <span className="text-[10px] text-[#188038] font-medium flex items-center gap-0.5">
                          <Check className="w-3 h-3 text-[#188038]" />
                          Verified
                        </span>
                      ) : null}
                    </div>
                    <input
                      id="momo-name"
                      type="text"
                      value={payerName}
                      onChange={(e) => {
                        setPayerName(e.target.value);
                        setIsHubtelVerified(false);
                      }}
                      placeholder="Kwame Mensah"
                      className="w-full h-10 px-3 rounded-lg bg-surface-subtle border border-border-light/80 text-xs font-medium text-foreground focus:outline-none focus:border-[#007AFF] focus:bg-surface focus:ring-1 focus:ring-[#007AFF] transition-all placeholder:text-on-surface-muted/50"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Dynamic Inset Form for Card */}
            {channel === "CARD" && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium text-on-surface-muted uppercase tracking-wider px-3">
                  Card Details
                </p>
                <div className="bg-surface rounded-xl border border-border-light/70 overflow-hidden divide-y divide-border-light/60">
                  <div className="px-4 py-2.5 space-y-1">
                    <label htmlFor="card-name" className="text-[11px] font-medium text-on-surface-muted block">
                      Cardholder Name
                    </label>
                    <input
                      id="card-name"
                      type="text"
                      value={cardholderName}
                      onChange={(e) => setCardholderName(e.target.value)}
                      placeholder="Name as printed on card"
                      className="w-full h-10 px-3 rounded-lg bg-surface-subtle border border-border-light/80 text-xs font-medium text-foreground focus:outline-none focus:border-[#007AFF] focus:bg-surface focus:ring-1 focus:ring-[#007AFF] transition-all placeholder:text-on-surface-muted/50"
                    />
                  </div>

                  <div className="px-4 py-2.5 space-y-1">
                    <label htmlFor="card-number" className="text-[11px] font-medium text-on-surface-muted block">
                      Card Number
                    </label>
                    <input
                      id="card-number"
                      type="text"
                      value={cardNumber}
                      onChange={handleCardNumberChange}
                      placeholder="•••• •••• •••• ••••"
                      className="w-full h-10 px-3 rounded-lg bg-surface-subtle border border-border-light/80 font-mono text-xs font-medium text-foreground focus:outline-none focus:border-[#007AFF] focus:bg-surface focus:ring-1 focus:ring-[#007AFF] tracking-wider transition-all placeholder:text-on-surface-muted/50"
                    />
                  </div>

                  <div className="grid grid-cols-2 divide-x divide-border-light/60">
                    <div className="px-4 py-2.5 space-y-1">
                      <label htmlFor="card-expiry" className="text-[11px] font-medium text-on-surface-muted block">
                        Expires
                      </label>
                      <input
                        id="card-expiry"
                        type="text"
                        value={cardExpiry}
                        onChange={handleExpiryChange}
                        placeholder="MM/YY"
                        maxLength={5}
                        className="w-full h-10 px-3 rounded-lg bg-surface-subtle border border-border-light/80 font-mono text-xs font-medium text-foreground focus:outline-none focus:border-[#007AFF] focus:bg-surface focus:ring-1 focus:ring-[#007AFF] transition-all placeholder:text-on-surface-muted/50"
                      />
                    </div>

                    <div className="px-4 py-2.5 space-y-1">
                      <label htmlFor="card-cvc" className="text-[11px] font-medium text-on-surface-muted block">
                        CVC
                      </label>
                      <input
                        id="card-cvc"
                        type="password"
                        maxLength={4}
                        value={cardCvc}
                        onChange={handleCvcChange}
                        placeholder="•••"
                        className="w-full h-10 px-3 rounded-lg bg-surface-subtle border border-border-light/80 font-mono text-xs font-medium text-foreground focus:outline-none focus:border-[#007AFF] focus:bg-surface focus:ring-1 focus:ring-[#007AFF] transition-all placeholder:text-on-surface-muted/50"
                      />
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-on-surface-muted px-3 pt-0.5">
                  Supports Visa and Mastercard. One-time payment with no recurring billing.
                </p>
              </div>
            )}

            {/* Apple Wallet Style Financial Breakdown */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-on-surface-muted uppercase tracking-wider px-3">
                Payment Summary
              </p>
              <div className="bg-surface rounded-xl border border-border-light/70 overflow-hidden divide-y divide-border-light/60 px-4 py-1">
                <div className="flex justify-between items-center py-2.5 text-xs">
                  <span className="text-on-surface-muted">Base Amount</span>
                  <span className="text-foreground tabular-nums">{activeSubtotalFormatted}</span>
                </div>
                <div className="flex justify-between items-center py-2.5 text-xs">
                  <span className="text-on-surface-muted">Processing Fee (2%)</span>
                  <span className="text-foreground tabular-nums">{activeProcessingFeeFormatted}</span>
                </div>
                <div className="flex justify-between items-center py-3 text-sm font-semibold text-foreground">
                  <span>Total</span>
                  <span className="tabular-nums">{activeTotalAmountFormatted}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Sticky Bottom Action: Pay [Total Amount] */}
          <div className="sticky bottom-0 bg-background/95 backdrop-blur-md px-4 py-3 border-t border-border-light/40 mt-auto">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleCompletePayment}
              className={`w-full h-12 rounded-xl text-white font-semibold text-sm transition-colors flex items-center justify-center shadow-xs ${
                isSubmitting
                  ? "bg-[#007AFF]/60 cursor-not-allowed"
                  : "bg-[#007AFF] hover:bg-[#0062CC] active:bg-[#0051A8] cursor-pointer"
              }`}
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Authorizing...</span>
                </div>
              ) : (
                <span>Pay {activeTotalAmountFormatted}</span>
              )}
            </button>
          </div>
        </motion.div>
      )}

      {/* PROCESSING STATE */}
      {step === "PROCESSING" && (
        <motion.div
          key="step-processing"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-6"
        >
          <HeinzLoader size="large" />
          <div className="space-y-1.5">
            <h2 className="text-base font-semibold text-foreground">Check Your Phone</h2>
            <p className="text-xs text-on-surface-muted max-w-[260px] mx-auto leading-relaxed">
              Please enter your PIN on your mobile device to authorize this payment prompt.
            </p>
          </div>

          <div className="pt-6">
            <button
              type="button"
              onClick={handleCancelPayment}
              className="text-xs text-[#007AFF] hover:underline font-medium cursor-pointer"
            >
              Cancel Payment
            </button>
          </div>
        </motion.div>
      )}

      {/* FAILED STATE */}
      {step === "FAILED" && (
        <motion.div
          key="step-failed"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-6"
        >
          <div className="w-16 h-16 bg-[#FCE8E6] rounded-full flex items-center justify-center mx-auto ring-4 ring-[#FCE8E6]/50">
            <AlertTriangle className="w-8 h-8 text-[#C5221F]" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-base font-semibold text-foreground">Payment Failed</h2>
            <p className="text-xs text-on-surface-muted max-w-[260px] mx-auto leading-relaxed">
              The authorization timed out, failed, or was cancelled on your device. No funds were deducted.
            </p>
          </div>

          <div className="w-full max-w-xs pt-4">
            <button
              type="button"
              onClick={() => setStep("CHANNELS")}
              className="w-full h-11 rounded-xl bg-[#007AFF] hover:bg-[#0062CC] text-white font-semibold text-xs transition-colors cursor-pointer"
            >
              Retry Payment
            </button>
          </div>
        </motion.div>
      )}

      {/* CONFIRMATION STATE */}
      {step === "CONFIRMATION" && receiptResult && (
        <motion.div
          key="step-confirmation"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex-1 flex flex-col"
        >
          <div className="flex-1 px-4 py-5 space-y-5 text-center">
            <div className="w-16 h-16 bg-[#E6F4EA] rounded-full flex items-center justify-center mx-auto ring-4 ring-[#E6F4EA]/50">
              <Check className="w-8 h-8 text-[#188038]" />
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">
                Rate Payment Confirmed
              </h2>
              <p className="text-xs text-on-surface-muted">
                Municipal assessment successfully credited to KKMA Treasury.
              </p>
            </div>

            {/* Apple Grouped Inset Receipt Summary */}
            <div className="space-y-1.5 text-left">
              <p className="text-[11px] font-medium text-on-surface-muted uppercase tracking-wider px-3">
                Official Receipt
              </p>
              <div className="bg-surface rounded-xl border border-border-light/70 overflow-hidden divide-y divide-border-light/60 text-xs">
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-on-surface-muted">Receipt Number</span>
                  <span className="font-mono font-semibold text-foreground">
                    {receiptResult.receiptNumber}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-on-surface-muted">Amount Settled</span>
                  <span className="font-semibold text-foreground tabular-nums">
                    {receiptResult.amountFormatted}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-on-surface-muted">Payment Channel</span>
                  <span className="font-medium text-foreground">
                    {receiptResult.paymentMethod}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-on-surface-muted">Timestamp</span>
                  <span className="font-medium text-foreground">
                    {receiptResult.timestamp}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 bg-background/95 backdrop-blur-md px-4 py-3 border-t border-border-light/40 space-y-2 mt-auto">
            <button
              type="button"
              onClick={() => window.print()}
              className="w-full h-12 rounded-xl bg-[#007AFF] hover:bg-[#0062CC] text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
            >
              <ReceiptIcon className="w-4 h-4" />
              <span>Print / Download Receipt</span>
            </button>

            <button
              type="button"
              onClick={() => setIsCompleted(true)}
              className="w-full h-11 rounded-xl bg-surface border border-border-light/70 text-foreground hover:bg-surface-subtle text-xs font-medium flex items-center justify-center transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </motion.div>
      )}

      {/* TOAST NOTIFICATION */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm bg-[#1C1C1E] text-white px-4 py-3 rounded-xl shadow-2xl border border-white/10 flex items-center justify-between gap-3 text-xs font-medium"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center gap-2 min-w-0">
              {toast.type === "success" && (
                <CheckCircle2 className="w-4 h-4 text-[#81C995] shrink-0" />
              )}
              {toast.type === "error" && (
                <AlertTriangle className="w-4 h-4 text-[#F28B82] shrink-0" />
              )}
              <span className="text-[#F3F4F4] leading-tight truncate">{toast.message}</span>
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

      {/* EDIT AMOUNT MODAL (APPLE SHEET STYLE) */}
      <AnimatePresence>
        {isEditingAmount && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setIsEditingAmount(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              className="relative z-10 w-full max-w-sm bg-surface rounded-2xl border border-border-light/70 shadow-2xl p-5 space-y-4 font-sans"
            >
              <div className="flex items-center justify-between pb-2 border-b border-border-light/60">
                <h3 className="text-sm font-semibold text-foreground">Custom Installment</h3>
                <button
                  type="button"
                  onClick={() => setIsEditingAmount(false)}
                  className="text-on-surface-muted hover:text-foreground p-1 transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="custom-amount-input" className="text-xs text-on-surface-muted">
                  Amount in Ghanaian Cedi (GH₵)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-foreground">
                    GH₵
                  </span>
                  <input
                    id="custom-amount-input"
                    type="number"
                    step="0.01"
                    autoFocus
                    value={tempAmount}
                    onChange={(e) => setTempAmount(e.target.value)}
                    placeholder={actualBill.toString()}
                    className={`w-full h-11 pl-12 pr-4 rounded-xl bg-surface-subtle border text-sm font-semibold text-foreground focus:outline-none transition-colors ${
                      tempValidationError
                        ? "border-red-500 focus:border-red-500"
                        : "border-border-light/70 focus:border-[#007AFF]"
                    }`}
                  />
                </div>
                {tempValidationError && (
                  <p className="text-[11px] text-red-600 font-medium pt-0.5">
                    {tempValidationError}
                  </p>
                )}
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={handleResetToFull}
                  className="flex-1 h-10 rounded-xl bg-surface border border-border-light/70 text-foreground font-medium text-xs hover:bg-surface-subtle transition-colors cursor-pointer"
                >
                  Reset to Full
                </button>
                <button
                  type="button"
                  disabled={!isTempValid}
                  onClick={handleApplyCustom}
                  className={`flex-1 h-10 rounded-xl font-semibold text-xs transition-colors shadow-xs ${
                    isTempValid
                      ? "bg-[#007AFF] text-white hover:bg-[#0062CC] cursor-pointer"
                      : "bg-[#007AFF]/40 text-white/50 cursor-not-allowed"
                  }`}
                >
                  Apply Custom
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<CheckoutSkeleton />}>
      <CheckoutContent />
    </Suspense>
  );
}
