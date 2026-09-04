"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getPublicReceiptVerification, PublicReceiptVerificationData } from "@/app/actions";
import { ShieldCheck, ShieldAlert, CheckCircle2, Search, ArrowLeft, Building2, Landmark, Clock, FileText } from "lucide-react";
import Link from "next/link";

function ReceiptVerifyContent() {
  const searchParams = useSearchParams();
  const codeParam = searchParams.get("code") || "";

  const [receiptNumber, setReceiptNumber] = useState(codeParam);
  const [data, setData] = useState<PublicReceiptVerificationData | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(codeParam));
  const [hasSearched, setHasSearched] = useState(Boolean(codeParam));
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (codeParam) {
      handleVerify(codeParam);
    }
  }, [codeParam]);

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

  return (
    <div className="min-h-screen bg-[#F6ECF2] text-[#2C2C2C] flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-white border-b border-[#DADCE0] shadow-xs shrink-0 h-14">
        <div className="max-w-2xl mx-auto px-4 h-full flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Landmark className="w-5 h-5 text-[#612D53]" />
            <div>
              <span className="text-sm font-bold tracking-tight text-[#612D53] block">
                KKMA Revenue Directorate
              </span>
              <span className="text-[10px] text-[#717171] uppercase font-mono block">
                Public Treasury Verification Portal
              </span>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="text-xs font-medium text-[#612D53] hover:underline flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Citizen App</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-2xl w-full mx-auto p-4 sm:p-6 space-y-5">
        {/* Verification Form (if manual search or editing) */}
        <div className="bg-white border border-[#DADCE0] rounded-xl p-4 shadow-xs">
          <label className="text-xs font-semibold text-[#2C2C2C] block mb-1.5">
            Verify Municipal Property Rate Receipt
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#717171] absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Enter Receipt Reference (e.g. REC-KKMA-...)"
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleVerify(receiptNumber)}
                className="w-full h-10 pl-9 pr-3 rounded-lg border border-[#DADCE0] bg-white text-xs text-[#2C2C2C] focus:outline-none focus:border-[#612D53]"
              />
            </div>
            <button
              type="button"
              onClick={() => handleVerify(receiptNumber)}
              disabled={isLoading}
              className="btn-3d-primary h-10 px-4 rounded-lg text-xs font-medium cursor-pointer disabled:opacity-50 shrink-0"
            >
              {isLoading ? "Verifying..." : "Verify Record"}
            </button>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="bg-white border border-[#DADCE0] rounded-xl p-8 text-center space-y-2 shadow-xs">
            <div className="w-6 h-6 border-2 border-[#612D53] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-[#717171]">Querying KKMA Municipal Treasury ledger...</p>
          </div>
        )}

        {/* Verified Result Card (Zero Pills - Clean Google Enterprise / Act 936 Standard) */}
        {!isLoading && hasSearched && data && (
          <div className="bg-white border border-[#DADCE0] rounded-xl shadow-sm overflow-hidden divide-y divide-[#E8EAED]">
            {/* Certificate Banner */}
            <div className="p-5 bg-[#F8F9FA] flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#188038]">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>&bull; Authenticated Municipal Rate Record</span>
                </div>
                <h1 className="text-base font-bold text-[#2C2C2C] tracking-tight">
                  Kpone-Katamanso Municipal Assembly (KKMA)
                </h1>
                <p className="text-xs text-[#717171]">
                  Official Electronic Treasury Confirmation &bull; Local Governance Act, 2016 (Act 936)
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[10px] text-[#717171] uppercase font-mono block">Statutory Status</span>
                <span className="text-xs font-semibold text-[#188038]">Settled &amp; Reconciled</span>
              </div>
            </div>

            {/* Amount Banner */}
            <div className="p-5 flex items-center justify-between bg-white">
              <div>
                <span className="text-xs text-[#717171] block font-medium">Settlement Amount Paid</span>
                <span className="text-2xl font-bold text-[#2C2C2C] tracking-tight tabular-nums">
                  {data.amountFormatted}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs text-[#717171] block font-medium">Payment Channel</span>
                <span className="text-xs font-semibold text-[#2C2C2C]">{data.paymentMethod}</span>
              </div>
            </div>

            {/* Core Particulars */}
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-white">
              <div className="space-y-0.5">
                <span className="text-[#717171] text-[11px] block">Receipt Reference</span>
                <span className="font-mono font-medium text-[#2C2C2C] text-xs">{data.receiptNumber}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[#717171] text-[11px] block">Date &amp; Time Paid</span>
                <span className="text-[#2C2C2C] font-medium">{data.datePaidFormatted} at {data.timestamp}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[#717171] text-[11px] block">Ratepayer Name</span>
                <span className="font-semibold text-[#2C2C2C]">{data.ratepayerName}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[#717171] text-[11px] block">Assessment Scope</span>
                <span className="text-[#2C2C2C] font-medium">{data.settlementScopeFormatted}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[#717171] text-[11px] block">Property Account Head</span>
                <span className="font-mono font-semibold text-[#612D53]">{data.propertyAccountNumber}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[#717171] text-[11px] block">GhanaPostGPS Digital Address</span>
                <span className="font-mono text-[#2C2C2C] font-medium">{data.digitalAddress}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[#717171] text-[11px] block">Property Classification</span>
                <span className="text-[#2C2C2C] font-medium">{data.propertyClassification}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[#717171] text-[11px] block">Fiscal Billing Year</span>
                <span className="text-[#2C2C2C] font-medium">FY {data.fiscalYear}</span>
              </div>
            </div>

            {/* Anti-Fraud Cryptographic Stamp */}
            <div className="p-4 bg-[#F8F9FA] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <span className="text-[10px] text-[#717171] uppercase font-mono block">Anti-Fraud Electronic Hash</span>
                <span className="font-mono text-[11px] font-semibold text-[#2C2C2C]">{data.antiFraudCode}</span>
              </div>
              <span className="text-[11px] text-[#188038] font-medium shrink-0">
                &bull; Cryptographically Verified Ledger Row
              </span>
            </div>

            {/* Grounded Statute Note */}
            <div className="p-4 bg-white text-[11px] text-[#717171] leading-relaxed">
              This digital certificate serves as official statutory evidence of property rate discharge issued pursuant to Section 146 of the Local Governance Act, 2016 (Act 936). Any alteration or unauthorized issuance constitutes an offense under Ghanaian municipal law.
            </div>
          </div>
        )}

        {/* Not Found Error State */}
        {!isLoading && hasSearched && !data && (
          <div className="bg-white border border-[#DADCE0] rounded-xl p-8 text-center space-y-3 shadow-xs">
            <div className="w-10 h-10 rounded-full bg-[#EA4335]/10 text-[#EA4335] flex items-center justify-center mx-auto">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h2 className="text-sm font-bold text-[#2C2C2C]">Unverified Financial Credential</h2>
            <p className="text-xs text-[#717171] max-w-md mx-auto">
              {errorMsg || "The specified receipt reference could not be authenticated in the official KKMA cadastre treasury records."}
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="shrink-0 h-10 bg-white border-t border-[#DADCE0] px-4 flex items-center justify-between text-[11px] text-[#717171]">
        <span>Republic of Ghana &bull; Kpone-Katamanso Municipal Assembly (KKMA)</span>
        <span>Local Governance Act, 2016 (Act 936)</span>
      </footer>
    </div>
  );
}

export default function ReceiptVerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F6ECF2] flex items-center justify-center text-xs text-[#717171]">
          Loading verification portal...
        </div>
      }
    >
      <ReceiptVerifyContent />
    </Suspense>
  );
}
