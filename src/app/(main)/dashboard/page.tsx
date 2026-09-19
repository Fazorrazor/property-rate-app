"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FileText,
  CreditCard,
  ArrowRight,
  Building2,
  ShieldCheck,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { DashboardSkeleton } from "@/components/ui/Skeletons";
import { motion } from "framer-motion";
import { getDashboardData, DashboardData } from "@/app/actions";

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const accountNumberParam = searchParams.get("accountNumber") || undefined;

  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const dashRes = await getDashboardData(accountNumberParam);
        if (dashRes) setData(dashRes);
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
  const unpaidProps = properties.filter((p) => p.status !== "PAID");

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

  if (isLoading) return <DashboardSkeleton />;

  const primaryPropId = unpaidProps.length > 1
    ? (accountNumberParam || unpaidProps[0]?.accountNumber || "ALL")
    : (unpaidProps[0]?.accountNumber || properties[0]?.accountNumber || "ALL");

  const checkoutHref = unpaidProps.length > 1
    ? `/checkout?propertyId=ALL&accountNumber=${encodeURIComponent(primaryPropId)}`
    : `/checkout?propertyId=${encodeURIComponent(primaryPropId)}`;

  const statusLabel = (status: string) => {
    if (status === "PAID") return { text: "Settled", color: "text-[#1A7336]" };
    if (status === "PARTIALLY_PAID") return { text: "Partial", color: "text-[#B06000]" };
    return { text: "Due", color: "text-[#C5221F]" };
  };

  return (
    <main className="min-h-screen bg-[#F0F2F5] text-foreground flex flex-col max-w-md mx-auto w-full font-sans">

      {/* ── Hero Balance Header ── */}
      <div className="bg-[#121330] text-white px-5 pt-10 pb-8 relative overflow-hidden">
        {/* Subtle radial gradient accent */}
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-white opacity-[0.03] rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-white/10" />

        {/* Top row */}
        <div className="flex items-center justify-between mb-8 relative z-10">
          <div>
            <h1 className="text-[22px] font-black tracking-tight leading-none">
              {data?.user?.name && data.user.name !== "Municipal Ratepayer"
                ? data.user.name
                : "Municipal Ratepayer"}
            </h1>
            <p className="text-white/50 text-[11px] font-medium mt-1 tracking-wide uppercase">
              Kpone-Katamanso Municipal Assembly
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-white/40 text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#34A853]" />
            <span>Encrypted</span>
          </div>
        </div>

        {/* Balance */}
        <div className="relative z-10">
          <p className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-1">
            Total Municipal Rate Due
          </p>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[44px] font-black tracking-tighter leading-none text-white">
                {properties.length === 0 ? "GH₵ 0.00" : metrics.totalOutstandingFormatted}
              </p>
              <p className="text-white/40 text-[11px] mt-2 font-medium">
                {properties.length === 0
                  ? "No properties on record"
                  : isAllPaid
                  ? "All accounts fully settled · FY 2026"
                  : `${unpaidProps.length} account${unpaidProps.length !== 1 ? "s" : ""} outstanding · FY 2026`}
              </p>
            </div>

            {!isAllPaid && properties.length > 0 && (
              <button
                type="button"
                onClick={() => router.push(checkoutHref)}
                className="shrink-0 flex items-center gap-1.5 bg-white text-[#121330] hover:bg-white/90 active:scale-95 transition-all px-4 py-2.5 rounded-xl cursor-pointer font-bold text-[13px] tracking-wide shadow-lg"
              >
                <span>Pay Now</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Summary metrics row */}
          {properties.length > 0 && (
            <div className="mt-5 pt-4 border-t border-white/10 grid grid-cols-3 gap-0">
              {[
                { label: "Properties", value: String(properties.length) },
                { label: "Unpaid", value: String(unpaidProps.length) },
                { label: "Settled", value: String(metrics.paidCount) },
              ].map((m, i) => (
                <div key={m.label} className={`text-center ${i > 0 ? "border-l border-white/10" : ""}`}>
                  <p className="text-white font-black text-xl">{m.value}</p>
                  <p className="text-white/40 text-[10px] font-medium uppercase tracking-wider mt-0.5">{m.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Property Bill List ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="flex-1 px-4 py-5 space-y-3"
      >
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[11px] font-bold text-[#717171] uppercase tracking-widest">
            {properties.length === 1 ? "Demand Notice" : `Demand Notices (${properties.length})`}
          </h2>
          <span className="text-[11px] text-[#717171] font-medium">FY 2026 · Act 936</span>
        </div>

        {/* Empty state */}
        {properties.length === 0 && (
          <div className="bg-white rounded-2xl border border-[#DADCE0] p-8 flex flex-col items-center text-center gap-3 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-[#F0F2F5] flex items-center justify-center">
              <Building2 className="w-6 h-6 text-[#717171]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#121212]">No Assessment Found</h3>
              <p className="text-xs text-[#717171] leading-relaxed mt-1 max-w-[260px]">
                No active property rate bills were found for this account. Please check your SMS notice link.
              </p>
            </div>
          </div>
        )}

        {/* Property cards */}
        <div className="flex flex-col gap-3">
          {properties.map((prop, idx) => {
            const isPaid = prop.status === "PAID";
            const isExpanded = expandedId === prop.id;
            const sl = statusLabel(prop.status);

            return (
              <motion.article
                key={prop.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: idx * 0.05 }}
                className="bg-white rounded-2xl border border-[#DADCE0] shadow-sm overflow-hidden"
              >
                {/* Card Header — always visible */}
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : prop.id)}
                  className="w-full text-left px-4 pt-4 pb-3 flex items-start justify-between gap-3 cursor-pointer"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-[#F0F2F5] flex items-center justify-center shrink-0 mt-0.5">
                      <FileText className="w-4 h-4 text-[#121330]" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-mono font-black text-[#121212] text-[15px] tracking-tight">{prop.accountNumber}</p>
                      <p className="text-[11px] text-[#717171] mt-0.5 truncate">{prop.ownerDigitalAddress} · {prop.propertyClassification?.split(" ").slice(-2).join(" ")}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-1">
                    <p className={`text-[11px] font-bold uppercase tracking-wide ${sl.color}`}>{sl.text}</p>
                    <p className="font-black text-[#121212] text-[16px] leading-none">
                      {isPaid ? "GH₵ 0.00" : `GH₵ ${prop.totalAmountDue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
                    </p>
                    <ChevronRight className={`w-4 h-4 text-[#DADCE0] transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                  </div>
                </button>

                {/* Divider */}
                <div className="h-px bg-[#F0F2F5] mx-4" />

                {/* Bill summary row — always visible */}
                <div className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  <div className="flex items-center justify-between col-span-2">
                    <span className="text-[#717171]">Arrears (Prev. Year)</span>
                    <span className="font-semibold text-[#121212] tabular-nums">GH₵ {(prop.arrears || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex items-center justify-between col-span-2">
                    <span className="text-[#717171]">Current Year Fee</span>
                    <span className="font-semibold text-[#121212] tabular-nums">GH₵ {(prop.currentFee || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="mx-4 border-t border-dashed border-[#DADCE0] py-3 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[#717171]">Assessed Capital Value</span>
                        <span className="font-medium text-[#121212] tabular-nums">GH₵ {(prop.rateableValue || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#717171]">Applied Rate Factor</span>
                        <span className="font-medium text-[#121212] tabular-nums">{prop.rateImposed}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#717171]">Bill Date</span>
                        <span className="font-medium text-[#121212]">{prop.billDateFormatted}</span>
                      </div>
                      {prop.isOverdue && (
                        <div className="flex items-center gap-1.5 text-[#C5221F] pt-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span className="font-semibold text-[10px] uppercase tracking-wide">Overdue · Penalties may apply</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Total + Pay button footer */}
                <div className="px-4 pb-4 pt-1">
                  <div className="flex items-center justify-between pt-3 border-t border-[#F0F2F5]">
                    <div>
                      <p className="text-[10px] font-bold text-[#717171] uppercase tracking-widest">Total Amount Due</p>
                      <p className={`text-[22px] font-black tracking-tight leading-tight ${isPaid ? "text-[#1A7336]" : "text-[#121212]"}`}>
                        {isPaid ? "GH₵ 0.00" : `GH₵ ${prop.totalAmountDue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
                      </p>
                    </div>
                    {!isPaid && (
                      <button
                        type="button"
                        onClick={() => router.push(`/checkout?propertyId=${encodeURIComponent(prop.accountNumber)}`)}
                        className="flex items-center gap-1.5 bg-[#121330] hover:bg-black active:scale-95 transition-all text-white px-4 py-2.5 rounded-xl font-bold text-xs cursor-pointer shadow-md"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>Pay</span>
                      </button>
                    )}
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>

        {/* Pay All sticky footer — multi-property only */}
        {unpaidProps.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="sticky bottom-5 pt-2"
          >
            <button
              type="button"
              onClick={() => router.push(checkoutHref)}
              className="w-full h-14 rounded-2xl bg-[#121330] hover:bg-black active:scale-[0.98] transition-all text-white font-black text-sm flex items-center justify-between px-5 cursor-pointer shadow-xl"
            >
              <div className="text-left">
                <span className="block text-xs text-white/50 font-semibold uppercase tracking-widest">Pay All Outstanding</span>
                <span className="block text-base font-black tracking-tight">{metrics.totalOutstandingFormatted}</span>
              </div>
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                <ArrowRight className="w-4 h-4 text-white" />
              </div>
            </button>
          </motion.div>
        )}

        {/* Legal footnote */}
        <p className="text-center text-[10px] text-[#ADADAD] font-medium pt-2 pb-4">
          Local Governance Act, 2016 (Act 936) · Kpone-Katamanso Municipal Assembly
        </p>
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
