"use client";

import React, { useState, useEffect, useMemo, useDeferredValue, useRef } from "react";
import {
  Search,
  X,
  ChevronLeft,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  Save,
  RotateCcw,
} from "lucide-react";
import {
  searchPropertyBillAccounts,
  updatePropertyBiodata,
  PropertyBillAccountSummary,
} from "@/app/actions";
import { AppleSpinner } from "@/components/ui/AppleSpinner";
import { motion, AnimatePresence } from "framer-motion";

interface AccountsBiodataSectionProps {
  currentAdmin?: {
    id: string;
    username: string;
    name: string;
    role: string;
  } | null;
  initialAccountNo?: string;
  onOpenStatement?: (accountNo: string) => void;
  onSelectAccount?: (accountNo: string | null) => void;
}

type MissingFilter = "ALL" | "MISSING_PHONE" | "MISSING_GPS" | "COMPLETE";

export function AccountsBiodataSection({
  currentAdmin,
  initialAccountNo,
  onOpenStatement,
  onSelectAccount,
}: AccountsBiodataSectionProps) {
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

  const [activeAccountNo, setActiveAccountNo] = useState<string | null>(getSynchronousAccountNo);
  const [selectedAccount, setSelectedAccount] = useState<PropertyBillAccountSummary | null>(null);
  const [isLoadingSelectedAccount, setIsLoadingSelectedAccount] = useState<boolean>(Boolean(getSynchronousAccountNo()));

  // Directory Search & Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [missingFilter, setMissingFilter] = useState<MissingFilter>("ALL");
  const [accounts, setAccounts] = useState<PropertyBillAccountSummary[]>([]);
  const [accountsTotal, setAccountsTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;
  const [totalPages, setTotalPages] = useState(1);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Form State for Selected Account
  const [formData, setFormData] = useState({
    name: "",
    telephone: "",
    ownerDigitalAddress: "",
    houseNo: "",
    streetName: "",
    electoralArea: "",
    tin: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Synchronize activeAccountNo with prop updates
  const prevInitialAccountNoRef = useRef(initialAccountNo);
  useEffect(() => {
    if (initialAccountNo !== prevInitialAccountNoRef.current) {
      prevInitialAccountNoRef.current = initialAccountNo;
      const clean = (initialAccountNo && initialAccountNo.trim()) || null;
      setActiveAccountNo(clean);
      if (!clean) {
        setSelectedAccount(null);
      }
    }
  }, [initialAccountNo]);

  // Synchronize browser history (back/forward popstate)
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window === "undefined") return;
      const urlAccount = new URLSearchParams(window.location.search).get("account");
      if (urlAccount && urlAccount.trim()) {
        setActiveAccountNo(urlAccount.trim());
      } else {
        setActiveAccountNo(null);
        setSelectedAccount(null);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Fetch Accounts Directory on search/page change
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
  }, [deferredSearchQuery, currentPage]);

  // Reset page to 1 on search change
  useEffect(() => {
    setCurrentPage(1);
  }, [deferredSearchQuery]);

  // Fetch / Resolve Selected Account Particulars
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
          const match =
            res.accounts.find((a) => a.accountNumber.toLowerCase() === activeAccountNo!.toLowerCase()) ||
            res.accounts[0];
          setSelectedAccount(match);
        } else if (!isCancelled) {
          setSelectedAccount(null);
        }
      } catch (err) {
        console.error("Failed to resolve selected account particulars:", err);
      } finally {
        if (!isCancelled) setIsLoadingSelectedAccount(false);
      }
    }

    resolveAccountParticulars();
    return () => {
      isCancelled = true;
    };
  }, [activeAccountNo]);

  // Populate Form Data whenever Selected Account changes
  useEffect(() => {
    if (selectedAccount) {
      setFormData({
        name: selectedAccount.name || "",
        telephone: selectedAccount.telephone || "",
        ownerDigitalAddress: selectedAccount.ownerDigitalAddress || "",
        houseNo: selectedAccount.houseNo || "",
        streetName: "",
        electoralArea: selectedAccount.electoralArea || "",
        tin: "",
      });
    }
  }, [selectedAccount]);

  // Filter accounts client-side for quick missing-data tabs
  const filteredAccounts = useMemo(() => {
    if (missingFilter === "ALL") return accounts;
    if (missingFilter === "MISSING_PHONE") {
      return accounts.filter((a) => !a.telephone || !a.telephone.trim());
    }
    if (missingFilter === "MISSING_GPS") {
      return accounts.filter((a) => !a.ownerDigitalAddress || !a.ownerDigitalAddress.trim());
    }
    if (missingFilter === "COMPLETE") {
      return accounts.filter(
        (a) => a.telephone && a.telephone.trim() && a.ownerDigitalAddress && a.ownerDigitalAddress.trim()
      );
    }
    return accounts;
  }, [accounts, missingFilter]);

  const handleSelectAccount = (acc: PropertyBillAccountSummary) => {
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

  const handleBackToDirectory = () => {
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

  const handleResetForm = () => {
    if (selectedAccount) {
      setFormData({
        name: selectedAccount.name || "",
        telephone: selectedAccount.telephone || "",
        ownerDigitalAddress: selectedAccount.ownerDigitalAddress || "",
        houseNo: selectedAccount.houseNo || "",
        streetName: "",
        electoralArea: selectedAccount.electoralArea || "",
        tin: "",
      });
      showToast("Form restored to current records.", "success");
    }
  };

  const handleSaveBiodata = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) return;

    if (!formData.name.trim()) {
      showToast("Ratepayer name cannot be empty.", "error");
      return;
    }

    setIsSaving(true);
    try {
      const res = await updatePropertyBiodata({
        accountNo: selectedAccount.accountNumber,
        name: formData.name.trim(),
        telephone: formData.telephone.trim() || null,
        ownerDigitalAddress: formData.ownerDigitalAddress.trim() || null,
        houseNo: formData.houseNo.trim() || null,
        streetName: formData.streetName.trim() || null,
        electoralArea: formData.electoralArea.trim() || null,
        tin: formData.tin.trim() || null,
        propertyCategory: selectedAccount.propertyCategory || null,
      });

      if (res.success && res.account) {
        // Update local selected account
        setSelectedAccount(res.account);
        // Update item in accounts directory list
        setAccounts((prev) =>
          prev.map((a) => (a.accountNumber === res.account!.accountNumber ? res.account! : a))
        );
        showToast("Ratepayer biodata updated successfully.", "success");
      } else {
        showToast(res.error || "Failed to update biodata.", "error");
      }
    } catch (err: any) {
      console.error("Save biodata error:", err);
      showToast(err.message || "An unexpected error occurred.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full flex-1 min-h-0 flex flex-col font-sans antialiased overflow-hidden bg-[#F5F5F7]">
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

      {/* Main Split Layout Container */}
      <div className="w-full flex-1 min-h-0 flex overflow-hidden">
        {/* =========================================================================
            PANE 1: MASTER DIRECTORY (Hidden on mobile if account is selected)
            ========================================================================= */}
        <div
          className={`${
            activeAccountNo ? "hidden md:flex" : "flex"
          } w-full md:w-[380px] lg:w-[410px] shrink-0 border-r border-[#E8E8ED] bg-white flex-col h-full overflow-hidden`}
        >
          {/* 1. Directory Search Toolbar */}
          <div className="p-3 sm:p-4 border-b border-[#E8E8ED] bg-[#FAFAFC] shrink-0 space-y-3">
            <div className="relative w-full">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#8E8E93]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search account, owner, phone, GPS..."
                className="w-full pl-9 pr-8 py-2 bg-white border border-[#E8E8ED] rounded-xl text-xs font-medium text-[#1D1D1F] placeholder-[#8E8E93] outline-none focus:border-[#007AFF] transition-all"
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

            {/* Quick Filter Links (Apple Typography — ZERO PILLS) */}
            <div className="flex items-center justify-center gap-4 sm:gap-6 overflow-x-auto no-scrollbar text-xs py-0.5">
              <button
                type="button"
                onClick={() => setMissingFilter("ALL")}
                className={`transition-colors cursor-pointer shrink-0 pb-0.5 ${
                  missingFilter === "ALL"
                    ? "font-semibold text-[#007AFF] border-b-2 border-[#007AFF]"
                    : "text-[#6E6E73] hover:text-[#1D1D1F]"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setMissingFilter("MISSING_PHONE")}
                className={`transition-colors cursor-pointer shrink-0 pb-0.5 ${
                  missingFilter === "MISSING_PHONE"
                    ? "font-semibold text-[#FF9500] border-b-2 border-[#FF9500]"
                    : "text-[#6E6E73] hover:text-[#1D1D1F]"
                }`}
              >
                Needs Phone
              </button>
              <button
                type="button"
                onClick={() => setMissingFilter("MISSING_GPS")}
                className={`transition-colors cursor-pointer shrink-0 pb-0.5 ${
                  missingFilter === "MISSING_GPS"
                    ? "font-semibold text-[#FF9500] border-b-2 border-[#FF9500]"
                    : "text-[#6E6E73] hover:text-[#1D1D1F]"
                }`}
              >
                Needs GPS
              </button>
              <button
                type="button"
                onClick={() => setMissingFilter("COMPLETE")}
                className={`transition-colors cursor-pointer shrink-0 pb-0.5 ${
                  missingFilter === "COMPLETE"
                    ? "font-semibold text-[#34C759] border-b-2 border-[#34C759]"
                    : "text-[#6E6E73] hover:text-[#1D1D1F]"
                }`}
              >
                Complete
              </button>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-end text-[11px] text-[#8E8E93]">
                <span>Page {currentPage} of {totalPages}</span>
              </div>
            )}
          </div>

          {/* 2. Directory Accounts List (Scrollable, Zero Visible Scrollbars) */}
          <div ref={tableContainerRef} className="flex-1 min-h-0 overflow-y-auto no-scrollbar divide-y divide-[#E8E8ED]/60">
            {isLoadingAccounts && accounts.length === 0 ? (
              <div className="p-8 flex flex-col items-center justify-center gap-2.5 text-[#8E8E93]">
                <AppleSpinner size="md" className="text-[#007AFF]" />
                <span className="text-xs">Loading accounts...</span>
              </div>
            ) : filteredAccounts.length === 0 ? (
              <div className="p-8 text-center text-[#8E8E93] text-xs">
                No matching property accounts found.
              </div>
            ) : (
              filteredAccounts.map((acc) => {
                const isSelected = activeAccountNo?.toLowerCase() === acc.accountNumber.toLowerCase();
                const hasPhone = Boolean(acc.telephone && acc.telephone.trim());
                const hasGps = Boolean(acc.ownerDigitalAddress && acc.ownerDigitalAddress.trim());

                return (
                  <button
                    key={acc.accountNumber}
                    type="button"
                    onClick={() => handleSelectAccount(acc)}
                    className={`w-full text-left p-3 sm:px-4 sm:py-3.5 transition-colors cursor-pointer flex flex-col gap-1 border-l-2 ${
                      isSelected
                        ? "bg-[#F2F7FF] border-[#007AFF]"
                        : "border-transparent hover:bg-[#F9F9FB]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-[#007AFF]">
                        {acc.accountNumber}
                      </span>
                      {acc.electoralArea && (
                        <span className="text-[11px] text-[#8E8E93] truncate max-w-[130px]">
                          {acc.electoralArea}
                        </span>
                      )}
                    </div>

                    <div className="text-[13px] font-semibold text-[#1D1D1F] truncate">
                      {acc.name || "Unassigned Owner"}
                    </div>

                    {/* Status metadata typography — ZERO PILLS */}
                    <div className="flex items-center gap-3 text-[11px] mt-0.5">
                      {!hasPhone ? (
                        <span className="text-[#FF9500] font-medium flex items-center gap-1">
                          &bull; Missing phone
                        </span>
                      ) : (
                        <span className="text-[#6E6E73] truncate max-w-[110px]">
                          {acc.telephone}
                        </span>
                      )}

                      {!hasGps ? (
                        <span className="text-[#FF9500] font-medium flex items-center gap-1">
                          &bull; Missing GPS
                        </span>
                      ) : (
                        <span className="text-[#8E8E93] font-mono truncate max-w-[100px]">
                          {acc.ownerDigitalAddress}
                        </span>
                      )}

                      {hasPhone && hasGps && (
                        <span className="text-[#34C759] font-medium ml-auto">
                          &bull; Complete
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* 3. Directory Pagination Footer */}
          {totalPages > 1 && (
            <div className="p-2.5 sm:p-3 border-t border-[#E8E8ED] bg-white flex items-center justify-between text-xs text-[#6E6E73] shrink-0">
              <button
                type="button"
                disabled={currentPage <= 1 || isLoadingAccounts}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded-md border border-[#E8E8ED] hover:bg-[#F5F5F7] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Previous
              </button>
              <span>{currentPage} / {totalPages}</span>
              <button
                type="button"
                disabled={currentPage >= totalPages || isLoadingAccounts}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded-md border border-[#E8E8ED] hover:bg-[#F5F5F7] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* =========================================================================
            PANE 2: BIODATA EDIT WORKBENCH (DETAIL)
            ========================================================================= */}
        <div
          className={`${
            activeAccountNo ? "flex" : "hidden md:flex"
          } flex-1 min-h-0 flex-col h-full overflow-hidden bg-[#F5F5F7]`}
        >
          {!activeAccountNo ? (
            /* Empty State: Prompt user to select an account */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[#8E8E93] gap-3">
              <UserCheck className="w-10 h-10 text-[#C7C7CC] stroke-[1.5]" />
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-[#1D1D1F]">No Account Selected</h3>
                <p className="text-xs text-[#6E6E73] max-w-xs">
                  Choose a ratepayer account from the directory on the left to inspect and update its biodata.
                </p>
              </div>
            </div>
          ) : isLoadingSelectedAccount && !selectedAccount ? (
            /* Loading State */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-2.5">
              <AppleSpinner size="lg" className="text-[#007AFF]" />
              <span className="text-xs text-[#8E8E93]">Retrieving ratepayer biodata...</span>
            </div>
          ) : selectedAccount ? (
            /* Selected Account Biodata Form Canvas */
            <form onSubmit={handleSaveBiodata} className="flex-1 min-h-0 flex flex-col h-full overflow-hidden">
              {/* 1. Workbench Sticky Header */}
              <div className="bg-white border-b border-[#E8E8ED] px-4 sm:px-6 py-3 shrink-0 flex items-center justify-between gap-3 shadow-2xs z-20">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  {/* Mobile Back Button */}
                  <button
                    type="button"
                    onClick={handleBackToDirectory}
                    className="md:hidden flex items-center text-[#007AFF] hover:underline text-xs font-semibold shrink-0 cursor-pointer p-1 -ml-1"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs sm:text-sm font-bold text-[#007AFF]">
                        {selectedAccount.accountNumber}
                      </span>
                      {onOpenStatement && (
                        <button
                          type="button"
                          onClick={() => onOpenStatement(selectedAccount.accountNumber)}
                          className="text-[11px] sm:text-xs text-[#6E6E73] hover:text-[#007AFF] hover:underline flex items-center gap-0.5 cursor-pointer ml-1"
                          title="Open statement view for this account"
                        >
                          <span>Statement</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <h2 className="text-sm sm:text-base font-semibold text-[#1D1D1F] truncate">
                      {selectedAccount.name || "Unassigned Owner"}
                    </h2>
                  </div>
                </div>

                {/* Save & Reset Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleResetForm}
                    disabled={isSaving}
                    className="px-3 py-1.5 rounded-lg border border-[#E8E8ED] bg-white text-[#1D1D1F] hover:bg-[#F5F5F7] text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5"
                    title="Revert unsaved form edits"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[#8E8E93]" />
                    <span className="hidden sm:inline">Revert</span>
                  </button>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-1.5 rounded-lg bg-[#007AFF] hover:bg-[#0066D6] disabled:opacity-50 text-white text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    {isSaving ? <AppleSpinner size="xs" /> : <Save className="w-3.5 h-3.5" />}
                    <span>{isSaving ? "Saving..." : "Save Changes"}</span>
                  </button>
                </div>
              </div>

              {/* 2. Scrollable Form Body (Zero Visible Scrollbar) */}
              <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl w-full">
                {/* SECTION 1: OWNER IDENTITY & CONTACT */}
                <div className="bg-white border border-[#E8E8ED] rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
                  <div className="border-b border-[#E8E8ED]/60 pb-2">
                    <h3 className="text-xs uppercase font-semibold text-[#8E8E93] tracking-wide">
                      Owner Identity & Contact
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-xs font-semibold text-[#1D1D1F]">
                        Full Ratepayer Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g. MR. EMMANUEL DOE YEVWO"
                        className="w-full px-3 py-2 bg-[#F9F9FB] border border-[#E8E8ED] rounded-lg text-xs font-medium text-[#1D1D1F] outline-none focus:border-[#007AFF] focus:bg-white transition-all"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[#1D1D1F]">
                        Primary Telephone
                      </label>
                      <input
                        type="text"
                        value={formData.telephone}
                        onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                        placeholder="e.g. 024 123 4567 or +233 24 123 4567"
                        className="w-full px-3 py-2 bg-[#F9F9FB] border border-[#E8E8ED] rounded-lg text-xs font-medium text-[#1D1D1F] outline-none focus:border-[#007AFF] focus:bg-white transition-all"
                      />
                      <p className="text-[10.5px] text-[#8E8E93]">Ghana mobile money & SMS delivery line.</p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[#1D1D1F]">
                        Ghana Card PIN / TIN
                      </label>
                      <input
                        type="text"
                        value={formData.tin}
                        onChange={(e) => setFormData({ ...formData, tin: e.target.value })}
                        placeholder="e.g. GHA-000000000-0"
                        className="w-full px-3 py-2 bg-[#F9F9FB] border border-[#E8E8ED] rounded-lg text-xs font-medium text-[#1D1D1F] outline-none focus:border-[#007AFF] focus:bg-white transition-all uppercase"
                      />
                      <p className="text-[10.5px] text-[#8E8E93]">National ID verification code.</p>
                    </div>
                  </div>
                </div>

                {/* SECTION 2: PROPERTY LOCATION & CADASTRE */}
                <div className="bg-white border border-[#E8E8ED] rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
                  <div className="border-b border-[#E8E8ED]/60 pb-2">
                    <h3 className="text-xs uppercase font-semibold text-[#8E8E93] tracking-wide">
                      Property Location & Physical Address
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[#1D1D1F]">
                        Ghana Post Digital Address
                      </label>
                      <input
                        type="text"
                        value={formData.ownerDigitalAddress}
                        onChange={(e) => setFormData({ ...formData, ownerDigitalAddress: e.target.value })}
                        placeholder="e.g. GK-0024-5653"
                        className="w-full px-3 py-2 bg-[#F9F9FB] border border-[#E8E8ED] rounded-lg text-xs font-mono font-medium text-[#1D1D1F] outline-none focus:border-[#007AFF] focus:bg-white transition-all uppercase"
                      />
                      <p className="text-[10.5px] text-[#8E8E93]">Digital cadastre geo-code.</p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[#1D1D1F]">
                        House / Plot Number
                      </label>
                      <input
                        type="text"
                        value={formData.houseNo}
                        onChange={(e) => setFormData({ ...formData, houseNo: e.target.value })}
                        placeholder="e.g. Plot 42, Block B"
                        className="w-full px-3 py-2 bg-[#F9F9FB] border border-[#E8E8ED] rounded-lg text-xs font-medium text-[#1D1D1F] outline-none focus:border-[#007AFF] focus:bg-white transition-all"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[#1D1D1F]">
                        Electoral Area
                      </label>
                      <input
                        type="text"
                        value={formData.electoralArea}
                        onChange={(e) => setFormData({ ...formData, electoralArea: e.target.value })}
                        placeholder="e.g. Kpone / Katamanso"
                        className="w-full px-3 py-2 bg-[#F9F9FB] border border-[#E8E8ED] rounded-lg text-xs font-medium text-[#1D1D1F] outline-none focus:border-[#007AFF] focus:bg-white transition-all"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[#1D1D1F]">
                        Street Name / Landmark
                      </label>
                      <input
                        type="text"
                        value={formData.streetName}
                        onChange={(e) => setFormData({ ...formData, streetName: e.target.value })}
                        placeholder="e.g. Near St. Peter Catholic Church"
                        className="w-full px-3 py-2 bg-[#F9F9FB] border border-[#E8E8ED] rounded-lg text-xs font-medium text-[#1D1D1F] outline-none focus:border-[#007AFF] focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                </div>


                {/* Audit Provenance Card */}
                <div className="p-3.5 bg-white border border-[#E8E8ED] rounded-xl text-xs text-[#8E8E93] flex items-center justify-between">
                  <span>
                    Logged in administrator: <strong className="text-[#1D1D1F]">{currentAdmin?.name || currentAdmin?.username || "Admin"}</strong>
                  </span>
                  <span>Municipal Cadastre Record</span>
                </div>
              </div>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}
