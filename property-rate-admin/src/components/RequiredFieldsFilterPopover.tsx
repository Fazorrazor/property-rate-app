"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { SlidersHorizontal, ChevronDown, Search, X, Check } from "lucide-react";

export interface FieldCriteria {
  key: string;
  label: string;
  category: "Contact" | "Profile" | "Location" | "Identification" | "Financial" | "Classification";
}

export const AVAILABLE_FIELD_CRITERIA: FieldCriteria[] = [
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

interface RequiredFieldsFilterPopoverProps {
  requiredFields: string[];
  onChange: (fields: string[]) => void;
  buttonLabel?: string;
  align?: "left" | "right";
  recommendedPreset?: string[];
}

export function RequiredFieldsFilterPopover({
  requiredFields,
  onChange,
  buttonLabel = "Fields Filter",
  align = "right",
  recommendedPreset = ["telephone", "name", "ownerDigitalAddress"],
}: RequiredFieldsFilterPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [draftFields, setDraftFields] = useState<string[]>(requiredFields);

  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left?: number; right?: number } | null>(null);

  const computePosition = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    if (align === 'right') {
      const rightFromEdge = viewportWidth - rect.right;
      setDropdownPos({ top: rect.bottom + 6, right: rightFromEdge });
    } else {
      setDropdownPos({ top: rect.bottom + 6, left: rect.left });
    }
  };

  useEffect(() => {
    setDraftFields(requiredFields);
  }, [requiredFields]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isOpen &&
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    const handleScrollOrResize = () => {
      if (isOpen) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen]);

  const filteredFields = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return AVAILABLE_FIELD_CRITERIA;
    return AVAILABLE_FIELD_CRITERIA.filter(
      (f) =>
        f.label.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q) ||
        f.key.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const handleToggleField = (key: string) => {
    setDraftFields((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleSelectAll = () => {
    setDraftFields(AVAILABLE_FIELD_CRITERIA.map((f) => f.key));
  };

  const handleClearAll = () => {
    setDraftFields([]);
  };

  const handleSetRecommended = () => {
    setDraftFields(recommendedPreset);
  };

  const handleApply = () => {
    onChange(draftFields);
    setIsOpen(false);
  };

  return (
    <div className="relative shrink-0 z-40">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setDraftFields(requiredFields);
          if (!isOpen) computePosition();
          setIsOpen((prev) => !prev);
        }}
        className={`h-8 px-3 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
          requiredFields.length > 0
            ? "bg-[#007AFF] text-white font-medium border-[#007AFF] shadow-xs"
            : "bg-[#F2F2F7] text-[#1C1C1E] border-[#E5E5EA] hover:bg-[#E5E5EA]"
        }`}
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        <span>{buttonLabel}</span>
        {requiredFields.length > 0 && (
          <span className="ml-0.5 text-[11px] font-bold opacity-90">
            ({requiredFields.length})
          </span>
        )}
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && dropdownPos && (
        <div
          ref={containerRef}
          style={{
            position: 'fixed',
            top: dropdownPos.top,
            ...(dropdownPos.right !== undefined ? { right: dropdownPos.right } : { left: dropdownPos.left }),
            width: Math.min(380, window.innerWidth - 32),
            zIndex: 9999,
          }}
          className="rounded-xl border border-[#E5E5EA] bg-white/95 backdrop-blur-xl shadow-xl p-3 flex flex-col font-sans max-h-[360px] overflow-hidden"
        >
          <div className="flex items-center justify-between border-b border-[#E5E5EA] pb-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#007AFF]" />
              <span className="text-xs font-bold text-[#1C1C1E]">Required Field Criteria</span>
              <span className="text-[10px] text-[#6C6C70]">({AVAILABLE_FIELD_CRITERIA.length} fields)</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-[#8E8E93] hover:text-[#1C1C1E] p-0.5 rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="relative shrink-0 pt-2">
            <Search className="w-3 h-3 text-[#8E8E93] absolute left-2 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
                onClick={handleSelectAll}
                className="text-[#007AFF] hover:underline font-semibold cursor-pointer"
              >
                Select All
              </button>
              <span className="text-[#E5E5EA]">&bull;</span>
              <button
                type="button"
                onClick={handleClearAll}
                className="text-[#6C6C70] hover:underline font-medium cursor-pointer"
              >
                Clear
              </button>
            </div>
            <button
              type="button"
              onClick={handleSetRecommended}
              className="text-[#34C759] hover:underline font-semibold cursor-pointer flex items-center gap-1"
            >
              <span>Recommended Preset</span>
            </button>
          </div>

          <div className="flex-1 min-h-[140px] overflow-y-auto divide-y divide-[#E5E5EA] rounded-lg border border-[#E5E5EA] bg-[#F2F2F7]/50">
            {filteredFields.map((field) => {
              const isChecked = draftFields.includes(field.key);
              return (
                <label
                  key={field.key}
                  onClick={() => handleToggleField(field.key)}
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
            <span>{draftFields.length} field{draftFields.length === 1 ? "" : "s"} required</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="h-6 px-2 rounded border border-[#E5E5EA] text-[#6C6C70] hover:bg-[#F2F2F7] font-medium cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="h-6 px-2.5 rounded bg-[#007AFF] text-white font-semibold cursor-pointer hover:bg-[#007AFF]/90 transition-colors shadow-2xs"
              >
                Apply Filter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
