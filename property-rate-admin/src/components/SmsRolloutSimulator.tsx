"use client";

import React, { useState, useMemo, useEffect, useRef, Fragment } from "react";
import {
  Send,
  CheckCircle2,
  AlertTriangle,
  Lock,
  ShieldCheck,
  Eye,
  EyeOff,
  Loader2,
  X,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
  Check,
  SlidersHorizontal,
  ChevronDown,
  Code2,
  Bookmark,
  Edit3,
  Users,
  Download,
  FileText,
} from "lucide-react";
import { exportSmsRolloutCsv, exportCadastreCsv } from "@/lib/csv-export";
import {
  AdminProperty,
  SmsRolloutLogItem,
  getSmsRolloutAudience,
  getSmsRolloutLogs,
  getSmsRolloutLogsPaginated,
  searchSmsRolloutAccounts,
  saveSmsTemplate,
  getSmsSettings,
  getArkeselBalance,
} from "@/app/actions";
import { SupabaseTablePagination } from "@/components/SupabaseTablePagination";
import {
  DEFAULT_SMS_NOTICE_TEMPLATE,
  DEFAULT_RECEIPT_NOTICE_TEMPLATE,
  FILTER_SMS_TEMPLATES,
  DEFAULT_SAVED_TEMPLATES,
} from "@/lib/sms/types";
import { motion, AnimatePresence } from "framer-motion";

const cleanDash = (val: any): string => {
  if (val === null || val === undefined) return "—";
  const s = String(val).trim();
  if (!s || s.toUpperCase() === "N/A" || s === "null" || s === "undefined" || s === "NONE") return "—";
  return s;
};

interface SmsRolloutSimulatorProps {
  properties: AdminProperty[];
  smsLogs: SmsRolloutLogItem[];
  onTriggerBatchRollout: (
    target: any,
    template: string,
    password?: string,
    mode?: "TEST" | "LIVE"
  ) => Promise<{ success: boolean; error?: string } | void>;
  isProcessing: boolean;
  selectedProperties?: AdminProperty[];
  onClearSelectedProperties?: () => void;
  onNotify?: (message: string, type: "success" | "error" | "info") => void;
}

