"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Phone,
  Receipt,
  Camera,
  CheckCircle2,
  FileImage,
  Clock,
  ArrowRight,
  Plus,
  FileText,
} from "lucide-react";
import { AppleSpinner } from "@/components/ui/AppleSpinner";
import {
  RatepayerHistoryDossier,
  AdminPropertyReceipt,
  attachPropertyBillImage,
} from "@/app/actions";
import { HistoricalPaymentLedger } from "@/components/HistoricalPaymentLedger";

function getInitials(name: string | null | undefined): string {
  if (!name) return "PO";
  const clean = name.trim();
  if (!clean || /^\d+$/.test(clean)) return "PO";
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }
  if (words.length === 1) {
    return clean.slice(0, Math.min(2, clean.length)).toUpperCase();
  }
  return "PO";
}

export interface RatepayerDossierPreview {
  id: string;
  name: string;
  phoneNumber: string;
  role: string;
  createdAtFormatted: string;
  propertyCount?: number;
  totalValuationFormatted?: string;
  totalDueFormatted?: string;
  totalArrearsFormatted?: string;
  totalPaidFormatted?: string;
  status?: "SETTLED" | "DEFAULTER" | "OUTSTANDING" | "EMPTY" | string;
}

interface RatepayerDossierSheetProps {
  dossier: RatepayerHistoryDossier | null;
  preview?: RatepayerDossierPreview | null;
  isLoading?: boolean;
  isOpen: boolean;
  onClose: () => void;
  onSelectProperty?: (accountNumber: string, origin?: { id: string; name: string; preview: any }) => void;
  onRecordPayment?: (accountNumber: string) => void;
  hideRecordPayment?: boolean;
  onOpenStatement?: (accountNumber: string) => void;
}

type DossierTab = "PROPERTIES" | "PAYMENTS" | "BILLS_LEDGER";

