"use client";

import { useState, useEffect, useRef, ChangeEvent } from "react";
import {
  X,
  Copy,
  Check,
  ExternalLink,
  Printer,
  User,
  CheckCircle2,
  XCircle,
  Upload,
  Send,
} from "lucide-react";
import { motion } from "framer-motion";
import { AppleSpinner } from "@/components/ui/AppleSpinner";
import { attachScannedReceiptImage, sendReceiptNoticeSMS } from "@/app/actions";
import type { AdminPaidUserRecord } from "@/app/actions";

interface TransactionDetailWorkbenchProps {
  transaction: AdminPaidUserRecord;
  onBack: () => void;
  onOpenDossier: (rec: AdminPaidUserRecord) => void;
}

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

export default function TransactionDetailWorkbench({
  transaction,
  onBack,
  onOpenDossier,
}: TransactionDetailWorkbenchProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [receiptImage, setReceiptImage] = useState<string | null>((transaction as any).scannedImageUrl || null);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const [isDispatchingSms, setIsDispatchingSms] = useState(false);
  const [smsStatus, setSmsStatus] = useState<{ success: boolean; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lock background viewport scrolling when transaction workbench is active
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const handleReceiptFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setReceiptImage(base64);
      setIsUploadingReceipt(true);
      try {
        if (transaction.id) {
          await attachScannedReceiptImage(transaction.id, base64, file.type || "image/jpeg");
        }
      } catch (err) {
        console.error("Failed to upload receipt image:", err);
      } finally {
        setIsUploadingReceipt(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDispatchReceiptSms = async () => {
    if (!receiptImage || isDispatchingSms) return;
    setIsDispatchingSms(true);
    setSmsStatus(null);
    try {
      const res = await sendReceiptNoticeSMS(transaction.id);
      if (res && res.success) {
        setSmsStatus({
          success: true,
          message: `Official receipt SMS dispatched to ${transaction.phoneNumber || "ratepayer"}`,
        });
      } else {
        setSmsStatus({
          success: false,
          message: res?.error || "SMS dispatch simulation completed.",
        });
      }
    } catch (err: any) {
      setSmsStatus({
        success: false,
        message: err.message || "Failed to dispatch SMS",
      });
    } finally {
      setIsDispatchingSms(false);
    }
  };

  const rawName = transaction.userName?.trim();
  const isGenericOrPhone = !rawName || /^\d+$/.test(rawName) || rawName.toLowerCase() === "property owner";
  const validPayer = transaction.payerName && !/^\d+$/.test(transaction.payerName.trim()) && transaction.payerName.trim().toLowerCase() !== "property owner" ? transaction.payerName.trim() : null;
  const displayName = !isGenericOrPhone
    ? rawName
    : validPayer || rawName || "Property Owner";

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onBack();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onBack]);

  const isSuccess = transaction.status === "PAID" || transaction.status === "SUCCESS";
  const isFailed = transaction.status === "FAILED";

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200 pointer-events-auto">
      <div 
        className="fixed inset-0" 
        onClick={onBack} 
        aria-hidden="true" 
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="relative bg-white rounded-2xl border border-[#E5E5EA] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E5E5EA] flex items-center justify-between gap-3 bg-white shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="font-semibold text-sm text-[#1C1C1E]">Transaction Details</h3>
            <span className="text-[#8E8E93]">&rsaquo;</span>
            <span className="font-mono text-xs text-[#6C6C70] truncate">{transaction.id}</span>
          </div>

          <button
            type="button"
            onClick={onBack}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#8E8E93] hover:text-[#1C1C1E] hover:bg-[#F2F2F7] transition-colors cursor-pointer ml-1"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="px-6 py-5 overflow-y-auto flex-1 min-h-0 bg-white">
          {/* Section 1: Amount Paid & Transaction Key Details */}
          <div className="pb-5 border-b border-gray-100">
            <div className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider">
              Amount Paid
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold font-mono text-[#1C1C1E] tracking-tight">
                {transaction.amountPaidFormatted}
              </span>
              <span className={`text-xs font-semibold ${isSuccess ? "text-[#34C759]" : isFailed ? "text-[#FF3B30]" : "text-[#8E8E93]"}`}>
                &bull; {isSuccess ? "Paid" : isFailed ? "Declined" : "Unpaid"}
              </span>
            </div>
            {(transaction.arrearsPaid > 0 || transaction.currentPaid > 0) && (
              <div className="mt-2.5 pt-2 border-t border-gray-100 text-xs flex items-center gap-4 flex-wrap">
                {transaction.arrearsPaid > 0 && (
                  <span className="text-[#34C759] font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Arrears Cleared: <strong className="text-[#1C1C1E] font-semibold">GH₵ {transaction.arrearsPaid.toFixed(2)}</strong></span>
                  </span>
                )}
                {transaction.currentPaid > 0 && (
                  <span className="text-[#6C6C70] font-medium flex items-center gap-1.5">
                    <span>Current Paid: <strong className="text-[#1C1C1E] font-semibold">GH₵ {transaction.currentPaid.toFixed(2)}</strong></span>
                  </span>
                )}
              </div>
            )}

            {/* Transaction Key Details */}
            <div className="mt-4 pt-3 border-t border-gray-100 space-y-2.5 text-xs">
              {/* Reference */}
              <div className="grid grid-cols-[130px_1fr] sm:grid-cols-[150px_1fr] items-center gap-2">
                <span className="text-[#6C6C70]">Payment Reference</span>
                <div className="flex items-center gap-1.5 font-mono text-[#1C1C1E] min-w-0">
                  <span className="truncate flex-1 min-w-0 select-all" title={transaction.reference}>
                    {transaction.reference.replace(/--+/g, "-")}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(transaction.reference, "reference")}
                    className="text-[#8E8E93] hover:text-[#007AFF] p-0.5 cursor-pointer shrink-0"
                    title="Copy Reference"
                  >
                    {copiedField === "reference" ? (
                      <Check className="w-3.5 h-3.5 text-[#34C759]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Receipt Number */}
              {transaction.receiptNumber && !transaction.receiptNumber.startsWith("DIG-") && !transaction.receiptNumber.includes("-TXN-") && (
                <div className="grid grid-cols-[130px_1fr] sm:grid-cols-[150px_1fr] items-center gap-2">
                  <span className="text-[#6C6C70]">Receipt Number</span>
                  <div className="flex items-center gap-1.5 font-mono text-[#1C1C1E] min-w-0">
                    <span className="truncate flex-1 min-w-0">
                      {transaction.receiptNumber}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(transaction.receiptNumber, "receipt")}
                      className="text-[#8E8E93] hover:text-[#007AFF] p-0.5 cursor-pointer shrink-0"
                      title="Copy Receipt Number"
                    >
                      {copiedField === "receipt" ? (
                        <Check className="w-3.5 h-3.5 text-[#34C759]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Channel */}
              <div className="grid grid-cols-[130px_1fr] sm:grid-cols-[150px_1fr] items-center gap-2">
                <span className="text-[#6C6C70]">Payment Channel</span>
                <span className="font-medium text-[#1C1C1E]">{transaction.paymentMethod}</span>
              </div>

              {/* Paid At */}
              <div className="grid grid-cols-[130px_1fr] sm:grid-cols-[150px_1fr] items-center gap-2">
                <span className="text-[#6C6C70]">Payment Date</span>
                <span className="font-medium text-[#1C1C1E]">{transaction.paidAt}</span>
              </div>

              {/* Gateway Message */}
              <div className="grid grid-cols-[130px_1fr] sm:grid-cols-[150px_1fr] items-center gap-2">
                <span className="text-[#6C6C70]">Payment Status</span>
                <span className="font-medium text-[#1C1C1E]">
                  {transaction.gatewayResponse || (isSuccess ? "Approved" : isFailed ? "Failed" : "Abandoned")}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Property Owner Account */}
          <div className="py-5 border-b border-gray-100">
            <div className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-2.5">
              Property Owner Account
            </div>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-full bg-[#007AFF]/10 text-[#007AFF] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  {getInitials(displayName)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-xs text-[#1C1C1E]">
                    {displayName}
                  </div>
                  <div className="text-[11px] text-[#6C6C70] font-mono">
                    {transaction.phoneNumber}
                  </div>
                  {transaction.accountNumber && (
                    <div className="text-[11px] text-[#007AFF] font-mono mt-0.5">
                      Property #{transaction.accountNumber}
                    </div>
                  )}
                  {transaction.payerEmail && (
                    <div className="text-[11px] text-[#8E8E93] truncate max-w-[240px] sm:max-w-none block mt-0.5" title={transaction.payerEmail}>
                      {transaction.payerEmail}
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => onOpenDossier(transaction)}
                className="apple-btn-secondary h-8 px-2.5 text-xs font-medium flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <User className="w-3.5 h-3.5" />
                <span>View Profile</span>
                <ExternalLink className="w-3 h-3 text-[#8E8E93]" />
              </button>
            </div>
          </div>

          {/* Section 3: Official Scanned Receipt Attachment & SMS Dispatch */}
          <div className="pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider block">
                  Official Receipt Scan &amp; SMS Dispatch
                </span>
                <span className="text-xs text-[#6C6C70]">
                  Attach physical receipt image to authorize Ratepayer SMS dispatch
                </span>
              </div>
              {receiptImage && (
                <span className="text-[11px] font-semibold text-[#34C759] flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Receipt Attached
                </span>
              )}
            </div>

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*,.pdf"
              onChange={handleReceiptFileChange}
              className="hidden"
            />

            <div className="flex items-center gap-3 pt-1">
              {receiptImage ? (
                <div className="flex items-center gap-2">
                  <a
                    href={receiptImage}
                    target="_blank"
                    rel="noreferrer"
                    className="relative group block shrink-0"
                    title="Click to view full receipt"
                  >
                    <img
                      src={receiptImage}
                      alt="Receipt Attachment Thumbnail"
                      className="w-10 h-10 rounded-lg border border-[#E5E5EA] object-cover shadow-2xs hover:opacity-85 transition-opacity"
                    />
                  </a>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingReceipt}
                    className="apple-btn-secondary h-8 px-2.5 text-xs font-medium flex items-center gap-1.5 cursor-pointer text-[#1C1C1E] border-[#E5E5EA]"
                  >
                    <Upload className="w-3 h-3 text-[#007AFF]" />
                    <span>Change Receipt</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingReceipt}
                  className="apple-btn-primary h-8 px-3 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-98"
                >
                  {isUploadingReceipt ? (
                    <AppleSpinner size="xs" className="text-white" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  <span>Attach Official Receipt Image</span>
                </button>
              )}

              {/* Dispatch Receipt SMS Button */}
              <button
                type="button"
                onClick={handleDispatchReceiptSms}
                disabled={!receiptImage || isDispatchingSms}
                className={`h-8 px-3 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all ${
                  !receiptImage
                    ? "apple-btn-secondary opacity-50 cursor-not-allowed text-[#8E8E93] border-[#E5E5EA]"
                    : "apple-btn-primary bg-[#007AFF] text-white hover:bg-[#0062CC] cursor-pointer shadow-xs active:scale-98"
                }`}
                title={!receiptImage ? "Attach physical receipt scan above to authorize SMS dispatch" : "Dispatch receipt SMS notice to ratepayer"}
              >
                {isDispatchingSms ? (
                  <>
                    <AppleSpinner size="xs" className="text-white" />
                    <span>Dispatching...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Dispatch Receipt SMS</span>
                  </>
                )}
              </button>
            </div>

            {smsStatus && (
              <div
                className={`text-xs pt-1 flex items-center gap-1.5 ${
                  smsStatus.success ? "text-[#34C759] font-medium" : "text-[#FF3B30]"
                }`}
              >
                {smsStatus.success ? (
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>{smsStatus.message}</span>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer with Clean Outline & Secondary Actions */}
        <div className="px-6 py-3.5 border-t border-gray-100 bg-white flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onBack}
            className="apple-btn-secondary h-8 px-3.5 text-xs font-medium cursor-pointer"
          >
            Close
          </button>
          {isSuccess && (
            <button
              type="button"
              onClick={handlePrint}
              className="apple-btn-secondary h-8 px-3.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer text-[#007AFF] border-[#007AFF]/30 hover:bg-[#007AFF]/5 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Official Receipt</span>
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
