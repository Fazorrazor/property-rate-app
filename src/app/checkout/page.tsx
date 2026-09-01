"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  Lock,
  ReceiptText as ReceiptIcon,
  AlertTriangle,
  X,
  Edit2,
} from "lucide-react";
import {
  MtnMomoLogo,
  TelecelLogo,
  AirtelTigoLogo,
  VisaLogo,
  BankTreasuryLogo,
} from "@/components/icons/PaymentLogos";
import { HeinzLoader } from "@/components/ui/HeinzLoader";
import { CheckoutSkeleton } from "@/components/ui/Skeletons";
import { motion, AnimatePresence } from "framer-motion";
import { getCheckoutData, chargeMobileMoneyAction, verifyPaymentTransaction } from "@/app/actions";
import { identifyNetworkCarrier } from "@/lib/utils/network-detector";

type Step = "CHANNELS" | "DETAILS" | "PROCESSING" | "CONFIRMATION" | "FAILED";
type Channel = "MOMO" | "CARD" | "BANK";
type MoMoNetwork = "MTN" | "TELECEL" | "AIRTELTIGO";
type SettlementType = "TOTAL" | "ARREARS" | "CURRENT_FEE" | "PARTIAL";

interface CheckoutState {
  title: string;
  subtitle: string;
  settlementType?: SettlementType;
  settlementLabel?: string;
  fiscalYear: number;
  subtotal: number;
  subtotalFormatted: string;
  processingFee: number;
  processingFeeFormatted: string;
  totalAmount: number;
  totalAmountFormatted: string;
  user: {
    id: string;
    name: string | null;
    phoneNumber: string;
  };
}

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const propertyId = searchParams.get("propertyId") || "ALL";
  const settlementTypeParam = (searchParams.get("type") as SettlementType) || "TOTAL";
  const amountParamStr = searchParams.get("amount");
  const customAmount = amountParamStr ? parseFloat(amountParamStr) : undefined;

  const [paymentMode, setPaymentMode] = useState<"FULL" | "PARTIAL">(customAmount ? "PARTIAL" : "FULL");
  const [customSubtotal, setCustomSubtotal] = useState<string>(customAmount ? String(customAmount) : "");
  const [isEditingAmount, setIsEditingAmount] = useState(false);
  const [step, setStep] = useState<Step>("CHANNELS");
  const [channel, setChannel] = useState<Channel>("MOMO");
  const [network, setNetwork] = useState<MoMoNetwork>("MTN");
  const [phoneNumber, setPhoneNumber] = useState("024 400 0000");
  const [payerName, setPayerName] = useState("Kwame Mensah-Bonsu");

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
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "error") => {
    setToast({ message, type });
  };

  const activeSubtotal = paymentMode === "FULL" ? (checkoutData?.subtotal || 0) : (parseFloat(customSubtotal) || 0);
  const activeTotalAmount = Math.ceil(activeSubtotal / 0.98);
  const activeProcessingFee = Number((activeTotalAmount - activeSubtotal).toFixed(2));

  const activeSubtotalFormatted = `GH₵ ${activeSubtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const activeProcessingFeeFormatted = `GH₵ ${activeProcessingFee.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const activeTotalAmountFormatted = `GH₵ ${activeTotalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    async function load() {
      try {
        const data = await getCheckoutData(propertyId, settlementTypeParam, customAmount);
        if (data) {
          setCheckoutData(data);
          if (data.user.name) setPayerName(data.user.name);
          if (data.user.phoneNumber) {
            setPhoneNumber(data.user.phoneNumber);
            const detected = identifyNetworkCarrier(data.user.phoneNumber);
            if (detected) setNetwork(detected);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [propertyId, settlementTypeParam]);


  // Polling Effect
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
              // PENDING
              setPollingAttempts(prev => {
                if (prev > 40) { // Approx 2 minutes timeout (40 * 3s = 120s)
                  clearInterval(intervalId);
                  setStep("FAILED");
                  return prev;
                }
                return prev + 1;
              });
            }
          }
        } catch (err) {
          console.error("Polling error", err);
        }
      }, 3000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [step, activeReference, checkoutData, network]);


  const handleBack = () => {
    if (step === "DETAILS") {
      setStep("CHANNELS");
    } else if (step === "CONFIRMATION" || step === "FAILED") {
      router.push("/dashboard");
    } else {
      router.push("/properties");
    }
  };

  const handleProceedToDetails = () => {
    setStep("DETAILS");
  };

  const executePayment = async (totalAmount: number, subtotal: number, processingFee: number) => {
    if (!checkoutData || isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      const res = await chargeMobileMoneyAction({
        propertyId: propertyId || "ALL",
        settlementType: paymentMode === "PARTIAL" ? "PARTIAL" : settlementTypeParam,
        amount: totalAmount,
        subtotal: subtotal,
        processingFee: processingFee,
        phone: phoneNumber,
        network: network
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

  const handleCompletePayment = async () => {
    if (!checkoutData || isSubmitting) return;

    if (channel === "MOMO") {
      await executePayment(activeTotalAmount, activeSubtotal, activeProcessingFee);
    } else {
      showToast("Only Mobile Money is supported for this demo.", "info");
    }
  };

  const handleCancelPayment = () => {
    setStep("FAILED");
  };

  if (isLoading) {
    return <CheckoutSkeleton />;
  }

  if (!checkoutData || checkoutData.totalAmount <= 0) {
    return (
      <main className="min-h-screen bg-background p-6 max-w-md mx-auto flex flex-col justify-center items-center text-center space-y-3 font-sans">
        <div className="w-12 h-12 rounded-2xl bg-background text-foreground flex items-center justify-center">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h2 className="text-base font-semibold text-foreground">No Outstanding Balance</h2>
        <p className="text-xs text-on-surface-muted">This municipal assessment has already been settled in full.</p>
        <button
          onClick={() => router.push("/properties")}
          className="px-4 py-2 rounded-lg bg-[#4B1426] text-white font-medium text-xs hover:bg-[#558467] transition-colors cursor-pointer"
        >
          Return to Properties
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col max-w-md mx-auto w-full p-4 sm:p-5 font-sans">
      {/* Top Header */}
      {step !== "PROCESSING" && (
        <header className="flex items-center justify-between py-2 border-b border-border-light mb-4">
          <button
            type="button"
            onClick={handleBack}
            className="w-9 h-9 rounded-xl bg-surface border border-border-light flex items-center justify-center text-on-surface-muted hover:bg-background transition-colors cursor-pointer"
            aria-label="Go Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="text-center">
            <h1 className="text-xs font-semibold text-foreground uppercase tracking-wider">
              {step === "CONFIRMATION" ? "Official Receipt" : "KKMA Rate Settlement"}
            </h1>
            <p className="text-[11px] text-on-surface-muted font-normal flex items-center justify-center gap-1">
              <Lock className="w-3 h-3 text-on-surface-muted" />
              <span>Municipal Treasury Encrypted</span>
            </p>
          </div>

          <div className="w-9 h-9 rounded-xl bg-surface border border-border-light flex items-center justify-center text-on-surface-muted">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </header>
      )}

      {/* STEP 1: PAYMENT OPTIONS / CHANNELS SCREEN */}
      {step === "CHANNELS" && (
        <motion.div
          key="step-channels"
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 8 }}
          className="space-y-4 flex-1 flex flex-col justify-between"
        >
          <div className="space-y-4">
            {/* Invoice Summary Card */}
            <div className="p-4 rounded-xl bg-surface border border-border-light space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between text-xs text-on-surface-muted">
                <span>Assessment Notice</span>
                <span>{checkoutData.fiscalYear} Fiscal</span>
              </div>
              <h2 className="text-sm font-semibold text-foreground">
                {checkoutData.title}
              </h2>
              <p className="text-xs text-on-surface-muted">{checkoutData.subtitle}</p>

              {checkoutData.settlementLabel && (
                <div className="text-xs text-on-surface-muted font-medium pt-1">
                  Scope: {checkoutData.settlementLabel}
                </div>
              )}

              <div className="pt-3 border-t border-border-light flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-on-surface-muted">Total Due</span>
                  <span className="text-xl font-bold text-foreground">
                    {activeSubtotalFormatted}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingAmount(true)}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-surface-subtle hover:bg-[#F2F2F2] border border-border-light text-on-surface-muted hover:text-foreground transition-colors cursor-pointer shadow-xs"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">Edit Amount</span>
                </button>
              </div>
            </div>

            {/* Payment Channels */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-0.5">
                <h3 className="text-xs font-semibold text-on-surface-muted uppercase tracking-wider">
                  Select Settlement Channel
                </h3>
                <span className="text-xs text-on-surface-muted">
                  Step 1 of 2
                </span>
              </div>

              <div className="space-y-2">
                {/* 1. Mobile Money */}
                <div
                  onClick={() => setChannel("MOMO")}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between shadow-2xs ${
                    channel === "MOMO"
                      ? "border-[#4B1426] bg-background"
                      : "border-border-light bg-surface hover:border-border-light"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                      <MtnMomoLogo className="w-7 h-7" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-semibold text-foreground">Mobile Money</h4>
                        <span className="text-[11px] text-on-surface-muted">(Instant MoMo)</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-on-surface-muted">
                        <span>MTN</span>
                        <span>&bull;</span>
                        <span>Telecel</span>
                        <span>&bull;</span>
                        <span>AT Money</span>
                      </div>
                    </div>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                      channel === "MOMO" ? "border-[#4B1426] bg-[#4B1426]" : "border-border-light"
                    }`}
                  >
                    {channel === "MOMO" && <div className="w-1.5 h-1.5 rounded-full bg-surface" />}
                  </div>
                </div>

                {/* 2. Card */}
                <div
                  onClick={() => setChannel("CARD")}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between shadow-2xs ${
                    channel === "CARD"
                      ? "border-[#4B1426] bg-background"
                      : "border-border-light bg-surface hover:border-border-light"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center shrink-0 p-1">
                      <VisaLogo className="w-8 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-foreground">Credit / Debit Card</h4>
                      <div className="flex items-center gap-1.5 text-[11px] text-on-surface-muted">
                        <span>VISA</span>
                        <span>&bull;</span>
                        <span>Mastercard</span>
                      </div>
                    </div>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                      channel === "CARD" ? "border-[#4B1426] bg-[#4B1426]" : "border-border-light"
                    }`}
                  >
                    {channel === "CARD" && <div className="w-1.5 h-1.5 rounded-full bg-surface" />}
                  </div>
                </div>

                {/* 3. Bank Wire */}
                <div
                  onClick={() => setChannel("BANK")}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between shadow-2xs ${
                    channel === "BANK"
                      ? "border-[#4B1426] bg-background"
                      : "border-border-light bg-surface hover:border-border-light"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center shrink-0">
                      <BankTreasuryLogo className="w-6 h-6 text-foreground" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-foreground">GovPay Direct Bank Wire</h4>
                      <p className="text-[11px] text-on-surface-muted">Municipal Treasury Account</p>
                    </div>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                      channel === "BANK" ? "border-[#4B1426] bg-[#4B1426]" : "border-border-light"
                    }`}
                  >
                    {channel === "BANK" && <div className="w-1.5 h-1.5 rounded-full bg-surface" />}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Continue Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleProceedToDetails}
              className="w-full h-11 rounded-xl bg-[#4B1426] hover:bg-[#558467] text-white font-medium text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
            >
              <span>Continue to Payment Details</span>
              <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
            </button>
          </div>
        </motion.div>
      )}

      {/* STEP 2: INPUT PAYMENT DETAILS SCREEN */}
      {step === "DETAILS" && (
        <motion.div
          key="step-details"
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -8 }}
          className="space-y-4 flex-1 flex flex-col justify-between"
        >
          <div className="space-y-4">
            <div>
              <span className="text-xs text-on-surface-muted font-medium">Step 2 of 2</span>
              <h2 className="text-base font-semibold text-foreground mt-0.5">
                {channel === "MOMO" && "Enter Mobile Money Number"}
                {channel === "CARD" && "Enter Card Details"}
                {channel === "BANK" && "GovPay Direct Wire Details"}
              </h2>
            </div>

            {/* MOMO DETAILS */}
            {channel === "MOMO" && (
              <div className="space-y-3 text-xs">
                <div className="space-y-1.5">
                  <label className="font-medium text-on-surface-muted">Select Network</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setNetwork("MTN")}
                      className={`p-2.5 rounded-lg border text-center font-medium transition-colors cursor-pointer flex flex-col items-center gap-1 ${
                        network === "MTN"
                          ? "border-[#4B1426] bg-background text-foreground font-semibold"
                          : "border-border-light bg-surface text-on-surface-muted hover:bg-background"
                      }`}
                    >
                      <MtnMomoLogo className="w-6 h-6" />
                      <span>MTN MoMo</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNetwork("TELECEL")}
                      className={`p-2.5 rounded-lg border text-center font-medium transition-colors cursor-pointer flex flex-col items-center gap-1 ${
                        network === "TELECEL"
                          ? "border-[#4B1426] bg-background text-foreground font-semibold"
                          : "border-border-light bg-surface text-on-surface-muted hover:bg-background"
                      }`}
                    >
                      <TelecelLogo className="w-6 h-6" />
                      <span>Telecel</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNetwork("AIRTELTIGO")}
                      className={`p-2.5 rounded-lg border text-center font-medium transition-colors cursor-pointer flex flex-col items-center gap-1 ${
                        network === "AIRTELTIGO"
                          ? "border-[#4B1426] bg-background text-foreground font-semibold"
                          : "border-border-light bg-surface text-on-surface-muted hover:bg-background"
                      }`}
                    >
                      <AirtelTigoLogo className="w-6 h-6" />
                      <span>AT Money</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-on-surface-muted">Mobile Money Phone Number</label>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPhoneNumber(val);
                      const detected = identifyNetworkCarrier(val);
                      if (detected) setNetwork(detected);
                    }}
                    placeholder="024 400 0000"
                    className="w-full h-10 px-3 rounded-lg bg-surface border border-border-light text-xs font-medium text-foreground focus:outline-none focus:border-[#4B1426]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-on-surface-muted">Account Holder Name</label>
                  <input
                    type="text"
                    value={payerName}
                    onChange={(e) => setPayerName(e.target.value)}
                    placeholder="Kwame Mensah-Bonsu"
                    className="w-full h-10 px-3 rounded-lg bg-surface border border-border-light text-xs font-medium text-foreground focus:outline-none focus:border-[#4B1426]"
                  />
                </div>
              </div>
            )}

            {/* CARD DETAILS */}
            {channel === "CARD" && (
              <div className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="font-medium text-on-surface-muted">Cardholder Name</label>
                  <input
                    type="text"
                    value={payerName}
                    onChange={(e) => setPayerName(e.target.value)}
                    placeholder="Name on card"
                    className="w-full h-10 px-3 rounded-lg bg-surface border border-border-light text-xs font-medium text-foreground focus:outline-none focus:border-[#4B1426]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-on-surface-muted">Card Number</label>
                  <input
                    type="text"
                    defaultValue="•••• •••• •••• 4242"
                    className="w-full h-10 px-3 rounded-lg bg-surface border border-border-light text-xs font-medium text-foreground focus:outline-none focus:border-[#4B1426]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="font-medium text-on-surface-muted">Expiry (MM/YY)</label>
                    <input
                      type="text"
                      defaultValue="12/28"
                      placeholder="MM/YY"
                      className="w-full h-10 px-3 rounded-lg bg-surface border border-border-light text-xs font-medium text-foreground focus:outline-none focus:border-[#4B1426]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-medium text-on-surface-muted">CVC</label>
                    <input
                      type="text"
                      defaultValue="•••"
                      placeholder="CVC"
                      className="w-full h-10 px-3 rounded-lg bg-surface border border-border-light text-xs font-medium text-foreground focus:outline-none focus:border-[#4B1426]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* BANK DETAILS */}
            {channel === "BANK" && (
              <div className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="font-medium text-on-surface-muted">Select Bank</label>
                  <select className="w-full h-10 px-3 rounded-lg bg-surface border border-border-light text-xs font-medium text-foreground focus:outline-none focus:border-[#4B1426]">
                    <option>GCB Bank Municipal Collection Account</option>
                    <option>Ecobank Ghana Treasury</option>
                    <option>Standard Chartered Bank</option>
                    <option>Zenith Bank Ghana</option>
                  </select>
                </div>
              </div>
            )}

            {/* Order Summary */}
            <div className="p-3.5 rounded-xl bg-background border border-border-light space-y-1.5 text-xs">
              <div className="flex justify-between text-on-surface-muted">
                <span>Settlement Amount</span>
                <span className="font-medium text-foreground">{activeSubtotalFormatted}</span>
              </div>
              <div className="flex justify-between text-on-surface-muted">
                <span>Processing Fee (2%)</span>
                <span className="font-medium text-foreground">{activeProcessingFeeFormatted}</span>
              </div>
              <div className="pt-1.5 border-t border-border-light flex justify-between font-semibold text-foreground">
                <span>Total Payable</span>
                <span>{activeTotalAmountFormatted}</span>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleCompletePayment}
              className={`w-full h-11 rounded-xl text-white font-medium text-xs flex items-center justify-center gap-2 transition-colors shadow-xs ${isSubmitting ? 'bg-[#4B1426]/70 cursor-not-allowed' : 'bg-[#4B1426] hover:bg-[#558467] cursor-pointer'}`}
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Authorizing...</span>
                </div>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>
                    {channel === "MOMO"
                      ? `Authorize via ${network === "MTN" ? "MTN MoMo" : network === "TELECEL" ? "Telecel Cash" : "AT Money"} • ${activeTotalAmountFormatted}`
                      : channel === "CARD"
                      ? `Pay with Card • ${activeTotalAmountFormatted}`
                      : `Authorize Bank Settlement • ${activeTotalAmountFormatted}`}
                  </span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      )}



      {/* STEP 4: PROCESSING OVERLAY */}
      {step === "PROCESSING" && (
        <motion.div
          key="step-processing"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-6"
        >
          <HeinzLoader size="large" />
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Check Your Phone</h2>
            <p className="text-xs text-on-surface-muted max-w-[250px] mx-auto">
              Please enter your PIN on your mobile device to authorize this transaction.
            </p>
          </div>
          
          <div className="pt-8">
            <button
              onClick={handleCancelPayment}
              className="px-4 py-2 text-xs font-medium text-on-surface-muted hover:text-foreground transition-colors underline cursor-pointer"
            >
              Cancel Payment
            </button>
          </div>
        </motion.div>
      )}

      {/* STEP 3.5: FAILED OVERLAY */}
      {step === "FAILED" && (
        <motion.div
          key="step-failed"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-6"
        >
          <div className="w-16 h-16 bg-[#FCE8E6] rounded-full flex items-center justify-center mx-auto shadow-sm ring-4 ring-[#FCE8E6]/50">
            <AlertTriangle className="w-8 h-8 text-[#C5221F]" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Payment Failed</h2>
            <p className="text-xs text-on-surface-muted max-w-[250px] mx-auto">
              The authorization timed out, failed, or was cancelled on your device. No funds were deducted.
            </p>
          </div>

          <div className="pt-4 space-y-2 w-full">
            <button
              onClick={() => setStep("CHANNELS")}
              className="w-full h-11 rounded-xl bg-[#4B1426] hover:bg-[#558467] text-white font-medium text-xs flex items-center justify-center transition-colors cursor-pointer shadow-xs"
            >
              Retry Payment
            </button>
            <button
              onClick={() => router.push("/dashboard")}
              className="w-full h-11 rounded-xl bg-surface border border-border-light text-on-surface-muted font-medium text-xs flex items-center justify-center transition-colors hover:bg-background cursor-pointer"
            >
              Return to Dashboard
            </button>
          </div>
        </motion.div>
      )}

      {/* STEP 4: CONFIRMATION SCREEN */}
      {step === "CONFIRMATION" && receiptResult && (
        <motion.div
          key="step-confirmation"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="space-y-4 flex-1 flex flex-col justify-between pt-2 pb-2"
        >
          <div className="space-y-4 text-center">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
              className="w-16 h-16 bg-[#E6F4EA] rounded-full flex items-center justify-center mx-auto shadow-sm ring-4 ring-[#E6F4EA]/50"
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <motion.path
                  d="M5 13l4 4L19 7"
                  stroke="#188038"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.5, ease: "easeOut", delay: 0.3 }}
                />
              </svg>
            </motion.div>

            <div className="space-y-0.5">
              <h2 className="text-lg font-semibold text-foreground">
                Rate Payment Confirmed
              </h2>
              <p className="text-xs text-on-surface-muted">
                Municipal assessment credited to KKMA Treasury.
              </p>
            </div>

            {/* Receipt Summary Card */}
            <div className="p-4 rounded-xl bg-surface border border-border-light text-left space-y-3 text-xs shadow-2xs">
              <div className="flex items-center justify-between border-b border-border-light pb-2">
                <div>
                  <span className="text-[11px] text-on-surface-muted">Official Receipt Reference</span>
                  <p className="font-mono font-semibold text-foreground">
                    {receiptResult.receiptNumber}
                  </p>
                </div>
                <span className="text-xs font-medium text-[#188038]">
                  Paid
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-on-surface-muted">Amount Settled</span>
                  <p className="text-base font-bold text-foreground">{receiptResult.amountFormatted}</p>
                </div>
                <div>
                  <span className="text-on-surface-muted">Channel</span>
                  <p className="font-medium text-foreground mt-0.5">{receiptResult.paymentMethod}</p>
                </div>
              </div>

              <div className="pt-2 border-t border-border-light flex items-center justify-between text-on-surface-muted">
                <span>Timestamp</span>
                <span className="font-medium text-foreground">{receiptResult.timestamp}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <button
              type="button"
              onClick={() => router.push("/receipts")}
              className="w-full h-11 rounded-xl bg-[#4B1426] hover:bg-[#558467] text-white font-medium text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
            >
              <ReceiptIcon className="w-4 h-4" />
              <span>View Official Receipt</span>
            </button>

            <button
              type="button"
              onClick={() => router.push("/properties")}
              className="w-full py-2.5 text-center text-xs font-medium text-on-surface-muted hover:text-foreground cursor-pointer"
            >
              Back to Properties
            </button>
          </div>
        </motion.div>
      )}

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
              {toast.type === "success" && (
                <CheckCircle2 className="w-4 h-4 text-[#81C995] shrink-0" />
              )}
              {toast.type === "error" && (
                <AlertTriangle className="w-4 h-4 text-[#F28B82] shrink-0" />
              )}
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

      {/* EDIT AMOUNT MODAL */}
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
              className="relative z-10 w-full max-w-sm bg-surface rounded-2xl border border-border-light shadow-2xl p-5 space-y-4 font-sans"
            >
              <div className="flex items-center justify-between pb-1 border-b border-border-light">
                <h3 className="text-sm font-semibold text-foreground">Edit Payment Amount</h3>
                <button onClick={() => setIsEditingAmount(false)} className="text-on-surface-muted hover:text-foreground p-1 transition-colors cursor-pointer rounded-lg hover:bg-surface-subtle">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-medium text-on-surface-muted">Custom Amount (GH₵)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-foreground">GH₵</span>
                  <input
                    type="number"
                    autoFocus
                    value={customSubtotal}
                    onChange={(e) => {
                      setCustomSubtotal(e.target.value);
                      setPaymentMode("PARTIAL");
                    }}
                    placeholder={checkoutData.subtotal.toString()}
                    className="w-full h-11 pl-12 pr-4 rounded-xl bg-background border border-[#4B1426]/30 text-sm font-semibold text-foreground focus:outline-none focus:border-[#4B1426] shadow-2xs"
                  />
                </div>
              </div>
              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMode("FULL");
                    setCustomSubtotal("");
                    setIsEditingAmount(false);
                  }}
                  className="flex-1 h-10 rounded-xl bg-surface border border-border-light text-foreground font-medium text-xs hover:bg-background transition-colors cursor-pointer shadow-xs"
                >
                  Reset to Full
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingAmount(false)}
                  className="flex-1 h-10 rounded-xl bg-[#2C2C2C] text-white font-medium text-xs hover:bg-[#1F1F1F] transition-colors cursor-pointer shadow-xs"
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
    <Suspense
      fallback={<CheckoutSkeleton />}
    >
      <CheckoutContent />
    </Suspense>
  );
}
