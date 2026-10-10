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
  Phone,
  MapPin,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { AppleSpinner } from "@/components/ui/AppleSpinner";
import PaymentsSection from "@/components/PaymentsSection";
import {
  getAccountBillHistoryDetail,
  searchPropertyBillAccounts,
  adminLogout,
  PropertyBillAccountSummary,
  GetAccountBillHistoryDetailResponse,
} from "@/app/actions";
import { formatGhc, formatDateGb } from "@/lib/formatters";

interface OfficerStatementViewProps {
  initialAdmin?: {
    id: string;
    username: string;
    name: string;
    role: string;
  } | null;
  initialAccountNo?: string | null;
  initialSection?: "STATEMENT" | "PAYMENTS";
}

interface StatementLedgerRow {
  year: number | string;
  dateStr: string;
  timestamp: number;
  item: string;
  billedDebit: number;
  paidCredit: number;
  runningBalance: number;
}

const MONTH_NAMES_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

// Available fiscal years for dedicated filter tabs
const FISCAL_YEARS = [2026, 2025, 2024, 2023, 2022];

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
}: OfficerStatementViewProps) {
  // Synchronously resolve initial account on Frame 0
  const getInitialAccount = () => {
    if (initialAccountNo && initialAccountNo.trim()) return initialAccountNo.trim();
    if (typeof window !== "undefined") {
      try {
        const params = new URLSearchParams(window.location.search);
        const urlAcc = params.get("account") || params.get("accountNumber") || params.get("accountNo");
        const storedAcc = localStorage.getItem("kkma_officer_statement_account");
        return (urlAcc || storedAcc || "").trim();
      } catch {
        return "";
      }
    }
    return "";
  };

  const resolvedInitialAcc = getInitialAccount();

  // Input & search states
  const [accountNumberInput, setAccountNumberInput] = useState(resolvedInitialAcc);
  const [searchQuery, setSearchQuery] = useState(resolvedInitialAcc);
  const [searchResults, setSearchResults] = useState<PropertyBillAccountSummary[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

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

  // Modal temporary editable date states
  const [modalStartText, setModalStartText] = useState("");
  const [modalEndText, setModalEndText] = useState("");

  // Date range picker modal state
  const [isPeriodPickerOpen, setIsPeriodPickerOpen] = useState(false);
  const [pickerCalendarMonth, setPickerCalendarMonth] = useState<Date>(new Date(2026, 11, 1)); // Dec 2026
  const [tempStartDate, setTempStartDate] = useState("");
  const [tempEndDate, setTempEndDate] = useState("");
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isSearchCollapsed, setIsSearchCollapsed] = useState(false);
  const [isBiodataExpanded, setIsBiodataExpanded] = useState(false);

  const getInitialSection = (): "STATEMENT" | "PAYMENTS" => {
    if (initialSection) return initialSection;
    if (typeof window !== "undefined") {
      try {
        const params = new URLSearchParams(window.location.search);
        const urlSec = params.get("section") || params.get("tab");
        if (urlSec && urlSec.toLowerCase() === "payments") return "PAYMENTS";
        const stored = localStorage.getItem("kkma_officer_active_section");
        if (stored === "PAYMENTS") return "PAYMENTS";
      } catch {}
    }
    return "STATEMENT";
  };

  // Active top-level navigation section: 'STATEMENT' | 'PAYMENTS'
  const [activeSection, setActiveSection] = useState<"STATEMENT" | "PAYMENTS">(getInitialSection);

  const handleSectionChange = (newSec: "STATEMENT" | "PAYMENTS") => {
    setActiveSection(newSec);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("kkma_officer_active_section", newSec);
        document.cookie = `kkma_officer_active_section=${newSec}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
        const url = new URL(window.location.href);
        if (newSec === "PAYMENTS") {
          url.searchParams.set("section", "payments");
        } else {
          url.searchParams.delete("section");
        }
        window.history.replaceState(null, "", url.pathname + url.search);
      } catch {}
    }
  };

  const handleOpenStatementFromPayments = (accNo: string) => {
    handleSectionChange("STATEMENT");
    setAccountNumberInput(accNo);
    setSearchQuery(accNo);
    fetchStatement(accNo, false);
  };

  const desktopSearchContainerRef = useRef<HTMLDivElement>(null);
  const mobileSearchContainerRef = useRef<HTMLDivElement>(null);
  const statementSectionRef = useRef<HTMLElement>(null);
  const isSelectingRef = useRef(false);
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
          setSearchResults(res.accounts);
          setIsDropdownOpen(res.accounts.length > 0);
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
  }, [searchQuery]);

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
          const url = new URL(window.location.href);
          url.searchParams.set("account", clean);
          window.history.replaceState(null, "", url.pathname + url.search);
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
            const url = new URL(window.location.href);
            url.searchParams.set("account", clean);
            window.history.replaceState(null, "", url.pathname + url.search);
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
        localStorage.removeItem("kkma_officer_statement_start");
        localStorage.removeItem("kkma_officer_statement_end");
        const url = new URL(window.location.href);
        url.searchParams.delete("account");
        url.searchParams.delete("accountNumber");
        url.searchParams.delete("accountNo");
        url.searchParams.delete("start");
        url.searchParams.delete("end");
        window.history.replaceState(null, "", url.pathname + (url.search || ""));
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
          fetchStatement(accToFetch);
        }
      } catch {
        // ignore
      }
    }
  }, [initialAccountNo]);

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
    };

    const entries: RawEntry[] = [];

    // Sort bills chronologically ascending
    const sortedBills = [...(statementData.bills || [])].sort((a, b) => {
      const tA = a.billDate ? new Date(a.billDate).getTime() : Number(a.billYear || 0);
      const tB = b.billDate ? new Date(b.billDate).getTime() : Number(b.billYear || 0);
      return tA - tB;
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
      const earliestYear = earliestBill.billDate
        ? new Date(earliestBill.billDate).getFullYear()
        : Number(earliestBill.billYear || 2024);
      const bfDate = earliestBill.billDate
        ? new Date(new Date(earliestBill.billDate).getTime() - 86400000)
        : new Date(earliestYear, 0, 1);

      entries.push({
        year: earliestYear,
        dateStr: formatDateGb(bfDate),
        timestamp: bfDate.getTime(),
        item: "Balance Brought Forward (Arrears)",
        billedDebit: preExistingArrears,
        paidCredit: 0.0,
      });
    }

    // 1. Process Bills (Debits)
    for (const b of sortedBills) {
      const bDate = b.billDate ? new Date(b.billDate) : new Date(Number(b.billYear || 2026), 0, 15);
      const ts = bDate.getTime();
      const rawDebit = Number(b.ratePA || 0);
      const debitAmt = rawDebit > 0 ? rawDebit : (propAnnualRate > 0 ? propAnnualRate : 0);
      const invoiceYear = b.billDate ? bDate.getFullYear() : (Number(b.billYear) || 2026);

      entries.push({
        year: invoiceYear,
        dateStr: formatDateGb(bDate),
        timestamp: ts,
        item: "Bill Invoice",
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
          dateStr: formatDateGb(pDate),
          timestamp: ts,
          item: p.gcrNr ? `Payment · GCR ${p.gcrNr}` : "Payment",
          billedDebit: 0.0,
          paidCredit: creditAmt,
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
        dateStr: formatDateGb(sDateObj),
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
    setSearchResults([]);
    setIsDropdownOpen(false);
    setTimeout(() => {
      isSelectingRef.current = false;
    }, 400);
  };

  const handleViewStatementSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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
        localStorage.removeItem("kkma_officer_statement_start");
        localStorage.removeItem("kkma_officer_statement_end");
      }
      await adminLogout();
      window.location.href = "/login";
    } catch {
      window.location.href = "/login";
    }
  };

  // Dedicated Year Preset Filter Actions
  const applyFiscalYearFilter = (year: number) => {
    if (!accountNumberInput.trim()) return;
    const sIso = `${year}-01-01`;
    const eIso = `${year}-12-31`;
    setStartDate(sIso);
    setEndDate(eIso);
    setStartDateText(`01-Jan-${year}`);
    setEndDateText(`31-Dec-${year}`);
    setTempStartDate(sIso);
    setTempEndDate(eIso);
    setModalStartText(`01-Jan-${year}`);
    setModalEndText(`31-Dec-${year}`);
    setPickerCalendarMonth(new Date(year, 11, 1));
  };

  const applyMultiYearFilter = (startYr: number, endYr: number) => {
    if (!accountNumberInput.trim()) return;
    const sIso = `${startYr}-01-01`;
    const eIso = `${endYr}-12-31`;
    setStartDate(sIso);
    setEndDate(eIso);
    setStartDateText(`01-Jan-${startYr}`);
    setEndDateText(`31-Dec-${endYr}`);
    setTempStartDate(sIso);
    setTempEndDate(eIso);
    setModalStartText(`01-Jan-${startYr}`);
    setModalEndText(`31-Dec-${endYr}`);
    setPickerCalendarMonth(new Date(endYr, 11, 1));
  };

  const applyAllRecordsFilter = () => {
    if (!accountNumberInput.trim()) return;
    setStartDate("");
    setEndDate("");
    setStartDateText("");
    setEndDateText("");
    setTempStartDate("");
    setTempEndDate("");
    setModalStartText("");
    setModalEndText("");
  };

  // Handle typing inside Start Date Input
  const handleStartDateBlur = () => {
    const parsed = parseDateInput(startDateText, false);
    if (parsed) {
      setStartDate(parsed);
      setStartDateText(formatIsoToDisplay(parsed));
      setTempStartDate(parsed);
    } else {
      setStartDateText(formatIsoToDisplay(startDate));
    }
  };

  // Handle typing inside End Date Input
  const handleEndDateBlur = () => {
    const parsed = parseDateInput(endDateText, true);
    if (parsed) {
      setEndDate(parsed);
      setEndDateText(formatIsoToDisplay(parsed));
      setTempEndDate(parsed);
    } else {
      setEndDateText(formatIsoToDisplay(endDate));
    }
  };

  // Modal input typing handlers
  const handleModalStartBlur = () => {
    const parsed = parseDateInput(modalStartText, false);
    if (parsed) {
      setTempStartDate(parsed);
      setModalStartText(formatIsoToDisplay(parsed));
      const pDate = new Date(parsed);
      setPickerCalendarMonth(new Date(pDate.getFullYear(), pDate.getMonth(), 1));
    } else {
      setModalStartText(formatIsoToDisplay(tempStartDate));
    }
  };

  const handleModalEndBlur = () => {
    const parsed = parseDateInput(modalEndText, true);
    if (parsed) {
      setTempEndDate(parsed);
      setModalEndText(formatIsoToDisplay(parsed));
      const pDate = new Date(parsed);
      setPickerCalendarMonth(new Date(pDate.getFullYear(), pDate.getMonth(), 1));
    } else {
      setModalEndText(formatIsoToDisplay(tempEndDate));
    }
  };

  // Calendar logic for date picker
  const calendarYear = pickerCalendarMonth.getFullYear();
  const calendarMonthIdx = pickerCalendarMonth.getMonth();
  const monthName = pickerCalendarMonth.toLocaleString("en-US", { month: "long" });

  const daysInMonth = new Date(calendarYear, calendarMonthIdx + 1, 0).getDate();
  const firstDayOfWeek = new Date(calendarYear, calendarMonthIdx, 1).getDay();

  const prevMonth = () => {
    setPickerCalendarMonth(new Date(calendarYear, calendarMonthIdx - 1, 1));
  };

  const nextMonth = () => {
    setPickerCalendarMonth(new Date(calendarYear, calendarMonthIdx + 1, 1));
  };

  const handleSelectCalendarDay = (day: number) => {
    const selectedDateObj = new Date(calendarYear, calendarMonthIdx, day);
    const isoString = selectedDateObj.toISOString().slice(0, 10);

    if (!tempStartDate || (tempStartDate && tempEndDate)) {
      setTempStartDate(isoString);
      setTempEndDate("");
      setModalStartText(formatIsoToDisplay(isoString));
      setModalEndText("");
    } else {
      if (new Date(isoString).getTime() < new Date(tempStartDate).getTime()) {
        setTempEndDate(tempStartDate);
        setTempStartDate(isoString);
        setModalEndText(formatIsoToDisplay(tempStartDate));
        setModalStartText(formatIsoToDisplay(isoString));
      } else {
        setTempEndDate(isoString);
        setModalEndText(formatIsoToDisplay(isoString));
      }
    }
  };

  const commitPeriodSelection = () => {
    let finalStart = tempStartDate;
    let finalEnd = tempEndDate;

    if (!finalStart && modalStartText.trim()) {
      const parsed = parseDateInput(modalStartText.trim(), false);
      if (parsed) finalStart = parsed;
    }
    if (!finalEnd && modalEndText.trim()) {
      const parsed = parseDateInput(modalEndText.trim(), true);
      if (parsed) finalEnd = parsed;
    }

    if (finalStart) {
      setStartDate(finalStart);
      setStartDateText(formatIsoToDisplay(finalStart));
    }
    if (finalEnd) {
      setEndDate(finalEnd);
      setEndDateText(formatIsoToDisplay(finalEnd));
    } else if (finalStart) {
      setEndDate(finalStart);
      setEndDateText(formatIsoToDisplay(finalStart));
      finalEnd = finalStart;
    }

    setIsPeriodPickerOpen(false);

    // If account number is present and dates have been selected, seamlessly load the statement
    const cleanAccount = accountNumberInput.trim();
    if (cleanAccount && finalStart) {
      fetchStatement(cleanAccount);
    }
  };

  const openPeriodModal = () => {
    if (!accountNumberInput.trim()) return;
    setTempStartDate(startDate);
    setTempEndDate(endDate);
    setModalStartText(startDate ? formatIsoToDisplay(startDate) : "");
    setModalEndText(endDate ? formatIsoToDisplay(endDate) : "");
    const baseDate = endDate || startDate;
    const eDate = baseDate ? new Date(baseDate) : new Date(2026, 11, 1);
    setPickerCalendarMonth(new Date(eDate.getFullYear(), eDate.getMonth(), 1));
    setIsPeriodPickerOpen(true);
  };

  if (isLoadingStatement) {
    return (
      <div className="h-[100dvh] max-h-[100dvh] w-full bg-[#F5F5F7] text-[#1D1D1F] flex flex-col font-sans antialiased overflow-hidden">
        <header className="w-full flex items-center justify-between gap-4 no-print border-b border-[#E8E8ED] px-4 sm:px-6 lg:px-8 py-2.5 sm:py-3 shrink-0 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#1D1D1F] flex items-center justify-center text-white shadow-sm shrink-0">
              <Building2 className="w-3.5 h-3.5 text-white" />
            </div>
            <h1 className="text-[15px] font-bold text-[#1D1D1F] tracking-tight leading-snug">
              ASSEMBLY APP
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-[12px] font-semibold text-[#1D1D1F]">
                {initialAdmin?.name || "Authorized Revenue Officer"}
              </span>
              <span className="text-[10px] text-[#8E8E93]">Municipal Field Officer</span>
            </div>

            <button
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-medium text-[#6E6E73] hover:text-[#FF3B30] hover:bg-black/5 transition-all cursor-pointer"
              title="Sign out of officer session"
            >
              {isSigningOut ? (
                <AppleSpinner size="sm" />
              ) : (
                <>
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </>
              )}
            </button>
          </div>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-3.5">
          <AppleSpinner size="lg" className="text-[#007AFF]" />
          <div className="flex flex-col gap-1 max-w-sm">
            <h3 className="text-[16px] font-semibold text-[#1D1D1F]">
              Loading Statement...
            </h3>
            <p className="text-[12px] text-[#6E6E73]">
              Retrieving property account billing and payment records
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] max-h-[100dvh] w-full bg-[#F5F5F7] text-[#1D1D1F] flex flex-col font-sans antialiased overflow-hidden selection:bg-[#007AFF]/20 selection:text-[#007AFF]">
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
      {/* Main Container - Viewport Constrained */}
      <main className="w-full px-0 sm:px-6 lg:px-8 py-0 sm:py-3 flex-1 min-h-0 flex flex-col gap-0 sm:gap-3 overflow-hidden pb-16 sm:pb-3">
        {/* Assembly Identity & Officer Top Bar (Locked / Flex-shrink: 0) */}
        <header className="relative w-full flex items-center justify-between gap-4 no-print border-b border-[#E8E8ED] px-4 sm:px-0 py-2.5 sm:py-0 pb-2.5 shrink-0 bg-white sm:bg-transparent min-h-[44px]">
          {/* Brand Identity permanently anchored on the left (ZERO displacement) */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-full bg-[#1D1D1F] flex items-center justify-center text-white shadow-sm shrink-0">
              <Building2 className="w-3.5 h-3.5 text-white" />
            </div>
            <h1 className="text-[15px] font-bold text-[#1D1D1F] tracking-tight leading-snug select-none">
              ASSEMBLY APP
            </h1>
          </div>

          {/* Desktop Navigation Tabs - Apple Centered Segment Bar with Fluid Underline */}
          <div className="hidden sm:flex absolute left-1/2 -translate-x-1/2 items-center pointer-events-auto">
            <nav
              className="flex items-center gap-1 bg-white/90 backdrop-blur-xl px-2 py-1 rounded-xl border border-[#E8E8ED] shadow-2xs"
              aria-label="Main Navigation"
            >
              <button
                type="button"
                onClick={() => handleSectionChange("STATEMENT")}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-[13px] transition-all relative cursor-pointer ${
                  activeSection === "STATEMENT"
                    ? "text-[#007AFF] font-semibold"
                    : "text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/3 font-medium"
                }`}
              >
                <motion.div
                  animate={activeSection === "STATEMENT" ? { scale: [1, 0.88, 1.14, 1], y: 0 } : { scale: 1, y: 0 }}
                  transition={{ duration: 0.24, ease: "easeOut" }}
                  className="flex items-center justify-center"
                >
                  <FileText className={`w-4 h-4 ${activeSection === "STATEMENT" ? "stroke-[2.2]" : "stroke-[1.8]"}`} />
                </motion.div>
                <span>Account statement</span>
                {activeSection === "STATEMENT" && (
                  <motion.div
                    layoutId="officer-desktop-nav-underline"
                    className="absolute bottom-0 inset-x-3.5 h-[2px] bg-[#007AFF] rounded-full"
                    transition={{ type: "spring", stiffness: 500, damping: 38 }}
                  />
                )}
              </button>

              <button
                type="button"
                onClick={() => handleSectionChange("PAYMENTS")}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-[13px] transition-all relative cursor-pointer ${
                  activeSection === "PAYMENTS"
                    ? "text-[#007AFF] font-semibold"
                    : "text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/3 font-medium"
                }`}
              >
                <motion.div
                  animate={activeSection === "PAYMENTS" ? { scale: [1, 0.88, 1.14, 1], y: 0 } : { scale: 1, y: 0 }}
                  transition={{ duration: 0.24, ease: "easeOut" }}
                  className="flex items-center justify-center"
                >
                  <Receipt className={`w-4 h-4 ${activeSection === "PAYMENTS" ? "stroke-[2.2]" : "stroke-[1.8]"}`} />
                </motion.div>
                <span>Payments</span>
                {activeSection === "PAYMENTS" && (
                  <motion.div
                    layoutId="officer-desktop-nav-underline"
                    className="absolute bottom-0 inset-x-3.5 h-[2px] bg-[#007AFF] rounded-full"
                    transition={{ type: "spring", stiffness: 500, damping: 38 }}
                  />
                )}
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="hidden sm:flex flex-col text-right"
            >
              <span className="text-[12px] font-semibold text-[#1D1D1F]">
                {initialAdmin?.name || "Authorized Revenue Officer"}
              </span>
              <span className="text-[10px] text-[#8E8E93]">Municipal Field Officer</span>
            </motion.div>

            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-medium text-[#6E6E73] hover:text-[#FF3B30] hover:bg-black/5 transition-all cursor-pointer"
              title="Sign out of officer session"
            >
              {isSigningOut ? (
                <AppleSpinner size="sm" />
              ) : (
                <>
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </>
              )}
            </motion.button>
          </div>
        </header>

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
                  <form onSubmit={handleViewStatementSubmit} className="flex items-center gap-3.5 w-full">
                    {/* Col 1: Account number field (fluid flex-1, ~400px) */}
                    <div className="relative flex-1 min-w-0" ref={desktopSearchContainerRef}>
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8E8E93]">
                        {isSearching ? <AppleSpinner size="sm" /> : <Search className="w-4 h-4" />}
                      </div>
                      <input
                        type="text"
                        value={accountNumberInput}
                        onChange={(e) => {
                          setAccountNumberInput(e.target.value);
                          setSearchQuery(e.target.value);
                        }}
                        onFocus={() => {
                          if (searchResults.length > 0) setIsDropdownOpen(true);
                        }}
                        onBlur={() => {
                          blurTimeoutRef.current = setTimeout(() => {
                            setIsDropdownOpen(false);
                          }, 180);
                        }}
                        placeholder="e.g. PR-03-000932"
                        className="w-full pl-10 pr-3 h-[44px] text-[14px] text-[#1D1D1F] bg-white border border-[#D2D2D7] rounded-[10px] shadow-[0px_1px_3px_0px_rgba(29,29,31,0.02)] focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 transition-all font-sans placeholder:text-[#8E8E93]"
                      />

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
                    <div className="flex items-center gap-2 flex-[1.2] min-w-0">
                      {/* Start Date Box */}
                      <div
                        className={`relative flex items-center flex-1 h-[44px] rounded-[10px] border transition-all ${
                          accountNumberInput.trim()
                            ? "bg-white border-[#D2D2D7] focus-within:border-[#007AFF] focus-within:ring-2 focus-within:ring-[#007AFF]/20"
                            : "bg-[#F5F5F7] border-[#E8E8ED] cursor-not-allowed opacity-75"
                        }`}
                      >
                        <button
                          type="button"
                          disabled={!accountNumberInput.trim()}
                          onClick={openPeriodModal}
                          className="pl-3.5 pr-1.5 text-[#8E8E93] hover:text-[#007AFF] transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                          title={accountNumberInput.trim() ? "Open calendar picker" : "Select an account first"}
                        >
                          <Calendar className="w-4 h-4" />
                        </button>
                        <input
                          type="text"
                          disabled={!accountNumberInput.trim()}
                          value={startDateText}
                          onChange={(e) => setStartDateText(e.target.value)}
                          onBlur={handleStartDateBlur}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleStartDateBlur();
                          }}
                          placeholder="01-Jan-2025"
                          className="w-full pr-3 py-1.5 text-[14px] font-medium text-[#1D1D1F] bg-transparent outline-none font-sans placeholder:text-[#8E8E93] disabled:cursor-not-allowed"
                          title={accountNumberInput.trim() ? "Type start date (e.g. 01-Jan-2025)" : "Select an account first"}
                        />
                      </div>

                      {/* Arrow Connector */}
                      <span className="text-[#8E8E93] text-[14px] select-none font-sans shrink-0">→</span>

                      {/* End Date Box */}
                      <div
                        className={`relative flex items-center flex-1 h-[44px] rounded-[10px] border transition-all ${
                          accountNumberInput.trim()
                            ? "bg-white border-[#D2D2D7] focus-within:border-[#007AFF] focus-within:ring-2 focus-within:ring-[#007AFF]/20"
                            : "bg-[#F5F5F7] border-[#E8E8ED] cursor-not-allowed opacity-75"
                        }`}
                      >
                        <button
                          type="button"
                          disabled={!accountNumberInput.trim()}
                          onClick={openPeriodModal}
                          className="pl-3.5 pr-1.5 text-[#8E8E93] hover:text-[#007AFF] transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                          title={accountNumberInput.trim() ? "Open calendar picker" : "Select an account first"}
                        >
                          <Calendar className="w-4 h-4" />
                        </button>
                        <input
                          type="text"
                          disabled={!accountNumberInput.trim()}
                          value={endDateText}
                          onChange={(e) => setEndDateText(e.target.value)}
                          onBlur={handleEndDateBlur}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleEndDateBlur();
                          }}
                          placeholder="31-Dec-2026"
                          className="w-full pr-3 py-1.5 text-[14px] font-medium text-[#1D1D1F] bg-transparent outline-none font-sans placeholder:text-[#8E8E93] disabled:cursor-not-allowed"
                          title={accountNumberInput.trim() ? "Type end date (e.g. 31-Dec-2026)" : "Select an account first"}
                        />
                      </div>
                    </div>

                    {/* Col 3: View Statement Button (~156px) */}
                    <div className="shrink-0 w-[156px]">
                      <button
                        type="submit"
                        disabled={!accountNumberInput.trim() || isLoadingStatement}
                        className={`w-full h-[44px] rounded-[10px] text-[15px] font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 ${
                          accountNumberInput.trim() && !isLoadingStatement
                            ? "bg-[#007AFF] text-white hover:bg-[#0066D6] shadow-[0px_2px_8px_0px_rgba(0,122,255,0.35)] active:scale-[0.98] ring-1 ring-[#007AFF]/20 cursor-pointer"
                            : "bg-[#E8E8ED] border border-[#D2D2D7] text-[#8E8E93] cursor-not-allowed shadow-none"
                        }`}
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

                  {/* Line 2: Year Buttons Separately Centered Beneath Fields */}
                  <div className="flex items-center justify-center gap-2 pt-1 w-full">
                    {FISCAL_YEARS.map((yr) => {
                      const isActive = startDate === `${yr}-01-01` && endDate === `${yr}-12-31`;
                      const isEnabled = Boolean(accountNumberInput.trim());
                      return (
                        <button
                          key={yr}
                          type="button"
                          disabled={!isEnabled}
                          onClick={() => applyFiscalYearFilter(yr)}
                          className={`px-3 h-[32px] rounded-[8px] text-[13px] font-medium transition-all shrink-0 border ${
                            !isEnabled
                              ? "bg-[#E8E8ED] border-[#E8E8ED] text-[#626267] cursor-not-allowed"
                              : isActive
                              ? "bg-[#007AFF] border-[#007AFF] text-white font-semibold shadow-[0px_1px_4px_0px_rgba(0,122,255,0.35)] cursor-pointer"
                              : "bg-white border-[#D2D2D7] text-[#1D1D1F] hover:border-[#007AFF] hover:text-[#007AFF] cursor-pointer"
                          }`}
                        >
                          FY {yr}
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      disabled={!accountNumberInput.trim()}
                      onClick={() => applyMultiYearFilter(2024, 2026)}
                      className={`px-3.5 h-[32px] rounded-[8px] text-[13px] font-medium transition-all shrink-0 border ${
                        !accountNumberInput.trim()
                          ? "bg-[#E8E8ED] border-[#E8E8ED] text-[#626267] cursor-not-allowed"
                          : startDate === "2024-01-01" && endDate === "2026-12-31"
                          ? "bg-[#007AFF] border-[#007AFF] text-white font-semibold shadow-[0px_1px_4px_0px_rgba(0,122,255,0.35)] cursor-pointer"
                          : "bg-white border-[#D2D2D7] text-[#1D1D1F] hover:border-[#007AFF] hover:text-[#007AFF] cursor-pointer"
                      }`}
                    >
                      2024–2026 (3 Yrs)
                    </button>

                    <button
                      type="button"
                      disabled={!accountNumberInput.trim()}
                      onClick={applyAllRecordsFilter}
                      className={`px-3.5 h-[32px] rounded-[8px] text-[13px] font-medium transition-all shrink-0 border ${
                        !accountNumberInput.trim()
                          ? "bg-[#E8E8ED] border-[#E8E8ED] text-[#626267] cursor-not-allowed"
                          : !startDate && !endDate && statementData
                          ? "bg-[#007AFF] border-[#007AFF] text-white font-semibold shadow-[0px_1px_4px_0px_rgba(0,122,255,0.35)] cursor-pointer"
                          : "bg-white border-[#D2D2D7] text-[#1D1D1F] hover:border-[#007AFF] hover:text-[#007AFF] cursor-pointer"
                      }`}
                    >
                      All Records
                    </button>
                  </div>
                </section>
              </div>
            </div>

            {/* MOBILE: Responsive Controls Block */}
            <div className="flex lg:hidden flex-col gap-2.5 shrink-0 no-print relative z-40 w-full">
              {/* LOOKUP FORM: MOBILE */}
              <section className="flex flex-col gap-2.5 shrink-0 no-print relative z-40 w-full">
          {/* Account number input */}
          <div className="flex flex-col gap-1 w-full">
            <label className="text-[12px] font-semibold text-[#1D1D1F]">Account number</label>
            <div ref={mobileSearchContainerRef} className="relative w-full z-50">
              <input
                type="text"
                value={accountNumberInput}
                onChange={(e) => {
                  setAccountNumberInput(e.target.value);
                  setSearchQuery(e.target.value);
                }}
                onFocus={() => {
                  if (searchResults.length > 0) setIsDropdownOpen(true);
                }}
                onBlur={() => {
                  blurTimeoutRef.current = setTimeout(() => {
                    setIsDropdownOpen(false);
                  }, 180);
                }}
                placeholder="e.g. PR-03-000932"
                className="w-full pl-3 pr-9 h-[44px] text-[14px] text-[#1D1D1F] bg-white border border-[#D2D2D7] rounded-[10px] shadow-[0px_1px_2px_0px_rgba(29,29,31,0.02)] focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 transition-all font-sans placeholder:text-[#8E8E93]"
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-[#8E8E93]">
                {isSearching ? <AppleSpinner size="sm" /> : <Search className="w-3.5 h-3.5" />}
              </div>

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

          {/* View Statement Action (Directly beneath Account number) */}
          <button
            type="button"
            onClick={() => handleViewStatementSubmit()}
            disabled={!accountNumberInput.trim() || isLoadingStatement}
            className={`w-full h-[46px] rounded-[10px] text-[15px] font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
              accountNumberInput.trim() && !isLoadingStatement
                ? "bg-[#007AFF] text-white hover:bg-[#0066D6] shadow-[0px_2px_8px_0px_rgba(0,122,255,0.35)] active:scale-[0.98] ring-1 ring-[#007AFF]/20 cursor-pointer"
                : "bg-[#E8E8ED] border border-[#D2D2D7] text-[#8E8E93] cursor-not-allowed shadow-none"
            }`}
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

          {/* Statement Period Container */}
          <div className="flex flex-col gap-2 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-semibold text-[#1D1D1F]">Statement period</span>
              <span className="text-[11px] text-[#8E8E93]">
                {!accountNumberInput.trim() ? "Enter account to enable" : "Filter options"}
              </span>
            </div>

            {/* 1. CUSTOM RANGE FIRST (Per User Request) */}
            <div className="flex flex-col gap-1">
              <span className="text-[#8E8E93] text-[10px] font-semibold uppercase tracking-wider">
                CUSTOM RANGE
              </span>
              <div className="bg-[#FAFAFC] border border-[#E8E8ED] rounded-[10px] p-2.5 flex items-center justify-between gap-2">
                {/* Start Date */}
                <div className="flex-1 flex flex-col gap-0.5">
                  <span className="text-[10px] font-medium text-[#8E8E93]">START DATE</span>
                  <div
                    className={`relative flex items-center h-[38px] rounded-[8px] border px-2 transition-all ${
                      accountNumberInput.trim()
                        ? "bg-white border-[#D2D2D7]"
                        : "bg-[#F5F5F7] border-[#E8E8ED] cursor-not-allowed"
                    }`}
                  >
                    <input
                      type="text"
                      disabled={!accountNumberInput.trim()}
                      value={startDateText}
                      onChange={(e) => setStartDateText(e.target.value)}
                      onBlur={handleStartDateBlur}
                      placeholder="01-Jan-2025"
                      className="w-full text-[12px] text-[#1D1D1F] bg-transparent outline-none pr-5 placeholder:text-[#8E8E93] disabled:cursor-not-allowed"
                    />
                    <button
                      type="button"
                      disabled={!accountNumberInput.trim()}
                      onClick={openPeriodModal}
                      className="absolute right-1.5 text-[#8E8E93] hover:text-[#007AFF]"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <span className="text-[#8E8E93] text-[13px] pt-3 select-none">→</span>

                {/* End Date */}
                <div className="flex-1 flex flex-col gap-0.5">
                  <span className="text-[10px] font-medium text-[#8E8E93]">END DATE</span>
                  <div
                    className={`relative flex items-center h-[38px] rounded-[8px] border px-2 transition-all ${
                      accountNumberInput.trim()
                        ? "bg-white border-[#D2D2D7]"
                        : "bg-[#F5F5F7] border-[#E8E8ED] cursor-not-allowed"
                    }`}
                  >
                    <input
                      type="text"
                      disabled={!accountNumberInput.trim()}
                      value={endDateText}
                      onChange={(e) => setEndDateText(e.target.value)}
                      onBlur={handleEndDateBlur}
                      placeholder="31-Dec-2026"
                      className="w-full text-[12px] text-[#1D1D1F] bg-transparent outline-none pr-5 placeholder:text-[#8E8E93] disabled:cursor-not-allowed"
                    />
                    <button
                      type="button"
                      disabled={!accountNumberInput.trim()}
                      onClick={openPeriodModal}
                      className="absolute right-1.5 text-[#8E8E93] hover:text-[#007AFF]"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. FISCAL YEAR SECOND (Per User Request) */}
            <div className="flex flex-col gap-1">
              <span className="text-[#8E8E93] text-[10px] font-semibold uppercase tracking-wider">
                FISCAL YEAR
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                {FISCAL_YEARS.slice(0, 4).map((yr) => {
                  const isActive = startDate === `${yr}-01-01` && endDate === `${yr}-12-31`;
                  const isEnabled = Boolean(accountNumberInput.trim());
                  return (
                    <button
                      key={yr}
                      type="button"
                      disabled={!isEnabled}
                      onClick={() => applyFiscalYearFilter(yr)}
                      className={`h-[36px] rounded-lg text-[12px] font-medium transition-all flex items-center justify-center border ${
                        !isEnabled
                          ? "bg-[#E8E8ED] border-[#E8E8ED] text-[#626267] cursor-not-allowed"
                          : isActive
                          ? "bg-[#007AFF] border-[#007AFF] text-white font-semibold shadow-[0px_1px_4px_0px_rgba(0,122,255,0.35)] cursor-pointer"
                          : "bg-white border-[#D2D2D7] text-[#1D1D1F] active:border-[#007AFF] cursor-pointer"
                      }`}
                    >
                      FY {yr}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  disabled={!accountNumberInput.trim()}
                  onClick={() => applyFiscalYearFilter(2022)}
                  className={`h-[36px] rounded-lg text-[12px] font-medium transition-all flex items-center justify-center border ${
                    !accountNumberInput.trim()
                      ? "bg-[#E8E8ED] border-[#E8E8ED] text-[#626267] cursor-not-allowed"
                      : startDate === "2022-01-01" && endDate === "2022-12-31"
                      ? "bg-[#007AFF] border-[#007AFF] text-white font-semibold shadow-[0px_1px_4px_0px_rgba(0,122,255,0.35)] cursor-pointer"
                      : "bg-white border-[#D2D2D7] text-[#1D1D1F] active:border-[#007AFF] cursor-pointer"
                  }`}
                >
                  FY 2022
                </button>

                <button
                  type="button"
                  disabled={!accountNumberInput.trim()}
                  onClick={() => applyMultiYearFilter(2024, 2026)}
                  className={`h-[36px] rounded-lg text-[12px] font-medium transition-all flex items-center justify-center border ${
                    !accountNumberInput.trim()
                      ? "bg-[#E8E8ED] border-[#E8E8ED] text-[#626267] cursor-not-allowed"
                      : startDate === "2024-01-01" && endDate === "2026-12-31"
                      ? "bg-[#007AFF] border-[#007AFF] text-white font-semibold shadow-[0px_1px_4px_0px_rgba(0,122,255,0.35)] cursor-pointer"
                      : "bg-white border-[#D2D2D7] text-[#1D1D1F] active:border-[#007AFF] cursor-pointer"
                  }`}
                >
                  2024–2026 (3 Yrs)
                </button>

                <button
                  type="button"
                  disabled={!accountNumberInput.trim()}
                  onClick={applyAllRecordsFilter}
                  className={`h-[36px] rounded-lg text-[12px] font-medium transition-all flex items-center justify-center border ${
                    !accountNumberInput.trim()
                      ? "bg-[#E8E8ED] border-[#E8E8ED] text-[#626267] cursor-not-allowed"
                      : !startDate && !endDate && statementData
                      ? "bg-[#007AFF] border-[#007AFF] text-white font-semibold shadow-[0px_1px_4px_0px_rgba(0,122,255,0.35)] cursor-pointer"
                      : "bg-white border-[#D2D2D7] text-[#1D1D1F] active:border-[#007AFF] cursor-pointer"
                  }`}
                >
                  All Records
                </button>
              </div>
            </div>
          </div>
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
                    title="Back to search"
                  >
                    <ChevronLeft className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2.5]" />
                    <span>Back</span>
                  </button>

                  <h2 className="text-[17px] sm:text-[20px] font-semibold text-[#1D1D1F] tracking-tight">
                    Account statement
                  </h2>

                  {/* Typographic Period Indicator (Strictly Zero Pills) */}
                  <div className="inline-flex items-center gap-1.5 text-[#007AFF] text-[12px] font-medium">
                    <Calendar className="w-3.5 h-3.5 text-[#007AFF]" />
                    <span>
                      {startDate && endDate
                        ? `${formatIsoToDisplay(startDate)} → ${formatIsoToDisplay(endDate)}`
                        : startDate || endDate
                        ? formatIsoToDisplay(startDate || endDate)
                        : "All Records"}
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
                  {/* MOBILE: Name and Address on one compact line (<sm) */}
                  <div className="flex sm:hidden items-center gap-1.5 min-w-0 flex-1 text-[12px] truncate">
                    <span className="font-semibold text-[#1D1D1F] truncate shrink-0 max-w-[150px]">
                      {statementData.property?.name || "—"}
                    </span>
                    <span className="text-[#8E8E93] shrink-0">&bull;</span>
                    <span className="text-[#6E6E73] truncate">
                      {statementData.property?.ownerDigitalAddress || statementData.property?.houseNo || "—"}
                    </span>
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
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
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
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
              {/* Transactions Ledger Table */}
              <div className="w-full overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-full">
                  <thead className="sticky top-0 z-10 bg-[#FAFAFC] shadow-[0_1px_0_0_#E8E8ED]">
                    <tr>
                      <th className="py-2 sm:py-2.5 px-2.5 sm:px-5 text-[10px] sm:text-[12px] uppercase font-semibold text-[#8E8E93] sm:text-[#6E6E73] w-[50px] sm:w-[80px]">
                        Year
                      </th>
                      <th className="py-2 sm:py-2.5 px-2.5 sm:px-5 text-[10px] sm:text-[12px] uppercase font-semibold text-[#8E8E93] sm:text-[#6E6E73] w-[75px] sm:w-[130px]">
                        Date
                      </th>
                      <th className="py-2 sm:py-2.5 px-2.5 sm:px-5 text-[10px] sm:text-[12px] uppercase font-semibold text-[#8E8E93] sm:text-[#6E6E73]">
                        Item
                      </th>
                      <th className="py-2 sm:py-2.5 px-2.5 sm:px-5 text-[10px] sm:text-[12px] uppercase font-semibold text-[#8E8E93] sm:text-[#6E6E73] text-right w-[65px] sm:w-[140px]">
                        CR
                      </th>
                      <th className="py-2 sm:py-2.5 px-2.5 sm:px-5 text-[10px] sm:text-[12px] uppercase font-semibold text-[#8E8E93] sm:text-[#6E6E73] text-right w-[65px] sm:w-[140px]">
                        DR
                      </th>
                      <th className="py-2 sm:py-2.5 px-2.5 sm:px-5 text-[10px] sm:text-[12px] uppercase font-semibold text-[#8E8E93] sm:text-[#6E6E73] text-right w-[75px] sm:w-[160px]">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E8ED]">
                    {ledgerRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-[#8E8E93] text-[12px] sm:text-[13px]">
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
                                className="py-2.5 sm:py-3 px-2.5 sm:px-5 text-[11px] sm:text-[13px] font-medium text-[#1D1D1F] align-top border-r border-[#E8E8ED]/60 bg-white"
                              >
                                {group.year}
                              </td>
                            )}
                            <td className="py-2.5 sm:py-3 px-2.5 sm:px-5 text-[11px] sm:text-[13px] text-[#1D1D1F] whitespace-nowrap">
                              {row.dateStr}
                            </td>
                            <td className="py-2.5 sm:py-3 px-2.5 sm:px-5 text-[11px] sm:text-[13px] text-[#1D1D1F] font-medium">
                              {row.item}
                            </td>
                            <td className="py-2.5 sm:py-3 px-2.5 sm:px-5 text-[11px] sm:text-[13px] text-[#34C759] text-right font-mono tabular-nums">
                              {row.paidCredit > 0 ? row.paidCredit.toFixed(2) : "0.00"}
                            </td>
                            <td className="py-2.5 sm:py-3 px-2.5 sm:px-5 text-[11px] sm:text-[13px] text-[#1D1D1F] text-right font-mono tabular-nums">
                              {row.billedDebit > 0 ? row.billedDebit.toFixed(2) : "0.00"}
                            </td>
                            <td className="py-2.5 sm:py-3 px-2.5 sm:px-5 text-[11px] sm:text-[13px] text-[#1D1D1F] text-right font-mono tabular-nums font-semibold">
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

        {/* SECTION 2: PAYMENTS (DIRECTORY, DRILLDOWN, IN-PERSON CASH SETTLEMENT & GCR RECEIPT MANAGEMENT) */}
        {activeSection === "PAYMENTS" && (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden no-print">
            <PaymentsSection
              currentAdmin={initialAdmin}
              onOpenStatement={handleOpenStatementFromPayments}
            />
          </div>
        )}
      </main>

      {/* Mobile Fixed iOS Bottom Navigation Dock (Guaranteed 100% visibility & safe-area padded) */}
      <nav
        className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-2xl border-t border-[#E8E8ED] flex items-center justify-around h-16 px-6 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-2px_16px_rgba(0,0,0,0.04)] no-print"
        aria-label="Mobile Navigation"
      >
        <button
          type="button"
          onClick={() => handleSectionChange("STATEMENT")}
          className={`flex-1 flex flex-col items-center justify-center py-1 text-[11px] transition-colors relative cursor-pointer min-h-[48px] active:scale-95 ${
            activeSection === "STATEMENT"
              ? "text-[#007AFF] font-semibold"
              : "text-[#8E8E93] hover:text-[#1D1D1F] font-medium"
          }`}
        >
          <motion.div
            animate={activeSection === "STATEMENT" ? { scale: [1, 0.85, 1.15, 1], y: -2 } : { scale: 1, y: 0 }}
            transition={{ duration: 0.26, ease: "easeOut" }}
            className="flex items-center justify-center"
          >
            <FileText className={`w-5 h-5 ${activeSection === "STATEMENT" ? "stroke-[2.2]" : "stroke-[1.8]"}`} />
          </motion.div>
          <span className="mt-0.5">Statement</span>
          {activeSection === "STATEMENT" && (
            <motion.div
              layoutId="officer-mobile-nav-indicator"
              className="w-1.5 h-1.5 rounded-full bg-[#007AFF] mt-1"
              transition={{ type: "spring", stiffness: 480, damping: 32 }}
            />
          )}
        </button>

        <button
          type="button"
          onClick={() => handleSectionChange("PAYMENTS")}
          className={`flex-1 flex flex-col items-center justify-center py-1 text-[11px] transition-colors relative cursor-pointer min-h-[48px] active:scale-95 ${
            activeSection === "PAYMENTS"
              ? "text-[#007AFF] font-semibold"
              : "text-[#8E8E93] hover:text-[#1D1D1F] font-medium"
          }`}
        >
          <motion.div
            animate={activeSection === "PAYMENTS" ? { scale: [1, 0.85, 1.15, 1], y: -2 } : { scale: 1, y: 0 }}
            transition={{ duration: 0.26, ease: "easeOut" }}
            className="flex items-center justify-center"
          >
            <Receipt className={`w-5 h-5 ${activeSection === "PAYMENTS" ? "stroke-[2.2]" : "stroke-[1.8]"}`} />
          </motion.div>
          <span className="mt-0.5">Payments</span>
          {activeSection === "PAYMENTS" && (
            <motion.div
              layoutId="officer-mobile-nav-indicator"
              className="w-1.5 h-1.5 rounded-full bg-[#007AFF] mt-1"
              transition={{ type: "spring", stiffness: 480, damping: 32 }}
            />
          )}
        </button>
      </nav>

      {/* =========================================================================
         STATE 3: INTERACTIVE PERIOD SELECTOR MODAL / POPOVER (Figma Frame 83:118 & 90:2100)
         Enhanced with Solid Blue Active Presets and Direct Editable Inputs
         ========================================================================= */}
      <AnimatePresence>
        {isPeriodPickerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.18 }}
              className="w-full max-w-[440px] bg-white border border-[#E8E8ED] rounded-[16px] shadow-[0px_8px_32px_0px_rgba(29,29,31,0.12)] overflow-hidden flex flex-col font-sans"
            >
              {/* Header */}
              <div className="p-4 border-b border-[#E8E8ED] flex items-center justify-between">
                <div>
                  <h3 className="text-[15px] font-semibold text-[#1D1D1F]">Statement period</h3>
                  <p className="text-[12px] text-[#6E6E73]">Choose the date range for the account statement.</p>
                </div>
                <button
                  onClick={() => setIsPeriodPickerOpen(false)}
                  className="p-1 rounded-lg text-[#8E8E93] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Start & End Typeable Summary Boxes inside Modal */}
              <div className="p-3 border-b border-[#E8E8ED] bg-[#FAFAFC] flex items-center justify-between gap-2">
                <div className="flex-1 flex flex-col gap-0.5">
                  <span className="text-[10px] font-semibold text-[#8E8E93] uppercase tracking-wider">START DATE</span>
                  <div className="px-2.5 py-1.5 bg-white border border-[#D2D2D7] rounded-lg text-[13px] font-medium text-[#1D1D1F] flex items-center gap-2 focus-within:border-[#007AFF] focus-within:ring-2 focus-within:ring-[#007AFF]/20">
                    <Calendar className="w-3.5 h-3.5 text-[#8E8E93]" />
                    <input
                      type="text"
                      value={modalStartText}
                      onChange={(e) => setModalStartText(e.target.value)}
                      onBlur={handleModalStartBlur}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleModalStartBlur();
                      }}
                      placeholder="01-Jan-2025"
                      className="w-full bg-transparent outline-none text-[12px] text-[#1D1D1F] font-medium placeholder:text-[#8E8E93]"
                    />
                  </div>
                </div>

                <div className="text-[#8E8E93] font-semibold text-xs pt-3 select-none">→</div>

                <div className="flex-1 flex flex-col gap-0.5">
                  <span className="text-[10px] font-semibold text-[#8E8E93] uppercase tracking-wider">END DATE</span>
                  <div className="px-2.5 py-1.5 bg-white border border-[#D2D2D7] rounded-lg text-[13px] font-medium text-[#1D1D1F] flex items-center gap-2 focus-within:border-[#007AFF] focus-within:ring-2 focus-within:ring-[#007AFF]/20">
                    <Calendar className="w-3.5 h-3.5 text-[#8E8E93]" />
                    <input
                      type="text"
                      value={modalEndText}
                      onChange={(e) => setModalEndText(e.target.value)}
                      onBlur={handleModalEndBlur}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleModalEndBlur();
                      }}
                      placeholder="31-Dec-2026"
                      className="w-full bg-transparent outline-none text-[12px] text-[#1D1D1F] font-medium placeholder:text-[#8E8E93]"
                    />
                  </div>
                </div>
              </div>

              {/* Fiscal Year Presets Grid (2 Rows) - Solid Blue When Active */}
              <div className="px-4 pt-2.5 pb-2.5 border-b border-[#E8E8ED] flex flex-col gap-1.5">
                <span className="text-[#8E8E93] text-[10px] font-semibold uppercase tracking-wider">
                  FISCAL YEAR
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {FISCAL_YEARS.slice(0, 4).map((yr) => {
                    const isActive = tempStartDate === `${yr}-01-01` && tempEndDate === `${yr}-12-31`;
                    return (
                      <button
                        key={yr}
                        type="button"
                        onClick={() => {
                          const sIso = `${yr}-01-01`;
                          const eIso = `${yr}-12-31`;
                          setTempStartDate(sIso);
                          setTempEndDate(eIso);
                          setModalStartText(`01-Jan-${yr}`);
                          setModalEndText(`31-Dec-${yr}`);
                          setPickerCalendarMonth(new Date(yr, 11, 1));
                        }}
                        className={`h-[32px] rounded-lg text-[11px] font-medium transition-all cursor-pointer border ${
                          isActive
                            ? "bg-[#007AFF] border-[#007AFF] text-white font-semibold shadow-[0px_1px_3px_0px_rgba(0,122,255,0.35)]"
                            : "bg-white border-[#D2D2D7] text-[#1D1D1F] hover:border-[#007AFF]"
                        }`}
                      >
                        FY {yr}
                      </button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setTempStartDate("2022-01-01");
                      setTempEndDate("2022-12-31");
                      setModalStartText("01-Jan-2022");
                      setModalEndText("31-Dec-2022");
                      setPickerCalendarMonth(new Date(2022, 11, 1));
                    }}
                    className={`h-[32px] rounded-lg text-[11px] font-medium transition-all cursor-pointer border ${
                      tempStartDate === "2022-01-01" && tempEndDate === "2022-12-31"
                        ? "bg-[#007AFF] border-[#007AFF] text-white font-semibold shadow-[0px_1px_3px_0px_rgba(0,122,255,0.35)]"
                        : "bg-white border-[#D2D2D7] text-[#1D1D1F] hover:border-[#007AFF]"
                    }`}
                  >
                    FY 2022
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTempStartDate("2024-01-01");
                      setTempEndDate("2026-12-31");
                      setModalStartText("01-Jan-2024");
                      setModalEndText("31-Dec-2026");
                      setPickerCalendarMonth(new Date(2026, 11, 1));
                    }}
                    className={`h-[32px] rounded-lg text-[11px] font-medium transition-all cursor-pointer border ${
                      tempStartDate === "2024-01-01" && tempEndDate === "2026-12-31"
                        ? "bg-[#007AFF] border-[#007AFF] text-white font-semibold shadow-[0px_1px_4px_0px_rgba(0,122,255,0.35)]"
                        : "bg-white border-[#D2D2D7] text-[#1D1D1F] hover:border-[#007AFF]"
                    }`}
                  >
                    2024–2026 (3 Yrs)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTempStartDate("");
                      setTempEndDate("");
                      setModalStartText("");
                      setModalEndText("");
                    }}
                    className={`h-[32px] rounded-lg text-[11px] font-medium transition-all cursor-pointer border ${
                      !tempStartDate && !tempEndDate
                        ? "bg-[#007AFF] border-[#007AFF] text-white font-semibold shadow-[0px_1px_4px_0px_rgba(0,122,255,0.35)]"
                        : "bg-white border-[#D2D2D7] text-[#1D1D1F] hover:border-[#007AFF]"
                    }`}
                  >
                    All Records
                  </button>
                </div>
              </div>

              {/* Calendar Navigator with Year Selector Dropdown */}
              <div className="p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <button
                    onClick={prevMonth}
                    className="w-7 h-7 rounded-lg bg-[#F5F5F7] hover:bg-[#E8E8ED] flex items-center justify-center text-[#007AFF] transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[14px] font-semibold text-[#1D1D1F]">{monthName}</span>
                    <select
                      value={calendarYear}
                      onChange={(e) => {
                        const newYr = parseInt(e.target.value, 10);
                        setPickerCalendarMonth(new Date(newYr, calendarMonthIdx, 1));
                      }}
                      className="text-[14px] font-semibold text-[#1D1D1F] bg-[#F5F5F7] border border-[#E8E8ED] rounded-md px-1.5 py-0.5 outline-none cursor-pointer hover:bg-[#E8E8ED] transition-colors"
                    >
                      {[2027, 2026, 2025, 2024, 2023, 2022, 2021, 2020].map((yr) => (
                        <option key={yr} value={yr}>
                          {yr}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={nextMonth}
                    className="w-7 h-7 rounded-lg bg-[#F5F5F7] hover:bg-[#E8E8ED] flex items-center justify-center text-[#007AFF] transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Weekday Labels */}
                <div className="grid grid-cols-7 gap-1 text-center">
                  {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((wd) => (
                    <span key={wd} className="text-[11px] font-semibold text-[#8E8E93] py-0.5">
                      {wd}
                    </span>
                  ))}
                </div>

                {/* Day Matrix */}
                <div className="grid grid-cols-7 gap-1 text-center">
                  {/* Empty cells for start day offset */}
                  {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                    <div key={`empty-${i}`} className="h-8" />
                  ))}

                  {/* Days */}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const dateObj = new Date(calendarYear, calendarMonthIdx, day);
                    const iso = dateObj.toISOString().slice(0, 10);

                    const isStart = tempStartDate === iso;
                    const isEnd = tempEndDate === iso;
                    const inRange =
                      tempStartDate &&
                      tempEndDate &&
                      dateObj.getTime() > new Date(tempStartDate).getTime() &&
                      dateObj.getTime() < new Date(tempEndDate).getTime();

                    return (
                      <button
                        key={day}
                        onClick={() => handleSelectCalendarDay(day)}
                        className={`h-8 rounded-full text-[12px] font-medium transition-all flex items-center justify-center cursor-pointer ${
                          isStart || isEnd
                            ? "bg-[#007AFF] text-white font-semibold shadow-xs"
                            : inRange
                            ? "bg-[#007AFF]/10 text-[#007AFF] rounded-none first:rounded-l-full last:rounded-r-full"
                            : "hover:bg-[#F5F5F7] text-[#1D1D1F]"
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="p-3 bg-[#FAFAFC] border-t border-[#E8E8ED] flex items-center justify-between">
                <span className="text-[12px] text-[#8E8E93]">
                  {tempStartDate && tempEndDate
                    ? `${formatIsoToDisplay(tempStartDate)} → ${formatIsoToDisplay(tempEndDate)}`
                    : tempStartDate
                    ? `From ${formatIsoToDisplay(tempStartDate)}`
                    : "Pick range or select fiscal year"}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsPeriodPickerOpen(false)}
                    className="px-3 py-1.5 text-[12px] font-medium text-[#6E6E73] hover:text-[#1D1D1F] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={commitPeriodSelection}
                    className="px-3.5 py-1.5 bg-[#007AFF] hover:bg-[#0066D6] text-white text-[12px] font-semibold rounded-lg shadow-xs transition-all cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
