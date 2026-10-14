"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  X,
  MoreVertical,
  MoreHorizontal,
  Bookmark,
  Plus,
  RotateCcw,
  AlertTriangle,
  ChevronDown,
  Info,
  Check,
  Edit2,
  Trash2,
  Undo2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface MessageTemplatePreset {
  id: string;
  name: string;
  type: "BILLING" | "RECEIPT";
  filterKey?: string;
  content: string;
  savedAt?: string;
}

export interface DynamicTokenItem {
  tag: string;
  label: string;
}

interface MessageTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTemplateType: "BILLING" | "RECEIPT";
  onTemplateTypeChange: (type: "BILLING" | "RECEIPT", status?: string) => void;
  targetStatus: string; // "UNPAID" | "ALL" | "PAID" | "OVERPAID"
  currentTemplate: string;
  onTemplateChange: (val: string) => void;
  savedTemplates: MessageTemplatePreset[];
  onApplyPreset: (content: string, filterKey?: string) => void;
  onSavePreset?: (presetName: string, content: string) => void;
  onRenamePreset?: (presetId: string, newName: string) => void;
  onDeletePreset?: (presetId: string) => void;
  onRestorePreset?: (preset: MessageTemplatePreset) => void;
  onResetToDefault: () => void;
  onSave: () => Promise<void>;
  isSaving: boolean;
  dynamicTokens: DynamicTokenItem[];
}

// GSM-7 Standard character set regex
const GSM_7BIT_REGEX =
  /^[@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§a-zäöñüà^{}\\[~\]|€\s]*$/;

// Human-friendly token titles and real-world examples
const FRIENDLY_TOKEN_INFO: Record<string, { friendly: string; example: string }> = {
  "{{ownerName}}": { friendly: "Ratepayer Name", example: "Kwame Mensah" },
  "{{accountNumber}}": { friendly: "Property Account / Valuation ID", example: "KKMA-004291" },
  "{{totalAmountDue}}": { friendly: "Total Amount Due", example: "GH₵ 450.00" },
  "{{arrears}}": { friendly: "Outstanding Arrears", example: "GH₵ 120.00" },
  "{{currentFee}}": { friendly: "Current Year Fee", example: "GH₵ 330.00" },
  "{{propertyGpsAddress}}": { friendly: "Property Digital Address", example: "GK-0123-4567" },
  "{{dueDate}}": { friendly: "Payment Due Date", example: "31 Dec 2026" },
  "{{paymentLink}}": { friendly: "Online Payment Link", example: "https://kkma.gov.gh/pay/4291" },
  "{{link_checkout}}": { friendly: "Instant Checkout Link", example: "https://kkma.gov.gh/pay/4291" },
  "{{link_assessment}}": { friendly: "Digital Bill View Link", example: "https://kkma.gov.gh/bill/4291" },
  "{{municipality}}": { friendly: "Municipality Name", example: "KKMA" },
  "{{billYear}}": { friendly: "Billing Year", example: "2026" },
  "{{propertyAccounts}}": { friendly: "Multi-Property Accounts", example: "KKMA-004291, KKMA-004292" },
  "{{amount}}": { friendly: "Amount Paid", example: "GH₵ 450.00" },
  "{{receiptNumber}}": { friendly: "GCR Receipt Number", example: "GCR-2026-0814" },
  "{{receiptLink}}": { friendly: "Receipt Download Link", example: "https://kkma.gov.gh/receipt/814" },
  "{{paymentMethod}}": { friendly: "Payment Channel / Method", example: "MTN Mobile Money" },
  "{{datePaid}}": { friendly: "Payment Date", example: "13 Oct 2026" },
};

const TEMPLATE_TYPE_OPTIONS = [
  { value: "UNPAID", label: "Annual Bill (Unpaid Accounts)", category: "BILLING" },
  { value: "ALL", label: "General Notice (All Accounts)", category: "BILLING" },
  { value: "PAID", label: "Settlement Clearance (Paid Accounts)", category: "BILLING" },
  { value: "OVERPAID", label: "Credit Statement (Overpaid Accounts)", category: "BILLING" },
  { value: "RECEIPT", label: "Payment Receipt Confirmation", category: "RECEIPT" },
];

