"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Search,
  Check,
  Building2,
  Trash2,
} from "lucide-react";
import { AppleSpinner } from "./ui/AppleSpinner";
import { formatGhc } from "@/lib/formatters";

interface IdentifiedPaymentRow {
  accountNumber: string;
  amount: number;
  receiptNumber?: string;
  payerName?: string;
  paymentMethod?: string;
  paymentDate?: string;
}

interface PaymentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (count: number, totalAmount: number) => void;
}

export function PaymentUploadModal({ isOpen, onClose, onSuccess }: PaymentUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [parsedOverview, setParsedOverview] = useState<{
    totalIdentified: number;
    skippedCount: number;
    uniqueAccountsCount: number;
    totalAmount: number;
    previewRows: IdentifiedPaymentRow[];
    allRows: IdentifiedPaymentRow[];
  } | null>(null);

  const [previewSearch, setPreviewSearch] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lock background scroll when modal is active
  useEffect(() => {
    if (isOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    } else {
      // Reset state on close
      setFile(null);
      setParsedOverview(null);
      setPreviewSearch("");
      setErrorMsg(null);
      setSuccessMsg(null);
      setIsReadingFile(false);
      setIsConfirming(false);
    }
  }, [isOpen]);

  // Fallback check for reduced performance / low-spec devices
  const isReducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Strict Excel format validation & preview fetch
  const handleProcessExcelFile = async (selectedFile: File) => {
    const fileName = selectedFile.name.toLowerCase();
    const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");

    if (!isExcel) {
      setErrorMsg("Invalid file format. Only Excel spreadsheets (.xlsx, .xls) are accepted.");
      setFile(null);
      setParsedOverview(null);
      return;
    }

    setFile(selectedFile);
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsReadingFile(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("confirm", "false");

      const res = await fetch("/api/payments/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.error || "Failed to process Excel spreadsheet. Please ensure it is a valid Excel workbook.");
        setParsedOverview(null);
      } else {
        setParsedOverview({
          totalIdentified: data.totalIdentified,
          skippedCount: data.skippedCount,
          uniqueAccountsCount: data.uniqueAccountsCount,
          totalAmount: data.totalAmount,
          previewRows: data.previewRows || [],
          allRows: data.allRows || [],
        });
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred while reading the Excel file.");
      setParsedOverview(null);
    } finally {
      setIsReadingFile(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleProcessExcelFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleConfirmImport = async () => {
    if (!file || !parsedOverview || parsedOverview.allRows.length === 0) {
      setErrorMsg("No valid payment records to confirm.");
      return;
    }

    setIsConfirming(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("confirm", "true");

      const res = await fetch("/api/payments/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.error || "Failed to finalize batch payment import.");
      } else {
        setSuccessMsg(
          `Successfully imported and reconciled ${data.importedCount} payment records totaling ${formatGhc(data.totalAmount)}.`
        );
        if (onSuccess) {
          onSuccess(data.importedCount || parsedOverview.allRows.length, data.totalAmount || parsedOverview.totalAmount);
        }
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to confirm batch payment import.");
    } finally {
      setIsConfirming(false);
    }
  };

  const handleClearFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFile(null);
    setParsedOverview(null);
    setErrorMsg(null);
    setSuccessMsg(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Filter preview rows by user search
  const filteredRows = (parsedOverview?.allRows || []).filter((r) => {
    if (!previewSearch.trim()) return true;
    const q = previewSearch.toLowerCase();
    return (
      r.accountNumber.toLowerCase().includes(q) ||
      (r.payerName && r.payerName.toLowerCase().includes(q)) ||
      (r.receiptNumber && r.receiptNumber.toLowerCase().includes(q)) ||
      (r.paymentMethod && r.paymentMethod.toLowerCase().includes(q))
    );
  });

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
        {/* Apple-like Scrim Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={isConfirming || isReadingFile ? undefined : onClose}
          className="fixed inset-0 bg-black/40 backdrop-blur-md transition-all cursor-pointer"
        />

        {/* Focused Modal Dialog */}
        <motion.div
          initial={isReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 8 }}
          animate={isReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
          exit={isReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 8 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-[#E5E5EA] overflow-hidden flex flex-col z-10 font-sans"
        >
          {/* Header */}
          <div className="px-5 pt-5 pb-3 flex items-start justify-between border-b border-[#F2F2F7]">
            <div className="space-y-0.5">
              <h3 className="text-base font-semibold text-[#1D1D1F] tracking-tight flex items-center gap-2">
                <span>Upload Excel Payment Records</span>
              </h3>
              <p className="text-xs text-[#8E8E93]">
                Upload an Excel spreadsheet (.xlsx, .xls) to preview and reconcile payments
              </p>
            </div>
            <button
              type="button"
              disabled={isConfirming || isReadingFile}
              onClick={onClose}
              className="p-1 rounded-full text-[#8E8E93] hover:text-[#1D1D1F] hover:bg-[#F2F2F7] transition-all cursor-pointer disabled:opacity-40"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-5 space-y-4 no-scrollbar max-h-[75vh] overflow-y-auto">
            {/* 1. Drag & Drop Surface with Strict Excel Validation */}
            {!parsedOverview && (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                  isDragging
                    ? "border-[#007AFF] bg-[#007AFF]/5"
                    : isReadingFile
                    ? "border-[#007AFF]/50 bg-[#FBFBFD]"
                    : "border-[#D2D2D7] hover:border-[#8E8E93] bg-[#FBFBFD]"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleProcessExcelFile(e.target.files[0]);
                    }
                  }}
                />

                <div className="w-12 h-12 rounded-full bg-white shadow-xs flex items-center justify-center border border-[#E5E5EA]">
                  {isReadingFile ? (
                    <AppleSpinner size="sm" className="text-[#007AFF]" />
                  ) : (
                    <FileSpreadsheet className="w-6 h-6 text-[#34C759]" />
                  )}
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-semibold text-[#1D1D1F]">
                    {isReadingFile ? "Reading Excel workbook..." : "Select Excel spreadsheet or drag & drop here"}
                  </p>
                  <p className="text-[11px] text-[#8E8E93]">
                    Accepts only <strong>.xlsx</strong> and <strong>.xls</strong> formats • Required: Account Number, Amount
                  </p>
                </div>
              </div>
            )}

            {/* Error Message Alert */}
            {errorMsg && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#FF3B30]/10 border border-[#FF3B30]/20 text-[#FF3B30] text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="font-medium">{errorMsg}</span>
              </div>
            )}

            {/* Success Message Alert */}
            {successMsg && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#34C759]/10 border border-[#34C759]/20 text-[#34C759] text-xs">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="font-medium">{successMsg}</span>
              </div>
            )}

            {/* 2. Executive Overview & Inspection Grid (When File is Parsed) */}
            {parsedOverview && (
              <div className="space-y-3.5">
                {/* Active File Bar */}
                <div className="flex items-center justify-between p-2.5 bg-[#F9F9FB] border border-[#E5E5EA] rounded-xl text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <FileSpreadsheet className="w-4 h-4 text-[#34C759] shrink-0" />
                    <span className="font-semibold text-[#1D1D1F] truncate">{file?.name}</span>
                    <span className="text-[11px] text-[#8E8E93] shrink-0">
                      ({((file?.size || 0) / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={isConfirming}
                    onClick={handleClearFile}
                    className="text-[#8E8E93] hover:text-[#FF3B30] p-1 rounded-md transition-colors cursor-pointer"
                    title="Remove file"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Key Metrics Overview Strip (Zero Pills Standard) */}
                <div className="flex items-center justify-between flex-wrap gap-2 text-xs py-1 px-1 border-b border-[#F2F2F7]">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[#34C759] font-semibold">
                      &bull; {parsedOverview.totalIdentified} Payments Identified
                    </span>
                    <span className="text-[#007AFF] font-medium">
                      &bull; {parsedOverview.uniqueAccountsCount} Property Accounts
                    </span>
                    {parsedOverview.skippedCount > 0 && (
                      <span className="text-[#8E8E93]">
                        &bull; {parsedOverview.skippedCount} rows skipped
                      </span>
                    )}
                  </div>
                  <span className="font-mono font-bold text-[#1D1D1F] text-[13px]">
                    Total: {formatGhc(parsedOverview.totalAmount)}
                  </span>
                </div>

                {/* Search / Filter Inside Preview */}
                <div className="relative w-full">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#8E8E93]" />
                  <input
                    type="text"
                    value={previewSearch}
                    onChange={(e) => setPreviewSearch(e.target.value)}
                    placeholder="Search identified payments by account, payer, receipt..."
                    className="w-full pl-8 pr-3 py-1.5 bg-[#F5F5F7] border border-[#E8E8ED] rounded-xl text-xs font-medium text-[#1D1D1F] placeholder-[#8E8E93] outline-none focus:border-[#007AFF] focus:bg-white transition-all"
                  />
                </div>

                {/* Detailed Preview Inspection Table (Zero Scrollbar Standard) */}
                <div className="border border-[#E5E5EA] rounded-xl overflow-hidden bg-white text-xs">
                  <div className="max-h-60 overflow-y-auto no-scrollbar">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-[#F9F9FB] text-[11px] font-semibold text-[#8E8E93] sticky top-0 z-10 border-b border-[#E5E5EA]">
                        <tr>
                          <th className="py-2 px-3">#</th>
                          <th className="py-2 px-3">Account No</th>
                          <th className="py-2 px-3">Payer / Name</th>
                          <th className="py-2 px-3 text-right">Net Amount</th>
                          <th className="py-2 px-3">Receipt / GCR</th>
                          <th className="py-2 px-3">Channel</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F2F2F7] font-mono text-[11px]">
                        {filteredRows.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-6 text-center text-[#8E8E93] font-sans">
                              No payments match your search filter
                            </td>
                          </tr>
                        ) : (
                          filteredRows.map((row, idx) => (
                            <tr key={idx} className="hover:bg-[#F9F9FB] transition-colors">
                              <td className="py-2 px-3 text-[#8E8E93]">{idx + 1}</td>
                              <td className="py-2 px-3 font-semibold text-[#1D1D1F]">{row.accountNumber}</td>
                              <td className="py-2 px-3 font-sans text-[#1D1D1F] truncate max-w-[120px]">
                                {row.payerName || "—"}
                              </td>
                              <td className="py-2 px-3 text-right font-bold text-[#1D1D1F]">
                                {formatGhc(row.amount)}
                              </td>
                              <td className="py-2 px-3 text-[#8E8E93] truncate max-w-[100px]">
                                {row.receiptNumber || "Auto-Assign"}
                              </td>
                              <td className="py-2 px-3 font-sans text-[#8E8E93] truncate max-w-[100px]">
                                {row.paymentMethod || "Excel Batch"}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  {filteredRows.length > 0 && (
                    <div className="px-3 py-1.5 bg-[#F9F9FB] text-right text-[11px] text-[#8E8E93] border-t border-[#E5E5EA]">
                      Showing {filteredRows.length} of {parsedOverview.totalIdentified} identified payments
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer Controls */}
          <div className="px-5 py-3.5 bg-[#F9F9FB] border-t border-[#F2F2F7] flex items-center justify-between gap-2.5">
            <button
              type="button"
              disabled={isConfirming || isReadingFile}
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl border border-[#D2D2D7] bg-white text-xs font-medium text-[#1D1D1F] hover:bg-[#F2F2F7] transition-all cursor-pointer disabled:opacity-40"
            >
              Cancel
            </button>

            {parsedOverview && (
              <button
                type="button"
                disabled={isConfirming || parsedOverview.allRows.length === 0}
                onClick={handleConfirmImport}
                className="px-4 py-2 rounded-xl bg-[#007AFF] text-white text-xs font-semibold hover:bg-[#0062CC] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-xs"
              >
                {isConfirming ? (
                  <>
                    <AppleSpinner size="sm" className="text-white" />
                    <span>Reconciling Payments...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>
                      Confirm & Reconcile ({parsedOverview.totalIdentified} Payments)
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default PaymentUploadModal;
