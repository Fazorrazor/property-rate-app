"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FileText,
  CreditCard,
  ArrowRight,
  Building2,
  ShieldCheck,
} from "lucide-react";
import { DashboardSkeleton } from "@/components/ui/Skeletons";
import { motion } from "framer-motion";
import {
  getDashboardData,
  DashboardData,
} from "@/app/actions";

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const accountNumberParam = searchParams.get("accountNumber") || undefined;

  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const dashRes = await getDashboardData(accountNumberParam);
        if (dashRes) {
          setData(dashRes);
        }
      } catch (err) {
        console.error("Error loading dashboard:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [accountNumberParam]);

  const properties = [...(data?.properties || [])].sort((a, b) => {
    if (accountNumberParam) {
      if (a.accountNumber === accountNumberParam || a.id === accountNumberParam) return -1;
      if (b.accountNumber === accountNumberParam || b.id === accountNumberParam) return 1;
    }
    const aPaid = a.status === "PAID";
    const bPaid = b.status === "PAID";
    if (aPaid && !bPaid) return 1;
    if (!aPaid && bPaid) return -1;
    return b.totalAmountDue - a.totalAmountDue;
  });

  const isAllPaid = properties.length > 0 && properties.every((p) => p.status === "PAID");

  const metrics = data?.metrics || {
    totalValuation: 0,
    totalValuationFormatted: "GH₵ 0.00",
    totalOutstanding: 0,
    totalOutstandingFormatted: "GH₵ 0.00",
    totalProperties: 0,
    paidCount: 0,
    unpaidCount: 0,
    complianceStatus: "Compliant" as const,
  };

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const primaryProp = properties[0];
  const primaryPropId = primaryProp ? primaryProp.accountNumber : "ALL";

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col max-w-md mx-auto w-full p-4 sm:p-5 font-sans relative">
      {/* Sleek Header / Balance Card */}
      <div className="-mx-4 sm:-mx-5 -mt-4 sm:-mt-5 px-5 sm:px-6 pt-8 pb-8 bg-surface text-foreground shadow-sm rounded-b-[36px] relative overflow-hidden shrink-0 z-20 border-b border-border-light transition-colors duration-300">
        <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 bg-primary opacity-5 rounded-full blur-[80px] pointer-events-none" />

        <header className="flex items-center justify-between mb-8 relative z-10">
          <div className="flex items-center gap-3">
            <span className="text-xl font-black tracking-tight select-none">
              Heinz
            </span>
            <div className="border-l border-border-subtle pl-3">
              <h1 className="text-sm font-medium leading-tight tracking-wide">
                {properties.length > 0 && data?.user?.name && data.user.name !== "Ratepayer"
                  ? `Hello, ${data.user.name.split(" ")[0]}`
                  : data?.user?.phoneNumber
                  ? `Taxpayer (${data.user.phoneNumber})`
                  : "Municipal Rate Assessment"}
              </h1>
              <p className="text-[11px] text-on-surface-muted leading-tight mt-0.5">
                {properties.length > 0 ? "Kpone-Katamanso Municipal Assembly" : "Municipal District"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-on-surface-muted text-xs">
            <ShieldCheck className="w-4 h-4 text-[#188038]" />
            <span className="text-[11px] font-medium text-on-surface-muted">Encrypted</span>
          </div>
        </header>

        <div className="space-y-4 relative z-10">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-on-surface-muted uppercase tracking-widest">
              Total Municipal Rate Due
            </span>
            <span
              className={`text-[10px] uppercase font-bold tracking-wider ${
                properties.length === 0
                  ? "text-on-surface-muted"
                  : isAllPaid
                  ? "text-[#188038]"
                  : "text-[#C5221F]"
              }`}
            >
              {properties.length === 0
                ? "No properties linked"
                : isAllPaid
                ? "All bills settled"
                : "Payment Due 30-Jun"}
            </span>
          </div>

          <div className="flex items-end justify-between gap-4">
            <p className="text-[40px] font-bold tracking-tighter leading-none">
              {properties.length === 0 ? "GH₵ 0.00" : metrics.totalOutstandingFormatted}
            </p>

            <div className="shrink-0 mb-1">
              {!isAllPaid && properties.length > 0 ? (
                <button
                  type="button"
                  onClick={() => router.push(`/checkout?propertyId=${encodeURIComponent(primaryPropId)}`)}
                  className="flex items-center justify-center gap-1.5 bg-primary text-on-primary hover:bg-primary-hover active:scale-95 transition-all px-4 py-2.5 rounded-xl cursor-pointer shadow-md"
                >
                  <span className="text-[13px] font-bold tracking-wide uppercase">Pay Now</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-4 flex-1 flex flex-col min-h-0 pt-3"
      >
        {/* Registered Property List */}
        <section className="flex flex-col space-y-3 flex-1" aria-label="Properties">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-semibold text-on-surface-muted uppercase tracking-wider">
              Assessed {properties.length === 1 ? "Property Rate Bill" : `Property Bills (${properties.length})`}
            </h2>
          </div>

          <div className="flex flex-col gap-4 mt-1 flex-1">
            {properties.length === 0 ? (
              <div className="p-6 rounded-2xl bg-surface border border-border-light shadow-sm text-center flex flex-col items-center justify-center space-y-3 py-10">
                <div className="w-12 h-12 rounded-xl bg-surface-subtle flex items-center justify-center text-[#4B1426] border border-border-subtle">
                  <Building2 className="w-6 h-6" />
                </div>
                <div className="space-y-1 max-w-xs">
                  <h3 className="text-sm font-bold text-foreground">No Assessment Found</h3>
                  <p className="text-xs text-on-surface-muted leading-relaxed">
                    No active property rate bills were found for this account. Please check your SMS notice link.
                  </p>
                </div>
              </div>
            ) : properties.length === 1 ? (
              <article className="bg-surface p-4 sm:p-6 rounded-2xl border border-border-light shadow-md flex flex-col gap-3 sm:gap-5 transition-all w-full relative overflow-hidden flex-1">
                {/* Header */}
                <div className="flex items-start justify-between pb-3 sm:pb-4 border-b border-border-light">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-background text-foreground flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-foreground">
                        Digital Demand Notice
                      </h2>
                      <p className="text-xs text-on-surface-muted">FY {properties[0].billYear} &bull; Local Governance Act, 2016 (Act 936)</p>
                    </div>
                  </div>
                  <span
                    className={`text-xs font-bold ${
                      properties[0].status === "PAID"
                        ? "text-[#188038]"
                        : properties[0].status === "PARTIALLY_PAID"
                        ? "text-[#B06000]"
                        : "text-[#C5221F]"
                    }`}
                  >
                    {properties[0].status === "PAID"
                      ? "Settled in Full"
                      : properties[0].status === "PARTIALLY_PAID"
                      ? "Partially Settled"
                      : "Unpaid / Due 30-Jun"}
                  </span>
                </div>

                {/* Main Identification */}
                <div className="grid grid-cols-2 gap-2 sm:gap-4 text-sm bg-surface-subtle p-3 sm:p-4 rounded-xl border border-border-light">
                  <div>
                    <span className="text-[11px] text-on-surface-muted uppercase font-semibold tracking-wider">Account Head</span>
                    <div className="font-mono font-bold text-foreground mt-0.5 sm:mt-1 text-sm sm:text-base">
                      {properties[0].accountNumber}
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] text-on-surface-muted uppercase font-semibold tracking-wider">GPS Digital Address</span>
                    <div className="font-mono font-bold text-foreground mt-0.5 sm:mt-1 text-sm sm:text-base">
                      {properties[0].ownerDigitalAddress}
                    </div>
                  </div>
                  <div className="col-span-2 hidden [@media(min-height:700px)]:block">
                    <span className="text-[11px] text-on-surface-muted uppercase font-semibold tracking-wider">Property Classification</span>
                    <div className="font-semibold text-foreground mt-0.5 sm:mt-1 text-xs sm:text-sm">
                      {properties[0].propertyClassification}
                    </div>
                  </div>
                </div>

                {/* Financial Breakdown */}
                <div className="space-y-3 pt-1">
                  <div className="hidden [@media(min-height:800px)]:block space-y-3">
                    <h3 className="text-[11px] text-on-surface-muted uppercase font-bold tracking-widest border-b border-border-light pb-2">Valuation & Assessment Breakdown</h3>
                    
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-on-surface-muted">Assessed Capital Value</span>
                      <span className="font-medium text-foreground">GH₵ {(properties[0].rateableValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs pb-2 border-b border-dashed border-border-light">
                      <span className="text-on-surface-muted">Applied Rate Factor</span>
                      <span className="font-medium text-foreground">{properties[0].rateImposed}</span>
                    </div>
                  </div>

                  {/* Core Balances */}
                  <div className="flex justify-between items-center text-xs pt-1">
                    <span className="text-on-surface-muted font-semibold">Current Year Fee</span>
                    <span className="font-bold text-foreground">GH₵ {(properties[0].currentFee || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="text-on-surface-muted">Previous Year Arrears</span>
                    <span className="font-medium text-foreground">GH₵ {(properties[0].arrears || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>

                {/* Total & Pay Button */}
                <div className="pt-3 sm:pt-4 flex flex-col gap-3 sm:gap-4 border-t border-border-light mt-auto">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-sm uppercase tracking-widest text-foreground">Total Amount Due</span>
                    <span className="text-xl font-bold text-foreground">
                      {properties[0].status === "PAID" ? "GH₵ 0.00" : properties[0].totalAmountDueFormatted}
                    </span>
                  </div>

                  {properties[0].status !== "PAID" && (
                    <button
                      type="button"
                      onClick={() => router.push(`/checkout?propertyId=${encodeURIComponent(properties[0].accountNumber)}`)}
                      className="btn-3d-primary w-full h-12 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-md"
                    >
                      <CreditCard className="w-5 h-5 shrink-0" />
                      <span>Proceed to Payment</span>
                    </button>
                  )}
                </div>
              </article>
            ) : (
              properties.map((prop) => {
                const isPaid = prop.status === "PAID";
                return (
                  <article
                    key={prop.id}
                    className="bg-surface p-5 rounded-2xl border border-border-light shadow-sm flex flex-col gap-4 transition-all hover:shadow-md"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-border-light">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-foreground" />
                        <div>
                          <h2 className="text-xs font-semibold text-foreground">
                            Digital Demand Notice &bull; FY {prop.billYear}
                          </h2>
                          <p className="text-[11px] text-on-surface-muted">Local Governance Act, 2016 (Act 936)</p>
                        </div>
                      </div>
                      <span
                        className={`text-xs font-medium ${
                          isPaid
                            ? "text-[#188038]"
                            : prop.status === "PARTIALLY_PAID"
                            ? "text-[#B06000]"
                            : "text-[#C5221F]"
                        }`}
                      >
                        {isPaid
                          ? "Settled in Full"
                          : prop.status === "PARTIALLY_PAID"
                          ? "Partially Settled"
                          : "Due: 30-Jun"}
                      </span>
                    </div>

                    {/* Particulars Grid */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[11px] text-on-surface-muted">Account Head</span>
                        <div className="font-mono font-semibold text-foreground mt-0.5">
                          {prop.accountNumber}
                        </div>
                      </div>
                      <div>
                        <span className="text-[11px] text-on-surface-muted">GPS Digital Address</span>
                        <div className="font-mono font-medium text-foreground mt-0.5">
                          {prop.ownerDigitalAddress}
                        </div>
                      </div>
                      <div className="col-span-2 pt-2 border-t border-border-light">
                        <span className="text-[11px] text-on-surface-muted">Property Classification</span>
                        <div className="font-medium text-foreground mt-0.5">
                          {prop.propertyClassification}
                        </div>
                      </div>
                    </div>

                    {/* Total & Pay Button */}
                    <div className="pt-3 flex flex-col gap-3.5 border-t border-border-light/60">
                      <div className="flex items-center justify-between text-sm font-semibold">
                        <span className="font-extrabold uppercase tracking-widest text-foreground">Total Due</span>
                        <span className="text-base text-foreground">
                          {isPaid ? "GH₵ 0.00" : prop.totalAmountDueFormatted}
                        </span>
                      </div>

                      {!isPaid && (
                        <button
                          type="button"
                          onClick={() => router.push(`/checkout?propertyId=${encodeURIComponent(prop.accountNumber)}`)}
                          className="btn-3d-outline-primary w-full h-11 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <CreditCard className="w-4 h-4 shrink-0" />
                          <span>Pay Now</span>
                        </button>
                      )}
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </motion.div>
    </main>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
