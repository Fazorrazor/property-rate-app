"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { ChevronDown, Check, Search, X } from "lucide-react";

export interface PropertyItem {
  id: string;
  accountNumber: string;
  ownerDigitalAddress?: string;
  totalAmountDue: number;
  totalAmountDueFormatted?: string;
  status?: string;
  isOverdue?: boolean;
}

interface PropertySwitcherProps {
  properties: PropertyItem[];
  activeAccountNumber: string;
  onSelectProperty: (accountNumber: string) => void;
  className?: string;
}

export function PropertySwitcher({
  properties,
  activeAccountNumber,
  onSelectProperty,
  className = "",
}: PropertySwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const sheetRef = useRef<HTMLDivElement>(null);

  const activeIndex = properties.findIndex(
    (p) => p.accountNumber.toLowerCase() === activeAccountNumber.toLowerCase()
  );
  const currentIndex = activeIndex >= 0 ? activeIndex + 1 : 1;
  const totalCount = properties.length;

  const filteredProperties = useMemo(() => {
    if (!searchQuery.trim()) return properties;
    const q = searchQuery.toLowerCase().trim();
    return properties.filter(
      (p) =>
        p.accountNumber.toLowerCase().includes(q) ||
        (p.ownerDigitalAddress && p.ownerDigitalAddress.toLowerCase().includes(q))
    );
  }, [properties, searchQuery]);

  // Handle keyboard Escape and focus trap
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const handleSelect = (accountNumber: string) => {
    onSelectProperty(accountNumber);
    setIsOpen(false);
    setSearchQuery("");
  };

  return (
    <>
      {/* Switcher Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`group inline-flex items-center gap-1.5 min-h-[44px] px-2.5 py-1.5 -mx-2.5 rounded-lg text-left cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${className}`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-1.5 font-mono font-tabular text-[13px] font-semibold text-foreground tracking-tight">
          <span>{activeAccountNumber || "Select Property"}</span>
          <ChevronDown className="w-3.5 h-3.5 text-on-surface-muted group-hover:text-foreground transition-transform duration-200" />
        </div>
        {totalCount > 1 && (
          <span className="text-[12px] text-on-surface-muted font-normal">
            &bull; {currentIndex} of {totalCount}
          </span>
        )}
      </button>

      {/* Mobile Bottom Sheet Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end md:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Sheet Container */}
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="Select Property"
            className="relative w-full max-h-[82dvh] bg-surface rounded-t-[20px] shadow-2xl flex flex-col border-t border-border-light/60 overflow-hidden animate-in slide-in-from-bottom duration-250 ease-out z-10"
          >
            {/* Grab Handle */}
            <div className="w-full pt-3 pb-2 flex justify-center shrink-0">
              <div className="w-9 h-1 rounded-full bg-on-surface-subtle/40" />
            </div>

            {/* Header */}
            <div className="px-5 pb-3 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-[17px] font-semibold tracking-tight text-foreground">
                  Select Property
                </h2>
                <p className="text-[13px] text-on-surface-muted">
                  {totalCount} properties registered to this portfolio
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full bg-surface-subtle flex items-center justify-center text-on-surface-muted hover:text-foreground transition-colors cursor-pointer"
                aria-label="Close sheet"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input (only shown if > 6 properties) */}
            {totalCount > 6 && (
              <div className="px-5 pb-2.5 shrink-0">
                <div className="relative">
                  <Search className="w-4 h-4 text-on-surface-muted absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search account or address"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-10 pl-9 pr-3 rounded-xl bg-surface-subtle text-[16px] text-foreground placeholder:text-on-surface-muted focus:outline-none focus:ring-2 focus:ring-primary/40 border border-border-light/60"
                  />
                </div>
              </div>
            )}

            {/* Property Options List */}
            <div className="flex-1 overflow-y-auto px-3 py-1 space-y-1 divide-y divide-border-subtle/50 overscroll-contain">
              {filteredProperties.length === 0 ? (
                <div className="py-8 text-center text-[13px] text-on-surface-muted">
                  No matching property found.
                </div>
              ) : (
                filteredProperties.map((p) => {
                  const isSelected =
                    p.accountNumber.toLowerCase() === activeAccountNumber.toLowerCase();
                  const isPaid = p.status === "PAID" || p.totalAmountDue <= 0;

                  return (
                    <button
                      key={p.id || p.accountNumber}
                      type="button"
                      onClick={() => handleSelect(p.accountNumber)}
                      className={`w-full min-h-[52px] px-3.5 py-3 rounded-xl flex items-center justify-between text-left transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-primary/8 dark:bg-primary/15"
                          : "hover:bg-surface-subtle"
                      }`}
                    >
                      <div className="min-w-0 pr-3">
                        <div className="font-mono font-tabular text-[15px] font-semibold text-foreground tracking-tight">
                          {p.accountNumber}
                        </div>
                        {p.ownerDigitalAddress && (
                          <div className="text-[12px] text-on-surface-muted font-mono truncate mt-0.5">
                            {p.ownerDigitalAddress}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <span className="font-tabular text-[14px] font-semibold text-foreground block">
                            {p.totalAmountDueFormatted ||
                              `GH₵ ${Number(p.totalAmountDue || 0).toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}`}
                          </span>
                          <span
                            className={`text-[11px] font-medium block mt-0.5 ${
                              isPaid ? "text-on-surface-muted" : "text-[#FF3B30] dark:text-[#FF453A]"
                            }`}
                          >
                            {isPaid ? "• Settled" : "• Due Dec 31"}
                          </span>
                        </div>

                        {isSelected && (
                          <Check className="w-4 h-4 text-primary shrink-0 stroke-[2.5]" />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Bottom Safe Area Padding */}
            <div className="h-6 shrink-0" style={{ paddingBottom: "env(safe-area-inset-bottom)" }} />
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Desktop Persistent Sidebar Pane for Property Switcher
 */
export function PropertySidebarPane({
  properties,
  activeAccountNumber,
  onSelectProperty,
  className = "",
}: PropertySwitcherProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredProperties = useMemo(() => {
    if (!searchQuery.trim()) return properties;
    const q = searchQuery.toLowerCase().trim();
    return properties.filter(
      (p) =>
        p.accountNumber.toLowerCase().includes(q) ||
        (p.ownerDigitalAddress && p.ownerDigitalAddress.toLowerCase().includes(q))
    );
  }, [properties, searchQuery]);

  return (
    <aside className={`w-80 shrink-0 border-r border-border-light/60 bg-surface flex flex-col ${className}`}>
      <div className="p-4 border-b border-border-light/60 shrink-0">
        <h2 className="text-[15px] font-semibold text-foreground tracking-tight">
          Properties
        </h2>
        <p className="text-[12px] text-on-surface-muted">
          {properties.length} account{properties.length === 1 ? "" : "s"} in portfolio
        </p>
        {properties.length > 6 && (
          <div className="mt-3 relative">
            <Search className="w-3.5 h-3.5 text-on-surface-muted absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Search properties"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-8 pr-3 rounded-lg bg-surface-subtle text-[13px] text-foreground placeholder:text-on-surface-muted focus:outline-none focus:ring-2 focus:ring-primary/40 border border-border-light/60"
            />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-border-subtle/50">
        {filteredProperties.map((p) => {
          const isSelected = p.accountNumber.toLowerCase() === activeAccountNumber.toLowerCase();
          const isPaid = p.status === "PAID" || p.totalAmountDue <= 0;

          return (
            <button
              key={p.id || p.accountNumber}
              type="button"
              onClick={() => onSelectProperty(p.accountNumber)}
              className={`w-full p-3 rounded-xl text-left transition-colors cursor-pointer flex items-center justify-between ${
                isSelected ? "bg-primary/10 text-primary" : "hover:bg-surface-subtle text-foreground"
              }`}
            >
              <div className="min-w-0 pr-2">
                <div className="font-mono font-tabular text-[13px] font-semibold tracking-tight text-foreground">
                  {p.accountNumber}
                </div>
                {p.ownerDigitalAddress && (
                  <div className="text-[11px] text-on-surface-muted font-mono truncate mt-0.5">
                    {p.ownerDigitalAddress}
                  </div>
                )}
              </div>

              <div className="text-right shrink-0 flex items-center gap-2">
                <div>
                  <span className="font-tabular text-[13px] font-semibold text-foreground block">
                    {p.totalAmountDueFormatted ||
                      `GH₵ ${Number(p.totalAmountDue || 0).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`}
                  </span>
                  <span
                    className={`text-[10px] font-medium block mt-0.5 ${
                      isPaid ? "text-on-surface-muted" : "text-[#FF3B30] dark:text-[#FF453A]"
                    }`}
                  >
                    {isPaid ? "• Settled" : "• Due Dec 31"}
                  </span>
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-primary stroke-[2.5]" />}
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
