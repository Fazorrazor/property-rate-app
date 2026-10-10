"use client";

import React, { useState, useEffect, useMemo, useDeferredValue, useRef } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Plus,
  Receipt,
  Printer,
  X,
  Building2,
  Calendar,
  Edit2,
  Check,
  CheckCircle2,
  AlertTriangle,
  Globe,
  Lock,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { AppleSpinner } from "@/components/ui/AppleSpinner";
import {
  searchPropertyBillAccounts,
  getAccountPaymentsList,
  recordInPersonPayment,
  updatePaymentReceiptNumber,
  PropertyBillAccountSummary,
  UnifiedPaymentRecord,
} from "@/app/actions";
import { formatGhc, formatDateGb } from "@/lib/formatters";

interface PaymentsSectionProps {
  currentAdmin?: {
    id: string;
    username: string;
    name: string;
    role: string;
  } | null;
  initialAccountNo?: string;
  onOpenStatement?: (accountNo: string) => void;
}

export function PaymentsSection({
  currentAdmin,
  initialAccountNo,
  onOpenStatement,
}: PaymentsSectionProps) {
  // Navigation & Drilldown State
  const [selectedAccount, setSelectedAccount] = useState<PropertyBillAccountSummary | null>(null);

  // Accounts Directory Search & Pagination States
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [accounts, setAccounts] = useState<PropertyBillAccountSummary[]>([]);
  const [accountsTotal, setAccountsTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;
  const [totalPages, setTotalPages] = useState(1);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    tableContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Channel Segment Filter State (ALL | ONLINE | IN_PERSON)
  const [channelFilter, setChannelFilter] = useState<"ALL" | "ONLINE" | "IN_PERSON">("ALL");

  // Payments Ledger States (for selected account)
  const [payments, setPayments] = useState<UnifiedPaymentRecord[]>([]);
  const [paymentsSummary, setPaymentsSummary] = useState<{
    totalPaid: number;
    totalPaidFormatted: string;
    paymentsCount: number;
    onlinePaid: number;
    onlinePaidFormatted: string;
    onlineCount: number;
    inPersonPaid: number;
    inPersonPaidFormatted: string;
    inPersonCount: number;
  }>({
    totalPaid: 0,
    totalPaidFormatted: "GH₵ 0.00",
    paymentsCount: 0,
    onlinePaid: 0,
    onlinePaidFormatted: "GH₵ 0.00",
    onlineCount: 0,
    inPersonPaid: 0,
    inPersonPaidFormatted: "GH₵ 0.00",
    inPersonCount: 0,
  });
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);

  // Filtered payments by channel
  const filteredPayments = useMemo(() => {
    if (channelFilter === "ONLINE") {
      return payments.filter((p) => p.paymentCategory === "ONLINE");
    }
    if (channelFilter === "IN_PERSON") {
      return payments.filter((p) => p.paymentCategory === "IN_PERSON");
    }
    return payments;
  }, [payments, channelFilter]);

  // In-Person Payment Modal States
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [recordAmount, setRecordAmount] = useState("");
  const [recordReceiptNo, setRecordReceiptNo] = useState("");
  const [recordChannel, setRecordChannel] = useState("Counter Cash Treasury");
  const [recordSettlementType, setRecordSettlementType] = useState<"TOTAL" | "ARREARS">("TOTAL");
  const [recordPassword, setRecordPassword] = useState("");
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);

  // Receipt Modal & Online Receipt Modification States
  const [selectedPayment, setSelectedPayment] = useState<UnifiedPaymentRecord | null>(null);
  const [isEditingReceiptNo, setIsEditingReceiptNo] = useState(false);
  const [newReceiptNoInput, setNewReceiptNoInput] = useState("");
  const [sendSmsNotice, setSendSmsNotice] = useState(true);
  const [isUpdatingReceiptNo, setIsUpdatingReceiptNo] = useState(false);
  const [receiptUpdateError, setReceiptUpdateError] = useState<string | null>(null);

  // Toast feedback
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // 1. Fetch Accounts Directory on search/page change
  useEffect(() => {
    let isCancelled = false;
    async function loadAccounts() {
      setIsLoadingAccounts(true);
      try {
        const res = await searchPropertyBillAccounts({
          searchQuery: deferredSearchQuery,
          page: currentPage,
          pageSize,
        });
        if (!isCancelled && res.success && res.accounts) {
          setAccounts(res.accounts);
          setAccountsTotal(res.totalCount || res.accounts.length);
          setTotalPages(res.totalPages || Math.max(1, Math.ceil((res.totalCount || res.accounts.length) / pageSize)));

          // If initialAccountNo provided, automatically select it if found
          if (initialAccountNo && !selectedAccount) {
            const match = res.accounts.find(
              (a) => a.accountNumber.toLowerCase() === initialAccountNo.toLowerCase()
            );
            if (match) setSelectedAccount(match);
          }
        }
      } catch (err) {
        console.error("Failed to load accounts directory:", err);
      } finally {
        if (!isCancelled) setIsLoadingAccounts(false);
      }
    }
    loadAccounts();
    return () => {
      isCancelled = true;
    };
  }, [deferredSearchQuery, currentPage, initialAccountNo]);

  // Reset page to 1 when search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [deferredSearchQuery]);

  // 2. Fetch Payments when an account is selected
  useEffect(() => {
    if (!selectedAccount) {
      setPayments([]);
      return;
    }
    const targetAccountNo = selectedAccount.accountNumber;
    let isCancelled = false;
    async function loadPayments() {
      setIsLoadingPayments(true);
      try {
        const res = await getAccountPaymentsList(targetAccountNo);
        if (!isCancelled && res.success) {
          setPayments(res.payments);
          setPaymentsSummary(res.summary);
        } else if (!isCancelled && res.error) {
          showToast(res.error, "error");
        }
      } catch (err) {
        console.error("Failed to load account payments:", err);
      } finally {
        if (!isCancelled) setIsLoadingPayments(false);
      }
    }
    loadPayments();
    return () => {
      isCancelled = true;
    };
  }, [selectedAccount]);

  // 3. Handle In-Person Payment Submission
  const handleRecordInPersonPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) return;

    setRecordError(null);
    const amt = parseFloat(recordAmount);
    if (isNaN(amt) || amt <= 0) {
      setRecordError("Please enter a valid positive payment amount.");
      return;
    }
    if (!recordReceiptNo.trim()) {
      setRecordError("Please enter the physical GCR booklet receipt number.");
      return;
    }
    if (!recordPassword.trim()) {
      setRecordError("Officer authorization password is required.");
      return;
    }

    setIsSubmittingPayment(true);
    try {
      const res = await recordInPersonPayment({
        accountNumber: selectedAccount.accountNumber,
        amount: amt,
        receiptNumber: recordReceiptNo.trim(),
        paymentMethod: recordChannel,
        settlementType: recordSettlementType,
        adminPassword: recordPassword,
      });

      if (res.success) {
        showToast(`Payment recorded successfully. GCR #${res.receiptNumber}`, "success");
        setIsRecordModalOpen(false);
        setRecordAmount("");
        setRecordReceiptNo("");
        setRecordPassword("");

        // Optimistically update selectedAccount balance
        if (res.updatedProperty) {
          setSelectedAccount((prev) =>
            prev
              ? {
                  ...prev,
                  outstandingAmount: res.updatedProperty.totalAmountDue,
                }
              : null
          );
        }

        // Refresh payments list
        const refreshed = await getAccountPaymentsList(selectedAccount.accountNumber);
        if (refreshed.success) {
          setPayments(refreshed.payments);
          setPaymentsSummary(refreshed.summary);
        }
      } else {
        setRecordError(res.error || "Failed to record payment.");
      }
    } catch (err: any) {
      setRecordError(err.message || "An error occurred while submitting payment.");
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // 4. Handle Modify Receipt Number for Online Payments
  const handleUpdateReceiptNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayment) return;

    setReceiptUpdateError(null);
    const trimmedNew = newReceiptNoInput.trim();
    if (!trimmedNew) {
      setReceiptUpdateError("Please specify a new receipt number.");
      return;
    }

    setIsUpdatingReceiptNo(true);
    try {
      const res = await updatePaymentReceiptNumber({
        paymentId: selectedPayment.id,
        oldReceiptNumber: selectedPayment.receiptNumber,
        newReceiptNumber: trimmedNew,
        accountNumber: selectedPayment.accountNo,
        sendSmsNotice,
      });

      if (res.success && res.updatedReceiptNumber) {
        showToast(`Receipt number updated to ${res.updatedReceiptNumber}`, "success");
        setIsEditingReceiptNo(false);

        // Update selected payment in-memory
        setSelectedPayment((prev) =>
          prev
            ? {
                ...prev,
                receiptNumber: res.updatedReceiptNumber!,
                isPhysicalIssued: true,
              }
            : null
        );

        // Update in payments table list
        setPayments((prev) =>
          prev.map((p) =>
            p.id === selectedPayment.id || p.receiptNumber === selectedPayment.receiptNumber
              ? { ...p, receiptNumber: res.updatedReceiptNumber!, isPhysicalIssued: true }
              : p
          )
        );
      } else {
        setReceiptUpdateError(res.error || "Failed to update receipt number.");
      }
    } catch (err: any) {
      setReceiptUpdateError(err.message || "An error occurred while updating receipt number.");
    } finally {
      setIsUpdatingReceiptNo(false);
    }
  };

  return (
    <div className="w-full flex-1 min-h-0 flex flex-col font-sans antialiased overflow-hidden">
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`fixed top-4 right-4 z-60 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-xl border flex items-center gap-2 ${
              toast.type === "success"
                ? "bg-white text-[#1C1C1E] border-[#34C759]/30 shadow-[#34C759]/10"
                : "bg-white text-[#FF3B30] border-[#FF3B30]/30 shadow-[#FF3B30]/10"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-[#34C759]" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-[#FF3B30]" />
            )}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* VIEW 1: RATEPAYER ACCOUNTS DIRECTORY */}
      {!selectedAccount ? (
        <div className="w-full flex-1 min-h-0 flex flex-col gap-2.5 sm:gap-3 p-3 sm:px-6 lg:px-8 sm:py-3 overflow-hidden">
          {/* 1. Standalone Static Search Toolbar Container (Detached from Table) */}
          <div className="w-full bg-white border border-[#E8E8ED] rounded-[14px] px-3.5 py-3 sm:px-5 sm:py-3.5 shadow-xs shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#8E8E93]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search ratepayer accounts, names, phones, digital address..."
                  className="w-full pl-9 pr-8 py-2 bg-[#F5F5F7] border border-[#E8E8ED] rounded-xl text-xs font-medium text-[#1D1D1F] placeholder-[#8E8E93] outline-none focus:border-[#007AFF] focus:bg-white transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-2 text-[#8E8E93] hover:text-[#1D1D1F] p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-[#6E6E73] shrink-0">
              <span className="font-medium">
                {isLoadingAccounts ? (
                  <span className="flex items-center gap-1.5 text-[#007AFF]">
                    <AppleSpinner size="xs" /> Loading accounts...
                  </span>
                ) : (
                  <span>
                    <strong className="text-[#1D1D1F] font-semibold">{accountsTotal.toLocaleString()}</strong> ratepayer accounts
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* 2. Standalone Table & Mobile List Container (Consumes all available space) */}
          <div className="w-full flex-1 min-h-0 bg-white border border-[#E8E8ED] rounded-[14px] shadow-xs flex flex-col overflow-hidden relative">
            <div ref={tableContainerRef} className="w-full flex-1 min-h-0 overflow-y-auto overflow-x-auto flex flex-col">
              {isLoadingAccounts && accounts.length === 0 ? (
                /* Full-Height Authentic Apple Loading State (Consumes ALL Available Space) */
                <div className="w-full flex-1 h-full min-h-[340px] flex flex-col items-center justify-center gap-3.5 text-[#6E6E73] p-8 m-auto">
                  <AppleSpinner size="lg" className="text-[#007AFF]" />
                  <p className="text-xs font-medium text-[#8E8E93]">Loading ratepayer property accounts...</p>
                </div>
              ) : accounts.length === 0 ? (
                <div className="w-full flex-1 h-full min-h-[280px] flex flex-col items-center justify-center text-center p-8 gap-2 m-auto">
                  <Building2 className="w-8 h-8 text-[#8E8E93]" />
                  <h4 className="text-sm font-semibold text-[#1D1D1F]">No ratepayer accounts found</h4>
                  <p className="text-xs text-[#6E6E73] max-w-sm">
                    No accounts matched your search criteria. Try searching by a different account number, name, or phone number.
                  </p>
                </div>
              ) : (
                <>
                  {/* DESKTOP TABLE VIEW (hidden on mobile <sm, visible on sm+) */}
                  <table className="hidden sm:table w-full text-left border-collapse min-w-[720px]">
                    <thead className="bg-[#F9F9FB] text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider sticky top-0 z-10 border-b border-[#E8E8ED]">
                      <tr>
                        <th className="py-2.5 px-4 lg:px-6">Account No</th>
                        <th className="py-2.5 px-4">Ratepayer Name</th>
                        <th className="py-2.5 px-4">Telephone</th>
                        <th className="py-2.5 px-4">Property Location</th>
                        <th className="py-2.5 px-4 text-right">Outstanding Due</th>
                        <th className="py-2.5 px-4 text-center">Status</th>
                        <th className="py-2.5 px-4 lg:px-6 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8E8ED] text-xs">
                      {accounts.map((acc) => {
                        const isSettled = acc.outstandingAmount <= 0;
                        return (
                          <tr
                            key={acc.accountNumber}
                            onClick={() => setSelectedAccount(acc)}
                            className="hover:bg-[#F5F5F7]/70 transition-colors cursor-pointer group"
                          >
                            <td className="py-3 px-4 lg:px-6">
                              <span className="font-mono font-bold text-[#007AFF] group-hover:underline">
                                {acc.accountNumber}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-medium text-[#1D1D1F]">
                              {acc.name || "Unnamed Ratepayer"}
                            </td>
                            <td className="py-3 px-4 text-[#6E6E73] font-mono">
                              {acc.telephone || "—"}
                            </td>
                            <td className="py-3 px-4 text-[#6E6E73] truncate max-w-[220px]">
                              {acc.ownerDigitalAddress || acc.electoralArea || "KKMA Cadastre"}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums text-[#1D1D1F]">
                              {formatGhc(acc.outstandingAmount)}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`font-semibold text-[11px] ${
                                  isSettled ? "text-[#34C759]" : "text-[#FF3B30]"
                                }`}
                              >
                                &bull; {isSettled ? "Settled" : "Balance Due"}
                              </span>
                            </td>
                            <td className="py-3 px-4 lg:px-6 text-right">
                              <span className="text-[#007AFF] font-medium text-[11px] group-hover:underline inline-flex items-center gap-0.5">
                                View Payments &rarr;
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* MOBILE RESPONSIVE TILES (strictly zero pills, min 44px touch targets) */}
                  <div className="block sm:hidden divide-y divide-[#E8E8ED]">
                    {accounts.map((acc) => {
                      const isSettled = acc.outstandingAmount <= 0;
                      return (
                        <div
                          key={`mobile-${acc.accountNumber}`}
                          onClick={() => setSelectedAccount(acc)}
                          className="p-3.5 flex flex-col gap-1.5 active:bg-[#F5F5F7] transition-colors cursor-pointer min-h-[56px]"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono font-bold text-[13px] text-[#007AFF]">
                              {acc.accountNumber}
                            </span>
                            <span
                              className={`text-[11px] font-semibold shrink-0 ${
                                isSettled ? "text-[#34C759]" : "text-[#FF3B30]"
                              }`}
                            >
                              &bull; {isSettled ? "Settled" : "Balance Due"}
                            </span>
                          </div>

                          <div className="text-[13px] font-semibold text-[#1D1D1F] leading-snug">
                            {acc.name || "Unnamed Ratepayer"}
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-0.5 text-[11px]">
                            <div className="text-[#8E8E93] truncate max-w-[60%]">
                              {acc.telephone ? `${acc.telephone} • ` : ""}
                              {acc.ownerDigitalAddress || acc.electoralArea || "KKMA Cadastre"}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="font-mono font-semibold text-[#1D1D1F] text-[12px] tabular-nums">
                                {formatGhc(acc.outstandingAmount)}
                              </span>
                              <ChevronRight className="w-3.5 h-3.5 text-[#C7C7CC]" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 3. Standalone Static Bottom Pagination Dock (Detached from Table) */}
          <div className="w-full bg-white border border-[#E8E8ED] rounded-[14px] px-4 py-2.5 shadow-xs flex items-center justify-between text-xs text-[#6E6E73] shrink-0">
            <span>
              Page <strong className="text-[#1D1D1F]">{currentPage}</strong> of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage <= 1 || isLoadingAccounts}
                onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                className="px-3 py-1.5 rounded-lg border border-[#D2D2D7] bg-white text-[#1D1D1F] hover:bg-[#F5F5F7] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer font-medium min-h-[36px] flex items-center justify-center"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages || isLoadingAccounts}
                onClick={() => handlePageChange(currentPage + 1)}
                className="px-3 py-1.5 rounded-lg border border-[#D2D2D7] bg-white text-[#1D1D1F] hover:bg-[#F5F5F7] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer font-medium min-h-[36px] flex items-center justify-center"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* VIEW 2: ACCOUNT PAYMENTS LEDGER & WORKBENCH (DRILLDOWN) */
        <div className="w-full flex-1 min-h-0 flex flex-col gap-2.5 sm:gap-3 p-3 sm:px-6 lg:px-8 sm:py-3 overflow-hidden">
          {/* Top Standalone Card: Apple Navigation & Profile Summary */}
          <div className="w-full bg-white border border-[#E8E8ED] rounded-2xl p-3.5 sm:p-5 shadow-xs shrink-0 space-y-3.5">
            {/* iOS Level 1: Navigation Link & Action Bar */}
            <div className="flex items-center justify-between gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedAccount(null)}
                className="flex items-center gap-1 text-[13px] font-semibold text-[#007AFF] hover:underline cursor-pointer min-h-[44px] -ml-1 px-1 active:opacity-70 transition-opacity"
              >
                <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
                <span>Back to Accounts</span>
              </button>

              <div className="flex items-center gap-2">
                {onOpenStatement && (
                  <button
                    type="button"
                    onClick={() => onOpenStatement(selectedAccount.accountNumber)}
                    className="px-3 py-1.5 rounded-lg border border-[#D2D2D7] bg-white hover:bg-[#F5F5F7] text-[#1D1D1F] font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer min-h-[38px] active:scale-98"
                  >
                    <Calendar className="w-3.5 h-3.5 text-[#6E6E73]" />
                    <span className="hidden sm:inline">View Statement</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setIsRecordModalOpen(true);
                    setRecordAmount(
                      selectedAccount.outstandingAmount > 0
                        ? selectedAccount.outstandingAmount.toFixed(2)
                        : ""
                    );
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-[#007AFF] hover:bg-[#0066D6] text-white font-semibold text-xs flex items-center gap-1.5 shadow-[0px_1px_3px_0px_rgba(0,122,255,0.25)] transition-all cursor-pointer active:scale-98 min-h-[38px]"
                >
                  <Plus className="w-4 h-4" />
                  <span>Record Payment</span>
                </button>
              </div>
            </div>

            {/* iOS Level 2: Ratepayer Profile & Financial Overview Card */}
            <div className="bg-[#FAFAFC] border border-[#E8E8ED] rounded-xl p-3.5 sm:p-4 flex flex-col gap-3">
              {/* Ratepayer Biodata (Name and Account & Address) */}
              <div className="space-y-0.5 min-w-0">
                <h3 className="text-base sm:text-lg font-bold text-[#1D1D1F] tracking-tight truncate">
                  {selectedAccount.name || "Unnamed Ratepayer"}
                </h3>
                <p className="text-xs text-[#6E6E73] truncate flex items-center gap-1.5">
                  <span className="font-mono text-[#007AFF] font-medium">{selectedAccount.accountNumber}</span>
                  <span className="text-[#8E8E93]">&bull;</span>
                  <span className="truncate">{selectedAccount.ownerDigitalAddress || selectedAccount.houseNo || "No address on record"}</span>
                </p>
              </div>

              {/* Hairline Divider */}
              <div className="border-t border-[#E8E8ED]" />

              {/* Financial Metrics (Apple 2-Column Responsive Grid - Zero Text Wrapping) */}
              <div className="grid grid-cols-2 gap-4 sm:gap-8 items-start">
                <div className="space-y-0.5 min-w-0">
                  <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider block truncate">
                    Outstanding balance
                  </span>
                  <span
                    className={`text-base sm:text-lg font-bold font-mono tabular-nums block truncate ${
                      selectedAccount.outstandingAmount <= 0 ? "text-[#34C759]" : "text-[#FF3B30]"
                    }`}
                  >
                    {formatGhc(selectedAccount.outstandingAmount)}
                  </span>
                </div>

                <div className="space-y-0.5 min-w-0">
                  <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider block truncate">
                    Total paid
                  </span>
                  <span className="text-base sm:text-lg font-bold font-mono tabular-nums text-[#1D1D1F] block truncate">
                    {paymentsSummary.totalPaidFormatted}
                  </span>
                  <span className="text-[10px] sm:text-[11px] text-[#8E8E93] block truncate">
                    Online: {paymentsSummary.onlinePaidFormatted} &bull; Counter: {paymentsSummary.inPersonPaidFormatted}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Standalone Payments Ledger Card Container */}
          <div className="w-full flex-1 min-h-0 bg-white border border-[#E8E8ED] rounded-[14px] shadow-xs flex flex-col overflow-hidden relative">
            {/* Channel Filter Tabs (Zero Pills Standard: Clean Typographic Links without icons) */}
            <div className="flex items-center gap-5 sm:gap-7 px-4 pt-2.5 border-b border-[#E8E8ED] shrink-0 text-xs font-semibold overflow-x-auto bg-[#FAFAFC]">
              <button
                type="button"
                onClick={() => setChannelFilter("ALL")}
                className={`pb-2.5 transition-colors cursor-pointer relative shrink-0 ${
                  channelFilter === "ALL"
                    ? "text-[#007AFF] font-bold border-b-2 border-[#007AFF]"
                    : "text-[#6E6E73] hover:text-[#1D1D1F]"
                }`}
              >
                All Settlements ({payments.length})
              </button>
              <button
                type="button"
                onClick={() => setChannelFilter("ONLINE")}
                className={`pb-2.5 transition-colors cursor-pointer relative shrink-0 ${
                  channelFilter === "ONLINE"
                    ? "text-[#007AFF] font-bold border-b-2 border-[#007AFF]"
                    : "text-[#6E6E73] hover:text-[#1D1D1F]"
                }`}
              >
                Online App ({paymentsSummary.onlineCount})
              </button>
              <button
                type="button"
                onClick={() => setChannelFilter("IN_PERSON")}
                className={`pb-2.5 transition-colors cursor-pointer relative shrink-0 ${
                  channelFilter === "IN_PERSON"
                    ? "text-[#007AFF] font-bold border-b-2 border-[#007AFF]"
                    : "text-[#6E6E73] hover:text-[#1D1D1F]"
                }`}
              >
                In-Person Treasury ({paymentsSummary.inPersonCount})
              </button>
            </div>

            <div className="w-full flex-1 min-h-0 overflow-y-auto overflow-x-auto flex flex-col">
              {isLoadingPayments ? (
                /* Full-Height Loading */
                <div className="w-full flex-1 h-full min-h-[300px] flex flex-col items-center justify-center gap-3.5 text-[#6E6E73] p-8 m-auto">
                  <AppleSpinner size="lg" className="text-[#007AFF]" />
                  <p className="text-xs font-medium text-[#8E8E93]">Loading payments history...</p>
                </div>
              ) : filteredPayments.length === 0 ? (
                <div className="w-full flex-1 h-full min-h-[260px] flex flex-col items-center justify-center text-center p-8 gap-2 m-auto">
                  <Receipt className="w-8 h-8 text-[#8E8E93]" />
                  <h4 className="text-sm font-semibold text-[#1D1D1F]">
                    {channelFilter === "ALL"
                      ? "No payments recorded yet"
                      : channelFilter === "ONLINE"
                      ? "No online app payments found"
                      : "No in-person treasury settlements found"}
                  </h4>
                  <p className="text-xs text-[#6E6E73] max-w-sm">
                    {channelFilter === "ALL"
                      ? "This ratepayer account has no verified payment transactions. Click 'Record Payment' to enter a counter settlement."
                      : `No transactions were recorded under the ${channelFilter === "ONLINE" ? "online Paystack" : "in-person treasury"} channel.`}
                  </p>
                </div>
              ) : (
                <>
                  {/* DESKTOP PAYMENTS TABLE */}
                  <table className="hidden sm:table w-full text-left border-collapse min-w-[760px]">
                    <thead className="bg-[#F9F9FB] text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider sticky top-0 z-10 border-b border-[#E8E8ED]">
                      <tr>
                        <th className="py-2.5 px-4 lg:px-6">Date & Time</th>
                        <th className="py-2.5 px-4">Receipt / GCR No</th>
                        <th className="py-2.5 px-4">Origin & Channel</th>
                        <th className="py-2.5 px-4">Payment Method</th>
                        <th className="py-2.5 px-4 text-right">Amount Paid</th>
                        <th className="py-2.5 px-4 text-center">Status</th>
                        <th className="py-2.5 px-4 lg:px-6 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8E8ED] text-xs">
                      {filteredPayments.map((p) => {
                        const isOnline = p.paymentCategory === "ONLINE";
                        return (
                          <tr
                            key={p.id}
                            onClick={() => {
                              setSelectedPayment(p);
                              setIsEditingReceiptNo(false);
                              setNewReceiptNoInput(p.receiptNumber);
                            }}
                            className="hover:bg-[#F5F5F7]/70 transition-colors cursor-pointer group"
                          >
                            <td className="py-3.5 px-4 lg:px-6 text-[#1D1D1F]">
                              <span className="font-medium block">{p.formattedDate}</span>
                              {p.formattedTime && (
                                <span className="text-[11px] text-[#8E8E93] font-mono block">
                                  {p.formattedTime}
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="font-mono font-bold text-[#1D1D1F] block">
                                {p.receiptNumber}
                              </span>
                              {isOnline && (
                                <span className="text-[10px] text-[#007AFF] font-medium block">
                                  Digital Receipt
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              {isOnline ? (
                                <div className="space-y-0.5">
                                  <span className="text-[#007AFF] font-semibold text-[11px] flex items-center gap-1.5">
                                    <Globe className="w-3.5 h-3.5 text-[#007AFF]" />
                                    <span>Online App</span>
                                  </span>
                                  <span className="text-[10px] text-[#8E8E93] block">
                                    Paystack Gateway
                                  </span>
                                </div>
                              ) : (
                                <div className="space-y-0.5">
                                  <span className="text-[#34C759] font-semibold text-[11px] flex items-center gap-1.5">
                                    <Building2 className="w-3.5 h-3.5 text-[#34C759]" />
                                    <span>In-Person Treasury</span>
                                  </span>
                                  <span className="text-[10px] text-[#8E8E93] block">
                                    {p.cashierName || "Desk Cashier"}
                                  </span>
                                </div>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-[#1D1D1F] font-medium">
                              <span>{p.paymentMethod}</span>
                              {p.transactionReference && (
                                <span className="text-[10px] text-[#8E8E93] font-mono block truncate max-w-[140px]">
                                  ref: {p.transactionReference}
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono font-bold text-[#1D1D1F] tabular-nums">
                              {p.amountPaidFormatted}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <span className="font-semibold text-[11px] text-[#34C759]">
                                &bull; Reconciled
                              </span>
                            </td>
                            <td className="py-3.5 px-4 lg:px-6 text-right">
                              <span className="text-[#007AFF] font-semibold text-[11px] group-hover:underline inline-flex items-center gap-1">
                                <Receipt className="w-3.5 h-3.5" />
                                <span>View Receipt</span>
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* MOBILE RESPONSIVE PAYMENTS TILES */}
                  <div className="block sm:hidden divide-y divide-[#E8E8ED]">
                    {filteredPayments.map((p) => {
                      const isOnline = p.paymentCategory === "ONLINE";
                      return (
                        <div
                          key={`mobile-pay-${p.id}`}
                          onClick={() => {
                            setSelectedPayment(p);
                            setIsEditingReceiptNo(false);
                            setNewReceiptNoInput(p.receiptNumber);
                          }}
                          className="p-3.5 flex flex-col gap-1.5 active:bg-[#F5F5F7] transition-colors cursor-pointer min-h-[56px] bg-white"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono font-bold text-[13px] text-[#1D1D1F]">
                              #{p.receiptNumber}
                            </span>
                            <span
                              className={`text-[11px] font-semibold shrink-0 flex items-center gap-1 ${
                                isOnline ? "text-[#007AFF]" : "text-[#34C759]"
                              }`}
                            >
                              {isOnline ? <Globe className="w-3 h-3" /> : <Building2 className="w-3 h-3" />}
                              <span>&bull; {isOnline ? "Online App" : "In-Person Counter"}</span>
                            </span>
                          </div>

                          <div className="text-[11px] text-[#6E6E73] flex items-center justify-between gap-2">
                            <span>{p.formattedDate} {p.formattedTime ? `• ${p.formattedTime}` : ""}</span>
                            <span className="font-medium text-[#1D1D1F] truncate max-w-[50%]">{p.paymentMethod}</span>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#F5F5F7]">
                            <div>
                              <span className="text-[10px] text-[#8E8E93] block">Settled Net</span>
                              <span className="font-mono font-bold text-[13px] text-[#1D1D1F] tabular-nums">
                                {p.amountPaidFormatted}
                              </span>
                            </div>
                            <span className="text-[#007AFF] text-[11px] font-semibold flex items-center gap-0.5">
                              View Receipt &rarr;
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: RECORD IN-PERSON PAYMENT */}
      {isRecordModalOpen && selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="bg-white rounded-2xl border border-[#E8E8ED] shadow-2xl max-w-md w-full overflow-hidden text-xs"
          >
            <div className="px-5 py-4 border-b border-[#E8E8ED] flex items-center justify-between bg-white">
              <div>
                <h3 className="font-bold text-sm text-[#1D1D1F]">Record In-Person Payment</h3>
                <p className="text-[11px] text-[#6E6E73] font-mono mt-0.5">
                  Account: {selectedAccount.accountNumber} ({selectedAccount.name})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsRecordModalOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[#8E8E93] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRecordInPersonPayment} className="p-5 space-y-4">
              {recordError && (
                <div className="p-3 rounded-xl bg-[#FF3B30]/10 border border-[#FF3B30]/20 text-[#FF3B30] text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{recordError}</span>
                </div>
              )}

              {/* Amount Field */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-[#1D1D1F]">Payment Amount (GH₵) *</label>
                  {selectedAccount.outstandingAmount > 0 && (
                    <button
                      type="button"
                      onClick={() => setRecordAmount(selectedAccount.outstandingAmount.toFixed(2))}
                      className="text-[11px] text-[#007AFF] hover:underline cursor-pointer"
                    >
                      Fill Outstanding ({formatGhc(selectedAccount.outstandingAmount)})
                    </button>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 font-bold text-[#8E8E93]">GH₵</span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={recordAmount}
                    onChange={(e) => setRecordAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-12 pr-3 py-2 bg-white border border-[#D2D2D7] rounded-xl font-mono text-sm font-bold text-[#1D1D1F] outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF]"
                  />
                </div>
              </div>

              {/* Receipt Number Field */}
              <div className="space-y-1">
                <label className="font-semibold text-[#1D1D1F]">
                  Receipt Number (GCR) *
                </label>
                <input
                  type="text"
                  required
                  value={recordReceiptNo}
                  onChange={(e) => setRecordReceiptNo(e.target.value)}
                  placeholder="e.g. GCR-104928"
                  className="w-full px-3 py-2 bg-white border border-[#D2D2D7] rounded-xl font-mono text-xs font-bold text-[#1D1D1F] outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF]"
                />
              </div>

              {/* Channel Selector */}
              <div className="space-y-1">
                <label className="font-semibold text-[#1D1D1F]">Payment Channel</label>
                <select
                  value={recordChannel}
                  onChange={(e) => setRecordChannel(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#D2D2D7] rounded-xl text-xs text-[#1D1D1F] outline-none focus:border-[#007AFF]"
                >
                  <option value="Counter Cash Treasury">Counter Cash Treasury</option>
                  <option value="Assembly Direct Cheque">Assembly Direct Cheque</option>
                  <option value="Direct Bank Deposit">Direct Bank Deposit</option>
                  <option value="Field Cash Collection">Field Cash Collection</option>
                </select>
              </div>

              {/* Password */}
              <div className="space-y-1 pt-2 border-t border-[#E8E8ED]">
                <div className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#007AFF]" />
                  <label className="font-semibold text-[#1D1D1F] text-xs">
                    Password *
                  </label>
                </div>
                <input
                  type="password"
                  required
                  value={recordPassword}
                  onChange={(e) => setRecordPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full px-3 py-2 bg-white border border-[#D2D2D7] rounded-xl text-xs text-[#1D1D1F] outline-none focus:border-[#007AFF]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isSubmittingPayment}
                  onClick={() => setIsRecordModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl border border-[#D2D2D7] text-[#1D1D1F] font-semibold hover:bg-[#F5F5F7] transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="px-4 py-2 rounded-xl bg-[#007AFF] hover:bg-[#0066D6] text-white font-semibold flex items-center gap-1.5 shadow-[0px_1px_4px_0px_rgba(0,122,255,0.3)] transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingPayment ? (
                    <>
                      <AppleSpinner size="xs" />
                      <span>Recording Payment...</span>
                    </>
                  ) : (
                    <span>Record Payment</span>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* MODAL 2: OFFICIAL PAYMENT RECEIPT & ONLINE RECEIPT MODIFICATION */}
      {selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="bg-white rounded-2xl border border-[#E8E8ED] shadow-2xl max-w-md w-full overflow-hidden text-xs max-h-[92vh] flex flex-col"
          >
            {/* Modal Header */}
            <div className="px-4 sm:px-5 py-3 border-b border-[#E8E8ED] flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#007AFF]" />
                <h3 className="font-bold text-sm text-[#1D1D1F]">Payment Receipt</h3>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] transition-colors cursor-pointer min-h-[36px]"
                  title="Print Receipt"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPayment(null)}
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-[#8E8E93] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] transition-colors cursor-pointer min-h-[36px]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Official Receipt Body */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0 space-y-4 bg-white">
              {/* Assembly Crest Header */}
              <div className="text-center pb-3 border-b border-[#E8E8ED] space-y-1">
                <div className="w-9 h-9 rounded-full bg-[#1D1D1F] text-white flex items-center justify-center mx-auto mb-1.5 shadow-xs">
                  <Building2 className="w-4 h-4 text-white" />
                </div>
                <h2 className="font-bold text-sm text-[#1D1D1F] tracking-tight uppercase">
                  Kpone-Katamanso Municipal Assembly
                </h2>
                <p className="text-[11px] text-[#6E6E73]">
                  Revenue Directorate &bull; Official Payment Receipt
                </p>
              </div>

              {/* Amount Display (Zero Pills Standard) */}
              <div className="bg-[#F9F9FB] rounded-xl p-3.5 sm:p-4 border border-[#E8E8ED] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-semibold text-[#8E8E93] uppercase tracking-wider block">
                    Amount Paid
                  </span>
                  <span className="text-2xl sm:text-3xl font-bold font-mono text-[#1D1D1F] tracking-tight block mt-0.5">
                    {selectedPayment.amountPaidFormatted}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-xs text-[#34C759] block">&bull; Paid</span>
                  <span className="text-[10px] text-[#6E6E73] block mt-0.5">Municipal Revenue</span>
                </div>
              </div>

              {/* Receipt Essential Fields */}
              <div className="text-xs divide-y divide-[#E8E8ED]/70 border-y border-[#E8E8ED]/70">
                <div className="flex items-center justify-between py-2">
                  <span className="text-[#6E6E73]">Receipt / GCR No</span>
                  <span className="font-mono font-bold text-[#1D1D1F]">
                    {selectedPayment.receiptNumber}
                  </span>
                </div>

                <div className="flex items-center justify-between py-2">
                  <span className="text-[#6E6E73]">Property Account</span>
                  <span className="font-mono font-bold text-[#007AFF]">
                    {selectedPayment.accountNo}
                  </span>
                </div>

                <div className="flex items-center justify-between py-2">
                  <span className="text-[#6E6E73]">Payment Date</span>
                  <span className="font-medium text-[#1D1D1F]">
                    {selectedPayment.formattedDate} {selectedPayment.formattedTime || ""}
                  </span>
                </div>

                <div className="flex items-center justify-between py-2">
                  <span className="text-[#6E6E73]">Payment Method</span>
                  <span className="font-medium text-[#1D1D1F]">
                    {selectedPayment.paymentCategory === "ONLINE"
                      ? "Online App (Paystack)"
                      : (selectedPayment.paymentMethod || "In-Person Cash")}
                  </span>
                </div>

                {selectedPayment.transactionReference && (
                  <div className="flex items-center justify-between py-2">
                    <span className="text-[#6E6E73]">Transaction Ref</span>
                    <span className="font-mono text-[11px] text-[#6E6E73] truncate max-w-[180px]">
                      {selectedPayment.transactionReference}
                    </span>
                  </div>
                )}

                {(selectedPayment.arrearsPaid > 0 || selectedPayment.currentPaid > 0) && (
                  <div className="flex items-center justify-between py-2">
                    <span className="text-[#6E6E73]">Allocation</span>
                    <span className="font-medium text-[#1D1D1F]">
                      Overdue: {formatGhc(selectedPayment.arrearsPaid)} &bull; Current: {formatGhc(selectedPayment.currentPaid)}
                    </span>
                  </div>
                )}
              </div>

              {/* ONLINE PAYMENT: PHYSICAL GCR BOOKLET NUMBER ASSIGNMENT */}
              {selectedPayment.paymentCategory === "ONLINE" && (
                <div className="bg-[#F5F5F7]/70 rounded-xl p-3.5 space-y-2.5 border border-[#E8E8ED]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div>
                      <h4 className="font-bold text-xs text-[#1D1D1F]">
                        GCR Booklet Number
                      </h4>
                      <p className="text-[11px] text-[#6E6E73]">
                        Assign or update physical receipt number
                      </p>
                    </div>

                    {!isEditingReceiptNo && (
                      <button
                        type="button"
                        onClick={() => setIsEditingReceiptNo(true)}
                        className="w-full sm:w-auto px-3 py-1.5 rounded-lg bg-white border border-[#D2D2D7] text-[#007AFF] hover:bg-[#F5F5F7] font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[38px] active:scale-98"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Update Number</span>
                      </button>
                    )}
                  </div>

                  {isEditingReceiptNo && (
                    <form onSubmit={handleUpdateReceiptNumber} className="space-y-3 pt-2">
                      {receiptUpdateError && (
                        <div className="p-2 rounded-lg bg-[#FF3B30]/10 text-[#FF3B30] text-[11px]">
                          {receiptUpdateError}
                        </div>
                      )}

                      <div className="space-y-1">
                        <label className="font-semibold text-[#1D1D1F] text-[11px]">
                          Receipt Number (GCR) *
                        </label>
                        <input
                          type="text"
                          required
                          value={newReceiptNoInput}
                          onChange={(e) => setNewReceiptNoInput(e.target.value)}
                          placeholder="e.g. GCR-104928"
                          className="w-full px-3 py-2 bg-white border border-[#D2D2D7] rounded-xl font-mono text-xs font-bold text-[#1D1D1F] outline-none focus:border-[#007AFF] min-h-[40px]"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="sendSmsNotice"
                          checked={sendSmsNotice}
                          onChange={(e) => setSendSmsNotice(e.target.checked)}
                          className="rounded text-[#007AFF] w-4 h-4 cursor-pointer"
                        />
                        <label htmlFor="sendSmsNotice" className="text-[11px] text-[#6E6E73] cursor-pointer select-none">
                          Send updated receipt SMS notice to citizen
                        </label>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          disabled={isUpdatingReceiptNo}
                          onClick={() => {
                            setIsEditingReceiptNo(false);
                            setReceiptUpdateError(null);
                          }}
                          className="px-3 py-1.5 rounded-lg border border-[#D2D2D7] text-[#1D1D1F] text-xs font-medium cursor-pointer min-h-[36px]"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isUpdatingReceiptNo}
                          className="px-3.5 py-1.5 rounded-lg bg-[#007AFF] hover:bg-[#0066D6] text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 min-h-[36px]"
                        >
                          {isUpdatingReceiptNo ? (
                            <>
                              <AppleSpinner size="xs" />
                              <span>Saving...</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Save Number</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>

            {/* Modal Bottom Bar for Quick Action */}
            <div className="p-3.5 border-t border-[#E8E8ED] bg-[#FAFAFC] flex items-center justify-between gap-3 shrink-0">
              <span className="text-[11px] text-[#8E8E93]">Official Municipal Record</span>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-lg bg-[#007AFF] hover:bg-[#0066D6] text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer min-h-[38px] active:scale-98"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Receipt</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default PaymentsSection;
