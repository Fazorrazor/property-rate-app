"use client";

import { useState, useEffect, useRef, useMemo, useDeferredValue, useCallback } from "react";
import {
  RefreshCw,
  Send,
  Search,
  X,
  AlertTriangle,
  CheckCircle2,
  Info,
  Users,
  Building2,
  Receipt,
  MessageSquare,
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  UploadCloud,
  Settings,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LogOut,
  Flag,
  XCircle,
  ArrowLeft,
  RotateCcw,
  FileText,
} from "lucide-react";
import {
  getAdminOverview,
  getRatepayerHistory,
  getSmsRolloutLogs,
  getAuditTrailList,
  batchDispatchSms,
  getSmsJobStatus,
  retryFailedSmsJob,
  recordManualCashPayment,
  runAnnualBillingBatch,
  getSmsSettings,
  adminLogout,
  getCurrentAdmin,
  AdminDashboardData,
  AdminProperty,
  AdminRatepayerSummary,
  RatepayerHistoryDossier,
  SmsRolloutLogItem,
  AdminAuditLogItem,
  getPaidUsersList,
  AdminPaidUserRecord,
  getSmsRolloutAudience,
} from "./actions";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { RatepayerDossierSheet } from "@/components/RatepayerDossierSheet";
import TransactionDetailWorkbench from "@/components/TransactionDetailWorkbench";
import { SettingsTab } from "@/components/SettingsTab";
import { SupabaseTablePagination } from "@/components/SupabaseTablePagination";
import { SmsRolloutSkeleton } from "@/components/Skeletons";
import { RequiredFieldsFilterPopover, AVAILABLE_FIELD_CRITERIA } from "@/components/RequiredFieldsFilterPopover";
import { AppleSpinner } from "@/components/ui/AppleSpinner";
import { FloatingMobileDock } from "@/components/FloatingMobileDock";
import { RatepayersSupabaseTable } from "@/components/RatepayersSupabaseTable";
import { UniversalDatabaseTable } from "@/components/UniversalDatabaseTable";
import { AccountBillHistoryView } from "@/components/AccountBillHistoryView";
import { TableFilterPopover } from "@/components/TableFilterPopover";
import { AccountStatementDialog } from "@/components/AccountStatementDialog";
import { AccountStatementReportView } from "@/components/AccountStatementReportView";
import { OfficerStatementView } from "@/components/OfficerStatementView";
import PaymentsSection from "@/components/PaymentsSection";
import { AccountsBiodataSection } from "@/components/AccountsBiodataSection";
import { SigningOutScreen } from "@/components/SigningOutScreen";
import { SessionTimer } from "@/components/SessionTimer";
import { DATABASE_TABLE_DEFINITIONS } from "@/lib/database-tables-config";

const PropertyModal = dynamic(
  () => import("@/components/PropertyModal").then((m) => m.PropertyModal),
  { ssr: false }
);

const CsvImportModal = dynamic(
  () => import("@/components/CsvImportModal").then((m) => m.CsvImportModal),
  { ssr: false }
);

const SmsRolloutSimulator = dynamic(
  () => import("@/components/SmsRolloutSimulator").then((m) => m.SmsRolloutSimulator),
  {
    ssr: false,
    loading: () => <SmsRolloutSkeleton />,
  }
);

type NavTab = "STATEMENTS" | "PAYMENTS" | "ACCOUNTS" | "SMS_CENTER" | "AUDIT_LOGS" | "REGISTRY" | "RATEPAYERS" | "PAID_USERS" | "FEE_PAYMENTS" | "SETTINGS";

const OFFICER_ALLOWED_TABS: NavTab[] = ["STATEMENTS", "PAYMENTS"];

const ALL_NAV_TABS: { key: NavTab; label: string; shortLabel: string; icon: any }[] = [
  { key: "STATEMENTS", label: "Statements", shortLabel: "Statements", icon: FileText },
  { key: "PAYMENTS", label: "Payments", shortLabel: "Payments", icon: Receipt },
  { key: "ACCOUNTS", label: "Accounts", shortLabel: "Accounts", icon: Users },
  { key: "RATEPAYERS", label: "Property Owners", shortLabel: "Owners", icon: Users },
  { key: "REGISTRY", label: "Properties", shortLabel: "Properties", icon: Building2 },
  { key: "PAID_USERS", label: "Paid Ratepayers", shortLabel: "Paid Users", icon: CreditCard },
  { key: "FEE_PAYMENTS", label: "Fee Payments", shortLabel: "Payments", icon: Receipt },
  { key: "SMS_CENTER", label: "Send SMS Bills", shortLabel: "SMS Bills", icon: MessageSquare },
  { key: "AUDIT_LOGS", label: "Activity Log", shortLabel: "Activity", icon: ShieldCheck },
  { key: "SETTINGS", label: "SMS & App Settings", shortLabel: "Settings", icon: Settings },
];

const NAV_TABS: { key: NavTab; label: string; shortLabel: string; icon: any }[] = [
  { key: "STATEMENTS", label: "Statements", shortLabel: "Statements", icon: FileText },
  { key: "PAYMENTS", label: "Payments", shortLabel: "Payments", icon: Receipt },
  { key: "ACCOUNTS", label: "Accounts", shortLabel: "Accounts", icon: Users },
  { key: "SMS_CENTER", label: "Send SMS Bills", shortLabel: "SMS Bills", icon: MessageSquare },
];

interface AdminDashboardClientProps {
  initialTab: NavTab;
  initialAdmin: { id: string; username: string; name: string; role: string } | null;
  initialAccountNo?: string;
}

