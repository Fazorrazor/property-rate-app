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
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { AdminDashboardSkeleton } from "@/components/Skeletons";
import { RatepayerDossierSheet } from "@/components/RatepayerDossierSheet";
import { SettingsTab } from "@/components/SettingsTab";

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
    loading: () => (
      <div className="flex-1 flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#FCD535]" />
      </div>
    ),
  }
);

type NavTab = "REGISTRY" | "RATEPAYERS" | "SMS_CENTER" | "TREASURY" | "AUDIT_LOGS" | "SETTINGS";

const NAV_TABS: { key: NavTab; label: string; shortLabel: string; icon: any }[] = [
  { key: "REGISTRY", label: "Cadastre & Property Roll", shortLabel: "Registry", icon: Building2 },
  { key: "RATEPAYERS", label: "Ratepayer Portfolios & Dossiers", shortLabel: "Ratepayers", icon: Users },
  { key: "SMS_CENTER", label: "SMS Bill Rollout Engine", shortLabel: "SMS Engine", icon: MessageSquare },
  { key: "TREASURY", label: "Treasury Reconciliation", shortLabel: "Treasury", icon: Landmark },
  { key: "AUDIT_LOGS", label: "System Audit Trail", shortLabel: "Audit Logs", icon: ShieldCheck },
  { key: "SETTINGS", label: "Settings & SMS Gateway", shortLabel: "Settings", icon: Settings },
];

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [propertiesList, setPropertiesList] = useState<AdminProperty[]>([]);
  const [currentPropertyPage, setCurrentPropertyPage] = useState(1);
  const [hasMoreProperties, setHasMoreProperties] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const propertySentinelRef = useRef<HTMLDivElement>(null);

  const [ratepayers, setRatepayers] = useState<AdminRatepayerSummary[]>([]);
  const [ratepayersTotal, setRatepayersTotal] = useState(0);
  const [currentRatepayerPage, setCurrentRatepayerPage] = useState(1);
  const [hasMoreRatepayers, setHasMoreRatepayers] = useState(true);
  const [isLoadingMoreRatepayers, setIsLoadingMoreRatepayers] = useState(false);
  const [ratepayerSearchQuery, setRatepayerSearchQuery] = useState("");
  const deferredRatepayerSearchQuery = useDeferredValue(ratepayerSearchQuery);
  const [smsLogs, setSmsLogs] = useState<SmsRolloutLogItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogItem[]>([]);
  const [auditLogsTotal, setAuditLogsTotal] = useState(0);
  const [currentAuditLogPage, setCurrentAuditLogPage] = useState(1);
  const [hasMoreAuditLogs, setHasMoreAuditLogs] = useState(true);
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

  // Dedicated Municipal Admin State
  const [currentAdmin, setCurrentAdmin] = useState<{ id: string; username: string; name: string; role: string } | null>(null);

  useEffect(() => {
    const verifySession = async () => {
      try {
        const admin = await getCurrentAdmin();
        if (admin) {
          setCurrentAdmin(admin);
        } else {
          window.location.href = "/login?superseded=true";
        }
      } catch {
        window.location.href = "/login?superseded=true";
      }
    };

    verifySession();

    // Proactive single-session check: detect if another device logged into this admin account
    const handleFocus = () => verifySession();
    window.addEventListener("focus", handleFocus);
    const interval = setInterval(verifySession, 30000);

    return () => {
      window.removeEventListener("focus", handleFocus);
      clearInterval(interval);
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
    isInitial = false
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
        50,
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
      setCurrentPropertyPage(1);
      setHasMoreProperties((overviewRes?.pagination?.page || 1) < (overviewRes?.pagination?.totalPages || 1));

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
          setHasMoreAuditLogs(auditRes.logs.length < auditRes.total);
        }
        getTreasuryReceipts("", "ALL", 1, 100).then((tres) => {
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

  const loadAuditLogs = async (query = auditLogSearchQuery, actionFilter = auditLogActionFilter, page = 1, append = false) => {
    setIsLoadingAuditLogs(true);
    try {
      const res = await getAuditTrailList(query, actionFilter, page, 50);
      if (activeAuditQueryRef.current !== query) {
        return;
      }
      if (res) {
        if (append) {
          setAuditLogs((prev) => [...prev, ...res.logs]);
        } else {
          setAuditLogs(res.logs);
        }
        setAuditLogsTotal(res.total);
        setCurrentAuditLogPage(page);
        setHasMoreAuditLogs((page * 50) < res.total);
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

  const handleExportAuditLogsCsv = () => {
    if (auditLogs.length === 0) {
      showToast("No audit records available to export.", "info");
      return;
    }

    const headers = [
      "Log ID",
      "Timestamp",
      "Action Code",
      "Action Description",
      "Entity Type",
      "Entity Reference",
      "Administrator Name",
      "Administrator ID",
      "Audit Narrative",
    ];

    const rows = auditLogs.map((log) => [
      `"${log.id}"`,
      `"${log.createdAtFormatted} ${log.timeFormatted}"`,
      `"${log.action}"`,
      `"${log.actionLabel}"`,
      `"${log.entityType}"`,
      `"${log.entityId || "N/A"}"`,
      `"${log.adminName}"`,
      `"${log.adminId}"`,
      `"${log.details.replace(/"/g, '""')}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `KKMA_Audit_Trail_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Audit trail CSV downloaded.", "success");
  };


  // Proactive pagination loader for Cadastre properties
  const loadNextPropertyPage = async () => {
    if (isLoadingMore || !hasMoreProperties || isSearchingProperties) return;
    setIsLoadingMore(true);
    const nextPage = currentPropertyPage + 1;
    try {
      const activeStatus = statusFilter;
      const nextRes = await getAdminOverview(
        nextPage,
        50,
        municipalityFilter,
        searchQuery,
        classificationFilter,
        activeStatus as any
      );
      if (nextRes && nextRes.properties.length > 0) {
        setPropertiesList((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const newItems = nextRes.properties.filter((p) => !existingIds.has(p.id));
          return [...prev, ...newItems];
        });
        setCurrentPropertyPage(nextPage);
        setHasMoreProperties(nextPage < (nextRes.pagination?.totalPages || 1));
      } else {
        setHasMoreProperties(false);
      }
    } catch (err) {
      console.error("Error loading next page of properties:", err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Fallback scroll handler inside Cadastre table container
  const handleTableScroll = async (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 80) {
      loadNextPropertyPage();
    }
  };

  // Proactive IntersectionObserver for endless scrolling of Cadastre properties
  useEffect(() => {
    const sentinel = propertySentinelRef.current;
    if (!sentinel || !hasMoreProperties || isLoadingMore || isSearchingProperties) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadNextPropertyPage();
        }
      },
      { rootMargin: "300px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreProperties, isLoadingMore, isSearchingProperties, currentPropertyPage, activeTab, municipalityFilter, searchQuery, classificationFilter, statusFilter]);

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
        setHasMoreProperties(
          (baselineOverviewRef.current.pagination?.page || 1) <
          (baselineOverviewRef.current.pagination?.totalPages || 1)
        );
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
      setHasMoreProperties(
        (baselineOverviewRef.current.pagination?.page || 1) <
        (baselineOverviewRef.current.pagination?.totalPages || 1)
      );
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
        setHasMoreAuditLogs(
          baselineAuditLogsRef.current.logs.length < baselineAuditLogsRef.current.total
        );
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
      setHasMoreAuditLogs(
        baselineAuditLogsRef.current.logs.length < baselineAuditLogsRef.current.total
      );
    }
    loadAuditLogs("", auditLogActionFilter, 1);
  };

  // Proactive pagination loader for Ratepayers
  const loadRatepayers = async (query = "", page = 1, append = false) => {
    if (page === 1) setIsLoadingMoreRatepayers(true);
    try {
      const res = await getRatepayersList(query, page, 50);
      if (res) {
        if (append) {
          setRatepayers((prev) => [...prev, ...res.ratepayers]);
        } else {
          setRatepayers(res.ratepayers);
        }
        setRatepayersTotal(res.total);
        setCurrentRatepayerPage(page);
        setHasMoreRatepayers(res.ratepayers.length === 50 && page * 50 < res.total);
      }
    } catch (err) {
      console.error("Error loading ratepayers list:", err);
    } finally {
      setIsLoadingMoreRatepayers(false);
    }
  };

  useEffect(() => {
    if (activeTab === "RATEPAYERS") {
      loadRatepayers(deferredRatepayerSearchQuery, 1, false);
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

  const handleExportCsv = (filteredOnly = false) => {
    if (!data || data.properties.length === 0) return;

    const listToExport = filteredOnly ? filteredProperties : data.properties;

    const headers = [
      "Account Number",
      "Municipality",
      "Owner Name",
      "Owner Phone",
      "Digital Address",
      "Classification",
      "Bill Year",
      "Rateable Value (GH₵)",
      "Previous Year Bill (GH₵)",
      "Amount Paid Last Year (GH₵)",
      "Arrears (GH₵)",
      "Current Fee (GH₵)",
      "Total Due (GH₵)",
      "Status",
    ];

    const rows = listToExport.map((p) => [
      `"${p.accountNumber}"`,
      `"${p.municipality}"`,
      `"${p.ownerName}"`,
      `"${p.ownerPhone}"`,
      `"${p.ownerDigitalAddress}"`,
      `"${p.propertyClassification}"`,
      p.billYear,
      p.rateableValue,
      p.previousYearBill,
      p.amountPaidLastYear,
      p.arrears,
      p.currentFee,
      p.totalAmountDue,
      `"${p.status}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `KKMA_Property_Rate_${activeTab}_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  if (isInitialLoading) {
    return <AdminDashboardSkeleton />;
  }

  return (

    <div className="min-h-screen w-full bg-[#181A20] text-[#EAECEF] flex flex-col lg:flex-row font-sans relative">
      {/* Mobile Slide-Over Navigation Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-xs"
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed inset-y-0 right-0 w-4/5 max-w-xs bg-[#1E2329] border-l border-[#2B3139] shadow-xl z-50 flex flex-col font-sans lg:hidden"
            >
              {/* Drawer Header */}
              <div className="h-13 flex items-center px-4 border-b border-[#2B3139] justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold tracking-tight text-[#FCD535]">KKMA Revenue</span>
                  <span className="text-[10px] text-[#848E9C] uppercase font-mono font-medium">Console</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 text-[#848E9C] hover:text-[#EAECEF] rounded-lg cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Municipality Selector */}
              <div className="p-3 border-b border-[#2B3139] bg-[#1E2329]">
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#848E9C] mb-1 font-mono">
                  Administrative Assembly
                </label>
                <select
                  value={municipalityFilter}
                  onChange={(e) => setMunicipalityFilter(e.target.value)}
                  aria-label="Select Municipal Assembly"
                  className="w-full text-xs font-semibold text-[#EAECEF] bg-[#1E2329] border border-[#2B3139] rounded-md py-1.5 px-2 focus:outline-none focus:border-[#FCD535]"
                >
                  <option value="Kpone-Katamanso (KKMA)">Kpone-Katamanso (KKMA)</option>
                </select>
              </div>

              {/* Module Navigation Links */}
              <nav className="flex flex-col flex-1 px-3 py-3 gap-1 overflow-y-auto" aria-label="Mobile Navigation">
                <div className="px-3 pt-1 pb-1.5 text-[10px] font-semibold tracking-wider text-[#848E9C] uppercase font-mono">
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
                          ? "bg-[#FCD535]/8 text-[#FCD535] font-semibold"
                          : "text-[#848E9C] hover:text-[#EAECEF] hover:bg-[#1E2329]"
                        }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-1">
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-[#FCD535]" : "text-[#848E9C]"}`} />
                        <span className="truncate">{tab.label}</span>
                      </div>
                      {isActive && (
                        <span className="text-xs font-bold text-[#FCD535]">&bull;</span>
                      )}
                    </button>
                  );
                })}
              </nav>

              {/* Drawer Footer with Officer & Sign Out */}
              <div className="p-3 border-t border-[#2B3139] shrink-0 bg-[#1E2329]">
                <div className="px-3 py-1.5 text-xs mb-1">
                  <span className="text-[#848E9C] block text-[10px]">Logged in Administrator</span>
                  <span className="font-semibold text-[#EAECEF] truncate block">
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
                  className="w-full py-2 text-xs font-medium text-[#848E9C] hover:text-[#EAECEF] hover:bg-[#2B313A] rounded-lg transition-colors text-left px-3 cursor-pointer flex items-center gap-2 min-h-[44px]"
                >
                  {isLoggingOut ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#FCD535]" />
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

      {/* Desktop Sidebar Navigation */}
      <aside className="hidden lg:flex w-64 bg-[#1E2329] border-r border-[#2B3139] shadow-sm flex-col shrink-0 h-screen z-30 font-sans sticky top-0">
        <div className="h-13 flex items-center px-4 border-b border-[#2B3139] shrink-0 justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-md bg-[#FCD535] text-[#181A20] flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
              K
            </div>
            <div className="flex flex-col min-w-0">
              <select
                value={municipalityFilter}
                onChange={(e) => setMunicipalityFilter(e.target.value)}
                aria-label="Select Municipal Assembly"
                className="text-xs font-bold text-[#EAECEF] bg-transparent border-none focus:outline-none cursor-pointer p-0 truncate hover:text-[#FCD535] transition-colors"
              >
                <option value="Kpone-Katamanso (KKMA)">Kpone-Katamanso (KKMA)</option>
              </select>
              <span className="text-[10px] text-[#848E9C] truncate leading-tight">
                Property Rate Cadastre &bull; Act 936
              </span>
            </div>
          </div>
          <span className="text-[10px] text-[#848E9C] uppercase font-mono font-medium shrink-0">Admin</span>
        </div>

        {/* Navigation Links (Zero Pills - Clean Google Enterprise Standard) */}
        <nav className="flex flex-col flex-1 px-3 py-3 gap-1 overflow-y-auto" aria-label="Main Navigation">
          <div className="px-3 pt-1 pb-1.5 text-[10px] font-semibold tracking-wider text-[#848E9C] uppercase font-mono select-none">
            Revenue Modules
          </div>
          {NAV_TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleTabChange(tab.key)}
                className={`relative px-3 py-2.5 text-left text-xs font-medium transition-colors cursor-pointer focus:outline-none rounded-lg flex items-center justify-between group ${isActive
                    ? "bg-[#FCD535]/8 text-[#FCD535] font-semibold"
                    : "text-[#848E9C] hover:text-[#EAECEF] hover:bg-[#1E2329]"
                  }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-1">
                  <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? "text-[#FCD535]" : "text-[#848E9C] group-hover:text-[#EAECEF]"}`} />
                  <span className="truncate whitespace-nowrap">{tab.label}</span>
                </div>
                {isActive && (
                  <motion.div
                    layoutId="activeTabIndicatorSidebar"
                    className="absolute left-0 top-1.5 bottom-1.5 w-[3.5px] bg-[#FCD535] rounded-r"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* User & Sign Out Footer */}
        <div className="p-3 border-t border-[#2B3139] shrink-0 bg-[#1E2329]">
          <div className="px-3 py-1.5 text-xs">
            <span className="text-[#848E9C] block text-[10px]">Logged in Administrator</span>
            <span className="font-semibold text-[#EAECEF] truncate block">
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
            className="w-full py-1.5 text-xs font-medium text-[#848E9C] hover:text-[#EAECEF] hover:bg-[#2B313A] rounded-lg transition-colors focus:outline-none text-left px-3 cursor-pointer flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoggingOut ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#FCD535]" />
                <span>Signing out...</span>
              </>
            ) : (
              <span>Sign Out</span>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen lg:h-screen lg:overflow-hidden">
        {/* Mobile App Header */}
        <header className="bg-[#1E2329] border-b border-[#2B3139] shadow-xs px-3.5 sm:px-4 h-13 flex items-center justify-between shrink-0 lg:hidden font-sans z-20 sticky top-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-md bg-[#FCD535] text-[#181A20] flex items-center justify-center font-bold text-xs shrink-0">
              K
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-[#FCD535] tracking-tight truncate">KKMA Revenue</span>
              <span className="text-[10px] text-[#848E9C] font-medium leading-none truncate">
                {NAV_TABS.find(t => t.key === activeTab)?.shortLabel || "Console"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {activeTab === "REGISTRY" && (
              <button
                type="button"
                onClick={() => setShowBatchModal(true)}
                className="btn-3d-secondary h-8 px-2.5 rounded-md text-[#FCD535] font-medium text-[11px] flex items-center gap-1 cursor-pointer focus:outline-none"
                title="Run Annual Billing Batch"
              >
                <RefreshCw className="w-3 h-3 text-[#FCD535]" />
                <span className="hidden sm:inline">Batch Rollout</span>
              </button>
            )}
            <span className="text-[11px] font-semibold text-[#EAECEF] hidden sm:inline-block">
              {currentAdmin?.username || "Heinz"}
            </span>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 -mr-1.5 text-[#EAECEF] hover:text-[#FCD535] hover:bg-[#181A20] rounded-lg cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center focus:outline-none transition-colors"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5 text-[#EAECEF]" />
            </button>
          </div>
        </header>

        {/* SMS Rollout Progress Bar (Slim Banner when Active) */}
        {smsJobId && smsJobProgress && (
          <div className="bg-[#1E2329] border-b border-[#2B3139] px-4 py-2 flex items-center gap-3 shrink-0 text-xs font-sans">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-[#EAECEF] truncate flex items-center gap-1.5">
                  {smsJobProgress.status === "DONE" ? (
                    <span className="text-[#0ECB81] font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Rollout Complete
                    </span>
                  ) : smsJobProgress.status === "FAILED" ? (
                    <span className="text-[#F6465D] font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Rollout Failed
                    </span>
                  ) : (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin text-[#FCD535]" />
                      <span>SMS Rollout in Progress...</span>
                    </>
                  )}
                </span>
                <span className="text-[10px] text-[#848E9C] font-mono shrink-0 ml-2">
                  {smsJobProgress.sentCount} / {smsJobProgress.totalCount} sent
                  {smsJobProgress.failedCount > 0 && (
                    <span className="text-[#F6465D] ml-1">({smsJobProgress.failedCount} failed)</span>
                  )}
                </span>
              </div>
              <div className="w-full bg-[#2B3139] rounded-full h-1 overflow-hidden">
                <div
                  className="h-1 rounded-full transition-all duration-500"
                  style={{
                    width: smsJobProgress.totalCount > 0 ? `${Math.round((smsJobProgress.sentCount / smsJobProgress.totalCount) * 100)}%` : "0%",
                    background: smsJobProgress.status === "DONE" ? "#0ECB81" : smsJobProgress.status === "FAILED" ? "#F6465D" : "#FCD535",
                  }}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setSmsJobId(null); setSmsJobProgress(null); }}
              className="text-[#848E9C] hover:text-[#EAECEF] cursor-pointer shrink-0 p-1 transition-colors"
              title="Dismiss progress notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Main Dashboard Workspace (Viewport Fitted & Full-Bleed on Mobile) */}
        <main className={`flex-1 min-h-0 w-full flex flex-col ${activeTab === "SMS_CENTER"
            ? "p-0 max-w-none overflow-hidden"
            : activeTab === "SETTINGS"
              ? "p-0 max-w-none overflow-y-auto"
              : "p-0 lg:px-6 lg:py-3 max-w-none lg:max-w-7xl lg:mx-auto gap-0 lg:gap-3 bg-[#1E2329] lg:bg-transparent overflow-y-auto pb-3"
          }`}>
          {/* Top KPI Cards (Zero Pills - Flat Edge-to-Edge on Mobile, Cards on Desktop) */}
          {activeTab === "REGISTRY" && (
            <section aria-label="Executive KPIs" className="shrink-0 bg-[#1E2329] border-b border-[#2B3139] lg:border-b-0 lg:bg-transparent">
              <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-x-0 lg:divide-y-0 divide-[#2B3139] lg:gap-3">
                {/* 1. Total Assessed Demand */}
                <div className="p-3.5 sm:p-4 lg:p-3 lg:bg-[#1E2329] lg:border lg:border-[#2B3139] lg:rounded-xl hover:bg-[#1E2329] lg:hover:border-[#363D47] transition-colors flex items-center justify-between lg:shadow-xs">
                  <div className="min-w-0 pr-2">
                    <span className="text-[11px] text-[#848E9C] font-medium block truncate">Total Assessed Demand</span>
                    <span className="text-base xl:text-lg font-bold text-[#EAECEF] tracking-tight whitespace-nowrap tabular-nums block">{metrics.totalBilledFormatted}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-[#848E9C] block font-mono">FY 2025</span>
                    <span className="text-[10px] text-[#848E9C] block">{(data?.pagination?.total ?? metrics.totalProperties).toLocaleString()} accounts</span>
                  </div>
                </div>

                {/* 2. Revenue Collected */}
                <div className="p-3.5 sm:p-4 lg:p-3 lg:bg-[#1E2329] lg:border lg:border-[#2B3139] lg:rounded-xl hover:bg-[#1E2329] lg:hover:border-[#363D47] transition-colors flex items-center justify-between lg:shadow-xs">
                  <div className="min-w-0 pr-2">
                    <span className="text-[11px] text-[#848E9C] font-medium block truncate">Revenue Collected</span>
                    <span className="text-base xl:text-lg font-bold text-[#0ECB81] tracking-tight whitespace-nowrap tabular-nums block">{metrics.totalCollectedFormatted}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-[#848E9C] block font-mono">Efficiency</span>
                    <span className="text-[11px] font-semibold text-[#0ECB81] block">{metrics.collectionRateFormatted}</span>
                  </div>
                </div>

                {/* 3. Cumulative Arrears */}
                <div className="p-3.5 sm:p-4 lg:p-3 lg:bg-[#1E2329] lg:border lg:border-[#2B3139] lg:rounded-xl hover:bg-[#1E2329] lg:hover:border-[#363D47] transition-colors flex items-center justify-between lg:shadow-xs">
                  <div className="min-w-0 pr-2">
                    <span className="text-[11px] text-[#848E9C] font-medium block truncate">Cumulative Arrears</span>
                    <span className="text-base xl:text-lg font-bold text-[#F6465D] tracking-tight whitespace-nowrap tabular-nums block">{metrics.totalArrearsFormatted}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-[#848E9C] block font-mono">Prior Debt</span>
                    <span className="text-[10px] text-[#848E9C] block">Act 936</span>
                  </div>
                </div>

                {/* 4. Accounts with Arrears */}
                <div className="p-3.5 sm:p-4 lg:p-3 lg:bg-[#1E2329] lg:border lg:border-[#2B3139] lg:rounded-xl hover:bg-[#1E2329] lg:hover:border-[#363D47] transition-colors flex items-center justify-between lg:shadow-xs">
                  <div className="min-w-0 pr-2">
                    <span className="text-[11px] text-[#848E9C] font-medium block truncate">Accounts with Arrears</span>
                    <span className="text-base xl:text-lg font-bold text-[#EAECEF] tracking-tight whitespace-nowrap tabular-nums block">{metrics.defaultersCount.toLocaleString()}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-[10px] font-semibold block ${metrics.defaultersCount > 0 ? "text-[#F6465D]" : "text-[#0ECB81]"}`}>
                      {metrics.defaultersCount > 0 ? "Recovery Active" : "Compliant"}
                    </span>
                    <span className="text-[10px] text-[#FCD535] hover:underline cursor-pointer" onClick={() => { setActiveTab("REGISTRY"); setStatusFilter("DEFAULTER"); }}>
                      Inspect
                    </span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* TAB 1: CADASTRE & VALUATION ROLL */}
          {activeTab === "REGISTRY" && (
            <section className="bg-[#1E2329] border-b border-[#2B3139] lg:border lg:border-[#2B3139] rounded-none lg:rounded-xl shadow-none lg:shadow-sm flex-1 min-h-0 flex flex-col overflow-hidden w-full">
              <div className="p-3.5 border-b border-[#2B3139] space-y-2.5 shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-[#EAECEF]">
                      Municipal Property Cadastre &amp; Valuation Roll
                    </h2>
                    <p className="text-xs text-[#848E9C] mt-0.5">
                      Master register of municipal property accounts, GhanaPost GPS codes, and rating valuations
                    </p>
                  </div>

                  <div className="text-xs text-[#848E9C] font-medium hidden sm:block">
                    {(data?.pagination?.total ?? propertiesList.length).toLocaleString()} properties on record
                  </div>
                </div>

                {/* Filter & Action Bar */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 sm:gap-3 pt-2 border-t border-[#2B3139]">
                  {/* Search */}
                  <div className="relative flex items-center w-full lg:flex-1 lg:max-w-md">
                    {isSearchingProperties ? (
                      <Loader2 className="w-4 h-4 text-[#FCD535] animate-spin absolute left-3 pointer-events-none" />
                    ) : (
                      <Search className="w-4 h-4 text-[#848E9C] absolute left-3 pointer-events-none" />
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
                      className="w-full h-8 pl-9 pr-8 rounded-lg border border-[#2B3139] bg-[#1E2329] text-xs text-[#EAECEF] placeholder:text-[#848E9C] focus:border-[#FCD535] focus:outline-none transition-colors"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={handleClearPropertySearch}
                        className="absolute right-2 text-[#848E9C] hover:text-[#EAECEF] p-1 cursor-pointer"
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
                      className="h-8 px-2.5 rounded-lg border border-[#2B3139] bg-[#1E2329] text-xs text-[#EAECEF] focus:outline-none focus:border-[#FCD535] shrink-0"
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
                      className="h-8 px-2.5 rounded-lg border border-[#2B3139] bg-[#1E2329] text-xs text-[#EAECEF] focus:outline-none focus:border-[#FCD535] shrink-0"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="UNPAID">Unpaid Balances</option>
                      <option value="DEFAULTER">Past Due Arrears (&gt; GH₵ 0)</option>
                      <option value="PAID">Paid in Full</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => setShowPropertyModal(true)}
                      className="btn-3d-primary h-8 px-3 rounded-lg font-medium text-xs flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <span>+ Add Property</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowCsvImportModal(true)}
                      className="btn-3d-secondary h-8 px-3 rounded-lg font-medium text-xs flex items-center gap-1.5 cursor-pointer shrink-0 text-[#FCD535] border-[#FCD535]/30"
                      title="Import Cadastre CSV"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Import CSV</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleExportCsv(selectedIds.length > 0)}
                      className="btn-3d-secondary h-8 px-3 rounded-lg font-medium text-xs flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{selectedIds.length > 0 ? `Export (${selectedIds.length})` : "Export CSV"}</span>
                    </button>
                  </div>
                </div>

                {/* Active Cadastre Filter Summary Strip (Zero Pills) */}
                {(classificationFilter !== "ALL" || statusFilter !== "ALL" || searchQuery.trim() !== "") && (
                  <div className="flex items-center justify-between text-xs text-[#848E9C] pt-1.5 pb-0.5 border-t border-[#2B3139]">
                    <div className="flex items-center gap-2 flex-wrap text-[11px]">
                      <span className="font-semibold text-[#EAECEF]">Active Filters:</span>
                      {searchQuery.trim() && (
                        <span className="text-[#FCD535] font-medium">Search: &ldquo;{searchQuery.trim()}&rdquo;</span>
                      )}
                      {classificationFilter !== "ALL" && (
                        <span className="text-[#FCD535] font-medium">&bull; Class: {classificationFilter}</span>
                      )}
                      {statusFilter !== "ALL" && (
                        <span className="text-[#FCD535] font-medium">&bull; Status: {statusFilter === "DEFAULTER" ? "Past Due Arrears" : statusFilter}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        handleClearPropertySearch();
                        setClassificationFilter("ALL");
                        setStatusFilter("ALL");
                      }}
                      className="text-[11px] font-semibold text-[#FCD535] hover:underline cursor-pointer shrink-0"
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
                    className="bg-[#181A20] border-b border-[#2B3139] px-4 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs shrink-0"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[#FCD535]">
                        {selectedIds.length} {selectedIds.length === 1 ? "property" : "properties"} selected
                      </span>

                      {selectedPaidList.length > 0 && selectedUnpaidList.length > 0 && (
                        <span className="text-[#848E9C] font-normal">
                          ({selectedUnpaidList.length} with balance due, {selectedPaidList.length} settled)
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => setSelectedIds([])}
                        className="text-xs text-[#848E9C] hover:text-[#EAECEF] underline cursor-pointer ml-1"
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
                          className="btn-3d-primary h-7 px-3 rounded-md font-medium text-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <Send className="w-3 h-3" />
                          <span>
                            Broadcast Dual-Link SMS ({selectedUnpaidList.length} Unpaid)
                          </span>
                        </button>
                      ) : (

                        <span className="text-xs text-[#0ECB81] font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Selected Accounts Settled</span>
                        </span>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Cadastre Table Container with Infinite Scrolling */}
              <div
                ref={tableContainerRef}
                onScroll={handleTableScroll}
                className="w-full flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-none"
              >
                {/* Desktop Cadastre Table (>= 768px) */}
                <table className="hidden md:table table-fixed w-full text-left text-xs border-collapse">
                  <thead className="bg-[#1E2329] border-b border-[#2B3139] text-[#848E9C] font-semibold text-[11px] sticky top-0 z-10 shadow-xs">
                    <tr>
                      <th className="py-2.5 px-3 text-center w-8 bg-[#1E2329]">
                        <input
                          type="checkbox"
                          checked={selectedIds.length === filteredProperties.length && filteredProperties.length > 0}
                          onChange={toggleSelectAll}
                          aria-label="Select all properties on current page"
                          className="rounded border-[#2B3139] text-[#FCD535] focus:ring-0 cursor-pointer"
                        />
                      </th>
                      <th className="py-2.5 px-3 w-[24%] bg-[#1E2329]">Account &amp; Cadastre</th>
                      <th className="py-2.5 px-3 w-[23%] bg-[#1E2329]">Ratepayer Particulars</th>
                      <th className="py-2.5 px-3 w-[15%] bg-[#1E2329] truncate">Classification</th>
                      <th className="py-2.5 px-3 w-[13%] text-right bg-[#1E2329] whitespace-nowrap">Rateable Value</th>
                      <th className="py-2.5 px-3 w-[14%] text-right bg-[#1E2329] whitespace-nowrap">Assessment Due</th>
                      <th className="py-2.5 px-3 w-[11%] text-center bg-[#1E2329] whitespace-nowrap">Status</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#2B3139] bg-[#1E2329]">
                    {filteredProperties.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-[#848E9C] font-normal">
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
                            className={`hover:bg-[#2B313A] transition-colors cursor-pointer ${selectedAccount?.id === prop.id ? "bg-[#2B313A]" : ""
                              }`}
                          >
                            <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectRow(prop.accountNumber)}
                                aria-label={`Select property ${prop.accountNumber}`}
                                className="rounded border-[#2B3139] text-[#FCD535] focus:ring-0 cursor-pointer"
                              />
                            </td>
                            <td className="py-2.5 px-3">
                              <p className="font-semibold text-[#EAECEF]">{prop.accountNumber}</p>
                              <p className="text-[#848E9C] text-[11px] mt-0.5">{prop.ownerDigitalAddress} &bull; {prop.municipality}</p>
                            </td>
                            <td className="py-2.5 px-3">
                              <p 
                                className="font-medium text-[#FCD535] hover:underline cursor-pointer transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (prop.ownerId) {
                                    handleOpenRatepayerDossier(prop.ownerId);
                                  }
                                }}
                              >
                                {prop.ownerName}
                              </p>
                              <p className="text-[#848E9C] text-[11px] mt-0.5">{prop.ownerPhone}</p>
                            </td>
                            <td className="py-2.5 px-3 text-[#848E9C]">
                              {prop.propertyClassification}
                            </td>
                            <td className="py-2.5 px-3 text-right font-medium text-[#EAECEF] whitespace-nowrap tabular-nums">
                              {prop.rateableValueFormatted}
                            </td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap tabular-nums">
                              <p className="font-semibold text-[#EAECEF] whitespace-nowrap tabular-nums">{prop.totalAmountDueFormatted}</p>
                              {prop.arrears > 0 && (
                                <p className="text-[#F6465D] text-[11px] mt-0.5 whitespace-nowrap tabular-nums">Arrears: {prop.arrearsFormatted}</p>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              <span
                                className={`text-xs font-medium ${isPaid
                                    ? "text-[#0ECB81]"
                                    : prop.status === "PARTIALLY_PAID"
                                      ? "text-[#FCD535]"
                                      : "text-[#F6465D]"
                                  }`}
                              >
                                {isPaid ? "Paid" : prop.status === "PARTIALLY_PAID" ? "Partial" : "Unpaid"}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}

                    {isLoadingMore && (
                      <>
                        {[...Array(5)].map((_, i) => (
                          <tr key={`cadastre-skel-desk-${i}`} className="animate-pulse bg-[#1E2329] border-b border-[#2B3139]">
                            <td className="py-3 px-3 text-center">
                              <div className="w-4 h-4 rounded bg-[#2B3139] mx-auto" />
                            </td>
                            <td className="py-3 px-3 space-y-1.5">
                              <div className="h-3 bg-[#2B3139] rounded w-28" />
                              <div className="h-2.5 bg-[#2B3139] rounded w-20" />
                            </td>
                            <td className="py-3 px-3 space-y-1.5">
                              <div className="h-3 bg-[#2B3139] rounded w-36" />
                              <div className="h-2.5 bg-[#2B3139] rounded w-28" />
                            </td>
                            <td className="py-3 px-3">
                              <div className="h-3 bg-[#2B3139] rounded w-32" />
                            </td>
                            <td className="py-3 px-3 text-right">
                              <div className="h-3 bg-[#2B3139] rounded w-20 ml-auto" />
                            </td>
                            <td className="py-3 px-3 text-right">
                              <div className="h-3.5 bg-[#2B3139] rounded w-20 ml-auto" />
                            </td>
                            <td className="py-3 px-3 text-center">
                              <div className="h-3 bg-[#2B3139] rounded w-14 mx-auto" />
                            </td>
                          </tr>
                        ))}
                      </>
                    )}
                  </tbody>
                </table>

                {/* Mobile Cadastre Google Material List Tiles (< 768px) */}
                <div className="block md:hidden divide-y divide-[#2B3139] bg-[#1E2329]">
                  {filteredProperties.length === 0 ? (
                    <div className="py-8 text-center text-[#848E9C] font-normal text-xs px-4">
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
                          className={`px-3.5 py-3 flex items-center justify-between gap-2.5 transition-colors cursor-pointer ${selectedAccount?.id === prop.id ? "bg-[#181A20]" : "hover:bg-[#1E2329] active:bg-[#2B313A]"
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
                                className="rounded border-[#2B3139] text-[#FCD535] focus:ring-0 cursor-pointer w-4 h-4"
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-xs text-[#EAECEF] font-mono truncate">
                                  {prop.accountNumber}
                                </span>
                                <span
                                  className={`text-[11px] font-semibold shrink-0 ${isPaid
                                      ? "text-[#0ECB81]"
                                      : prop.status === "PARTIALLY_PAID"
                                        ? "text-[#FCD535]"
                                        : "text-[#F6465D]"
                                    }`}
                                >
                                  &bull; {isPaid ? "Paid" : prop.status === "PARTIALLY_PAID" ? "Partial" : "Unpaid"}
                                </span>
                              </div>
                              <div className="text-[11px] text-[#848E9C] truncate mt-0.5">
                                <span
                                  className="text-[#FCD535] font-medium hover:underline cursor-pointer"
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
                                  <span className="text-[#848E9C] font-mono ml-1.5">&bull; {prop.ownerDigitalAddress}</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right: Total Due Amount + Classification + Chevron */}
                          <div className="flex items-center gap-1.5 shrink-0 text-right">
                            <div>
                              <div className="text-xs font-bold text-[#EAECEF] tabular-nums">
                                {prop.totalAmountDueFormatted}
                              </div>
                              <div className="text-[10px] text-[#848E9C] uppercase tracking-wider">
                                {prop.propertyClassification?.split(" ")[0] || "Rate"}
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-[#848E9C] shrink-0 ml-0.5" />
                          </div>
                        </div>
                      );
                    })
                  )}

                  {isLoadingMore && (
                    <div className="divide-y divide-[#2B3139] bg-[#1E2329] animate-pulse">
                      {[...Array(4)].map((_, i) => (
                        <div key={`cadastre-skel-mob-${i}`} className="px-3.5 py-3 flex items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="w-4 h-4 rounded bg-[#2B3139] shrink-0" />
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <div className="flex items-center gap-2">
                                <div className="h-3.5 bg-[#2B3139] rounded w-28" />
                                <div className="h-2.5 bg-[#2B313A] rounded w-12" />
                              </div>
                              <div className="h-3 bg-[#2B313A] rounded w-44" />
                            </div>
                          </div>
                          <div className="space-y-1 text-right shrink-0">
                            <div className="h-3.5 bg-[#2B3139] rounded w-16 ml-auto" />
                            <div className="h-2.5 bg-[#2B313A] rounded w-12 ml-auto" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Endless Scroll Sentinel & Clean End Marker */}
                  <div ref={propertySentinelRef} className="h-2 w-full" />
                  {!hasMoreProperties && filteredProperties.length > 0 && (
                    <div className="py-4 text-center text-[11px] text-[#848E9C] border-t border-[#2B3139]">
                      &bull; End of cadastre roll ({filteredProperties.length.toLocaleString()} properties loaded)
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* TAB 2: RATEPAYER DIRECTORY & CONSOLIDATED PORTFOLIOS */}
          {activeTab === "RATEPAYERS" && (
            <section className="flex-1 flex flex-col min-h-0 bg-[#1E2329] border-b border-[#2B3139] lg:border lg:border-[#2B3139] rounded-none lg:rounded-xl shadow-none lg:shadow-xs overflow-hidden w-full">
              {/* Directory Header Bar */}
              <div className="px-4 lg:px-6 py-3.5 sm:py-4 border-b border-[#2B3139] flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 shrink-0 bg-[#1E2329]">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-[#EAECEF] tracking-tight">
                      Municipal Ratepayer Directory & Portfolios
                    </h2>
                    <span className="text-xs text-[#FCD535] font-medium">&bull; Consolidated Taxpayer Profiles</span>
                  </div>
                  <p className="text-xs text-[#848E9C] mt-0.5">
                    Search and inspect citizen portfolios, multi-property ownerships, billing history, payment receipts, and audit logs under their name alone.
                  </p>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => loadRatepayers(ratepayerSearchQuery, 1, false)}
                    disabled={isLoadingMoreRatepayers}
                    className="btn-3d-secondary h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingMoreRatepayers ? "animate-spin" : ""}`} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {/* Filter & Search Toolbar */}
              <div className="px-4 lg:px-6 py-2.5 bg-[#1E2329] border-b border-[#2B3139] flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 shrink-0">
                <div className="flex items-center gap-2.5 w-full sm:w-auto sm:max-w-md flex-1">
                  <div className="relative w-full">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#848E9C]" />
                    <input
                      type="text"
                      inputMode="search"
                      value={ratepayerSearchQuery}
                      onChange={(e) => setRatepayerSearchQuery(e.target.value)}
                      placeholder="Search by ratepayer name or phone number..."
                      className="w-full pl-8 pr-8 py-1.5 bg-[#1E2329] border border-[#2B3139] rounded-lg text-xs text-[#EAECEF] placeholder-[#848E9C] focus:outline-none focus:border-[#FCD535] focus:ring-1 focus:ring-[#FCD535]"
                    />
                    {ratepayerSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setRatepayerSearchQuery("")}
                        className="absolute right-2.5 top-2 text-[#848E9C] hover:text-[#EAECEF] cursor-pointer"
                        title="Clear search"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <span className="text-xs text-[#848E9C] font-mono shrink-0">
                  {ratepayers.length} of {ratepayersTotal} Ratepayers
                </span>
              </div>

              {/* Ratepayers Directory Table */}
              <div className="flex-1 min-h-0 overflow-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-[#1E2329] border-b border-[#2B3139] sticky top-0 z-10 font-medium text-[#848E9C]">
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
                  <tbody className="divide-y divide-[#2B3139] bg-[#1E2329]">
                    {isLoadingMoreRatepayers && ratepayers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-[#848E9C]">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#FCD535] mb-2" />
                          <span>Loading ratepayer profiles...</span>
                        </td>
                      </tr>
                    ) : ratepayers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-[#848E9C]">
                          No ratepayer records match your query.
                        </td>
                      </tr>
                    ) : (
                      ratepayers.map((rp) => (
                        <tr
                          key={rp.id}
                          onClick={() => handleOpenRatepayerDossier(rp.id, rp)}
                          className="hover:bg-[#181A20]/40 cursor-pointer transition-colors group"
                        >
                          <td className="px-4 lg:px-6 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-md bg-[#FCD535]/10 text-[#FCD535] flex items-center justify-center font-bold text-xs shrink-0">
                                {rp.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <span className="font-semibold text-[#EAECEF] group-hover:text-[#FCD535] block truncate">
                                  {rp.name}
                                </span>
                                <span className="text-[11px] text-[#848E9C] block">
                                  Member since {rp.createdAtFormatted}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 lg:px-6 py-3.5 font-mono text-[#EAECEF]">
                            {rp.phoneNumber}
                          </td>
                          <td className="px-4 lg:px-6 py-3.5 text-center">
                            <span className="font-semibold text-[#EAECEF]">
                              {rp.propertyCount} {rp.propertyCount === 1 ? "property" : "properties"}
                            </span>
                          </td>
                          <td className="px-4 lg:px-6 py-3.5 text-right font-mono font-medium text-[#F6465D]">
                            {rp.totalArrearsFormatted}
                          </td>
                          <td className="px-4 lg:px-6 py-3.5 text-right font-mono font-semibold text-[#EAECEF]">
                            {rp.totalDueFormatted}
                          </td>
                          <td className="px-4 lg:px-6 py-3.5 text-center">
                            {rp.status === "DEFAULTER" ? (
                              <span className="text-xs font-semibold text-[#F6465D]">&bull; Defaulter</span>
                            ) : rp.status === "SETTLED" ? (
                              <span className="text-xs font-semibold text-[#0ECB81]">&bull; Settled</span>
                            ) : rp.status === "NO_PROPERTIES" ? (
                              <span className="text-xs text-[#848E9C]">&bull; No Parcels</span>
                            ) : (
                              <span className="text-xs font-semibold text-[#E37400]">&bull; Outstanding</span>
                            )}
                          </td>
                          <td className="px-4 lg:px-6 py-3.5 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenRatepayerDossier(rp.id, rp);
                              }}
                              className="text-xs font-medium text-[#FCD535] hover:underline cursor-pointer inline-flex items-center gap-1"
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

              {/* Pagination Bar */}
              {hasMoreRatepayers && (
                <div className="p-3 border-t border-[#2B3139] bg-[#1E2329] flex justify-center shrink-0">
                  <button
                    type="button"
                    onClick={() => loadRatepayers(ratepayerSearchQuery, currentRatepayerPage + 1, true)}
                    disabled={isLoadingMoreRatepayers}
                    className="btn-3d-secondary px-4 py-1.5 text-xs font-medium text-[#FCD535] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isLoadingMoreRatepayers && <Loader2 className="w-3 h-3 animate-spin" />}
                    <span>Load More Ratepayers</span>
                  </button>
                </div>
              )}
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

          {/* TAB 5: TREASURY RECONCILIATION */}
          {activeTab === "TREASURY" && (
            <section className="bg-[#1E2329] border-b border-[#2B3139] lg:border lg:border-[#2B3139] rounded-none lg:rounded-xl shadow-none lg:shadow-sm flex-1 min-h-0 flex flex-col overflow-hidden w-full">
              <div className="p-3.5 border-b border-[#2B3139] flex flex-col gap-3 shrink-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-[#EAECEF]">Municipal Treasury Collections &amp; GCR Audit Log</h2>
                    <p className="text-xs text-[#848E9C] mt-0.5">
                      Real-time transaction logs of all rate payments settled across Mobile Money, Card, and Counter Cash Treasury.
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-[#0ECB81]">
                    Total Reconciled: {metrics.totalCollectedFormatted}
                  </span>
                </div>

                {/* Treasury Dynamic Search & Filter Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 pt-2 border-t border-[#2B3139]">
                  <div className="relative flex items-center w-full lg:flex-1 lg:max-w-md">
                    <Search className="w-4 h-4 text-[#848E9C] absolute left-3 pointer-events-none" />
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
                      className="w-full h-8 pl-9 pr-8 rounded-lg border border-[#2B3139] bg-[#1E2329] text-xs text-[#EAECEF] placeholder:text-[#848E9C] focus:border-[#FCD535] focus:outline-none transition-colors"
                    />
                    {treasurySearchQuery && (
                      <button
                        type="button"
                        onClick={() => setTreasurySearchQuery("")}
                        className="absolute right-2 text-[#848E9C] hover:text-[#EAECEF] p-1 cursor-pointer"
                        title="Clear search"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={treasuryMethodFilter}
                      onChange={(e) => setTreasuryMethodFilter(e.target.value)}
                      aria-label="Filter by payment channel"
                      className="h-8 px-2.5 rounded-lg border border-[#2B3139] bg-[#1E2329] text-xs text-[#EAECEF] focus:outline-none focus:border-[#FCD535]"
                    >
                      <option value="ALL">All Payment Channels</option>
                      <option value="Mobile Money">Mobile Money (MTN / Telecel)</option>
                      <option value="Card">Card / Online Gateway</option>
                      <option value="Counter Cash">Counter Cash Treasury</option>
                    </select>
                    <span className="text-xs text-[#848E9C] font-medium">
                      {filteredTreasuryReceipts.length} record{filteredTreasuryReceipts.length === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="w-full flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                {/* Desktop Treasury Table (>= 768px) */}
                <table className="hidden md:table table-fixed w-full text-left text-xs border-collapse">
                  <thead className="bg-[#1E2329] border-b border-[#2B3139] text-[#848E9C] font-semibold text-[11px] sticky top-0 z-10 shadow-xs">
                    <tr>
                      <th className="py-2.5 px-3 w-[20%] bg-[#1E2329] whitespace-nowrap">Receipt Reference</th>
                      <th className="py-2.5 px-3 w-[25%] bg-[#1E2329]">Account Head &amp; Ratepayer</th>
                      <th className="py-2.5 px-3 w-[14%] bg-[#1E2329] whitespace-nowrap">Settlement Date</th>
                      <th className="py-2.5 px-3 w-[16%] bg-[#1E2329] whitespace-nowrap">Payment Channel</th>
                      <th className="py-2.5 px-3 w-[13%] text-right bg-[#1E2329] whitespace-nowrap">Amount Settled</th>
                      <th className="py-2.5 px-3 w-[12%] text-center bg-[#1E2329] whitespace-nowrap">Audit Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2B3139] bg-[#1E2329]">
                    {filteredTreasuryReceipts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-[#848E9C] italic font-normal">
                          No treasury receipts match your search query.
                        </td>
                      </tr>
                    ) : (
                      filteredTreasuryReceipts.map((receipt) => (
                        <tr key={receipt.id} className="hover:bg-[#1E2329] transition-colors">
                          <td className="py-2.5 px-3 font-semibold text-[#EAECEF] whitespace-nowrap">
                            {receipt.receiptNumber}
                          </td>
                          <td className="py-2.5 px-3 text-[#848E9C]">
                            <span className="font-mono font-medium text-[#EAECEF]">{receipt.accountNumber}</span>
                            {receipt.ownerName && <p className="text-[11px] text-[#848E9C]">{receipt.ownerName}</p>}
                          </td>
                          <td className="py-2.5 px-3 text-[#848E9C] whitespace-nowrap">
                            {receipt.datePaid}
                          </td>
                          <td className="py-2.5 px-3 text-[#EAECEF] whitespace-nowrap">
                            {receipt.paymentMethod}
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold text-[#0ECB81] whitespace-nowrap tabular-nums">
                            {receipt.amountFormatted}
                          </td>
                          <td className="py-2.5 px-3 text-center font-medium text-[#0ECB81] whitespace-nowrap">
                            &bull; Reconciled
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {/* Mobile Treasury Google Material List Tiles (< 768px) */}
                <div className="block md:hidden divide-y divide-[#2B3139] bg-[#1E2329]">
                  {filteredTreasuryReceipts.length === 0 ? (
                    <div className="py-8 text-center text-[#848E9C] italic font-normal text-xs px-4">
                      No treasury receipts match your search query.
                    </div>
                  ) : (
                    filteredTreasuryReceipts.map((receipt) => (
                      <div
                        key={`mobile-receipt-${receipt.id}`}
                        className="px-3.5 py-3 flex items-center justify-between gap-2.5 hover:bg-[#1E2329] transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-[#EAECEF] font-mono">
                              {receipt.receiptNumber}
                            </span>
                            <span className="text-[11px] font-semibold text-[#0ECB81]">
                              &bull; Reconciled
                            </span>
                          </div>
                          <div className="text-[11px] text-[#848E9C] truncate mt-0.5">
                            <span className="font-mono text-[#848E9C]">{receipt.accountNumber}</span>
                            {receipt.ownerName && <span className="ml-1.5">&bull; {receipt.ownerName}</span>}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-xs font-bold text-[#0ECB81] tabular-nums block">
                            {receipt.amountFormatted}
                          </span>
                          <span className="text-[10px] text-[#848E9C] block mt-0.5">
                            {receipt.paymentMethod} &bull; {receipt.datePaid}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Treasury Status Bar */}
              <div className="px-4 py-2 border-t border-[#2B3139] bg-[#1E2329] flex items-center justify-between text-xs text-[#848E9C] shrink-0">
                <span>Value Book &amp; GCR Reconciled Ledger</span>
                <span>{filteredTreasuryReceipts.length} entries shown</span>
              </div>
            </section>
          )}

          {/* TAB: SYSTEM AUDIT TRAIL */}
          {activeTab === "AUDIT_LOGS" && (
            <section className="flex-1 flex flex-col min-h-0 bg-[#1E2329] border-b border-[#2B3139] lg:border lg:border-[#2B3139] rounded-none lg:rounded-xl shadow-none lg:shadow-xs overflow-hidden w-full">
              {/* Audit Header Bar */}
              <div className="px-4 lg:px-6 py-3.5 sm:py-4 border-b border-[#2B3139] flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 shrink-0 bg-[#1E2329]">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-[#EAECEF] tracking-tight">
                      Municipal Revenue Directorate — Master Audit Trail
                    </h2>
                    <span className="text-xs text-[#0ECB81] font-medium">&bull; Immutable Ledger</span>
                  </div>
                  <p className="text-xs text-[#848E9C] mt-0.5">
                    Chronological audit event logs for manual settlements, rate revisions, SMS bill rollouts, and assembly administrative overrides under Act 936.
                  </p>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => loadAuditLogs(auditLogSearchQuery, auditLogActionFilter, 1)}
                    disabled={isLoadingAuditLogs}
                    className="btn-3d-secondary h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAuditLogs ? "animate-spin" : ""}`} />
                    <span>Refresh</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportAuditLogsCsv}
                    className="btn-3d-secondary h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer text-[#FCD535] border-[#FCD535]/30"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Audit Log (CSV)</span>
                  </button>
                </div>
              </div>

              {/* Filter Toolbar */}
              <div className="px-4 lg:px-6 py-2.5 bg-[#1E2329] border-b border-[#2B3139] flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 shrink-0">
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 sm:gap-3 w-full lg:flex-1">
                  <div className="relative flex-1 w-full sm:w-auto max-w-none sm:max-w-md">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#848E9C]" />
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
                      className="w-full pl-8 pr-8 py-1.5 bg-[#1E2329] border border-[#2B3139] rounded-lg text-xs text-[#EAECEF] focus:outline-none focus:border-[#FCD535]"
                    />
                    {auditLogSearchQuery && (
                      <button
                        type="button"
                        onClick={handleClearAuditLogSearch}
                        className="absolute right-2.5 top-2 text-[#848E9C] hover:text-[#EAECEF] p-0.5 cursor-pointer"
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
                    className="h-8 px-3 bg-[#1E2329] border border-[#2B3139] rounded-lg text-xs text-[#EAECEF] focus:outline-none focus:border-[#FCD535] cursor-pointer"
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

                <div className="text-xs text-[#848E9C] font-medium">
                  {auditLogsTotal} event{auditLogsTotal === 1 ? "" : "s"} logged
                </div>
              </div>

              {/* Table Container */}
              <div
                ref={auditLogTableContainerRef}
                className="w-full flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
              >
                {/* Desktop Audit Trail Table (>= 768px) */}
                <table className="hidden md:table table-fixed w-full text-left text-xs border-collapse">
                  <thead className="bg-[#1E2329] border-b border-[#2B3139] text-[#848E9C] font-semibold text-[11px] sticky top-0 z-10 shadow-xs">
                    <tr>
                      <th className="py-2.5 px-3 w-[14%] bg-[#1E2329] whitespace-nowrap">Date &amp; Time</th>
                      <th className="py-2.5 px-3 w-[19%] bg-[#1E2329] whitespace-nowrap">Administrative Action</th>
                      <th className="py-2.5 px-3 w-[13%] bg-[#1E2329] whitespace-nowrap">Target Entity</th>
                      <th className="py-2.5 px-3 w-[16%] bg-[#1E2329] whitespace-nowrap">Authorized Actor</th>
                      <th className="py-2.5 px-3 w-[26%] bg-[#1E2329]">Audit Narrative &amp; Scope</th>
                      <th className="py-2.5 px-3 w-[12%] text-right bg-[#1E2329] whitespace-nowrap">Tamper Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2B3139] bg-[#1E2329] font-sans">
                    {filteredAuditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-[#848E9C]">
                          {isLoadingAuditLogs ? (
                            <div className="flex justify-center items-center py-4">
                              <Loader2 className="w-5 h-5 animate-spin text-[#FCD535]" />
                            </div>
                          ) : (
                            <span className="italic">No audit trail records found matching your filter.</span>
                          )}
                        </td>
                      </tr>
                    ) : (
                      filteredAuditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-[#1E2329] transition-colors">
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="font-medium text-[#EAECEF]">{log.createdAtFormatted}</span>
                            <span className="text-[11px] text-[#848E9C] block font-mono">{log.timeFormatted}</span>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="flex items-center gap-1.5 font-medium text-[#EAECEF]">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: log.actionBadgeColor }}
                              />
                              {log.actionLabel}
                            </span>
                            <span className="text-[10px] text-[#848E9C] font-mono block pl-3.5">{log.action}</span>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap text-[#848E9C]">
                            <span className="font-medium text-[#EAECEF]">{log.entityType}</span>
                            {log.entityId && (
                              <span className="text-[11px] text-[#848E9C] font-mono block truncate max-w-[120px]">
                                #{log.entityId}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="font-semibold text-[#EAECEF]">{log.adminName}</span>
                            <span className="text-[11px] text-[#848E9C] block">{log.adminRole}</span>
                          </td>
                          <td className="py-2.5 px-3 text-[#EAECEF] leading-relaxed break-words">
                            {log.details}
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <span className="text-[11px] font-medium text-[#0ECB81]">
                              &bull; Verified Immutable
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {/* Mobile Audit Trail Cards (< 768px) */}
                <div className="block md:hidden divide-y divide-[#2B3139] bg-[#1E2329] font-sans">
                  {filteredAuditLogs.length === 0 ? (
                    <div className="py-12 text-center text-[#848E9C] text-xs px-4">
                      {isLoadingAuditLogs ? (
                        <div className="flex justify-center items-center py-4">
                          <Loader2 className="w-5 h-5 animate-spin text-[#FCD535]" />
                        </div>
                      ) : (
                        <span className="italic">No audit trail records found matching your filter.</span>
                      )}
                    </div>
                  ) : (
                    filteredAuditLogs.map((log) => (
                      <div
                        key={`mobile-audit-${log.id}`}
                        className="p-3.5 space-y-2 hover:bg-[#1E2329] transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 font-medium text-xs text-[#EAECEF]">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: log.actionBadgeColor }}
                            />
                            {log.actionLabel}
                          </span>
                          <span className="text-[11px] font-medium text-[#0ECB81]">
                            &bull; Immutable
                          </span>
                        </div>

                        <div className="text-xs text-[#EAECEF] leading-relaxed break-words">
                          {log.details}
                        </div>

                        <div className="pt-1.5 border-t border-[#2B3139] flex items-center justify-between text-[11px] text-[#848E9C]">
                          <div>
                            <span className="font-semibold text-[#EAECEF]">{log.adminName}</span>
                            <span className="text-[#848E9C] ml-1">({log.adminRole})</span>
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

              {/* Status Bar */}
              <div className="px-4 py-2 border-t border-[#2B3139] bg-[#1E2329] flex items-center justify-between text-xs text-[#848E9C] shrink-0">
                <span>Local Governance Act, 2016 (Act 936) &bull; Official Treasury Audit Log</span>
                <span>{auditLogs.length} of {auditLogsTotal} records shown</span>
              </div>
            </section>
          )}

          {/* TAB 7: SETTINGS & SMS GATEWAY CONFIGURATION */}
          {activeTab === "SETTINGS" && (
            <SettingsTab onNotify={showToast} />
          )}
        </main>

        {/* Static Grounded Footer */}
        <footer className="shrink-0 h-8 bg-[#1E2329] border-t border-[#2B3139] px-6 hidden lg:flex items-center justify-between text-[11px] text-[#848E9C] font-sans">
          <span>Kpone-Katamanso Municipal Assembly (KKMA) &bull; Revenue Administration Platform</span>
          <span>Local Governance Act, 2016 (Act 936)</span>
        </footer>
      </div>


      {/* PROPERTY ASSESSMENT DOSSIER SIDE SHEET */}
      <AnimatePresence>
        {selectedAccount && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/35"
              onClick={() => setSelectedAccount(null)}
            />

            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 280 }}
              className="relative z-10 w-full max-w-lg bg-[#1E2329] h-full shadow-2xl flex flex-col border-l border-[#2B3139] font-sans"
            >
              <div className="px-6 py-4 border-b border-[#2B3139] flex items-center justify-between shrink-0 bg-[#1E2329]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#848E9C] font-semibold uppercase tracking-wider">
                      Property Assessment Dossier
                    </span>
                    <span
                      className={`text-[11px] font-semibold ${selectedAccount.status === "PAID"
                          ? "text-[#0ECB81]"
                          : selectedAccount.status === "PARTIALLY_PAID"
                            ? "text-[#FCD535]"
                            : "text-[#F6465D]"
                        }`}
                    >
                      &bull; {selectedAccount.status === "PAID" ? "Settled" : selectedAccount.status === "PARTIALLY_PAID" ? "Partial" : "Unpaid Demand"}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-[#EAECEF] mt-0.5">
                    {selectedAccount.accountNumber}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedAccount(null)}
                  className="p-1.5 rounded-lg text-[#848E9C] hover:text-[#EAECEF] transition-colors cursor-pointer"
                  aria-label="Close dossier"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 text-xs divide-y divide-[#2B3139]">
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-[#EAECEF] uppercase tracking-wider">
                    Ratepayer &amp; Cadastre Location
                  </h4>
                  <dl className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs">
                    <div>
                      <dt className="text-[#848E9C]">Account Head (Owner)</dt>
                      <dd className="font-medium text-[#EAECEF] mt-0.5">{selectedAccount.ownerName}</dd>
                    </div>
                    <div>
                      <dt className="text-[#848E9C]">Telephone No.</dt>
                      <dd className="font-medium text-[#EAECEF] mt-0.5">{selectedAccount.ownerPhone}</dd>
                    </div>
                    <div>
                      <dt className="text-[#848E9C]">GhanaPost GPS Code</dt>
                      <dd className="font-mono font-medium text-[#EAECEF] mt-0.5">{selectedAccount.ownerDigitalAddress}</dd>
                    </div>
                    <div>
                      <dt className="text-[#848E9C]">Assembly (MMDA)</dt>
                      <dd className="font-medium text-[#EAECEF] mt-0.5">{selectedAccount.municipality}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-[#848E9C]">Zoning Classification</dt>
                      <dd className="font-medium text-[#EAECEF] mt-0.5">{selectedAccount.propertyClassification}</dd>
                    </div>
                  </dl>
                </div>

                <div className="pt-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-[#EAECEF] uppercase tracking-wider">
                      Valuation &amp; Statement of Account
                    </h4>
                    <span className="text-xs text-[#848E9C]">FY {selectedAccount.billYear}</span>
                  </div>

                  <dl className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-[#2B3139]">
                      <dt className="text-[#848E9C]">Rateable Valuation Roll</dt>
                      <dd className="font-medium text-[#EAECEF] whitespace-nowrap tabular-nums">{selectedAccount.rateableValueFormatted}</dd>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#2B3139]">
                      <dt className="text-[#848E9C]">Rate Imposed</dt>
                      <dd className="text-[#EAECEF] whitespace-nowrap tabular-nums">{selectedAccount.rateImposed}</dd>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#2B3139]">
                      <dt className="text-[#848E9C]">Previous Year Assessment</dt>
                      <dd className="text-[#EAECEF] whitespace-nowrap tabular-nums">{selectedAccount.previousYearBillFormatted}</dd>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#2B3139]">
                      <dt className="text-[#848E9C]">Carried Cumulative Arrears</dt>
                      <dd className={`font-medium whitespace-nowrap tabular-nums ${selectedAccount.arrears > 0 ? "text-[#F6465D]" : "text-[#EAECEF]"}`}>
                        {selectedAccount.arrearsFormatted}
                      </dd>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#2B3139]">
                      <dt className="text-[#848E9C]">2025 Current Rate Assessment</dt>
                      <dd className="font-medium text-[#EAECEF] whitespace-nowrap tabular-nums">{selectedAccount.currentFeeFormatted}</dd>
                    </div>
                    <div className="flex justify-between pt-2 text-sm font-semibold">
                      <dt className="text-[#EAECEF]">Total Amount Due</dt>
                      <dd className="text-[#EAECEF] whitespace-nowrap tabular-nums">{selectedAccount.totalAmountDueFormatted}</dd>
                    </div>
                  </dl>
                </div>

                <div className="pt-5 space-y-3">
                  <h4 className="text-xs font-semibold text-[#EAECEF] uppercase tracking-wider">
                    GCR Receipt Trail ({selectedAccount.receipts.length})
                  </h4>
                  {selectedAccount.receipts.length === 0 ? (
                    <p className="text-[#848E9C] text-xs py-2 italic">No payments recorded for this assessment cycle.</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedAccount.receipts.map((r) => (
                        <div
                          key={r.id}
                          className="p-3 rounded-lg bg-[#1E2329] border border-[#2B3139] flex items-center justify-between text-xs"
                        >
                          <div>
                            <p className="font-semibold text-[#EAECEF]">{r.receiptNumber}</p>
                            <p className="text-[#848E9C] text-[11px] mt-0.5">{r.paymentMethod} &bull; {r.datePaid}</p>
                          </div>
                          <span className="font-semibold text-[#0ECB81]">{r.amountFormatted}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="px-6 py-3.5 border-t border-[#2B3139] bg-[#1E2329] flex items-center justify-between gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(true)}
                  className="btn-3d-secondary h-9 px-3.5 rounded-lg font-medium text-xs cursor-pointer"
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
                    className="btn-3d-primary h-9 px-3.5 rounded-lg font-medium text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send SMS Notice</span>
                  </button>
                )}

              </div>
            </motion.aside>
          </div>
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
        onSelectProperty={(acc) => {
          const propFromDossier = selectedRatepayerDossier?.properties.find((p) => p.accountNumber === acc);
          const propFromList = properties.find((p) => p.accountNumber === acc);
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
              className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            />

            {/* Bottom-to-Top Sliding Modal Sheet */}
            <motion.div
              initial={{ y: "100%", opacity: 0.8 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="relative z-10 bg-[#1E2329] rounded-t-2xl sm:rounded-2xl border-t sm:border border-[#2B3139] shadow-2xl p-4 sm:p-6 max-w-md w-full font-sans max-h-[92vh] sm:max-h-[90vh] overflow-y-auto"
            >
              <div className="w-10 h-1 bg-[#2B3139] rounded-full mx-auto mb-3 sm:hidden shrink-0" />
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
                <div className="flex items-center justify-between pb-3 border-b border-[#2B3139]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#181A20] text-[#FCD535] flex items-center justify-center">
                      <RefreshCw className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-[#EAECEF]">
                        Annual Batch Billing Rollout
                      </h3>
                      <p className="text-xs text-[#848E9C]">Statutory Assessment Cycle</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowBatchModal(false)}
                    className="text-[#848E9C] hover:text-[#EAECEF] p-1 rounded-lg cursor-pointer"
                    aria-label="Close modal"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-3.5 rounded-xl bg-[#181A20] text-xs text-[#EAECEF] space-y-2">
                  <p className="font-semibold text-[#FCD535]">
                    Execute Annual Rollout for {properties.length} Properties
                  </p>
                  <div className="space-y-3 pt-2">
                    <div className="space-y-1">
                      <label className="text-[#848E9C] font-medium block">Residential Rate Factor</label>
                      <input
                        type="number"
                        step="0.001"
                        value={residentialRate}
                        onChange={(e) => setResidentialRate(e.target.value)}
                        aria-label="Residential Rate Factor"
                        className="w-full h-9 px-3 rounded-md border border-[#2B3139] text-xs focus:outline-none focus:border-[#FCD535]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[#848E9C] font-medium block">Commercial Rate Factor</label>
                      <input
                        type="number"
                        step="0.001"
                        value={commercialRate}
                        onChange={(e) => setCommercialRate(e.target.value)}
                        aria-label="Commercial Rate Factor"
                        className="w-full h-9 px-3 rounded-md border border-[#2B3139] text-xs focus:outline-none focus:border-[#FCD535]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[#848E9C] font-medium block">Statutory Due Date</label>
                      <input
                        type="text"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        aria-label="Statutory Due Date"
                        className="w-full h-9 px-3 rounded-md border border-[#2B3139] text-xs focus:outline-none focus:border-[#FCD535]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[#848E9C] font-medium block">Dual-Link SMS Notice Template</label>
                      <textarea
                        value={messageTemplate}
                        onChange={(e) => setMessageTemplate(e.target.value)}
                        aria-label="Dual-Link SMS Notice Template"
                        rows={4}
                        className="w-full p-2.5 rounded-md border border-[#2B3139] text-xs focus:outline-none focus:border-[#FCD535] resize-none"
                      />
                    </div>

                    {/* Security Authorization Password */}
                    <div className="space-y-1 pt-2 border-t border-[#E8D4E2]">
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-[#FCD535]" />
                        <label className="text-[#FCD535] font-semibold text-xs block">Administrator Authorization Password *</label>
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
                          className="w-full h-9 px-3 pr-9 rounded-md border border-[#2B3139] bg-[#1E2329] text-xs text-[#EAECEF] focus:outline-none focus:border-[#FCD535] [&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_white] [&:-webkit-autofill]:text-fill-[#2C2C2C]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowBatchPassword(!showBatchPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#848E9C] hover:text-[#EAECEF] p-1 cursor-pointer"
                        >
                          {showBatchPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#2B3139]">
                  <button
                    type="button"
                    onClick={() => setShowBatchModal(false)}
                    disabled={isProcessing}
                    className="h-11 sm:h-9 px-3.5 rounded-lg border border-[#2B3139] text-[#EAECEF] font-medium text-xs cursor-pointer flex-1 sm:flex-none"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="btn-3d-primary h-11 sm:h-9 px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 flex-1 sm:flex-none"
                  >
                    {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    <span>Confirm &amp; Rollout Bills</span>
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
              className="fixed inset-0 bg-black/50 backdrop-blur-xs"
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
              className="relative z-10 bg-[#1E2329] rounded-t-2xl sm:rounded-xl border-t sm:border border-[#2B3139] shadow-xl p-4 sm:p-5 max-w-md w-full space-y-3.5 text-xs font-sans max-h-[92vh] sm:max-h-[90vh] overflow-y-auto"
            >
              {/* Anti-autofill Decoy Honeypot */}
              <input type="text" name="prevent_autofill_user" tabIndex={-1} aria-hidden="true" style={{ position: "absolute", top: -9999, left: -9999, opacity: 0, height: 0, width: 0, pointerEvents: "none" }} />
              <input type="password" name="prevent_autofill_pass" tabIndex={-1} aria-hidden="true" style={{ position: "absolute", top: -9999, left: -9999, opacity: 0, height: 0, width: 0, pointerEvents: "none" }} />
              <div className="w-10 h-1 bg-[#2B3139] rounded-full mx-auto mb-2 sm:hidden shrink-0" />
              <div className="flex items-center justify-between border-b border-[#2B3139] pb-2.5">
                <h3 className="text-sm font-semibold text-[#EAECEF]">
                  Record Manual Assembly Payment
                </h3>
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  disabled={isProcessing}
                  className="text-[#848E9C] hover:text-[#EAECEF] p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1">
                <span className="text-[#848E9C]">Account Head</span>
                <p className="font-semibold text-[#EAECEF]">{selectedAccount.accountNumber} ({selectedAccount.ownerName})</p>
                <p className="text-[#848E9C]">Total Outstanding Due: {selectedAccount.totalAmountDueFormatted}</p>
              </div>

              <div className="space-y-1">
                <label className="text-[#848E9C] font-medium">Payment Amount (GH₵)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder={selectedAccount.totalAmountDue.toString()}
                  value={manualAmount}
                  onChange={(e) => setManualAmount(e.target.value)}
                  aria-label="Payment Amount in Ghanaian Cedi"
                  className="w-full h-10 px-3 rounded-lg border border-[#2B3139] bg-[#1E2329] text-xs font-semibold text-[#EAECEF] focus:outline-none focus:border-[#FCD535]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[#848E9C] font-medium">Payment Channel</label>
                <select
                  value={manualMethod}
                  onChange={(e) => setManualMethod(e.target.value)}
                  aria-label="Select Payment Channel"
                  className="w-full h-10 px-3 rounded-lg border border-[#2B3139] bg-[#1E2329] text-xs text-[#EAECEF] focus:outline-none focus:border-[#FCD535]"
                >
                  <option>Counter Cash Treasury</option>
                  <option>Assembly Direct Cheque</option>
                  <option>GCB Bank Direct Deposit</option>
                  <option>Ecobank Treasury Deposit</option>
                </select>
              </div>

              {/* Security Authorization Password */}
              <div className="space-y-1 pt-2 border-t border-[#2B3139]">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#FCD535]" />
                  <label className="text-[#FCD535] font-semibold text-xs block">Administrator Authorization Password *</label>
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
                    className="w-full h-10 px-3 pr-9 rounded-lg border border-[#2B3139] bg-[#1E2329] text-xs font-semibold text-[#EAECEF] focus:outline-none focus:border-[#FCD535] [&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_white] [&:-webkit-autofill]:text-fill-[#2C2C2C]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPaymentPassword(!showPaymentPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#848E9C] hover:text-[#EAECEF] p-1 cursor-pointer"
                  >
                    {showPaymentPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#2B3139]">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  disabled={isProcessing}
                  className="h-11 sm:h-9 px-3.5 rounded-lg border border-[#2B3139] text-[#EAECEF] font-medium transition-colors cursor-pointer flex-1 sm:flex-none"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isProcessing}
                  className="btn-3d-primary h-11 sm:h-9 px-4 rounded-lg font-medium flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 flex-1 sm:flex-none"
                >
                  {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Issue &amp; Reconcile GCR</span>
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      {/* Systematic Google-Style Notification Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed bottom-6 left-6 z-50 max-w-md w-[calc(100%-3rem)] bg-[#1E2329] text-[#EAECEF] px-4 py-3 rounded-lg shadow-2xl border border-[#2B3139] flex items-center justify-between gap-3 text-xs font-medium font-sans"
            role="status"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {toast.type === "success" && (
                <CheckCircle2 className="w-4 h-4 text-[#81C995] shrink-0" />
              )}
              {toast.type === "error" && (
                <AlertTriangle className="w-4 h-4 text-[#F28B82] shrink-0" />
              )}
              {toast.type === "info" && (
                <Info className="w-4 h-4 text-[#8AB4F8] shrink-0" />
              )}
              <span className="text-[#F3F4F4] leading-snug">{toast.message}</span>
            </div>

            <button
              type="button"
              onClick={() => setToast(null)}
              className="text-[#9AA0A6] hover:text-white p-1 rounded transition-colors shrink-0 cursor-pointer"
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
              className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            />

            {/* Bottom-to-Top Sliding Modal Sheet */}
            <motion.div
              initial={{ y: "100%", opacity: 0.8 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="relative z-10 bg-[#1E2329] rounded-t-2xl sm:rounded-2xl border-t sm:border border-[#2B3139] shadow-2xl p-4 sm:p-6 max-w-lg w-full space-y-4 max-h-[92vh] sm:max-h-[90vh] overflow-y-auto"
            >
              {/* Anti-autofill Decoy Honeypot */}
              <input type="text" name="prevent_autofill_user" tabIndex={-1} aria-hidden="true" style={{ position: "absolute", top: -9999, left: -9999, opacity: 0, height: 0, width: 0, pointerEvents: "none" }} />
              <input type="password" name="prevent_autofill_pass" tabIndex={-1} aria-hidden="true" style={{ position: "absolute", top: -9999, left: -9999, opacity: 0, height: 0, width: 0, pointerEvents: "none" }} />
              <div className="w-10 h-1 bg-[#2B3139] rounded-full mx-auto mb-2 sm:hidden shrink-0" />
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[#2B3139]">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-[#181A20] text-[#FCD535] flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-[#FCD535]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#EAECEF]">
                      Authorize SMS Rollout Transmission
                    </h3>
                    <p className="text-xs text-[#848E9C]">Communications Directorate &bull; Act 936</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowSmsAuthModal(false);
                    setSmsAuthPassword("");
                    setSmsAuthError(null);
                  }}
                  className="w-7 h-7 rounded-lg text-[#848E9C] hover:text-[#EAECEF] hover:bg-[#2B313A] flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Target Audience Summary */}
              <div className="bg-[#1E2329] rounded-xl p-3.5 border border-[#2B3139] space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#848E9C] font-medium">Target Recipients:</span>
                  <span className="font-semibold text-[#EAECEF]">
                    {smsAuthTargetAccounts.length} {smsAuthTargetAccounts.length === 1 ? "Taxpayer Account" : "Taxpayer Accounts"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#848E9C] font-medium">Total Balance to Notify:</span>
                  <span className="font-semibold text-[#F6465D]">
                    GH₵ {smsAuthTargetAccounts.reduce((acc, curr) => acc + (curr.totalAmountDue || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#848E9C] font-medium">Outbound Gateway:</span>
                  <span className="font-medium text-[#0ECB81]">Arkesel SMS Gateway (Sender ID: Arnold)</span>
                </div>
              </div>

              {/* Recipient Details List */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#EAECEF] block">
                  Recipient Roster ({smsAuthTargetAccounts.length})
                </label>
                <div className="max-h-36 overflow-y-auto rounded-lg border border-[#2B3139] divide-y divide-[#2B3139] bg-[#1E2329] text-xs">
                  {smsAuthTargetAccounts.map((t) => (
                    <div key={t.id} className="p-2.5 flex items-center justify-between hover:bg-[#1E2329]">
                      <div>
                        <span className="font-semibold text-[#EAECEF]">{t.ownerName}</span>
                        <p className="text-[11px] text-[#848E9C] font-mono">{t.accountNumber} &bull; {t.ownerPhone}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold text-[#EAECEF]">{t.totalAmountDueFormatted}</span>
                        <p className="text-[10px] text-[#F6465D]">Due</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Password Challenge Field */}
              <div className="space-y-1.5 pt-2 border-t border-[#2B3139]">
                <label className="text-xs font-semibold text-[#EAECEF] flex items-center justify-between">
                  <span>Enter Administrator Security Password</span>
                  <span className="text-[10px] text-[#848E9C] font-normal">Required for authorization</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#848E9C]">
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
                    className="w-full h-10 pl-9 pr-10 rounded-lg border border-[#2B3139] text-xs text-[#EAECEF] focus:outline-none focus:border-[#FCD535] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSmsAuthPassword(!showSmsAuthPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#848E9C] hover:text-[#EAECEF] cursor-pointer"
                  >
                    {showSmsAuthPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {smsAuthError && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-[#F6465D] font-medium flex items-center gap-1 mt-1"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{smsAuthError}</span>
                  </motion.p>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#2B3139]">
                <button
                  type="button"
                  onClick={() => {
                    setShowSmsAuthModal(false);
                    setSmsAuthPassword("");
                    setSmsAuthError(null);
                  }}
                  disabled={isProcessing}
                  className="btn-3d-secondary h-11 sm:h-9 px-4 rounded-lg text-xs font-medium cursor-pointer flex-1 sm:flex-none"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteSmsDispatch}
                  disabled={isProcessing || !smsAuthPassword.trim()}
                  className="btn-3d-primary h-11 sm:h-9 px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 flex-1 sm:flex-none"
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
