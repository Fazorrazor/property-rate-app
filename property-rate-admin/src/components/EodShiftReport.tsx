'use client';

import { useState, useEffect } from 'react';
import { getShiftReport, ShiftReport } from '@/app/shiftActions';
import { formatGhc } from '@/lib/formatters';
import { AppleSpinner } from '@/components/ui/AppleSpinner';
import { Receipt, Clock, User, FileText } from 'lucide-react';

export function EodShiftReport() {
  const [report, setReport] = useState<ShiftReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadReport() {
      setIsLoading(true);
      const res = await getShiftReport();
      if (res.success && res.data) {
        setReport(res.data);
      } else {
        setError(res.error || 'Failed to load report.');
      }
      setIsLoading(false);
    }
    loadReport();
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <AppleSpinner size="lg" />
        <p className="mt-4 text-sm text-[#6C6C70]">Loading Shift Report...</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-[#FF3B30]">
        <p className="text-sm font-medium">{error || 'Unable to load data'}</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col font-sans bg-[#F2F2F7]">
      <div className="bg-white border-b border-[#E5E5EA] px-6 py-5 shrink-0 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#1C1C1E] tracking-tight">End of Day (EOD) Shift Report</h2>
          <p className="text-xs text-[#6C6C70] mt-1 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" /> Shift Started: 12:00 AM Today
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 no-scrollbar space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-[#E5E5EA] rounded-xl p-5 shadow-xs flex flex-col justify-between h-28">
            <div className="flex items-center gap-2 text-[#6C6C70]">
              <User className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Cashier / Officer</span>
            </div>
            <div className="text-xl font-bold text-[#1C1C1E]">{report.adminName}</div>
          </div>
          <div className="bg-white border border-[#E5E5EA] rounded-xl p-5 shadow-xs flex flex-col justify-between h-28">
            <div className="flex items-center gap-2 text-[#6C6C70]">
              <Receipt className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Total Transactions</span>
            </div>
            <div className="text-3xl font-bold text-[#1C1C1E]">{report.transactionCount}</div>
          </div>
          <div className="bg-[#007AFF]/10 border border-[#007AFF]/20 rounded-xl p-5 shadow-xs flex flex-col justify-between h-28">
            <div className="flex items-center gap-2 text-[#007AFF]">
              <FileText className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Total Collected Today</span>
            </div>
            <div className="text-3xl font-bold text-[#007AFF]">{formatGhc(report.totalCollected)}</div>
          </div>
        </div>

        <div className="bg-white border border-[#E5E5EA] rounded-xl shadow-xs overflow-hidden flex flex-col min-h-0">
          <div className="px-5 py-4 border-b border-[#E5E5EA] bg-[#F8F9FA] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#1C1C1E]">Shift Transactions Log</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-[#F8F9FA] text-[#8E8E93] sticky top-0 z-10 border-b border-[#E5E5EA]">
                <tr>
                  <th className="px-5 py-3 font-medium">Time</th>
                  <th className="px-5 py-3 font-medium">Receipt Number</th>
                  <th className="px-5 py-3 font-medium">Account Number</th>
                  <th className="px-5 py-3 font-medium">Settlement</th>
                  <th className="px-5 py-3 font-medium text-right">Amount (GHS)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5EA]">
                {report.transactions.length > 0 ? (
                  report.transactions.map((txn, i) => (
                    <tr key={i} className="hover:bg-[#F2F2F7]/50 transition-colors">
                      <td className="px-5 py-3.5 text-[#1C1C1E]">{txn.time}</td>
                      <td className="px-5 py-3.5 font-medium text-[#1C1C1E]">{txn.receiptNumber}</td>
                      <td className="px-5 py-3.5 text-[#007AFF] font-medium">{txn.accountNumber}</td>
                      <td className="px-5 py-3.5 text-[#6C6C70]">{txn.settlementType}</td>
                      <td className="px-5 py-3.5 text-right font-semibold text-[#1C1C1E]">{formatGhc(txn.amount)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-[#8E8E93]">
                      <Receipt className="w-8 h-8 mx-auto mb-3 opacity-20" />
                      No transactions recorded yet today.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
