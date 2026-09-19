"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  Check,
  Lock,
  ReceiptText as ReceiptIcon,
  AlertTriangle,
  X,
  Edit2,
  Building2,
} from "lucide-react";
import {
  MtnMomoLogo,
  TelecelLogo,
  AirtelTigoLogo,
  VisaLogo,
} from "@/components/icons/PaymentLogos";
import { HeinzLoader } from "@/components/ui/HeinzLoader";
import { CheckoutSkeleton } from "@/components/ui/Skeletons";
import { motion, AnimatePresence } from "framer-motion";
import { getCheckoutData, chargeMobileMoneyAction, verifyPaymentTransaction, initializePayment, verifySubscriberAction } from "@/app/actions";
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
  const propertyId = searchParams.get("propertyId") || searchParams.get("accountNumber") || "ALL";
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
  const [isCompleted, setIsCompleted] = useState(false);
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
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const rawAccountNumber = searchParams.get("accountNumber") || undefined;
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

  const fmt = (n: number) => `GH₵ ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const activeSubtotalFormatted = fmt(activeSubtotal);
  const activeProcessingFeeFormatted = fmt(activeProcessingFee);
  const activeTotalAmountFormatted = fmt(activeTotalAmount);

  const parsedTemp = parseFloat(tempAmount);
  let tempValidationError: string | null = null;
  if (!tempAmount.trim() || isNaN(parsedTemp)) {
    tempValidationError = "Please enter an amount";
  } else if (parsedTemp < minPartialAmount) {
    tempValidationError = `Minimum payment is 40% (${fmt(minPartialAmount)})`;
  } else if (parsedTemp > maxPartialAmount) {
    tempValidationError = `Amount cannot exceed total bill of ${fmt(maxPartialAmount)}`;
  }
  const isTempValid = !tempValidationError && parsedTemp >= minPartialAmount && parsedTemp <= maxPartialAmount;

  const openEditAmountModal = () => {
    const currentVal = paymentMode === "PARTIAL" && customSubtotal ? customSubtotal : actualBill.toString();
    setTempAmount(currentVal);
    setIsEditingAmount(true);
  };

  const handleApplyCustom = () => {
    if (!isTempValid) return;
    setCustomSubtotal(parsedTemp.toFixed(2));
    setPaymentMode("PARTIAL");
    setIsEditingAmount(false);
  };

  const handleBack = () => {
    if (step === "DETAILS") setStep("CHANNELS");
  };

  const handleProceedToDetails = () => {
    if (isMultiPropertyMode && selectedPropertyIds.length === 0) {
      showToast("Please select at least one property to pay.", "error");
      return;
    }
    setStep("DETAILS");
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

  useEffect(() => {
    async function load() {
      try {
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
            if (detectedCarrier) setNetwork(detectedCarrier);
          }
          if (resolvedName) {
            setPayerName(resolvedName);
            setCardholderName(resolvedName);
          }
          if (data.isHubtelVerified) setIsHubtelVerified(true);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [propertyId, settlementTypeParam, customAmount, rawAccountNumber]);

  // Debounced phone verification
  useEffect(() => {
    const cleanDigits = phoneNumber.replace(/\D/g, "");
    const isPotentiallyComplete =
      (cleanDigits.length === 10 && cleanDigits.startsWith("0")) ||
      (cleanDigits.length === 12 && cleanDigits.startsWith("233"));

    if (!isPotentiallyComplete) {
      setIsHubtelVerified(false);
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
          if (res.network) setNetwork(res.network);
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

  // Polling
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
                amountFormatted: checkoutData?.totalAmountFormatted || "0.00",
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
        } catch {
          /* continue polling */
        }
      }, 3000);
    }
    return () => clearInterval(intervalId);
  }, [step, activeReference, network, checkoutData]);

  const executePayment = async (totalAmount: number, subtotal: number, processingFee: number) => {
    if (!checkoutData || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await chargeMobileMoneyAction({
        propertyId: propertyId || "ALL",
        settlementType: paymentMode === "PARTIAL" ? "PARTIAL" : settlementTypeParam,
        amount: totalAmount,
        subtotal,
        processingFee,
        phone: phoneNumber,
        network,
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
      showToast("An unexpected error occurred.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 19);
    setCardNumber(raw.replace(/(\d{4})(?=\d)/g, "$1 "));
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 4);
    setCardExpiry(raw.length >= 3 ? `${raw.slice(0, 2)}/${raw.slice(2)}` : raw);
  };

  const handleCvcChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCardCvc(e.target.value.replace(/\D/g, "").slice(0, 4));
  };

  const handleCompletePayment = async () => {
    if (!checkoutData || isSubmitting) return;
    if (channel === "MOMO") {
      if (!phoneNumber.trim()) {
        showToast("Please enter your Mobile Money phone number.", "error");
        return;
      }
      await executePayment(activeTotalAmount, activeSubtotal, activeProcessingFee);
    } else {
      const cleanCard = cardNumber.replace(/\s/g, "");
      if (cleanCard.length < 13) {
        showToast("Please enter a valid card number.", "error");
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

  const handleCancelPayment = () => setStep("FAILED");

  if (isLoading) return <CheckoutSkeleton />;

  // ── Empty / Settled State ──
  if (!checkoutData || checkoutData.totalAmount <= 0) {
    const accToView = rawAccountNumber || (propertyId !== "ALL" ? propertyId : undefined);
    return (
      <main className="min-h-screen bg-[#F0F2F5] max-w-md mx-auto flex flex-col justify-center items-center text-center p-6 font-sans gap-5">
        <div className="w-16 h-16 bg-[#E6F4EA] rounded-full flex items-center justify-center shadow-sm">
          <CheckCircle2 className="w-8 h-8 text-[#1A7336]" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-black text-[#121212]">All Settled</h2>
          <p className="text-sm text-[#717171] max-w-[260px] leading-relaxed">
            This municipal property rate assessment has already been settled in full.
          </p>
        </div>
        <div className="flex flex-col gap-2.5 w-full max-w-xs">
          {accToView && (
            <button
              onClick={() => router.push(`/dashboard?accountNumber=${encodeURIComponent(accToView)}`)}
              className="w-full h-12 rounded-2xl bg-[#121330] text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg"
            >
              <Building2 className="w-4 h-4" />
              <span>View Property Bill</span>
            </button>
          )}
          <button
            onClick={() => window.close()}
            className="w-full h-10 rounded-xl border border-[#DADCE0] bg-white text-[#121212] font-medium text-sm hover:bg-[#F0F2F5] transition-colors cursor-pointer"
          >
            Close Window
          </button>
        </div>
      </main>
    );
  }

  if (isCompleted) {
    return (
      <main className="min-h-screen bg-[#F0F2F5] flex flex-col items-center justify-center max-w-md mx-auto w-full p-6 text-center gap-5 font-sans">
        <div className="w-16 h-16 bg-[#E6F4EA] rounded-full flex items-center justify-center mx-auto shadow-sm ring-4 ring-[#E6F4EA]/50">
          <CheckCircle2 className="w-8 h-8 text-[#1A7336]" />
        </div>
        <div>
          <h2 className="text-xl font-black text-[#121212]">Rate Settlement Complete</h2>
          <p className="text-sm text-[#717171] leading-relaxed mt-1 max-w-[280px] mx-auto">
            Your payment has been credited to Kpone-Katamanso Municipal Assembly.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.close()}
          className="w-full max-w-xs h-12 rounded-2xl bg-[#121330] hover:bg-black text-white font-bold text-sm flex items-center justify-center transition-colors cursor-pointer shadow-lg"
        >
          Done
        </button>
      </main>
    );
  }

  const networkLabel = network === "MTN" ? "MTN MoMo" : network === "TELECEL" ? "Telecel Cash" : "AT Money";

  return (
    <main className="min-h-screen bg-[#F0F2F5] text-[#121212] flex flex-col max-w-md mx-auto w-full font-sans">

      {/* ── Top Nav Bar ── */}
      {step !== "PROCESSING" && (
        <header className="bg-white border-b border-[#DADCE0] px-4 py-3 flex items-center justify-between sticky top-0 z-30">
          {step === "DETAILS" ? (
            <button
              type="button"
              onClick={handleBack}
              className="w-9 h-9 rounded-xl bg-[#F0F2F5] flex items-center justify-center text-[#717171] hover:bg-[#E8EAED] transition-colors cursor-pointer"
              aria-label="Go Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          ) : (
            <div className="w-9 h-9" />
          )}

          <div className="text-center">
            <h1 className="text-xs font-bold text-[#121212] uppercase tracking-wider">
              {step === "CONFIRMATION" ? "Official Receipt" : "Property Rate Payment"}
            </h1>
            <p className="text-[10px] text-[#717171] font-normal flex items-center justify-center gap-1 mt-0.5">
              <Lock className="w-2.5 h-2.5" />
              <span>Municipal Treasury Encrypted</span>
            </p>
          </div>

          <div className="w-9 h-9 rounded-xl bg-[#F0F2F5] flex items-center justify-center text-[#717171]">
            <ShieldCheck className="w-4 h-4 text-[#34A853]" />
          </div>
        </header>
      )}

      <div className="flex-1 flex flex-col px-4 py-4 gap-3">
        <AnimatePresence mode="wait">

          {/* ══ STEP 1: CHANNELS ══ */}
          {step === "CHANNELS" && (
            <motion.div
              key="step-channels"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex flex-col gap-3"
            >
              {/* Bill Summary Card */}
              <div className="bg-white rounded-2xl border border-[#DADCE0] overflow-hidden shadow-sm">
                {/* Header band */}
                <div className="bg-[#121330] px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-white/50 font-semibold uppercase tracking-widest">Bill Payment</p>
                    <p className="text-white font-black text-lg leading-tight mt-0.5">
                      {checkoutData.ownerName || "Municipal Ratepayer"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-white/50 font-semibold uppercase tracking-widest">FY {checkoutData.fiscalYear}</p>
                    <p className="text-white/70 text-xs font-medium mt-0.5">Kpone-Katamanso</p>
                  </div>
                </div>

                {/* Bill rows */}
                <div className="px-4 py-3 space-y-2 border-b border-[#F0F2F5] text-xs">
                  {checkoutData.accountNumber && (
                    <div className="flex items-center justify-between">
                      <span className="text-[#717171]">Account No.</span>
                      <span className="font-mono font-bold text-[#121212]">{checkoutData.accountNumber}</span>
                    </div>
                  )}
                  {checkoutData.arrearsFormatted && (
                    <div className="flex items-center justify-between">
                      <span className="text-[#717171]">Arrears</span>
                      <span className="font-semibold text-[#121212] tabular-nums">{checkoutData.arrearsFormatted}</span>
                    </div>
                  )}
                  {checkoutData.annualRateFormatted && (
                    <div className="flex items-center justify-between">
                      <span className="text-[#717171]">Annual Rate</span>
                      <span className="font-semibold text-[#121212] tabular-nums">{checkoutData.annualRateFormatted}</span>
                    </div>
                  )}
                </div>

                {/* Multi-property selector */}
                {isMultiPropertyMode && checkoutData.portfolioProperties && (
                  <div className="px-4 py-3 border-b border-[#F0F2F5]">
                    <div className="flex items-center justify-between mb-2.5">
                      <p className="text-xs font-bold text-[#121212]">
                        Select Properties to Pay
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
                        className="text-[11px] font-bold text-[#121330] hover:underline cursor-pointer"
                      >
                        {selectedPropertyIds.length === checkoutData.portfolioProperties.length ? "Deselect All" : "Select All"}
                      </button>
                    </div>

                    <div className="space-y-1.5 max-h-52 overflow-y-auto">
                      {checkoutData.portfolioProperties.map((prop) => {
                        const isChecked = selectedPropertyIds.includes(prop.id);
                        return (
                          <div
                            key={prop.id}
                            onClick={() =>
                              setSelectedPropertyIds((prev) =>
                                prev.includes(prop.id)
                                  ? prev.filter((id) => id !== prop.id)
                                  : [...prev, prop.id]
                              )
                            }
                            className={`rounded-xl border p-3 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                              isChecked
                                ? "bg-[#F0F2F5] border-[#121330]/30"
                                : "bg-white border-[#E8EAED] opacity-60 hover:opacity-100"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${isChecked ? "bg-[#121330] border-[#121330]" : "border-[#DADCE0] bg-white"}`}>
                                {isChecked && <Check className="w-2.5 h-2.5 text-white" />}
                              </div>
                              <div className="min-w-0">
                                <p className="font-mono font-bold text-[#121212] text-xs">{prop.accountNumber}</p>
                                <p className="text-[10px] text-[#717171] truncate">
                                  {prop.arrears > 0 ? `Arr: GH₵ ${prop.arrears.toFixed(2)} · ` : ""}Rate: GH₵ {prop.currentFee.toFixed(2)}
                                </p>
                              </div>
                            </div>
                            <span className="text-sm font-black text-[#121212] tabular-nums shrink-0">
                              GH₵ {prop.totalAmountDue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Amount due row */}
                <div className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-[#717171] uppercase tracking-widest">
                        {paymentMode === "PARTIAL" ? "Custom Installment" : "Amount Due"}
                      </p>
                      {paymentMode === "PARTIAL" && (
                        <p className="text-[10px] text-[#717171] mt-0.5">
                          of {checkoutData.actualAmountDueFormatted || checkoutData.subtotalFormatted} full bill
                        </p>
                      )}
                    </div>
                    <p className="text-2xl font-black text-[#121212] tracking-tight">{activeSubtotalFormatted}</p>
                  </div>
                  <button
                    type="button"
                    onClick={openEditAmountModal}
                    className="mt-2.5 w-full flex items-center justify-center gap-1.5 h-9 rounded-xl bg-[#F0F2F5] hover:bg-[#E8EAED] border border-[#DADCE0] text-[#717171] hover:text-[#121212] transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span className="text-xs font-medium">
                      {paymentMode === "PARTIAL" ? "Change Custom Amount" : "Pay Custom Amount"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Payment Channels */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <p className="text-[11px] font-bold text-[#717171] uppercase tracking-widest">Payment Channel</p>
                  <p className="text-[11px] text-[#717171]">Step 1 of 2</p>
                </div>

                {/* MoMo */}
                <div
                  onClick={() => setChannel("MOMO")}
                  className={`bg-white rounded-2xl border p-4 transition-all cursor-pointer flex items-center justify-between shadow-sm ${
                    channel === "MOMO" ? "border-[#121330]" : "border-[#DADCE0] hover:border-[#ADADAD]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                      <MtnMomoLogo className="w-7 h-7" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#121212]">Mobile Money</p>
                      <p className="text-[11px] text-[#717171]">MTN · Telecel · AT Money</p>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${channel === "MOMO" ? "border-[#121330] bg-[#121330]" : "border-[#DADCE0]"}`}>
                    {channel === "MOMO" && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                </div>

                {/* Card */}
                <div
                  onClick={() => setChannel("CARD")}
                  className={`bg-white rounded-2xl border p-4 transition-all cursor-pointer flex items-center justify-between shadow-sm ${
                    channel === "CARD" ? "border-[#121330]" : "border-[#DADCE0] hover:border-[#ADADAD]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-[#F0F2F5] flex items-center justify-center shrink-0 p-1.5">
                      <VisaLogo className="w-full h-full" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#121212]">Credit / Debit Card</p>
                      <p className="text-[11px] text-[#717171]">VISA · Mastercard</p>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${channel === "CARD" ? "border-[#121330] bg-[#121330]" : "border-[#DADCE0]"}`}>
                    {channel === "CARD" && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                </div>
              </div>

              {/* Proceed CTA */}
              <button
                type="button"
                onClick={handleProceedToDetails}
                className="w-full h-14 rounded-2xl bg-[#121330] hover:bg-black active:scale-[0.98] transition-all text-white font-black text-sm flex items-center justify-between px-5 cursor-pointer shadow-xl mt-1"
              >
                <span>Continue to Payment Details</span>
                <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                  <ArrowLeft className="w-4 h-4 text-white rotate-180" />
                </div>
              </button>

              <p className="text-center text-[10px] text-[#ADADAD] font-medium pb-2">
                Local Governance Act, 2016 (Act 936) · KKMA
              </p>
            </motion.div>
          )}

          {/* ══ STEP 2: PAYMENT DETAILS ══ */}
          {step === "DETAILS" && (
            <motion.div
              key="step-details"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              className="flex flex-col gap-3"
            >
              {/* Amount header */}
              <div className="bg-[#121330] rounded-2xl px-4 py-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-white/50 font-bold uppercase tracking-widest">Step 2 of 2</p>
                  <p className="text-white font-black text-lg mt-0.5">
                    {channel === "MOMO" ? "Mobile Money" : "Card Payment"}
                  </p>
                  <p className="text-white/50 text-[11px] mt-0.5">
                    {channel === "MOMO"
                      ? "Confirm number · Authorize MoMo prompt on your phone"
                      : "Enter card details to complete"}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-white/50 font-semibold uppercase tracking-widest">Total</p>
                  <p className="text-white font-black text-2xl tracking-tight">{activeTotalAmountFormatted}</p>
                  <p className="text-white/40 text-[10px]">incl. 2% fee</p>
                </div>
              </div>

              {/* Form card */}
              <div className="bg-white rounded-2xl border border-[#DADCE0] p-4 shadow-sm space-y-4">
                {channel === "MOMO" && (
                  <>
                    {/* Network selector */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-[#717171] uppercase tracking-wider block">Network</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(["MTN", "TELECEL", "AIRTELTIGO"] as MoMoNetwork[]).map((net) => {
                          const Logo = net === "MTN" ? MtnMomoLogo : net === "TELECEL" ? TelecelLogo : AirtelTigoLogo;
                          const label = net === "MTN" ? "MTN MoMo" : net === "TELECEL" ? "Telecel" : "AT Money";
                          return (
                            <button
                              key={net}
                              type="button"
                              onClick={() => setNetwork(net)}
                              className={`relative p-3 rounded-xl border text-center font-medium transition-all cursor-pointer flex flex-col items-center gap-1.5 text-xs ${
                                network === net
                                  ? "border-2 border-[#121330] bg-[#F0F2F5] text-[#121330] font-bold"
                                  : "border border-[#DADCE0] bg-white text-[#717171] opacity-60 hover:opacity-100"
                              }`}
                            >
                              {network === net && <Check className="w-3 h-3 text-[#121330] absolute top-1.5 right-1.5" />}
                              <Logo className="w-6 h-6" />
                              <span>{label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Phone */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#717171] uppercase tracking-wider block">Mobile Money Number</label>
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPhoneNumber(val);
                          const detected = identifyNetworkCarrier(val);
                          if (detected) setNetwork(detected);
                        }}
                        placeholder="e.g. 024 000 0000"
                        className="w-full h-12 px-4 rounded-xl bg-[#F0F2F5] border border-[#DADCE0] text-sm font-semibold text-[#121212] focus:outline-none focus:border-[#121330] transition-colors"
                      />
                    </div>

                    {/* Name */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-[#717171] uppercase tracking-wider">Account Holder Name</label>
                        {isVerifyingSubscriber ? (
                          <span className="text-[11px] text-[#717171] flex items-center gap-1">
                            <span className="w-2.5 h-2.5 border border-t-transparent border-[#121330] rounded-full animate-spin shrink-0" />
                            Verifying...
                          </span>
                        ) : isHubtelVerified ? (
                          <span className="text-[11px] text-emerald-700 flex items-center gap-1 font-semibold">
                            <Check className="w-3 h-3" /> Verified
                          </span>
                        ) : null}
                      </div>
                      <input
                        type="text"
                        value={payerName}
                        onChange={(e) => { setPayerName(e.target.value); setIsHubtelVerified(false); }}
                        placeholder="e.g. Kwame Mensah"
                        className="w-full h-12 px-4 rounded-xl bg-[#F0F2F5] border border-[#DADCE0] text-sm font-semibold text-[#121212] focus:outline-none focus:border-[#121330] transition-colors"
                      />
                    </div>
                  </>
                )}

                {channel === "CARD" && (
                  <>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-[#717171] uppercase tracking-wider">Cardholder Name</label>
                        {isHubtelVerified && (
                          <span className="text-[11px] text-emerald-700 flex items-center gap-1 font-semibold">
                            <Check className="w-3 h-3" /> Verified
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={cardholderName}
                        onChange={(e) => setCardholderName(e.target.value)}
                        placeholder="Name as it appears on card"
                        className="w-full h-12 px-4 rounded-xl bg-[#F0F2F5] border border-[#DADCE0] text-sm font-semibold text-[#121212] focus:outline-none focus:border-[#121330] transition-colors"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#717171] uppercase tracking-wider block">Card Number</label>
                      <input
                        type="text"
                        value={cardNumber}
                        onChange={handleCardNumberChange}
                        placeholder="•••• •••• •••• ••••"
                        className="w-full h-12 px-4 rounded-xl bg-[#F0F2F5] border border-[#DADCE0] text-sm font-mono font-semibold text-[#121212] tracking-wider focus:outline-none focus:border-[#121330] transition-colors"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-[#717171] uppercase tracking-wider block">Expiry (MM/YY)</label>
                        <input
                          type="text"
                          value={cardExpiry}
                          onChange={handleExpiryChange}
                          placeholder="MM/YY"
                          maxLength={5}
                          className="w-full h-12 px-4 rounded-xl bg-[#F0F2F5] border border-[#DADCE0] text-sm font-mono font-semibold text-[#121212] text-center focus:outline-none focus:border-[#121330] transition-colors"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-[#717171] uppercase tracking-wider block">CVC / CVV</label>
                        <input
                          type="password"
                          maxLength={4}
                          value={cardCvc}
                          onChange={handleCvcChange}
                          placeholder="•••"
                          className="w-full h-12 px-4 rounded-xl bg-[#F0F2F5] border border-[#DADCE0] text-sm font-mono font-semibold text-[#121212] text-center focus:outline-none focus:border-[#121330] transition-colors"
                        />
                      </div>
                    </div>
                    <p className="text-[11px] text-[#717171] pt-1 border-t border-[#F0F2F5]">
                      Supports Visa, Mastercard, Virtual & Prepaid. One-time payment only — no recurring charges.
                    </p>
                  </>
                )}
              </div>

              {/* Order Summary */}
              <div className="bg-white rounded-2xl border border-[#DADCE0] px-4 py-3 shadow-sm space-y-2 text-xs">
                <p className="text-[10px] font-bold text-[#717171] uppercase tracking-widest">Order Summary</p>
                <div className="flex justify-between text-[#717171]">
                  <span>Settlement Amount</span>
                  <span className="font-semibold text-[#121212] tabular-nums">{activeSubtotalFormatted}</span>
                </div>
                <div className="flex justify-between text-[#717171]">
                  <span>Processing Fee (2%)</span>
                  <span className="font-semibold text-[#121212] tabular-nums">{activeProcessingFeeFormatted}</span>
                </div>
                <div className="pt-2 border-t border-[#F0F2F5] flex justify-between font-black text-sm text-[#121212]">
                  <span>Total Payable</span>
                  <span className="tabular-nums">{activeTotalAmountFormatted}</span>
                </div>
              </div>

              {/* Pay CTA */}
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleCompletePayment}
                className={`w-full h-14 rounded-2xl text-white font-black text-sm flex items-center justify-between px-5 transition-all shadow-xl ${
                  isSubmitting ? "bg-[#121330]/60 cursor-not-allowed" : "bg-[#121330] hover:bg-black active:scale-[0.98] cursor-pointer"
                }`}
              >
                {isSubmitting ? (
                  <>
                    <span>Authorizing...</span>
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4" />
                      <span>
                        {channel === "MOMO"
                          ? `Authorize via ${networkLabel}`
                          : "Pay with Card"}
                      </span>
                    </div>
                    <span className="font-black tabular-nums">{activeTotalAmountFormatted}</span>
                  </>
                )}
              </button>
            </motion.div>
          )}

          {/* ══ STEP 3: PROCESSING ══ */}
          {step === "PROCESSING" && (
            <motion.div
              key="step-processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex flex-col items-center justify-center text-center py-16 gap-6"
            >
              <HeinzLoader size="large" />
              <div>
                <h2 className="text-lg font-black text-[#121212]">Check Your Phone</h2>
                <p className="text-sm text-[#717171] max-w-[240px] mx-auto mt-1 leading-relaxed">
                  Please enter your PIN on your mobile device to authorize this transaction.
                </p>
              </div>
              <button
                onClick={handleCancelPayment}
                className="text-xs font-medium text-[#717171] hover:text-[#121212] transition-colors underline cursor-pointer mt-4"
              >
                Cancel Payment
              </button>
            </motion.div>
          )}

          {/* ══ STEP: FAILED ══ */}
          {step === "FAILED" && (
            <motion.div
              key="step-failed"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex-1 flex flex-col items-center justify-center text-center py-16 gap-5"
            >
              <div className="w-16 h-16 bg-[#FCE8E6] rounded-full flex items-center justify-center shadow-sm">
                <AlertTriangle className="w-8 h-8 text-[#C5221F]" />
              </div>
              <div>
                <h2 className="text-xl font-black text-[#121212]">Payment Failed</h2>
                <p className="text-sm text-[#717171] max-w-[240px] mx-auto mt-1 leading-relaxed">
                  The authorization timed out, failed, or was cancelled. No funds were deducted.
                </p>
              </div>
              <button
                onClick={() => setStep("CHANNELS")}
                className="w-full max-w-xs h-12 rounded-2xl bg-[#121330] hover:bg-black text-white font-bold text-sm flex items-center justify-center transition-colors cursor-pointer shadow-lg"
              >
                Retry Payment
              </button>
            </motion.div>
          )}

          {/* ══ STEP: CONFIRMATION ══ */}
          {step === "CONFIRMATION" && receiptResult && (
            <motion.div
              key="step-confirmation"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col gap-4 py-4"
            >
              <div className="text-center flex flex-col items-center gap-3">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
                  className="w-16 h-16 bg-[#E6F4EA] rounded-full flex items-center justify-center shadow-sm ring-4 ring-[#E6F4EA]/50"
                >
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                    <motion.path
                      d="M5 13l4 4L19 7"
                      stroke="#1A7336"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.5, ease: "easeOut", delay: 0.3 }}
                    />
                  </svg>
                </motion.div>
                <div>
                  <h2 className="text-xl font-black text-[#121212]">Rate Payment Confirmed</h2>
                  <p className="text-sm text-[#717171] mt-0.5">Municipal assessment credited to KKMA Treasury.</p>
                </div>
              </div>

              {/* Receipt card */}
              <div className="bg-white rounded-2xl border border-[#DADCE0] overflow-hidden shadow-sm">
                <div className="bg-[#E6F4EA] px-4 py-3 flex items-center justify-between">
                  <p className="text-xs font-bold text-[#1A7336] uppercase tracking-wider">Official Receipt</p>
                  <p className="text-xs font-bold text-[#1A7336]">Paid</p>
                </div>
                <div className="px-4 py-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b border-[#F0F2F5] pb-3">
                    <span className="text-[#717171]">Receipt Reference</span>
                    <span className="font-mono font-black text-[#121212]">{receiptResult.receiptNumber}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[#717171] mb-0.5">Amount Settled</p>
                      <p className="text-base font-black text-[#121212]">{receiptResult.amountFormatted}</p>
                    </div>
                    <div>
                      <p className="text-[#717171] mb-0.5">Channel</p>
                      <p className="font-bold text-[#121212] mt-0.5">{receiptResult.paymentMethod}</p>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-[#F0F2F5] flex items-center justify-between">
                    <span className="text-[#717171]">Timestamp</span>
                    <span className="font-medium text-[#121212]">{receiptResult.timestamp}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="w-full h-12 rounded-2xl bg-[#121330] hover:bg-black text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-lg"
                >
                  <ReceiptIcon className="w-4 h-4" />
                  <span>Print / Download Official Receipt</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsCompleted(true)}
                  className="w-full h-11 rounded-xl border border-[#DADCE0] bg-white text-[#121212] hover:bg-[#F0F2F5] text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#1A7336]" />
                  <span>Done</span>
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm bg-[#17433F] text-white px-4 py-3 rounded-2xl shadow-2xl border border-white/10 flex items-center justify-between gap-3 text-xs font-medium"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center gap-2 min-w-0">
              {toast.type === "success" && <CheckCircle2 className="w-4 h-4 text-[#81C995] shrink-0" />}
              {toast.type === "error" && <AlertTriangle className="w-4 h-4 text-[#F28B82] shrink-0" />}
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

      {/* Edit Amount Modal */}
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
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="relative z-10 w-full max-w-sm bg-white rounded-2xl border border-[#DADCE0] shadow-2xl p-5 space-y-4 font-sans"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[#F0F2F5]">
                <h3 className="text-sm font-black text-[#121212]">Edit Payment Amount</h3>
                <button
                  onClick={() => setIsEditingAmount(false)}
                  className="text-[#717171] hover:text-[#121212] p-1 transition-colors cursor-pointer rounded-lg hover:bg-[#F0F2F5]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-[#717171] uppercase tracking-wider block">Custom Amount (GH₵)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-[#121212]">GH₵</span>
                  <input
                    type="number"
                    step="0.01"
                    autoFocus
                    value={tempAmount}
                    onChange={(e) => setTempAmount(e.target.value)}
                    placeholder={actualBill.toString()}
                    className={`w-full h-12 pl-14 pr-4 rounded-xl bg-[#F0F2F5] border text-sm font-black text-[#121212] focus:outline-none transition-colors ${
                      tempValidationError ? "border-[#C5221F] focus:border-[#C5221F]" : "border-[#DADCE0] focus:border-[#121330]"
                    }`}
                  />
                </div>
                {tempValidationError && (
                  <p className="text-[11px] text-[#C5221F] font-semibold">{tempValidationError}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleResetToFull}
                  className="flex-1 h-11 rounded-xl border border-[#DADCE0] bg-white text-[#121212] font-semibold text-xs hover:bg-[#F0F2F5] transition-colors cursor-pointer"
                >
                  Reset to Full
                </button>
                <button
                  type="button"
                  disabled={!isTempValid}
                  onClick={handleApplyCustom}
                  className={`flex-1 h-11 rounded-xl font-bold text-xs transition-colors ${
                    isTempValid
                      ? "bg-[#121330] text-white hover:bg-black cursor-pointer shadow-md"
                      : "bg-[#121330]/30 text-white/50 cursor-not-allowed"
                  }`}
                >
                  Apply Amount
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
