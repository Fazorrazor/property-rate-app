'use client';

import React, { useState, useEffect, useTransition, useCallback, useRef } from 'react';
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Database,
  ArrowUpDown,
} from 'lucide-react';
import {
  DatabaseTableDefinition,
  ColumnDefinition,
} from '@/lib/database-tables-config';
import { getDatabaseTableRecords } from '@/app/actions';
import { formatGhc, formatDateGb } from '@/lib/formatters';
import { AppleSpinner } from '@/components/ui/AppleSpinner';

interface UniversalDatabaseTableProps {
  tableDef: DatabaseTableDefinition;
  visibleColumnKeys?: string[];
  hideToolbar?: boolean;
  externalSearchQuery?: string;
  onCountChange?: (count: number, total: number) => void;
  onTableScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
  mobileHeaderSlot?: React.ReactNode;
}

export function UniversalDatabaseTable({
  tableDef,
  visibleColumnKeys,
  hideToolbar = false,
  externalSearchQuery,
  onCountChange,
  onTableScroll,
  mobileHeaderSlot,
}: UniversalDatabaseTableProps) {
  const [data, setData] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [expandedRowKeys, setExpandedRowKeys] = useState<Set<string | number>>(new Set());
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string | number, HTMLDivElement>>(new Map());

  const toggleRowExpand = (key: string | number) => {
    setExpandedRowKeys((prev) => {
      const isOpening = !prev.has(key);
      if (isOpening) {
        // Accordion: close any open card, open only this one
        requestAnimationFrame(() => {
          const card = cardRefs.current.get(key);
          card?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
        return new Set([key]);
      }
      // Tapping the open card collapses it
      return new Set();
    });
  };

  // Scroll to top of table when moving between pages
  useEffect(() => {
    tableContainerRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, [currentPage]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>(tableDef.defaultSort.column);
  const [sortAscending, setSortAscending] = useState<boolean>(tableDef.defaultSort.ascending);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Reset state when switching table
  useEffect(() => {
    setCurrentPage(1);
    setSearchQuery('');
    setDebouncedSearch('');
    setSortBy(tableDef.defaultSort.column);
    setSortAscending(tableDef.defaultSort.ascending);
  }, [tableDef.id]);

  // Debounce search query (internal or external)
  useEffect(() => {
    const q = externalSearchQuery !== undefined ? externalSearchQuery : searchQuery;
    const timer = setTimeout(() => {
      setDebouncedSearch(q);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, externalSearchQuery]);

  // Compute effective visible columns
  const effectiveColumns = React.useMemo(() => {
    if (!visibleColumnKeys || visibleColumnKeys.length === 0) {
      return tableDef.columns;
    }
    const filtered = tableDef.columns.filter((c) => visibleColumnKeys.includes(c.key));
    return filtered.length > 0 ? filtered : tableDef.columns;
  }, [tableDef.columns, visibleColumnKeys]);

  // Fetch records
  const fetchRecords = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await getDatabaseTableRecords({
        tableName: tableDef.id,
        page: currentPage,
        pageSize,
        searchQuery: debouncedSearch,
        sortBy,
        sortAscending,
      });

      if (!res.success) {
        setErrorMessage(res.error || 'Failed to load records.');
        setData([]);
        setTotalCount(0);
        setTotalPages(1);
      } else {
        setData(res.data || []);
        setTotalCount(res.totalCount ?? 0);
        setTotalPages(res.totalPages ?? 1);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Network error fetching table records.');
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, [tableDef.id, currentPage, pageSize, debouncedSearch, sortBy, sortAscending]);

  useEffect(() => {
    startTransition(() => {
      fetchRecords();
    });
  }, [fetchRecords]);

  // Notify parent of count updates
  useEffect(() => {
    onCountChange?.(data.length, totalCount);
  }, [data.length, totalCount, onCountChange]);

  // Handle column header sorting
  const handleSort = (columnKey: string) => {
    if (sortBy === columnKey) {
      setSortAscending(!sortAscending);
    } else {
      setSortBy(columnKey);
      setSortAscending(true);
    }
    setCurrentPage(1);
  };

  // Render cell value according to column definition
  const renderCellValue = (row: any, col: ColumnDefinition) => {
    const val = row[col.key];
    if (val === null || val === undefined || val === '') {
      return <span className="text-[#C7C7CC]">—</span>;
    }

    switch (col.type) {
      case 'currency':
        return (
          <span className="tabular-nums font-medium text-[#1C1C1E]">
            {formatGhc(val)}
          </span>
        );
      case 'date':
        return (
          <span className="tabular-nums text-[#3A3A3C]">
            {formatDateGb(val)}
          </span>
        );
      case 'number':
        return (
          <span className="tabular-nums text-[#3A3A3C]">
            {typeof val === 'number' ? val.toLocaleString() : val}
          </span>
        );
      case 'boolean':
        return (
          <span className={`text-[11px] font-medium ${val ? 'text-[#34C759]' : 'text-[#8E8E93]'}`}>
            {val ? 'Yes' : 'No'}
          </span>
        );
      default:
        return (
          <span className="text-[#1C1C1E] truncate block" title={String(val)}>
            {String(val)}
          </span>
        );
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white">
      {/* Table Toolbar (only if not hidden externally) */}
      {!hideToolbar && (
        <div className="px-4 lg:px-6 py-2.5 border-b border-[#E5E5EA] flex flex-wrap items-center justify-between gap-3 bg-white shrink-0">
          {/* Left: Table Title & Description */}
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-[#1C1C1E] flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-[#007AFF]" />
                {tableDef.label}
              </span>
              <span className="text-[11px] text-[#8E8E93] tabular-nums font-mono">
                ({totalCount.toLocaleString()} {totalCount === 1 ? 'record' : 'records'})
              </span>
            </div>
          </div>

          {/* Right: Search, Refresh, Export Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search Input */}
            <div className="relative w-48 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#8E8E93]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${tableDef.name}...`}
                className="w-full pl-8 pr-7 py-1.5 bg-[#F2F2F7] border border-[#E5E5EA] rounded-lg text-xs text-[#1C1C1E] placeholder-[#8E8E93] focus:outline-none focus:border-[#007AFF] focus:bg-white transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-2 text-[#8E8E93] hover:text-[#1C1C1E] cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>


          </div>
        </div>
      )}

      {/* Table Content Area */}
      <div ref={tableContainerRef} onScroll={onTableScroll} className="flex-1 min-h-0 min-h-[calc(100dvh-13rem)] overflow-auto relative [overflow-anchor:auto] [isolation:isolate]">
        {mobileHeaderSlot && (
          <div className="block md:hidden sticky top-0 z-30 [overflow-anchor:none]">
            {mobileHeaderSlot}
          </div>
        )}
        {isLoading && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] z-20 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <AppleSpinner size="md" />
              <span className="text-xs text-[#6C6C70]">Loading {tableDef.name}...</span>
            </div>
          </div>
        )}

        {isLoading && data.length === 0 && (
          <div className="p-4 space-y-3 min-h-[calc(100dvh-13rem)]" aria-hidden="true">
            <div className="hidden md:block space-y-2">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="h-8 w-full bg-[#E5E5EA]/40 rounded animate-pulse" />
              ))}
            </div>
            <div className="block md:hidden space-y-2.5">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-20 w-full bg-[#E5E5EA]/40 rounded-xl animate-pulse" />
              ))}
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="p-6 text-center">
            <p className="text-xs text-[#FF3B30] mb-2">{errorMessage}</p>
            <button
              type="button"
              onClick={fetchRecords}
              className="text-xs font-medium text-[#007AFF] underline cursor-pointer"
            >
              Try again
            </button>
          </div>
        )}

        {!isLoading && !errorMessage && data.length === 0 && (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <Database className="w-8 h-8 text-[#C7C7CC] mb-2" />
            <p className="text-xs font-medium text-[#1C1C1E]">No records found in {tableDef.name}</p>
            <p className="text-[11px] text-[#8E8E93] mt-1 max-w-sm">
              {debouncedSearch
                ? `No results match "${debouncedSearch}". Try clearing the search filter.`
                : 'This municipal table currently contains zero entries in the cadastre.'}
            </p>
          </div>
        )}

        {data.length > 0 && (
          <>
            {/* Desktop View (>= 768px): Supabase Studio High-Density Table */}
            <div className="hidden md:inline-block min-w-full align-middle">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F9F9FB] border-b border-[#E5E5EA] sticky top-0 z-10">
                    <th className="py-2.5 px-3 font-semibold text-[#8E8E93] text-[11px] w-12 text-center select-none">
                      #
                    </th>
                    {effectiveColumns.map((col) => {
                      const isSorted = sortBy === col.key;
                      return (
                        <th
                          key={col.key}
                          onClick={() => handleSort(col.key)}
                          style={{ width: col.width }}
                          className={`py-2.5 px-3 font-semibold text-[11px] text-[#6C6C70] select-none cursor-pointer hover:bg-[#E5E5EA]/40 transition-colors ${
                            col.align === 'right'
                              ? 'text-right'
                              : col.align === 'center'
                              ? 'text-center'
                              : 'text-left'
                          }`}
                        >
                          <div
                            className={`flex items-center gap-1.5 ${
                              col.align === 'right'
                                ? 'justify-end'
                                : col.align === 'center'
                                ? 'justify-center'
                                : 'justify-start'
                            }`}
                          >
                            <span className={isSorted ? 'text-[#007AFF] font-bold' : ''}>
                              {col.label}
                            </span>
                            <ArrowUpDown
                              className={`w-3 h-3 ${
                                isSorted ? 'text-[#007AFF]' : 'text-[#C7C7CC] opacity-50'
                              }`}
                            />
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E5EA]/60">
                  {data.map((row, index) => {
                    const rowNumber = (currentPage - 1) * pageSize + index + 1;
                    return (
                      <tr
                        key={row[tableDef.primaryKey] || index}
                        className="hover:bg-[#F2F2F7]/50 transition-colors"
                      >
                        <td className="py-2 px-3 text-center text-[11px] text-[#8E8E93] tabular-nums font-mono">
                          {rowNumber}
                        </td>
                        {effectiveColumns.map((col) => (
                          <td
                            key={col.key}
                            className={`py-2 px-3 text-xs ${
                              col.align === 'right'
                                ? 'text-right'
                                : col.align === 'center'
                                ? 'text-center'
                                : 'text-left'
                            }`}
                          >
                            {renderCellValue(row, col)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile View (< 768px): Apple HIG Progressive Disclosure Record Cards */}
            <div className="block md:hidden p-3 space-y-2 bg-[#F8F9FA]/70">
              {data.map((row, index) => {
                const rowNumber = (currentPage - 1) * pageSize + index + 1;
                const rowKey = row[tableDef.primaryKey] !== undefined ? row[tableDef.primaryKey] : index;
                const isExpanded = expandedRowKeys.has(rowKey);

                // Identify primary display columns
                const primaryVal = row[tableDef.primaryKey];
                const currencyCol = effectiveColumns.find((c) => c.type === 'currency');
                const dateCol = effectiveColumns.find((c) => c.type === 'date');
                const secondaryTextCol = effectiveColumns.find(
                  (c) => c.key !== tableDef.primaryKey && c !== currencyCol && c !== dateCol
                );

                return (
                  <div
                    key={rowKey}
                    ref={(el) => {
                      if (el) cardRefs.current.set(rowKey, el);
                      else cardRefs.current.delete(rowKey);
                    }}
                    className="bg-white rounded-xl border border-[#E5E5EA] shadow-2xs overflow-hidden transition-all duration-200"
                  >
                    {/* Collapsed Summary Header (Always Visible - Tap to Expand/Collapse) */}
                    <button
                      type="button"
                      onClick={() => toggleRowExpand(rowKey)}
                      className="w-full text-left p-3 flex flex-col gap-1.5 cursor-pointer hover:bg-[#F9F9FB] active:bg-[#F2F2F7] transition-colors"
                      aria-expanded={isExpanded}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[10px] font-mono text-[#8E8E93]">#{rowNumber}</span>
                          <span className="text-xs font-mono font-bold text-[#007AFF] truncate">
                            {primaryVal !== undefined && primaryVal !== null ? String(primaryVal) : `Record #${rowNumber}`}
                          </span>
                        </div>

                        {currencyCol && (
                          <div className="text-xs font-bold text-[#1C1C1E] tabular-nums shrink-0">
                            {renderCellValue(row, currencyCol)}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 text-[11px] text-[#6C6C70]">
                        <div className="truncate min-w-0">
                          {secondaryTextCol ? (
                            <span>
                              <span className="text-[#8E8E93]">{secondaryTextCol.label}: </span>
                              <span className="text-[#1C1C1E] font-medium">{renderCellValue(row, secondaryTextCol)}</span>
                            </span>
                          ) : (
                            <span className="text-[#8E8E93]">{tableDef.name}</span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0 text-[#8E8E93]">
                          {dateCol && (
                            <span className="text-[10px]">{renderCellValue(row, dateCol)}</span>
                          )}
                          <ChevronDown
                            className={`w-3.5 h-3.5 text-[#8E8E93] transition-transform duration-200 ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                          />
                        </div>
                      </div>
                    </button>

                    {/* Expandable Full Key-Value Details */}
                    {isExpanded && (
                      <div className="px-3 pb-3 pt-1 border-t border-[#F2F2F7] space-y-1.5 text-xs bg-[#FAFAFC]">
                        {effectiveColumns
                          .filter((col) => col.key !== tableDef.primaryKey)
                          .map((col) => (
                            <div
                              key={col.key}
                              className="flex items-baseline justify-between gap-2 py-1 border-b border-[#F2F2F7] last:border-b-0"
                            >
                              <span className="text-[10px] uppercase font-semibold text-[#8E8E93] tracking-wide shrink-0">
                                {col.label}
                              </span>
                              <span className="text-xs text-[#1C1C1E] text-right font-medium truncate max-w-[65%]">
                                {renderCellValue(row, col)}
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Table Pagination Bar */}
      <div className="sticky bottom-0 z-20 px-3 sm:px-4 lg:px-6 py-2 border-t border-[#E5E5EA] flex flex-wrap items-center justify-between gap-2 sm:gap-3 bg-white/95 backdrop-blur-md shrink-0 text-xs text-[#6C6C70] shadow-2xs">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="text-[11px] hidden xs:inline">Rows:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="h-8 px-2 bg-white border border-[#E5E5EA] rounded-lg text-xs text-[#1C1C1E] focus:outline-none focus:border-[#007AFF] cursor-pointer"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span className="text-[#E5E5EA]">•</span>
          <span className="text-[11px] tabular-nums font-sans">
            Showing {totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1}–
            {Math.min(currentPage * pageSize, totalCount)} of {totalCount.toLocaleString()}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] tabular-nums hidden sm:inline">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage <= 1 || isLoading}
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
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage >= totalPages || isLoading}
              className="h-8 w-8 rounded-lg border border-[#E5E5EA] bg-white text-[#1C1C1E] hover:bg-[#F2F2F7] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors flex items-center justify-center active:scale-95"
              title="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
