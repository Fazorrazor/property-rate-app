"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Search,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Printer,
  LogOut,
  Building2,
  FileText,
  CreditCard,
  Receipt,
  X,
  RotateCcw,
  ArrowLeft,
  ArrowUpRight,
  Phone,
  MapPin,
} from "lucide-react";
import { PaymentsSection } from "@/components/PaymentsSection";
import { motion, AnimatePresence } from "framer-motion";
import { AppleSpinner } from "@/components/ui/AppleSpinner";
import { SigningOutScreen } from "@/components/SigningOutScreen";
import { SessionTimer } from "@/components/SessionTimer";
import { StatementsViewSkeleton } from "@/components/Skeletons";
import {
  getAccountBillHistoryDetail,
  searchPropertyBillAccounts,
  adminLogout,
  PropertyBillAccountSummary,
  GetAccountBillHistoryDetailResponse,
} from "@/app/actions";
import { formatGhc, formatDateGb, formatDateSlash } from "@/lib/formatters";

interface OfficerStatementViewProps {
  initialAdmin?: {
    id: string;
    username: string;
    name: string;
    role: string;
  } | null;
  initialAccountNo?: string | null;
  initialSection?: "STATEMENT" | "PAYMENTS";
  hideHeader?: boolean;
  onNavigateToPayments?: (accountNo: string) => void;
}

interface StatementLedgerRow {
  year: number | string;
  dateStr: string;
  timestamp: number;
  item: string;
  billedDebit: number;
  paidCredit: number;
  runningBalance: number;
  isPayment?: boolean;
  accountNo?: string;
  gcrNr?: string;
}

const MONTH_NAMES_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

// Available fiscal years for dedicated filter tabs & year picker
const FISCAL_YEARS = [2027, 2026, 2025, 2024, 2023, 2022, 2021, 2020];
const AVAILABLE_YEARS = [2027, 2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018];

/**
 * Format accounting running balance.
 * Uses standard credit balance indicator (CR) if negative (advance/overpayment).
 */
function formatLedgerBalance(balance: number): string {
  if (balance < -0.005) {
    return `${Math.abs(balance).toFixed(2)} CR`;
  }
  return balance.toFixed(2);
}

/**
 * Format ISO (YYYY-MM-DD) to Figma format (DD-Mon-YYYY) e.g. 01-Jan-2025
 */
function formatIsoToDisplay(isoStr: string): string {
  if (!isoStr) return "";
  const parts = isoStr.split("-");
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d) && m >= 0 && m < 12) {
      return `${String(d).padStart(2, "0")}-${MONTH_NAMES_SHORT[m]}-${y}`;
    }
  }
  const date = new Date(isoStr);
  if (isNaN(date.getTime())) return isoStr;
  const day = String(date.getDate()).padStart(2, "0");
  const mon = MONTH_NAMES_SHORT[date.getMonth()];
  const yr = date.getFullYear();
  return `${day}-${mon}-${yr}`;
}

/**
 * Postel's Law Date Parser:
 * Accepts formats:
 * - DD-Mon-YYYY (01-Jan-2025)
 * - YYYY-MM-DD (2025-01-01)
 * - DD-MM-YYYY or DD/MM/YYYY (01-01-2025, 01/01/2025)
 * - YYYY (2025) -> returns start or end of year depending on isEnd
 */
