"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, Calendar, Info, X, Check } from "lucide-react";
import { searchPropertyBillAccounts, PropertyBillAccountSummary } from "@/app/actions";
import { AppleSpinner } from "@/components/ui/AppleSpinner";

interface AccountStatementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onPreview: (accountNo: string, startDate: string, endDate: string) => void;
  initialAccountNo?: string | null;
}

export function AccountStatementDialog({
  isOpen,
  onClose,
  onPreview,
  initialAccountNo,
}: AccountStatementDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PropertyBillAccountSummary[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<PropertyBillAccountSummary | null>(null);

  // Default dates: Start = 1st Jan of 3 years ago, End = current date
  const now = new Date();
  const currentYear = now.getFullYear();
  const defaultStartDate = `${currentYear - 3}-01-01`;
  const defaultEndDate = now.toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Set initial account if passed
  useEffect(() => {
    if (isOpen) {
      if (initialAccountNo) {
        setSearchQuery(initialAccountNo);
        searchPropertyBillAccounts({ searchQuery: initialAccountNo, pageSize: 1 }).then((res) => {
          const accounts = res.accounts ?? [];
          if (res.success && accounts.length > 0) {
            setSelectedAccount(accounts[0]);
          } else {
            // Seed a minimal placeholder so the account number is pre-filled
            setSelectedAccount(null);
          }
        });
      } else {
        setSelectedAccount(null);
        setSearchQuery("");
        setSearchResults([]);
      }
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, initialAccountNo]);

  // Lock background viewport scrolling when statement dialog is active
  useEffect(() => {
    if (isOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (!isOpen) return;
    const query = searchQuery.trim();
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      setErrorMsg(null);
      try {
        const res = await searchPropertyBillAccounts({ searchQuery: query, pageSize: 6 });
        const accounts = res.accounts ?? [];
        if (res.success) {
          setSearchResults(accounts);
          if (
            selectedAccount &&
            accounts.some((a) => a.accountNumber === selectedAccount.accountNumber)
          ) {
            // keep selected
          } else if (
            accounts.length === 1 &&
            query.toLowerCase() === accounts[0].accountNumber.toLowerCase()
          ) {
            setSelectedAccount(accounts[0]);
          }
        }
      } catch (err: any) {
        console.error("Search accounts error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, isOpen, selectedAccount]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleAccountSelect = (acc: PropertyBillAccountSummary) => {
    setSelectedAccount(acc);
    setSearchQuery(acc.accountNumber);
    setSearchResults([]);
    setErrorMsg(null);
  };

  const handlePreviewSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const accNo = selectedAccount?.accountNumber || searchQuery.trim();
    if (!accNo) {
      setErrorMsg("Please select or enter an Account Number.");
      searchInputRef.current?.focus();
      return;
    }
    onPreview(accNo, startDate, endDate);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs transition-opacity duration-200 pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="statement-dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-[704px] bg-white rounded-[10px] shadow-2xl border border-[#E9E9ED] overflow-hidden flex flex-col font-sans transition-transform duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Heading */}
        <div className="px-7 pt-7 pb-4 flex items-start justify-between border-b border-[#F2F2F5]">
          <div>
            <h2 id="statement-dialog-title" className="text-[23px] font-semibold text-[#1D1D1F] tracking-tight">
              Account Statement
            </h2>
            <p className="text-[13px] text-[#737378] mt-1">
              Choose an account and a date range to preview its statement.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#737378] hover:text-[#1D1D1F] hover:bg-[#F2F2F5] transition-colors focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handlePreviewSubmit} className="p-7 space-y-6">
          {/* Account Selector */}
          <div className="space-y-2">
            <label htmlFor="account-search-input" className="block text-xs font-medium text-[#737378]">
              Select Account Number
            </label>
            <div className="relative">
              <div className="flex items-center w-full h-[40px] px-3 bg-[#F2F2F5] rounded-[8px] border border-transparent focus-within:border-[#007AFF] focus-within:bg-white transition-all">
                <Search className="w-4 h-4 text-[#737378] shrink-0 mr-2.5" />
                <input
                  id="account-search-input"
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (selectedAccount && e.target.value !== selectedAccount.accountNumber) {
                      setSelectedAccount(null);
                    }
                  }}
                  placeholder="Search by Account No, Owner Name, or Phone..."
                  className="w-full bg-transparent text-[13px] text-[#1D1D1F] placeholder:text-[#8E8E93] focus:outline-none"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-bwignore="true"
                  data-form-type="other"
                />
                {isSearching && <AppleSpinner size="sm" className="shrink-0 text-[#007AFF] ml-2" />}
                {searchQuery && !isSearching && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedAccount(null);
                      setSearchResults([]);
                    }}
                    className="p-1 text-[#8E8E93] hover:text-[#1D1D1F]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Autocomplete Results Popover */}
              {searchResults.length > 0 && (
                <div className="absolute top-[46px] left-0 right-0 z-20 bg-white rounded-[10px] shadow-lg border border-[#E9E9ED] overflow-hidden max-h-[240px] overflow-y-auto">
                  {searchResults.map((acc) => (
                    <button
                      key={acc.accountNumber}
                      type="button"
                      onClick={() => handleAccountSelect(acc)}
                      className="w-full text-left px-3.5 py-2.5 hover:bg-[#EAF3FF] transition-colors flex items-center justify-between border-b border-[#F2F2F5] last:border-b-0 group"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold text-[#007AFF]">
                            {acc.accountNumber}
                          </span>
                          <span className="text-[13px] text-[#1D1D1F] truncate">
                            {acc.name}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#737378] mt-0.5 flex items-center gap-2">
                          {acc.ownerDigitalAddress && <span>GPS: {acc.ownerDigitalAddress}</span>}
                          {acc.telephone && <span>Tel: {acc.telephone}</span>}
                        </div>
                      </div>
                      <span className="text-[11px] text-[#737378] group-hover:text-[#007AFF] shrink-0 font-medium">
                        Select →
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Selected Account Confirmation Banner */}
              {selectedAccount && (
                <div className="mt-2.5 px-3 py-2 bg-[#EAF3FF] border border-[#B9C4FF]/40 rounded-[8px] flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Check className="w-4 h-4 text-[#007AFF] shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[13px] font-semibold text-[#007AFF] mr-2">
                        {selectedAccount.accountNumber}
                      </span>
                      <span className="text-[12px] text-[#1D1D1F] font-medium truncate">
                        {selectedAccount.name}
                      </span>
                      {selectedAccount.ownerDigitalAddress && (
                        <span className="text-[11px] text-[#737378] ml-2">
                          · {selectedAccount.ownerDigitalAddress}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAccount(null);
                      setSearchQuery("");
                    }}
                    className="text-xs text-[#007AFF] hover:underline shrink-0 ml-2"
                  >
                    Change
                  </button>
                </div>
              )}
            </div>
            {errorMsg && (
              <p className="text-xs text-[#FF3B30] mt-1">{errorMsg}</p>
            )}
          </div>

          {/* Statement Dates Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Start Date */}
            <div className="space-y-1.5">
              <label htmlFor="statement-start-date" className="block text-xs font-medium text-[#737378]">
                Start Date
              </label>
              <div className="relative flex items-center w-full h-[40px] px-3 bg-white rounded-[8px] border border-[#E9E9ED] focus-within:border-[#007AFF] transition-all">
                <Calendar className="w-4 h-4 text-[#737378] mr-2.5 shrink-0" />
                <input
                  id="statement-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full text-[13px] text-[#1D1D1F] bg-transparent focus:outline-none"
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
            </div>

            {/* End Date */}
            <div className="space-y-1.5">
              <label htmlFor="statement-end-date" className="block text-xs font-medium text-[#737378]">
                End Date
              </label>
              <div className="relative flex items-center w-full h-[40px] px-3 bg-white rounded-[8px] border border-[#E9E9ED] focus-within:border-[#007AFF] transition-all">
                <Calendar className="w-4 h-4 text-[#737378] mr-2.5 shrink-0" />
                <input
                  id="statement-end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full text-[13px] text-[#1D1D1F] bg-transparent focus:outline-none"
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
            </div>
          </div>

          {/* Range Note */}
          <div className="flex items-center gap-2 text-[#737378]">
            <Info className="w-3.5 h-3.5 text-[#737378] shrink-0" />
            <span className="text-[11px]">
              Includes all account transactions and assessments within the selected dates.
            </span>
          </div>

          {/* Dialog Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#F2F2F5]">
            <button
              type="button"
              onClick={onClose}
              className="h-[38px] px-4 rounded-[10px] bg-[#F2F2F5] hover:bg-[#E5E5EA] text-[#1D1D1F] text-[13px] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
            >
              Close
            </button>
            <button
              type="submit"
              className="h-[38px] px-5 rounded-[10px] bg-[#007AFF] hover:bg-[#0062CC] text-white text-[13px] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#007AFF] shadow-sm flex items-center gap-1.5"
            >
              Preview
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
