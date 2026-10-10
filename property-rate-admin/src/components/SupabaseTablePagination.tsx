"use client";

import React, { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AppleSpinner } from "./ui/AppleSpinner";

export interface SupabaseTablePaginationProps {
  currentPage: number;
  totalPages: number;
  totalRecords: number;
  pageSize: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  isLoading?: boolean;
  entityLabel?: string;
  className?: string;
}

export function SupabaseTablePagination({
  currentPage,
  totalPages,
  totalRecords,
  pageSize,
  pageSizeOptions = [25, 50, 100],
  onPageChange,
  onPageSizeChange,
  isLoading = false,
  entityLabel = "records",
  className = "",
}: SupabaseTablePaginationProps) {
  const [pageInput, setPageInput] = useState(String(currentPage));

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  const maxPages = Math.max(1, totalPages);

  const commitPageJump = () => {
    const parsed = parseInt(pageInput, 10);
    if (isNaN(parsed)) {
      setPageInput(String(currentPage));
      return;
    }
    const clamped = Math.min(Math.max(1, parsed), maxPages);
    setPageInput(String(clamped));
    if (clamped !== currentPage) {
      onPageChange(clamped);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      commitPageJump();
    } else if (e.key === "Escape") {
      setPageInput(String(currentPage));
    }
  };

  const canGoPrev = currentPage > 1 && !isLoading;
  const canGoNext = currentPage < maxPages && !isLoading;

  return (
    <div
      className={`sticky bottom-0 z-20 px-3 sm:px-4 py-2 sm:py-2.5 border-t border-[#E5E5EA] bg-white/95 backdrop-blur-md flex items-center justify-between gap-2 text-xs shrink-0 select-none shadow-2xs ${className}`}
    >
      {/* Left: Page Navigator [ < ] Page [ 1 ] of 161 [ > ] */}
      <div className="flex items-center gap-1 sm:gap-2">
        <button
          type="button"
          onClick={() => canGoPrev && onPageChange(currentPage - 1)}
          disabled={!canGoPrev}
          title="Previous Page"
          className="h-8 w-8 min-w-[32px] rounded-lg border border-[#E5E5EA] bg-white hover:bg-[#F2F2F7] disabled:opacity-35 disabled:hover:bg-white disabled:cursor-not-allowed flex items-center justify-center text-[#1C1C1E] active:scale-95 transition-all duration-150 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <span className="text-[#6C6C70] font-medium hidden xs:inline">Page</span>

        <div className="relative flex items-center">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value.replace(/[^0-9]/g, ""))}
            onBlur={commitPageJump}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            className="h-8 w-10 sm:w-12 text-center text-xs font-semibold rounded-lg border border-[#E5E5EA] bg-[#F8F9FA] hover:bg-white focus:bg-white text-[#1C1C1E] focus:outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] transition-colors tabular-nums"
          />
        </div>

        <span className="text-[#6C6C70] font-medium text-[11px] sm:text-xs">
          of <strong className="text-[#1C1C1E] font-semibold tabular-nums">{maxPages.toLocaleString()}</strong>
        </span>

        <button
          type="button"
          onClick={() => canGoNext && onPageChange(currentPage + 1)}
          disabled={!canGoNext}
          title="Next Page"
          className="h-8 w-8 min-w-[32px] rounded-lg border border-[#E5E5EA] bg-white hover:bg-[#F2F2F7] disabled:opacity-35 disabled:hover:bg-white disabled:cursor-not-allowed flex items-center justify-center text-[#1C1C1E] active:scale-95 transition-all duration-150 cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {isLoading && (
          <AppleSpinner size="xs" className="text-[#007AFF] ml-0.5" />
        )}
      </div>

      {/* Right: Page Size Selector & Total Records Count */}
      <div className="flex items-center gap-2 sm:gap-4 shrink-0 text-right">
        {onPageSizeChange && (
          <div className="hidden sm:flex items-center gap-1.5">
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              disabled={isLoading}
              className="h-8 px-2.5 rounded-lg border border-[#E5E5EA] bg-white hover:bg-[#F8F9FA] text-xs font-medium text-[#1C1C1E] focus:outline-none focus:border-[#007AFF] cursor-pointer transition-colors"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} rows
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="text-[#6C6C70] font-normal tabular-nums text-[11px] sm:text-xs">
          <strong className="text-[#1C1C1E] font-semibold">
            {totalRecords.toLocaleString()}
          </strong>{" "}
          {entityLabel}
        </div>
      </div>
    </div>
  );
}