function parseDateInput(raw: string, isEnd = false): string | null {
  const s = raw.trim();
  if (!s) return null;

  // Single 4-digit year: e.g. "2025"
  if (/^\d{4}$/.test(s)) {
    const yr = s;
    return isEnd ? `${yr}-12-31` : `${yr}-01-01`;
  }

  // DD-Mon-YYYY (e.g. 01-Jan-2025, 1-jan-2025, 01-January-2025)
  const dMonYMatch = s.match(/^(\d{1,2})[-/ ]([a-zA-Z]{3,9})[-/ ](\d{2,4})$/);
  if (dMonYMatch) {
    const day = parseInt(dMonYMatch[1], 10);
    const monStr = dMonYMatch[2].toLowerCase().slice(0, 3);
    let yr = parseInt(dMonYMatch[3], 10);
    if (yr < 100) yr += 2000;

    const monIdx = MONTH_NAMES_SHORT.findIndex((m) => m.toLowerCase() === monStr);
    if (monIdx !== -1 && day >= 1 && day <= 31) {
      return `${yr}-${String(monIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  // YYYY-MM-DD (ISO)
  const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    const yr = isoMatch[1];
    const m = String(parseInt(isoMatch[2], 10)).padStart(2, "0");
    const d = String(parseInt(isoMatch[3], 10)).padStart(2, "0");
    return `${yr}-${m}-${d}`;
  }

  // DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (dmyMatch) {
    const day = String(parseInt(dmyMatch[1], 10)).padStart(2, "0");
    const month = String(parseInt(dmyMatch[2], 10)).padStart(2, "0");
    let yr = parseInt(dmyMatch[3], 10);
    if (yr < 100) yr += 2000;
    return `${yr}-${month}-${day}`;
  }

  // Fallback native Date parse
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

export function OfficerStatementView({
  initialAdmin,
  initialAccountNo,
  initialSection = "STATEMENT",
  hideHeader = false,
  onNavigateToPayments,
}: OfficerStatementViewProps) {
  // Synchronously resolve initial account strictly from server-forwarded props on Frame 0
  const resolvedInitialAcc = (initialAccountNo && initialAccountNo.trim()) || "";

  // Input & search states
  const [accountNumberInput, setAccountNumberInput] = useState(resolvedInitialAcc);
  const [searchQuery, setSearchQuery] = useState(resolvedInitialAcc);
  const [searchResults, setSearchResults] = useState<PropertyBillAccountSummary[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isAccountConfirmed, setIsAccountConfirmed] = useState(Boolean(resolvedInitialAcc));
  const [isMultiMatchModalOpen, setIsMultiMatchModalOpen] = useState(false);
  const [multiMatchResults, setMultiMatchResults] = useState<PropertyBillAccountSummary[]>([]);
  const [multiMatchSearchTerm, setMultiMatchSearchTerm] = useState("");
  const [accountSearchMessage, setAccountSearchMessage] = useState<string | null>(null);

  // Active statement state
  const [activeAccountNo, setActiveAccountNo] = useState<string | null>(resolvedInitialAcc || null);
  const [statementData, setStatementData] = useState<GetAccountBillHistoryDetailResponse | null>(null);
  const [isLoadingStatement, setIsLoadingStatement] = useState(Boolean(resolvedInitialAcc));
  const [statementError, setStatementError] = useState<string | null>(null);

  // Date range states (ISO format: YYYY-MM-DD)
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Editable date string states for typing
  const [startDateText, setStartDateText] = useState("");
  const [endDateText, setEndDateText] = useState("");


  // Date range picker modal state (Fiscal Year Based)
  const [isPeriodPickerOpen, setIsPeriodPickerOpen] = useState(false);
  const [tempStartDate, setTempStartDate] = useState("");
  const [tempEndDate, setTempEndDate] = useState("");
  const [tempStartYear, setTempStartYear] = useState<number | null>(null);
  const [tempEndYear, setTempEndYear] = useState<number | null>(null);
  const [activeYearTarget, setActiveYearTarget] = useState<"start" | "end">("start");
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isSearchCollapsed, setIsSearchCollapsed] = useState(false);
  const [isBiodataExpanded, setIsBiodataExpanded] = useState(false);
  const startReelRef = useRef<HTMLDivElement>(null);
  const endReelRef = useRef<HTMLDivElement>(null);
  const [hasInteractedWithEndReel, setHasInteractedWithEndReel] = useState(false);

  // Active top-level navigation section: 'STATEMENT' | 'PAYMENTS'
  const [activeSection, setActiveSection] = useState<"STATEMENT" | "PAYMENTS">(initialSection || "STATEMENT");
  const [paymentsNavAccount, setPaymentsNavAccount] = useState<string | null>(null);

  const handleSectionChange = (newSec: "STATEMENT" | "PAYMENTS") => {
    if (newSec === "PAYMENTS") {
      setPaymentsNavAccount(null);
    }
    setActiveSection(newSec);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("kkma_officer_active_section", newSec);
        document.cookie = `kkma_officer_active_section=${newSec}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
        const url = new URL(window.location.href);
        if (newSec === "PAYMENTS") {
          url.searchParams.set("section", "payments");
          url.searchParams.delete("account");
        } else {
          url.searchParams.delete("section");
        }
        window.history.pushState({ section: newSec }, "", url.pathname + url.search);
      } catch { }
    }
  };

  const handleRedirectToPayments = (targetAcc?: string) => {
    const acc = (targetAcc || statementData?.property?.account_no || activeAccountNo || accountNumberInput || "").trim();
    if (acc) {
      setPaymentsNavAccount(acc);
      setActiveAccountNo(acc);
      setAccountNumberInput(acc);
      setSearchQuery(acc);
    }
    if (onNavigateToPayments && acc) {
      onNavigateToPayments(acc);
      return;
    }
    if (typeof window !== "undefined") {
      try {
        if (acc) {
          localStorage.setItem("kkma_officer_statement_account", acc);
          document.cookie = `kkma_officer_statement_account=${acc}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
          const url = new URL(window.location.href);
          url.searchParams.set("section", "payments");
          url.searchParams.set("account", acc);
          window.history.pushState({ section: "PAYMENTS", account: acc }, "", url.pathname + url.search);
        }
        document.cookie = "admin_active_tab=PAYMENTS; path=/; max-age=2592000; SameSite=Lax";
        document.cookie = "kkma_officer_active_section=PAYMENTS; path=/; max-age=2592000; SameSite=Lax";
      } catch {}
    }
    setActiveSection("PAYMENTS");
  };

  const desktopSearchContainerRef = useRef<HTMLDivElement>(null);
  const mobileSearchContainerRef = useRef<HTMLDivElement>(null);
  const desktopInputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const statementSectionRef = useRef<HTMLElement>(null);
  const isSelectingRef = useRef(false);
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleClearAccountSearch = (isMobile = false) => {
    setAccountNumberInput("");
    setSearchQuery("");
    setIsAccountConfirmed(false);
    setAccountSearchMessage(null);
    setSearchResults([]);
    setIsDropdownOpen(false);
    if (isMobile) {
      mobileInputRef.current?.focus();
    } else {
      desktopInputRef.current?.focus();
    }
  };

  // Performance & Concurrency Guards
  const latestSearchIdRef = useRef(0);
  const searchCacheRef = useRef<Map<string, PropertyBillAccountSummary[]>>(new Map());
  const inFlightAccountRef = useRef<string | null>(null);
  const statementCacheRef = useRef<Map<string, GetAccountBillHistoryDetailResponse>>(new Map());

  // Keep display text synchronized when ISO dates change via filters or presets
  useEffect(() => {
    setStartDateText(formatIsoToDisplay(startDate));
  }, [startDate]);

  useEffect(() => {
    setEndDateText(formatIsoToDisplay(endDate));
  }, [endDate]);

  // Close search dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        (desktopSearchContainerRef.current && desktopSearchContainerRef.current.contains(target)) ||
        (mobileSearchContainerRef.current && mobileSearchContainerRef.current.contains(target))
      ) {
        return;
      }
      setIsDropdownOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Lock background viewport scrolling when any statement modal is active
  useEffect(() => {
    const isAnyModalOpen = Boolean(isPeriodPickerOpen || isMultiMatchModalOpen);
    if (isAnyModalOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isPeriodPickerOpen, isMultiMatchModalOpen]);

  // Debounced search for account autocomplete with race-condition cancellation and memoization
  useEffect(() => {
    if (isSelectingRef.current) return;
    const q = searchQuery.trim();
    if (!q || q.length < 2) {
      setSearchResults([]);
      setIsDropdownOpen(false);
      return;
    }

    // Fast-path: Instant retrieval from client memory cache (<1ms)
    const normalizedKey = q.toLowerCase();
    if (searchCacheRef.current.has(normalizedKey)) {
      const cached = searchCacheRef.current.get(normalizedKey)!;
      const exactMatch = cached.find(
        (acc) => acc.accountNumber.trim().toUpperCase() === q.toUpperCase()
      );
      if (exactMatch && !isAccountConfirmed) {
        handleSelectAccount(exactMatch);
        setIsSearching(false);
        return;
      }
      setSearchResults(cached);
      setIsDropdownOpen(cached.length > 0);
      setIsSearching(false);
      return;
    }

    const currentSearchId = ++latestSearchIdRef.current;

    const timer = setTimeout(async () => {
      if (isSelectingRef.current) return;
      setIsSearching(true);
      try {
        const res = await searchPropertyBillAccounts({ searchQuery: q, pageSize: 6 });
        // Prevent race condition: discard stale response if a newer search was launched
        if (currentSearchId !== latestSearchIdRef.current || isSelectingRef.current) return;

        if (res.success && res.accounts) {
          searchCacheRef.current.set(normalizedKey, res.accounts);
          const exactMatch = res.accounts.find(
            (acc) => acc.accountNumber.trim().toUpperCase() === q.toUpperCase()
          );
          if (exactMatch && !isAccountConfirmed) {
            handleSelectAccount(exactMatch);
          } else {
            setSearchResults(res.accounts);
            setIsDropdownOpen(res.accounts.length > 0);
          }
        } else {
          setSearchResults([]);
          setIsDropdownOpen(false);
        }
      } catch (err) {
        if (currentSearchId === latestSearchIdRef.current) {
          console.error("Error searching accounts:", err);
        }
      } finally {
        if (currentSearchId === latestSearchIdRef.current) {
          setIsSearching(false);
        }
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery, isAccountConfirmed]);

  // Handle Loading Statement with In-Flight Lock & Fast-Path Memory Cache
  const fetchStatement = async (accNo: string, forceRefresh = false) => {
    const clean = accNo.trim();
    if (!clean) return;

    // Prevent duplicate in-flight requests for the same account
    if (inFlightAccountRef.current === clean && !forceRefresh) return;

    // Fast-Path: Serve from private client memory cache immediately (0ms latency)
    if (!forceRefresh && statementCacheRef.current.has(clean)) {
      const cached = statementCacheRef.current.get(clean)!;
      setStatementData(cached);
      setActiveAccountNo(clean);
      setIsSearchCollapsed(true);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("kkma_officer_statement_account", clean);
          document.cookie = `kkma_officer_statement_account=${encodeURIComponent(clean)}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
          const url = new URL(window.location.href);
          const currentUrlAcc = url.searchParams.get("account") || url.searchParams.get("accountNumber") || url.searchParams.get("accountNo");
          url.searchParams.set("account", clean);
          if (currentUrlAcc !== clean) {
            window.history.pushState({ account: clean, section: "STATEMENT" }, "", url.pathname + url.search);
          } else {
            window.history.replaceState({ account: clean, section: "STATEMENT" }, "", url.pathname + url.search);
          }
        } catch {
          // ignore
        }
      }
      setTimeout(() => {
        statementSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
      return;
    }

    inFlightAccountRef.current = clean;
    setIsLoadingStatement(true);
    setStatementError(null);
    try {
      const res = await getAccountBillHistoryDetail(clean);
      if (res.success) {
        statementCacheRef.current.set(clean, res);
        setStatementData(res);
        setActiveAccountNo(clean);
        setIsSearchCollapsed(true);
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("kkma_officer_statement_account", clean);
            document.cookie = `kkma_officer_statement_account=${encodeURIComponent(clean)}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
            const url = new URL(window.location.href);
            const currentUrlAcc = url.searchParams.get("account") || url.searchParams.get("accountNumber") || url.searchParams.get("accountNo");
            url.searchParams.set("account", clean);
            if (currentUrlAcc !== clean) {
              window.history.pushState({ account: clean, section: "STATEMENT" }, "", url.pathname + url.search);
            } else {
              window.history.replaceState({ account: clean, section: "STATEMENT" }, "", url.pathname + url.search);
            }
          } catch {
            // ignore
          }
        }
        setTimeout(() => {
          statementSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 60);
      } else {
        setStatementError(res.error || "Failed to retrieve account records.");
        setStatementData(null);
        setIsSearchCollapsed(false);
      }
    } catch (err: any) {
      console.error("Statement fetch error:", err);
      setStatementError(err.message || "An unexpected error occurred while loading the statement.");
      setStatementData(null);
      setIsSearchCollapsed(false);
    } finally {
      inFlightAccountRef.current = null;
      setIsLoadingStatement(false);
    }
  };

  const handleClearAccount = () => {
    setStatementData(null);
    setAccountNumberInput("");
    setSearchQuery("");
    setIsAccountConfirmed(false);
    setAccountSearchMessage(null);
    setIsMultiMatchModalOpen(false);
    setActiveAccountNo(null);
    setStartDate("");
    setEndDate("");
    setStartDateText("");
    setEndDateText("");
    setIsSearchCollapsed(false);
    setIsBiodataExpanded(false);
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("kkma_officer_statement_account");
        document.cookie = "kkma_officer_statement_account=; path=/; max-age=0; SameSite=Lax";
        localStorage.removeItem("kkma_officer_statement_start");
        localStorage.removeItem("kkma_officer_statement_end");
        const url = new URL(window.location.href);
        url.searchParams.delete("account");
        url.searchParams.delete("accountNumber");
        url.searchParams.delete("accountNo");
        url.searchParams.delete("start");
        url.searchParams.delete("end");
        window.history.replaceState({ account: null, section: activeSection }, "", url.pathname + (url.search || ""));
      } catch {
        // ignore
      }
    }
  };

  // Restore saved account and dates on initial mount / refresh
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const params = new URLSearchParams(window.location.search);
        const urlAcc = params.get("account") || params.get("accountNumber") || params.get("accountNo");
        const urlStart = params.get("start");
        const urlEnd = params.get("end");

        const savedAcc = urlAcc || localStorage.getItem("kkma_officer_statement_account") || initialAccountNo;
        const savedStart = urlStart || localStorage.getItem("kkma_officer_statement_start");
        const savedEnd = urlEnd || localStorage.getItem("kkma_officer_statement_end");

        if (savedStart) setStartDate(savedStart);
        if (savedEnd) setEndDate(savedEnd);

        if (savedAcc && savedAcc.trim()) {
          const accToFetch = savedAcc.trim();
          setAccountNumberInput(accToFetch);
          setSearchQuery(accToFetch);
          setIsAccountConfirmed(true);
          if (activeSection === "STATEMENT") {
            fetchStatement(accToFetch);
          }
        }
      } catch {
        // ignore
      }
    }
  }, [initialAccountNo, activeSection]);

  // Hardware/Device & Browser Back/Forward navigation listener
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handlePopState = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const urlSec = params.get("section") || params.get("tab");
        const newSec: "STATEMENT" | "PAYMENTS" = (urlSec && urlSec.toLowerCase() === "payments") ? "PAYMENTS" : "STATEMENT";
        setActiveSection(newSec);

        const urlAcc = params.get("account") || params.get("accountNumber") || params.get("accountNo");
        const cleanAcc = (urlAcc || "").trim();

        if (cleanAcc) {
          if (cleanAcc !== inFlightAccountRef.current) {
            setAccountNumberInput(cleanAcc);
            setSearchQuery(cleanAcc);
            setIsAccountConfirmed(true);
            setIsSearchCollapsed(true);
            fetchStatement(cleanAcc, false);
          }
        } else {
          // Navigated back to empty search screen
          inFlightAccountRef.current = null;
          setActiveAccountNo(null);
          setStatementData(null);
          setAccountNumberInput("");
          setSearchQuery("");
          setIsAccountConfirmed(false);
          setIsSearchCollapsed(false);
          setIsBiodataExpanded(false);
          localStorage.removeItem("kkma_officer_statement_account");
          document.cookie = "kkma_officer_statement_account=; path=/; max-age=0; SameSite=Lax";
        }
      } catch {
        // ignore
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Synchronize date filters to localStorage and URL
  useEffect(() => {
    if (typeof window !== "undefined" && activeAccountNo) {
      try {
        const url = new URL(window.location.href);
        if (startDate) {
          localStorage.setItem("kkma_officer_statement_start", startDate);
          url.searchParams.set("start", startDate);
        } else {
          localStorage.removeItem("kkma_officer_statement_start");
          url.searchParams.delete("start");
        }
        if (endDate) {
          localStorage.setItem("kkma_officer_statement_end", endDate);
          url.searchParams.set("end", endDate);
        } else {
          localStorage.removeItem("kkma_officer_statement_end");
          url.searchParams.delete("end");
        }
        window.history.replaceState(null, "", url.pathname + url.search);
      } catch {
        // ignore
      }
    }
  }, [startDate, endDate, activeAccountNo]);

  // Ledger calculation with running balance
  const ledgerRows: StatementLedgerRow[] = useMemo(() => {
    if (!statementData || !statementData.success) return [];

    const startTs = startDate ? new Date(startDate).getTime() : 0;
    const endTs = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : Infinity;

    type RawEntry = {
      year: number | string;
      dateStr: string;
      timestamp: number;
      item: string;
      billedDebit: number;
      paidCredit: number;
      isPayment?: boolean;
      accountNo?: string;
      gcrNr?: string;
    };

    const entries: RawEntry[] = [];

    // Sort bills chronologically ascending by authoritative fiscal BillYear
    const sortedBills = [...(statementData.bills || [])].sort((a, b) => {
      return Number(a.billYear || 0) - Number(b.billYear || 0);
    });

    // Extract property's authoritative annual rate
    const propAnnualRate = Number(
      statementData.property?.current_bill > 0
        ? statementData.property.current_bill
        : statementData.property?.currentFee > 0
          ? statementData.property.currentFee
          : 0
    );

    // Extract initial pre-existing arrears (Balance Brought Forward)
    const earliestBill = sortedBills[0];
    const totalArrears = Number(
      statementData.property?.initial_arrears ??
      statementData.property?.arrears ??
      earliestBill?.balanceBF ??
      0
    );

    // In municipal billing, if the statement includes individual historical annual bill invoices
    // for prior recorded years, those prior years are already billed individually as ledger debits.
    // The true pre-existing arrears from before the earliest recorded bill is:
    const priorBillsCount = Math.max(0, sortedBills.length - 1);
    const priorBillsSum = priorBillsCount * (propAnnualRate > 0 ? propAnnualRate : (Number(earliestBill?.ratePA) || 0));
    const preExistingArrears = Math.max(0, Number((totalArrears - priorBillsSum).toFixed(2)));

    if (preExistingArrears > 0 && earliestBill) {
      const earliestYear = Number(earliestBill.billYear || 2023);
      const bfDate = new Date(earliestYear, 0, 1);

      entries.push({
        year: earliestYear,
        dateStr: formatDateSlash(bfDate),
        timestamp: bfDate.getTime(),
        item: "Balance Brought Forward (Arrears)",
        billedDebit: preExistingArrears,
        paidCredit: 0.0,
      });
    }

    // 1. Process Bills (Debits) - Anchored strictly to BillYear from master Bill data
    for (const b of sortedBills) {
      const invoiceYear = Number(b.billYear) || 2026;
      const bDate = new Date(invoiceYear, 0, 15);
      const ts = bDate.getTime();
      const rawDebit = Number(b.ratePA || 0);
      const debitAmt = rawDebit > 0 ? rawDebit : (propAnnualRate > 0 ? propAnnualRate : 0);

      entries.push({
        year: invoiceYear,
        dateStr: formatDateSlash(bDate),
        timestamp: ts,
        item: "Bill",
        billedDebit: debitAmt,
        paidCredit: 0.0,
      });
    }

    // 2. Process Payments (Credits)
    if (statementData.payments && statementData.payments.length > 0) {
      for (const p of statementData.payments) {
        const pDate = p.datePaid ? new Date(p.datePaid) : new Date();
        const ts = pDate.getTime();
        const creditAmt = Number(p.amtPaid || 0);

        entries.push({
          year: pDate.getFullYear(),
          dateStr: formatDateSlash(pDate),
          timestamp: ts,
          item: p.gcrNr ? `GCR ${p.gcrNr}` : (p.id ? `GCR ${p.id}` : "Payment"),
          billedDebit: 0.0,
          paidCredit: creditAmt,
          isPayment: true,
          accountNo: statementData.property?.account_no || activeAccountNo || p.accountNo || accountNumberInput,
          gcrNr: p.gcrNr ? String(p.gcrNr) : (p.id ? String(p.id) : undefined),
        });
      }
    }

    // Sort chronologically ascending to compute accurate progressive running balances
    entries.sort((a, b) => a.timestamp - b.timestamp);

    // Compute running balances with period-aware opening balance
    let priorBalance = 0;
    const inRangeEntries: RawEntry[] = [];

    for (const e of entries) {
      if (startTs > 0 && e.timestamp < startTs) {
        priorBalance = Number((priorBalance + e.billedDebit - e.paidCredit).toFixed(2));
      } else if (e.timestamp <= endTs) {
        inRangeEntries.push(e);
      }
    }

    const rowsWithBalance: StatementLedgerRow[] = [];
    let currentBalance = priorBalance;

    // If start date filter is active and there's a prior accumulated balance,
    // inject opening Balance Brought Forward for this requested view window
    if (startTs > 0 && priorBalance !== 0) {
      const sDateObj = new Date(startTs);
      rowsWithBalance.push({
        year: sDateObj.getFullYear(),
        dateStr: formatDateSlash(sDateObj),
        timestamp: startTs - 1,
        item: "Balance Brought Forward",
        billedDebit: priorBalance > 0 ? priorBalance : 0,
        paidCredit: priorBalance < 0 ? Math.abs(priorBalance) : 0,
        runningBalance: currentBalance,
      });
    }

    for (const e of inRangeEntries) {
      currentBalance = Number((currentBalance + e.billedDebit - e.paidCredit).toFixed(2));
      rowsWithBalance.push({
        ...e,
        runningBalance: currentBalance,
      });
    }

    return rowsWithBalance;
  }, [statementData, startDate, endDate]);

  // Group ledger rows by year for table rowSpan and mobile grouped display
  const groupedByYear = useMemo(() => {
    const groups: { year: number | string; rows: StatementLedgerRow[] }[] = [];
    for (const row of ledgerRows) {
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && String(lastGroup.year) === String(row.year)) {
        lastGroup.rows.push(row);
      } else {
        groups.push({ year: row.year, rows: [row] });
      }
    }
    return groups;
  }, [ledgerRows]);

  const handleSelectAccount = (acc: PropertyBillAccountSummary) => {
    isSelectingRef.current = true;
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    setAccountNumberInput(acc.accountNumber);
    setSearchQuery(acc.accountNumber);
    setIsAccountConfirmed(true);
    setAccountSearchMessage(null);
    setSearchResults([]);
    setIsDropdownOpen(false);
    setIsMultiMatchModalOpen(false);
    setTimeout(() => {
      isSelectingRef.current = false;
    }, 400);
  };

  const handleAccountSearchEnter = async (e?: React.KeyboardEvent | React.FormEvent) => {
    if (e && "key" in e && e.key !== "Enter") return;
    if (e && "preventDefault" in e) e.preventDefault();

    const query = accountNumberInput.trim();
    if (!query) return;

    if (isAccountConfirmed) {
      handleViewStatementSubmit();
      return;
    }

    setIsSearching(true);
    setAccountSearchMessage(null);
    setIsDropdownOpen(false);

    try {
      const normalizedKey = query.toLowerCase();
      let accounts: PropertyBillAccountSummary[] = [];

      if (searchCacheRef.current.has(normalizedKey)) {
        accounts = searchCacheRef.current.get(normalizedKey)!;
      } else {
        const res = await searchPropertyBillAccounts({ searchQuery: query, pageSize: 30 });
        if (res.success && res.accounts) {
          accounts = res.accounts;
          searchCacheRef.current.set(normalizedKey, accounts);
        }
      }

      if (accounts.length === 0) {
        setAccountSearchMessage(`No property accounts found matching "${query}".`);
        setIsAccountConfirmed(false);
      } else {
        const exactMatch = accounts.find(
          (acc) => acc.accountNumber.trim().toUpperCase() === query.toUpperCase()
        );
        if (exactMatch) {
          handleSelectAccount(exactMatch);
        } else if (accounts.length === 1) {
          handleSelectAccount(accounts[0]);
        } else {
          setMultiMatchResults(accounts);
          setMultiMatchSearchTerm(query);
          setIsMultiMatchModalOpen(true);
        }
      }
    } catch (err) {
      console.error("Account search error:", err);
      setAccountSearchMessage("Error looking up accounts. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleViewStatementSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isAccountConfirmed) {
      handleAccountSearchEnter(e);
      return;
    }
    const cleanAccount = accountNumberInput.trim();
    if (!cleanAccount) return;
    setIsDropdownOpen(false);

    let activeStart = startDate;
    let activeEnd = endDate;

    if (!activeStart && startDateText.trim()) {
      const parsedStart = parseDateInput(startDateText.trim(), false);
      if (parsedStart) {
        activeStart = parsedStart;
        setStartDate(parsedStart);
      }
    }
    if (!activeEnd && endDateText.trim()) {
      const parsedEnd = parseDateInput(endDateText.trim(), true);
      if (parsedEnd) {
        activeEnd = parsedEnd;
        setEndDate(parsedEnd);
      }
    }

    // Sequential ordered flow: if dates are empty, pop open the dates modal!
    if (!activeStart || !activeEnd) {
      openPeriodModal();
      return;
    }

    fetchStatement(cleanAccount);
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    statementCacheRef.current.clear();
    searchCacheRef.current.clear();
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("kkma_officer_statement_account");
        localStorage.removeItem("heinz_admin_session_expiry");
        document.cookie = "kkma_officer_statement_account=; path=/; max-age=0; SameSite=Lax";
        document.cookie = "admin_session_expires_at=; path=/; max-age=0; SameSite=Lax";
        localStorage.removeItem("kkma_officer_statement_start");
        localStorage.removeItem("kkma_officer_statement_end");
      }
      await Promise.all([
        adminLogout(),
        new Promise((resolve) => setTimeout(resolve, 850)),
      ]);
    } finally {
      window.location.href = "/login";
    }
  };


  const handleSelectStartYear = (yr: number, idx: number) => {
    setTempStartYear(yr);
    setTempStartDate(`${yr}-01-01`);
    if (tempEndYear && tempEndYear < yr) {
      setTempEndYear(null);
      setTempEndDate("");
      setHasInteractedWithEndReel(false);
    }
    startReelRef.current?.scrollTo({ top: idx * 44, behavior: "smooth" });
    setActiveYearTarget("end");
  };

  const handleSelectEndYear = (yr: number, idx: number) => {
    if (tempStartYear && yr < tempStartYear) return;
    setHasInteractedWithEndReel(true);
    setTempEndYear(yr);
    setTempEndDate(`${yr}-12-31`);
    if (!tempStartYear) {
      setTempStartYear(yr);
      setTempStartDate(`${yr}-01-01`);
    }
    endReelRef.current?.scrollTo({ top: idx * 44, behavior: "smooth" });
  };

  const handleStartScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    const idx = Math.round(scrollTop / 44);
    if (idx >= 0 && idx < AVAILABLE_YEARS.length) {
      const yr = AVAILABLE_YEARS[idx];
      if (yr !== tempStartYear) {
        setTempStartYear(yr);
        setTempStartDate(`${yr}-01-01`);
        if (tempEndYear && tempEndYear < yr) {
          setTempEndYear(null);
          setTempEndDate("");
          setHasInteractedWithEndReel(false);
        }
      }
    }
  };

  const handleEndScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!hasInteractedWithEndReel) return;
    const scrollTop = e.currentTarget.scrollTop;
    const idx = Math.round(scrollTop / 44);
    if (idx >= 0 && idx < AVAILABLE_YEARS.length) {
      const yr = AVAILABLE_YEARS[idx];
      if (tempStartYear && yr < tempStartYear) return;
      if (yr !== tempEndYear) {
        setTempEndYear(yr);
        setTempEndDate(`${yr}-12-31`);
      }
    }
  };

  const openPeriodModal = () => {
    const sYr = startDate ? parseInt(startDate.slice(0, 4), 10) : null;
    const eYr = endDate ? parseInt(endDate.slice(0, 4), 10) : null;
    setTempStartYear(sYr);
    setTempEndYear(eYr);
    setTempStartDate(startDate);
    setTempEndDate(endDate);
    setActiveYearTarget(sYr ? "end" : "start");
    setHasInteractedWithEndReel(Boolean(eYr));
    setIsPeriodPickerOpen(true);

    setTimeout(() => {
      if (sYr) {
        const sIdx = AVAILABLE_YEARS.indexOf(sYr);
        if (sIdx !== -1 && startReelRef.current) {
          startReelRef.current.scrollTop = sIdx * 44;
        }
      } else if (startReelRef.current) {
        startReelRef.current.scrollTop = 0;
      }
      if (eYr) {
        const eIdx = AVAILABLE_YEARS.indexOf(eYr);
        if (eIdx !== -1 && endReelRef.current) {
          endReelRef.current.scrollTop = eIdx * 44;
        }
      } else if (endReelRef.current) {
        endReelRef.current.scrollTop = 0;
      }
    }, 60);
  };

  const commitPeriodSelection = () => {
    let finalStart = tempStartDate;
    let finalEnd = tempEndDate;

    if (!finalStart && tempStartYear) {
      finalStart = `${tempStartYear}-01-01`;
    }
    if (!finalEnd && tempEndYear) {
      finalEnd = `${tempEndYear}-12-31`;
    } else if (finalStart && !finalEnd && tempStartYear) {
      finalEnd = `${tempStartYear}-12-31`;
    }

    setStartDate(finalStart);
    setEndDate(finalEnd);
    setStartDateText(formatIsoToDisplay(finalStart));
    setEndDateText(formatIsoToDisplay(finalEnd));
    setIsPeriodPickerOpen(false);

    // If account number is present and dates have been selected, seamlessly load the statement
    const cleanAccount = accountNumberInput.trim();
    if (cleanAccount && finalStart && isAccountConfirmed) {
      fetchStatement(cleanAccount);
    }
  };

  if (isLoadingStatement && activeSection === "STATEMENT") {
    return (
      <div className={`w-full flex-1 min-h-0 ${hideHeader ? "h-full bg-transparent" : "h-[100dvh] max-h-[100dvh] bg-[#F5F5F7]"} text-[#1D1D1F] flex flex-col font-sans antialiased overflow-hidden`}>
        {/* Dedicated Apple-Style Fullscreen Signing Out Experience */}
        <AnimatePresence>
          {isSigningOut && (
            <SigningOutScreen userName={initialAdmin?.name || initialAdmin?.username} />
          )}
        </AnimatePresence>

        {!hideHeader && (
          <header className="relative w-full flex items-center justify-between gap-4 no-print border-b border-[#E8E8ED] px-4 sm:px-6 lg:px-8 py-2.5 sm:py-3 shrink-0 bg-white min-h-[44px]">
            <div className="flex items-center gap-2.5 shrink-0 z-10">
              <div className="w-7 h-7 rounded-lg bg-[#007AFF] flex items-center justify-center text-white shadow-xs shrink-0 font-bold text-xs">
                H
              </div>
              <h1 className="text-[16px] font-bold text-[#1D1D1F] tracking-tight leading-snug select-none">
                HEINZ Ltd.
              </h1>
            </div>

            {/* Officer Navigation Tabs (Centered on desktop, hidden on mobile) */}
            <nav className="hidden sm:flex absolute left-1/2 -translate-x-1/2 items-center gap-1 sm:gap-2 z-10" aria-label="Officer Navigation">
              <button
                type="button"
                onClick={() => handleSectionChange("STATEMENT")}
                className="relative px-3 py-1.5 text-[13px] font-semibold text-[#007AFF] transition-colors cursor-pointer flex items-center gap-1.5 focus:outline-none"
              >
                <FileText className="w-4 h-4 shrink-0 text-[#007AFF]" />
                <span>Statements</span>
                <motion.div
                  layoutId="officerActiveNavUnderline"
                  className="absolute bottom-0 inset-x-1.5 h-[2px] bg-[#007AFF] rounded-full"
                  transition={{ type: "spring", stiffness: 450, damping: 35 }}
                />
              </button>
              <button
                type="button"
                onClick={() => handleSectionChange("PAYMENTS")}
                className="relative px-3 py-1.5 text-[13px] font-medium text-[#6E6E73] hover:text-[#1D1D1F] transition-colors cursor-pointer flex items-center gap-1.5 focus:outline-none"
              >
                <Receipt className="w-4 h-4 shrink-0 text-[#8E8E93]" />
                <span>Payments</span>
              </button>
            </nav>

            <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 z-10">
              <span className="hidden sm:inline text-xs font-medium text-[#6E6E73]">
                {initialAdmin?.name || initialAdmin?.username || "Officer"}
              </span>
              <SessionTimer initialMinutes={7} onExpire={handleSignOut} />
              <button
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-[#6E6E73] hover:text-[#FF3B30] transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{isSigningOut ? "Signing out..." : "Sign Out"}</span>
              </button>
            </div>
          </header>
        )}

        <StatementsViewSkeleton />

        {/* Apple-Style Mobile Bottom Navigation Bar in loading skeleton */}
        {!hideHeader && (
          <nav
            className="sm:hidden shrink-0 w-full z-40 bg-white/85 backdrop-blur-2xl border-t border-[#E5E5EA] shadow-[0_-1px_3px_rgba(0,0,0,0.03)] pb-[env(safe-area-inset-bottom,0px)] select-none no-print"
            aria-label="Officer Mobile Bottom Navigation"
          >
            <div className="h-[52px] flex items-center justify-around px-4 w-full">
              <button
                type="button"
                onClick={() => handleSectionChange("STATEMENT")}
                className="flex-1 flex flex-col items-center justify-center py-1 min-h-[48px] focus:outline-none cursor-pointer transition-all active:scale-95"
                role="tab"
                aria-selected={true}
                aria-label="Statements"
              >
                <FileText className="w-5 h-5 shrink-0 text-[#007AFF]" />
                <span className="text-[10px] tracking-tight mt-0.5 leading-none text-[#007AFF] font-semibold">
                  Statements
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSectionChange("PAYMENTS")}
                className="flex-1 flex flex-col items-center justify-center py-1 min-h-[48px] focus:outline-none cursor-pointer transition-all active:scale-95"
                role="tab"
                aria-selected={false}
                aria-label="Payments"
              >
                <Receipt className="w-5 h-5 shrink-0 text-[#8E8E93]" />
                <span className="text-[10px] tracking-tight mt-0.5 leading-none text-[#8E8E93] font-medium">
                  Payments
                </span>
              </button>
            </div>
          </nav>
        )}
      </div>
    );
  }

  return (
    <div className={`w-full flex-1 min-h-0 ${hideHeader ? "h-full bg-transparent" : "h-[100dvh] max-h-[100dvh] bg-[#F5F5F7]"} text-[#1D1D1F] flex flex-col font-sans antialiased overflow-hidden selection:bg-[#007AFF]/20 selection:text-[#007AFF]`}>
      {/* Dedicated Apple-Style Fullscreen Signing Out Experience */}
      <AnimatePresence>
        {isSigningOut && (
          <SigningOutScreen userName={initialAdmin?.name || initialAdmin?.username} />
        )}
      </AnimatePresence>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body, html {
            height: auto !important;
            overflow: visible !important;
            background-color: #ffffff !important;
          }
          .no-print {
            display: none !important;
          }
          .print-full-width {
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            overflow: visible !important;
            height: auto !important;
          }
        }
      `}</style>
      {/* Assembly Identity & Officer Top Bar (Locked / Flex-shrink: 0 - Matches Heinz Admin Standard) */}
      {!hideHeader && (
        <header className="relative w-full flex items-center justify-between gap-4 no-print border-b border-[#E8E8ED] px-4 sm:px-6 lg:px-8 py-2.5 shrink-0 bg-white min-h-[48px] z-40">
          {/* Brand Identity permanently anchored on the left (ZERO displacement) */}
          <div className="flex items-center gap-2.5 shrink-0 z-10">
            <div className="w-7 h-7 rounded-lg bg-[#007AFF] flex items-center justify-center text-white shadow-xs shrink-0 font-bold text-xs">
              H
            </div>
            <h1 className="text-[16px] font-bold text-[#1D1D1F] tracking-tight leading-snug select-none">
              HEINZ Ltd.
            </h1>
          </div>

          {/* Officer Navigation Tabs (Centered on desktop, hidden on mobile) */}
          <nav className="hidden sm:flex absolute left-1/2 -translate-x-1/2 items-center gap-1 sm:gap-2 z-10" aria-label="Officer Navigation">
            <button
              type="button"
              onClick={() => handleSectionChange("STATEMENT")}
              className={`relative px-3 py-1.5 text-[13px] font-medium transition-colors cursor-pointer flex items-center gap-1.5 focus:outline-none ${
                activeSection === "STATEMENT"
                  ? "text-[#007AFF] font-semibold"
                  : "text-[#6E6E73] hover:text-[#1D1D1F]"
              }`}
            >
              <FileText className={`w-4 h-4 shrink-0 ${activeSection === "STATEMENT" ? "text-[#007AFF]" : "text-[#8E8E93]"}`} />
              <span>Statements</span>
              {activeSection === "STATEMENT" && (
                <motion.div
                  layoutId="officerActiveNavUnderline"
                  className="absolute bottom-0 inset-x-1.5 h-[2px] bg-[#007AFF] rounded-full"
                  transition={{ type: "spring", stiffness: 450, damping: 35 }}
                />
              )}
            </button>
            <button
              type="button"
              onClick={() => handleSectionChange("PAYMENTS")}
              className={`relative px-3 py-1.5 text-[13px] font-medium transition-colors cursor-pointer flex items-center gap-1.5 focus:outline-none ${
                activeSection === "PAYMENTS"
                  ? "text-[#007AFF] font-semibold"
                  : "text-[#6E6E73] hover:text-[#1D1D1F]"
              }`}
            >
              <Receipt className={`w-4 h-4 shrink-0 ${activeSection === "PAYMENTS" ? "text-[#007AFF]" : "text-[#8E8E93]"}`} />
              <span>Payments</span>
              {activeSection === "PAYMENTS" && (
                <motion.div
                  layoutId="officerActiveNavUnderline"
                  className="absolute bottom-0 inset-x-1.5 h-[2px] bg-[#007AFF] rounded-full"
                  transition={{ type: "spring", stiffness: 450, damping: 35 }}
                />
              )}
            </button>
          </nav>

          {/* Right Action: Officer Profile Identity, Session Timer & Sign Out */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 z-10">
            <span className="hidden sm:inline text-xs font-medium text-[#6E6E73]">
              {initialAdmin?.name || initialAdmin?.username || "Officer"}
            </span>
            <SessionTimer initialMinutes={7} onExpire={handleSignOut} />
            <button
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-[#6E6E73] hover:text-[#FF3B30] transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{isSigningOut ? "Signing out..." : "Sign Out"}</span>
            </button>
          </div>
        </header>
      )}

      {/* Main Container - Viewport Constrained */}
      <main
        className={`flex-1 min-h-0 w-full flex flex-col overflow-hidden relative ${
          activeSection === "STATEMENT"
            ? "px-0 sm:px-6 lg:px-8 py-0 sm:py-3 gap-0 sm:gap-3 pb-0"
            : ""
        }`}
      >

        {/* SECTION 1: ACCOUNT STATEMENT */}
        {activeSection === "STATEMENT" && (
          <>
            {/* Animated Transition: Expanded Search Controls vs. Compact Sticky Summary Bar */}
            <AnimatePresence mode="wait" initial={false}>
              {isSearchCollapsed && statementData ? (
                /* COMPACT STICKY SUMMARY BAR (48px - 72px) */
                <motion.div
                  key="compact-summary"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="w-full shrink-0 no-print"
                >
                  <div className="w-full bg-white border-b sm:border border-[#E8E8ED] rounded-none sm:rounded-[10px] px-4 sm:px-3.5 py-2.5 flex items-center justify-between gap-3 shadow-none sm:shadow-xs">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-bold text-[#1D1D1F] tracking-tight truncate">
                          {statementData.property?.account_no || activeAccountNo || accountNumberInput}
                        </span>
                        {statementData.property?.name && (
                          <span className="text-[13px] font-semibold text-[#1D1D1F] truncate">
                            &bull; {statementData.property.name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[12px] font-medium text-[#007AFF]">
                        <Calendar className="w-3.5 h-3.5 shrink-0 text-[#007AFF]" />
                        <span className="truncate">
                          {startDate && endDate
                            ? `${formatIsoToDisplay(startDate)} → ${formatIsoToDisplay(endDate)}`
                            : startDate || endDate
                              ? formatIsoToDisplay(startDate || endDate)
                              : "All Records"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="sm:hidden flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-[#1D1D1F] bg-[#F5F5F7] hover:bg-[#E8E8ED] active:scale-95 transition-all cursor-pointer"
                        title="Print Statement"
                      >
                        <Printer className="w-3.5 h-3.5 text-[#6E6E73]" />
                        <span>Print</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsSearchCollapsed(false)}
                        className="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-[#007AFF] bg-[#007AFF]/10 hover:bg-[#007AFF]/20 active:scale-95 transition-all cursor-pointer flex items-center gap-1"
                      >
                        Change Search
                      </button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                /* EXPANDED SEARCH & FILTER CONTROLS */
                <motion.div
                  key="expanded-search-controls"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto", transitionEnd: { overflow: "visible" } }}
                  exit={{ opacity: 0, height: 0, overflow: "hidden" }}
                  transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                  className="shrink-0 no-print w-full relative z-30"
                >
                  <div className="w-full bg-white border-b sm:border border-[#E8E8ED] rounded-none sm:rounded-[10px] p-3.5 sm:p-4 shadow-none sm:shadow-xs">
                    {/* DESKTOP: Centered Form Block (1,056px inner controls block) */}
                    <div className="hidden lg:block w-full">
                      <div className="w-full max-w-[1056px] mx-auto flex flex-col gap-2.5">
                        {/* DESKTOP LOOKUP FORM */}
                        <section className="flex flex-col gap-2.5 shrink-0 no-print relative z-40 w-full">
                          {/* Line 1: Inputs Row */}
                          <form onSubmit={handleViewStatementSubmit} className="flex items-center gap-3.5 w-full" autoComplete="off">
                            {/* Col 1: Account number field (fluid flex-1, ~400px) */}
                            <div className="relative flex-1 min-w-0" ref={desktopSearchContainerRef}>
                              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8E8E93]">
                                {isSearching ? <AppleSpinner size="sm" /> : <Search className="w-4 h-4" />}
                              </div>
                              <input
                                ref={desktopInputRef}
                                type="text"
                                value={accountNumberInput}
                                onChange={(e) => {
                                  setAccountNumberInput(e.target.value);
                                  setSearchQuery(e.target.value);
                                  setIsAccountConfirmed(false);
                                  setAccountSearchMessage(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleAccountSearchEnter(e);
                                  }
                                }}
                                onFocus={() => {
                                  if (searchResults.length > 0) setIsDropdownOpen(true);
                                }}
                                onBlur={() => {
                                  blurTimeoutRef.current = setTimeout(() => {
                                    setIsDropdownOpen(false);
                                  }, 180);
                                }}
                                placeholder="Search account no, ratepayer name, or phone..."
                                className="w-full pl-10 pr-9 h-[44px] text-[14px] text-[#1D1D1F] bg-white border border-[#D2D2D7] rounded-[10px] shadow-[0px_1px_3px_0px_rgba(29,29,31,0.02)] focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 transition-all font-sans placeholder:text-[#8E8E93]"
                                autoComplete="off"
                                autoCorrect="off"
                                autoCapitalize="off"
                                spellCheck={false}
                                data-lpignore="true"
                                data-1p-ignore="true"
                                data-bwignore="true"
                                data-form-type="other"
                              />

                              {accountNumberInput.trim().length > 0 && !isSearching && (
                                <button
                                  type="button"
                                  onClick={() => handleClearAccountSearch(false)}
                                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#8E8E93] hover:text-[#1D1D1F] transition-colors cursor-pointer"
                                  title="Clear search"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}

                              {accountSearchMessage && (
                                <p className="text-[12px] text-[#FF3B30] font-medium mt-1 absolute -bottom-5 left-1 z-30">
                                  {accountSearchMessage}
                                </p>
                              )}

                              {/* Autocomplete Dropdown */}
                              <AnimatePresence>
                                {isDropdownOpen && searchResults.length > 0 && (
                                  <motion.div
                                    initial={{ opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -4 }}
                                    transition={{ duration: 0.15 }}
                                    className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#E8E8ED] rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-[#F5F5F7]"
                                  >
                                    <div className="px-3 py-1.5 bg-[#FAFAFC] text-[10px] font-semibold text-[#8E8E93] uppercase tracking-wider">
                                      Suggested Accounts ({searchResults.length})
                                    </div>
                                    <div className="max-h-56 overflow-y-auto">
                                      {searchResults.map((acc) => (
                                        <button
                                          key={acc.accountNumber}
                                          type="button"
                                          onMouseDown={(e) => {
                                            e.preventDefault();
                                            handleSelectAccount(acc);
                                          }}
                                          onClick={() => handleSelectAccount(acc)}
                                          className="w-full px-3 py-2 text-left hover:bg-[#F5F5F7] transition-colors flex items-center justify-between group cursor-pointer"
                                        >
                                          <div>
                                            <div className="text-[13px] font-medium text-[#1D1D1F] group-hover:text-[#007AFF] transition-colors">
                                              {acc.accountNumber}
                                            </div>
                                            <div className="text-[11px] text-[#6E6E73] truncate max-w-[260px]">
                                              {acc.name || "Unnamed Ratepayer"} &bull; {acc.electoralArea || "KKMA"}
                                            </div>
                                          </div>
                                          <div className="text-right shrink-0">
                                            <span className="text-[11px] font-mono font-medium text-[#1D1D1F]">
                                              {formatGhc(acc.outstandingAmount)}
                                            </span>
                                          </div>
                                        </button>
                                      ))}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>

                            {/* Col 2: Statement period field (fluid flex-[1.2], ~452px) */}
                            <div
                              onClick={openPeriodModal}
                              className="flex items-center gap-2 flex-[1.2] min-w-0 cursor-pointer group"
                              title="Click to select fiscal year range"
                            >
                              {/* Start Year Box */}
                              <div className="relative flex items-center flex-1 h-[44px] rounded-[10px] border bg-white border-[#D2D2D7] group-hover:border-[#007AFF] transition-all px-3">
                                <Calendar className="w-4 h-4 text-[#8E8E93] group-hover:text-[#007AFF] shrink-0 mr-2 transition-colors" />
                                <div className="flex flex-col min-w-0">
                                  <span className="text-[10px] font-semibold text-[#8E8E93] uppercase leading-none">START YEAR</span>
                                  <span className="text-[13px] font-semibold text-[#1D1D1F] truncate leading-tight mt-0.5">
                                    {startDate ? `${startDate.slice(0, 4)} (01-Jan)` : "All Records"}
                                  </span>
                                </div>
                              </div>

                              {/* Arrow Connector */}
                              <span className="text-[#8E8E93] text-[14px] select-none font-sans shrink-0">→</span>

                              {/* End Year Box */}
                              <div className="relative flex items-center flex-1 h-[44px] rounded-[10px] border bg-white border-[#D2D2D7] group-hover:border-[#007AFF] transition-all px-3">
                                <Calendar className="w-4 h-4 text-[#8E8E93] group-hover:text-[#007AFF] shrink-0 mr-2 transition-colors" />
                                <div className="flex flex-col min-w-0">
                                  <span className="text-[10px] font-semibold text-[#8E8E93] uppercase leading-none">END YEAR</span>
                                  <span className="text-[13px] font-semibold text-[#1D1D1F] truncate leading-tight mt-0.5">
                                    {endDate ? `${endDate.slice(0, 4)} (31-Dec)` : "All Records"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Col 3: View Statement Button (~156px) */}
                            <div className="shrink-0 w-[156px]">
                              <button
                                type="submit"
                                disabled={!isAccountConfirmed || isLoadingStatement}
                                className={`w-full h-[44px] rounded-[10px] text-[15px] font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 ${isAccountConfirmed && !isLoadingStatement
                                    ? "bg-[#007AFF] text-white hover:bg-[#0066D6] shadow-[0px_2px_8px_0px_rgba(0,122,255,0.35)] active:scale-[0.98] ring-1 ring-[#007AFF]/20 cursor-pointer"
                                    : "bg-[#E8E8ED] border border-[#D2D2D7] text-[#8E8E93] cursor-not-allowed shadow-none"
                                  }`}
                                title={!isAccountConfirmed ? "Select an account to view statement" : "View Statement"}
                              >
                                {isLoadingStatement ? (
                                  <>
                                    <AppleSpinner size="sm" />
                                    <span className="text-[13px]">Loading...</span>
                                  </>
                                ) : (
                                  <span>View Statement</span>
                                )}
                              </button>
                            </div>
                          </form>
                        </section>
                      </div>
                    </div>

                    {/* MOBILE: Responsive Controls Block */}
                    <div className="flex lg:hidden flex-col gap-2.5 shrink-0 no-print relative z-40 w-full">
                      {/* LOOKUP FORM: MOBILE */}
                      <section className="flex flex-col gap-3 shrink-0 no-print relative z-40 w-full">
                        {/* 1. FISCAL YEAR PICKER (Appears BEFORE search section on mobile) */}
                        <div className="w-full">
                          <div
                            onClick={openPeriodModal}
                            className="bg-[#FAFAFC] border border-[#E8E8ED] hover:border-[#007AFF] rounded-[10px] p-2.5 flex items-center justify-between gap-2 cursor-pointer transition-all"
                            title="Click to select fiscal year range"
                          >
                            {/* Start Year */}
                            <div className="flex-1 flex flex-col gap-0.5">
                              <span className="text-[10px] font-medium text-[#8E8E93]">START YEAR</span>
                              <div className="relative flex items-center h-[38px] rounded-[8px] border px-2.5 bg-white border-[#D2D2D7]">
                                <Calendar className="w-3.5 h-3.5 text-[#8E8E93] shrink-0 mr-1.5" />
                                <span className="text-[13px] font-semibold text-[#1D1D1F] truncate select-none">
                                  {startDate ? `${startDate.slice(0, 4)} (01-Jan)` : "All Records"}
                                </span>
                              </div>
                            </div>

                            <span className="text-[#8E8E93] text-[13px] pt-3 select-none">→</span>

                            {/* End Year */}
                            <div className="flex-1 flex flex-col gap-0.5">
                              <span className="text-[10px] font-medium text-[#8E8E93]">END YEAR</span>
                              <div className="relative flex items-center h-[38px] rounded-[8px] border px-2.5 bg-white border-[#D2D2D7]">
                                <Calendar className="w-3.5 h-3.5 text-[#8E8E93] shrink-0 mr-1.5" />
                                <span className="text-[13px] font-semibold text-[#1D1D1F] truncate select-none">
                                  {endDate ? `${endDate.slice(0, 4)} (31-Dec)` : "All Records"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* 2. SEARCH SECTION */}
                        <div className="flex flex-col gap-1 w-full">
                          <label className="text-[12px] font-semibold text-[#1D1D1F]">Account number</label>
                          <div ref={mobileSearchContainerRef} className="relative w-full z-50">
                            <input
                              ref={mobileInputRef}
                              type="text"
                              value={accountNumberInput}
                              onChange={(e) => {
                                setAccountNumberInput(e.target.value);
                                setSearchQuery(e.target.value);
                                setIsAccountConfirmed(false);
                                setAccountSearchMessage(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleAccountSearchEnter(e);
                                }
                              }}
                              onFocus={() => {
                                if (searchResults.length > 0) setIsDropdownOpen(true);
                              }}
                              onBlur={() => {
                                blurTimeoutRef.current = setTimeout(() => {
                                  setIsDropdownOpen(false);
                                }, 180);
                              }}
                              placeholder="Search account no, ratepayer name, or phone..."
                              className="w-full pl-3 pr-9 h-[44px] text-[14px] text-[#1D1D1F] bg-white border border-[#D2D2D7] rounded-[10px] shadow-[0px_1px_2px_0px_rgba(29,29,31,0.02)] focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 transition-all font-sans placeholder:text-[#8E8E93]"
                              autoComplete="off"
                              autoCorrect="off"
                              autoCapitalize="off"
                              spellCheck={false}
                              data-lpignore="true"
                              data-1p-ignore="true"
                              data-bwignore="true"
                              data-form-type="other"
                            />
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#8E8E93]">
                              {isSearching ? (
                                <AppleSpinner size="sm" />
                              ) : accountNumberInput.trim().length > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => handleClearAccountSearch(true)}
                                  className="p-1 hover:text-[#1D1D1F] transition-colors cursor-pointer"
                                  title="Clear search"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              ) : (
                                <Search className="w-3.5 h-3.5 pointer-events-none" />
                              )}
                            </div>

                            {accountSearchMessage && (
                              <p className="text-[12px] text-[#FF3B30] font-medium mt-1">{accountSearchMessage}</p>
                            )}

                            {/* Autocomplete Dropdown */}
                            <AnimatePresence>
                              {isDropdownOpen && searchResults.length > 0 && (
                                <motion.div
                                  initial={{ opacity: 0, y: -4 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -4 }}
                                  transition={{ duration: 0.15 }}
                                  className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#E8E8ED] rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-[#F5F5F7]"
                                >
                                  <div className="px-3 py-1.5 bg-[#FAFAFC] text-[10px] font-semibold text-[#8E8E93] uppercase tracking-wider">
                                    Suggested Accounts ({searchResults.length})
                                  </div>
                                  <div className="max-h-52 overflow-y-auto">
                                    {searchResults.map((acc) => (
                                      <button
                                        key={acc.accountNumber}
                                        type="button"
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          handleSelectAccount(acc);
                                        }}
                                        onClick={() => handleSelectAccount(acc)}
                                        className="w-full px-3 py-2 text-left hover:bg-[#F5F5F7] transition-colors flex items-center justify-between group cursor-pointer"
                                      >
                                        <div>
                                          <div className="text-[13px] font-medium text-[#1D1D1F] group-hover:text-[#007AFF] transition-colors">
                                            {acc.accountNumber}
                                          </div>
                                          <div className="text-[11px] text-[#6E6E73] truncate max-w-[260px]">
                                            {acc.name || "Unnamed Ratepayer"} &bull; {acc.electoralArea || "KKMA"}
                                          </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                          <span className="text-[11px] font-mono font-medium text-[#1D1D1F]">
                                            {formatGhc(acc.outstandingAmount)}
                                          </span>
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>

                        {/* 3. VIEW STATEMENT ACTION */}
                        <button
                          type="button"
                          onClick={() => handleViewStatementSubmit()}
                          disabled={!isAccountConfirmed || isLoadingStatement}
                          className={`w-full h-[46px] rounded-[10px] text-[15px] font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${isAccountConfirmed && !isLoadingStatement
                              ? "bg-[#007AFF] text-white hover:bg-[#0066D6] shadow-[0px_2px_8px_0px_rgba(0,122,255,0.35)] active:scale-[0.98] ring-1 ring-[#007AFF]/20 cursor-pointer"
                              : "bg-[#E8E8ED] border border-[#D2D2D7] text-[#8E8E93] cursor-not-allowed shadow-none"
                            }`}
                          title={!isAccountConfirmed ? "Select an account to view statement" : "View Statement"}
                        >
                          {isLoadingStatement ? (
                            <>
                              <AppleSpinner size="sm" />
                              <span>Loading Statement...</span>
                            </>
                          ) : (
                            <span>View Statement</span>
                          )}
                        </button>
                      </section>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error Feedback (Locked / flex-shrink: 0) */}
            {statementError && (
              <div className="w-full p-3 bg-[#FF3B30]/10 border border-[#FF3B30]/20 rounded-lg text-[#FF3B30] text-[13px] flex items-center justify-between no-print shrink-0">
                <span>{statementError}</span>
                <button onClick={() => setStatementError(null)} className="p-1 hover:bg-[#FF3B30]/10 rounded cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* =========================================================================
           STATEMENT CONTAINER: FIXED VIEWPORT ARCHITECTURE
           flex-1 min-h-0 + sticky headers + scrollable internal ledger
           ========================================================================= */}
            {!statementData ? (
              /* STATE 1: EMPTY INITIAL PREVIEW (Figma Node 112:41) */
              <section className="bg-white border border-[#E8E8ED] rounded-[10px] sm:rounded-[12px] shadow-[0px_1px_3px_0px_rgba(29,29,31,0.02)] p-8 sm:p-14 flex flex-col items-center justify-center text-center gap-3.5 w-full mt-3.5 sm:mt-0">
                <div className="w-13 h-13 rounded-2xl bg-[#F5F5F7] flex items-center justify-center text-[#8E8E93]">
                  <FileText className="w-7 h-7 text-[#8E8E93]" />
                </div>
                <div className="flex flex-col gap-1.5 max-w-sm">
                  <h3 className="text-[18px] font-semibold text-[#1D1D1F]">
                    Your statement will appear here
                  </h3>
                  <p className="text-[15px] text-[#6E6E73]">
                    Enter an account number to view your statement.
                  </p>
                </div>
              </section>
            ) : (
              /* STATE 2: POPULATED STATEMENT - Sticky controls + internally scrollable ledger */
              <section
                ref={statementSectionRef}
                className="flex-1 min-h-0 bg-white border border-[#E8E8ED] rounded-[10px] sm:rounded-[12px] shadow-sm flex flex-col overflow-hidden print-full-width w-full mt-3.5 sm:mt-0"
              >
                {/* STATEMENT HEADER & BIODATA CARD (Visible on Desktop and Mobile) */}
                <div className="p-3.5 sm:p-4 border-b border-[#E8E8ED] flex flex-col gap-3 shrink-0 bg-white z-20">
                  {/* Heading & Actions Row */}
                  <div className="flex items-center justify-between gap-2.5">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                      {/* Single clean Back button directly beside Account Statement title */}
                      <button
                        type="button"
                        onClick={handleClearAccount}
                        className="flex items-center gap-1 text-[13px] sm:text-[14px] font-semibold text-[#007AFF] hover:text-[#0051A8] active:opacity-60 transition-all cursor-pointer py-1 pr-2 mr-0.5 rounded-lg hover:bg-[#007AFF]/8"
                        title="Back"
                      >
                        <ChevronLeft className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2.5]" />
                        <span>Back</span>
                      </button>

                      <div className="flex flex-wrap items-baseline gap-2">
                        <h2 className="text-[17px] sm:text-[20px] font-semibold text-[#1D1D1F] tracking-tight">
                          Account statement
                        </h2>
                        <span className="font-mono text-[13px] sm:text-[15px] font-bold text-[#007AFF]">
                          {statementData.property?.account_no || activeAccountNo || accountNumberInput}
                        </span>
                      </div>
                    </div>

                    {/* Print Action only (duplicate back button removed!) */}
                    <div className="flex items-center gap-2 no-print shrink-0">
                      <button
                        onClick={() => window.print()}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F5F5F7] hover:bg-[#E8E8ED] text-[#1D1D1F] text-[12px] font-medium rounded-lg transition-colors shadow-xs cursor-pointer active:scale-95"
                      >
                        <Printer className="w-3.5 h-3.5 text-[#6E6E73]" />
                        <span className="hidden sm:inline">Print Statement</span>
                      </button>
                    </div>

                  </div>

                  {/* TABULAR METADATA ROW WITH COLLAPSIBLE BIODATA & ARROW TOGGLE */}
                  <div className="border border-[#E8E8ED] rounded-lg bg-white overflow-hidden transition-all shadow-2xs">
                    {/* Primary Row: Mobile Single-Line View (<sm) vs Desktop 3-Column Tabular View (sm+) */}
                    <div
                      onClick={() => setIsBiodataExpanded(!isBiodataExpanded)}
                      className="px-3 py-2 sm:px-4 sm:py-2.5 flex items-center justify-between gap-2 sm:grid sm:grid-cols-12 sm:gap-4 cursor-pointer hover:bg-[#F9F9FB] active:bg-[#F2F2F5] transition-colors select-none"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setIsBiodataExpanded(!isBiodataExpanded);
                        }
                      }}
                      aria-expanded={isBiodataExpanded}
                      title={isBiodataExpanded ? "Click to collapse biodata" : "Click to view ratepayer biodata"}
                    >
                      {/* MOBILE: Account Number, Name and Address (<sm) */}
                      <div className="flex sm:hidden flex-col gap-0.5 min-w-0 flex-1 text-[12px]">
                        <div className="flex items-center gap-1.5 min-w-0 truncate">
                          <span className="font-semibold text-[#007AFF] font-mono text-[12px] shrink-0">
                            {statementData.property?.account_no || activeAccountNo || accountNumberInput}
                          </span>
                          <span className="text-[#8E8E93] shrink-0">&bull;</span>
                          <span className="font-semibold text-[#1D1D1F] truncate">
                            {statementData.property?.name || "—"}
                          </span>
                        </div>
                        {(statementData.property?.ownerDigitalAddress || statementData.property?.houseNo) && (
                          <span className="text-[#6E6E73] text-[11px] truncate">
                            {statementData.property?.ownerDigitalAddress || statementData.property?.houseNo}
                          </span>
                        )}
                      </div>

                      {/* DESKTOP: 3-column tabular view (sm+) */}
                      <div className="hidden sm:grid sm:grid-cols-11 sm:col-span-11 gap-4 min-w-0 flex-1">
                        {/* Col 1: Account number */}
                        <div className="sm:col-span-3 min-w-0">
                          <span className="text-[#8E8E93] text-[11px] block font-medium">Account number</span>
                          <span className="font-semibold text-[#007AFF] font-mono text-[13px] truncate block mt-0.5">
                            {statementData.property?.account_no || activeAccountNo}
                          </span>
                        </div>

                        {/* Col 2: Property owner */}
                        <div className="sm:col-span-4 min-w-0">
                          <span className="text-[#8E8E93] text-[11px] block font-medium">Property owner</span>
                          <span className="font-medium text-[#1D1D1F] text-[13px] truncate block mt-0.5">
                            {statementData.property?.name || "—"}
                          </span>
                        </div>

                        {/* Col 3: Property address */}
                        <div className="sm:col-span-4 min-w-0">
                          <span className="text-[#8E8E93] text-[11px] block font-medium">Property address</span>
                          <span className="text-[#1D1D1F] text-[13px] truncate block mt-0.5">
                            {statementData.property?.ownerDigitalAddress || statementData.property?.houseNo || "—"}
                          </span>
                        </div>
                      </div>

                      {/* Toggle Arrow Indicator */}
                      <div className="shrink-0 sm:col-span-1 flex items-center justify-end">
                        <div
                          className="p-1 rounded text-[#8E8E93] hover:text-[#1D1D1F] transition-colors"
                          aria-label={isBiodataExpanded ? "Collapse biodata" : "Expand biodata"}
                        >
                          {isBiodataExpanded ? (
                            <ChevronUp className="w-4 h-4 text-[#007AFF]" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-[#8E8E93]" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Collapsible Biodata Drawer / Details Row */}
                    <AnimatePresence initial={false}>
                      {isBiodataExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.18, ease: "easeInOut" }}
                          className="overflow-hidden border-t border-[#E8E8ED] bg-[#FAFAFC] px-3 sm:px-4 py-2.5 sm:py-3"
                        >
                          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-xs">
                            {/* Account Number */}
                            <div>
                              <span className="text-[#8E8E93] text-[11px] block font-medium">Account Number</span>
                              <span className="font-mono font-semibold text-[#007AFF] text-[12px] block mt-0.5 truncate">
                                {statementData.property?.account_no || activeAccountNo || accountNumberInput}
                              </span>
                            </div>
                            {/* Telephone */}
                            <div>
                              <span className="text-[#8E8E93] text-[11px] block font-medium">Telephone</span>
                              {statementData.property?.telephone ? (
                                <a
                                  href={`tel:${statementData.property.telephone}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 text-[#007AFF] hover:underline font-mono font-medium text-[12px] mt-0.5"
                                >
                                  <Phone className="w-3 h-3 text-[#007AFF] shrink-0" />
                                  <span>{statementData.property.telephone}</span>
                                </a>
                              ) : (
                                <span className="text-[#8E8E93] text-[12px] mt-0.5 block">—</span>
                              )}
                            </div>

                            {/* House & Electoral Area */}
                            <div>
                              <span className="text-[#8E8E93] text-[11px] block font-medium">House & Area</span>
                              <span className="text-[#1D1D1F] text-[12px] font-medium block truncate mt-0.5">
                                {statementData.property?.houseNo ? `House ${statementData.property.houseNo}` : "—"}
                                {statementData.property?.electoral_area ? ` • ${statementData.property.electoral_area}` : ""}
                              </span>
                            </div>

                            {/* Property Category */}
                            <div>
                              <span className="text-[#8E8E93] text-[11px] block font-medium">Property Class</span>
                              <span className="text-[#1D1D1F] text-[12px] font-medium block truncate mt-0.5">
                                {statementData.property?.property_cat || "Rateable Property"}
                              </span>
                            </div>

                            {/* Municipality */}
                            <div>
                              <span className="text-[#8E8E93] text-[11px] block font-medium">Municipality</span>
                              <span className="text-[#1D1D1F] text-[12px] font-medium block truncate mt-0.5">
                                {statementData.property?.municipality || "KKMA"}
                              </span>
                            </div>

                            {/* Rateable Value */}
                            <div>
                              <span className="text-[#8E8E93] text-[11px] block font-medium">Rateable Value</span>
                              <span className="font-mono font-semibold text-[12px] text-[#1D1D1F] block mt-0.5 tabular-nums">
                                {statementData.property?.rateableValue
                                  ? formatGhc(Number(statementData.property.rateableValue))
                                  : "—"}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* SECTION BAR: Bills and payments on left, {N} records on right */}
                <div className="px-3.5 sm:px-5 py-2 sm:py-2.5 bg-[#FAFAFC] border-b border-[#E8E8ED] flex items-center justify-between shrink-0">
                  <h4 className="text-[12px] sm:text-[13px] font-semibold text-[#6E6E73]">
                    Bills and payments
                  </h4>
                  <span className="text-[11px] sm:text-[12px] text-[#8E8E93]">
                    {ledgerRows.length} {ledgerRows.length === 1 ? "record" : "records"}
                  </span>
                </div>

                {/* =====================================================================
                SCROLLABLE TRANSACTION REGION (The ONLY scrollable container!)
                flex-1 min-h-0 overflow-y-auto overscroll-contain
                ===================================================================== */}
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain no-scrollbar">
                  {/* Transactions Ledger Table */}
                  <div className="w-full overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-full">
                      <thead className="sticky top-0 z-10 bg-[#FAFAFC] shadow-[0_1px_0_0_#E8E8ED]">
                        <tr>
                          <th className="py-2.5 sm:py-3 px-2.5 sm:px-5 text-[11px] sm:text-[13px] uppercase font-semibold text-[#8E8E93] sm:text-[#6E6E73] w-[65px] sm:w-[95px]">
                            Year
                          </th>
                          <th className="py-2.5 sm:py-3 px-2.5 sm:px-5 text-[11px] sm:text-[13px] uppercase font-semibold text-[#8E8E93] sm:text-[#6E6E73]">
                            Item
                          </th>
                          <th className="py-2.5 sm:py-3 px-2.5 sm:px-5 text-[11px] sm:text-[13px] uppercase font-semibold text-[#8E8E93] sm:text-[#6E6E73] text-right w-[70px] sm:w-[145px]">
                            CR
                          </th>
                          <th className="py-2.5 sm:py-3 px-2.5 sm:px-5 text-[11px] sm:text-[13px] uppercase font-semibold text-[#8E8E93] sm:text-[#6E6E73] text-right w-[70px] sm:w-[145px]">
                            DR
                          </th>
                          <th className="py-2.5 sm:py-3 px-2.5 sm:px-5 text-[11px] sm:text-[13px] uppercase font-semibold text-[#8E8E93] sm:text-[#6E6E73] text-right w-[80px] sm:w-[165px]">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E8E8ED]">
                        {ledgerRows.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-12 text-center text-[#8E8E93] text-[13px] sm:text-[15.5px]">
                              No bills or payments found within the selected statement period.
                            </td>
                          </tr>
                        ) : (
                          groupedByYear.map((group) =>
                            group.rows.map((row, rowIdx) => (
                              <tr key={`${group.year}-${rowIdx}`} className="hover:bg-[#F9F9FB] transition-colors">
                                {/* Year Cell Spans All Rows in That Billing Year */}
                                {rowIdx === 0 && (
                                  <td
                                    rowSpan={group.rows.length}
                                    className="py-2.5 sm:py-3.5 px-2.5 sm:px-5 text-[13px] sm:text-[15.5px] font-medium text-[#1D1D1F] align-top border-r border-[#E8E8ED]/60 bg-white"
                                  >
                                    {group.year}
                                  </td>
                                )}
                                <td className="py-2.5 sm:py-3.5 px-2.5 sm:px-5 text-[13px] sm:text-[15.5px] text-[#1D1D1F] font-medium">
                                  {row.isPayment ? (
                                    <button
                                      type="button"
                                      onClick={() => handleRedirectToPayments(row.accountNo || statementData?.property?.account_no || activeAccountNo || accountNumberInput)}
                                      className="inline-flex items-center gap-1.5 text-[#007AFF] hover:text-[#0051A8] hover:underline font-medium cursor-pointer transition-colors group text-left"
                                      title="View payment records for this account in Payments"
                                    >
                                      <span>{row.item}</span>
                                      {row.dateStr && (
                                        <span className="text-[11px] sm:text-[12px] text-[#8E8E93] font-normal">
                                          ({row.dateStr})
                                        </span>
                                      )}
                                      <ArrowUpRight className="w-3.5 h-3.5 text-[#007AFF] opacity-70 group-hover:opacity-100 transition-opacity shrink-0" />
                                    </button>
                                  ) : (
                                    row.item
                                  )}
                                </td>
                                <td className="py-2.5 sm:py-3.5 px-2.5 sm:px-5 text-[13px] sm:text-[15.5px] text-[#248A3D] text-right font-mono tabular-nums font-semibold">
                                  {row.paidCredit > 0 ? row.paidCredit.toFixed(2) : "0.00"}
                                </td>
                                <td className="py-2.5 sm:py-3.5 px-2.5 sm:px-5 text-[13px] sm:text-[15.5px] text-[#1D1D1F] text-right font-mono tabular-nums">
                                  {row.billedDebit > 0 ? row.billedDebit.toFixed(2) : "0.00"}
                                </td>
                                <td className="py-2.5 sm:py-3.5 px-2.5 sm:px-5 text-[13px] sm:text-[15.5px] text-[#1D1D1F] text-right font-mono tabular-nums font-semibold">
                                  {formatLedgerBalance(row.runningBalance)}
                                </td>
                              </tr>
                            ))
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}
          </>
        )}

        {/* SECTION 2: PAYMENTS (Integrated for Officer view - Matches Heinz Admin Standard) */}
        {activeSection === "PAYMENTS" && (
          <div className="flex-1 min-h-0 w-full overflow-hidden flex flex-col">
            <PaymentsSection
              currentAdmin={initialAdmin}
              initialAccountNo={paymentsNavAccount || undefined}
              onBackToStatement={
                paymentsNavAccount
                  ? () => {
                      setPaymentsNavAccount(null);
                      handleSectionChange("STATEMENT");
                    }
                  : undefined
              }
              onOpenStatement={(accNo) => {
                const clean = (accNo || "").trim();
                if (!clean) return;
                setAccountNumberInput(clean);
                setSearchQuery(clean);
                setActiveAccountNo(clean);
                setIsAccountConfirmed(true);
                if (typeof window !== "undefined") {
                  try {
                    localStorage.setItem("kkma_officer_statement_account", clean);
                    document.cookie = `kkma_officer_statement_account=${encodeURIComponent(clean)}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
                    localStorage.setItem("kkma_officer_active_section", "STATEMENT");
                    document.cookie = `kkma_officer_active_section=STATEMENT; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
                    const url = new URL(window.location.href);
                    url.searchParams.delete("section");
                    url.searchParams.set("account", clean);
                    window.history.pushState({ account: clean, section: "STATEMENT" }, "", url.pathname + url.search);
                  } catch {}
                }
                setActiveSection("STATEMENT");
                fetchStatement(clean, true);
              }}
              onSelectAccount={(accNo) => {
                if (accNo) {
                  setAccountNumberInput(accNo);
                  setActiveAccountNo(accNo);
                } else {
                  setActiveAccountNo(null);
                  setAccountNumberInput("");
                  setStatementData(null);
                  if (typeof window !== "undefined") {
                    try {
                      localStorage.removeItem("kkma_officer_statement_account");
                      document.cookie = "kkma_officer_statement_account=; path=/; max-age=0; SameSite=Lax";
                      const url = new URL(window.location.href);
                      url.searchParams.delete("account");
                      window.history.replaceState({ section: "PAYMENTS" }, "", url.pathname + (url.search || ""));
                    } catch {}
                  }
                }
              }}
            />
          </div>
        )}
      </main>

      {/* =========================================================================
         STATE 3: INTERACTIVE PERIOD SELECTOR MODAL / POPOVER (Figma Frame 83:118 & 90:2100)
         Enhanced with Solid Blue Active Presets and Direct Editable Inputs
         ========================================================================= */}
      <AnimatePresence>
        {isPeriodPickerOpen && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm pointer-events-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.18 }}
              className="w-full max-w-[500px] sm:max-w-[520px] bg-white border border-[#E8E8ED] rounded-[16px] shadow-[0px_8px_32px_0px_rgba(29,29,31,0.12)] overflow-hidden flex flex-col font-sans"
            >
              {/* Header */}
              <div className="p-4 border-b border-[#E8E8ED] flex items-center justify-between">
                <div>
                  <h3 className="text-[15px] font-semibold text-[#1D1D1F]">Statement period</h3>
                  <p className="text-[12px] text-[#6E6E73]">Filter bills by municipal fiscal years.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPeriodPickerOpen(false)}
                  className="p-1 rounded-lg text-[#8E8E93] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Start & End Year Range Cards (Grid cols 2 matching the columns below) */}
              <div className="p-3.5 border-b border-[#E8E8ED] bg-[#FAFAFC] grid grid-cols-2 gap-3 relative">
                {/* START YEAR */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveYearTarget("start");
                    if (tempStartYear) {
                      const idx = AVAILABLE_YEARS.indexOf(tempStartYear);
                      if (idx !== -1) startReelRef.current?.scrollTo({ top: idx * 44, behavior: "smooth" });
                    }
                  }}
                  className={`p-2.5 rounded-xl border text-center flex flex-col items-center justify-center transition-all cursor-pointer ${activeYearTarget === "start"
                      ? "bg-white border-[#007AFF] ring-2 ring-[#007AFF]/20 shadow-xs"
                      : "bg-white border-[#D2D2D7] hover:border-[#8E8E93]"
                    }`}
                >
                  <div className="text-[10px] font-semibold text-[#8E8E93] uppercase tracking-wider text-center">START YEAR</div>
                  <div className="text-[14px] font-bold text-[#1D1D1F] mt-0.5 truncate text-center w-full">
                    {tempStartYear ? `${tempStartYear} (01-Jan)` : "Select start"}
                  </div>
                </button>

                {/* Centered Connector */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-[#8E8E93] font-semibold text-xs select-none bg-[#FAFAFC] px-1">→</span>
                </div>

                {/* END YEAR */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveYearTarget("end");
                    if (tempEndYear) {
                      const idx = AVAILABLE_YEARS.indexOf(tempEndYear);
                      if (idx !== -1) endReelRef.current?.scrollTo({ top: idx * 44, behavior: "smooth" });
                    }
                  }}
                  className={`p-2.5 rounded-xl border text-center flex flex-col items-center justify-center transition-all cursor-pointer ${activeYearTarget === "end"
                      ? "bg-white border-[#007AFF] ring-2 ring-[#007AFF]/20 shadow-xs"
                      : "bg-white border-[#D2D2D7] hover:border-[#8E8E93]"
                    }`}
                >
                  <div className="text-[10px] font-semibold text-[#8E8E93] uppercase tracking-wider text-center">END YEAR</div>
                  <div className="text-[14px] font-bold text-[#1D1D1F] mt-0.5 truncate text-center w-full">
                    {tempEndYear ? `${tempEndYear} (31-Dec)` : "Select end"}
                  </div>
                </button>
              </div>

              {/* Body: Two Separate Vertical Slot Machine Drums */}
              <div className="p-4 bg-white grid grid-cols-2 gap-3.5">
                {/* LEFT COLUMN: START YEAR DRUM */}
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-bold text-[#1D1D1F] uppercase tracking-wider text-center">
                    START YEAR (01-JAN)
                  </span>
                  <div
                    onClick={() => setActiveYearTarget("start")}
                    className={`relative bg-[#FAFAFC] rounded-2xl border transition-all p-2 overflow-hidden shadow-inner ${
                      activeYearTarget === "start"
                        ? "border-[#007AFF]/50 ring-2 ring-[#007AFF]/15"
                        : "border-[#E8E8ED]"
                    }`}
                  >
                    {/* Dedicated Center Selection Lens for Start Year */}
                    <div className="absolute top-[96px] inset-x-2 h-[44px] rounded-xl bg-[#007AFF]/8 border-y border-[#007AFF]/30 pointer-events-none z-10 shadow-xs" />

                    {/* Top Vignette Fade Overlay */}
                    <div className="absolute top-0 inset-x-0 h-[80px] bg-gradient-to-b from-[#FAFAFC] via-[#FAFAFC]/85 to-transparent pointer-events-none z-20" />

                    {/* Bottom Vignette Fade Overlay */}
                    <div className="absolute bottom-0 inset-x-0 h-[80px] bg-gradient-to-t from-[#FAFAFC] via-[#FAFAFC]/85 to-transparent pointer-events-none z-20" />

                    {/* START YEAR REEL */}
                    <div
                      ref={startReelRef}
                      onScroll={handleStartScroll}
                      className="relative h-[220px] overflow-y-auto overscroll-contain snap-y snap-mandatory py-[88px] no-scrollbar select-none z-15"
                      style={{ scrollSnapType: "y mandatory" }}
                    >
                      {AVAILABLE_YEARS.map((yr, idx) => {
                        const isSelected = tempStartYear === yr;
                        return (
                          <div
                            key={`drum-start-${yr}`}
                            onClick={() => handleSelectStartYear(yr, idx)}
                            className={`h-[44px] flex items-center justify-center cursor-pointer transition-all duration-150 snap-center ${
                              isSelected
                                ? "text-[21px] font-bold text-[#007AFF] scale-110"
                                : "text-[16px] font-medium text-[#8E8E93] hover:text-[#1D1D1F]"
                            }`}
                            style={{ scrollSnapAlign: "center" }}
                          >
                            {yr}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN: END YEAR DRUM */}
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-bold text-[#1D1D1F] uppercase tracking-wider text-center">
                    END YEAR (31-DEC)
                  </span>
                  <div
                    onClick={() => setActiveYearTarget("end")}
                    className={`relative bg-[#FAFAFC] rounded-2xl border transition-all p-2 overflow-hidden shadow-inner ${
                      activeYearTarget === "end"
                        ? "border-[#007AFF]/50 ring-2 ring-[#007AFF]/15"
                        : "border-[#E8E8ED]"
                    }`}
                  >
                    {/* Dedicated Center Selection Lens for End Year */}
                    <div className="absolute top-[96px] inset-x-2 h-[44px] rounded-xl bg-[#007AFF]/8 border-y border-[#007AFF]/30 pointer-events-none z-10 shadow-xs" />

                    {/* Top Vignette Fade Overlay */}
                    <div className="absolute top-0 inset-x-0 h-[80px] bg-gradient-to-b from-[#FAFAFC] via-[#FAFAFC]/85 to-transparent pointer-events-none z-20" />

                    {/* Bottom Vignette Fade Overlay */}
                    <div className="absolute bottom-0 inset-x-0 h-[80px] bg-gradient-to-t from-[#FAFAFC] via-[#FAFAFC]/85 to-transparent pointer-events-none z-20" />

                    {/* END YEAR REEL */}
                    <div
                      ref={endReelRef}
                      onScroll={handleEndScroll}
                      onTouchStart={() => setHasInteractedWithEndReel(true)}
                      onMouseDown={() => setHasInteractedWithEndReel(true)}
                      onWheel={() => setHasInteractedWithEndReel(true)}
                      className="relative h-[220px] overflow-y-auto overscroll-contain snap-y snap-mandatory py-[88px] no-scrollbar select-none z-15"
                      style={{ scrollSnapType: "y mandatory" }}
                    >
                      {AVAILABLE_YEARS.map((yr, idx) => {
                        const isSelected = tempEndYear === yr;
                        const isBeforeStart = Boolean(tempStartYear && yr < tempStartYear);

                        return (
                          <div
                            key={`drum-end-${yr}`}
                            onClick={() => !isBeforeStart && handleSelectEndYear(yr, idx)}
                            className={`h-[44px] flex items-center justify-center transition-all duration-150 snap-center ${
                              isBeforeStart
                                ? "text-[15px] font-medium text-[#D2D2D7] cursor-not-allowed opacity-30"
                                : isSelected
                                  ? "text-[21px] font-bold text-[#007AFF] scale-110 cursor-pointer"
                                  : "text-[16px] font-medium text-[#8E8E93] hover:text-[#1D1D1F] cursor-pointer"
                            }`}
                            style={{ scrollSnapAlign: "center" }}
                          >
                            {yr}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="p-3 bg-[#FAFAFC] border-t border-[#E8E8ED] flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setTempStartYear(null);
                    setTempEndYear(null);
                    setTempStartDate("");
                    setTempEndDate("");
                    setActiveYearTarget("start");
                  }}
                  className="text-[12px] font-semibold text-[#007AFF] hover:underline cursor-pointer"
                >
                  All Years (No Limits)
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPeriodPickerOpen(false)}
                    className="px-3 py-1.5 text-[12px] font-medium text-[#6E6E73] hover:text-[#1D1D1F] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={commitPeriodSelection}
                    className="px-4 py-1.5 bg-[#007AFF] hover:bg-[#0066D6] text-white text-[12px] font-semibold rounded-lg shadow-xs transition-all cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Multiple Matching Accounts Disambiguation Modal */}
      <AnimatePresence>
        {isMultiMatchModalOpen && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMultiMatchModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-[#E8E8ED] overflow-hidden flex flex-col max-h-[85vh] z-10 font-sans"
            >
              {/* Header */}
              <div className="px-5 py-4 border-b border-[#E8E8ED] flex items-center justify-between bg-[#FAFAFC]">
                <div>
                  <h3 className="text-[16px] font-semibold text-[#1D1D1F]">
                    Select Property Account
                  </h3>
                  <p className="text-[12px] text-[#6E6E73] mt-0.5">
                    Found {multiMatchResults.length} accounts matching &ldquo;{multiMatchSearchTerm}&rdquo;
                  </p>
                </div>
                <button
                  onClick={() => setIsMultiMatchModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-[#E8E8ED] hover:bg-[#D2D2D7] text-[#6E6E73] hover:text-[#1D1D1F] flex items-center justify-center transition-colors cursor-pointer"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* List of Accounts */}
              <div className="flex-1 overflow-y-auto divide-y divide-[#F5F5F7] p-2">
                {multiMatchResults.map((acc) => (
                  <button
                    key={acc.accountNumber}
                    type="button"
                    onClick={() => handleSelectAccount(acc)}
                    className="w-full px-4 py-3 text-left rounded-xl hover:bg-[#F5F5F7] transition-all flex items-center justify-between gap-4 group cursor-pointer active:scale-[0.99]"
                  >
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-semibold font-mono text-[#1D1D1F] group-hover:text-[#007AFF] transition-colors">
                          {acc.accountNumber}
                        </span>
                        {acc.propertyCategory && (
                          <span className="text-[11px] text-[#8E8E93] uppercase font-sans">
                            &bull; {acc.propertyCategory}
                          </span>
                        )}
                      </div>
                      <div className="text-[13px] font-medium text-[#1D1D1F] truncate">
                        {acc.name || "Unnamed Ratepayer"}
                      </div>
                      <div className="text-[11px] text-[#6E6E73] flex items-center gap-2 truncate">
                        <span>{acc.electoralArea || "KKMA"}</span>
                        {acc.houseNo && <span>&bull; House: {acc.houseNo}</span>}
                        {acc.telephone && <span>&bull; Tel: {acc.telephone}</span>}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-[10px] font-semibold text-[#8E8E93] uppercase tracking-wider">
                        Outstanding
                      </div>
                      <div className="text-[13px] font-mono font-semibold text-[#1D1D1F]">
                        {formatGhc(acc.outstandingAmount)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-[#E8E8ED] bg-[#FAFAFC] flex items-center justify-between">
                <span className="text-[12px] text-[#8E8E93]">
                  Click an account to select and view statement
                </span>
                <button
                  type="button"
                  onClick={() => setIsMultiMatchModalOpen(false)}
                  className="px-4 py-1.5 rounded-lg text-[13px] font-medium text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#E8E8ED] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Apple-Style Mobile Bottom Navigation Bar (Authentic iOS UITabBar Standard) */}
      {!hideHeader && (
        <nav
          className="sm:hidden shrink-0 w-full z-40 bg-white/85 backdrop-blur-2xl border-t border-[#E5E5EA] shadow-[0_-1px_3px_rgba(0,0,0,0.03)] pb-[env(safe-area-inset-bottom,0px)] select-none no-print"
          aria-label="Officer Mobile Bottom Navigation"
        >
          <div className="h-[52px] flex items-center justify-around px-4 w-full">
            <button
              type="button"
              onClick={() => handleSectionChange("STATEMENT")}
              className="flex-1 flex flex-col items-center justify-center py-1 min-h-[48px] focus:outline-none cursor-pointer transition-all active:scale-95"
              role="tab"
              aria-selected={activeSection === "STATEMENT"}
              aria-label="Statements"
            >
              <FileText
                className={`w-5 h-5 shrink-0 transition-colors ${
                  activeSection === "STATEMENT" ? "text-[#007AFF]" : "text-[#8E8E93]"
                }`}
              />
              <span
                className={`text-[10px] tracking-tight mt-0.5 leading-none transition-colors ${
                  activeSection === "STATEMENT"
                    ? "text-[#007AFF] font-semibold"
                    : "text-[#8E8E93] font-medium"
                }`}
              >
                Statements
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleSectionChange("PAYMENTS")}
              className="flex-1 flex flex-col items-center justify-center py-1 min-h-[48px] focus:outline-none cursor-pointer transition-all active:scale-95"
              role="tab"
              aria-selected={activeSection === "PAYMENTS"}
              aria-label="Payments"
            >
              <Receipt
                className={`w-5 h-5 shrink-0 transition-colors ${
                  activeSection === "PAYMENTS" ? "text-[#007AFF]" : "text-[#8E8E93]"
                }`}
              />
              <span
                className={`text-[10px] tracking-tight mt-0.5 leading-none transition-colors ${
                  activeSection === "PAYMENTS"
                    ? "text-[#007AFF] font-semibold"
                    : "text-[#8E8E93] font-medium"
                }`}
              >
                Payments
              </span>
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
