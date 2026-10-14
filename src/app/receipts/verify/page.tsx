"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getPublicReceiptVerification, PublicReceiptVerificationData } from "@/app/actions";
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  ArrowLeft,
  Building2,
  Image as ImageIcon,
  ZoomIn,
  X,
  ExternalLink,
  Printer,
  FileCheck,
} from "lucide-react";
import { AppleSpinner } from "@/components/ui/AppleSpinner";
import { CitizenHeader } from "@/components/citizen/CitizenHeader";
import { DisclosureRow } from "@/components/citizen/DisclosureRow";
import { CopyValue } from "@/components/citizen/CopyValue";

function ReceiptVerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const codeParam = searchParams.get("code") || "";

  const [receiptNumber, setReceiptNumber] = useState(codeParam);
  const [data, setData] = useState<PublicReceiptVerificationData | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(codeParam));
  const [hasSearched, setHasSearched] = useState(Boolean(codeParam));
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  const handleVerify = async (ref: string) => {
    const trimmed = ref.trim();
    if (!trimmed) {
      setErrorMsg("Please enter a valid receipt number.");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setHasSearched(true);

    try {
      const res = await getPublicReceiptVerification(trimmed);
      if (res) {
        setData(res);
      } else {
        setData(null);
        setErrorMsg(`Receipt #${trimmed} could not be authenticated in the KKMA Treasury database.`);
      }
    } catch (err) {
      console.error("Verification error:", err);
      setErrorMsg("An unexpected system error occurred while verifying the receipt.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (codeParam) {
      handleVerify(codeParam);
    }
  }, [codeParam]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans transition-colors">
      {/* Top Municipal Navigation Header */}
      <CitizenHeader
        title="Municipal Receipt"
        subtitle={data ? data.receiptNumber : "Verification"}
        backHref={
          data?.propertyAccountNumber
            ? `/bill?accountNumber=${encodeURIComponent(data.propertyAccountNumber)}&tab=receipts`
            : "/bill"
        }
        backLabel="Back to Bill"
        rightElement={
          data ? (
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-primary hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer text-xs font-medium print:hidden"
              title="Print Receipt"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print / Save PDF</span>
            </button>
          ) : null
        }
      />

      <main className="flex-1 max-w-lg mx-auto w-full px-4 pt-4 pb-16 space-y-5">
        {/* Verification Search Bar (Only shown if no code in URL or searching a different receipt) */}
        {!codeParam && (
          <div className="bg-surface rounded-2xl border border-border-light/70 p-4 space-y-2 shadow-xs print:hidden">
            <label className="text-xs font-semibold text-foreground block">
              Authenticate Official Receipt
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-on-surface-muted absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Enter Receipt Reference (e.g. REC-KKMA-...)"
                  value={receiptNumber}
                  onChange={(e) => setReceiptNumber(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleVerify(receiptNumber)}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-bwignore="true"
                  data-form-type="other"
                  className="w-full h-10 pl-9 pr-3 rounded-xl border border-border-light bg-surface text-xs text-foreground focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <button
                type="button"
                onClick={() => handleVerify(receiptNumber)}
                disabled={isLoading}
                className="h-10 px-4 rounded-xl bg-primary hover:bg-primary-hover text-on-primary text-xs font-medium cursor-pointer disabled:opacity-50 transition-colors shrink-0"
              >
                {isLoading ? "Verifying..." : "Verify"}
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="bg-surface rounded-2xl border border-border-light/70 p-8 text-center space-y-3 shadow-xs">
            <AppleSpinner size="md" className="mx-auto" />
            <p className="text-xs text-on-surface-muted">
              Querying KKMA Municipal Treasury ledger...
            </p>
          </div>
        )}

        {/* ============================================================== */}
        {/* LEVEL 1: THE ANSWER (OFFICIAL AUTHENTICATION VERDICT & AMOUNT) */}
        {/* ============================================================== */}
        {!isLoading && hasSearched && data && (
          <div className="space-y-4">
            <section
              aria-label="Verified Certificate Verdict"
              className="bg-surface rounded-2xl border border-border-light/70 p-6 text-center space-y-2 shadow-xs transition-colors"
            >
              <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-[#34C759]">
                <ShieldCheck className="w-4 h-4 stroke-[2.2]" />
                <span>Officially Authenticated GCR Record</span>
              </div>

              <div className="py-1">
                <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground font-tabular">
                  {data.amountFormatted}
                </h2>
              </div>

              <p className="text-xs text-on-surface-muted">
                Credited to account on {data.datePaidFormatted} &bull; {data.paymentMethod}
              </p>
            </section>

            {/* ============================================================ */}
            {/* LEVEL 2: THE ACTIONS                                        */}
            {/* ============================================================ */}
            <div className="flex gap-2 print:hidden">
              <button
                type="button"
                onClick={handlePrint}
                className="flex-1 h-11 rounded-xl bg-surface hover:bg-surface-subtle text-foreground text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer border border-border-light/70 shadow-xs"
              >
                <Printer className="w-4 h-4 text-on-surface-muted" />
                <span>Print Official Receipt</span>
              </button>

              {data.propertyAccountNumber && (
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/bill?accountNumber=${encodeURIComponent(data.propertyAccountNumber)}`
                    )
                  }
                  className="flex-1 h-11 rounded-xl bg-primary hover:bg-primary-hover text-on-primary text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <Building2 className="w-4 h-4" />
                  <span>View Property Bill</span>
                </button>
              )}
            </div>

            {/* ============================================================ */}
            {/* LEVEL 3: THE EVIDENCE (DISCLOSURE ACCORDIONS)               */}
            {/* ============================================================ */}
            <div className="bg-surface rounded-2xl border border-border-light/70 px-4 divide-y divide-border-light/60 shadow-xs">
              {/* Disclosure 1: Payment & Channel Particulars */}
              <DisclosureRow
                title="Payment &amp; Settlement Particulars"
                subtitle={`Ref: ${data.receiptNumber}`}
                defaultExpanded={true}
              >
                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between py-1">
                    <span className="text-on-surface-muted">Receipt Reference</span>
                    <CopyValue value={data.receiptNumber} />
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className="text-on-surface-muted">Settlement Amount</span>
                    <span className="font-semibold text-foreground font-tabular">{data.amountFormatted}</span>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className="text-on-surface-muted">Payment Channel</span>
                    <span className="font-medium text-foreground">{data.paymentMethod}</span>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className="text-on-surface-muted">Settlement Scope</span>
                    <span className="font-medium text-foreground text-right">{data.settlementScopeFormatted}</span>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className="text-on-surface-muted">Payment Timestamp</span>
                    <span className="font-medium text-foreground">{data.datePaidFormatted} at {data.timestamp}</span>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className="text-on-surface-muted">Treasury Status</span>
                    <span className="text-[#34C759] font-medium">&bull; Reconciled</span>
                  </div>
                </div>
              </DisclosureRow>

              {/* Disclosure 2: Property & Ratepayer Details */}
              <DisclosureRow
                title="Property &amp; Ratepayer Particulars"
                subtitle={data.ratepayerName}
                defaultExpanded={false}
              >
                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between py-1">
                    <span className="text-on-surface-muted">Ratepayer Name</span>
                    <span className="font-semibold text-foreground text-right">{data.ratepayerName}</span>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className="text-on-surface-muted">Property Account</span>
                    <CopyValue value={data.propertyAccountNumber} />
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className="text-on-surface-muted">Digital Address</span>
                    <CopyValue value={data.digitalAddress} />
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className="text-on-surface-muted">Classification</span>
                    <span className="font-medium text-foreground">{data.propertyClassification}</span>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className="text-on-surface-muted">Fiscal Assessment Year</span>
                    <span className="font-medium text-foreground">FY {data.fiscalYear}</span>
                  </div>
                </div>
              </DisclosureRow>

              {/* Disclosure 3: Physical GCR Leaf (if attached) */}
              {data.scannedImageUrl && (
                <DisclosureRow
                  title="Official Physical GCR Stamped Leaf"
                  subtitle="Council Archival Record Attached"
                  defaultExpanded={true}
                >
                  <div className="space-y-2 text-xs">
                    <div
                      onClick={() => setIsImageModalOpen(true)}
                      className="relative group rounded-xl overflow-hidden border border-border-light bg-black/5 cursor-pointer max-h-72 flex items-center justify-center transition-all"
                    >
                      <img
                        src={data.scannedImageUrl}
                        alt={`Stamped Physical GCR Receipt #${data.receiptNumber}`}
                        className="w-full max-h-72 object-contain group-hover:scale-[1.01] transition-transform duration-200"
                      />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-medium">
                        <ZoomIn className="w-4 h-4" />
                        <span>Enlarge Archival Scan</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-on-surface-muted leading-relaxed">
                      Official photographic record of the physical General Counterfoil Receipt (GCR) signed and stamped by the KKMA Revenue Directorate.
                    </p>
                  </div>
                </DisclosureRow>
              )}

              {/* Disclosure 4: Anti-Fraud Electronic Stamp & Statute */}
              <DisclosureRow
                title="Cryptographic Stamp &amp; Statute"
                subtitle="Local Governance Act, 2016 (Act 936)"
                defaultExpanded={false}
              >
                <div className="space-y-2.5 text-xs text-on-surface-muted leading-relaxed">
                  <div className="flex items-center justify-between py-1">
                    <span>Electronic Hash</span>
                    <CopyValue value={data.antiFraudCode} />
                  </div>
                  <p>
                    This electronic certificate serves as official statutory evidence of property rate discharge issued pursuant to Section 146 of the Local Governance Act, 2016 (Act 936). Any alteration or unauthorized issuance constitutes an offense under Ghanaian municipal law.
                  </p>
                </div>
              </DisclosureRow>
            </div>
          </div>
        )}

        {/* Not Found Error State */}
        {!isLoading && hasSearched && !data && (
          <div className="bg-surface rounded-2xl border border-border-light/70 p-8 text-center space-y-3 shadow-xs">
            <div className="w-10 h-10 rounded-2xl bg-[#FF3B30]/10 text-[#FF3B30] flex items-center justify-center mx-auto">
              <ShieldAlert className="w-5 h-5 stroke-[2]" />
            </div>
            <h2 className="text-sm font-semibold text-foreground">Unverified Financial Credential</h2>
            <p className="text-xs text-on-surface-muted max-w-sm mx-auto leading-relaxed">
              {errorMsg || "The specified receipt reference could not be authenticated in the official KKMA cadastre treasury records."}
            </p>
            <button
              type="button"
              onClick={() => router.push("/bill")}
              className="mt-2 h-10 px-4 rounded-xl bg-surface hover:bg-surface-subtle text-foreground text-xs font-semibold border border-border-light/70 transition-colors cursor-pointer"
            >
              Return to Bill
            </button>
          </div>
        )}
      </main>

      {/* Full-Screen Scanned Receipt Image Lightbox */}
      {isImageModalOpen && data?.scannedImageUrl && (
        <div
          onClick={() => setIsImageModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-3xl w-full max-h-[90vh] bg-surface rounded-2xl overflow-hidden shadow-2xl flex flex-col cursor-default border border-white/20"
          >
            <div className="p-3 bg-surface-subtle border-b border-border-light/60 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-foreground">
                  Original GCR Receipt Leaf — #{data.receiptNumber}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={data.scannedImageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-on-surface-muted hover:text-foreground flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open raw</span>
                </a>
                <button
                  type="button"
                  onClick={() => setIsImageModalOpen(false)}
                  className="w-7 h-7 rounded-lg text-on-surface-muted hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-center cursor-pointer ml-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-auto p-2 bg-black/5 dark:bg-black/40 flex items-center justify-center">
              <img
                src={data.scannedImageUrl}
                alt={`Stamped GCR Receipt #${data.receiptNumber}`}
                className="max-w-full max-h-[78vh] object-contain rounded shadow"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReceiptVerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <AppleSpinner size="lg" />
        </div>
      }
    >
      <ReceiptVerifyContent />
    </Suspense>
  );
}
