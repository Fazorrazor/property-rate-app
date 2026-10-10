"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Database, ChevronDown, Search, X, Check } from "lucide-react";
import {
  DATABASE_TABLE_DEFINITIONS,
  ORDERED_TABLE_GROUPS,
  DatabaseTableDefinition,
} from "@/lib/database-tables-config";

interface TableFilterPopoverProps {
  selectedTable: string;
  onSelectTable: (tableName: string) => void;
  align?: "left" | "right";
  allowedTables?: string[];
}

export function TableFilterPopover({
  selectedTable,
  onSelectTable,
  align = "right",
  allowedTables,
}: TableFilterPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left?: number; right?: number } | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setMounted(true);
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile, { passive: true });
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const computePosition = () => {
    if (!buttonRef.current || window.innerWidth < 640) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const popoverHeight = 440;
    const popoverWidth = Math.min(420, viewportWidth - 32);

    let top = rect.bottom + 6;
    if (top + popoverHeight > viewportHeight && rect.top - 6 - popoverHeight > 10) {
      top = rect.top - 6 - popoverHeight;
    }

    let left: number | undefined = undefined;
    let right: number | undefined = undefined;

    if (align === "right") {
      const rightFromEdge = Math.max(12, viewportWidth - rect.right);
      if (viewportWidth - rightFromEdge - popoverWidth < 12) {
        left = 12;
      } else {
        right = rightFromEdge;
      }
    } else {
      left = Math.max(12, Math.min(viewportWidth - popoverWidth - 12, rect.left));
    }

    setDropdownPos({ top, left, right });
  };

  useEffect(() => {
    if (isOpen) {
      computePosition();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isOpen &&
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    const handleScroll = (e: Event) => {
      if (!isOpen) return;
      if (containerRef.current && e.target && containerRef.current.contains(e.target as Node)) {
        return;
      }
      computePosition();
    };
    const handleResize = () => {
      if (isOpen) computePosition();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScroll, { passive: true, capture: true });
    window.addEventListener("resize", handleResize, { passive: true });
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Filter tables by allowedTables and search query
  const filteredGroups = useMemo(() => {
    let baseGroups = ORDERED_TABLE_GROUPS;
    if (allowedTables && allowedTables.length > 0) {
      baseGroups = baseGroups
        .map((group) => ({
          ...group,
          tables: group.tables.filter((t) => allowedTables.includes(t.id) || allowedTables.includes(t.name)),
        }))
        .filter((group) => group.tables.length > 0);
    }

    const q = searchQuery.trim().toLowerCase();
    if (!q) return baseGroups;

    return baseGroups
      .map((group) => ({
        ...group,
        tables: group.tables.filter(
          (t) =>
            t.name.toLowerCase().includes(q) ||
            t.label.toLowerCase().includes(q) ||
            t.description.toLowerCase().includes(q)
        ),
      }))
      .filter((group) => group.tables.length > 0);
  }, [searchQuery, allowedTables]);

  const totalTablesCount = useMemo(() => {
    return filteredGroups.reduce((acc, g) => acc + g.tables.length, 0);
  }, [filteredGroups]);

  const activeTableDef = DATABASE_TABLE_DEFINITIONS[selectedTable] || DATABASE_TABLE_DEFINITIONS.Property;

  const handleSelect = (tableName: string) => {
    onSelectTable(tableName);
    setIsOpen(false);
  };

  return (
    <div className="relative shrink-0 z-40">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (!isOpen) computePosition();
          setIsOpen((prev) => !prev);
        }}
        className={`h-8 px-3 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
          selectedTable !== "Property"
            ? "bg-[#007AFF] text-white border-[#007AFF] shadow-xs"
            : "bg-[#F2F2F7] text-[#1C1C1E] border-[#E5E5EA] hover:bg-[#E5E5EA]"
        }`}
        title="Filter and switch between municipal database tables"
      >
        <Database className="w-3.5 h-3.5" />
        <span>Tables Filter</span>
        <span
          className={`text-[11px] font-normal truncate max-w-[130px] ${
            selectedTable !== "Property" ? "text-white/90" : "text-[#6C6C70]"
          }`}
        >
          ({activeTableDef.name})
        </span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && mounted && typeof document !== "undefined" && (dropdownPos || isMobile) && createPortal(
        <>
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs z-[9998] sm:hidden"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div
            ref={containerRef}
            style={
              isMobile
                ? {
                    position: "fixed",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    width: "calc(100vw - 32px)",
                    maxWidth: 400,
                    maxHeight: "85vh",
                    zIndex: 9999,
                  }
                : {
                    position: "fixed",
                    top: dropdownPos?.top ?? 60,
                    ...(dropdownPos?.right !== undefined ? { right: dropdownPos.right } : { left: dropdownPos?.left ?? 12 }),
                    width: Math.min(420, typeof window !== "undefined" ? window.innerWidth - 32 : 420),
                    zIndex: 9999,
                  }
            }
            className="rounded-[10px] border border-[#E9E9ED] bg-white shadow-2xl p-3.5 flex flex-col font-sans max-h-[85vh] sm:max-h-[460px] overflow-hidden"
          >
          {/* Popover Header */}
          <div className="flex items-center justify-between border-b border-[#E9E9ED] pb-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-[#007AFF]" />
              <span className="text-xs font-bold text-[#1D1D1F]">Municipal Tables Filter</span>
              <span className="text-[10px] text-[#737378]">({totalTablesCount} {totalTablesCount === 1 ? "Table" : "Tables"})</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-[#737378] hover:text-[#1D1D1F] p-0.5 rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Search Input - shown only if more than 3 tables */}
          {(!allowedTables || allowedTables.length > 3) && (
            <div className="relative shrink-0 pt-2 pb-1.5">
              <Search className="w-3 h-3 text-[#8E8E93] absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tables..."
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
                className="w-full h-7 pl-7 pr-2 rounded-md border border-[#E5E5EA] bg-[#F2F2F7] text-[11px] text-[#1C1C1E] focus:outline-none focus:border-[#007AFF] focus:bg-white"
              />
            </div>
          )}

          {/* Table List Grouped by Category */}
          <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-0.5 pt-1">
            {filteredGroups.map((group) => (
              <div key={group.category} className="space-y-1">
                <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-[#8E8E93] flex items-center justify-between">
                  <span>{group.category}</span>
                  <span className="tabular-nums font-mono text-[9px] text-[#8E8E93]">
                    {group.tables.length} {group.tables.length === 1 ? "table" : "tables"}
                  </span>
                </div>

                <div className="divide-y divide-[#E5E5EA] rounded-lg border border-[#E5E5EA] bg-[#F2F2F7]/40 overflow-hidden">
                  {group.tables.map((table: DatabaseTableDefinition) => {
                    const isSelected = selectedTable === table.id;
                    const count = table.recordCount;
                    return (
                      <div
                        key={table.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleSelect(table.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleSelect(table.id);
                          }
                        }}
                        className={`px-2.5 py-2 flex items-start justify-between text-xs cursor-pointer hover:bg-white transition-colors select-none ${
                          isSelected ? "bg-[#007AFF]/8 font-medium text-[#007AFF]" : "text-[#1C1C1E]"
                        }`}
                      >
                        <div className="flex items-start gap-2 min-w-0 pr-2">
                          <div
                            className={`w-3.5 h-3.5 mt-0.5 rounded-full shrink-0 flex items-center justify-center border transition-colors ${
                              isSelected
                                ? "bg-[#007AFF] border-[#007AFF] text-white"
                                : "border-[#C7C7CC] bg-white"
                            }`}
                          >
                            {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-semibold text-[#1C1C1E]">
                                {table.name}
                              </span>
                              <span className="text-[11px] text-[#6C6C70]">
                                &bull; {table.label}
                              </span>
                            </div>
                            <p className="text-[10px] text-[#8E8E93] truncate max-w-xs mt-0.5">
                              {table.description}
                            </p>
                          </div>
                        </div>

                        {count !== undefined && (
                          <span className="text-[10px] text-[#6C6C70] tabular-nums font-mono shrink-0 mt-0.5">
                            {count.toLocaleString()} rows
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {filteredGroups.length === 0 && (
              <div className="p-6 text-center text-xs text-[#8E8E93]">
                No municipal tables match "{searchQuery}".
              </div>
            )}
          </div>

          {/* Popover Footer */}
          <div className="pt-2 border-t border-[#E5E5EA] flex items-center justify-between text-[11px] text-[#6C6C70] shrink-0 mt-1">
            <span>
              Active: <strong className="text-[#1C1C1E]">{activeTableDef.name}</strong>
            </span>
            <button
              type="button"
              onClick={() => handleSelect("Property")}
              className="text-[11px] text-[#007AFF] hover:underline font-semibold cursor-pointer"
            >
              Reset to Property Roll
            </button>
          </div>
        </div>
      </>,
      document.body
    )}
  </div>
);
}
