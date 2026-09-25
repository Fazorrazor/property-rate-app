"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FileText,
  CreditCard,
  Building2,
  Calendar,
  MapPin,
  Maximize2,
  X,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getPropertyBillData, PropertyBillViewData } from "@/app/actions";
import { HeinzLoader } from "@/components/ui/HeinzLoader";

function BillViewerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawAccount = searchParams.get("accountNumber") || searchParams.get("propertyId") || "";

  const [billData, setBillData] = useState<PropertyBillViewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  useEffect(() => {
    async function loadBill() {
      setIsLoading(true);
      try {
        const data = await getPropertyBillData(rawAccount || undefined);
        setBillData(data);
      } catch (err) {
        console.error("Failed to load bill data:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadBill();
  }, [rawAccount]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <HeinzLoader size="large" />
        <p className="mt-4 text-xs text-on-surface-muted font-medium tracking-tight">
          Retrieving Municipal Assessment...
        </p>
      </div>
    );
  }

  if (!billData) {
    return (
      <main className="min-h-screen bg-background text-foreground flex flex-col max-w-md mx-auto w-full font-sans pb-28">
        <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border-light/60 h-11 flex items-center justify-center px-4">
          <h1 className="text-sm font-semibold tracking-tight text-foreground">
            Kpone-Katamanso Municipal Assembly
          </h1>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-surface-subtle flex items-center justify-center text-on-surface-muted border border-border-light">
            <Building2 className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-xs">
            <h2 className="text-sm font-bold text-foreground">No Assessment Found</h2>
            <p className="text-xs text-on-surface-muted leading-relaxed">
              We could not find an active property rate bill for this account. Please check your SMS link or contact municipal revenue support.
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/checkout")}
            className="w-full h-11 rounded-xl bg-primary text-on-primary font-semibold text-xs transition-colors cursor-pointer"
          >
            Go to Payment Portal
          </button>
        </div>
      </main>
    );
  }

  const isPaid = billData.status === "PAID" || billData.totalAmountDue <= 0;

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col max-w-md mx-auto w-full font-sans pb-8">
      {/* Top Municipal Navigation Bar */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border-light/60 h-11 flex items-center justify-between px-4">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-foreground tracking-tight">
            KKMA
          </span>
          <span className="text-[11px] text-on-surface-muted">· Revenue Portal</span>
        </div>
        <span
          className={`text-xs font-semibold ${
            isPaid
              ? "text-[#188038]"
              : billData.status === "PARTIALLY_PAID"
              ? "text-[#B06000]"
              : "text-[#C5221F]"
          }`}
        >
          {isPaid
            ? "Settled in Full"
            : billData.status === "PARTIALLY_PAID"
            ? "Partially Settled"
            : "Bill Due Dec 31"}
        </span>
      </header>

      {/* Bill Overview Header */}
      <div className="px-4 pt-5 pb-3 text-center space-y-1">
        <p className="text-[11px] font-semibold text-on-surface-muted uppercase tracking-widest">
          {billData.billYear} Property Rate Assessment
        </p>
        <p className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground tabular-nums">
          {isPaid ? "GH₵ 0.00" : billData.totalAmountDueFormatted}
        </p>
        <p className="text-xs text-on-surface-muted">
          {isPaid ? "Account in good standing with KKMA" : "Total Net Balance Due"}
        </p>
      </div>

      <div className="px-4 space-y-4">
        {/* Primary CTA if unpaid */}
        {!isPaid && (
          <button
            type="button"
            onClick={() => router.push(`/checkout?propertyId=${encodeURIComponent(billData.accountNumber)}`)}
            className="w-full h-12 rounded-xl bg-[#007AFF] hover:bg-[#0062CC] active:scale-[0.99] text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
          >
            <CreditCard className="w-4 h-4" />
            <span>Proceed to Payment ({billData.totalAmountDueFormatted})</span>
          </button>
        )}

        {/* Official Scanned Paper Bill Card (if attached by admin) */}
        {billData.billImageUrl && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-on-surface-muted uppercase tracking-wider px-1">
              Official Paper Bill
            </p>
            <div className="bg-surface rounded-xl border border-border-light/70 overflow-hidden p-3 space-y-2.5">
              <div className="relative group cursor-pointer overflow-hidden rounded-lg border border-border-light bg-black/5" onClick={() => setIsImageModalOpen(true)}>
                <img
                  src={billData.billImageUrl}
                  alt={`Official municipal bill for ${billData.accountNumber}`}
                  className="w-full h-44 object-cover object-top transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="bg-black/70 text-white text-[11px] font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>View Full Bill</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-on-surface-muted text-[11px]">Original physical council notice</span>
                <button
                  type="button"
                  onClick={() => setIsImageModalOpen(true)}
                  className="text-xs text-[#007AFF] hover:underline font-medium cursor-pointer"
                >
                  Inspect Full Resolution
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Property & Account Information */}
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-on-surface-muted uppercase tracking-wider px-1">
            Property &amp; Account Details
          </p>
          <div className="bg-surface rounded-xl border border-border-light/70 overflow-hidden divide-y divide-border-light/60">
            <div className="flex items-center justify-between px-4 py-3 text-xs">
              <span className="text-on-surface-muted">Ratepayer Name</span>
              <span className="font-semibold text-foreground">{billData.ownerName}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3 text-xs">
              <span className="text-on-surface-muted">Property Account Number</span>
              <span className="font-mono font-bold text-foreground">{billData.accountNumber}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3 text-xs">
              <span className="text-on-surface-muted">Digital Address</span>
              <span className="font-mono font-medium text-foreground">{billData.ownerDigitalAddress}</span>
            </div>
            {(billData.houseNo || billData.plotNo) && (
              <div className="flex items-center justify-between px-4 py-3 text-xs">
                <span className="text-on-surface-muted">House / Plot No</span>
                <span className="font-medium text-foreground">
                  {[billData.houseNo, billData.plotNo].filter(Boolean).join(" • ")}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between px-4 py-3 text-xs">
              <span className="text-on-surface-muted">Property Classification</span>
              <span className="font-medium text-foreground">{billData.propertyClassification}</span>
            </div>
          </div>
        </div>

        {/* Billing & Payment Summary */}
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-on-surface-muted uppercase tracking-wider px-1">
            Billing &amp; Payment Summary
          </p>
          <div className="bg-surface rounded-xl border border-border-light/70 overflow-hidden divide-y divide-border-light/60">
            <div className="flex items-center justify-between px-4 py-3 text-xs">
              <span className="text-on-surface-muted">Prior Unpaid Arrears</span>
              <div className="text-right">
                {billData.isArrearsCleared ? (
                  <span className="font-mono text-xs">
                    <span className="line-through text-on-surface-muted/60">{billData.arrearsFormatted}</span>
                    <span className="text-[#188038] font-medium ml-2">&bull; Cleared</span>
                  </span>
                ) : (
                  <span className="font-medium text-foreground tabular-nums">
                    {billData.effectiveArrearsFormatted || billData.arrearsFormatted}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between px-4 py-3 text-xs">
              <span className="text-on-surface-muted">{billData.billYear} Municipal Rate</span>
              <span className="font-medium text-foreground tabular-nums">{billData.currentFeeFormatted}</span>
            </div>

            <div className="flex items-center justify-between px-4 py-3 text-xs">
              <span className="text-on-surface-muted font-medium">Gross Assessment</span>
              <span className="font-mono font-medium text-foreground tabular-nums">{billData.totalGrossBillFormatted}</span>
            </div>

            {billData.amountPaid > 0 && (
              <div className="flex items-center justify-between px-4 py-3 text-xs bg-surface-subtle/30">
                <span className="text-on-surface-muted">Payments Credited</span>
                <span className="font-mono font-medium text-[#188038] tabular-nums">
                  - {billData.amountPaidFormatted}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between px-4 py-3.5 text-xs font-semibold bg-surface-subtle/50">
              <span className="text-foreground">Net Balance Due</span>
              <span className="text-base font-bold text-foreground tabular-nums">
                {isPaid ? "GH₵ 0.00" : billData.totalAmountDueFormatted}
              </span>
            </div>
          </div>
        </div>

        {/* How Your Bill Is Calculated */}
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-on-surface-muted uppercase tracking-wider px-1">
            How Your Bill Is Calculated
          </p>
          <div className="bg-surface rounded-xl border border-border-light/70 overflow-hidden divide-y divide-border-light/60">
            <div className="flex items-center justify-between px-4 py-3 text-xs">
              <span className="text-on-surface-muted">Property Valuation</span>
              <span className="font-mono font-medium text-foreground tabular-nums">
                {billData.rateableValueFormatted}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3 text-xs">
              <span className="text-on-surface-muted">Municipal Rate Percentage</span>
              <span className="font-mono font-medium text-foreground">
                {billData.rateImposedFormatted}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3 text-xs">
              <span className="text-on-surface-muted">Payment Deadline</span>
              <span className="font-medium text-foreground">{billData.dueDateFormatted}</span>
            </div>
          </div>
        </div>

        {/* Portfolio Switcher (if owner has multiple properties) */}
        {billData.portfolioProperties && billData.portfolioProperties.length > 1 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-on-surface-muted uppercase tracking-wider px-1">
              Other Properties in Your Portfolio ({billData.portfolioProperties.length})
            </p>
            <div className="bg-surface rounded-xl border border-border-light/70 overflow-hidden divide-y divide-border-light/60">
              {billData.portfolioProperties.map((p) => {
                const isSelected = p.accountNumber === billData.accountNumber;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => router.push(`/bill?accountNumber=${encodeURIComponent(p.accountNumber)}`)}
                    className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors cursor-pointer ${
                      isSelected ? "bg-surface-subtle" : "hover:bg-surface-subtle/50"
                    }`}
                  >
                    <div>
                      <div className="text-xs font-semibold text-foreground font-mono">{p.accountNumber}</div>
                      <div className="text-[11px] text-on-surface-muted">{p.ownerDigitalAddress}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground tabular-nums">
                        {p.totalAmountDueFormatted}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-on-surface-muted" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer Legal Context */}
        <p className="text-[11px] text-on-surface-muted text-center pt-2 pb-4 leading-relaxed">
          Official bill issued by Kpone-Katamanso Municipal Assembly pursuant to Local Governance Act, 2016 (Act 936).
        </p>
      </div>

      {/* Full-Screen Bill Image Modal */}
      <AnimatePresence>
        {isImageModalOpen && billData.billImageUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col"
          >
            <div className="h-14 px-4 flex items-center justify-between border-b border-white/10 text-white">
              <span className="text-xs font-semibold">Official Bill Document</span>
              <button
                type="button"
                onClick={() => setIsImageModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
              <img
                src={billData.billImageUrl}
                alt="Full Official Municipal Bill"
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

export default function BillViewerPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
          <HeinzLoader size="large" />
        </div>
      }
    >
      <BillViewerContent />
    </Suspense>
  );
}
