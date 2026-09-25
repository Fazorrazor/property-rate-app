"use client";

import { useState, useEffect, useRef, useMemo, useDeferredValue } from "react";
import {
  RefreshCw,
  Send,
  Search,
  Download,
  Phone,
  ExternalLink,
  X,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Info,
  Loader2,
  Users,
  Building2,
  Receipt,
  MessageSquare,
  ShieldAlert,
  ShieldCheck,
  Landmark,
  Lock,
  Eye,
  EyeOff,
  UploadCloud,
  Settings,
  Menu,
  CreditCard,
  ChevronRight,
  LogOut,
  Flag,
  XCircle,
  ArrowLeft,
} from "lucide-react";
import {
  getAdminOverview,
  getRatepayersList,
  getRatepayerHistory,
  getSmsRolloutLogs,
  getAuditTrailList,
  simulateSmsNoticeDispatch,
  batchDispatchSms,
  getSmsJobStatus,
  recordManualCashPayment,
  runAnnualBillingBatch,
  getSmsSettings,
  adminLogout,
  getCurrentAdmin,
  AdminDashboardData,
  AdminProperty,
  AdminPropertyReceipt,
  AdminRatepayerSummary,
  RatepayerHistoryDossier,
  SmsRolloutLogItem,
  AdminAuditLogItem,
  getTreasuryReceipts,
  AdminTreasuryReceipt,
} from "./actions";
import {
  exportCadastreCsv,
  exportRatepayersCsv,
  exportTreasuryCsv,
  exportAuditLogsCsv,
} from "@/lib/csv-export";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { RatepayerDossierSheet } from "@/components/RatepayerDossierSheet";
import { SettingsTab } from "@/components/SettingsTab";
import { SupabaseTablePagination } from "@/components/SupabaseTablePagination";
import { SmsRolloutSkeleton } from "@/components/Skeletons";

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

type NavTab = "REGISTRY" | "RATEPAYERS" | "SMS_CENTER" | "TREASURY" | "AUDIT_LOGS" | "SETTINGS";