export function RatepayerDossierSheet({
  dossier,
  preview,
  isLoading = false,
  isOpen,
  onClose,
  onSelectProperty,
  onRecordPayment,
  hideRecordPayment = false,
  onOpenStatement,
}: RatepayerDossierSheetProps) {

  const [activeTab, setActiveTab] = useState<DossierTab>("PROPERTIES");
  const [localReceipts, setLocalReceipts] = useState<AdminPropertyReceipt[]>([]);

  // Lock background viewport scrolling when dossier sheet is active
  useEffect(() => {
    if (isOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isOpen]);


  // Bill image state per property
  const [localBillImages, setLocalBillImages] = useState<Record<string, string | null>>({});
  const [billConfirmUpload, setBillConfirmUpload] = useState<{
    accountNumber: string;
    dataUrl: string;
    mimeType: string;
  } | null>(null);
  const [isBillUploading, setIsBillUploading] = useState(false);




  useEffect(() => {
    if (dossier?.receipts) {
      setLocalReceipts(dossier.receipts);
    }
  }, [dossier]);

  // Reset tab when sheet opens/closes or different ratepayer is selected
  useEffect(() => {
    if (!isOpen) {
      setActiveTab("PROPERTIES");
    }
  }, [isOpen]);




  const handleBillFileSelected = (
    accountNumber: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setBillConfirmUpload({
        accountNumber,
        dataUrl: reader.result as string,
        mimeType: file.type || "image/jpeg",
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleConfirmBillUpload = async () => {
    if (!billConfirmUpload) return;
    setIsBillUploading(true);
    try {
      const res = await attachPropertyBillImage(
        billConfirmUpload.accountNumber,
        billConfirmUpload.dataUrl,
        billConfirmUpload.mimeType
      );
      if (res.success && res.publicUrl) {
        setLocalBillImages((prev) => ({
          ...prev,
          [billConfirmUpload.accountNumber]: res.publicUrl!,
        }));
        setBillConfirmUpload(null);
      } else {
        alert(res.error || "Failed to attach bill scan.");
      }
    } catch (err) {
      console.error(err);
      alert("An unexpected error occurred while uploading the bill scan.");
    } finally {
      setIsBillUploading(false);
    }
  };

  // Keyboard escape listener for prompt accessibility
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Derived state from full dossier or optimistic preview
  const user = dossier?.user || (preview ? {
    id: preview.id,
    name: preview.name,
    phoneNumber: preview.phoneNumber,
    role: preview.role,
    createdAtFormatted: preview.createdAtFormatted,
  } : null);

  const summary = dossier?.summary || (preview ? {
    totalProperties: preview.propertyCount ?? 0,
    totalValuation: 0,
    totalValuationFormatted: preview.totalValuationFormatted ?? "GH₵ 0.00",
    totalOutstandingDue: 0,
    totalOutstandingDueFormatted: preview.totalDueFormatted ?? "GH₵ 0.00",
    totalArrears: 0,
    totalArrearsFormatted: preview.totalArrearsFormatted ?? "GH₵ 0.00",
    totalPaid: 0,
    totalPaidFormatted: preview.totalPaidFormatted ?? "GH₵ 0.00",
    status: (preview.status === "SETTLED" || preview.status === "DEFAULTER" || preview.status === "OUTSTANDING")
      ? preview.status
      : "OUTSTANDING",
  } : null);

  const properties = dossier?.properties || [];
  const receipts = localReceipts.length > 0 ? localReceipts : (dossier?.receipts || []);

  const isDossierLoaded = Boolean(dossier);

  const tabs: { key: DossierTab; label: string }[] = [
    {
      key: "PROPERTIES",
      label: isDossierLoaded
        ? `Properties (${properties.length})`
        : summary?.totalProperties !== undefined
        ? `Properties (${summary.totalProperties})`
        : "Properties",
    },
    {
      key: "PAYMENTS",
      label: isDossierLoaded ? `Payments (${receipts.length})` : "Payments",
    },
    {
      key: "BILLS_LEDGER",
      label: "Bills & Ledger",
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          key="ratepayer-dossier-wrapper"
          className="fixed inset-0 z-[10000] flex justify-end pointer-events-auto"
        >
          {/* Backdrop */}
          <motion.div
            key="ratepayer-dossier-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs"
            onClick={onClose}
          />

          {/* Sliding Panel */}
          <motion.aside
            key="ratepayer-dossier-panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", ease: [0.16, 1, 0.3, 1], duration: 0.32 }}
            className="relative z-10 w-full max-w-2xl bg-white/95 backdrop-blur-2xl h-full shadow-2xl flex flex-col border-l border-[#E5E5EA] font-sans"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#E5E5EA] flex items-center justify-between shrink-0 bg-white/80 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#007AFF]/10 text-[#007AFF] flex items-center justify-center font-bold text-sm shrink-0">
                  {getInitials(user?.name)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#6C6C70] uppercase tracking-wider font-semibold">
                      Owner Profile
                    </span>
                    {summary ? (
                      <span
                        className={`text-[11px] font-semibold ${
                          summary.status === "SETTLED"
                            ? "text-[#34C759]"
                            : summary.status === "DEFAULTER"
                            ? "text-[#FF3B30]"
                            : "text-[#FF9500]"
                        }`}
                      >
                        &bull; {summary.status === "SETTLED" ? "Paid" : summary.status === "DEFAULTER" ? "Overdue Balance" : "Balance Due"}
                      </span>
                    ) : (
                      <div className="h-3 w-20 bg-[#E5E5EA] animate-pulse rounded-md" />
                    )}

                    {isLoading && (
                      <span className="flex items-center ml-1.5 text-[#007AFF]">
                        <AppleSpinner size="xs" />
                      </span>
                    )}
                  </div>
                  {user ? (
                    <h2 className="text-base font-semibold text-[#1C1C1E] mt-0.5">
                      {user.name}
                    </h2>
                  ) : (
                    <div className="h-5 w-44 bg-[#E5E5EA] animate-pulse rounded mt-1" />
                  )}
                  {user?.phoneNumber && (
                    <div className="flex items-center gap-1.5 text-xs text-[#6C6C70] font-mono mt-0.5">
                      <Phone className="w-3 h-3 text-[#8E8E93]" />
                      <span>{user.phoneNumber}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-[#8E8E93] hover:text-[#1C1C1E] hover:bg-[#F2F2F7] transition-all cursor-pointer active:scale-90"
                  aria-label="Close profile"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Dossier Tabs Navigation (Zero Pills - Underline Indicator) */}
            <div className="px-3 sm:px-6 border-b border-[#E5E5EA] bg-white flex items-center justify-between text-xs shrink-0 overflow-x-auto scrollbar-none">
              <div className="flex items-center gap-4 sm:gap-6">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      className={`py-3 text-xs font-medium relative transition-colors cursor-pointer focus:outline-none whitespace-nowrap ${
                        isActive ? "text-[#007AFF] font-semibold" : "text-[#6C6C70] hover:text-[#1C1C1E]"
                      }`}
                    >
                      <span>{tab.label}</span>
                      {isActive && (
                        <motion.div
                          layoutId="dossierTabUnderline"
                          className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#007AFF]"
                          transition={{ type: "spring", stiffness: 450, damping: 30 }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {onRecordPayment && !hideRecordPayment && (
                <button
                  type="button"
                  onClick={() => {
                    const primaryProp = properties[0];
                    if (primaryProp) {
                      onRecordPayment(primaryProp.accountNumber);
                    }
                  }}
                  className="apple-btn-primary h-7 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer bg-[#007AFF] text-white hover:bg-[#0062CC] transition-colors shrink-0 my-1.5"
                  title="Record counter cash / direct treasury payment"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Record Payment</span>
                </button>
              )}
            </div>

            {/* Tab Content Area */}
            <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-3 sm:py-4 space-y-3 text-xs min-h-0 bg-[#F2F2F7]">
              {/* LAZY LOADING SKELETON STATE */}
              {!isDossierLoaded && isLoading ? (
                <div className="space-y-3">
                  {activeTab === "PROPERTIES" && (
                    <>
                      {[1, 2].map((i) => (
                        <div
                          key={i}
                          className="p-4 bg-white border border-[#E5E5EA] rounded-xl shadow-xs space-y-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-2 flex-1">
                              <div className="h-4 w-32 bg-[#E5E5EA] animate-pulse rounded" />
                              <div className="h-3 w-48 bg-[#E5E5EA] animate-pulse rounded" />
                              <div className="h-3 w-28 bg-[#E5E5EA] animate-pulse rounded" />
                            </div>
                            <div className="space-y-1.5 flex flex-col items-end">
                              <div className="h-3 w-16 bg-[#E5E5EA] animate-pulse rounded" />
                              <div className="h-4 w-24 bg-[#E5E5EA] animate-pulse rounded" />
                            </div>
                          </div>
                          <div className="pt-2 border-t border-[#E5E5EA] flex items-center justify-between">
                            <div className="h-3 w-36 bg-[#E5E5EA] animate-pulse rounded" />
                            <div className="h-3 w-28 bg-[#E5E5EA] animate-pulse rounded" />
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {activeTab === "PAYMENTS" && (
                    <>
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="p-3.5 bg-white border border-[#E5E5EA] rounded-xl shadow-xs flex items-center justify-between gap-3"
                        >
                          <div className="space-y-2 flex-1">
                            <div className="h-4 w-32 bg-[#E5E5EA] animate-pulse rounded" />
                            <div className="h-3 w-40 bg-[#E5E5EA] animate-pulse rounded" />
                          </div>
                          <div className="space-y-1.5 flex flex-col items-end">
                            <div className="h-4 w-20 bg-[#E5E5EA] animate-pulse rounded" />
                            <div className="h-3 w-24 bg-[#E5E5EA] animate-pulse rounded" />
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                  >
                    {/* TAB 1: PROPERTIES */}
                    {activeTab === "PROPERTIES" && (
                    <div className="space-y-3">
                      {properties.length === 0 ? (
                        <p className="text-[#6C6C70] py-8 text-center italic">No properties linked to this property owner.</p>
                      ) : (
                        properties.map((prop) => {
                          const billImgUrl = localBillImages[prop.accountNumber] !== undefined
                            ? localBillImages[prop.accountNumber]
                            : prop.billImageUrl || null;
                          return (
                          <div
                            key={prop.id}
                            className="p-4 bg-white border border-[#E5E5EA] rounded-xl shadow-xs space-y-3 hover:border-[#007AFF]/40 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <span className="font-semibold text-[#1C1C1E] text-sm">{prop.accountNumber}</span>
                                <p className="text-[#6C6C70] text-xs mt-0.5">
                                  {prop.ownerDigitalAddress} &bull; {prop.municipality}
                                </p>
                                <p className="text-[#8E8E93] text-[11px] mt-0.5">{prop.propertyClassification}</p>
                              </div>

                              <div className="text-right shrink-0">
                                <div className="flex items-center justify-end gap-1.5 text-xs">
                                  <span className="text-[#8E8E93] text-[11px] font-medium">Status:</span>
                                  <span
                                    className={`font-semibold ${
                                      prop.status === "PAID"
                                        ? "text-[#34C759]"
                                        : prop.status === "PARTIALLY_PAID"
                                        ? "text-[#FF9500]"
                                        : "text-[#FF3B30]"
                                    }`}
                                  >
                                    {prop.status === "PAID" ? "Paid" : prop.status === "PARTIALLY_PAID" ? "Partial" : "Unpaid"}
                                  </span>
                                </div>
                                <div className="flex items-baseline justify-end gap-1.5 mt-1">
                                  <span className="text-[#8E8E93] text-[11px] font-medium whitespace-nowrap">Total Outstanding:</span>
                                  <p className="font-semibold text-[#1C1C1E] text-sm whitespace-nowrap tabular-nums">{prop.totalAmountDueFormatted}</p>
                                </div>
                                {(() => {
                                  const initialArr = Number(
                                    prop.initialArrears !== undefined
                                      ? prop.initialArrears
                                      : (prop.initial_arrears !== undefined ? prop.initial_arrears : prop.arrears || 0)
                                  );
                                  if (initialArr <= 0) return null;
                                  const paidCycle = Number(
                                    prop.totalPaidCycle !== undefined
                                      ? prop.totalPaidCycle
                                      : (prop.total_paid_cycle !== undefined ? prop.total_paid_cycle : prop.amountPaidLastYear || 0)
                                  );
                                  const currentArr = Number(
                                    prop.currentArrears !== undefined
                                      ? prop.currentArrears
                                      : (prop.current_arrears !== undefined ? prop.current_arrears : Math.max(0, initialArr - paidCycle))
                                  );
                                  const isPaid = prop.status === "PAID" || currentArr <= 0;
                                  const hasReduction = currentArr < initialArr;
                                  const paymentCount = (prop.receipts || []).length || (paidCycle > 0 ? 1 : 0);
                                  const storyTooltip = `Original Arrears: GH₵ ${initialArr.toFixed(2)} | Paid: GH₵ ${paidCycle.toFixed(2)} | Remaining Balance: GH₵ ${currentArr.toFixed(2)} across ${paymentCount} payment(s).`;

                                  return (
                                    <div
                                      className="text-[11px] whitespace-nowrap tabular-nums mt-0.5 cursor-help"
                                      title={storyTooltip}
                                    >
                                      <div className="flex items-center justify-end gap-1.5">
                                        <span className="text-[#8E8E93] font-medium">Arrears Overdue:</span>
                                        {hasReduction && (
                                          <span className="line-through text-[#8E8E93] font-normal">
                                            GH₵ {initialArr.toFixed(2)}
                                          </span>
                                        )}
                                        <span className={isPaid ? "text-[#34C759] font-medium" : "text-[#FF3B30] font-semibold"}>
                                          {isPaid ? "• Paid" : `GH₵ ${currentArr.toFixed(2)}`}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>

                            {/* Bill Scan attachment row */}
                            <div className="flex items-center justify-between gap-2 text-[11px]">
                              {billImgUrl ? (
                                <span className="text-[#34C759] flex items-center gap-1 font-medium">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Official Bill Scan Attached
                                </span>
                              ) : (
                                <span className="text-[#8E8E93] italic flex items-center gap-1">
                                  <FileImage className="w-3 h-3" />
                                  No Bill Scan Uploaded
                                </span>
                              )}
                              <label className="text-[#007AFF] hover:underline font-medium flex items-center gap-1 cursor-pointer">
                                <Camera className="w-3 h-3" />
                                <span>{billImgUrl ? "Replace Bill Scan" : "Attach Official Bill Scan"}</span>
                                <input
                                  type="file"
                                  accept="image/*,application/pdf"
                                  className="hidden"
                                  onChange={(e) => handleBillFileSelected(prop.accountNumber, e)}
                                />
                              </label>
                            </div>

                            <div className="pt-2 border-t border-[#E5E5EA] flex items-center justify-between text-[11px] text-[#6C6C70]">
                              <span className="whitespace-nowrap tabular-nums">Property Value: {prop.rateableValueFormatted}</span>
                              <div className="flex items-center gap-3">
                                {onOpenStatement && (
                                  <button
                                    type="button"
                                    onClick={() => onOpenStatement(prop.accountNumber)}
                                    className="text-[#007AFF] hover:underline font-medium cursor-pointer flex items-center gap-1"
                                  >
                                    <FileText className="w-3 h-3" />
                                    <span>Statement</span>
                                  </button>
                                )}
                                {onSelectProperty && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const originInfo = user
                                        ? { id: user.id, name: user.name, preview: preview || null }
                                        : preview
                                          ? { id: preview.id, name: preview.name, preview }
                                          : undefined;
                                      onSelectProperty(prop.accountNumber, originInfo);
                                      onClose();
                                    }}
                                    className="text-[#6C6C70] hover:text-[#1C1C1E] font-medium cursor-pointer"
                                  >
                                    View Property Details &rarr;
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                          );
                        })
                      )}


                    </div>
                  )}

                  {/* TAB 2: PAYMENTS LEDGER & STORYTELLING AUDIT */}
                  {activeTab === "PAYMENTS" && (
                    <div className="space-y-4">
                      {receipts.length === 0 ? (
                        <p className="text-[#6C6C70] py-8 text-center italic">No payment transactions recorded on this account.</p>
                      ) : (
                        receipts.map((r) => {
                          const narrative = r.narrative;
                          return (
                            <div
                              key={r.id}
                              className="p-4 bg-white border border-[#E5E5EA] rounded-xl shadow-xs space-y-3.5"
                            >
                              {/* Header: Receipt No, Status, Method, Date & Time, Amount */}
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap text-xs">
                                    <Receipt className="w-4 h-4 text-[#007AFF] shrink-0" />
                                    {(!r.receiptNumber.startsWith('DIG-') && !r.receiptNumber.includes('-TXN-')) ? (
                                      <span className="font-bold text-[#1C1C1E] text-sm">{r.receiptNumber}</span>
                                    ) : (
                                      <span className="font-bold text-[#8E8E93] italic text-sm">Digital Record</span>
                                    )}
                                    <span className="text-[#34C759] font-medium">&bull; Reconciled</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-[11px] text-[#6C6C70] flex-wrap">
                                    <span className="font-medium text-[#1C1C1E]">{r.paymentMethod}</span>
                                    <span>&bull;</span>
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3 h-3 text-[#8E8E93]" />
                                      <span>{r.formattedDate ? `${r.formattedDate}, ${r.formattedTime}` : r.datePaid}</span>
                                    </span>
                                    {r.transactionReference && (
                                      <>
                                        <span>&bull;</span>
                                        <span className="font-mono text-[#8E8E93]">Ref: {r.transactionReference}</span>
                                      </>
                                    )}
                                  </div>
                                  {(r.payerName || r.payerPhoneNumber) && (
                                    <div className="flex items-center gap-1.5 text-[11px] text-[#6C6C70]">
                                      <Phone className="w-3 h-3 text-[#8E8E93] shrink-0" />
                                      <span>
                                        Paid by MoMo: <strong className="text-[#1C1C1E]">{r.payerName || "Property Owner"}</strong> {r.payerPhoneNumber ? `(${r.payerPhoneNumber})` : ""}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                <div className="text-right shrink-0">
                                  <span className="font-bold text-[#34C759] text-base whitespace-nowrap tabular-nums">{r.amountFormatted}</span>
                                  <p className="text-[#6C6C70] text-[10px] mt-0.5 whitespace-nowrap font-medium">{r.settlementType} Assessment</p>
                                </div>
                              </div>

                              {/* Storytelling Narrative Card (What Was Paid, What Updated, Next Steps) */}
                              <div className="bg-[#F8F9FA] border border-[#E5E5EA] rounded-lg p-3 space-y-2.5 text-xs">
                                {/* 1. What was paid for */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-2 border-b border-[#E5E5EA]">
                                  <div className="space-y-0.5">
                                    <span className="text-[10px] uppercase font-semibold text-[#8E8E93] tracking-wide block">
                                      Target Assessment Account
                                    </span>
                                    <div className="flex items-center gap-2 text-xs font-semibold text-[#1C1C1E]">
                                      <span>{narrative?.targetAccount || r.propertyAccountNumber || "General Assessment"}</span>
                                      {narrative?.targetDigitalAddress && narrative.targetDigitalAddress !== "—" && (
                                        <span className="text-[#6C6C70] font-normal text-[11px]">
                                          ({narrative.targetDigitalAddress})
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3 text-[11px] text-[#6C6C70] shrink-0">
                                    <span>Overdue: <strong className="text-[#1C1C1E]">{narrative?.arrearsPaidFormatted || "GH₵ 0.00"}</strong></span>
                                    <span>&bull;</span>
                                    <span>Current Rate: <strong className="text-[#1C1C1E]">{narrative?.currentFeePaidFormatted || r.amountFormatted}</strong></span>
                                  </div>
                                </div>

                                {/* 2. What got updated & compliance status */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-2 border-b border-[#E5E5EA]">
                                  <div className="space-y-0.5">
                                    <span className="text-[10px] uppercase font-semibold text-[#8E8E93] tracking-wide block">
                                      Balance Transition
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[#8E8E93] line-through text-[11px]">
                                        Prior Due
                                      </span>
                                      <ArrowRight className="w-3 h-3 text-[#8E8E93]" />
                                      <span className="font-semibold text-[#1C1C1E] tabular-nums">
                                        Remaining: {narrative?.remainingTotalDueFormatted || "GH₵ 0.00"}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <span className={`font-semibold text-[11px] ${narrative?.isFullySettled ? "text-[#34C759]" : "text-[#FF9500]"}`}>
                                      {narrative?.isFullySettled ? "● Fully Paid (Zero Debt)" : "● Partial Payment Recorded"}
                                    </span>
                                  </div>
                                </div>

                                {/* 3. Next action */}
                                <div className="space-y-0.5 pt-0.5">
                                  <span className="text-[10px] uppercase font-semibold text-[#8E8E93] tracking-wide block">
                                    Account Status
                                  </span>
                                  <p className="text-[11px] text-[#6C6C70] leading-relaxed">
                                    {narrative?.actionRequiredText || (narrative?.isFullySettled
                                      ? "Account fully settled & cleared. Zero debt remaining."
                                      : "Account has remaining balance due for municipal settlement.")}
                                  </p>
                                </div>
                              </div>

                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {/* TAB 3: BILLS & LEDGER */}
                  {activeTab === "BILLS_LEDGER" && (
                    <div className="space-y-2">
                      {properties.length === 0 ? (
                        <p className="text-[#6C6C70] py-8 text-center italic">No properties linked to this account.</p>
                      ) : (
                        <HistoricalPaymentLedger
                          properties={properties}
                          receipts={receipts}
                          bills={dossier?.bills}
                          defaultPropertyAccountNumber={
                            properties.length === 1 ? properties[0].accountNumber : "ALL"
                          }
                        />
                      )}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
              )}
            </div>
          </motion.aside>

          {/* Bill Scan Upload Confirmation Modal */}
          {billConfirmUpload && (
            <div className="fixed inset-0 z-[10001] bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 pointer-events-auto">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white border border-[#E5E5EA] shadow-2xl rounded-2xl max-w-sm w-full p-5 space-y-4 text-xs"
              >
                <div className="flex items-center justify-between border-b border-[#E5E5EA] pb-2.5">
                  <div>
                    <h4 className="font-semibold text-sm text-[#1C1C1E]">Attach Official Bill Scan</h4>
                    <p className="text-[11px] text-[#6C6C70]">Property #{billConfirmUpload.accountNumber}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBillConfirmUpload(null)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-[#8E8E93] hover:text-[#1C1C1E] hover:bg-[#F2F2F7] transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="rounded-xl overflow-hidden border border-[#E5E5EA] bg-[#F2F2F7] max-h-56 flex items-center justify-center">
                  {billConfirmUpload.mimeType === 'application/pdf' ? (
                    <div className="p-6 flex flex-col items-center gap-2">
                      <FileImage className="w-8 h-8 text-[#007AFF]" />
                      <span className="text-xs text-[#6C6C70]">PDF Document Selected</span>
                    </div>
                  ) : (
                    <img
                      src={billConfirmUpload.dataUrl}
                      alt="Bill Scan Preview"
                      className="max-h-56 w-auto object-contain"
                    />
                  )}
                </div>

                <p className="text-[11px] text-[#6C6C70] leading-relaxed">
                  Confirm attaching this official municipal rate bill scan. Citizens will be able to view it from their SMS bill link.
                </p>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E5E5EA]">
                  <button
                    type="button"
                    disabled={isBillUploading}
                    onClick={() => setBillConfirmUpload(null)}
                    className="apple-btn-secondary h-8 px-3.5"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isBillUploading}
                    onClick={handleConfirmBillUpload}
                    className="apple-btn-primary h-8 px-4"
                  >
                    {isBillUploading ? (
                      <>
                        <AppleSpinner size="xs" />
                        <span>Uploading Bill Scan...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Confirm &amp; Attach</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          )}


        </motion.div>
      )}
    </AnimatePresence>
  );
}
