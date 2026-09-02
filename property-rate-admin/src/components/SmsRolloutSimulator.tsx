"use client";

import { useState, useMemo } from "react";
import {
  Send,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  MessageSquare,
  FileText,
  CreditCard,
  Phone,
  Clock,
  Sparkles,
  Info,
} from "lucide-react";
import { AdminProperty, SmsRolloutLogItem } from "@/app/actions";

interface SmsRolloutSimulatorProps {
  properties: AdminProperty[];
  smsLogs: SmsRolloutLogItem[];
  onTriggerBatchRollout: (accountNumbers: string[], template: string) => Promise<void>;
  isProcessing: boolean;
}

export function SmsRolloutSimulator({
  properties,
  smsLogs,
  onTriggerBatchRollout,
  isProcessing,
}: SmsRolloutSimulatorProps) {
  // Campaign Filter States
  const [targetMunicipality, setTargetMunicipality] = useState("ALL");
  const [targetClassification, setTargetClassification] = useState("ALL");
  const [targetStatus, setTargetStatus] = useState<"ALL" | "UNPAID" | "DEFAULTER">("UNPAID");

  // Template State
  const defaultTemplate =
    "KKMA PROPERTY RATE DEMAND: Account {{accountNumber}} ({{ownerName}}) has municipal assessment due of GH₵ {{totalAmountDue}} (Arrears: GH₵ {{arrears}}, Current Fee: GH₵ {{currentFee}}). Due Date: {{dueDate}} under Act 936.\n\n1. View Digital Assessment: {{billLink}}\n2. Instant Mobile Settlement: {{paymentLink}}";

  const [messageTemplate, setMessageTemplate] = useState(defaultTemplate);
  const [dueDate, setDueDate] = useState("30-Jun-2025");
  const [previewAccountIndex, setPreviewAccountIndex] = useState(0);

  // Filtered target list
  const eligibleProperties = useMemo(() => {
    return properties.filter((p) => {
      if (targetMunicipality !== "ALL" && p.municipality !== targetMunicipality) return false;
      if (targetClassification !== "ALL" && p.propertyClassification !== targetClassification) return false;
      if (targetStatus === "UNPAID" && p.status === "PAID") return false;
      if (targetStatus === "DEFAULTER" && !p.isDefaulter) return false;
      return true;
    });
  }, [properties, targetMunicipality, targetClassification, targetStatus]);

  const previewProp = eligibleProperties[previewAccountIndex] || properties[0] || null;

  // Render preview message with dual links
  const previewData = useMemo(() => {
    if (!previewProp) {
      return {
        message: "Select an active property account to preview the dual-link SMS rollout notice.",
        billLink: "http://localhost:3000/properties?accountNumber=DEMO",
        paymentLink: "http://localhost:3000/properties?accountNumber=DEMO&action=pay",
        recipientPhone: "+233 24 000 0000",
        recipientName: "Municipal Citizen",
      };
    }

    const host = typeof window !== "undefined" ? window.location.origin.replace(":3001", ":3000") : "http://localhost:3000";
    const billLink = `${host}/properties?accountNumber=${encodeURIComponent(previewProp.accountNumber)}`;
    const paymentLink = `${host}/properties?accountNumber=${encodeURIComponent(previewProp.accountNumber)}&action=pay`;

    const rendered = messageTemplate
      .replace(/{{accountNumber}}/g, previewProp.accountNumber)
      .replace(/{{ownerName}}/g, previewProp.ownerName)
      .replace(/{{totalAmountDue}}/g, previewProp.totalAmountDueFormatted.replace("GH₵ ", ""))
      .replace(/{{arrears}}/g, previewProp.arrearsFormatted.replace("GH₵ ", ""))
      .replace(/{{currentFee}}/g, previewProp.currentFeeFormatted.replace("GH₵ ", ""))
      .replace(/{{dueDate}}/g, dueDate)
      .replace(/{{billLink}}/g, billLink)
      .replace(/{{paymentLink}}/g, paymentLink);

    return {
      message: rendered,
      billLink,
      paymentLink,
      recipientPhone: previewProp.ownerPhone,
      recipientName: previewProp.ownerName,
    };
  }, [previewProp, messageTemplate, dueDate]);

  const insertVariableTag = (tag: string) => {
    setMessageTemplate((prev) => prev + " " + tag);
  };

  const handleStartCampaign = () => {
    const targetAccounts = eligibleProperties
      .filter((p) => p.status !== "PAID" && p.totalAmountDue > 0)
      .map((p) => p.accountNumber);

    onTriggerBatchRollout(targetAccounts, messageTemplate);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Context (Zero Pills) */}
      <div className="bg-white border border-[#DADCE0] rounded-xl p-5 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#612D53] uppercase tracking-wider">
                Communications Directorate
              </span>
              <span className="text-xs text-[#717171]">&bull; Twilio E.164 SMS Engine</span>
            </div>
            <h2 className="text-lg font-semibold text-[#2C2C2C] mt-0.5">
              SMS Bill Rollout &amp; Demand Notice Dispatch Center
            </h2>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#137333] font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#137333]" />
              <span>Twilio Service Ready (Simulation Mode)</span>
            </span>
          </div>
        </div>

        <p className="text-xs text-[#717171] leading-relaxed">
          Broadcast statutory property rate assessment bills and demand notices directly to ratepayer phone numbers with two cryptographic deep links: 
          <strong> (1) View Official Assessment Roll</strong> and <strong> (2) Instant In-App Payment Gateway Checkout</strong>.
        </p>
      </div>

      {/* Main Two-Column Layout: Controls & Live Preview Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Campaign Controls & Template Editor (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Section 1: Audience Selection */}
          <div className="bg-white border border-[#DADCE0] rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[#F1F3F4] pb-3">
              <h3 className="text-sm font-semibold text-[#2C2C2C]">
                1. Target Ratepayer Audience
              </h3>
              <span className="text-xs text-[#717171] font-medium">
                {eligibleProperties.length} accounts matched
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="space-y-1">
                <label className="text-[#717171] font-medium block">Municipality (MMDA)</label>
                <select
                  value={targetMunicipality}
                  onChange={(e) => {
                    setTargetMunicipality(e.target.value);
                    setPreviewAccountIndex(0);
                  }}
                  className="w-full h-9 px-2.5 rounded-lg border border-[#DADCE0] bg-white text-xs text-[#2C2C2C] focus:outline-none focus:border-[#612D53]"
                >
                  <option value="ALL">All Assemblies</option>
                  <option value="Kpone-Katamanso (KKMA)">Kpone-Katamanso (KKMA)</option>
                  <option value="Tema Metropolitan (TMA)">Tema Metropolitan (TMA)</option>
                  <option value="Accra Metropolitan (AMA)">Accra Metropolitan (AMA)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[#717171] font-medium block">Zoning Classification</label>
                <select
                  value={targetClassification}
                  onChange={(e) => {
                    setTargetClassification(e.target.value);
                    setPreviewAccountIndex(0);
                  }}
                  className="w-full h-9 px-2.5 rounded-lg border border-[#DADCE0] bg-white text-xs text-[#2C2C2C] focus:outline-none focus:border-[#612D53]"
                >
                  <option value="ALL">All Classifications</option>
                  <option value="PRIVATE THIRD CLASS RESIDENTIAL">Third Class Residential</option>
                  <option value="SECOND CLASS COMMERCIAL">Second Class Commercial</option>
                  <option value="FIRST CLASS RESIDENTIAL">First Class Residential</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[#717171] font-medium block">Assessment Status</label>
                <select
                  value={targetStatus}
                  onChange={(e) => {
                    setTargetStatus(e.target.value as any);
                    setPreviewAccountIndex(0);
                  }}
                  className="w-full h-9 px-2.5 rounded-lg border border-[#DADCE0] bg-white text-xs text-[#2C2C2C] focus:outline-none focus:border-[#612D53]"
                >
                  <option value="UNPAID">Unpaid Balances Only</option>
                  <option value="DEFAULTER">Statutory Defaulters (Arrears)</option>
                  <option value="ALL">All Records</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Template Editor with Tag Palette */}
          <div className="bg-white border border-[#DADCE0] rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[#F1F3F4] pb-3">
              <div>
                <h3 className="text-sm font-semibold text-[#2C2C2C]">
                  2. Dual-Link SMS Template Engine
                </h3>
                <p className="text-[11px] text-[#717171] mt-0.5">
                  Insert dynamic variables to generate individualized bill links and amounts.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMessageTemplate(defaultTemplate)}
                className="text-xs text-[#612D53] hover:underline font-medium cursor-pointer"
              >
                Reset Default
              </button>
            </div>

            {/* Variable Tags Palette (Zero Pills - Clean typographic buttons) */}
            <div className="space-y-1.5">
              <span className="text-[11px] text-[#717171] font-medium">Available Dynamic Variables:</span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { tag: "{{accountNumber}}", label: "Account No." },
                  { tag: "{{ownerName}}", label: "Ratepayer Name" },
                  { tag: "{{totalAmountDue}}", label: "Total Assessment Due" },
                  { tag: "{{arrears}}", label: "Arrears" },
                  { tag: "{{currentFee}}", label: "Current Fee" },
                  { tag: "{{dueDate}}", label: "Due Date" },
                  { tag: "{{billLink}}", label: "Link 1: View Bill" },
                  { tag: "{{paymentLink}}", label: "Link 2: In-App Pay" },
                ].map((item) => (
                  <button
                    key={item.tag}
                    type="button"
                    onClick={() => insertVariableTag(item.tag)}
                    className="px-2 py-1 text-[11px] font-mono font-medium text-[#612D53] bg-[#F6ECF2] border border-[#E8D4E2] rounded hover:bg-[#EAD6E4] transition-colors cursor-pointer"
                    title={`Click to insert ${item.tag}`}
                  >
                    + {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[#717171] font-medium text-xs block">SMS Message Body</label>
              <textarea
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                rows={5}
                className="w-full p-3 rounded-lg border border-[#DADCE0] bg-white text-xs text-[#2C2C2C] focus:outline-none focus:border-[#612D53] resize-none leading-relaxed font-sans"
              />
              <div className="flex items-center justify-between text-[11px] text-[#717171]">
                <span>Character Count: {messageTemplate.length} chars (approx. {Math.ceil(messageTemplate.length / 160)} SMS segments)</span>
                <span>Statutory Compliance: Act 936</span>
              </div>
            </div>

            {/* Statutory Due Date Setting */}
            <div className="space-y-1">
              <label className="text-[#717171] font-medium text-xs block">Statutory Payment Due Date</label>
              <input
                type="text"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full sm:w-64 h-9 px-3 rounded-lg border border-[#DADCE0] bg-white text-xs text-[#2C2C2C] focus:outline-none focus:border-[#612D53]"
                placeholder="e.g. 30-Jun-2025"
              />
            </div>

            {/* Campaign Action Button */}
            <div className="pt-3 border-t border-[#F1F3F4] flex items-center justify-between">
              <div className="text-xs text-[#717171]">
                <span>Target: <strong>{eligibleProperties.filter((p) => p.status !== "PAID" && p.totalAmountDue > 0).length}</strong> unpaid accounts</span>
              </div>

              <button
                type="button"
                onClick={handleStartCampaign}
                disabled={isProcessing || eligibleProperties.filter((p) => p.status !== "PAID" && p.totalAmountDue > 0).length === 0}
                className="btn-3d-primary h-10 px-5 rounded-lg font-medium text-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>
                  {isProcessing
                    ? "Dispatching SMS Rollout..."
                    : `Queue Rollout Notice (${eligibleProperties.filter((p) => p.status !== "PAID" && p.totalAmountDue > 0).length})`}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Live Dual-Link Phone Simulator (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-[#DADCE0] rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[#F1F3F4] pb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-[#612D53]" />
                <h3 className="text-sm font-semibold text-[#2C2C2C]">
                  Live Citizen Device Simulator
                </h3>
              </div>
              <span className="text-[11px] text-[#717171]">Real-time rendering</span>
            </div>

            {/* Sample Record Switcher */}
            {eligibleProperties.length > 0 && (
              <div className="flex items-center justify-between text-xs bg-[#F8F9FA] p-2 rounded-lg border border-[#DADCE0]">
                <span className="text-[#717171]">Previewing Account:</span>
                <select
                  value={previewAccountIndex}
                  onChange={(e) => setPreviewAccountIndex(Number(e.target.value))}
                  className="text-xs font-semibold text-[#2C2C2C] bg-transparent border-none focus:outline-none cursor-pointer"
                >
                  {eligibleProperties.slice(0, 15).map((p, idx) => (
                    <option key={p.id} value={idx}>
                      {p.accountNumber} — {p.ownerName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Smartphone Graphic Mockup */}
            <div className="bg-[#2C2C2C] p-4 rounded-3xl shadow-xl text-white max-w-sm mx-auto space-y-3 font-sans border-4 border-[#1F1F1F]">
              {/* Phone Top Notch */}
              <div className="flex items-center justify-between text-[10px] text-[#9AA0A6] px-2 pb-1 border-b border-white/10">
                <span>9:41 AM</span>
                <span className="font-semibold text-white">KKMA REVENUE</span>
                <span>4G • 98%</span>
              </div>

              {/* Message Bubble Container */}
              <div className="space-y-3 py-2">
                <div className="text-center text-[10px] text-[#9AA0A6]">
                  <span>Today 9:41 AM &bull; SMS from +233 24 100 0000</span>
                </div>

                {/* SMS Bubble */}
                <div className="bg-[#3C4043] text-white p-3.5 rounded-2xl rounded-tl-sm text-xs leading-relaxed space-y-3 shadow-md border border-white/5">
                  <p className="whitespace-pre-line text-[#F1F3F4] text-[11px]">
                    {previewData.message}
                  </p>

                  {/* Highlighted Dual Direct Action Cards */}
                  <div className="space-y-2 pt-2 border-t border-white/10">
                    <span className="text-[10px] uppercase text-[#BDC1C6] font-semibold tracking-wider block">
                      Citizen In-App Touchpoints:
                    </span>

                    {/* Link 1: View Digital Bill */}
                    <a
                      href={previewData.billLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-2 rounded-lg bg-white/10 hover:bg-white/15 transition-colors text-[11px] text-[#8AB4F8] flex items-center justify-between font-medium cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-[#8AB4F8]" />
                        <span>Link 1: View Digital Assessment</span>
                      </span>
                      <ExternalLink className="w-3 h-3 text-[#8AB4F8]" />
                    </a>

                    {/* Link 2: Instant Settlement */}
                    <a
                      href={previewData.paymentLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-2 rounded-lg bg-[#81C995]/20 hover:bg-[#81C995]/30 transition-colors text-[11px] text-[#81C995] flex items-center justify-between font-medium cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-[#81C995]" />
                        <span>Link 2: In-App Payment Gateway</span>
                      </span>
                      <ExternalLink className="w-3 h-3 text-[#81C995]" />
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Recipient Details Footnote */}
            <div className="text-[11px] text-[#717171] text-center space-y-0.5">
              <p>Recipient: <strong>{previewData.recipientName}</strong></p>
              <p>Phone: <strong>{previewData.recipientPhone}</strong></p>
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: SMS Dispatch & Delivery Audit Log Table */}
      <div className="bg-white border border-[#DADCE0] rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-[#DADCE0] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#2C2C2C]">
              Transactional SMS Dispatch &amp; Delivery Log
            </h3>
            <p className="text-xs text-[#717171] mt-0.5">
              Historical ledger of all billing notifications and statutory demand notices dispatched via Twilio.
            </p>
          </div>

          <span className="text-xs text-[#717171] font-medium">
            {smsLogs.length} transmissions recorded
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#F8F9FA] border-b border-[#DADCE0] text-[#717171] font-semibold text-[11px]">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Recipient Particulars</th>
                <th className="py-3 px-4">Notice Title / Type</th>
                <th className="py-3 px-4">Message Content Preview</th>
                <th className="py-3 px-4 text-center">Channel</th>
                <th className="py-3 px-4 text-center">Delivery Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8EAED] bg-white">
              {smsLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#717171] italic font-normal">
                    No SMS dispatches queued or sent yet. Trigger a rollout above to populate logs.
                  </td>
                </tr>
              ) : (
                smsLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#F8F9FA] transition-colors">
                    <td className="py-3 px-4 text-[#717171] whitespace-nowrap">
                      {log.createdAtFormatted}
                    </td>
                    <td className="py-3 px-4 font-medium text-[#2C2C2C]">
                      <span>{log.recipientName}</span>
                      <p className="text-[11px] text-[#717171]">{log.recipientPhone}</p>
                    </td>
                    <td className="py-3 px-4 font-medium text-[#2C2C2C]">
                      {log.title}
                    </td>
                    <td className="py-3 px-4 text-[#717171] max-w-md truncate">
                      {log.message}
                    </td>
                    <td className="py-3 px-4 text-center text-[#717171]">
                      {log.deliveryMethod}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`font-medium ${
                          log.deliveryStatus === "DELIVERED"
                            ? "text-[#188038]"
                            : log.deliveryStatus === "PENDING"
                            ? "text-[#E37400]"
                            : "text-[#D93025]"
                        }`}
                      >
                        {log.deliveryStatus === "DELIVERED" ? "Delivered" : log.deliveryStatus === "PENDING" ? "Queued" : "Failed"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
