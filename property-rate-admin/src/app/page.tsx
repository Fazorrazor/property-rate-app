"use client";

import { useState, useEffect, useRef, useMemo } from "react";
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
} from "lucide-react";
import {
  getAdminOverview,
  getRatepayersList,
  getRatepayerHistory,
  getSmsRolloutLogs,
  getAuditTrailList,
  simulateSmsNoticeDispatch,
  batchDispatchSms,
  recordManualCashPayment,
  runAnnualBillingBatch,
  adminLogout,
  AdminDashboardData,
  AdminProperty,
  AdminPropertyReceipt,
  AdminRatepayerSummary,
  RatepayerHistoryDossier,
  SmsRolloutLogItem,
  AdminAuditLogItem,
} from "./actions";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { AdminDashboardSkeleton } from "@/components/Skeletons";
import { RatepayerDossierSheet } from "@/components/RatepayerDossierSheet";

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
      <div className="flex-1 flex items-center justify-center p-12 text-xs text-[#717171]">
        <Loader2 className="w-5 h-5 animate-spin text-[#612D53] mr-2" />
        <span>Loading SMS Communication Center...</span>
      </div>
    ),
  }
);

type NavTab = "REGISTRY" | "RATEPAYERS" | "SMS_CENTER" | "DEFAULTERS" | "TREASURY" | "AUDIT_LOGS";

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [propertiesList, setPropertiesList] = useState<AdminProperty[]>([]);
  const [currentPropertyPage, setCurrentPropertyPage] = useState(1);
  const [hasMoreProperties, setHasMoreProperties] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const [ratepayers, setRatepayers] = useState<AdminRatepayerSummary[]>([]);
  const [ratepayersTotal, setRatepayersTotal] = useState(0);
  const [currentRatepayerPage, setCurrentRatepayerPage] = useState(1);
  const [hasMoreRatepayers, setHasMoreRatepayers] = useState(true);
  const [isLoadingMoreRatepayers, setIsLoadingMoreRatepayers] = useState(false);
  const ratepayerTableContainerRef = useRef<HTMLDivElement>(null);
  const [smsLogs, setSmsLogs] = useState<SmsRolloutLogItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogItem[]>([]);
  const [auditLogsTotal, setAuditLogsTotal] = useState(0);
  const [currentAuditLogPage, setCurrentAuditLogPage] = useState(1);
  const [hasMoreAuditLogs, setHasMoreAuditLogs] = useState(true);
  const [isLoadingAuditLogs, setIsLoadingAuditLogs] = useState(false);
  const [auditLogSearchQuery, setAuditLogSearchQuery] = useState("");
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
      const validTabs: NavTab[] = ["REGISTRY", "RATEPAYERS", "SMS_CENTER", "DEFAULTERS", "TREASURY", "AUDIT_LOGS"];

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
  const [ratepayerSearchQuery, setRatepayerSearchQuery] = useState("");
  const [treasurySearchQuery, setTreasurySearchQuery] = useState("");
  const [treasuryMethodFilter, setTreasuryMethodFilter] = useState("ALL");
  const [isSearchingProperties, setIsSearchingProperties] = useState(false);
  const [isSearchingRatepayers, setIsSearchingRatepayers] = useState(false);
  const [municipalityFilter, setMunicipalityFilter] = useState("ALL");
  const [classificationFilter, setClassificationFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PAID" | "UNPAID">("ALL");

  const activePropertyQueryRef = useRef("");
  const activeRatepayerQueryRef = useRef("");
  const activeAuditQueryRef = useRef("");

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
    "Dear {{municipality}} Resident,\n\nDo find below your {{billYear}} Property Rate bill:\n\nValuation ID: {{accountNumber}}\n\nAmount due: GH₵ {{totalAmountDue}}\n\nView your bills: {{billLink}}\n\nPay Via *227*4362# or {{paymentLink}} with your payment reference {{accountNumber}}\n\nFor payment & enquiries kindly call 0256039385/0538702445\nDisregard if already paid. Keep receipt for verification."
  );

  const loadData = async (
    page = 1,
    query = searchQuery,
    muni = municipalityFilter,
    classification = classificationFilter,
    status = activeTab === "DEFAULTERS" ? "DEFAULTER" : statusFilter,
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
      // Discard stale responses if user cleared search in the meantime
      if (query && activePropertyQueryRef.current !== query) {
        return;
      }
      setData(overviewRes);
      setPropertiesList(overviewRes?.properties || []);
      setCurrentPropertyPage(1);
      setHasMoreProperties((overviewRes?.pagination?.page || 1) < (overviewRes?.pagination?.totalPages || 1));

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
        const [ratepayersRes, logsRes, auditRes] = await Promise.all([
          getRatepayersList(ratepayerSearchQuery, 1, 100),
          getSmsRolloutLogs(),
          getAuditTrailList("", "ALL", 1, 50),
        ]);
        if (ratepayersRes) {
          setRatepayers(ratepayersRes.ratepayers);
          setRatepayersTotal(ratepayersRes.total);
          setCurrentRatepayerPage(1);
          setHasMoreRatepayers(ratepayersRes.ratepayers.length < ratepayersRes.total);
        }
        if (logsRes) setSmsLogs(logsRes);
        if (auditRes) {
          setAuditLogs(auditRes.logs);
          setAuditLogsTotal(auditRes.total);
          setCurrentAuditLogPage(1);
          setHasMoreAuditLogs(auditRes.logs.length < auditRes.total);
        }
      } catch (err) {
        console.error("Background data fetch error:", err);
      }
    }
  };

  const loadAuditLogs = async (query = auditLogSearchQuery, actionFilter = auditLogActionFilter, page = 1, append = false) => {
    setIsLoadingAuditLogs(true);
    try {
      const res = await getAuditTrailList(query, actionFilter, page, 50);
      if (res) {
        if (append) {
          setAuditLogs((prev) => [...prev, ...res.logs]);
        } else {
          setAuditLogs(res.logs);
        }
        setAuditLogsTotal(res.total);
        setCurrentAuditLogPage(page);
        setHasMoreAuditLogs((page * 50) < res.total);
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


  // Infinite scroll loader inside Cadastre table container
  const handleTableScroll = async (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (isLoadingMore || !hasMoreProperties || isSearchingProperties) return;

    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 80) {
      setIsLoadingMore(true);
      const nextPage = currentPropertyPage + 1;
      try {
        const activeStatus = activeTab === "DEFAULTERS" ? "DEFAULTER" : statusFilter;
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
    }
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
      return;
    }
    setIsSearchingProperties(true);
    const timer = setTimeout(() => {
      loadData(1, searchQuery, municipalityFilter, classificationFilter, activeTab === "DEFAULTERS" ? "DEFAULTER" : statusFilter, false);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleClearPropertySearch = () => {
    setSearchQuery("");
    activePropertyQueryRef.current = "";
    setIsSearchingProperties(false);
    loadData(1, "", municipalityFilter, classificationFilter, activeTab === "DEFAULTERS" ? "DEFAULTER" : statusFilter, false);
  };

  // Instant server query for dropdown changes
  useEffect(() => {
    if (isInitialLoading) return;
    loadData(1, searchQuery, municipalityFilter, classificationFilter, activeTab === "DEFAULTERS" ? "DEFAULTER" : statusFilter, false);
  }, [municipalityFilter, classificationFilter, statusFilter, activeTab]);


  // Debounced background server search for Ratepayers
  useEffect(() => {
    if (isInitialLoading) return;
    activeRatepayerQueryRef.current = ratepayerSearchQuery;
    if (!ratepayerSearchQuery.trim()) {
      setIsSearchingRatepayers(false);
      return;
    }
    setIsSearchingRatepayers(true);
    const timer = setTimeout(async () => {
      try {
        const q = ratepayerSearchQuery;
        const res = await getRatepayersList(q, 1, 100);
        if (res && activeRatepayerQueryRef.current === q) {
          setRatepayers(res.ratepayers);
          setRatepayersTotal(res.total);
          setCurrentRatepayerPage(1);
          setHasMoreRatepayers(res.ratepayers.length < res.total);
        }
      } catch (err) {
        console.error("Error searching ratepayers:", err);
      } finally {
        if (activeRatepayerQueryRef.current === ratepayerSearchQuery) {
          setIsSearchingRatepayers(false);
        }
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [ratepayerSearchQuery]);

  const handleClearRatepayerSearch = () => {
    setRatepayerSearchQuery("");
    activeRatepayerQueryRef.current = "";
    setIsSearchingRatepayers(false);
    getRatepayersList("", 1, 100).then((res) => {
      if (res && activeRatepayerQueryRef.current === "") {
        setRatepayers(res.ratepayers);
        setRatepayersTotal(res.total);
        setCurrentRatepayerPage(1);
        setHasMoreRatepayers(res.ratepayers.length < res.total);
      }
    });
  };

  // Debounced background server search for Audit Trail
  useEffect(() => {
    if (isInitialLoading) return;
    activeAuditQueryRef.current = auditLogSearchQuery;
    if (!auditLogSearchQuery.trim()) return;
    const timer = setTimeout(() => {
      loadAuditLogs(auditLogSearchQuery, auditLogActionFilter, 1);
    }, 250);
    return () => clearTimeout(timer);
  }, [auditLogSearchQuery]);

  const handleClearAuditLogSearch = () => {
    setAuditLogSearchQuery("");
    activeAuditQueryRef.current = "";
    loadAuditLogs("", auditLogActionFilter, 1);
  };

  // Infinite scroll loader inside Ratepayers table container
  const handleRatepayerTableScroll = async (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (isLoadingMoreRatepayers || !hasMoreRatepayers || isSearchingRatepayers) return;

    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 80) {
      setIsLoadingMoreRatepayers(true);
      const nextPage = currentRatepayerPage + 1;
      try {
        const nextRes = await getRatepayersList(ratepayerSearchQuery, nextPage, 100);
        if (nextRes && nextRes.ratepayers.length > 0) {
          setRatepayers((prev) => {
            const existingIds = new Set(prev.map((r) => r.id));
            const newItems = nextRes.ratepayers.filter((r) => !existingIds.has(r.id));
            return [...prev, ...newItems];
          });
          setCurrentRatepayerPage(nextPage);
          setHasMoreRatepayers(ratepayers.length + nextRes.ratepayers.length < (nextRes.total || 0));
        } else {
          setHasMoreRatepayers(false);
        }
      } catch (err) {
        console.error("Error loading more ratepayers:", err);
      } finally {
        setIsLoadingMoreRatepayers(false);
      }
    }
  };


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
    const initialPreview = preview || ratepayers.find((r) => r.id === userId) || null;
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

  const handleBatchDispatchSms = async (accountNumbers?: string[], customTpl?: string, adminPassword?: string) => {
    const targets = accountNumbers || selectedIds;
    if (!targets || targets.length === 0) return { success: false, error: "No target accounts selected." };

    setIsProcessing(true);
    try {
      const res = await batchDispatchSms(targets, adminPassword, customTpl);
      if (res.success) {
        showToast(`Successfully dispatched dual-link SMS Demand Notices to ${res.dispatchedCount} accounts.`, "success");
        setSelectedIds([]);
        const updatedLogs = await getSmsRolloutLogs();
        setSmsLogs(updatedLogs);
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

    setIsProcessing(true);
    setSmsAuthError(null);
    try {
      const res = await batchDispatchSms(targetAccountNumbers, smsAuthPassword);
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

  const properties = propertiesList.length > 0 ? propertiesList : (data?.properties || []);
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
    if (!searchQuery.trim()) return properties;
    const tokens = searchQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return properties.filter((p) => {
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
  }, [properties, searchQuery]);

  // Google Instant Reactive Search for Ratepayers (Synchronous <16ms on every keystroke)
  const filteredRatepayers = useMemo(() => {
    if (!ratepayerSearchQuery.trim()) return ratepayers;
    const tokens = ratepayerSearchQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return ratepayers.filter((r) => {
      const name = (r.name || "").toLowerCase();
      const phone = (r.phoneNumber || "").toLowerCase();
      const role = (r.role || "").toLowerCase();
      const stat = (r.status || "").toLowerCase();
      const due = (r.totalDueFormatted || "").toLowerCase();
      const arrears = (r.totalArrearsFormatted || "").toLowerCase();
      const val = (r.totalValuationFormatted || "").toLowerCase();
      const date = (r.createdAtFormatted || "").toLowerCase();

      return tokens.every(
        (token) =>
          name.includes(token) ||
          phone.includes(token) ||
          role.includes(token) ||
          stat.includes(token) ||
          due.includes(token) ||
          arrears.includes(token) ||
          val.includes(token) ||
          date.includes(token)
      );
    });
  }, [ratepayers, ratepayerSearchQuery]);

  // Google Instant Reactive Search for Audit Trail (Synchronous <16ms on every keystroke)
  const filteredAuditLogs = useMemo(() => {
    if (!auditLogSearchQuery.trim()) return auditLogs;
    const tokens = auditLogSearchQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);
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
  }, [auditLogs, auditLogSearchQuery]);

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
    return allTreasuryReceipts.filter((r: any) => {
      if (
        treasuryMethodFilter !== "ALL" &&
        !r.paymentMethod.toLowerCase().includes(treasuryMethodFilter.toLowerCase())
      ) {
        return false;
      }
      if (!treasurySearchQuery.trim()) return true;
      const q = treasurySearchQuery.toLowerCase().trim();
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
  }, [allTreasuryReceipts, treasurySearchQuery, treasuryMethodFilter]);

  if (isInitialLoading) {
    return <AdminDashboardSkeleton />;
  }

  return (

    <div className="h-screen w-screen overflow-hidden bg-[#F6ECF2] text-[#2C2C2C] flex flex-row font-sans">
      {/* Sidebar Navigation */}
      <aside className="w-72 bg-white border-r border-[#DADCE0] shadow-sm flex flex-col shrink-0 h-screen z-30 font-sans">
        <div className="h-13 flex items-center px-6 border-b border-[#DADCE0] shrink-0 justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold tracking-tight text-[#612D53] select-none">KKMA Revenue</span>
          </div>
          <span className="text-[10px] text-[#717171] uppercase font-mono font-medium">Enterprise</span>
        </div>
        
        {/* Navigation Links (Zero Pills - Clean Google Enterprise Standard) */}
        <nav className="flex flex-col flex-1 px-3 py-3 gap-1 overflow-y-auto" aria-label="Main Navigation">
          <div className="px-3 pt-1 pb-1.5 text-[10px] font-semibold tracking-wider text-[#717171] uppercase font-mono select-none">
            Revenue Modules
          </div>
          {([
            { key: "REGISTRY", label: "Cadastre & Property Roll", icon: Building2 },
            { key: "RATEPAYERS", label: "Ratepayers & Citizen Dossier", icon: Users },
            { key: "SMS_CENTER", label: "SMS Bill Rollout Engine", icon: MessageSquare },
            { key: "DEFAULTERS", label: "Statutory Defaulters", icon: ShieldAlert },
            { key: "TREASURY", label: "Treasury Reconciliation", icon: Landmark },
            { key: "AUDIT_LOGS", label: "System Audit Trail", icon: ShieldCheck },
          ] as { key: NavTab; label: string; icon: any }[]).map((tab) => {
            const isActive = activeTab === tab.key;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleTabChange(tab.key)}
                className={`relative px-3 py-2.5 text-left text-xs font-medium transition-colors cursor-pointer focus:outline-none rounded-lg flex items-center justify-between group ${
                  isActive
                    ? "bg-[#612D53]/8 text-[#612D53] font-semibold"
                    : "text-[#5F6368] hover:text-[#202124] hover:bg-[#F8F9FA]"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-1">
                  <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? "text-[#612D53]" : "text-[#717171] group-hover:text-[#202124]"}`} />
                  <span className="truncate whitespace-nowrap">{tab.label}</span>
                </div>
                {isActive && (
                  <motion.div
                    layoutId="activeTabIndicatorSidebar"
                    className="absolute left-0 top-1.5 bottom-1.5 w-[3.5px] bg-[#612D53] rounded-r"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </nav>
        
        {/* User & Sign Out Footer */}
        <div className="p-3 border-t border-[#DADCE0] shrink-0 bg-[#F8F9FA]">
          <div className="px-3 py-1.5 text-xs">
            <span className="text-[#717171] block text-[10px]">Logged in Administrator</span>
            <span className="font-semibold text-[#2C2C2C] truncate block">Municipal Admin</span>
          </div>
          <button
            type="button"
            onClick={async () => {
              await adminLogout();
            }}
            className="w-full py-1.5 text-xs font-medium text-[#717171] hover:text-[#2C2C2C] hover:bg-[#F1F3F4] rounded-lg transition-colors focus:outline-none text-left px-3 cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="bg-white border-b border-[#DADCE0] shadow-sm shrink-0 h-13 font-sans">
          <div className="w-full px-6 h-full flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <select
                  value={municipalityFilter}
                  onChange={(e) => setMunicipalityFilter(e.target.value)}
                  className="text-xs font-semibold text-[#2C2C2C] bg-transparent border-none focus:outline-none cursor-pointer py-1 px-2 rounded-md transition-colors -ml-2"
                >
                  <option value="ALL">National Overview (All Assemblies)</option>
                  <option value="Kpone-Katamanso (KKMA)">Kpone-Katamanso (KKMA)</option>
                  <option value="Tema Metropolitan (TMA)">Tema Metropolitan (TMA)</option>
                  <option value="Accra Metropolitan (AMA)">Accra Metropolitan (AMA)</option>
                  <option value="Ashaiman Municipal (ASHMA)">Ashaiman Municipal (ASHMA)</option>
                  <option value="Ga East Municipal (GEMA)">Ga East Municipal (GEMA)</option>
                </select>
                <span className="text-xs text-[#DADCE0]">|</span>
                <span className="text-xs text-[#717171] font-normal">
                  Property Rate Revenue Directorate &bull; Act 936
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowBatchModal(true)}
                className="btn-3d-secondary h-8 px-3 rounded-md text-[#612D53] font-medium text-xs flex items-center gap-1.5 cursor-pointer focus:outline-none"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#612D53]" />
                <span>Annual Batch Billing Rollout</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Dashboard Workspace (Viewport Fitted & Full-Bleed for SMS Engine) */}
        <main className={`flex-1 min-h-0 w-full flex flex-col overflow-hidden ${
          activeTab === "SMS_CENTER"
            ? "p-0 max-w-none"
            : "px-6 py-3 max-w-7xl mx-auto gap-3"
        }`}>
          {/* Top KPI Cards (Zero Pills - High Density Compact Single Row) */}
          {(activeTab === "REGISTRY" || activeTab === "DEFAULTERS") && (
            <section aria-label="Executive KPIs" className="shrink-0">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Total Assessed Demand */}
                <div className="px-4 py-2.5 bg-white border border-[#DADCE0] rounded-xl hover:border-[#BDC1C6] transition-colors flex items-center justify-between shadow-xs">
                  <div>
                    <span className="text-[11px] text-[#717171] font-medium block">Total Assessed Demand</span>
                    <span className="text-lg font-bold text-[#2C2C2C] tracking-tight">{metrics.totalBilledFormatted}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-[#717171] block font-mono">FY 2025</span>
                    <span className="text-[10px] text-[#717171]">{(data?.pagination?.total ?? metrics.totalProperties).toLocaleString()} accounts</span>
                  </div>
                </div>

                {/* 2. Revenue Collected */}
                <div className="px-4 py-2.5 bg-white border border-[#DADCE0] rounded-xl hover:border-[#BDC1C6] transition-colors flex items-center justify-between shadow-xs">
                  <div>
                    <span className="text-[11px] text-[#717171] font-medium block">Revenue Collected</span>
                    <span className="text-lg font-bold text-[#188038] tracking-tight">{metrics.totalCollectedFormatted}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-[#717171] block font-mono">Efficiency</span>
                    <span className="text-[11px] font-semibold text-[#188038]">{metrics.collectionRateFormatted}</span>
                  </div>
                </div>

                {/* 3. Cumulative Arrears */}
                <div className="px-4 py-2.5 bg-white border border-[#DADCE0] rounded-xl hover:border-[#BDC1C6] transition-colors flex items-center justify-between shadow-xs">
                  <div>
                    <span className="text-[11px] text-[#717171] font-medium block">Cumulative Arrears</span>
                    <span className="text-lg font-bold text-[#D93025] tracking-tight">{metrics.totalArrearsFormatted}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-[#717171] block font-mono">Prior Debt</span>
                    <span className="text-[10px] text-[#717171]">Act 936</span>
                  </div>
                </div>

                {/* 4. Statutory Defaulters */}
                <div className="px-4 py-2.5 bg-white border border-[#DADCE0] rounded-xl hover:border-[#BDC1C6] transition-colors flex items-center justify-between shadow-xs">
                  <div>
                    <span className="text-[11px] text-[#717171] font-medium block">Statutory Defaulters</span>
                    <span className="text-lg font-bold text-[#2C2C2C] tracking-tight">{metrics.defaultersCount.toLocaleString()}</span>
                  </div>
                  <div className="text-right">
                    <span className={`text-[10px] font-semibold block ${metrics.defaultersCount > 0 ? "text-[#D93025]" : "text-[#188038]"}`}>
                      {metrics.defaultersCount > 0 ? "Recovery Active" : "Compliant"}
                    </span>
                    <span className="text-[10px] text-[#612D53] hover:underline cursor-pointer" onClick={() => handleTabChange("DEFAULTERS")}>
                      Inspect
                    </span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* TAB 1 & TAB 4: CADASTRE & VALUATION ROLL / DEFAULTERS */}
          {(activeTab === "REGISTRY" || activeTab === "DEFAULTERS") && (
            <section className="bg-white border border-[#DADCE0] rounded-xl shadow-sm flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="p-3.5 border-b border-[#DADCE0] space-y-2.5 shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-[#2C2C2C]">
                      {activeTab === "DEFAULTERS"
                        ? "Statutory Defaulters Watchlist"
                        : "Municipal Property Cadastre & Valuation Roll"}
                    </h2>
                    <p className="text-xs text-[#717171] mt-0.5">
                      {activeTab === "DEFAULTERS"
                        ? "Accounts in arrears past June 30 statutory settlement deadline under Act 936"
                        : "Master register of municipal property accounts, GhanaPost GPS codes, and rating valuations"}
                    </p>
                  </div>

                  <div className="text-xs text-[#717171] font-medium hidden sm:block">
                    {activeTab === "DEFAULTERS"
                      ? `${metrics.defaultersCount.toLocaleString()} defaulters on record`
                      : `${(data?.pagination?.total ?? propertiesList.length).toLocaleString()} properties on record`}
                  </div>
                </div>

                {/* Filter & Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#F1F3F4]">
                  {/* Search */}
                  <div className="relative flex items-center flex-1 max-w-md min-w-[260px]">
                    {isSearchingProperties ? (
                      <Loader2 className="w-4 h-4 text-[#612D53] animate-spin absolute left-3 pointer-events-none" />
                    ) : (
                      <Search className="w-4 h-4 text-[#717171] absolute left-3 pointer-events-none" />
                    )}
                    <input
                      type="text"
                      placeholder="Search Account ID, Valuation No, Ratepayer, Phone, GPS (e.g. GK-0010), Landmark, Receipt..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") handleClearPropertySearch();
                      }}
                      className="w-full h-8 pl-9 pr-8 rounded-lg border border-[#DADCE0] bg-white text-xs text-[#2C2C2C] placeholder:text-[#80868B] focus:border-[#612D53] focus:outline-none transition-colors"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={handleClearPropertySearch}
                        className="absolute right-2 text-[#717171] hover:text-[#2C2C2C] p-1 cursor-pointer"
                        title="Clear search"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Dropdowns */}
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={classificationFilter}
                      onChange={(e) => setClassificationFilter(e.target.value)}
                      className="h-8 px-2.5 rounded-lg border border-[#DADCE0] bg-white text-xs text-[#2C2C2C] focus:outline-none focus:border-[#612D53]"
                    >
                      <option value="ALL">All Classifications</option>
                      <option value="COMMERCIAL MIXED USE">Commercial Mixed Use</option>
                      <option value="PRIVATE THIRD CLASS RESIDENTIAL">Third Class Residential</option>
                      <option value="FIRST CLASS RESIDENTIAL">First Class Residential</option>
                    </select>


                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as any)}
                      className="h-8 px-2.5 rounded-lg border border-[#DADCE0] bg-white text-xs text-[#2C2C2C] focus:outline-none focus:border-[#612D53]"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="UNPAID">Unpaid</option>
                      <option value="PAID">Paid</option>
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
                      className="btn-3d-secondary h-8 px-3 rounded-lg font-medium text-xs flex items-center gap-1.5 cursor-pointer shrink-0 text-[#612D53] border-[#612D53]/30"
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
              </div>

              {/* Selection Action Bar */}
              <AnimatePresence>
                {selectedIds.length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="bg-[#F6ECF2] border-b border-[#EAD6E3] px-4 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs shrink-0"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[#612D53]">
                        {selectedIds.length} {selectedIds.length === 1 ? "property" : "properties"} selected
                      </span>

                      {selectedPaidList.length > 0 && selectedUnpaidList.length > 0 && (
                        <span className="text-[#717171] font-normal">
                          ({selectedUnpaidList.length} with balance due, {selectedPaidList.length} settled)
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => setSelectedIds([])}
                        className="text-xs text-[#717171] hover:text-[#2C2C2C] underline cursor-pointer ml-1"
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

                        <span className="text-xs text-[#137333] font-medium flex items-center gap-1">
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
                className="w-full flex-1 min-h-0 overflow-y-auto overflow-x-auto"
              >
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#F8F9FA] border-b border-[#DADCE0] text-[#717171] font-semibold text-[11px] sticky top-0 z-10 shadow-xs">
                    <tr>
                      <th className="py-2.5 px-3 text-center w-8 bg-[#F8F9FA]">
                        <input
                          type="checkbox"
                          checked={selectedIds.length === filteredProperties.length && filteredProperties.length > 0}
                          onChange={toggleSelectAll}
                          className="rounded border-[#DADCE0] text-[#612D53] focus:ring-0 cursor-pointer"
                        />
                      </th>
                      <th className="py-2.5 px-3 bg-[#F8F9FA] min-w-[160px]">Account &amp; Cadastre</th>
                      <th className="py-2.5 px-3 bg-[#F8F9FA] min-w-[160px]">Ratepayer Particulars</th>
                      <th className="py-2.5 px-3 bg-[#F8F9FA] min-w-[150px]">Classification</th>
                      <th className="py-2.5 px-3 text-right bg-[#F8F9FA] whitespace-nowrap min-w-[130px]">Rateable Value</th>
                      <th className="py-2.5 px-3 text-right bg-[#F8F9FA] whitespace-nowrap min-w-[160px]">Total Assessment Due</th>
                      <th className="py-2.5 px-3 text-center bg-[#F8F9FA] whitespace-nowrap min-w-[100px]">Status</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#E8EAED] bg-white">
                    {filteredProperties.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-[#717171] font-normal">
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
                            className={`hover:bg-[#F8F9FA] transition-colors cursor-pointer ${
                              selectedAccount?.id === prop.id ? "bg-[#F6ECF2]" : ""
                            }`}
                          >
                            <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectRow(prop.accountNumber)}
                                className="rounded border-[#DADCE0] text-[#612D53] focus:ring-0 cursor-pointer"
                              />
                            </td>
                            <td className="py-2.5 px-3">
                              <p className="font-semibold text-[#2C2C2C]">{prop.accountNumber}</p>
                              <p className="text-[#717171] text-[11px] mt-0.5">{prop.ownerDigitalAddress} &bull; {prop.municipality}</p>
                            </td>
                            <td className="py-2.5 px-3">
                              <p className="font-medium text-[#2C2C2C]">{prop.ownerName}</p>
                              <p className="text-[#717171] text-[11px] mt-0.5">{prop.ownerPhone}</p>
                            </td>
                            <td className="py-2.5 px-3 text-[#717171]">
                              {prop.propertyClassification}
                            </td>
                            <td className="py-2.5 px-3 text-right font-medium text-[#2C2C2C] whitespace-nowrap tabular-nums">
                              {prop.rateableValueFormatted}
                            </td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap tabular-nums">
                              <p className="font-semibold text-[#2C2C2C] whitespace-nowrap tabular-nums">{prop.totalAmountDueFormatted}</p>
                              {prop.arrears > 0 && (
                                <p className="text-[#D93025] text-[11px] mt-0.5 whitespace-nowrap tabular-nums">Arrears: {prop.arrearsFormatted}</p>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              <span
                                className={`text-xs font-medium ${
                                  isPaid
                                    ? "text-[#188038]"
                                    : prop.status === "PARTIALLY_PAID"
                                    ? "text-[#E37400]"
                                    : "text-[#D93025]"
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
                      <tr>
                        <td colSpan={7} className="py-3 text-center bg-[#F8F9FA]/40">
                          <div className="flex items-center justify-center">
                            <Loader2 className="w-4 h-4 animate-spin text-[#612D53]" />
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Static Grounded Table Status Bar */}
              <div className="px-4 py-2 border-t border-[#DADCE0] bg-[#F8F9FA] flex items-center justify-between text-xs text-[#717171] shrink-0">
                <span>
                  {(data?.pagination?.total ?? propertiesList.length).toLocaleString()} properties on record &bull; {filteredProperties.length} loaded
                </span>
                <span className="text-[11px] text-[#717171]">
                  {hasMoreProperties ? "Scroll inside table to load more automatically" : "All records loaded"}
                </span>
              </div>
            </section>
          )}

          {/* TAB 2: RATEPAYERS & USER HISTORY DIRECTORY */}
          {activeTab === "RATEPAYERS" && (
            <section className="bg-white border border-[#DADCE0] rounded-xl shadow-sm flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="p-3.5 border-b border-[#DADCE0] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                <div>
                  <h2 className="text-base font-semibold text-[#2C2C2C]">
                    Ratepayers &amp; Citizen Dossier Directory
                  </h2>
                  <p className="text-xs text-[#717171] mt-0.5">
                    Search and inspect complete citizen profiles, multi-property portfolios, billing histories, and SMS audits.
                  </p>
                </div>

                <div className="relative flex items-center flex-1 max-w-md min-w-[260px]">
                  {isSearchingRatepayers ? (
                    <Loader2 className="w-4 h-4 text-[#612D53] animate-spin absolute left-3 pointer-events-none" />
                  ) : (
                    <Search className="w-4 h-4 text-[#717171] absolute left-3 pointer-events-none" />
                  )}
                  <input
                    type="text"
                    placeholder="Search Ratepayer Name, Phone, Account ID, GPS Address, Municipality..."
                    value={ratepayerSearchQuery}
                    onChange={(e) => setRatepayerSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") handleClearRatepayerSearch();
                    }}
                    className="w-full h-8 pl-9 pr-8 rounded-lg border border-[#DADCE0] bg-white text-xs text-[#2C2C2C] placeholder:text-[#80868B] focus:border-[#612D53] focus:outline-none transition-colors"
                  />
                  {ratepayerSearchQuery && (
                    <button
                      type="button"
                      onClick={handleClearRatepayerSearch}
                      className="absolute right-2 text-[#717171] hover:text-[#2C2C2C] p-1 cursor-pointer"
                      title="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div
                ref={ratepayerTableContainerRef}
                onScroll={handleRatepayerTableScroll}
                className={`w-full flex-1 min-h-0 overflow-y-auto overflow-x-auto transition-opacity duration-200 ${isSearchingRatepayers ? "opacity-60" : "opacity-100"}`}
              >
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#F8F9FA] border-b border-[#DADCE0] text-[#717171] font-semibold text-[11px] sticky top-0 z-10 shadow-xs">
                    <tr>
                      <th className="py-2.5 px-4 bg-[#F8F9FA] min-w-[180px]">Ratepayer Name &amp; Role</th>
                      <th className="py-2.5 px-4 bg-[#F8F9FA] whitespace-nowrap min-w-[120px]">Telephone</th>
                      <th className="py-2.5 px-4 text-center bg-[#F8F9FA] whitespace-nowrap min-w-[120px]">Properties Linked</th>
                      <th className="py-2.5 px-4 text-right bg-[#F8F9FA] whitespace-nowrap min-w-[140px]">Total Valuation</th>
                      <th className="py-2.5 px-4 text-right bg-[#F8F9FA] whitespace-nowrap min-w-[160px]">Total Assessment Due</th>
                      <th className="py-2.5 px-4 text-center bg-[#F8F9FA] whitespace-nowrap min-w-[130px]">Status</th>
                      <th className="py-2.5 px-4 text-right bg-[#F8F9FA] whitespace-nowrap min-w-[100px]">Action</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#E8EAED] bg-white">
                    {filteredRatepayers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-[#717171] font-normal italic">
                          No ratepayer records found matching query.
                        </td>
                      </tr>
                    ) : (
                      filteredRatepayers.map((ratepayer) => (
                        <tr
                          key={ratepayer.id}
                          onClick={() => handleOpenRatepayerDossier(ratepayer.id, ratepayer)}
                          className="hover:bg-[#F8F9FA] transition-colors cursor-pointer"
                        >
                          <td className="py-2.5 px-4 font-semibold text-[#2C2C2C]">
                            <span>{ratepayer.name}</span>
                            <span className="text-[11px] text-[#717171] font-normal block mt-0.5">
                              {ratepayer.role} &bull; Registered {ratepayer.createdAtFormatted}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 font-mono text-[#717171] whitespace-nowrap">
                            {ratepayer.phoneNumber}
                          </td>
                          <td className="py-2.5 px-4 text-center font-medium text-[#2C2C2C] whitespace-nowrap">
                            {ratepayer.propertyCount} {ratepayer.propertyCount === 1 ? "property" : "properties"}
                          </td>
                          <td className="py-2.5 px-4 text-right text-[#2C2C2C] font-medium whitespace-nowrap tabular-nums">
                            {ratepayer.totalValuationFormatted}
                          </td>
                          <td className="py-2.5 px-4 text-right whitespace-nowrap tabular-nums">
                            <span className="font-semibold text-[#2C2C2C] whitespace-nowrap tabular-nums">{ratepayer.totalDueFormatted}</span>
                            {ratepayer.totalArrearsFormatted !== "GH₵ 0.00" && (
                              <span className="text-[#D93025] text-[11px] block mt-0.5 whitespace-nowrap tabular-nums">
                                Arrears: {ratepayer.totalArrearsFormatted}
                              </span>
                            )}
                          </td>

                          <td className="py-2.5 px-4 text-center whitespace-nowrap">
                            <span
                              className={`font-semibold ${
                                ratepayer.status === "SETTLED"
                                  ? "text-[#188038]"
                                  : ratepayer.status === "DEFAULTER"
                                  ? "text-[#D93025]"
                                  : ratepayer.status === "OUTSTANDING"
                                  ? "text-[#E37400]"
                                  : "text-[#717171] font-normal"
                              }`}
                            >
                              {ratepayer.status === "SETTLED"
                                ? "• Settled"
                                : ratepayer.status === "DEFAULTER"
                                ? "• Defaulter"
                                : ratepayer.status === "OUTSTANDING"
                                ? "• Balance Due"
                                : "• No Properties Linked"}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenRatepayerDossier(ratepayer.id, ratepayer);
                              }}
                              className="text-xs text-[#612D53] hover:underline font-semibold cursor-pointer"
                            >
                              View History &rarr;
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Ratepayers Status Bar */}
              <div className="px-4 py-2 border-t border-[#DADCE0] bg-[#F8F9FA] flex items-center justify-between text-xs text-[#717171] shrink-0">
                <span>{(ratepayersTotal || ratepayers.length).toLocaleString()} ratepayers registered in municipal directory</span>
                <span className="text-[11px] text-[#717171] flex items-center gap-1.5">
                  {isLoadingMoreRatepayers && <Loader2 className="w-3 h-3 animate-spin text-[#612D53]" />}
                  <span>{filteredRatepayers.length} loaded of {(ratepayersTotal || ratepayers.length)}</span>
                </span>
              </div>
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
              />
            </div>
          )}

          {/* TAB 5: TREASURY RECONCILIATION */}
          {activeTab === "TREASURY" && (
            <section className="bg-white border border-[#DADCE0] rounded-xl shadow-sm flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="p-3.5 border-b border-[#DADCE0] flex flex-col gap-3 shrink-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-[#2C2C2C]">Municipal Treasury Collections &amp; GCR Audit Log</h2>
                    <p className="text-xs text-[#717171] mt-0.5">
                      Real-time transaction logs of all rate payments settled across Mobile Money, Card, and Counter Cash Treasury.
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-[#188038]">
                    Total Reconciled: {metrics.totalCollectedFormatted}
                  </span>
                </div>

                {/* Treasury Dynamic Search & Filter Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#F1F3F4]">
                  <div className="relative flex items-center flex-1 max-w-md min-w-[260px]">
                    <Search className="w-4 h-4 text-[#717171] absolute left-3 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search Receipt / GCR No., Account ID, Ratepayer, Channel, Date..."
                      value={treasurySearchQuery}
                      onChange={(e) => setTreasurySearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") setTreasurySearchQuery("");
                      }}
                      className="w-full h-8 pl-9 pr-8 rounded-lg border border-[#DADCE0] bg-white text-xs text-[#2C2C2C] placeholder:text-[#80868B] focus:border-[#612D53] focus:outline-none transition-colors"
                    />
                    {treasurySearchQuery && (
                      <button
                        type="button"
                        onClick={() => setTreasurySearchQuery("")}
                        className="absolute right-2 text-[#717171] hover:text-[#2C2C2C] p-1 cursor-pointer"
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
                      className="h-8 px-2.5 rounded-lg border border-[#DADCE0] bg-white text-xs text-[#2C2C2C] focus:outline-none focus:border-[#612D53]"
                    >
                      <option value="ALL">All Payment Channels</option>
                      <option value="Mobile Money">Mobile Money (MTN / Telecel)</option>
                      <option value="Card">Card / Online Gateway</option>
                      <option value="Counter Cash">Counter Cash Treasury</option>
                    </select>
                    <span className="text-xs text-[#717171] font-medium">
                      {filteredTreasuryReceipts.length} record{filteredTreasuryReceipts.length === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="w-full flex-1 min-h-0 overflow-y-auto overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#F8F9FA] border-b border-[#DADCE0] text-[#717171] font-semibold text-[11px] sticky top-0 z-10 shadow-xs">
                    <tr>
                      <th className="py-2.5 px-3 bg-[#F8F9FA] whitespace-nowrap min-w-[130px]">Receipt Reference</th>
                      <th className="py-2.5 px-3 bg-[#F8F9FA] min-w-[160px]">Account Head &amp; Ratepayer</th>
                      <th className="py-2.5 px-3 bg-[#F8F9FA] whitespace-nowrap min-w-[110px]">Settlement Date</th>
                      <th className="py-2.5 px-3 bg-[#F8F9FA] whitespace-nowrap min-w-[140px]">Payment Channel</th>
                      <th className="py-2.5 px-3 text-right bg-[#F8F9FA] whitespace-nowrap min-w-[130px]">Amount Settled</th>
                      <th className="py-2.5 px-3 text-center bg-[#F8F9FA] whitespace-nowrap min-w-[110px]">Audit Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8EAED] bg-white">
                    {filteredTreasuryReceipts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-[#717171] italic font-normal">
                          No treasury receipts match your search query.
                        </td>
                      </tr>
                    ) : (
                      filteredTreasuryReceipts.map((receipt) => (
                        <tr key={receipt.id} className="hover:bg-[#F8F9FA] transition-colors">
                          <td className="py-2.5 px-3 font-semibold text-[#2C2C2C] whitespace-nowrap">
                            {receipt.receiptNumber}
                          </td>
                          <td className="py-2.5 px-3 text-[#717171]">
                            <span className="font-mono font-medium text-[#2C2C2C]">{receipt.accountNumber}</span>
                            {receipt.ownerName && <p className="text-[11px] text-[#717171]">{receipt.ownerName}</p>}
                          </td>
                          <td className="py-2.5 px-3 text-[#717171] whitespace-nowrap">
                            {receipt.datePaid}
                          </td>
                          <td className="py-2.5 px-3 text-[#2C2C2C] whitespace-nowrap">
                            {receipt.paymentMethod}
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold text-[#188038] whitespace-nowrap tabular-nums">
                            {receipt.amountFormatted}
                          </td>
                          <td className="py-2.5 px-3 text-center font-medium text-[#188038] whitespace-nowrap">
                            &bull; Reconciled
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Treasury Status Bar */}
              <div className="px-4 py-2 border-t border-[#DADCE0] bg-[#F8F9FA] flex items-center justify-between text-xs text-[#717171] shrink-0">
                <span>Value Book &amp; GCR Reconciled Ledger</span>
                <span>{filteredTreasuryReceipts.length} entries shown</span>
              </div>
            </section>
          )}

          {/* TAB: SYSTEM AUDIT TRAIL */}
          {activeTab === "AUDIT_LOGS" && (
            <section className="flex-1 flex flex-col min-h-0 bg-white border border-[#DADCE0] rounded-xl shadow-xs overflow-hidden">
              {/* Audit Header Bar */}
              <div className="px-6 py-4 border-b border-[#DADCE0] flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 bg-white">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-[#2C2C2C] tracking-tight">
                      Municipal Revenue Directorate — Master Audit Trail
                    </h2>
                    <span className="text-xs text-[#188038] font-medium">&bull; Immutable Ledger</span>
                  </div>
                  <p className="text-xs text-[#717171] mt-0.5">
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
                    className="btn-3d-secondary h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer text-[#612D53] border-[#612D53]/30"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Audit Log (CSV)</span>
                  </button>
                </div>
              </div>

              {/* Filter Toolbar */}
              <div className="px-6 py-2.5 bg-[#F8F9FA] border-b border-[#DADCE0] flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3 flex-1 min-w-[280px]">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#717171]" />
                    <input
                      type="text"
                      placeholder="Search by action, narrative, administrator, or reference..."
                      value={auditLogSearchQuery}
                      onChange={(e) => setAuditLogSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") handleClearAuditLogSearch();
                      }}
                      className="w-full pl-8 pr-8 py-1.5 bg-white border border-[#DADCE0] rounded-lg text-xs text-[#2C2C2C] focus:outline-none focus:border-[#612D53]"
                    />
                    {auditLogSearchQuery && (
                      <button
                        type="button"
                        onClick={handleClearAuditLogSearch}
                        className="absolute right-2.5 top-2 text-[#717171] hover:text-[#2C2C2C] p-0.5 cursor-pointer"
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
                    className="h-8 px-3 bg-white border border-[#DADCE0] rounded-lg text-xs text-[#2C2C2C] focus:outline-none focus:border-[#612D53] cursor-pointer"
                  >
                    <option value="ALL">All Recorded Actions</option>
                    <option value="RECORD_PAYMENT">Cash Settlements (RECORD_PAYMENT)</option>
                    <option value="BATCH_BILLING">Annual Billing Rollouts (BATCH_BILLING)</option>
                    <option value="BATCH_SMS_DISPATCH">SMS Batch Notices (BATCH_SMS_DISPATCH)</option>
                    <option value="EDIT_PROPERTY">Property Valuation Edits (EDIT_PROPERTY)</option>
                    <option value="CREATE_PROPERTY">Parcel Registrations (CREATE_PROPERTY)</option>
                  </select>
                </div>

                <div className="text-xs text-[#717171] font-medium">
                  {auditLogsTotal} event{auditLogsTotal === 1 ? "" : "s"} logged
                </div>
              </div>

              {/* Table Container */}
              <div
                ref={auditLogTableContainerRef}
                className="w-full flex-1 min-h-0 overflow-y-auto overflow-x-auto"
              >
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#F8F9FA] border-b border-[#DADCE0] text-[#717171] font-semibold text-[11px] sticky top-0 z-10 shadow-xs">
                    <tr>
                      <th className="py-2.5 px-4 bg-[#F8F9FA] whitespace-nowrap min-w-[140px]">Date &amp; Time</th>
                      <th className="py-2.5 px-4 bg-[#F8F9FA] whitespace-nowrap min-w-[190px]">Administrative Action</th>
                      <th className="py-2.5 px-4 bg-[#F8F9FA] whitespace-nowrap min-w-[130px]">Target Entity</th>
                      <th className="py-2.5 px-4 bg-[#F8F9FA] whitespace-nowrap min-w-[170px]">Authorized Actor</th>
                      <th className="py-2.5 px-4 bg-[#F8F9FA] min-w-[280px]">Audit Narrative &amp; Scope</th>
                      <th className="py-2.5 px-4 text-center bg-[#F8F9FA] whitespace-nowrap min-w-[120px]">Tamper Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8EAED] bg-white font-sans">
                    {filteredAuditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-[#717171] italic">
                          {isLoadingAuditLogs ? "Loading system audit events..." : "No audit trail records found matching your filter."}
                        </td>
                      </tr>
                    ) : (
                      filteredAuditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-[#F8F9FA] transition-colors">
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            <span className="font-medium text-[#2C2C2C]">{log.createdAtFormatted}</span>
                            <span className="text-[11px] text-[#717171] block font-mono">{log.timeFormatted}</span>
                          </td>
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            <span className="flex items-center gap-1.5 font-medium text-[#2C2C2C]">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: log.actionBadgeColor }}
                              />
                              {log.actionLabel}
                            </span>
                            <span className="text-[10px] text-[#717171] font-mono block pl-3.5">{log.action}</span>
                          </td>
                          <td className="py-2.5 px-4 whitespace-nowrap text-[#717171]">
                            <span className="font-medium text-[#2C2C2C]">{log.entityType}</span>
                            {log.entityId && (
                              <span className="text-[11px] text-[#717171] font-mono block truncate max-w-[120px]">
                                #{log.entityId}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            <span className="font-semibold text-[#2C2C2C]">{log.adminName}</span>
                            <span className="text-[11px] text-[#717171] block">{log.adminRole}</span>
                          </td>
                          <td className="py-2.5 px-4 text-[#2C2C2C] leading-relaxed">
                            {log.details}
                          </td>
                          <td className="py-2.5 px-4 text-center whitespace-nowrap">
                            <span className="text-[11px] font-medium text-[#188038]">
                              &bull; Verified Immutable
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Status Bar */}
              <div className="px-4 py-2 border-t border-[#DADCE0] bg-[#F8F9FA] flex items-center justify-between text-xs text-[#717171] shrink-0">
                <span>Local Governance Act, 2016 (Act 936) &bull; Official Treasury Audit Log</span>
                <span>{auditLogs.length} of {auditLogsTotal} records shown</span>
              </div>
            </section>
          )}
        </main>

        {/* Static Grounded Footer */}
        <footer className="shrink-0 h-8 bg-white border-t border-[#DADCE0] px-6 flex items-center justify-between text-[11px] text-[#717171] font-sans">
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
              className="relative z-10 w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-[#DADCE0] font-sans"
            >
              <div className="px-6 py-4 border-b border-[#DADCE0] flex items-center justify-between shrink-0 bg-white">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#717171] font-semibold uppercase tracking-wider">
                      Property Assessment Dossier
                    </span>
                    <span
                      className={`text-[11px] font-semibold ${
                        selectedAccount.status === "PAID"
                          ? "text-[#188038]"
                          : selectedAccount.status === "PARTIALLY_PAID"
                          ? "text-[#E37400]"
                          : "text-[#D93025]"
                      }`}
                    >
                      &bull; {selectedAccount.status === "PAID" ? "Settled" : selectedAccount.status === "PARTIALLY_PAID" ? "Partial" : "Unpaid Demand"}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-[#2C2C2C] mt-0.5">
                    {selectedAccount.accountNumber}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedAccount(null)}
                  className="p-1.5 rounded-lg text-[#717171] hover:text-[#2C2C2C] transition-colors cursor-pointer"
                  aria-label="Close dossier"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 text-xs divide-y divide-[#E8EAED]">
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-[#2C2C2C] uppercase tracking-wider">
                    Ratepayer &amp; Cadastre Location
                  </h4>
                  <dl className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs">
                    <div>
                      <dt className="text-[#717171]">Account Head (Owner)</dt>
                      <dd className="font-medium text-[#2C2C2C] mt-0.5">{selectedAccount.ownerName}</dd>
                    </div>
                    <div>
                      <dt className="text-[#717171]">Telephone No.</dt>
                      <dd className="font-medium text-[#2C2C2C] mt-0.5">{selectedAccount.ownerPhone}</dd>
                    </div>
                    <div>
                      <dt className="text-[#717171]">GhanaPost GPS Code</dt>
                      <dd className="font-mono font-medium text-[#2C2C2C] mt-0.5">{selectedAccount.ownerDigitalAddress}</dd>
                    </div>
                    <div>
                      <dt className="text-[#717171]">Assembly (MMDA)</dt>
                      <dd className="font-medium text-[#2C2C2C] mt-0.5">{selectedAccount.municipality}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-[#717171]">Zoning Classification</dt>
                      <dd className="font-medium text-[#2C2C2C] mt-0.5">{selectedAccount.propertyClassification}</dd>
                    </div>
                  </dl>
                </div>

                <div className="pt-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-[#2C2C2C] uppercase tracking-wider">
                      Valuation &amp; Statement of Account
                    </h4>
                    <span className="text-xs text-[#717171]">FY {selectedAccount.billYear}</span>
                  </div>

                  <dl className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-[#F1F3F4]">
                      <dt className="text-[#717171]">Rateable Valuation Roll</dt>
                      <dd className="font-medium text-[#2C2C2C] whitespace-nowrap tabular-nums">{selectedAccount.rateableValueFormatted}</dd>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#F1F3F4]">
                      <dt className="text-[#717171]">Rate Imposed</dt>
                      <dd className="text-[#2C2C2C] whitespace-nowrap tabular-nums">{selectedAccount.rateImposed}</dd>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#F1F3F4]">
                      <dt className="text-[#717171]">Previous Year Assessment</dt>
                      <dd className="text-[#2C2C2C] whitespace-nowrap tabular-nums">{selectedAccount.previousYearBillFormatted}</dd>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#F1F3F4]">
                      <dt className="text-[#717171]">Carried Cumulative Arrears</dt>
                      <dd className={`font-medium whitespace-nowrap tabular-nums ${selectedAccount.arrears > 0 ? "text-[#D93025]" : "text-[#2C2C2C]"}`}>
                        {selectedAccount.arrearsFormatted}
                      </dd>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#F1F3F4]">
                      <dt className="text-[#717171]">2025 Current Rate Assessment</dt>
                      <dd className="font-medium text-[#2C2C2C] whitespace-nowrap tabular-nums">{selectedAccount.currentFeeFormatted}</dd>
                    </div>
                    <div className="flex justify-between pt-2 text-sm font-semibold">
                      <dt className="text-[#2C2C2C]">Total Amount Due</dt>
                      <dd className="text-[#2C2C2C] whitespace-nowrap tabular-nums">{selectedAccount.totalAmountDueFormatted}</dd>
                    </div>
                  </dl>
                </div>

                <div className="pt-5 space-y-3">
                  <h4 className="text-xs font-semibold text-[#2C2C2C] uppercase tracking-wider">
                    GCR Receipt Trail ({selectedAccount.receipts.length})
                  </h4>
                  {selectedAccount.receipts.length === 0 ? (
                    <p className="text-[#717171] text-xs py-2 italic">No payments recorded for this assessment cycle.</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedAccount.receipts.map((r) => (
                        <div
                          key={r.id}
                          className="p-3 rounded-lg bg-[#F8F9FA] border border-[#DADCE0] flex items-center justify-between text-xs"
                        >
                          <div>
                            <p className="font-semibold text-[#2C2C2C]">{r.receiptNumber}</p>
                            <p className="text-[#717171] text-[11px] mt-0.5">{r.paymentMethod} &bull; {r.datePaid}</p>
                          </div>
                          <span className="font-semibold text-[#188038]">{r.amountFormatted}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="px-6 py-3.5 border-t border-[#DADCE0] bg-white flex items-center justify-between gap-2 shrink-0">
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-[#DADCE0] shadow-2xl p-6 max-w-md w-full space-y-4 font-sans"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[#F1F3F4]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#F6ECF2] text-[#612D53] flex items-center justify-center">
                    <RefreshCw className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#2C2C2C]">
                      Annual Batch Billing Rollout
                    </h3>
                    <p className="text-xs text-[#717171]">Statutory Assessment Cycle</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBatchModal(false)}
                  className="text-[#717171] hover:text-[#2C2C2C] p-1 rounded-lg cursor-pointer"
                  aria-label="Close modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-[#F6ECF2] text-xs text-[#2C2C2C] space-y-2">
                <p className="font-semibold text-[#612D53]">
                  Execute Annual Rollout for {properties.length} Properties
                </p>
                <div className="space-y-3 pt-2">
                  <div className="space-y-1">
                    <label className="text-[#717171] font-medium block">Residential Rate Factor</label>
                    <input
                      type="number"
                      step="0.001"
                      value={residentialRate}
                      onChange={(e) => setResidentialRate(e.target.value)}
                      className="w-full h-9 px-3 rounded-md border border-[#DADCE0] text-xs focus:outline-none focus:border-[#612D53]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[#717171] font-medium block">Commercial Rate Factor</label>
                    <input
                      type="number"
                      step="0.001"
                      value={commercialRate}
                      onChange={(e) => setCommercialRate(e.target.value)}
                      className="w-full h-9 px-3 rounded-md border border-[#DADCE0] text-xs focus:outline-none focus:border-[#612D53]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[#717171] font-medium block">Statutory Due Date</label>
                    <input
                      type="text"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full h-9 px-3 rounded-md border border-[#DADCE0] text-xs focus:outline-none focus:border-[#612D53]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[#717171] font-medium block">Dual-Link SMS Notice Template</label>
                    <textarea
                      value={messageTemplate}
                      onChange={(e) => setMessageTemplate(e.target.value)}
                      rows={4}
                      className="w-full p-2.5 rounded-md border border-[#DADCE0] text-xs focus:outline-none focus:border-[#612D53] resize-none"
                    />
                  </div>

                  {/* Security Authorization Password */}
                  <div className="space-y-1 pt-2 border-t border-[#E8D4E2]">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#612D53]" />
                      <label className="text-[#612D53] font-semibold text-xs block">Administrator Authorization Password *</label>
                    </div>
                    <div className="relative">
                      <input
                        required
                        type={showBatchPassword ? "text" : "password"}
                        value={batchAdminPassword}
                        onChange={(e) => setBatchAdminPassword(e.target.value)}
                        placeholder="Enter admin password (e.g. admin123)"
                        className="w-full h-9 px-3 pr-9 rounded-md border border-[#DADCE0] bg-white text-xs text-[#2C2C2C] focus:outline-none focus:border-[#612D53]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowBatchPassword(!showBatchPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#717171] hover:text-[#2C2C2C] p-1 cursor-pointer"
                      >
                        {showBatchPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F1F3F4]">
                <button
                  type="button"
                  onClick={() => setShowBatchModal(false)}
                  disabled={isProcessing}
                  className="h-9 px-3.5 rounded-lg border border-[#DADCE0] text-[#3C4043] font-medium text-xs cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleRunBatchBilling}
                  disabled={isProcessing}
                  className="btn-3d-primary h-9 px-4 rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  <span>Confirm &amp; Rollout Bills</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* RECORD PAYMENT MODAL */}
      <AnimatePresence>
        {showPaymentModal && selectedAccount && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
            <motion.form
              onSubmit={handleRecordPayment}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative z-10 bg-white rounded-xl border border-[#DADCE0] shadow-xl p-5 max-w-md w-full space-y-3.5 text-xs font-sans"
            >
              <div className="flex items-center justify-between border-b border-[#E8EAED] pb-2.5">
                <h3 className="text-sm font-semibold text-[#2C2C2C]">
                  Record Manual Assembly Payment
                </h3>
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  disabled={isProcessing}
                  className="text-[#717171] hover:text-[#2C2C2C] p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1">
                <span className="text-[#717171]">Account Head</span>
                <p className="font-semibold text-[#2C2C2C]">{selectedAccount.accountNumber} ({selectedAccount.ownerName})</p>
                <p className="text-[#717171]">Total Outstanding Due: {selectedAccount.totalAmountDueFormatted}</p>
              </div>

              <div className="space-y-1">
                <label className="text-[#717171] font-medium">Payment Amount (GH₵)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder={selectedAccount.totalAmountDue.toString()}
                  value={manualAmount}
                  onChange={(e) => setManualAmount(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#DADCE0] bg-white text-xs font-semibold text-[#2C2C2C] focus:outline-none focus:border-[#612D53]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[#717171] font-medium">Payment Channel</label>
                <select
                  value={manualMethod}
                  onChange={(e) => setManualMethod(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#DADCE0] bg-white text-xs text-[#2C2C2C] focus:outline-none focus:border-[#612D53]"
                >
                  <option>Counter Cash Treasury</option>
                  <option>Assembly Direct Cheque</option>
                  <option>GCB Bank Direct Deposit</option>
                  <option>Ecobank Treasury Deposit</option>
                </select>
              </div>

              {/* Security Authorization Password */}
              <div className="space-y-1 pt-2 border-t border-[#DADCE0]">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#612D53]" />
                  <label className="text-[#612D53] font-semibold text-xs block">Administrator Authorization Password *</label>
                </div>
                <div className="relative">
                  <input
                    required
                    type={showPaymentPassword ? "text" : "password"}
                    value={paymentAdminPassword}
                    onChange={(e) => setPaymentAdminPassword(e.target.value)}
                    placeholder="Enter admin password (e.g. admin123)"
                    className="w-full h-10 px-3 pr-9 rounded-lg border border-[#DADCE0] bg-white text-xs font-semibold text-[#2C2C2C] focus:outline-none focus:border-[#612D53]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPaymentPassword(!showPaymentPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#717171] hover:text-[#2C2C2C] p-1 cursor-pointer"
                  >
                    {showPaymentPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E8EAED]">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  disabled={isProcessing}
                  className="h-9 px-3.5 rounded-lg border border-[#DADCE0] text-[#3C4043] font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isProcessing}
                  className="btn-3d-primary h-9 px-4 rounded-lg font-medium flex items-center gap-2 cursor-pointer disabled:opacity-50"
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
            className="fixed bottom-6 left-6 z-50 max-w-md w-[calc(100%-3rem)] bg-[#2C2C2C] text-white px-4 py-3 rounded-lg shadow-2xl border border-white/10 flex items-center justify-between gap-3 text-xs font-medium font-sans"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs font-sans">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl border border-[#DADCE0] shadow-2xl p-6 max-w-lg w-full space-y-4"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[#F1F3F4]">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-[#F6ECF2] text-[#612D53] flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-[#612D53]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#2C2C2C]">
                      Authorize SMS Rollout Transmission
                    </h3>
                    <p className="text-xs text-[#717171]">Communications Directorate &bull; Act 936</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowSmsAuthModal(false);
                    setSmsAuthPassword("");
                    setSmsAuthError(null);
                  }}
                  className="w-7 h-7 rounded-lg text-[#717171] hover:text-[#2C2C2C] hover:bg-[#F1F3F4] flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Target Audience Summary */}
              <div className="bg-[#F8F9FA] rounded-xl p-3.5 border border-[#E8EAED] space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#717171] font-medium">Target Recipients:</span>
                  <span className="font-semibold text-[#2C2C2C]">
                    {smsAuthTargetAccounts.length} {smsAuthTargetAccounts.length === 1 ? "Taxpayer Account" : "Taxpayer Accounts"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#717171] font-medium">Total Balance to Notify:</span>
                  <span className="font-semibold text-[#D93025]">
                    GH₵ {smsAuthTargetAccounts.reduce((acc, curr) => acc + (curr.totalAmountDue || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#717171] font-medium">Outbound Gateway:</span>
                  <span className="font-medium text-[#188038]">Arkesel SMS Gateway (Sender ID: Arnold)</span>
                </div>
              </div>

              {/* Recipient Details List */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#2C2C2C] block">
                  Recipient Roster ({smsAuthTargetAccounts.length})
                </label>
                <div className="max-h-36 overflow-y-auto rounded-lg border border-[#DADCE0] divide-y divide-[#F1F3F4] bg-white text-xs">
                  {smsAuthTargetAccounts.map((t) => (
                    <div key={t.id} className="p-2.5 flex items-center justify-between hover:bg-[#F8F9FA]">
                      <div>
                        <span className="font-semibold text-[#2C2C2C]">{t.ownerName}</span>
                        <p className="text-[11px] text-[#717171] font-mono">{t.accountNumber} &bull; {t.ownerPhone}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold text-[#2C2C2C]">{t.totalAmountDueFormatted}</span>
                        <p className="text-[10px] text-[#D93025]">Due</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Password Challenge Field */}
              <div className="space-y-1.5 pt-2 border-t border-[#F1F3F4]">
                <label className="text-xs font-semibold text-[#2C2C2C] flex items-center justify-between">
                  <span>Enter Administrator Security Password</span>
                  <span className="text-[10px] text-[#717171] font-normal">Required for authorization</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#717171]">
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type={showSmsAuthPassword ? "text" : "password"}
                    value={smsAuthPassword}
                    onChange={(e) => {
                      setSmsAuthPassword(e.target.value);
                      if (smsAuthError) setSmsAuthError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !isProcessing && smsAuthPassword.trim()) {
                        handleExecuteSmsDispatch();
                      }
                    }}
                    placeholder="Enter admin password (e.g. admin123)"
                    className="w-full h-10 pl-9 pr-10 rounded-lg border border-[#DADCE0] text-xs text-[#2C2C2C] focus:outline-none focus:border-[#612D53] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSmsAuthPassword(!showSmsAuthPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#717171] hover:text-[#2C2C2C] cursor-pointer"
                  >
                    {showSmsAuthPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {smsAuthError && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-[#D93025] font-medium flex items-center gap-1 mt-1"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{smsAuthError}</span>
                  </motion.p>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#F1F3F4]">
                <button
                  type="button"
                  onClick={() => {
                    setShowSmsAuthModal(false);
                    setSmsAuthPassword("");
                    setSmsAuthError(null);
                  }}
                  disabled={isProcessing}
                  className="btn-3d-secondary h-9 px-4 rounded-lg text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteSmsDispatch}
                  disabled={isProcessing || !smsAuthPassword.trim()}
                  className="btn-3d-primary h-9 px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
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
