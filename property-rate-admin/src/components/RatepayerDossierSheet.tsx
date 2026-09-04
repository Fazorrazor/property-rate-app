"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  User,
  Phone,
  Building2,
  Receipt,
  MessageSquare,
} from "lucide-react";
import { RatepayerHistoryDossier } from "@/app/actions";

interface RatepayerDossierSheetProps {
  dossier: RatepayerHistoryDossier | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectProperty?: (accountNumber: string) => void;
}

type DossierTab = "PROPERTIES" | "PAYMENTS" | "SMS_NOTICES" | "AUDIT_TRAIL";

export function RatepayerDossierSheet({
  dossier,
  isOpen,
  onClose,
  onSelectProperty,
}: RatepayerDossierSheetProps) {
  const [activeTab, setActiveTab] = useState<DossierTab>("PROPERTIES");

  if (!isOpen || !dossier) return null;

  const { user, properties, receipts, notifications, auditLogs, summary } = dossier;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/35"
          onClick={onClose}
        />

        {/* Sliding Panel */}
        <motion.aside
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 26, stiffness: 280 }}
          className="relative z-10 w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col border-l border-[#DADCE0] font-sans"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-[#DADCE0] flex items-center justify-between shrink-0 bg-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#F6ECF2] text-[#612D53] flex items-center justify-center shrink-0">
                <User className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[#717171] uppercase tracking-wider font-semibold">
                    Ratepayer Dossier
                  </span>
                  <span
                    className={`text-[11px] font-semibold ${
                      summary.status === "SETTLED"
                        ? "text-[#137333]"
                        : summary.status === "DEFAULTER"
                        ? "text-[#D93025]"
                        : "text-[#E37400]"
                    }`}
                  >
                    &bull; {summary.status === "SETTLED" ? "Compliant & Settled" : summary.status === "DEFAULTER" ? "Statutory Defaulter" : "Balance Due"}
                  </span>
                </div>
                <h2 className="text-base font-semibold text-[#2C2C2C] mt-0.5">
                  {user.name}
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#717171] hover:text-[#2C2C2C] transition-colors cursor-pointer"
              aria-label="Close dossier"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Citizen Quick Profile Bar */}
          <div className="bg-[#F8F9FA] px-6 py-3.5 border-b border-[#DADCE0] grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-[#717171] block text-[11px]">Primary Phone</span>
              <span className="font-mono font-medium text-[#2C2C2C] flex items-center gap-1 mt-0.5">
                <Phone className="w-3.5 h-3.5 text-[#717171]" />
                <span>{user.phoneNumber}</span>
              </span>
            </div>
            <div>
              <span className="text-[#717171] block text-[11px]">Account Type</span>
              <span className="font-medium text-[#2C2C2C] mt-0.5 block">{user.role}</span>
            </div>
            <div>
              <span className="text-[#717171] block text-[11px]">Registered Date</span>
              <span className="font-medium text-[#2C2C2C] mt-0.5 block">{user.createdAtFormatted}</span>
            </div>
          </div>

          {/* Financial Summary Scorecards (Zero Pills) */}
          <div className="px-6 py-4 bg-white border-b border-[#DADCE0] grid grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-[#F8F9FA] border border-[#DADCE0] rounded-lg">
              <span className="text-[#717171] text-[11px] block">Properties Registered</span>
              <span className="text-lg font-semibold text-[#2C2C2C] mt-1 block">
                {summary.totalProperties} <span className="text-xs font-normal text-[#717171]">Parcels</span>
              </span>
              <span className="text-[10px] text-[#717171] mt-1 block whitespace-nowrap tabular-nums">Valuation: {summary.totalValuationFormatted}</span>
            </div>

            <div className="p-3 bg-[#F8F9FA] border border-[#DADCE0] rounded-lg">
              <span className="text-[#717171] text-[11px] block">Total Outstanding Due</span>
              <span className="text-lg font-semibold text-[#2C2C2C] mt-1 block whitespace-nowrap tabular-nums">
                {summary.totalOutstandingDueFormatted}
              </span>
              <span className="text-[10px] text-[#D93025] mt-1 block whitespace-nowrap tabular-nums">Arrears: {summary.totalArrearsFormatted}</span>
            </div>

            <div className="p-3 bg-[#F8F9FA] border border-[#DADCE0] rounded-lg">
              <span className="text-[#717171] text-[11px] block">Total Settled (All-Time)</span>
              <span className="text-lg font-semibold text-[#137333] mt-1 block whitespace-nowrap tabular-nums">
                {summary.totalPaidFormatted}
              </span>
              <span className="text-[10px] text-[#717171] mt-1 block">{receipts.length} treasury receipts</span>
            </div>
          </div>

          {/* Dossier Tabs Navigation (Zero Pills - Underline Indicator) */}
          <div className="px-6 border-b border-[#DADCE0] bg-white flex items-center gap-6 text-xs">
            {([
              { key: "PROPERTIES", label: `Linked Properties (${properties.length})` },
              { key: "PAYMENTS", label: `Payment Ledger (${receipts.length})` },
              { key: "SMS_NOTICES", label: `SMS Communications (${notifications.length})` },
              { key: "AUDIT_TRAIL", label: `Audit Trail (${auditLogs.length})` },
            ] as { key: DossierTab; label: string }[]).map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`py-3 text-xs font-medium relative transition-colors cursor-pointer focus:outline-none ${
                    isActive ? "text-[#612D53] font-semibold" : "text-[#717171] hover:text-[#2C2C2C]"
                  }`}
                >
                  <span>{tab.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="dossierTabUnderline"
                      className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#612D53]"
                      transition={{ type: "spring", stiffness: 450, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab Content Area */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 text-xs">
            {/* TAB 1: PROPERTIES */}
            {activeTab === "PROPERTIES" && (
              <div className="space-y-3">
                {properties.length === 0 ? (
                  <p className="text-[#717171] py-8 text-center italic">No property parcels linked to this ratepayer.</p>
                ) : (
                  properties.map((prop) => (
                    <div
                      key={prop.id}
                      className="p-4 bg-white border border-[#DADCE0] rounded-xl space-y-3 hover:border-[#BDC1C6] transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <span className="font-semibold text-[#2C2C2C] text-sm">{prop.accountNumber}</span>
                          <p className="text-[#717171] text-xs mt-0.5">
                            {prop.ownerDigitalAddress} &bull; {prop.municipality}
                          </p>
                          <p className="text-[#717171] text-[11px] mt-0.5">{prop.propertyClassification}</p>
                        </div>

                        <div className="text-right shrink-0">
                          <span
                            className={`text-xs font-semibold ${
                              prop.status === "PAID"
                                ? "text-[#188038]"
                                : prop.status === "PARTIALLY_PAID"
                                ? "text-[#E37400]"
                                : "text-[#D93025]"
                            }`}
                          >
                            {prop.status === "PAID" ? "Settled" : prop.status === "PARTIALLY_PAID" ? "Partial" : "Unpaid"}
                          </span>
                          <p className="font-semibold text-[#2C2C2C] text-sm mt-1 whitespace-nowrap tabular-nums">{prop.totalAmountDueFormatted}</p>
                          {prop.arrears > 0 && (
                            <p className="text-[#D93025] text-[11px] whitespace-nowrap tabular-nums">Arrears: {prop.arrearsFormatted}</p>
                          )}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-[#F1F3F4] flex items-center justify-between text-[11px] text-[#717171]">
                        <span className="whitespace-nowrap tabular-nums">Rateable Valuation: {prop.rateableValueFormatted}</span>
                        {onSelectProperty && (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectProperty(prop.accountNumber);
                              onClose();
                            }}
                            className="text-[#612D53] hover:underline font-medium cursor-pointer"
                          >
                            Inspect Assessment Roll &rarr;
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB 2: PAYMENTS LEDGER */}
            {activeTab === "PAYMENTS" && (
              <div className="space-y-3">
                {receipts.length === 0 ? (
                  <p className="text-[#717171] py-8 text-center italic">No payment transactions recorded on this account.</p>
                ) : (
                  receipts.map((r) => (
                    <div
                      key={r.id}
                      className="p-3.5 bg-white border border-[#DADCE0] rounded-xl flex items-center justify-between gap-3"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <Receipt className="w-3.5 h-3.5 text-[#612D53] shrink-0" />
                          <span className="font-semibold text-[#2C2C2C] whitespace-nowrap">{r.receiptNumber}</span>
                          <span className="text-[#137333] font-medium whitespace-nowrap">&bull; Reconciled</span>
                        </div>
                        <p className="text-[#717171] text-[11px] whitespace-nowrap">
                          {r.paymentMethod} &bull; {r.datePaid}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-semibold text-[#188038] text-sm whitespace-nowrap tabular-nums">{r.amountFormatted}</span>
                        <p className="text-[#717171] text-[10px] mt-0.5 whitespace-nowrap">{r.settlementType} Assessment</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB 3: SMS & COMMUNICATIONS */}
            {activeTab === "SMS_NOTICES" && (
              <div className="space-y-3">
                {notifications.length === 0 ? (
                  <p className="text-[#717171] py-8 text-center italic">No SMS or dispatch notices found for this ratepayer.</p>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className="p-3.5 bg-white border border-[#DADCE0] rounded-xl space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="w-3.5 h-3.5 text-[#612D53]" />
                          <span className="font-semibold text-[#2C2C2C]">{n.title}</span>
                          <span className="text-[#717171] text-[11px]">&bull; {n.deliveryMethod}</span>
                        </div>
                        <span className="text-[11px] text-[#717171]">{n.createdAtFormatted}</span>
                      </div>

                      <div className="p-2.5 bg-[#F6ECF2] border border-[#DADCE0] rounded-lg text-xs text-[#2C2C2C] leading-relaxed">
                        {n.message}
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-[#717171]">
                        <span>Delivery Status: <strong className="text-[#137333] font-medium">{n.deliveryStatus}</strong></span>
                        <span>Type: {n.type}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB 4: AUDIT TRAIL */}
            {activeTab === "AUDIT_TRAIL" && (
              <div className="space-y-3">
                {auditLogs.length === 0 ? (
                  <p className="text-[#717171] py-8 text-center italic">No administrative audit events recorded for this user.</p>
                ) : (
                  auditLogs.map((a) => (
                    <div
                      key={a.id}
                      className="p-3 bg-white border border-[#DADCE0] rounded-xl flex items-start justify-between text-xs"
                    >
                      <div className="space-y-0.5">
                        <span className="font-semibold text-[#2C2C2C]">{a.action}</span>
                        <p className="text-[#717171] text-xs">{a.details}</p>
                      </div>
                      <span className="text-[#717171] text-[11px] shrink-0">{a.createdAtFormatted}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3.5 border-t border-[#DADCE0] bg-white flex items-center justify-between text-xs shrink-0">
            <span className="text-[#717171]">
              Kpone-Katamanso Municipal Assembly (KKMA) &bull; Ratepayer Registry
            </span>
            <button
              type="button"
              onClick={onClose}
              className="btn-3d-secondary h-8 px-3 rounded-lg font-medium text-xs cursor-pointer"
            >
              Close Dossier
            </button>
          </div>
        </motion.aside>
      </div>
    </AnimatePresence>
  );
}
