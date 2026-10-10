"use client";

import { useState, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Download,
  RotateCcw,
  Search,
  Check,
  ShieldCheck,
  Eye,
} from "lucide-react";
import { AppleSpinner } from "@/components/ui/AppleSpinner";
import {
  fetchAccountsForValidation,
  applyRatepayerBatchUpdates,
  RatepayerBatchUpdateItem,
  MatchedAccountValidationRecord,
  RatepayerBatchUpdateResult,
} from "@/app/actions";
import { parseBakBuffer } from "@/lib/bak-parser";

interface ParsedRow {
  rawAccount: string;
  accountNumber: string;
  name?: string;
  arrears?: number;
  currentBill?: number;
  amountPaid?: number;
  outstanding?: number;
}

interface RowDiff {
  accountNumber: string;
  ownerName: string;
  matched: boolean;
  dbRecord?: MatchedAccountValidationRecord;
  parsedRow: ParsedRow;
  hasChanges: boolean;
  paymentDelta: number;
  arrearsDelta: number;
  feeDelta: number;
  outstandingDelta: number;
  newStatus: string;
}

interface RatepayerDataSyncPageProps {
  onAccountSelect?: (accountNumber: string) => void;
  currentUser?: { id: string; name: string; role: string } | null;
}

export function RatepayerDataSyncPage({
  onAccountSelect,
  currentUser,
}: RatepayerDataSyncPageProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Validation diff state
  const [diffs, setDiffs] = useState<RowDiff[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [filterMode, setFilterMode] = useState<"ALL" | "UPDATED" | "PAYMENTS" | "UNMATCHED">("UPDATED");
  const [searchQuery, setSearchQuery] = useState("");

  // Confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [securityPassword, setSecurityPassword] = useState("");
  const [isApplying, setIsApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<RatepayerBatchUpdateResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to format currency
  const formatGhc = (amt: number | undefined | null) => {
    if (amt === undefined || amt === null || isNaN(amt)) return "GH₵ 0.00";
    return `GH₵ ${amt.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Clean numbers from currency strings
  const parseCurrencyNumber = (val: string | undefined): number | undefined => {
    if (!val) return undefined;
    const clean = val.replace(/GH[₵S]/gi, "").replace(/,/g, "").trim();
    if (!clean) return undefined;
    const num = parseFloat(clean);
    return isNaN(num) ? undefined : num;
  };

  // 1. Download Standard CSV Template
  const handleDownloadTemplate = () => {
    const csvContent =
      "Account No,Name,Arrears,Current Bill,Amount Paid,Outstanding\n" +
      "KKDA03188007,EMMANUEL KOFI ACKAH,0.00,792.61,360.00,792.61\n" +
      "MA11078001,KWAME MENSAH,120.00,450.00,570.00,0.00\n" +
      "KKDA11095001,ABENA SERWAA,50.00,300.00,100.00,250.00\n";

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "assembly_ratepayer_sync_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 2. Parse CSV / Tabular content
  const parseTabularData = async (text: string, currentFileName: string) => {
    setIsParsing(true);
    setParseError(null);
    setApplyResult(null);

    try {
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      if (lines.length < 2) {
        throw new Error("The uploaded file does not contain enough data or header rows.");
      }

      // Find the actual header row (skip titles, blank lines, or dashed lines from SSMS exports)
      let headerLineIndex = -1;
      let delimiter = ",";
      let headers: string[] = [];

      for (let i = 0; i < Math.min(20, lines.length); i++) {
        const line = lines[i];
        if (/^[-=+|]+$/.test(line.replace(/\s/g, ""))) continue; // Skip dashed lines

        let possibleDelimiter = ",";
        if (line.includes("\t")) possibleDelimiter = "\t";
        else if (line.includes("|")) possibleDelimiter = "|";
        else if (line.includes(";") && !line.includes(",")) possibleDelimiter = ";";
        else if (/\s{2,}/.test(line)) possibleDelimiter = "spaces"; // Fixed-width / SSMS export

        const rawHeaders = possibleDelimiter === "spaces" 
          ? line.split(/\s{2,}/) 
          : line.split(possibleDelimiter);
        
        const cleanHeaders = rawHeaders.map((h) => h.trim().replace(/^["']|["']$/g, "").toLowerCase());
        
        if (cleanHeaders.some(h => h.includes("account") || h.includes("property_id") || h.includes("parcel"))) {
          headerLineIndex = i;
          delimiter = possibleDelimiter;
          headers = cleanHeaders;
          break;
        }
      }

      if (headerLineIndex === -1) {
        // Fallback to first non-dashed line just in case, to show a better error
        const firstValidLine = lines.find(l => !/^[-=+|]+$/.test(l.replace(/\s/g, ""))) || lines[0];
        throw new Error(
          "Could not detect 'Account No' column. Found headers: " + firstValidLine.substring(0, 100)
        );
      }

      // Identify column indexes
      const findHeaderIndex = (patterns: string[]) =>
        headers.findIndex((h) => patterns.some((p) => h.includes(p)));

      const accIdx = findHeaderIndex(["account", "acc", "property_id", "parcel", "acct"]);
      const nameIdx = findHeaderIndex(["name", "owner", "ratepayer"]);
      const arrearsIdx = findHeaderIndex(["arrears", "old_arrears", "balance_bf", "bf"]);
      const billIdx = findHeaderIndex(["current bill", "current_bill", "current fee", "current_fee", "bill_amount", "bill"]);
      const paidIdx = findHeaderIndex(["amount paid", "amount_paid", "amt paid", "amt_paid", "total_paid", "paid", "receipt"]);
      const outstandingIdx = findHeaderIndex(["outstanding", "balance", "total due", "total_amount_due"]);

      if (accIdx === -1) {
        throw new Error(
          "Could not detect 'Account No' column. Headers found: " + headers.join(", ")
        );
      }

      const parsed: ParsedRow[] = [];
      for (let i = headerLineIndex + 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line || /^[-=+|]+$/.test(line.replace(/\s/g, ""))) continue; // Skip blanks and dashed separators
        
        const cols = delimiter === "spaces" 
          ? line.split(/\s{2,}/).map(c => c.trim()) 
          : line.split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, ""));
          
        const rawAccount = cols[accIdx];
        if (!rawAccount) continue;

        parsed.push({
          rawAccount,
          accountNumber: rawAccount.trim().toUpperCase(),
          name: nameIdx !== -1 ? cols[nameIdx] : undefined,
          arrears: arrearsIdx !== -1 ? parseCurrencyNumber(cols[arrearsIdx]) : undefined,
          currentBill: billIdx !== -1 ? parseCurrencyNumber(cols[billIdx]) : undefined,
          amountPaid: paidIdx !== -1 ? parseCurrencyNumber(cols[paidIdx]) : undefined,
          outstanding: outstandingIdx !== -1 ? parseCurrencyNumber(cols[outstandingIdx]) : undefined,
        });
      }

      if (parsed.length === 0) {
        throw new Error("No valid account rows were found in the uploaded file.");
      }

      await validateAndComputeDiffs(parsed, currentFileName);
    } catch (err: any) {
      console.error("[parseTabularData] Error:", err);
      setParseError(err?.message || "Failed to parse data file.");
      setDiffs([]);
    } finally {
      setIsParsing(false);
      setIsValidating(false);
    }
  };

  const validateAndComputeDiffs = async (parsed: ParsedRow[], currentFileName: string) => {
      setIsValidating(true);
      const accList = parsed.map((p) => p.accountNumber);
      const valRes = await fetchAccountsForValidation(accList);

      if (!valRes.success || !valRes.records) {
        throw new Error(valRes.error || "Failed to validate accounts with database.");
      }

      const dbMap = new Map<string, MatchedAccountValidationRecord>();
      valRes.records.forEach((r) => dbMap.set(r.accountNumber.toUpperCase(), r));

      // Calculate Diffs
      const computedDiffs: RowDiff[] = parsed.map((row) => {
        const dbRec = dbMap.get(row.accountNumber);
        if (!dbRec) {
          return {
            accountNumber: row.accountNumber,
            ownerName: row.name || "Unknown Ratepayer",
            matched: false,
            parsedRow: row,
            hasChanges: false,
            paymentDelta: 0,
            arrearsDelta: 0,
            feeDelta: 0,
            outstandingDelta: 0,
            newStatus: "UNMATCHED",
          };
        }

        const targetArrears = row.arrears !== undefined ? row.arrears : dbRec.currentArrears;
        const targetFee = row.currentBill !== undefined ? row.currentBill : dbRec.currentFee;
        const targetPaid = row.amountPaid !== undefined ? row.amountPaid : dbRec.amountPaid;

        const paymentDelta = Math.max(0, Number((targetPaid - dbRec.amountPaid).toFixed(2)));
        const arrearsDelta = Number((targetArrears - dbRec.currentArrears).toFixed(2));
        const feeDelta = Number((targetFee - dbRec.currentFee).toFixed(2));

        const expectedOutstanding =
          row.outstanding !== undefined
            ? row.outstanding
            : Math.max(0, Number((targetArrears + targetFee - (paymentDelta > 0 ? paymentDelta : 0)).toFixed(2)));
        const outstandingDelta = Number((expectedOutstanding - dbRec.totalAmountDue).toFixed(2));

        const hasChanges =
          paymentDelta !== 0 ||
          arrearsDelta !== 0 ||
          feeDelta !== 0 ||
          outstandingDelta !== 0;

        const newStatus =
          expectedOutstanding <= 0 ? "PAID" : targetPaid > 0 ? "PARTIALLY_PAID" : "UNPAID";

        return {
          accountNumber: row.accountNumber,
          ownerName: row.name || dbRec.ownerName,
          matched: true,
          dbRecord: dbRec,
          parsedRow: row,
          hasChanges,
          paymentDelta,
          arrearsDelta,
          feeDelta,
          outstandingDelta,
          newStatus,
        };
      });

      setDiffs(computedDiffs);
  };

  // 3. Handle File Input / Drop
  const handleFile = async (f: File) => {
    if (f.name.toLowerCase().endsWith(".bak")) {
      setIsParsing(true);
      setParseError(null);
      try {
        const buffer = await f.arrayBuffer();
        // Wait briefly for the UI spinner to render
        await new Promise((resolve) => setTimeout(resolve, 50));
        const bakData = parseBakBuffer(buffer);
        
        const parsed: ParsedRow[] = bakData.map((b) => ({
          rawAccount: b.accountNumber,
          accountNumber: b.accountNumber,
          name: b.name,
          arrears: b.arrears,
          currentBill: b.currentBill,
          amountPaid: b.amountPaid,
          outstanding: b.outstanding,
        }));
        
        await validateAndComputeDiffs(parsed, f.name);
      } catch (err: any) {
        console.error("[parseBakFile] Error:", err);
        setParseError("Failed to decode SQL Server backup file: " + err?.message);
        setDiffs([]);
      } finally {
        setIsParsing(false);
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      parseTabularData(content, f.name);
    };
    reader.readAsText(f);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  // 4. Filtered Rows
  const filteredDiffs = useMemo(() => {
    return diffs.filter((d) => {
      // Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesAcc = d.accountNumber.toLowerCase().includes(q);
        const matchesName = d.ownerName.toLowerCase().includes(q);
        if (!matchesAcc && !matchesName) return false;
      }

      // Mode filter
      if (filterMode === "UPDATED") return d.hasChanges && d.matched;
      if (filterMode === "PAYMENTS") return d.paymentDelta > 0 && d.matched;
      if (filterMode === "UNMATCHED") return !d.matched;
      return true;
    });
  }, [diffs, searchQuery, filterMode]);

  // Statistics
  const stats = useMemo(() => {
    const total = diffs.length;
    const matched = diffs.filter((d) => d.matched).length;
    const updated = diffs.filter((d) => d.matched && d.hasChanges).length;
    const payments = diffs.filter((d) => d.matched && d.paymentDelta > 0);
    const paymentCount = payments.length;
    const totalNewPaymentVolume = payments.reduce((acc, curr) => acc + curr.paymentDelta, 0);
    const unmatched = diffs.filter((d) => !d.matched).length;

    return {
      total,
      matched,
      updated,
      paymentCount,
      totalNewPaymentVolume,
      unmatched,
    };
  }, [diffs]);

  // 5. Apply Updates Action
  const handleApplyUpdates = async () => {
    const updatesToApply: RatepayerBatchUpdateItem[] = diffs
      .filter((d) => d.matched && d.hasChanges)
      .map((d) => ({
        accountNumber: d.accountNumber,
        name: d.ownerName,
        arrears: d.parsedRow.arrears,
        currentBill: d.parsedRow.currentBill,
        amountPaid: d.parsedRow.amountPaid,
        outstanding: d.parsedRow.outstanding,
      }));

    if (updatesToApply.length === 0) {
      alert("No updated accounts detected to apply.");
      return;
    }

    setIsApplying(true);
    try {
      const res = await applyRatepayerBatchUpdates(updatesToApply, securityPassword.trim() || undefined);
      if (res.success) {
        setApplyResult(res);
        setShowConfirmModal(false);
      } else {
        alert(res.error || "Failed to apply updates.");
      }
    } catch (err: any) {
      console.error("[handleApplyUpdates] Error:", err);
      alert(err?.message || "An unexpected error occurred.");
    } finally {
      setIsApplying(false);
    }
  };

  const handleReset = () => {
    setDiffs([]);
    setParseError(null);
    setApplyResult(null);
    setSecurityPassword("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="w-full flex-1 flex flex-col bg-[#F9F9FB] min-h-screen text-[#1C1C1E]">
      {/* Top Header */}
      <div className="border-b border-[#E5E5EA] bg-white sticky top-0 z-10 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#1C1C1E]">
            Officer Ratepayer Data Ingestion
          </h1>
          <p className="text-xs text-[#6C6C70] mt-0.5">
            Synchronize municipal field updates, CSV records, and billing extracts directly into the live register.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#007AFF] bg-white border border-[#E5E5EA] rounded-lg hover:bg-[#F2F2F7] transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download CSV Template</span>
          </button>

          {diffs.length > 0 && (
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#8E8E93] hover:text-[#1C1C1E] border border-transparent hover:border-[#E5E5EA] rounded-lg transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      <div className="p-6 flex-1 flex flex-col space-y-6 max-w-7xl w-full mx-auto">
        {/* SUCCESS SUMMARY BANNER */}
        {applyResult && applyResult.success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-5 bg-white border border-[#34C759]/30 rounded-xl shadow-xs space-y-3"
          >
            <div className="flex items-center gap-2.5 text-[#34C759]">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <h2 className="text-sm font-bold text-[#1C1C1E]">
                Ingestion Completed Successfully
              </h2>
            </div>
            <p className="text-xs text-[#6C6C70]">
              Applied updates to <strong className="text-[#1C1C1E]">{applyResult.updatedCount}</strong> municipal accounts. Generated <strong className="text-[#1C1C1E]">{applyResult.paymentsGeneratedCount}</strong> official GCR receipts totaling <strong className="text-[#34C759]">{applyResult.totalPaymentsFormatted}</strong>.
            </p>

            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={handleReset}
                className="px-3.5 py-1.5 bg-[#007AFF] text-white rounded-lg text-xs font-semibold hover:bg-[#0066D6] transition cursor-pointer"
              >
                Upload Another Sheet
              </button>
            </div>
          </motion.div>
        )}

        {/* UPLOAD DROPZONE (When no file parsed yet or parse error) */}
        {diffs.length === 0 && !applyResult && (
          <div className="space-y-4">
            <div
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition ${
                isDragging
                  ? "border-[#007AFF] bg-[#007AFF]/5"
                  : "border-[#D1D1D6] bg-white hover:border-[#8E8E93]"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,.tsv,.sql,.bak"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFile(e.target.files[0]);
                  }
                }}
              />

              <div className="w-14 h-14 rounded-full bg-[#F2F2F7] flex items-center justify-center mb-4 text-[#007AFF]">
                <UploadCloud className="w-7 h-7" />
              </div>

              <h2 className="text-base font-semibold text-[#1C1C1E] tracking-tight">
                Drag and drop your RMMS .bak or Tabular Extract
              </h2>
              <p className="text-xs text-[#6C6C70] mt-1 max-w-md">
                Directly parses .bak SQL Server database snapshots locally, or reads columns for Account No, Name, Arrears, Current Bill, Amount Paid, and Outstanding.
              </p>

              <div className="mt-4 flex items-center gap-2 text-xs text-[#8E8E93]">
                <span>Supported: .bak, .csv, .tsv, .txt</span>
                <span>&bull;</span>
                <span>Direct DB & Ledger Sync</span>
              </div>
            </div>

            {/* Error notice */}
            {parseError && (
              <div className="p-4 bg-white border border-[#FF3B30]/30 rounded-xl flex items-start gap-3 text-xs text-[#FF3B30]">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-semibold">Parsing Error</strong>
                  <span>{parseError}</span>
                </div>
              </div>
            )}

            {/* Parsing State - Centered in Focus with Apple Backdrop Blur */}
            {(isParsing || isValidating) && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md animate-in fade-in duration-200">
                <div className="p-8 bg-white/95 border border-[#E5E5EA] rounded-2xl flex flex-col items-center justify-center space-y-3 shadow-2xl max-w-sm w-full mx-4">
                  <AppleSpinner size="md" className="text-[#007AFF]" />
                  <p className="text-xs text-[#1C1C1E] font-medium text-center">
                    {isParsing ? "Reading tabular file lines..." : "Validating accounts against municipal database..."}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PRE-FLIGHT VALIDATION PREVIEW */}
        {diffs.length > 0 && !applyResult && (
          <div className="space-y-6 flex-1 flex flex-col">
            {/* KPI Summary Bar (Apple Minimalist Typography, Strictly Zero Pills) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white border border-[#E5E5EA] rounded-xl p-4 space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93] block">
                  File Records
                </span>
                <span className="text-xl font-bold text-[#1C1C1E] tabular-nums">
                  {stats.total}
                </span>
                <span className="text-[11px] text-[#6C6C70] block">
                  {stats.matched} matched in DB
                </span>
              </div>

              <div className="bg-white border border-[#E5E5EA] rounded-xl p-4 space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93] block">
                  Accounts with Updates
                </span>
                <span className="text-xl font-bold text-[#007AFF] tabular-nums">
                  {stats.updated}
                </span>
                <span className="text-[11px] text-[#6C6C70] block">
                  detected balance/rate changes
                </span>
              </div>

              <div className="bg-white border border-[#E5E5EA] rounded-xl p-4 space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93] block">
                  Payment Increments
                </span>
                <span className="text-xl font-bold text-[#34C759] tabular-nums">
                  {stats.paymentCount}
                </span>
                <span className="text-[11px] text-[#34C759] font-medium block tabular-nums">
                  +{formatGhc(stats.totalNewPaymentVolume)}
                </span>
              </div>

              <div className="bg-white border border-[#E5E5EA] rounded-xl p-4 space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93] block">
                  Unmatched Accounts
                </span>
                <span className={`text-xl font-bold tabular-nums ${stats.unmatched > 0 ? "text-[#FF9500]" : "text-[#8E8E93]"}`}>
                  {stats.unmatched}
                </span>
                <span className="text-[11px] text-[#6C6C70] block">
                  not found in master cadastre
                </span>
              </div>
            </div>

            {/* Filter and Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Filter Tabs (Zero Pills, clean typographic links with subtle border) */}
              <div className="flex items-center gap-4 text-xs border-b border-[#E5E5EA] pb-1">
                <button
                  type="button"
                  onClick={() => setFilterMode("UPDATED")}
                  className={`pb-2 font-medium cursor-pointer transition ${
                    filterMode === "UPDATED"
                      ? "text-[#007AFF] border-b-2 border-[#007AFF] font-bold"
                      : "text-[#6C6C70] hover:text-[#1C1C1E]"
                  }`}
                >
                  Accounts with Updates ({stats.updated})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode("PAYMENTS")}
                  className={`pb-2 font-medium cursor-pointer transition ${
                    filterMode === "PAYMENTS"
                      ? "text-[#007AFF] border-b-2 border-[#007AFF] font-bold"
                      : "text-[#6C6C70] hover:text-[#1C1C1E]"
                  }`}
                >
                  New Payments ({stats.paymentCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode("ALL")}
                  className={`pb-2 font-medium cursor-pointer transition ${
                    filterMode === "ALL"
                      ? "text-[#007AFF] border-b-2 border-[#007AFF] font-bold"
                      : "text-[#6C6C70] hover:text-[#1C1C1E]"
                  }`}
                >
                  All Rows ({stats.total})
                </button>
                {stats.unmatched > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilterMode("UNMATCHED")}
                    className={`pb-2 font-medium cursor-pointer transition ${
                      filterMode === "UNMATCHED"
                        ? "text-[#FF9500] border-b-2 border-[#FF9500] font-bold"
                        : "text-[#6C6C70] hover:text-[#1C1C1E]"
                    }`}
                  >
                    Unmatched ({stats.unmatched})
                  </button>
                )}
              </div>

              {/* Search & Commit CTA */}
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#8E8E93]" />
                  <input
                    type="text"
                    placeholder="Search account or name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs bg-white border border-[#E5E5EA] rounded-lg focus:outline-none focus:border-[#007AFF] w-48 sm:w-64"
                  />
                </div>

                <button
                  type="button"
                  disabled={stats.updated === 0 || isApplying}
                  onClick={() => setShowConfirmModal(true)}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    stats.updated > 0 && !isApplying
                      ? "bg-[#007AFF] text-white hover:bg-[#0066D6] shadow-xs"
                      : "bg-[#E5E5EA] text-[#8E8E93] cursor-not-allowed"
                  }`}
                >
                  {isApplying ? (
                    <>
                      <AppleSpinner size="xs" className="text-white" />
                      <span>Applying...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Apply Updates ({stats.updated})</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* High Density Pre-Flight Diff Table */}
            <div className="bg-white border border-[#E5E5EA] rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8F9FA] border-b border-[#E5E5EA] text-[#8E8E93] uppercase font-semibold text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Account & Ratepayer</th>
                      <th className="py-3 px-4">Arrears</th>
                      <th className="py-3 px-4">Current Bill</th>
                      <th className="py-3 px-4">Amount Paid</th>
                      <th className="py-3 px-4">Outstanding</th>
                      <th className="py-3 px-4 text-right">Detection</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E5EA]">
                    {filteredDiffs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-[#8E8E93] italic">
                          No matching records for this filter view.
                        </td>
                      </tr>
                    ) : (
                      filteredDiffs.map((diff) => {
                        const db = diff.dbRecord;
                        return (
                          <tr
                            key={diff.accountNumber}
                            className={`hover:bg-[#F9F9FB] transition ${
                              !diff.matched ? "bg-[#FFF9F5]" : ""
                            }`}
                          >
                            {/* Account & Ratepayer */}
                            <td className="py-3 px-4">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5 font-bold text-[#1C1C1E]">
                                  <span>{diff.accountNumber}</span>
                                  {onAccountSelect && diff.matched && (
                                    <button
                                      type="button"
                                      onClick={() => onAccountSelect(diff.accountNumber)}
                                      className="text-[#007AFF] hover:underline"
                                      title="Open Dossier"
                                    >
                                      <Eye className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                                <span className="text-[11px] text-[#6C6C70] block truncate max-w-[200px]">
                                  {diff.ownerName}
                                </span>
                              </div>
                            </td>

                            {/* Arrears */}
                            <td className="py-3 px-4 tabular-nums">
                              {diff.matched && db ? (
                                <div className="space-y-0.5">
                                  {diff.arrearsDelta !== 0 ? (
                                    <div className="flex items-center gap-1">
                                      <span className="text-[#8E8E93] line-through text-[11px]">
                                        {formatGhc(db.currentArrears)}
                                      </span>
                                      <ArrowRight className="w-2.5 h-2.5 text-[#8E8E93]" />
                                      <span className="font-semibold text-[#1C1C1E]">
                                        {formatGhc(diff.parsedRow.arrears ?? db.currentArrears)}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-[#6C6C70]">{formatGhc(db.currentArrears)}</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[#8E8E93]">{formatGhc(diff.parsedRow.arrears)}</span>
                              )}
                            </td>

                            {/* Current Bill */}
                            <td className="py-3 px-4 tabular-nums">
                              {diff.matched && db ? (
                                <div className="space-y-0.5">
                                  {diff.feeDelta !== 0 ? (
                                    <div className="flex items-center gap-1">
                                      <span className="text-[#8E8E93] line-through text-[11px]">
                                        {formatGhc(db.currentFee)}
                                      </span>
                                      <ArrowRight className="w-2.5 h-2.5 text-[#8E8E93]" />
                                      <span className="font-semibold text-[#1C1C1E]">
                                        {formatGhc(diff.parsedRow.currentBill ?? db.currentFee)}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-[#6C6C70]">{formatGhc(db.currentFee)}</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[#8E8E93]">{formatGhc(diff.parsedRow.currentBill)}</span>
                              )}
                            </td>

                            {/* Amount Paid */}
                            <td className="py-3 px-4 tabular-nums">
                              {diff.matched && db ? (
                                <div className="space-y-0.5">
                                  {diff.paymentDelta > 0 ? (
                                    <div>
                                      <div className="flex items-center gap-1">
                                        <span className="text-[#8E8E93] line-through text-[11px]">
                                          {formatGhc(db.amountPaid)}
                                        </span>
                                        <ArrowRight className="w-2.5 h-2.5 text-[#8E8E93]" />
                                        <span className="font-bold text-[#34C759]">
                                          {formatGhc(diff.parsedRow.amountPaid)}
                                        </span>
                                      </div>
                                      <span className="text-[10px] text-[#34C759] font-medium block">
                                        +{formatGhc(diff.paymentDelta)}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-[#6C6C70]">{formatGhc(db.amountPaid)}</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[#8E8E93]">{formatGhc(diff.parsedRow.amountPaid)}</span>
                              )}
                            </td>

                            {/* Outstanding */}
                            <td className="py-3 px-4 tabular-nums">
                              {diff.matched && db ? (
                                <div className="space-y-0.5">
                                  {diff.outstandingDelta !== 0 ? (
                                    <div className="flex items-center gap-1">
                                      <span className="text-[#8E8E93] line-through text-[11px]">
                                        {formatGhc(db.totalAmountDue)}
                                      </span>
                                      <ArrowRight className="w-2.5 h-2.5 text-[#8E8E93]" />
                                      <span className="font-bold text-[#1C1C1E]">
                                        {formatGhc(
                                          diff.parsedRow.outstanding ??
                                            Math.max(0, db.totalAmountDue - diff.paymentDelta)
                                        )}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-[#6C6C70]">{formatGhc(db.totalAmountDue)}</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[#8E8E93]">{formatGhc(diff.parsedRow.outstanding)}</span>
                              )}
                            </td>

                            {/* Detection status */}
                            <td className="py-3 px-4 text-right">
                              {!diff.matched ? (
                                <span className="text-[#FF9500] font-medium text-[11px]">
                                  &bull; Unmatched Account
                                </span>
                              ) : diff.paymentDelta > 0 ? (
                                <span className="text-[#34C759] font-medium text-[11px]">
                                  ● New Payment Recorded
                                </span>
                              ) : diff.hasChanges ? (
                                <span className="text-[#007AFF] font-medium text-[11px]">
                                  ● Balance Adjusted
                                </span>
                              ) : (
                                <span className="text-[#8E8E93] text-[11px]">
                                  &bull; Unchanged
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CONFIRMATION MODAL */}
      <AnimatePresence>
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-[#E5E5EA]"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[#007AFF]">
                  <ShieldCheck className="w-5 h-5" />
                  <h3 className="text-base font-bold text-[#1C1C1E]">
                    Confirm Database Synchronization
                  </h3>
                </div>
                <p className="text-xs text-[#6C6C70]">
                  This operation will commit updates to the official municipal registry.
                </p>
              </div>

              {/* Action summary */}
              <div className="bg-[#F8F9FA] border border-[#E5E5EA] rounded-xl p-4 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-[#6C6C70]">Target Accounts:</span>
                  <strong className="text-[#1C1C1E]">{stats.updated} records</strong>
                </div>
                {stats.paymentCount > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-[#6C6C70]">New Receipts to Generate:</span>
                    <strong className="text-[#34C759] font-semibold">
                      {stats.paymentCount} official receipts (+{formatGhc(stats.totalNewPaymentVolume)})
                    </strong>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-[#E5E5EA]">
                  <span className="text-[#6C6C70]">Audit Logging:</span>
                  <span className="text-[#1C1C1E] font-medium">Automatic (Timestamped)</span>
                </div>
              </div>

              {/* Security Authorization */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1C1C1E] block">
                  Security Authorization Password
                </label>
                <input
                  type="password"
                  placeholder="Enter administrator or officer password"
                  value={securityPassword}
                  onChange={(e) => setSecurityPassword(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[#E5E5EA] rounded-lg focus:outline-none focus:border-[#007AFF]"
                />
                <span className="text-[10px] text-[#8E8E93] block">
                  Confirms officer authorization to commit bulk financial modifications.
                </span>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={isApplying}
                  onClick={() => setShowConfirmModal(false)}
                  className="px-4 py-2 text-xs font-medium text-[#6C6C70] hover:text-[#1C1C1E] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isApplying}
                  onClick={handleApplyUpdates}
                  className="px-4 py-2 bg-[#007AFF] text-white rounded-lg text-xs font-semibold hover:bg-[#0066D6] transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isApplying ? (
                    <>
                      <AppleSpinner size="xs" className="text-white" />
                      <span>Applying to Database...</span>
                    </>
                  ) : (
                    <span>Confirm & Commit Updates</span>
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
