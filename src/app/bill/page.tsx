"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FileText,
  CreditCard,
  Building2,
  Maximize2,
  X,
  ChevronRight,
  ExternalLink,
  Receipt,
  Download,
  Printer,
  ShieldCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getPropertyBillData, PropertyBillViewData } from "@/app/actions";
import { HeinzLoader } from "@/components/ui/HeinzLoader";
import { CitizenHeader } from "@/components/citizen/CitizenHeader";
import { PropertySwitcher, PropertyItem } from "@/components/citizen/PropertySwitcher";
import { DisclosureRow } from "@/components/citizen/DisclosureRow";
import { CopyValue } from "@/components/citizen/CopyValue";

function BillViewerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawAccount = searchParams.get("accountNumber") || searchParams.get("propertyId") || "";
  const tabParam = searchParams.get("tab");

  const [billData, setBillData] = useState<PropertyBillViewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"BILL" | "RECEIPTS">(
    tabParam?.toUpperCase() === "RECEIPTS" ? "RECEIPTS" : "BILL"
  );

  // Sync tab state if URL param changes
  useEffect(() => {
    if (tabParam?.toUpperCase() === "RECEIPTS") {
      setActiveTab("RECEIPTS");
    } else if (tabParam?.toUpperCase() === "BILL") {
      setActiveTab("BILL");
    }
  }, [tabParam]);

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

  const handleTabChange = (newTab: "BILL" | "RECEIPTS") => {
    setActiveTab(newTab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", newTab.toLowerCase());
    router.replace(`/bill?${params.toString()}`, { scroll: false });
  };

  const handlePropertySelect = (newAccount: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("accountNumber", newAccount);
    router.push(`/bill?${params.toString()}`);
  };

  // Portfolio items for switcher
  const switcherProperties: PropertyItem[] = useMemo(() => {
    if (!billData) return [];
    if (billData.portfolioProperties && billData.portfolioProperties.length > 0) {
      return billData.portfolioProperties.map((p) => ({
        id: p.id,
        accountNumber: p.accountNumber,
        ownerDigitalAddress: p.ownerDigitalAddress,
        totalAmountDue: p.totalAmountDue,
        totalAmountDueFormatted: p.totalAmountDueFormatted,
        status: p.status,
      }));
    }
    return [
      {
        id: billData.id,
        accountNumber: billData.accountNumber,
        ownerDigitalAddress: billData.ownerDigitalAddress,
        totalAmountDue: billData.totalAmountDue,
        totalAmountDueFormatted: billData.totalAmountDueFormatted,
        status: billData.status,
      },
    ];
  }, [billData]);

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
      <main className="min-h-screen bg-background text-foreground flex flex-col max-w-lg mx-auto w-full font-sans pb-28">
        <CitizenHeader
          title="KKMA Revenue"
          subtitle="Municipal Portal"
          backHref="/dashboard"
          backLabel="Dashboard"
        />

        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-surface-subtle flex items-center justify-center text-on-surface-muted border border-border-light">
            <Building2 className="w-6 h-6 stroke-[1.5]" />
          </div>
          <div className="space-y-1.5 max-w-xs">
            <h2 className="text-base font-semibold tracking-tight text-foreground">No Assessment Found</h2>
            <p className="text-xs text-on-surface-muted leading-relaxed">
              We could not find an active property rate bill for this account. Please verify your reference or check back later.
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/checkout")}
            className="w-full max-w-xs h-11 rounded-xl bg-primary hover:bg-primary-hover text-on-primary font-semibold text-xs transition-colors cursor-pointer"
          >
            Go to Payment Portal
          </button>
        </div>
      </main>
    );
  }

  const isPaid = billData.status === "PAID" || billData.totalAmountDue <= 0;
  const receiptsList = billData.receipts || [];
  const portfolioList = billData.portfolioProperties || [];
  const hasMultipleProperties = portfolioList.length > 1;

  // Total portfolio balance for multi-property owners
  const totalPortfolioBalance = hasMultipleProperties
    ? portfolioList.reduce((sum, p) => sum + (p.totalAmountDue || 0), 0)
    : billData.totalAmountDue;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans transition-colors">
      {/* Top Municipal Navigation Header */}
      <CitizenHeader
        title="KKMA Revenue"
        subtitle={billData.accountNumber}
        backHref="/dashboard"
        backLabel="Dashboard"
        rightElement={
          hasMultipleProperties ? (
            <PropertySwitcher
              properties={switcherProperties}
              activeAccountNumber={billData.accountNumber}
              onSelectProperty={handlePropertySelect}
            />
          ) : (
            <CopyValue
              value={billData.accountNumber}
              className="text-xs font-semibold text-on-surface-muted hover:text-foreground"
            />
          )
        }
      />

      <main className="flex-1 max-w-lg mx-auto w-full px-4 pt-4 pb-28 space-y-5">
        {/* ============================================================== */}
        {/* LEVEL 1: THE ANSWER (HERO AMOUNT & VERDICT)                    */}
        {/* ============================================================== */}
        <section
          aria-label="Assessment Verdict"
          className="bg-surface rounded-2xl border border-border-light/70 p-6 text-center space-y-2 shadow-xs transition-colors"
        >
          <p className="text-[11px] font-semibold text-on-surface-muted uppercase tracking-wider">
            {billData.billYear} Municipal Rate Assessment
          </p>

          <div className="py-1">
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground font-tabular">
              {isPaid ? "GH₵ 0.00" : billData.totalAmountDueFormatted}
            </h2>
          </div>

          <div className="flex items-center justify-center gap-1.5 text-xs font-medium">
            {isPaid ? (
              <span className="text-[#34C759] flex items-center gap-1">
                <ShieldCheck className="w-4 h-4 stroke-[2]" />
                <span>Account Settled in Full &bull; Treasury Cleared</span>
              </span>
            ) : billData.status === "PARTIALLY_PAID" ? (
              <span className="text-[#FF9500]">
                &bull; Partially Paid &bull; Remaining Due Dec 31
              </span>
            ) : (
              <span className="text-[#FF3B30]">
                &bull; Unpaid &bull; Due by {billData.dueDateFormatted}
              </span>
            )}
          </div>
        </section>

        {/* ============================================================== */}
        {/* SEGMENTED TYPOGRAPHIC TABS (ZERO PILLS)                        */}
        {/* ============================================================== */}
        <nav
          aria-label="Assessment View Options"
          className="flex border-b border-border-light/70 gap-6 px-1"
        >
          <button
            type="button"
            onClick={() => handleTabChange("BILL")}
            className={`pb-3 text-xs font-semibold transition-colors cursor-pointer border-b-2 -mb-px ${
              activeTab === "BILL"
                ? "text-foreground border-primary"
                : "text-on-surface-muted hover:text-foreground border-transparent"
            }`}
          >
            Bill &amp; Assessment
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("RECEIPTS")}
            className={`pb-3 text-xs font-semibold transition-colors cursor-pointer border-b-2 -mb-px flex items-center gap-1.5 ${
              activeTab === "RECEIPTS"
                ? "text-foreground border-primary"
                : "text-on-surface-muted hover:text-foreground border-transparent"
            }`}
          >
            <span>Official Receipts</span>
            {receiptsList.length > 0 && (
              <span className="text-[11px] font-tabular font-mono text-on-surface-muted">
                ({receiptsList.length})
              </span>
            )}
          </button>
        </nav>

        {/* ============================================================== */}
        {/* TAB CONTENT                                                   */}
        {/* ============================================================== */}
        {activeTab === "BILL" ? (
          <div className="space-y-4">
            {/* Multi-Property Portfolio Banner (Clean Typographic Callout) */}
            {hasMultipleProperties && totalPortfolioBalance > 0 && (
              <div className="bg-surface rounded-xl border border-border-light/70 p-3.5 flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-foreground block">
                    Portfolio Balance ({portfolioList.length} Properties)
                  </span>
                  <span className="text-[11px] text-on-surface-muted">
                    Total: GH₵ {totalPortfolioBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => router.push("/checkout?propertyId=ALL")}
                  className="text-primary hover:underline font-semibold cursor-pointer shrink-0"
                >
                  Pay All &rarr;
                </button>
              </div>
            )}

            {/* Scanned Official Council Paper Bill (if attached) */}
            {billData.billImageUrl && (
              <section aria-label="Official Council Bill Document" className="space-y-2">
                <div className="bg-surface rounded-xl border border-border-light/70 p-3 space-y-2">
                  <div
                    className="relative group cursor-pointer overflow-hidden rounded-lg border border-border-light bg-black/5"
                    onClick={() => setIsImageModalOpen(true)}
                  >
                    <img
                      src={billData.billImageUrl}
                      alt={`Official paper notice for ${billData.accountNumber}`}
                      className="w-full h-40 object-cover object-top transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                    <div className="absolute inset-0 bg-black/25 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="bg-black/75 text-white text-[11px] font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>Inspect Full Bill Document</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs px-1">
                    <span className="text-on-surface-muted text-[11px]">Official physical council bill</span>
                    <button
                      type="button"
                      onClick={() => setIsImageModalOpen(true)}
                      className="text-primary hover:underline font-medium cursor-pointer text-xs"
                    >
                      Enlarge Notice
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* ============================================================ */}
            {/* LEVEL 3: THE EVIDENCE (DISCLOSURE ACCORDIONS)               */}
            {/* ============================================================ */}
            <div className="bg-surface rounded-2xl border border-border-light/70 px-4 divide-y divide-border-light/60 shadow-xs">
              {/* Disclosure 1: Assessment & Financial Breakdown */}
              <DisclosureRow
                title="Assessment Breakdown"
                subtitle={`Net Due: ${isPaid ? "GH₵ 0.00" : billData.totalAmountDueFormatted}`}
                defaultExpanded={true}
              >
                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between py-1">
                    <span className="text-on-surface-muted">{billData.billYear} Municipal Rate</span>
                    <span className="font-medium text-foreground font-tabular">{billData.currentFeeFormatted}</span>
                  </div>

                  {billData.arrears > 0 && (
                    <div className="flex items-center justify-between py-1">
                      <span className="text-on-surface-muted">Prior Arrears</span>
                      <div className="text-right">
                        {billData.isArrearsCleared ? (
                          <span className="font-mono text-xs">
                            <span className="line-through text-on-surface-muted/60">{billData.arrearsFormatted}</span>
                            <span className="text-[#34C759] font-medium ml-2">&bull; Cleared</span>
                          </span>
                        ) : (
                          <span className="font-medium text-foreground font-tabular">
                            {billData.effectiveArrearsFormatted || billData.arrearsFormatted}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {billData.amountPaid > 0 && (
                    <div className="flex items-center justify-between py-1 text-[#34C759]">
                      <span>Payments Credited</span>
                      <span className="font-mono font-medium font-tabular">
                        - {billData.amountPaidFormatted}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2.5 border-t border-border-light/60 font-semibold">
                    <span className="text-foreground">Net Balance Due</span>
                    <span className={`text-sm font-bold font-tabular ${isPaid ? "text-[#34C759]" : "text-foreground"}`}>
                      {isPaid ? "GH₵ 0.00" : billData.totalAmountDueFormatted}
                    </span>
                  </div>
                </div>
              </DisclosureRow>

              {/* Disclosure 2: Property & Ratepayer Particulars */}
              <DisclosureRow
                title="Property &amp; Account Particulars"
                subtitle={billData.ownerName}
                defaultExpanded={false}
              >
                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between py-1">
                    <span className="text-on-surface-muted">Ratepayer Name</span>
                    <span className="font-semibold text-foreground text-right">{billData.ownerName}</span>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className="text-on-surface-muted">Property Account</span>
                    <CopyValue value={billData.accountNumber} />
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className="text-on-surface-muted">Digital Address</span>
                    <CopyValue value={billData.ownerDigitalAddress} />
                  </div>

                  {(billData.houseNo || billData.plotNo) && (
                    <div className="flex items-center justify-between py-1">
                      <span className="text-on-surface-muted">House / Plot</span>
                      <span className="font-medium text-foreground">
                        {[billData.houseNo, billData.plotNo].filter(Boolean).join(" • ")}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between py-1">
                    <span className="text-on-surface-muted">Classification</span>
                    <span className="font-medium text-foreground">{billData.propertyClassification}</span>
                  </div>
                </div>
              </DisclosureRow>

              {/* Disclosure 3: Legal Authority & Payment Terms */}
              <DisclosureRow
                title="Statutory Authority &amp; Terms"
                subtitle="Local Governance Act, 2016 (Act 936)"
                defaultExpanded={false}
              >
                <div className="space-y-2 text-xs text-on-surface-muted leading-relaxed">
                  <p>
                    Property rates are statutory levies enacted under Section 146 of the Local Governance Act, 2016 (Act 936) by the Kpone-Katamanso Municipal Assembly (KKMA).
                  </p>
                  <p>
                    All property rates are due on or before <strong>{billData.dueDateFormatted}</strong>. Official General Counterfoil Receipts (GCR) are issued upon ledger reconciliation.
                  </p>
                </div>
              </DisclosureRow>
            </div>
          </div>
        ) : (
          /* ============================================================ */
          /* SCREEN 2: OFFICIAL RECEIPTS TAB                              */
          /* ============================================================ */
          <div className="space-y-4">
            {receiptsList.length > 0 ? (
              <div className="space-y-2">
                <div className="px-1 flex items-center justify-between text-xs text-on-surface-muted">
                  <span>Reconciled Municipal Receipts</span>
                  <span className="font-tabular font-mono">
                    {receiptsList.length} {receiptsList.length === 1 ? "Record" : "Records"}
                  </span>
                </div>

                <div className="bg-surface rounded-2xl border border-border-light/70 divide-y divide-border-light/60 overflow-hidden shadow-xs">
                  {receiptsList.map((r) => (
                    <div key={r.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <Receipt className="w-3.5 h-3.5 text-primary" />
                            <CopyValue
                              value={r.receiptNumber}
                              className="font-mono font-bold text-xs text-primary"
                            />
                          </div>
                          <p className="text-[11px] text-on-surface-muted mt-1">
                            {r.datePaidFormatted} &bull; {r.paymentMethod}
                          </p>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-bold font-tabular text-[#34C759] block">
                            {r.amountFormatted}
                          </span>
                          <span className="text-[11px] text-[#34C759] font-medium">
                            &bull; Reconciled
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => router.push(`/receipts/verify?code=${encodeURIComponent(r.receiptNumber)}`)}
                        className="w-full h-9 rounded-xl bg-surface-subtle hover:bg-black/5 dark:hover:bg-white/5 text-foreground text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-border-light/60"
                      >
                        <span>View Verified GCR Receipt</span>
                        <ChevronRight className="w-3.5 h-3.5 text-on-surface-muted" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : isPaid ? (
              /* If marked paid but individual receipt list empty: fallback certificate view */
              <div className="bg-surface rounded-2xl border border-border-light/70 p-5 space-y-3 text-center shadow-xs">
                <div className="w-10 h-10 rounded-full bg-[#34C759]/10 text-[#34C759] flex items-center justify-center mx-auto">
                  <ShieldCheck className="w-5 h-5 stroke-[2]" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">Treasury Clearance Confirmed</h3>
                  <p className="text-xs text-on-surface-muted">
                    This property has settled all municipal rates in full for FY {billData.billYear}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => router.push(`/receipts/verify?code=${encodeURIComponent(billData.accountNumber)}`)}
                  className="w-full h-10 rounded-xl bg-primary hover:bg-primary-hover text-on-primary text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Verify Municipal Clearance Certificate</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              /* No receipts yet */
              <div className="bg-surface rounded-2xl border border-border-light/70 p-8 text-center space-y-2 shadow-xs">
                <div className="w-10 h-10 rounded-2xl bg-surface-subtle text-on-surface-muted flex items-center justify-center mx-auto border border-border-light">
                  <FileText className="w-5 h-5 stroke-[1.5]" />
                </div>
                <h3 className="text-xs font-semibold text-foreground">No Official Receipts Issued Yet</h3>
                <p className="text-[11px] text-on-surface-muted max-w-xs mx-auto leading-relaxed">
                  Official General Counterfoil Receipts (GCR) are automatically published here upon municipal treasury reconciliation.
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ================================================================ */}
      {/* LEVEL 2: STICKY BOTTOM ACTION BAR (MOBILE / DESKTOP RESPONSIVE) */}
      {/* ================================================================ */}
      {!isPaid && (
        <aside
          aria-label="Payment Action"
          className="fixed bottom-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-md border-t border-border-light/70 p-3 sm:p-4"
        >
          <div className="max-w-lg mx-auto flex items-center gap-3">
            <div className="hidden sm:block min-w-0 flex-1">
              <span className="text-[11px] text-on-surface-muted block">Net Due</span>
              <span className="text-base font-bold text-foreground font-tabular truncate block">
                {billData.totalAmountDueFormatted}
              </span>
            </div>

            <button
              type="button"
              onClick={() => router.push(`/checkout?propertyId=${encodeURIComponent(billData.accountNumber)}`)}
              className="flex-1 h-12 rounded-xl bg-primary hover:bg-primary-hover active:scale-[0.99] text-on-primary font-semibold text-xs sm:text-[13px] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
            >
              <CreditCard className="w-4 h-4" />
              <span>Pay Now ({billData.totalAmountDueFormatted})</span>
            </button>
          </div>
        </aside>
      )}

      {/* Lightbox Modal for Scanned Paper Bill */}
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
                alt={`Full Official Municipal Bill for ${billData.accountNumber}`}
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
