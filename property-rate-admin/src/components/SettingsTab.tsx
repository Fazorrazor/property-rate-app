"use client";

import { useState, useEffect } from "react";
import {
  Shield,
  Radio,
  Key,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Save,
  RefreshCw,
  Eye,
  EyeOff,
  Server,
  Smartphone,
  Info,
  ExternalLink,
} from "lucide-react";
import {
  getSmsSettings,
  updateSmsSettings,
  testArkeselGatewayConnection,
  SmsSettingsData,
} from "@/app/actions";

interface SettingsTabProps {
  onNotify?: (message: string, type: "success" | "error" | "info") => void;
}

export function SettingsTab({ onNotify }: SettingsTabProps) {
  const [settings, setSettings] = useState<SmsSettingsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  // Form State
  const [dispatchMode, setDispatchMode] = useState<"TEST" | "LIVE">("TEST");
  const [apiKey, setApiKey] = useState("YUlJRXNnTUdJaUdndHRNd2Zubms");
  const [showApiKey, setShowApiKey] = useState(false);
  const [senderId, setSenderId] = useState("Arnold");
  const [provider, setProvider] = useState<"arkesel" | "twilio">("arkesel");

  // Diagnostics result
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    smsBalance?: number;
    mainBalance?: string;
  } | null>(null);

  // Safety confirmation dialog state
  const [showLiveConfirmModal, setShowLiveConfirmModal] = useState(false);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const cachedMode = typeof window !== "undefined" ? (localStorage.getItem("kkma_sms_dispatch_mode") as "TEST" | "LIVE" | null) : null;
      if (cachedMode) {
        setDispatchMode(cachedMode);
      }
      const data = await getSmsSettings();
      if (data) {
        setSettings(data);
        const effectiveMode = cachedMode || data.dispatchMode;
        setDispatchMode(effectiveMode);
        setApiKey(data.arkeselApiKey || "YUlJRXNnTUdJaUdndHRNd2Zubms");
        setSenderId(data.arkeselSenderId || "Arnold");
        setProvider(data.provider || "arkesel");
      }
    } catch (err) {
      console.error("Error loading SMS settings:", err);
      onNotify?.("Failed to load SMS settings.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleModeChange = async (newMode: "TEST" | "LIVE") => {
    if (newMode === "LIVE" && dispatchMode !== "LIVE") {
      setShowLiveConfirmModal(true);
    } else {
      setDispatchMode(newMode);
      try {
        if (typeof window !== "undefined") localStorage.setItem("kkma_sms_dispatch_mode", newMode);
        await updateSmsSettings({ dispatchMode: newMode });
        onNotify?.(`Switched to ${newMode === "LIVE" ? "LIVE GATEWAY" : "TEST / SIMULATION"} mode.`, "info");
      } catch (err) {
        console.error("Failed to auto-save dispatch mode:", err);
      }
    }
  };

  const confirmLiveMode = async () => {
    setDispatchMode("LIVE");
    setShowLiveConfirmModal(false);
    try {
      if (typeof window !== "undefined") localStorage.setItem("kkma_sms_dispatch_mode", "LIVE");
      await updateSmsSettings({ dispatchMode: "LIVE" });
      onNotify?.("Live Gateway Mode activated and saved.", "success");
    } catch (err) {
      console.error("Failed to auto-save LIVE mode:", err);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testArkeselGatewayConnection(apiKey);
      if (res.success) {
        setTestResult({
          success: true,
          message: res.message || `Arkesel Gateway Connected. Available: ${res.smsBalance ?? 0} SMS credits.`,
          smsBalance: res.smsBalance,
          mainBalance: res.mainBalance,
        });
        onNotify?.("Gateway connection verified successfully.", "success");
      } else {
        setTestResult({
          success: false,
          message: res.error || "Connection failed. Please check your API key.",
        });
        onNotify?.(res.error || "Gateway connection test failed.", "error");
      }
    } catch (err) {
      console.error(err);
      setTestResult({
        success: false,
        message: "Failed to connect to Arkesel API. Check network connectivity.",
      });
      onNotify?.("Failed to reach Arkesel gateway.", "error");
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    try {
      const res = await updateSmsSettings({
        dispatchMode,
        provider,
        arkeselApiKey: apiKey.trim(),
        arkeselSenderId: senderId.trim(),
      });
      if (res.success) {
        if (typeof window !== "undefined") localStorage.setItem("kkma_sms_dispatch_mode", dispatchMode);
        onNotify?.(
          `Settings saved. Active mode: ${dispatchMode === "LIVE" ? "LIVE GATEWAY" : "TEST / SIMULATION"}.`,
          "success"
        );
        fetchSettings();
      }
    } catch (err) {
      console.error("Error saving settings:", err);
      onNotify?.("Failed to save SMS settings.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#612D53]" />
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-y-auto scrollbar-none bg-white sm:bg-[#F8F9FA] p-0 sm:p-6 font-sans">
      <div className="max-w-4xl w-full mx-auto space-y-0 sm:space-y-6 divide-y divide-[#E8EAED] sm:divide-y-0">
        {/* Header */}
        <div className="bg-white p-4 sm:p-0 sm:bg-transparent sm:border-b sm:border-[#DADCE0] sm:pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
          <div>
            <h1 className="text-base sm:text-lg font-bold text-[#2C2C2C] tracking-tight">
              System &amp; SMS Dispatch Settings
            </h1>
            <p className="text-xs text-[#717171] mt-0.5">
              Configure carrier gateway routes, API credentials, and telephony rollout modes.
            </p>
          </div>

          <div className="flex items-center gap-2 pt-1 sm:pt-0">
            <span
              className={`text-xs font-semibold ${
                dispatchMode === "LIVE" ? "text-[#188038]" : "text-[#B45309]"
              }`}
            >
              {dispatchMode === "LIVE"
                ? "• Live Carrier Dispatch Active"
                : "• Test Sandbox Simulation Active"}
            </span>
          </div>
        </div>

        {/* SECTION 1: DISPATCH MODE TOGGLE (LIVE VS TEST) */}
        <div className="bg-white border-0 sm:border sm:border-[#DADCE0] rounded-none sm:rounded-xl p-4 sm:p-5 shadow-none sm:shadow-xs space-y-3.5">
          <div>
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-[#612D53]" />
              <h2 className="text-sm font-semibold text-[#2C2C2C]">
                Outbound SMS Dispatch Mode
              </h2>
            </div>
            <p className="text-xs text-[#717171] mt-1">
              Select whether rollout demand notices and SMS messages are broadcast live to citizens or tested in simulation mode.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Mode Option 1: Test / Simulation */}
            <div
              onClick={() => handleModeChange("TEST")}
              className={`p-3.5 sm:p-4 rounded-lg border transition-all cursor-pointer ${
                dispatchMode === "TEST"
                  ? "border-[#612D53] bg-[#612D53]/5 shadow-xs"
                  : "border-[#E8EAED] hover:border-[#BDC1C6] bg-white"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      dispatchMode === "TEST"
                        ? "border-[#612D53]"
                        : "border-[#BDC1C6]"
                    }`}
                  >
                    {dispatchMode === "TEST" && (
                      <span className="w-2 h-2 rounded-full bg-[#612D53]" />
                    )}
                  </span>
                  <span className="text-xs font-semibold text-[#2C2C2C]">
                    Test / Simulation Mode
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-[#B45309] shrink-0">
                  &bull; Zero Cost
                </span>
              </div>
              <p className="text-xs text-[#717171] mt-2 pl-6 leading-relaxed">
                Emulates SMS dispatches safely. Generates deep links and audit entries with mock gateway IDs (<code className="text-[10px] text-[#5F6368]">mock-arkesel-...</code>) with zero carrier charges.
              </p>
            </div>

            {/* Mode Option 2: Live Dispatch */}
            <div
              onClick={() => handleModeChange("LIVE")}
              className={`p-3.5 sm:p-4 rounded-lg border transition-all cursor-pointer ${
                dispatchMode === "LIVE"
                  ? "border-[#188038] bg-[#188038]/5 shadow-xs"
                  : "border-[#E8EAED] hover:border-[#BDC1C6] bg-white"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      dispatchMode === "LIVE"
                        ? "border-[#188038]"
                        : "border-[#BDC1C6]"
                    }`}
                  >
                    {dispatchMode === "LIVE" && (
                      <span className="w-2 h-2 rounded-full bg-[#188038]" />
                    )}
                  </span>
                  <span className="text-xs font-semibold text-[#2C2C2C]">
                    Live Gateway Mode
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-[#188038] shrink-0">
                  &bull; Real Carrier SMS
                </span>
              </div>
              <p className="text-xs text-[#717171] mt-2 pl-6 leading-relaxed">
                Routes dispatches through the Arkesel HTTP API over Ghana mobile network operators (MTN, Telecel, AT). Delivers real SMS to ratepayers and deducts account credits.
              </p>
            </div>
          </div>
        </div>

        {/* SECTION 2: ARKESEL GATEWAY CONFIGURATION */}
        <div className="bg-white border-0 sm:border sm:border-[#DADCE0] rounded-none sm:rounded-xl p-4 sm:p-5 shadow-none sm:shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#F1F3F4] pb-3 gap-3">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-[#612D53] shrink-0" />
              <div>
                <h2 className="text-sm font-semibold text-[#2C2C2C]">
                  Arkesel Carrier Route Credentials (Ghana)
                </h2>
                <p className="text-xs text-[#717171] mt-0.5">
                  Direct HTTP gateway routing for Ghanaian E.164 mobile numbers (+233).
                </p>
              </div>
            </div>

            {/* Live Gateway Balance Indicator & Direct Top-up Link */}
            <div className="p-2.5 sm:p-0 bg-[#F8F9FA] sm:bg-transparent rounded-lg sm:rounded-none border sm:border-0 border-[#E8EAED] text-left sm:text-right text-xs space-y-0.5">
              <span className="text-[#717171] block text-[10px] uppercase font-semibold tracking-wider">Live Gateway Balance</span>
              <div className="flex flex-wrap items-center sm:justify-end gap-2">
                <span className="font-semibold text-[#188038]">
                  {settings?.balanceInfo
                    ? `${settings.balanceInfo.smsBalance} SMS Credits • ${settings.balanceInfo.mainBalance.replace('GHS', 'GH₵')}`
                    : "93 SMS Credits • GH₵ 0.025"}
                </span>
                <span className="text-[#DADCE0]">&bull;</span>
                <a
                  href={
                    provider === "arkesel"
                      ? "https://sms.arkesel.com/user/billing/make-payment"
                      : "https://console.twilio.com/billing"
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#612D53] hover:underline cursor-pointer"
                  title={`Open ${provider === "arkesel" ? "Arkesel payment portal" : "Twilio billing portal"} to top up balance`}
                >
                  <span>Top Up {provider === "arkesel" ? "Arkesel" : "Twilio"}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* API Key */}
              <div className="space-y-1.5 md:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#2C2C2C]">
                    Arkesel API Key
                  </label>
                  <span className="text-[11px] text-[#717171]">
                    Required for live dispatches &amp; balance lookups
                  </span>
                </div>
                <div className="relative flex items-center">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    aria-label="Arkesel API Key"
                    placeholder="Enter Arkesel API key..."
                    autoComplete="off"
                    data-form-type="other"
                    className="w-full h-11 sm:h-9 px-3 pr-10 border border-[#DADCE0] rounded-lg text-xs font-mono text-[#2C2C2C] focus:border-[#612D53] focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 text-[#717171] hover:text-[#2C2C2C] cursor-pointer p-1"
                    title={showApiKey ? "Hide Key" : "Reveal Key"}
                  >
                    {showApiKey ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Sender ID */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#2C2C2C]">
                  Registered Sender ID
                </label>
                <input
                  type="text"
                  maxLength={11}
                  value={senderId}
                  onChange={(e) => setSenderId(e.target.value)}
                  aria-label="Registered SMS Sender ID"
                  placeholder="e.g. Arnold or KKMA-Rev"
                  autoComplete="off"
                  data-form-type="other"
                  className="w-full h-11 sm:h-9 px-3 border border-[#DADCE0] rounded-lg text-xs font-mono text-[#2C2C2C] focus:border-[#612D53] focus:outline-none transition-colors"
                />
                <p className="text-[10px] text-[#717171]">
                  Max 11 alphanumeric characters approved by Ghana NCA.
                </p>
              </div>

              {/* SMS Provider Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#2C2C2C]">
                  Active Telephony Engine
                </label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as any)}
                  aria-label="Active Telephony Engine"
                  className="w-full h-11 sm:h-9 px-3 border border-[#DADCE0] rounded-lg text-xs text-[#2C2C2C] bg-white focus:border-[#612D53] focus:outline-none cursor-pointer"
                >
                  <option value="arkesel">Arkesel (Ghana Domestic Gateway)</option>
                  <option value="twilio">Twilio (International Gateway)</option>
                </select>
                <p className="text-[10px] text-[#717171]">
                  {provider === "arkesel"
                    ? "Arkesel is optimized for Ghana domestic routes (+233)."
                    : "Twilio routes international SMS and US/UK telephone numbers."}
                </p>
              </div>
            </div>

            {/* Test Diagnostic Result Banner */}
            {testResult && (
              <div
                className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                  testResult.success
                    ? "bg-[#E6F4EA] border-[#CEEAD6] text-[#137333]"
                    : "bg-[#FCE8E6] border-[#FAD2CF] text-[#C5221F]"
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <span className="font-semibold block">
                    {testResult.success ? "Gateway Health OK" : "Connection Test Failed"}
                  </span>
                  <span className="text-[11px] block mt-0.5">
                    {testResult.message}
                  </span>
                </div>
              </div>
            )}

            {/* Action Buttons: 44px min target on mobile */}
            <div className="pt-2 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2.5 border-t border-[#F1F3F4]">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting || !apiKey.trim()}
                className="w-full sm:w-auto h-11 sm:h-9 px-4 rounded-lg border border-[#DADCE0] hover:bg-[#F8F9FA] active:bg-[#F1F3F4] text-xs font-semibold text-[#2C2C2C] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
              >
                {isTesting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#612D53]" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 text-[#717171]" />
                )}
                <span>Test Gateway Connection</span>
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="btn-3d w-full sm:w-auto h-11 sm:h-9 px-5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isSaving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                ) : (
                  <Save className="w-3.5 h-3.5 text-white" />
                )}
                <span>Save Settings</span>
              </button>
            </div>
          </form>
        </div>

        {/* SECTION 3: SYSTEM REFERENCE DETAILS */}
        <div className="bg-white border-0 sm:border sm:border-[#DADCE0] rounded-none sm:rounded-xl p-4 sm:p-5 shadow-none sm:shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-[#717171]" />
            <h3 className="text-xs font-semibold text-[#2C2C2C]">
              Carrier Protocol Standards &bull; Act 936
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs text-[#717171] pt-1">
            <div className="p-3 bg-[#F8F9FA] rounded-lg border border-[#E8EAED]">
              <span className="font-semibold text-[#2C2C2C] block">Dual Direct Links</span>
              <span className="text-[11px] mt-1 block leading-relaxed">
                Every demand notice embeds an assessment inspection link and an instant checkout link.
              </span>
            </div>
            <div className="p-3 bg-[#F8F9FA] rounded-lg border border-[#E8EAED]">
              <span className="font-semibold text-[#2C2C2C] block">E.164 Normalization</span>
              <span className="text-[11px] mt-1 block leading-relaxed">
                Local formats (024, 050, 020) are automatically formatted to Ghana +233 standard before dispatch.
              </span>
            </div>
            <div className="p-3 bg-[#F8F9FA] rounded-lg border border-[#E8EAED]">
              <span className="font-semibold text-[#2C2C2C] block">Auditing &amp; SIDs</span>
              <span className="text-[11px] mt-1 block leading-relaxed">
                All dispatches write to the municipal audit trail with provider transaction SIDs.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Safety Confirmation Modal for Switching to LIVE Mode */}
      {showLiveConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-0 sm:p-4 font-sans">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl border border-[#DADCE0] max-w-md w-full p-5 space-y-4 animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-[#FEF7E0] border border-[#FEEFC3] flex items-center justify-center shrink-0 text-[#B06000]">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-[#2C2C2C]">
                  Switch to Live SMS Gateway Mode?
                </h3>
                <p className="text-xs text-[#5F6368] mt-1.5 leading-relaxed">
                  In <strong>Live Mode</strong>, all subsequent batch dispatches will deliver actual SMS messages directly to ratepayers&apos; mobile phones across Ghanaian telecom networks and deduct paid SMS credits from your Arkesel account.
                </p>
                <div className="mt-3 p-2.5 bg-[#F8F9FA] rounded-lg border border-[#DADCE0] text-[11px] text-[#717171]">
                  <strong>Current Balance:</strong> {settings?.balanceInfo?.smsBalance ?? 93} SMS units available on API key.
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 pt-2 border-t border-[#F1F3F4]">
              <button
                type="button"
                onClick={() => setShowLiveConfirmModal(false)}
                className="w-full sm:w-auto h-11 sm:h-9 px-4 text-xs font-semibold text-[#5F6368] hover:text-[#202124] hover:bg-[#F1F3F4] rounded-lg transition-colors cursor-pointer flex items-center justify-center"
              >
                Cancel (Keep in Test Mode)
              </button>
              <button
                type="button"
                onClick={confirmLiveMode}
                className="w-full sm:w-auto h-11 sm:h-9 px-4 text-xs font-semibold text-white bg-[#188038] hover:bg-[#137333] active:bg-[#0D652D] rounded-lg transition-colors cursor-pointer flex items-center justify-center"
              >
                Confirm Switch to Live Mode
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