export default function AdminDashboardClient({ initialTab, initialAdmin, initialAccountNo }: AdminDashboardClientProps) {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [propertiesList, setPropertiesList] = useState<AdminProperty[]>([]);
  const [currentPropertyPage, setCurrentPropertyPage] = useState(1);
  const [propertyLimit, setPropertyLimit] = useState(50);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const [ratepayerProperties, setRatepayerProperties] = useState<AdminProperty[]>([]);
  const [ratepayersTotal, setRatepayersTotal] = useState(0);
  const [ratepayerPropertiesDueFormatted, setRatepayerPropertiesDueFormatted] = useState("GH₵ 0.00");
  const [currentRatepayerPage, setCurrentRatepayerPage] = useState(1);
  const [ratepayerLimit, setRatepayerLimit] = useState(50);
  const [isLoadingRatepayers, setIsLoadingRatepayers] = useState(false);
  const [ratepayerSearchQuery, setRatepayerSearchQuery] = useState("");
  const deferredRatepayerSearchQuery = useDeferredValue(ratepayerSearchQuery);
  const [smsLogs, setSmsLogs] = useState<SmsRolloutLogItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogItem[]>([]);
  const [auditLogsTotal, setAuditLogsTotal] = useState(0);
  const [currentAuditLogPage, setCurrentAuditLogPage] = useState(1);
  const [auditLogLimit, setAuditLogLimit] = useState(50);
  const [isLoadingAuditLogs, setIsLoadingAuditLogs] = useState(false);
  const [auditLogSearchQuery, setAuditLogSearchQuery] = useState("");
  const deferredAuditLogSearchQuery = useDeferredValue(auditLogSearchQuery);
  const [auditLogActionFilter, setAuditLogActionFilter] = useState("ALL");
  const auditLogTableContainerRef = useRef<HTMLDivElement>(null);

  const [isInitialLoading, setIsInitialLoading] = useState(initialTab === "REGISTRY" && initialAdmin?.role !== "OFFICER");
  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Admin state seeded from server — also kept in sync with localStorage for future visits
  const [currentAdmin, setCurrentAdmin] = useState<{ id: string; username: string; name: string; role: string } | null>(initialAdmin);
  const isAssemblyOfficer = currentAdmin?.role === "OFFICER";

  // Active Tab State — seeded from server cookie so Frame 0 HTML is already correct
  const [activeTab, setActiveTab] = useState<NavTab>(
    NAV_TABS.some((t) => t.key === initialTab) ? initialTab : "STATEMENTS"
  );

  // Paid Ratepayers Directory States
  const [paidUsers, setPaidUsers] = useState<AdminPaidUserRecord[]>([]);
  const [paidUsersTotal, setPaidUsersTotal] = useState(0);
  const [paidUsersTotalAmount, setPaidUsersTotalAmount] = useState(0);
  const [currentPaidUsersPage, setCurrentPaidUsersPage] = useState(1);
  const [paidUsersLimit, setPaidUsersLimit] = useState(50);
  const [isLoadingPaidUsers, setIsLoadingPaidUsers] = useState(false);
  const [paidUsersSearchQuery, setPaidUsersSearchQuery] = useState("");
  const deferredPaidUsersSearchQuery = useDeferredValue(paidUsersSearchQuery);
  const hasLoadedPaidUsersRef = useRef(false);
  const [copiedReference, setCopiedReference] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<AdminPaidUserRecord | null>(null);
  const paidUsersTableContainerRef = useRef<HTMLDivElement>(null);
  // Active Municipal Database Table Filter (for Ratepayers & Municipal Datasets)
  const allowedRatepayerTables = useMemo(() => {
    return isAssemblyOfficer
      ? ["FeePayments", "Bill"]
      : ["Property", "FeePayments", "Bill"];
  }, [isAssemblyOfficer]);
  const [selectedRatepayerTable, setSelectedRatepayerTable] = useState<string>(
    isAssemblyOfficer ? "FeePayments" : "Property"
  );
  const [tableVisibleColumns, setTableVisibleColumns] = useState<Record<string, string[]>>({});
  const [universalTableSearchQuery, setUniversalTableSearchQuery] = useState("");
  const [isAccountBillDetailActive, setIsAccountBillDetailActive] = useState(false);

  // Dedicated Fee Payments Table States
  const [feePaymentsSearchQuery, setFeePaymentsSearchQuery] = useState("");
  const [feePaymentsCount, setFeePaymentsCount] = useState<{ count: number; total: number }>({ count: 830, total: 830 });
  const [feePaymentsViewMode, setFeePaymentsViewMode] = useState<"ACCOUNTS_MANAGER" | "DATABASE_RECORDS">("ACCOUNTS_MANAGER");

  // High-Security SMS Authorization Modal States (Targeted & Selective)
  const [showSmsAuthModal, setShowSmsAuthModal] = useState(false);
  const [smsAuthTargetAccounts, setSmsAuthTargetAccounts] = useState<AdminProperty[]>([]);
  const [smsAuthPassword, setSmsAuthPassword] = useState("");
  const [showSmsAuthPassword, setShowSmsAuthPassword] = useState(false);
  const [smsAuthError, setSmsAuthError] = useState<string | null>(null);

  // Bulk CSV Cadastre Importer State
  const [showCsvImportModal, setShowCsvImportModal] = useState(false);

  // Desktop Supabase-Style Curtain Sidebar Hover State
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [manualAccountSearch, setManualAccountSearch] = useState("");

  // Reports Suite States (Figma 3:3195, 3:3312, 3:3741)
  const [statementAccountParam, setStatementAccountParam] = useState<string | undefined>(initialAccountNo);
  const [isReportsPopoverOpen, setIsReportsPopoverOpen] = useState(false);
  const [isAccountStatementDialogOpen, setIsAccountStatementDialogOpen] = useState(false);
  const [statementAccountNo, setStatementAccountNo] = useState<string | null>(null);
  const [statementStartDate, setStatementStartDate] = useState<string | undefined>(undefined);
  const [statementEndDate, setStatementEndDate] = useState<string | undefined>(undefined);
  const [isStatementReportActive, setIsStatementReportActive] = useState(false);
  const reportsPopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isReportsPopoverOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (reportsPopoverRef.current && !reportsPopoverRef.current.contains(e.target as Node)) {
        setIsReportsPopoverOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isReportsPopoverOpen]);

  const visibleNavTabs = useMemo(() => {
    if (isAssemblyOfficer) {
      return NAV_TABS.filter((t) => OFFICER_ALLOWED_TABS.includes(t.key));
    }
    return NAV_TABS;
  }, [isAssemblyOfficer]);

  // Return to Ratepayer Dossier from Property Roll
  const [returnToRatepayerDossier, setReturnToRatepayerDossier] = useState<{ id: string; name: string; preview: any } | null>(null);

  useEffect(() => {
    const verifySession = async () => {
      try {
        const admin = await getCurrentAdmin();
        if (admin) {
          setCurrentAdmin(admin);
          try {
            localStorage.setItem("admin_current_user", JSON.stringify(admin));
          } catch {}
          if (admin.role === "OFFICER") {
            setActiveTab((prev) => (OFFICER_ALLOWED_TABS.includes(prev) ? prev : "STATEMENTS"));
          }
        } else {
          try {
            localStorage.removeItem("admin_current_user");
            localStorage.removeItem("heinz_admin_session_expiry");
          } catch {}
          window.location.href = "/login";
        }
      } catch {
        try {
          localStorage.removeItem("admin_current_user");
          localStorage.removeItem("heinz_admin_session_expiry");
        } catch {}
        window.location.href = "/login";
      }
    };

    verifySession();

    // Periodic session heartbeat check every 30 seconds
    const handleFocus = () => {
      verifySession();
    };
    window.addEventListener("focus", handleFocus);
    const sessionHeartbeat = setInterval(verifySession, 30000);

    return () => {
      window.removeEventListener("focus", handleFocus);
      clearInterval(sessionHeartbeat);
    };
  }, []);


  // Helper: Synchronize state with URL search params and localStorage
  const updateUrlAndStorage = (key: string, value: string, storageKey: string, push: boolean = false) => {
    try {
      if (value && value !== "ALL") {
        localStorage.setItem(storageKey, value);
      } else {
        localStorage.removeItem(storageKey);
      }
      const params = new URLSearchParams(window.location.search);
      if (value && value !== "ALL") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
      if (push) {
        window.history.pushState({ [key]: value }, "", newUrl);
      } else {
        window.history.replaceState(null, "", newUrl);
      }
    } catch {
      // non-fatal
    }
  };

  // Tab persistence, Deep link synchronization, & Cookie write for server-side refresh
  const handleTabChange = (newTab: NavTab, targetAccount?: string) => {
    if (isAssemblyOfficer && !OFFICER_ALLOWED_TABS.includes(newTab)) {
      return;
    }
    setIsAccountBillDetailActive(false);
    setIsStatementReportActive(false);

    isNavigatingRef.current = true;
    setActiveTab(newTab);
    setIsHeaderVisible(true);
    lastScrollTopRef.current = 0;
    tableContainerRef.current?.scrollTo({ top: 0, behavior: "instant" });
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "instant" });
    }

    if (targetAccount && targetAccount.trim()) {
      const cleanAcc = targetAccount.trim();
      setStatementAccountParam(cleanAcc);
      try {
        localStorage.setItem("kkma_officer_statement_account", cleanAcc);
        document.cookie = `kkma_officer_statement_account=${encodeURIComponent(cleanAcc)}; path=/; max-age=86400; SameSite=Lax`;
        const params = new URLSearchParams(window.location.search);
        params.set("tab", newTab);
        params.set("account", cleanAcc);
        const newUrl = `${window.location.pathname}?${params.toString()}`;
        window.history.pushState({ tab: newTab, account: cleanAcc }, "", newUrl);
        localStorage.setItem("admin_active_tab", newTab);
        document.cookie = `admin_active_tab=${newTab}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
      } catch {}
    } else {
      setStatementAccountParam(undefined);
      try {
        localStorage.removeItem("kkma_officer_statement_account");
        document.cookie = "kkma_officer_statement_account=; path=/; max-age=0; SameSite=Lax";
        const params = new URLSearchParams(window.location.search);
        params.set("tab", newTab);
        params.delete("account");
        params.delete("accountNumber");
        params.delete("accountNo");
        params.delete("start");
        params.delete("end");
        params.delete("dossier");
        const newUrl = `${window.location.pathname}?${params.toString()}`;
        window.history.pushState({ tab: newTab }, "", newUrl);
        localStorage.setItem("admin_active_tab", newTab);
        document.cookie = `admin_active_tab=${newTab}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
      } catch {}
    }

    requestAnimationFrame(() => {
      setTimeout(() => {
        isNavigatingRef.current = false;
      }, 150);
    });
  };

  // Ratepayer Dossier State
  const [selectedRatepayerDossier, setSelectedRatepayerDossier] = useState<RatepayerHistoryDossier | null>(null);
  const [previewRatepayer, setPreviewRatepayer] = useState<AdminRatepayerSummary | null>(null);
  const [isDossierOpen, setIsDossierOpen] = useState(false);
  const [isFetchingDossier, setIsFetchingDossier] = useState(false);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Hardware/Device & Browser Back/Forward navigation listener
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handlePopState = () => {
      try {
        const params = new URLSearchParams(window.location.search);

        // Handle dossier modal back navigation
        if (!params.has("dossier") && isDossierOpen) {
          setIsDossierOpen(false);
          setSelectedRatepayerDossier(null);
          setPreviewRatepayer(null);
        }

        // Handle tab back navigation
        const rawTabParam = params.get("tab") as NavTab | null;
        const validTab: NavTab = rawTabParam && ALL_NAV_TABS.some((t) => t.key === rawTabParam)
          ? rawTabParam
          : "STATEMENTS";

        if (validTab !== activeTab) {
          if (!isAssemblyOfficer || OFFICER_ALLOWED_TABS.includes(validTab)) {
            setActiveTab(validTab);
            document.cookie = `admin_active_tab=${validTab}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
          }
        }

        // Handle account selection back navigation
        const accParam = params.get("account") || params.get("accountNumber") || params.get("accountNo");
        if (accParam && accParam.trim()) {
          setStatementAccountParam(accParam.trim());
        } else {
          setStatementAccountParam(undefined);
          try {
            localStorage.removeItem("kkma_officer_statement_account");
            document.cookie = "kkma_officer_statement_account=; path=/; max-age=0; SameSite=Lax";
          } catch {}
        }
      } catch {
        // non-fatal
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [isDossierOpen, activeTab, isAssemblyOfficer]);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchingProperties, setIsSearchingProperties] = useState(false);
  const [municipalityFilter] = useState("Kpone-Katamanso (KKMA)");
  const [classificationFilter, setClassificationFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PAID" | "UNPAID" | "DEFAULTER">("ALL");
  const [propertyRequiredFields, setPropertyRequiredFields] = useState<string[]>([]);
  const [ratepayerRequiredFields, setRatepayerRequiredFields] = useState<string[]>([]);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // React 19 Deferred Search Queries for <16ms Non-Blocking Keystrokes
  const deferredSearchQuery = useDeferredValue(searchQuery);

  // Filter Synchronization Handlers (Persistent Across Refreshes & URL Deep Linking)
  const handleStatusFilterChange = (newStatus: "ALL" | "PAID" | "UNPAID" | "DEFAULTER") => {
    setStatusFilter(newStatus);
    updateUrlAndStorage("status", newStatus, "admin_registry_status");
  };

  const handleClassificationFilterChange = (newClass: string) => {
    setClassificationFilter(newClass);
    updateUrlAndStorage("class", newClass, "admin_registry_class");
  };

  const handleAuditLogActionFilterChange = (newAction: string) => {
    setAuditLogActionFilter(newAction);
    loadAuditLogs(auditLogSearchQuery, newAction, 1);
    updateUrlAndStorage("auditAction", newAction, "admin_audit_action");
  };

  // On mount: persist initialAdmin to localStorage so future client-side reads work correctly
  useEffect(() => {
    if (initialAdmin) {
      try {
        localStorage.setItem("admin_current_user", JSON.stringify(initialAdmin));
      } catch {}
    }
    // Sync URL with the server-resolved tab on first paint
    try {
      const params = new URLSearchParams(window.location.search);
      if (!params.get("tab") || params.get("tab") !== initialTab) {
        params.set("tab", initialTab);
        window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
      }
    } catch {}
  }, []);

  const activePropertyQueryRef = useRef("");
  const activeAuditQueryRef = useRef("");

  const baselineOverviewRef = useRef<AdminDashboardData | null>(null);
  const baselineAuditLogsRef = useRef<{ logs: AdminAuditLogItem[]; total: number } | null>(null);

  // Selection & Drawer states
  const [selectedAccount, setSelectedAccount] = useState<AdminProperty | null>(null);
  const [selectedAccountSiblings, setSelectedAccountSiblings] = useState<AdminProperty[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPropertyModal, setShowPropertyModal] = useState(false);
  const [manualAmount, setManualAmount] = useState("");
  const [manualMethod, setManualMethod] = useState("Cash");
  const [paymentAdminPassword, setPaymentAdminPassword] = useState("");
  const [showPaymentPassword, setShowPaymentPassword] = useState(false);

  // Global Modal Active State for Background Interaction & Scroll Shielding
  const isAnyModalActive = Boolean(
    selectedAccount ||
    showBatchModal ||
    showPaymentModal ||
    showPropertyModal ||
    showSmsAuthModal ||
    showCsvImportModal ||
    isAccountStatementDialogOpen ||
    isDossierOpen
  );

  useEffect(() => {
    if (isAnyModalActive) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isAnyModalActive]);

  // Batch Rollout States
  const [residentialRate, setResidentialRate] = useState("0.005");
  const [commercialRate, setCommercialRate] = useState("0.015");
  const [otherRate] = useState("0.010");
  const [dueDate, setDueDate] = useState("30-Jun-2025");
  const [batchAdminPassword, setBatchAdminPassword] = useState("");
  const [showBatchPassword, setShowBatchPassword] = useState(false);
  const [messageTemplate, setMessageTemplate] = useState(
    "Dear {{municipality}} Resident,\n\nDo find below your {{billYear}} Property Rate bill:\n\nValuation ID: {{accountNumber}}\n\nAmount due: GHS {{totalAmountDue}}\n\nView your bills: {{billLink}}\n\nPay online: {{paymentLink}}\n\nFor payment & enquiries kindly call 0256039385/0538702445\nDisregard if already paid. Keep receipt for verification."
  );

  // Hydrate persistent template from localStorage cache and server configuration
  useEffect(() => {
    try {
      const cached = localStorage.getItem("kkma_sms_message_template");
      if (cached && cached.trim()) {
        if (cached.includes("*227*4362#") || cached.includes("GH₵") || cached.includes("Pay Via")) {
          const sanitized = cached
            .replace(/Pay Via \*227\*4362# or ({{paymentLink}}|\S+) with your payment reference {{accountNumber}}/g, 'Pay online: {{paymentLink}}')
            .replace(/Pay Via \*227\*4362# or {{paymentLink}}/g, 'Pay online: {{paymentLink}}')
            .replace(/\*227\*4362# or /g, '')
            .replace(/GH₵/g, 'GHS');
          localStorage.setItem("kkma_sms_message_template", sanitized);
          setMessageTemplate(sanitized);
        } else {
          setMessageTemplate(cached);
        }
      }
    } catch { }

    getSmsSettings()
      .then((settings) => {
        if (settings?.messageTemplate) {
          setMessageTemplate(settings.messageTemplate);
          try {
            localStorage.setItem("kkma_sms_message_template", settings.messageTemplate);
          } catch { }
        }
      })
      .catch(() => { });
  }, []);

  const loadData = async (
    page = 1,
    query = searchQuery,
    muni = municipalityFilter,
    classification = classificationFilter,
    status = statusFilter,
    isInitial = false,
    limit = propertyLimit,
    requiredFields = propertyRequiredFields
  ) => {
    if (isInitial) {
      setIsInitialLoading(true);
    } else {
      setIsSearchingProperties(true);
    }

    try {
      // 1. High-speed database overview with exact filter counts
      const overviewRes = await getAdminOverview(
        page,
        limit,
        muni,
        query,
        classification,
        status as any,
        requiredFields
      );
      // Discard stale responses if user changed query in the meantime
      if (activePropertyQueryRef.current !== query) {
        return;
      }
      setData(overviewRes);
      setPropertiesList(overviewRes?.properties || []);
      setCurrentPropertyPage(page);

      // Cache baseline dataset when query is empty and filters are default
      if (!query && muni === "ALL" && classification === "ALL" && (status === "ALL" || !status)) {
        baselineOverviewRef.current = overviewRes;
      }

      if (tableContainerRef.current) {
        tableContainerRef.current.scrollTop = 0;
      }

      if (selectedAccount && overviewRes) {
        const updated = overviewRes.properties.find((p) => p.id === selectedAccount.id);
        if (updated) setSelectedAccount(updated);
      }
    } catch (err) {
      console.error("Error loading admin overview:", err);
      showToast("Failed to load municipal overview.", "error");
    } finally {
      if (isInitial) setIsInitialLoading(false);
      setIsSearchingProperties(false);
    }
  };

  const loadAuditLogs = async (query = auditLogSearchQuery, actionFilter = auditLogActionFilter, page = 1, limit = auditLogLimit) => {
    setIsLoadingAuditLogs(true);
    try {
      const res = await getAuditTrailList(query, actionFilter, page, limit);
      if (activeAuditQueryRef.current !== query) {
        return;
      }
      if (res) {
        setAuditLogs(res.logs);
        setAuditLogsTotal(res.total);
        setCurrentAuditLogPage(page);
        if (auditLogTableContainerRef.current) {
          auditLogTableContainerRef.current.scrollTop = 0;
        }
        if (!query && actionFilter === "ALL") {
          baselineAuditLogsRef.current = res;
        }
      }
    } catch (err) {
      console.error("Error loading audit logs:", err);
      showToast("Failed to refresh audit trail.", "error");
    } finally {
      setIsLoadingAuditLogs(false);
    }
  };

  const handlePropertyPageChange = (newPage: number) => {
    isNavigatingRef.current = true;
    tableContainerRef.current?.scrollTo({ top: 0, behavior: "instant" });
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
    loadData(newPage, searchQuery, municipalityFilter, classificationFilter, statusFilter, false, propertyLimit);
    requestAnimationFrame(() => {
      setTimeout(() => {
        isNavigatingRef.current = false;
      }, 150);
    });
  };

  const handlePropertyPageSizeChange = (newLimit: number) => {
    isNavigatingRef.current = true;
    tableContainerRef.current?.scrollTo({ top: 0, behavior: "instant" });
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
    setPropertyLimit(newLimit);
    loadData(1, searchQuery, municipalityFilter, classificationFilter, statusFilter, false, newLimit);
    requestAnimationFrame(() => {
      setTimeout(() => {
        isNavigatingRef.current = false;
      }, 150);
    });
  };

  const handleAuditLogPageChange = (newPage: number) => {
    isNavigatingRef.current = true;
    auditLogTableContainerRef.current?.scrollTo({ top: 0, behavior: "instant" });
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
    loadAuditLogs(auditLogSearchQuery, auditLogActionFilter, newPage, auditLogLimit);
    requestAnimationFrame(() => {
      setTimeout(() => {
        isNavigatingRef.current = false;
      }, 150);
    });
  };

  const handleAuditLogPageSizeChange = (newLimit: number) => {
    isNavigatingRef.current = true;
    auditLogTableContainerRef.current?.scrollTo({ top: 0, behavior: "instant" });
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
    setAuditLogLimit(newLimit);
    loadAuditLogs(auditLogSearchQuery, auditLogActionFilter, 1, newLimit);
    requestAnimationFrame(() => {
      setTimeout(() => {
        isNavigatingRef.current = false;
      }, 150);
    });
  };

  // Initial load once on mount — ONLY for the REGISTRY (Properties) tab.
  // Officers and admins on other tabs skip this expensive cadastre query entirely.
  useEffect(() => {
    if (activeTab === "REGISTRY" && !isAssemblyOfficer) {
      loadData(1, "", "ALL", "ALL", "ALL", true, propertyLimit, propertyRequiredFields);
    }
  }, []);

  // Scroll-Aware Collapsing Subheader state (Pure Directional Headroom Pattern - Zero Idle Resets)
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const lastScrollTopRef = useRef(0);
  const isNavigatingRef = useRef(false);

  const handleTableScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    // 0. Suppress scroll-driven state updates during navigation, pagination, or tab changes
    if (isNavigatingRef.current) return;

    // Only active on mobile viewports (< 640px)
    if (typeof window !== "undefined" && window.innerWidth >= 640) {
      if (!isHeaderVisible) setIsHeaderVisible(true);
      return;
    }

    const currentScrollTop = e.currentTarget.scrollTop;
    const scrollHeight = e.currentTarget.scrollHeight;
    const clientHeight = e.currentTarget.clientHeight;

    // iOS Rubber-Band / Overscroll Protection
    // A. Top bounce: if currentScrollTop <= 0, lock to top and reveal
    if (currentScrollTop <= 0) {
      if (!isHeaderVisible) setIsHeaderVisible(true);
      lastScrollTopRef.current = 0;
      return;
    }
    // B. Bottom bounce: ignore overscroll beyond scrollable height
    if (currentScrollTop >= scrollHeight - clientHeight - 8) {
      return;
    }

    const lastScrollTop = lastScrollTopRef.current;
    const deltaY = currentScrollTop - lastScrollTop;

    // Require a minimum organic delta (10px) to prevent layout reflow micro-jitter
    if (Math.abs(deltaY) < 10) return;

    // Collapse when scrolling down past the top band
    if (deltaY > 0 && currentScrollTop > 60) {
      if (isHeaderVisible) setIsHeaderVisible(false);
    }
    // Expand ONLY when actually at the very top of the page
    else if (currentScrollTop <= 10) {
      if (!isHeaderVisible) setIsHeaderVisible(true);
    }

    lastScrollTopRef.current = currentScrollTop;
  }, [isHeaderVisible]);

  // Reload properties when required fields change
  useEffect(() => {
    if (!isInitialLoading) {
      loadData(1, searchQuery, municipalityFilter, classificationFilter, statusFilter, false, propertyLimit, propertyRequiredFields);
    }
  }, [propertyRequiredFields]);

  // Debounced background server search for Properties without unmounting whole page
  useEffect(() => {
    if (isInitialLoading) return;
    activePropertyQueryRef.current = searchQuery;
    if (!searchQuery.trim()) {
      setIsSearchingProperties(false);
      // Fast-path: instant 0ms restoration of baseline overview
      if (
        baselineOverviewRef.current &&
        (municipalityFilter === "ALL" || municipalityFilter === "Kpone-Katamanso (KKMA)") &&
        classificationFilter === "ALL" &&
        statusFilter === "ALL"
      ) {
        setData(baselineOverviewRef.current);
        setPropertiesList(baselineOverviewRef.current.properties || []);
        setCurrentPropertyPage(1);
      }
      loadData(1, "", municipalityFilter, classificationFilter, statusFilter, false);
      return;
    }
    const timer = setTimeout(() => {
      setIsSearchingProperties(true);
      loadData(1, searchQuery, municipalityFilter, classificationFilter, statusFilter, false);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleClearPropertySearch = () => {
    setSearchQuery("");
    activePropertyQueryRef.current = "";
    setIsSearchingProperties(false);
    if (
      baselineOverviewRef.current &&
      (municipalityFilter === "ALL" || municipalityFilter === "Kpone-Katamanso (KKMA)") &&
      classificationFilter === "ALL" &&
      statusFilter === "ALL"
    ) {
      setData(baselineOverviewRef.current);
      setPropertiesList(baselineOverviewRef.current.properties || []);
      setCurrentPropertyPage(1);
    }
    loadData(1, "", municipalityFilter, classificationFilter, statusFilter, false);
  };

  // Instant server query for dropdown changes
  useEffect(() => {
    if (isInitialLoading) return;
    loadData(1, searchQuery, municipalityFilter, classificationFilter, statusFilter, false);
  }, [municipalityFilter, classificationFilter, statusFilter]);

  // Dedicated lazy-load for SMS Center logs
  const hasLoadedSmsLogsRef = useRef(false);
  useEffect(() => {
    if (activeTab === "SMS_CENTER" && !hasLoadedSmsLogsRef.current) {
      hasLoadedSmsLogsRef.current = true;
      getSmsRolloutLogs().then((logsRes) => {
        if (logsRes) setSmsLogs(logsRes);
      }).catch((err) => {
        console.error("Error loading SMS rollout logs:", err);
      });
    }
  }, [activeTab]);

  // Dedicated query for Paid Ratepayers Directory
  useEffect(() => {
    if (activeTab === "PAID_USERS") {
      setIsLoadingPaidUsers(true);
      const timer = setTimeout(async () => {
        try {
          const res = await getPaidUsersList(
            deferredPaidUsersSearchQuery,
            "LIVE",
            "SUCCESS",
            currentPaidUsersPage,
            paidUsersLimit
          );
          if (res) {
            setPaidUsers(res.records);
            setPaidUsersTotal(res.total);
            setPaidUsersTotalAmount(res.totalAmount);
          }
        } catch (err) {
          console.error("Error loading paid users:", err);
        } finally {
          hasLoadedPaidUsersRef.current = true;
          setIsLoadingPaidUsers(false);
        }
      }, deferredPaidUsersSearchQuery ? 200 : 0);
      return () => clearTimeout(timer);
    }
  }, [activeTab, deferredPaidUsersSearchQuery, currentPaidUsersPage, paidUsersLimit]);

  // Scroll paid users list to top when page changes
  useEffect(() => {
    paidUsersTableContainerRef.current?.scrollTo({ top: 0, behavior: "instant" });
  }, [currentPaidUsersPage]);

  // Dedicated lazy-load for Audit Trail tab
  const hasLoadedAuditLogsRef = useRef(false);
  useEffect(() => {
    if (activeTab === "AUDIT_LOGS" && !hasLoadedAuditLogsRef.current) {
      hasLoadedAuditLogsRef.current = true;
      loadAuditLogs("", auditLogActionFilter, 1);
    }
  }, [activeTab]);

  // Debounced background server search for Audit Trail
  useEffect(() => {
    if (isInitialLoading) return;
    activeAuditQueryRef.current = auditLogSearchQuery;
    if (!auditLogSearchQuery.trim()) {
      if (baselineAuditLogsRef.current && auditLogActionFilter === "ALL") {
        setAuditLogs(baselineAuditLogsRef.current.logs);
        setAuditLogsTotal(baselineAuditLogsRef.current.total);
        setCurrentAuditLogPage(1);
      }
      loadAuditLogs("", auditLogActionFilter, 1);
      return;
    }
    const timer = setTimeout(() => {
      loadAuditLogs(auditLogSearchQuery, auditLogActionFilter, 1);
    }, 250);
    return () => clearTimeout(timer);
  }, [auditLogSearchQuery]);

  const handleClearAuditLogSearch = () => {
    setAuditLogSearchQuery("");
    activeAuditQueryRef.current = "";
    if (baselineAuditLogsRef.current && auditLogActionFilter === "ALL") {
      setAuditLogs(baselineAuditLogsRef.current.logs);
      setAuditLogsTotal(baselineAuditLogsRef.current.total);
      setCurrentAuditLogPage(1);
    }
    loadAuditLogs("", auditLogActionFilter, 1);
  };

  // Dedicated pagination loader for Ratepayers using SMS Rollout Audience engine
  const loadRatepayers = async (query = "", page = 1, limit = ratepayerLimit, requiredFields = ratepayerRequiredFields) => {
    setIsLoadingRatepayers(true);
    try {
      const res = await getSmsRolloutAudience({
        municipality: "Kpone-Katamanso (KKMA)",
        classification: "ALL",
        balanceStatus: "ALL",
        requiredFields,
        searchQuery: query.trim() || undefined,
        page,
        limit,
      });
      if (res) {
        setRatepayerProperties(res.properties || []);
        setRatepayersTotal(res.totalCount || 0);
        setRatepayerPropertiesDueFormatted(res.totalDueFormatted || "GH₵ 0.00");
        setCurrentRatepayerPage(page);
      }
    } catch (err) {
      console.error("Error loading ratepayers list:", err);
    } finally {
      setIsLoadingRatepayers(false);
    }
  };

  const handleRatepayerPageChange = (newPage: number) => {
    isNavigatingRef.current = true;
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
    loadRatepayers(deferredRatepayerSearchQuery, newPage, ratepayerLimit, ratepayerRequiredFields);
    requestAnimationFrame(() => {
      setTimeout(() => {
        isNavigatingRef.current = false;
      }, 150);
    });
  };

  const handleRatepayerPageSizeChange = (newLimit: number) => {
    isNavigatingRef.current = true;
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
    setRatepayerLimit(newLimit);
    loadRatepayers(deferredRatepayerSearchQuery, 1, newLimit, ratepayerRequiredFields);
    requestAnimationFrame(() => {
      setTimeout(() => {
        isNavigatingRef.current = false;
      }, 150);
    });
  };

  useEffect(() => {
    if (activeTab === "RATEPAYERS") {
      loadRatepayers(deferredRatepayerSearchQuery, 1, ratepayerLimit, ratepayerRequiredFields);
    }
  }, [activeTab, deferredRatepayerSearchQuery, ratepayerRequiredFields]);


  // Lock background scroll when any modal, bottom sheet, or drawer is active across the entire app
  useEffect(() => {
    const isAnyModalOpen = Boolean(
      selectedAccount ||
      showBatchModal ||
      showPaymentModal ||
      showPropertyModal ||
      isDossierOpen ||
      showSmsAuthModal ||
      showCsvImportModal ||
      selectedTransaction
    );
    if (isAnyModalOpen) {
      const originalBodyOverflow = document.body.style.overflow;
      const originalDocOverflow = document.documentElement.style.overflow;
      const originalTouchAction = document.body.style.touchAction;
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
      document.body.style.touchAction = "none";
      return () => {
        document.body.style.overflow = originalBodyOverflow;
        document.documentElement.style.overflow = originalDocOverflow;
        document.body.style.touchAction = originalTouchAction;
      };
    }
  }, [
    selectedAccount,
    showBatchModal,
    showPaymentModal,
    showPropertyModal,
    isDossierOpen,
    showSmsAuthModal,
    showCsvImportModal,
    selectedTransaction,
  ]);


  // Open Ratepayer Dossier (Instant popup <50ms with background lazy loading)
  const handleOpenRatepayerDossier = (userId: string, preview?: AdminRatepayerSummary) => {
    const initialPreview = preview || null;
    setPreviewRatepayer(initialPreview);
    setSelectedRatepayerDossier(null);
    setIsDossierOpen(true);
    setIsFetchingDossier(true);
    if (typeof window !== "undefined") {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("dossier", userId);
        window.history.pushState({ dossier: userId }, "", url.pathname + url.search);
      } catch {}
    }

    getRatepayerHistory(userId)
      .then((dossier) => {
        if (dossier) {
          setSelectedRatepayerDossier(dossier);
        } else {
          showToast("Could not load full ratepayer history.", "error");
        }
      })
      .catch((err) => {
        console.error("Error retrieving ratepayer dossier:", err);
        showToast("Error retrieving citizen dossier.", "error");
      })
      .finally(() => {
        setIsFetchingDossier(false);
      });
  };

  // SMS async job queue state
  const [smsJobId, setSmsJobId] = useState<string | null>(null);
  const [smsJobProgress, setSmsJobProgress] = useState<{ status: string; sentCount: number; failedCount: number; totalCount: number; failedAccountCount?: number } | null>(null);
  const [isRetryingSms, setIsRetryingSms] = useState(false);

  // Poll SMS job status every 2s while a job is active
  useEffect(() => {
    if (!smsJobId) return;
    let cancelled = false;
    const poll = async () => {
      if (cancelled) return;
      const status = await getSmsJobStatus(smsJobId).catch(() => null);
      if (cancelled) return;
      setSmsJobProgress(status);
      if (status && (status.status === "DONE" || status.status === "FAILED")) {
        // Job complete — refresh logs
        getSmsRolloutLogs().then((logs) => { if (!cancelled) setSmsLogs(logs); });
        // Only auto-dismiss if completely successful (0 failures).
        // If there are failures, keep banner visible so admin can inspect or retry.
        if (status.failedCount === 0) {
          setTimeout(() => { if (!cancelled) { setSmsJobId(null); setSmsJobProgress(null); } }, 4000);
        }
      } else {
        setTimeout(poll, 2000);
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [smsJobId]);

  const handleRetryActiveSmsJob = async () => {
    if (!smsJobId || isRetryingSms) return;
    setIsRetryingSms(true);
    try {
      const res = await retryFailedSmsJob(smsJobId);
      if (res.success && res.jobId) {
        showToast(res.message || "Retry job started.", "success");
        setSmsJobId(res.jobId);
        setSmsJobProgress({ status: "QUEUED", sentCount: 0, failedCount: 0, totalCount: res.dispatchedCount ?? 0 });
      } else {
        showToast(res.error || "Failed to retry SMS rollout.", "error");
      }
    } catch (err: any) {
      showToast(err.message || "Retry dispatch failed.", "error");
    } finally {
      setIsRetryingSms(false);
    }
  };

  const handleBatchDispatchSms = async (accountNumbers?: any, customTpl?: string, adminPassword?: string, mode?: "TEST" | "LIVE") => {
    const targets = accountNumbers || selectedIds;
    if (!targets || (Array.isArray(targets) && targets.length === 0)) return { success: false, error: "No target accounts selected." };

    const clientMode = mode || (typeof window !== "undefined" ? (localStorage.getItem("kkma_sms_dispatch_mode") as any) : undefined);

    setIsProcessing(true);
    try {
      const res = await batchDispatchSms(targets, adminPassword, customTpl, undefined, clientMode);
      if (res.success) {
        // Store jobId to begin polling — modal closes immediately
        if ((res as any).jobId) {
          setSmsJobId((res as any).jobId);
          setSmsJobProgress({ status: "QUEUED", sentCount: 0, failedCount: 0, totalCount: targets.length });
        }
        showToast(`SMS rollout queued for ${res.dispatchedCount} accounts. Processing in background...`, "success");
        setSelectedIds([]);
        return { success: true, jobId: (res as any).jobId, dispatchedCount: res.dispatchedCount };
      } else {
        showToast(res.error || "Batch dispatch failed.", "error");
        return { success: false, error: res.error };
      }
    } catch (err) {
      console.error(err);
      showToast("Batch dispatch error.", "error");
      return { success: false, error: "Batch dispatch failed." };
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExecuteSmsDispatch = async () => {
    if (!smsAuthPassword.trim()) {
      setSmsAuthError("Administrator security password is required.");
      return;
    }

    const targetAccountNumbers = smsAuthTargetAccounts.map((p) => p.accountNumber);
    if (targetAccountNumbers.length === 0) {
      setSmsAuthError("No target accounts specified.");
      return;
    }

    const clientMode = typeof window !== "undefined" ? (localStorage.getItem("kkma_sms_dispatch_mode") as any) : undefined;
    setIsProcessing(true);
    setSmsAuthError(null);
    try {
      const res = await batchDispatchSms(targetAccountNumbers, smsAuthPassword, undefined, undefined, clientMode);
      if (res.success) {
        showToast(
          `Successfully dispatched dual-link SMS Demand Notices to ${res.dispatchedCount} accounts.`,
          "success"
        );
        setShowSmsAuthModal(false);
        setSmsAuthPassword("");
        setSmsAuthTargetAccounts([]);
        setSelectedIds([]);
        const updatedLogs = await getSmsRolloutLogs();
        setSmsLogs(updatedLogs);
      } else {
        setSmsAuthError(res.error || "Authorization failed.");
      }
    } catch (err) {
      console.error(err);
      setSmsAuthError("An unexpected error occurred during dispatch.");
    } finally {
      setIsProcessing(false);
    }
  };



  const handleRunBatchBilling = async () => {
    if (!batchAdminPassword.trim()) {
      showToast("Administrator security password is required.", "error");
      return;
    }
    setIsProcessing(true);
    try {
      const res = await runAnnualBillingBatch({
        residentialRate: parseFloat(residentialRate) || 0.005,
        commercialRate: parseFloat(commercialRate) || 0.015,
        otherRate: parseFloat(otherRate) || 0.01,
        dueDate: dueDate || "30-Jun-2025",
        messageTemplate: messageTemplate,
        adminPassword: batchAdminPassword,
      });
      if (res.success) {
        setShowBatchModal(false);
        setBatchAdminPassword("");
        showToast(`Successfully executed annual batch billing for ${res.count} property accounts with dual-link SMS queue.`, "success");
        await loadData();
      } else {
        showToast(res.error || "Batch billing failed.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Batch billing execution error.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetAccountNo = selectedAccount?.accountNumber || manualAccountSearch.trim();
    if (!targetAccountNo) {
      showToast("Please specify or select a property account number.", "error");
      return;
    }
    const num = parseFloat(manualAmount);
    if (isNaN(num) || num <= 0) {
      showToast("Please enter a valid payment amount.", "error");
      return;
    }
    if (!paymentAdminPassword.trim()) {
      showToast("Security authorization password is required.", "error");
      return;
    }

    setIsProcessing(true);
    try {
      const res = await recordManualCashPayment(targetAccountNo, num, manualMethod, paymentAdminPassword);
      if (res.success) {
        setShowPaymentModal(false);
        setManualAmount("");
        setPaymentAdminPassword("");
        setManualAccountSearch("");
        showToast(`Payment recorded successfully. GCR Receipt #${res.receiptNumber}`, "success");

        // Optimistically update selectedAccount
        if (selectedAccount && selectedAccount.accountNumber === targetAccountNo && res.updatedProperty) {
          const updStatus = (res.updatedProperty.status as 'PAID' | 'PARTIALLY_PAID' | 'UNPAID') || selectedAccount.status;
          setSelectedAccount((prev) =>
            prev
              ? {
                  ...prev,
                  ...res.updatedProperty,
                  status: updStatus,
                  receipts: res.receipt ? [res.receipt, ...(prev.receipts || [])] : prev.receipts,
                }
              : null
          );
        }

        // Optimistically update propertiesList
        if (res.updatedProperty) {
          const updStatus = res.updatedProperty.status as 'PAID' | 'PARTIALLY_PAID' | 'UNPAID';
          setPropertiesList((prev) =>
            prev.map((p) =>
              p.accountNumber === targetAccountNo
                ? {
                    ...p,
                    ...res.updatedProperty,
                    status: updStatus || p.status,
                    receipts: res.receipt ? [res.receipt, ...(p.receipts || [])] : p.receipts,
                  }
                : p
            )
          );
        }

        // Cross-tab synchronization: Refresh ratepayer dossier if open
        if (selectedRatepayerDossier) {
          try {
            const refreshedDossier = await getRatepayerHistory(selectedRatepayerDossier.user.id);
            if (refreshedDossier) {
              setSelectedRatepayerDossier(refreshedDossier);
            }
          } catch (dossierErr) {
            console.error("Failed to refresh ratepayer dossier:", dossierErr);
          }
        }

        await loadData();
      } else {
        showToast(res.error || "Payment recording failed.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Payment recording error.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredProperties.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredProperties.map((p) => p.accountNumber));
    }
  };

  const toggleSelectRow = (accountNumber: string) => {
    if (selectedIds.includes(accountNumber)) {
      setSelectedIds(selectedIds.filter((id) => id !== accountNumber));
    } else {
      setSelectedIds([...selectedIds, accountNumber]);
    }
  };

  const properties = propertiesList;
  const metrics = data?.metrics || {
    totalProperties: 0,
    totalBilledFormatted: "GH₵ 0.00",
    totalCollectedFormatted: "GH₵ 0.00",
    totalArrearsFormatted: "GH₵ 0.00",
    defaultersCount: 0,
    collectionRateFormatted: "0.0%",
    collectionRatePercent: 0,
  };

  // Google Instant Reactive Search for Cadastre Properties (Synchronous <16ms on every keystroke)
  const filteredProperties = useMemo(() => {
    let list = properties;
    if (classificationFilter !== "ALL") {
      list = list.filter((p) => p.propertyClassification === classificationFilter);
    }
    if (statusFilter === "DEFAULTER") {
      list = list.filter((p) => p.status !== "PAID" && (p.arrears || 0) > 0);
    } else if (statusFilter === "UNPAID") {
      list = list.filter((p) => p.status !== "PAID");
    } else if (statusFilter === "PAID") {
      list = list.filter((p) => p.status === "PAID");
    }

    if (!deferredSearchQuery.trim()) return list;
    const tokens = deferredSearchQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return list.filter((p) => {
      const acc = (p.accountNumber || "").toLowerCase();
      const val = (p.valuationNo || "").toLowerCase();
      const owner = (p.ownerName || "").toLowerCase();
      const phone = (p.ownerPhone || "").toLowerCase();
      const addr = (p.ownerDigitalAddress || "").toLowerCase();
      const phys = (p.physicalAddress || "").toLowerCase();
      const house = (p.houseNo || "").toLowerCase();
      const plot = (p.plotNo || "").toLowerCase();
      const muni = (p.municipality || "").toLowerCase();
      const classif = (p.propertyClassification || "").toLowerCase();
      const stat = (p.status || "").toLowerCase();
      const due = (p.totalAmountDueFormatted || "").toLowerCase();

      return tokens.every(
        (token) =>
          acc.includes(token) ||
          val.includes(token) ||
          owner.includes(token) ||
          phone.includes(token) ||
          addr.includes(token) ||
          phys.includes(token) ||
          house.includes(token) ||
          plot.includes(token) ||
          muni.includes(token) ||
          classif.includes(token) ||
          stat.includes(token) ||
          due.includes(token)
      );
    });
  }, [properties, deferredSearchQuery, classificationFilter, statusFilter, activeTab]);

  

  // Google Instant Reactive Search for Audit Trail (Synchronous <16ms on every keystroke)
  const filteredAuditLogs = useMemo(() => {
    if (!deferredAuditLogSearchQuery.trim()) return auditLogs;
    const tokens = deferredAuditLogSearchQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return auditLogs.filter((log) => {
      const act = (log.action || "").toLowerCase();
      const actLbl = (log.actionLabel || "").toLowerCase();
      const admin = (log.adminName || "").toLowerCase();
      const det = (log.details || "").toLowerCase();
      const entId = (log.entityId || "").toLowerCase();
      const entType = (log.entityType || "").toLowerCase();
      const dt = (log.createdAtFormatted || "").toLowerCase();
      const time = (log.timeFormatted || "").toLowerCase();

      return tokens.every(
        (token) =>
          act.includes(token) ||
          actLbl.includes(token) ||
          admin.includes(token) ||
          det.includes(token) ||
          entId.includes(token) ||
          entType.includes(token) ||
          dt.includes(token) ||
          time.includes(token)
      );
    });
  }, [auditLogs, deferredAuditLogSearchQuery]);

  const selectedPropertiesList = properties.filter((p) => selectedIds.includes(p.accountNumber));
  const selectedUnpaidList = selectedPropertiesList.filter((p) => p.status !== "PAID" && p.totalAmountDue > 0);
  const selectedPaidList = selectedPropertiesList.filter((p) => p.status === "PAID");

  if (isAssemblyOfficer) {
    return (
      <OfficerStatementView
        initialAdmin={currentAdmin}
        initialAccountNo={initialAccountNo}
      />
    );
  }

  return (

    <div className="h-[100dvh] max-h-[100dvh] w-full bg-[#F5F5F7] text-[#1D1D1F] flex flex-col font-sans antialiased overflow-hidden selection:bg-[#007AFF]/20 selection:text-[#007AFF]">
      {/* Dedicated Apple-Style Fullscreen Signing Out Experience */}
      <AnimatePresence>
        {isLoggingOut && (
          <SigningOutScreen userName={currentAdmin?.name || currentAdmin?.username} />
        )}
      </AnimatePresence>

      {/* Heinz Administrator Minimalist Top Bar (Locked / Flex-shrink: 0 - Officer Profile Standard) */}
      <header className="relative w-full flex items-center justify-between gap-4 no-print border-b border-[#E8E8ED] px-4 sm:px-6 lg:px-8 py-2.5 shrink-0 bg-white min-h-[48px] z-40">
        {/* Brand Identity permanently anchored on the left */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-[#007AFF] flex items-center justify-center text-white shadow-xs shrink-0 font-bold text-xs">
            H
          </div>
          <div className="flex flex-col">
            <h1 className="text-[15px] sm:text-[16px] font-bold text-[#1D1D1F] tracking-tight leading-snug select-none">
              HEINZ Ltd.
            </h1>
          </div>
        </div>

        {/* Desktop Navigation Links (Clean Typographic Standard with Bottom Accent - Hidden on Mobile) */}
        <nav className="hidden sm:flex items-center gap-1 sm:gap-3" aria-label="Main Navigation">
          {visibleNavTabs.map((tab) => {
            const isActive = activeTab === tab.key;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleTabChange(tab.key)}
                className={`relative px-3 py-2 text-[13px] font-medium transition-colors cursor-pointer flex items-center gap-1.5 focus:outline-none ${
                  isActive
                    ? "text-[#007AFF] font-semibold"
                    : "text-[#6E6E73] hover:text-[#1D1D1F]"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-[#007AFF]" : "text-[#8E8E93]"}`} />
                <span>{tab.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="heinzActiveNavUnderline"
                    className="absolute bottom-0 inset-x-1.5 h-[2px] bg-[#007AFF] rounded-full"
                    transition={{ type: "spring", stiffness: 450, damping: 35 }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Action: Admin Identity, Session Timer & Sign Out */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <span className="hidden sm:inline text-xs font-medium text-[#6E6E73]">
            {currentAdmin?.username || currentAdmin?.name || "Heinz"}
          </span>
          <SessionTimer
            initialMinutes={7}
            onExpire={async () => {
              setIsLoggingOut(true);
              try {
                if (typeof window !== "undefined") {
                  try {
                    localStorage.removeItem("admin_current_user");
                    localStorage.removeItem("heinz_admin_session_expiry");
                    document.cookie = "admin_session=; path=/; max-age=0; SameSite=Lax";
                    document.cookie = "admin_session_expires_at=; path=/; max-age=0; SameSite=Lax";
                  } catch {}
                }
                await Promise.all([
                  adminLogout(),
                  new Promise((resolve) => setTimeout(resolve, 850)),
                ]);
              } finally {
                window.location.href = "/login";
              }
            }}
          />
          <button
            type="button"
            onClick={async () => {
              setIsLoggingOut(true);
              try {
                if (typeof window !== "undefined") {
                  try {
                    localStorage.removeItem("admin_current_user");
                    localStorage.removeItem("heinz_admin_session_expiry");
                    document.cookie = "admin_session=; path=/; max-age=0; SameSite=Lax";
                    document.cookie = "admin_session_expires_at=; path=/; max-age=0; SameSite=Lax";
                  } catch {}
                }
                await Promise.all([
                  adminLogout(),
                  new Promise((resolve) => setTimeout(resolve, 850)),
                ]);
              } finally {
                window.location.href = "/login";
              }
            }}
            disabled={isLoggingOut}
            className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-[#6E6E73] hover:text-[#FF3B30] transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            title="Sign Out"
            aria-label="Sign out of administration portal"
          >
            {isLoggingOut ? (
              <AppleSpinner size="xs" className="text-[#007AFF]" />
            ) : (
              <LogOut className="w-3.5 h-3.5" />
            )}
            <span>{isLoggingOut ? "Signing out..." : "Sign Out"}</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full min-h-0 overflow-hidden">

        {/* SMS Rollout Progress Bar (Slim Banner when Active) */}
        {smsJobId && smsJobProgress && (
          <div className="bg-white border-b border-[#E5E5EA] px-4 py-2 flex items-center gap-3 shrink-0 text-xs font-sans shadow-2xs">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-[#1C1C1E] truncate flex items-center gap-1.5">
                  {smsJobProgress.status === "DONE" ? (
                    <span className="text-[#34C759] font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Rollout Complete
                    </span>
                  ) : smsJobProgress.status === "FAILED" ? (
                    <span className="text-[#FF3B30] font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Rollout Failed
                    </span>
                  ) : (
                    <>
                      <AppleSpinner size="xs" className="text-[#007AFF]" />
                      <span>SMS Rollout in Progress...</span>
                    </>
                  )}
                </span>
                <span className="text-[10px] text-[#6C6C70] font-mono shrink-0 ml-2 flex items-center gap-1.5">
                  <span>{smsJobProgress.sentCount} / {smsJobProgress.totalCount} sent</span>
                  {smsJobProgress.failedCount > 0 && (
                    <span className="text-[#FF3B30] font-semibold">({smsJobProgress.failedCount} failed)</span>
                  )}
                  {(smsJobProgress.status === "DONE" || smsJobProgress.status === "FAILED") && smsJobProgress.failedCount > 0 && (
                    <button
                      type="button"
                      disabled={isRetryingSms}
                      onClick={handleRetryActiveSmsJob}
                      className="text-[11px] font-bold text-[#007AFF] hover:underline cursor-pointer flex items-center gap-1 ml-1 transition-opacity disabled:opacity-50"
                      title="Retry only failed recipients without duplicate messages"
                    >
                      {isRetryingSms ? <AppleSpinner size="xs" /> : <RotateCcw className="w-3 h-3" />}
                      <span>Retry Failed ({smsJobProgress.failedCount})</span>
                    </button>
                  )}
                </span>
              </div>
              <div className="w-full bg-[#E5E5EA] rounded-full h-1 overflow-hidden">
                <div
                  className="h-1 rounded-full transition-all duration-500"
                  style={{
                    width: smsJobProgress.totalCount > 0 ? `${Math.round((smsJobProgress.sentCount / smsJobProgress.totalCount) * 100)}%` : "0%",
                    background: smsJobProgress.status === "DONE" ? "#34C759" : smsJobProgress.status === "FAILED" ? "#FF3B30" : "#007AFF",
                  }}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setSmsJobId(null); setSmsJobProgress(null); }}
              className="text-[#8E8E93] hover:text-[#1C1C1E] cursor-pointer shrink-0 p-1 transition-colors"
              title="Dismiss progress notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Main Dashboard Workspace (Universal Flat Studio Layout) */}
        <main className="flex-1 min-h-0 w-full flex flex-col p-0 max-w-none overflow-hidden h-full relative">
          {isStatementReportActive && statementAccountNo ? (
            <AccountStatementReportView
              accountNo={statementAccountNo}
              startDate={statementStartDate}
              endDate={statementEndDate}
              onBack={() => setIsStatementReportActive(false)}
              onEditFilters={() => setIsAccountStatementDialogOpen(true)}
            />
          ) : (
          <div className="flex-1 min-h-0 w-full flex flex-col overflow-hidden h-full">
            {/* TAB: STATEMENTS (OFFICER MINIMALIST STANDARD) */}
            {activeTab === "STATEMENTS" && (
              <OfficerStatementView
                hideHeader={true}
                initialAdmin={currentAdmin}
                initialAccountNo={statementAccountParam}
                onNavigateToPayments={(accNo) => {
                  setStatementAccountParam(accNo);
                  handleTabChange("PAYMENTS", accNo);
                }}
              />
            )}

            {/* TAB: PAYMENTS (OFFICER MINIMALIST STANDARD) */}
            {(activeTab === "PAYMENTS" || activeTab === "FEE_PAYMENTS") && (
              <div className="flex-1 min-h-0 w-full overflow-hidden flex flex-col">
                <PaymentsSection
                  currentAdmin={currentAdmin}
                  initialAccountNo={statementAccountParam}
                  onSelectAccount={(accNo) => {
                    setStatementAccountParam(accNo || undefined);
                    if (typeof window !== "undefined") {
                      try {
                        const url = new URL(window.location.href);
                        if (accNo) {
                          url.searchParams.set("account", accNo);
                        } else {
                          url.searchParams.delete("account");
                          url.searchParams.delete("accountNumber");
                          url.searchParams.delete("accountNo");
                        }
                        window.history.replaceState(null, "", url.pathname + (url.search || ""));
                      } catch {}
                    }
                  }}
                  onOpenStatement={(accNo: string) => {
                    handleTabChange("STATEMENTS", accNo);
                  }}
                />
              </div>
            )}

            {/* TAB: ACCOUNTS (BIODATA MANAGEMENT) */}
            {activeTab === "ACCOUNTS" && (
              <div className="flex-1 min-h-0 w-full overflow-hidden flex flex-col">
                <AccountsBiodataSection
                  currentAdmin={currentAdmin}
                  initialAccountNo={statementAccountParam}
                  onOpenStatement={(accNo) => handleTabChange("STATEMENTS", accNo)}
                  onSelectAccount={(accNo) => {
                    setStatementAccountParam(accNo || undefined);
                    if (typeof window !== "undefined") {
                      try {
                        const url = new URL(window.location.href);
                        if (accNo) {
                          url.searchParams.set("account", accNo);
                        } else {
                          url.searchParams.delete("account");
                          url.searchParams.delete("accountNumber");
                          url.searchParams.delete("accountNo");
                        }
                        window.history.replaceState(null, "", url.pathname + (url.search || ""));
                      } catch {}
                    }
                  }}
                />
              </div>
            )}
            {activeTab === "REGISTRY" && !isAssemblyOfficer && (
              <div
                className={`shrink-0 overflow-hidden [overflow-anchor:none] will-change-transform transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  !isHeaderVisible ? "max-h-0 sm:max-h-none opacity-0 sm:opacity-100 pointer-events-none sm:pointer-events-auto" : "max-h-[260px] opacity-100"
                }`}
              >
            <section aria-label="Executive KPIs" className="shrink-0 bg-[#F8F9FA] border-b border-[#E5E5EA] px-4 py-2 sm:px-6 sm:py-2.5">
              <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 overflow-x-auto sm:overflow-visible snap-x snap-mandatory scrollbar-none pb-1">
                {/* 1. Total Assessed Demand */}
                <div className="min-w-[260px] flex-1 sm:min-w-0 sm:w-auto shrink-0 snap-start p-3.5 bg-white border border-[#E5E5EA] rounded-xl hover:border-[#D1D1D6] transition-colors flex flex-col justify-between min-h-[96px]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[#8E8E93]">Total Amount Billed</span>
                    <Building2 className="w-4 h-4 text-[#8E8E93]" />
                  </div>
                  <div className="mt-2">
                    {isInitialLoading ? (
                      <div className="h-7 w-32 bg-[#E5E5EA] rounded animate-pulse" />
                    ) : (
                      <div className="text-xl sm:text-2xl font-semibold text-[#1C1C1E] tracking-tight tabular-nums">
                        {metrics.totalBilledFormatted}
                      </div>
                    )}
                    <div className="text-[11px] text-[#8E8E93] mt-1 flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium text-[#007AFF]">FY 2025</span>
                      <span>&bull;</span>
                      <span>{(data?.pagination?.total ?? metrics.totalProperties).toLocaleString()} property accounts</span>
                    </div>
                  </div>
                </div>

                {/* 2. Revenue Collected */}
                <div className="min-w-[260px] flex-1 sm:min-w-0 sm:w-auto shrink-0 snap-start p-3.5 bg-white border border-[#E5E5EA] rounded-xl hover:border-[#D1D1D6] transition-colors flex flex-col justify-between min-h-[96px]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[#8E8E93]">Revenue Collected</span>
                    <CheckCircle2 className="w-4 h-4 text-[#34C759]" />
                  </div>
                  <div className="mt-2">
                    {isInitialLoading ? (
                      <div className="h-7 w-32 bg-[#E5E5EA] rounded animate-pulse" />
                    ) : (
                      <div className="text-xl sm:text-2xl font-semibold text-[#34C759] tracking-tight tabular-nums">
                        {metrics.totalCollectedFormatted}
                      </div>
                    )}
                    <div className="text-[11px] text-[#8E8E93] mt-1 flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium text-[#34C759]">+{metrics.collectionRateFormatted}</span>
                      <span>&bull;</span>
                      <span>Total direct collections</span>
                    </div>
                  </div>
                </div>

                {/* 3. Cumulative Arrears */}
                <div className="min-w-[260px] flex-1 sm:min-w-0 sm:w-auto shrink-0 snap-start p-3.5 bg-white border border-[#E5E5EA] rounded-xl hover:border-[#D1D1D6] transition-colors flex flex-col justify-between min-h-[96px]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[#8E8E93]">Total Overdue (Arrears)</span>
                    <XCircle className="w-4 h-4 text-[#FF3B30]" />
                  </div>
                  <div className="mt-2">
                    {isInitialLoading ? (
                      <div className="h-7 w-32 bg-[#E5E5EA] rounded animate-pulse" />
                    ) : (
                      <div className="text-xl sm:text-2xl font-semibold text-[#FF3B30] tracking-tight tabular-nums">
                        {metrics.totalArrearsFormatted}
                      </div>
                    )}
                    <div className="text-[11px] text-[#8E8E93] mt-1 flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium text-[#FF3B30]">Prior Debt</span>
                      <span>&bull;</span>
                      <span>Outstanding municipal balance</span>
                    </div>
                  </div>
                </div>

                {/* 4. Accounts with Arrears */}
                <div className="min-w-[260px] flex-1 sm:min-w-0 sm:w-auto shrink-0 snap-start p-3.5 bg-white border border-[#E5E5EA] rounded-xl hover:border-[#D1D1D6] transition-colors flex flex-col justify-between min-h-[96px]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[#8E8E93]">Accounts with Overdue Bills</span>
                    <Flag className="w-4 h-4 text-[#FF9500]" />
                  </div>
                  <div className="mt-2">
                    {isInitialLoading ? (
                      <div className="h-7 w-20 bg-[#E5E5EA] rounded animate-pulse" />
                    ) : (
                      <div className="text-xl sm:text-2xl font-semibold text-[#1C1C1E] tracking-tight tabular-nums">
                        {metrics.defaultersCount.toLocaleString()}
                      </div>
                    )}
                    <div className="text-[11px] text-[#8E8E93] mt-1 flex items-center gap-1.5 flex-wrap">
                      <span className={`font-medium ${metrics.defaultersCount > 0 ? "text-[#FF9500]" : "text-[#34C759]"}`}>
                        {metrics.defaultersCount > 0 ? "Payment follow-up active" : "Compliant"}
                      </span>
                      <span>&bull;</span>
                      <button
                        type="button"
                        onClick={() => {
                          handleTabChange("REGISTRY");
                          handleStatusFilterChange("DEFAULTER");
                        }}
                        className="text-[#007AFF] hover:underline cursor-pointer"
                      >
                        View overdue accounts &rarr;
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
              </div>
          )}

          {/* TAB 1: CADASTRE & VALUATION ROLL */}
          {activeTab === "REGISTRY" && !isAssemblyOfficer && (
            <section className="bg-white border-0 rounded-none shadow-none flex-1 min-h-0 flex flex-col overflow-hidden w-full">
              <div className="p-3.5 border-b border-[#E5E5EA] space-y-2.5 shrink-0 bg-white">
                {/* Filter & Action Bar */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 sm:gap-3">
                  {/* Search & Mobile 1-Tap Add Property Button */}
                  <div className="flex items-center gap-2 w-full lg:flex-1 lg:max-w-md order-last lg:order-none">
                    <div className="relative flex-1 flex items-center min-w-0">
                      {isSearchingProperties ? (
                        <AppleSpinner size="sm" className="text-[#007AFF] absolute left-3 pointer-events-none" />
                      ) : (
                        <Search className="w-4 h-4 text-[#8E8E93] absolute left-3 pointer-events-none" />
                      )}
                      <input
                        type="text"
                        inputMode="search"
                        name="cadastre_property_search_filter"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        data-lpignore="true"
                        data-1p-ignore="true"
                        data-bwignore="true"
                        data-form-type="other"
                        placeholder="Search properties, accounts, owners..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        aria-label="Search cadastre properties"
                        onKeyDown={(e) => {
                          if (e.key === "Escape") handleClearPropertySearch();
                        }}
                        className="w-full h-8 pl-9 pr-8 rounded-lg border border-[#E5E5EA] bg-[#F2F2F7] text-xs text-[#1C1C1E] placeholder:text-[#8E8E93] focus:border-[#007AFF] focus:bg-white focus:outline-none transition-colors"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={handleClearPropertySearch}
                          className="absolute right-2 text-[#8E8E93] hover:text-[#1C1C1E] p-1 cursor-pointer"
                          title="Clear search"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowPropertyModal(true)}
                      className="apple-btn-primary h-8 px-3 rounded-lg font-semibold text-xs flex lg:hidden items-center gap-1 cursor-pointer shrink-0"
                    >
                      <span>+ Add</span>
                    </button>
                  </div>

                  {/* Horizontal Scrollable Strip for Dropdowns & Actions on Mobile */}
                  <div className="flex items-center justify-end-safe gap-2 w-full lg:w-auto overflow-x-auto whitespace-nowrap scrollbar-none py-1 lg:py-0">
                    <select
                      value={classificationFilter}
                      onChange={(e) => handleClassificationFilterChange(e.target.value)}
                      aria-label="Filter by property classification"
                      className="h-8 px-2.5 rounded-lg border border-[#E5E5EA] bg-[#F2F2F7] text-xs text-[#1C1C1E] focus:outline-none focus:border-[#007AFF] focus:bg-white shrink-0"
                    >
                      <option value="ALL">All Property Classes</option>
                      <option value="COMMERCIAL">Commercial</option>
                      <option value="RESIDENTIAL">Residential</option>
                      <option value="INDUSTRIAL">Industrial</option>
                      <option value="MIXED">Mixed Use</option>
                      <option value="INSTITUTIONAL">Institutional</option>
                      <option value="PRIVATE THIRD CLASS RESIDENTIAL">3rd Class Residential</option>
                      <option value="PRIVATE SECOND CLASS RESIDENTIAL">2nd Class Residential</option>
                      <option value="FIRST CLASS RESIDENTIAL">1st Class Residential</option>
                      <option value="COMMERCIAL PROPERTY">Commercial Property</option>
                      <option value="GRADE G">Grade G</option>
                      <option value="GRADE A">Grade A</option>
                      <option value="THIRD CLASS UNCOMPLETED">3rd Class Uncompleted</option>
                      <option value="UNACCESS PROPERTY">Unaccessed Property</option>
                    </select>

                    <select
                      value={statusFilter}
                      onChange={(e) => handleStatusFilterChange(e.target.value as any)}
                      aria-label="Filter by payment status"
                      className="h-8 px-2.5 rounded-lg border border-[#E5E5EA] bg-[#F2F2F7] text-xs text-[#1C1C1E] focus:outline-none focus:border-[#007AFF] focus:bg-white shrink-0"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="UNPAID">Unpaid Balances</option>
                      <option value="DEFAULTER">Past Due Arrears (&gt; GH₵ 0)</option>
                      <option value="PAID">Paid in Full</option>
                    </select>

                    <RequiredFieldsFilterPopover
                      requiredFields={propertyRequiredFields}
                      onChange={(fields) => {
                        setPropertyRequiredFields(fields);
                        setCurrentPropertyPage(1);
                      }}
                    />

                    <button
                      type="button"
                      onClick={() => setShowPropertyModal(true)}
                      className="apple-btn-primary h-8 px-3 rounded-lg font-semibold text-xs hidden lg:flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <span>+ Add Property</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowCsvImportModal(true)}
                      className="apple-btn-secondary h-8 px-3 rounded-lg font-medium text-xs flex items-center gap-1.5 cursor-pointer shrink-0 text-[#007AFF]"
                      title="Import Cadastre CSV"
                    >
                      <UploadCloud className="w-3.5 h-3.5 text-[#007AFF]" />
                      <span>Import CSV</span>
                    </button>
                  </div>
                </div>

                {/* Active Cadastre Filter Summary Strip (Zero Pills) */}
                {(classificationFilter !== "ALL" || statusFilter !== "ALL" || searchQuery.trim() !== "") && (
                  <div className="flex items-center justify-between text-xs text-[#6C6C70] pt-1.5 pb-0.5 border-t border-[#E5E5EA]">
                    <div className="flex items-center gap-2 flex-wrap text-[11px]">
                      <span className="font-semibold text-[#1C1C1E]">Active Filters:</span>
                      {searchQuery.trim() && (
                        <span className="text-[#007AFF] font-medium">Search: &ldquo;{searchQuery.trim()}&rdquo;</span>
                      )}
                      {classificationFilter !== "ALL" && (
                        <span className="text-[#007AFF] font-medium">&bull; Class: {classificationFilter}</span>
                      )}
                      {statusFilter !== "ALL" && (
                        <span className="text-[#007AFF] font-medium">&bull; Status: {statusFilter === "DEFAULTER" ? "Past Due Arrears" : statusFilter}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        handleClearPropertySearch();
                        handleClassificationFilterChange("ALL");
                        handleStatusFilterChange("ALL");
                      }}
                      className="text-[11px] font-semibold text-[#007AFF] hover:underline cursor-pointer shrink-0"
                    >
                      Reset all filters
                    </button>
                  </div>
                )}
              </div>

              {/* Selection Action Bar */}
              <AnimatePresence>
                {selectedIds.length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="bg-[#F2F2F7] border-b border-[#E5E5EA] px-4 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs shrink-0"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[#007AFF]">
                        {selectedIds.length} {selectedIds.length === 1 ? "property" : "properties"} selected
                      </span>

                      {selectedPaidList.length > 0 && selectedUnpaidList.length > 0 && (
                        <span className="text-[#6C6C70] font-normal">
                          ({selectedUnpaidList.length} with balance due, {selectedPaidList.length} settled)
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => setSelectedIds([])}
                        className="text-xs text-[#6C6C70] hover:text-[#1C1C1E] underline cursor-pointer ml-1"
                      >
                        Deselect all
                      </button>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {selectedUnpaidList.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSmsAuthTargetAccounts(selectedUnpaidList);
                            setSmsAuthPassword("");
                            setSmsAuthError(null);
                            setShowSmsAuthModal(true);
                          }}
                          disabled={isProcessing}
                          className="apple-btn-primary h-7 px-3 rounded-lg font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        >
                          <Send className="w-3 h-3" />
                          <span>
                            Broadcast Dual-Link SMS ({selectedUnpaidList.length} Unpaid)
                          </span>
                        </button>
                      ) : (

                        <span className="text-xs text-[#34C759] font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Selected Accounts Settled</span>
                        </span>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Cadastre Table Container */}
              <div
                ref={tableContainerRef}
                onScroll={handleTableScroll}
                className="w-full flex-1 min-h-0 min-h-[calc(100dvh-13rem)] overflow-y-auto overflow-x-hidden [overflow-anchor:auto] [isolation:isolate]"
              >
                {/* Desktop Cadastre Table (>= 768px) */}
                <table className="hidden md:table table-fixed w-full text-left text-xs border-collapse">
                  <thead className="bg-[#F8F9FA] border-b border-[#E5E5EA] text-[#6C6C70] font-semibold text-[11px] sticky top-0 z-[1]">
                    <tr>
                      <th className="py-2.5 px-3 text-center w-8 bg-[#F8F9FA]">
                        <input
                          type="checkbox"
                          checked={selectedIds.length === filteredProperties.length && filteredProperties.length > 0}
                          onChange={toggleSelectAll}
                          aria-label="Select all properties on current page"
                          className="rounded border-[#C7C7CC] text-[#007AFF] focus:ring-0 accent-[#007AFF] cursor-pointer"
                        />
                      </th>
                      <th className="py-2.5 px-3 w-[24%] bg-[#F8F9FA]">Account &amp; Cadastre</th>
                      <th className="py-2.5 px-3 w-[23%] bg-[#F8F9FA]">Ratepayer Particulars</th>
                      <th className="py-2.5 px-3 w-[15%] bg-[#F8F9FA] truncate">Classification</th>
                      <th className="py-2.5 px-3 w-[13%] text-right bg-[#F8F9FA] whitespace-nowrap">Rateable Value</th>
                      <th className="py-2.5 px-3 w-[14%] text-right bg-[#F8F9FA] whitespace-nowrap">Assessment Due</th>
                      <th className="py-2.5 px-3 w-[11%] text-center bg-[#F8F9FA] whitespace-nowrap">Status</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#E5E5EA] bg-white">
                    {isSearchingProperties || isInitialLoading ? (
                      Array.from({ length: 8 }).map((_, i) => (
                        <tr key={`cadastre-skel-${i}`} className="animate-pulse">
                          <td className="py-2.5 px-3 text-center">
                            <div className="w-3.5 h-3.5 bg-[#E5E5EA] rounded mx-auto" />
                          </td>
                          <td className="py-2.5 px-3 space-y-1">
                            <div className="w-24 h-3.5 bg-[#E5E5EA] rounded" />
                            <div className="w-36 h-2.5 bg-[#F2F2F7] rounded" />
                          </td>
                          <td className="py-2.5 px-3 space-y-1">
                            <div className="w-28 h-3.5 bg-[#E5E5EA] rounded" />
                            <div className="w-20 h-2.5 bg-[#F2F2F7] rounded" />
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="w-20 h-3.5 bg-[#E5E5EA] rounded" />
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="w-16 h-3.5 bg-[#E5E5EA] rounded ml-auto" />
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="w-18 h-3.5 bg-[#E5E5EA] rounded ml-auto" />
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="w-12 h-3.5 bg-[#E5E5EA] rounded mx-auto" />
                          </td>
                        </tr>
                      ))
                    ) : filteredProperties.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-[#8E8E93] font-normal">
                          No property records found matching current criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredProperties.map((prop) => {
                        const isPaid = prop.status === "PAID";
                        const isSelected = selectedIds.includes(prop.accountNumber);

                        return (
                          <tr
                            key={prop.id}
                            onClick={() => setSelectedAccount(prop)}
                            className={`transition-colors cursor-pointer ${
                              isSelected
                                ? "bg-[#007AFF]/10 hover:bg-[#007AFF]/15"
                                : selectedAccount?.id === prop.id
                                ? "bg-[#007AFF]/8 hover:bg-[#007AFF]/12"
                                : "hover:bg-[#F8F9FA]"
                            }`}
                          >
                            <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectRow(prop.accountNumber)}
                                aria-label={`Select property ${prop.accountNumber}`}
                                className="rounded border-[#C7C7CC] text-[#007AFF] focus:ring-0 accent-[#007AFF] cursor-pointer"
                              />
                            </td>
                            <td className="py-2.5 px-3">
                              <p className="font-semibold text-[#1C1C1E]">{prop.accountNumber}</p>
                              <p className="text-[#6C6C70] text-[11px] mt-0.5">{prop.ownerDigitalAddress} &bull; {prop.municipality}</p>
                            </td>
                            <td className="py-2.5 px-3">
                              <p 
                                className="font-medium text-[#007AFF] hover:underline cursor-pointer transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (prop.ownerId) {
                                    handleOpenRatepayerDossier(prop.ownerId);
                                  }
                                }}
                              >
                                {prop.ownerName}
                              </p>
                              <p className="text-[#6C6C70] text-[11px] mt-0.5">{prop.ownerPhone}</p>
                            </td>
                            <td className="py-2.5 px-3 text-[#6C6C70]">
                              {prop.propertyClassification}
                            </td>
                            <td className="py-2.5 px-3 text-right font-medium text-[#1C1C1E] whitespace-nowrap tabular-nums">
                              {prop.rateableValueFormatted}
                            </td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap tabular-nums">
                              <p className="font-semibold text-[#1C1C1E] whitespace-nowrap tabular-nums">{prop.totalAmountDueFormatted}</p>
                              {prop.arrears > 0 && (
                                <p
                                  className={`text-[11px] mt-0.5 whitespace-nowrap tabular-nums ${
                                    isPaid
                                      ? "line-through text-[#8E8E93]"
                                      : "text-[#FF3B30]"
                                  }`}
                                  title={isPaid ? "Arrears cleared" : undefined}
                                >
                                  Arrears: {prop.arrearsFormatted}
                                </p>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              <span
                                className={`text-xs font-medium ${isPaid
                                    ? "text-[#34C759]"
                                    : prop.status === "PARTIALLY_PAID"
                                      ? "text-[#FF9500]"
                                      : "text-[#FF3B30]"
                                  }`}
                              >
                                {isPaid ? "Paid" : prop.status === "PARTIALLY_PAID" ? "Partial" : "Unpaid"}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>

                {/* Mobile Cadastre Google Material List Tiles (< 768px) */}
                <div className="block md:hidden divide-y divide-[#E5E5EA] bg-white">
                  {filteredProperties.length === 0 ? (
                    <div className="py-8 text-center text-[#8E8E93] font-normal text-xs px-4">
                      No property records found matching current criteria.
                    </div>
                  ) : (
                    filteredProperties.map((prop) => {
                      const isPaid = prop.status === "PAID";
                      const isSelected = selectedIds.includes(prop.accountNumber);

                      return (
                        <div
                          key={`mobile-prop-${prop.id}`}
                          onClick={() => setSelectedAccount(prop)}
                          className={`px-3.5 py-3 flex items-center justify-between gap-2.5 transition-colors cursor-pointer ${selectedAccount?.id === prop.id ? "bg-[#007AFF]/8" : "hover:bg-[#F8F9FA] active:bg-[#F2F2F7]"
                            }`}
                        >
                          {/* Left: Selection checkbox + Account details */}
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="shrink-0 min-w-[44px] min-h-[44px] -m-2.5 flex items-center justify-center cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectRow(prop.accountNumber)}
                                aria-label={`Select property ${prop.accountNumber}`}
                                className="rounded border-[#C7C7CC] text-[#007AFF] focus:ring-0 accent-[#007AFF] cursor-pointer w-4 h-4"
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-xs text-[#1C1C1E] font-mono truncate">
                                  {prop.accountNumber}
                                </span>
                                <span
                                  className={`text-[11px] font-semibold shrink-0 ${isPaid
                                      ? "text-[#34C759]"
                                      : prop.status === "PARTIALLY_PAID"
                                        ? "text-[#FF9500]"
                                        : "text-[#FF3B30]"
                                    }`}
                                >
                                  &bull; {isPaid ? "Paid" : prop.status === "PARTIALLY_PAID" ? "Partial" : "Unpaid"}
                                </span>
                              </div>
                              <div className="text-[11px] text-[#6C6C70] truncate mt-0.5">
                                <span
                                  className="text-[#007AFF] font-medium hover:underline cursor-pointer"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (prop.ownerId) {
                                      handleOpenRatepayerDossier(prop.ownerId);
                                    }
                                  }}
                                >
                                  {prop.ownerName}
                                </span>
                                {prop.ownerDigitalAddress && (
                                  <span className="text-[#6C6C70] font-mono ml-1.5">&bull; {prop.ownerDigitalAddress}</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right: Total Due Amount + Classification + Chevron */}
                          <div className="flex items-center gap-1.5 shrink-0 text-right">
                            <div>
                              <div className="text-xs font-bold text-[#1C1C1E] tabular-nums">
                                {prop.totalAmountDueFormatted}
                              </div>
                              <div className="text-[10px] text-[#6C6C70] uppercase tracking-wider">
                                {prop.propertyClassification?.split(" ")[0] || "Rate"}
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-[#8E8E93] shrink-0 ml-0.5" />
                          </div>
                        </div>
                      );
                    })
                  )}

                </div>
              </div>

              {/* Cadastre Supabase Studio-Style Table Pagination Bar */}
              <SupabaseTablePagination
                currentPage={currentPropertyPage}
                totalPages={data?.pagination?.totalPages || 1}
                totalRecords={data?.pagination?.total || propertiesList.length}
                pageSize={propertyLimit}
                pageSizeOptions={[25, 50, 100]}
                onPageChange={handlePropertyPageChange}
                onPageSizeChange={handlePropertyPageSizeChange}
                isLoading={isSearchingProperties}
                entityLabel="properties"
              />
            </section>
          )}

          {/* TAB 2: PROPERTY OWNERS */}
          {activeTab === "RATEPAYERS" && (
            <section className="bg-white flex-1 flex flex-col min-h-0 overflow-hidden w-full border-0 rounded-none shadow-none">
              {/* Filter & Search Toolbar (Collapses on mobile scroll-down; Hidden in Account Detail View) */}
              {!(selectedRatepayerTable === "Bill" && isAccountBillDetailActive) && (
                <div
                  className={`px-3 sm:px-4 lg:px-6 bg-white border-b border-[#E5E5EA] flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 shrink-0 [overflow-anchor:none] will-change-transform transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden ${
                    !isHeaderVisible
                      ? "max-h-0 sm:max-h-none py-0 opacity-0 sm:opacity-100 pointer-events-none sm:pointer-events-auto border-b-0"
                      : "max-h-[160px] py-2 sm:py-2.5 opacity-100"
                  }`}
                >
                  <div className="flex items-center gap-2 w-full sm:max-w-md flex-1 order-last sm:order-none">
                    <div className="relative w-full">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-3 sm:top-2.5 text-[#8E8E93]" />
                      <input
                        type="text"
                        inputMode="search"
                        value={selectedRatepayerTable === "Property" ? ratepayerSearchQuery : universalTableSearchQuery}
                        onChange={(e) => {
                          if (selectedRatepayerTable === "Property") {
                            setRatepayerSearchQuery(e.target.value);
                          } else {
                            setUniversalTableSearchQuery(e.target.value);
                          }
                        }}
                        placeholder={
                          selectedRatepayerTable === "Property"
                            ? "Search by ratepayer name, phone, or account..."
                            : selectedRatepayerTable === "Bill"
                            ? "Search GPS, Account No, Name, or Phone..."
                            : `Search ${DATABASE_TABLE_DEFINITIONS[selectedRatepayerTable]?.name || selectedRatepayerTable}...`
                        }
                        className="w-full pl-8 pr-8 py-2 sm:py-1.5 bg-[#F2F2F7] border border-[#E5E5EA] rounded-lg text-xs text-[#1C1C1E] placeholder-[#8E8E93] focus:outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] focus:bg-white transition-colors"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        data-lpignore="true"
                        data-1p-ignore="true"
                        data-bwignore="true"
                        data-form-type="other"
                      />
                      {((selectedRatepayerTable === "Property" && ratepayerSearchQuery) || (selectedRatepayerTable !== "Property" && universalTableSearchQuery)) && (
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedRatepayerTable === "Property") {
                              setRatepayerSearchQuery("");
                            } else {
                              setUniversalTableSearchQuery("");
                            }
                          }}
                          className="absolute right-2.5 top-2.5 sm:top-2 text-[#8E8E93] hover:text-[#1C1C1E] cursor-pointer p-0.5"
                          title="Clear search"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end-safe gap-2 overflow-x-auto no-scrollbar scroll-smooth w-full sm:w-auto shrink-0 py-0.5">
                    {/* Dedicated Tables Filter Popover */}
                    <TableFilterPopover
                      selectedTable={selectedRatepayerTable}
                      allowedTables={allowedRatepayerTables}
                      onSelectTable={(table) => {
                        setSelectedRatepayerTable(table);
                        setIsAccountBillDetailActive(false);
                        setUniversalTableSearchQuery("");
                      }}
                    />

                    {/* Universal Fields Filter Popover - Dedicated for each table */}
                    <RequiredFieldsFilterPopover
                      title={selectedRatepayerTable === "Property" ? "Property Field Criteria" : `${DATABASE_TABLE_DEFINITIONS[selectedRatepayerTable]?.name || selectedRatepayerTable} Fields`}
                      buttonLabel={selectedRatepayerTable === "Property" ? "Fields Filter" : `${DATABASE_TABLE_DEFINITIONS[selectedRatepayerTable]?.name || selectedRatepayerTable} Fields`}
                      availableCriteria={
                        selectedRatepayerTable === "Property"
                          ? AVAILABLE_FIELD_CRITERIA
                          : (DATABASE_TABLE_DEFINITIONS[selectedRatepayerTable]?.columns || []).map((col) => ({
                              key: col.key,
                              label: col.label,
                              category: (col.type === "currency" ? "Financial" : col.type === "date" ? "Date" : col.type === "number" ? "Numeric" : col.type === "boolean" ? "Status" : "General"),
                            }))
                      }
                      requiredFields={
                        selectedRatepayerTable === "Property"
                          ? ratepayerRequiredFields
                          : (tableVisibleColumns[selectedRatepayerTable] || [])
                      }
                      onChange={(fields) => {
                        if (selectedRatepayerTable === "Property") {
                          setRatepayerRequiredFields(fields);
                          setCurrentRatepayerPage(1);
                        } else {
                          setTableVisibleColumns((prev) => ({
                            ...prev,
                            [selectedRatepayerTable]: fields,
                          }));
                        }
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Table Content Area: Only table content modifies itself based on filters */}
              {selectedRatepayerTable === "Property" ? (
                <>
                  {/* Ratepayers Directory Supabase-Style Draggable Table & Mobile Cards */}
                  <RatepayersSupabaseTable
                    properties={ratepayerProperties}
                    isLoading={isLoadingRatepayers}
                    totalCount={ratepayersTotal}
                    totalDueFormatted={ratepayerPropertiesDueFormatted}
                    onOpenDossier={(prop, siblings) => {
                      setSelectedAccount(prop);
                      setSelectedAccountSiblings(siblings && siblings.length > 0 ? siblings : [prop]);
                    }}
                    onTableScroll={handleTableScroll}
                  />

                  {/* Ratepayer Directory Supabase-Style Table Pagination Bar */}
                  <SupabaseTablePagination
                    currentPage={currentRatepayerPage}
                    totalPages={Math.max(1, Math.ceil(ratepayersTotal / ratepayerLimit))}
                    totalRecords={ratepayersTotal}
                    pageSize={ratepayerLimit}
                    pageSizeOptions={[25, 50, 100]}
                    onPageChange={handleRatepayerPageChange}
                    onPageSizeChange={handleRatepayerPageSizeChange}
                    isLoading={isLoadingRatepayers}
                    entityLabel="properties"
                  />
                </>
              ) : selectedRatepayerTable === "Bill" ? (
                <AccountBillHistoryView
                  hideToolbar={true}
                  externalSearchQuery={universalTableSearchQuery}
                  visibleColumnKeys={tableVisibleColumns["Bill"]}
                  onDetailViewChange={setIsAccountBillDetailActive}
                  onTableScroll={handleTableScroll}
                />
              ) : (
                <UniversalDatabaseTable
                  tableDef={DATABASE_TABLE_DEFINITIONS[selectedRatepayerTable]}
                  hideToolbar={true}
                  visibleColumnKeys={tableVisibleColumns[selectedRatepayerTable]}
                  externalSearchQuery={universalTableSearchQuery}
                  onTableScroll={handleTableScroll}
                />
              )}
            </section>
          )}

          {/* TAB: PAID RATEPAYERS DIRECTORY & COLLECTIONS LEDGER */}
          {activeTab === "PAID_USERS" && (
            <>
              <section className="bg-white flex-1 min-h-0 flex flex-col overflow-hidden w-full border-0 rounded-none shadow-none">
              {/* Sub-Tabs & Metrics (Collapses on mobile scroll-down) */}
              <div
                className={`px-4 lg:px-6 bg-white border-b border-[#E5E5EA] [overflow-anchor:none] will-change-transform transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden shrink-0 ${
                  !isHeaderVisible
                    ? "max-h-0 sm:max-h-none py-0 opacity-0 sm:opacity-100 pointer-events-none sm:pointer-events-auto border-b-0"
                    : "max-h-[140px] py-2.5 opacity-100"
                }`}
              >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                  {/* Title / Info - Clean typographic header */}
                  <div className="flex items-center gap-6 overflow-x-auto scrollbar-none">
                  <div className="pb-2.5 text-xs font-semibold tracking-tight transition-colors relative flex items-center gap-1.5 shrink-0 text-[#1C1C1E]">
                    <span>Official Paid Ratepayers</span>
                    {isLoadingPaidUsers ? (
                      <AppleSpinner size="xs" className="text-[#007AFF]" />
                    ) : (
                      <span className="text-[11px] font-mono text-[#007AFF]">({paidUsersTotal})</span>
                    )}
                  </div>
                </div>

                  <div className="flex items-center gap-3 shrink-0 ml-auto">
                    <div className="text-right">
                      <span className="text-[11px] text-[#6C6C70] block">
                        Total Collected:
                      </span>
                      <span className="text-xs font-semibold text-[#34C759]">
                        GH₵ {paidUsersTotalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Search Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 pt-2">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 w-full lg:flex-1">
                    <div className="relative flex items-center w-full lg:max-w-md">
                      <Search className="w-4 h-4 text-[#8E8E93] absolute left-3 pointer-events-none" />
                      <input
                        type="text"
                        inputMode="search"
                        name="paid_users_search_filter"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        data-lpignore="true"
                        data-1p-ignore="true"
                        data-bwignore="true"
                        data-form-type="other"
                        placeholder="Search paid ratepayers, accounts..."
                        value={paidUsersSearchQuery}
                        onChange={(e) => setPaidUsersSearchQuery(e.target.value)}
                        aria-label="Search paid ratepayers"
                        onKeyDown={(e) => {
                          if (e.key === "Escape") setPaidUsersSearchQuery("");
                        }}
                        className="w-full h-8 pl-9 pr-8 rounded-lg border border-[#E5E5EA] bg-[#F2F2F7] text-xs text-[#1C1C1E] placeholder:text-[#8E8E93] focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] focus:bg-white focus:outline-none transition-colors"
                      />
                      {isLoadingPaidUsers && paidUsersSearchQuery ? (
                        <span className="absolute right-2.5 flex items-center pointer-events-none">
                          <AppleSpinner size="xs" className="text-[#007AFF]" />
                        </span>
                      ) : paidUsersSearchQuery ? (
                        <motion.button
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ duration: 0.12 }}
                          type="button"
                          onClick={() => setPaidUsersSearchQuery("")}
                          className="absolute right-2 text-[#8E8E93] hover:text-[#1C1C1E] p-1 cursor-pointer active:scale-90 transition-transform"
                          title="Clear search"
                        >
                          <X className="w-3.5 h-3.5" />
                        </motion.button>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#6C6C70]">
                      Showing <span className="font-semibold text-[#1C1C1E]">{paidUsers.length}</span> of <span className="font-semibold text-[#1C1C1E]">{paidUsersTotal}</span> transactions
                    </span>
                    {isLoadingPaidUsers && !paidUsersSearchQuery && (
                      <AppleSpinner size="xs" className="text-[#007AFF]" />
                    )}
                  </div>
                </div>
              </div>

              {/* Table Container - Paystack Inspired Layout & Mobile Cards */}
              <div ref={paidUsersTableContainerRef} onScroll={handleTableScroll} className="flex-1 overflow-auto bg-white min-h-0 min-h-[calc(100dvh-13rem)] [overflow-anchor:auto] [isolation:isolate]">
                {/* Desktop Table (>= 768px) */}
                <table className="hidden md:table w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 z-10 bg-[#F8F9FA] border-b border-[#E5E5EA]">
                    <tr>
                      <th className="w-8 px-3 lg:px-4 py-3 text-center">
                        <span className="sr-only">Status Indicator</span>
                      </th>
                      <th className="px-4 lg:px-6 py-3 font-semibold text-[#6C6C70]">Amount</th>
                      <th className="px-4 lg:px-6 py-3 font-semibold text-[#6C6C70]">Ratepayer &amp; Account</th>
                      <th className="px-4 lg:px-6 py-3 font-semibold text-[#6C6C70]">Reference</th>
                      <th className="px-4 lg:px-6 py-3 font-semibold text-[#6C6C70]">Channel</th>
                      <th className="px-4 lg:px-6 py-3 font-semibold text-[#6C6C70] text-right">Paid On</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y divide-[#E5E5EA] transition-opacity duration-150 ${isLoadingPaidUsers && paidUsers.length > 0 ? "opacity-50" : "opacity-100"}`}>
                    {(isLoadingPaidUsers || !hasLoadedPaidUsersRef.current) && paidUsers.length === 0 ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <tr key={i} className="animate-pulse">
                          <td className="w-8 px-3 lg:px-4 py-3.5 text-center">
                            <div className="w-2.5 h-2.5 rounded-full bg-[#E5E5EA] mx-auto" />
                          </td>
                          <td className="px-4 lg:px-6 py-3.5">
                            <div className="h-3.5 w-20 bg-[#E5E5EA] rounded" />
                          </td>
                          <td className="px-4 lg:px-6 py-3.5">
                            <div className="h-3.5 w-36 bg-[#E5E5EA] rounded" />
                          </td>
                          <td className="px-4 lg:px-6 py-3.5">
                            <div className="h-3.5 w-32 bg-[#E5E5EA] rounded" />
                          </td>
                          <td className="px-4 lg:px-6 py-3.5">
                            <div className="h-3.5 w-24 bg-[#E5E5EA] rounded" />
                          </td>
                          <td className="px-4 lg:px-6 py-3.5 text-right">
                            <div className="h-3.5 w-24 bg-[#E5E5EA] rounded ml-auto" />
                          </td>
                        </tr>
                      ))
                    ) : paidUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-16 text-center text-[#6C6C70]">
                          <div className="flex flex-col items-center justify-center space-y-2">
                            <CreditCard className="w-8 h-8 text-[#8E8E93]" />
                            <p className="font-semibold text-sm text-[#1C1C1E]">No payment records found</p>
                            <p className="text-xs text-[#6C6C70]">
                              {paidUsersSearchQuery 
                                ? "No payment records match your search query." 
                                : "No official ratepayer payments recorded yet in this scope."}
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paidUsers.map((rec) => {
                        const isSuccess = rec.status === "PAID" || rec.status === "SUCCESS";
                        const isFailed = rec.status === "FAILED";

                        return (
                          <tr
                            key={rec.id}
                            onClick={() => setSelectedTransaction(rec)}
                            className="hover:bg-[#F8F9FA] transition-colors cursor-pointer group"
                            title="Click row to inspect transaction details"
                          >
                            {/* Status Dot Column */}
                            <td className="w-8 px-3 lg:px-4 py-3.5 text-center">
                              <span
                                className={`inline-block w-2.5 h-2.5 rounded-full ${
                                  isSuccess
                                    ? "bg-[#34C759]"
                                    : isFailed
                                    ? "bg-[#FF3B30]"
                                    : "bg-[#8E8E93]"
                                }`}
                                title={isSuccess ? "Paid / Successful" : isFailed ? "Failed" : "Abandoned"}
                              />
                            </td>

                            {/* Amount Column */}
                            <td className="px-4 lg:px-6 py-3.5 whitespace-nowrap">
                              <span className="font-mono font-semibold text-[#1C1C1E] block">
                                {rec.amountPaidFormatted}
                              </span>
                            </td>

                            {/* Ratepayer & Account Column */}
                            <td className="px-4 lg:px-6 py-3.5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-[#007AFF]/10 text-[#007AFF] flex items-center justify-center font-bold text-xs shrink-0">
                                  {(rec.userName || "R").charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <span className="font-semibold text-[#1C1C1E] block truncate">
                                    {rec.userName}
                                  </span>
                                  <div className="flex items-center gap-1.5 text-[11px] font-mono">
                                    <span className="text-[#007AFF] font-medium">
                                      {rec.accountNumber}
                                    </span>
                                    <span className="text-[#8E8E93]">&bull;</span>
                                    <span className="text-[#6C6C70]">{rec.phoneNumber}</span>
                                  </div>
                                  {rec.payerName && rec.payerName.trim().toLowerCase() !== rec.userName.trim().toLowerCase() && (
                                    <span className="text-[10px] text-[#8E8E93] block truncate" title={`Paid by ${rec.payerName} (${rec.payerPhone || rec.phoneNumber})`}>
                                      Paid by: {rec.payerName}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Reference Column */}
                            <td className="px-4 lg:px-6 py-3.5">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-[11px] text-[#1C1C1E] select-all truncate max-w-[170px]" title={rec.reference}>
                                    {rec.reference}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigator.clipboard.writeText(rec.reference);
                                      setCopiedReference(rec.reference);
                                      setTimeout(() => setCopiedReference(null), 2000);
                                    }}
                                    className="text-[#8E8E93] hover:text-[#007AFF] p-0.5 cursor-pointer text-[10px]"
                                    title="Copy payment reference"
                                  >
                                    {copiedReference === rec.reference ? (
                                      <span className="text-[#34C759] font-medium">Copied!</span>
                                    ) : (
                                      <span className="underline">Copy</span>
                                    )}
                                  </button>
                                </div>
                                {rec.receiptNumber && (
                                  <span className="text-[10px] font-mono text-[#6C6C70] block truncate">
                                    Receipt: {rec.receiptNumber}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Channel Column */}
                            <td className="px-4 lg:px-6 py-3.5">
                              <span className="text-[#1C1C1E] font-medium block">
                                {rec.paymentMethod}
                              </span>
                              {rec.isTestUser && (
                                <span className="block text-[10px] text-[#FF9500] font-mono font-medium">Sandbox Test</span>
                              )}
                            </td>

                            {/* Paid On Column */}
                            <td className="px-4 lg:px-6 py-3.5 text-right text-[#6C6C70] text-[11px] whitespace-nowrap">
                              {rec.paidAt}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>

                {/* Mobile Paid Ratepayers / Transactions List (< 768px) */}
                <div className="block md:hidden divide-y divide-[#E5E5EA] bg-white">
                  {(isLoadingPaidUsers || !hasLoadedPaidUsersRef.current) && paidUsers.length === 0 ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <div key={`paid-mob-skel-${i}`} className="px-3.5 py-3 animate-pulse flex items-center justify-between gap-2.5">
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="h-3.5 w-24 bg-[#E5E5EA] rounded" />
                          <div className="h-2.5 w-36 bg-[#F2F2F7] rounded" />
                        </div>
                        <div className="h-4 w-16 bg-[#E5E5EA] rounded" />
                      </div>
                    ))
                  ) : paidUsers.length === 0 ? (
                    <div className="py-12 text-center text-[#6C6C70] text-xs px-4">
                      No payment records found.
                    </div>
                  ) : (
                    paidUsers.map((rec) => {
                      const isSuccess = rec.status === "PAID" || rec.status === "SUCCESS";
                      const isFailed = rec.status === "FAILED";
                      return (
                        <div
                          key={`mobile-paid-${rec.id}`}
                          onClick={() => setSelectedTransaction(rec)}
                          className="px-3.5 py-3 flex items-center justify-between gap-2.5 hover:bg-[#F8F9FA] active:bg-[#F2F2F7] transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <span
                              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                isSuccess ? "bg-[#34C759]" : isFailed ? "bg-[#FF3B30]" : "bg-[#8E8E93]"
                              }`}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-xs text-[#1C1C1E] truncate">
                                  {rec.userName}
                                </span>
                                <span className="text-[11px] font-mono text-[#007AFF] font-medium">
                                  {rec.accountNumber}
                                </span>
                              </div>
                              <div className="text-[11px] text-[#6C6C70] flex items-center gap-1.5 mt-0.5 font-mono truncate">
                                <span>{rec.reference}</span>
                                <span>&bull;</span>
                                <span className="font-sans">{rec.paymentMethod}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 text-right">
                            <div>
                              <div className="text-xs font-bold text-[#1C1C1E] tabular-nums font-mono">
                                {rec.amountPaidFormatted}
                              </div>
                              <div className="text-[10px] text-[#6C6C70]">
                                {rec.paidAt}
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-[#8E8E93] shrink-0 ml-0.5" />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Pagination Bar */}
              <SupabaseTablePagination
                currentPage={currentPaidUsersPage}
                totalPages={Math.max(1, Math.ceil(paidUsersTotal / paidUsersLimit))}
                totalRecords={paidUsersTotal}
                pageSize={paidUsersLimit}
                pageSizeOptions={[25, 50, 100]}
                onPageChange={(p) => setCurrentPaidUsersPage(p)}
                onPageSizeChange={(sz) => { setPaidUsersLimit(sz); setCurrentPaidUsersPage(1); }}
                isLoading={isLoadingPaidUsers}
                entityLabel="payments"
              />
            </section>

            {/* Centered Modal Popup for Transaction Details */}
            {selectedTransaction && (() => {
              const propMatch = propertiesList.find((p) => p.accountNumber === selectedTransaction.accountNumber) || data?.properties.find((p) => p.accountNumber === selectedTransaction.accountNumber);
              const resolvedOwnerName = (selectedTransaction.userName && selectedTransaction.userName !== 'Property Owner' && !/^\d+$/.test(selectedTransaction.userName))
                ? selectedTransaction.userName
                : propMatch?.ownerName || (selectedTransaction.payerName && !/^\d+$/.test(selectedTransaction.payerName) ? selectedTransaction.payerName : 'Property Owner');
              const enrichedTransaction: AdminPaidUserRecord = {
                ...selectedTransaction,
                userName: resolvedOwnerName,
              };
              return (
                <TransactionDetailWorkbench
                  transaction={enrichedTransaction}
                  onBack={() => setSelectedTransaction(null)}
                  onOpenDossier={(rec) => {
                    const preview: AdminRatepayerSummary = {
                      id: rec.userId || `usr_${rec.phoneNumber}`,
                      name: resolvedOwnerName,
                      phoneNumber: rec.phoneNumber,
                      role: 'RATEPAYER',
                      isVerified: true,
                      propertyCount: 1,
                      totalValuationFormatted: 'GH₵ 0.00',
                      totalArrears: 0,
                      totalArrearsFormatted: 'GH₵ 0.00',
                      totalDue: 0,
                      totalDueFormatted: 'GH₵ 0.00',
                      status: 'SETTLED',
                      createdAtFormatted: rec.paidAt || 'N/A',
                      accountNumber: rec.accountNumber || rec.propertyId || '',
                      accountNumbers: rec.accountNumber ? [rec.accountNumber] : rec.propertyId ? [rec.propertyId] : [],
                      location: propMatch?.ownerDigitalAddress || (propMatch as any)?.location || 'N/A',
                      currentBill: 0,
                      currentBillFormatted: 'GH₵ 0.00',
                      previousBill: 0,
                      previousBillFormatted: 'GH₵ 0.00',
                    };
                    // Keep transaction popup persistent in the backdrop shadow
                    if (rec.userId) {
                      handleOpenRatepayerDossier(rec.userId, preview);
                    } else if (propMatch) {
                      setSelectedAccount(propMatch);
                    } else {
                      handleOpenRatepayerDossier(`usr_${rec.phoneNumber}`, preview);
                    }
                  }}
                />
              );
            })()}
          </>
        )}

          {/* TAB: FEE PAYMENTS & REVENUE COLLECTIONS */}
          {activeTab === "FEE_PAYMENTS" && (() => {
            const feePaymentsSubheader = (
              <div className="w-full bg-white border-b border-[#E5E5EA] shadow-2xs">
                {/* View Switcher Bar (Strictly Zero Pills per UI_STANDARDS.md) */}
                <div className="px-4 lg:px-6 py-2.5 bg-[#F9F9FB] flex flex-wrap items-center justify-between gap-2 border-b border-[#E5E5EA]">
                  <div className="flex items-center gap-6">
                    <button
                      type="button"
                      onClick={() => setFeePaymentsViewMode("ACCOUNTS_MANAGER")}
                      className={`text-xs font-semibold py-1 transition-colors relative cursor-pointer ${
                        feePaymentsViewMode === "ACCOUNTS_MANAGER"
                          ? "text-[#007AFF] border-b-2 border-[#007AFF]"
                          : "text-[#6C6C70] hover:text-[#1C1C1E] border-b-2 border-transparent"
                      }`}
                    >
                      Ratepayer Payments & Settlements
                    </button>
                    <button
                      type="button"
                      onClick={() => setFeePaymentsViewMode("DATABASE_RECORDS")}
                      className={`text-xs font-semibold py-1 transition-colors relative cursor-pointer ${
                        feePaymentsViewMode === "DATABASE_RECORDS"
                          ? "text-[#007AFF] border-b-2 border-[#007AFF]"
                          : "text-[#6C6C70] hover:text-[#1C1C1E] border-b-2 border-transparent"
                      }`}
                    >
                      Database Records Ledger ({feePaymentsCount.count})
                    </button>
                  </div>
                </div>

                {feePaymentsViewMode === "DATABASE_RECORDS" && (
                  <div className="px-3 sm:px-4 lg:px-6 py-2 sm:py-2.5 bg-white border-b border-[#E5E5EA] flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 shrink-0">
                    <div className="flex items-center gap-2 w-full sm:max-w-md flex-1 order-last sm:order-none">
                      <div className="relative w-full">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-3 sm:top-2.5 text-[#8E8E93]" />
                        <input
                          type="text"
                          inputMode="search"
                          value={feePaymentsSearchQuery}
                          onChange={(e) => setFeePaymentsSearchQuery(e.target.value)}
                          placeholder="Search fee payments, receipts..."
                          className="w-full pl-8 pr-8 py-2 sm:py-1.5 bg-[#F2F2F7] border border-[#E5E5EA] rounded-lg text-xs text-[#1C1C1E] placeholder-[#8E8E93] focus:outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] focus:bg-white transition-colors"
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck={false}
                          data-lpignore="true"
                          data-1p-ignore="true"
                          data-bwignore="true"
                          data-form-type="other"
                        />
                        {feePaymentsSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setFeePaymentsSearchQuery("")}
                            className="absolute right-2.5 top-2.5 sm:top-2 text-[#8E8E93] hover:text-[#1C1C1E] cursor-pointer p-0.5"
                            title="Clear search"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-end-safe gap-2 overflow-x-auto no-scrollbar scroll-smooth w-full sm:w-auto shrink-0 py-0.5">
                      {/* Fields Filter Popover */}
                      <RequiredFieldsFilterPopover
                        title="Fee Payments Fields"
                        buttonLabel="Fields Filter"
                        availableCriteria={(DATABASE_TABLE_DEFINITIONS.FeePayments?.columns || []).map((col) => ({
                          key: col.key,
                          label: col.label,
                          category: (col.type === "currency" ? "Financial" : col.type === "date" ? "Date" : col.type === "number" ? "Numeric" : col.type === "boolean" ? "Status" : "General"),
                        }))}
                        requiredFields={tableVisibleColumns["FeePayments"] || []}
                        onChange={(fields) => {
                          setTableVisibleColumns((prev) => ({
                            ...prev,
                            FeePayments: fields,
                          }));
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );

            return (
              <section className="bg-white flex-1 flex flex-col min-h-0 overflow-hidden w-full border-0 rounded-none shadow-none">
                {/* Desktop-Only Toolbar (Always fixed at top on desktop) */}
                <div className="hidden md:block shrink-0">
                  {feePaymentsSubheader}
                </div>

                {feePaymentsViewMode === "ACCOUNTS_MANAGER" ? (
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    <PaymentsSection
                      currentAdmin={currentAdmin}
                      onOpenStatement={(accNo: string) => {
                        setStatementAccountNo(accNo);
                        setIsStatementReportActive(true);
                      }}
                    />
                  </div>
                ) : (
                  <UniversalDatabaseTable
                    tableDef={DATABASE_TABLE_DEFINITIONS.FeePayments}
                    hideToolbar={true}
                    visibleColumnKeys={tableVisibleColumns["FeePayments"]}
                    externalSearchQuery={feePaymentsSearchQuery}
                    onCountChange={(count, total) => setFeePaymentsCount({ count, total })}
                    onTableScroll={handleTableScroll}
                    mobileHeaderSlot={
                      <div
                        className={`w-full transition-transform duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                          !isHeaderVisible
                            ? "-translate-y-full pointer-events-none"
                            : "translate-y-0 pointer-events-auto shadow-md"
                        }`}
                      >
                        {feePaymentsSubheader}
                      </div>
                    }
                  />
                )}
              </section>
            );
          })()}

          {/* TAB 3: SMS BILL ROLLOUT & COMMUNICATIONS ENGINE */}
          {activeTab === "SMS_CENTER" && (
            <div className="flex-1 min-h-0 w-full h-full overflow-hidden flex flex-col">
              <SmsRolloutSimulator
                properties={properties}
                smsLogs={smsLogs}
                onTriggerBatchRollout={handleBatchDispatchSms}
                isProcessing={isProcessing}
                selectedProperties={selectedUnpaidList}
                onClearSelectedProperties={() => setSelectedIds([])}
                onNotify={(msg, type) => setToast({ message: msg, type })}
                isHeaderVisible={isHeaderVisible}
                onTableScroll={handleTableScroll}
              />
            </div>
          )}




          {/* TAB: ACTIVITY LOG */}
          {activeTab === "AUDIT_LOGS" && (
            <section className="bg-white flex-1 flex flex-col min-h-0 overflow-hidden w-full border-0 rounded-none shadow-none">
              {/* Filter Toolbar (Collapses on mobile scroll-down) */}
              <div
                className={`px-4 lg:px-6 bg-white border-b border-[#E5E5EA] flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 shrink-0 [overflow-anchor:none] will-change-transform transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden ${
                  !isHeaderVisible
                    ? "max-h-0 sm:max-h-none py-0 opacity-0 sm:opacity-100 pointer-events-none sm:pointer-events-auto border-b-0"
                    : "max-h-[140px] py-2.5 opacity-100"
                }`}
              >
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 sm:gap-3 w-full lg:flex-1">
                  <div className="relative flex-1 w-full sm:w-auto max-w-none sm:max-w-md order-last sm:order-none">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#8E8E93]" />
                    <input
                      type="text"
                      inputMode="search"
                      name="audit_trail_search_filter"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      data-lpignore="true"
                      data-1p-ignore="true"
                      data-bwignore="true"
                      data-form-type="other"
                      placeholder="Search activity log, administrator..."
                      value={auditLogSearchQuery}
                      onChange={(e) => setAuditLogSearchQuery(e.target.value)}
                      aria-label="Search audit trail"
                      onKeyDown={(e) => {
                        if (e.key === "Escape") handleClearAuditLogSearch();
                      }}
                      className="w-full pl-8 pr-8 py-1.5 bg-[#F2F2F7] border border-[#E5E5EA] rounded-lg text-xs text-[#1C1C1E] placeholder:text-[#8E8E93] focus:outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] focus:bg-white transition-colors"
                    />
                    {auditLogSearchQuery && (
                      <button
                        type="button"
                        onClick={handleClearAuditLogSearch}
                        className="absolute right-2.5 top-2 text-[#8E8E93] hover:text-[#1C1C1E] p-0.5 cursor-pointer"
                        title="Clear search"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <select
                    value={auditLogActionFilter}
                    onChange={(e) => handleAuditLogActionFilterChange(e.target.value)}
                    aria-label="Filter audit logs by action"
                    className="ml-auto h-8 px-3 bg-[#F2F2F7] border border-[#E5E5EA] rounded-lg text-xs text-[#1C1C1E] focus:outline-none focus:border-[#007AFF] cursor-pointer transition-colors"
                  >
                    <option value="ALL">All Recorded Actions</option>
                    <option value="RECORD_PAYMENT">Cash Settlements (RECORD_PAYMENT)</option>
                    <option value="BATCH_BILLING">Annual Billing Rollouts (BATCH_BILLING)</option>
                    <option value="BATCH_SMS_DISPATCH">SMS Batch Notices (BATCH_SMS_DISPATCH)</option>
                    <option value="SINGLE_SMS_DISPATCH">Direct SMS Notices (SINGLE_SMS_DISPATCH)</option>
                    <option value="EDIT_PROPERTY">Property Valuation Edits (EDIT_PROPERTY)</option>
                    <option value="CREATE_PROPERTY">Property Registrations (CREATE_PROPERTY)</option>
                  </select>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="text-xs text-[#6C6C70] font-medium">
                    {auditLogsTotal} event{auditLogsTotal === 1 ? "" : "s"} logged
                  </div>
                </div>
              </div>

              {/* Table Container */}
              <div
                ref={auditLogTableContainerRef}
                onScroll={handleTableScroll}
                className="w-full flex-1 min-h-0 min-h-[calc(100dvh-13rem)] overflow-y-auto overflow-x-hidden [overflow-anchor:auto] [isolation:isolate]"
              >
                {/* Desktop Audit Trail Table (>= 768px) */}
                <table className="hidden md:table table-fixed w-full text-left text-xs border-collapse">
                  <thead className="bg-[#F8F9FA] border-b border-[#E5E5EA] text-[#6C6C70] font-semibold text-[11px] sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-3 w-[14%] bg-[#F8F9FA] whitespace-nowrap">Date &amp; Time</th>
                      <th className="py-2.5 px-3 w-[19%] bg-[#F8F9FA] whitespace-nowrap">Administrative Action</th>
                      <th className="py-2.5 px-3 w-[13%] bg-[#F8F9FA] whitespace-nowrap">Target Entity</th>
                      <th className="py-2.5 px-3 w-[16%] bg-[#F8F9FA] whitespace-nowrap">Authorized Actor</th>
                      <th className="py-2.5 px-3 w-[26%] bg-[#F8F9FA]">Audit Narrative &amp; Scope</th>
                      <th className="py-2.5 px-3 w-[12%] text-right bg-[#F8F9FA] whitespace-nowrap">Tamper Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E5EA] bg-white font-sans">
                    {isLoadingAuditLogs && auditLogs.length === 0 ? (
                      Array.from({ length: 8 }).map((_, i) => (
                        <tr key={`audit-skel-${i}`} className="animate-pulse">
                          <td className="py-2.5 px-3">
                            <div className="h-3.5 w-20 bg-[#E5E5EA] rounded mb-1" />
                            <div className="h-2.5 w-14 bg-[#F2F2F7] rounded" />
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="h-3.5 w-28 bg-[#E5E5EA] rounded mb-1" />
                            <div className="h-2.5 w-20 bg-[#F2F2F7] rounded" />
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="h-3.5 w-20 bg-[#E5E5EA] rounded" />
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="h-3.5 w-24 bg-[#E5E5EA] rounded mb-1" />
                            <div className="h-2.5 w-16 bg-[#F2F2F7] rounded" />
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="h-3.5 w-48 bg-[#E5E5EA] rounded" />
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="h-3 w-20 bg-[#E5E5EA] rounded ml-auto" />
                          </td>
                        </tr>
                      ))
                    ) : filteredAuditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-[#6C6C70]">
                          <span className="italic">No audit trail records found matching your filter.</span>
                        </td>
                      </tr>
                    ) : (
                      filteredAuditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-[#F8F9FA] transition-colors">
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="font-medium text-[#1C1C1E]">{log.createdAtFormatted}</span>
                            <span className="text-[11px] text-[#6C6C70] block font-mono">{log.timeFormatted}</span>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="flex items-center gap-1.5 font-medium text-[#1C1C1E]">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: log.actionBadgeColor }}
                              />
                              {log.actionLabel}
                            </span>
                            <span className="text-[10px] text-[#6C6C70] font-mono block pl-3.5">{log.action}</span>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap text-[#6C6C70]">
                            <span className="font-medium text-[#1C1C1E]">{log.entityType}</span>
                            {log.entityId && (
                              <span className="text-[11px] text-[#6C6C70] font-mono block truncate max-w-[120px]">
                                #{log.entityId}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="font-semibold text-[#1C1C1E]">{log.adminName}</span>
                            <span className="text-[11px] text-[#6C6C70] block">{log.adminRole}</span>
                          </td>
                          <td className="py-2.5 px-3 text-[#1C1C1E] leading-relaxed break-words">
                            {log.details}
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <span className="text-[11px] font-medium text-[#34C759]">
                              &bull; Verified Immutable
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {/* Mobile Audit Trail Cards (< 768px) */}
                <div className="block md:hidden divide-y divide-[#E5E5EA] bg-white font-sans">
                  {isLoadingAuditLogs && auditLogs.length === 0 ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <div key={`audit-mob-skel-${i}`} className="p-3.5 space-y-2 animate-pulse">
                        <div className="flex justify-between items-center">
                          <div className="h-3.5 w-24 bg-[#E5E5EA] rounded" />
                          <div className="h-3 w-16 bg-[#F2F2F7] rounded" />
                        </div>
                        <div className="h-3 w-48 bg-[#E5E5EA] rounded" />
                        <div className="pt-1.5 border-t border-[#E5E5EA] flex justify-between items-center">
                          <div className="h-2.5 w-28 bg-[#F2F2F7] rounded" />
                          <div className="h-2.5 w-20 bg-[#F2F2F7] rounded" />
                        </div>
                      </div>
                    ))
                  ) : filteredAuditLogs.length === 0 ? (
                    <div className="py-12 text-center text-[#6C6C70] text-xs px-4">
                      <span className="italic">No audit trail records found matching your filter.</span>
                    </div>
                  ) : (
                    filteredAuditLogs.map((log) => (
                      <div
                        key={`mobile-audit-${log.id}`}
                        className="p-3.5 space-y-2 hover:bg-[#F8F9FA] transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 font-medium text-xs text-[#1C1C1E]">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: log.actionBadgeColor }}
                            />
                            {log.actionLabel}
                          </span>
                          <span className="text-[11px] font-medium text-[#34C759]">
                            &bull; Immutable
                          </span>
                        </div>

                        <div className="text-xs text-[#1C1C1E] leading-relaxed break-words">
                          {log.details}
                        </div>

                        <div className="pt-1.5 border-t border-[#E5E5EA] flex items-center justify-between text-[11px] text-[#6C6C70]">
                          <div>
                            <span className="font-semibold text-[#1C1C1E]">{log.adminName}</span>
                            <span className="text-[#6C6C70] ml-1">({log.adminRole})</span>
                          </div>
                          <span className="font-mono text-[10px]">
                            {log.createdAtFormatted} {log.timeFormatted}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Audit Trail Supabase Studio-Style Table Pagination Bar */}
              <SupabaseTablePagination
                currentPage={currentAuditLogPage}
                totalPages={Math.max(1, Math.ceil(auditLogsTotal / auditLogLimit))}
                totalRecords={auditLogsTotal}
                pageSize={auditLogLimit}
                pageSizeOptions={[25, 50, 100]}
                onPageChange={handleAuditLogPageChange}
                onPageSizeChange={handleAuditLogPageSizeChange}
                isLoading={isLoadingAuditLogs}
                entityLabel="events"
              />
            </section>
          )}

          {/* TAB 7: SETTINGS & SMS GATEWAY CONFIGURATION */}
          {activeTab === "SETTINGS" && (
            <SettingsTab onNotify={showToast} />
          )}
          </div>
          )}
        </main>

        {/* Static Grounded Footer */}
        <footer className="shrink-0 h-8 bg-white/80 backdrop-blur-md border-t border-[#E5E5EA] px-6 hidden lg:flex items-center justify-between text-[11px] text-[#8E8E93] font-sans">
          <span>HEINZ INTEGRATED SYSTEMS LIMITED</span>
        </footer>
      </div>

      {/* Apple-Style Mobile Bottom Navigation Bar (Authentic iOS UITabBar Standard) */}
      <nav
        className="sm:hidden shrink-0 w-full z-40 bg-white/85 backdrop-blur-2xl border-t border-[#E5E5EA] shadow-[0_-1px_3px_rgba(0,0,0,0.03)] pb-[env(safe-area-inset-bottom,0px)] select-none no-print"
        aria-label="Mobile Bottom Navigation"
      >
        <div className="h-[52px] flex items-center justify-around px-2 w-full">
          {visibleNavTabs.map((tab) => {
            const isActive = activeTab === tab.key;
            const Icon = tab.icon;
            return (
              <button
                key={`mobile-tab-${tab.key}`}
                type="button"
                onClick={() => handleTabChange(tab.key)}
                className="flex-1 flex flex-col items-center justify-center py-1 min-h-[48px] focus:outline-none cursor-pointer transition-all active:scale-95"
                role="tab"
                aria-selected={isActive}
                aria-label={tab.label}
              >
                <Icon
                  className={`w-5 h-5 shrink-0 transition-colors ${
                    isActive ? "text-[#007AFF]" : "text-[#8E8E93]"
                  }`}
                />
                <span
                  className={`text-[10px] tracking-tight mt-0.5 leading-none transition-colors ${
                    isActive
                      ? "text-[#007AFF] font-semibold"
                      : "text-[#8E8E93] font-medium"
                  }`}
                >
                  {tab.shortLabel || tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>


      {/* PROPERTY ASSESSMENT DOSSIER SIDE SHEET */}
      <AnimatePresence>
        {selectedAccount && (
          <motion.div 
            key="property-drawer-wrapper"
            className="fixed inset-0 z-[10000] flex justify-end pointer-events-auto"
          >
            <motion.div
              key="property-drawer-backdrop"
              initial={{ opacity: returnToRatepayerDossier ? 1 : 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: returnToRatepayerDossier ? 1 : 0 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="fixed inset-0 bg-black/30 backdrop-blur-xs"
              onClick={() => {
                setSelectedAccount(null);
                setReturnToRatepayerDossier(null);
              }}
            />

            <motion.aside
              key="property-drawer-panel"
              initial={returnToRatepayerDossier ? { x: 30, opacity: 0 } : { x: "100%" }}
              animate={{ x: 0, opacity: 1 }}
              exit={returnToRatepayerDossier ? { x: 30, opacity: 0 } : { x: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
              className="relative z-10 w-full max-w-lg bg-white/95 backdrop-blur-2xl h-full shadow-2xl flex flex-col border-l border-[#E5E5EA] font-sans"
            >
              <div className="px-6 py-4 border-b border-[#E5E5EA] flex items-center justify-between shrink-0 bg-white/80 backdrop-blur-md">
                <div>
                  {returnToRatepayerDossier && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = returnToRatepayerDossier;
                        setSelectedAccount(null);
                        setReturnToRatepayerDossier(null);
                        handleOpenRatepayerDossier(target.id, target.preview);
                      }}
                      className="inline-flex items-center gap-1 text-xs text-[#007AFF] hover:text-[#0062CC] font-semibold mb-1.5 cursor-pointer transition-colors"
                      title="Back"
                    >
                      <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
                      <span>Back</span>
                    </button>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#8E8E93] font-semibold uppercase tracking-wider">
                      Property Assessment Dossier
                    </span>
                    <span
                      className={`text-[11px] font-semibold ${selectedAccount.status === "PAID"
                          ? "text-[#34C759]"
                          : selectedAccount.status === "PARTIALLY_PAID"
                            ? "text-[#FF9500]"
                            : "text-[#FF3B30]"
                        }`}
                    >
                      &bull; {selectedAccount.status === "PAID" ? "Settled" : selectedAccount.status === "PARTIALLY_PAID" ? "Partial" : "Unpaid Demand"}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-[#1C1C1E] mt-0.5">
                    {selectedAccount.accountNumber}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedAccount(null);
                    setSelectedAccountSiblings([]);
                    setReturnToRatepayerDossier(null);
                  }}
                  className="p-1.5 rounded-lg text-[#8E8E93] hover:text-[#1C1C1E] hover:bg-[#F2F2F7] transition-colors cursor-pointer"
                  aria-label="Close dossier"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Multi-Property Portfolio Selector Bar (High Affordance Deck - Strictly Zero Pills) */}
              {selectedAccountSiblings && selectedAccountSiblings.length > 1 && (
                <div className="px-6 py-3 bg-[#F8F9FA] border-b border-[#E5E5EA] shrink-0">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-[#007AFF]" />
                      <span className="text-[11px] font-bold text-[#1C1C1E] uppercase tracking-wider">
                        Switch Property Account
                      </span>
                      <span className="text-[11px] text-[#8E8E93]">
                        ({selectedAccountSiblings.length} in Portfolio)
                      </span>
                    </div>
                    <span className="text-[10px] text-[#8E8E93] hidden sm:inline">
                      Click tile to inspect account
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-0.5">
                    {selectedAccountSiblings.map((prop) => {
                      const isSelected = (prop.accountNumber === selectedAccount.accountNumber) || (prop.id === selectedAccount.id);
                      const isPaid = prop.status === "PAID";
                      return (
                        <button
                          key={prop.id || prop.accountNumber}
                          type="button"
                          onClick={() => setSelectedAccount(prop)}
                          className={`p-2.5 rounded-xl text-left transition-all cursor-pointer relative ${
                            isSelected
                              ? "bg-white border border-[#007AFF]/30 border-l-[3.5px] border-l-[#007AFF] shadow-xs"
                              : "bg-[#F2F2F7] hover:bg-white border border-[#E5E5EA] hover:border-[#007AFF]/30 text-[#6C6C70]"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className={`font-mono text-xs font-bold truncate ${
                              isSelected ? "text-[#007AFF]" : "text-[#1C1C1E]"
                            }`}>
                              {prop.accountNumber}
                            </span>
                            <span className={`text-[10px] font-medium shrink-0 ${
                              isPaid ? "text-[#34C759]" : "text-[#FF3B30]"
                            }`}>
                              &bull; {isPaid ? "Paid" : prop.totalAmountDueFormatted || "Due"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-1 mt-1 text-[10px]">
                            <span className="text-[#8E8E93] truncate">
                              {prop.propertyClassification || prop.houseNo || "Property Account"}
                            </span>
                            {isSelected ? (
                              <span className="text-[#007AFF] font-semibold text-[10px]">
                                Active
                              </span>
                            ) : (
                              <span className="text-[#8E8E93]">
                                Switch &rsaquo;
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 text-xs divide-y divide-[#E5E5EA]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={selectedAccount.accountNumber || selectedAccount.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className="space-y-6 divide-y divide-[#E5E5EA]"
                  >
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold text-[#1C1C1E] uppercase tracking-wider">
                        Ratepayer &amp; Cadastre Location
                      </h4>
                      <dl className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs">
                        <div>
                          <dt className="text-[#6C6C70]">Account Head (Owner)</dt>
                          <dd className="font-medium text-[#1C1C1E] mt-0.5">{selectedAccount.ownerName}</dd>
                        </div>
                        <div>
                          <dt className="text-[#6C6C70]">Telephone No.</dt>
                          <dd className="font-medium text-[#1C1C1E] mt-0.5">{selectedAccount.ownerPhone}</dd>
                        </div>
                        <div>
                          <dt className="text-[#6C6C70]">GhanaPost GPS Code</dt>
                          <dd className="font-mono font-medium text-[#1C1C1E] mt-0.5">{selectedAccount.ownerDigitalAddress}</dd>
                        </div>
                        <div>
                          <dt className="text-[#6C6C70]">Assembly (MMDA)</dt>
                          <dd className="font-medium text-[#1C1C1E] mt-0.5">{selectedAccount.municipality}</dd>
                        </div>
                        <div className="col-span-2">
                          <dt className="text-[#6C6C70]">Zoning Classification</dt>
                          <dd className="font-medium text-[#1C1C1E] mt-0.5">{selectedAccount.propertyClassification}</dd>
                        </div>
                      </dl>
                    </div>

                    <div className="pt-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold text-[#1C1C1E] uppercase tracking-wider">
                          Valuation &amp; Statement of Account
                        </h4>
                        <span className="text-xs text-[#6C6C70]">FY {selectedAccount.billYear}</span>
                      </div>

                      <dl className="space-y-2 text-xs">
                        <div className="flex justify-between py-1 border-b border-[#E5E5EA]">
                          <dt className="text-[#6C6C70]">Rateable Valuation Roll</dt>
                          <dd className="font-medium text-[#1C1C1E] whitespace-nowrap tabular-nums">{selectedAccount.rateableValueFormatted}</dd>
                        </div>
                        <div className="flex justify-between py-1 border-b border-[#E5E5EA]">
                          <dt className="text-[#6C6C70]">Rate Imposed</dt>
                          <dd className="text-[#1C1C1E] whitespace-nowrap tabular-nums">{selectedAccount.rateImposed}</dd>
                        </div>
                        <div className="flex justify-between py-1 border-b border-[#E5E5EA]">
                          <dt className="text-[#6C6C70]">Previous Year Assessment</dt>
                          <dd className="text-[#1C1C1E] whitespace-nowrap tabular-nums">{selectedAccount.previousYearBillFormatted}</dd>
                        </div>
                        <div className="flex justify-between py-1 border-b border-[#E5E5EA]">
                          <dt className="text-[#6C6C70]">Carried Cumulative Arrears</dt>
                          <dd
                            className={`font-medium whitespace-nowrap tabular-nums ${
                              selectedAccount.status === "PAID" && selectedAccount.arrears > 0
                                ? "line-through text-[#8E8E93]"
                                : selectedAccount.arrears > 0
                                ? "text-[#FF3B30]"
                                : "text-[#1C1C1E]"
                            }`}
                            title={selectedAccount.status === "PAID" && selectedAccount.arrears > 0 ? "Arrears cleared" : undefined}
                          >
                            {selectedAccount.arrearsFormatted}
                          </dd>
                        </div>
                        <div className="flex justify-between py-1 border-b border-[#E5E5EA]">
                          <dt className="text-[#6C6C70]">2025 Current Rate Assessment</dt>
                          <dd className="font-medium text-[#1C1C1E] whitespace-nowrap tabular-nums">{selectedAccount.currentFeeFormatted}</dd>
                        </div>
                        <div className="flex justify-between pt-2 text-sm font-semibold">
                          <dt className="text-[#1C1C1E]">Total Amount Due</dt>
                          <dd className="text-[#1C1C1E] whitespace-nowrap tabular-nums">{selectedAccount.totalAmountDueFormatted}</dd>
                        </div>
                      </dl>
                    </div>

                    <div className="pt-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold text-[#1C1C1E] uppercase tracking-wider">
                          GCR Receipt Trail ({(selectedAccount.receipts || []).length})
                        </h4>
                        {selectedAccount.receipts && selectedAccount.receipts.length > 0 && (
                          <span className="text-[11px] font-semibold text-[#34C759]">
                            &bull; Active Ledger
                          </span>
                        )}
                      </div>
                      {(!selectedAccount.receipts || selectedAccount.receipts.length === 0) ? (
                        <div className="p-4 rounded-xl bg-[#F8F9FA] border border-dashed border-[#D1D1D6] text-center">
                          <p className="text-[#6C6C70] text-xs italic">No GCR payments recorded for this assessment cycle.</p>
                          <button
                            type="button"
                            onClick={() => {
                              setManualAmount(selectedAccount.totalAmountDue > 0 ? selectedAccount.totalAmountDue.toString() : "");
                              setShowPaymentModal(true);
                            }}
                            className="mt-2 text-xs font-semibold text-[#007AFF] hover:underline cursor-pointer"
                          >
                            + Record First Payment
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {selectedAccount.receipts.map((r) => (
                            <div
                              key={r.id}
                              className="p-3 rounded-xl bg-[#F8F9FA] border border-[#E5E5EA] flex items-center justify-between text-xs"
                            >
                              <div className="min-w-0 pr-2">
                                <p className="font-semibold text-[#1C1C1E] font-mono">{r.receiptNumber}</p>
                                <p className="text-[#6C6C70] text-[11px] mt-0.5 truncate">
                                  {r.paymentMethod || "Counter Cash"} &bull; {r.datePaid}
                                </p>
                                {r.settlementType && (
                                  <p className="text-[10px] text-[#8E8E93] mt-0.5">
                                    Settlement: {r.settlementType === 'ARREARS' ? 'Arrears Only' : 'Total Assessment'}
                                  </p>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                <span className="font-semibold text-[#34C759] tabular-nums">{r.amountFormatted}</span>
                                <p className="text-[10px] text-[#34C759] font-medium mt-0.5">&bull; Verified GCR</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              {!returnToRatepayerDossier && activeTab !== "RATEPAYERS" && activeTab !== "PAID_USERS" && activeTab !== "FEE_PAYMENTS" && !isAssemblyOfficer && (
                <div className="px-6 py-3.5 border-t border-[#E5E5EA] bg-white flex items-center justify-between gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowPaymentModal(true)}
                    className="apple-btn-secondary h-9 px-3.5 rounded-lg font-medium text-xs cursor-pointer text-[#1C1C1E] border-[#E5E5EA]"
                  >
                    Record Counter Payment
                  </button>

                  {selectedAccount.status !== "PAID" && (
                    <button
                      type="button"
                      onClick={() => {
                        setSmsAuthTargetAccounts([selectedAccount]);
                        setSmsAuthPassword("");
                        setSmsAuthError(null);
                        setShowSmsAuthModal(true);
                      }}
                      disabled={isProcessing}
                      className="apple-btn-primary h-9 px-3.5 rounded-lg font-medium text-xs flex items-center gap-1.5 cursor-pointer bg-[#007AFF] text-white hover:bg-[#0062CC]"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send SMS Notice</span>
                    </button>
                  )}

                </div>
              )}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {/* RATEPAYER FULL HISTORY DOSSIER SLIDING SHEET */}
      <RatepayerDossierSheet
        dossier={selectedRatepayerDossier}
        preview={previewRatepayer}
        isLoading={isFetchingDossier}
        isOpen={isDossierOpen}
        hideRecordPayment={activeTab === "PAID_USERS"}
        onClose={() => {
          setIsDossierOpen(false);
          setSelectedRatepayerDossier(null);
          setPreviewRatepayer(null);
          if (typeof window !== "undefined") {
            try {
              const url = new URL(window.location.href);
              if (url.searchParams.has("dossier")) {
                url.searchParams.delete("dossier");
                window.history.pushState(null, "", url.pathname + (url.search || ""));
              }
            } catch {}
          }
        }}
        onSelectProperty={(acc, origin) => {
          if (origin) {
            setReturnToRatepayerDossier(origin);
          } else {
            setReturnToRatepayerDossier(null);
          }
          const propFromDossier = selectedRatepayerDossier?.properties.find((p) => p.accountNumber === acc);
          const propFromList = propertiesList.find((p) => p.accountNumber === acc) || data?.properties.find((p) => p.accountNumber === acc);
          const prop = propFromDossier || propFromList;
          if (prop) setSelectedAccount(prop);
        }}
        onRecordPayment={(acc) => {
          const propFromDossier = selectedRatepayerDossier?.properties.find((p) => p.accountNumber === acc);
          const propFromList = propertiesList.find((p) => p.accountNumber === acc) || data?.properties.find((p) => p.accountNumber === acc);
          const prop = propFromDossier || propFromList;
          if (prop) {
            setSelectedAccount(prop);
            setManualAmount(prop.totalAmountDue > 0 ? prop.totalAmountDue.toString() : "");
          } else {
            setSelectedAccount(null);
            setManualAccountSearch(acc);
          }
          setPaymentAdminPassword("");
          setShowPaymentModal(true);
        }}
        onOpenStatement={(acc) => {
          setStatementAccountNo(acc);
          setIsAccountStatementDialogOpen(true);
        }}
      />

      {/* ANNUAL BATCH BILLING MODAL */}
      <AnimatePresence>
        {showBatchModal && (
          <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-0 sm:p-4 font-sans pointer-events-auto">
            {/* Smooth Fading Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setShowBatchModal(false)}
              className="fixed inset-0 bg-black/30 backdrop-blur-xs"
            />

            {/* Bottom-to-Top Sliding Modal Sheet */}
            <motion.div
              initial={{ y: "100%", opacity: 0.8 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="relative z-10 bg-white/95 backdrop-blur-2xl rounded-t-2xl sm:rounded-2xl border-t sm:border border-[#E5E5EA] shadow-2xl p-4 sm:p-6 max-w-md w-full font-sans max-h-[92vh] sm:max-h-[90vh] overflow-y-auto"
            >
              <div className="w-10 h-1 bg-[#D1D1D6] rounded-full mx-auto mb-3 sm:hidden shrink-0" />
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleRunBatchBilling();
                }}
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore="true"
                data-form-type="other"
                className="space-y-4"
              >
                {/* Anti-autofill Decoy Honeypot */}
                <input type="text" name="prevent_autofill_user" tabIndex={-1} aria-hidden="true" style={{ position: "absolute", top: -9999, left: -9999, opacity: 0, height: 0, width: 0, pointerEvents: "none" }} />
                <input type="password" name="prevent_autofill_pass" tabIndex={-1} aria-hidden="true" style={{ position: "absolute", top: -9999, left: -9999, opacity: 0, height: 0, width: 0, pointerEvents: "none" }} />
                <div className="flex items-center justify-between pb-3 border-b border-[#E5E5EA]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#007AFF]/10 text-[#007AFF] flex items-center justify-center">
                      <RefreshCw className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-[#1C1C1E]">
                        Generate Annual Bills
                      </h3>
                      <p className="text-xs text-[#6C6C70]">Annual Billing Cycle</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowBatchModal(false)}
                    className="text-[#8E8E93] hover:text-[#1C1C1E] hover:bg-[#F2F2F7] p-1 rounded-lg cursor-pointer transition-colors"
                    aria-label="Close modal"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-3.5 rounded-xl bg-[#F8F9FA] border border-[#E5E5EA] text-xs text-[#1C1C1E] space-y-2">
                  <p className="font-semibold text-[#007AFF]">
                    Generate &amp; Send Bills for {properties.length} Properties
                  </p>
                  <div className="space-y-3 pt-2">
                    <div className="space-y-1">
                      <label className="text-[#6C6C70] font-medium block">Residential Rate Factor</label>
                      <input
                        type="number"
                        step="0.001"
                        value={residentialRate}
                        onChange={(e) => setResidentialRate(e.target.value)}
                        aria-label="Residential Rate Factor"
                        className="w-full h-9 px-3 rounded-lg border border-[#E5E5EA] bg-white text-xs text-[#1C1C1E] focus:outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] transition-colors"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        data-lpignore="true"
                        data-1p-ignore="true"
                        data-bwignore="true"
                        data-form-type="other"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[#6C6C70] font-medium block">Commercial Rate Factor</label>
                      <input
                        type="number"
                        step="0.001"
                        value={commercialRate}
                        onChange={(e) => setCommercialRate(e.target.value)}
                        aria-label="Commercial Rate Factor"
                        className="w-full h-9 px-3 rounded-lg border border-[#E5E5EA] bg-white text-xs text-[#1C1C1E] focus:outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] transition-colors"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        data-lpignore="true"
                        data-1p-ignore="true"
                        data-bwignore="true"
                        data-form-type="other"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[#6C6C70] font-medium block">Statutory Due Date</label>
                      <input
                        type="text"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        aria-label="Statutory Due Date"
                        className="w-full h-9 px-3 rounded-lg border border-[#E5E5EA] bg-white text-xs text-[#1C1C1E] focus:outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] transition-colors"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        data-lpignore="true"
                        data-1p-ignore="true"
                        data-bwignore="true"
                        data-form-type="other"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[#6C6C70] font-medium block">SMS Bill Message Template</label>
                      <textarea
                        value={messageTemplate}
                        onChange={(e) => setMessageTemplate(e.target.value)}
                        aria-label="SMS Bill Message Template"
                        rows={4}
                        className="w-full p-2.5 rounded-lg border border-[#E5E5EA] bg-white text-xs text-[#1C1C1E] focus:outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] resize-none transition-colors"
                      />
                    </div>

                    {/* Security Authorization Password */}
                    <div className="space-y-1 pt-2 border-t border-[#E5E5EA]">
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-[#007AFF]" />
                        <label className="text-[#007AFF] font-semibold text-xs block">Admin Password Confirmation *</label>
                      </div>
                      <div className="relative">
                        <input
                          required
                          type={showBatchPassword ? "text" : "password"}
                          name="statutory_batch_rollout_auth_key"
                          autoComplete="new-password"
                          data-lpignore="true"
                          data-1p-ignore="true"
                          data-bwignore="true"
                          data-form-type="other"
                          value={batchAdminPassword}
                          onChange={(e) => setBatchAdminPassword(e.target.value)}
                          aria-label="Administrator Authorization Password"
                          placeholder="Enter administrator authorization password"
                          className="w-full h-9 px-3 pr-9 rounded-lg border border-[#E5E5EA] bg-white text-xs text-[#1C1C1E] focus:outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => setShowBatchPassword(!showBatchPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8E8E93] hover:text-[#1C1C1E] p-1 cursor-pointer"
                        >
                          {showBatchPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E5E5EA]">
                  <button
                    type="button"
                    onClick={() => setShowBatchModal(false)}
                    disabled={isProcessing}
                    className="apple-btn-secondary h-11 sm:h-9 px-3.5 rounded-lg text-[#1C1C1E] border-[#E5E5EA] font-medium text-xs cursor-pointer flex-1 sm:flex-none"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="apple-btn-primary h-11 sm:h-9 px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 flex-1 sm:flex-none bg-[#007AFF] text-white hover:bg-[#0062CC]"
                  >
                    {isProcessing ? <AppleSpinner size="xs" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    <span>Confirm &amp; Send Bills</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* RECORD PAYMENT MODAL */}
      <AnimatePresence>
        {showPaymentModal && (
          <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-0 sm:p-4 font-sans pointer-events-auto">
            {/* Smooth Fading Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setShowPaymentModal(false)}
              className="fixed inset-0 bg-black/30 backdrop-blur-xs"
            />

            {/* Bottom-to-Top Sliding Modal Sheet */}
            <motion.form
              onSubmit={handleRecordPayment}
              autoComplete="off"
              data-lpignore="true"
              data-1p-ignore="true"
              data-form-type="other"
              initial={{ y: "100%", opacity: 0.8 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="relative z-10 bg-white/95 backdrop-blur-2xl rounded-t-2xl sm:rounded-2xl border-t sm:border border-[#E5E5EA] shadow-2xl p-4 sm:p-5 max-w-md w-full space-y-3.5 text-xs font-sans max-h-[92vh] sm:max-h-[90vh] overflow-y-auto"
            >
              {/* Anti-autofill Decoy Honeypot */}
              <input type="text" name="prevent_autofill_user" tabIndex={-1} aria-hidden="true" style={{ position: "absolute", top: -9999, left: -9999, opacity: 0, height: 0, width: 0, pointerEvents: "none" }} />
              <input type="password" name="prevent_autofill_pass" tabIndex={-1} aria-hidden="true" style={{ position: "absolute", top: -9999, left: -9999, opacity: 0, height: 0, width: 0, pointerEvents: "none" }} />
              <div className="w-10 h-1 bg-[#D1D1D6] rounded-full mx-auto mb-2 sm:hidden shrink-0" />
              <div className="flex items-center justify-between border-b border-[#E5E5EA] pb-2.5">
                <h3 className="text-sm font-semibold text-[#1C1C1E]">
                  Record Manual Assembly Payment
                </h3>
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  disabled={isProcessing}
                  className="text-[#8E8E93] hover:text-[#1C1C1E] hover:bg-[#F2F2F7] p-1 rounded-lg cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Account Head: Preselected or Account Lookup */}
              {selectedAccount ? (
                <div className="space-y-1 p-2.5 bg-[#F2F2F7] rounded-xl border border-[#E5E5EA]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#6C6C70] font-semibold uppercase tracking-wider">Account Head</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAccount(null);
                        setManualAccountSearch("");
                      }}
                      className="text-[11px] text-[#007AFF] hover:underline cursor-pointer"
                    >
                      Change Account
                    </button>
                  </div>
                  <p className="font-semibold text-[#1C1C1E] text-xs">
                    {selectedAccount.accountNumber} {selectedAccount.ownerName ? `(${selectedAccount.ownerName})` : ""}
                  </p>
                  <p className="text-[11px] text-[#6C6C70]">
                    Total Outstanding Due: <span className="font-semibold text-[#FF3B30]">{selectedAccount.totalAmountDueFormatted}</span>
                  </p>
                  <p className="text-[10px] text-[#8E8E93] mt-2 pt-2 border-t border-[#E5E5EA]">
                    &bull; Payments automatically settle overdue arrears first before applying towards the active annual fee.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-[#6C6C70] font-medium text-xs block">Property Account Number *</label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="e.g. KKMA-10294"
                      value={manualAccountSearch}
                      onChange={(e) => {
                        const val = e.target.value;
                        setManualAccountSearch(val);
                        const match = propertiesList.find(
                          (p) => p.accountNumber.toLowerCase() === val.trim().toLowerCase()
                        ) || data?.properties.find(
                          (p) => p.accountNumber.toLowerCase() === val.trim().toLowerCase()
                        );
                        if (match) {
                          setSelectedAccount(match);
                          if (!manualAmount) setManualAmount(match.totalAmountDue.toString());
                        }
                      }}
                      className="w-full h-10 px-3 rounded-lg border border-[#E5E5EA] bg-white text-xs font-mono font-semibold text-[#1C1C1E] focus:outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] transition-colors"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      data-lpignore="true"
                      data-1p-ignore="true"
                      data-bwignore="true"
                      data-form-type="other"
                    />
                  </div>
                  <p className="text-[10px] text-[#8E8E93]">
                    Enter the property account number to record the counter receipt.
                  </p>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[#6C6C70] font-medium">Payment Amount (GH₵) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder={selectedAccount ? selectedAccount.totalAmountDue.toString() : "0.00"}
                  value={manualAmount}
                  onChange={(e) => setManualAmount(e.target.value)}
                  aria-label="Payment Amount in Ghanaian Cedi"
                  className="w-full h-10 px-3 rounded-lg border border-[#E5E5EA] bg-white text-xs font-semibold text-[#1C1C1E] focus:outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] transition-colors"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-bwignore="true"
                  data-form-type="other"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[#6C6C70] font-medium">Payment Channel</label>
                <select
                  value={manualMethod}
                  onChange={(e) => setManualMethod(e.target.value)}
                  aria-label="Select Payment Channel"
                  className="w-full h-10 px-3 rounded-lg border border-[#E5E5EA] bg-white text-xs text-[#1C1C1E] focus:outline-none focus:border-[#007AFF] transition-colors"
                >
                  <option>Cash</option>
                  <option>Cheque</option>
                </select>
              </div>

              {/* Password */}
              <div className="space-y-1 pt-2 border-t border-[#E5E5EA]">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#007AFF]" />
                  <label className="text-[#1C1C1E] font-semibold text-xs block">
                    Password *
                  </label>
                </div>
                <div className="relative">
                  <input
                    required
                    type={showPaymentPassword ? "text" : "password"}
                    name="municipal_manual_settlement_auth_key"
                    autoComplete="new-password"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    data-form-type="other"
                    value={paymentAdminPassword}
                    onChange={(e) => setPaymentAdminPassword(e.target.value)}
                    aria-label="Password"
                    placeholder="Password"
                    className="w-full h-10 px-3 pr-9 rounded-lg border border-[#E5E5EA] bg-white text-xs font-semibold text-[#1C1C1E] focus:outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPaymentPassword(!showPaymentPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8E8E93] hover:text-[#1C1C1E] p-1 cursor-pointer"
                  >
                    {showPaymentPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E5E5EA]">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  disabled={isProcessing}
                  className="apple-btn-secondary h-11 sm:h-9 px-3.5 rounded-lg border-[#E5E5EA] text-[#1C1C1E] font-medium transition-colors cursor-pointer flex-1 sm:flex-none"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isProcessing}
                  className="apple-btn-primary h-11 sm:h-9 px-4 rounded-lg font-medium flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 flex-1 sm:flex-none bg-[#007AFF] text-white hover:bg-[#0062CC]"
                >
                  {isProcessing ? <AppleSpinner size="xs" /> : null}
                  <span>Issue &amp; Reconcile GCR</span>
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      {/* Systematic Notification Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed bottom-6 left-6 z-60 max-w-md w-[calc(100%-3rem)] bg-white/95 backdrop-blur-xl text-[#1C1C1E] px-4 py-3 rounded-2xl shadow-xl border border-[#E5E5EA] flex items-center justify-between gap-3 text-xs font-medium font-sans"
            role="status"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {toast.type === "success" && (
                <CheckCircle2 className="w-4 h-4 text-[#34C759] shrink-0" />
              )}
              {toast.type === "error" && (
                <AlertTriangle className="w-4 h-4 text-[#FF3B30] shrink-0" />
              )}
              {toast.type === "info" && (
                <Info className="w-4 h-4 text-[#007AFF] shrink-0" />
              )}
              <span className="text-[#1C1C1E] leading-snug">{toast.message}</span>
            </div>

            <button
              type="button"
              onClick={() => setToast(null)}
              className="text-[#8E8E93] hover:text-[#1C1C1E] p-1 rounded-lg transition-colors shrink-0 cursor-pointer"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <PropertyModal
        isOpen={showPropertyModal}
        onClose={() => setShowPropertyModal(false)}
        property={null}
        onSuccess={() => {
          showToast("Property assessment saved successfully.", "success");
          loadData(1);
        }}
      />

      {/* HIGH-SECURITY SMS AUTHORIZATION MODAL (INDIVIDUAL & SELECTIVE TARGETS) */}
      <AnimatePresence>
        {showSmsAuthModal && smsAuthTargetAccounts.length > 0 && (
          <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-0 sm:p-4 font-sans pointer-events-auto">
            {/* Smooth Fading Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => {
                setShowSmsAuthModal(false);
                setSmsAuthPassword("");
                setSmsAuthError(null);
              }}
              className="fixed inset-0 bg-black/30 backdrop-blur-xs"
            />

            {/* Bottom-to-Top Sliding Modal Sheet */}
            <motion.div
              initial={{ y: "100%", opacity: 0.8 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="relative z-10 bg-white/95 backdrop-blur-2xl rounded-t-2xl sm:rounded-2xl border-t sm:border border-[#E5E5EA] shadow-2xl p-4 sm:p-6 max-w-lg w-full space-y-4 max-h-[92vh] sm:max-h-[90vh] overflow-y-auto"
            >
              {/* Anti-autofill Decoy Honeypot */}
              <input type="text" name="prevent_autofill_user" tabIndex={-1} aria-hidden="true" style={{ position: "absolute", top: -9999, left: -9999, opacity: 0, height: 0, width: 0, pointerEvents: "none" }} />
              <input type="password" name="prevent_autofill_pass" tabIndex={-1} aria-hidden="true" style={{ position: "absolute", top: -9999, left: -9999, opacity: 0, height: 0, width: 0, pointerEvents: "none" }} />
              <div className="w-10 h-1 bg-[#D1D1D6] rounded-full mx-auto mb-2 sm:hidden shrink-0" />
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[#E5E5EA]">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-[#007AFF]/10 text-[#007AFF] flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-[#007AFF]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#1C1C1E]">
                      Authorize SMS Rollout Transmission
                    </h3>
                    <p className="text-xs text-[#6C6C70]">Communications Directorate &bull; Act 936</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowSmsAuthModal(false);
                    setSmsAuthPassword("");
                    setSmsAuthError(null);
                  }}
                  className="w-7 h-7 rounded-lg text-[#8E8E93] hover:text-[#1C1C1E] hover:bg-[#F2F2F7] flex items-center justify-center cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Target Audience Summary */}
              <div className="bg-[#F8F9FA] rounded-xl p-3.5 border border-[#E5E5EA] space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#6C6C70] font-medium">Target Recipients:</span>
                  <span className="font-semibold text-[#1C1C1E]">
                    {smsAuthTargetAccounts.length} {smsAuthTargetAccounts.length === 1 ? "Taxpayer Account" : "Taxpayer Accounts"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#6C6C70] font-medium">Total Balance to Notify:</span>
                  <span className="font-semibold text-[#FF3B30]">
                    GH₵ {smsAuthTargetAccounts.reduce((acc, curr) => acc + (curr.totalAmountDue || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#6C6C70] font-medium">Outbound Gateway:</span>
                  <span className="font-medium text-[#34C759]">Arkesel SMS Gateway (Sender ID: Arnold)</span>
                </div>
              </div>

              {/* Recipient Details List */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1C1C1E] block">
                  Recipient Roster ({smsAuthTargetAccounts.length})
                </label>
                <div className="max-h-36 overflow-y-auto rounded-lg border border-[#E5E5EA] divide-y divide-[#E5E5EA] bg-[#F8F9FA] text-xs">
                  {smsAuthTargetAccounts.map((t) => (
                    <div key={t.id} className="p-2.5 flex items-center justify-between hover:bg-[#F2F2F7] transition-colors">
                      <div>
                        <span className="font-semibold text-[#1C1C1E]">{t.ownerName}</span>
                        <p className="text-[11px] text-[#6C6C70] font-mono">{t.accountNumber} &bull; {t.ownerPhone}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold text-[#1C1C1E]">{t.totalAmountDueFormatted}</span>
                        <p className="text-[10px] text-[#FF3B30]">Due</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Password Challenge Field */}
              <div className="space-y-1.5 pt-2 border-t border-[#E5E5EA]">
                <label className="text-xs font-semibold text-[#1C1C1E] flex items-center justify-between">
                  <span>Enter Administrator Security Password</span>
                  <span className="text-[10px] text-[#6C6C70] font-normal">Required for authorization</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8E8E93]">
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type={showSmsAuthPassword ? "text" : "password"}
                    name="sms_rollout_security_key"
                    autoComplete="new-password"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    data-form-type="other"
                    value={smsAuthPassword}
                    onChange={(e) => {
                      setSmsAuthPassword(e.target.value);
                      if (smsAuthError) setSmsAuthError(null);
                    }}
                    aria-label="Administrator security authorization password"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !isProcessing && smsAuthPassword.trim()) {
                        handleExecuteSmsDispatch();
                      }
                    }}
                    placeholder="Enter administrator authorization password"
                    className="w-full h-10 pl-9 pr-10 rounded-lg border border-[#E5E5EA] bg-white text-xs text-[#1C1C1E] focus:outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSmsAuthPassword(!showSmsAuthPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#8E8E93] hover:text-[#1C1C1E] cursor-pointer"
                  >
                    {showSmsAuthPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {smsAuthError && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-[#FF3B30] font-medium flex items-center gap-1 mt-1"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{smsAuthError}</span>
                  </motion.p>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E5E5EA]">
                <button
                  type="button"
                  onClick={() => {
                    setShowSmsAuthModal(false);
                    setSmsAuthPassword("");
                    setSmsAuthError(null);
                  }}
                  disabled={isProcessing}
                  className="apple-btn-secondary h-11 sm:h-9 px-4 rounded-lg text-xs font-medium cursor-pointer flex-1 sm:flex-none text-[#1C1C1E] border-[#E5E5EA]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteSmsDispatch}
                  disabled={isProcessing || !smsAuthPassword.trim()}
                  className="apple-btn-primary h-11 sm:h-9 px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 flex-1 sm:flex-none bg-[#007AFF] text-white hover:bg-[#0062CC]"
                >
                  {isProcessing ? (
                    <>
                      <AppleSpinner size="xs" />
                      <span>Verifying &amp; Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Authorize &amp; Dispatch SMS</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ACCOUNT STATEMENT DIALOG */}
      <AccountStatementDialog
        isOpen={isAccountStatementDialogOpen}
        onClose={() => setIsAccountStatementDialogOpen(false)}
        initialAccountNo={statementAccountNo}
        onPreview={(accountNo, startDate, endDate) => {
          setStatementAccountNo(accountNo);
          setStatementStartDate(startDate);
          setStatementEndDate(endDate);
          setIsAccountStatementDialogOpen(false);
          setIsStatementReportActive(true);
        }}
      />

      {/* BULK CADASTRE CSV IMPORTER MODAL */}
      <CsvImportModal
        isOpen={showCsvImportModal}
        onClose={() => setShowCsvImportModal(false)}
        onSuccess={(count) => {
          showToast(`Successfully imported ${count} properties into the municipal register.`, "success");
          loadData();
        }}
      />


    </div>
  );
}
