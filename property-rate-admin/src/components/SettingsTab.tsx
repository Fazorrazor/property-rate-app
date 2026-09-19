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
  Sparkles,
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
        if (data.arkeselApiKey) setApiKey(data.arkeselApiKey);
        if (data.arkeselSenderId) setSenderId(data.arkeselSenderId);
        if (!cachedMode) setDispatchMode(data.dispatchMode);
        if (data.provider) setProvider(data.provider);
      }
    } catch (err) {
      console.error("Failed to load SMS settings:", err);
      onNotify?.("Failed to fetch settings from server.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleModeChange = (mode: "TEST" | "LIVE") => {
    if (mode === "LIVE") {
      setShowLiveConfirmModal(true);
    } else {
      setDispatchMode("TEST");
      if (typeof window !== "undefined") localStorage.setItem("kkma_sms_dispatch_mode", "TEST");
      onNotify?.("Switched to Safe Test / Simulation mode.", "info");
    }
  };

  const confirmLiveMode = () => {
    setDispatchMode("LIVE");
    if (typeof window !== "undefined") localStorage.setItem("kkma_sms_dispatch_mode", "LIVE");
    setShowLiveConfirmModal(false);
    onNotify?.("LIVE GATEWAY ACTIVATED. SMS dispatches will now be billed and delivered to real phones.", "success");
  };

  const handleTestConnection = async () => {
    if (!apiKey.trim()) {
      onNotify?.("Please enter an Arkesel API key to test.", "error");
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await testArkeselGatewayConnection(apiKey.trim());
      if (result.success) {
        const successMsg = result.message || "Connected to Arkesel SMS gateway.";
        setTestResult({
          success: true,
          message: successMsg,
          smsBalance: result.smsBalance,
          mainBalance: result.mainBalance,
        });
        onNotify?.(successMsg, "success");
      } else {
        const errorMsg = result.error || "Gateway connection failed.";
        setTestResult({
          success: false,
          message: errorMsg,
        });
        onNotify?.(errorMsg, "error");
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: "Failed to communicate with Arkesel endpoint. Check your network.",
      });
      onNotify?.("Gateway connection test timed out.", "error");
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      onNotify?.("API key cannot be blank.", "error");
      return;
    }
    if (!senderId.trim()) {
      onNotify?.("Sender ID cannot be blank.", "error");
      return;
    }
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
      <div className="flex-1 flex items-center justify-center p-12 bg-[#F2F2F7]">
        <Loader2 className="w-6 h-6 animate-spin text-[#007AFF]" />
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-y-auto scrollbar-none bg-[#F2F2F7] p-4 sm:p-8 font-sans">
      <div className="max-w-4xl w-full mx-auto space-y-6">
        {/* Header */}
        <div className="border-b border-[#E5E5EA] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#1C1C1E] tracking-tight">
              System &amp; SMS Dispatch Settings
            </h1>
            <p className="text-xs text-[#6C6C70] mt-1">
              Configure carrier gateway routes, API credentials, and telephony rollout modes.
            </p>
          </div>

          <div className="flex items-center gap-2 pt-1 sm:pt-0">
            <span
              className={`text-xs font-semibold ${
                dispatchMode === "LIVE" ? "text-[#34C759]" : "text-[#FF9500]"
              }`}
            >
              {dispatchMode === "LIVE"
                ? "• Live Carrier Dispatch Active"
                : "• Test Sandbox Simulation Active"}
            </span>
          </div>
        </div>

        {/* SECTION 1: DISPATCH MODE TOGGLE (LIVE VS TEST) */}
        <div className="bg-white border border-[#E5E5EA] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <div>
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-[#007AFF]" />
              <h2 className="text-sm font-semibold text-[#1C1C1E]">
                Outbound SMS Dispatch Mode
              </h2>
            </div>
            <p className="text-xs text-[#6C6C70] mt-1">
              Select whether rollout demand notices and SMS messages are broadcast live to citizens or tested in simulation mode.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            {/* Mode Option 1: Test / Simulation */}
            <div
              onClick={() => handleModeChange("TEST")}
              className={`p-4 rounded-xl border transition-all cursor-pointer ${
                dispatchMode === "TEST"
                  ? "border-[#007AFF] bg-[#007AFF]/5 shadow-xs"
                  : "border-[#E5E5EA] hover:border-[#007AFF]/40 bg-white"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      dispatchMode === "TEST"
                        ? "border-[#007AFF]"
                        : "border-[#C7C7CC]"
                    }`}
                  >
                    {dispatchMode === "TEST" && (
                      <span className="w-2 h-2 rounded-full bg-[#007AFF]" />
                    )}
                  </span>
                  <span className="text-xs font-semibold text-[#1C1C1E]">
                    Test / Simulation Mode
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-[#007AFF] shrink-0">
                  &bull; Zero Cost
                </span>
              </div>
              <p className="text-xs text-[#6C6C70] mt-2 pl-6 leading-relaxed">
                Emulates SMS dispatches safely. Generates deep links and audit entries with mock gateway IDs (<code className="text-[10px] text-[#6C6C70]">mock-arkesel-...</code>) with zero carrier charges.
              </p>
            </div>

            {/* Mode Option 2: Live Dispatch */}
            <div
              onClick={() => handleModeChange("LIVE")}
              className={`p-4 rounded-xl border transition-all cursor-pointer ${
                dispatchMode === "LIVE"
                  ? "border-[#34C759] bg-[#34C759]/5 shadow-xs"
                  : "border-[#E5E5EA] hover:border-[#34C759]/40 bg-white"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      dispatchMode === "LIVE"
                        ? "border-[#34C759]"
                        : "border-[#C7C7CC]"
                    }`}
                  >
                    {dispatchMode === "LIVE" && (
                      <span className="w-2 h-2 rounded-full bg-[#34C759]" />
                    )}
                  </span>
                  <span className="text-xs font-semibold text-[#1C1C1E]">
                    Live Gateway Mode
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-[#34C759] shrink-0">
                  &bull; Real Carrier SMS
                </span>
              </div>
              <p className="text-xs text-[#6C6C70] mt-2 pl-6 leading-relaxed">
                Routes dispatches through the Arkesel HTTP API over Ghana mobile network operators (MTN, Telecel, AT). Delivers real SMS to ratepayers and deducts account credits.
              </p>
            </div>
          </div>
        </div>

        {/* SECTION 2: ARKESEL GATEWAY CONFIGURATION */}
        <div className="bg-white border border-[#E5E5EA] rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#E5E5EA] pb-4 gap-3">
            <div className="flex items-center gap-2.5">
              <Key className="w-4 h-4 text-[#007AFF] shrink-0" />
              <div>
                <h2 className="text-sm font-semibold text-[#1C1C1E]">
                  Arkesel Carrier Route Credentials (Ghana)
                </h2>
                <p className="text-xs text-[#6C6C70] mt-0.5">
                  Direct HTTP gateway routing for Ghanaian E.164 mobile numbers (+233).
                </p>
              </div>
            </div>

            {/* Live Gateway Balance Indicator & Direct Top-up Link */}
            <div className="p-3 sm:p-0 bg-[#F8F9FA] sm:bg-transparent rounded-xl sm:rounded-none border sm:border-0 border-[#E5E5EA] text-left sm:text-right text-xs space-y-0.5">
              <span className="text-[#6C6C70] block text-[10px] uppercase font-semibold tracking-wider">Live Gateway Balance</span>
              <div className="flex flex-wrap items-center sm:justify-end gap-2">
                <span className="font-semibold text-[#34C759]">
                  {settings?.balanceInfo
                    ? `${settings.balanceInfo.smsBalance} SMS Credits • ${settings.balanceInfo.mainBalance.replace('GHS', 'GH₵')}`
                    : "93 SMS Credits • GH₵ 0.025"}
                </span>
                <span className="text-[#C7C7CC]">&bull;</span>
                <a
                  href={
                    provider === "arkesel"
                      ? "https://sms.arkesel.com/user/billing/make-payment"
                      : "https://console.twilio.com/billing"
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#007AFF] hover:underline cursor-pointer"
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
                  <label className="text-xs font-semibold text-[#1C1C1E]">
                    Arkesel API Key
                  </label>
                  <span className="text-[11px] text-[#6C6C70]">
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
                    className="w-full h-11 sm:h-10 px-3.5 pr-10 border border-[#E5E5EA] rounded-xl text-xs font-mono bg-[#F2F2F7] text-[#1C1C1E] focus:bg-white focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 focus:outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 text-[#8E8E93] hover:text-[#1C1C1E] cursor-pointer p-1 transition-colors"
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
                <label className="text-xs font-semibold text-[#1C1C1E]">
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
                  className="w-full h-11 sm:h-10 px-3.5 border border-[#E5E5EA] rounded-xl text-xs font-mono bg-[#F2F2F7] text-[#1C1C1E] focus:bg-white focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 focus:outline-none transition-all"
                />
                <p className="text-[10px] text-[#6C6C70]">
                  Max 11 alphanumeric characters approved by Ghana NCA.
                </p>
              </div>

              {/* SMS Provider Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1C1C1E]">
                  Active Telephony Engine
                </label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as any)}
                  aria-label="Active Telephony Engine"
                  className="w-full h-11 sm:h-10 px-3.5 border border-[#E5E5EA] rounded-xl text-xs bg-[#F2F2F7] text-[#1C1C1E] focus:bg-white focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 focus:outline-none transition-all cursor-pointer"
                >
                  <option value="arkesel">Arkesel (Ghana Domestic Gateway)</option>
                  <option value="twilio">Twilio (International Gateway)</option>
                </select>
                <p className="text-[10px] text-[#6C6C70]">
                  {provider === "arkesel"
                    ? "Arkesel is optimized for Ghana domestic routes (+233)."
                    : "Twilio routes international SMS and US/UK telephone numbers."}
                </p>
              </div>
            </div>

            {/* Test Diagnostic Result Banner */}
            {testResult && (
              <div
                className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                  testResult.success
                    ? "bg-[#34C759]/10 border-[#34C759]/30 text-[#34C759]"
                    : "bg-[#FF3B30]/10 border-[#FF3B30]/30 text-[#FF3B30]"
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
            <div className="pt-3 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 border-t border-[#E5E5EA]">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting || !apiKey.trim()}
                className="apple-btn-secondary w-full sm:w-auto h-11 sm:h-9 px-4 disabled:opacity-50"
              >
                {isTesting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#007AFF]" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 text-[#6C6C70]" />
                )}
                <span>Test Gateway Connection</span>
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="apple-btn-primary w-full sm:w-auto h-11 sm:h-9 px-5 disabled:opacity-50"
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
        <div className="bg-white border border-[#E5E5EA] rounded-2xl p-5 sm:p-6 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-[#6C6C70]" />
            <h3 className="text-xs font-semibold text-[#1C1C1E]">
              Carrier Protocol Standards &bull; Act 936
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs text-[#6C6C70] pt-1">
            <div className="p-3.5 bg-[#F8F9FA] rounded-xl border border-[#E5E5EA]">
              <span className="font-semibold text-[#1C1C1E] block">Dual Direct Links</span>
              <span className="text-[11px] mt-1 block leading-relaxed">
                Every demand notice embeds an assessment inspection link and an instant checkout link.
              </span>
            </div>
            <div className="p-3.5 bg-[#F8F9FA] rounded-xl border border-[#E5E5EA]">
              <span className="font-semibold text-[#1C1C1E] block">E.164 Normalization</span>
              <span className="text-[11px] mt-1 block leading-relaxed">
                Local formats (024, 050, 020) are automatically formatted to Ghana +233 standard before dispatch.
              </span>
            </div>
            <div className="p-3.5 bg-[#F8F9FA] rounded-xl border border-[#E5E5EA]">
              <span className="font-semibold text-[#1C1C1E] block">Auditing &amp; SIDs</span>
              <span className="text-[11px] mt-1 block leading-relaxed">
                All dispatches write to the municipal audit trail with provider transaction SIDs.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Safety Confirmation Modal for Switching to LIVE Mode */}
      {showLiveConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/35 backdrop-blur-xs p-0 sm:p-4 font-sans">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-[#E5E5EA] max-w-md w-full p-6 space-y-4 animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FF9500]/10 border border-[#FF9500]/20 flex items-center justify-center shrink-0 text-[#FF9500]">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-[#1C1C1E]">
                  Switch to Live SMS Gateway Mode?
                </h3>
                <p className="text-xs text-[#6C6C70] mt-1.5 leading-relaxed">
                  In <strong>Live Mode</strong>, all subsequent batch dispatches will deliver actual SMS messages directly to ratepayers&apos; mobile phones across Ghanaian telecom networks and deduct paid SMS credits from your Arkesel account.
                </p>
                <div className="mt-3 p-3 bg-[#F8F9FA] rounded-xl border border-[#E5E5EA] text-[11px] text-[#6C6C70]">
                  <strong>Current Balance:</strong> {settings?.balanceInfo?.smsBalance ?? 93} SMS units available on API key.
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-3 border-t border-[#E5E5EA]">
              <button
                type="button"
                onClick={() => setShowLiveConfirmModal(false)}
                className="apple-btn-secondary w-full sm:w-auto h-11 sm:h-9 px-4"
              >
                Cancel (Keep in Test Mode)
              </button>
              <button
                type="button"
                onClick={confirmLiveMode}
                className="w-full sm:w-auto h-11 sm:h-9 px-4 text-xs font-semibold text-white bg-[#34C759] hover:bg-[#2EB84E] active:scale-[0.98] rounded-lg transition-all cursor-pointer flex items-center justify-center shadow-xs"
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
