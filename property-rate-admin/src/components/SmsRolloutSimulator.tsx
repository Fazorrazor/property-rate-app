"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  Send,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  MessageSquare,
  FileText,
  CreditCard,
  Phone,
  Clock,
  Sparkles,
  Info,
  Lock,
  ShieldCheck,
  Eye,
  EyeOff,
  Loader2,
  X,
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { AdminProperty, SmsRolloutLogItem, getSmsRolloutAudience } from "@/app/actions";
import { motion, AnimatePresence } from "framer-motion";

interface SmsRolloutSimulatorProps {
  properties: AdminProperty[];
  smsLogs: SmsRolloutLogItem[];
  onTriggerBatchRollout: (accountNumbers: string[], template: string, password?: string) => Promise<{ success: boolean; error?: string } | void>;
  isProcessing: boolean;
  selectedProperties?: AdminProperty[];
  onClearSelectedProperties?: () => void;
}

export function SmsRolloutSimulator({
  properties,
  smsLogs,
  onTriggerBatchRollout,
  isProcessing,
  selectedProperties = [],
  onClearSelectedProperties,
}: SmsRolloutSimulatorProps) {
  // Active View Pane: 'SIMULATOR' (SMS rollout engine & phone) vs 'LOGS' (audit delivery table)
  const [activeView, setActiveView] = useState<"SIMULATOR" | "LOGS">("SIMULATOR");

  // Campaign Scope: 'SELECTED' (explicit user selection) vs 'DATABASE_FILTER' (full MMDA query)
  const [audienceScope, setAudienceScope] = useState<"SELECTED" | "DATABASE_FILTER">(
    selectedProperties && selectedProperties.length > 0 ? "SELECTED" : "DATABASE_FILTER"
  );

  // Specific Account Search & Multi-Selection States
  const [accountSearchQuery, setAccountSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<AdminProperty[]>([]);
  const [isSearchingSpecificAccounts, setIsSearchingSpecificAccounts] = useState(false);
  const [selectedSpecificAccounts, setSelectedSpecificAccounts] = useState<AdminProperty[]>(
    selectedProperties && selectedProperties.length > 0 ? selectedProperties : []
  );

  // Sync scope and specific accounts when selectedProperties prop changes
  useEffect(() => {
    if (selectedProperties && selectedProperties.length > 0) {
      setSelectedSpecificAccounts(selectedProperties);
      setAudienceScope("SELECTED");
    }
  }, [selectedProperties]);

  // Campaign Filter States
  const [targetMunicipality, setTargetMunicipality] = useState("ALL");
  const [targetClassification, setTargetClassification] = useState("ALL");
  const [targetStatus, setTargetStatus] = useState<"ALL" | "UNPAID" | "DEFAULTER">("UNPAID");

  // Dynamic Full Database Audience State
  const [liveAudience, setLiveAudience] = useState<AdminProperty[]>(properties);
  const [isLoadingAudience, setIsLoadingAudience] = useState(false);

  // Security Authorization Modal States
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthorizing, setIsAuthorizing] = useState(false);

  // Template State & Focus Modal
  const defaultTemplate =
    "Dear {{municipality}} Resident,\n\nDo find below your {{billYear}} Property Rate bill:\n\nValuation ID: {{accountNumber}}\n\nAmount due: GH₵ {{totalAmountDue}}\n\nView your bills: {{billLink}}\n\nPay Via *227*4362# or {{paymentLink}} with your payment reference {{accountNumber}}\n\nFor payment & enquiries kindly call 0256039385/0538702445\nDisregard if already paid. Keep receipt for verification.";

  const [messageTemplate, setMessageTemplate] = useState(defaultTemplate);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [draftTemplate, setDraftTemplate] = useState(defaultTemplate);
  const modalTextareaRef = useRef<HTMLTextAreaElement>(null);

  const dynamicTokens = [
    { tag: "{{municipality}}", label: "Municipality" },
    { tag: "{{billYear}}", label: "Bill Year" },
    { tag: "{{accountNumber}}", label: "Valuation ID / Account No." },
    { tag: "{{ownerName}}", label: "Ratepayer Name" },
    { tag: "{{totalAmountDue}}", label: "Total Due" },
    { tag: "{{arrears}}", label: "Arrears" },
    { tag: "{{currentFee}}", label: "Current Fee" },
    { tag: "{{billLink}}", label: "Link 1: View Bill" },
    { tag: "{{paymentLink}}", label: "Link 2: In-App Pay" },
    { tag: "{{dueDate}}", label: "Due Date" },
  ];

  const [dueDate, setDueDate] = useState("30-Jun-2025");
  const [previewAccountIndex, setPreviewAccountIndex] = useState(0);

  // Live Debounced Server Search for Specific Accounts
  useEffect(() => {
    if (!accountSearchQuery.trim()) {
      setSearchResults([]);
      setIsSearchingSpecificAccounts(false);
      return;
    }
    setIsSearchingSpecificAccounts(true);
    const timer = setTimeout(async () => {
      try {
        const res = await getSmsRolloutAudience({
          searchQuery: accountSearchQuery.trim(),
          status: "ALL",
        });
        if (res) {
          setSearchResults(res.properties);
        }
      } catch (err) {
        console.error("Error searching specific accounts:", err);
      } finally {
        setIsSearchingSpecificAccounts(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [accountSearchQuery]);

  const handleToggleSpecificAccount = (account: AdminProperty) => {
    setSelectedSpecificAccounts((prev) => {
      const exists = prev.some((p) => p.accountNumber === account.accountNumber);
      if (exists) {
        return prev.filter((p) => p.accountNumber !== account.accountNumber);
      } else {
        return [...prev, account];
      }
    });
    setAudienceScope("SELECTED");
    setPreviewAccountIndex(0);
  };

  const handleClearSpecificAccounts = () => {
    setSelectedSpecificAccounts([]);
    if (onClearSelectedProperties) onClearSelectedProperties();
    setAudienceScope("DATABASE_FILTER");
    setPreviewAccountIndex(0);
  };

  // Fetch full dynamic audience across the entire database whenever filters change
  useEffect(() => {
    let isCancelled = false;
    const fetchAudience = async () => {
      setIsLoadingAudience(true);
      try {
        const res = await getSmsRolloutAudience({
          municipality: targetMunicipality,
          classification: targetClassification,
          status: targetStatus as "ALL" | "UNPAID" | "DEFAULTER",
        });
        if (!isCancelled && res) {
          setLiveAudience(res.properties);
        }
      } catch (err) {
        console.error("Failed to query rollout audience:", err);
      } finally {
        if (!isCancelled) setIsLoadingAudience(false);
      }
    };

    fetchAudience();
    return () => {
      isCancelled = true;
    };
  }, [targetMunicipality, targetClassification, targetStatus]);

  // Target list strictly adheres to audience scope
  const eligibleProperties = audienceScope === "SELECTED" && selectedSpecificAccounts.length > 0
    ? selectedSpecificAccounts
    : liveAudience;

  const unpaidTargets = useMemo(() => {
    return eligibleProperties.filter((p) => p.status !== "PAID" && p.totalAmountDue > 0);
  }, [eligibleProperties]);

  const totalOutstandingDueSum = useMemo(() => {
    return unpaidTargets.reduce((acc, curr) => acc + (curr.totalAmountDue || 0), 0);
  }, [unpaidTargets]);

  const previewProp = eligibleProperties[previewAccountIndex] || eligibleProperties[0] || properties[0] || null;

  // Render preview message with dual links
  const previewData = useMemo(() => {
    if (!previewProp) {
      return {
        message: "Select an active property account to preview the dual-link SMS rollout notice.",
        billLink: "http://localhost:3000/properties?accountNumber=DEMO",
        paymentLink: "http://localhost:3000/properties?accountNumber=DEMO&action=pay",
        recipientPhone: "+233 24 000 0000",
        recipientName: "Municipal Citizen",
      };
    }

    const host = typeof window !== "undefined" ? window.location.origin.replace(":3001", ":3000") : "http://localhost:3000";
    const billLink = `${host}/properties?accountNumber=${encodeURIComponent(previewProp.accountNumber)}`;
    const paymentLink = `${host}/properties?accountNumber=${encodeURIComponent(previewProp.accountNumber)}&action=pay`;

    const cleanMunicipality = (previewProp.municipality || "Kpone-Katamanso (KKMA)").replace(/\s*\([^)]*\)/, '').trim() || "Municipal";
    const billYear = previewProp.billYear || 2026;

    const rendered = messageTemplate
      .replace(/{{municipality}}/g, cleanMunicipality)
      .replace(/{{billYear}}/g, String(billYear))
      .replace(/{{accountNumber}}/g, previewProp.accountNumber)
      .replace(/{{ownerName}}/g, previewProp.ownerName)
      .replace(/{{totalAmountDue}}/g, previewProp.totalAmountDueFormatted.replace("GH₵ ", ""))
      .replace(/{{arrears}}/g, previewProp.arrearsFormatted.replace("GH₵ ", ""))
      .replace(/{{currentFee}}/g, previewProp.currentFeeFormatted.replace("GH₵ ", ""))
      .replace(/{{dueDate}}/g, dueDate)
      .replace(/{{billLink}}/g, billLink)
      .replace(/{{paymentLink}}/g, paymentLink);

    return {
      message: rendered,
      billLink,
      paymentLink,
      recipientPhone: previewProp.ownerPhone,
      recipientName: previewProp.ownerName,
    };
  }, [previewProp, messageTemplate, dueDate]);

  const handleOpenTemplateModal = () => {
    setDraftTemplate(messageTemplate);
    setShowTemplateModal(true);
  };

  const handleSaveTemplateModal = () => {
    setMessageTemplate(draftTemplate);
    setShowTemplateModal(false);
  };

  const insertVariableTag = (tag: string) => {
    setMessageTemplate((prev) => prev + " " + tag);
  };

  const insertVariableTagInDraft = (tag: string) => {
    if (modalTextareaRef.current) {
      const textarea = modalTextareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = draftTemplate;
      const before = text.substring(0, start);
      const after = text.substring(end, text.length);
      const newText = before + tag + after;
      setDraftTemplate(newText);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + tag.length, start + tag.length);
      }, 0);
    } else {
      setDraftTemplate((prev) => prev + " " + tag);
    }
  };

  const modalRenderedPreview = useMemo(() => {
    const prop = previewProp || properties[0] || {
      accountNumber: "KKDA03991001",
      ownerName: "Heinz",
      ownerPhone: "0209067556",
      municipality: "Kpone-Katamanso (KKMA)",
      billYear: 2026,
      totalAmountDueFormatted: "GH₵ 437.50",
      arrearsFormatted: "GH₵ 0.00",
      currentFeeFormatted: "GH₵ 437.50",
    };
    const host = typeof window !== "undefined" ? window.location.origin.replace(":3001", ":3000") : "http://localhost:3000";
    const billLink = `${host}/properties?accountNumber=${encodeURIComponent(prop.accountNumber)}`;
    const paymentLink = `${host}/properties?accountNumber=${encodeURIComponent(prop.accountNumber)}&action=pay`;
    const cleanMunicipality = (prop.municipality || "Kpone-Katamanso (KKMA)").replace(/\s*\([^)]*\)/, '').trim() || "Municipal";
    const billYear = prop.billYear || 2026;

    return draftTemplate
      .replace(/{{municipality}}/g, cleanMunicipality)
      .replace(/{{billYear}}/g, String(billYear))
      .replace(/{{accountNumber}}/g, prop.accountNumber)
      .replace(/{{ownerName}}/g, prop.ownerName)
      .replace(/{{totalAmountDue}}/g, (prop.totalAmountDueFormatted || "437.50").replace("GH₵ ", ""))
      .replace(/{{arrears}}/g, (prop.arrearsFormatted || "0.00").replace("GH₵ ", ""))
      .replace(/{{currentFee}}/g, (prop.currentFeeFormatted || "437.50").replace("GH₵ ", ""))
      .replace(/{{dueDate}}/g, dueDate)
      .replace(/{{billLink}}/g, billLink)
      .replace(/{{paymentLink}}/g, paymentLink);
  }, [draftTemplate, previewProp, properties, dueDate]);

  const handleOpenAuthModal = () => {
    setAdminPassword("");
    setAuthError(null);
    setShowAuthModal(true);
  };

  const handleConfirmAuthorization = async () => {
    if (!adminPassword.trim()) {
      setAuthError("Please enter your administrator security password.");
      return;
    }

    setIsAuthorizing(true);
    setAuthError(null);

    try {
      const targetAccounts = unpaidTargets.map((p) => p.accountNumber);
      const res = await onTriggerBatchRollout(targetAccounts, messageTemplate, adminPassword);
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

  // Desktop Swiping Gestures (Trackpad 2-finger swipe & Mouse drag swipe)
  const lastWheelSwipeRef = useRef<number>(0);

  const handleWheelSwipe = (e: React.WheelEvent<HTMLDivElement>) => {
    const now = Date.now();
    if (now - lastWheelSwipeRef.current < 450) return;

    // Check if horizontal delta dominates vertical delta and exceeds threshold
    if (Math.abs(e.deltaX) > 40 && Math.abs(e.deltaX) > Math.abs(e.deltaY) * 1.5) {
      if (e.deltaX > 40 && activeView === "SIMULATOR") {
        setActiveView("LOGS");
        lastWheelSwipeRef.current = now;
      } else if (e.deltaX < -40 && activeView === "LOGS") {
        setActiveView("SIMULATOR");
        lastWheelSwipeRef.current = now;
      }
    }
  };

  const handleDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: { offset: { x: number; y: number }; velocity: { x: number; y: number } }
  ) => {
    const swipeThreshold = 60;
    const velocityThreshold = 250;

    if (
      (info.offset.x < -swipeThreshold || info.velocity.x < -velocityThreshold) &&
      activeView === "SIMULATOR"
    ) {
      setActiveView("LOGS");
    } else if (
      (info.offset.x > swipeThreshold || info.velocity.x > velocityThreshold) &&
      activeView === "LOGS"
    ) {
      setActiveView("SIMULATOR");
    }
  };

  return (
    <div
      onWheel={handleWheelSwipe}
      className="relative w-full h-full flex-1 min-h-0 overflow-hidden flex flex-col font-sans"
    >
      {/* Synchronized Dual-Pane Motion Slider Track with Swiping Gestures */}
      <motion.div
        className="w-[200%] h-full flex flex-row flex-1 min-h-0"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.08}
        onDragEnd={handleDragEnd}
        animate={{ x: activeView === "SIMULATOR" ? "0%" : "-50%" }}
        transition={{ type: "spring", damping: 26, stiffness: 220, mass: 0.8 }}
      >
        {/* PANE 1: SMS ROLLOUT ENGINE & DEVICE SIMULATOR (50% of track = 100% viewport) */}
        <div className="w-1/2 h-full flex flex-col min-h-0 p-3 overflow-hidden relative">
          {/* Main Two-Column Layout: Controls & Full-Height Live Preview Simulator */}
          <div className="w-full h-full min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 overflow-hidden items-stretch">
            {/* Left Column: Streamlined Header + Campaign Controls + Template Editor (7 cols / ~58%) */}
            <div className="lg:col-span-7 h-full flex flex-col min-h-0 space-y-2.5 overflow-y-auto">
              {/* Streamlined Enterprise Top Header (High Density, Clean Typography) */}
              <div className="bg-white border border-[#DADCE0] rounded-xl px-3.5 py-2.5 shadow-2xs shrink-0 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xs font-semibold text-[#2C2C2C] tracking-tight">
                      SMS Rollout &amp; Demand Notice Engine
                    </h2>
                    <span className="text-[#DADCE0]">&bull;</span>
                    <span className="text-[11px] text-[#137333] font-medium flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#137333]" />
                      Arkesel Gateway (Arnold)
                    </span>
                  </div>
                  <p className="text-[11px] text-[#717171] truncate mt-0.5">
                    Statutory billing broadcasts with dual deep links for assessment inspection and instant in-app checkout.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveView("LOGS")}
                  className="shrink-0 h-7 px-2.5 rounded-lg border border-[#DADCE0] bg-[#F8F9FA] text-[#612D53] hover:bg-[#F6ECF2] hover:border-[#612D53] text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>Delivery Logs</span>
                  <span className="text-[10px] text-[#717171]">({smsLogs.length})</span>
                  <ChevronRight className="w-3 h-3 text-[#612D53]" />
                </button>
              </div>

              {/* Section 1: Audience Selection (Compact Productivity Layout) */}
              <div className="bg-white border border-[#DADCE0] rounded-xl p-3 shadow-2xs space-y-2.5 shrink-0">
                <div className="flex items-center justify-between border-b border-[#F1F3F4] pb-1.5">
                  <h3 className="text-xs font-semibold text-[#2C2C2C]">
                    1. Target Ratepayer Audience
                  </h3>
                  <div className="flex items-center gap-2">
                    {isLoadingAudience && <Loader2 className="w-3 h-3 animate-spin text-[#612D53]" />}
                    <span className="text-[11px] text-[#717171] font-medium">
                      {eligibleProperties.length} {audienceScope === "SELECTED" ? "selected" : "dynamic"} {eligibleProperties.length === 1 ? "property" : "properties"} matched
                    </span>
                  </div>
                </div>

                {/* Specific Account Search & Multi-Account Selection Bar */}
                <div className="space-y-1.5">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-[#717171] absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={accountSearchQuery}
                      onChange={(e) => setAccountSearchQuery(e.target.value)}
                      placeholder="Search Valuation ID, Ratepayer, Phone, GPS (e.g. GK-0010), Landmark, Class..."
                      className="w-full h-8 pl-8 pr-7 rounded-lg border border-[#DADCE0] bg-white text-xs text-[#2C2C2C] focus:outline-none focus:border-[#612D53]"
                    />
                    {accountSearchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setAccountSearchQuery("");
                          setSearchResults([]);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[#717171] hover:text-[#2C2C2C] p-1 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                    {isSearchingSpecificAccounts && (
                      <Loader2 className="w-3 h-3 animate-spin text-[#612D53] absolute right-7 top-1/2 -translate-y-1/2" />
                    )}
                  </div>

                  {/* Instant Search Results Dropdown List */}
                  {searchResults.length > 0 && (
                    <div className="max-h-48 overflow-y-auto rounded-lg border border-[#DADCE0] bg-white divide-y divide-[#F1F3F4] shadow-lg">
                      {searchResults.map((acc) => {
                        const isSelected = selectedSpecificAccounts.some((p) => p.accountNumber === acc.accountNumber);
                        return (
                          <div
                            key={acc.id}
                            onClick={() => handleToggleSpecificAccount(acc)}
                            className={`p-2 flex items-center justify-between text-xs cursor-pointer hover:bg-[#F8F9FA] transition-colors ${
                              isSelected ? "bg-[#F6ECF2]/60" : ""
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-semibold text-[#2C2C2C] text-[11px]">{acc.accountNumber}</span>
                                <span className="text-[#717171] text-[11px] truncate">{acc.ownerName}</span>
                              </div>
                              <div className="text-[10px] text-[#717171] flex items-center gap-1.5 mt-0.5">
                                <span>Phone: {acc.ownerPhone}</span>
                                <span>&bull;</span>
                                <span className="font-medium text-[#2C2C2C]">{acc.totalAmountDueFormatted}</span>
                                <span>&bull;</span>
                                <span className={acc.status === "PAID" ? "text-[#137333]" : "text-[#D93025]"}>
                                  {acc.status}
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleSpecificAccount(acc);
                              }}
                              className={`h-6 px-2 rounded text-[11px] font-medium shrink-0 flex items-center gap-1 transition-colors cursor-pointer ${
                                isSelected
                                  ? "bg-[#612D53] text-white"
                                  : "border border-[#DADCE0] text-[#2C2C2C] hover:bg-[#F1F3F4]"
                              }`}
                            >
                              {isSelected ? (
                                <>
                                  <CheckCircle2 className="w-2.5 h-2.5" />
                                  <span>Selected</span>
                                </>
                              ) : (
                                <span>+ Select</span>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Selected Specific Accounts Compact Drawer */}
                  {selectedSpecificAccounts.length > 0 && (
                    <div className="space-y-1.5 p-2 rounded-lg bg-[#F8F9FA] border border-[#DADCE0]">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-[#2C2C2C] text-[11px]">
                          Targeting {selectedSpecificAccounts.length} Selected Account{selectedSpecificAccounts.length > 1 ? "s" : ""}:
                        </span>
                        <button
                          type="button"
                          onClick={handleClearSpecificAccounts}
                          className="text-[10px] text-[#D93025] hover:underline font-medium cursor-pointer"
                        >
                          Clear Selection
                        </button>
                      </div>

                      <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                        {selectedSpecificAccounts.map((acc) => (
                          <div
                            key={acc.id}
                            className="p-1.5 rounded bg-white border border-[#DADCE0] flex items-center justify-between text-xs"
                          >
                            <div className="min-w-0 pr-2">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-semibold text-[#2C2C2C] text-[11px]">{acc.accountNumber}</span>
                                <span className="text-[#717171] text-[11px] truncate">{acc.ownerName}</span>
                              </div>
                              <div className="text-[10px] text-[#717171] flex items-center gap-1.5 mt-0.2">
                                <span>Phone: {acc.ownerPhone}</span>
                                <span>&bull;</span>
                                <span className="font-medium text-[#612D53]">Due: {acc.totalAmountDueFormatted}</span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleToggleSpecificAccount(acc)}
                              className="text-[#717171] hover:text-[#D93025] p-0.5 rounded transition-colors cursor-pointer"
                              title="Remove from target list"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Scope Switcher when selections exist (Clean Typographic Standard) */}
                {selectedSpecificAccounts.length > 0 && (
                  <div className="p-1.5 rounded-lg bg-[#F8F9FA] border border-[#DADCE0] flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-[#717171] text-[11px] font-medium">Scope:</span>
                      <button
                        type="button"
                        onClick={() => {
                          setAudienceScope("SELECTED");
                          setPreviewAccountIndex(0);
                        }}
                        className={`text-[11px] font-medium transition-colors cursor-pointer ${
                          audienceScope === "SELECTED"
                            ? "text-[#612D53] font-semibold underline"
                            : "text-[#717171] hover:text-[#2C2C2C]"
                        }`}
                      >
                        Selected Accounts ({selectedSpecificAccounts.length})
                      </button>
                      <span className="text-[#DADCE0]">&bull;</span>
                      <button
                        type="button"
                        onClick={() => {
                          setAudienceScope("DATABASE_FILTER");
                          setPreviewAccountIndex(0);
                        }}
                        className={`text-[11px] font-medium transition-colors cursor-pointer ${
                          audienceScope === "DATABASE_FILTER"
                            ? "text-[#612D53] font-semibold underline"
                            : "text-[#717171] hover:text-[#2C2C2C]"
                        }`}
                      >
                        All Filtered Records ({liveAudience.length})
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleClearSpecificAccounts}
                      className="text-[10px] text-[#717171] hover:text-[#D93025] underline cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                )}

                {/* Broader Municipal Filters (Ultra Compact 3-Column Grid) */}
                <div className="pt-1.5 border-t border-[#F1F3F4]">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div className="space-y-0.5">
                      <label className="text-[#717171] text-[10px] font-medium block">Municipality (MMDA)</label>
                      <select
                        value={targetMunicipality}
                        onChange={(e) => {
                          setTargetMunicipality(e.target.value);
                          setPreviewAccountIndex(0);
                        }}
                        className="w-full h-7.5 px-2 rounded-md border border-[#DADCE0] bg-white text-[11px] text-[#2C2C2C] focus:outline-none focus:border-[#612D53]"
                      >
                        <option value="ALL">All Assemblies</option>
                        <option value="Kpone-Katamanso (KKMA)">Kpone-Katamanso (KKMA)</option>
                        <option value="Tema Metropolitan (TMA)">Tema Metropolitan (TMA)</option>
                        <option value="Accra Metropolitan (AMA)">Accra Metropolitan (AMA)</option>
                      </select>
                    </div>

                    <div className="space-y-0.5">
                      <label className="text-[#717171] text-[10px] font-medium block">Zoning Classification</label>
                      <select
                        value={targetClassification}
                        onChange={(e) => {
                          setTargetClassification(e.target.value);
                          setPreviewAccountIndex(0);
                        }}
                        className="w-full h-7.5 px-2 rounded-md border border-[#DADCE0] bg-white text-[11px] text-[#2C2C2C] focus:outline-none focus:border-[#612D53]"
                      >
                        <option value="ALL">All Classifications</option>
                        <option value="COMMERCIAL MIXED USE">Commercial Mixed Use</option>
                        <option value="PRIVATE THIRD CLASS RESIDENTIAL">Third Class Residential</option>
                        <option value="FIRST CLASS RESIDENTIAL">First Class Residential</option>
                      </select>
                    </div>

                    <div className="space-y-0.5">
                      <label className="text-[#717171] text-[10px] font-medium block">Assessment Status</label>
                      <select
                        value={targetStatus}
                        onChange={(e) => {
                          setTargetStatus(e.target.value as any);
                          setPreviewAccountIndex(0);
                        }}
                        className="w-full h-7.5 px-2 rounded-md border border-[#DADCE0] bg-white text-[11px] text-[#2C2C2C] focus:outline-none focus:border-[#612D53]"
                      >
                        <option value="UNPAID">Unpaid Balances Only</option>
                        <option value="DEFAULTER">Statutory Defaulters (Arrears)</option>
                        <option value="ALL">All Records</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Template Editor with Tag Palette (High Density Productivity Layout) */}
              <div className="bg-white border border-[#DADCE0] rounded-xl p-3 shadow-2xs space-y-2 shrink-0">
                <div className="flex items-center justify-between border-b border-[#F1F3F4] pb-1.5">
                  <h3 className="text-xs font-semibold text-[#2C2C2C]">
                    2. Dual-Link SMS Template Engine
                  </h3>
                  <button
                    type="button"
                    onClick={() => setMessageTemplate(defaultTemplate)}
                    className="text-[11px] text-[#612D53] hover:underline font-medium cursor-pointer"
                  >
                    Reset Default
                  </button>
                </div>

                {/* Variable Tags Palette (Zero Pills - Clean typographic monospace tokens) */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#717171] font-medium">Insert Dynamic Tokens:</span>
                    <span className="text-[10px] text-[#717171]">Act 936 Compliant</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {dynamicTokens.map((item) => (
                      <button
                        key={item.tag}
                        type="button"
                        onClick={() => insertVariableTag(item.tag)}
                        className="px-1.5 py-0.5 text-[10px] font-mono font-medium text-[#612D53] bg-[#F6ECF2]/60 border border-[#E8D4E2] rounded hover:bg-[#EAD6E4] transition-colors cursor-pointer"
                        title={`Click to insert ${item.tag}`}
                      >
                        + {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <textarea
                    value={messageTemplate}
                    onClick={handleOpenTemplateModal}
                    onFocus={handleOpenTemplateModal}
                    readOnly
                    rows={3}
                    className="w-full p-2.5 rounded-lg border border-[#DADCE0] bg-[#FDFDFD] text-xs text-[#2C2C2C] focus:outline-none focus:border-[#612D53] resize-none leading-relaxed font-sans cursor-pointer hover:border-[#612D53]/60 transition-all"
                  />
                  <div className="flex items-center justify-between text-[10px] text-[#717171]">
                    <span>Character Count: {messageTemplate.length} chars (approx. {Math.ceil(messageTemplate.length / 160)} SMS segments)</span>
                    <span>Dual Deep Links Standard</span>
                  </div>
                </div>

                {/* Statutory Due Date Setting & Action */}
                <div className="pt-1.5 border-t border-[#F1F3F4] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <label className="text-[#717171] font-medium text-[11px] whitespace-nowrap">Due Date:</label>
                    <input
                      type="text"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-28 h-7.5 px-2 rounded-md border border-[#DADCE0] bg-white text-[11px] text-[#2C2C2C] focus:outline-none focus:border-[#612D53]"
                      placeholder="30-Jun-2025"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleOpenAuthModal}
                    disabled={isProcessing || unpaidTargets.length === 0}
                    className="btn-3d-primary h-8 px-3.5 rounded-lg font-medium text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>
                      {isProcessing
                        ? "Dispatching SMS..."
                        : `Queue Rollout Notice (${unpaidTargets.length})`}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Full-Height Standalone Smartphone Simulator (5 cols / ~42%) */}
            <div className="lg:col-span-5 h-full flex flex-col justify-center items-center min-h-0 py-0 overflow-hidden">
              {/* Standalone Smartphone Device Frame (Consumes available vertical height cleanly) */}
              <div className="bg-[#1F1F1F] border-[4px] border-[#2C2C2C] rounded-[32px] shadow-2xl text-white max-w-[330px] w-full h-full max-h-full flex flex-col justify-between overflow-hidden relative font-sans ring-1 ring-black/40">
                {/* Top Status Bar & Notch */}
                <div className="bg-[#2C2C2C] px-3.5 pt-1.5 pb-1 flex items-center justify-between text-[10px] text-[#9AA0A6] shrink-0 border-b border-white/5">
                  <span className="font-semibold text-white">9:41</span>
                  {/* Dynamic Island / Speaker Pill */}
                  <div className="w-14 h-3 bg-black rounded-full flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#1A1A1A] mr-1" />
                  </div>
                  <span className="font-medium text-[#BDC1C6]">5G • 100%</span>
                </div>

                {/* Baked-In Contact Bar & Interactive Account Switcher */}
                <div className="bg-[#26282B] px-3 py-1.5 border-b border-white/10 shrink-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-[#612D53] text-white flex items-center justify-center text-[11px] font-bold shrink-0 border border-white/20 shadow-inner">
                      A
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-white truncate">Arnold (KKMA Revenue)</span>
                        <span className="text-[10px] text-[#34A853] font-medium">&bull; Verified SMS</span>
                      </div>
                      <div className="text-[10px] text-[#9AA0A6] truncate">
                        To: <strong className="text-[#E8EAED]">{previewData.recipientName}</strong> &bull; {previewData.recipientPhone}
                      </div>
                    </div>
                  </div>

                  {/* Embedded Account Selector Switcher */}
                  {eligibleProperties.length > 0 && (
                    <div className="flex items-center gap-1 bg-[#1C1D1F] p-0.5 px-1.5 rounded border border-white/10">
                      <span className="text-[9px] text-[#9AA0A6] shrink-0 font-medium">Previewing:</span>
                      <select
                        value={previewAccountIndex}
                        onChange={(e) => setPreviewAccountIndex(Number(e.target.value))}
                        className="w-full text-[10px] font-semibold text-[#8AB4F8] bg-transparent border-none focus:outline-none cursor-pointer truncate"
                      >
                        {eligibleProperties.slice(0, 100).map((p, idx) => (
                          <option key={p.id} value={idx} className="bg-[#2C2C2C] text-white">
                            {p.accountNumber} — {p.ownerName} ({p.totalAmountDueFormatted})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Fluid SMS Thread Body */}
                <div className="flex-1 min-h-0 p-2.5 overflow-y-auto space-y-2 bg-[#121314]">
                  <div className="text-center text-[9px] text-[#80868B] py-0.5">
                    <span>Statutory Notice &bull; Today 9:41 AM</span>
                  </div>

                  {/* SMS Bubble */}
                  <div className="bg-[#2B2D30] text-white p-2.5 rounded-2xl rounded-tl-xs text-xs leading-relaxed space-y-2 shadow-lg border border-white/10">
                    <p className="whitespace-pre-line text-[#F1F3F4] text-[11px] leading-relaxed">
                      {previewData.message}
                    </p>

                    {/* Highlighted Dual Direct Action Cards */}
                    <div className="space-y-1 pt-1.5 border-t border-white/10">
                      <span className="text-[9px] uppercase text-[#9AA0A6] font-semibold tracking-wider block">
                        Citizen Touchpoints:
                      </span>

                      {/* Link 1: View Digital Assessment */}
                      <a
                        href={previewData.billLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-1.5 rounded-md bg-white/10 hover:bg-white/15 transition-colors text-[10px] text-[#8AB4F8] flex items-center justify-between font-medium cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5">
                          <FileText className="w-3 h-3 text-[#8AB4F8]" />
                          <span>Link 1: View Digital Assessment</span>
                        </span>
                        <ExternalLink className="w-2.5 h-2.5 text-[#8AB4F8]" />
                      </a>

                      {/* Link 2: Instant Payment Gateway */}
                      <a
                        href={previewData.paymentLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-1.5 rounded-md bg-[#81C995]/20 hover:bg-[#81C995]/30 transition-colors text-[10px] text-[#81C995] flex items-center justify-between font-medium cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5">
                          <CreditCard className="w-3 h-3 text-[#81C995]" />
                          <span>Link 2: In-App Payment Gateway</span>
                        </span>
                        <ExternalLink className="w-2.5 h-2.5 text-[#81C995]" />
                      </a>
                    </div>
                  </div>

                  <div className="text-right text-[9px] text-[#80868B] pr-1">
                    <span>Delivered &bull; Encrypted Token</span>
                  </div>
                </div>

                {/* Bottom Native Mobile Bar & Home Indicator */}
                <div className="bg-[#26282B] px-3 pt-1.5 pb-1 border-t border-white/10 shrink-0 space-y-0.5">
                  <div className="flex items-center justify-between bg-[#1C1D1F] px-2.5 py-1 rounded-full border border-white/10 text-[9px] text-[#9AA0A6]">
                    <span>Text Message &bull; SMS Delivery</span>
                    <div className="w-3.5 h-3.5 rounded-full bg-[#612D53] flex items-center justify-center text-white">
                      <Send className="w-2 h-2" />
                    </div>
                  </div>
                  {/* iOS/Android Home Indicator Bar */}
                  <div className="w-20 h-1 bg-white/30 rounded-full mx-auto mt-1" />
                </div>
              </div>
            </div>
          </div>

          {/* Persistent Floating Edge Arrow Tab for Logs (Reveals label on hover) */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 z-30">
            <div className="relative group flex items-center justify-end">
              {/* Hover Tooltip Label (Positioned absolutely so it takes 0 layout space) */}
              <div className="absolute right-full mr-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-[#2C2C2C] text-white text-[11px] font-medium px-2.5 py-1.5 rounded-lg shadow-xl border border-white/10 whitespace-nowrap z-40">
                SMS Delivery Logs ({smsLogs.length})
              </div>

              {/* Pure Arrow Button */}
              <button
                type="button"
                onClick={() => setActiveView("LOGS")}
                className="bg-[#612D53] text-white p-3 rounded-l-xl shadow-xl flex items-center justify-center hover:bg-[#4E2442] active:scale-95 transition-all cursor-pointer border-y border-l border-white/20"
                aria-label={`View SMS Delivery Logs (${smsLogs.length})`}
              >
                <ChevronRight className="w-4 h-4 text-white group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        </div>

        {/* PANE 2: TRANSACTIONAL SMS DISPATCH & DELIVERY LOG (50% of track = 100% viewport) */}
        <div className="w-1/2 h-full flex flex-col min-h-0 p-3 overflow-hidden relative">
          <div className="h-full flex flex-col bg-white border border-[#DADCE0] rounded-xl overflow-hidden shadow-sm">
            {/* Header */}
            <div className="p-3 border-b border-[#DADCE0] flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={() => setActiveView("SIMULATOR")}
                  className="h-7.5 px-2.5 rounded-lg border border-[#DADCE0] text-xs font-semibold text-[#612D53] hover:bg-[#F6ECF2] transition-colors flex items-center gap-1 cursor-pointer shrink-0 whitespace-nowrap"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Back to Engine</span>
                </button>
                <div className="min-w-0">
                  <h3 className="text-xs font-semibold text-[#2C2C2C] truncate">
                    Transactional SMS Dispatch &amp; Delivery Ledger
                  </h3>
                  <p className="text-[11px] text-[#717171] truncate">
                    Historical record of all billing notifications &amp; demand notices dispatched via Arkesel Gateway.
                  </p>
                </div>
              </div>

              <span className="text-[11px] text-[#717171] font-medium shrink-0 whitespace-nowrap">
                {smsLogs.length} total transmission{smsLogs.length === 1 ? "" : "s"}
              </span>
            </div>

            {/* Table Container - Fixed 100% Viewport, Zero Horizontal Scroll */}
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
              <table className="table-fixed w-full text-left text-xs border-collapse">
                <thead className="bg-[#F8F9FA] border-b border-[#DADCE0] text-[#717171] font-semibold text-[11px] sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3 w-[18%]">Timestamp</th>
                    <th className="py-2.5 px-3 w-[26%]">Recipient Particulars</th>
                    <th className="py-2.5 px-3 w-[18%]">Notice Type</th>
                    <th className="py-2.5 px-3 w-[24%]">Message Preview</th>
                    <th className="py-2.5 px-3 w-[14%] text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8EAED] bg-white">
                  {smsLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-[#717171] italic font-normal">
                        No SMS dispatches queued or sent yet. Trigger a rollout above to populate logs.
                      </td>
                    </tr>
                  ) : (
                    smsLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-[#F8F9FA] transition-colors">
                        <td className="py-2.5 px-3 text-[#717171] text-[11px] align-top">
                          <span className="font-medium text-[#2C2C2C] block">
                            {log.createdAtFormatted.split(",")[0]}
                          </span>
                          <span className="text-[10px] text-[#717171]">
                            {log.createdAtFormatted.split(",")[1] || ""}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 align-top min-w-0">
                          <span className="font-medium text-[#2C2C2C] text-[11px] block truncate" title={log.recipientName}>
                            {log.recipientName}
                          </span>
                          <span className="text-[10px] text-[#717171] font-mono block truncate">
                            {log.recipientPhone}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 align-top min-w-0">
                          <span className="font-medium text-[#2C2C2C] text-[11px] block truncate" title={log.title}>
                            {log.title}
                          </span>
                          <span className="text-[10px] text-[#612D53] font-medium block">
                            SMS Delivery
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-[#717171] text-[11px] align-top min-w-0">
                          <p className="truncate" title={log.message}>
                            {log.message.replace(/\n+/g, " ")}
                          </p>
                        </td>
                        <td className="py-2.5 px-3 text-center align-top">
                          <span
                            className={`font-semibold text-[11px] block ${
                              log.deliveryStatus === "DELIVERED"
                                ? "text-[#188038]"
                                : log.deliveryStatus === "PENDING"
                                ? "text-[#E37400]"
                                : "text-[#D93025]"
                            }`}
                          >
                            {log.deliveryStatus === "DELIVERED" ? "Delivered" : log.deliveryStatus === "PENDING" ? "Queued" : "Failed"}
                          </span>
                          {log.externalMessageId && (
                            <span
                              className="text-[9px] text-[#717171] font-mono block truncate max-w-[100px] mx-auto mt-0.5"
                              title={`Arkesel Gateway ID: ${log.externalMessageId}`}
                            >
                              {log.externalMessageId.substring(0, 10)}...
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer Status Bar */}
            <div className="px-4 py-2 border-t border-[#DADCE0] bg-[#F8F9FA] flex items-center justify-between text-xs text-[#717171] shrink-0">
              <span>Arkesel E.164 SMS Outbound Dispatch Service</span>
              <span>{smsLogs.length} total entries</span>
            </div>
          </div>

          {/* Persistent Floating Edge Arrow Tab to Switch back to Simulator (Reveals label on hover) */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 z-30">
            <div className="relative group flex items-center">
              {/* Pure Arrow Button */}
              <button
                type="button"
                onClick={() => setActiveView("SIMULATOR")}
                className="bg-[#612D53] text-white p-3 rounded-r-xl shadow-xl flex items-center justify-center hover:bg-[#4E2442] active:scale-95 transition-all cursor-pointer border-y border-r border-white/20"
                aria-label="Back to SMS Rollout Engine"
              >
                <ChevronLeft className="w-4 h-4 text-white group-hover:-translate-x-0.5 transition-transform" />
              </button>

              {/* Hover Tooltip Label (Positioned absolutely so it takes 0 layout space) */}
              <div className="absolute left-full ml-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-[#2C2C2C] text-white text-[11px] font-medium px-2.5 py-1.5 rounded-lg shadow-xl border border-white/10 whitespace-nowrap z-40">
                Back to Rollout Engine
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* SMS MESSAGE TEMPLATE FOCUS & EDIT MODAL */}
      <AnimatePresence>
        {showTemplateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs font-sans">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl border border-[#DADCE0] shadow-2xl p-5 max-w-2xl w-full space-y-3.5 flex flex-col max-h-[92vh] overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-2.5 border-b border-[#F1F3F4] shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#F6ECF2] text-[#612D53] flex items-center justify-center shrink-0">
                    <MessageSquare className="w-4 h-4 text-[#612D53]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#2C2C2C]">
                      SMS Message Template Editor
                    </h3>
                    <p className="text-[11px] text-[#717171]">
                      Customize statutory billing notice with dynamic token tags &amp; dual deep links.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowTemplateModal(false)}
                  className="w-7 h-7 rounded-lg text-[#717171] hover:text-[#2C2C2C] hover:bg-[#F1F3F4] flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable Modal Content */}
              <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-0.5">
                {/* Dynamic Token Palette */}
                <div className="space-y-1.5 bg-[#F8F9FA] p-2.5 rounded-xl border border-[#E8EAED]">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-[#2C2C2C]">
                      Click Token to Insert at Cursor:
                    </span>
                    <span className="text-[10px] text-[#717171]">Act 936 Standard</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {dynamicTokens.map((item) => (
                      <button
                        key={item.tag}
                        type="button"
                        onClick={() => insertVariableTagInDraft(item.tag)}
                        className="px-2 py-1 text-[11px] font-mono font-medium text-[#612D53] bg-white border border-[#E8D4E2] rounded-md hover:bg-[#F6ECF2] hover:border-[#612D53] transition-all cursor-pointer shadow-2xs active:scale-95"
                        title={`Insert ${item.tag}`}
                      >
                        + {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Big Focused Textarea */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-[#2C2C2C]">
                      Message Body (Drafting Canvas)
                    </label>
                    <span className="text-[10px] text-[#717171] font-mono">
                      {draftTemplate.length} chars &bull; {Math.ceil(draftTemplate.length / 160)} SMS segment{Math.ceil(draftTemplate.length / 160) === 1 ? "" : "s"}
                    </span>
                  </div>
                  <textarea
                    ref={modalTextareaRef}
                    autoFocus
                    value={draftTemplate}
                    onChange={(e) => setDraftTemplate(e.target.value)}
                    rows={6}
                    className="w-full p-3 rounded-xl border border-[#DADCE0] bg-white text-xs text-[#2C2C2C] focus:outline-none focus:border-[#612D53] focus:ring-1 focus:ring-[#612D53] leading-relaxed font-sans shadow-inner transition-colors resize-none"
                    placeholder="Enter statutory message template..."
                  />
                </div>

                {/* Real-Time Live Rendered Sample Preview Box */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[#2C2C2C] flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-[#612D53]" />
                      <span>Live Rendered Sample Preview</span>
                    </span>
                    <span className="text-[10px] text-[#717171]">
                      Sample Target: {previewProp?.ownerName || "Heinz"} ({previewProp?.accountNumber || "KKDA03991001"})
                    </span>
                  </div>

                  <div className="bg-[#F8F9FA] rounded-xl border border-[#DADCE0] p-3 text-xs space-y-2">
                    <p className="whitespace-pre-line text-[#2C2C2C] text-[11px] leading-relaxed font-sans">
                      {modalRenderedPreview}
                    </p>

                    <div className="pt-2 border-t border-[#E8EAED] flex flex-wrap gap-2 text-[10px]">
                      <span className="text-[#137333] font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-[#137333]" />
                        <span>Link 1 (Assessment Inspection): {modalRenderedPreview.includes("/properties?accountNumber=") ? "Active" : "Missing"}</span>
                      </span>
                      <span className="text-[#DADCE0]">&bull;</span>
                      <span className="text-[#137333] font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-[#137333]" />
                        <span>Link 2 (Direct Checkout): {modalRenderedPreview.includes("&action=pay") ? "Active" : "Missing"}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-[#F1F3F4] shrink-0">
                <button
                  type="button"
                  onClick={() => setDraftTemplate(defaultTemplate)}
                  className="text-xs text-[#717171] hover:text-[#2C2C2C] hover:underline cursor-pointer font-medium"
                >
                  Reset Default Template
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowTemplateModal(false)}
                    className="btn-3d-secondary h-8.5 px-3.5 rounded-lg text-xs font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveTemplateModal}
                    className="btn-3d-primary h-8.5 px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Apply &amp; Save Template</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* HIGH-SECURITY SMS ROLLOUT AUTHORIZATION MODAL */}
      <AnimatePresence>
        {showAuthModal && (
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
                  onClick={() => setShowAuthModal(false)}
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
                    {unpaidTargets.length} Taxpayer Account{unpaidTargets.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#717171] font-medium">Total Balance to Notify:</span>
                  <span className="font-semibold text-[#D93025]">
                    GH₵ {totalOutstandingDueSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                  Recipient Roster ({unpaidTargets.length})
                </label>
                <div className="max-h-36 overflow-y-auto rounded-lg border border-[#DADCE0] divide-y divide-[#F1F3F4] bg-white text-xs">
                  {unpaidTargets.map((t) => (
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
                    type={showPassword ? "text" : "password"}
                    value={adminPassword}
                    onChange={(e) => {
                      setAdminPassword(e.target.value);
                      if (authError) setAuthError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !isAuthorizing && adminPassword.trim()) {
                        handleConfirmAuthorization();
                      }
                    }}
                    placeholder="Enter admin password (e.g. admin123)"
                    className="w-full h-10 pl-9 pr-10 rounded-lg border border-[#DADCE0] text-xs text-[#2C2C2C] focus:outline-none focus:border-[#612D53] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#717171] hover:text-[#2C2C2C] cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {authError && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-[#D93025] font-medium flex items-center gap-1 mt-1"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{authError}</span>
                  </motion.p>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#F1F3F4]">
                <button
                  type="button"
                  onClick={() => setShowAuthModal(false)}
                  disabled={isAuthorizing}
                  className="btn-3d-secondary h-9 px-4 rounded-lg text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAuthorization}
                  disabled={isAuthorizing || !adminPassword.trim()}
                  className="btn-3d-primary h-9 px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isAuthorizing ? (
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
    </div>
  );
}

