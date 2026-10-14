"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  SlidersHorizontal,
  Printer,
  Download,
  Building2,
  FileText,
  AlertCircle,
  ArrowUpRight,
} from "lucide-react";
import { getAccountBillHistoryDetail, GetAccountBillHistoryDetailResponse } from "@/app/actions";
import { formatGhc, formatDateGb, formatDateSlash } from "@/lib/formatters";
import { AppleSpinner } from "@/components/ui/AppleSpinner";

interface AccountStatementReportViewProps {
  accountNo: string;
  startDate?: string;
  endDate?: string;
  onBack: () => void;
  onEditFilters: () => void;
}

interface StatementLedgerRow {
  year: number | string;
  dateStr: string;
  timestamp: number;
  item: string;
  cr: number; // Credit (Payments reducing balance)
  dr: number; // Debit (Bills increasing balance)
  runningBalance: number;
}

export function AccountStatementReportView({
  accountNo,
  startDate,
  endDate,
  onBack,
  onEditFilters,
}: AccountStatementReportViewProps) {
  const [data, setData] = useState<GetAccountBillHistoryDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await getAccountBillHistoryDetail(accountNo);
        if (isMounted) {
          if (res.success) {
            setData(res);
          } else {
            setError(res.error || "Failed to retrieve account records.");
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || "An unexpected error occurred loading statement.");
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [accountNo]);

  // Construct accounting ledger from bills and payments sorted chronologically
  const { ledgerRows, totalCr, totalDr, closingBalance, dateRangeLabel } = useMemo(() => {
    if (!data || !data.success) {
      return { ledgerRows: [], totalCr: 0, totalDr: 0, closingBalance: 0, dateRangeLabel: "" };
    }

    const startTs = startDate ? new Date(startDate).getTime() : 0;
    const endTs = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : Infinity;

    const rawRows: {
      year: number | string;
      dateStr: string;
      timestamp: number;
      item: string;
      cr: number;
      dr: number;
    }[] = [];

    // Sort bills chronologically ascending by authoritative fiscal BillYear
    const sortedBills = [...(data.bills || [])].sort((a, b) => {
      return Number(a.billYear || 0) - Number(b.billYear || 0);
    });

    // Authoritative annual rate
    const propAnnualRate = Number(
      data.property?.current_bill > 0
        ? data.property.current_bill
        : data.property?.currentFee > 0
        ? data.property.currentFee
        : 0
    );

    // Initial pre-existing arrears
    const earliestBill = sortedBills[0];
    const totalArrears = Number(
      data.property?.initial_arrears ??
      data.property?.arrears ??
      earliestBill?.balanceBF ??
      0
    );

    const priorBillsCount = Math.max(0, sortedBills.length - 1);
    const priorBillsSum = priorBillsCount * (propAnnualRate > 0 ? propAnnualRate : (Number(earliestBill?.ratePA) || 0));
    const preExistingArrears = Math.max(0, Number((totalArrears - priorBillsSum).toFixed(2)));

    if (preExistingArrears > 0 && earliestBill) {
      const earliestYear = Number(earliestBill.billYear || 2023);
      const bfDate = new Date(earliestYear, 0, 1);

      rawRows.push({
        year: earliestYear,
        dateStr: formatDateSlash(bfDate),
        timestamp: bfDate.getTime(),
        item: "Balance Brought Forward (Arrears)",
        cr: 0,
        dr: preExistingArrears,
      });
    }

    // Add Bills (Debits) - Anchored strictly to BillYear from master Bill data
    for (const b of sortedBills) {
      const invoiceYear = Number(b.billYear) || 2026;
      const bDate = new Date(invoiceYear, 0, 15);
      const ts = bDate.getTime();
      const rawDebit = Number(b.ratePA || 0);
      const amount = rawDebit > 0 ? rawDebit : (propAnnualRate > 0 ? propAnnualRate : 0);

      rawRows.push({
        year: invoiceYear,
        dateStr: formatDateSlash(bDate),
        timestamp: ts,
        item: "Bill",
        cr: 0,
        dr: amount,
      });
    }

    // Add Payments (Credits)
    for (const p of (data.payments || [])) {
      const pDate = p.datePaid ? new Date(p.datePaid) : new Date();
      const ts = pDate.getTime();
      const amount = Number(p.amtPaid || 0);

      rawRows.push({
        year: pDate.getFullYear(),
        dateStr: formatDateSlash(pDate),
        timestamp: ts,
        item: p.gcrNr ? `GCR ${p.gcrNr}` : (p.id ? `GCR ${p.id}` : `Payment · ${p.pmtMode || "Cash"}`),
        cr: amount,
        dr: 0,
      });
    }

    // Sort chronologically ascending
    rawRows.sort((a, b) => a.timestamp - b.timestamp);

    // Compute running balance with period-aware opening balance
    let priorBalance = 0;
    const inRangeRows: typeof rawRows = [];

    for (const r of rawRows) {
      if (startTs > 0 && r.timestamp < startTs) {
        priorBalance = Number((priorBalance + r.dr - r.cr).toFixed(2));
      } else if (r.timestamp <= endTs) {
        inRangeRows.push(r);
      }
    }

    const computedLedger: StatementLedgerRow[] = [];
    let currentBalance = priorBalance;
    let tCr = 0;
    let tDr = 0;

    // If start date filter is active and there's a prior accumulated balance,
    // inject opening Balance Brought Forward row for this statement period
    if (startTs > 0 && priorBalance !== 0) {
      const sDateObj = new Date(startTs);
      computedLedger.push({
        year: sDateObj.getFullYear(),
        dateStr: formatDateSlash(sDateObj),
        timestamp: startTs - 1,
        item: "Balance Brought Forward",
        cr: priorBalance < 0 ? Math.abs(priorBalance) : 0,
        dr: priorBalance > 0 ? priorBalance : 0,
        runningBalance: currentBalance,
      });
      if (priorBalance > 0) tDr += priorBalance;
      if (priorBalance < 0) tCr += Math.abs(priorBalance);
    }

    for (const r of inRangeRows) {
      currentBalance = Number((currentBalance + r.dr - r.cr).toFixed(2));
      tCr += r.cr;
      tDr += r.dr;
      computedLedger.push({
        ...r,
        runningBalance: currentBalance,
      });
    }

    // If date range is specified, format friendly label
    const startFmt = startDate ? formatDateGb(startDate) : "All Records";
    const endFmt = endDate ? formatDateGb(endDate) : formatDateGb(new Date());
    const rangeLabel = startDate
      ? `${startFmt} – ${endFmt} · All amounts in GH₵`
      : `All Recorded Fiscal Years · All amounts in GH₵`;

    return {
      ledgerRows: computedLedger,
      totalCr: tCr,
      totalDr: tDr,
      closingBalance: currentBalance,
      dateRangeLabel: rangeLabel,
    };
  }, [data, startDate, endDate]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    if (!ledgerRows.length) return;
    const headers = ["Year", "Date", "Item", "CR (GH₵)", "DR (GH₵)", "Running Balance (GH₵)"];
    const rows = ledgerRows.map((r) => [
      `"${r.year}"`,
      `"${r.dateStr}"`,
      `"${r.item.replace(/"/g, '""')}"`,
      `"${r.cr.toFixed(2)}"`,
      `"${r.dr.toFixed(2)}"`,
      `"${r.runningBalance.toFixed(2)}"`,
    ]);
    const summaryRow = [
      '"CLOSING BALANCE"',
      '""',
      '""',
      `"${totalCr.toFixed(2)}"`,
      `"${totalDr.toFixed(2)}"`,
      `"${closingBalance.toFixed(2)}"`,
    ];

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(",")), summaryRow.join(",")].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `statement_${accountNo}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const prop = data?.property;
  const ownerName = prop?.owner_name || prop?.ownerName || prop?.ratable_name || prop?.name || "";
  const address = prop?.owner_digital_address || prop?.ownerDigitalAddress || prop?.physicalAddress || prop?.house_no || "";
  const todayFormatted = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#F5F5F7] min-h-0 overflow-y-auto font-sans">
      {/* Top Preview Toolbar */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-[#E9E9ED] px-6 py-3 flex items-center justify-between">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-[13px]">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 text-[#007AFF] hover:underline font-semibold focus:outline-none"
            title="Back"
          >
            <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
            <span>Back</span>
          </button>
          <span className="text-[#98989D]">/</span>
          <span className="text-[#1D1D1F] font-semibold">Account Statement</span>
          <span className="text-xs text-[#737378] ml-2">({accountNo})</span>
        </div>

        {/* Edit filters trigger */}
        <button
          type="button"
          onClick={onEditFilters}
          className="h-[34px] px-3.5 rounded-[10px] bg-[#F2F2F5] hover:bg-[#E5E5EA] text-[#1D1D1F] text-[13px] font-medium flex items-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-[#1D1D1F]" />
          <span>Edit filters</span>
        </button>
      </div>

      {/* Main Workspace Container */}
      <div className="p-6 md:p-10 max-w-5xl mx-auto w-full">
        {isLoading ? (
          <div className="bg-white rounded-[10px] border border-[#E9E9ED] p-16 flex flex-col items-center justify-center min-h-[400px]">
            <AppleSpinner size="lg" className="text-[#007AFF] mb-3" />
            <p className="text-[13px] text-[#737378]">Generating official account statement...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-[10px] border border-[#E9E9ED] p-12 text-center">
            <AlertCircle className="w-8 h-8 text-[#FF3B30] mx-auto mb-2" />
            <h3 className="text-base font-semibold text-[#1D1D1F]">Statement Unavailable</h3>
            <p className="text-sm text-[#737378] mt-1 max-w-md mx-auto">{error}</p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={onBack}
                className="px-4 py-2 bg-[#F2F2F5] text-xs font-semibold rounded-lg text-[#1D1D1F] hover:bg-[#E5E5EA] transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={onEditFilters}
                className="px-4 py-2 bg-[#007AFF] text-white text-xs font-medium rounded-lg"
              >
                Choose Another Account
              </button>
            </div>
          </div>
        ) : (
          /* Statement Document Paper (Apple Minimalist Standard) */
          <div className="bg-white rounded-[10px] shadow-sm border border-[#E9E9ED] p-8 md:p-12 space-y-8 print:p-0 print:border-none print:shadow-none">
            {/* Document Header */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-[#F2F2F5]">
              <div>
                <h1 className="text-[20px] md:text-[22px] font-semibold text-[#1D1D1F] tracking-tight">
                  HEINZ INTEGRATED SYSTEMS LIMITED - Account Statement
                </h1>
                <p className="text-xs text-[#737378] mt-1 font-medium">
                  {dateRangeLabel}
                </p>
              </div>

              {/* Document Actions (Hidden on Print) */}
              <div className="flex items-center gap-2 print:hidden shrink-0">
                <button
                  type="button"
                  onClick={handlePrint}
                  title="Print official statement"
                  className="h-8 px-3 rounded-[8px] border border-[#E9E9ED] bg-white hover:bg-[#F2F2F5] text-[#1D1D1F] text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5 text-[#737378]" />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  title="Export to CSV spreadsheet"
                  className="h-8 px-3 rounded-[8px] border border-[#E9E9ED] bg-white hover:bg-[#F2F2F5] text-[#1D1D1F] text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-[#737378]" />
                  <span>Export</span>
                </button>
              </div>
            </div>

            {/* Account Summary Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 py-2">
              <div>
                <span className="block text-[11px] font-medium text-[#737378] uppercase tracking-wider">
                  Account Number
                </span>
                <span className="block text-[15px] font-semibold text-[#007AFF] mt-0.5">
                  {accountNo}
                </span>
              </div>
              <div>
                <span className="block text-[11px] font-medium text-[#737378] uppercase tracking-wider">
                  Address
                </span>
                <span className="block text-[14px] text-[#1D1D1F] mt-0.5 truncate">
                  {address}
                </span>
              </div>
              <div>
                <span className="block text-[11px] font-medium text-[#737378] uppercase tracking-wider">
                  Owner
                </span>
                <span className="block text-[14px] font-medium text-[#1D1D1F] mt-0.5 truncate">
                  {ownerName}
                </span>
              </div>
            </div>

            {/* Transactions Ledger Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px] sm:text-[15.5px]">
                <thead>
                  <tr className="border-b border-[#E9E9ED] text-[#737378] text-[11px] sm:text-[13px] font-medium">
                    <th className="py-2.5 pr-4 font-medium w-16">Year</th>
                    <th className="py-2.5 px-4 font-medium">Item</th>
                    <th className="py-2.5 px-4 font-medium text-right w-28">CR</th>
                    <th className="py-2.5 px-4 font-medium text-right w-28">DR</th>
                    <th className="py-2.5 pl-4 font-medium text-right w-32">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2F2F5] text-[#1D1D1F]">
                  {ledgerRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-[13px] sm:text-[15.5px] text-[#737378]">
                        No recorded transactions found within the selected dates.
                      </td>
                    </tr>
                  ) : (
                    ledgerRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-[#F9F9FB] transition-colors">
                        <td className="py-3 pr-4 font-medium text-[#737378]">{row.year}</td>
                        <td className="py-3 px-4 font-medium">
                          {row.cr > 0 && row.item.startsWith("GCR") ? (
                            <a
                              href={`/?tab=PAYMENTS&account=${encodeURIComponent(accountNo)}`}
                              className="inline-flex items-center gap-1.5 text-[#007AFF] hover:underline font-medium group"
                              title="View payment records for this account"
                            >
                              <span>{row.item}</span>
                              {row.dateStr && (
                                <span className="text-[11px] sm:text-[12px] text-[#737378] font-normal">
                                  ({row.dateStr})
                                </span>
                              )}
                              <ArrowUpRight className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100 transition-opacity shrink-0" />
                            </a>
                          ) : (
                            row.item
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-[#248A3D] font-semibold">
                          {row.cr > 0 ? row.cr.toFixed(2) : "0.00"}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-[#1D1D1F]">
                          {row.dr > 0 ? row.dr.toFixed(2) : "0.00"}
                        </td>
                        <td className="py-3 pl-4 text-right font-mono tabular-nums font-semibold text-[#1D1D1F]">
                          {row.runningBalance.toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}

                  {/* Statement Totals Row */}
                  <tr className="border-t-2 border-[#1D1D1F] font-semibold text-[#1D1D1F] bg-[#FDFDFE]">
                    <td colSpan={2} className="py-3.5 pr-4 text-[13px] sm:text-[15.5px]">
                      Closing balance
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#248A3D] font-semibold">
                      {totalCr.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#1D1D1F]">
                      {totalDr.toFixed(2)}
                    </td>
                    <td className="py-3.5 pl-4 text-right font-mono tabular-nums text-[14px] sm:text-[16.5px] text-[#007AFF]">
                      {formatGhc(closingBalance)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Document Footer */}
            <div className="pt-6 border-t border-[#E9E9ED] flex flex-col sm:flex-row items-center justify-between text-[11px] text-[#737378] gap-2">
              <span>Generated {todayFormatted}</span>
              <span>Page 1 of 1</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
