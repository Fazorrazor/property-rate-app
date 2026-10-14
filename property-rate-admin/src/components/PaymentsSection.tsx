"use client";

import React, { useState, useEffect, useMemo, useDeferredValue, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
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
  ArrowUpRight,
  Send,
  Phone,
  MessageSquare,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { AppleSpinner } from "@/components/ui/AppleSpinner";
import { PaymentsDirectorySkeleton, PaymentsUserRecordsSkeleton } from "@/components/Skeletons";

// Dynamic code-split: PaymentReceiptModal and print/share logic are kept out of initial bundle
const PaymentReceiptModal = dynamic(
  () => import("@/components/PaymentReceiptModal").then((mod) => mod.PaymentReceiptModal),
  { ssr: false }
);

interface PaymentRowProps {
  payment: UnifiedPaymentRecord;
  onSelect: (p: UnifiedPaymentRecord) => void;
  onPrefetch?: () => void;
}

const PaymentTableRow = React.memo(function PaymentTableRow({
  payment,
  onSelect,
  onPrefetch,
}: PaymentRowProps) {
  const isOnline = payment.paymentCategory === "ONLINE";
  return (
    <tr
      onClick={() => onSelect(payment)}
      onPointerEnter={onPrefetch}
      onTouchStart={onPrefetch}
      className="hover:bg-[#F5F5F7]/70 transition-colors cursor-pointer group"
    >
      <td className="py-3.5 px-4 lg:px-6 text-[#1D1D1F]">
        <span className="font-medium block">{payment.formattedDate}</span>
        {payment.formattedTime && (
          <span className="text-[11px] text-[#8E8E93] font-mono block">
            {payment.formattedTime}
          </span>
        )}
      </td>
      <td className="py-3.5 px-4">
        <span className="font-mono font-bold text-[#1D1D1F] block">
          {payment.receiptNumber}
        </span>
        {isOnline && (
          <span className="text-[10px] text-[#007AFF] font-medium block">
            Digital Receipt
          </span>
        )}
      </td>
      <td className="py-3 px-4">
        {isOnline ? (
          <div className="space-y-0.5">
            <span className="text-[#007AFF] font-semibold text-[11px] flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-[#007AFF]" />
              <span>Online</span>
            </span>
            <span className="text-[10px] text-[#8E8E93] block">
              Paystack Gateway
            </span>
          </div>
        ) : (
          <div className="space-y-0.5">
            <span className="text-[#34C759] font-semibold text-[11px] flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-[#34C759]" />
              <span>In-person</span>
            </span>
            <span className="text-[10px] text-[#8E8E93] block">
              {payment.cashierName || "Desk Cashier"}
            </span>
          </div>
        )}
      </td>
      <td className="py-3 px-4 text-[#1D1D1F] font-medium">
        <span>{payment.paymentMethod}</span>
        {payment.transactionReference && (
          <span className="text-[10px] text-[#8E8E93] font-mono block truncate max-w-[140px]">
            ref: {payment.transactionReference}
          </span>
        )}
      </td>
      <td className="py-3 px-4 text-right font-mono font-bold text-[#1D1D1F] tabular-nums">
        {payment.amountPaidFormatted}
      </td>
      <td className="py-3 px-4 text-center">
        <span className="font-semibold text-[11px] text-[#34C759]">
          &bull; Reconciled
        </span>
      </td>
      <td className="py-3 px-4 lg:px-6 text-right">
        <span className="text-[#007AFF] font-semibold text-[11px] group-hover:underline inline-flex items-center gap-1">
          <Receipt className="w-3.5 h-3.5" />
          <span>Receipt</span>
        </span>
      </td>
    </tr>
  );
});

const PaymentMobileTile = React.memo(function PaymentMobileTile({
  payment,
  onSelect,
  onPrefetch,
}: PaymentRowProps) {
  const isOnline = payment.paymentCategory === "ONLINE";
  return (
    <div
      onClick={() => onSelect(payment)}
      onPointerEnter={onPrefetch}
      onTouchStart={onPrefetch}
      className="p-3 flex flex-col gap-1.5 active:bg-[#F5F5F7] transition-colors cursor-pointer min-h-[56px] bg-white"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono font-bold text-[13px] text-[#1D1D1F]">
          #{payment.receiptNumber}
        </span>
        <span
          className={`text-[11px] font-semibold shrink-0 flex items-center gap-1 ${
            isOnline ? "text-[#007AFF]" : "text-[#34C759]"
          }`}
        >
          {isOnline ? <Globe className="w-3 h-3" /> : <Building2 className="w-3 h-3" />}
          <span>&bull; {isOnline ? "Online" : "In-person"}</span>
        </span>
      </div>

      <div className="text-[11px] text-[#6E6E73] flex items-center justify-between gap-2">
        <span>{payment.formattedDate} {payment.formattedTime ? `• ${payment.formattedTime}` : ""}</span>
        <span className="font-medium text-[#1D1D1F] truncate max-w-[50%]">{payment.paymentMethod}</span>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#F5F5F7]">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[10px] text-[#8E8E93]">Net</span>
          <span className="font-mono font-bold text-[13px] text-[#1D1D1F] tabular-nums">
            {payment.amountPaidFormatted}
          </span>
        </div>
        <span className="text-[#007AFF] text-[11px] font-semibold flex items-center gap-0.5">
          Receipt &rarr;
        </span>
      </div>
    </div>
  );
});
import {
  searchPropertyBillAccounts,
  getAccountPaymentsList,
  getPaidUsersList,
  recordInPersonPayment,
  sendInPersonPaymentConfirmationSms,
  updatePaymentReceiptNumber,
  PropertyBillAccountSummary,
  UnifiedPaymentRecord,
  AdminPaidUserRecord,
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
  onSelectAccount?: (accountNo: string | null) => void;
  onBackToStatement?: () => void;
}

export function PaymentsSection({
  currentAdmin,
  initialAccountNo,
  onOpenStatement,
  onSelectAccount,
  onBackToStatement,
}: PaymentsSectionProps) {
  // Synchronously resolve initial account selection on Frame 0
  const getSynchronousAccountNo = (): string | null => {
    if (initialAccountNo && initialAccountNo.trim()) return initialAccountNo.trim();
    if (typeof window !== "undefined") {
      try {
        const urlParam = new URLSearchParams(window.location.search).get("account");
        if (urlParam && urlParam.trim()) return urlParam.trim();
      } catch {}
    }
    return null;
  };

  // Navigation & Drilldown State (Known immediately on Frame 0)
  const [activeAccountNo, setActiveAccountNo] = useState<string | null>(getSynchronousAccountNo);
  const isDirectStatementRedirect = useRef(Boolean(initialAccountNo && initialAccountNo.trim() && onBackToStatement));
  const [selectedAccount, setSelectedAccount] = useState<PropertyBillAccountSummary | null>(null);
  const [isLoadingSelectedAccount, setIsLoadingSelectedAccount] = useState<boolean>(Boolean(getSynchronousAccountNo()));

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

  // Top-Level Payments View Sub-Tab (ACCOUNTS | ONLINE)
  const getInitialMainTab = (): "ACCOUNTS" | "ONLINE" => {
    if (typeof window !== "undefined") {
      try {
        const sub = new URLSearchParams(window.location.search).get("subtab");
        if (sub === "online") return "ONLINE";
      } catch {}
    }
    return "ACCOUNTS";
  };
  const [mainTab, setMainTab] = useState<"ACCOUNTS" | "ONLINE">(getInitialMainTab);

  const handleMainTabChange = (tab: "ACCOUNTS" | "ONLINE") => {
    setMainTab(tab);
    if (typeof window !== "undefined") {
      try {
        const url = new URL(window.location.href);
        if (tab === "ONLINE") {
          url.searchParams.set("subtab", "online");
        } else {
          url.searchParams.delete("subtab");
        }
        window.history.replaceState(null, "", url.pathname + (url.search || ""));
      } catch {}
    }
  };

  // Dedicated Online Payments Feed States
  const [onlineStatusFilter, setOnlineStatusFilter] = useState<"SUCCESS" | "ALL" | "FAILED" | "ABANDONED">("SUCCESS");
  const [onlinePayments, setOnlinePayments] = useState<AdminPaidUserRecord[]>([]);
  const [onlineTotal, setOnlineTotal] = useState(0);
  const [onlineTotalAmount, setOnlineTotalAmount] = useState(0);
  const [onlineCurrentPage, setOnlineCurrentPage] = useState(1);
  const onlinePageSize = 25;
  const [onlineTotalPages, setOnlineTotalPages] = useState(1);
  const [isLoadingOnline, setIsLoadingOnline] = useState(false);
  const [onlineSearchQuery, setOnlineSearchQuery] = useState("");
  const deferredOnlineSearchQuery = useDeferredValue(onlineSearchQuery);
  const onlineTableContainerRef = useRef<HTMLDivElement>(null);

  const handleOnlinePageChange = (newPage: number) => {
    setOnlineCurrentPage(newPage);
    onlineTableContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    setOnlineCurrentPage(1);
  }, [deferredOnlineSearchQuery, onlineStatusFilter]);

  useEffect(() => {
    if (mainTab !== "ONLINE") return;
    let isCancelled = false;
    async function loadOnlinePayments() {
      setIsLoadingOnline(true);
      try {
        const res = await getPaidUsersList(
          deferredOnlineSearchQuery,
          "LIVE",
          onlineStatusFilter,
          onlineCurrentPage,
          onlinePageSize
        );
        if (!isCancelled && res) {
          setOnlinePayments(res.records || []);
          setOnlineTotal(res.total || 0);
          setOnlineTotalAmount(res.totalAmount || 0);
          setOnlineTotalPages(Math.max(1, Math.ceil((res.total || 0) / onlinePageSize)));
        }
      } catch (err) {
        console.error("Failed to load online payments:", err);
      } finally {
        if (!isCancelled) setIsLoadingOnline(false);
      }
    }
    loadOnlinePayments();
    return () => {
      isCancelled = true;
    };
  }, [mainTab, deferredOnlineSearchQuery, onlineStatusFilter, onlineCurrentPage]);

  // Keep activeAccountNo in sync with prop updates without snapping back against local user clears
  const prevInitialAccountNoRef = useRef(initialAccountNo);
  useEffect(() => {
    if (initialAccountNo !== prevInitialAccountNoRef.current) {
      prevInitialAccountNoRef.current = initialAccountNo;
      const clean = (initialAccountNo && initialAccountNo.trim()) || null;
      isDirectStatementRedirect.current = Boolean(clean && onBackToStatement);
      setActiveAccountNo(clean);
      if (!clean) {
        setSelectedAccount(null);
      }
    }
  }, [initialAccountNo, onBackToStatement]);

  // Synchronize browser history (back/forward popstate)
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);
      const urlAccount = params.get("account");
      if (urlAccount && urlAccount.trim()) {
        setActiveAccountNo(urlAccount.trim());
      } else {
        setActiveAccountNo(null);
        setSelectedAccount(null);
      }

      const sub = params.get("subtab");
      if (sub === "online") {
        setMainTab("ONLINE");
      } else {
        setMainTab("ACCOUNTS");
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Dedicated effect to resolve selected account particulars whenever activeAccountNo changes
  useEffect(() => {
    if (!activeAccountNo) {
      setSelectedAccount(null);
      setIsLoadingSelectedAccount(false);
      return;
    }

    if (selectedAccount && selectedAccount.accountNumber.toLowerCase() === activeAccountNo.toLowerCase()) {
      setIsLoadingSelectedAccount(false);
      return;
    }

    let isCancelled = false;
    async function resolveAccountParticulars() {
      setIsLoadingSelectedAccount(true);
      try {
        const res = await searchPropertyBillAccounts({
          searchQuery: activeAccountNo!,
          page: 1,
          pageSize: 10,
        });
        if (!isCancelled && res.success && res.accounts && res.accounts.length > 0) {
          const match = res.accounts.find(
            (a) => a.accountNumber.toLowerCase() === activeAccountNo!.toLowerCase()
          ) || res.accounts[0];
          setSelectedAccount(match);
        } else if (!isCancelled) {
          // If account is invalid / nonexistent, clear selection safely
          setActiveAccountNo(null);
          setSelectedAccount(null);
          onSelectAccount?.(null);
          if (typeof window !== "undefined") {
            try {
              const url = new URL(window.location.href);
              url.searchParams.delete("account");
              url.searchParams.delete("accountNumber");
              url.searchParams.delete("accountNo");
              window.history.replaceState(null, "", url.pathname + (url.search || ""));
            } catch {}
          }
        }
      } catch (err) {
        console.error("Failed to load selected account particulars:", err);
      } finally {
        if (!isCancelled) setIsLoadingSelectedAccount(false);
      }
    }

    resolveAccountParticulars();
    return () => {
      isCancelled = true;
    };
  }, [activeAccountNo]);

  // Handle Account Selection from directory
  const handleSelectAccount = (acc: PropertyBillAccountSummary) => {
    isDirectStatementRedirect.current = false;
    setSelectedAccount(acc);
    setActiveAccountNo(acc.accountNumber);
    onSelectAccount?.(acc.accountNumber);
    if (typeof window !== "undefined") {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("account", acc.accountNumber);
        window.history.pushState({ account: acc.accountNumber }, "", url.pathname + url.search);
      } catch {}
    }
  };

  // Handle Account Selection by Account Number (from online payments feed)
  const handleSelectAccountByNo = (accountNo: string) => {
    isDirectStatementRedirect.current = false;
    setActiveAccountNo(accountNo);
    onSelectAccount?.(accountNo);
    if (typeof window !== "undefined") {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("account", accountNo);
        window.history.pushState({ account: accountNo }, "", url.pathname + url.search);
      } catch {}
    }
  };

  // Handle Return to Directory
  const handleBackToDirectory = () => {
    isDirectStatementRedirect.current = false;
    setSelectedAccount(null);
    setActiveAccountNo(null);
    onSelectAccount?.(null);
    if (typeof window !== "undefined") {
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("account");
        url.searchParams.delete("accountNumber");
        url.searchParams.delete("accountNo");
        window.history.replaceState({}, "", url.pathname + (url.search || ""));
      } catch {}
    }
  };

  // Clean Back Navigation (Always returns to Payments account directory within Payments tab)
  const handleBackNavigation = () => {
    handleBackToDirectory();
  };

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
  const [recordChannel, setRecordChannel] = useState("Cash");
  const [recordSettlementType, setRecordSettlementType] = useState<"TOTAL" | "ARREARS">("TOTAL");
  const [recordPassword, setRecordPassword] = useState("");
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);

  // Second Popup: Payment Confirmation & SMS Notice
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
  const [confirmationData, setConfirmationData] = useState<{
    accountNumber: string;
    ratepayerName: string;
    amount: number;
    receiptNumber: string;
    paymentChannel: string;
    remainingBalance: number;
    recipientPhone: string;
  } | null>(null);
  const [confirmationPhone, setConfirmationPhone] = useState("");
  const [isSendingConfirmationSms, setIsSendingConfirmationSms] = useState(false);
  const [confirmationError, setConfirmationError] = useState<string | null>(null);

  // Receipt Modal State
  const [selectedPayment, setSelectedPayment] = useState<UnifiedPaymentRecord | null>(null);

  const handleSelectPayment = useCallback((payment: UnifiedPaymentRecord) => {
    setSelectedPayment(payment);
  }, []);

  const handleCloseReceipt = useCallback(() => {
    setSelectedPayment(null);
  }, []);

  const handlePrefetchReceipt = useCallback(() => {
    import("@/components/PaymentReceiptModal");
  }, []);

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

  // Idle background prefetch: warm PaymentReceiptModal chunk once payments are loaded
  useEffect(() => {
    if (payments.length > 0) {
      import("@/components/PaymentReceiptModal");
    }
  }, [payments.length]);

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

        const newBal = res.updatedProperty?.totalAmountDue ?? Math.max(0, (selectedAccount.outstandingAmount || 0) - amt);
        const recordedGcr = res.receiptNumber || recordReceiptNo.trim();
        const recordedAmt = amt;
        const recordedChannel = recordChannel;
        const recordedAccountNo = selectedAccount.accountNumber;
        const recordedRatepayerName = selectedAccount.name;
        const defaultPhone = selectedAccount.telephone || "";

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

        // Trigger Second Popup: Payment Confirmation & SMS Notice
        setConfirmationData({
          accountNumber: recordedAccountNo,
          ratepayerName: recordedRatepayerName,
          amount: recordedAmt,
          receiptNumber: recordedGcr,
          paymentChannel: recordedChannel,
          remainingBalance: newBal,
          recipientPhone: defaultPhone,
        });
        setConfirmationPhone(defaultPhone);
        setConfirmationError(null);
        setIsConfirmationModalOpen(true);
      } else {
        setRecordError(res.error || "Failed to record payment.");
      }
    } catch (err: any) {
      setRecordError(err.message || "An error occurred while submitting payment.");
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Handle Dispatching Payment Confirmation SMS
  const handleSendConfirmationSms = async () => {
    if (!confirmationData) return;
    const cleanPhone = confirmationPhone.trim();
    if (!cleanPhone) {
      setConfirmationError("Please enter a valid recipient phone number.");
      return;
    }

    setIsSendingConfirmationSms(true);
    setConfirmationError(null);

    try {
      const res = await sendInPersonPaymentConfirmationSms({
        accountNumber: confirmationData.accountNumber,
        ratepayerName: confirmationData.ratepayerName,
        amount: confirmationData.amount,
        receiptNumber: confirmationData.receiptNumber,
        remainingBalance: confirmationData.remainingBalance,
        recipientPhone: cleanPhone,
      });

      if (res.success) {
        showToast(`Confirmation SMS sent to ${cleanPhone}`, "success");
        setIsConfirmationModalOpen(false);
        setConfirmationData(null);
      } else {
        setConfirmationError(res.error || "Failed to dispatch SMS confirmation.");
      }
    } catch (err: any) {
      console.error("Failed to send confirmation SMS:", err);
      setConfirmationError(err.message || "An unexpected error occurred while dispatching SMS.");
    } finally {
      setIsSendingConfirmationSms(false);
    }
  };

  // 4. Handle Modify Receipt Number for Online Payments
  const handleUpdateReceiptNumber = async (trimmedNew: string, sendSms: boolean) => {
    if (!selectedPayment) return { success: false, error: "No payment selected" };

    try {
      const res = await updatePaymentReceiptNumber({
        paymentId: selectedPayment.id,
        oldReceiptNumber: selectedPayment.receiptNumber,
        newReceiptNumber: trimmedNew,
        accountNumber: selectedPayment.accountNo,
        sendSmsNotice: sendSms,
      });

      if (res.success && res.updatedReceiptNumber) {
        showToast(`Receipt number updated to ${res.updatedReceiptNumber}`, "success");

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

        return { success: true, updatedReceiptNumber: res.updatedReceiptNumber };
      } else {
        return { success: false, error: res.error || "Failed to update receipt number." };
      }
    } catch (err: any) {
      return { success: false, error: err.message || "An error occurred while updating receipt number." };
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

      {/* VIEW 1: RATEPAYER ACCOUNTS & ONLINE PAYMENTS DIRECTORY */}
      {!activeAccountNo ? (
        isLoadingAccounts && accounts.length === 0 && mainTab === "ACCOUNTS" ? (
          <PaymentsDirectorySkeleton />
        ) : (
          <div className="w-full flex-1 min-h-0 flex flex-col gap-2.5 sm:gap-3 p-3 sm:px-6 lg:px-8 sm:py-3 overflow-hidden">
            {/* Top Sub-Navigation Bar: Property Accounts vs. Online Payments (Zero Pills standard) */}
            <div className="flex items-center justify-center sm:justify-start gap-6 sm:gap-8 border-b border-[#E8E8ED] shrink-0 text-xs font-semibold overflow-x-auto px-1">
              <button
                type="button"
                onClick={() => handleMainTabChange("ACCOUNTS")}
                className={`pb-2.5 transition-colors cursor-pointer relative shrink-0 ${
                  mainTab === "ACCOUNTS"
                    ? "text-[#007AFF] font-bold border-b-2 border-[#007AFF]"
                    : "text-[#6E6E73] hover:text-[#1D1D1F]"
                }`}
              >
                <span>Property Accounts</span>
              </button>
              <button
                type="button"
                onClick={() => handleMainTabChange("ONLINE")}
                className={`pb-2.5 transition-colors cursor-pointer relative shrink-0 ${
                  mainTab === "ONLINE"
                    ? "text-[#007AFF] font-bold border-b-2 border-[#007AFF]"
                    : "text-[#6E6E73] hover:text-[#1D1D1F]"
                }`}
              >
                <span>Online Payments</span>
              </button>
            </div>

            {mainTab === "ONLINE" ? (
              <>
                {/* Online Payments Status Filter Tabs (Zero Pills Standard: Clean typographic links with subtle active underline) */}
                <div className="flex items-center justify-center sm:justify-start gap-6 sm:gap-8 border-b border-[#E8E8ED] shrink-0 text-xs font-semibold overflow-x-auto px-1">
                  <button
                    type="button"
                    onClick={() => setOnlineStatusFilter("SUCCESS")}
                    className={`pb-2 transition-colors cursor-pointer relative shrink-0 ${
                      onlineStatusFilter === "SUCCESS"
                        ? "text-[#34C759] font-bold border-b-2 border-[#34C759]"
                        : "text-[#6E6E73] hover:text-[#1D1D1F]"
                    }`}
                  >
                    <span>Confirmed Paid</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOnlineStatusFilter("ALL")}
                    className={`pb-2 transition-colors cursor-pointer relative shrink-0 ${
                      onlineStatusFilter === "ALL"
                        ? "text-[#007AFF] font-bold border-b-2 border-[#007AFF]"
                        : "text-[#6E6E73] hover:text-[#1D1D1F]"
                    }`}
                  >
                    <span>All Attempts</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOnlineStatusFilter("FAILED")}
                    className={`pb-2 transition-colors cursor-pointer relative shrink-0 ${
                      onlineStatusFilter === "FAILED"
                        ? "text-[#FF3B30] font-bold border-b-2 border-[#FF3B30]"
                        : "text-[#6E6E73] hover:text-[#1D1D1F]"
                    }`}
                  >
                    <span>Failed</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOnlineStatusFilter("ABANDONED")}
                    className={`pb-2 transition-colors cursor-pointer relative shrink-0 ${
                      onlineStatusFilter === "ABANDONED"
                        ? "text-[#8E8E93] font-bold border-b-2 border-[#8E8E93]"
                        : "text-[#6E6E73] hover:text-[#1D1D1F]"
                    }`}
                  >
                    <span>Abandoned</span>
                  </button>
                </div>

                {/* 1. Standalone Static Search Toolbar for Online Payments */}
                <div className="w-full bg-white border border-[#E8E8ED] rounded-[14px] px-3.5 py-3 sm:px-5 sm:py-3.5 shadow-xs shrink-0 flex items-center gap-3">
                  <div className="relative w-full max-w-md">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#8E8E93]" />
                    <input
                      type="text"
                      value={onlineSearchQuery}
                      onChange={(e) => setOnlineSearchQuery(e.target.value)}
                      placeholder="Search reference, ratepayer, phone, account number..."
                      className="w-full pl-9 pr-8 py-2 bg-[#F5F5F7] border border-[#E8E8ED] rounded-xl text-xs font-medium text-[#1D1D1F] placeholder-[#8E8E93] outline-none focus:border-[#007AFF] focus:bg-white transition-all"
                    />
                    {onlineSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setOnlineSearchQuery("")}
                        className="absolute right-2.5 top-2 text-[#8E8E93] hover:text-[#1D1D1F] p-0.5 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. Standalone Table Container for Online Payments */}
                <div className="w-full flex-1 min-h-0 bg-white border border-[#E8E8ED] rounded-[14px] shadow-xs flex flex-col overflow-hidden relative">
                  <div ref={onlineTableContainerRef} className="w-full flex-1 min-h-0 overflow-y-auto overflow-x-auto no-scrollbar flex flex-col">
                    {isLoadingOnline && onlinePayments.length === 0 ? (
                      <div className="w-full flex-1 h-full min-h-[340px] flex flex-col items-center justify-center gap-3.5 text-[#6E6E73] p-8 m-auto">
                        <AppleSpinner size="lg" className="text-[#007AFF]" />
                        <p className="text-xs font-medium text-[#8E8E93]">Loading online Paystack transactions...</p>
                      </div>
                    ) : onlinePayments.length === 0 ? (
                      <div className="w-full flex-1 h-full min-h-[280px] flex flex-col items-center justify-center text-center p-8 gap-2 m-auto">
                        <Globe className="w-8 h-8 text-[#8E8E93]" />
                        <h4 className="text-sm font-semibold text-[#1D1D1F]">
                          {onlineStatusFilter === "SUCCESS"
                            ? "No confirmed online payments found"
                            : onlineStatusFilter === "FAILED"
                            ? "No failed online payments found"
                            : onlineStatusFilter === "ABANDONED"
                            ? "No abandoned online sessions found"
                            : "No online transactions found"}
                        </h4>
                        <p className="text-xs text-[#6E6E73] max-w-sm">
                          {onlineSearchQuery
                            ? "No online transactions matched your search criteria. Try a different reference or account number."
                            : onlineStatusFilter === "SUCCESS"
                            ? "No confirmed citizen payments have been processed through Paystack yet."
                            : "No transactions match the selected filter."}
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* DESKTOP TABLE VIEW */}
                        <table className="hidden sm:table w-full text-left border-collapse min-w-[780px]">
                          <thead className="bg-[#F9F9FB] text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider sticky top-0 z-10 border-b border-[#E8E8ED]">
                            <tr>
                              <th className="py-2.5 px-4 lg:px-6">Date & Time</th>
                              <th className="py-2.5 px-4">Reference / Receipt</th>
                              <th className="py-2.5 px-4">Ratepayer / Payer</th>
                              <th className="py-2.5 px-4">Property Account</th>
                              <th className="py-2.5 px-4">Channel</th>
                              <th className="py-2.5 px-4 text-right">Amount Paid</th>
                              <th className="py-2.5 px-4 text-center">Status</th>
                              <th className="py-2.5 px-4 lg:px-6 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E8E8ED] text-xs">
                            {onlinePayments.map((p) => {
                              const hasAccount = Boolean(p.accountNumber && p.accountNumber !== "N/A");
                              return (
                                <tr key={p.id} className="hover:bg-[#F5F5F7]/70 transition-colors group">
                                  <td className="py-3 px-4 lg:px-6 text-[#1D1D1F] font-medium whitespace-nowrap">
                                    {p.paidAt}
                                  </td>
                                  <td className="py-3 px-4 font-mono font-medium text-[#1D1D1F] max-w-[160px] truncate" title={p.reference || p.receiptNumber}>
                                    {p.reference || p.receiptNumber || "—"}
                                  </td>
                                  <td className="py-3 px-4">
                                    <div className="font-medium text-[#1D1D1F] truncate max-w-[180px]">
                                      {p.userName || "Online Ratepayer"}
                                    </div>
                                    {p.phoneNumber && p.phoneNumber !== "N/A" && (
                                      <div className="text-[11px] text-[#8E8E93] font-mono">
                                        {p.phoneNumber}
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-3 px-4 font-mono font-semibold">
                                    {hasAccount ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (onOpenStatement) {
                                            onOpenStatement(p.accountNumber);
                                          } else {
                                            setActiveAccountNo(p.accountNumber);
                                          }
                                        }}
                                        className="text-[#007AFF] hover:underline cursor-pointer group-hover:text-[#0051A8]"
                                        title="View statement for this property"
                                      >
                                        {p.accountNumber}
                                      </button>
                                    ) : (
                                      <span className="text-[#8E8E93]">N/A</span>
                                    )}
                                  </td>
                                  <td className="py-3 px-4 text-[#6E6E73]">
                                    {p.paymentMethod || "Paystack MoMo"}
                                  </td>
                                  <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums text-[#1D1D1F]">
                                    {formatGhc(p.amountPaid)}
                                  </td>
                                  <td className="py-3 px-4 text-center">
                                    {p.status === "PAID" || p.status === "SUCCESS" ? (
                                      <span className="text-[#34C759] font-semibold text-[11px]">
                                        &bull; Paid
                                      </span>
                                    ) : p.status === "FAILED" ? (
                                      <span className="text-[#FF3B30] font-semibold text-[11px]" title={p.gatewayResponse || "Declined"}>
                                        &bull; Failed
                                      </span>
                                    ) : (
                                      <span className="text-[#8E8E93] font-semibold text-[11px]" title="Session closed before completion">
                                        &bull; Abandoned
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3 px-4 lg:px-6 text-right whitespace-nowrap">
                                    {hasAccount ? (
                                      <button
                                        type="button"
                                        onClick={() => handleSelectAccountByNo(p.accountNumber)}
                                        className="text-[#007AFF] font-medium text-[11px] hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                                      >
                                        View Payments &rarr;
                                      </button>
                                    ) : (
                                      <span className="text-[#8E8E93] text-[11px]">—</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>

                        {/* MOBILE RESPONSIVE CARDS */}
                        <div className="block sm:hidden divide-y divide-[#E8E8ED]">
                          {onlinePayments.map((p) => {
                            const hasAccount = Boolean(p.accountNumber && p.accountNumber !== "N/A");
                            return (
                              <div
                                key={`mobile-online-${p.id}`}
                                className="p-3.5 flex flex-col gap-1.5 active:bg-[#F5F5F7] transition-colors"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-mono text-[11px] text-[#6E6E73] truncate max-w-[65%]">
                                    {p.reference || p.receiptNumber}
                                  </span>
                                  {p.status === "PAID" || p.status === "SUCCESS" ? (
                                    <span className="text-[#34C759] text-[11px] font-semibold shrink-0">
                                      &bull; Paid
                                    </span>
                                  ) : p.status === "FAILED" ? (
                                    <span className="text-[#FF3B30] text-[11px] font-semibold shrink-0" title={p.gatewayResponse || "Declined"}>
                                      &bull; Failed
                                    </span>
                                  ) : (
                                    <span className="text-[#8E8E93] text-[11px] font-semibold shrink-0" title="Session closed before completion">
                                      &bull; Abandoned
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-baseline justify-between gap-2">
                                  <span className="text-[13px] font-semibold text-[#1D1D1F]">
                                    {p.userName || "Online Ratepayer"}
                                  </span>
                                  <span className="font-mono font-bold text-[13px] text-[#1D1D1F] tabular-nums">
                                    {formatGhc(p.amountPaid)}
                                  </span>
                                </div>

                                <div className="flex items-center justify-between gap-2 pt-0.5 text-[11px]">
                                  <div className="text-[#8E8E93] font-mono truncate">
                                    {hasAccount ? p.accountNumber : p.phoneNumber || p.paymentMethod}
                                  </div>
                                  <span className="text-[#8E8E93] shrink-0">{p.paidAt}</span>
                                </div>

                                {hasAccount && (
                                  <div className="pt-1 flex items-center justify-end">
                                    <button
                                      type="button"
                                      onClick={() => handleSelectAccountByNo(p.accountNumber)}
                                      className="text-[#007AFF] font-semibold text-[11px] hover:underline cursor-pointer inline-flex items-center gap-1"
                                    >
                                      <span>View Account Payments</span>
                                      <ChevronRight className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* 3. Standalone Bottom Pagination for Online Payments */}
                {onlineTotalPages > 1 && (
                  <div className="w-full bg-white border border-[#E8E8ED] rounded-[14px] px-4 py-2.5 shadow-xs flex items-center justify-between text-xs text-[#6E6E73] shrink-0">
                    <span>
                      Page <strong className="text-[#1D1D1F]">{onlineCurrentPage}</strong> of {onlineTotalPages}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={onlineCurrentPage <= 1 || isLoadingOnline}
                        onClick={() => handleOnlinePageChange(Math.max(1, onlineCurrentPage - 1))}
                        className="px-3 py-1.5 rounded-lg border border-[#D2D2D7] bg-white text-[#1D1D1F] hover:bg-[#F5F5F7] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer font-medium min-h-[36px] flex items-center justify-center"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        disabled={onlineCurrentPage >= onlineTotalPages || isLoadingOnline}
                        onClick={() => handleOnlinePageChange(onlineCurrentPage + 1)}
                        className="px-3 py-1.5 rounded-lg border border-[#D2D2D7] bg-white text-[#1D1D1F] hover:bg-[#F5F5F7] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer font-medium min-h-[36px] flex items-center justify-center"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* 1. Standalone Static Search Toolbar Container (Detached from Table) */}
                <div className="w-full bg-white border border-[#E8E8ED] rounded-[14px] px-3.5 py-3 sm:px-5 sm:py-3.5 shadow-xs shrink-0 flex items-center gap-3">
                  <div className="relative w-full max-w-md">
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

                {/* 2. Standalone Table & Mobile List Container (Consumes all available space) */}
                <div className="w-full flex-1 min-h-0 bg-white border border-[#E8E8ED] rounded-[14px] shadow-xs flex flex-col overflow-hidden relative">
                  <div ref={tableContainerRef} className="w-full flex-1 min-h-0 overflow-y-auto overflow-x-auto no-scrollbar flex flex-col">
                    {isLoadingAccounts && accounts.length === 0 ? (
                      /* Authentic Loading State inside table during initial mount fallback */
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
                                  onClick={() => handleSelectAccount(acc)}
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
                                onClick={() => handleSelectAccount(acc)}
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
                {totalPages > 1 && (
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
                )}
              </>
            )}
          </div>
        )
      ) : !selectedAccount ? (
        <PaymentsUserRecordsSkeleton />
      ) : (
        /* VIEW 2: ACCOUNT PAYMENTS LEDGER & WORKBENCH (DRILLDOWN) */
        <div className="w-full flex-1 min-h-0 flex flex-col gap-2.5 sm:gap-3 p-3 sm:px-6 lg:px-8 sm:py-3 overflow-hidden">
          {/* Top Standalone Card: Apple Navigation & Profile Summary */}
          <div className="w-full bg-white border border-[#E8E8ED] rounded-2xl p-3.5 sm:p-5 shadow-xs shrink-0 space-y-3.5">
            {/* iOS Level 1: Navigation Link & Action Bar */}
            <div className="flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleBackNavigation}
                  className="flex items-center gap-1 text-[13px] font-semibold text-[#007AFF] hover:underline cursor-pointer min-h-[44px] -ml-1 px-1 active:opacity-70 transition-opacity"
                  title="Back"
                >
                  <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
                  <span>Back</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsRecordModalOpen(true);
                    setRecordAmount("");
                    setRecordReceiptNo("");
                    setRecordPassword("");
                    setRecordError(null);
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-[#007AFF] hover:bg-[#0066D6] text-white font-semibold text-xs flex items-center gap-1.5 shadow-[0px_1px_3px_0px_rgba(0,122,255,0.25)] transition-all cursor-pointer active:scale-98 min-h-[38px]"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Payment</span>
                </button>
              </div>
            </div>

            {/* iOS Level 2: Ratepayer Profile & Financial Overview Card (Height Reduced by ~12%) */}
            <div className="relative bg-[#FAFAFC] border border-[#E8E8ED] rounded-xl p-3 sm:px-4 sm:py-3 flex flex-col gap-2.5">
              {/* Floated Redirect Link Icon to View Statement */}
              {onOpenStatement && (
                <button
                  type="button"
                  onClick={() => onOpenStatement(selectedAccount.accountNumber)}
                  title="View Statement"
                  aria-label="View Statement"
                  className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 p-1.5 rounded-lg text-[#007AFF] hover:bg-[#EAF2FC] transition-colors cursor-pointer active:scale-95 flex items-center gap-1 group"
                >
                  <span className="text-[11px] font-semibold hidden md:inline group-hover:underline">Statement</span>
                  <ArrowUpRight className="w-4 h-4 stroke-[2.2]" />
                </button>
              )}

              {/* Ratepayer Biodata (Name and Account & Address) */}
              <div className="space-y-0.5 min-w-0 pr-12 sm:pr-24">
                <h3 className="text-[15px] sm:text-base font-bold text-[#1D1D1F] tracking-tight truncate leading-tight">
                  {selectedAccount.name || "Unnamed Ratepayer"}
                </h3>
                <p className="text-[11px] sm:text-xs text-[#6E6E73] truncate flex items-center gap-1.5">
                  <span className="font-mono text-[#007AFF] font-medium">{selectedAccount.accountNumber}</span>
                  <span className="text-[#8E8E93]">&bull;</span>
                  <span className="truncate">{selectedAccount.ownerDigitalAddress || selectedAccount.houseNo || "No address on record"}</span>
                </p>
              </div>

              {/* Hairline Divider */}
              <div className="border-t border-[#E8E8ED]" />

              {/* Financial Metrics (Apple 2-Column Responsive Grid - Zero Text Wrapping) */}
              <div className="grid grid-cols-2 gap-3 sm:gap-6 items-start">
                <div className="space-y-0.5 min-w-0">
                  <span className="text-[10px] sm:text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider block truncate">
                    Outstanding balance
                  </span>
                  <span
                    className={`text-base sm:text-[17px] font-bold font-mono tabular-nums block truncate leading-tight ${
                      selectedAccount.outstandingAmount <= 0 ? "text-[#34C759]" : "text-[#FF3B30]"
                    }`}
                  >
                    {formatGhc(selectedAccount.outstandingAmount)}
                  </span>
                </div>

                <div className="space-y-0.5 min-w-0">
                  <span className="text-[10px] sm:text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider block truncate">
                    Total paid
                  </span>
                  <span className="text-base sm:text-[17px] font-bold font-mono tabular-nums text-[#1D1D1F] block truncate leading-tight">
                    {paymentsSummary.totalPaidFormatted}
                  </span>
                  <span className="text-[10px] text-[#8E8E93] block truncate">
                    Online: {paymentsSummary.onlinePaidFormatted} &bull; Counter: {paymentsSummary.inPersonPaidFormatted}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Standalone Payments Ledger Card Container */}
          <div className="w-full flex-1 min-h-0 bg-white border border-[#E8E8ED] rounded-[14px] shadow-xs flex flex-col overflow-hidden relative">
            {/* Channel Filter Tabs (Zero Pills Standard: Clean Typographic Links without icons) */}
            <div className="flex items-center justify-center sm:justify-start gap-5 sm:gap-7 px-4 pt-2.5 border-b border-[#E8E8ED] shrink-0 text-xs font-semibold overflow-x-auto bg-[#FAFAFC]">
              <button
                type="button"
                onClick={() => setChannelFilter("ALL")}
                className={`pb-2.5 transition-colors cursor-pointer relative shrink-0 ${
                  channelFilter === "ALL"
                    ? "text-[#007AFF] font-bold border-b-2 border-[#007AFF]"
                    : "text-[#6E6E73] hover:text-[#1D1D1F]"
                }`}
              >
                All
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
                Online
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
                In-person
              </button>
            </div>

            <div className="w-full flex-1 min-h-0 overflow-y-auto overflow-x-auto no-scrollbar flex flex-col">
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
                      {filteredPayments.map((p) => (
                        <PaymentTableRow
                          key={p.id}
                          payment={p}
                          onSelect={handleSelectPayment}
                          onPrefetch={handlePrefetchReceipt}
                        />
                      ))}
                    </tbody>
                  </table>

                  {/* MOBILE RESPONSIVE PAYMENTS TILES */}
                  <div className="block sm:hidden divide-y divide-[#E8E8ED]">
                    {filteredPayments.map((p) => (
                      <PaymentMobileTile
                        key={`mobile-pay-${p.id}`}
                        payment={p}
                        onSelect={handleSelectPayment}
                        onPrefetch={handlePrefetchReceipt}
                      />
                    ))}
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
                onClick={() => {
                  setIsRecordModalOpen(false);
                  setRecordAmount("");
                  setRecordReceiptNo("");
                  setRecordPassword("");
                  setRecordError(null);
                }}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[#8E8E93] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleRecordInPersonPayment}
              autoComplete="off"
              data-lpignore="true"
              data-1p-ignore="true"
              data-form-type="other"
              className="p-5 space-y-4"
            >
              {/* Anti-autofill Decoy Honeypots */}
              <input
                type="text"
                name="prevent_autofill_user"
                tabIndex={-1}
                aria-hidden="true"
                style={{ position: "absolute", top: -9999, left: -9999, opacity: 0, height: 0, width: 0, pointerEvents: "none" }}
              />
              <input
                type="password"
                name="prevent_autofill_pass"
                tabIndex={-1}
                aria-hidden="true"
                style={{ position: "absolute", top: -9999, left: -9999, opacity: 0, height: 0, width: 0, pointerEvents: "none" }}
              />

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
                    autoComplete="off"
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
                  autoComplete="off"
                  name="gcr_receipt_no_entry"
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
                  <option value="Cash">Cash</option>
                  <option value="Cheque">Cheque</option>
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
                  autoComplete="new-password"
                  name="officer_confirmation_secret"
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
                  onClick={() => {
                    setIsRecordModalOpen(false);
                    setRecordAmount("");
                    setRecordReceiptNo("");
                    setRecordPassword("");
                    setRecordError(null);
                  }}
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

      {/* MODAL 1.5: PAYMENT CONFIRMATION & SMS NOTICE (SECOND POPUP) */}
      {isConfirmationModalOpen && confirmationData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="bg-white rounded-2xl border border-[#E8E8ED] shadow-2xl max-w-md w-full overflow-hidden text-xs"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-[#E8E8ED] flex items-center justify-between bg-white">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#34C759]">
                  <CheckCircle2 className="w-4 h-4 stroke-[2.2]" />
                  <span>Payment Recorded Successfully</span>
                </div>
                <h3 className="font-bold text-sm text-[#1D1D1F] mt-0.5">
                  Send Citizen Confirmation Notice
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsConfirmationModalOpen(false);
                  setConfirmationData(null);
                }}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[#8E8E93] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {confirmationError && (
                <div className="p-3 rounded-xl bg-[#FF3B30]/10 border border-[#FF3B30]/20 text-[#FF3B30] text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{confirmationError}</span>
                </div>
              )}

              {/* Recognized Payment Summary Card */}
              <div className="p-3.5 rounded-xl bg-[#F5F5F7] border border-[#E8E8ED] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[#6E6E73] font-medium uppercase tracking-wider">
                    Amount Paid &amp; Credited
                  </span>
                  <span className="text-[11px] font-semibold text-[#34C759]">
                    &bull; Reconciled
                  </span>
                </div>

                <div className="text-2xl font-bold font-mono text-[#1D1D1F] tabular-nums">
                  GH₵ {confirmationData.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#E8E8ED]/80 text-[11px]">
                  <div>
                    <span className="text-[#8E8E93] block">Official GCR #</span>
                    <span className="font-mono font-bold text-[#1D1D1F]">
                      {confirmationData.receiptNumber}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#8E8E93] block">Account Number</span>
                    <span className="font-mono font-semibold text-[#1D1D1F]">
                      {confirmationData.accountNumber}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#8E8E93] block">Ratepayer Name</span>
                    <span className="font-medium text-[#1D1D1F] truncate block">
                      {confirmationData.ratepayerName}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#8E8E93] block">New Balance Due</span>
                    <span className={`font-mono font-bold tabular-nums ${confirmationData.remainingBalance <= 0 ? "text-[#34C759]" : "text-[#1D1D1F]"}`}>
                      GH₵ {confirmationData.remainingBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Recipient Phone Input */}
              <div className="space-y-1.5">
                <label className="font-semibold text-[#1D1D1F] flex items-center justify-between">
                  <span>Recipient Phone Number *</span>
                  <span className="text-[10px] text-[#8E8E93] font-normal">Ghana Mobile (e.g. 0244...)</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-[#8E8E93] absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="tel"
                    required
                    value={confirmationPhone}
                    onChange={(e) => setConfirmationPhone(e.target.value)}
                    placeholder="Enter ratepayer phone number"
                    className="w-full pl-9 pr-3 py-2 bg-white border border-[#D2D2D7] rounded-xl font-mono text-xs font-semibold text-[#1D1D1F] outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF]"
                  />
                </div>
              </div>

              {/* SMS Notice Preview */}
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-[11px] font-semibold text-[#6E6E73]">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>SMS Notice Preview</span>
                </div>
                <div className="p-3 bg-[#FAFAFC] rounded-xl border border-[#E8E8ED] font-mono text-[11px] text-[#48484A] leading-relaxed whitespace-pre-wrap">
                  {`KKMA Official Payment Confirmation\nDear ${confirmationData.ratepayerName}, payment of GH₵ ${confirmationData.amount.toFixed(2)} for Property #${confirmationData.accountNumber} is credited.\nOfficial GCR: ${confirmationData.receiptNumber}\nRemaining Balance: GH₵ ${confirmationData.remainingBalance.toFixed(2)}\nThank you for paying your municipal rate.`}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-[#E8E8ED]">
                <button
                  type="button"
                  disabled={isSendingConfirmationSms}
                  onClick={() => {
                    setIsConfirmationModalOpen(false);
                    setConfirmationData(null);
                  }}
                  className="px-3.5 py-2 rounded-xl border border-[#D2D2D7] text-[#1D1D1F] font-semibold hover:bg-[#F5F5F7] transition-all cursor-pointer"
                >
                  Skip Notice
                </button>
                <button
                  type="button"
                  onClick={handleSendConfirmationSms}
                  disabled={isSendingConfirmationSms}
                  className="px-4 py-2 rounded-xl bg-[#007AFF] hover:bg-[#0066D6] text-white font-semibold flex items-center gap-1.5 shadow-[0px_1px_4px_0px_rgba(0,122,255,0.3)] transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSendingConfirmationSms ? (
                    <>
                      <AppleSpinner size="xs" />
                      <span>Sending SMS...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Confirmation SMS</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* MODAL 2: OFFICIAL PAYMENT RECEIPT (APPLE HIG COMPLIANT) */}
      <AnimatePresence>
        {selectedPayment && (
          <PaymentReceiptModal
            payment={selectedPayment}
            defaultPhone={selectedAccount?.telephone || undefined}
            outstandingBalance={selectedAccount?.outstandingAmount}
            onClose={handleCloseReceipt}
            currentAdmin={currentAdmin}
            onOpenStatement={onOpenStatement}
            onUpdateReceiptNumber={handleUpdateReceiptNumber}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default PaymentsSection;
