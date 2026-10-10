"use client";

import { useState, useMemo, useEffect, useRef, Fragment } from "react";
import { createPortal } from "react-dom";
import {
  Send,
  CheckCircle2,
  AlertTriangle,
  Lock,
  X,
  Search,
  Check,
  SlidersHorizontal,
  ChevronDown,
  Code2,
  Bookmark,
  Edit3,
  Users,
  FileText,
  RotateCcw,
  RefreshCw,
  History,
} from "lucide-react";
import { AppleSpinner } from "@/components/ui/AppleSpinner";
import {
  AdminProperty,
  SmsRolloutLogItem,
  getSmsRolloutAudience,
  getSmsRolloutLogsPaginated,
  saveSmsTemplate,
  getSmsSettings,
  getArkeselBalance,
  getSmsRolloutJobs,
  retryFailedSmsJob,
  SmsRolloutJobSummary,
} from "@/app/actions";
import { formatGhc, formatDateGb } from "@/lib/formatters";
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

function ArrearsCellWithTooltip({ prop }: { prop: AdminProperty }) {
  const [isHovered, setIsHovered] = useState(false);
  const [tooltipCoords, setTooltipCoords] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    placement: "top" | "bottom";
  } | null>(null);
  const cellRef = useRef<HTMLDivElement>(null);

  const initialArrears = Number(
    prop.initialArrears !== undefined
      ? prop.initialArrears
      : (prop.initial_arrears !== undefined ? prop.initial_arrears : prop.arrears || 0)
  );
  const paidCycle = Number(
    prop.totalPaidCycle !== undefined
      ? prop.totalPaidCycle
      : (prop.total_paid_cycle !== undefined ? prop.total_paid_cycle : prop.amountPaidLastYear || 0)
  );
  const currentArrears = Number(
    prop.currentArrears !== undefined
      ? prop.currentArrears
      : (prop.current_arrears !== undefined ? prop.current_arrears : Math.max(0, initialArrears - paidCycle))
  );
  const isPaid = prop.status === "PAID" || (initialArrears > 0 && currentArrears <= 0);
  const isCleared = isPaid || currentArrears <= 0;
  const arrearsPaid = isCleared ? initialArrears : Math.min(initialArrears, paidCycle);
  const paymentCount = (prop.receipts || []).length || (paidCycle > 0 ? 1 : 0);

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

  const handleMouseEnter = () => {
    updatePosition();
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  useEffect(() => {
    if (!isHovered) return;
    const handleScrollOrResize = () => {
      updatePosition();
    };
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
      {/* Visual Arrears Display */}
      {isCleared ? (
        <div className="flex flex-col items-end leading-tight">
          <span className="line-through text-[#8E8E93] text-[10px] tabular-nums" title={`Original arrears: GH₵ ${initialArrears.toFixed(2)} (Fully cleared)`}>
            GH₵ {initialArrears.toFixed(2)}
          </span>
          <span className="text-[10px] text-[#34C759] font-medium whitespace-nowrap">
            &bull; Cleared
          </span>
        </div>
      ) : arrearsPaid > 0 ? (
        <div className="flex flex-col items-end leading-tight">
          <span className="line-through text-[#8E8E93] text-[10px] tabular-nums" title={`Original arrears: GH₵ ${initialArrears.toFixed(2)}`}>
            GH₵ {initialArrears.toFixed(2)}
          </span>
          <span className="text-[#1C1C1E] font-semibold tabular-nums text-[11px] whitespace-nowrap" title="Remaining unpaid arrears">
            {formatGhc(currentArrears)}
          </span>
        </div>
      ) : (
        <span className="text-[#1C1C1E] font-semibold tabular-nums whitespace-nowrap">
          {prop.arrearsFormatted || `GH₵ ${initialArrears.toFixed(2)}`}
        </span>
      )}

      {/* Apple Minimalist Dark HUD Hover Tooltip rendered in React Portal */}
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
                {/* Header */}
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

                {/* Breakdown Rows */}
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

                {/* Footer / Context */}
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

  return (
    <div
      ref={cellRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative inline-block text-right cursor-help select-none"
    >
      <span className="text-[#1C1C1E] font-semibold tabular-nums whitespace-nowrap">
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
      <span className="text-[#1C1C1E] font-semibold tabular-nums whitespace-nowrap">
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

interface SmsRolloutSimulatorProps {
  properties: AdminProperty[];
  smsLogs: SmsRolloutLogItem[];
  onTriggerBatchRollout: (
    target: any,
    template: string,
    password?: string,
    mode?: "TEST" | "LIVE"
  ) => Promise<{ success: boolean; error?: string; jobId?: string; dispatchedCount?: number } | void>;
  isProcessing: boolean;
  selectedProperties?: AdminProperty[];
  onClearSelectedProperties?: () => void;
  onNotify?: (message: string, type: "success" | "error" | "info") => void;
  isHeaderVisible?: boolean;
  onTableScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
}

export function SmsRolloutSimulator({
  properties,
  smsLogs,
  onTriggerBatchRollout,
  isProcessing,
  selectedProperties,
  onClearSelectedProperties,
  onNotify,
  isHeaderVisible = true,
  onTableScroll,
}: SmsRolloutSimulatorProps) {
  // Active View Pane: 'SIMULATOR' vs 'BATCHES' vs 'LOGS'
  const [activeView, setActiveView] = useState<"SIMULATOR" | "BATCHES" | "LOGS">("SIMULATOR");

  // Helper: Synchronize state with URL search params and localStorage
  const updateUrlAndStorage = (key: string, value: string, storageKey: string) => {
    try {
      if (value && value !== "ALL" && value !== "SIMULATOR") {
        localStorage.setItem(storageKey, value);
      } else {
        localStorage.removeItem(storageKey);
      }
      const params = new URLSearchParams(window.location.search);
      if (value && value !== "ALL" && value !== "SIMULATOR") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
      window.history.replaceState(null, "", newUrl);
    } catch {
      // non-fatal
    }
  };

  const handleActiveViewChange = (view: "SIMULATOR" | "BATCHES" | "LOGS") => {
    setActiveView(view);
    updateUrlAndStorage("smsView", view, "sms_active_view");
    if (view === "BATCHES") {
      loadRolloutJobs();
      refreshGatewayBalance();
    }
  };

  // Rollout Batches & Retry Queue State
  const [rolloutJobs, setRolloutJobs] = useState<SmsRolloutJobSummary[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [retryTargetJob, setRetryTargetJob] = useState<{ id: string; count: number } | null>(null);
  const [gatewayBalance, setGatewayBalance] = useState<{ smsBalance: number; mainBalance: string } | null>(null);
  const [isFetchingBalance, setIsFetchingBalance] = useState(false);

  // Supabase-style dynamic column ordering state
  const [columnOrder, setColumnOrder] = useState<AudienceColumnId[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("kkma_audience_column_order");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length === DEFAULT_AUDIENCE_COLUMNS.length) {
            const defaultIds = new Set(DEFAULT_AUDIENCE_COLUMNS.map((c) => c.id));
            if (parsed.every((id) => defaultIds.has(id))) {
              return parsed;
            }
          }
        }
      } catch {}
    }
    return DEFAULT_AUDIENCE_COLUMNS.map((c) => c.id);
  });

  const [draggedColId, setDraggedColId] = useState<AudienceColumnId | null>(null);
  const [dragOverColId, setDragOverColId] = useState<AudienceColumnId | null>(null);

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
          localStorage.setItem("kkma_audience_column_order", JSON.stringify(next));
        } catch {}
      }
    }
    setDraggedColId(null);
    setDragOverColId(null);
  };

  const resetColumnOrder = () => {
    const defaultOrder = DEFAULT_AUDIENCE_COLUMNS.map((c) => c.id);
    setColumnOrder(defaultOrder);
    try {
      localStorage.removeItem("kkma_audience_column_order");
    } catch {}
  };

  const renderAudienceCell = (
    colId: AudienceColumnId,
    prop: AdminProperty,
    isHierarchicalChild: boolean = false,
    isLastChild: boolean = false
  ) => {
    switch (colId) {
      case "accountNumber":
        return isHierarchicalChild ? (
          <td key={colId} className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-[#007AFF] text-[11px] relative truncate">
            {/* Tree Guide Lines */}
            <div
              className={`absolute left-[22px] w-px border-l border-dashed border-[#E5E5EA] ${
                isLastChild ? "top-0 h-1/2" : "top-0 h-full"
              }`}
            />
            <div className="absolute left-[22px] top-1/2 w-4 border-t border-dashed border-[#E5E5EA]" />
            <span className="pl-8 inline-block font-mono font-bold text-[#007AFF] text-[11px] truncate max-w-full" title={cleanDash(prop.accountNumber)}>
              {cleanDash(prop.accountNumber)}
            </span>
          </td>
        ) : (
          <td key={colId} className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-[#007AFF] text-[11px] truncate" title={cleanDash(prop.accountNumber)}>
            {cleanDash(prop.accountNumber)}
          </td>
        );

      case "ownerName":
        return (
          <td key={colId} className="py-2.5 px-3 whitespace-nowrap text-[11px] font-semibold text-[#1C1C1E] truncate" title={cleanDash(prop.ownerName)}>
            {cleanDash(prop.ownerName)}
          </td>
        );

      case "ownerPhone":
        return (
          <td key={colId} className="py-2.5 px-3 whitespace-nowrap text-[11px] font-medium text-[#1C1C1E] truncate" title={cleanDash(prop.ownerPhone)}>
            {cleanDash(prop.ownerPhone)}
          </td>
        );

      case "id":
        return (
          <td key={colId} className="py-2.5 px-3 whitespace-nowrap font-mono font-medium text-[11px] text-[#1C1C1E] truncate" title={cleanDash(prop.id)}>
            {cleanDash(prop.id)}
          </td>
        );

      case "ownerDigitalAddress":
        return (
          <td key={colId} className="py-2.5 px-3 whitespace-nowrap font-mono font-medium text-[11px] text-[#1C1C1E] truncate" title={cleanDash(prop.ownerDigitalAddress)}>
            {cleanDash(prop.ownerDigitalAddress)}
          </td>
        );

      case "arrears":
        return (
          <td key={colId} className="py-2.5 px-3 text-right text-[11px] font-semibold text-[#1C1C1E] tabular-nums relative overflow-visible">
            <ArrearsCellWithTooltip prop={prop} />
          </td>
        );

      case "billAmount": {
        const totalBillAmt = Number(prop.arrears || 0) + Number(prop.currentFee || 0);
        return (
          <td key={colId} className="py-2.5 px-3 text-right whitespace-nowrap text-[11px] font-semibold text-[#1C1C1E] tabular-nums truncate">
            {formatGhc(totalBillAmt)}
          </td>
        );
      }

      case "houseNo":
        return (
          <td key={colId} className="py-2.5 px-3 whitespace-nowrap text-[11px] font-medium text-[#1C1C1E] truncate" title={cleanDash(prop.houseNo)}>
            {cleanDash(prop.houseNo)}
          </td>
        );

      case "plotNo":
        return (
          <td key={colId} className="py-2.5 px-3 whitespace-nowrap text-[11px] font-medium text-[#1C1C1E] truncate" title={cleanDash(prop.plotNo)}>
            {cleanDash(prop.plotNo)}
          </td>
        );

      case "valuationNo":
        return (
          <td key={colId} className="py-2.5 px-3 whitespace-nowrap text-[11px] font-medium text-[#1C1C1E] truncate" title={cleanDash(prop.valuationNo)}>
            {cleanDash(prop.valuationNo)}
          </td>
        );

      case "municipality":
        return (
          <td key={colId} className="py-2.5 px-3 whitespace-nowrap text-[11px] font-medium text-[#1C1C1E] truncate" title={cleanDash(prop.municipality)}>
            {cleanDash(prop.municipality)}
          </td>
        );

      case "propertyClassification":
        return (
          <td key={colId} className="py-2.5 px-3 whitespace-nowrap text-[11px] font-medium text-[#1C1C1E] truncate" title={cleanDash(prop.propertyClassification)}>
            {cleanDash(prop.propertyClassification)}
          </td>
        );

      case "billYear":
        return (
          <td key={colId} className="py-2.5 px-3 whitespace-nowrap text-[11px] font-medium text-[#1C1C1E] truncate" title={String(prop.billYear || "—")}>
            {prop.billYear || "—"}
          </td>
        );

      case "billDate":
        return (
          <td key={colId} className="py-2.5 px-3 whitespace-nowrap text-[11px] font-medium text-[#1C1C1E] truncate" title={String(prop.billDateFormatted || "—")}>
            {prop.billDateFormatted || "—"}
          </td>
        );

      case "rateableValue":
        return (
          <td key={colId} className="py-2.5 px-3 text-right whitespace-nowrap text-[11px] font-semibold text-[#1C1C1E] tabular-nums truncate" title={String(prop.rateableValueFormatted || "—")}>
            {prop.rateableValueFormatted || "—"}
          </td>
        );

      case "rateImposed":
        return (
          <td key={colId} className="py-2.5 px-3 text-right whitespace-nowrap text-[11px] font-semibold text-[#1C1C1E] tabular-nums truncate" title={String(prop.rateImposed ?? "—")}>
            {prop.rateImposed ?? "—"}
          </td>
        );

      case "previousYearBill":
        return (
          <td key={colId} className="py-2.5 px-3 text-right whitespace-nowrap text-[11px] font-semibold text-[#1C1C1E] tabular-nums relative overflow-visible">
            <PreviousYearBillCellWithTooltip prop={prop} />
          </td>
        );

      case "amountPaid":
        return (
          <td key={colId} className="py-2.5 px-3 text-right whitespace-nowrap text-[11px] font-semibold text-[#1C1C1E] tabular-nums truncate" title={Number(prop.amountPaidLastYear || 0) > 0 ? `Amount Paid: ${formatGhc(prop.amountPaidLastYear)}` : "GH₵ 0.00 (No payment recorded)"}>
            {formatGhc(prop.amountPaidLastYear)}
          </td>
        );

      case "currentBill":
        return (
          <td key={colId} className="py-2.5 px-3 text-right whitespace-nowrap text-[11px] font-semibold text-[#1C1C1E] tabular-nums relative overflow-visible">
            <CurrentBillCellWithTooltip prop={prop} />
          </td>
        );

      case "electoralArea":
        return (
          <td key={colId} className="py-2.5 px-3 whitespace-nowrap text-[11px] font-medium text-[#1C1C1E] truncate" title={cleanDash(prop.electoralArea)}>
            {cleanDash(prop.electoralArea)}
          </td>
        );

      case "totalAmountDue":
        return (
          <td key={colId} className="py-2.5 px-3 text-right whitespace-nowrap text-[11px] text-[#6C6C70] tabular-nums font-normal truncate" title={formatGhc(prop.totalAmountDue)}>
            {formatGhc(prop.totalAmountDue)}
          </td>
        );

      default:
        return null;
    }
  };

  const loadRolloutJobs = async () => {
    setIsLoadingJobs(true);
    try {
      const jobs = await getSmsRolloutJobs(40);
      setRolloutJobs(jobs);
    } catch (err) {
      console.error("Failed to load SMS rollout jobs:", err);
    } finally {
      setIsLoadingJobs(false);
    }
  };

  const refreshGatewayBalance = async () => {
    setIsFetchingBalance(true);
    try {
      const bal = await getArkeselBalance();
      if (bal) setGatewayBalance(bal);
    } catch (err) {
      console.error("Failed to fetch gateway balance:", err);
    } finally {
      setIsFetchingBalance(false);
    }
  };

  // Check if any job is currently active in queue or running
  const hasActiveJob = useMemo(() => {
    return rolloutJobs.some((j) => j.status === "RUNNING" || j.status === "QUEUED");
  }, [rolloutJobs]);

  const prevActiveRef = useRef(false);

  // Background adaptive live polling: polls every 1.5s while active jobs exist
  useEffect(() => {
    let intervalId: any = null;

    if (hasActiveJob) {
      intervalId = setInterval(async () => {
        try {
          const jobs = await getSmsRolloutJobs(40);
          setRolloutJobs(jobs);
        } catch (err) {
          console.error("Failed to live poll SMS rollout jobs:", err);
        }
      }, 1500);
    }

    if (prevActiveRef.current && !hasActiveJob) {
      // All running jobs finished — synchronize gateway SMS credits automatically
      refreshGatewayBalance();
    }
    prevActiveRef.current = hasActiveJob;

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [hasActiveJob]);

  useEffect(() => {
    loadRolloutJobs();
    refreshGatewayBalance();
  }, []);

  useEffect(() => {
    if (activeView === "BATCHES") {
      loadRolloutJobs();
      refreshGatewayBalance();
    }
  }, [activeView]);


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
    updateUrlAndStorage("smsTargetStatus", newStatus, "kkma_sms_target_status");
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
      try {
        const params = new URLSearchParams(window.location.search);

        // SMS View Restoration
        const urlView = params.get("smsView") as "SIMULATOR" | "BATCHES" | "LOGS" | null;
        const savedView = localStorage.getItem("sms_active_view") as "SIMULATOR" | "BATCHES" | "LOGS" | null;
        const validViews = ["SIMULATOR", "BATCHES", "LOGS"];
        if (urlView && validViews.includes(urlView)) {
          setActiveView(urlView);
          if (urlView === "BATCHES") {
            loadRolloutJobs();
            refreshGatewayBalance();
          }
        } else if (savedView && validViews.includes(savedView)) {
          setActiveView(savedView);
          if (savedView === "BATCHES") {
            loadRolloutJobs();
            refreshGatewayBalance();
          }
        }

        // SMS Logs Status Restoration
        const urlLogsStatus = params.get("smsLogStatus") as "ALL" | "DELIVERED" | "FAILED" | null;
        const savedLogsStatus = localStorage.getItem("sms_logs_status") as "ALL" | "DELIVERED" | "FAILED" | null;
        const validLogsStatuses = ["ALL", "DELIVERED", "FAILED"];
        if (urlLogsStatus && validLogsStatuses.includes(urlLogsStatus)) {
          setLogsStatusFilter(urlLogsStatus);
        } else if (savedLogsStatus && validLogsStatuses.includes(savedLogsStatus)) {
          setLogsStatusFilter(savedLogsStatus);
        }

        // Target Status Restoration
        const urlTargetStatus = params.get("smsTargetStatus") as "ALL" | "UNPAID" | "PAID" | "OVERPAID" | null;
        const savedStatus = localStorage.getItem("kkma_sms_target_status") as "ALL" | "UNPAID" | "PAID" | "OVERPAID" | null;
        const validStatuses = ["ALL", "UNPAID", "PAID", "OVERPAID"];
        if (urlTargetStatus && validStatuses.includes(urlTargetStatus)) {
          setTargetStatus(urlTargetStatus);
        } else if (savedStatus && validStatuses.includes(savedStatus)) {
          setTargetStatus(savedStatus);
        }
      } catch {
        // non-fatal
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
  const [logsSearchQuery, setLogsSearchQuery] = useState("");
  const [logsStatusFilter, setLogsStatusFilter] = useState<"ALL" | "DELIVERED" | "FAILED">("ALL");

  const handleLogsStatusFilterChange = (status: "ALL" | "DELIVERED" | "FAILED") => {
    setLogsStatusFilter(status);
    updateUrlAndStorage("smsLogStatus", status, "sms_logs_status");
  };

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
  const [confirmText, setConfirmText] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthorizing, setIsAuthorizing] = useState(false);

  // Template State
  const defaultTemplate = DEFAULT_SMS_NOTICE_TEMPLATE;
  const defaultReceiptTemplate = DEFAULT_RECEIPT_NOTICE_TEMPLATE;

  const [activeTemplateType, setActiveTemplateType] = useState<"BILLING" | "RECEIPT">("BILLING");
  const [messageTemplate, setMessageTemplate] = useState(FILTER_SMS_TEMPLATES.UNPAID);
  const [receiptTemplate, setReceiptTemplate] = useState(defaultReceiptTemplate);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

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

  const billingTokens = useMemo(() => {
    const baseTokens = [
      { tag: "{{municipality}}", label: "Municipality" },
      { tag: "{{billYear}}", label: "Bill Year" },
      { tag: "{{accountNumber}}", label: "Valuation ID / Account No." },
      { tag: "{{propertyAccounts}}", label: "Multi-Property Accounts List" },
      { tag: "{{ownerName}}", label: "Ratepayer Name" },
      { tag: "{{propertyGpsAddress}}", label: "Property GPS / Digital Address" },
    ];

    if (targetStatus === "PAID") {
      return baseTokens;
    }

    if (targetStatus === "OVERPAID") {
      return [
        ...baseTokens,
        { tag: "{{totalAmountDue}}", label: "Credit Balance Amount" },
      ];
    }

    return [
      ...baseTokens,
      { tag: "{{totalAmountDue}}", label: "Total Due" },
      { tag: "{{arrears}}", label: "Arrears" },
      { tag: "{{currentFee}}", label: "Current Fee" },
      { tag: "{{paymentLink}}", label: "Payment Link" },
      { tag: "{{dueDate}}", label: "Due Date" },
    ];
  }, [targetStatus]);

  const receiptTokens = [
    { tag: "{{receiptNumber}}", label: "GCR Receipt No." },
    { tag: "{{amount}}", label: "Amount Paid" },
    { tag: "{{accountNumber}}", label: "Valuation ID / Account No." },
    { tag: "{{ownerName}}", label: "Ratepayer Name" },
    { tag: "{{paymentMethod}}", label: "Payment Channel" },
    { tag: "{{datePaid}}", label: "Payment Date" },
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

  // Delivery Logs Page Navigation & Query
  const fetchDeliveryLogs = async (
    newPage = logsPage,
    newLimit = logsLimit,
    query = logsSearchQuery,
    status = logsStatusFilter
  ) => {
    setIsLoadingLogs(true);
    try {
      const res = await getSmsRolloutLogsPaginated(newPage, newLimit, query, status);
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

  const handleLogsPageChange = (newPage: number) => {
    fetchDeliveryLogs(newPage, logsLimit, logsSearchQuery, logsStatusFilter);
  };

  const handleLogsPageSizeChange = (newLimit: number) => {
    setLogsLimit(newLimit);
    fetchDeliveryLogs(1, newLimit, logsSearchQuery, logsStatusFilter);
  };

  // Re-fetch when switching to LOGS view or when status filter changes
  useEffect(() => {
    if (activeView === "LOGS") {
      fetchDeliveryLogs(1, logsLimit, logsSearchQuery, logsStatusFilter);
    }
  }, [activeView, logsStatusFilter]);

  // Debounced search for logs
  useEffect(() => {
    if (activeView !== "LOGS") return;
    const timer = setTimeout(() => {
      fetchDeliveryLogs(1, logsLimit, logsSearchQuery, logsStatusFilter);
    }, 250);
    return () => clearTimeout(timer);
  }, [logsSearchQuery]);




  const effectiveRolloutCount = audienceScope === "SELECTED" && selectedSpecificAccounts.length > 0
    ? selectedSpecificAccounts.length
    : totalAudienceCount;

  const effectiveRolloutTotalDueFormatted = audienceScope === "SELECTED" && selectedSpecificAccounts.length > 0
    ? formatGhc(selectedSpecificAccounts.reduce((sum, p) => sum + Number(p.totalAmountDue || 0), 0))
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
      const isCleared = prop.status === "PAID" || Number(prop.totalAmountDue || 0) <= 0 || Number(prop.amountPaidLastYear || 0) >= Number(prop.arrears || 0);
      const remainingArrears = isCleared ? 0 : Math.max(0, Number(prop.arrears || 0) - Number(prop.amountPaidLastYear || 0));
      g.totalArrears += remainingArrears;
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
      if (retryTargetJob) {
        const res = await retryFailedSmsJob(retryTargetJob.id, adminPassword);
        if (res && !res.success) {
          setAuthError(res.error || "Password verification failed.");
        } else {
          setShowAuthModal(false);
          setRetryTargetJob(null);
          setAdminPassword("");
          handleActiveViewChange("BATCHES");
          if (onNotify) onNotify(res.message || "Rollout resumed.", "success");
          setRolloutJobs((prev) =>
            prev.map((j) => (j.id === retryTargetJob.id ? { ...j, status: "QUEUED" } : j))
          );
          await loadRolloutJobs();
          refreshGatewayBalance();
        }
        return;
      }

      const clientMode = typeof window !== "undefined" ? (localStorage.getItem("kkma_sms_dispatch_mode") as any) : undefined;
      
      let dispatchPayload: any;
      let targetRecipientCount = 0;
      if (audienceScope === "SELECTED" && selectedSpecificAccounts.length > 0) {
        dispatchPayload = selectedSpecificAccounts.map((p) => p.accountNumber);
        targetRecipientCount = selectedSpecificAccounts.length;
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
        targetRecipientCount = totalAudienceCount;
      }

      const res = await onTriggerBatchRollout(dispatchPayload, messageTemplate, adminPassword, clientMode);
      if (res && !res.success) {
        setAuthError(res.error || "Password verification failed.");
      } else {
        setShowAuthModal(false);
        setAdminPassword("");
        setConfirmText("");
        handleActiveViewChange("BATCHES");
        if (res && (res as any).jobId) {
          const optimisticJob: SmsRolloutJobSummary = {
            id: (res as any).jobId,
            status: "QUEUED",
            mode: clientMode === "LIVE" ? "LIVE" : "SIMULATION",
            totalCount: (res as any).dispatchedCount || targetRecipientCount,
            sentCount: 0,
            failedCount: 0,
            accountCount: (res as any).dispatchedCount || targetRecipientCount,
            sentAccountCount: 0,
            failedAccountCount: 0,
            hasFailedAccounts: false,
            createdAt: new Date().toISOString(),
            createdAtFormatted: formatDateGb(new Date()),
            errorMessage: null,
          };
          setRolloutJobs((prev) => [optimisticJob, ...prev.filter((j) => j.id !== (res as any).jobId)]);
        }
        await loadRolloutJobs();
        refreshGatewayBalance();
      }
    } catch (err) {
      setAuthError("An unexpected error occurred during dispatch authorization.");
    } finally {
      setIsAuthorizing(false);
    }
  };

  return (
    <div className="relative w-full h-full flex-1 min-h-0 overflow-hidden flex flex-col font-sans bg-[#F2F2F7] text-[#1C1C1E]">
      {/* SMS SUBNAVIGATION TABS (Collapses on mobile scroll-down) */}
      <div className={`w-full bg-white border-b border-[#E5E5EA] px-3.5 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-3 shrink-0 z-10 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden ${
        !isHeaderVisible
          ? "max-h-0 sm:max-h-none py-0 opacity-0 sm:opacity-100 pointer-events-none sm:pointer-events-auto border-b-0"
          : "max-h-[140px] opacity-100"
      }`}>
        <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto no-scrollbar py-0.5 shrink-0">
          <button
            type="button"
            onClick={() => handleActiveViewChange("SIMULATOR")}
            className={`py-2.5 sm:py-3 text-xs font-semibold transition-colors cursor-pointer relative whitespace-nowrap shrink-0 ${
              activeView === "SIMULATOR"
                ? "text-[#007AFF] border-b-2 border-[#007AFF]"
                : "text-[#6C6C70] hover:text-[#1C1C1E]"
            }`}
          >
            <span>Rollout Engine</span>
          </button>
          <button
            type="button"
            onClick={() => handleActiveViewChange("BATCHES")}
            className={`py-2.5 sm:py-3 text-xs font-semibold transition-colors cursor-pointer relative flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeView === "BATCHES"
                ? "text-[#007AFF] border-b-2 border-[#007AFF]"
                : "text-[#6C6C70] hover:text-[#1C1C1E]"
            }`}
          >
            <span className="hidden sm:inline">Rollout Batches &amp; History</span>
            <span className="sm:hidden">Batches &amp; History</span>
          </button>
          <button
            type="button"
            onClick={() => handleActiveViewChange("LOGS")}
            className={`py-2.5 sm:py-3 text-xs font-semibold transition-colors cursor-pointer relative flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeView === "LOGS"
                ? "text-[#007AFF] border-b-2 border-[#007AFF]"
                : "text-[#6C6C70] hover:text-[#1C1C1E]"
            }`}
          >
            <span>Delivery Logs</span>
          </button>
        </div>

        {/* Live Gateway Balance Quick Widget */}
        <div className="flex items-center gap-2.5 text-xs py-2 sm:py-0">
          <span className="text-[11px] text-[#6C6C70]">
            Gateway Credit:{" "}
            <span className="font-semibold text-[#1C1C1E] tabular-nums">
              {gatewayBalance ? `${gatewayBalance.smsBalance.toLocaleString()} SMS (${gatewayBalance.mainBalance.replace('GHS', 'GH₵')})` : "Checking..."}
            </span>
          </span>
        </div>
      </div>

      {/* PANE 1: SMS ROLLOUT ENGINE */}
      {activeView === "SIMULATOR" && (
        <div className="w-full h-full flex flex-col min-h-0 p-0 overflow-hidden relative bg-[#F2F2F7]">
          <div className="w-full h-full min-h-0 flex flex-col overflow-hidden">

            {/* Audience & Field Selection */}
            <div className="border-0 rounded-none shadow-none shrink-0 flex flex-col bg-white">
              <div className="shrink-0 space-y-2.5 relative z-20 p-3.5 border-b border-[#E5E5EA] bg-white">
                {/* Search, Classification, Fields Filter & Action Toolbar */}
                <div className="flex flex-wrap items-center justify-end-safe gap-2">
                  <div className="relative flex-1 min-w-[180px] order-last lg:order-none">
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
                <div className="relative shrink-0 z-50 isolate">
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
              <div className="px-3.5 py-2 border-b flex flex-col md:flex-row md:items-center justify-between gap-2 shrink-0 bg-[#F8F9FA] border-[#E5E5EA]">
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="text-xs font-bold text-[#1C1C1E] truncate">Audience Rollout Queue</span>
                    <span className="text-[11px] text-[#6C6C70] whitespace-nowrap">
                      ({totalAudienceCount.toLocaleString()} • P{audiencePage}/{Math.max(1, Math.ceil(totalAudienceCount / audienceLimit))}
                      {multiPropertyRatepayersCount > 0 && ` • ${multiPropertyRatepayersCount} portfolios`})
                    </span>
                  </div>
                  {/* Quick Select All in Mobile view */}
                  <label className="md:hidden flex items-center gap-1.5 text-[11px] font-medium text-[#007AFF] cursor-pointer shrink-0 min-h-[44px]">
                    <input
                      type="checkbox"
                      checked={audienceScope === "SELECTED" && liveAudience.length > 0 && selectedSpecificAccounts.length === liveAudience.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedSpecificAccounts(liveAudience);
                          setAudienceScope("SELECTED");
                        } else {
                          setSelectedSpecificAccounts([]);
                          setAudienceScope("DATABASE_FILTER");
                        }
                      }}
                      className="w-4 h-4 rounded border-[#C7C7CC] text-[#007AFF] accent-[#007AFF] cursor-pointer"
                    />
                    <span>Select Page</span>
                  </label>
                </div>
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 shrink-0">
                  {multiPropertyRatepayersCount > 0 && isHierarchicalView && (
                    <button
                      type="button"
                      onClick={handleToggleCollapseAll}
                      className="text-[11px] text-[#6C6C70] hover:text-[#1C1C1E] cursor-pointer whitespace-nowrap"
                    >
                      {collapsedGroupKeys.size > 0 ? "Expand All" : "Collapse All"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsHierarchicalView(!isHierarchicalView)}
                    className={`h-7 px-2.5 rounded-md border text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 whitespace-nowrap ${
                      isHierarchicalView
                        ? "border-[#007AFF] bg-[#007AFF]/10 text-[#007AFF]"
                        : "border-[#E5E5EA] bg-[#F2F2F7] text-[#6C6C70] hover:text-[#1C1C1E]"
                    }`}
                    title="Toggle between Ratepayer Portfolio Grouping and Flat Property rows"
                  >
                    <Users className="w-3 h-3" />
                    <span>{isHierarchicalView ? "Hierarchical" : "Flat"}</span>
                  </button>
                  <div className="h-3 w-px bg-[#E5E5EA] shrink-0" />
                  <button
                    type="button"
                    onClick={() => setShowTemplateModal(true)}
                    className="text-[11px] font-semibold text-[#007AFF] hover:underline cursor-pointer flex items-center gap-1 shrink-0 whitespace-nowrap"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Template</span>
                  </button>
                  {JSON.stringify(columnOrder) !== JSON.stringify(DEFAULT_AUDIENCE_COLUMNS.map((c) => c.id)) && (
                    <button
                      type="button"
                      onClick={resetColumnOrder}
                      className="h-7 px-2.5 rounded-md border border-[#E5E5EA] bg-[#F2F2F7] text-[#6C6C70] hover:text-[#1C1C1E] text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                      title="Reset columns to default layout"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset Columns</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Audience Table Container */}
              <div
                ref={tableContainerRef}
                onScroll={onTableScroll}
                className="flex-1 min-h-0 min-h-[calc(100dvh-13rem)] overflow-auto [overflow-anchor:auto] [isolation:isolate]"
              >
                <table className="hidden md:table w-[2860px] min-w-[2860px] table-fixed text-left text-xs border-collapse">
                  <colgroup>
                    <col className="w-[48px]" />
                    {columnOrder.map((colId) => {
                      const colDef = DEFAULT_AUDIENCE_COLUMNS.find((c) => c.id === colId);
                      return <col key={colId} className={colDef?.width || "w-[130px]"} />;
                    })}
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
                      {columnOrder.map((colId) => {
                        const colDef = DEFAULT_AUDIENCE_COLUMNS.find((c) => c.id === colId);
                        if (!colDef) return null;
                        const isDragging = draggedColId === colId;
                        const isDragOver = dragOverColId === colId;
                        return (
                          <th
                            key={colId}
                            draggable
                            onDragStart={() => handleDragStart(colId)}
                            onDragOver={(e) => handleDragOver(e, colId)}
                            onDragLeave={() => handleDragLeave(colId)}
                            onDrop={() => handleDrop(colId)}
                            className={`py-2.5 px-3 whitespace-nowrap bg-[#F8F9FA] select-none cursor-grab active:cursor-grabbing transition-colors ${
                              colDef.align === "right" ? "text-right" : "text-left"
                            } ${colDef.width} ${
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
                    {isLoadingAudience ? (
                      Array.from({ length: 9 }).map((_, i) => (
                        <tr key={`aud-skel-${i}`} className="animate-pulse">
                          <td className="py-2.5 px-3 text-center"><div className="w-3.5 h-3.5 bg-[#E5E5EA] rounded mx-auto" /></td>
                          {columnOrder.map((colId) => {
                            const colDef = DEFAULT_AUDIENCE_COLUMNS.find((c) => c.id === colId);
                            return (
                              <td key={colId} className={`py-2.5 px-3 ${colDef?.align === "right" ? "text-right" : ""}`}>
                                <div className={`h-3.5 w-20 bg-[#E5E5EA] rounded ${colDef?.align === "right" ? "ml-auto" : ""}`} />
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    ) : liveAudience.length === 0 ? (
                      <tr>
                        <td colSpan={columnOrder.length + 1} className="py-12 text-center text-[#8E8E93] italic text-xs">
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
                                <td colSpan={columnOrder.length - 1} className="py-2 px-3">
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
                                            Arrears: {formatGhc(group.totalArrears)}
                                          </span>
                                        </>
                                      )}
                                  </div>
                                </td>
                                <td
                                  onClick={() => toggleGroupCollapse(group.key)}
                                  className="py-2.5 px-3 text-right whitespace-nowrap font-bold text-xs text-[#1C1C1E] tabular-nums cursor-pointer relative truncate"
                                  title={formatGhc(group.totalAmountDue)}
                                >
                                  {isExpanded && (
                                    <div className="absolute left-3 bottom-0 h-2.5 w-px border-l border-dashed border-[#E5E5EA]" />
                                  )}
                                  {formatGhc(group.totalAmountDue)}
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
                                        {columnOrder.map((colId) => renderAudienceCell(colId, prop, true, isLast))}
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
                            {columnOrder.map((colId) => renderAudienceCell(colId, prop, false, false))}
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
                            {columnOrder.map((colId) => renderAudienceCell(colId, prop, false, false))}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>

                {/* Mobile Matched Audience Cards (< 768px) */}
                <div className="block md:hidden divide-y divide-[#E5E5EA] bg-white">
                  {isLoadingAudience ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <div key={`mob-aud-skel-${i}`} className="p-3.5 space-y-2 animate-pulse">
                        <div className="flex items-center justify-between">
                          <div className="h-4 w-28 bg-[#E5E5EA] rounded" />
                          <div className="h-4 w-20 bg-[#E5E5EA] rounded" />
                        </div>
                        <div className="h-3 w-40 bg-[#E5E5EA] rounded" />
                        <div className="h-3 w-24 bg-[#E5E5EA] rounded" />
                      </div>
                    ))
                  ) : liveAudience.length === 0 ? (
                    <div className="py-12 px-4 text-center text-[#8E8E93] italic text-xs">
                      No properties match the selected audience filters.
                    </div>
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
                          <div key={`mob-grp-${group.key}`} className="border-b border-[#E5E5EA]">
                            {/* Portfolio Header Card */}
                            <div className="p-3 bg-[#F8F9FA] flex items-start gap-2.5">
                              {/* 44px Checkbox */}
                              <div className="min-w-[44px] min-h-[44px] flex items-center justify-center -m-2 shrink-0">
                                <input
                                  type="checkbox"
                                  checked={isAllGroupSelected}
                                  ref={(el) => {
                                    if (el) el.indeterminate = isSomeGroupSelected;
                                  }}
                                  onChange={() => {
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
                                  className="w-4 h-4 rounded border-[#C7C7CC] text-[#007AFF] accent-[#007AFF] cursor-pointer"
                                />
                              </div>

                              {/* Portfolio Info */}
                              <div
                                onClick={() => toggleGroupCollapse(group.key)}
                                className="flex-1 min-w-0 cursor-pointer pt-0.5"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-bold text-xs text-[#1C1C1E] truncate">
                                    {group.ownerName}
                                  </span>
                                  <span className="text-xs font-bold text-[#1C1C1E] tabular-nums shrink-0">
                                    {formatGhc(group.totalAmountDue)}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5 text-[11px] text-[#6C6C70] mt-0.5 flex-wrap">
                                  <span className="font-mono">{cleanDash(group.phone)}</span>
                                  <span>&bull;</span>
                                  <span className="font-semibold text-[#007AFF]">{group.properties.length} Accounts</span>
                                  {group.totalArrears > 0 && (
                                    <>
                                      <span>&bull;</span>
                                      <span className="text-[#FF3B30] font-semibold">
                                        Arrears: {formatGhc(group.totalArrears)}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* 44px Expand/Collapse Chevron */}
                              <button
                                type="button"
                                onClick={() => toggleGroupCollapse(group.key)}
                                className="min-w-[44px] min-h-[44px] flex items-center justify-center -m-2 text-[#6C6C70] hover:text-[#1C1C1E] cursor-pointer shrink-0"
                                aria-label={isExpanded ? "Collapse portfolio" : "Expand portfolio"}
                              >
                                <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                              </button>
                            </div>

                            {/* Nested Property Cards */}
                            {isExpanded && (
                              <div className="pl-6 border-l-2 border-[#007AFF] divide-y divide-[#E5E5EA] bg-white">
                                {group.properties.map((prop) => {
                                  const isSelected = selectedSpecificAccounts.some(
                                    (p) => (p.id || p.accountNumber) === (prop.id || prop.accountNumber)
                                  );

                                  return (
                                    <div
                                      key={`mob-sub-${prop.id || prop.accountNumber}`}
                                      onClick={() => {
                                        if (isSelected) {
                                          setSelectedSpecificAccounts((prev) => {
                                            const newSelection = prev.filter(
                                              (p) => (p.id || p.accountNumber) !== (prop.id || prop.accountNumber)
                                            );
                                            if (newSelection.length === 0) setAudienceScope("DATABASE_FILTER");
                                            return newSelection;
                                          });
                                        } else {
                                          setSelectedSpecificAccounts((prev) => [...prev, prop]);
                                          setAudienceScope("SELECTED");
                                        }
                                      }}
                                      className={`p-3 flex items-start gap-2.5 transition-colors cursor-pointer ${
                                        isSelected ? "bg-[#007AFF]/8" : "hover:bg-[#F8F9FA]"
                                      }`}
                                    >
                                      <div className="min-w-[44px] min-h-[44px] flex items-center justify-center -m-2 shrink-0 pointer-events-none">
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          readOnly
                                          className="w-4 h-4 rounded border-[#C7C7CC] text-[#007AFF] accent-[#007AFF]"
                                        />
                                      </div>

                                      <div className="flex-1 min-w-0 pt-0.5">
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="font-mono text-xs font-bold text-[#007AFF] truncate">
                                            {cleanDash(prop.accountNumber)}
                                          </span>
                                          <span className="text-xs font-bold text-[#1C1C1E] tabular-nums shrink-0">
                                            {formatGhc(prop.totalAmountDue)}
                                          </span>
                                        </div>

                                        <div className="text-[11px] text-[#6C6C70] flex items-center gap-1.5 flex-wrap mt-0.5">
                                          <span>{cleanDash(prop.valuationNo)}</span>
                                          <span>&bull;</span>
                                          <span className="font-mono">{cleanDash(prop.ownerDigitalAddress)}</span>
                                        </div>

                                        <div className="text-[11px] flex items-center justify-between mt-1">
                                          <span className="text-[#8E8E93] truncate">{cleanDash(prop.propertyClassification)}</span>
                                          {prop.arrears > 0 ? (
                                            <span className="text-[#FF3B30] font-semibold tabular-nums">
                                              Arrears: {prop.arrearsFormatted}
                                            </span>
                                          ) : (
                                            <span className="text-[#34C759] font-medium">&bull; Current</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      }

                      // Single property under hierarchical view
                      const prop = group.properties[0];
                      if (!prop) return null;
                      const isSelected = selectedSpecificAccounts.some(
                        (p) => (p.id || p.accountNumber) === (prop.id || prop.accountNumber)
                      );

                      return (
                        <div
                          key={`mob-sing-${prop.id || prop.accountNumber}`}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedSpecificAccounts((prev) => {
                                const newSelection = prev.filter(
                                  (p) => (p.id || p.accountNumber) !== (prop.id || prop.accountNumber)
                                );
                                if (newSelection.length === 0) setAudienceScope("DATABASE_FILTER");
                                return newSelection;
                              });
                            } else {
                              setSelectedSpecificAccounts((prev) => [...prev, prop]);
                              setAudienceScope("SELECTED");
                            }
                          }}
                          className={`p-3 flex items-start gap-2.5 transition-colors cursor-pointer ${
                            isSelected ? "bg-[#007AFF]/8" : "hover:bg-[#F8F9FA]"
                          }`}
                        >
                          <div className="min-w-[44px] min-h-[44px] flex items-center justify-center -m-2 shrink-0 pointer-events-none">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              readOnly
                              className="w-4 h-4 rounded border-[#C7C7CC] text-[#007AFF] accent-[#007AFF]"
                            />
                          </div>

                          <div className="flex-1 min-w-0 pt-0.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-xs font-bold text-[#007AFF] truncate">
                                {cleanDash(prop.accountNumber)}
                              </span>
                              <span className="text-xs font-bold text-[#1C1C1E] tabular-nums shrink-0">
                                {formatGhc(prop.totalAmountDue)}
                              </span>
                            </div>

                            <div className="text-xs font-bold text-[#1C1C1E] truncate mt-0.5">
                              {cleanDash(prop.ownerName)}
                            </div>

                            <div className="text-[11px] text-[#6C6C70] flex items-center gap-1.5 flex-wrap mt-0.5 font-mono">
                              <span>{cleanDash(prop.ownerPhone)}</span>
                              <span>&bull;</span>
                              <span>{cleanDash(prop.ownerDigitalAddress)}</span>
                            </div>

                            <div className="text-[11px] flex items-center justify-between mt-1">
                              <span className="text-[#8E8E93] truncate">{cleanDash(prop.propertyClassification)}</span>
                              {prop.arrears > 0 ? (
                                <span className="text-[#FF3B30] font-semibold tabular-nums">
                                  Arrears: {prop.arrearsFormatted}
                                </span>
                              ) : (
                                <span className="text-[#34C759] font-medium">&bull; Current</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    // Flat View
                    liveAudience.map((prop) => {
                      const isSelected = selectedSpecificAccounts.some(
                        (p) => (p.id || p.accountNumber) === (prop.id || prop.accountNumber)
                      );

                      return (
                        <div
                          key={`mob-flat-${prop.id || prop.accountNumber}`}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedSpecificAccounts((prev) => {
                                const newSelection = prev.filter(
                                  (p) => (p.id || p.accountNumber) !== (prop.id || prop.accountNumber)
                                );
                                if (newSelection.length === 0) setAudienceScope("DATABASE_FILTER");
                                return newSelection;
                              });
                            } else {
                              setSelectedSpecificAccounts((prev) => [...prev, prop]);
                              setAudienceScope("SELECTED");
                            }
                          }}
                          className={`p-3 flex items-start gap-2.5 transition-colors cursor-pointer ${
                            isSelected ? "bg-[#007AFF]/8" : "hover:bg-[#F8F9FA]"
                          }`}
                        >
                          <div className="min-w-[44px] min-h-[44px] flex items-center justify-center -m-2 shrink-0 pointer-events-none">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              readOnly
                              className="w-4 h-4 rounded border-[#C7C7CC] text-[#007AFF] accent-[#007AFF]"
                            />
                          </div>

                          <div className="flex-1 min-w-0 pt-0.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-xs font-bold text-[#007AFF] truncate">
                                {cleanDash(prop.accountNumber)}
                              </span>
                              <span className="text-xs font-bold text-[#1C1C1E] tabular-nums shrink-0">
                                {formatGhc(prop.totalAmountDue)}
                              </span>
                            </div>

                            <div className="text-xs font-bold text-[#1C1C1E] truncate mt-0.5">
                              {cleanDash(prop.ownerName)}
                            </div>

                            <div className="text-[11px] text-[#6C6C70] flex items-center gap-1.5 flex-wrap mt-0.5 font-mono">
                              <span>{cleanDash(prop.ownerPhone)}</span>
                              <span>&bull;</span>
                              <span>{cleanDash(prop.ownerDigitalAddress)}</span>
                            </div>

                            <div className="text-[11px] flex items-center justify-between mt-1">
                              <span className="text-[#8E8E93] truncate">{cleanDash(prop.propertyClassification)}</span>
                              {prop.arrears > 0 ? (
                                <span className="text-[#FF3B30] font-semibold tabular-nums">
                                  Arrears: {prop.arrearsFormatted}
                                </span>
                              ) : (
                                <span className="text-[#34C759] font-medium">&bull; Current</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
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
      )}

      {/* PANE 2: ROLLOUT BATCHES & RETRY QUEUE */}
      {activeView === "BATCHES" && (
        <div className="w-full h-full flex flex-col overflow-hidden bg-white border-0 rounded-none shadow-none">
          <div className="p-3 border-b border-[#E5E5EA] bg-[#F8F9FA] flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-[#6C6C70]">
                Batch Dispatches &amp; Retries
              </span>
            </div>

          </div>

          <div onScroll={onTableScroll} className="flex-1 min-h-0 min-h-[calc(100dvh-13rem)] overflow-auto [overflow-anchor:auto] [isolation:isolate]">
            {rolloutJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-[#6C6C70] text-xs space-y-2">
                {isLoadingJobs ? (
                  <>
                    <AppleSpinner size="sm" className="text-[#007AFF]" />
                    <span>Loading rollout batches...</span>
                  </>
                ) : (
                  <>
                    <History className="w-8 h-8 text-[#8E8E93] stroke-[1.5]" />
                    <span className="font-medium">No batch rollouts dispatched yet.</span>
                    <button
                      type="button"
                      onClick={() => handleActiveViewChange("SIMULATOR")}
                      className="text-xs text-[#007AFF] hover:underline cursor-pointer"
                    >
                      Go to Rollout Engine to launch a campaign
                    </button>
                  </>
                )}
              </div>
            ) : (
              <>
                {/* Desktop Batches Table (>= 768px) */}
                <table className="hidden md:table min-w-[800px] w-full text-left text-xs border-collapse font-sans">
                  <thead className="border-b text-[#6C6C70] sticky top-0 bg-[#F8F9FA] border-[#E5E5EA] z-10">
                    <tr>
                      <th className="py-2.5 px-3">Date &amp; Time</th>
                      <th className="py-2.5 px-3">Batch ID</th>
                      <th className="py-2.5 px-3">Mode</th>
                      <th className="py-2.5 px-3">Recipients Progress</th>
                      <th className="py-2.5 px-3">Failures</th>
                      <th className="py-2.5 px-3">Job Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E5EA]">
                    {rolloutJobs.map((job) => {
                      const total = job.totalCount || 0;
                      const sent = job.sentCount || 0;
                      const failed = job.failedCount || 0;
                      const isFinished = total > 0 && (sent + failed >= total);
                      const effectiveStatus = (job.status === "RUNNING" && isFinished)
                        ? (sent === 0 ? "FAILED" : "DONE")
                        : job.status;
                      const pct = total > 0 ? Math.min(100, Math.round((sent / total) * 100)) : 0;
                      const isRunning = effectiveStatus === "RUNNING" && !isFinished;
                      const isQueued = effectiveStatus === "QUEUED";

                      return (
                        <tr key={job.id} className="hover:bg-[#F8F9FA] transition-colors">
                          <td className="py-2.5 px-3 text-xs font-medium text-[#1C1C1E] whitespace-nowrap">
                            {job.createdAtFormatted}
                          </td>
                          <td className="py-2.5 px-3 text-[11px] font-mono font-bold text-[#007AFF] whitespace-nowrap">
                            {job.id}
                          </td>
                          <td className="py-2.5 px-3 text-xs font-semibold whitespace-nowrap">
                            <span className={job.mode === "LIVE" ? "text-[#FF9500]" : "text-[#6C6C70]"}>
                              {job.mode}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <div className="flex flex-col gap-1 min-w-[140px] max-w-[200px]">
                              <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-[#1C1C1E]">
                                <span className="flex items-center gap-1.5">
                                  {isRunning && <AppleSpinner size="xs" />}
                                  <span>{sent} / {total}</span>
                                </span>
                                <span className="text-[#6C6C70] font-semibold">{pct}%</span>
                              </div>
                              <div className="w-full bg-[#E5E5EA] rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="h-full bg-[#34C759] rounded-full transition-all duration-300 ease-out"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {job.failedCount > 0 ? (
                              <span className="text-xs font-semibold text-[#FF3B30] flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                <span>{job.failedCount} Failed ({job.failedAccountCount} accounts)</span>
                              </span>
                            ) : (
                              <span className="text-xs font-medium text-[#34C759]">
                                &bull; 0 Failed
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap font-medium text-xs">
                            {effectiveStatus === "DONE" ? (
                              job.failedCount > 0 ? (
                                <span className="text-[#FF9500] font-semibold flex items-center gap-1">
                                  &bull; Partial
                                </span>
                              ) : (
                                <span className="text-[#34C759] font-semibold flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Done
                                </span>
                              )
                            ) : isRunning ? (
                              <span className="text-[#007AFF] font-semibold flex items-center gap-1.5">
                                <AppleSpinner size="xs" />
                                <span>Running</span>
                              </span>
                            ) : isQueued ? (
                              <span className="text-[#8E8E93] font-semibold flex items-center gap-1.5">
                                <AppleSpinner size="xs" />
                                <span>Queued</span>
                              </span>
                            ) : effectiveStatus === "FAILED" ? (
                              <span className="text-[#FF3B30] font-semibold">
                                &bull; Failed
                              </span>
                            ) : (
                              <span className="text-[#8E8E93]">
                                &bull; {effectiveStatus}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            {job.hasFailedAccounts && job.failedAccountCount > 0 ? (
                              <button
                                type="button"
                                disabled={isAuthorizing}
                                onClick={() => {
                                  setRetryTargetJob({ id: job.id, count: job.failedAccountCount });
                                  setAdminPassword("");
                                  setAuthError(null);
                                  setShowAuthModal(true);
                                  refreshGatewayBalance();
                                }}
                                className="text-xs font-bold text-[#007AFF] hover:underline cursor-pointer inline-flex items-center gap-1.5 transition-opacity disabled:opacity-50"
                                title="Dispatch only to recipients who did not receive the SMS"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Retry Failed ({job.failedAccountCount})</span>
                              </button>
                            ) : (
                              <span className="text-xs text-[#8E8E93]">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Mobile Rollout Batches List (< 768px) */}
                <div className="block md:hidden divide-y divide-[#E5E5EA]">
                  {rolloutJobs.map((job) => {
                    const total = job.totalCount || 0;
                    const sent = job.sentCount || 0;
                    const failed = job.failedCount || 0;
                    const isFinished = total > 0 && (sent + failed >= total);
                    const effectiveStatus = (job.status === "RUNNING" && isFinished)
                      ? (sent === 0 ? "FAILED" : "DONE")
                      : job.status;
                    const pct = total > 0 ? Math.min(100, Math.round((sent / total) * 100)) : 0;
                    const isRunning = effectiveStatus === "RUNNING" && !isFinished;

                    return (
                      <div key={`mob-job-${job.id}`} className="p-3.5 space-y-2.5 hover:bg-[#F8F9FA] transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-[#007AFF]">{job.id}</span>
                            <span className={`text-[11px] font-semibold ${job.mode === "LIVE" ? "text-[#FF9500]" : "text-[#6C6C70]"}`}>
                              &bull; {job.mode}
                            </span>
                          </div>
                          <span className="text-[11px] text-[#6C6C70] font-mono">{job.createdAtFormatted}</span>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-mono text-[#1C1C1E]">
                            <span className="flex items-center gap-1.5">
                              {isRunning && <AppleSpinner size="xs" />}
                              <span>{sent} / {total} dispatched</span>
                            </span>
                            <span className="font-semibold text-[#6C6C70]">{pct}%</span>
                          </div>
                          <div className="w-full bg-[#E5E5EA] rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-full bg-[#34C759] rounded-full transition-all duration-300 ease-out"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>

                        {/* Status & Retry Footer */}
                        <div className="flex items-center justify-between pt-1 text-xs">
                          <div>
                            {effectiveStatus === "FAILED" ? (
                              <span className="text-[#FF3B30] font-semibold flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                <span>{job.failedCount} Failed</span>
                              </span>
                            ) : job.failedCount > 0 ? (
                              <span className="text-[#FF9500] font-semibold flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                <span>{job.failedCount} Failed</span>
                              </span>
                            ) : (
                              <span className="text-[#34C759] font-medium flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Completed</span>
                              </span>
                            )}
                          </div>

                          {job.hasFailedAccounts && job.failedAccountCount > 0 && (
                            <button
                              type="button"
                              disabled={isAuthorizing}
                              onClick={() => {
                                setRetryTargetJob({ id: job.id, count: job.failedAccountCount });
                                setAdminPassword("");
                                setAuthError(null);
                                setShowAuthModal(true);
                                refreshGatewayBalance();
                              }}
                              className="h-8 px-2.5 rounded-lg border border-[#007AFF]/30 text-xs font-bold text-[#007AFF] bg-[#007AFF]/5 hover:bg-[#007AFF]/10 cursor-pointer inline-flex items-center gap-1.5 active:scale-95 transition-all"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Retry ({job.failedAccountCount})</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* PANE 3: DELIVERY LOGS */}
      {activeView === "LOGS" && (
        <div className="w-full h-full flex flex-col min-h-0 p-0 overflow-hidden relative bg-[#F2F2F7]">
          <div className="h-full flex flex-col overflow-hidden bg-white border-0 rounded-none shadow-none">
            <div className="p-3 border-b border-[#E5E5EA] bg-[#F8F9FA] flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex flex-1 flex-wrap items-center justify-end-safe gap-3">
                {/* Search Bar */}
                <div className="relative w-48 sm:w-64 order-last sm:order-none sm:mr-auto">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8E8E93]" />
                  <input
                    type="text"
                    placeholder="Search logs (phone, account, name)..."
                    value={logsSearchQuery}
                    onChange={(e) => setLogsSearchQuery(e.target.value)}
                    className="w-full h-8 pl-8 pr-3 text-xs bg-white border border-[#E5E5EA] rounded-lg text-[#1C1C1E] placeholder-[#8E8E93] focus:outline-none focus:border-[#007AFF]"
                  />
                  {logsSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setLogsSearchQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8E8E93] hover:text-[#1C1C1E] text-xs cursor-pointer"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Status Filter (Pure Typographic, Zero Pills) */}
                <div className="flex items-center gap-3 text-xs pl-1">
                  <button
                    type="button"
                    onClick={() => handleLogsStatusFilterChange("ALL")}
                    className={`pb-0.5 font-medium cursor-pointer transition-colors ${
                      logsStatusFilter === "ALL"
                        ? "text-[#007AFF] border-b-2 border-[#007AFF] font-bold"
                        : "text-[#6C6C70] hover:text-[#1C1C1E]"
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLogsStatusFilterChange("DELIVERED")}
                    className={`pb-0.5 font-medium cursor-pointer transition-colors ${
                      logsStatusFilter === "DELIVERED"
                        ? "text-[#34C759] border-b-2 border-[#34C759] font-bold"
                        : "text-[#6C6C70] hover:text-[#1C1C1E]"
                    }`}
                  >
                    Delivered
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLogsStatusFilterChange("FAILED")}
                    className={`pb-0.5 font-medium cursor-pointer transition-colors ${
                      logsStatusFilter === "FAILED"
                        ? "text-[#FF3B30] border-b-2 border-[#FF3B30] font-bold"
                        : "text-[#6C6C70] hover:text-[#1C1C1E]"
                    }`}
                  >
                    Failed
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <span className="text-xs text-[#6C6C70] font-mono tabular-nums">
                  {logsTotal.toLocaleString()} dispatches
                </span>
              </div>
            </div>

            {/* Delivery Logs Container */}
            <div
              ref={logsTableContainerRef}
              onScroll={onTableScroll}
              className="flex-1 min-h-0 min-h-[calc(100dvh-13rem)] overflow-auto [overflow-anchor:auto] [isolation:isolate]"
            >
              {/* Desktop Table (>= 768px) */}
              <table className="hidden md:table min-w-[850px] w-full text-left text-xs border-collapse">
                <thead className="border-b text-[#6C6C70] sticky top-0 bg-[#F8F9FA] border-[#E5E5EA] z-10">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Timestamp</th>
                    <th className="py-2.5 px-4 font-semibold">Account No</th>
                    <th className="py-2.5 px-4 font-semibold">Recipient</th>
                    <th className="py-2.5 px-4 font-semibold">Notice Message</th>
                    <th className="py-2.5 px-4 font-semibold text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E5EA]">
                  {isLoadingLogs ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-[#6C6C70]">
                        <div className="flex items-center justify-center gap-2">
                          <AppleSpinner size="sm" />
                          <span>Loading dispatches...</span>
                        </div>
                      </td>
                    </tr>
                  ) : logsList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-[#8E8E93]">
                        No transmission logs found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    logsList.map((log) => (
                      <tr key={log.id} className="hover:bg-[#F8F9FA] transition-colors">
                        <td className="py-2.5 px-4 text-xs font-medium text-[#6C6C70] font-mono whitespace-nowrap">
                          {log.createdAtFormatted}
                        </td>
                        <td className="py-2.5 px-4 text-xs font-mono font-bold text-[#007AFF] whitespace-nowrap">
                          {log.accountNumber || "—"}
                        </td>
                        <td className="py-2.5 px-4 text-xs">
                          <span className="font-semibold text-[#1C1C1E] block">
                            {log.recipientName}
                          </span>
                          <span className="text-[11px] text-[#6C6C70] font-mono block">
                            {log.recipientPhone}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-xs text-[#1C1C1E] font-medium max-w-md">
                          <span className="line-clamp-2" title={log.message}>
                            {log.message}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-center text-xs font-semibold whitespace-nowrap">
                          {log.deliveryStatus === "DELIVERED" ? (
                            <span className="text-[#34C759]">&bull; Delivered</span>
                          ) : log.deliveryStatus === "FAILED" ? (
                            <span className="text-[#FF3B30]">&bull; Failed</span>
                          ) : (
                            <span className="text-[#FF9500]">&bull; {log.deliveryStatus}</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {/* Mobile Delivery Logs List (< 768px) */}
              <div className="block md:hidden divide-y divide-[#E5E5EA]">
                {isLoadingLogs ? (
                  <div className="py-12 text-center text-[#6C6C70]">
                    <div className="flex items-center justify-center gap-2">
                      <AppleSpinner size="sm" />
                      <span className="text-xs">Loading dispatches...</span>
                    </div>
                  </div>
                ) : logsList.length === 0 ? (
                  <div className="py-12 text-center text-[#8E8E93] text-xs px-4">
                    No transmission logs found matching your criteria.
                  </div>
                ) : (
                  logsList.map((log) => (
                    <div key={`mob-log-${log.id}`} className="p-3.5 space-y-1.5 hover:bg-[#F8F9FA] transition-colors">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 font-mono">
                          <span className="font-bold text-[#007AFF]">{log.accountNumber || "—"}</span>
                          <span className="text-[#8E8E93]">&bull;</span>
                          <span className="font-sans font-semibold text-[#1C1C1E]">{log.recipientName}</span>
                        </div>
                        <span className={`text-[11px] font-semibold shrink-0 ${
                          log.deliveryStatus === "DELIVERED"
                            ? "text-[#34C759]"
                            : log.deliveryStatus === "FAILED"
                            ? "text-[#FF3B30]"
                            : "text-[#FF9500]"
                        }`}>
                          &bull; {log.deliveryStatus === "DELIVERED" ? "Delivered" : log.deliveryStatus === "FAILED" ? "Failed" : log.deliveryStatus}
                        </span>
                      </div>

                      <p className="text-xs text-[#1C1C1E] line-clamp-2 leading-relaxed">
                        {log.message}
                      </p>

                      <div className="flex items-center justify-between text-[11px] text-[#6C6C70] font-mono pt-1">
                        <span>{log.recipientPhone}</span>
                        <span>{log.createdAtFormatted}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
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
      )}

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
                    Message Template &amp; Placeholders
                  </h3>
                  <p className="text-[11px] text-[#6C6C70]">
                    Customise the SMS notice text with property details and balance placeholders.
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
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowTemplateModal(false)}
                  className="border border-[#E5E5EA] bg-white text-[#1C1C1E] hover:bg-[#F2F2F7] font-medium h-8 px-3.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (activeTemplateType === "RECEIPT") {
                      setReceiptTemplate(DEFAULT_RECEIPT_NOTICE_TEMPLATE);
                    } else {
                      setMessageTemplate(FILTER_SMS_TEMPLATES[targetStatus] || FILTER_SMS_TEMPLATES.UNPAID);
                    }
                  }}
                  className="text-xs text-[#6C6C70] hover:text-[#007AFF] hover:underline font-medium cursor-pointer"
                >
                  Reset to Standard Default
                </button>
              </div>
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
            <h3 className="text-sm font-semibold text-[#1C1C1E]">
              {retryTargetJob ? "Authorize Rollout Retry Dispatch" : "Authorize Rollout Dispatch"}
            </h3>
            <p className="text-xs text-[#6C6C70]">
              {retryTargetJob ? (
                <>Retrying <span className="font-bold text-[#1C1C1E]">{retryTargetJob.count.toLocaleString()}</span> failed recipient{retryTargetJob.count === 1 ? '' : 's'} from Batch #{retryTargetJob.id.slice(0, 8)}.</>
              ) : (
                <>Targeting <span className="font-bold text-[#1C1C1E]">{effectiveRolloutCount.toLocaleString()}</span> properties {audienceScope === "SELECTED" ? "(manually selected)" : "matching active filter criteria"} with total outstanding due of <span className="font-bold text-[#1C1C1E]">{effectiveRolloutTotalDueFormatted}</span>.</>
              )}
            </p>
            
            {(() => {
              const targetCount = retryTargetJob ? retryTargetJob.count : effectiveRolloutCount;
              // Expand template with typical realistic variables to compute exact rendered GSM-7 length
              const sampleRendered = currentTemplate
                .replace(/{{municipality}}/g, "Kpone-Katamanso (KKMA)")
                .replace(/{{billYear}}/g, "2025")
                .replace(/{{ownerName}}/g, "MUNICIPAL RATEPAYER")
                .replace(/{{accountNumber}}|{{propertyAccounts}}/g, "KKMA-00123-2024")
                .replace(/{{totalAmountDue}}/g, "450.00")
                .replace(/{{arrears}}/g, "150.00")
                .replace(/{{currentFee}}/g, "300.00")
                .replace(/{{propertyGpsAddress}}/g, "GK-0123-4567")
                .replace(/{{dueDate}}/g, "30-Jun-2025")
                .replace(/{{link_assessment}}|{{billLink}}/g, "https://property-rate-app.vercel.app/b/ast_1234567890123456")
                .replace(/{{link_checkout}}|{{paymentLink}}/g, "https://property-rate-app.vercel.app/p/ckt_1234567890123456")
                .replace(/•/g, "-")
                .replace(/GH₵|₵/g, "GHS");

              const gsmLength = sampleRendered.length;
              // In pure GSM-7: single message is <= 160 chars; concatenated multi-part is 153 chars per segment
              const creditsPerMessage = gsmLength <= 160 ? 1 : Math.ceil(gsmLength / 153);
              const estCreditsNeeded = targetCount * creditsPerMessage;
              // Standard Arkesel rate in Ghana is ~0.040 GHS per SMS credit (including carrier and VAT)
              const estDispatchCostGhs = estCreditsNeeded * 0.04;
              const hasEnoughBalance = gatewayBalance ? gatewayBalance.smsBalance >= estCreditsNeeded : false;
              const isInsufficient = !!(gatewayBalance && !hasEnoughBalance);
              const isExceedingSafetyLimit = targetCount > 2500;
              const clientMode = typeof window !== "undefined" ? (localStorage.getItem("kkma_sms_dispatch_mode") as any) : undefined;
              const missingConfirmation = clientMode === "LIVE" && confirmText.trim().toUpperCase() !== "CONFIRM";
              const isButtonDisabled = Boolean(
                isAuthorizing || 
                !adminPassword.trim() || 
                isFetchingBalance || 
                isInsufficient || 
                isExceedingSafetyLimit || 
                missingConfirmation
              );

              return (
                <>
                  <div className="bg-[#F8F9FA] rounded-xl p-3.5 border border-[#E5E5EA] space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#6C6C70] font-medium">Gateway Balance (Arkesel):</span>
                      {isFetchingBalance ? (
                        <span className="text-[#007AFF] flex items-center gap-1.5"><AppleSpinner size="xs" /> Fetching...</span>
                      ) : gatewayBalance ? (
                        <span className="font-semibold text-[#34C759]">
                          {gatewayBalance.smsBalance.toLocaleString()} SMS ({gatewayBalance.mainBalance})
                        </span>
                      ) : (
                        <span className="text-[#FF3B30] font-semibold">Unavailable</span>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#6C6C70] font-medium">Est. Credits Needed:</span>
                      <span className={`font-semibold ${isInsufficient ? "text-[#FF3B30]" : "text-[#1C1C1E]"}`}>
                        {estCreditsNeeded.toLocaleString()} SMS ({creditsPerMessage} credits/msg)
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#6C6C70] font-medium">Est. Dispatch Cost:</span>
                      <span className="font-bold text-[#007AFF]">
                        {formatGhc(estDispatchCostGhs)}
                      </span>
                    </div>
                  </div>

                  {isInsufficient && (
                    <div className="bg-[#FF3B30]/10 border border-[#FF3B30]/30 text-[#FF3B30] px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 mt-4">
                      <span>⚠️</span>
                      Insufficient Arkesel balance. Need {estCreditsNeeded.toLocaleString()} SMS ({formatGhc(estDispatchCostGhs)}), but account has {gatewayBalance?.smsBalance.toLocaleString() ?? 0} SMS.
                    </div>
                  )}
                  {isExceedingSafetyLimit && (
                    <div className="bg-[#FF3B30]/10 border border-[#FF3B30]/30 text-[#FF3B30] px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 mt-4">
                      <span>⚠️</span>
                      Batch safety limit exceeded. You can only dispatch up to 2,500 messages per job to prevent gateway throttling. Please refine your audience filters.
                    </div>
                  )}

                  <div className="mt-4 space-y-4">
                    {clientMode === "LIVE" && (
                      <div>
                        <label className="block text-[#1C1C1E] font-medium text-xs mb-1.5">Type CONFIRM to proceed</label>
                        <input
                          type="text"
                          value={confirmText}
                          onChange={(e) => setConfirmText(e.target.value)}
                          placeholder="CONFIRM"
                          className="w-full h-9 px-3 rounded-lg border border-[#E5E5EA] bg-[#F2F2F7] text-xs text-[#1C1C1E] focus:outline-none focus:border-[#007AFF] focus:bg-white mb-3 uppercase"
                        />
                      </div>
                    )}
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
                        onClick={() => {
                          setShowAuthModal(false);
                          setRetryTargetJob(null);
                          setConfirmText("");
                        }}
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
                        {isAuthorizing ? <AppleSpinner size="xs" /> : <Lock className="w-3.5 h-3.5" />}
                        <span>{retryTargetJob ? "Authorize & Retry" : "Authorize & Dispatch"}</span>
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