"use client";

import React, { useState, useEffect, useRef, useMemo, Fragment } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { AdminProperty } from "@/app/actions";

export type AudienceColumnId =
  | "accountNumber"
  | "ownerName"
  | "ownerPhone"
  | "id"
  | "ownerDigitalAddress"
  | "arrears"
  | "billAmount"
  | "houseNo"
  | "plotNo"
  | "valuationNo"
  | "municipality"
  | "propertyClassification"
  | "billYear"
  | "billDate"
  | "rateableValue"
  | "rateImposed"
  | "previousYearBill"
  | "amountPaid"
  | "currentBill"
  | "electoralArea"
  | "totalAmountDue";

export interface AudienceColumnMeta {
  id: AudienceColumnId;
  label: string;
  width: string;
  align?: "left" | "right" | "center";
}

export const DEFAULT_AUDIENCE_COLUMNS: AudienceColumnMeta[] = [
  { id: "accountNumber", label: "Account No", width: "w-[140px]" },
  { id: "ownerName", label: "Name", width: "w-[190px]" },
  { id: "ownerPhone", label: "Telephone", width: "w-[130px]" },
  { id: "id", label: "ID", width: "w-[160px]" },
  { id: "ownerDigitalAddress", label: "Owner Digital Address", width: "w-[210px]" },
  { id: "arrears", label: "Arrears", width: "w-[130px]", align: "right" },
  { id: "billAmount", label: "Bill Amount", width: "w-[130px]", align: "right" },
  { id: "houseNo", label: "House No", width: "w-[110px]" },
  { id: "plotNo", label: "Plot No", width: "w-[110px]" },
  { id: "valuationNo", label: "Valuation No", width: "w-[140px]" },
  { id: "municipality", label: "Municipality", width: "w-[180px]" },
  { id: "propertyClassification", label: "Property Cat", width: "w-[190px]" },
  { id: "billYear", label: "Bill Year", width: "w-[90px]" },
  { id: "billDate", label: "Bill Date", width: "w-[110px]" },
  { id: "rateableValue", label: "Rateable Value", width: "w-[130px]", align: "right" },
  { id: "rateImposed", label: "Rate Imposed", width: "w-[110px]", align: "right" },
  { id: "previousYearBill", label: "Previous Year Bill", width: "w-[130px]", align: "right" },
  { id: "amountPaid", label: "Amount Paid", width: "w-[130px]", align: "right" },
  { id: "currentBill", label: "Current Bill", width: "w-[130px]", align: "right" },
  { id: "electoralArea", label: "Electoral Area", width: "w-[150px]" },
  { id: "totalAmountDue", label: "Outstanding Amt", width: "w-[140px]", align: "right" },
];