export function SmsRolloutSimulator({
  properties,
  smsLogs,
  onTriggerBatchRollout,
  isProcessing,
  selectedProperties,
  onClearSelectedProperties,
  onNotify,
}: SmsRolloutSimulatorProps) {
  // Active View Pane: 'SIMULATOR' vs 'LOGS'
  const [activeView, setActiveView] = useState<"SIMULATOR" | "LOGS">("SIMULATOR");

  // Campaign Scope: 'SELECTED' vs 'DATABASE_FILTER'
  // Campaign Scope: 'SELECTED' vs 'DATABASE_FILTER'
  const [audienceScope, setAudienceScope] = useState<"SELECTED" | "DATABASE_FILTER">(
    selectedProperties && selectedProperties.length > 0 ? "SELECTED" : "DATABASE_FILTER"
  );

  const [selectedSpecificAccounts, setSelectedSpecificAccounts] = useState<AdminProperty[]>(
    selectedProperties && selectedProperties.length > 0 ? selectedProperties : []
  );

  useEffect(() => {
    if (selectedProperties && selectedProperties.length > 0) {
      setSelectedSpecificAccounts(selectedProperties);
      setAudienceScope("SELECTED");
    }
  }, [selectedProperties]);

  // Search Query State
  const [accountSearchQuery, setAccountSearchQuery] = useState("");

  // Campaign Filters
  const targetMunicipality = "Kpone-Katamanso (KKMA)";
  const targetClassification = "ALL";
  const [targetStatus, setTargetStatus] = useState<
    "ALL" | "UNPAID" | "PAID" | "OVERPAID"
  >("UNPAID");

  const handleStatusChange = (newStatus: "ALL" | "UNPAID" | "PAID" | "OVERPAID") => {
    setTargetStatus(newStatus);
    const savedForStatus = typeof window !== "undefined" ? localStorage.getItem(`kkma_sms_template_${newStatus}`) : null;
    const matched = savedForStatus || FILTER_SMS_TEMPLATES[newStatus];
    if (matched) {
      setMessageTemplate(matched);
      try {
        localStorage.setItem("kkma_sms_message_template", matched);
      } catch {}
    }
  };

  // Load persisted filters on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedStatus = localStorage.getItem("kkma_sms_target_status");
      const validStatuses = ["ALL", "UNPAID", "PAID", "OVERPAID"];
      if (savedStatus && validStatuses.includes(savedStatus)) {
        setTargetStatus(savedStatus as any);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("kkma_sms_target_status", targetStatus);
    }
  }, [targetStatus]);

  // Applied Required Fields state vs Draft Popover State
  const [requiredFields, setRequiredFields] = useState<string[]>([]);
  const [draftRequiredFields, setDraftRequiredFields] = useState<string[]>([]);
  const [showFieldsFilter, setShowFieldsFilter] = useState(false);
  const [fieldsSearchQuery, setFieldsSearchQuery] = useState("");

  const fieldsFilterRef = useRef<HTMLDivElement>(null);
  const fieldsFilterBtnRef = useRef<HTMLButtonElement>(null);

  // Actionable ratepayer & property database fields for SMS campaign filtering
  const availableFieldFilters = [
    { key: "telephone", label: "Phone Number (SMS Contact)", category: "Contact" },
    { key: "name", label: "Ratepayer Full Name", category: "Profile" },
    { key: "ownerDigitalAddress", label: "GhanaPost GPS Digital Address", category: "Location" },
    { key: "account_no", label: "Valuation Account Number", category: "Identification" },
    { key: "current_bill", label: "Current Period Bill", category: "Financial" },
    { key: "arrears", label: "Arrears Balance", category: "Financial" },
    { key: "outstanding_amt", label: "Net Outstanding Due", category: "Financial" },
    { key: "houseNo", label: "House / Building Number", category: "Location" },
    { key: "plotNo", label: "Cadastral Plot Number", category: "Location" },
    { key: "valuationNo", label: "Valuation Assessment Number", category: "Identification" },
    { key: "electoral_area", label: "Electoral Area / Sub-District", category: "Location" },
    { key: "property_cat", label: "Property Classification", category: "Classification" },
    { key: "rateableValue", label: "Rateable Property Value", category: "Financial" },
    { key: "amount_paid", label: "Previous Payment Records", category: "Financial" },
  ];

  const filteredAvailableFields = useMemo(() => {
    const q = fieldsSearchQuery.trim().toLowerCase();
    if (!q) return availableFieldFilters;
    return availableFieldFilters.filter(
      (f) =>
        f.label.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q) ||
        f.key.toLowerCase().includes(q)
    );
  }, [fieldsSearchQuery]);

  const handleOpenFieldsFilter = () => {
    setDraftRequiredFields(requiredFields);
    setShowFieldsFilter((prev) => !prev);
  };

  const handleToggleDraftField = (fieldKey: string) => {
    setDraftRequiredFields((prev) =>
      prev.includes(fieldKey) ? prev.filter((f) => f !== fieldKey) : [...prev, fieldKey]
    );
  };

  const handleApplyFieldsFilter = () => {
    setRequiredFields(draftRequiredFields);
    localStorage.setItem("kkma_sms_required_fields", JSON.stringify(draftRequiredFields));
    setShowFieldsFilter(false);
  };

  const handleSelectAllFields = () => {
    setDraftRequiredFields(availableFieldFilters.map((f) => f.key));
  };

  const handleClearAllFields = () => {
    setDraftRequiredFields([]);
  };

  const handleResetDefaultFields = () => {
    setDraftRequiredFields(["telephone", "name", "ownerDigitalAddress"]);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        showFieldsFilter &&
        fieldsFilterRef.current &&
        !fieldsFilterRef.current.contains(e.target as Node) &&
        fieldsFilterBtnRef.current &&
        !fieldsFilterBtnRef.current.contains(e.target as Node)
      ) {
        setShowFieldsFilter(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showFieldsFilter]);

  // Dynamic Full Database Audience State with Supabase Studio Pagination
  const [liveAudience, setLiveAudience] = useState<AdminProperty[]>(properties);
  const [isLoadingAudience, setIsLoadingAudience] = useState(false);
  const [audiencePage, setAudiencePage] = useState(1);
  const [audienceLimit, setAudienceLimit] = useState(50);
  const [totalAudienceCount, setTotalAudienceCount] = useState(properties.length);
  const [totalAudienceDueFormatted, setTotalAudienceDueFormatted] = useState("GH₵ 0.00");

  const tableContainerRef = useRef<HTMLDivElement | null>(null);
  const logsTableContainerRef = useRef<HTMLDivElement | null>(null);

  // Delivery Logs Paginated State
  const [logsList, setLogsList] = useState<SmsRolloutLogItem[]>(smsLogs);
  const [logsPage, setLogsPage] = useState(1);
  const [logsLimit, setLogsLimit] = useState(50);
  const [logsTotal, setLogsTotal] = useState(smsLogs.length);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  useEffect(() => {
    setLogsList(smsLogs);
    setLogsTotal((prev) => Math.max(prev, smsLogs.length));
  }, [smsLogs]);

  // Ratepayer Hierarchical Portfolio Grouping
  const [isHierarchicalView, setIsHierarchicalView] = useState(true);
  const [collapsedGroupKeys, setCollapsedGroupKeys] = useState<Set<string>>(new Set());

  const toggleGroupCollapse = (key: string) => {
    setCollapsedGroupKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Security Authorization Modal States
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [gatewayBalance, setGatewayBalance] = useState<{ smsBalance: number; mainBalance: string } | null>(null);
  const [isFetchingBalance, setIsFetchingBalance] = useState(false);

  // Template State
  const defaultTemplate = DEFAULT_SMS_NOTICE_TEMPLATE;
  const defaultReceiptTemplate = DEFAULT_RECEIPT_NOTICE_TEMPLATE;

  const [activeTemplateType, setActiveTemplateType] = useState<"BILLING" | "RECEIPT">("BILLING");
  const [messageTemplate, setMessageTemplate] = useState(FILTER_SMS_TEMPLATES.UNPAID);
  const [receiptTemplate, setReceiptTemplate] = useState(defaultReceiptTemplate);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  const handleExportAudience = () => {
    const list = selectedSpecificAccounts.length > 0 ? selectedSpecificAccounts : liveAudience;
    if (list.length === 0) return;
    const totalVal = list.reduce((sum, p) => sum + (p.rateableValue || 0), 0);
    const totalArr = list.reduce((sum, p) => sum + (p.arrears || 0), 0);
    const totalDue = list.reduce((sum, p) => sum + (p.totalAmountDue || 0), 0);
    exportCadastreCsv(list, {
      reportTitle: "SMS Campaign Target Audience Roll",
      filterScope: `Status: ${targetStatus} | Scope: ${audienceScope}`,
      recordCount: list.length,
      financialSummary: {
        totalValuation: totalVal,
        totalArrears: totalArr,
        totalDue: totalDue,
      },
    });
  };

  const handleExportLogs = () => {
    if (logsList.length === 0) return;
    exportSmsRolloutCsv(logsList, {
      reportTitle: "SMS Rollout & Transactional Dispatch Audit Log",
      filterScope: "All Recorded Dispatches",
      recordCount: logsList.length,
    });
  };

  const [showTokenInserter, setShowTokenInserter] = useState(false);
  const [showSavedTemplates, setShowSavedTemplates] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState(DEFAULT_SAVED_TEMPLATES);

  const savedTemplatesRef = useRef<HTMLDivElement>(null);
  const tokenInserterRef = useRef<HTMLDivElement>(null);
  const savedTemplatesBtnRef = useRef<HTMLButtonElement>(null);
  const tokenInserterBtnRef = useRef<HTMLButtonElement>(null);
  const templateTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (showSavedTemplates && savedTemplatesRef.current && !savedTemplatesRef.current.contains(e.target as Node) && savedTemplatesBtnRef.current && !savedTemplatesBtnRef.current.contains(e.target as Node)) {
        setShowSavedTemplates(false);
      }
      if (showTokenInserter && tokenInserterRef.current && !tokenInserterRef.current.contains(e.target as Node) && tokenInserterBtnRef.current && !tokenInserterBtnRef.current.contains(e.target as Node)) {
        setShowTokenInserter(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showSavedTemplates, showTokenInserter]);

  useEffect(() => {
    try {
      const cachedRequiredFields = localStorage.getItem("kkma_sms_required_fields");
      if (cachedRequiredFields) {
        try {
          const parsedRequiredFields = JSON.parse(cachedRequiredFields);
          if (Array.isArray(parsedRequiredFields)) {
            setRequiredFields(parsedRequiredFields);
            setDraftRequiredFields(parsedRequiredFields);
          }
        } catch {
          setRequiredFields([]);
          setDraftRequiredFields([]);
        }
      }

      const initialStatus = (localStorage.getItem("kkma_sms_target_status") as any) || "UNPAID";
      const cachedForStatus = localStorage.getItem(`kkma_sms_template_${initialStatus}`);
      const cachedBilling = localStorage.getItem("kkma_sms_message_template");
      if (cachedForStatus && cachedForStatus.trim()) {
        setMessageTemplate(cachedForStatus);
      } else if (cachedBilling && cachedBilling.trim()) {
        setMessageTemplate(cachedBilling);
      } else {
        setMessageTemplate(FILTER_SMS_TEMPLATES[initialStatus] || FILTER_SMS_TEMPLATES.UNPAID);
      }

      // Populate presets with any customized versions stored for specific types
      const hydratedPresets = DEFAULT_SAVED_TEMPLATES.map((st) => {
        if (st.type === "BILLING" && (st as any).filterKey) {
          const custom = localStorage.getItem(`kkma_sms_template_${(st as any).filterKey}`);
          return custom ? { ...st, content: custom } : st;
        }
        if (st.type === "RECEIPT") {
          const customReceipt = localStorage.getItem("kkma_sms_receipt_template");
          return customReceipt ? { ...st, content: customReceipt } : st;
        }
        return st;
      });
      setSavedTemplates(hydratedPresets);

      const cachedReceipt = localStorage.getItem("kkma_sms_receipt_template");
      if (cachedReceipt && cachedReceipt.trim()) setReceiptTemplate(cachedReceipt);
    } catch { }

    getSmsSettings()
      .then((settings) => {
        if (settings?.messageTemplate) setMessageTemplate(settings.messageTemplate);
        if (settings?.receiptTemplate) setReceiptTemplate(settings.receiptTemplate);
      })
      .catch(() => { });
  }, []);

  const billingTokens = [
    { tag: "{{municipality}}", label: "Municipality" },
    { tag: "{{billYear}}", label: "Bill Year" },
    { tag: "{{accountNumber}}", label: "Valuation ID / Account No." },
    { tag: "{{propertyAccounts}}", label: "Multi-Property Accounts List" },
    { tag: "{{ownerName}}", label: "Ratepayer Name" },
    { tag: "{{totalAmountDue}}", label: "Total Due" },
    { tag: "{{arrears}}", label: "Arrears" },
    { tag: "{{currentFee}}", label: "Current Fee" },
    { tag: "{{paymentLink}}", label: "Payment Link" },
    { tag: "{{dueDate}}", label: "Due Date" },
    { tag: "{{propertyGpsAddress}}", label: "Property GPS / Digital Address" },
  ];

  const receiptTokens = [
    { tag: "{{receiptNumber}}", label: "GCR Receipt No." },
    { tag: "{{amount}}", label: "Amount Paid" },
    { tag: "{{accountNumber}}", label: "Valuation ID / Account No." },
    { tag: "{{ownerName}}", label: "Ratepayer Name" },
    { tag: "{{paymentMethod}}", label: "Payment Channel" },
    { tag: "{{datePaid}}", label: "Payment Date" },
    { tag: "{{receiptLink}}", label: "Receipt Link" },
  ];

  const dynamicTokens = activeTemplateType === "BILLING" ? billingTokens : receiptTokens;
  const currentTemplate = activeTemplateType === "BILLING" ? messageTemplate : receiptTemplate;

  // Dynamic Full Database Audience with Supabase Studio Pagination
  useEffect(() => {
    let isCancelled = false;
    setIsLoadingAudience(true);
    setAudiencePage(1);

    const timer = setTimeout(async () => {
      try {
        const res = await getSmsRolloutAudience({
          municipality: targetMunicipality,
          classification: targetClassification,
          balanceStatus: targetStatus,
          requiredFields,
          searchQuery: accountSearchQuery.trim() || undefined,
          page: 1,
          limit: audienceLimit,
        });

        if (!isCancelled && res) {
          setLiveAudience(res.properties || []);
          setTotalAudienceCount(res.totalCount || 0);
          if (res.totalDueFormatted) setTotalAudienceDueFormatted(res.totalDueFormatted);
          if (tableContainerRef.current) {
            tableContainerRef.current.scrollTop = 0;
          }
        }
      } catch (err) {
        console.error("Failed to query rollout audience:", err);
      } finally {
        if (!isCancelled) {
          setIsLoadingAudience(false);
        }
      }
    }, 350);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [targetMunicipality, targetClassification, targetStatus, requiredFields, accountSearchQuery]);

  // Page jump / change handler for Audience
  const handleAudiencePageChange = async (newPage: number) => {
    setIsLoadingAudience(true);
    try {
      const res = await getSmsRolloutAudience({
        municipality: targetMunicipality,
        classification: targetClassification,
        balanceStatus: targetStatus,
        requiredFields,
        searchQuery: accountSearchQuery.trim() || undefined,
        page: newPage,
        limit: audienceLimit,
      });

      if (res) {
        setLiveAudience(res.properties || []);
        setTotalAudienceCount(res.totalCount || 0);
        setAudiencePage(newPage);
        if (res.totalDueFormatted) setTotalAudienceDueFormatted(res.totalDueFormatted);
        if (tableContainerRef.current) {
          tableContainerRef.current.scrollTop = 0;
        }
      }
    } catch (err) {
      console.error("Failed to load audience page:", err);
    } finally {
      setIsLoadingAudience(false);
    }
  };

  // Page size change handler for Audience
  const handleAudiencePageSizeChange = async (newLimit: number) => {
    setAudienceLimit(newLimit);
    setIsLoadingAudience(true);
    try {
      const res = await getSmsRolloutAudience({
        municipality: targetMunicipality,
        classification: targetClassification,
        balanceStatus: targetStatus,
        requiredFields,
        searchQuery: accountSearchQuery.trim() || undefined,
        page: 1,
        limit: newLimit,
      });

      if (res) {
        setLiveAudience(res.properties || []);
        setTotalAudienceCount(res.totalCount || 0);
        setAudiencePage(1);
        if (res.totalDueFormatted) setTotalAudienceDueFormatted(res.totalDueFormatted);
        if (tableContainerRef.current) {
          tableContainerRef.current.scrollTop = 0;
        }
      }
    } catch (err) {
      console.error("Failed to update audience page size:", err);
    } finally {
      setIsLoadingAudience(false);
    }
  };

  // Delivery Logs Page Navigation
  const handleLogsPageChange = async (newPage: number) => {
    setIsLoadingLogs(true);
    try {
      const res = await getSmsRolloutLogsPaginated(newPage, logsLimit);
      if (res) {
        setLogsList(res.logs);
        setLogsTotal(res.total);
        setLogsPage(newPage);
        if (logsTableContainerRef.current) {
          logsTableContainerRef.current.scrollTop = 0;
        }
      }
    } catch (err) {
      console.error("Failed to load logs page:", err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleLogsPageSizeChange = async (newLimit: number) => {
    setLogsLimit(newLimit);
    setIsLoadingLogs(true);
    try {
      const res = await getSmsRolloutLogsPaginated(1, newLimit);
      if (res) {
        setLogsList(res.logs);
        setLogsTotal(res.total);
        setLogsPage(1);
        if (logsTableContainerRef.current) {
          logsTableContainerRef.current.scrollTop = 0;
        }
      }
    } catch (err) {
      console.error("Failed to change logs page size:", err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const eligibleProperties = audienceScope === "SELECTED" && selectedSpecificAccounts.length > 0
    ? selectedSpecificAccounts
    : liveAudience;

  const unpaidTargets = useMemo(() => {
    if (targetStatus === "OVERPAID") {
      return eligibleProperties.filter((p) => p.totalAmountDue < 0);
    }
    if (targetStatus === "PAID") {
      return eligibleProperties.filter((p) => p.totalAmountDue === 0);
    }
    if (targetStatus === "ALL") {
      return eligibleProperties;
    }
    return eligibleProperties.filter((p) => p.status !== "PAID" && p.totalAmountDue > 0);
  }, [eligibleProperties, targetStatus]);

  const totalOutstandingDueSum = useMemo(() => {
    return unpaidTargets.reduce((acc, curr) => acc + (curr.totalAmountDue || 0), 0);
  }, [unpaidTargets]);

  const effectiveRolloutCount = audienceScope === "SELECTED" && selectedSpecificAccounts.length > 0
    ? selectedSpecificAccounts.length
    : totalAudienceCount;

  const effectiveRolloutTotalDueFormatted = audienceScope === "SELECTED" && selectedSpecificAccounts.length > 0
    ? `GH₵ ${selectedSpecificAccounts.reduce((sum, p) => sum + Number(p.totalAmountDue || 0), 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
    : (totalAudienceDueFormatted || "GH₵ 0.00");

  const ratepayerGroups = useMemo(() => {
    const groupsMap = new Map<
      string,
      {
        key: string;
        ownerName: string;
        phone: string;
        totalAmountDue: number;
        totalArrears: number;
        properties: AdminProperty[];
      }
    >();

    for (const prop of liveAudience) {
      const rawPhone = (prop.ownerPhone || (prop as any).telephone || "").trim();
      const normPhone = rawPhone.replace(/[^\d+]/g, "");
      const hasValidPhone = Boolean(normPhone && normPhone !== "0" && normPhone.length >= 7);
      const rawName = (prop.ownerName || (prop as any).name || "Municipal Ratepayer").trim();
      const accNo = prop.accountNumber || "";

      let groupKey: string;
      if (!hasValidPhone) {
        groupKey = `NO_PHONE::${accNo}`;
      } else {
        const upper = rawName.toUpperCase();
        if (!upper || upper.includes("NO NAME")) {
          groupKey = `${normPhone}::UNNAMED::${accNo}`;
        } else {
          const cleanName = upper
            .replace(/\b(MR|MRS|MS|DR|ING|ALHAJI|HAJIA|HON|CHIEF|NII|NANA|REV|PASTOR|ELDER|MADAM)\b\.?/gi, "")
            .replace(/[^\w\s]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
          groupKey = `${normPhone}::${cleanName}`;
        }
      }

      if (!groupsMap.has(groupKey)) {
        groupsMap.set(groupKey, {
          key: groupKey,
          ownerName: rawName,
          phone: hasValidPhone ? rawPhone : "—",
          totalAmountDue: 0,
          totalArrears: 0,
          properties: [],
        });
      }
      const g = groupsMap.get(groupKey)!;
      g.properties.push(prop);
      g.totalAmountDue += Number(prop.totalAmountDue || 0);
      g.totalArrears += Number(prop.arrears || 0);
    }

    return Array.from(groupsMap.values()).map((g) => ({
      ...g,
      isMultiProperty: g.properties.length > 1,
    }));
  }, [liveAudience]);

  const multiPropertyRatepayersCount = useMemo(
    () => ratepayerGroups.filter((g) => g.isMultiProperty).length,
    [ratepayerGroups]
  );

  const handleToggleCollapseAll = () => {
    if (collapsedGroupKeys.size > 0) {
      setCollapsedGroupKeys(new Set());
    } else {
      const multiKeys = ratepayerGroups.filter((g) => g.isMultiProperty).map((g) => g.key);
      setCollapsedGroupKeys(new Set(multiKeys));
    }
  };

  const renderPreviewSnippet = (tpl: string, prop: AdminProperty, groupProps?: AdminProperty[]) => {
    const isMulti = groupProps && groupProps.length > 1;
    const totalDueNum = isMulti
      ? groupProps.reduce((sum, p) => sum + Number(p.totalAmountDue || 0), 0)
      : Number(prop.totalAmountDue || 0);
    const arrearsNum = isMulti
      ? groupProps.reduce((sum, p) => sum + Number(p.arrears || p.totalAmountDue || 0), 0)
      : Number(prop.arrears || prop.totalAmountDue || 0);
    const currentFeeNum = isMulti
      ? groupProps.reduce((sum, p) => sum + Number(p.currentFee || 0), 0)
      : Number(prop.currentFee || 0);

    const arrearsStr = arrearsNum.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const totalStr = totalDueNum.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const currentFeeStr = currentFeeNum.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const primaryAcc = prop.accountNumber || "KKMA-ACC";
    const propertyAccounts = isMulti ? groupProps.map((p) => p.accountNumber).join(", ") : primaryAcc;

    let publicAppUrl = (
      process.env.NEXT_PUBLIC_APP_URL || "https://property-rate-app.vercel.app"
    ).replace(/\/+$/, "");

    if (publicAppUrl.includes("-projects.vercel.app") || publicAppUrl.includes("kzz98dclv") || publicAppUrl.includes("localhost:3001")) {
      publicAppUrl = "https://property-rate-app.vercel.app";
    }

    const assessmentLink = `${publicAppUrl}/auth/access?token=demo_ast_${encodeURIComponent(primaryAcc)}`;
    const checkoutLink = `${publicAppUrl}/auth/access?token=demo_ckt_${encodeURIComponent(primaryAcc)}`;

    const gpsAddresses = isMulti
      ? Array.from(new Set(groupProps.map((p) => p.ownerDigitalAddress?.trim()).filter(Boolean))).join(", ")
      : prop.ownerDigitalAddress || "KKMA-MUNICIPAL";

    return tpl
      .replace(/{{ownerName}}/g, prop.ownerName || "Ratepayer")
      .replace(/{{accountNumber}}/g, isMulti ? propertyAccounts : primaryAcc)
      .replace(/{{propertyAccounts}}/g, propertyAccounts)
      .replace(/{{arrears}}/g, arrearsStr)
      .replace(/{{totalAmountDue}}/g, totalStr)
      .replace(/{{currentFee}}/g, currentFeeStr)
      .replace(/{{propertyGpsAddress}}/g, gpsAddresses || "KKMA-MUNICIPAL")
      .replace(/{{billYear}}/g, String(prop.billYear || 2026))
      .replace(/{{municipality}}/g, prop.municipality || "Kpone-Katamanso (KKMA)")
      .replace(/{{dueDate}}/g, prop.settlementDeadlineFormatted || "30-Jun-2025")
      .replace(/{{paymentLink}}/g, checkoutLink)
      .replace(/{{billLink}}/g, assessmentLink)
      .replace(/{{link_assessment}}/g, assessmentLink)
      .replace(/{{link_checkout}}/g, checkoutLink);
  };


  const handleSaveTemplate = async () => {
    setIsSavingTemplate(true);
    try {
      const fallback = activeTemplateType === "BILLING" ? defaultTemplate : defaultReceiptTemplate;
      const templateToSave = currentTemplate.trim() || fallback;

      if (activeTemplateType === "BILLING") {
        setMessageTemplate(templateToSave);
        // Save for the currently active filter type so switching retains custom edits
        localStorage.setItem(`kkma_sms_template_${targetStatus}`, templateToSave);
        localStorage.setItem("kkma_sms_message_template", templateToSave);

        // Update the in-memory and local storage presets list
        setSavedTemplates((prev) =>
          prev.map((t) =>
            t.type === "BILLING" && (t as any).filterKey === targetStatus
              ? { ...t, content: templateToSave }
              : t
          )
        );
      } else {
        setReceiptTemplate(templateToSave);
        localStorage.setItem("kkma_sms_receipt_template", templateToSave);
        setSavedTemplates((prev) =>
          prev.map((t) =>
            t.type === "RECEIPT"
              ? { ...t, content: templateToSave }
              : t
          )
        );
      }

      await saveSmsTemplate(templateToSave, activeTemplateType);
      onNotify?.(
        `${activeTemplateType === "BILLING" ? `${targetStatus} notice` : "Payment receipt notice"} template saved.`,
        "success"
      );
    } catch (err) {
      onNotify?.("Template saved locally.", "info");
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleOpenAuthModal = async () => {
    setAdminPassword("");
    setAuthError(null);
    setShowAuthModal(true);
    setIsFetchingBalance(true);
    try {
      const balance = await getArkeselBalance();
      setGatewayBalance(balance);
    } catch (err) {
      console.error("Failed to fetch balance:", err);
    } finally {
      setIsFetchingBalance(false);
    }
  };

  const handleConfirmAuthorization = async () => {
    if (!adminPassword.trim()) {
      setAuthError("Please enter your administrator security password.");
      return;
    }

    setIsAuthorizing(true);
    setAuthError(null);

    try {
      const clientMode = typeof window !== "undefined" ? (localStorage.getItem("kkma_sms_dispatch_mode") as any) : undefined;
      
      let dispatchPayload: any;
      if (audienceScope === "SELECTED" && selectedSpecificAccounts.length > 0) {
        dispatchPayload = selectedSpecificAccounts.map((p) => p.accountNumber);
      } else {
        dispatchPayload = {
          filters: {
            municipality: targetMunicipality,
            classification: targetClassification,
            balanceStatus: targetStatus,
            requiredFields,
            searchQuery: accountSearchQuery.trim() || undefined,
          },
        };
      }

      const res = await onTriggerBatchRollout(dispatchPayload, messageTemplate, adminPassword, clientMode);
      if (res && !res.success) {
        setAuthError(res.error || "Password verification failed.");
      } else {
        setShowAuthModal(false);
      }
    } catch (err) {
      setAuthError("An unexpected error occurred during dispatch authorization.");
    } finally {
      setIsAuthorizing(false);
    }
  };

  return (
    <div className="relative w-full h-full flex-1 min-h-0 overflow-hidden flex flex-col font-sans bg-[#F2F2F7] text-[#1C1C1E]">
      <motion.div
        className="w-[200%] h-full flex flex-row flex-1 min-h-0"
        animate={{ x: activeView === "SIMULATOR" ? "0%" : "-50%" }}
        transition={{ type: "spring", damping: 26, stiffness: 220, mass: 0.8 }}
      >
        {/* PANE 1: SMS ROLLOUT ENGINE */}
        <div className="w-1/2 h-full flex flex-col min-h-0 p-0 overflow-hidden relative bg-[#F2F2F7]">
          <div className="w-full h-full min-h-0 flex flex-col overflow-hidden">

            {/* Audience & Field Selection */}
            <div className="border-0 rounded-none shadow-none shrink-0 flex flex-col bg-white">
              <div className="shrink-0 space-y-2.5 relative z-20 p-3.5 border-b border-[#E5E5EA] bg-white">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-[#1C1C1E] flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-[#007AFF]" />
                    <span className="text-[#1C1C1E] font-bold">Target Ratepayer Audience</span>
                  </h3>
                  <div className="flex items-center gap-2.5">
                    <span className="text-[11px] text-[#6C6C70] font-medium">
                      {(totalAudienceCount || eligibleProperties.length).toLocaleString()} active properties matched
                    </span>

                    <div className="h-3.5 w-px bg-[#E5E5EA]" />

                    {/* Delivery Logs Action Button with Floating Metric Tooltip on Hover */}
                    <div className="relative group shrink-0">
                      <button
                        type="button"
                        onClick={() => setActiveView("LOGS")}
                        aria-label="View SMS Delivery Logs"
                        className="w-7 h-7 rounded-full border border-[#E5E5EA] bg-[#F2F2F7] hover:bg-[#E5E5EA] hover:border-[#007AFF] text-[#1C1C1E] shadow-2xs flex items-center justify-center transition-all cursor-pointer focus:outline-none"
                      >
                        <ChevronRight className="w-3.5 h-3.5 text-[#6C6C70] group-hover:text-[#007AFF] group-hover:translate-x-0.5 transition-transform" />
                      </button>

                      {/* Floating Tooltip Card (Appears on Hover) - iOS Liquid Glass */}
                      <div className="absolute right-0 top-full mt-2 hidden group-hover:flex flex-col items-end pointer-events-none z-50 animate-in fade-in zoom-in-95 duration-150">
                        {/* Tooltip Caret Arrow */}
                        <div className="w-2.5 h-2.5 bg-white/95 backdrop-blur-xl border-l border-t border-[#E5E5EA] rotate-45 -mb-1 mr-2.5" />
                        <div className="bg-white/95 backdrop-blur-xl border border-[#E5E5EA] text-[#1C1C1E] text-xs px-3 py-1.5 rounded-lg shadow-xl whitespace-nowrap flex items-center gap-2">
                          <span className="font-semibold text-[#1C1C1E]">Delivery Logs</span>
                          <span className="text-[#8E8E93] text-[10px]">•</span>
                          <span className="text-[#1C1C1E] text-[11px] font-mono tabular-nums">
                            {smsLogs.length.toLocaleString()} records
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Search, Classification, Fields Filter & Action Toolbar */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-[180px]">
                    <Search className="w-3.5 h-3.5 text-[#8E8E93] absolute left-2.5 top-1/2 -translate-y-1/2 z-10" />

                  <input
                    type="text"
                    value={accountSearchQuery}
                    onChange={(e) => setAccountSearchQuery(e.target.value)}
                    placeholder="Search Valuation ID, Ratepayer, Phone, GPS, Class..."
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck="false"
                    className="w-full h-8 pl-8 pr-8 rounded-lg border border-[#E5E5EA] bg-[#F2F2F7] text-xs text-[#1C1C1E] focus:outline-none focus:border-[#007AFF] focus:bg-white placeholder-[#8E8E93] transition-colors"
                  />

                  {accountSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setAccountSearchQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8E8E93] p-1 cursor-pointer z-10 hover:text-[#1C1C1E]"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* FIELDS FILTER TRIGGER & CONTAINER POPOVER */}
                <div className="relative shrink-0">
                  <button
                    ref={fieldsFilterBtnRef}
                    type="button"
                    onClick={handleOpenFieldsFilter}
                    className={`h-8 px-3 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                      requiredFields.length > 0
                        ? "bg-[#007AFF] text-white font-medium border-[#007AFF] shadow-xs"
                        : "bg-[#F2F2F7] text-[#1C1C1E] border-[#E5E5EA] hover:bg-[#E5E5EA]"
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Fields Filter</span>
                    {requiredFields.length > 0 && (
                      <span className="ml-0.5 text-[11px] font-bold opacity-90">
                        ({requiredFields.length})
                      </span>
                    )}
                    <ChevronDown className={`w-3 h-3 transition-transform ${showFieldsFilter ? "rotate-180" : ""}`} />
                  </button>

                  {/* FIELDS SELECTION POPOVER (FITS VIEWPORT & FULLY RESPONSIVE) */}
                  {showFieldsFilter && (
                    <div
                      ref={fieldsFilterRef}
                      className="absolute right-0 top-full mt-1.5 w-[340px] sm:w-[380px] max-w-[calc(100vw-32px)] z-50 rounded-xl border border-[#E5E5EA] bg-white/95 backdrop-blur-xl shadow-xl p-3 flex flex-col font-sans max-h-[340px] overflow-hidden"
                    >
                      <div className="flex items-center justify-between border-b border-[#E5E5EA] pb-2 shrink-0">
                        <div className="flex items-center gap-1.5">
                          <SlidersHorizontal className="w-3.5 h-3.5 text-[#007AFF]" />
                          <span className="text-xs font-bold text-[#1C1C1E]">Required Field Criteria</span>
                          <span className="text-[10px] text-[#6C6C70]">({availableFieldFilters.length} fields)</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowFieldsFilter(false)}
                          className="text-[#8E8E93] hover:text-[#1C1C1E] p-0.5 rounded cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="relative shrink-0 pt-2">
                        <Search className="w-3 h-3 text-[#8E8E93] absolute left-2 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={fieldsSearchQuery}
                          onChange={(e) => setFieldsSearchQuery(e.target.value)}
                          placeholder="Search fields (e.g. Phone, GPS, Name)..."
                          autoComplete="off"
                          autoCorrect="off"
                          spellCheck="false"
                          className="w-full h-7 pl-7 pr-2 rounded-md border border-[#E5E5EA] bg-[#F2F2F7] text-[11px] text-[#1C1C1E] focus:outline-none focus:border-[#007AFF] focus:bg-white"
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] shrink-0 py-1.5">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleSelectAllFields}
                            className="text-[#007AFF] hover:underline font-semibold cursor-pointer"
                          >
                            Select All
                          </button>
                          <span className="text-[#E5E5EA]">&bull;</span>
                          <button
                            type="button"
                            onClick={handleClearAllFields}
                            className="text-[#6C6C70] hover:underline font-medium cursor-pointer"
                          >
                            Clear
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={handleResetDefaultFields}
                          className="text-[#34C759] hover:underline font-semibold cursor-pointer flex items-center gap-1"
                        >
                          <span>Recommended for SMS</span>
                        </button>
                      </div>

                      <div className="flex-1 min-h-[140px] overflow-y-auto divide-y divide-[#E5E5EA] rounded-lg border border-[#E5E5EA] bg-[#F2F2F7]/50">
                        {filteredAvailableFields.map((field) => {
                          const isChecked = draftRequiredFields.includes(field.key);
                          return (
                            <label
                              key={field.key}
                              onClick={() => handleToggleDraftField(field.key)}
                              className={`px-2.5 py-1.5 flex items-center justify-between text-xs cursor-pointer hover:bg-white transition-colors ${
                                isChecked ? "bg-[#007AFF]/8 font-medium text-[#007AFF]" : "text-[#1C1C1E]"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0 pr-2">
                                <div
                                  className={`w-3.5 h-3.5 rounded shrink-0 flex items-center justify-center border transition-colors ${
                                    isChecked
                                      ? "bg-[#007AFF] border-[#007AFF] text-white"
                                      : "border-[#C7C7CC] bg-white"
                                  }`}
                                >
                                  {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                </div>
                                <span className="text-[11px] text-[#1C1C1E] truncate">
                                  {field.label}
                                </span>
                              </div>
                              <span className="text-[9px] text-[#6C6C70] uppercase tracking-wide shrink-0">
                                {field.category}
                              </span>
                            </label>
                          );
                        })}
                      </div>

                      <div className="pt-2 border-t border-[#E5E5EA] flex items-center justify-between text-[10px] text-[#6C6C70] shrink-0">
                        <span>{draftRequiredFields.length} field{draftRequiredFields.length === 1 ? "" : "s"} required</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setShowFieldsFilter(false)}
                            className="h-6 px-2 rounded border border-[#E5E5EA] text-[#6C6C70] hover:bg-[#F2F2F7] font-medium cursor-pointer transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleApplyFieldsFilter}
                            className="h-6 px-2.5 rounded bg-[#007AFF] text-white font-semibold cursor-pointer hover:bg-[#007AFF]/90 transition-colors shadow-2xs"
                          >
                            Apply Filter
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <select
                  value={targetStatus}
                  onChange={(e) => handleStatusChange(e.target.value as any)}
                  className="shrink-0 h-8 px-2 rounded-lg border border-[#E5E5EA] bg-[#F2F2F7] text-[11px] text-[#1C1C1E] focus:outline-none focus:border-[#007AFF] focus:bg-white cursor-pointer font-medium"
                >
                  <option value="UNPAID">Unpaid Balances Only</option>
                  <option value="PAID">Paid / Settled</option>
                  <option value="OVERPAID">Overpaid (Credit Balance)</option>
                  <option value="ALL">All Records</option>
                </select>

                {/* Edit Message Template Modal Trigger Button */}
                <button
                  type="button"
                  onClick={() => setShowTemplateModal(true)}
                  className="h-8 px-2.5 rounded-lg border border-[#E5E5EA] bg-[#F2F2F7] hover:bg-[#E5E5EA] hover:border-[#007AFF] text-xs font-semibold text-[#1C1C1E] flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                  title="Configure SMS Message Template"
                >
                  <FileText className="w-3.5 h-3.5 text-[#6C6C70]" />
                  <span>Message Template</span>
                  <span className="text-[10px] text-[#6C6C70]">({currentTemplate.length} chars)</span>
                </button>

                {/* Rollout Action Button with Floating Metric Tooltip on Hover */}
                <div className="relative group shrink-0">
                  <button
                    type="button"
                    onClick={handleOpenAuthModal}
                    disabled={isProcessing || effectiveRolloutCount === 0}
                    className="h-8 px-3.5 rounded-lg font-semibold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all shadow-xs bg-[#007AFF] hover:bg-[#007AFF]/90 text-white"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>
                      {isProcessing ? "Dispatching..." : "Rollout"}
                    </span>
                  </button>

                  {/* Floating Tooltip Card (Appears on Hover) - iOS Liquid Glass */}
                  <div className="absolute right-0 bottom-full mb-2 hidden group-hover:flex flex-col items-center pointer-events-none z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="bg-white/95 backdrop-blur-xl border border-[#E5E5EA] text-[#1C1C1E] text-xs px-3 py-1.5 rounded-lg shadow-xl whitespace-nowrap flex items-center gap-2">
                      <span className="font-semibold text-[#007AFF]">
                        {effectiveRolloutCount.toLocaleString()}
                      </span>
                      <span className="text-[#6C6C70] text-[11px]">
                        {audienceScope === "SELECTED" ? "accounts selected" : "accounts matching filter criteria"}
                      </span>
                      <span className="text-[#E5E5EA] text-[10px]">•</span>
                      <span className="text-[#1C1C1E] text-[11px] font-mono tabular-nums">
                        {effectiveRolloutTotalDueFormatted}
                      </span>
                    </div>
                    {/* Tooltip Caret Arrow */}
                    <div className="w-2.5 h-2.5 bg-white/95 backdrop-blur-xl border-r border-b border-[#E5E5EA] rotate-45 -mt-1" />
                  </div>
                </div>
              </div>
            </div>
          </div>

            {/* Matched Audience Rollout Queue Table (Consumes All Vertical Space) */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white">
              <div className="px-3.5 py-2 border-b flex items-center justify-between gap-3 shrink-0 bg-[#F8F9FA] border-[#E5E5EA]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-[#1C1C1E]">Matched Audience Rollout Queue</span>
                  <span className="text-[11px] text-[#6C6C70]">
                    ({totalAudienceCount.toLocaleString()} properties • Page {audiencePage} of {Math.max(1, Math.ceil(totalAudienceCount / audienceLimit))}
                    {multiPropertyRatepayersCount > 0 && ` • ${multiPropertyRatepayersCount} multi-account portfolios`})
                  </span>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  {multiPropertyRatepayersCount > 0 && isHierarchicalView && (
                    <button
                      type="button"
                      onClick={handleToggleCollapseAll}
                      className="text-[11px] text-[#6C6C70] hover:text-[#1C1C1E] cursor-pointer"
                    >
                      {collapsedGroupKeys.size > 0 ? "Expand All" : "Collapse All"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsHierarchicalView(!isHierarchicalView)}
                    className={`h-6.5 px-2 rounded-md border text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                      isHierarchicalView
                        ? "border-[#007AFF] bg-[#007AFF]/10 text-[#007AFF]"
                        : "border-[#E5E5EA] bg-[#F2F2F7] text-[#6C6C70] hover:text-[#1C1C1E]"
                    }`}
                    title="Toggle between Ratepayer Portfolio Grouping and Flat Property rows"
                  >
                    <Users className="w-3 h-3" />
                    <span>{isHierarchicalView ? "Hierarchical View" : "Flat View"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportAudience}
                    className="h-6.5 px-2 rounded-md border border-[#E5E5EA] bg-[#F2F2F7] text-[#6C6C70] hover:text-[#1C1C1E] hover:border-[#007AFF]/40 text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Export Audience CSV with Linked Portfolios"
                  >
                    <Download className="w-3 h-3 text-[#007AFF]" />
                    <span>Export Audience CSV</span>
                  </button>
                  <div className="h-3 w-px bg-[#E5E5EA]" />
                  <button
                    type="button"
                    onClick={() => setShowTemplateModal(true)}
                    className="text-[11px] font-semibold text-[#007AFF] hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Edit Template Body</span>
                  </button>
                </div>
              </div>

              {/* Audience Table Container */}
              <div
                ref={tableContainerRef}
                className="flex-1 min-h-0 overflow-auto"
              >
                <table className="w-[2860px] min-w-[2860px] table-fixed text-left text-xs border-collapse">
                  <colgroup>
                    <col className="w-[48px]" />
                    <col className="w-[140px]" />
                    <col className="w-[190px]" />
                    <col className="w-[130px]" />
                    <col className="w-[160px]" />
                    <col className="w-[210px]" />
                    <col className="w-[110px]" />
                    <col className="w-[110px]" />
                    <col className="w-[140px]" />
                    <col className="w-[180px]" />
                    <col className="w-[190px]" />
                    <col className="w-[90px]" />
                    <col className="w-[110px]" />
                    <col className="w-[130px]" />
                    <col className="w-[110px]" />
                    <col className="w-[130px]" />
                    <col className="w-[130px]" />
                    <col className="w-[130px]" />
                    <col className="w-[130px]" />
                    <col className="w-[130px]" />
                    <col className="w-[150px]" />
                    <col className="w-[140px]" />
                  </colgroup>
                  <thead className="border-b text-[#6C6C70] font-semibold text-[11px] sticky top-0 z-20 bg-[#F8F9FA] border-[#E5E5EA]">
                    <tr>
                      <th className="py-2.5 px-3 text-center border-l-4 border-[#F8F9FA] bg-[#F8F9FA] w-[48px]">
                        <input
                          type="checkbox"
                          checked={audienceScope === "SELECTED" && liveAudience.length > 0 && selectedSpecificAccounts.length === liveAudience.length}
                          ref={(el) => {
                            if (el) {
                              el.indeterminate = selectedSpecificAccounts.length > 0 && selectedSpecificAccounts.length < liveAudience.length;
                            }
                          }}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSpecificAccounts(liveAudience);
                              setAudienceScope("SELECTED");
                            } else {
                              setSelectedSpecificAccounts([]);
                              setAudienceScope("DATABASE_FILTER");
                            }
                          }}
                          className="w-3.5 h-3.5 rounded border-[#C7C7CC] text-[#007AFF] focus:ring-[#007AFF] accent-[#007AFF] cursor-pointer"
                        />
                      </th>
                      <th className="py-2.5 px-3 whitespace-nowrap bg-[#F8F9FA] truncate w-[140px]">Account No</th>
                      <th className="py-2.5 px-3 whitespace-nowrap bg-[#F8F9FA] truncate w-[190px]">Name</th>
                      <th className="py-2.5 px-3 whitespace-nowrap bg-[#F8F9FA] truncate w-[130px]">Telephone</th>
                      <th className="py-2.5 px-3 whitespace-nowrap bg-[#F8F9FA] truncate w-[160px]">ID</th>
                      <th className="py-2.5 px-3 whitespace-nowrap bg-[#F8F9FA] truncate w-[210px]">Owner Digital Address</th>
                      <th className="py-2.5 px-3 whitespace-nowrap bg-[#F8F9FA] truncate w-[110px]">House No</th>
                      <th className="py-2.5 px-3 whitespace-nowrap bg-[#F8F9FA] truncate w-[110px]">Plot No</th>
                      <th className="py-2.5 px-3 whitespace-nowrap bg-[#F8F9FA] truncate w-[140px]">Valuation No</th>
                      <th className="py-2.5 px-3 whitespace-nowrap bg-[#F8F9FA] truncate w-[180px]">Municipality</th>
                      <th className="py-2.5 px-3 whitespace-nowrap bg-[#F8F9FA] truncate w-[190px]">Property Cat</th>
                      <th className="py-2.5 px-3 whitespace-nowrap bg-[#F8F9FA] truncate w-[90px]">Bill Year</th>
                      <th className="py-2.5 px-3 whitespace-nowrap bg-[#F8F9FA] truncate w-[110px]">Bill Date</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap bg-[#F8F9FA] truncate w-[130px]">Rateable Value</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap bg-[#F8F9FA] truncate w-[110px]">Rate Imposed</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap bg-[#F8F9FA] truncate w-[130px]">Previous Year Bill</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap bg-[#F8F9FA] truncate w-[130px]">Amount Paid</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap bg-[#F8F9FA] truncate w-[130px]">Arrears</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap bg-[#F8F9FA] truncate w-[130px]">Current Bill</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap bg-[#F8F9FA] truncate w-[130px]">Bill Amount</th>
                      <th className="py-2.5 px-3 whitespace-nowrap bg-[#F8F9FA] truncate w-[150px]">Electoral Area</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap bg-[#F8F9FA] truncate w-[140px]">Outstanding Amt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E5EA] bg-white">
                    {isLoadingAudience ? (
                      Array.from({ length: 9 }).map((_, i) => (
                        <tr key={`aud-skel-${i}`} className="animate-pulse">
                          <td className="py-2.5 px-3 text-center"><div className="w-3.5 h-3.5 bg-[#E5E5EA] rounded mx-auto" /></td>
                          <td className="py-2.5 px-3"><div className="h-3.5 w-24 bg-[#E5E5EA] rounded" /></td>
                          <td className="py-2.5 px-3"><div className="h-3.5 w-28 bg-[#E5E5EA] rounded" /></td>
                          <td className="py-2.5 px-3"><div className="h-3.5 w-20 bg-[#E5E5EA] rounded" /></td>
                          <td className="py-2.5 px-3"><div className="h-3.5 w-20 bg-[#E5E5EA] rounded" /></td>
                          <td className="py-2.5 px-3"><div className="h-3.5 w-16 bg-[#E5E5EA] rounded" /></td>
                          <td className="py-2.5 px-3"><div className="h-3.5 w-16 bg-[#E5E5EA] rounded" /></td>
                          <td className="py-2.5 px-3"><div className="h-3.5 w-16 bg-[#E5E5EA] rounded" /></td>
                          <td className="py-2.5 px-3"><div className="h-3.5 w-20 bg-[#E5E5EA] rounded" /></td>
                          <td className="py-2.5 px-3"><div className="h-3.5 w-20 bg-[#E5E5EA] rounded" /></td>
                          <td className="py-2.5 px-3"><div className="h-3.5 w-14 bg-[#E5E5EA] rounded" /></td>
                          <td className="py-2.5 px-3"><div className="h-3.5 w-18 bg-[#E5E5EA] rounded" /></td>
                          <td className="py-2.5 px-3 text-right"><div className="h-3.5 w-16 bg-[#E5E5EA] rounded ml-auto" /></td>
                          <td className="py-2.5 px-3 text-right"><div className="h-3.5 w-14 bg-[#E5E5EA] rounded ml-auto" /></td>
                          <td className="py-2.5 px-3 text-right"><div className="h-3.5 w-16 bg-[#E5E5EA] rounded ml-auto" /></td>
                          <td className="py-2.5 px-3 text-right"><div className="h-3.5 w-16 bg-[#E5E5EA] rounded ml-auto" /></td>
                          <td className="py-2.5 px-3 text-right"><div className="h-3.5 w-16 bg-[#E5E5EA] rounded ml-auto" /></td>
                          <td className="py-2.5 px-3 text-right"><div className="h-3.5 w-16 bg-[#E5E5EA] rounded ml-auto" /></td>
                          <td className="py-2.5 px-3 text-right"><div className="h-3.5 w-16 bg-[#E5E5EA] rounded ml-auto" /></td>
                          <td className="py-2.5 px-3"><div className="h-3.5 w-20 bg-[#E5E5EA] rounded" /></td>
                          <td className="py-2.5 px-3 text-right"><div className="h-3.5 w-18 bg-[#E5E5EA] rounded ml-auto" /></td>
                        </tr>
                      ))
                    ) : liveAudience.length === 0 ? (
                      <tr>
                        <td colSpan={22} className="py-12 text-center text-[#8E8E93] italic text-xs">
                          No properties match the selected audience filters.
                        </td>
                      </tr>
                    ) : isHierarchicalView ? (
                      ratepayerGroups.map((group) => {
                        const groupPropIds = group.properties.map((p) => p.id || p.accountNumber);
                        const selectedInGroup = group.properties.filter((p) =>
                          selectedSpecificAccounts.some((sel) => (sel.id || sel.accountNumber) === (p.id || p.accountNumber))
                        );
                        const isAllGroupSelected =
                          selectedInGroup.length === group.properties.length && group.properties.length > 0;
                        const isSomeGroupSelected = selectedInGroup.length > 0 && !isAllGroupSelected;
                        const isExpanded = !collapsedGroupKeys.has(group.key);

                        if (group.isMultiProperty) {
                          return (
                            <Fragment key={`group-frag-${group.key}`}>
                              {/* Ratepayer Portfolio Group Header */}
                              <tr
                                className="bg-[#F8F9FA] border-t border-b border-[#E5E5EA] transition-colors select-none hover:bg-[#F2F2F7]"
                              >
                                <td className="py-2.5 px-3 text-center border-l-4 border-[#007AFF] bg-[#F8F9FA] w-[48px]">
                                  <input
                                    type="checkbox"
                                    checked={isAllGroupSelected}
                                    ref={(el) => {
                                      if (el) el.indeterminate = isSomeGroupSelected;
                                    }}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      if (isAllGroupSelected) {
                                        setSelectedSpecificAccounts((prev) => {
                                          const idSet = new Set(groupPropIds);
                                          const remaining = prev.filter(
                                            (p) => !idSet.has(p.id || p.accountNumber)
                                          );
                                          if (remaining.length === 0) setAudienceScope("DATABASE_FILTER");
                                          return remaining;
                                        });
                                      } else {
                                        setSelectedSpecificAccounts((prev) => {
                                          const prevIds = new Set(prev.map((p) => p.id || p.accountNumber));
                                          const toAdd = group.properties.filter(
                                            (p) => !prevIds.has(p.id || p.accountNumber)
                                          );
                                          return [...prev, ...toAdd];
                                        });
                                        setAudienceScope("SELECTED");
                                      }
                                    }}
                                    className="w-3.5 h-3.5 rounded border-[#C7C7CC] text-[#007AFF] focus:ring-[#007AFF] accent-[#007AFF] cursor-pointer"
                                  />
                                </td>
                                <td colSpan={20} className="py-2 px-3">
                                  <div
                                    onClick={() => toggleGroupCollapse(group.key)}
                                    className="flex items-center gap-2 flex-wrap cursor-pointer"
                                  >
                                    <div className="relative">
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              toggleGroupCollapse(group.key);
                                            }}
                                            className="w-5 h-5 rounded border border-[#E5E5EA] bg-white text-[#1C1C1E] hover:bg-[#F2F2F7] hover:border-[#007AFF] flex items-center justify-center transition-colors shrink-0 shadow-2xs cursor-pointer"
                                          >
                                            <motion.div
                                              animate={{ rotate: isExpanded ? 0 : -90 }}
                                              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                                              className="flex items-center justify-center"
                                            >
                                              <ChevronDown className="w-3.5 h-3.5 text-[#1C1C1E]" />
                                            </motion.div>
                                          </button>
                                          {isExpanded && (
                                            <div className="absolute left-[9.5px] top-full h-2.5 w-px border-l border-dashed border-[#E5E5EA]" />
                                          )}
                                        </div>
                                      <span className="font-bold text-xs text-[#1C1C1E]">
                                        {group.ownerName}
                                      </span>
                                      <span className="text-[11px] font-mono text-[#6C6C70]">
                                        • {cleanDash(group.phone)}
                                      </span>

                                      <span className="text-[#E5E5EA] mx-0.5">|</span>
                                      <span className="text-[11px] font-semibold text-[#1C1C1E]">
                                        {group.properties.length} Accounts
                                      </span>

                                      {group.totalArrears > 0 && (
                                        <>
                                          <span className="text-[#E5E5EA] mx-0.5">|</span>
                                          <span className="text-[11px] font-semibold text-[#FF3B30]">
                                            Arrears: GH₵{" "}
                                            {group.totalArrears.toLocaleString("en-US", {
                                              minimumFractionDigits: 2,
                                            })}
                                          </span>
                                        </>
                                      )}
                                  </div>
                                </td>
                                <td
                                  onClick={() => toggleGroupCollapse(group.key)}
                                  className="py-2.5 px-3 text-right whitespace-nowrap font-bold text-xs text-[#1C1C1E] tabular-nums cursor-pointer relative truncate"
                                  title={`GH₵ ${group.totalAmountDue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
                                >
                                  {isExpanded && (
                                    <div className="absolute left-3 bottom-0 h-2.5 w-px border-l border-dashed border-[#E5E5EA]" />
                                  )}
                                  GH₵{" "}
                                  {group.totalAmountDue.toLocaleString("en-US", {
                                    minimumFractionDigits: 2,
                                  })}
                                </td>
                              </tr>

                              {/* Nested Properties with Collapsible Animation */}
                              <AnimatePresence initial={false}>
                                {isExpanded &&
                                  group.properties.map((prop, pIdx) => {
                                    const isLast = pIdx === group.properties.length - 1;
                                    const isSelected = selectedSpecificAccounts.some(
                                      (p) => (p.id || p.accountNumber) === (prop.id || prop.accountNumber)
                                    );

                                    return (
                                      <motion.tr
                                        key={prop.id || prop.accountNumber}
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ duration: 0.18, ease: "easeOut" }}
                                        onClick={() => {
                                          if (isSelected) {
                                            setSelectedSpecificAccounts((prev) => {
                                              const newSelection = prev.filter(
                                                (p) =>
                                                  (p.id || p.accountNumber) !==
                                                  (prop.id || prop.accountNumber)
                                              );
                                              if (newSelection.length === 0)
                                                setAudienceScope("DATABASE_FILTER");
                                              return newSelection;
                                            });
                                          } else {
                                            setSelectedSpecificAccounts((prev) => [...prev, prop]);
                                            setAudienceScope("SELECTED");
                                          }
                                        }}
                                        className={`transition-colors cursor-pointer border-b border-[#E5E5EA] ${
                                          isSelected ? "bg-[#007AFF]/10" : "bg-white hover:bg-[#F8F9FA]"
                                        }`}
                                      >
                                        <td className="py-2.5 px-3 text-center w-10 border-l-4 border-transparent">
                                          <input
                                            type="checkbox"
                                            checked={isSelected}
                                            readOnly
                                            className="w-3.5 h-3.5 rounded border-[#C7C7CC] text-[#007AFF] focus:ring-[#007AFF] accent-[#007AFF] cursor-pointer pointer-events-none"
                                          />
                                        </td>
                                        <td className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-[#007AFF] text-[11px] relative truncate">
                                          {/* Tree Guide Lines: Continuous Vertical Line & Horizontal Branch */}
                                          <div
                                            className={`absolute left-[22px] w-px border-l border-dashed border-[#E5E5EA] ${
                                              isLast ? "top-0 h-1/2" : "top-0 h-full"
                                            }`}
                                          />
                                          <div className="absolute left-[22px] top-1/2 w-4 border-t border-dashed border-[#E5E5EA]" />
                                          <span className="pl-8 inline-block font-mono font-bold text-[#007AFF] text-[11px] truncate max-w-full" title={cleanDash(prop.accountNumber)}>
                                            {cleanDash(prop.accountNumber)}
                                          </span>
                                        </td>
                                        <td className="py-2.5 px-3 whitespace-nowrap text-[11px] font-semibold text-[#1C1C1E] truncate" title={cleanDash(prop.ownerName)}>{cleanDash(prop.ownerName)}</td>
                                        <td className="py-2.5 px-3 whitespace-nowrap text-[11px] font-medium text-[#1C1C1E] truncate" title={cleanDash(prop.ownerPhone)}>{cleanDash(prop.ownerPhone)}</td>
                                        <td className="py-2.5 px-3 whitespace-nowrap font-mono font-medium text-[11px] text-[#1C1C1E] truncate" title={cleanDash(prop.id)}>{cleanDash(prop.id)}</td>
                                        <td className="py-2.5 px-3 whitespace-nowrap font-mono font-medium text-[11px] text-[#1C1C1E] truncate" title={cleanDash(prop.ownerDigitalAddress)}>{cleanDash(prop.ownerDigitalAddress)}</td>
                                        <td className="py-2.5 px-3 whitespace-nowrap text-[11px] font-medium text-[#1C1C1E] truncate" title={cleanDash(prop.houseNo)}>{cleanDash(prop.houseNo)}</td>
                                        <td className="py-2.5 px-3 whitespace-nowrap text-[11px] font-medium text-[#1C1C1E] truncate" title={cleanDash(prop.plotNo)}>{cleanDash(prop.plotNo)}</td>
                                        <td className="py-2.5 px-3 whitespace-nowrap text-[11px] font-medium text-[#1C1C1E] truncate" title={cleanDash(prop.valuationNo)}>{cleanDash(prop.valuationNo)}</td>
                                        <td className="py-2.5 px-3 whitespace-nowrap text-[11px] font-medium text-[#1C1C1E] truncate" title={cleanDash(prop.municipality)}>{cleanDash(prop.municipality)}</td>
                                        <td className="py-2.5 px-3 whitespace-nowrap text-[11px] font-medium text-[#1C1C1E] truncate" title={cleanDash(prop.propertyClassification)}>{cleanDash(prop.propertyClassification)}</td>
                                        <td className="py-2.5 px-3 whitespace-nowrap text-[11px] font-medium text-[#1C1C1E] truncate" title={String(prop.billYear || "—")}>{prop.billYear || "—"}</td>
                                        <td className="py-2.5 px-3 whitespace-nowrap text-[11px] font-medium text-[#1C1C1E] truncate" title={String(prop.billDateFormatted || "—")}>{prop.billDateFormatted || "—"}</td>
                                        <td className="py-2.5 px-3 text-right whitespace-nowrap text-[11px] font-semibold text-[#1C1C1E] tabular-nums truncate" title={String(prop.rateableValueFormatted || "—")}>{prop.rateableValueFormatted || "—"}</td>
                                        <td className="py-2.5 px-3 text-right whitespace-nowrap text-[11px] font-semibold text-[#1C1C1E] tabular-nums truncate" title={String(prop.rateImposed ?? "—")}>{prop.rateImposed ?? "—"}</td>
                                        <td className="py-2.5 px-3 text-right whitespace-nowrap text-[11px] font-semibold text-[#1C1C1E] tabular-nums truncate" title={String(prop.previousYearBillFormatted || "—")}>{prop.previousYearBillFormatted || "—"}</td>
                                        <td className="py-2.5 px-3 text-right whitespace-nowrap text-[11px] font-semibold text-[#1C1C1E] tabular-nums truncate" title={`GH₵ ${(Number(prop.amountPaidLastYear || 0)).toLocaleString("en-US", { minimumFractionDigits: 2 })}`}>GH₵ {(Number(prop.amountPaidLastYear || 0)).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                                        <td className="py-2.5 px-3 text-right whitespace-nowrap text-[11px] font-semibold text-[#1C1C1E] tabular-nums truncate" title={String(prop.arrearsFormatted || "—")}><span className={prop.arrears > 0 ? "text-[#FF3B30] font-semibold" : ""}>{prop.arrearsFormatted || "—"}</span></td>
                                        <td className="py-2.5 px-3 text-right whitespace-nowrap text-[11px] font-semibold text-[#1C1C1E] tabular-nums truncate" title={`GH₵ ${(Number(prop.currentFee || 0)).toLocaleString("en-US", { minimumFractionDigits: 2 })}`}>GH₵ {(Number(prop.currentFee || 0)).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                                        <td className="py-2.5 px-3 text-right whitespace-nowrap text-[11px] font-semibold text-[#1C1C1E] tabular-nums truncate" title={`GH₵ ${(Number(prop.totalAmountDue || 0)).toLocaleString("en-US", { minimumFractionDigits: 2 })}`}>GH₵ {(Number(prop.totalAmountDue || 0)).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                                        <td className="py-2.5 px-3 whitespace-nowrap text-[11px] font-medium text-[#1C1C1E] truncate" title={cleanDash(prop.electoralArea)}>{cleanDash(prop.electoralArea)}</td>
                                        <td className="py-2.5 px-3 text-right whitespace-nowrap text-[11px] text-[#6C6C70] tabular-nums font-normal relative truncate">
                                          {/* Tree Guide Lines for Outstanding Amt */}
                                          <div
                                            className={`absolute left-3 w-px border-l border-dashed border-[#E5E5EA] ${
                                              isLast ? "top-0 h-1/2" : "top-0 h-full"
                                            }`}
                                          />
                                          <div className="absolute left-3 top-1/2 w-3 border-t border-dashed border-[#E5E5EA]" />
                                          <span title={`GH₵ ${(Number(prop.totalAmountDue || 0)).toLocaleString("en-US", { minimumFractionDigits: 2 })}`}>
                                            GH₵ {(Number(prop.totalAmountDue || 0)).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                          </span>
                                        </td>
                                      </motion.tr>
                                      );
                                    })}
                              </AnimatePresence>
                            </Fragment>
                          );
                        }

                        // Single property ratepayer (standard row)
                        const prop = group.properties[0];
                        if (!prop) return null;
                        const isSelected = selectedSpecificAccounts.some(
                          (p) => (p.id || p.accountNumber) === (prop.id || prop.accountNumber)
                        );

                        return (
                          <tr
                            key={prop.id || prop.accountNumber}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedSpecificAccounts((prev) => {
                                  const newSelection = prev.filter(
                                    (p) =>
                                      (p.id || p.accountNumber) !==
                                      (prop.id || prop.accountNumber)
                                  );
                                  if (newSelection.length === 0) setAudienceScope("DATABASE_FILTER");
                                  return newSelection;
                                });
                              } else {
                                setSelectedSpecificAccounts((prev) => [...prev, prop]);
                                setAudienceScope("SELECTED");
                              }
                            }}
                            className={`transition-colors cursor-pointer border-b border-[#E5E5EA] ${isSelected ? "bg-[#007AFF]/10" : "bg-white hover:bg-[#F8F9FA]"}`}
                          >
                            <td className="py-2.5 px-3 text-center w-10 border-l-4 border-transparent">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                readOnly
                                className="w-3.5 h-3.5 rounded border-[#C7C7CC] text-[#007AFF] focus:ring-[#007AFF] accent-[#007AFF] cursor-pointer pointer-events-none"
                              />
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-[#007AFF] text-[11px] truncate" title={cleanDash(prop.accountNumber)}>{cleanDash(prop.accountNumber)}</td>
                            <td className="py-2.5 px-3 whitespace-nowrap text-[11px] font-semibold text-[#1C1C1E] truncate" title={cleanDash(prop.ownerName)}>{cleanDash(prop.ownerName)}</td>
                            <td className="py-2.5 px-3 whitespace-nowrap text-[11px] font-medium text-[#1C1C1E] truncate" title={cleanDash(prop.ownerPhone)}>{cleanDash(prop.ownerPhone)}</td>
                            <td className="py-2.5 px-3 whitespace-nowrap font-mono font-medium text-[11px] text-[#1C1C1E] truncate" title={cleanDash(prop.id)}>{cleanDash(prop.id)}</td>
                            <td className="py-2.5 px-3 whitespace-nowrap font-mono font-medium text-[11px] text-[#1C1C1E] truncate" title={cleanDash(prop.ownerDigitalAddress)}>{cleanDash(prop.ownerDigitalAddress)}</td>
                            <td className="py-2.5 px-3 whitespace-nowrap text-[11px] font-medium text-[#1C1C1E] truncate" title={cleanDash(prop.houseNo)}>{cleanDash(prop.houseNo)}</td>
                            <td className="py-2.5 px-3 whitespace-nowrap text-[11px] font-medium text-[#1C1C1E] truncate" title={cleanDash(prop.plotNo)}>{cleanDash(prop.plotNo)}</td>
                            <td className="py-2.5 px-3 whitespace-nowrap text-[11px] font-medium text-[#1C1C1E] truncate" title={cleanDash(prop.valuationNo)}>{cleanDash(prop.valuationNo)}</td>
                            <td className="py-2.5 px-3 whitespace-nowrap text-[11px] font-medium text-[#1C1C1E] truncate" title={cleanDash(prop.municipality)}>{cleanDash(prop.municipality)}</td>
                            <td className="py-2.5 px-3 whitespace-nowrap text-[11px] font-medium text-[#1C1C1E] truncate" title={cleanDash(prop.propertyClassification)}>{cleanDash(prop.propertyClassification)}</td>
                            <td className="py-2.5 px-3 whitespace-nowrap text-[11px] font-medium text-[#1C1C1E] truncate" title={cleanDash(prop.billYear)}>{cleanDash(prop.billYear)}</td>
                            <td className="py-2.5 px-3 whitespace-nowrap text-[11px] font-medium text-[#1C1C1E] truncate" title={cleanDash(prop.billDateFormatted)}>{cleanDash(prop.billDateFormatted)}</td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap text-[11px] font-semibold text-[#1C1C1E] tabular-nums truncate" title={String(prop.rateableValueFormatted || "—")}>{prop.rateableValueFormatted || "—"}</td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap text-[11px] font-semibold text-[#1C1C1E] tabular-nums truncate" title={String(prop.rateImposed ?? "—")}>{prop.rateImposed ?? "—"}</td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap text-[11px] font-semibold text-[#1C1C1E] tabular-nums truncate" title={String(prop.previousYearBillFormatted || "—")}>{prop.previousYearBillFormatted || "—"}</td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap text-[11px] font-semibold text-[#1C1C1E] tabular-nums truncate" title={`GH₵ ${(Number(prop.amountPaidLastYear || 0)).toLocaleString("en-US", { minimumFractionDigits: 2 })}`}>GH₵ {(Number(prop.amountPaidLastYear || 0)).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap text-[11px] font-semibold text-[#1C1C1E] tabular-nums truncate" title={String(prop.arrearsFormatted || "—")}><span className={prop.arrears > 0 ? "text-[#FF3B30] font-semibold" : ""}>{prop.arrearsFormatted || "—"}</span></td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap text-[11px] font-semibold text-[#1C1C1E] tabular-nums truncate" title={`GH₵ ${(Number(prop.currentFee || 0)).toLocaleString("en-US", { minimumFractionDigits: 2 })}`}>GH₵ {(Number(prop.currentFee || 0)).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap text-[11px] font-semibold text-[#1C1C1E] tabular-nums truncate" title={`GH₵ ${(Number(prop.totalAmountDue || 0)).toLocaleString("en-US", { minimumFractionDigits: 2 })}`}>GH₵ {(Number(prop.totalAmountDue || 0)).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                            <td className="py-2.5 px-3 whitespace-nowrap text-[11px] font-medium text-[#1C1C1E] truncate" title={cleanDash(prop.electoralArea)}>{cleanDash(prop.electoralArea)}</td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap font-bold text-[#1C1C1E] text-[11px] tabular-nums truncate" title={`GH₵ ${(Number(prop.totalAmountDue || 0)).toLocaleString("en-US", { minimumFractionDigits: 2 })}`}>GH₵ {(Number(prop.totalAmountDue || 0)).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                          </tr>
                        );
                      })
                    ) : (
                      liveAudience.map((prop) => {
                        const isSelected = selectedSpecificAccounts.some(
                          (p) => (p.id || p.accountNumber) === (prop.id || prop.accountNumber)
                        );

                        return (
                          <tr 
                            key={prop.id || prop.accountNumber} 
                            onClick={() => {
                              if (isSelected) {
                                setSelectedSpecificAccounts((prev) => {
                                  const newSelection = prev.filter(p => (p.id || p.accountNumber) !== (prop.id || prop.accountNumber));
                                  if (newSelection.length === 0) setAudienceScope("DATABASE_FILTER");
                                  return newSelection;
                                });
                              } else {
                                setSelectedSpecificAccounts((prev) => [...prev, prop]);
                                setAudienceScope("SELECTED");
                              }
                            }}
                            className={`transition-colors cursor-pointer border-b border-[#E5E5EA] ${isSelected ? 'bg-[#007AFF]/10 text-[#1C1C1E]' : 'hover:bg-[#F8F9FA]'}`}
                          >
                            <td className="py-2.5 px-3 text-center w-10 border-l-4 border-transparent">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                readOnly
                                className="w-3.5 h-3.5 rounded border-[#C7C7CC] text-[#007AFF] focus:ring-[#007AFF] accent-[#007AFF] cursor-pointer pointer-events-none"
                              />
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-[#007AFF] text-[11px] truncate" title={cleanDash(prop.accountNumber)}>{cleanDash(prop.accountNumber)}</td>
                            <td className="py-2.5 px-3 whitespace-nowrap text-[11px] font-semibold text-[#1C1C1E] truncate" title={cleanDash(prop.ownerName)}>{cleanDash(prop.ownerName)}</td>
                            <td className="py-2.5 px-3 whitespace-nowrap text-[11px] font-medium text-[#1C1C1E] truncate" title={cleanDash(prop.ownerPhone)}>{cleanDash(prop.ownerPhone)}</td>
                            <td className="py-2.5 px-3 whitespace-nowrap font-mono font-medium text-[11px] text-[#1C1C1E] truncate" title={cleanDash(prop.id)}>{cleanDash(prop.id)}</td>
                            <td className="py-2.5 px-3 whitespace-nowrap font-mono font-medium text-[11px] text-[#1C1C1E] truncate" title={cleanDash(prop.ownerDigitalAddress)}>{cleanDash(prop.ownerDigitalAddress)}</td>
                            <td className="py-2.5 px-3 whitespace-nowrap text-[11px] font-medium text-[#1C1C1E] truncate" title={cleanDash(prop.houseNo)}>{cleanDash(prop.houseNo)}</td>
                            <td className="py-2.5 px-3 whitespace-nowrap text-[11px] font-medium text-[#1C1C1E] truncate" title={cleanDash(prop.plotNo)}>{cleanDash(prop.plotNo)}</td>
                            <td className="py-2.5 px-3 whitespace-nowrap text-[11px] font-medium text-[#1C1C1E] truncate" title={cleanDash(prop.valuationNo)}>{cleanDash(prop.valuationNo)}</td>
                            <td className="py-2.5 px-3 whitespace-nowrap text-[11px] font-medium text-[#1C1C1E] truncate" title={cleanDash(prop.municipality)}>{cleanDash(prop.municipality)}</td>
                            <td className="py-2.5 px-3 whitespace-nowrap text-[11px] font-medium text-[#1C1C1E] truncate" title={cleanDash(prop.propertyClassification)}>{cleanDash(prop.propertyClassification)}</td>
                            <td className="py-2.5 px-3 whitespace-nowrap text-[11px] font-medium text-[#1C1C1E] truncate" title={cleanDash(prop.billYear)}>{cleanDash(prop.billYear)}</td>
                            <td className="py-2.5 px-3 whitespace-nowrap text-[11px] font-medium text-[#1C1C1E] truncate" title={cleanDash(prop.billDateFormatted)}>{cleanDash(prop.billDateFormatted)}</td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap text-[11px] font-semibold text-[#1C1C1E] tabular-nums truncate" title={String(prop.rateableValueFormatted || "—")}>{prop.rateableValueFormatted || "—"}</td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap text-[11px] font-semibold text-[#1C1C1E] tabular-nums truncate" title={String(prop.rateImposed ?? "—")}>{prop.rateImposed ?? "—"}</td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap text-[11px] font-semibold text-[#1C1C1E] tabular-nums truncate" title={String(prop.previousYearBillFormatted || "—")}>{prop.previousYearBillFormatted || "—"}</td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap text-[11px] font-semibold text-[#1C1C1E] tabular-nums truncate" title={`GH₵ ${(Number(prop.amountPaidLastYear || 0)).toLocaleString("en-US", { minimumFractionDigits: 2 })}`}>GH₵ {(Number(prop.amountPaidLastYear || 0)).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap text-[11px] font-semibold text-[#1C1C1E] tabular-nums truncate" title={String(prop.arrearsFormatted || "—")}><span className={prop.arrears > 0 ? "text-[#FF3B30] font-semibold" : ""}>{prop.arrearsFormatted || "—"}</span></td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap text-[11px] font-semibold text-[#1C1C1E] tabular-nums truncate" title={`GH₵ ${(Number(prop.currentFee || 0)).toLocaleString("en-US", { minimumFractionDigits: 2 })}`}>GH₵ {(Number(prop.currentFee || 0)).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap text-[11px] font-semibold text-[#1C1C1E] tabular-nums truncate" title={`GH₵ ${(Number(prop.totalAmountDue || 0)).toLocaleString("en-US", { minimumFractionDigits: 2 })}`}>GH₵ {(Number(prop.totalAmountDue || 0)).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                            <td className="py-2.5 px-3 whitespace-nowrap text-[11px] font-medium text-[#1C1C1E] truncate" title={cleanDash(prop.electoralArea)}>{cleanDash(prop.electoralArea)}</td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap font-bold text-[#1C1C1E] text-[11px] tabular-nums truncate" title={`GH₵ ${(Number(prop.totalAmountDue || 0)).toLocaleString("en-US", { minimumFractionDigits: 2 })}`}>GH₵ {(Number(prop.totalAmountDue || 0)).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                          </tr>
                        );
                      })
                    )}

                  </tbody>
                </table>
              </div>

              {/* Supabase Studio-Style Table Pagination Bar */}
              <SupabaseTablePagination
                currentPage={audiencePage}
                totalPages={Math.max(1, Math.ceil(totalAudienceCount / audienceLimit))}
                totalRecords={totalAudienceCount}
                pageSize={audienceLimit}
                pageSizeOptions={[25, 50, 100]}
                onPageChange={handleAudiencePageChange}
                onPageSizeChange={handleAudiencePageSizeChange}
                isLoading={isLoadingAudience}
                entityLabel="properties"
              />
            </div>
          </div>
        </div>

        {/* PANE 2: DELIVERY LOGS */}
        <div className="w-1/2 h-full flex flex-col min-h-0 p-0 overflow-hidden relative bg-[#F2F2F7]">
          <div className="h-full flex flex-col overflow-hidden bg-white border-0 rounded-none shadow-none">
            <div className="p-3 border-b border-[#E5E5EA] bg-[#F8F9FA] flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setActiveView("SIMULATOR")}
                className="h-7.5 px-2.5 rounded-lg border border-[#E5E5EA] text-xs font-semibold text-[#1C1C1E] bg-white hover:bg-[#F2F2F7] transition-colors flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Back to Engine</span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportLogs}
                  className="h-7.5 px-2.5 rounded-lg border border-[#E5E5EA] text-xs font-semibold text-[#007AFF] bg-white hover:bg-[#F2F2F7] transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Export SMS Rollout Logs CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Logs CSV</span>
                </button>
                <span className="text-xs text-[#6C6C70]">{logsList.length} total entries</span>
              </div>
            </div>

            {/* Delivery Logs Container */}
            <div
              ref={logsTableContainerRef}
              className="flex-1 min-h-0 overflow-auto"
            >
              <table className="min-w-[700px] w-full text-left text-xs border-collapse">
                  <thead className="border-b text-[#6C6C70] sticky top-0 bg-[#F8F9FA] border-[#E5E5EA]">
                    <tr>
                      <th className="py-2.5 px-3">Timestamp</th>
                      <th className="py-2.5 px-3">Recipient</th>
                      <th className="py-2.5 px-3">Notice</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E5EA]">
                    {logsList.map((log) => (
                      <tr key={log.id} className="hover:bg-[#F8F9FA] transition-colors">
                        <td className="py-2.5 px-3 text-xs font-medium text-[#1C1C1E]">{log.createdAtFormatted}</td>
                        <td className="py-2.5 px-3 text-xs font-semibold text-[#1C1C1E]">{log.recipientName} ({log.recipientPhone})</td>
                        <td className="py-2.5 px-3 text-xs text-[#1C1C1E] font-medium truncate max-w-xs">{log.message}</td>
                        <td className={`py-2.5 px-3 text-center text-xs font-bold ${log.deliveryStatus === "DELIVERED" ? "text-[#34C759]" : log.deliveryStatus === "FAILED" ? "text-[#FF3B30]" : "text-[#FF9500]"}`}>{log.deliveryStatus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Delivery Logs Supabase-Style Table Pagination Bar */}
              <SupabaseTablePagination
                currentPage={logsPage}
                totalPages={Math.max(1, Math.ceil(logsTotal / logsLimit))}
                totalRecords={logsTotal}
                pageSize={logsLimit}
                pageSizeOptions={[25, 50, 100]}
                onPageChange={handleLogsPageChange}
                onPageSizeChange={handleLogsPageSizeChange}
                isLoading={isLoadingLogs}
                entityLabel="dispatches"
              />
            </div>
          </div>
        </motion.div>

      {/* Message Template Configuration Modal Popup */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-md font-sans">
          <div className="rounded-2xl max-w-2xl w-full shadow-2xl flex flex-col overflow-hidden max-h-[90vh] bg-white border border-[#E5E5EA]">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-[#E5E5EA] bg-[#F8F9FA] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#007AFF]" />
                <div>
                  <h3 className="text-sm font-bold text-[#1C1C1E]">
                    Message Template &amp; Dynamic Tokens
                  </h3>
                  <p className="text-[11px] text-[#6C6C70]">
                    Customise the outbound notice text with dynamic property and balance tokens.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTemplateModal(false)}
                className="text-[#8E8E93] hover:text-[#1C1C1E] p-1 rounded-lg hover:bg-[#E5E5EA] cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1 bg-white">
              {/* Type and Presets Row */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E5E5EA] pb-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-[#1C1C1E]">Template Type:</span>
                  <div className="flex items-center gap-1">
                    <select
                      value={activeTemplateType === "RECEIPT" ? "RECEIPT" : targetStatus}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "RECEIPT") {
                          setActiveTemplateType("RECEIPT");
                        } else {
                          setActiveTemplateType("BILLING");
                          handleStatusChange(val as any);
                        }
                      }}
                      className="bg-[#F2F2F7] text-[#007AFF] border border-[#E5E5EA] rounded-md px-2 py-1 text-xs font-medium focus:outline-none focus:border-[#007AFF] cursor-pointer"
                    >
                      <option value="UNPAID">Annual Bill (Unpaid)</option>
                      <option value="ALL">General Notice (All)</option>
                      <option value="PAID">Settlement Clearance (Paid)</option>
                      <option value="OVERPAID">Credit Statement (Overpaid)</option>
                      <option value="RECEIPT">Payment Receipt Notice</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* INSERT TOKENS BUTTON & POPOVER */}
                  <div className="relative">
                    <button
                      ref={tokenInserterBtnRef}
                      type="button"
                      onClick={() => setShowTokenInserter((prev) => !prev)}
                      className="h-6 px-2 rounded-md bg-[#F2F2F7] hover:bg-[#E5E5EA] border border-[#E5E5EA] text-[10px] font-semibold text-[#1C1C1E] flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Code2 className="w-3 h-3 text-[#007AFF]" />
                      <span>Insert Token</span>
                      <ChevronDown className="w-2.5 h-2.5" />
                    </button>

                    {showTokenInserter && (
                      <div
                        ref={tokenInserterRef}
                        className="absolute right-0 top-full mt-1 w-64 z-50 rounded-xl border border-[#E5E5EA] bg-white/95 backdrop-blur-xl shadow-xl p-2 space-y-1 font-sans text-xs"
                      >
                        <div className="text-[10px] font-bold text-[#6C6C70] uppercase px-1 pb-1 border-b border-[#E5E5EA]">
                          Insert Dynamic Token
                        </div>
                        <div className="max-h-48 overflow-y-auto space-y-0.5">
                          {dynamicTokens.map((t) => (
                            <button
                              key={t.tag}
                              type="button"
                              onClick={() => {
                                const el = templateTextareaRef.current;
                                if (el) {
                                  const start = el.selectionStart;
                                  const end = el.selectionEnd;
                                  const text = currentTemplate;
                                  const updated = text.substring(0, start) + t.tag + text.substring(end);
                                  if (activeTemplateType === "BILLING") {
                                    setMessageTemplate(updated);
                                  } else {
                                    setReceiptTemplate(updated);
                                  }
                                  setShowTokenInserter(false);
                                  setTimeout(() => {
                                    el.focus();
                                    el.setSelectionRange(start + t.tag.length, start + t.tag.length);
                                  }, 50);
                                }
                              }}
                              className="w-full text-left px-2 py-1 rounded hover:bg-[#F2F2F7] text-[11px] flex items-center justify-between group cursor-pointer"
                            >
                              <span className="font-mono text-[#007AFF] font-semibold text-[10px]">{t.tag}</span>
                              <span className="text-[10px] text-[#6C6C70] group-hover:text-[#1C1C1E]">{t.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* SAVED TEMPLATES / PRESETS BUTTON & POPOVER */}
                  <div className="relative">
                    <button
                      ref={savedTemplatesBtnRef}
                      type="button"
                      onClick={() => setShowSavedTemplates((prev) => !prev)}
                      className="h-6 px-2 rounded-md bg-[#F2F2F7] hover:bg-[#E5E5EA] border border-[#E5E5EA] text-[10px] font-medium text-[#1C1C1E] flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Bookmark className="w-3 h-3 text-[#007AFF]" />
                      <span>Saved Presets</span>
                      <ChevronDown className="w-2.5 h-2.5" />
                    </button>

                    {showSavedTemplates && (
                      <div
                        ref={savedTemplatesRef}
                        className="absolute right-0 top-full mt-1 w-72 z-50 rounded-xl border border-[#E5E5EA] bg-white/95 backdrop-blur-xl shadow-xl p-2 space-y-1 font-sans text-xs"
                      >
                        <div className="text-[10px] font-bold text-[#6C6C70] uppercase px-1 pb-1 border-b border-[#E5E5EA]">
                          Load Template Preset
                        </div>
                        <div className="max-h-56 overflow-y-auto space-y-1">
                          {savedTemplates
                            .filter((st) => st.type === activeTemplateType)
                            .map((st) => (
                              <button
                                key={st.id}
                                type="button"
                                onClick={() => {
                                  if (activeTemplateType === "BILLING") {
                                    setMessageTemplate(st.content);
                                    if ((st as any).filterKey && (st as any).filterKey !== "RECEIPT") {
                                      setTargetStatus((st as any).filterKey);
                                    }
                                  } else {
                                    setReceiptTemplate(st.content);
                                  }
                                  setShowSavedTemplates(false);
                                }}
                                className="w-full text-left p-1.5 rounded hover:bg-[#F2F2F7] border border-[#E5E5EA] cursor-pointer transition-colors"
                              >
                                <span className="font-semibold text-[#007AFF] text-[11px] block">{st.name}</span>
                                <span className="text-[10px] text-[#6C6C70] line-clamp-1 font-mono">{st.content}</span>
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <span className="text-[11px] text-[#6C6C70] font-mono">{currentTemplate.length} chars</span>
                </div>
              </div>

              {/* Textarea */}
              <div>
                <textarea
                  ref={templateTextareaRef}
                  value={currentTemplate}
                  onChange={(e) =>
                    activeTemplateType === "BILLING"
                      ? setMessageTemplate(e.target.value)
                      : setReceiptTemplate(e.target.value)
                  }
                  rows={6}
                  className="w-full p-3 rounded-lg border border-[#E5E5EA] bg-[#F2F2F7] text-xs text-[#1C1C1E] focus:outline-none focus:border-[#007AFF] focus:bg-white resize-y font-mono leading-relaxed"
                  placeholder="Type or customize your SMS message template here..."
                />
              </div>

              {/* Dynamic Tokens Guide Strip */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-semibold text-[#6C6C70] uppercase tracking-wider block">
                  Click token below to insert into template:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {dynamicTokens.map((t) => (
                    <button
                      key={t.tag}
                      type="button"
                      onClick={() => {
                        const el = templateTextareaRef.current;
                        if (el) {
                          const start = el.selectionStart;
                          const end = el.selectionEnd;
                          const text = currentTemplate;
                          const updated = text.substring(0, start) + t.tag + text.substring(end);
                          if (activeTemplateType === "BILLING") {
                            setMessageTemplate(updated);
                          } else {
                            setReceiptTemplate(updated);
                          }
                          setTimeout(() => {
                            el.focus();
                            el.setSelectionRange(start + t.tag.length, start + t.tag.length);
                          }, 50);
                        }
                      }}
                      className="text-[10px] font-mono px-2 py-0.5 rounded border border-[#E5E5EA] bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[#007AFF] font-medium cursor-pointer transition-colors"
                      title={t.label}
                    >
                      {t.tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t flex items-center justify-between shrink-0 bg-[#F8F9FA] border-[#E5E5EA]">
              <button
                type="button"
                onClick={() => setShowTemplateModal(false)}
                className="border border-[#E5E5EA] bg-white text-[#1C1C1E] hover:bg-[#F2F2F7] font-medium h-8 px-3.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await handleSaveTemplate();
                  setShowTemplateModal(false);
                }}
                disabled={isSavingTemplate}
                className="bg-[#007AFF] hover:bg-[#007AFF]/90 text-white font-semibold shadow-xs h-8 px-4 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{isSavingTemplate ? "Saving..." : "Save & Apply Template"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Security Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-md font-sans">
          <div className="rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl transition-all bg-white border border-[#E5E5EA]">
            <h3 className="text-sm font-semibold text-[#1C1C1E]">Authorize Rollout Dispatch</h3>
            <p className="text-xs text-[#6C6C70]">
              Targeting <span className="font-bold text-[#1C1C1E]">{effectiveRolloutCount.toLocaleString()}</span> properties {audienceScope === "SELECTED" ? "(manually selected)" : "matching active filter criteria"} with total outstanding due of <span className="font-bold text-[#1C1C1E]">{effectiveRolloutTotalDueFormatted}</span>.
            </p>
            
            {(() => {
              const estCreditsNeeded = unpaidTargets.length * (Math.ceil((currentTemplate.length + 50) / 160) || 1);
              const hasEnoughBalance = gatewayBalance ? gatewayBalance.smsBalance >= estCreditsNeeded : false;
              const isInsufficient = !!(gatewayBalance && !hasEnoughBalance);
              const isButtonDisabled = Boolean(isAuthorizing || !adminPassword.trim() || isFetchingBalance || isInsufficient);

              return (
                <>
                  <div className="bg-[#F8F9FA] rounded-xl p-3.5 border border-[#E5E5EA] space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#6C6C70] font-medium">Gateway Balance (Arkesel):</span>
                      {isFetchingBalance ? (
                        <span className="text-[#007AFF] flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Fetching...</span>
                      ) : gatewayBalance ? (
                        <span className="font-semibold text-[#34C759]">
                          {gatewayBalance.smsBalance} SMS ({gatewayBalance.mainBalance})
                        </span>
                      ) : (
                        <span className="text-[#FF3B30] font-semibold">Unavailable</span>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#6C6C70] font-medium">Est. Credits Needed:</span>
                      <span className={`font-semibold ${isInsufficient ? "text-[#FF3B30]" : "text-[#1C1C1E]"}`}>
                        {estCreditsNeeded.toLocaleString()} SMS
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#6C6C70] font-medium">Est. Dispatch Cost:</span>
                      <span className="font-bold text-[#007AFF]">
                        GH₵ {(estCreditsNeeded * 0.035).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {isInsufficient && (
                    <div className="bg-[#FF3B30]/10 border border-[#FF3B30]/30 text-[#FF3B30] px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 mt-4">
                      <span>⚠️</span>
                      Insufficient Arkesel gateway balance for this rollout.
                    </div>
                  )}

                  <div className="mt-4 space-y-4">
                    <input
                      type="password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="Enter administrator password"
                      autoComplete="new-password"
                      data-lpignore="true"
                      data-form-type="other"
                      className="w-full h-9 px-3 rounded-lg border border-[#E5E5EA] bg-[#F2F2F7] text-xs text-[#1C1C1E] focus:outline-none focus:border-[#007AFF] focus:bg-white"
                    />
                    {authError && <p className="text-xs text-[#FF3B30]">{authError}</p>}
                    
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAuthModal(false)}
                        className="border border-[#E5E5EA] bg-white text-[#1C1C1E] hover:bg-[#F2F2F7] font-medium h-8 px-3 rounded-lg text-xs cursor-pointer transition-colors"
                        disabled={isAuthorizing}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmAuthorization}
                        disabled={isButtonDisabled}
                        className="bg-[#007AFF] hover:bg-[#007AFF]/90 text-white font-semibold shadow-xs h-8 px-4 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {isAuthorizing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                        <span>Dispatch SMS</span>
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
export default SmsRolloutSimulator;