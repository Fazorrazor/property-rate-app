'use client';

import React, { useState, useEffect, useCallback, useTransition, useRef } from 'react';
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Database,
  MapPin,
  Copy,
  Check,
  Calendar,
  Phone,
  Home,
  Layers,
  ArrowRight,
} from 'lucide-react';
import {
  searchPropertyBillAccounts,
  getAccountBillHistoryDetail,
  PropertyBillAccountSummary,
  GetAccountBillHistoryDetailResponse,
} from '@/app/actions';
import { formatGhc, formatDateGb } from '@/lib/formatters';
import { AppleSpinner } from '@/components/ui/AppleSpinner';
import { UniversalDatabaseTable } from '@/components/UniversalDatabaseTable';
import { DATABASE_TABLE_DEFINITIONS } from '@/lib/database-tables-config';

interface AccountBillHistoryViewProps {
  initialAccountNo?: string | null;
  hideToolbar?: boolean;
  externalSearchQuery?: string;
  visibleColumnKeys?: string[];
  subView?: 'accounts' | 'raw_table';
  onSubViewChange?: (mode: 'accounts' | 'raw_table') => void;
  onDetailViewChange?: (isDetail: boolean) => void;
  onCountChange?: (count: number, total: number) => void;
  onTableScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
}

export function AccountBillHistoryView({
  initialAccountNo = null,
  hideToolbar = false,
  externalSearchQuery,
  visibleColumnKeys,
  subView: controlledSubView,
  onSubViewChange,
  onDetailViewChange,
  onCountChange,
  onTableScroll,
}: AccountBillHistoryViewProps) {
  // Mode: "accounts" (multi-year account lookup) vs "raw_table" (flat 61,263 Bill rows)
  const [internalSubView, setInternalSubView] = useState<'accounts' | 'raw_table'>('accounts');
  const subView = controlledSubView !== undefined ? controlledSubView : internalSubView;
  const setSubView = (val: 'accounts' | 'raw_table') => {
    setInternalSubView(val);
    onSubViewChange?.(val);
  };

  // Account search state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const accountsScrollRef = useRef<HTMLDivElement>(null);

  // Scroll to top of list when moving between pages
  useEffect(() => {
    accountsScrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, [currentPage]);
  const [accounts, setAccounts] = useState<PropertyBillAccountSummary[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Selected account detail state
  const [selectedAccountNo, setSelectedAccountNo] = useState<string | null>(initialAccountNo);
  const [detailData, setDetailData] = useState<GetAccountBillHistoryDetailResponse | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [copiedAcc, setCopiedAcc] = useState(false);

  const [, startTransition] = useTransition();

  // Debounce search input (internal or external)
  useEffect(() => {
    const q = externalSearchQuery !== undefined ? externalSearchQuery : searchQuery;
    const timer = setTimeout(() => {
      setDebouncedSearch(q);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, externalSearchQuery]);

  // Fetch accounts list
  const fetchAccounts = useCallback(async () => {
    setIsLoadingAccounts(true);
    setSearchError(null);
    try {
      const res = await searchPropertyBillAccounts({
        searchQuery: debouncedSearch,
        page: currentPage,
        pageSize,
      });

      if (!res.success) {
        setSearchError(res.error || 'Failed to search billing accounts.');
        setAccounts([]);
        setTotalCount(0);
        setTotalPages(1);
      } else {
        setAccounts(res.accounts || []);
        setTotalCount(res.totalCount || 0);
        setTotalPages(res.totalPages || 1);
      }
    } catch (err: any) {
      setSearchError(err?.message || 'Network error fetching accounts.');
      setAccounts([]);
    } finally {
      setIsLoadingAccounts(false);
    }
  }, [debouncedSearch, currentPage, pageSize]);

  useEffect(() => {
    if (subView === 'accounts' && !selectedAccountNo) {
      startTransition(() => {
        fetchAccounts();
      });
    }
  }, [fetchAccounts, subView, selectedAccountNo]);

  // Notify parent of count updates
  useEffect(() => {
    if (subView === 'accounts') {
      onCountChange?.(accounts.length, totalCount);
    }
  }, [accounts.length, totalCount, onCountChange, subView]);

  // Fetch detail for selected account
  const loadAccountDetail = useCallback(async (accountNo: string) => {
    setIsLoadingDetail(true);
    setDetailError(null);
    try {
      const res = await getAccountBillHistoryDetail(accountNo);
      if (!res.success) {
        setDetailError(res.error || 'Failed to load account bill history.');
        setDetailData(null);
      } else {
        setDetailData(res);
      }
    } catch (err: any) {
      setDetailError(err?.message || 'Error fetching account bill history.');
      setDetailData(null);
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (selectedAccountNo) {
      loadAccountDetail(selectedAccountNo);
    }
    onDetailViewChange?.(Boolean(selectedAccountNo));
  }, [selectedAccountNo, loadAccountDetail, onDetailViewChange]);

  const handleSelectAccount = (accountNo: string) => {
    setSelectedAccountNo(accountNo);
    onDetailViewChange?.(true);
  };

  const handleBackToSearch = () => {
    setSelectedAccountNo(null);
    setDetailData(null);
    setDetailError(null);
    onDetailViewChange?.(false);
  };

  const handleCopyAccountNo = (acc: string) => {
    navigator.clipboard.writeText(acc);
    setCopiedAcc(true);
    setTimeout(() => setCopiedAcc(false), 2000);
  };

  // If user switches to raw table view
  if (subView === 'raw_table') {
    return (
      <div className="flex-1 flex flex-col min-h-0 bg-white">
        {/* Sub-view Switcher Toolbar */}
        {!hideToolbar && (
          <div className="px-4 lg:px-6 py-2 border-b border-[#E5E5EA] bg-[#F8F9FA] flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#1C1C1E]">
                Viewing Raw Table: <span className="font-mono text-[#007AFF]">Bill</span>
              </span>
              <span className="text-[11px] text-[#8E8E93]">(61,263 raw records across 2023–2026)</span>
            </div>
            <button
              type="button"
              onClick={() => setSubView('accounts')}
              className="apple-btn-secondary h-7 px-2.5 rounded-md text-xs font-medium flex items-center gap-1.5 cursor-pointer text-[#007AFF] border-[#007AFF]/20 hover:bg-[#007AFF]/5 transition-colors"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Switch to Account Bill History Lookup</span>
            </button>
          </div>
        )}
        <UniversalDatabaseTable
          tableDef={DATABASE_TABLE_DEFINITIONS.Bill}
          hideToolbar={hideToolbar}
          visibleColumnKeys={visibleColumnKeys}
          externalSearchQuery={externalSearchQuery}
          onCountChange={onCountChange}
          onTableScroll={onTableScroll}
        />
      </div>
    );
  }

  // =========================================================================
  // DETAIL VIEW: SPECIFIC ACCOUNT'S MULTI-YEAR BILL HISTORY
  // =========================================================================
  if (selectedAccountNo) {
    const prop = detailData?.property;
    const bills = detailData?.bills || [];
    const summary = detailData?.summary;

    return (
      <div onScroll={onTableScroll} className="flex-1 flex flex-col min-h-0 min-h-[calc(100dvh-13rem)] overflow-y-auto bg-[#F8F9FA] font-sans [overflow-anchor:auto] [isolation:isolate]">
        {/* Sticky Detail Top Bar: Single Compact Row */}
        <div className="sticky top-0 z-30 px-3 sm:px-6 py-2 bg-white/95 backdrop-blur-md border-b border-[#E5E5EA] flex items-center justify-between gap-2 shadow-xs shrink-0">
          {/* Left: Clean, unbordered < Back text/icon link */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={handleBackToSearch}
              className="inline-flex items-center gap-0.5 text-xs font-semibold text-[#007AFF] hover:text-[#0051A8] cursor-pointer transition-colors p-1 -ml-1"
            >
              <ChevronLeft className="w-4 h-4 shrink-0" />
              <span>Back</span>
            </button>
          </div>

          {/* Center: Title & Account ID with copy */}
          <div className="flex items-center justify-center gap-1.5 min-w-0 flex-1 px-1 text-center">
            <span className="text-xs font-bold text-[#1C1C1E] truncate hidden xs:inline">
              Account Bill History
            </span>
            <span className="text-xs font-bold text-[#1C1C1E] truncate xs:hidden">
              Bill History
            </span>
            <span className="text-[#8E8E93] hidden xs:inline">&bull;</span>
            <span className="font-mono text-xs font-semibold text-[#007AFF] tracking-tight truncate">
              {selectedAccountNo}
            </span>
            <button
              type="button"
              onClick={() => handleCopyAccountNo(selectedAccountNo)}
              className="text-[#8E8E93] hover:text-[#1C1C1E] p-1 rounded cursor-pointer transition-colors shrink-0"
              title="Copy account number"
            >
              {copiedAcc ? (
                <Check className="w-3.5 h-3.5 text-[#34C759]" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {/* Right Spacer to preserve perfect center alignment */}
          <div className="w-12 shrink-0" aria-hidden="true" />
        </div>

        {/* Loading Indicator */}
        {isLoadingDetail && !detailData && (
          <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
            <AppleSpinner size="md" className="text-[#007AFF]" />
            <span className="text-xs font-medium text-[#6C6C70]">
              Loading multi-year assessment bills for {selectedAccountNo}...
            </span>
          </div>
        )}

        {/* Error State */}
        {detailError && (
          <div className="m-4 lg:m-6 p-4 rounded-xl border border-[#FF3B30]/20 bg-[#FF3B30]/5 text-xs text-[#FF3B30]">
            <strong>Error:</strong> {detailError}
          </div>
        )}

        {/* Main Content Area */}
        {detailData && (
          <div className="p-3.5 sm:p-5 pb-8 space-y-4 max-w-7xl w-full mx-auto">
            {/* 1. RATEPAYER & PROPERTY PROFILE HEADER CARD */}
            <div className="bg-white rounded-xl border border-[#E5E5EA] p-3.5 sm:p-4 shadow-xs">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E5E5EA] pb-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm sm:text-base font-bold text-[#1C1C1E] truncate">
                      {prop?.name || 'Unnamed Ratepayer'}
                    </h2>
                    {prop?.ownerDigitalAddress && (
                      <span className="text-xs text-[#007AFF] flex items-center gap-1 font-mono font-medium whitespace-nowrap">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        {prop.ownerDigitalAddress}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#6C6C70] flex items-center gap-3 flex-wrap">
                    {prop?.telephone && (
                      <span className="flex items-center gap-1 whitespace-nowrap">
                        <Phone className="w-3 h-3 text-[#8E8E93] shrink-0" />
                        {prop.telephone}
                      </span>
                    )}
                    {prop?.houseNo && (
                      <span className="flex items-center gap-1 whitespace-nowrap">
                        <Home className="w-3 h-3 text-[#8E8E93] shrink-0" />
                        House {prop.houseNo}
                      </span>
                    )}
                    {prop?.electoral_area && (
                      <span className="whitespace-nowrap">Electoral Area: <strong className="text-[#1C1C1E] font-medium">{prop.electoral_area}</strong></span>
                    )}
                    {prop?.property_cat && (
                      <span className="whitespace-nowrap">Category: <strong className="text-[#1C1C1E] font-medium">{prop.property_cat}</strong></span>
                    )}
                  </p>
                </div>

                <div className="text-left sm:text-right shrink-0">
                  <span className="text-[11px] uppercase tracking-wider text-[#8E8E93] font-semibold block whitespace-nowrap">
                    Due
                  </span>
                  <span className="text-lg sm:text-xl font-bold text-[#FF3B30] tabular-nums whitespace-nowrap">
                    {formatGhc(Number(prop?.outstanding_amt || 0))}
                  </span>
                </div>
              </div>

              {/* Quick Metrics Bar (Clean Typography - Strictly ZERO PILLS) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 text-xs">
                <div>
                  <span className="text-[11px] text-[#8E8E93] block whitespace-nowrap">Value</span>
                  <span className="text-sm font-semibold text-[#1C1C1E] tabular-nums whitespace-nowrap">
                    {formatGhc(Number(prop?.rateableValue || 0))}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-[#8E8E93] block whitespace-nowrap">Arrears</span>
                  <span className="text-sm font-semibold text-[#1C1C1E] tabular-nums whitespace-nowrap">
                    {formatGhc(Number(prop?.arrears || 0))}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-[#8E8E93] block whitespace-nowrap">Bill Years</span>
                  <span className="text-sm font-semibold text-[#007AFF] tabular-nums whitespace-nowrap">
                    {summary?.recordedYearsCount || bills.length} {bills.length === 1 ? 'Year' : 'Years'}{' '}
                    {bills.length > 0 && `(${bills[bills.length - 1].billYear} - ${bills[0].billYear})`}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. MULTI-YEAR BILL DEMANDS SECTION */}
            <div className="space-y-2">
              {/* Apple HIG Section Header (Directly on canvas - NOT in a card) */}
              <div className="flex items-center gap-2 px-1">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#007AFF] shrink-0" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6C6C70]">
                    Assessment Demands
                  </h3>
                </div>
                <span className="font-mono text-xs font-medium text-[#007AFF] whitespace-nowrap">
                  ({bills.length} {bills.length === 1 ? 'Annual Bill' : 'Annual Bills'})
                </span>
              </div>

              {bills.length === 0 ? (
                <div className="bg-white rounded-2xl border border-[#E5E5EA] shadow-xs p-8 text-center text-xs text-[#8E8E93]">
                  No assessment bills found in the Bill registry for this account.
                </div>
              ) : (
                <>
                  {/* Desktop View (>= 768px): Multi-Year Comparison Table */}
                  <div className="hidden md:block bg-white rounded-xl border border-[#E5E5EA] shadow-xs overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-[#E5E5EA] bg-[#F8F9FA]/80 text-[11px] font-semibold text-[#6C6C70]">
                            <th className="py-2.5 px-4 text-center w-20 whitespace-nowrap">Bill Year</th>
                            <th className="py-2.5 px-4 w-28 whitespace-nowrap">Bill Date</th>
                            <th className="py-2.5 px-4 text-right w-32 whitespace-nowrap">Value</th>
                            <th className="py-2.5 px-4 text-right w-24 whitespace-nowrap">Rate PA</th>
                            <th className="py-2.5 px-4 text-right w-32 whitespace-nowrap">Arrears</th>
                            <th className="py-2.5 px-4 text-right w-36 bg-[#007AFF]/5 text-[#007AFF] whitespace-nowrap">
                              Balance
                            </th>
                            <th className="py-2.5 px-4 text-center w-24 whitespace-nowrap">Printed</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E5E5EA] bg-white">
                          {bills.map((bill) => (
                            <tr
                              key={bill.id}
                              className="hover:bg-[#F2F2F7]/50 transition-colors"
                            >
                              <td className="py-3 px-4 text-center font-bold text-sm text-[#007AFF] font-mono tabular-nums whitespace-nowrap">
                                {bill.billYear}
                              </td>
                              <td className="py-3 px-4 text-[#3A3A3C] tabular-nums whitespace-nowrap">
                                {bill.billYear ? `15 Jan ${bill.billYear}` : formatDateGb(bill.billDate)}
                              </td>
                              <td className="py-3 px-4 text-right font-medium text-[#1C1C1E] tabular-nums whitespace-nowrap">
                                {formatGhc(bill.rateableValue)}
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-[#6C6C70] tabular-nums whitespace-nowrap">
                                {bill.ratePA}
                              </td>
                              <td className="py-3 px-4 text-right text-[#6C6C70] tabular-nums whitespace-nowrap">
                                {formatGhc(bill.balanceBF)}
                              </td>
                              <td className="py-3 px-4 text-right font-bold text-[#1C1C1E] tabular-nums bg-[#007AFF]/5 whitespace-nowrap">
                                {formatGhc(bill.accountBalance)}
                              </td>
                              <td className="py-3 px-4 text-center whitespace-nowrap">
                                {bill.printed ? (
                                  <span className="text-[#34C759] text-[11px] font-medium">
                                    &bull; Printed
                                  </span>
                                ) : (
                                  <span className="text-[#8E8E93] text-[11px]">
                                    &bull; Pending
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Mobile View (< 768px): Unified Apple Inset-Grouped Card (NO nested cards) */}
                  <div className="block md:hidden bg-white rounded-2xl border border-[#E5E5EA] shadow-xs divide-y divide-[#E5E5EA] overflow-hidden">
                    {bills.map((bill) => (
                      <div
                        key={bill.id}
                        className="p-3.5 space-y-2 transition-colors"
                      >
                        {/* Row Header: Year & Date on Left, Status Dot on Right */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-sm text-[#007AFF] whitespace-nowrap">
                              {bill.billYear}
                            </span>
                            <span className="text-[11px] text-[#8E8E93] tabular-nums whitespace-nowrap">
                              {bill.billYear ? `15 Jan ${bill.billYear}` : formatDateGb(bill.billDate)}
                            </span>
                          </div>
                          <div className="shrink-0">
                            {bill.printed ? (
                              <span className="text-[#34C759] text-xs font-semibold whitespace-nowrap">
                                &bull; Printed
                              </span>
                            ) : (
                              <span className="text-[#8E8E93] text-xs font-medium whitespace-nowrap">
                                &bull; Pending
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 4-Metric Grid with Protected Wrapping & Bold Balance */}
                        <div className="grid grid-cols-2 gap-2 text-xs pt-0.5">
                          <div>
                            <span className="text-[10px] uppercase font-semibold text-[#8E8E93] block whitespace-nowrap">
                              Value
                            </span>
                            <span className="font-medium text-[#1C1C1E] tabular-nums whitespace-nowrap">
                              {formatGhc(bill.rateableValue)}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-semibold text-[#8E8E93] block whitespace-nowrap">
                              Rate PA
                            </span>
                            <span className="font-mono text-[#6C6C70] tabular-nums whitespace-nowrap">
                              {bill.ratePA}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-semibold text-[#8E8E93] block whitespace-nowrap">
                              Arrears
                            </span>
                            <span className="font-medium text-[#6C6C70] tabular-nums whitespace-nowrap">
                              {formatGhc(bill.balanceBF)}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-semibold text-[#8E8E93] block whitespace-nowrap">
                              Balance
                            </span>
                            <span className="font-bold text-[#1C1C1E] tabular-nums whitespace-nowrap">
                              {formatGhc(bill.accountBalance)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  const isColVisible = (key: string) => {
    if (!visibleColumnKeys || visibleColumnKeys.length === 0) return true;
    if (key === 'accountNumber') return visibleColumnKeys.includes('accountNumber') || visibleColumnKeys.includes('accountNo');
    if (key === 'outstandingAmount') return visibleColumnKeys.includes('outstandingAmount') || visibleColumnKeys.includes('outstanding_amt');
    return visibleColumnKeys.includes(key);
  };

  // =========================================================================
  // ACCOUNTS LIST VIEW: SEARCH ACCOUNTS BY GPS, ACCOUNT NO, NAME, PHONE
  // =========================================================================
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white font-sans">
      {/* Search Toolbar (only if not hidden externally) */}
      {!hideToolbar && (
        <div className="px-4 lg:px-6 py-2.5 border-b border-[#E5E5EA] flex flex-wrap items-center justify-between gap-3 bg-white shrink-0">
          {/* Left: Title & Explainer */}
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-[#1C1C1E] flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-[#007AFF]" />
                Account Multi-Year Bill History
              </span>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Multi-Identifier Search Input */}
            <div className="relative w-64 sm:w-80">
              <Search className="w-3.5 h-3.5 text-[#8E8E93] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search GPS (e.g. GK-0021), Account, Name, Phone..."
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
                className="w-full h-8 pl-8 pr-7 rounded-lg border border-[#E5E5EA] bg-[#F2F2F7] text-xs text-[#1C1C1E] placeholder-[#8E8E93] focus:outline-none focus:border-[#007AFF] focus:bg-white transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8E8E93] hover:text-[#1C1C1E] p-0.5 rounded cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Switch to Raw Table */}
            <button
              type="button"
              onClick={() => setSubView('raw_table')}
              className="apple-btn-secondary h-8 px-2.5 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer text-[#6C6C70] border-[#E5E5EA] hover:bg-[#F2F2F7]"
              title="Switch to flat 61,263 Bill table"
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Raw Bill Table</span>
            </button>
          </div>
        </div>
      )}

      {/* Error state */}
      {searchError && (
        <div className="m-4 p-3 rounded-lg border border-[#FF3B30]/20 bg-[#FF3B30]/5 text-xs text-[#FF3B30] flex items-center justify-between">
          <span>{searchError}</span>
          <button
            type="button"
            onClick={fetchAccounts}
            className="text-xs font-semibold underline ml-3 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Accounts Table Container */}
      <div ref={accountsScrollRef} onScroll={onTableScroll} className="flex-1 min-h-0 min-h-[calc(100dvh-13rem)] overflow-auto [overflow-anchor:auto] [isolation:isolate]">
        {/* Desktop View (>= 768px): Wide Table */}
        <div className="hidden md:block">
          <table className="w-full min-w-[1100px] text-left text-xs border-collapse">
          <thead className="border-b border-[#E5E5EA] bg-[#F8F9FA] text-[11px] font-semibold text-[#6C6C70] sticky top-0 z-20">
            <tr>
              {isColVisible('accountNumber') && <th className="py-2.5 px-4 w-36">Account No</th>}
              {isColVisible('name') && <th className="py-2.5 px-4 w-52">Ratepayer Name</th>}
              {isColVisible('ownerDigitalAddress') && <th className="py-2.5 px-4 w-44">GhanaPost GPS</th>}
              {isColVisible('telephone') && <th className="py-2.5 px-4 w-36">Phone / Contact</th>}
              {isColVisible('electoral_area') && <th className="py-2.5 px-4 w-36">Electoral Area</th>}
              {isColVisible('recordedYears') && <th className="py-2.5 px-4 w-48 text-center">Recorded Bill Years</th>}
              {isColVisible('rateableValue') && <th className="py-2.5 px-4 text-right w-32">Rateable Value</th>}
              {isColVisible('outstandingAmount') && <th className="py-2.5 px-4 text-right w-36">Current Outstanding</th>}
              <th className="py-2.5 px-4 text-center w-36">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E5EA] bg-white">
            {isLoadingAccounts ? (
              Array.from({ length: 12 }).map((_, i) => (
                <tr key={`skel-${i}`} className="animate-pulse">
                  {isColVisible('accountNumber') && <td className="py-3 px-4"><div className="h-4 bg-gray-200 rounded w-24" /></td>}
                  {isColVisible('name') && <td className="py-3 px-4"><div className="h-4 bg-gray-200 rounded w-40" /></td>}
                  {isColVisible('ownerDigitalAddress') && <td className="py-3 px-4"><div className="h-4 bg-gray-200 rounded w-28" /></td>}
                  {isColVisible('telephone') && <td className="py-3 px-4"><div className="h-4 bg-gray-200 rounded w-24" /></td>}
                  {isColVisible('electoral_area') && <td className="py-3 px-4"><div className="h-4 bg-gray-200 rounded w-28" /></td>}
                  {isColVisible('recordedYears') && <td className="py-3 px-4 text-center"><div className="h-4 bg-gray-200 rounded w-32 mx-auto" /></td>}
                  {isColVisible('rateableValue') && <td className="py-3 px-4 text-right"><div className="h-4 bg-gray-200 rounded w-20 ml-auto" /></td>}
                  {isColVisible('outstandingAmount') && <td className="py-3 px-4 text-right"><div className="h-4 bg-gray-200 rounded w-24 ml-auto" /></td>}
                  <td className="py-3 px-4 text-center"><div className="h-4 bg-gray-200 rounded w-24 mx-auto" /></td>
                </tr>
              ))
            ) : accounts.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-16 text-center text-xs text-[#8E8E93]">
                  No property ratepayer accounts found matching "{debouncedSearch}".
                </td>
              </tr>
            ) : (
              accounts.map((acc) => (
                <tr
                  key={acc.accountNumber}
                  onClick={() => handleSelectAccount(acc.accountNumber)}
                  className="hover:bg-[#007AFF]/5 cursor-pointer transition-colors group"
                >
                  {isColVisible('accountNumber') && (
                    <td className="py-3 px-4 font-mono font-semibold text-[#007AFF] group-hover:underline">
                      {acc.accountNumber}
                    </td>
                  )}
                  {isColVisible('name') && (
                    <td className="py-3 px-4 font-medium text-[#1C1C1E] truncate max-w-[200px]" title={acc.name}>
                      {acc.name}
                    </td>
                  )}
                  {isColVisible('ownerDigitalAddress') && (
                    <td className="py-3 px-4 font-mono text-[11px] text-[#3A3A3C]">
                      {acc.ownerDigitalAddress ? (
                        <span className="flex items-center gap-1 text-[#007AFF]">
                          <MapPin className="w-3 h-3 shrink-0" />
                          {acc.ownerDigitalAddress}
                        </span>
                      ) : (
                        <span className="text-[#C7C7CC]">—</span>
                      )}
                    </td>
                  )}
                  {isColVisible('telephone') && (
                    <td className="py-3 px-4 text-[#6C6C70] tabular-nums">
                      {acc.telephone || (acc.houseNo ? `House ${acc.houseNo}` : '—')}
                    </td>
                  )}
                  {isColVisible('electoral_area') && (
                    <td className="py-3 px-4 text-[#6C6C70] truncate max-w-[140px]">
                      {acc.electoralArea || '—'}
                    </td>
                  )}
                  {isColVisible('recordedYears') && (
                    <td className="py-3 px-4 text-center">
                      {acc.recordedYears.length > 0 ? (
                        <span className="text-[11px] font-medium text-[#1C1C1E]">
                          {acc.recordedYears.length} {acc.recordedYears.length === 1 ? 'Year' : 'Years'} ({acc.recordedYears.join(', ')})
                        </span>
                      ) : (
                        <span className="text-[11px] text-[#8E8E93]">No bills recorded</span>
                      )}
                    </td>
                  )}
                  {isColVisible('rateableValue') && (
                    <td className="py-3 px-4 text-right font-medium text-[#1C1C1E] tabular-nums">
                      {formatGhc(acc.rateableValue)}
                    </td>
                  )}
                  {isColVisible('outstandingAmount') && (
                    <td className="py-3 px-4 text-right font-bold text-[#FF3B30] tabular-nums">
                      {formatGhc(acc.outstandingAmount)}
                    </td>
                  )}
                  <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => handleSelectAccount(acc.accountNumber)}
                      className="apple-btn-secondary h-7 px-2.5 rounded-md text-xs font-semibold inline-flex items-center gap-1 cursor-pointer text-[#007AFF] border-[#007AFF]/20 hover:bg-[#007AFF]/10 transition-colors"
                      title="Load all years and bills for this account"
                    >
                      <span>View Bills</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>

        {/* Mobile View (< 768px): Account Bill History Cards */}
        <div className="block md:hidden p-3 space-y-3 bg-[#F8F9FA]/70">
          {isLoadingAccounts ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={`mob-acc-skel-${i}`} className="bg-white rounded-xl border border-[#E5E5EA] p-4 space-y-2.5 animate-pulse">
                <div className="flex justify-between">
                  <div className="h-4 w-28 bg-[#E5E5EA] rounded" />
                  <div className="h-4 w-20 bg-[#E5E5EA] rounded" />
                </div>
                <div className="h-4 w-44 bg-[#E5E5EA] rounded" />
                <div className="h-3 w-32 bg-[#E5E5EA] rounded" />
              </div>
            ))
          ) : accounts.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#8E8E93]">
              No property ratepayer accounts found matching "{debouncedSearch}".
            </div>
          ) : (
            accounts.map((acc) => (
              <div
                key={acc.accountNumber}
                onClick={() => handleSelectAccount(acc.accountNumber)}
                className="bg-white rounded-xl border border-[#E5E5EA] p-4 shadow-2xs space-y-3 active:bg-[#F2F2F7] transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2 border-b border-[#E5E5EA]/70 pb-2.5">
                  <div className="min-w-0">
                    <span className="font-mono font-bold text-xs text-[#007AFF] block whitespace-nowrap">
                      {acc.accountNumber}
                    </span>
                    <h3 className="text-sm font-semibold text-[#1C1C1E] mt-0.5 truncate">
                      {acc.name || "Unnamed Ratepayer"}
                    </h3>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] uppercase tracking-wider text-[#8E8E93] font-semibold block whitespace-nowrap">
                      Outstanding
                    </span>
                    <span className="text-sm font-bold text-[#FF3B30] tabular-nums whitespace-nowrap">
                      {formatGhc(acc.outstandingAmount)}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-[#6C6C70]">
                  {acc.ownerDigitalAddress && (
                    <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#3A3A3C]">
                      <MapPin className="w-3.5 h-3.5 text-[#007AFF] shrink-0" />
                      <span className="truncate whitespace-nowrap">{acc.ownerDigitalAddress}</span>
                    </div>
                  )}
                  {acc.telephone && (
                    <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#3A3A3C]">
                      <Phone className="w-3.5 h-3.5 text-[#8E8E93] shrink-0" />
                      <a
                        href={`tel:${acc.telephone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="hover:underline text-[#007AFF] whitespace-nowrap"
                      >
                        {acc.telephone}
                      </a>
                    </div>
                  )}
                  {acc.electoralArea && (
                    <div className="text-[11px] text-[#6C6C70] truncate">
                      Electoral Area: <strong className="text-[#1C1C1E] font-medium">{acc.electoralArea}</strong>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[11px] pt-1 gap-2 flex-wrap">
                    <span className="whitespace-nowrap">
                      Recorded: <strong className="text-[#1C1C1E]">{acc.recordedYears.length} {acc.recordedYears.length === 1 ? 'Year' : 'Years'}</strong>
                      {acc.recordedYears.length > 0 && ` (${acc.recordedYears.join(', ')})`}
                    </span>
                    <span className="text-[#8E8E93] tabular-nums whitespace-nowrap">
                      Val: {formatGhc(acc.rateableValue)}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectAccount(acc.accountNumber);
                  }}
                  className="w-full h-9 rounded-lg apple-btn-secondary text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer text-[#007AFF] border-[#007AFF]/20 hover:bg-[#007AFF]/5 transition-colors"
                >
                  <span>View All Bills & Statements</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="px-3 sm:px-4 lg:px-6 py-2 border-t border-[#E5E5EA] flex flex-wrap items-center justify-between gap-2 sm:gap-3 shrink-0 sticky bottom-0 z-20 bg-white/95 backdrop-blur-md shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#6C6C70]">
              Showing <strong className="text-[#1C1C1E]">{currentPage}</strong> of{' '}
              <strong className="text-[#1C1C1E]">{totalPages}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5 text-xs text-[#6C6C70]">
              <span className="hidden xs:inline">Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="h-8 px-2 rounded-lg border border-[#E5E5EA] bg-white text-xs text-[#1C1C1E] focus:outline-none focus:border-[#007AFF] cursor-pointer"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1 || isLoadingAccounts}
                className="h-8 w-8 rounded-lg border border-[#E5E5EA] bg-white text-[#1C1C1E] hover:bg-[#F2F2F7] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors flex items-center justify-center active:scale-95"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[11px] font-semibold text-[#1C1C1E] sm:hidden px-1">
                {currentPage}/{totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages || isLoadingAccounts}
                className="h-8 w-8 rounded-lg border border-[#E5E5EA] bg-white text-[#1C1C1E] hover:bg-[#F2F2F7] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors flex items-center justify-center active:scale-95"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
