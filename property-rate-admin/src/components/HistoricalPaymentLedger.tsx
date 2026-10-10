"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  ChevronDown,
  FileText,
  Calendar,
  Eye,
} from "lucide-react";
import type { AdminProperty, AdminPropertyReceipt, AdminBillRecord } from "@/app/actions";
import { linkPhysicalGcrToReceipt } from "@/app/actions";

interface HistoricalPaymentLedgerProps {
  properties: AdminProperty[];
  receipts: AdminPropertyReceipt[];
  bills?: AdminBillRecord[];
  defaultPropertyAccountNumber?: string;
  onPreviewBillImage?: (url: string) => void;
}

const formatGhc = (val: number | null | undefined): string => {
  if (val === null || val === undefined || isNaN(val)) return "GH₵ 0.00";
  return `GH₵ ${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export function HistoricalPaymentLedger({
  properties,
  receipts,
  bills = [],
  defaultPropertyAccountNumber = "ALL",
  onPreviewBillImage,
}: HistoricalPaymentLedgerProps) {
  const [selectedPropertyFilter, setSelectedPropertyFilter] = useState<string>(defaultPropertyAccountNumber);
  const [selectedYearFilter, setSelectedYearFilter] = useState<string>(String(new Date().getFullYear()));
  const [searchQuery, setSearchQuery] = useState("");
  const [previewingBillUrl, setPreviewingBillUrl] = useState<string | null>(null);

  const [editingReceiptId, setEditingReceiptId] = useState<string | null>(null);
  const [gcrInputValue, setGcrInputValue] = useState("");
  const [isLinkingGcr, setIsLinkingGcr] = useState(false);

  // Sync state if defaultPropertyAccountNumber changes (e.g. user clicks a different property for the same ratepayer)
  React.useEffect(() => {
    setSelectedPropertyFilter(defaultPropertyAccountNumber);
    setSelectedYearFilter(String(new Date().getFullYear()));
  }, [defaultPropertyAccountNumber]);

  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>([2026, 2025, 2024, 2023]);

    bills.forEach((b) => {
      if (b.billYear) yearsSet.add(b.billYear);
    });

    properties.forEach((p) => {
      if (p.billYear) yearsSet.add(p.billYear);
    });

    receipts.forEach((r) => {
      const yearFromDate = r.exactTimestamp
        ? new Date(r.exactTimestamp).getFullYear()
        : r.datePaid
        ? parseInt(r.datePaid.slice(-4), 10)
        : null;
      if (yearFromDate && !isNaN(yearFromDate)) {
        yearsSet.add(yearFromDate);
      }
    });

    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [properties, receipts, bills]);

  // Look up exact Bill record from RMMS-ingested data
  const getBillRecord = (accountNo: string, year: number): AdminBillRecord | null => {
    return bills.find((b) => b.accountNo === accountNo && b.billYear === year) || null;
  };

  // Active property object based on selection
  const activeProperty = useMemo(() => {
    if (selectedPropertyFilter === "ALL") {
      return properties[0] || null;
    }
    return properties.find((p) => p.accountNumber === selectedPropertyFilter) || null;
  }, [properties, selectedPropertyFilter]);

  // Filtered receipts
  const filteredReceipts = useMemo(() => {
    return receipts.filter((r) => {
      // 1. Property filter
      if (selectedPropertyFilter !== "ALL") {
        const matchesAccount = r.propertyAccountNumber === selectedPropertyFilter;
        const matchesPropId = properties.some(
          (p) => p.accountNumber === selectedPropertyFilter && p.id === r.propertyId
        );
        if (!matchesAccount && !matchesPropId) return false;
      }

      // 2. Year filter
      if (selectedYearFilter !== "ALL") {
        const targetYear = parseInt(selectedYearFilter, 10);
        const receiptYear = r.exactTimestamp
          ? new Date(r.exactTimestamp).getFullYear()
          : r.formattedDate
          ? parseInt(r.formattedDate.slice(-4), 10)
          : r.datePaid
          ? parseInt(r.datePaid.slice(-4), 10)
          : null;

        // Also check if narrative indicates current year payment
        const matchesYear = receiptYear === targetYear;
        if (!matchesYear) return false;
      }

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const num = (r.receiptNumber || "").toLowerCase();
        const ref = (r.transactionReference || "").toLowerCase();
        const method = (r.paymentMethod || "").toLowerCase();
        const acc = (r.propertyAccountNumber || "").toLowerCase();
        if (!num.includes(q) && !ref.includes(q) && !method.includes(q) && !acc.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [receipts, selectedPropertyFilter, selectedYearFilter, searchQuery, properties]);

  // Assessment bill details for the selected year
  const yearAssessment = useMemo(() => {
    if (selectedYearFilter === "ALL" || !activeProperty) return null;

    const yearNum = parseInt(selectedYearFilter, 10);
    const isCurrentBillYear = activeProperty.billYear === yearNum;
    const yearPayments = filteredReceipts.reduce((sum, r) => sum + r.amount, 0);

    // Priority: exact RMMS-ingested Bill record > property estimates
    const bill = getBillRecord(activeProperty.accountNumber, yearNum);

    // UI safety net: if RMMS bill has balanceBF = 0 but property shows known arrears,
    // use property.initialArrears as the effective Arrears B/F (RMMS gap fix)
    const propertyArrears = activeProperty.initialArrears ?? activeProperty.arrears ?? 0;
    const effectiveArrearsBF = bill
      ? (bill.balanceBF === 0 && propertyArrears > 0 ? propertyArrears : bill.balanceBF)
      : isCurrentBillYear
      ? propertyArrears
      : Math.max(0, propertyArrears - yearPayments);

    const rateableValue = activeProperty.rateableValue || 0;
    const rateImposed = bill ? bill.ratePA : (activeProperty.currentFee || 0);
    const arrearsBroughtForward = effectiveArrearsBF;

    // Recompute totalAssessmentDue using effectiveArrearsBF when bill.accountBalance
    // was also 0-arrears-based (i.e. bill.accountBalance === bill.ratePA)
    const effectiveTotalDue = bill
      ? Math.max(0, (rateImposed + effectiveArrearsBF) - yearPayments)
      : isCurrentBillYear
      ? (activeProperty.totalAmountDue ?? Math.max(0, effectiveArrearsBF + rateImposed - yearPayments))
      : Math.max(0, rateImposed + effectiveArrearsBF - yearPayments);

    const totalAssessmentDue = effectiveTotalDue;
    const isSettled = totalAssessmentDue <= 0 || (isCurrentBillYear && activeProperty.status === "PAID");
    const usedFallback = bill && bill.balanceBF === 0 && propertyArrears > 0;

    return {
      year: yearNum,
      accountNumber: activeProperty.accountNumber,
      digitalAddress: activeProperty.ownerDigitalAddress || "—",
      rateableValue,
      rateImposed,
      arrearsBroughtForward,
      yearPayments,
      totalAssessmentDue,
      isSettled,
      billImageUrl: activeProperty.billImageUrl,
      source: bill ? (usedFallback ? "RMMS+" : "RMMS") : "ESTIMATED",
    };
  }, [selectedYearFilter, activeProperty, filteredReceipts, bills]);

  // Portfolio matrix — multi-property owners + specific year
  const portfolioMatrix = useMemo(() => {
    if (selectedPropertyFilter !== "ALL" || selectedYearFilter === "ALL" || properties.length <= 1) return null;
    const yearNum = parseInt(selectedYearFilter, 10);

    return properties.map((p) => {
      const bill = getBillRecord(p.accountNumber, yearNum);
      const propReceipts = receipts.filter((r) => {
        const recYear = r.exactTimestamp
          ? new Date(r.exactTimestamp).getFullYear()
          : r.datePaid ? parseInt(r.datePaid.slice(-4), 10) : null;
        return (r.propertyAccountNumber === p.accountNumber || r.propertyId === p.id) && recYear === yearNum;
      });
      const paidInYear = propReceipts.reduce((s, r) => s + r.amount, 0);
      const rateImposed = bill ? bill.ratePA : (p.currentFee || 0);
      // UI fallback: if RMMS bill.balanceBF = 0 but property has known arrears, use property arrears
      const propArrears = p.initialArrears ?? p.arrears ?? 0;
      const arrearsBF = bill
        ? (bill.balanceBF === 0 && propArrears > 0 ? propArrears : bill.balanceBF)
        : propArrears;
      const totalDue = Math.max(0, rateImposed + arrearsBF - paidInYear);
      return {
        accountNumber: p.accountNumber,
        location: p.ownerDigitalAddress || p.physicalAddress || "—",
        rateImposed,
        arrearsBF,
        paidInYear,
        totalDue,
        isSettled: totalDue <= 0,
        source: bill ? (bill.balanceBF === 0 && propArrears > 0 ? "RMMS+" : "RMMS") : "EST",
      };
    });
  }, [selectedPropertyFilter, selectedYearFilter, properties, receipts, bills]);

  // KPI Calculations
  const kpis = useMemo(() => {
    const activeProperties = selectedPropertyFilter === "ALL"
      ? properties
      : properties.filter((p) => p.accountNumber === selectedPropertyFilter);

    const totalPaid = filteredReceipts.reduce((sum, r) => sum + (r.amount || 0), 0);
    const outstandingBalance = activeProperties.reduce((sum, p) => sum + (p.totalAmountDue || 0), 0);
    const lastTxnDate = filteredReceipts.length > 0
      ? (filteredReceipts[0].formattedDate || filteredReceipts[0].datePaid || "—")
      : "No Transactions";

    return {
      totalPaid,
      outstandingBalance,
      lastTxnDate,
    };
  }, [filteredReceipts, selectedPropertyFilter, properties]);

  // CSV Export Trigger
  const handleLinkGcr = async (receiptId: string) => {
    if (!gcrInputValue.trim()) return;
    setIsLinkingGcr(true);
    try {
      const res = await linkPhysicalGcrToReceipt(receiptId, gcrInputValue.trim().toUpperCase());
      if (res.success) {
        alert('Successfully linked physical GCR to this digital receipt. Please refresh the page to see changes.');
        setEditingReceiptId(null);
        setGcrInputValue("");
      } else {
        alert(res.error || 'Failed to link GCR');
      }
    } catch (err: any) {
      alert(err.message || 'An error occurred while linking GCR');
    } finally {
      setIsLinkingGcr(false);
    }
  };

  return (
    <div className="space-y-3 pt-3 border-t border-[#E5E5EA]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-bold text-[#1C1C1E] uppercase tracking-wider">
            Historical Payment Ledger &amp; Bills
          </h3>
          <p className="text-[11px] text-[#6C6C70]">
            Itemized municipal receipts and reconciled assessment records
          </p>
        </div>
      </div>

      {/* KPI Summary Bar (Zero Pills, Pure Minimalist Typography) */}
      <div className="grid grid-cols-3 gap-2.5 p-3 bg-[#F8F9FA] border border-[#E5E5EA] rounded-xl">
        <div>
          <span className="text-[10px] text-[#6C6C70] uppercase tracking-wider font-semibold block">
            Total Paid
          </span>
          <p className="text-sm font-bold text-[#34C759] tabular-nums mt-0.5">
            {formatGhc(kpis.totalPaid)}
          </p>
        </div>
        <div>
          <span className="text-[10px] text-[#6C6C70] uppercase tracking-wider font-semibold block">
            Outstanding Due
          </span>
          <p className={`text-sm font-bold tabular-nums mt-0.5 ${kpis.outstandingBalance > 0 ? "text-[#FF3B30]" : "text-[#1C1C1E]"}`}>
            {formatGhc(kpis.outstandingBalance)}
          </p>
        </div>
        <div>
          <span className="text-[10px] text-[#6C6C70] uppercase tracking-wider font-semibold block">
            Last Transaction
          </span>
          <p className="text-xs font-semibold text-[#1C1C1E] mt-0.5 truncate">
            {kpis.lastTxnDate}
          </p>
        </div>
      </div>

      {/* Filters Bar: Property Selector, Bill Year Selector & Search */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {/* 1. Property Account Selector */}
        <div className="relative">
          <select
            value={selectedPropertyFilter}
            onChange={(e) => setSelectedPropertyFilter(e.target.value)}
            className="w-full text-xs py-1.5 pl-2.5 pr-7 bg-white border border-[#D1D1D6] rounded-lg text-[#1C1C1E] font-medium appearance-none focus:outline-none focus:ring-1 focus:ring-[#007AFF] cursor-pointer"
          >
            <option value="ALL">All Registered Properties ({properties.length})</option>
            {properties.map((p) => (
              <option key={p.accountNumber} value={p.accountNumber}>
                {p.accountNumber} {p.houseNo ? `(Hse ${p.houseNo})` : ""}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-[#8E8E93] absolute right-2 top-2 pointer-events-none" />
        </div>

        {/* 2. Billing Year Filter */}
        <div className="relative">
          <select
            value={selectedYearFilter}
            onChange={(e) => setSelectedYearFilter(e.target.value)}
            className="w-full text-xs py-1.5 pl-2.5 pr-7 bg-white border border-[#D1D1D6] rounded-lg text-[#1C1C1E] font-medium appearance-none focus:outline-none focus:ring-1 focus:ring-[#007AFF] cursor-pointer"
          >
            <option value="ALL">All Assessment Years</option>
            {availableYears.map((yr) => (
              <option key={yr} value={yr.toString()}>
                {yr} Municipal Assessment Bill
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-[#8E8E93] absolute right-2 top-2 pointer-events-none" />
        </div>

        {/* 3. Search Input */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search GCR #, ref, method..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs py-1.5 pl-7 pr-2.5 bg-white border border-[#D1D1D6] rounded-lg text-[#1C1C1E] placeholder:text-[#8E8E93] focus:outline-none focus:ring-1 focus:ring-[#007AFF]"
          />
          <Search className="w-3.5 h-3.5 text-[#8E8E93] absolute left-2 top-2 pointer-events-none" />
        </div>
      </div>

      {/* PORTFOLIO ASSESSMENT MATRIX — multi-property owner + specific year */}
      {portfolioMatrix && (
        <div className="p-3.5 bg-white border border-[#E5E5EA] rounded-xl space-y-2.5 shadow-xs">
          <div className="flex items-center gap-2 border-b border-[#E5E5EA] pb-2">
            <Calendar className="w-4 h-4 text-[#007AFF] shrink-0" />
            <h4 className="text-xs font-bold text-[#1C1C1E]">
              {selectedYearFilter} Portfolio Assessment — All {properties.length} Properties
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px] border-collapse">
              <thead className="bg-[#F8F9FA] text-[10px] text-[#6C6C70] uppercase font-semibold">
                <tr>
                  <th className="py-1.5 px-2">Property Account</th>
                  <th className="py-1.5 px-2">Location / GPS</th>
                  <th className="py-1.5 px-2 text-right">Rate Imposed</th>
                  <th className="py-1.5 px-2 text-right">Arrears B/F</th>
                  <th className="py-1.5 px-2 text-right">Paid in {selectedYearFilter}</th>
                  <th className="py-1.5 px-2 text-right">Balance Due</th>
                  <th className="py-1.5 px-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5EA]">
                {portfolioMatrix.map((row) => (
                  <tr
                    key={row.accountNumber}
                    className="hover:bg-[#F2F2F7]/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedPropertyFilter(row.accountNumber)}
                  >
                    <td className="py-2 px-2 font-mono font-semibold text-[#007AFF] whitespace-nowrap">
                      {row.accountNumber}
                      <span className="ml-1 text-[9px] text-[#8E8E93] font-sans font-normal">{row.source}</span>
                    </td>
                    <td className="py-2 px-2 text-[#6C6C70] whitespace-nowrap">{row.location}</td>
                    <td className="py-2 px-2 text-right tabular-nums font-mono">{formatGhc(row.rateImposed)}</td>
                    <td className="py-2 px-2 text-right tabular-nums font-mono text-[#FF9500]">
                      {row.arrearsBF > 0 ? formatGhc(row.arrearsBF) : "—"}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums font-mono text-[#34C759]">
                      {row.paidInYear > 0 ? formatGhc(row.paidInYear) : "—"}
                    </td>
                    <td className={`py-2 px-2 text-right tabular-nums font-bold ${row.totalDue > 0 ? "text-[#FF3B30]" : "text-[#34C759]"}` }>
                      {formatGhc(row.totalDue)}
                    </td>
                    <td className="py-2 px-2 text-right whitespace-nowrap">
                      <span className={`text-[11px] font-medium ${row.isSettled ? "text-[#34C759]" : "text-[#FF9500]"}`}>
                        {row.isSettled ? "• Paid" : "• Pending"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-[#E5E5EA] bg-[#F8F9FA]">
                <tr>
                  <td colSpan={2} className="py-2 px-2 text-[10px] font-bold text-[#1C1C1E] uppercase tracking-wide">Portfolio Total</td>
                  <td className="py-2 px-2 text-right tabular-nums font-bold text-[#1C1C1E] text-[11px]">
                    {formatGhc(portfolioMatrix.reduce((s, r) => s + r.rateImposed, 0))}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums font-bold text-[#FF9500] text-[11px]">
                    {formatGhc(portfolioMatrix.reduce((s, r) => s + r.arrearsBF, 0))}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums font-bold text-[#34C759] text-[11px]">
                    {formatGhc(portfolioMatrix.reduce((s, r) => s + r.paidInYear, 0))}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums font-bold text-[#FF3B30] text-[11px]">
                    {formatGhc(portfolioMatrix.reduce((s, r) => s + r.totalDue, 0))}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-[10px] text-[#8E8E93] italic">Click any row to isolate that property&apos;s transactions below.</p>
        </div>
      )}

      {/* SELECTED YEAR BILL ASSESSMENT CARD */}
      {yearAssessment && !portfolioMatrix && (
        <div className="p-3.5 bg-white border border-[#E5E5EA] rounded-xl space-y-2.5 shadow-xs">
          <div className="flex items-start justify-between gap-3 border-b border-[#E5E5EA] pb-2">
            <div>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#007AFF] shrink-0" />
                <h4 className="text-xs font-bold text-[#1C1C1E]">
                  {yearAssessment.year} Municipal Rate Assessment Bill
                </h4>
                <span className={`text-[11px] font-medium ${yearAssessment.isSettled ? "text-[#34C759]" : "text-[#FF9500]"}`}>
                  {yearAssessment.isSettled ? "• Paid in Full" : "• Pending Settlement"}
                </span>
                {yearAssessment.source === "RMMS" && (
                  <span className="text-[9px] text-[#8E8E93] font-medium">RMMS Verified</span>
                )}
              </div>
              <p className="text-[11px] text-[#6C6C70] mt-0.5 font-mono">
                Account: <strong className="text-[#1C1C1E]">{yearAssessment.accountNumber}</strong> &bull; GPS: {yearAssessment.digitalAddress}
              </p>
            </div>

            {yearAssessment.billImageUrl && (
              <button
                type="button"
                onClick={() => {
                  if (onPreviewBillImage) onPreviewBillImage(yearAssessment.billImageUrl!);
                  else setPreviewingBillUrl(yearAssessment.billImageUrl || null);
                }}
                className="px-2.5 py-1 text-[11px] font-medium text-[#007AFF] hover:underline flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Eye className="w-3 h-3" />
                <span>View Bill Scan</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div>
              <span className="text-[10px] text-[#8E8E93] uppercase font-semibold block">
                Rateable Value
              </span>
              <span className="font-semibold text-[#1C1C1E] tabular-nums">
                {formatGhc(yearAssessment.rateableValue)}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-[#8E8E93] uppercase font-semibold block">
                Arrears B/F
              </span>
              <span className="font-semibold text-[#1C1C1E] tabular-nums">
                {formatGhc(yearAssessment.arrearsBroughtForward)}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-[#8E8E93] uppercase font-semibold block">
                Year Rate Imposed
              </span>
              <span className="font-semibold text-[#1C1C1E] tabular-nums">
                {formatGhc(yearAssessment.rateImposed)}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-[#8E8E93] uppercase font-semibold block">
                Payments in {yearAssessment.year}
              </span>
              <span className="font-bold text-[#34C759] tabular-nums">
                {formatGhc(yearAssessment.yearPayments)}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-[#E5E5EA] flex items-center justify-between text-xs">
            <span className="text-[#6C6C70]">Assessment Balance Due:</span>
            <span className={`font-bold tabular-nums ${yearAssessment.totalAssessmentDue > 0 ? "text-[#FF3B30]" : "text-[#34C759]"}`}>
              {formatGhc(yearAssessment.totalAssessmentDue)}
            </span>
          </div>
        </div>
      )}

      {/* Ledger Data Table */}
      <div className="border border-[#E5E5EA] rounded-xl overflow-hidden bg-white">
        {filteredReceipts.length === 0 ? (
          <div className="p-6 text-center text-[#8E8E93] text-xs italic">
            No payment records found for {selectedYearFilter === "ALL" ? "this property" : `the ${selectedYearFilter} billing cycle`}.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[280px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#F8F9FA] border-b border-[#E5E5EA] sticky top-0 z-10 text-[10px] text-[#6C6C70] uppercase font-semibold">
                <tr>
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Receipt / Ref</th>
                  <th className="py-2 px-3">Property Account</th>
                  <th className="py-2 px-3">Channel</th>
                  <th className="py-2 px-3 text-right">Arrears</th>
                  <th className="py-2 px-3 text-right">Current</th>
                  <th className="py-2 px-3 text-right">Amount</th>
                  <th className="py-2 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5EA]">
                {filteredReceipts.map((r) => {
                  const arrearsPd = r.narrative?.arrearsPaid || 0;
                  const feePd = r.narrative?.currentFeePaid || 0;
                  return (
                    <tr key={r.id} className="hover:bg-[#F2F2F7]/50 transition-colors">
                      <td className="py-2 px-3 text-[11px] text-[#6C6C70] whitespace-nowrap">
                        {r.formattedDate || r.datePaid}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap font-mono text-[11px] text-[#1C1C1E] font-medium">
                        {r.receiptNumber}
                      </td>
                      <td className="py-2 px-3 text-[11px] font-mono text-[#1C1C1E] whitespace-nowrap">
                        {r.propertyAccountNumber || "—"}
                      </td>
                      <td className="py-2 px-3 text-[11px] text-[#1C1C1E] whitespace-nowrap">
                        {r.paymentMethod}
                      </td>
                      <td className="py-2 px-3 text-right text-[11px] font-mono text-[#6C6C70] tabular-nums whitespace-nowrap">
                        {arrearsPd > 0 ? `GH₵ ${arrearsPd.toFixed(2)}` : "—"}
                      </td>
                      <td className="py-2 px-3 text-right text-[11px] font-mono text-[#6C6C70] tabular-nums whitespace-nowrap">
                        {feePd > 0 ? `GH₵ ${feePd.toFixed(2)}` : "—"}
                      </td>
                      <td className="py-2 px-3 text-right text-[11px] font-bold text-[#1C1C1E] tabular-nums whitespace-nowrap">
                        {formatGhc(r.amount)}
                      </td>
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        {r.receiptNumber?.startsWith('DIG-') || r.receiptNumber?.startsWith('TXN-') || r.receiptNumber?.startsWith('REC-') ? (
                          editingReceiptId === r.id ? (
                            <div className="flex items-center justify-end gap-1">
                              <input
                                type="text"
                                placeholder="GCR-..."
                                className="border border-[#E5E5EA] rounded px-1.5 py-0.5 text-[10px] uppercase w-20 outline-none"
                                value={gcrInputValue}
                                onChange={(e) => setGcrInputValue(e.target.value)}
                                autoFocus
                              />
                              <button
                                onClick={() => handleLinkGcr(r.id)}
                                disabled={isLinkingGcr}
                                className="bg-[#007AFF] text-white text-[10px] px-2 py-0.5 rounded font-medium disabled:opacity-50"
                              >
                                {isLinkingGcr ? '...' : 'Save'}
                              </button>
                              <button
                                onClick={() => { setEditingReceiptId(null); setGcrInputValue(""); }}
                                className="text-[#6C6C70] text-[10px] px-1"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setEditingReceiptId(r.id); setGcrInputValue(""); }}
                              className="text-[10px] text-[#007AFF] font-medium hover:underline"
                            >
                              Link Physical GCR
                            </button>
                          )
                        ) : (
                          <span className="text-[11px] text-[#34C759] font-medium">
                            &bull; Reconciled
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bill image preview fallback modal if not handled externally */}
      {previewingBillUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-[#1C1C1E]">Official Assessment Bill Scan</h4>
              <button
                type="button"
                onClick={() => setPreviewingBillUrl(null)}
                className="text-xs text-[#8E8E93] hover:text-[#1C1C1E] cursor-pointer"
              >
                Close
              </button>
            </div>
            <img
              src={previewingBillUrl}
              alt="Official Bill Scan"
              className="w-full max-h-[70vh] object-contain rounded-lg border border-[#E5E5EA]"
            />
          </div>
        </div>
      )}
    </div>
  );
}
