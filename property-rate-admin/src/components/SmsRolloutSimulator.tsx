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
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
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
import { MessageTemplateModal, MessageTemplatePreset } from "@/components/MessageTemplateModal";
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
  const [batchSearchQuery, setBatchSearchQuery] = useState("");

  const filteredRolloutJobs = useMemo(() => {
    if (!batchSearchQuery.trim()) return rolloutJobs;
    const q = batchSearchQuery.toLowerCase();
    return rolloutJobs.filter((job) =>
      job.id.toLowerCase().includes(q) ||
      (job.mode && job.mode.toLowerCase().includes(q)) ||
      (job.createdAtFormatted && job.createdAtFormatted.toLowerCase().includes(q))
    );
  }, [rolloutJobs, batchSearchQuery]);

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

  // Applied Required Fields state vs Draft Apple HIG Bottom Sheet State
  const [requiredFields, setRequiredFields] = useState<string[]>([]);
  const [draftRequiredFields, setDraftRequiredFields] = useState<string[]>([]);
  const [showFieldsFilter, setShowFieldsFilter] = useState(false);
  const [fieldsSearchQuery, setFieldsSearchQuery] = useState("");
  const [showSelectMenu, setShowSelectMenu] = useState(false);

  const fieldsFilterRef = useRef<HTMLDivElement>(null);
  const fieldsFilterBtnRef = useRef<HTMLButtonElement>(null);
  const selectMenuRef = useRef<HTMLDivElement>(null);

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

  // Group fields by category following Apple HIG layout specification
  const groupedFields = useMemo(() => {
    const CATEGORY_ORDER = ["Location", "Identification", "Financial", "Contact", "Profile", "Classification"];
    const groups: { category: string; fields: typeof availableFieldFilters }[] = [];
    const categoryMap = new Map<string, typeof availableFieldFilters>();

    for (const cat of CATEGORY_ORDER) {
      categoryMap.set(cat, []);
    }

    for (const field of filteredAvailableFields) {
      if (!categoryMap.has(field.category)) {
        categoryMap.set(field.category, []);
      }
      categoryMap.get(field.category)!.push(field);
    }

    for (const [category, fields] of categoryMap.entries()) {
      if (fields.length > 0) {
        groups.push({ category, fields });
      }
    }
    return groups;
  }, [filteredAvailableFields]);

  const handleOpenFieldsFilter = () => {
    setDraftRequiredFields(requiredFields);
    setShowFieldsFilter(true);
    setShowSelectMenu(false);
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
    setShowSelectMenu(false);
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
        showSelectMenu &&
        selectMenuRef.current &&
        !selectMenuRef.current.contains(e.target as Node)
      ) {
        setShowSelectMenu(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showSelectMenu) {
          setShowSelectMenu(false);
        } else if (showFieldsFilter) {
          setShowFieldsFilter(false);
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showSelectMenu, showFieldsFilter]);

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

  // Ratepayer Hierarchical Portfolio Grouping (Persisted)
  const [isHierarchicalView, setIsHierarchicalView] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("kkma_sms_hierarchical_view");
        if (saved !== null) return saved === "true";
      } catch {}
    }
    return true;
  });

  const handleToggleHierarchicalView = () => {
    setIsHierarchicalView((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("kkma_sms_hierarchical_view", String(next));
      } catch {}
      return next;
    });
  };
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

  const [savedTemplates, setSavedTemplates] = useState<MessageTemplatePreset[]>(
    DEFAULT_SAVED_TEMPLATES as MessageTemplatePreset[]
  );

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

      let customPresets: any[] = [];
      try {
        customPresets = JSON.parse(localStorage.getItem("kkma_sms_custom_presets") || "[]");
      } catch {}

      setSavedTemplates([...customPresets, ...hydratedPresets]);

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
      {/* SMS SUBNAVIGATION TAB STRIP (Figma SMS Section Switcher) */}
      <div className="w-full bg-[#F2F2F7] sm:bg-white border-b border-[#DDE2E8] px-4 py-2 sm:py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0 z-10">
        <div className="w-full max-w-[361px] sm:max-w-md mx-auto sm:mx-0 h-[42px] bg-[#E8EBF0] p-[3px] rounded-[10px] flex items-center gap-[3px] shrink-0">
          <button
            type="button"
            onClick={() => handleActiveViewChange("SIMULATOR")}
            className={`flex-1 h-[36px] flex items-center justify-center rounded-[8px] text-[13px] transition-all cursor-pointer ${
              activeView === "SIMULATOR"
                ? "bg-[#FFFFFF] text-[#155DAA] font-semibold shadow-xs"
                : "bg-transparent text-[#596575] font-medium hover:text-[#182331]"
            }`}
          >
            <span>Rollout</span>
          </button>
          <button
            type="button"
            onClick={() => handleActiveViewChange("BATCHES")}
            className={`flex-1 h-[36px] flex items-center justify-center rounded-[8px] text-[13px] transition-all cursor-pointer ${
              activeView === "BATCHES"
                ? "bg-[#FFFFFF] text-[#155DAA] font-semibold shadow-xs"
                : "bg-transparent text-[#596575] font-medium hover:text-[#182331]"
            }`}
          >
            <span>Batches</span>
          </button>
          <button
            type="button"
            onClick={() => handleActiveViewChange("LOGS")}
            className={`flex-1 h-[36px] flex items-center justify-center rounded-[8px] text-[13px] transition-all cursor-pointer ${
              activeView === "LOGS"
                ? "bg-[#FFFFFF] text-[#155DAA] font-semibold shadow-xs"
                : "bg-transparent text-[#596575] font-medium hover:text-[#182331]"
            }`}
          >
            <span>Logs</span>
          </button>
        </div>

        {/* Live Gateway Balance Widget */}
        <div className="hidden sm:flex items-center gap-2 text-xs py-1">
          <span className="text-[12px] text-[#596575]">
            Gateway Credit:{" "}
            <span className="font-semibold text-[#182331] tabular-nums">
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
              <div className="shrink-0 space-y-3 relative z-20 p-3.5 sm:p-4 border-b border-[#DDE2E8] bg-white">
                {/* Row 1: Field filters | Reset | Unpaid only Toggle (Strictly Single Row) */}
                <div className="flex items-center justify-between gap-2 w-full">
                  <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                    {/* FIELDS FILTER TRIGGER & CONTAINER */}
                    <div className="relative shrink-0 z-50 isolate">
                      <button
                        ref={fieldsFilterBtnRef}
                        type="button"
                        onClick={handleOpenFieldsFilter}
                        className={`h-[34px] sm:h-[36px] px-2.5 sm:px-3 rounded-[10px] text-[12px] sm:text-[13px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                          requiredFields.length > 0
                            ? "bg-[#155DAA] text-white shadow-xs"
                            : "bg-[#EAF2FC] text-[#155DAA] hover:bg-[#D5E6F9]"
                        }`}
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                        <span className="truncate">Fields</span>
                        {requiredFields.length > 0 && (
                          <span className="font-semibold text-[11px] sm:text-xs tabular-nums">
                            ({requiredFields.length})
                          </span>
                        )}
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform shrink-0 ${showFieldsFilter ? "rotate-180" : ""}`} />
                      </button>

                      {/* APPLE HIG BOTTOM SHEET MODAL */}
                      {showFieldsFilter &&
                        typeof document !== "undefined" &&
                        createPortal(
                          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
                            {/* Backdrop */}
                            <div
                              onClick={() => setShowFieldsFilter(false)}
                              className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
                            />

                            {/* Native Bottom Sheet Container */}
                            <div
                              ref={fieldsFilterRef}
                              className="relative z-10 w-full sm:max-w-[480px] h-[82vh] sm:h-[640px] max-h-[90vh] bg-[#F2F2F7] dark:bg-black rounded-t-[20px] sm:rounded-[20px] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-200"
                            >
                              {/* System Grabber */}
                              <div className="w-full flex justify-center pt-2.5 pb-1 shrink-0">
                                <div className="w-9 h-1 rounded-full bg-[#D1D1D6] dark:bg-[#48484A]" />
                              </div>

                              {/* Navigation Bar */}
                              <div className="h-[48px] px-4 flex items-center justify-between shrink-0">
                                {/* Left: Cancel */}
                                <button
                                  type="button"
                                  onClick={() => setShowFieldsFilter(false)}
                                  className="text-[#007AFF] dark:text-[#0A84FF] text-[17px] font-normal hover:opacity-70 active:opacity-40 transition-opacity cursor-pointer"
                                >
                                  Cancel
                                </button>

                                {/* Center: Title & Count Subtitle */}
                                <div className="flex flex-col items-center justify-center text-center px-2 min-w-0">
                                  <span className="text-[17px] font-semibold text-black dark:text-white leading-tight truncate">
                                    Required Fields
                                  </span>
                                  <span className="text-[12px] text-[#8E8E93] dark:text-[#98989D] leading-tight">
                                    {draftRequiredFields.length} of {availableFieldFilters.length} selected
                                  </span>
                                </div>

                                {/* Right: More Menu & Done */}
                                <div className="flex items-center gap-2.5">
                                  {/* Overflow Selection Options Menu */}
                                  <div className="relative" ref={selectMenuRef}>
                                    <button
                                      type="button"
                                      onClick={() => setShowSelectMenu((prev) => !prev)}
                                      className="p-1 rounded-full text-[#007AFF] dark:text-[#0A84FF] hover:bg-black/5 dark:hover:bg-white/10 active:opacity-40 transition-colors cursor-pointer"
                                      aria-label="More selection options"
                                    >
                                      <MoreHorizontal className="w-5 h-5" />
                                    </button>

                                    {showSelectMenu && (
                                      <div className="absolute right-0 top-full mt-1.5 w-44 bg-white/95 dark:bg-[#2C2C2E]/95 backdrop-blur-xl rounded-[14px] shadow-lg border border-black/10 dark:border-white/10 py-1 z-50 text-[14px]">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            handleSelectAllFields();
                                            setShowSelectMenu(false);
                                          }}
                                          className="w-full text-left px-3.5 py-2 text-black dark:text-white hover:bg-[#007AFF] hover:text-white transition-colors cursor-pointer"
                                        >
                                          Select All
                                        </button>
                                        <div className="h-px bg-black/5 dark:bg-white/10 mx-2" />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            handleClearAllFields();
                                            setShowSelectMenu(false);
                                          }}
                                          className="w-full text-left px-3.5 py-2 text-black dark:text-white hover:bg-[#007AFF] hover:text-white transition-colors cursor-pointer"
                                        >
                                          Deselect All
                                        </button>
                                      </div>
                                    )}
                                  </div>

                                  {/* Done Action */}
                                  <button
                                    type="button"
                                    onClick={handleApplyFieldsFilter}
                                    className="text-[#007AFF] dark:text-[#0A84FF] text-[17px] font-semibold hover:opacity-70 active:opacity-40 transition-opacity cursor-pointer"
                                  >
                                    Done
                                  </button>
                                </div>
                              </div>

                              {/* Search Bar */}
                              <div className="px-4 pb-2.5 shrink-0">
                                <div className="relative flex items-center">
                                  <Search className="w-4 h-4 text-[#8E8E93] dark:text-[#98989D] absolute left-3 pointer-events-none" />
                                  <input
                                    type="text"
                                    value={fieldsSearchQuery}
                                    onChange={(e) => setFieldsSearchQuery(e.target.value)}
                                    placeholder="Search"
                                    autoComplete="off"
                                    spellCheck={false}
                                    className="w-full h-[36px] pl-9 pr-8 rounded-[10px] bg-[#E5E5EA] dark:bg-[#1C1C1E] text-[15px] text-black dark:text-white placeholder-[#8E8E93] dark:placeholder-[#98989D] focus:outline-none transition-colors"
                                  />
                                  {fieldsSearchQuery && (
                                    <button
                                      type="button"
                                      onClick={() => setFieldsSearchQuery("")}
                                      className="absolute right-2.5 p-0.5 rounded-full bg-[#8E8E93] dark:bg-[#636366] text-white hover:opacity-80 transition-opacity cursor-pointer"
                                      aria-label="Clear search"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Inset Grouped List with Zero Scrollbar Tracks */}
                              <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                                {/* Section 1: RECOMMENDED PRESET */}
                                {(!fieldsSearchQuery || "recommended sms preset".includes(fieldsSearchQuery.toLowerCase())) && (
                                  <div>
                                    <div className="px-4 pb-1.5 text-[12px] font-normal tracking-tight text-[#8E8E93] dark:text-[#98989D] uppercase">
                                      Recommended
                                    </div>
                                    <div className="bg-white dark:bg-[#1C1C1E] rounded-[12px] overflow-hidden">
                                      <button
                                        type="button"
                                        onClick={handleResetDefaultFields}
                                        className="w-full min-h-[44px] px-4 py-2.5 flex items-center justify-between text-left hover:bg-black/5 dark:hover:bg-white/5 active:bg-black/10 transition-colors cursor-pointer"
                                      >
                                        <div className="flex flex-col pr-2 min-w-0">
                                          <span className="text-[16px] text-black dark:text-white font-normal">
                                            Use SMS preset
                                          </span>
                                          <span className="text-[12px] text-[#8E8E93] dark:text-[#98989D]">
                                            Selects phone, name, and address
                                          </span>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-[#C7C7CC] dark:text-[#48484A] shrink-0" />
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {/* Category Sections */}
                                {groupedFields.map((group) => (
                                  <div key={group.category}>
                                    <div className="px-4 pb-1.5 text-[12px] font-normal tracking-tight text-[#8E8E93] dark:text-[#98989D] uppercase">
                                      {group.category}
                                    </div>
                                    <div className="bg-white dark:bg-[#1C1C1E] rounded-[12px] overflow-hidden">
                                      {group.fields.map((field, idx) => {
                                        const isSelected = draftRequiredFields.includes(field.key);
                                        const isLast = idx === group.fields.length - 1;
                                        return (
                                          <div key={field.key} className="relative">
                                            <button
                                              type="button"
                                              onClick={() => handleToggleDraftField(field.key)}
                                              className="w-full min-h-[44px] px-4 py-3 flex items-center justify-between text-left active:bg-black/5 dark:active:bg-white/5 transition-colors cursor-pointer"
                                            >
                                              <span className="text-[16px] text-black dark:text-white font-normal truncate pr-3">
                                                {field.label}
                                              </span>
                                              {isSelected && (
                                                <Check className="w-5 h-5 text-[#007AFF] dark:text-[#0A84FF] shrink-0 stroke-[2.5]" />
                                              )}
                                            </button>
                                            {!isLast && (
                                              <div className="ml-4 h-px bg-[#E5E5EA] dark:bg-[#38383A]" />
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}

                                {/* Empty Search Results State */}
                                {groupedFields.length === 0 && (
                                  <div className="text-center py-12 text-[#8E8E93] dark:text-[#98989D] text-[15px]">
                                    No fields found for &ldquo;{fieldsSearchQuery}&rdquo;
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>,
                          document.body
                        )}
                    </div>

                    {/* Template Action (Moved to top row beside Fields) */}
                    <button
                      type="button"
                      onClick={() => setShowTemplateModal(true)}
                      className="h-[34px] sm:h-[36px] px-2.5 sm:px-3 rounded-[10px] text-[12px] sm:text-[13px] font-semibold text-[#155DAA] bg-[#EAF2FC] hover:bg-[#D5E6F9] transition-colors cursor-pointer shrink-0 flex items-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">Template</span>
                    </button>
                  </div>

                  {/* Unpaid balances filter toggle (Single-line compact Apple switch, clean borderless) */}
                  <div
                    onClick={() => handleStatusChange(targetStatus === "UNPAID" ? "ALL" : "UNPAID")}
                    className="h-[34px] sm:h-[36px] px-1 flex items-center gap-2 sm:gap-2.5 cursor-pointer select-none shrink-0"
                  >
                    <span className="text-[12px] sm:text-[13px] font-medium text-[#182331] whitespace-nowrap">Unpaid only</span>
                    <div
                      className={`w-[36px] sm:w-[42px] h-[22px] sm:h-[26px] flex items-center rounded-full p-[2px] transition-colors duration-200 ease-in-out ${
                        targetStatus === "UNPAID" ? "bg-[#34C759]" : "bg-[#E8EBF0]"
                      }`}
                    >
                      <div
                        className={`bg-white w-[18px] sm:w-[22px] h-[18px] sm:h-[22px] rounded-full shadow-xs border border-black/5 transform transition-transform duration-200 ease-in-out ${
                          targetStatus === "UNPAID" ? "translate-x-[14px] sm:translate-x-[16px]" : "translate-x-0"
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {/* Search & Send SMS Action (Outer container removed, Send SMS floated to right of search field) */}
                <div className="flex items-center gap-2 w-full">
                  {/* Search Field */}
                  <div className="relative flex-1 h-[36px] sm:h-[38px] bg-[#F2F2F7] rounded-[10px] flex items-center px-3 gap-2">
                    <Search className="w-4 h-4 text-[#596575] shrink-0" />
                    <input
                      type="text"
                      value={accountSearchQuery}
                      onChange={(e) => setAccountSearchQuery(e.target.value)}
                      placeholder="Account, name, phone or location"
                      autoComplete="off"
                      spellCheck={false}
                      className="w-full h-full bg-transparent text-[13px] sm:text-[14px] text-[#182331] placeholder-[#8E8E93] focus:outline-none"
                    />
                    {accountSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setAccountSearchQuery("")}
                        className="text-[#8E8E93] hover:text-[#182331] p-0.5 cursor-pointer shrink-0"
                        title="Clear search"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Send SMS Button floated to right side of search field */}
                  <button
                    type="button"
                    onClick={handleOpenAuthModal}
                    disabled={isProcessing || effectiveRolloutCount === 0}
                    className="h-[36px] sm:h-[38px] px-3.5 sm:px-4 rounded-[10px] bg-[#155DAA] hover:bg-[#114B8B] text-white text-[12px] sm:text-[13px] font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all shadow-xs shrink-0"
                  >
                    <Send className="w-3.5 h-3.5 shrink-0" />
                    <span className="whitespace-nowrap">{isProcessing ? "Sending..." : "Send SMS"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Matched Audience Rollout Queue Table / Cards (Consumes All Vertical Space) */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white">

              {/* Audience Table Container */}
              <div
                ref={tableContainerRef}
                onScroll={onTableScroll}
                className="flex-1 min-h-0 overflow-auto [overflow-anchor:auto] [isolation:isolate]"
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

                {/* Mobile Matched Audience Cards (< 768px) (Figma Screen 1) */}
                <div className="block md:hidden p-3.5 space-y-2.5 bg-[#F2F2F7]">
                  {isLoadingAudience ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <div key={`mob-aud-skel-${i}`} className="p-3.5 space-y-2 bg-white rounded-[14px] border border-[#DDE2E8] animate-pulse">
                        <div className="flex items-center justify-between">
                          <div className="h-4 w-28 bg-[#E8EBF0] rounded" />
                          <div className="h-4 w-20 bg-[#E8EBF0] rounded" />
                        </div>
                        <div className="h-3.5 w-40 bg-[#E8EBF0] rounded" />
                        <div className="h-3 w-48 bg-[#E8EBF0] rounded" />
                        <div className="flex items-center justify-between pt-1">
                          <div className="h-3 w-28 bg-[#E8EBF0] rounded" />
                          <div className="h-4 w-16 bg-[#E8EBF0] rounded" />
                        </div>
                      </div>
                    ))
                  ) : liveAudience.length === 0 ? (
                    <div className="py-12 px-4 text-center text-[#596575] italic text-xs bg-white rounded-[14px] border border-[#DDE2E8]">
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
                          <div key={`mob-grp-${group.key}`} className="bg-white rounded-[14px] border border-[#DDE2E8] p-3.5 space-y-2.5">
                            {/* Portfolio Header Card */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
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
                                  className="w-4 h-4 rounded border-[#C7C7CC] text-[#155DAA] accent-[#155DAA] cursor-pointer shrink-0"
                                />
                                <span className="font-bold text-xs text-[#182331] uppercase truncate">
                                  {group.ownerName}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-sm font-bold text-[#182331] tabular-nums">
                                  {formatGhc(group.totalAmountDue)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => toggleGroupCollapse(group.key)}
                                  className="p-1 text-[#596575] hover:text-[#182331] cursor-pointer"
                                  aria-label={isExpanded ? "Collapse portfolio" : "Expand portfolio"}
                                >
                                  <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                                </button>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 text-[11px] text-[#596575] flex-wrap">
                              <span className="font-semibold text-[#155DAA]">{group.properties.length} Properties</span>
                            </div>

                            {/* Nested Property Cards */}
                            {isExpanded && (
                              <div className="space-y-2 pt-2 border-t border-[#E8EBF0]">
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
                                      className={`p-3 rounded-[10px] border transition-colors cursor-pointer space-y-1.5 ${
                                        isSelected ? "bg-[#EAF2FC] border-[#155DAA]" : "bg-[#F8F9FA] border-[#DDE2E8] hover:bg-white"
                                      }`}
                                    >
                                      {/* Row 1: Checkbox + Account No + Total Due */}
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <input
                                            type="checkbox"
                                            checked={isSelected}
                                            readOnly
                                            className="w-3.5 h-3.5 rounded border-[#C7C7CC] text-[#155DAA] accent-[#155DAA] pointer-events-none shrink-0"
                                          />
                                          <span className="font-mono text-xs font-bold text-[#155DAA] truncate">
                                            {cleanDash(prop.accountNumber)}
                                          </span>
                                        </div>
                                        <span className="text-xs font-bold text-[#182331] tabular-nums shrink-0">
                                          {formatGhc(prop.totalAmountDue)}
                                        </span>
                                      </div>

                                      {/* Row 2: GPS Address */}
                                      {(prop.ownerDigitalAddress || (prop as any).gpsAddress) && (
                                        <div className="text-[11px] text-[#596575] font-mono truncate" title={cleanDash(prop.ownerDigitalAddress || (prop as any).gpsAddress)}>
                                          {cleanDash(prop.ownerDigitalAddress || (prop as any).gpsAddress)}
                                        </div>
                                      )}

                                      {/* Row 3: Status Indicator */}
                                      <div className="pt-0.5 flex items-center">
                                        {prop.totalAmountDue > 0 ? (
                                          <span className="text-[11px] font-semibold text-[#B42332] flex items-center gap-1">
                                            &bull; Balance Due
                                          </span>
                                        ) : (
                                          <span className="text-[11px] font-semibold text-[#187444] flex items-center gap-1">
                                            &bull; Paid
                                          </span>
                                        )}
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
                          className={`bg-white rounded-[14px] border transition-all cursor-pointer p-3.5 space-y-2 ${
                            isSelected ? "border-[#155DAA] ring-1 ring-[#155DAA]/20" : "border-[#DDE2E8] hover:border-[#B5C2D1]"
                          }`}
                        >
                          {/* Row 1: Checkbox + Account No + Balance Due */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                readOnly
                                className="w-4 h-4 rounded border-[#C7C7CC] text-[#155DAA] accent-[#155DAA] pointer-events-none shrink-0"
                              />
                              <span className="font-mono text-xs font-bold text-[#155DAA] truncate">
                                {cleanDash(prop.accountNumber)}
                              </span>
                            </div>
                            <span className="text-sm font-bold text-[#182331] tabular-nums shrink-0">
                              {formatGhc(prop.totalAmountDue)}
                            </span>
                          </div>

                          {/* Row 2: Owner Name */}
                          <div className="text-xs font-bold text-[#182331] uppercase truncate">
                            {cleanDash(prop.ownerName)}
                          </div>

                          {/* Row 3: GPS Address */}
                          {(prop.ownerDigitalAddress || (prop as any).gpsAddress) && (
                            <div className="text-[11px] text-[#596575] font-mono truncate" title={cleanDash(prop.ownerDigitalAddress || (prop as any).gpsAddress)}>
                              {cleanDash(prop.ownerDigitalAddress || (prop as any).gpsAddress)}
                            </div>
                          )}

                          {/* Row 4: Status Indicator */}
                          <div className="pt-0.5 flex items-center">
                            {prop.totalAmountDue > 0 ? (
                              <span className="text-[11px] font-semibold text-[#B42332] flex items-center gap-1">
                                &bull; Balance Due
                              </span>
                            ) : (
                              <span className="text-[11px] font-semibold text-[#187444] flex items-center gap-1">
                                &bull; Paid
                              </span>
                            )}
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
                          className={`bg-white rounded-[14px] border transition-all cursor-pointer p-3.5 space-y-2 ${
                            isSelected ? "border-[#155DAA] ring-1 ring-[#155DAA]/20" : "border-[#DDE2E8] hover:border-[#B5C2D1]"
                          }`}
                        >
                          {/* Row 1: Checkbox + Account No + Balance Due */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                readOnly
                                className="w-4 h-4 rounded border-[#C7C7CC] text-[#155DAA] accent-[#155DAA] pointer-events-none shrink-0"
                              />
                              <span className="font-mono text-xs font-bold text-[#155DAA] truncate">
                                {cleanDash(prop.accountNumber)}
                              </span>
                            </div>
                            <span className="text-sm font-bold text-[#182331] tabular-nums shrink-0">
                              {formatGhc(prop.totalAmountDue)}
                            </span>
                          </div>

                          {/* Row 2: Owner Name */}
                          <div className="text-xs font-bold text-[#182331] uppercase truncate">
                            {cleanDash(prop.ownerName)}
                          </div>

                          {/* Row 3: GPS Address */}
                          {(prop.ownerDigitalAddress || (prop as any).gpsAddress) && (
                            <div className="text-[11px] text-[#596575] font-mono truncate" title={cleanDash(prop.ownerDigitalAddress || (prop as any).gpsAddress)}>
                              {cleanDash(prop.ownerDigitalAddress || (prop as any).gpsAddress)}
                            </div>
                          )}

                          {/* Row 4: Status Indicator */}
                          <div className="pt-0.5 flex items-center">
                            {prop.totalAmountDue > 0 ? (
                              <span className="text-[11px] font-semibold text-[#B42332] flex items-center gap-1">
                                &bull; Balance Due
                              </span>
                            ) : (
                              <span className="text-[11px] font-semibold text-[#187444] flex items-center gap-1">
                                &bull; Paid
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}

                </div>
              </div>

              {/* Native iOS Pagination Footer for Mobile (< 768px, Static at Bottom - Payments Screen Inspo) */}
              <div className="md:hidden shrink-0 border-t border-[#E8E8ED] bg-white px-4 py-2.5 flex items-center justify-between text-xs text-[#596575] font-medium z-10">
                <span className="text-xs text-[#6E6E73]">
                  Page <strong className="text-[#182331] font-semibold">{audiencePage}</strong> of {Math.max(1, Math.ceil(totalAudienceCount / audienceLimit))}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={audiencePage <= 1}
                    onClick={() => handleAudiencePageChange(audiencePage - 1)}
                    className="px-2.5 py-1 rounded-[8px] border border-[#DDE2E8] bg-white text-xs font-medium text-[#182331] hover:bg-[#F2F2F7] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={audiencePage >= Math.max(1, Math.ceil(totalAudienceCount / audienceLimit))}
                    onClick={() => handleAudiencePageChange(audiencePage + 1)}
                    className="px-2.5 py-1 rounded-[8px] border border-[#DDE2E8] bg-white text-xs font-medium text-[#182331] hover:bg-[#F2F2F7] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>

              {/* Supabase Studio-Style Table Pagination Bar (Desktop >= 768px) */}
              <div className="hidden md:block shrink-0">
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
        </div>
      )}

      {/* PANE 2: ROLLOUT BATCHES & RETRY QUEUE (Figma Screen 2) */}
      {activeView === "BATCHES" && (
        <div className="w-full h-full flex flex-col overflow-hidden bg-[#F2F2F7] border-0 rounded-none shadow-none">
          {/* Top Search Bar */}
          <div className="p-3.5 sm:p-4 bg-white border-b border-[#DDE2E8] shrink-0">
            <div className="relative w-full h-[40px] bg-[#E8EBF0] rounded-[10px] flex items-center px-3.5 gap-2">
              <Search className="w-4 h-4 text-[#596575] shrink-0" />
              <input
                type="text"
                value={batchSearchQuery}
                onChange={(e) => setBatchSearchQuery(e.target.value)}
                placeholder="Search batches"
                autoComplete="off"
                spellCheck={false}
                className="w-full h-full bg-transparent text-[14px] text-[#182331] placeholder-[#596575] focus:outline-none"
              />
              {batchSearchQuery && (
                <button
                  type="button"
                  onClick={() => setBatchSearchQuery("")}
                  className="text-[#596575] hover:text-[#182331] p-1 cursor-pointer shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div onScroll={onTableScroll} className="flex-1 min-h-0 min-h-[calc(100dvh-13rem)] overflow-auto [overflow-anchor:auto] [isolation:isolate]">
            {filteredRolloutJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-[#596575] text-xs space-y-2 p-4">
                {isLoadingJobs ? (
                  <>
                    <AppleSpinner size="sm" className="text-[#155DAA]" />
                    <span>Loading rollout batches...</span>
                  </>
                ) : (
                  <>
                    <History className="w-8 h-8 text-[#596575] stroke-[1.5]" />
                    <span className="font-medium">
                      {batchSearchQuery ? "No batches match your search." : "No batch rollouts dispatched yet."}
                    </span>
                    {!batchSearchQuery && (
                      <button
                        type="button"
                        onClick={() => handleActiveViewChange("SIMULATOR")}
                        className="text-xs text-[#155DAA] hover:underline cursor-pointer"
                      >
                        Go to Rollout Engine to launch a campaign
                      </button>
                    )}
                  </>
                )}
              </div>
            ) : (
              <>
                {/* Desktop Batches Table (>= 768px) */}
                <table className="hidden md:table min-w-[800px] w-full text-left text-xs border-collapse font-sans bg-white">
                  <thead className="border-b text-[#596575] sticky top-0 bg-[#F8F9FA] border-[#DDE2E8] z-10 font-semibold">
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
                  <tbody className="divide-y divide-[#DDE2E8]">
                    {filteredRolloutJobs.map((job) => {
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
                          <td className="py-2.5 px-3 text-xs font-medium text-[#182331] whitespace-nowrap">
                            {job.createdAtFormatted}
                          </td>
                          <td className="py-2.5 px-3 text-[11px] font-mono font-bold text-[#155DAA] whitespace-nowrap">
                            {job.id}
                          </td>
                          <td className="py-2.5 px-3 text-xs whitespace-nowrap">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-[4px] ${
                              job.mode === "LIVE" ? "text-[#955B08] bg-[#FFF3DE]" : "text-[#596575] bg-[#E8EBF0]"
                            }`}>
                              {job.mode}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <div className="flex flex-col gap-1 min-w-[140px] max-w-[200px]">
                              <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-[#182331]">
                                <span className="flex items-center gap-1.5">
                                  {isRunning && <AppleSpinner size="xs" />}
                                  <span>{sent} / {total}</span>
                                </span>
                                <span className="text-[#596575] font-semibold">{pct}%</span>
                              </div>
                              <div className="w-full bg-[#E8EBF0] rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="h-full bg-[#187444] rounded-full transition-all duration-300 ease-out"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {job.failedCount > 0 ? (
                              <span className="inline-block text-[10px] font-bold text-[#B42332] bg-[#FCEDEF] px-2 py-0.5 rounded-[4px]">
                                {job.failedCount} Failed ({job.failedAccountCount} accounts)
                              </span>
                            ) : (
                              <span className="text-xs font-medium text-[#187444]">
                                &bull; 0 Failed
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap font-medium text-xs">
                            {effectiveStatus === "DONE" ? (
                              job.failedCount > 0 ? (
                                <span className="text-[#955B08] font-semibold flex items-center gap-1">
                                  &bull; Partial
                                </span>
                              ) : (
                                <span className="text-[#187444] font-semibold flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Done
                                </span>
                              )
                            ) : isRunning ? (
                              <span className="text-[#155DAA] font-semibold flex items-center gap-1.5">
                                <AppleSpinner size="xs" />
                                <span>Running</span>
                              </span>
                            ) : isQueued ? (
                              <span className="text-[#596575] font-semibold flex items-center gap-1.5">
                                <AppleSpinner size="xs" />
                                <span>Queued</span>
                              </span>
                            ) : effectiveStatus === "FAILED" ? (
                              <span className="text-[#B42332] font-semibold">
                                &bull; Failed
                              </span>
                            ) : (
                              <span className="text-[#596575]">
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
                                className="bg-[#EAF2FC] text-[#155DAA] font-semibold text-xs rounded-lg px-3 py-1.5 inline-flex items-center gap-1.5 hover:bg-[#D5E5F9] cursor-pointer transition-colors disabled:opacity-50"
                                title="Dispatch only to recipients who did not receive the SMS"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Retry Failed ({job.failedAccountCount})</span>
                              </button>
                            ) : (
                              <span className="text-xs text-[#596575]">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Mobile Rollout Batches List (< 768px) (Figma Screen 2) */}
                <div className="block md:hidden p-3.5 space-y-3 bg-[#F2F2F7]">
                  {filteredRolloutJobs.map((job) => {
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
                      <div key={`mob-job-${job.id}`} className="bg-white rounded-[14px] border border-[#DDE2E8] p-4 space-y-3 shadow-none">
                        {/* Top Row: Job ID + Mode Badge */}
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-[#155DAA]">{job.id}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-[4px] ${
                            job.mode === "LIVE" ? "text-[#955B08] bg-[#FFF3DE]" : "text-[#596575] bg-[#E8EBF0]"
                          }`}>
                            {job.mode}
                          </span>
                        </div>

                        {/* Timestamp */}
                        <div className="text-[11px] text-[#596575] font-mono">{job.createdAtFormatted}</div>

                        {/* Progress Row */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs font-mono">
                            <span className="flex items-center gap-1.5 font-bold text-[#182331]">
                              {isRunning && <AppleSpinner size="xs" />}
                              <span>{sent} / {total} dispatched</span>
                            </span>
                            <span className="font-bold text-[#596575]">{pct}%</span>
                          </div>
                          <div className="w-full bg-[#E8EBF0] rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-full bg-[#187444] rounded-full transition-all duration-300 ease-out"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>

                        {/* Status & Retry Footer */}
                        <div className="flex items-center justify-between pt-1">
                          <div>
                            {effectiveStatus === "FAILED" || job.failedCount > 0 ? (
                              <span className="inline-block text-[10px] font-bold text-[#B42332] bg-[#FCEDEF] px-2 py-0.5 rounded-[4px]">
                                {job.failedCount} Failed
                              </span>
                            ) : (
                              <span className="inline-block text-[10px] font-bold text-[#187444] bg-[#EAF7EF] px-2 py-0.5 rounded-[4px]">
                                Completed
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
                              className="bg-[#EAF2FC] text-[#155DAA] font-semibold text-xs rounded-lg px-3 py-1.5 flex items-center gap-1.5 hover:bg-[#D5E5F9] cursor-pointer active:scale-95 transition-all"
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

      {/* PANE 3: DELIVERY LOGS (Figma Screen 3) */}
      {activeView === "LOGS" && (
        <div className="w-full h-full flex flex-col min-h-0 p-0 overflow-hidden relative bg-[#F2F2F7]">
          <div className="h-full flex flex-col overflow-hidden bg-[#F2F2F7] border-0 rounded-none shadow-none">
            {/* Header: Segmented Filter & Search */}
            <div className="p-3.5 sm:p-4 bg-white border-b border-[#DDE2E8] space-y-3 shrink-0">
              {/* Segmented Control [ All | Delivered | Failed ] */}
              <div className="bg-[#E8EBF0] p-[3px] rounded-[10px] flex items-center">
                <button
                  type="button"
                  onClick={() => handleLogsStatusFilterChange("ALL")}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-[7px] text-center transition-all cursor-pointer ${
                    logsStatusFilter === "ALL"
                      ? "bg-white text-[#155DAA] shadow-xs"
                      : "text-[#596575] hover:text-[#182331]"
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => handleLogsStatusFilterChange("DELIVERED")}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-[7px] text-center transition-all cursor-pointer ${
                    logsStatusFilter === "DELIVERED"
                      ? "bg-white text-[#155DAA] shadow-xs"
                      : "text-[#596575] hover:text-[#182331]"
                  }`}
                >
                  Delivered
                </button>
                <button
                  type="button"
                  onClick={() => handleLogsStatusFilterChange("FAILED")}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-[7px] text-center transition-all cursor-pointer ${
                    logsStatusFilter === "FAILED"
                      ? "bg-white text-[#155DAA] shadow-xs"
                      : "text-[#596575] hover:text-[#182331]"
                  }`}
                >
                  Failed
                </button>
              </div>

              {/* Search Input */}
              <div className="relative w-full h-[40px] bg-[#E8EBF0] rounded-[10px] flex items-center px-3.5 gap-2">
                <Search className="w-4 h-4 text-[#596575] shrink-0" />
                <input
                  type="text"
                  value={logsSearchQuery}
                  onChange={(e) => setLogsSearchQuery(e.target.value)}
                  placeholder="Search name, phone or account"
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full h-full bg-transparent text-[14px] text-[#182331] placeholder-[#596575] focus:outline-none"
                />
                {logsSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setLogsSearchQuery("")}
                    className="text-[#596575] hover:text-[#182331] p-1 cursor-pointer shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Delivery Logs Container */}
            <div
              ref={logsTableContainerRef}
              onScroll={onTableScroll}
              className="flex-1 min-h-0 min-h-[calc(100dvh-13rem)] overflow-auto [overflow-anchor:auto] [isolation:isolate]"
            >
              {/* Desktop Table (>= 768px) */}
              <table className="hidden md:table min-w-[850px] w-full text-left text-xs border-collapse bg-white">
                <thead className="border-b text-[#596575] sticky top-0 bg-[#F8F9FA] border-[#DDE2E8] z-10 font-semibold">
                  <tr>
                    <th className="py-2.5 px-4">Timestamp</th>
                    <th className="py-2.5 px-4">Account No</th>
                    <th className="py-2.5 px-4">Recipient</th>
                    <th className="py-2.5 px-4">Notice Message</th>
                    <th className="py-2.5 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DDE2E8]">
                  {isLoadingLogs ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-[#596575]">
                        <div className="flex items-center justify-center gap-2">
                          <AppleSpinner size="sm" className="text-[#155DAA]" />
                          <span>Loading dispatches...</span>
                        </div>
                      </td>
                    </tr>
                  ) : logsList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-[#596575]">
                        No transmission logs found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    logsList.map((log) => (
                      <tr key={log.id} className="hover:bg-[#F8F9FA] transition-colors">
                        <td className="py-2.5 px-4 text-xs font-medium text-[#596575] font-mono whitespace-nowrap">
                          {log.createdAtFormatted}
                        </td>
                        <td className="py-2.5 px-4 text-xs font-mono font-bold text-[#155DAA] whitespace-nowrap">
                          {log.accountNumber || "—"}
                        </td>
                        <td className="py-2.5 px-4 text-xs">
                          <span className="font-semibold text-[#182331] block">
                            {log.recipientName}
                          </span>
                          <span className="text-[11px] text-[#596575] font-mono block">
                            {log.recipientPhone}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-xs text-[#182331] font-medium max-w-md">
                          <span className="line-clamp-2" title={log.message}>
                            {log.message}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-center text-xs font-semibold whitespace-nowrap">
                          <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-[4px] ${
                            log.deliveryStatus === "DELIVERED"
                              ? "text-[#187444] bg-[#EAF7EF]"
                              : log.deliveryStatus === "FAILED"
                              ? "text-[#B42332] bg-[#FCEDEF]"
                              : "text-[#955B08] bg-[#FFF3DE]"
                          }`}>
                            {log.deliveryStatus === "DELIVERED" ? "Delivered" : log.deliveryStatus === "FAILED" ? "Failed" : log.deliveryStatus}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {/* Mobile Delivery Logs List (< 768px) (Figma Screen 3) */}
              <div className="block md:hidden p-3.5 space-y-2.5 bg-[#F2F2F7]">
                {isLoadingLogs ? (
                  <div className="py-12 text-center text-[#596575] bg-white rounded-[14px] border border-[#DDE2E8]">
                    <div className="flex items-center justify-center gap-2">
                      <AppleSpinner size="sm" className="text-[#155DAA]" />
                      <span className="text-xs">Loading dispatches...</span>
                    </div>
                  </div>
                ) : logsList.length === 0 ? (
                  <div className="py-12 text-center text-[#596575] text-xs px-4 bg-white rounded-[14px] border border-[#DDE2E8]">
                    No transmission logs found matching your criteria.
                  </div>
                ) : (
                  logsList.map((log) => (
                    <div key={`mob-log-${log.id}`} className="bg-white rounded-[14px] border border-[#DDE2E8] p-3.5 space-y-2 shadow-none">
                      {/* Top Row: Account No & Status Badge */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-mono text-xs font-bold text-[#155DAA] truncate">
                            {log.accountNumber || "—"}
                          </span>
                          <span className="text-[11px] text-[#596575] shrink-0">&bull; Notice</span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-[4px] shrink-0 ${
                          log.deliveryStatus === "DELIVERED"
                            ? "text-[#187444] bg-[#EAF7EF]"
                            : log.deliveryStatus === "FAILED"
                            ? "text-[#B42332] bg-[#FCEDEF]"
                            : "text-[#955B08] bg-[#FFF3DE]"
                        }`}>
                          {log.deliveryStatus === "DELIVERED" ? "Delivered" : log.deliveryStatus === "FAILED" ? "Failed" : log.deliveryStatus}
                        </span>
                      </div>

                      {/* Recipient Headline */}
                      {log.recipientName ? (
                        <div className="text-xs font-bold text-[#182331] uppercase">
                          Account &mdash; {log.recipientName}
                        </div>
                      ) : (
                        <div className="text-xs font-bold text-[#182331] font-mono">
                          {log.recipientPhone}
                        </div>
                      )}

                      {/* Notice Message / Failure reason */}
                      <p className="text-xs text-[#596575] leading-[145%]">
                        {log.message}
                      </p>

                      {/* Footer: Phone & Timestamp */}
                      <div className="flex items-center justify-between text-[11px] text-[#596575] font-mono pt-0.5">
                        <span>{log.recipientPhone}</span>
                        <span>{log.createdAtFormatted}</span>
                      </div>
                    </div>
                  ))
                )}

                {/* Native iOS Pagination Footer for Mobile (< 768px) */}
                <div className="flex items-center justify-between px-3 py-3 text-xs text-[#596575] font-medium">
                  <button
                    type="button"
                    disabled={logsPage <= 1}
                    onClick={() => handleLogsPageChange(logsPage - 1)}
                    className="p-2 -m-2 disabled:opacity-30 text-[#155DAA] cursor-pointer disabled:cursor-not-allowed"
                    aria-label="Previous Page"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="font-semibold text-[#182331]">
                    Page {logsPage} of {Math.max(1, Math.ceil(logsTotal / logsLimit))}
                  </span>
                  <button
                    type="button"
                    disabled={logsPage >= Math.max(1, Math.ceil(logsTotal / logsLimit))}
                    onClick={() => handleLogsPageChange(logsPage + 1)}
                    className="p-2 -m-2 disabled:opacity-30 text-[#155DAA] cursor-pointer disabled:cursor-not-allowed"
                    aria-label="Next Page"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Delivery Logs Supabase-Style Table Pagination Bar (Desktop >= 768px) */}
            <div className="hidden md:block">
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
        </div>
      )}

      {/* Redesigned Responsive Message Template Modal */}
      <MessageTemplateModal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        activeTemplateType={activeTemplateType}
        onTemplateTypeChange={(type, status) => {
          if (type === "RECEIPT") {
            setActiveTemplateType("RECEIPT");
          } else {
            setActiveTemplateType("BILLING");
            if (status) handleStatusChange(status as any);
          }
        }}
        targetStatus={targetStatus}
        currentTemplate={currentTemplate}
        onTemplateChange={(val) => {
          if (activeTemplateType === "BILLING") {
            setMessageTemplate(val);
          } else {
            setReceiptTemplate(val);
          }
        }}
        savedTemplates={savedTemplates}
        onApplyPreset={(content, filterKey) => {
          if (activeTemplateType === "BILLING") {
            setMessageTemplate(content);
            if (filterKey && filterKey !== "RECEIPT") {
              handleStatusChange(filterKey as any);
            }
          } else {
            setReceiptTemplate(content);
          }
        }}
        onSavePreset={(presetName, content) => {
          const newPreset = {
            id: `preset_custom_${Date.now()}`,
            name: presetName,
            type: activeTemplateType,
            filterKey: activeTemplateType === "BILLING" ? targetStatus : "RECEIPT",
            content,
            savedAt: new Date().toLocaleDateString("en-GB"),
          };
          setSavedTemplates((prev) => [newPreset, ...prev]);
          try {
            const existingCustom = JSON.parse(
              localStorage.getItem("kkma_sms_custom_presets") || "[]"
            );
            localStorage.setItem(
              "kkma_sms_custom_presets",
              JSON.stringify([newPreset, ...existingCustom])
            );
          } catch {}
          onNotify?.(`Preset "${presetName}" saved.`, "success");
        }}
        onRenamePreset={(presetId, newName) => {
          setSavedTemplates((prev) =>
            prev.map((p) => (p.id === presetId ? { ...p, name: newName } : p))
          );
          try {
            const existingCustom = JSON.parse(
              localStorage.getItem("kkma_sms_custom_presets") || "[]"
            );
            const updated = existingCustom.map((p: any) =>
              p.id === presetId ? { ...p, name: newName } : p
            );
            localStorage.setItem("kkma_sms_custom_presets", JSON.stringify(updated));
          } catch {}
          onNotify?.(`Preset renamed to "${newName}".`, "info");
        }}
        onDeletePreset={(presetId) => {
          setSavedTemplates((prev) => prev.filter((p) => p.id !== presetId));
          try {
            const existingCustom = JSON.parse(
              localStorage.getItem("kkma_sms_custom_presets") || "[]"
            );
            const updated = existingCustom.filter((p: any) => p.id !== presetId);
            localStorage.setItem("kkma_sms_custom_presets", JSON.stringify(updated));
          } catch {}
        }}
        onRestorePreset={(preset) => {
          setSavedTemplates((prev) => [preset, ...prev]);
          try {
            const existingCustom = JSON.parse(
              localStorage.getItem("kkma_sms_custom_presets") || "[]"
            );
            localStorage.setItem(
              "kkma_sms_custom_presets",
              JSON.stringify([preset, ...existingCustom])
            );
          } catch {}
          onNotify?.(`Preset "${preset.name}" restored.`, "info");
        }}
        onResetToDefault={() => {
          if (activeTemplateType === "RECEIPT") {
            setReceiptTemplate(DEFAULT_RECEIPT_NOTICE_TEMPLATE);
          } else {
            setMessageTemplate(
              FILTER_SMS_TEMPLATES[targetStatus] || FILTER_SMS_TEMPLATES.UNPAID
            );
          }
          onNotify?.("Reset to standard municipal template.", "info");
        }}
        onSave={handleSaveTemplate}
        isSaving={isSavingTemplate}
        dynamicTokens={dynamicTokens}
      />

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
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="characters"
                          spellCheck={false}
                          data-lpignore="true"
                          data-1p-ignore="true"
                          data-bwignore="true"
                          data-form-type="other"
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
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      data-lpignore="true"
                      data-1p-ignore="true"
                      data-bwignore="true"
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