const formatGhc = (val: number | null | undefined): string => {
  if (val === null || val === undefined || isNaN(val)) return "GH₵ 0.00";
  return `GH₵ ${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const cleanDash = (val: any): string => {
  if (val === null || val === undefined) return "—";
  const s = String(val).trim();
  if (!s || s === "-" || s === "--" || s.toLowerCase() === "null" || s.toLowerCase() === "undefined") {
    return "—";
  }
  return s;
};

/**
 * Apple Minimalist Dark HUD Arrears Hover Tooltip
 * Rendered through React Portal to escape overflow clipping and always stay in viewport.
 */
function ArrearsCellWithTooltip({ prop }: { prop: AdminProperty }) {
  const [isHovered, setIsHovered] = useState(false);
  const [tooltipCoords, setTooltipCoords] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    placement: "top" | "bottom";
  } | null>(null);
  const cellRef = useRef<HTMLDivElement>(null);

  const initialArrears = Number(prop.initialArrears !== undefined ? prop.initialArrears : prop.arrears || 0);
  const currentArrears = Number(prop.currentArrears !== undefined ? prop.currentArrears : Math.max(0, initialArrears - Number(prop.amountPaidLastYear || 0)));
  const arrearsPaid = Math.max(0, Number((initialArrears - currentArrears).toFixed(2)));
  const isCleared = prop.status === "PAID" || (initialArrears > 0 && currentArrears <= 0);
  const paymentCount = (prop.receipts && prop.receipts.length > 0) ? prop.receipts.length : (arrearsPaid > 0 ? 1 : 0);

  const updatePosition = () => {
    if (!cellRef.current) return;
    const rect = cellRef.current.getBoundingClientRect();
    const tooltipWidth = 270;
    const left = Math.max(12, Math.min(window.innerWidth - tooltipWidth - 12, rect.right - tooltipWidth));

    if (rect.top < 230) {
      setTooltipCoords({
        top: rect.bottom + 8,
        left,
        placement: "bottom",
      });
    } else {
      setTooltipCoords({
        bottom: window.innerHeight - rect.top + 8,
        left,
        placement: "top",
      });
    }
  };

  const handleMouseEnter = (e: React.MouseEvent) => {
    e.stopPropagation();
    updatePosition();
    setIsHovered(true);
  };

  const handleMouseLeave = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsHovered(false);
  };

  useEffect(() => {
    if (!isHovered) return;
    const handleScrollOrResize = () => updatePosition();
    window.addEventListener("scroll", handleScrollOrResize, { passive: true, capture: true });
    window.addEventListener("resize", handleScrollOrResize, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isHovered]);

  if (initialArrears <= 0) {
    return <span className="text-[#8E8E93] tabular-nums">—</span>;
  }

  return (
    <div
      ref={cellRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative inline-block text-right cursor-help select-none"
    >
      {isCleared ? (
        <div className="flex flex-col items-end leading-tight">
          <span className="line-through text-[#8E8E93] text-[10px] tabular-nums">
            {formatGhc(initialArrears)}
          </span>
          <span className="text-[10px] text-[#34C759] font-medium whitespace-nowrap">
            &bull; Cleared
          </span>
        </div>
      ) : arrearsPaid > 0 ? (
        <div className="flex flex-col items-end leading-tight">
          <span className="line-through text-[#8E8E93] text-[10px] tabular-nums">
            {formatGhc(initialArrears)}
          </span>
          <span className="text-[#1C1C1E] font-bold tabular-nums text-[11px] whitespace-nowrap">
            {formatGhc(currentArrears)}
          </span>
        </div>
      ) : (
        <span className="text-[#1C1C1E] font-bold tabular-nums whitespace-nowrap">
          {formatGhc(initialArrears)}
        </span>
      )}

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isHovered && tooltipCoords && (
              <motion.div
                initial={{
                  opacity: 0,
                  scale: 0.96,
                  y: tooltipCoords.placement === "top" ? 4 : -4,
                }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{
                  opacity: 0,
                  scale: 0.96,
                  y: tooltipCoords.placement === "top" ? 2 : -2,
                }}
                transition={{ duration: 0.12, ease: "easeOut" }}
                style={{
                  position: "fixed",
                  left: `${tooltipCoords.left}px`,
                  ...(tooltipCoords.top !== undefined
                    ? { top: `${tooltipCoords.top}px` }
                    : { bottom: `${tooltipCoords.bottom}px` }),
                  zIndex: 99999,
                }}
                className="pointer-events-none w-[270px] p-3.5 bg-[#1C1C1E]/95 backdrop-blur-xl border border-white/15 shadow-2xl rounded-2xl text-left font-sans text-xs text-white"
              >
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider">
                    Arrears Breakdown
                  </span>
                  <span className="text-[10px] font-semibold text-white/80">
                    &bull; {isCleared ? "Cleared" : arrearsPaid > 0 ? "Partially Paid" : "Unpaid"}
                  </span>
                </div>

                {/* Financial Story Headline */}
                <div className="py-1.5 text-[11px] text-white/90 leading-relaxed font-sans border-b border-white/10">
                  Original Arrears: <span className="font-semibold text-white">GH₵ {initialArrears.toFixed(2)}</span> | Paid: <span className="font-semibold text-[#34C759]">GH₵ {arrearsPaid.toFixed(2)}</span> | Remaining Balance: <span className="font-semibold text-white">GH₵ {currentArrears.toFixed(2)}</span> across {paymentCount} payment(s).
                </div>

                <div className="py-2 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Initial Arrears</span>
                    <span className="font-mono text-white tabular-nums font-semibold">
                      GH₵ {initialArrears.toFixed(2)}
                    </span>
                  </div>

                  {arrearsPaid > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-white/60">Paid to Date</span>
                      <span className="font-mono text-[#34C759] tabular-nums font-semibold">
                        - GH₵ {arrearsPaid.toFixed(2)}
                      </span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                    <span className="font-semibold text-white">Current Overdue</span>
                    <span className="font-mono font-bold tabular-nums text-sm text-white">
                      {isCleared ? "GH₵ 0.00" : `GH₵ ${currentArrears.toFixed(2)}`}
                    </span>
                  </div>
                </div>

                {prop.receipts && prop.receipts.length > 0 && prop.receipts[0]?.datePaid && (
                  <div className="pt-2 border-t border-white/10 text-[10px] text-white/40 flex items-center justify-between">
                    <span>Last Payment:</span>
                    <span className="font-medium text-white/80">{prop.receipts[0].datePaid}</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}

function CurrentBillCellWithTooltip({ prop, isGrossBill = false }: { prop: AdminProperty; isGrossBill?: boolean }) {
  const [isHovered, setIsHovered] = useState(false);
  const [tooltipCoords, setTooltipCoords] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    placement: "top" | "bottom";
  } | null>(null);
  const cellRef = useRef<HTMLDivElement>(null);

  const initialArr = Number(prop.initialArrears !== undefined ? prop.initialArrears : prop.arrears || 0);
  const totalPaid = Number(prop.totalPaidCycle !== undefined ? prop.totalPaidCycle : prop.amountPaidLastYear || 0);
  const currentFee = Number(prop.currentFee || 0);
  const grossBill = Number((initialArr + currentFee).toFixed(2));
  const paidTowardsBill = Math.max(0, Number((totalPaid - initialArr).toFixed(2)));
  const remainingBill = Math.max(0, Number((currentFee - paidTowardsBill).toFixed(2)));
  const displayVal = isGrossBill ? grossBill : currentFee;

  const updatePosition = () => {
    if (!cellRef.current) return;
    const rect = cellRef.current.getBoundingClientRect();
    const tooltipWidth = 270;
    const left = Math.max(12, Math.min(window.innerWidth - tooltipWidth - 12, rect.right - tooltipWidth));

    if (rect.top < 230) {
      setTooltipCoords({ top: rect.bottom + 8, left, placement: "bottom" });
    } else {
      setTooltipCoords({ bottom: window.innerHeight - rect.top + 8, left, placement: "top" });
    }
  };

  const handleMouseEnter = (e: React.MouseEvent) => {
    e.stopPropagation();
    updatePosition();
    setIsHovered(true);
  };

  const handleMouseLeave = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsHovered(false);
  };

  useEffect(() => {
    if (!isHovered) return;
    const handleScrollOrResize = () => updatePosition();
    window.addEventListener("scroll", handleScrollOrResize, { passive: true, capture: true });
    window.addEventListener("resize", handleScrollOrResize, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isHovered]);

  return (
    <div
      ref={cellRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative inline-block text-right cursor-help select-none"
    >
      <span className="text-[#1C1C1E] font-bold tabular-nums whitespace-nowrap">
        {formatGhc(displayVal)}
      </span>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isHovered && tooltipCoords && (
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: tooltipCoords.placement === "top" ? 4 : -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: tooltipCoords.placement === "top" ? 2 : -2 }}
                transition={{ duration: 0.12, ease: "easeOut" }}
                style={{
                  position: "fixed",
                  left: `${tooltipCoords.left}px`,
                  ...(tooltipCoords.top !== undefined
                    ? { top: `${tooltipCoords.top}px` }
                    : { bottom: `${tooltipCoords.bottom}px` }),
                  zIndex: 99999,
                }}
                className="pointer-events-none w-[270px] p-3.5 bg-[#1C1C1E]/95 backdrop-blur-xl border border-white/15 shadow-2xl rounded-2xl text-left font-sans text-xs text-white"
              >
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider">
                    {isGrossBill ? "Gross Assessment" : "Current Assessment"}
                  </span>
                  <span className="text-[10px] font-semibold text-white/80">
                    &bull; FY {prop.billYear || 2025}
                  </span>
                </div>

                <div className="py-1.5 text-[11px] text-white/90 leading-relaxed font-sans border-b border-white/10">
                  Assessment: <span className="font-semibold text-white">GH₵ {currentFee.toFixed(2)}</span> | Applied: <span className="font-semibold text-[#34C759]">GH₵ {paidTowardsBill.toFixed(2)}</span> | Balance: <span className="font-semibold text-white">GH₵ {remainingBill.toFixed(2)}</span>
                </div>

                <div className="py-2 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Annual Rateable Charge</span>
                    <span className="font-mono text-white tabular-nums font-semibold">
                      GH₵ {currentFee.toFixed(2)}
                    </span>
                  </div>
                  {paidTowardsBill > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-white/60">Paid Towards Bill</span>
                      <span className="font-mono text-[#34C759] tabular-nums font-semibold">
                        - GH₵ {paidTowardsBill.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                    <span className="font-semibold text-white">Net Bill Remaining</span>
                    <span className="font-mono font-bold tabular-nums text-sm text-white">
                      GH₵ {remainingBill.toFixed(2)}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}

function PreviousYearBillCellWithTooltip({ prop }: { prop: AdminProperty }) {
  const [isHovered, setIsHovered] = useState(false);
  const [tooltipCoords, setTooltipCoords] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    placement: "top" | "bottom";
  } | null>(null);
  const cellRef = useRef<HTMLDivElement>(null);

  const prevYear = (prop.billYear || 2025) - 1;
  const prevBill = Number(prop.previousYearBill || 0);

  const updatePosition = () => {
    if (!cellRef.current) return;
    const rect = cellRef.current.getBoundingClientRect();
    const tooltipWidth = 260;
    const left = Math.max(12, Math.min(window.innerWidth - tooltipWidth - 12, rect.right - tooltipWidth));

    if (rect.top < 230) {
      setTooltipCoords({ top: rect.bottom + 8, left, placement: "bottom" });
    } else {
      setTooltipCoords({ bottom: window.innerHeight - rect.top + 8, left, placement: "top" });
    }
  };

  const handleMouseEnter = () => {
    updatePosition();
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  useEffect(() => {
    if (!isHovered) return;
    const handleScrollOrResize = () => updatePosition();
    window.addEventListener("scroll", handleScrollOrResize, { passive: true, capture: true });
    window.addEventListener("resize", handleScrollOrResize, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isHovered]);

  if (prevBill <= 0) {
    return <span className="text-[#8E8E93] tabular-nums">—</span>;
  }

  return (
    <div
      ref={cellRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative inline-block text-right cursor-help select-none"
    >
      <span className="text-[#1C1C1E] font-bold tabular-nums whitespace-nowrap">
        {prop.previousYearBillFormatted || formatGhc(prevBill)}
      </span>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isHovered && tooltipCoords && (
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: tooltipCoords.placement === "top" ? 4 : -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: tooltipCoords.placement === "top" ? 2 : -2 }}
                transition={{ duration: 0.12, ease: "easeOut" }}
                style={{
                  position: "fixed",
                  left: `${tooltipCoords.left}px`,
                  ...(tooltipCoords.top !== undefined
                    ? { top: `${tooltipCoords.top}px` }
                    : { bottom: `${tooltipCoords.bottom}px` }),
                  zIndex: 99999,
                }}
                className="pointer-events-none w-[260px] p-3.5 bg-[#1C1C1E]/95 backdrop-blur-xl border border-white/15 shadow-2xl rounded-2xl text-left font-sans text-xs text-white"
              >
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider">
                    Historical Assessment
                  </span>
                  <span className="text-[10px] font-semibold text-white/80">
                    &bull; FY {prevYear}
                  </span>
                </div>

                <div className="py-1.5 text-[11px] text-white/90 leading-relaxed font-sans border-b border-white/10">
                  Fiscal Year: <span className="font-semibold text-white">FY {prevYear}</span> | Assessment: <span className="font-semibold text-white">GH₵ {prevBill.toFixed(2)}</span>
                </div>

                <div className="py-2 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Assessment Cycle</span>
                    <span className="font-mono text-white tabular-nums font-semibold">
                      FY {prevYear}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Assessed Value Due</span>
                    <span className="font-mono text-white tabular-nums font-semibold">
                      GH₵ {prevBill.toFixed(2)}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                    <span className="font-semibold text-white">Current Ledger Context</span>
                    <span className="font-medium text-white/80 text-[11px]">
                      Brought Forward in Arrears
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}

export interface RatepayersSupabaseTableProps {
  properties: AdminProperty[];
  isLoading?: boolean;
  totalCount?: number;
  totalDueFormatted?: string;
  onOpenDossier: (prop: AdminProperty, siblingProperties?: AdminProperty[]) => void;
  onTableScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
}

export function RatepayersSupabaseTable({
  properties,
  isLoading = false,
  totalCount,
  totalDueFormatted,
  onOpenDossier,
  onTableScroll,
}: RatepayersSupabaseTableProps) {
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Scroll to top of table when records or page change
  useEffect(() => {
    tableContainerRef.current?.scrollTo({ top: 0, behavior: "instant" });
  }, [properties]);
  const [columnOrder, setColumnOrder] = useState<AudienceColumnId[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("kkma_officer_property_columns");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return DEFAULT_AUDIENCE_COLUMNS.map((c) => c.id);
  });

  const [draggedColId, setDraggedColId] = useState<AudienceColumnId | null>(null);
  const [dragOverColId, setDragOverColId] = useState<AudienceColumnId | null>(null);
  const [isHierarchicalView] = useState(true);
  const [collapsedGroupKeys, setCollapsedGroupKeys] = useState<Set<string>>(new Set());

  const handleDragStart = (id: AudienceColumnId) => {
    setDraggedColId(id);
  };

  const handleDragOver = (e: React.DragEvent, id: AudienceColumnId) => {
    e.preventDefault();
    if (draggedColId && draggedColId !== id && dragOverColId !== id) {
      setDragOverColId(id);
    }
  };

  const handleDragLeave = (id: AudienceColumnId) => {
    if (dragOverColId === id) {
      setDragOverColId(null);
    }
  };

  const handleDrop = (targetId: AudienceColumnId) => {
    if (draggedColId && draggedColId !== targetId) {
      const fromIdx = columnOrder.indexOf(draggedColId);
      const toIdx = columnOrder.indexOf(targetId);
      if (fromIdx !== -1 && toIdx !== -1) {
        const next = [...columnOrder];
        next.splice(fromIdx, 1);
        next.splice(toIdx, 0, draggedColId);
        setColumnOrder(next);
        try {
          localStorage.setItem("kkma_officer_property_columns", JSON.stringify(next));
        } catch {}
      }
    }
    setDraggedColId(null);
    setDragOverColId(null);
  };

  const toggleGroupCollapse = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedGroupKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

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

    for (const prop of properties) {
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
      const isCleared =
        prop.status === "PAID" ||
        Number(prop.totalAmountDue || 0) <= 0 ||
        Number(prop.amountPaidLastYear || 0) >= Number(prop.arrears || 0);
      const remainingArrears = isCleared
        ? 0
        : Math.max(0, Number(prop.arrears || 0) - Number(prop.amountPaidLastYear || 0));
      g.totalArrears += remainingArrears;
    }

    return Array.from(groupsMap.values()).map((g) => ({
      ...g,
      isMultiProperty: g.properties.length > 1,
    }));
  }, [properties]);

  const totalCalculatedArrears = useMemo(() => {
    return properties.reduce((acc, p) => {
      const isCleared =
        p.status === "PAID" ||
        Number(p.totalAmountDue || 0) <= 0 ||
        Number(p.amountPaidLastYear || 0) >= Number(p.arrears || 0);
      const remainingArrears = isCleared
        ? 0
        : Math.max(0, Number(p.arrears || 0) - Number(p.amountPaidLastYear || 0));
      return acc + remainingArrears;
    }, 0);
  }, [properties]);

  const totalCalculatedDue = useMemo(() => {
    return properties.reduce((acc, p) => acc + Number(p.totalAmountDue || 0), 0);
  }, [properties]);

  const renderAudienceCell = (
    colId: AudienceColumnId,
    prop: AdminProperty,
    isHierarchicalChild: boolean = false,
    isLastChild: boolean = false
  ) => {
    switch (colId) {
      case "accountNumber":
        return isHierarchicalChild ? (
          <td
            key={colId}
            className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-[#007AFF] text-[11px] relative truncate"
          >
            {/* Tree Guide Lines */}
            <div
              className={`absolute left-[22px] w-[2px] border-l-2 border-solid border-[#8E8E93] ${
                isLastChild ? "top-0 h-1/2" : "top-0 h-full"
              }`}
            />
            <div className="absolute left-[22px] top-1/2 w-4 border-t-2 border-solid border-[#8E8E93]" />
            <span
              className="pl-8 inline-block font-mono font-bold text-[#007AFF] text-[11px] truncate max-w-full"
              title={cleanDash(prop.accountNumber)}
            >
              {cleanDash(prop.accountNumber)}
            </span>
          </td>
        ) : (
          <td
            key={colId}
            className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-[#007AFF] text-[11px] truncate"
            title={cleanDash(prop.accountNumber)}
          >
            {cleanDash(prop.accountNumber)}
          </td>
        );

      case "ownerName":
        return (
          <td
            key={colId}
            className="py-2.5 px-3 whitespace-nowrap text-[11px] font-semibold text-[#1C1C1E] truncate"
            title={cleanDash(prop.ownerName)}
          >
            {cleanDash(prop.ownerName)}
          </td>
        );

      case "ownerPhone":
        return (
          <td
            key={colId}
            className="py-2.5 px-3 whitespace-nowrap text-[11px] font-medium text-[#1C1C1E] truncate"
            title={cleanDash(prop.ownerPhone)}
          >
            {cleanDash(prop.ownerPhone)}
          </td>
        );

      case "id":
        return (
          <td
            key={colId}
            className="py-2.5 px-3 whitespace-nowrap font-mono font-medium text-[11px] text-[#1C1C1E] truncate"
            title={cleanDash(prop.id)}
          >
            {cleanDash(prop.id)}
          </td>
        );

      case "ownerDigitalAddress":
        return (
          <td
            key={colId}
            className="py-2.5 px-3 whitespace-nowrap font-mono font-medium text-[11px] text-[#1C1C1E] truncate"
            title={cleanDash(prop.ownerDigitalAddress)}
          >
            {cleanDash(prop.ownerDigitalAddress)}
          </td>
        );

      case "arrears":
        return (
          <td
            key={colId}
            className="py-2.5 px-3 text-right text-[11px] font-bold text-[#1C1C1E] tabular-nums relative overflow-visible"
          >
            <ArrearsCellWithTooltip prop={prop} />
          </td>
        );

      case "billAmount": {
        const totalBillAmt = Number(prop.arrears || 0) + Number(prop.currentFee || 0);
        return (
          <td
            key={colId}
            className="py-2.5 px-3 text-right whitespace-nowrap text-[11px] font-bold text-[#1C1C1E] tabular-nums truncate"
          >
            {formatGhc(totalBillAmt)}
          </td>
        );
      }

      case "houseNo":
        return (
          <td
            key={colId}
            className="py-2.5 px-3 whitespace-nowrap text-[11px] font-medium text-[#1C1C1E] truncate"
            title={cleanDash(prop.houseNo)}
          >
            {cleanDash(prop.houseNo)}
          </td>
        );

      case "plotNo":
        return (
          <td
            key={colId}
            className="py-2.5 px-3 whitespace-nowrap text-[11px] font-medium text-[#1C1C1E] truncate"
            title={cleanDash(prop.plotNo)}
          >
            {cleanDash(prop.plotNo)}
          </td>
        );

      case "valuationNo":
        return (
          <td
            key={colId}
            className="py-2.5 px-3 whitespace-nowrap text-[11px] font-medium text-[#1C1C1E] truncate"
            title={cleanDash(prop.valuationNo)}
          >
            {cleanDash(prop.valuationNo)}
          </td>
        );

      case "municipality":
        return (
          <td
            key={colId}
            className="py-2.5 px-3 whitespace-nowrap text-[11px] font-medium text-[#1C1C1E] truncate"
            title={cleanDash(prop.municipality)}
          >
            {cleanDash(prop.municipality)}
          </td>
        );

      case "propertyClassification":
        return (
          <td
            key={colId}
            className="py-2.5 px-3 whitespace-nowrap text-[11px] font-medium text-[#1C1C1E] truncate"
            title={cleanDash(prop.propertyClassification)}
          >
            {cleanDash(prop.propertyClassification)}
          </td>
        );

      case "billYear":
        return (
          <td
            key={colId}
            className="py-2.5 px-3 whitespace-nowrap text-[11px] font-medium text-[#1C1C1E] truncate"
            title={String(prop.billYear || "—")}
          >
            {prop.billYear || "—"}
          </td>
        );

      case "billDate":
        return (
          <td
            key={colId}
            className="py-2.5 px-3 whitespace-nowrap text-[11px] font-medium text-[#1C1C1E] truncate"
            title={String(prop.billDateFormatted || "—")}
          >
            {prop.billDateFormatted || "—"}
          </td>
        );

      case "rateableValue":
        return (
          <td
            key={colId}
            className="py-2.5 px-3 text-right whitespace-nowrap text-[11px] font-bold text-[#1C1C1E] tabular-nums truncate"
            title={String(prop.rateableValueFormatted || "—")}
          >
            {prop.rateableValueFormatted || "—"}
          </td>
        );

      case "rateImposed":
        return (
          <td
            key={colId}
            className="py-2.5 px-3 text-right whitespace-nowrap text-[11px] font-bold text-[#1C1C1E] tabular-nums truncate"
            title={String(prop.rateImposed ?? "—")}
          >
            {prop.rateImposed ?? "—"}
          </td>
        );

      case "previousYearBill":
        return (
          <td
            key={colId}
            className="py-2.5 px-3 text-right whitespace-nowrap text-[11px] font-bold text-[#1C1C1E] tabular-nums relative overflow-visible"
          >
            <PreviousYearBillCellWithTooltip prop={prop} />
          </td>
        );

      case "amountPaid":
        return (
          <td
            key={colId}
            className="py-2.5 px-3 text-right whitespace-nowrap text-[11px] font-bold text-[#1C1C1E] tabular-nums truncate"
            title={
              Number(prop.amountPaidLastYear || 0) > 0
                ? `Amount Paid: ${formatGhc(prop.amountPaidLastYear)}`
                : "GH₵ 0.00 (No payment recorded)"
            }
          >
            {formatGhc(prop.amountPaidLastYear)}
          </td>
        );

      case "currentBill":
        return (
          <td
            key={colId}
            className="py-2.5 px-3 text-right whitespace-nowrap text-[11px] font-bold text-[#1C1C1E] tabular-nums relative overflow-visible"
          >
            <CurrentBillCellWithTooltip prop={prop} />
          </td>
        );

      case "electoralArea":
        return (
          <td
            key={colId}
            className="py-2.5 px-3 whitespace-nowrap text-[11px] font-medium text-[#1C1C1E] truncate"
            title={cleanDash(prop.electoralArea)}
          >
            {cleanDash(prop.electoralArea)}
          </td>
        );

      case "totalAmountDue":
        return (
          <td
            key={colId}
            className="py-2.5 px-3 text-right whitespace-nowrap text-[11px] text-[#1C1C1E] tabular-nums font-bold truncate bg-[#007AFF]/[0.035] border-x border-[#007AFF]/10"
            title={formatGhc(prop.totalAmountDue)}
          >
            {formatGhc(prop.totalAmountDue)}
          </td>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white">
      {/* Table Header Controls */}
      <div className="px-4 lg:px-6 py-2.5 border-b border-[#E5E5EA] flex flex-wrap items-center justify-between gap-2.5 bg-white shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-[#1C1C1E]">
            Property Roll & Portfolios
          </span>
          <span className="text-[11px] text-[#8E8E93]">
            ({totalCount ?? properties.length}{" "}
            {(totalCount ?? properties.length) === 1 ? "Property" : "Properties"})
          </span>
        </div>


      </div>

      {/* Desktop Supabase-Style Table Container (min-w-[2860px]) */}
      <div ref={tableContainerRef} onScroll={onTableScroll} className="flex-1 min-h-0 min-h-[calc(100dvh-13rem)] overflow-auto [overflow-anchor:auto] [isolation:isolate]">
        <table className="hidden md:table w-[2860px] min-w-[2860px] table-fixed text-left text-xs border-collapse">
          <colgroup>
            {columnOrder.map((colId) => {
              const colDef = DEFAULT_AUDIENCE_COLUMNS.find((c) => c.id === colId);
              return <col key={colId} className={colDef?.width || "w-[130px]"} />;
            })}
          </colgroup>
          <thead className="border-b text-[#6C6C70] font-semibold text-[11px] sticky top-0 z-20 bg-[#F8F9FA] border-[#E5E5EA]">
            <tr>
              {columnOrder.map((colId) => {
                const colDef = DEFAULT_AUDIENCE_COLUMNS.find((c) => c.id === colId);
                if (!colDef) return null;
                const isDragging = draggedColId === colId;
                const isDragOver = dragOverColId === colId;
                const isOutstandingCol = colId === "totalAmountDue";
                return (
                  <th
                    key={colId}
                    draggable
                    onDragStart={() => handleDragStart(colId)}
                    onDragOver={(e) => handleDragOver(e, colId)}
                    onDragLeave={() => handleDragLeave(colId)}
                    onDrop={() => handleDrop(colId)}
                    className={`py-2.5 px-3 whitespace-nowrap select-none cursor-grab active:cursor-grabbing transition-colors ${
                      colDef.align === "right" ? "text-right" : "text-left"
                    } ${colDef.width} ${
                      isOutstandingCol
                        ? "bg-[#007AFF]/10 text-[#007AFF] font-bold border-x border-[#007AFF]/20"
                        : "bg-[#F8F9FA] text-[#6C6C70]"
                    } ${
                      isDragOver ? "border-l-2 border-[#007AFF] bg-[#007AFF]/10 text-[#007AFF]" : ""
                    } ${isDragging ? "opacity-40" : ""}`}
                    title="Drag and swap column position"
                  >
                    <span className="truncate">{colDef.label}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E5EA] bg-white">
            {isLoading ? (
              Array.from({ length: 9 }).map((_, i) => (
                <tr key={`aud-skel-${i}`} className="animate-pulse">
                  {columnOrder.map((colId) => {
                    const colDef = DEFAULT_AUDIENCE_COLUMNS.find((c) => c.id === colId);
                    const isOutstandingCol = colId === "totalAmountDue";
                    return (
                      <td
                        key={colId}
                        className={`py-2.5 px-3 ${colDef?.align === "right" ? "text-right" : ""} ${
                          isOutstandingCol ? "bg-[#007AFF]/[0.02] border-x border-[#007AFF]/10" : ""
                        }`}
                      >
                        <div
                          className={`h-3.5 w-20 bg-[#E5E5EA] rounded ${
                            colDef?.align === "right" ? "ml-auto" : ""
                          }`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))
            ) : properties.length === 0 ? (
              <tr>
                <td
                  colSpan={columnOrder.length}
                  className="py-12 text-center text-[#8E8E93] italic text-xs"
                >
                  No properties or ratepayer records found.
                </td>
              </tr>
            ) : isHierarchicalView ? (
              ratepayerGroups.map((group) => {
                const isExpanded = !collapsedGroupKeys.has(group.key);
                const firstProp = group.properties[0];

                if (group.isMultiProperty) {
                  return (
                    <Fragment key={`group-frag-${group.key}`}>
                      {/* Ratepayer Portfolio Group Header - Click opens Owner Profile */}
                      <tr
                        onClick={() => onOpenDossier(firstProp, group.properties)}
                        className="bg-[#F8F9FA] border-t border-b border-[#E5E5EA] transition-colors select-none hover:bg-[#F2F2F7] cursor-pointer"
                        title="Click to view Owner Profile"
                      >
                        {columnOrder.map((colId) => {
                          switch (colId) {
                            case "accountNumber":
                              return (
                                <td key={colId} className="py-2.5 px-3 whitespace-nowrap relative select-none">
                                  <div className="flex items-center gap-2">
                                    <div className="relative">
                                      <button
                                        type="button"
                                        onClick={(e) => toggleGroupCollapse(group.key, e)}
                                        className="w-5 h-5 rounded border border-[#8E8E93] bg-white text-[#1C1C1E] hover:bg-[#F2F2F7] hover:border-[#007AFF] flex items-center justify-center transition-colors shrink-0 shadow-2xs cursor-pointer"
                                        title={isExpanded ? "Collapse portfolio" : "Expand portfolio"}
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
                                        <div className="absolute left-[9px] top-full h-3 w-[2px] border-l-2 border-solid border-[#8E8E93]" />
                                      )}
                                    </div>
                                    <span className="font-mono font-bold text-xs text-[#007AFF]">
                                      {group.properties.length} Properties
                                    </span>
                                  </div>
                                </td>
                              );

                            case "ownerName":
                              return (
                                <td key={colId} className="py-2.5 px-3 whitespace-nowrap font-bold text-xs text-[#1C1C1E] truncate" title={group.ownerName}>
                                  <div className="flex items-center gap-1.5 truncate">
                                    <span className="truncate">{group.ownerName}</span>
                                    <span className="text-[10px] text-[#007AFF] font-medium shrink-0">• Assessment</span>
                                  </div>
                                </td>
                              );

                            case "ownerPhone":
                              return (
                                <td key={colId} className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-[#6C6C70] truncate" title={cleanDash(group.phone)}>
                                  {cleanDash(group.phone)}
                                </td>
                              );

                            case "arrears":
                              return (
                                <td key={colId} className="py-2.5 px-3 text-right whitespace-nowrap font-bold text-[11px] text-[#FF3B30] tabular-nums truncate">
                                  {group.totalArrears > 0 ? formatGhc(group.totalArrears) : "—"}
                                </td>
                              );

                            case "billAmount": {
                              const groupBillTotal = group.properties.reduce((s, p) => s + (Number(p.arrears || 0) + Number(p.currentFee || 0)), 0);
                              return (
                                <td key={colId} className="py-2.5 px-3 text-right whitespace-nowrap font-bold text-[11px] text-[#1C1C1E] tabular-nums truncate">
                                  {formatGhc(groupBillTotal)}
                                </td>
                              );
                            }

                            case "currentBill": {
                              const groupCurrentTotal = group.properties.reduce((s, p) => s + Number(p.currentFee || 0), 0);
                              return (
                                <td key={colId} className="py-2.5 px-3 text-right whitespace-nowrap font-bold text-[11px] text-[#1C1C1E] tabular-nums truncate">
                                  {formatGhc(groupCurrentTotal)}
                                </td>
                              );
                            }

                            case "previousYearBill": {
                              const groupPrevTotal = group.properties.reduce((s, p) => s + Number(p.previousYearBill || 0), 0);
                              return (
                                <td key={colId} className="py-2.5 px-3 text-right whitespace-nowrap font-bold text-[11px] text-[#1C1C1E] tabular-nums truncate">
                                  {groupPrevTotal > 0 ? formatGhc(groupPrevTotal) : "—"}
                                </td>
                              );
                            }

                            case "amountPaid": {
                              const groupPaidTotal = group.properties.reduce((s, p) => s + Number(p.amountPaidLastYear || 0), 0);
                              return (
                                <td key={colId} className="py-2.5 px-3 text-right whitespace-nowrap font-bold text-[11px] text-[#1C1C1E] tabular-nums truncate">
                                  {groupPaidTotal > 0 ? formatGhc(groupPaidTotal) : "—"}
                                </td>
                              );
                            }

                            case "rateableValue": {
                              const groupValuation = group.properties.reduce((s, p) => s + Number(p.rateableValue || 0), 0);
                              return (
                                <td key={colId} className="py-2.5 px-3 text-right whitespace-nowrap font-bold text-[11px] text-[#1C1C1E] tabular-nums truncate">
                                  {groupValuation > 0 ? formatGhc(groupValuation) : "—"}
                                </td>
                              );
                            }

                            case "totalAmountDue":
                              return (
                                <td
                                  key={colId}
                                  className="py-2.5 px-3 text-right whitespace-nowrap font-bold text-xs text-[#007AFF] tabular-nums relative truncate bg-[#007AFF]/12 border-x border-[#007AFF]/20"
                                  title={formatGhc(group.totalAmountDue)}
                                >
                                  {isExpanded && (
                                    <div className="absolute left-3 bottom-0 h-2.5 w-[2px] border-l-2 border-solid border-[#8E8E93]" />
                                  )}
                                  {formatGhc(group.totalAmountDue)}
                                </td>
                              );

                            default:
                              return (
                                <td key={colId} className="py-2.5 px-3 whitespace-nowrap text-[11px] text-[#8E8E93]">
                                  —
                                </td>
                              );
                          }
                        })}
                      </tr>

                      {/* Nested Properties with Collapsible Animation */}
                      <AnimatePresence initial={false}>
                        {isExpanded &&
                          group.properties.map((prop, pIdx) => {
                            const isLast = pIdx === group.properties.length - 1;
                            return (
                              <motion.tr
                                key={prop.id || prop.accountNumber}
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.18, ease: "easeOut" }}
                                onClick={() => onOpenDossier(prop, group.properties)}
                                className="transition-colors cursor-pointer border-b border-[#E5E5EA] bg-white hover:bg-[#F8F9FA]"
                                title="Click to view Property Details"
                              >
                                {columnOrder.map((colId) =>
                                  renderAudienceCell(colId, prop, true, isLast)
                                )}
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

                return (
                  <tr
                    key={prop.id || prop.accountNumber}
                    onClick={() => onOpenDossier(prop, [prop])}
                    className="transition-colors cursor-pointer border-b border-[#E5E5EA] bg-white hover:bg-[#F8F9FA]"
                    title="Click to view Property Details"
                  >
                    {columnOrder.map((colId) => renderAudienceCell(colId, prop, false, false))}
                  </tr>
                );
              })
            ) : (
              // Flat view
              properties.map((prop) => (
                <tr
                  key={prop.id || prop.accountNumber}
                  onClick={() => onOpenDossier(prop)}
                  className="transition-colors cursor-pointer border-b border-[#E5E5EA] bg-white hover:bg-[#F8F9FA]"
                  title="Click to view Ratepayer Profile"
                >
                  {columnOrder.map((colId) => renderAudienceCell(colId, prop, false, false))}
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Mobile View (< 768px): Apple HIG Ratepayer Cards */}
        <div className="block md:hidden p-3 space-y-3 bg-[#F8F9FA]/70">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={`mob-aud-skel-${i}`} className="bg-white rounded-xl border border-[#E5E5EA] p-4 space-y-2.5 animate-pulse">
                <div className="flex justify-between">
                  <div className="h-4 w-28 bg-[#E5E5EA] rounded" />
                  <div className="h-4 w-20 bg-[#E5E5EA] rounded" />
                </div>
                <div className="h-4 w-44 bg-[#E5E5EA] rounded" />
                <div className="h-3 w-32 bg-[#E5E5EA] rounded" />
              </div>
            ))
          ) : properties.length === 0 ? (
            <div className="py-12 text-center text-[#8E8E93] text-xs">
              No properties or ratepayer records found.
            </div>
          ) : (
            properties.map((prop) => {
              const isCleared = prop.status === "PAID" || Number(prop.totalAmountDue || 0) <= 0;
              return (
                <div
                  key={`mob-prop-${prop.id || prop.accountNumber}`}
                  onClick={() => onOpenDossier(prop, [prop])}
                  className="bg-white rounded-xl border border-[#E5E5EA] p-4 shadow-2xs space-y-3 active:bg-[#F2F2F7] transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2 border-b border-[#E5E5EA]/70 pb-2.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-bold text-xs text-[#007AFF]">
                          {prop.accountNumber}
                        </span>
                        {prop.houseNo && (
                          <span className="text-[10px] text-[#6C6C70]">
                            House {prop.houseNo}
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold text-[#1C1C1E] mt-0.5 truncate">
                        {cleanDash(prop.ownerName)}
                      </h3>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] uppercase tracking-wider text-[#8E8E93] font-semibold block">
                        Net Due
                      </span>
                      <span className={`text-sm font-bold tabular-nums ${isCleared ? "text-[#34C759]" : "text-[#FF3B30]"}`}>
                        {formatGhc(prop.totalAmountDue)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-[#6C6C70]">
                    {prop.ownerDigitalAddress && prop.ownerDigitalAddress !== "—" && (
                      <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#3A3A3C]">
                        <span className="text-[#007AFF] font-medium">{prop.ownerDigitalAddress}</span>
                      </div>
                    )}
                    {prop.ownerPhone && prop.ownerPhone !== "—" && (
                      <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#3A3A3C]">
                        <a
                          href={`tel:${prop.ownerPhone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:underline text-[#007AFF]"
                        >
                          {prop.ownerPhone}
                        </a>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-[11px] pt-1">
                      {prop.electoralArea && (
                        <span className="text-[#6C6C70] truncate max-w-[55%]">
                          Area: <strong className="text-[#1C1C1E] font-medium">{prop.electoralArea}</strong>
                        </span>
                      )}
                      <span className="text-[#8E8E93] tabular-nums ml-auto">
                        Val: {prop.rateableValueFormatted || "—"}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenDossier(prop, [prop]);
                    }}
                    className="w-full h-9 rounded-lg apple-btn-secondary text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer text-[#007AFF] border-[#007AFF]/20 hover:bg-[#007AFF]/5 transition-colors"
                  >
                    <span>View Ratepayer Profile</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