export function MessageTemplateModal({
  isOpen,
  onClose,
  activeTemplateType,
  onTemplateTypeChange,
  targetStatus,
  currentTemplate,
  onTemplateChange,
  savedTemplates,
  onApplyPreset,
  onSavePreset,
  onRenamePreset,
  onDeletePreset,
  onRestorePreset,
  onResetToDefault,
  onSave,
  isSaving,
  dynamicTokens,
}: MessageTemplateModalProps) {
  // Track initial snapshot for dirty state check & discard confirmation
  const [initialText, setInitialText] = useState(currentTemplate);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Custom Template Type dropdown
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const typeDropdownRef = useRef<HTMLDivElement>(null);

  // Overflow header menu
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const overflowMenuRef = useRef<HTMLDivElement>(null);

  // Popovers
  const [showPresetsMenu, setShowPresetsMenu] = useState(false);
  const [showFieldInserter, setShowFieldInserter] = useState(false);
  const presetsMenuRef = useRef<HTMLDivElement>(null);
  const fieldInserterRef = useRef<HTMLDivElement>(null);

  // Inline "Save as preset" form
  const [isSavingPresetInline, setIsSavingPresetInline] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");
  const [savePresetError, setSavePresetError] = useState<string | null>(null);
  const savePresetInputRef = useRef<HTMLInputElement>(null);

  // Row inline rename state
  const [renamingPresetId, setRenamingPresetId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Row quiet action popover (Rename / Delete)
  const [rowActionPresetId, setRowActionPresetId] = useState<string | null>(null);

  // Undo delete toast
  const [deletedPresetToast, setDeletedPresetToast] = useState<MessageTemplatePreset | null>(null);
  const undoToastTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Textarea reference for cursor-targeted insertion
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setInitialText(currentTemplate);
      setShowDiscardConfirm(false);
      setShowResetConfirm(false);
      setShowOverflowMenu(false);
      setShowPresetsMenu(false);
      setShowFieldInserter(false);
      setShowTypeDropdown(false);
      setIsSavingPresetInline(false);
      setNewPresetName("");
      setSavePresetError(null);
      setRenamingPresetId(null);
      setRowActionPresetId(null);
    }
  }, [isOpen]);

  // Autofocus save preset input
  useEffect(() => {
    if (isSavingPresetInline) {
      setTimeout(() => {
        savePresetInputRef.current?.focus();
      }, 50);
    }
  }, [isSavingPresetInline]);

  // Autofocus rename input
  useEffect(() => {
    if (renamingPresetId) {
      setTimeout(() => {
        renameInputRef.current?.focus();
        renameInputRef.current?.select();
      }, 50);
    }
  }, [renamingPresetId]);

  // Outside click listener for all dropdowns & popovers
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        showOverflowMenu &&
        overflowMenuRef.current &&
        !overflowMenuRef.current.contains(target)
      ) {
        setShowOverflowMenu(false);
      }
      if (
        showTypeDropdown &&
        typeDropdownRef.current &&
        !typeDropdownRef.current.contains(target)
      ) {
        setShowTypeDropdown(false);
      }
      if (
        showPresetsMenu &&
        presetsMenuRef.current &&
        !presetsMenuRef.current.contains(target)
      ) {
        setShowPresetsMenu(false);
        setIsSavingPresetInline(false);
        setNewPresetName("");
        setSavePresetError(null);
        setRowActionPresetId(null);
      }
      if (
        showFieldInserter &&
        fieldInserterRef.current &&
        !fieldInserterRef.current.contains(target)
      ) {
        setShowFieldInserter(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showTypeDropdown) setShowTypeDropdown(false);
        if (showPresetsMenu) {
          setShowPresetsMenu(false);
          setIsSavingPresetInline(false);
          setRowActionPresetId(null);
        }
        if (showFieldInserter) setShowFieldInserter(false);
        if (showOverflowMenu) setShowOverflowMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showOverflowMenu, showTypeDropdown, showPresetsMenu, showFieldInserter]);

  const isDirty = currentTemplate !== initialText;

  // Attempt close with discard check
  const handleAttemptClose = () => {
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  };

  // Insert token at cursor position
  const handleInsertToken = (tokenTag: string) => {
    const el = textareaRef.current;
    if (!el) {
      onTemplateChange(currentTemplate + tokenTag);
      setShowFieldInserter(false);
      return;
    }

    const start = el.selectionStart ?? currentTemplate.length;
    const end = el.selectionEnd ?? currentTemplate.length;
    const nextText =
      currentTemplate.substring(0, start) + tokenTag + currentTemplate.substring(end);

    onTemplateChange(nextText);
    setShowFieldInserter(false);

    // Return focus and restore cursor position after inserted token
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + tokenTag.length, start + tokenTag.length);
    }, 50);
  };

  // SMS character and segment calculation
  const { charCount, segmentCount, isGsm, isOverSegments } = useMemo(() => {
    const text = currentTemplate;
    const chars = text.length;
    const gsm = GSM_7BIT_REGEX.test(text);

    let segs = 0;
    if (chars > 0) {
      if (gsm) {
        segs = chars <= 160 ? 1 : Math.ceil(chars / 153);
      } else {
        segs = chars <= 70 ? 1 : Math.ceil(chars / 67);
      }
    }

    return {
      charCount: chars,
      segmentCount: segs,
      isGsm: gsm,
      isOverSegments: segs > 3,
    };
  }, [currentTemplate]);

  // Token validation
  const { unknownTokens, isMissingPaymentLink } = useMemo(() => {
    const matches = currentTemplate.match(/\{\{[^}]+\}\}/g) || [];
    const validTags = new Set([
      ...dynamicTokens.map((t) => t.tag),
      "{{ownerName}}",
      "{{accountNumber}}",
      "{{totalAmountDue}}",
      "{{arrears}}",
      "{{currentFee}}",
      "{{propertyGpsAddress}}",
      "{{dueDate}}",
      "{{paymentLink}}",
      "{{link_checkout}}",
      "{{link_assessment}}",
      "{{municipality}}",
      "{{billYear}}",
      "{{propertyAccounts}}",
      "{{amount}}",
      "{{receiptNumber}}",
      "{{receiptLink}}",
      "{{paymentMethod}}",
      "{{datePaid}}",
    ]);

    const unknown: string[] = [];
    matches.forEach((m) => {
      if (!validTags.has(m) && !unknown.includes(m)) {
        unknown.push(m);
      }
    });

    const isBilling = activeTemplateType === "BILLING";
    const hasPayLink =
      currentTemplate.includes("{{paymentLink}}") ||
      currentTemplate.includes("{{link_checkout}}");
    const missingPayLink = isBilling && targetStatus !== "PAID" && !hasPayLink;

    return {
      unknownTokens: unknown,
      isMissingPaymentLink: missingPayLink,
    };
  }, [currentTemplate, dynamicTokens, activeTemplateType, targetStatus]);

  // Relevant presets for active template type
  const relevantPresets = useMemo(() => {
    return savedTemplates.filter((st) => st.type === activeTemplateType);
  }, [savedTemplates, activeTemplateType]);

  // Selected template type object
  const currentTypeOption = useMemo(() => {
    if (activeTemplateType === "RECEIPT") {
      return TEMPLATE_TYPE_OPTIONS.find((o) => o.value === "RECEIPT");
    }
    return (
      TEMPLATE_TYPE_OPTIONS.find((o) => o.value === targetStatus) ||
      TEMPLATE_TYPE_OPTIONS[0]
    );
  }, [activeTemplateType, targetStatus]);

  // Execute Save as preset
  const handleExecuteSavePreset = () => {
    const trimmed = newPresetName.trim();
    if (!trimmed) return;

    // Check duplicate
    const isDuplicate = relevantPresets.some(
      (p) => p.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (isDuplicate) {
      setSavePresetError("Name already used");
      return;
    }

    if (onSavePreset) {
      onSavePreset(trimmed, currentTemplate);
    }
    setIsSavingPresetInline(false);
    setNewPresetName("");
    setSavePresetError(null);
    setShowPresetsMenu(false);
  };

  // Execute Rename preset
  const handleExecuteRename = (presetId: string) => {
    const trimmed = renameValue.trim();
    if (trimmed && onRenamePreset) {
      onRenamePreset(presetId, trimmed);
    }
    setRenamingPresetId(null);
    setRenameValue("");
    setRowActionPresetId(null);
  };

  // Execute Delete preset with 5-second Undo toast
  const handleExecuteDelete = (preset: MessageTemplatePreset) => {
    if (onDeletePreset) {
      onDeletePreset(preset.id);
    }
    setRowActionPresetId(null);

    // Show Undo toast
    setDeletedPresetToast(preset);
    if (undoToastTimerRef.current) clearTimeout(undoToastTimerRef.current);
    undoToastTimerRef.current = setTimeout(() => {
      setDeletedPresetToast(null);
    }, 5000);
  };

  // Undo delete
  const handleUndoDelete = () => {
    if (deletedPresetToast && onRestorePreset) {
      onRestorePreset(deletedPresetToast);
      setDeletedPresetToast(null);
      if (undoToastTimerRef.current) clearTimeout(undoToastTimerRef.current);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-0 sm:p-4 font-sans select-none">
      {/* Modal Container (Strictly Light Theme, Apple HIG) */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 30 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="w-full sm:max-w-[560px] h-[92dvh] sm:h-auto max-h-[100dvh] sm:max-h-[90vh] bg-white border-t sm:border border-[#E5E5EA] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden text-[#1D1D1F]"
      >
        {/* 1. Header */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-[#E5E5EA] flex items-center justify-between shrink-0 bg-white">
          <div className="min-w-0 pr-2">
            <h3 className="text-base font-bold text-[#1D1D1F] leading-tight truncate">
              Message Template
            </h3>
            <p className="text-xs text-[#8E8E93] leading-tight truncate mt-0.5">
              Edit the SMS sent to property owners.
            </p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Header Three-Dot Overflow Menu */}
            <div className="relative" ref={overflowMenuRef}>
              <button
                type="button"
                onClick={() => setShowOverflowMenu((prev) => !prev)}
                title="More options"
                aria-label="More options"
                className="w-9 h-9 flex items-center justify-center rounded-lg text-[#8E8E93] hover:text-[#1D1D1F] hover:bg-[#F2F2F7] transition-colors cursor-pointer"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {showOverflowMenu && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white/95 backdrop-blur-md border border-[#E5E5EA] rounded-xl shadow-xl py-1 z-30 font-medium text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setShowOverflowMenu(false);
                      setShowResetConfirm(true);
                    }}
                    className="w-full px-3.5 py-2.5 text-left text-[#FF3B30] hover:bg-[#F2F2F7] flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset to default</span>
                  </button>
                </div>
              )}
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={handleAttemptClose}
              title="Close modal"
              aria-label="Close modal"
              className="w-9 h-9 flex items-center justify-center rounded-lg text-[#8E8E93] hover:text-[#1D1D1F] hover:bg-[#F2F2F7] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. Top Controls (Properly Crafted Apple Filter UI) */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-[#E5E5EA] bg-[#FAFAFC] space-y-2.5 shrink-0">
          {/* Custom Template Type Selector */}
          <div className="space-y-1 relative" ref={typeDropdownRef}>
            <label className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider block">
              Template type
            </label>
            <button
              type="button"
              onClick={() => {
                setShowTypeDropdown((prev) => !prev);
                setShowPresetsMenu(false);
                setShowFieldInserter(false);
              }}
              className="w-full bg-white hover:bg-[#F9F9FA] text-[#1D1D1F] border border-[#E5E5EA] rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-[#007AFF] cursor-pointer flex items-center justify-between min-h-[42px] transition-colors"
            >
              <span className="truncate">{currentTypeOption?.label}</span>
              <ChevronDown
                className={`w-4 h-4 text-[#8E8E93] transition-transform duration-200 ${
                  showTypeDropdown ? "rotate-180 text-[#007AFF]" : ""
                }`}
              />
            </button>

            {/* Type Options Popover */}
            {showTypeDropdown && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-white/95 backdrop-blur-md border border-[#E5E5EA] rounded-xl shadow-xl py-1 z-40 space-y-0.5 text-xs">
                {TEMPLATE_TYPE_OPTIONS.map((opt) => {
                  const isSelected =
                    opt.category === "RECEIPT"
                      ? activeTemplateType === "RECEIPT"
                      : activeTemplateType === "BILLING" && targetStatus === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        if (opt.category === "RECEIPT") {
                          onTemplateTypeChange("RECEIPT");
                        } else {
                          onTemplateTypeChange("BILLING", opt.value);
                        }
                        setShowTypeDropdown(false);
                      }}
                      className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between hover:bg-[#F2F2F7] transition-colors cursor-pointer ${
                        isSelected ? "text-[#007AFF] font-bold" : "text-[#1D1D1F] font-medium"
                      }`}
                    >
                      <span className="truncate">{opt.label}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#007AFF] stroke-[2.5]" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Action Row: Presets & Insert Field */}
          <div className="flex items-center gap-2 pt-0.5">
            {/* Presets Button & Apple-like Minimal Dropdown */}
            <div className="relative flex-1" ref={presetsMenuRef}>
              <button
                type="button"
                onClick={() => {
                  setShowPresetsMenu((prev) => !prev);
                  setShowFieldInserter(false);
                  setShowTypeDropdown(false);
                  setIsSavingPresetInline(false);
                  setNewPresetName("");
                  setSavePresetError(null);
                }}
                className={`w-full h-10 px-3 rounded-xl bg-white border border-[#E5E5EA] hover:bg-[#F2F2F7] text-xs font-semibold text-[#1D1D1F] flex items-center justify-between transition-colors cursor-pointer whitespace-nowrap min-h-[40px] ${
                  showPresetsMenu ? "border-[#007AFF] text-[#007AFF]" : ""
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <Bookmark className="w-3.5 h-3.5 text-[#007AFF]" />
                  <span>Presets</span>
                </div>
                <ChevronDown
                  className={`w-3 h-3 text-[#8E8E93] transition-transform duration-200 ${
                    showPresetsMenu ? "rotate-180 text-[#007AFF]" : ""
                  }`}
                />
              </button>

              {/* Minimal Apple-like Presets Dropdown */}
              <AnimatePresence>
                {showPresetsMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                    transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                    style={{ transformOrigin: "top left" }}
                    role="menu"
                    className="absolute left-0 top-full mt-1.5 w-72 sm:w-80 max-w-[calc(100vw-32px)] min-w-[240px] bg-white/95 backdrop-blur-md border border-[#E5E5EA] rounded-[12px] shadow-xl z-40 overflow-hidden flex flex-col font-sans"
                  >
                    {/* Presets List */}
                    <div className="max-h-[50dvh] sm:max-h-60 overflow-y-auto no-scrollbar py-1 divide-y divide-[#F2F2F7]">
                      {relevantPresets.length === 0 ? (
                        <div className="py-4 text-center text-xs text-[#8E8E93]">
                          No presets yet
                        </div>
                      ) : (
                        relevantPresets.map((preset) => {
                          const isCurrentActive =
                            preset.content.trim() === currentTemplate.trim();
                          const isRenaming = renamingPresetId === preset.id;

                          return (
                            <div
                              key={preset.id}
                              role="menuitem"
                              className="group relative flex items-center justify-between px-4 min-h-[44px] sm:min-h-[36px] hover:bg-[#F2F2F7] active:bg-[#E5E5EA] transition-colors duration-120 cursor-pointer"
                            >
                              {isRenaming ? (
                                <div className="flex items-center gap-1.5 w-full py-1">
                                  <input
                                    ref={renameInputRef}
                                    type="text"
                                    value={renameValue}
                                    onChange={(e) => setRenameValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") handleExecuteRename(preset.id);
                                      if (e.key === "Escape") setRenamingPresetId(null);
                                    }}
                                    onBlur={() => handleExecuteRename(preset.id)}
                                    className="w-full bg-white border border-[#007AFF] rounded px-2 py-1 text-xs text-[#1D1D1F] outline-none"
                                  />
                                </div>
                              ) : (
                                <>
                                  {/* Row Tap Target (Loads preset) */}
                                  <div
                                    onClick={() => {
                                      onApplyPreset(preset.content, preset.filterKey);
                                      setShowPresetsMenu(false);
                                    }}
                                    className="flex-1 min-w-0 pr-2 py-2"
                                    title={preset.name}
                                  >
                                    <span className="text-xs sm:text-[13px] font-normal text-[#1D1D1F] truncate block">
                                      {preset.name}
                                    </span>
                                  </div>

                                  {/* Right Indicators: Checkmark & Quiet "..." Menu */}
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {isCurrentActive && (
                                      <Check className="w-4 h-4 text-[#007AFF] stroke-[2.5]" />
                                    )}

                                    {/* Trailing "..." Row Actions Trigger */}
                                    <div className="relative">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setRowActionPresetId(
                                            rowActionPresetId === preset.id ? null : preset.id
                                          );
                                        }}
                                        title="Preset options"
                                        aria-label="Preset options"
                                        className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#E5E5EA] text-[#8E8E93] hover:text-[#1D1D1F] transition-opacity cursor-pointer opacity-80 sm:opacity-0 group-hover:opacity-100 focus:opacity-100"
                                      >
                                        <MoreHorizontal className="w-3.5 h-3.5" />
                                      </button>

                                      {/* Row Action Popover */}
                                      {rowActionPresetId === preset.id && (
                                        <div className="absolute right-0 top-full mt-1 w-28 bg-white border border-[#E5E5EA] rounded-xl shadow-lg py-1 z-50 text-xs">
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setRenameValue(preset.name);
                                              setRenamingPresetId(preset.id);
                                              setRowActionPresetId(null);
                                            }}
                                            className="w-full px-3 py-1.5 text-left text-[#1D1D1F] hover:bg-[#F2F2F7] flex items-center gap-1.5 cursor-pointer"
                                          >
                                            <Edit2 className="w-3 h-3 text-[#8E8E93]" />
                                            <span>Rename</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleExecuteDelete(preset);
                                            }}
                                            className="w-full px-3 py-1.5 text-left text-[#FF3B30] hover:bg-[#F2F2F7] flex items-center gap-1.5 cursor-pointer"
                                          >
                                            <Trash2 className="w-3 h-3 text-[#FF3B30]" />
                                            <span>Delete</span>
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Pinned Save Action at Bottom */}
                    <div className="border-t border-[#E5E5EA] bg-[#FAFAFC] p-2">
                      {isSavingPresetInline ? (
                        <div className="space-y-1.5 p-1.5 bg-white border border-[#E5E5EA] rounded-lg">
                          <input
                            ref={savePresetInputRef}
                            type="text"
                            value={newPresetName}
                            onChange={(e) => {
                              setNewPresetName(e.target.value);
                              if (savePresetError) setSavePresetError(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleExecuteSavePreset();
                              if (e.key === "Escape") {
                                setIsSavingPresetInline(false);
                                setNewPresetName("");
                                setSavePresetError(null);
                              }
                            }}
                            placeholder="Preset name"
                            className="w-full bg-[#F5F5F7] border border-[#E5E5EA] rounded px-2.5 py-1.5 text-xs text-[#1D1D1F] outline-none focus:border-[#007AFF] text-[16px] sm:text-xs"
                          />

                          {savePresetError && (
                            <span className="text-[11px] text-[#FF3B30] font-medium block px-1">
                              {savePresetError}
                            </span>
                          )}

                          <div className="flex items-center justify-end gap-1.5 pt-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                setIsSavingPresetInline(false);
                                setNewPresetName("");
                                setSavePresetError(null);
                              }}
                              className="px-2.5 py-1 text-xs text-[#8E8E93] hover:text-[#1D1D1F] cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={!newPresetName.trim()}
                              onClick={handleExecuteSavePreset}
                              className="px-3 py-1 text-xs font-semibold bg-[#007AFF] text-white rounded-lg disabled:opacity-40 cursor-pointer"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setIsSavingPresetInline(true);
                            setSavePresetError(null);
                          }}
                          className="w-full px-3 py-2 text-left text-xs font-medium text-[#1D1D1F] hover:bg-white rounded-lg flex items-center gap-2 cursor-pointer transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5 text-[#8E8E93]" />
                          <span>Save as preset</span>
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Insert Field Button & Popover */}
            <div className="relative flex-1" ref={fieldInserterRef}>
              <button
                type="button"
                onClick={() => {
                  setShowFieldInserter((prev) => !prev);
                  setShowPresetsMenu(false);
                  setShowTypeDropdown(false);
                }}
                className={`w-full h-10 px-3 rounded-xl bg-white border border-[#E5E5EA] hover:bg-[#F2F2F7] text-xs font-semibold text-[#1D1D1F] flex items-center justify-between transition-colors cursor-pointer whitespace-nowrap min-h-[40px] ${
                  showFieldInserter ? "border-[#007AFF] text-[#007AFF]" : ""
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <Plus className="w-3.5 h-3.5 text-[#007AFF]" />
                  <span>Insert field</span>
                </div>
                <ChevronDown
                  className={`w-3 h-3 text-[#8E8E93] transition-transform duration-200 ${
                    showFieldInserter ? "rotate-180 text-[#007AFF]" : ""
                  }`}
                />
              </button>

              {/* Insert Field Popover */}
              <AnimatePresence>
                {showFieldInserter && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                    transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                    style={{ transformOrigin: "top right" }}
                    className="absolute right-0 top-full mt-1.5 w-72 sm:w-84 max-w-[calc(100vw-32px)] min-w-[240px] bg-white/95 backdrop-blur-md border border-[#E5E5EA] rounded-[12px] shadow-xl p-2 z-40 space-y-1 text-xs overflow-hidden"
                  >
                    <div className="px-2 py-1 text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider border-b border-[#E5E5EA] flex items-center justify-between">
                      <span>Available Fields</span>
                      <span className="text-[10px] text-[#8E8E93]">Tap to insert</span>
                    </div>

                    <div className="max-h-60 overflow-y-auto no-scrollbar space-y-1 py-1">
                      {dynamicTokens.map((t) => {
                        const meta = FRIENDLY_TOKEN_INFO[t.tag] || {
                          friendly: t.label,
                          example: t.tag,
                        };
                        return (
                          <button
                            key={t.tag}
                            type="button"
                            onClick={() => handleInsertToken(t.tag)}
                            className="w-full text-left p-2 rounded-lg hover:bg-[#F2F2F7] transition-colors cursor-pointer group flex flex-col gap-0.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-[#1D1D1F] text-xs group-hover:text-[#007AFF]">
                                {meta.friendly}
                              </span>
                              <span className="font-mono text-[10px] text-[#8E8E93] group-hover:text-[#007AFF]">
                                {t.tag}
                              </span>
                            </div>
                            <span className="text-[11px] text-[#8E8E93] truncate">
                              e.g. {meta.example}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* 3. Editor Body (Direct, Full-Height Textarea) */}
        <div className="flex-1 min-h-0 flex flex-col p-4 sm:p-5 overflow-y-auto no-scrollbar bg-white">
          <div className="flex-1 min-h-0 flex flex-col gap-2">
            {/* Textarea filling available height */}
            <div className="flex-1 min-h-0 flex flex-col">
              <textarea
                ref={textareaRef}
                value={currentTemplate}
                onChange={(e) => onTemplateChange(e.target.value)}
                placeholder="Type or customize your SMS message template here..."
                className="w-full flex-1 min-h-[220px] p-3.5 rounded-xl border border-[#E5E5EA] bg-[#FAFAFC] text-[16px] sm:text-sm text-[#1D1D1F] placeholder-[#8E8E93] outline-none focus:border-[#007AFF] focus:bg-white resize-none font-sans leading-relaxed transition-all"
              />
            </div>

            {/* Character and SMS segment calculation */}
            <div className="flex items-center justify-between text-xs pt-1 shrink-0">
              <span
                className={`font-medium ${
                  isOverSegments ? "text-[#FF9500] font-semibold" : "text-[#8E8E93]"
                }`}
              >
                {charCount} characters · {segmentCount} SMS
                {isOverSegments && " (High segment count)"}
              </span>

              <span className="text-[11px] text-[#8E8E93]">
                {isGsm ? "GSM-7 (160/SMS)" : "Unicode (70/SMS)"}
              </span>
            </div>

            {/* Validation Warnings */}
            {unknownTokens.length > 0 && (
              <div className="flex items-start gap-1.5 text-xs text-[#FF3B30] bg-[#FFF2F2] p-2.5 rounded-xl border border-[#FF3B30]/20 shrink-0">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Unknown field: </span>
                  <span>
                    {unknownTokens.join(", ")} will not be replaced with ratepayer data.
                  </span>
                </div>
              </div>
            )}

            {isMissingPaymentLink && (
              <div className="flex items-start gap-1.5 text-xs text-[#007AFF] bg-[#F0F7FF] p-2.5 rounded-xl border border-[#007AFF]/20 shrink-0">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Soft hint: </span>
                  <span>
                    Payment link is not included in this notice. Ratepayers will not receive a direct checkout link.
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 4. Sticky Footer */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-t border-[#E5E5EA] bg-white flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0">
          {/* Quick encoding label */}
          <span className="text-[11px] font-mono text-[#8E8E93] uppercase hidden sm:inline">
            {isGsm ? "Standard GSM-7" : "Unicode (UCS-2)"}
          </span>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleAttemptClose}
              className="flex-1 sm:flex-initial h-11 sm:h-9 px-4 rounded-xl text-xs font-semibold text-[#8E8E93] hover:text-[#1D1D1F] hover:bg-[#F2F2F7] transition-colors cursor-pointer min-h-[44px] sm:min-h-[36px] flex items-center justify-center"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={!isDirty || isSaving}
              onClick={async () => {
                await onSave();
                onClose();
              }}
              className="flex-1 sm:flex-initial h-11 sm:h-9 px-6 rounded-xl bg-[#007AFF] hover:bg-[#0066D6] disabled:bg-[#007AFF]/40 text-white font-semibold text-xs transition-all cursor-pointer disabled:cursor-not-allowed shadow-xs min-h-[44px] sm:min-h-[36px] flex items-center justify-center gap-1.5"
            >
              {isSaving ? (
                <span>Saving...</span>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Save</span>
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Undo Delete Toast */}
      <AnimatePresence>
        {deletedPresetToast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-60 bg-[#1D1D1F] text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-3 text-xs"
          >
            <span>Preset deleted</span>
            <button
              type="button"
              onClick={handleUndoDelete}
              className="text-[#007AFF] font-bold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Undo</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Discard Changes Confirmation Modal */}
      <AnimatePresence>
        {showDiscardConfirm && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs font-sans">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm bg-white border border-[#E5E5EA] rounded-2xl p-5 shadow-2xl space-y-3"
            >
              <h4 className="text-sm font-bold text-[#1D1D1F]">
                Discard changes?
              </h4>
              <p className="text-xs text-[#6C6C70] leading-relaxed">
                You have unsaved changes to this message template. If you exit now, your edits will be discarded.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDiscardConfirm(false)}
                  className="px-3 py-2 text-xs font-semibold text-[#8E8E93] hover:text-[#1D1D1F] cursor-pointer min-h-[40px]"
                >
                  Keep editing
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDiscardConfirm(false);
                    onClose();
                  }}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#FF3B30] hover:bg-[#D70015] rounded-xl cursor-pointer min-h-[40px]"
                >
                  Discard
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reset Confirmation Modal */}
      <AnimatePresence>
        {showResetConfirm && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs font-sans">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm bg-white border border-[#E5E5EA] rounded-2xl p-5 shadow-2xl space-y-3"
            >
              <h4 className="text-sm font-bold text-[#1D1D1F]">
                Reset to default template?
              </h4>
              <p className="text-xs text-[#6C6C70] leading-relaxed">
                This will replace your current text with the standard municipal template for this category.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  className="px-3 py-2 text-xs font-semibold text-[#8E8E93] hover:text-[#1D1D1F] cursor-pointer min-h-[40px]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onResetToDefault();
                    setShowResetConfirm(false);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#007AFF] hover:bg-[#0066D6] rounded-xl cursor-pointer min-h-[40px]"
                >
                  Replace
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
