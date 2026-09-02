"use client";

import { useState, useEffect } from "react";
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
  Landmark,
} from "lucide-react";
import {
  getAdminOverview,
  getRatepayersList,
  getRatepayerHistory,
  getSmsRolloutLogs,
  simulateSmsNoticeDispatch,
  batchDispatchSms,
  recordManualCashPayment,
  runAnnualBillingBatch,
  adminLogout,
  AdminDashboardData,
  AdminProperty,
  AdminRatepayerSummary,
  RatepayerHistoryDossier,
  SmsRolloutLogItem,
} from "./actions";
import { motion, AnimatePresence } from "framer-motion";
import { PropertyModal } from "@/components/PropertyModal";
import { RatepayerDossierSheet } from "@/components/RatepayerDossierSheet";
import { SmsRolloutSimulator } from "@/components/SmsRolloutSimulator";
import { AdminDashboardSkeleton } from "@/components/Skeletons";

type NavTab = "REGISTRY" | "RATEPAYERS" | "SMS_CENTER" | "DEFAULTERS" | "TREASURY";

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [ratepayers, setRatepayers] = useState<AdminRatepayerSummary[]>([]);
  const [smsLogs, setSmsLogs] = useState<SmsRolloutLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [activeTab, setActiveTab] = useState<NavTab>("REGISTRY");
  const [currentPage, setCurrentPage] = useState(1);

  // Ratepayer Dossier State
  const [selectedRatepayerDossier, setSelectedRatepayerDossier] = useState<RatepayerHistoryDossier | null>(null);
  const [isDossierOpen, setIsDossierOpen] = useState(false);
  const [isFetchingDossier, setIsFetchingDossier] = useState(false);
  const [ratepayerSearchQuery, setRatepayerSearchQuery] = useState("");

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
  const [municipalityFilter, setMunicipalityFilter] = useState("ALL");
  const [classificationFilter, setClassificationFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PAID" | "UNPAID">("ALL");

  // Selection & Drawer states
  const [selectedAccount, setSelectedAccount] = useState<AdminProperty | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPropertyModal, setShowPropertyModal] = useState(false);
  const [manualAmount, setManualAmount] = useState("");
  const [manualMethod, setManualMethod] = useState("Counter Cash Treasury");

  // Batch Rollout States
  const [residentialRate, setResidentialRate] = useState("0.005");
  const [commercialRate, setCommercialRate] = useState("0.015");
  const [otherRate, setOtherRate] = useState("0.010");
  const [dueDate, setDueDate] = useState("30-Jun-2025");
  const [messageTemplate, setMessageTemplate] = useState(
    "KKMA PROPERTY RATE BILL: Account {{accountNumber}} ({{ownerName}}) has municipal assessment due of GH₵ {{totalAmountDue}}. Due: {{dueDate}}.\n1. View Digital Bill: {{billLink}}\n2. Instant Settlement: {{paymentLink}}"
  );

  const loadData = async (page = currentPage) => {
    setIsLoading(true);
    try {
      const [overviewRes, ratepayersRes, logsRes] = await Promise.all([
        getAdminOverview(page, 50, municipalityFilter),
        getRatepayersList("", 1, 100),
        getSmsRolloutLogs(),
      ]);

      setData(overviewRes);
      if (ratepayersRes) setRatepayers(ratepayersRes.ratepayers);
      if (logsRes) setSmsLogs(logsRes);

      if (selectedAccount && overviewRes) {
        const updated = overviewRes.properties.find((p) => p.id === selectedAccount.id);
        if (updated) setSelectedAccount(updated);
      }
    } catch (err) {
      console.error("Error loading admin data:", err);
      showToast("Failed to load municipal data.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(currentPage);
  }, [currentPage, municipalityFilter]);

  // Lock background scroll when modal or drawer is active
  useEffect(() => {
    const isAnyModalOpen = Boolean(
      selectedAccount || showBatchModal || showPaymentModal || showPropertyModal || isDossierOpen
    );
    if (isAnyModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [selectedAccount, showBatchModal, showPaymentModal, isDossierOpen]);

  // Open Ratepayer Dossier
  const handleOpenRatepayerDossier = async (userId: string) => {
    setIsFetchingDossier(true);
    try {
      const dossier = await getRatepayerHistory(userId);
      if (dossier) {
        setSelectedRatepayerDossier(dossier);
        setIsDossierOpen(true);
      } else {
        showToast("Could not load ratepayer history.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Error retrieving citizen dossier.", "error");
    } finally {
      setIsFetchingDossier(false);
    }
  };

  const handleBatchDispatchSms = async (accountNumbers?: string[], customTpl?: string) => {
    const targets = accountNumbers || selectedIds;
    if (targets.length === 0) return;

    const unpaidAccounts = properties
      .filter((p) => targets.includes(p.accountNumber) && p.status !== "PAID" && p.totalAmountDue > 0)
      .map((p) => p.accountNumber);

    if (unpaidAccounts.length === 0) {
      showToast("All selected property accounts are settled (GH₵ 0.00 balance). No demand notices required.", "info");
      return;
    }

    setIsProcessing(true);
    try {
      const res = await batchDispatchSms(unpaidAccounts, customTpl);
      if (res.success) {
        showToast(`Successfully queued dual-link SMS Demand Notices to ${res.dispatchedCount} accounts with balance due.`, "success");
        setSelectedIds([]);
        const updatedLogs = await getSmsRolloutLogs();
        setSmsLogs(updatedLogs);
      } else {
        showToast(res.error || "Batch dispatch failed.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Batch dispatch error.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRunBatchBilling = async () => {
    setIsProcessing(true);
    try {
      const res = await runAnnualBillingBatch({
        residentialRate: parseFloat(residentialRate) || 0.005,
        commercialRate: parseFloat(commercialRate) || 0.015,
        otherRate: parseFloat(otherRate) || 0.01,
        dueDate: dueDate || "30-Jun-2025",
        messageTemplate: messageTemplate,
      });
      if (res.success) {
        setShowBatchModal(false);
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

    setIsProcessing(true);
    try {
      const res = await recordManualCashPayment(selectedAccount.accountNumber, num, manualMethod);
      if (res.success) {
        setShowPaymentModal(false);
        setManualAmount("");
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

  if (isLoading) {
    return <AdminDashboardSkeleton />;
  }

  const properties = data?.properties || [];
  const metrics = data?.metrics || {
    totalProperties: 0,
    totalBilledFormatted: "GH₵ 0.00",
    totalCollectedFormatted: "GH₵ 0.00",
    totalArrearsFormatted: "GH₵ 0.00",
    defaultersCount: 0,
    collectionRateFormatted: "0.0%",
    collectionRatePercent: 0,
  };

  const filteredProperties = properties.filter((p) => {
    if (activeTab === "DEFAULTERS" && !p.isDefaulter) return false;
    if (municipalityFilter !== "ALL" && p.municipality !== municipalityFilter) return false;
    if (classificationFilter !== "ALL" && p.propertyClassification !== classificationFilter) return false;
    if (statusFilter !== "ALL" && p.status !== statusFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        p.accountNumber.toLowerCase().includes(q) ||
        p.ownerDigitalAddress.toLowerCase().includes(q) ||
        p.ownerName.toLowerCase().includes(q) ||
        p.ownerPhone.toLowerCase().includes(q) ||
        p.municipality.toLowerCase().includes(q) ||
        p.propertyClassification.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filteredRatepayers = ratepayers.filter((r) => {
    if (!ratepayerSearchQuery.trim()) return true;
    const q = ratepayerSearchQuery.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.phoneNumber.toLowerCase().includes(q) ||
      r.status.toLowerCase().includes(q)
    );
  });

  const selectedPropertiesList = properties.filter((p) => selectedIds.includes(p.accountNumber));
  const selectedUnpaidList = selectedPropertiesList.filter((p) => p.status !== "PAID" && p.totalAmountDue > 0);
  const selectedPaidList = selectedPropertiesList.filter((p) => p.status === "PAID");

  return (
    <div className="min-h-screen bg-[#F6ECF2] text-[#2C2C2C] flex flex-row font-sans">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-white border-r border-[#DADCE0] shadow-sm flex flex-col fixed inset-y-0 left-0 z-30 font-sans">
        <div className="h-14 flex items-center px-6 border-b border-[#DADCE0] shrink-0 justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold tracking-tight text-[#612D53] select-none">KKMA Revenue</span>
          </div>
          <span className="text-[10px] text-[#717171] uppercase font-mono font-medium">Enterprise</span>
        </div>
        
        {/* Navigation Links (Zero Pills - Text with Clean Left Border Indicator) */}
        <nav className="flex flex-col flex-1 px-3 py-4 gap-1 overflow-y-auto" aria-label="Main Navigation">
          {([
            { key: "REGISTRY", label: "Cadastre & Property Roll", icon: Building2, count: properties.length },
            { key: "RATEPAYERS", label: "Ratepayers & Citizen Dossier", icon: Users, count: ratepayers.length },
            { key: "SMS_CENTER", label: "SMS Bill Rollout Engine", icon: MessageSquare, count: smsLogs.length },
            { key: "DEFAULTERS", label: "Statutory Defaulters", icon: ShieldAlert, count: metrics.defaultersCount },
            { key: "TREASURY", label: "Treasury Reconciliation", icon: Landmark },
          ] as { key: NavTab; label: string; icon: any; count?: number }[]).map((tab) => {
            const isActive = activeTab === tab.key;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`relative px-3.5 py-2.5 text-left text-xs font-medium transition-colors cursor-pointer focus:outline-none rounded-lg flex items-center justify-between ${
                  isActive ? "bg-[#F6ECF2] text-[#612D53] font-semibold" : "text-[#717171] hover:text-[#2C2C2C] hover:bg-[#F8F9FA]"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-[#612D53]" : "text-[#717171]"}`} />
                  <span className="truncate">{tab.label}</span>
                </div>
                {tab.count !== undefined && (
                  <span className={`text-[11px] font-normal shrink-0 ml-1.5 ${isActive ? "text-[#612D53]/80" : "text-[#717171]/70"}`}>
                    ({tab.count})
                  </span>
                )}
                {isActive && (
                  <motion.div
                    layoutId="activeTabIndicatorSidebar"
                    className="absolute left-0 top-1/4 bottom-1/4 w-[3px] bg-[#612D53] rounded-r-full"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </nav>
        
        {/* User & Sign Out Footer */}
        <div className="p-3 border-t border-[#DADCE0] shrink-0 bg-[#F8F9FA]">
          <div className="px-3 py-2 text-xs">
            <span className="text-[#717171] block text-[10px]">Logged in Administrator</span>
            <span className="font-semibold text-[#2C2C2C] truncate block">Municipal Admin</span>
          </div>
          <button
            type="button"
            onClick={async () => {
              await adminLogout();
            }}
            className="w-full py-2 text-xs font-medium text-[#717171] hover:text-[#2C2C2C] hover:bg-[#F6ECF2] rounded-lg transition-colors focus:outline-none text-left px-3 cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col ml-64 min-h-screen">
        {/* Top Header */}
        <header className="bg-white border-b border-[#DADCE0] shadow-sm sticky top-0 z-20 font-sans">
          <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
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

        {/* Main Workspace */}
        <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-6 space-y-6">
          {/* Top KPI Scorecards (Zero Pills) */}
          {(activeTab === "REGISTRY" || activeTab === "DEFAULTERS") && (
            <section aria-label="Executive KPIs">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* 1. Total Assessed Demand */}
                <div className="p-4 bg-white border border-[#DADCE0] rounded-xl hover:border-[#BDC1C6] transition-colors flex flex-col justify-between space-y-2 shadow-sm">
                  <div className="flex items-center justify-between text-xs text-[#717171] font-medium">
                    <span>Total Assessed Demand</span>
                    <span className="text-[11px] text-[#80868B]">FY 2025</span>
                  </div>
                  <div className="text-2xl font-normal text-[#2C2C2C] tracking-tight">
                    {metrics.totalBilledFormatted}
                  </div>
                  <div className="pt-2 border-t border-[#F1F3F4] text-[11px] text-[#717171] flex items-center justify-between">
                    <span>Annual valuation roll</span>
                    <span>{properties.length} accounts</span>
                  </div>
                </div>

                {/* 2. Revenue Collected */}
                <div className="p-4 bg-white border border-[#DADCE0] rounded-xl hover:border-[#BDC1C6] transition-colors flex flex-col justify-between space-y-2 shadow-sm">
                  <div className="flex items-center justify-between text-xs text-[#717171] font-medium">
                    <span>Revenue Collected</span>
                    <span className="text-[11px] text-[#80868B]">FY 2025</span>
                  </div>
                  <div className="text-2xl font-normal text-[#2C2C2C] tracking-tight">
                    {metrics.totalCollectedFormatted}
                  </div>
                  <div className="pt-2 border-t border-[#F1F3F4] text-[11px] text-[#717171] flex items-center justify-between">
                    <span>Collection efficiency</span>
                    <span className="text-[#188038] font-medium">{metrics.collectionRateFormatted}</span>
                  </div>
                </div>

                {/* 3. Cumulative Arrears */}
                <div className="p-4 bg-white border border-[#DADCE0] rounded-xl hover:border-[#BDC1C6] transition-colors flex flex-col justify-between space-y-2 shadow-sm">
                  <div className="flex items-center justify-between text-xs text-[#717171] font-medium">
                    <span>Cumulative Arrears</span>
                    <span className="text-[11px] text-[#80868B]">Prior Debt</span>
                  </div>
                  <div className="text-2xl font-normal text-[#2C2C2C] tracking-tight">
                    {metrics.totalArrearsFormatted}
                  </div>
                  <div className="pt-2 border-t border-[#F1F3F4] text-[11px] text-[#717171] flex items-center justify-between">
                    <span>Carried uncollected debt</span>
                    <span>Act 936</span>
                  </div>
                </div>

                {/* 4. Statutory Defaulters */}
                <div className="p-4 bg-white border border-[#DADCE0] rounded-xl hover:border-[#BDC1C6] transition-colors flex flex-col justify-between space-y-2 shadow-sm">
                  <div className="flex items-center justify-between text-xs text-[#717171] font-medium">
                    <span>Statutory Defaulters</span>
                    <span className={`text-[11px] font-medium ${metrics.defaultersCount > 0 ? "text-[#D93025]" : "text-[#188038]"}`}>
                      {metrics.defaultersCount > 0 ? "Recovery Action" : "Compliant"}
                    </span>
                  </div>
                  <div className="text-2xl font-normal text-[#2C2C2C] tracking-tight">
                    {metrics.defaultersCount} <span className="text-xs text-[#717171] font-normal">Accounts</span>
                  </div>
                  <div className="pt-2 border-t border-[#F1F3F4] text-[11px] text-[#717171] flex items-center justify-between">
                    <span>Past June 30 cutoff</span>
                    <span>Legal Recovery</span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* TAB 1 & TAB 4: CADASTRE & REGISTRY / DEFAULTERS */}
          {(activeTab === "REGISTRY" || activeTab === "DEFAULTERS") && (
            <section className="bg-white border border-[#DADCE0] rounded-xl overflow-hidden shadow-sm">
              {/* Toolbar */}
              <div className="p-4 border-b border-[#DADCE0] space-y-3">
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
                    {filteredProperties.length} parcel{filteredProperties.length === 1 ? "" : "s"} on record
                  </div>
                </div>

                {/* Filter & Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#F1F3F4]">
                  {/* Search */}
                  <div className="relative flex items-center w-72">
                    <Search className="w-4 h-4 text-[#717171] absolute left-3 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search Account, GPS, Ratepayer..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full h-9 pl-9 pr-3 rounded-lg border border-[#DADCE0] bg-white text-xs text-[#2C2C2C] placeholder:text-[#80868B] focus:border-[#612D53] focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Dropdowns */}
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={classificationFilter}
                      onChange={(e) => setClassificationFilter(e.target.value)}
                      className="h-9 px-2.5 rounded-lg border border-[#DADCE0] bg-white text-xs text-[#2C2C2C] focus:outline-none focus:border-[#612D53]"
                    >
                      <option value="ALL">All Classifications</option>
                      <option value="FIRST CLASS RESIDENTIAL">First Class Residential</option>
                      <option value="PRIVATE THIRD CLASS RESIDENTIAL">Third Class Residential</option>
                      <option value="SECOND CLASS COMMERCIAL">Second Class Commercial</option>
                    </select>

                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as any)}
                      className="h-9 px-2.5 rounded-lg border border-[#DADCE0] bg-white text-xs text-[#2C2C2C] focus:outline-none focus:border-[#612D53]"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="UNPAID">Unpaid</option>
                      <option value="PAID">Paid</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => setShowPropertyModal(true)}
                      className="btn-3d-primary h-9 px-3 rounded-lg font-medium text-xs flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <span>+ Add Property</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleExportCsv(selectedIds.length > 0)}
                      className="btn-3d-secondary h-9 px-3 rounded-lg font-medium text-xs flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{selectedIds.length > 0 ? `Export Selected (${selectedIds.length})` : "Export CSV"}</span>
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
                    className="bg-[#F6ECF2] border-b border-[#EAD6E3] px-4 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[#612D53]">
                        {selectedIds.length} parcel{selectedIds.length === 1 ? "" : "s"} selected
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
                          onClick={() => handleBatchDispatchSms()}
                          disabled={isProcessing}
                          className="btn-3d-primary h-8 px-3.5 rounded-md font-medium text-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
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

              {/* Cadastre Table */}
              <div className="w-full overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#F8F9FA] border-b border-[#DADCE0] text-[#717171] font-semibold text-[11px]">
                    <tr>
                      <th className="py-3 px-3 text-center w-8">
                        <input
                          type="checkbox"
                          checked={selectedIds.length === filteredProperties.length && filteredProperties.length > 0}
                          onChange={toggleSelectAll}
                          className="rounded border-[#DADCE0] text-[#612D53] focus:ring-0 cursor-pointer"
                        />
                      </th>
                      <th className="py-3 px-3">Account &amp; Cadastre</th>
                      <th className="py-3 px-3">Ratepayer Particulars</th>
                      <th className="py-3 px-3">Classification</th>
                      <th className="py-3 px-3 text-right">Rateable Value</th>
                      <th className="py-3 px-3 text-right">Total Assessment Due</th>
                      <th className="py-3 px-3 text-center">Status</th>
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
                            <td className="py-3.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectRow(prop.accountNumber)}
                                className="rounded border-[#DADCE0] text-[#612D53] focus:ring-0 cursor-pointer"
                              />
                            </td>
                            <td className="py-3.5 px-3">
                              <p className="font-semibold text-[#2C2C2C]">{prop.accountNumber}</p>
                              <p className="text-[#717171] text-[11px] mt-0.5">{prop.ownerDigitalAddress} &bull; {prop.municipality}</p>
                            </td>
                            <td className="py-3.5 px-3">
                              <p className="font-medium text-[#2C2C2C]">{prop.ownerName}</p>
                              <p className="text-[#717171] text-[11px] mt-0.5">{prop.ownerPhone}</p>
                            </td>
                            <td className="py-3.5 px-3 text-[#717171]">
                              {prop.propertyClassification}
                            </td>
                            <td className="py-3.5 px-3 text-right font-medium text-[#2C2C2C]">
                              {prop.rateableValueFormatted}
                            </td>
                            <td className="py-3.5 px-3 text-right">
                              <p className="font-semibold text-[#2C2C2C]">{prop.totalAmountDueFormatted}</p>
                              {prop.arrears > 0 && (
                                <p className="text-[#D93025] text-[11px] mt-0.5">Arrears: {prop.arrearsFormatted}</p>
                              )}
                            </td>
                            <td className="py-3.5 px-3 text-center">
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
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* TAB 2: RATEPAYERS & USER HISTORY DIRECTORY */}
          {activeTab === "RATEPAYERS" && (
            <section className="bg-white border border-[#DADCE0] rounded-xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-[#DADCE0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-[#2C2C2C]">
                    Ratepayers &amp; Citizen Dossier Directory
                  </h2>
                  <p className="text-xs text-[#717171] mt-0.5">
                    Search and inspect complete citizen profiles, multi-property portfolios, billing histories, and SMS audits.
                  </p>
                </div>

                <div className="relative flex items-center w-72">
                  <Search className="w-4 h-4 text-[#717171] absolute left-3 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search Ratepayer Name, Phone..."
                    value={ratepayerSearchQuery}
                    onChange={(e) => setRatepayerSearchQuery(e.target.value)}
                    className="w-full h-9 pl-9 pr-3 rounded-lg border border-[#DADCE0] bg-white text-xs text-[#2C2C2C] placeholder:text-[#80868B] focus:border-[#612D53] focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#F8F9FA] border-b border-[#DADCE0] text-[#717171] font-semibold text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Ratepayer Name &amp; Role</th>
                      <th className="py-3 px-4">Telephone</th>
                      <th className="py-3 px-4 text-center">Properties Linked</th>
                      <th className="py-3 px-4 text-right">Total Valuation</th>
                      <th className="py-3 px-4 text-right">Total Assessment Due</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
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
                          onClick={() => handleOpenRatepayerDossier(ratepayer.id)}
                          className="hover:bg-[#F8F9FA] transition-colors cursor-pointer"
                        >
                          <td className="py-3.5 px-4 font-semibold text-[#2C2C2C]">
                            <span>{ratepayer.name}</span>
                            <span className="text-[11px] text-[#717171] font-normal block mt-0.5">
                              {ratepayer.role} &bull; Registered {ratepayer.createdAtFormatted}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[#717171]">
                            {ratepayer.phoneNumber}
                          </td>
                          <td className="py-3.5 px-4 text-center font-medium text-[#2C2C2C]">
                            {ratepayer.propertyCount} parcel{ratepayer.propertyCount === 1 ? "" : "s"}
                          </td>
                          <td className="py-3.5 px-4 text-right text-[#2C2C2C] font-medium">
                            {ratepayer.totalValuationFormatted}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <span className="font-semibold text-[#2C2C2C]">{ratepayer.totalDueFormatted}</span>
                            {ratepayer.totalArrearsFormatted !== "GH₵ 0.00" && (
                              <span className="text-[#D93025] text-[11px] block mt-0.5">
                                Arrears: {ratepayer.totalArrearsFormatted}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`font-semibold ${
                                ratepayer.status === "SETTLED"
                                  ? "text-[#188038]"
                                  : ratepayer.status === "DEFAULTER"
                                  ? "text-[#D93025]"
                                  : "text-[#E37400]"
                              }`}
                            >
                              {ratepayer.status === "SETTLED" ? "Settled" : ratepayer.status === "DEFAULTER" ? "Defaulter" : "Balance Due"}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenRatepayerDossier(ratepayer.id);
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
            </section>
          )}

          {/* TAB 3: SMS BILL ROLLOUT & COMMUNICATIONS ENGINE */}
          {activeTab === "SMS_CENTER" && (
            <SmsRolloutSimulator
              properties={properties}
              smsLogs={smsLogs}
              onTriggerBatchRollout={handleBatchDispatchSms}
              isProcessing={isProcessing}
            />
          )}

          {/* TAB 5: TREASURY RECONCILIATION */}
          {activeTab === "TREASURY" && (
            <section className="bg-white border border-[#DADCE0] rounded-xl p-5 space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#F1F3F4] pb-3">
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

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#F8F9FA] border-b border-[#DADCE0] text-[#717171] font-semibold text-[11px]">
                    <tr>
                      <th className="py-3 px-3">Receipt Reference</th>
                      <th className="py-3 px-3">Account Head</th>
                      <th className="py-3 px-3">Settlement Date</th>
                      <th className="py-3 px-3">Payment Channel</th>
                      <th className="py-3 px-3 text-right">Amount Settled</th>
                      <th className="py-3 px-3 text-center">Audit Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8EAED] bg-white">
                    {properties
                      .flatMap((p) => p.receipts.map((r) => ({ ...r, accountNumber: p.accountNumber })))
                      .map((receipt) => (
                        <tr key={receipt.id} className="hover:bg-[#F8F9FA] transition-colors">
                          <td className="py-3 px-3 font-semibold text-[#2C2C2C]">
                            {receipt.receiptNumber}
                          </td>
                          <td className="py-3 px-3 text-[#717171]">
                            {receipt.accountNumber}
                          </td>
                          <td className="py-3 px-3 text-[#717171]">
                            {receipt.datePaid}
                          </td>
                          <td className="py-3 px-3 text-[#2C2C2C]">
                            {receipt.paymentMethod}
                          </td>
                          <td className="py-3 px-3 text-right font-semibold text-[#188038]">
                            {receipt.amountFormatted}
                          </td>
                          <td className="py-3 px-3 text-center font-medium text-[#188038]">
                            Reconciled
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </main>

        {/* Footer */}
        <footer className="border-t border-[#DADCE0] bg-white py-3 mt-auto font-sans">
          <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between text-xs text-[#717171] gap-2">
            <p>Kpone-Katamanso Municipal Assembly (KKMA) &bull; Revenue Administration Platform</p>
            <p className="font-normal">Local Governance Act, 2016 (Act 936)</p>
          </div>
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
                      <dd className="font-medium text-[#2C2C2C]">{selectedAccount.rateableValueFormatted}</dd>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#F1F3F4]">
                      <dt className="text-[#717171]">Rate Imposed</dt>
                      <dd className="text-[#2C2C2C]">{selectedAccount.rateImposed}</dd>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#F1F3F4]">
                      <dt className="text-[#717171]">Previous Year Assessment</dt>
                      <dd className="text-[#2C2C2C]">{selectedAccount.previousYearBillFormatted}</dd>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#F1F3F4]">
                      <dt className="text-[#717171]">Carried Cumulative Arrears</dt>
                      <dd className={`font-medium ${selectedAccount.arrears > 0 ? "text-[#D93025]" : "text-[#2C2C2C]"}`}>
                        {selectedAccount.arrearsFormatted}
                      </dd>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#F1F3F4]">
                      <dt className="text-[#717171]">2025 Current Rate Assessment</dt>
                      <dd className="font-medium text-[#2C2C2C]">{selectedAccount.currentFeeFormatted}</dd>
                    </div>
                    <div className="flex justify-between pt-2 text-sm font-semibold">
                      <dt className="text-[#2C2C2C]">Total Amount Due</dt>
                      <dd className="text-[#2C2C2C]">{selectedAccount.totalAmountDueFormatted}</dd>
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
                    onClick={async () => {
                      setIsProcessing(true);
                      try {
                        const res = await simulateSmsNoticeDispatch(selectedAccount.accountNumber);
                        if (res.success) {
                          showToast(`Dual-link SMS preview generated for ${selectedAccount.accountNumber}`, "success");
                          setActiveTab("SMS_CENTER");
                          setSelectedAccount(null);
                        }
                      } finally {
                        setIsProcessing(false);
                      }
                    }}
                    disabled={isProcessing}
                    className="btn-3d-primary h-9 px-3.5 rounded-lg font-medium text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>SMS Rollout Preview</span>
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
        isOpen={isDossierOpen}
        onClose={() => {
          setIsDossierOpen(false);
          setSelectedRatepayerDossier(null);
        }}
        onSelectProperty={(acc) => {
          const prop = properties.find((p) => p.accountNumber === acc);
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
          loadData(currentPage);
        }}
      />
    </div>
  );
}