const NAV_TABS: { key: NavTab; label: string; shortLabel: string; icon: any }[] = [
  { key: "REGISTRY", label: "Properties", shortLabel: "Properties", icon: Building2 },
  { key: "RATEPAYERS", label: "Property Owners", shortLabel: "Owners", icon: Users },
  { key: "SMS_CENTER", label: "Send SMS Bills", shortLabel: "SMS Bills", icon: MessageSquare },
  { key: "TREASURY", label: "Payments & Receipts", shortLabel: "Payments", icon: Landmark },
  { key: "AUDIT_LOGS", label: "Activity Log", shortLabel: "Activity", icon: ShieldCheck },
  { key: "SETTINGS", label: "SMS & App Settings", shortLabel: "Settings", icon: Settings },
];

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [propertiesList, setPropertiesList] = useState<AdminProperty[]>([]);
  const [currentPropertyPage, setCurrentPropertyPage] = useState(1);
  const [propertyLimit, setPropertyLimit] = useState(50);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const [ratepayers, setRatepayers] = useState<AdminRatepayerSummary[]>([]);
  const [ratepayersTotal, setRatepayersTotal] = useState(0);
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

  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [activeTab, setActiveTab] = useState<NavTab>("REGISTRY");
  const [currentPage, setCurrentPage] = useState(1);

  // High-Security SMS Authorization Modal States (Targeted & Selective)
  const [showSmsAuthModal, setShowSmsAuthModal] = useState(false);
  const [smsAuthTargetAccounts, setSmsAuthTargetAccounts] = useState<AdminProperty[]>([]);
  const [smsAuthPassword, setSmsAuthPassword] = useState("");
  const [showSmsAuthPassword, setShowSmsAuthPassword] = useState(false);
  const [smsAuthError, setSmsAuthError] = useState<string | null>(null);

  // Bulk CSV Cadastre Importer State
  const [showCsvImportModal, setShowCsvImportModal] = useState(false);

  // Mobile Drawer Navigation State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Desktop Supabase-Style Curtain Sidebar Hover State
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

  // Dedicated Municipal Admin State
  const [currentAdmin, setCurrentAdmin] = useState<{ id: string; username: string; name: string; role: string } | null>(null);

  // Return to Ratepayer Dossier from Property Roll
  const [returnToRatepayerDossier, setReturnToRatepayerDossier] = useState<{ id: string; name: string; preview: any } | null>(null);

  useEffect(() => {
    const verifySession = async () => {
      try {
        const admin = await getCurrentAdmin();
        if (admin) {
          setCurrentAdmin(admin);
        } else {
          window.location.href = "/login?expired=true";
        }
      } catch {
        window.location.href = "/login?expired=true";
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


  // Tab persistence & Deep link synchronization
  const handleTabChange = (newTab: NavTab) => {
    setActiveTab(newTab);
    try {
      localStorage.setItem("admin_active_tab", newTab);
      const params = new URLSearchParams(window.location.search);
      params.set("tab", newTab);
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState(null, "", newUrl);
    } catch (e) {
      // non-fatal
    }
  };

  // Sync initial tab from URL or localStorage on mount
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlTab = params.get("tab") as NavTab | null;
      const savedTab = localStorage.getItem("admin_active_tab") as NavTab | null;
      const validTabs: NavTab[] = ["REGISTRY", "RATEPAYERS", "SMS_CENTER", "TREASURY", "AUDIT_LOGS", "SETTINGS"];

      if (urlTab && validTabs.includes(urlTab)) {
        setActiveTab(urlTab);
      } else if (savedTab && validTabs.includes(savedTab)) {
        setActiveTab(savedTab);
        params.set("tab", savedTab);
        window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
      }
    } catch (e) {
      // non-fatal
    }
  }, []);

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

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [treasurySearchQuery, setTreasurySearchQuery] = useState("");
  const [treasuryMethodFilter, setTreasuryMethodFilter] = useState("ALL");
  const [isSearchingProperties, setIsSearchingProperties] = useState(false);
  const [municipalityFilter, setMunicipalityFilter] = useState("Kpone-Katamanso (KKMA)");
  const [classificationFilter, setClassificationFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PAID" | "UNPAID" | "DEFAULTER">("ALL");
  const [treasuryReceipts, setTreasuryReceipts] = useState<AdminTreasuryReceipt[]>([]);
  const [treasuryReceiptsTotal, setTreasuryReceiptsTotal] = useState(0);
  const [isLoadingTreasury, setIsLoadingTreasury] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // React 19 Deferred Search Queries for <16ms Non-Blocking Keystrokes
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const deferredTreasurySearchQuery = useDeferredValue(treasurySearchQuery);

  const activePropertyQueryRef = useRef("");
  const activeAuditQueryRef = useRef("");

  const baselineOverviewRef = useRef<AdminDashboardData | null>(null);
  const baselineAuditLogsRef = useRef<{ logs: AdminAuditLogItem[]; total: number } | null>(null);

  // Selection & Drawer states
  const [selectedAccount, setSelectedAccount] = useState<AdminProperty | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPropertyModal, setShowPropertyModal] = useState(false);
  const [manualAmount, setManualAmount] = useState("");
  const [manualMethod, setManualMethod] = useState("Counter Cash Treasury");
  const [paymentAdminPassword, setPaymentAdminPassword] = useState("");
  const [showPaymentPassword, setShowPaymentPassword] = useState(false);

  // Batch Rollout States
  const [residentialRate, setResidentialRate] = useState("0.005");
  const [commercialRate, setCommercialRate] = useState("0.015");
  const [otherRate, setOtherRate] = useState("0.010");
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
    limit = propertyLimit
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
        status as any
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

    // 2. Fetch secondary tabs only on initial mount
    if (isInitial) {
      try {
        const [logsRes, auditRes] = await Promise.all([
          getSmsRolloutLogs(),
          getAuditTrailList("", "ALL", 1, 50),
        ]);
        if (logsRes) setSmsLogs(logsRes);
        if (auditRes) {
          baselineAuditLogsRef.current = auditRes;
          setAuditLogs(auditRes.logs);
          setAuditLogsTotal(auditRes.total);
          setCurrentAuditLogPage(1);
        }
        getTreasuryReceipts("", "ALL", 1, 50).then((tres) => {
          if (tres) {
            setTreasuryReceipts(tres.receipts);
            setTreasuryReceiptsTotal(tres.total);
          }
        }).catch(() => {});
      } catch (err) {
        console.error("Background data fetch error:", err);
      }
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
    loadData(newPage, searchQuery, municipalityFilter, classificationFilter, statusFilter, false, propertyLimit);
  };

  const handlePropertyPageSizeChange = (newLimit: number) => {
    setPropertyLimit(newLimit);
    loadData(1, searchQuery, municipalityFilter, classificationFilter, statusFilter, false, newLimit);
  };

  const handleAuditLogPageChange = (newPage: number) => {
    loadAuditLogs(auditLogSearchQuery, auditLogActionFilter, newPage, auditLogLimit);
  };

  const handleAuditLogPageSizeChange = (newLimit: number) => {
    setAuditLogLimit(newLimit);
    loadAuditLogs(auditLogSearchQuery, auditLogActionFilter, 1, newLimit);
  };

  // Initial load once on mount
  useEffect(() => {
    loadData(1, "", "ALL", "ALL", "ALL", true);
  }, []);

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
  }, [municipalityFilter, classificationFilter, statusFilter, activeTab]);

  // Dedicated server query for Treasury Reconciliation tab
  useEffect(() => {
    if (isInitialLoading) return;
    if (activeTab === "TREASURY") {
      setIsLoadingTreasury(true);
      const timer = setTimeout(async () => {
        try {
          const res = await getTreasuryReceipts(treasurySearchQuery, treasuryMethodFilter, 1, 100);
          if (res) {
            setTreasuryReceipts(res.receipts);
            setTreasuryReceiptsTotal(res.total);
          }
        } catch (err) {
          console.error("Error loading treasury receipts:", err);
        } finally {
          setIsLoadingTreasury(false);
        }
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [treasurySearchQuery, treasuryMethodFilter, activeTab]);

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

  // Dedicated pagination loader for Ratepayers
  const loadRatepayers = async (query = "", page = 1, limit = ratepayerLimit) => {
    setIsLoadingRatepayers(true);
    try {
      const res = await getRatepayersList(query, page, limit);
      if (res) {
        setRatepayers(res.ratepayers);
        setRatepayersTotal(res.total);
        setCurrentRatepayerPage(page);
      }
    } catch (err) {
      console.error("Error loading ratepayers list:", err);
    } finally {
      setIsLoadingRatepayers(false);
    }
  };

  const handleRatepayerPageChange = (newPage: number) => {
    loadRatepayers(deferredRatepayerSearchQuery, newPage, ratepayerLimit);
  };

  const handleRatepayerPageSizeChange = (newLimit: number) => {
    setRatepayerLimit(newLimit);
    loadRatepayers(deferredRatepayerSearchQuery, 1, newLimit);
  };

  useEffect(() => {
    if (activeTab === "RATEPAYERS") {
      loadRatepayers(deferredRatepayerSearchQuery, 1, ratepayerLimit);
    }
  }, [activeTab, deferredRatepayerSearchQuery]);


  // Lock background scroll when modal or drawer is active
  useEffect(() => {
    const isAnyModalOpen = Boolean(
      selectedAccount || showBatchModal || showPaymentModal || showPropertyModal || isDossierOpen || showSmsAuthModal
    );
    if (isAnyModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [selectedAccount, showBatchModal, showPaymentModal, isDossierOpen, showSmsAuthModal]);


  // Open Ratepayer Dossier (Instant popup <50ms with background lazy loading)
  const handleOpenRatepayerDossier = (userId: string, preview?: AdminRatepayerSummary) => {
    const initialPreview = preview || null;
    setPreviewRatepayer(initialPreview);
    setSelectedRatepayerDossier(null);
    setIsDossierOpen(true);
    setIsFetchingDossier(true);

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
  const [smsJobProgress, setSmsJobProgress] = useState<{ status: string; sentCount: number; failedCount: number; totalCount: number } | null>(null);

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
        // Job complete — refresh logs and clear job after a short display delay
        getSmsRolloutLogs().then((logs) => { if (!cancelled) setSmsLogs(logs); });
        setTimeout(() => { if (!cancelled) { setSmsJobId(null); setSmsJobProgress(null); } }, 4000);
      } else {
        setTimeout(poll, 2000);
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [smsJobId]);

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
        return { success: true };
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
    if (!selectedAccount) return;
    const num = parseFloat(manualAmount);
    if (isNaN(num) || num <= 0) {
      showToast("Please enter a valid payment amount.", "error");
      return;
    }
    if (!paymentAdminPassword.trim()) {
      showToast("Administrator security password is required.", "error");
      return;
    }

    setIsProcessing(true);
    try {
      const res = await recordManualCashPayment(selectedAccount.accountNumber, num, manualMethod, paymentAdminPassword);
      if (res.success) {
        setShowPaymentModal(false);
        setManualAmount("");
        setPaymentAdminPassword("");
        showToast(`Payment recorded successfully. GCR Receipt #${res.receiptNumber}`, "success");
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

  const handleExportPropertiesCsv = (filteredOnly = false) => {
    const listToExport = filteredOnly && selectedIds.length > 0
      ? propertiesList.filter((p) => selectedIds.includes(p.accountNumber))
      : (filteredProperties.length > 0 ? filteredProperties : propertiesList);

    if (listToExport.length === 0) {
      showToast("No property records available to export.", "info");
      return;
    }

    const scopeDesc = selectedIds.length > 0
      ? `Selected Accounts (${selectedIds.length} properties)`
      : `Classification: ${classificationFilter} | Status: ${statusFilter} | Search: "${searchQuery || 'None'}"`;

    const totalVal = listToExport.reduce((sum, p) => sum + (p.rateableValue || 0), 0);
    const totalArr = listToExport.reduce((sum, p) => sum + (p.arrears || 0), 0);
    const totalDue = listToExport.reduce((sum, p) => sum + (p.totalAmountDue || 0), 0);

    exportCadastreCsv(listToExport, {
      reportTitle: "Cadastre Master Valuation Roll & Property Register",
      filterScope: scopeDesc,
      generatedBy: currentAdmin?.name ? `${currentAdmin.name} (${currentAdmin.role})` : "Revenue Administrator",
      recordCount: listToExport.length,
      financialSummary: {
        totalValuation: totalVal,
        totalArrears: totalArr,
        totalDue: totalDue,
      },
    });

    showToast(`Exported ${listToExport.length} property records with linked portfolio hierarchy.`, "success");
  };

  const handleExportRatepayersCsv = () => {
    const listToExport = ratepayers;
    if (listToExport.length === 0) {
      showToast("No ratepayer records available to export.", "info");
      return;
    }

    const totalVal = propertiesList.reduce((sum, p) => sum + (p.rateableValue || 0), 0);
    const totalArr = propertiesList.reduce((sum, p) => sum + (p.arrears || 0), 0);
    const totalDue = propertiesList.reduce((sum, p) => sum + (p.totalAmountDue || 0), 0);

    exportRatepayersCsv(listToExport, propertiesList, {
      reportTitle: "Ratepayer Portfolios & Linked Accounts Master Roll",
      filterScope: ratepayerSearchQuery ? `Search: "${ratepayerSearchQuery}"` : "All Registered Ratepayers",
      generatedBy: currentAdmin?.name ? `${currentAdmin.name} (${currentAdmin.role})` : "Revenue Administrator",
      recordCount: listToExport.length,
      financialSummary: {
        totalValuation: totalVal,
        totalArrears: totalArr,
        totalDue: totalDue,
      },
    });

    showToast(`Exported ${listToExport.length} ratepayer portfolios with linked accounts hierarchy.`, "success");
  };

  const handleExportTreasuryCsv = () => {
    const listToExport = filteredTreasuryReceipts.length > 0 ? filteredTreasuryReceipts : treasuryReceipts;
    if (listToExport.length === 0) {
      showToast("No treasury records available to export.", "info");
      return;
    }

    const totalCollected = listToExport.reduce((sum, r) => sum + (r.amount || 0), 0);

    exportTreasuryCsv(listToExport, {
      reportTitle: "Treasury Revenue Collection & GCR Reconciliation",
      filterScope: `Channel: ${treasuryMethodFilter} | Search: "${treasurySearchQuery || 'None'}"`,
      generatedBy: currentAdmin?.name ? `${currentAdmin.name} (${currentAdmin.role})` : "Revenue Administrator",
      recordCount: listToExport.length,
      financialSummary: {
        totalCollected,
      },
    });

    showToast(`Exported ${listToExport.length} treasury receipt records.`, "success");
  };

  const handleExportAuditLogsCsv = () => {
    const listToExport = filteredAuditLogs.length > 0 ? filteredAuditLogs : auditLogs;
    if (listToExport.length === 0) {
      showToast("No audit records available to export.", "info");
      return;
    }

    exportAuditLogsCsv(listToExport, {
      reportTitle: "System Security & Governance Audit Trail",
      filterScope: `Action: ${auditLogActionFilter} | Search: "${auditLogSearchQuery || 'None'}"`,
      generatedBy: currentAdmin?.name ? `${currentAdmin.name} (${currentAdmin.role})` : "Revenue Administrator",
      recordCount: listToExport.length,
    });

    showToast(`Exported ${listToExport.length} audit trail event logs.`, "success");
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

  // Memoized Treasury Collections with dynamic context-aware multi-term search
  const allTreasuryReceipts = useMemo(() => {
    return properties.flatMap((p: AdminProperty) =>
      (p.receipts || []).map((r: AdminPropertyReceipt) => ({
        ...r,
        accountNumber: p.accountNumber,
        ownerName: p.ownerName,
        municipality: p.municipality,
      }))
    );
  }, [properties]);

  const filteredTreasuryReceipts = useMemo(() => {
    return treasuryReceipts.filter((r: any) => {
      if (
        treasuryMethodFilter !== "ALL" &&
        !r.paymentMethod.toLowerCase().includes(treasuryMethodFilter.toLowerCase())
      ) {
        return false;
      }
      if (!deferredTreasurySearchQuery.trim()) return true;
      const q = deferredTreasurySearchQuery.toLowerCase().trim();
      const tokens = q.split(/\s+/).filter(Boolean);
      return tokens.every(
        (token: string) =>
          r.receiptNumber.toLowerCase().includes(token) ||
          r.accountNumber.toLowerCase().includes(token) ||
          (r.ownerName && r.ownerName.toLowerCase().includes(token)) ||
          r.paymentMethod.toLowerCase().includes(token) ||
          r.datePaid.toLowerCase().includes(token) ||
          r.amountFormatted.toLowerCase().includes(token) ||
          (r.municipality && r.municipality.toLowerCase().includes(token)) ||
          r.settlementType.toLowerCase().includes(token)
      );
    });
  }, [allTreasuryReceipts, deferredTreasurySearchQuery, treasuryMethodFilter]);

  return (

    <div className="h-screen w-full bg-white text-[#1C1C1E] flex flex-col lg:flex-row font-sans relative overflow-hidden">
      {/* Mobile Slide-Over Navigation Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/30 z-40 lg:hidden backdrop-blur-xs"
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed inset-y-0 right-0 w-4/5 max-w-xs bg-white/95 backdrop-blur-2xl border-l border-[#E5E5EA] shadow-2xl z-50 flex flex-col font-sans lg:hidden"
            >
              {/* Drawer Header */}
              <div className="h-13 flex items-center px-4 border-b border-[#E5E5EA] justify-between shrink-0 bg-[#F8F9FA]">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold tracking-tight text-[#007AFF]">KKMA Revenue</span>
                  <span className="text-[10px] text-[#6C6C70] uppercase font-mono font-medium">Console</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 text-[#8E8E93] hover:text-[#1C1C1E] rounded-lg cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Municipality Selector */}
              <div className="p-3 border-b border-[#E5E5EA] bg-[#F8F9FA]">
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#6C6C70] mb-1 font-mono">
                  Administrative Assembly
                </label>
                <select
                  value={municipalityFilter}
                  onChange={(e) => setMunicipalityFilter(e.target.value)}
                  aria-label="Select Municipal Assembly"
                  className="w-full text-xs font-semibold text-[#1C1C1E] bg-[#F2F2F7] border border-[#E5E5EA] rounded-md py-1.5 px-2 focus:outline-none focus:border-[#007AFF]"
                >
                  <option value="Kpone-Katamanso (KKMA)">Kpone-Katamanso (KKMA)</option>
                </select>
              </div>

              {/* Module Navigation Links */}
              <nav className="flex flex-col flex-1 px-3 py-3 gap-1 overflow-y-auto" aria-label="Mobile Navigation">
                <div className="px-3 pt-1 pb-1.5 text-[10px] font-semibold tracking-wider text-[#6C6C70] uppercase font-mono">
                  Revenue Modules
                </div>
                {NAV_TABS.map((tab) => {
                  const isActive = activeTab === tab.key;
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => {
                        handleTabChange(tab.key);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`relative px-3 py-2.5 text-left text-xs font-medium transition-colors cursor-pointer rounded-lg flex items-center justify-between min-h-[44px] ${isActive
                          ? "bg-[#007AFF]/10 text-[#007AFF] font-semibold"
                          : "text-[#6C6C70] hover:text-[#1C1C1E] hover:bg-[#F2F2F7]"
                        }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-1">
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-[#007AFF]" : "text-[#6C6C70]"}`} />
                        <span className="truncate">{tab.label}</span>
                      </div>
                      {isActive && (
                        <span className="text-xs font-bold text-[#007AFF]">&bull;</span>
                      )}
                    </button>
                  );
                })}
              </nav>

              {/* Drawer Footer with Officer & Sign Out */}
              <div className="p-3 border-t border-[#E5E5EA] shrink-0 bg-[#F8F9FA]">
                <div className="px-3 py-1.5 text-xs mb-1">
                  <span className="text-[#6C6C70] block text-[10px]">Logged in Administrator</span>
                  <span className="font-semibold text-[#1C1C1E] truncate block">
                    {currentAdmin?.username || currentAdmin?.name || "Heinz"}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={isLoggingOut}
                  onClick={async () => {
                    setIsLoggingOut(true);
                    try {
                      await adminLogout();
                    } finally {
                      window.location.href = '/login';
                    }
                  }}
                  aria-label="Sign out of administration portal"
                  className="w-full py-2 text-xs font-medium text-[#6C6C70] hover:text-[#1C1C1E] hover:bg-[#E5E5EA] rounded-lg transition-colors text-left px-3 cursor-pointer flex items-center gap-2 min-h-[44px]"
                >
                  {isLoggingOut ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#007AFF]" />
                      <span>Signing out...</span>
                    </>
                  ) : (
                    <span>Sign Out</span>
                  )}
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar Anchor (Fixed 56px footprint so main workspace never jumps or shifts) */}
      <div className="hidden lg:block w-14 shrink-0 relative z-30">
        <aside
          onMouseEnter={() => setIsSidebarExpanded(true)}
          onMouseLeave={() => setIsSidebarExpanded(false)}
          className={`h-screen fixed top-0 left-0 z-40 flex flex-col bg-white/95 backdrop-blur-2xl border-r border-[#E5E5EA] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden font-sans ${
            isSidebarExpanded ? "w-64 shadow-2xl" : "w-14 shadow-2xs"
          }`}
        >
          {/* Header */}
          <div className="h-13 flex items-center px-3.5 border-b border-[#E5E5EA] shrink-0 gap-2.5 overflow-hidden">
            <div className="w-7 h-7 rounded-md bg-[#007AFF] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
              K
            </div>
            <div className={`flex flex-col min-w-0 transition-opacity duration-200 ${isSidebarExpanded ? "opacity-100" : "opacity-0 pointer-events-none w-0"}`}>
              <select
                value={municipalityFilter}
                onChange={(e) => setMunicipalityFilter(e.target.value)}
                aria-label="Select Municipal Assembly"
                className="text-xs font-bold text-[#1C1C1E] bg-transparent border-none focus:outline-none cursor-pointer p-0 truncate hover:text-[#007AFF] transition-colors"
              >
                <option value="Kpone-Katamanso (KKMA)">Kpone-Katamanso (KKMA)</option>
              </select>
              <span className="text-[10px] text-[#6C6C70] truncate leading-tight whitespace-nowrap">
                Property Rate Cadastre &bull; Act 936
              </span>
            </div>
            {isSidebarExpanded && (
              <span className="text-[10px] text-[#6C6C70] uppercase font-mono font-medium shrink-0 ml-auto transition-opacity duration-200">
                Admin
              </span>
            )}
          </div>

          {/* Navigation Links (Zero Pills - Clean Google Enterprise / Supabase Standard) */}
          <nav className="flex flex-col flex-1 px-2 py-3 gap-1 overflow-y-auto overflow-x-hidden" aria-label="Main Navigation">
            {isSidebarExpanded ? (
              <div className="px-3 pt-1 pb-1.5 text-[10px] font-semibold tracking-wider text-[#6C6C70] uppercase font-mono select-none whitespace-nowrap transition-opacity duration-200">
                Revenue Modules
              </div>
            ) : (
              <div className="w-6 mx-auto h-px bg-[#E5E5EA] my-1" />
            )}

            {NAV_TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => handleTabChange(tab.key)}
                  title={!isSidebarExpanded ? tab.label : undefined}
                  className={`relative h-10 px-2.5 text-left text-xs font-medium transition-colors cursor-pointer focus:outline-none rounded-lg flex items-center group overflow-hidden ${
                    isActive
                      ? "bg-[#007AFF]/10 text-[#007AFF] font-semibold"
                      : "text-[#6C6C70] hover:text-[#1C1C1E] hover:bg-[#F2F2F7]"
                  } ${isSidebarExpanded ? "w-full justify-between" : "w-10 mx-auto justify-center"}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? "text-[#007AFF]" : "text-[#6C6C70] group-hover:text-[#1C1C1E]"}`} />
                    <span className={`truncate whitespace-nowrap transition-all duration-200 ${isSidebarExpanded ? "opacity-100 max-w-[160px]" : "opacity-0 max-w-0 pointer-events-none"}`}>
                      {tab.label}
                    </span>
                  </div>
                  {isActive && (
                    <motion.div
                      layoutId="activeTabIndicatorSidebar"
                      className="absolute left-0 top-1.5 bottom-1.5 w-[3.5px] bg-[#007AFF] rounded-r"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* User & Sign Out Footer */}
          <div className="p-2 border-t border-[#E5E5EA] shrink-0 bg-[#F8F9FA] overflow-hidden">
            {isSidebarExpanded && (
              <div className="px-2 py-1.5 text-xs transition-opacity duration-200">
                <span className="text-[#6C6C70] block text-[10px]">Logged in Administrator</span>
                <span className="font-semibold text-[#1C1C1E] truncate block">
                  {currentAdmin?.username || currentAdmin?.name || "Heinz"}
                </span>
              </div>
            )}

            <button
              type="button"
              disabled={isLoggingOut}
              onClick={async () => {
                setIsLoggingOut(true);
                try {
                  await adminLogout();
                } finally {
                  window.location.href = '/login';
                }
              }}
              title={!isSidebarExpanded ? "Sign Out" : undefined}
              aria-label="Sign out of administration portal"
              className={`h-9 text-xs font-medium text-[#6C6C70] hover:text-[#FF3B30] hover:bg-[#E5E5EA] rounded-lg transition-colors focus:outline-none cursor-pointer flex items-center disabled:opacity-60 disabled:cursor-not-allowed overflow-hidden ${
                isSidebarExpanded ? "w-full px-2.5 gap-2.5" : "w-10 mx-auto justify-center"
              }`}
            >
              {isLoggingOut ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#007AFF] shrink-0" />
              ) : (
                <LogOut className="w-4 h-4 shrink-0 text-[#6C6C70] group-hover:text-[#FF3B30]" />
              )}
              <span className={`whitespace-nowrap transition-opacity duration-200 ${isSidebarExpanded ? "opacity-100" : "opacity-0 pointer-events-none w-0"}`}>
                {isLoggingOut ? "Signing out..." : "Sign Out"}
              </span>
            </button>
          </div>
        </aside>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Mobile App Header */}
        <header className="bg-white/80 backdrop-blur-xl border-b border-[#E5E5EA] shadow-2xs px-3.5 sm:px-4 h-13 flex items-center justify-between shrink-0 lg:hidden font-sans z-20 sticky top-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-md bg-[#007AFF] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
              K
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-[#007AFF] tracking-tight truncate">KKMA Revenue</span>
              <span className="text-[10px] text-[#6C6C70] font-medium leading-none truncate">
                {NAV_TABS.find(t => t.key === activeTab)?.shortLabel || "Console"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {activeTab === "REGISTRY" && (
              <button
                type="button"
                onClick={() => setShowBatchModal(true)}
                className="h-8 px-2.5 rounded-lg border border-[#E5E5EA] bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[#007AFF] font-semibold text-[11px] flex items-center gap-1 cursor-pointer focus:outline-none transition-colors"
                title="Generate & Send Annual Bills"
              >
                <RefreshCw className="w-3 h-3 text-[#007AFF]" />
                <span className="hidden sm:inline">Send Annual Bills</span>
              </button>
            )}



            <span className="text-[11px] font-semibold text-[#1C1C1E] hidden sm:inline-block">
              {currentAdmin?.username || "Heinz"}
            </span>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 -mr-1.5 text-[#1C1C1E] hover:text-[#007AFF] hover:bg-[#F2F2F7] rounded-lg cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center focus:outline-none transition-colors"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5 text-[#1C1C1E]" />
            </button>
          </div>
        </header>

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
                      <Loader2 className="w-3 h-3 animate-spin text-[#007AFF]" />
                      <span>SMS Rollout in Progress...</span>
                    </>
                  )}
                </span>
                <span className="text-[10px] text-[#6C6C70] font-mono shrink-0 ml-2">
                  {smsJobProgress.sentCount} / {smsJobProgress.totalCount} sent
                  {smsJobProgress.failedCount > 0 && (
                    <span className="text-[#FF3B30] ml-1">({smsJobProgress.failedCount} failed)</span>
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
        <main className="flex-1 min-h-0 w-full flex flex-col p-0 max-w-none overflow-hidden h-full">
          {/* Top Modern KPI Cards (Compact Whimsical Fluid Wave Design) */}
          {activeTab === "REGISTRY" && (
            <section aria-label="Executive KPIs" className="shrink-0 bg-[#F8F9FA] border-b border-[#E5E5EA] px-4 py-2 sm:px-6 sm:py-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Total Assessed Demand */}
                <div className="p-3.5 bg-white border border-[#E5E5EA] rounded-xl hover:border-[#D1D1D6] transition-colors flex flex-col justify-between min-h-[96px]">
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
                <div className="p-3.5 bg-white border border-[#E5E5EA] rounded-xl hover:border-[#D1D1D6] transition-colors flex flex-col justify-between min-h-[96px]">
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
                <div className="p-3.5 bg-white border border-[#E5E5EA] rounded-xl hover:border-[#D1D1D6] transition-colors flex flex-col justify-between min-h-[96px]">
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
                <div className="p-3.5 bg-white border border-[#E5E5EA] rounded-xl hover:border-[#D1D1D6] transition-colors flex flex-col justify-between min-h-[96px]">
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
                        onClick={() => { setActiveTab("REGISTRY"); setStatusFilter("DEFAULTER"); }}
                        className="text-[#007AFF] hover:underline cursor-pointer"
                      >
                        View overdue accounts &rarr;
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* TAB 1: CADASTRE & VALUATION ROLL */}
          {activeTab === "REGISTRY" && (
            <section className="bg-white border-0 rounded-none shadow-none flex-1 min-h-0 flex flex-col overflow-hidden w-full">
              <div className="p-3.5 border-b border-[#E5E5EA] space-y-2.5 shrink-0 bg-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-[#1C1C1E]">
                      Property Register
                    </h2>
                    <p className="text-xs text-[#6C6C70] mt-0.5">
                      Register of property accounts, GhanaPost GPS addresses, and billing amounts
                    </p>
                  </div>

                  <div className="text-xs text-[#6C6C70] font-medium hidden sm:block">
                    {(data?.pagination?.total ?? propertiesList.length).toLocaleString()} properties on record
                  </div>
                </div>

                {/* Filter & Action Bar */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 sm:gap-3 pt-2 border-t border-[#E5E5EA]">
                  {/* Search */}
                  <div className="relative flex items-center w-full lg:flex-1 lg:max-w-md">
                    {isSearchingProperties ? (
                      <Loader2 className="w-4 h-4 text-[#007AFF] animate-spin absolute left-3 pointer-events-none" />
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
                      data-form-type="other"
                      placeholder="Search Account ID, Valuation No, Ratepayer, Phone, GPS (e.g. GK-0010), Landmark, Receipt..."
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

                  {/* Horizontal Scrollable Strip for Dropdowns & Actions on Mobile */}
                  <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto whitespace-nowrap scrollbar-none py-1 lg:py-0">
                    <select
                      value={classificationFilter}
                      onChange={(e) => setClassificationFilter(e.target.value)}
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
                      onChange={(e) => setStatusFilter(e.target.value as any)}
                      aria-label="Filter by payment status"
                      className="h-8 px-2.5 rounded-lg border border-[#E5E5EA] bg-[#F2F2F7] text-xs text-[#1C1C1E] focus:outline-none focus:border-[#007AFF] focus:bg-white shrink-0"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="UNPAID">Unpaid Balances</option>
                      <option value="DEFAULTER">Past Due Arrears (&gt; GH₵ 0)</option>
                      <option value="PAID">Paid in Full</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => setShowPropertyModal(true)}
                      className="apple-btn-primary h-8 px-3 rounded-lg font-semibold text-xs flex items-center gap-1.5 cursor-pointer shrink-0"
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

                    <button
                      type="button"
                      onClick={() => handleExportPropertiesCsv(selectedIds.length > 0)}
                      className="apple-btn-secondary h-8 px-3 rounded-lg font-medium text-xs flex items-center gap-1.5 cursor-pointer shrink-0"
                      title="Export Properties CSV"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{selectedIds.length > 0 ? `Export Selected (${selectedIds.length})` : "Export Properties CSV"}</span>
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
                        setClassificationFilter("ALL");
                        setStatusFilter("ALL");
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
                className="w-full flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
              >
                {/* Desktop Cadastre Table (>= 768px) */}
                <table className="hidden md:table table-fixed w-full text-left text-xs border-collapse">
                  <thead className="bg-[#F8F9FA] border-b border-[#E5E5EA] text-[#6C6C70] font-semibold text-[11px] sticky top-0 z-10">
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
                            className={`hover:bg-[#F8F9FA] transition-colors cursor-pointer ${selectedAccount?.id === prop.id ? "bg-[#007AFF]/8" : ""
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
                              className="shrink-0 flex items-center"
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
              {/* Directory Header Bar */}
              <div className="px-4 lg:px-6 py-3.5 sm:py-4 border-b border-[#E5E5EA] flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 shrink-0 bg-white">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-[#1C1C1E] tracking-tight">
                      Property Owners
                    </h2>
                  </div>
                  <p className="text-xs text-[#6C6C70] mt-0.5">
                    Directory of registered property owners and their linked accounts.
                  </p>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => loadRatepayers(ratepayerSearchQuery, 1, ratepayerLimit)}
                    disabled={isLoadingRatepayers}
                    className="apple-btn-secondary h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-50 text-[#1C1C1E] border-[#E5E5EA]"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRatepayers ? "animate-spin" : ""}`} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {/* Filter & Search Toolbar */}
              <div className="px-4 lg:px-6 py-2.5 bg-white border-b border-[#E5E5EA] flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 shrink-0">
                <div className="flex items-center gap-2.5 w-full sm:w-auto sm:max-w-md flex-1">
                  <div className="relative w-full">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#8E8E93]" />
                    <input
                      type="text"
                      inputMode="search"
                      value={ratepayerSearchQuery}
                      onChange={(e) => setRatepayerSearchQuery(e.target.value)}
                      placeholder="Search by ratepayer name or phone number..."
                      className="w-full pl-8 pr-8 py-1.5 bg-[#F2F2F7] border border-[#E5E5EA] rounded-lg text-xs text-[#1C1C1E] placeholder-[#8E8E93] focus:outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] focus:bg-white transition-colors"
                    />
                    {ratepayerSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setRatepayerSearchQuery("")}
                        className="absolute right-2.5 top-2 text-[#8E8E93] hover:text-[#1C1C1E] cursor-pointer"
                        title="Clear search"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleExportRatepayersCsv}
                    className="apple-btn-secondary h-8 px-3 rounded-lg font-medium text-xs flex items-center gap-1.5 cursor-pointer shrink-0 text-[#007AFF] border-[#007AFF]/20 hover:bg-[#007AFF]/5 transition-colors"
                    title="Export Professional Excel/CSV with Linked Accounts Hierarchy"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Ratepayers CSV</span>
                  </button>
                  <span className="text-xs text-[#8E8E93] font-sans tabular-nums">
                    {ratepayers.length} of {ratepayersTotal} Ratepayers
                  </span>
                </div>
              </div>

              {/* Ratepayers Directory Table */}
              <div className="flex-1 min-h-0 overflow-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-[#F8F9FA] border-b border-[#E5E5EA] sticky top-0 z-10 font-semibold text-[#6C6C70]">
                    <tr>
                      <th className="px-4 lg:px-6 py-3">Citizen / Ratepayer</th>
                      <th className="px-4 lg:px-6 py-3">Phone Number</th>
                      <th className="px-4 lg:px-6 py-3 text-center">Properties Owned</th>
                      <th className="px-4 lg:px-6 py-3 text-right">Portfolio Arrears</th>
                      <th className="px-4 lg:px-6 py-3 text-right">Total Outstanding</th>
                      <th className="px-4 lg:px-6 py-3 text-center">Status</th>
                      <th className="px-4 lg:px-6 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E5EA] bg-white">
                    {isLoadingRatepayers && ratepayers.length === 0 ? (
                      Array.from({ length: 8 }).map((_, i) => (
                        <tr key={`ratepayer-skel-${i}`} className="animate-pulse">
                          <td className="px-4 lg:px-6 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-[#E5E5EA] shrink-0" />
                              <div className="space-y-1.5 flex-1">
                                <div className="h-3.5 w-32 bg-[#E5E5EA] rounded" />
                                <div className="h-2.5 w-24 bg-[#F2F2F7] rounded" />
                              </div>
                            </div>
                          </td>
                          <td className="px-4 lg:px-6 py-3.5">
                            <div className="h-3.5 w-28 bg-[#E5E5EA] rounded" />
                          </td>
                          <td className="px-4 lg:px-6 py-3.5 text-center">
                            <div className="h-3.5 w-8 bg-[#E5E5EA] rounded mx-auto" />
                          </td>
                          <td className="px-4 lg:px-6 py-3.5 text-right">
                            <div className="h-3.5 w-20 bg-[#E5E5EA] rounded ml-auto" />
                          </td>
                          <td className="px-4 lg:px-6 py-3.5 text-right">
                            <div className="h-3.5 w-24 bg-[#E5E5EA] rounded ml-auto" />
                          </td>
                          <td className="px-4 lg:px-6 py-3.5 text-center">
                            <div className="h-3 w-16 bg-[#E5E5EA] rounded mx-auto" />
                          </td>
                          <td className="px-4 lg:px-6 py-3.5 text-right">
                            <div className="h-3 w-14 bg-[#E5E5EA] rounded ml-auto" />
                          </td>
                        </tr>
                      ))
                    ) : ratepayers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-[#6C6C70]">
                          No ratepayer records match your query.
                        </td>
                      </tr>
                    ) : (
                      ratepayers.map((rp) => (
                        <tr
                          key={rp.id}
                          onClick={() => handleOpenRatepayerDossier(rp.id, rp)}
                          className="hover:bg-[#F8F9FA] cursor-pointer transition-colors group"
                        >
                          <td className="px-4 lg:px-6 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-[#007AFF]/10 text-[#007AFF] flex items-center justify-center font-bold text-xs shrink-0">
                                {(rp.name || "C").charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <span className="font-semibold text-[#1C1C1E] group-hover:text-[#007AFF] block truncate transition-colors">
                                  {rp.name || `Citizen (${rp.phoneNumber})`}
                                </span>
                                <span className="text-[11px] text-[#6C6C70] block">
                                  Member since {rp.createdAtFormatted}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 lg:px-6 py-3.5 font-mono text-[#1C1C1E]">
                            {rp.phoneNumber}
                          </td>
                          <td className="px-4 lg:px-6 py-3.5 text-center">
                            <span className="font-semibold text-[#1C1C1E]">
                              {rp.propertyCount} {rp.propertyCount === 1 ? "property" : "properties"}
                            </span>
                          </td>
                          <td className={`px-4 lg:px-6 py-3.5 text-right font-mono font-medium ${rp.totalArrears > 0 || (rp.totalArrearsFormatted && rp.totalArrearsFormatted !== 'GH₵ 0.00') ? 'text-[#FF3B30]' : 'text-[#8E8E93]'}`}>
                            {rp.totalArrearsFormatted}
                          </td>
                          <td className="px-4 lg:px-6 py-3.5 text-right font-mono font-semibold text-[#1C1C1E]">
                            {rp.totalDueFormatted}
                          </td>
                          <td className="px-4 lg:px-6 py-3.5 text-center">
                            {rp.status === "DEFAULTER" ? (
                              <span className="text-xs font-semibold text-[#FF3B30]">&bull; Defaulter</span>
                            ) : rp.status === "SETTLED" ? (
                              <span className="text-xs font-semibold text-[#34C759]">&bull; Settled</span>
                            ) : rp.status === "NO_PROPERTIES" ? (
                              <span className="text-xs text-[#8E8E93]">&bull; No Parcels</span>
                            ) : (
                              <span className="text-xs font-semibold text-[#FF9500]">&bull; Outstanding</span>
                            )}
                          </td>
                          <td className="px-4 lg:px-6 py-3.5 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenRatepayerDossier(rp.id, rp);
                              }}
                              className="text-xs font-medium text-[#007AFF] hover:underline cursor-pointer inline-flex items-center gap-1"
                            >
                              <span>Inspect Dossier</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

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
                entityLabel="ratepayers"
              />
            </section>
          )}

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
              />
            </div>
          )}

          {/* TAB 4: PAYMENTS & RECEIPTS */}
          {activeTab === "TREASURY" && (
            <section className="bg-white flex-1 min-h-0 flex flex-col overflow-hidden w-full border-0 rounded-none shadow-none">
              <div className="px-4 lg:px-6 py-3.5 border-b border-[#E5E5EA] bg-white flex flex-col gap-3 shrink-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold text-[#1C1C1E] tracking-tight">Payment Transactions &amp; Receipts</h2>
                    <p className="text-xs text-[#6C6C70] mt-0.5">
                      Real-time record of all rate payments completed via Mobile Money, Card, and Cash.
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-[#34C759]">
                    Total Collected: {metrics.totalCollectedFormatted}
                  </span>
                </div>

                {/* Treasury Dynamic Search & Filter Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 pt-2.5 border-t border-[#E5E5EA]">
                  <div className="relative flex items-center w-full lg:flex-1 lg:max-w-md">
                    <Search className="w-4 h-4 text-[#8E8E93] absolute left-3 pointer-events-none" />
                    <input
                      type="text"
                      inputMode="search"
                      name="treasury_reconciliation_search_filter"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      data-lpignore="true"
                      data-1p-ignore="true"
                      data-form-type="other"
                      placeholder="Search Receipt / GCR No., Account ID, Ratepayer, Channel, Date..."
                      value={treasurySearchQuery}
                      onChange={(e) => setTreasurySearchQuery(e.target.value)}
                      aria-label="Search treasury transactions"
                      onKeyDown={(e) => {
                        if (e.key === "Escape") setTreasurySearchQuery("");
                      }}
                      className="w-full h-8 pl-9 pr-8 rounded-lg border border-[#E5E5EA] bg-[#F2F2F7] text-xs text-[#1C1C1E] placeholder:text-[#8E8E93] focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] focus:bg-white focus:outline-none transition-colors"
                    />
                    {treasurySearchQuery && (
                      <button
                        type="button"
                        onClick={() => setTreasurySearchQuery("")}
                        className="absolute right-2 text-[#8E8E93] hover:text-[#1C1C1E] p-1 cursor-pointer"
                        title="Clear search"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    <select
                      value={treasuryMethodFilter}
                      onChange={(e) => setTreasuryMethodFilter(e.target.value)}
                      aria-label="Filter by payment channel"
                      className="h-8 px-2.5 rounded-lg border border-[#E5E5EA] bg-[#F2F2F7] text-xs text-[#1C1C1E] focus:outline-none focus:border-[#007AFF] transition-colors"
                    >
                      <option value="ALL">All Payment Channels</option>
                      <option value="Mobile Money">Mobile Money (MTN / Telecel)</option>
                      <option value="Card">Card / Online Gateway</option>
                      <option value="Counter Cash">Counter Cash Treasury</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleExportTreasuryCsv}
                      className="apple-btn-secondary h-8 px-3 rounded-lg font-medium text-xs flex items-center gap-1.5 cursor-pointer shrink-0 text-[#007AFF] border-[#007AFF]/20 hover:bg-[#007AFF]/5 transition-colors"
                      title="Export Professional Treasury Reconciliation CSV"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export Treasury CSV</span>
                    </button>
                    <span className="text-xs text-[#6C6C70] font-medium shrink-0">
                      {filteredTreasuryReceipts.length} record{filteredTreasuryReceipts.length === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="w-full flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                {/* Desktop Treasury Table (>= 768px) */}
                <table className="hidden md:table table-fixed w-full text-left text-xs border-collapse">
                  <thead className="bg-[#F8F9FA] border-b border-[#E5E5EA] text-[#6C6C70] font-semibold text-[11px] sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-3 w-[20%] bg-[#F8F9FA] whitespace-nowrap">Receipt Reference</th>
                      <th className="py-2.5 px-3 w-[25%] bg-[#F8F9FA]">Account Head &amp; Ratepayer</th>
                      <th className="py-2.5 px-3 w-[14%] bg-[#F8F9FA] whitespace-nowrap">Settlement Date</th>
                      <th className="py-2.5 px-3 w-[16%] bg-[#F8F9FA] whitespace-nowrap">Payment Channel</th>
                      <th className="py-2.5 px-3 w-[13%] text-right bg-[#F8F9FA] whitespace-nowrap">Amount Settled</th>
                      <th className="py-2.5 px-3 w-[12%] text-center bg-[#F8F9FA] whitespace-nowrap">Audit Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E5EA] bg-white">
                    {isLoadingTreasury || (isInitialLoading && treasuryReceipts.length === 0) ? (
                      Array.from({ length: 8 }).map((_, i) => (
                        <tr key={`treasury-skel-${i}`} className="animate-pulse">
                          <td className="py-2.5 px-3">
                            <div className="h-3.5 w-28 bg-[#E5E5EA] rounded" />
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="h-3.5 w-24 bg-[#E5E5EA] rounded mb-1" />
                            <div className="h-2.5 w-32 bg-[#F2F2F7] rounded" />
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="h-3.5 w-20 bg-[#E5E5EA] rounded" />
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="h-3.5 w-24 bg-[#E5E5EA] rounded" />
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="h-3.5 w-16 bg-[#E5E5EA] rounded ml-auto" />
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="h-3 w-16 bg-[#E5E5EA] rounded mx-auto" />
                          </td>
                        </tr>
                      ))
                    ) : filteredTreasuryReceipts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-[#6C6C70] italic font-normal">
                          No treasury receipts match your search query.
                        </td>
                      </tr>
                    ) : (
                      filteredTreasuryReceipts.map((receipt) => (
                        <tr key={receipt.id} className="hover:bg-[#F8F9FA] transition-colors">
                          <td className="py-2.5 px-3 font-semibold text-[#1C1C1E] whitespace-nowrap">
                            {receipt.receiptNumber}
                          </td>
                          <td className="py-2.5 px-3 text-[#6C6C70]">
                            <span className="font-mono font-medium text-[#1C1C1E]">{receipt.accountNumber}</span>
                            {receipt.ownerName && <p className="text-[11px] text-[#6C6C70]">{receipt.ownerName}</p>}
                          </td>
                          <td className="py-2.5 px-3 text-[#6C6C70] whitespace-nowrap">
                            {receipt.datePaid}
                          </td>
                          <td className="py-2.5 px-3 text-[#1C1C1E] whitespace-nowrap">
                            {receipt.paymentMethod}
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold text-[#34C759] whitespace-nowrap tabular-nums">
                            {receipt.amountFormatted}
                          </td>
                          <td className="py-2.5 px-3 text-center font-medium text-[#34C759] whitespace-nowrap">
                            &bull; Reconciled
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {/* Mobile Treasury List (< 768px) */}
                <div className="block md:hidden divide-y divide-[#E5E5EA] bg-white">
                  {isLoadingTreasury || (isInitialLoading && treasuryReceipts.length === 0) ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <div key={`treasury-mob-skel-${i}`} className="px-3.5 py-3 animate-pulse flex items-center justify-between gap-2.5">
                        <div className="space-y-1.5 flex-1">
                          <div className="h-3.5 w-24 bg-[#E5E5EA] rounded" />
                          <div className="h-2.5 w-36 bg-[#F2F2F7] rounded" />
                        </div>
                        <div className="h-4 w-16 bg-[#E5E5EA] rounded" />
                      </div>
                    ))
                  ) : filteredTreasuryReceipts.length === 0 ? (
                    <div className="py-8 text-center text-[#6C6C70] italic font-normal text-xs px-4">
                      No treasury receipts match your search query.
                    </div>
                  ) : (
                    filteredTreasuryReceipts.map((receipt) => (
                      <div
                        key={`mobile-receipt-${receipt.id}`}
                        className="px-3.5 py-3 flex items-center justify-between gap-2.5 hover:bg-[#F8F9FA] transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-[#1C1C1E] font-mono">
                              {receipt.receiptNumber}
                            </span>
                            <span className="text-[11px] font-semibold text-[#34C759]">
                              &bull; Reconciled
                            </span>
                          </div>
                          <div className="text-[11px] text-[#6C6C70] truncate mt-0.5">
                            <span className="font-mono text-[#6C6C70]">{receipt.accountNumber}</span>
                            {receipt.ownerName && <span className="ml-1.5">&bull; {receipt.ownerName}</span>}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-xs font-bold text-[#34C759] tabular-nums block">
                            {receipt.amountFormatted}
                          </span>
                          <span className="text-[10px] text-[#6C6C70] block mt-0.5">
                            {receipt.paymentMethod} &bull; {receipt.datePaid}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Treasury Status Bar */}
              <div className="px-4 py-2 border-t border-[#E5E5EA] bg-white flex items-center justify-between text-xs text-[#6C6C70] shrink-0">
                <span>Value Book &amp; GCR Reconciled Ledger</span>
                <span>{filteredTreasuryReceipts.length} entries shown</span>
              </div>
            </section>
          )}

          {/* TAB: ACTIVITY LOG */}
          {activeTab === "AUDIT_LOGS" && (
            <section className="bg-white flex-1 flex flex-col min-h-0 overflow-hidden w-full border-0 rounded-none shadow-none">
              {/* Audit Header Bar */}
              <div className="px-4 lg:px-6 py-3.5 sm:py-4 border-b border-[#E5E5EA] flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 shrink-0 bg-white">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-[#1C1C1E] tracking-tight">
                      System Activity Log
                    </h2>
                    <span className="text-xs text-[#34C759] font-medium">&bull; System Log</span>
                  </div>
                  <p className="text-xs text-[#6C6C70] mt-0.5">
                    Chronological record of bill rollouts, payments, rate revisions, and system actions.
                  </p>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => loadAuditLogs(auditLogSearchQuery, auditLogActionFilter, 1)}
                    disabled={isLoadingAuditLogs}
                    className="apple-btn-secondary h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-50 text-[#1C1C1E] border-[#E5E5EA]"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAuditLogs ? "animate-spin" : ""}`} />
                    <span>Refresh</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportAuditLogsCsv}
                    className="apple-btn-secondary h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer text-[#007AFF] border-[#007AFF]/20 hover:bg-[#007AFF]/5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Activity Log (CSV)</span>
                  </button>
                </div>
              </div>

              {/* Filter Toolbar */}
              <div className="px-4 lg:px-6 py-2.5 bg-white border-b border-[#E5E5EA] flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 shrink-0">
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 sm:gap-3 w-full lg:flex-1">
                  <div className="relative flex-1 w-full sm:w-auto max-w-none sm:max-w-md">
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
                      data-form-type="other"
                      placeholder="Search by action, narrative, administrator, or reference..."
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
                    onChange={(e) => {
                      const val = e.target.value;
                      setAuditLogActionFilter(val);
                      loadAuditLogs(auditLogSearchQuery, val, 1);
                    }}
                    aria-label="Filter audit logs by action"
                    className="h-8 px-3 bg-[#F2F2F7] border border-[#E5E5EA] rounded-lg text-xs text-[#1C1C1E] focus:outline-none focus:border-[#007AFF] cursor-pointer transition-colors"
                  >
                    <option value="ALL">All Recorded Actions</option>
                    <option value="RECORD_PAYMENT">Cash Settlements (RECORD_PAYMENT)</option>
                    <option value="BATCH_BILLING">Annual Billing Rollouts (BATCH_BILLING)</option>
                    <option value="BATCH_SMS_DISPATCH">SMS Batch Notices (BATCH_SMS_DISPATCH)</option>
                    <option value="SINGLE_SMS_DISPATCH">Direct SMS Notices (SINGLE_SMS_DISPATCH)</option>
                    <option value="EDIT_PROPERTY">Property Valuation Edits (EDIT_PROPERTY)</option>
                    <option value="CREATE_PROPERTY">Parcel Registrations (CREATE_PROPERTY)</option>
                  </select>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleExportAuditLogsCsv}
                    className="apple-btn-secondary h-8 px-3 rounded-lg font-medium text-xs flex items-center gap-1.5 cursor-pointer shrink-0 text-[#007AFF] border-[#007AFF]/20 hover:bg-[#007AFF]/5 transition-colors"
                    title="Export System Audit Trail CSV"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Audit Logs CSV</span>
                  </button>
                  <div className="text-xs text-[#6C6C70] font-medium">
                    {auditLogsTotal} event{auditLogsTotal === 1 ? "" : "s"} logged
                  </div>
                </div>
              </div>

              {/* Table Container */}
              <div
                ref={auditLogTableContainerRef}
                className="w-full flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
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
        </main>

        {/* Static Grounded Footer */}
        <footer className="shrink-0 h-8 bg-white/80 backdrop-blur-md border-t border-[#E5E5EA] px-6 hidden lg:flex items-center justify-between text-[11px] text-[#8E8E93] font-sans">
          <span>Kpone-Katamanso Municipal Assembly (KKMA) &bull; Revenue Administration Platform</span>
          <span>Local Governance Act, 2016 (Act 936)</span>
        </footer>
      </div>


      {/* PROPERTY ASSESSMENT DOSSIER SIDE SHEET */}
      <AnimatePresence>
        {selectedAccount && (
          <motion.div 
            key="property-drawer-wrapper"
            className="fixed inset-0 z-50 flex justify-end pointer-events-auto"
          >
            <motion.div
              key="property-drawer-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="fixed inset-0 bg-black/30 backdrop-blur-xs"
              onClick={() => {
                setSelectedAccount(null);
                setReturnToRatepayerDossier(null);
              }}
            />

            <motion.aside
              key="property-drawer-panel"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", ease: [0.16, 1, 0.3, 1], duration: 0.32 }}
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
                      className="inline-flex items-center gap-1.5 text-xs text-[#007AFF] hover:text-[#0062CC] font-medium mb-1.5 cursor-pointer transition-colors"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back to Ratepayer Dossier ({returnToRatepayerDossier.name})</span>
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
                    setReturnToRatepayerDossier(null);
                  }}
                  className="p-1.5 rounded-lg text-[#8E8E93] hover:text-[#1C1C1E] hover:bg-[#F2F2F7] transition-colors cursor-pointer"
                  aria-label="Close dossier"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 text-xs divide-y divide-[#E5E5EA]">
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
                  <h4 className="text-xs font-semibold text-[#1C1C1E] uppercase tracking-wider">
                    GCR Receipt Trail ({selectedAccount.receipts.length})
                  </h4>
                  {selectedAccount.receipts.length === 0 ? (
                    <p className="text-[#6C6C70] text-xs py-2 italic">No payments recorded for this assessment cycle.</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedAccount.receipts.map((r) => (
                        <div
                          key={r.id}
                          className="p-3 rounded-xl bg-[#F8F9FA] border border-[#E5E5EA] flex items-center justify-between text-xs"
                        >
                          <div>
                            <p className="font-semibold text-[#1C1C1E]">{r.receiptNumber}</p>
                            <p className="text-[#6C6C70] text-[11px] mt-0.5">{r.paymentMethod} &bull; {r.datePaid}</p>
                          </div>
                          <span className="font-semibold text-[#34C759]">{r.amountFormatted}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

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
        onClose={() => {
          setIsDossierOpen(false);
          setSelectedRatepayerDossier(null);
          setPreviewRatepayer(null);
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
      />

      {/* ANNUAL BATCH BILLING MODAL */}
      <AnimatePresence>
        {showBatchModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 font-sans">
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
                          value={batchAdminPassword}
                          onChange={(e) => setBatchAdminPassword(e.target.value)}
                          aria-label="Administrator Authorization Password"
                          placeholder="Enter admin password (e.g. admin123)"
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
                    {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
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
        {showPaymentModal && selectedAccount && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 font-sans">
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

              <div className="space-y-1">
                <span className="text-[#6C6C70]">Account Head</span>
                <p className="font-semibold text-[#1C1C1E]">{selectedAccount.accountNumber} ({selectedAccount.ownerName})</p>
                <p className="text-[#6C6C70]">Total Outstanding Due: {selectedAccount.totalAmountDueFormatted}</p>
              </div>

              <div className="space-y-1">
                <label className="text-[#6C6C70] font-medium">Payment Amount (GH₵)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder={selectedAccount.totalAmountDue.toString()}
                  value={manualAmount}
                  onChange={(e) => setManualAmount(e.target.value)}
                  aria-label="Payment Amount in Ghanaian Cedi"
                  className="w-full h-10 px-3 rounded-lg border border-[#E5E5EA] bg-white text-xs font-semibold text-[#1C1C1E] focus:outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] transition-colors"
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
                  <option>Counter Cash Treasury</option>
                  <option>Assembly Direct Cheque</option>
                  <option>GCB Bank Direct Deposit</option>
                  <option>Ecobank Treasury Deposit</option>
                </select>
              </div>

              {/* Security Authorization Password */}
              <div className="space-y-1 pt-2 border-t border-[#E5E5EA]">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#007AFF]" />
                  <label className="text-[#007AFF] font-semibold text-xs block">Administrator Authorization Password *</label>
                </div>
                <div className="relative">
                  <input
                    required
                    type={showPaymentPassword ? "text" : "password"}
                    name="municipal_manual_settlement_auth_key"
                    autoComplete="new-password"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    value={paymentAdminPassword}
                    onChange={(e) => setPaymentAdminPassword(e.target.value)}
                    aria-label="Administrator Authorization Password"
                    placeholder="Enter admin password (e.g. admin123)"
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
                  {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
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
            className="fixed bottom-6 left-6 z-50 max-w-md w-[calc(100%-3rem)] bg-white/95 backdrop-blur-xl text-[#1C1C1E] px-4 py-3 rounded-2xl shadow-xl border border-[#E5E5EA] flex items-center justify-between gap-3 text-xs font-medium font-sans"
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
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 font-sans">
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
                    placeholder="Enter admin password (e.g. admin123)"
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
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
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

      {/* BULK CADASTRE CSV IMPORTER MODAL */}
      <CsvImportModal
        isOpen={showCsvImportModal}
        onClose={() => setShowCsvImportModal(false)}
        onSuccess={(count) => {
          showToast(`Successfully ingested ${count} parcels into municipal cadastre roll.`, "success");
          loadData();
        }}
      />

    </div>
  );
}
