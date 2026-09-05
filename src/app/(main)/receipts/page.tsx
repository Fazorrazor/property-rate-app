"use client";

import { useState, useEffect } from "react";
import {
  ReceiptText as ReceiptIcon,
  Search,
  Share2,
  Calendar,
  ShieldCheck,
  Printer,
  X,
  ChevronRight,
  Filter,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { ReceiptsSkeleton } from "@/components/ui/Skeletons";
import { motion, AnimatePresence } from "framer-motion";
import { getUserReceipts } from "@/app/actions";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { QRCodeSVG } from "@/components/ui/QRCodeSVG";
import Link from "next/link";

interface ReceiptItem {
  id: string;
  receiptNumber: string;
  amount: number;
  amountFormatted: string;
  settlementType: string;
  paymentMethod: string;
  status: string;
  datePaid: string;
  formattedDate: string;
  propertyName: string;
  digitalAddress: string;
  propertyClassification: string;
  fiscalYear: number;
  taxpayerName: string;
}

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<ReceiptItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptItem | null>(null);
  const [filter, setFilter] = useState<"ALL" | "PAID" | "PENDING">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedYear, setSelectedYear] = useState<string>("ALL");
  const [selectedProperty, setSelectedProperty] = useState<string>("ALL");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    async function load() {
      try {
        const data = await getUserReceipts();
        setReceipts(data);
      } catch (err) {
        console.error("Error loading receipts:", err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const uniqueYears = Array.from(new Set(receipts.map((r) => r.fiscalYear))).sort((a, b) => b - a);
  const uniqueProperties = Array.from(new Set(receipts.map((r) => r.propertyName)));

  const filteredReceipts = receipts.filter((r) => {
    if (filter !== "ALL" && r.status !== filter) return false;
    if (selectedYear !== "ALL" && r.fiscalYear.toString() !== selectedYear) return false;
    if (selectedProperty !== "ALL" && r.propertyName !== selectedProperty) return false;

    if (searchQuery.trim()) {
      const tokens = searchQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);
      return tokens.every(
        (t) =>
          r.receiptNumber.toLowerCase().includes(t) ||
          r.propertyName.toLowerCase().includes(t) ||
          r.digitalAddress.toLowerCase().includes(t) ||
          r.amountFormatted.toLowerCase().includes(t) ||
          (r.fiscalYear && r.fiscalYear.toString().includes(t)) ||
          (r.paymentMethod && r.paymentMethod.toLowerCase().includes(t))
      );
    }

    return true;
  });

  if (isLoading) {
    return <ReceiptsSkeleton />;
  }

  return (
    <main className="relative flex-1 min-h-screen bg-background p-4 sm:p-5 pb-24 max-w-md mx-auto w-full font-sans space-y-3 pt-2">
      {/* Sticky Top Section (Search + Tabs) */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md -mx-4 px-4 sm:-mx-5 sm:px-5 pt-2 pb-3 space-y-3 shadow-sm border-b border-border-light/50">
        {/* Search Bar */}
        <div className="w-full">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-on-surface-muted absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by receipt #, account, or GPS..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setSearchQuery("");
              }}
              className="w-full h-10 pl-10 pr-9 rounded-xl bg-surface border border-border-light shadow-sm text-xs font-normal text-foreground placeholder:text-on-surface-subtle focus:outline-none focus:border-[#4B1426] transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 p-1 text-on-surface-muted hover:text-foreground cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Dropdown Filters (Year & Property) */}
        <div className="flex gap-2">
          <div className="relative flex-[1.2]">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full h-9 pl-3 pr-7 rounded-xl bg-surface border border-border-light text-xs text-foreground focus:outline-none focus:border-[#4B1426] shadow-sm appearance-none cursor-pointer"
            >
              <option value="ALL">All Years</option>
              {uniqueYears.map((year) => (
                <option key={year} value={year.toString()}>FY {year}</option>
              ))}
            </select>
            <ChevronRight className="w-3 h-3 text-on-surface-muted absolute right-3 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
          </div>
          
          <div className="relative flex-[2]">
            <select
              value={selectedProperty}
              onChange={(e) => setSelectedProperty(e.target.value)}
              className="w-full h-9 pl-3 pr-7 rounded-xl bg-surface border border-border-light text-xs text-foreground focus:outline-none focus:border-[#4B1426] shadow-sm appearance-none truncate cursor-pointer"
            >
              <option value="ALL">All Properties</option>
              {uniqueProperties.map((prop) => (
                <option key={prop} value={prop}>{prop}</option>
              ))}
            </select>
            <ChevronRight className="w-3 h-3 text-on-surface-muted absolute right-3 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex border border-border-light rounded-xl overflow-hidden bg-surface shadow-sm text-xs">
          {(
            [
              { key: "ALL", label: `All (${receipts.length})` },
              { key: "PAID", label: `Settled (${receipts.filter((r) => r.status === "PAID").length})` },
              { key: "PENDING", label: `Pending (${receipts.filter((r) => r.status === "PENDING").length})` },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={`flex-1 py-2 text-center font-medium transition-colors cursor-pointer ${
                filter === item.key
                  ? "bg-background text-foreground font-semibold"
                  : "text-on-surface-muted hover:bg-background"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Receipts List */}
      <section className="space-y-2.5 pt-1">
        {receipts.length === 0 ? (
          <div className="p-8 rounded-2xl bg-surface border border-border-light shadow-sm text-center flex flex-col items-center justify-center space-y-3 my-8 py-10">
            <div className="w-12 h-12 rounded-xl bg-surface-subtle flex items-center justify-center text-[#4B1426] border border-border-subtle">
              <ReceiptIcon className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-xs">
              <h3 className="text-sm font-bold text-foreground">No Payment Receipts</h3>
              <p className="text-xs text-on-surface-muted leading-relaxed">
                Official audit certificates and payment receipts will appear here once rate assessments are settled.
              </p>
            </div>
          </div>
        ) : filteredReceipts.length === 0 ? (
          <div className="p-6 rounded-xl bg-surface shadow-sm border border-border-light text-center space-y-1.5">
            <ReceiptIcon className="w-6 h-6 text-on-surface-muted mx-auto" />
            <p className="text-xs font-medium text-foreground">
              {searchQuery ? `No receipts match "${searchQuery}"` : "No receipts on record"}
            </p>
            <p className="text-[11px] text-on-surface-muted">
              Official receipts appear here once rate assessments are settled.
            </p>
          </div>
        ) : (
          filteredReceipts.map((receipt) => {
            const isPaid = receipt.status.toUpperCase() === "PAID";

            return (
              <motion.article
                key={receipt.id}
                onClick={() => setSelectedReceipt(receipt)}
                whileHover={{ scale: 1.005 }}
                className="p-4 rounded-xl bg-surface border border-border-light hover:border-border-light transition-colors cursor-pointer space-y-2.5 shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-0.5">
                    <p className="text-xs font-mono font-semibold text-foreground">
                      {receipt.receiptNumber}
                    </p>
                    <h2 className="text-xs font-medium text-foreground">
                      {receipt.propertyName}
                    </h2>
                    <p className="text-[11px] font-mono text-on-surface-muted">
                      {receipt.digitalAddress}
                    </p>
                  </div>

                  <span
                    className={`text-xs font-medium ${
                      isPaid ? "text-[#188038]" : "text-[#D93025]"
                    }`}
                  >
                    {isPaid ? "Paid" : "Pending"}
                  </span>
                </div>

                <div className="pt-2 border-t border-border-light flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-on-surface-muted">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{receipt.formattedDate}</span>
                  </div>

                  <span className="font-semibold text-foreground">
                    {receipt.amountFormatted}
                  </span>
                </div>
              </motion.article>
            );
          })
        )}
      </section>

      {/* Official Tax Invoice / Receipt Modal */}
      <BottomSheet
        isOpen={!!selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
        title="Municipal Tax Receipt"
      >
        {selectedReceipt && (
          <div className="space-y-4 pt-1 pb-4 text-xs">
            {/* Certificate Card */}
            <div className="relative p-4 rounded-xl bg-surface border border-border-light shadow-sm space-y-3 overflow-hidden">
              {/* Subtle Watermark */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-[0.03] rotate-[-25deg]">
                <span className="text-4xl font-extrabold tracking-widest text-[#612D53] whitespace-nowrap">
                  KKMA REVENUE VERIFIED
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-border-light pb-2.5 relative z-10">
                <div>
                  <h3 className="text-[11px] font-semibold uppercase text-on-surface-muted">
                    Kpone-Katamanso Municipal Assembly
                  </h3>
                  <p className="text-sm font-semibold text-foreground">
                    Official Property Rate Receipt
                  </p>
                </div>
                <div className="w-8 h-8 rounded-xl bg-background text-[#612D53] flex items-center justify-center border border-border-light">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>

              {/* Amount Highlight */}
              <div className="rounded-lg bg-background p-3 border border-border-light flex items-center justify-between relative z-10">
                <div>
                  <p className="text-[11px] text-on-surface-muted">Settlement Amount</p>
                  <p className="text-xl font-bold text-foreground">
                    {selectedReceipt.amountFormatted}
                  </p>
                </div>
                <span className="text-xs font-semibold text-[#188038]">
                  &bull; Paid &amp; Settled
                </span>
              </div>

              {/* Key Particulars */}
              <div className="grid grid-cols-2 gap-2 text-xs relative z-10">
                <div>
                  <p className="text-on-surface-muted text-[11px]">Receipt Reference</p>
                  <p className="font-mono font-medium text-foreground">
                    {selectedReceipt.receiptNumber}
                  </p>
                </div>
                <div>
                  <p className="text-on-surface-muted text-[11px]">Settlement Date</p>
                  <p className="font-medium text-foreground">
                    {selectedReceipt.formattedDate}
                  </p>
                </div>
                <div>
                  <p className="text-on-surface-muted text-[11px]">Ratepayer</p>
                  <p className="font-medium text-foreground">
                    {selectedReceipt.taxpayerName}
                  </p>
                </div>
                <div>
                  <p className="text-on-surface-muted text-[11px]">Settlement Scope</p>
                  <p className="font-medium text-foreground">
                    {selectedReceipt.settlementType === "TOTAL"
                      ? "Full Assessment"
                      : selectedReceipt.settlementType === "ARREARS"
                      ? "Arrears Only"
                      : "2025 Current Fee"}
                  </p>
                </div>
              </div>

              {/* Property Details */}
              <div className="border-t border-border-light pt-2 space-y-0.5 text-xs relative z-10">
                <p className="text-on-surface-muted text-[11px]">Property Particulars</p>
                <div className="flex items-center justify-between font-mono font-medium text-foreground">
                  <span>{selectedReceipt.propertyName}</span>
                  <span>{selectedReceipt.digitalAddress}</span>
                </div>
                <p className="text-on-surface-muted text-[11px]">
                  Classification: {selectedReceipt.propertyClassification} &bull; FY {selectedReceipt.fiscalYear}
                </p>
                <p className="text-on-surface-muted text-[11px]">
                  Channel: {selectedReceipt.paymentMethod}
                </p>
              </div>

              {/* QR Code & Anti-Fraud Verification Block */}
              <div className="border-t border-border-light pt-3 flex items-center gap-3 bg-[#F8F9FA]/60 rounded-lg p-2.5 relative z-10">
                <div className="bg-white p-1 rounded border border-border-light shadow-2xs shrink-0">
                  <QRCodeSVG
                    value={`http://localhost:3000/receipts/verify?code=${selectedReceipt.receiptNumber}`}
                    size={72}
                    darkColor="#2C2C2C"
                  />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-[#188038]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Statutory Anti-Fraud QR</span>
                  </div>
                  <p className="text-[10px] text-on-surface-muted leading-tight">
                    Scan with any smartphone or reader to authenticate this payment under Act 936.
                  </p>
                  <Link
                    href={`/receipts/verify?code=${selectedReceipt.receiptNumber}`}
                    target="_blank"
                    className="text-[11px] text-[#612D53] hover:underline font-medium inline-flex items-center gap-1 pt-0.5"
                  >
                    <span>Public Verification Page</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>

              {/* Authentication Note */}
              <div className="p-2.5 rounded-lg bg-background border border-border-light text-[11px] text-on-surface-muted relative z-10">
                Electronically authenticated by KKMA Municipal Revenue Directorate under Act 936.
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="btn-3d-primary h-10 rounded-lg font-medium text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Receipt</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({
                      title: "KKMA Property Rate Receipt",
                      text: `Official Receipt ${selectedReceipt.receiptNumber} for ${selectedReceipt.propertyName}`,
                    }).catch(() => {});
                  } else {
                    navigator.clipboard?.writeText(selectedReceipt.receiptNumber);
                    showToast(`Receipt ${selectedReceipt.receiptNumber} copied to clipboard.`, "success");
                  }
                }}
                className="btn-3d-secondary h-10 rounded-lg font-medium text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share</span>
              </button>
            </div>
          </div>
        )}
      </BottomSheet>
      {/* Google-Style Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm bg-[#17433F] text-white px-4 py-3 rounded-xl shadow-2xl border border-white/10 flex items-center justify-between gap-3 text-xs font-medium"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="w-4 h-4 text-[#81C995] shrink-0" />
              <span className="text-[#F3F4F4] leading-tight">{toast.message}</span>
            </div>

            <button
              type="button"
              onClick={() => setToast(null)}
              className="text-[#9AA0A6] hover:text-white p-1 rounded cursor-pointer shrink-0"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
