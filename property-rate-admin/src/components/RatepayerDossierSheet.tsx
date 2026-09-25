"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  User,
  Phone,
  Building2,
  Receipt,
  MessageSquare,
  Loader2,
  Camera,
  Eye,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Send,
  Download,
  FileImage,
} from "lucide-react";
import { exportRatepayerDossierCsv } from "@/lib/csv-export";
import {
  RatepayerHistoryDossier,
  AdminPropertyReceipt,
  attachScannedReceiptImage,
  attachPropertyBillImage,
  sendReceiptNoticeSMS,
} from "@/app/actions";

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
}

type DossierTab = "PROPERTIES" | "PAYMENTS" | "SMS_NOTICES" | "AUDIT_TRAIL";

export function RatepayerDossierSheet({
  dossier,
  preview,
  isLoading = false,
  isOpen,
  onClose,
  onSelectProperty,
}: RatepayerDossierSheetProps) {
  const [activeTab, setActiveTab] = useState<DossierTab>("PROPERTIES");
  const [localReceipts, setLocalReceipts] = useState<AdminPropertyReceipt[]>([]);
  const [confirmUpload, setConfirmUpload] = useState<{
    receiptId: string;
    receiptNumber: string;
    dataUrl: string;
    mimeType: string;
  } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewingImage, setPreviewingImage] = useState<{
    url: string;
    receiptNumber: string;
  } | null>(null);
  const [sendingSmsReceiptId, setSendingSmsReceiptId] = useState<string | null>(null);
  const [smsStatus, setSmsStatus] = useState<{ [receiptId: string]: string }>({});
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

  const handleExportDossier = () => {
    if (!dossier) return;
    const totalVal = (dossier.properties || []).reduce((sum, p) => sum + (p.rateableValue || 0), 0);
    const totalArr = (dossier.properties || []).reduce((sum, p) => sum + (p.arrears || 0), 0);
    const totalDue = (dossier.properties || []).reduce((sum, p) => sum + (p.totalAmountDue || 0), 0);
    exportRatepayerDossierCsv(dossier, {
      reportTitle: `Ratepayer Historical Dossier - ${dossier.user.name || "Citizen"}`,
      filterScope: `Ratepayer ID: ${dossier.user.id} | Phone: ${dossier.user.phoneNumber}`,
      recordCount: (dossier.properties || []).length,
      financialSummary: {
        totalValuation: totalVal,
        totalArrears: totalArr,
        totalDue: totalDue,
      },
    });
  };

  const handleFileSelected = (
    receiptId: string,
    receiptNumber: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setConfirmUpload({
        receiptId,
        receiptNumber,
        dataUrl: reader.result as string,
        mimeType: file.type || "image/jpeg",
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleConfirmUpload = async () => {
    if (!confirmUpload) return;
    setIsUploading(true);
    try {
      const res = await attachScannedReceiptImage(
        confirmUpload.receiptId,
        confirmUpload.dataUrl,
        confirmUpload.mimeType
      );
      if (res.success && res.publicUrl) {
        setLocalReceipts((prev) =>
          prev.map((r) =>
            r.id === confirmUpload.receiptId
              ? { ...r, scannedImageUrl: res.publicUrl }
              : r
          )
        );
        setConfirmUpload(null);
      } else {
        alert(res.error || "Failed to attach image.");
      }
    } catch (err) {
      console.error(err);
      alert("An unexpected error occurred while uploading.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSendReceiptSms = async (receiptId: string) => {
    setSendingSmsReceiptId(receiptId);
    try {
      const res = await sendReceiptNoticeSMS(receiptId);
      if (res.success) {
        setSmsStatus((prev) => ({ ...prev, [receiptId]: "SMS Dispatched!" }));
        setTimeout(() => {
          setSmsStatus((prev) => {
            const copy = { ...prev };
            delete copy[receiptId];
            return copy;
          });
        }, 4000);
      } else {
        alert(res.error || "Failed to send SMS notice.");
      }
    } catch (err) {
      console.error(err);
      alert("Error sending receipt SMS.");
    } finally {
      setSendingSmsReceiptId(null);
    }
  };

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
  const notifications = dossier?.notifications || [];
  const auditLogs = dossier?.auditLogs || [];

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
      key: "SMS_NOTICES",
      label: isDossierLoaded ? `SMS Notices (${notifications.length})` : "SMS Notices",
    },
    {
      key: "AUDIT_TRAIL",
      label: isDossierLoaded ? `Activity Log (${auditLogs.length})` : "Activity Log",
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          key="ratepayer-dossier-wrapper"
          className="fixed inset-0 z-50 flex justify-end pointer-events-auto"
        >
          {/* Backdrop */}
          <motion.div
            key="ratepayer-dossier-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="fixed inset-0 bg-black/35"
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
                <div className="w-10 h-10 rounded-xl bg-[#007AFF]/10 text-[#007AFF] flex items-center justify-center shrink-0">
                  <User className="w-5 h-5" />
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
                        &bull; {summary.status === "SETTLED" ? "Compliant & Settled" : summary.status === "DEFAULTER" ? "Overdue Balance" : "Balance Due"}
                      </span>
                    ) : (
                      <div className="h-3 w-20 bg-[#E5E5EA] animate-pulse rounded-md" />
                    )}

                    {isLoading && (
                      <span className="flex items-center ml-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#007AFF]" />
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
                </div>
              </div>

              <div className="flex items-center gap-2">
                {dossier && (
                  <button
                    type="button"
                    onClick={handleExportDossier}
                    className="apple-btn-secondary h-8 px-2.5 text-[#007AFF] border-[#007AFF]/30 flex items-center gap-1.5"
                    title="Export Ratepayer Dossier CSV"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Export Profile CSV</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-[#8E8E93] hover:text-[#1C1C1E] hover:bg-[#F2F2F7] transition-colors cursor-pointer"
                  aria-label="Close dossier"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Citizen Quick Profile Bar */}
            <div className="bg-[#F8F9FA] px-6 py-3.5 border-b border-[#E5E5EA] grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs shrink-0">
              {user ? (
                <>
                  <div>
                    <span className="text-[#6C6C70] block text-[11px]">Primary Phone</span>
                    <span className="font-mono font-medium text-[#1C1C1E] flex items-center gap-1 mt-0.5">
                      <Phone className="w-3.5 h-3.5 text-[#8E8E93]" />
                      <span>{user.phoneNumber}</span>
                    </span>
                  </div>
                  <div>
                    <span className="text-[#6C6C70] block text-[11px]">Account Type</span>
                    <span className="font-medium text-[#1C1C1E] mt-0.5 block">{user.role}</span>
                  </div>
                  <div>
                    <span className="text-[#6C6C70] block text-[11px]">Registered Date</span>
                    <span className="font-medium text-[#1C1C1E] mt-0.5 block">{user.createdAtFormatted}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <div className="h-3 w-16 bg-[#E5E5EA] animate-pulse rounded" />
                    <div className="h-4 w-28 bg-[#E5E5EA] animate-pulse rounded" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="h-3 w-16 bg-[#E5E5EA] animate-pulse rounded" />
                    <div className="h-4 w-20 bg-[#E5E5EA] animate-pulse rounded" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="h-3 w-20 bg-[#E5E5EA] animate-pulse rounded" />
                    <div className="h-4 w-24 bg-[#E5E5EA] animate-pulse rounded" />
                  </div>
                </>
              )}
            </div>

            {/* Financial Summary Scorecards (Zero Pills) */}
            <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-[#F8F9FA] border-b border-[#E5E5EA] grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 text-xs shrink-0">
              {summary ? (
                <>
                  <div className="p-3 bg-white border border-[#E5E5EA] rounded-xl shadow-2xs">
                    <span className="text-[#6C6C70] text-[11px] block">Properties Registered</span>
                    <span className="text-lg font-semibold text-[#1C1C1E] mt-1 block">
                      {summary.totalProperties} <span className="text-xs font-normal text-[#8E8E93]">Parcels</span>
                    </span>
                    <span className="text-[10px] text-[#6C6C70] mt-1 block whitespace-nowrap tabular-nums">Valuation: {summary.totalValuationFormatted}</span>
                  </div>

                  <div className="p-3 bg-white border border-[#E5E5EA] rounded-xl shadow-2xs">
                    <span className="text-[#6C6C70] text-[11px] block">Total Outstanding Due</span>
                    <span className="text-lg font-semibold text-[#1C1C1E] mt-1 block whitespace-nowrap tabular-nums">
                      {summary.totalOutstandingDueFormatted}
                    </span>
                    <span className="text-[10px] text-[#FF3B30] mt-1 block whitespace-nowrap tabular-nums">Arrears: {summary.totalArrearsFormatted}</span>
                  </div>

                  <div className="p-3 bg-white border border-[#E5E5EA] rounded-xl shadow-2xs">
                    <span className="text-[#6C6C70] text-[11px] block">Total Settled (All-Time)</span>
                    <span className="text-lg font-semibold text-[#34C759] mt-1 block whitespace-nowrap tabular-nums">
                      {summary.totalPaidFormatted}
                    </span>
                    <span className="text-[10px] text-[#6C6C70] mt-1 block">
                      {isDossierLoaded ? `${receipts.length} treasury receipts` : "Reconciling..."}
                    </span>
                  </div>
                </>
              ) : (
                [1, 2, 3].map((i) => (
                  <div key={i} className="p-3 bg-white border border-[#E5E5EA] rounded-xl space-y-2">
                    <div className="h-3 w-20 bg-[#E5E5EA] animate-pulse rounded" />
                    <div className="h-6 w-24 bg-[#E5E5EA] animate-pulse rounded" />
                    <div className="h-2.5 w-16 bg-[#E5E5EA] animate-pulse rounded" />
                  </div>
                ))
              )}
            </div>

            {/* Dossier Tabs Navigation (Zero Pills - Underline Indicator) */}
            <div className="px-6 border-b border-[#E5E5EA] bg-white flex items-center gap-6 text-xs shrink-0 overflow-x-auto">
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

            {/* Tab Content Area */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 text-xs min-h-0 bg-[#F2F2F7]">
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

                  {activeTab === "SMS_NOTICES" && (
                    <>
                      {[1, 2].map((i) => (
                        <div
                          key={i}
                          className="p-3.5 bg-white border border-[#E5E5EA] rounded-xl shadow-xs space-y-2.5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="h-4 w-40 bg-[#E5E5EA] animate-pulse rounded" />
                            <div className="h-3 w-24 bg-[#E5E5EA] animate-pulse rounded" />
                          </div>
                          <div className="h-14 w-full bg-[#E5E5EA] animate-pulse rounded-lg" />
                          <div className="flex items-center justify-between">
                            <div className="h-3 w-32 bg-[#E5E5EA] animate-pulse rounded" />
                            <div className="h-3 w-20 bg-[#E5E5EA] animate-pulse rounded" />
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {activeTab === "AUDIT_TRAIL" && (
                    <>
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="p-3 bg-white border border-[#E5E5EA] rounded-xl shadow-xs flex items-start justify-between"
                        >
                          <div className="space-y-1.5 flex-1">
                            <div className="h-4 w-36 bg-[#E5E5EA] animate-pulse rounded" />
                            <div className="h-3 w-56 bg-[#E5E5EA] animate-pulse rounded" />
                          </div>
                          <div className="h-3 w-20 bg-[#E5E5EA] animate-pulse rounded" />
                        </div>
                      ))}
                    </>
                  )}
                </div>
              ) : (
                <>
                  {/* TAB 1: PROPERTIES */}
                  {activeTab === "PROPERTIES" && (
                    <div className="space-y-3">
                      {properties.length === 0 ? (
                        <p className="text-[#6C6C70] py-8 text-center italic">No property parcels linked to this ratepayer.</p>
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
                                <span
                                  className={`text-xs font-semibold ${
                                    prop.status === "PAID"
                                      ? "text-[#34C759]"
                                      : prop.status === "PARTIALLY_PAID"
                                      ? "text-[#FF9500]"
                                      : "text-[#FF3B30]"
                                  }`}
                                >
                                  {prop.status === "PAID" ? "Settled" : prop.status === "PARTIALLY_PAID" ? "Partial" : "Unpaid"}
                                </span>
                                <p className="font-semibold text-[#1C1C1E] text-sm mt-1 whitespace-nowrap tabular-nums">{prop.totalAmountDueFormatted}</p>
                                {prop.arrears > 0 && (
                                  <p
                                    className={`text-[11px] whitespace-nowrap tabular-nums ${
                                      prop.status === "PAID"
                                        ? "line-through text-[#8E8E93]"
                                        : "text-[#FF3B30]"
                                    }`}
                                    title={prop.status === "PAID" ? "Arrears cleared" : undefined}
                                  >
                                    Arrears: {prop.arrearsFormatted}
                                  </p>
                                )}
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
                              <span className="whitespace-nowrap tabular-nums">Rateable Valuation: {prop.rateableValueFormatted}</span>
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
                                  className="text-[#007AFF] hover:underline font-medium cursor-pointer"
                                >
                                  View Property Details &rarr;
                                </button>
                              )}
                            </div>
                          </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {/* TAB 2: PAYMENTS LEDGER */}
                  {activeTab === "PAYMENTS" && (
                    <div className="space-y-3">
                      {receipts.length === 0 ? (
                        <p className="text-[#6C6C70] py-8 text-center italic">No payment transactions recorded on this account.</p>
                      ) : (
                        receipts.map((r) => (
                          <div
                            key={r.id}
                            className="p-3.5 bg-white border border-[#E5E5EA] rounded-xl shadow-xs space-y-2.5"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-0.5 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Receipt className="w-3.5 h-3.5 text-[#007AFF] shrink-0" />
                                  <span className="font-semibold text-[#1C1C1E]">{r.receiptNumber}</span>
                                  <span className="text-[#34C759] font-medium">&bull; Reconciled</span>
                                  {r.scannedImageUrl ? (
                                    <span className="text-[#34C759] text-[11px] font-medium flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3 text-[#34C759]" />
                                      <span>Scanned GCR Attached</span>
                                    </span>
                                  ) : (
                                    <span className="text-[#8E8E93] text-[11px] italic">
                                      &bull; No Physical Scan
                                    </span>
                                  )}
                                </div>
                                <p className="text-[#6C6C70] text-[11px]">
                                  {r.paymentMethod} &bull; {r.datePaid}
                                </p>
                              </div>

                              <div className="text-right shrink-0">
                                <span className="font-semibold text-[#34C759] text-sm whitespace-nowrap tabular-nums">{r.amountFormatted}</span>
                                <p className="text-[#6C6C70] text-[10px] mt-0.5 whitespace-nowrap">{r.settlementType} Assessment</p>
                              </div>
                            </div>

                            {/* Action Bar: View/Attach Stamped Leaf & Dispatch SMS */}
                            <div className="pt-2 border-t border-[#E5E5EA] flex items-center justify-between gap-2 text-xs flex-wrap">
                              <div className="flex items-center gap-3">
                                {r.scannedImageUrl && (
                                  <button
                                    type="button"
                                    onClick={() => setPreviewingImage({ url: r.scannedImageUrl!, receiptNumber: r.receiptNumber })}
                                    className="text-[#007AFF] hover:underline font-medium flex items-center gap-1 cursor-pointer"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>Inspect Scanned Leaf</span>
                                  </button>
                                )}

                                <label className="text-[#007AFF] hover:underline font-medium flex items-center gap-1 cursor-pointer">
                                  <Camera className="w-3.5 h-3.5" />
                                  <span>{r.scannedImageUrl ? "Replace Scan" : "Attach Scanned GCR Leaf"}</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="hidden"
                                    onChange={(e) => handleFileSelected(r.id, r.receiptNumber, e)}
                                  />
                                </label>
                              </div>

                              <div className="flex items-center gap-2">
                                {smsStatus[r.id] && (
                                  <span className="text-[11px] text-[#34C759] font-medium">
                                    {smsStatus[r.id]}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  disabled={sendingSmsReceiptId === r.id}
                                  onClick={() => handleSendReceiptSms(r.id)}
                                  className="text-[#34C759] hover:underline font-medium flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                >
                                  {sendingSmsReceiptId === r.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Send className="w-3 h-3" />
                                  )}
                                  <span>{sendingSmsReceiptId === r.id ? "Dispatching..." : "Dispatch Receipt SMS"}</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* TAB 3: SMS & COMMUNICATIONS */}
                  {activeTab === "SMS_NOTICES" && (
                    <div className="space-y-3">
                      {notifications.length === 0 ? (
                        <p className="text-[#6C6C70] py-8 text-center italic">No SMS or dispatch notices found for this ratepayer.</p>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            className="p-3.5 bg-white border border-[#E5E5EA] rounded-xl shadow-xs space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <MessageSquare className="w-3.5 h-3.5 text-[#007AFF]" />
                                <span className="font-semibold text-[#1C1C1E]">{n.title}</span>
                                <span className="text-[#6C6C70] text-[11px]">&bull; {n.deliveryMethod}</span>
                              </div>
                              <span className="text-[11px] text-[#8E8E93]">{n.createdAtFormatted}</span>
                            </div>

                            <div className="p-2.5 bg-[#F2F2F7] border border-[#E5E5EA] rounded-lg text-xs text-[#1C1C1E] leading-relaxed">
                              {n.message}
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-[#6C6C70]">
                              <span>Delivery Status: <strong className="text-[#34C759] font-medium">{n.deliveryStatus}</strong></span>
                              <span>Type: {n.type}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* TAB 4: AUDIT TRAIL */}
                  {activeTab === "AUDIT_TRAIL" && (
                    <div className="space-y-3">
                      {auditLogs.length === 0 ? (
                        <p className="text-[#6C6C70] py-8 text-center italic">No administrative audit events recorded for this user.</p>
                      ) : (
                        auditLogs.map((a) => (
                          <div
                            key={a.id}
                            className="p-3 bg-white border border-[#E5E5EA] rounded-xl shadow-xs flex items-start justify-between text-xs"
                          >
                            <div className="space-y-0.5">
                              <span className="font-semibold text-[#1C1C1E]">{a.action}</span>
                              <p className="text-[#6C6C70] text-xs">{a.details}</p>
                            </div>
                            <span className="text-[#8E8E93] text-[11px] shrink-0">{a.createdAtFormatted}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 border-t border-[#E5E5EA] bg-white/80 backdrop-blur-md flex items-center justify-between text-xs shrink-0">
              <span className="text-[#8E8E93]">
                Kpone-Katamanso Municipal Assembly (KKMA) &bull; Ratepayer Registry
              </span>
              <button
                type="button"
                onClick={onClose}
                className="apple-btn-secondary h-8 px-3.5"
              >
                Close Dossier
              </button>
            </div>
          </motion.aside>

          {/* Bill Scan Upload Confirmation Modal */}
          {billConfirmUpload && (
            <div className="fixed inset-0 z-60 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
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
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
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

          {/* Scanned Receipt Upload Confirmation Modal */}
          {confirmUpload && (
            <div className="fixed inset-0 z-60 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white border border-[#E5E5EA] shadow-2xl rounded-2xl max-w-sm w-full p-5 space-y-4 text-xs"
              >
                <div className="flex items-center justify-between border-b border-[#E5E5EA] pb-2.5">
                  <div>
                    <h4 className="font-semibold text-sm text-[#1C1C1E]">Attach Scanned GCR Leaf</h4>
                    <p className="text-[11px] text-[#6C6C70]">Receipt #{confirmUpload.receiptNumber}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmUpload(null)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-[#8E8E93] hover:text-[#1C1C1E] hover:bg-[#F2F2F7] transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="rounded-xl overflow-hidden border border-[#E5E5EA] bg-[#F2F2F7] max-h-56 flex items-center justify-center">
                  <img
                    src={confirmUpload.dataUrl}
                    alt="Scanned Receipt Preview"
                    className="max-h-56 w-auto object-contain"
                  />
                </div>

                <p className="text-[11px] text-[#6C6C70] leading-relaxed">
                  Confirm attaching this physical GCR receipt leaf. It will be stored in municipal cloud storage and accessible by the citizen via their SMS receipt link.
                </p>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E5E5EA]">
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => setConfirmUpload(null)}
                    className="apple-btn-secondary h-8 px-3.5"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={handleConfirmUpload}
                    className="apple-btn-primary h-8 px-4"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Uploading to Storage...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Attach to Receipt</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {/* High-Res Scanned Image Lightbox */}
          {previewingImage && (
            <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white border border-[#E5E5EA] shadow-2xl rounded-2xl max-w-lg w-full p-4 space-y-3 text-xs">
                <div className="flex items-center justify-between border-b border-[#E5E5EA] pb-2">
                  <div>
                    <h4 className="font-semibold text-sm text-[#1C1C1E]">Physical Stamped GCR Leaf</h4>
                    <p className="text-[11px] text-[#6C6C70]">Receipt #{previewingImage.receiptNumber}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={previewingImage.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 text-[#007AFF] hover:bg-[#F2F2F7] rounded-lg cursor-pointer transition-colors"
                      title="Open full size"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button
                      type="button"
                      onClick={() => setPreviewingImage(null)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[#8E8E93] hover:text-[#1C1C1E] hover:bg-[#F2F2F7] cursor-pointer transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="rounded-xl overflow-hidden border border-[#E5E5EA] bg-[#F2F2F7] max-h-[60vh] flex items-center justify-center p-2">
                  <img
                    src={previewingImage.url}
                    alt={`Receipt ${previewingImage.receiptNumber}`}
                    className="max-h-[56vh] w-auto object-contain rounded"
                  />
                </div>

                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => setPreviewingImage(null)}
                    className="apple-btn-secondary h-8 px-4"
                  >
                    Close Preview
                  </button>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
