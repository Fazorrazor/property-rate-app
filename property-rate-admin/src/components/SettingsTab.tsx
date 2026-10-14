"use client";

import { useState, useEffect } from "react";
import {
  Radio,
  CheckCircle2,
  AlertTriangle,
  Save,
  RefreshCw,
  Eye,
  EyeOff,
  Server,
  ExternalLink,
  FlaskConical,
  Search,
  Copy,
  Check,
} from "lucide-react";
import {
  getSmsSettings,
  updateSmsSettings,
  testArkeselGatewayConnection,
  getTestAccountsStateAction,
  updateTestAccountBalancesAction,
  SmsSettingsData,
} from "@/app/actions";
import { TEST_ACCOUNTS } from "@/lib/testPresets";
import { AppleSpinner } from "./ui/AppleSpinner";
import { SettingsSkeleton } from "@/components/Skeletons";

interface SettingsTabProps {
  onNotify?: (message: string, type: "success" | "error" | "info") => void;
}

export function SettingsTab({ onNotify }: SettingsTabProps) {
  const [settings, setSettings] = useState<SmsSettingsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  // Settings Navigation: "TEST_USERS" | "GATEWAY" | "PROTOCOLS"
  const [activeSettingsTab, setActiveSettingsTab] = useState<"TEST_USERS" | "GATEWAY" | "PROTOCOLS">("TEST_USERS");
  const [selectedTestAccountId, setSelectedTestAccountId] = useState<string>("heinz-multi");

  // Form State
  const [dispatchMode, setDispatchMode] = useState<"TEST" | "LIVE">("TEST");
  const [apiKey, setApiKey] = useState("YUlJRXNnTUdJaUdndHRNd2Zubms");
  const [showApiKey, setShowApiKey] = useState(false);
  const [senderId, setSenderId] = useState("KKMA");
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

  // Dynamic Test Account Sandbox State
  const [activePropertyAcc, setActivePropertyAcc] = useState<string>("KKDA03001001");
  const [propertySearchQuery, setPropertySearchQuery] = useState("");
  const [balancesState, setBalancesState] = useState<Record<string, { arrears: string; currentBill: string }>>({});
  const [isFetchingBalances, setIsFetchingBalances] = useState(false);
  const [isSavingBalances, setIsSavingBalances] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const citizenAppUrl = process.env.NEXT_PUBLIC_CITIZEN_APP_URL || "https://property-rate-app.vercel.app";

  const selectedTestAccount = TEST_ACCOUNTS.find((a) => a.id === selectedTestAccountId) || TEST_ACCOUNTS[0];

  // Whenever test account switches, set active property to the first property in that account
  useEffect(() => {
    if (selectedTestAccount && selectedTestAccount.properties.length > 0) {
      setActivePropertyAcc(selectedTestAccount.properties[0].accountNumber);
      setPropertySearchQuery("");
    }
  }, [selectedTestAccountId]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const fetchTestAccountBalances = async () => {
    setIsFetchingBalances(true);
    try {
      const res = await getTestAccountsStateAction();
      if (res.success && res.balances) {
        const nextState: Record<string, { arrears: string; currentBill: string }> = {};
        for (const acc of TEST_ACCOUNTS) {
          for (const prop of acc.properties) {
            const dbVal = res.balances[prop.accountNumber];
            nextState[prop.accountNumber] = {
              arrears: dbVal !== undefined ? Number(dbVal.arrears).toFixed(2) : prop.defaultArrears.toFixed(2),
              currentBill: dbVal !== undefined ? Number(dbVal.currentBill).toFixed(2) : prop.defaultCurrentBill.toFixed(2),
            };
          }
        }
        setBalancesState(nextState);
      }
    } catch (err) {
      console.error("Failed to load test balances:", err);
    } finally {
      setIsFetchingBalances(false);
    }
  };

  const handleBalanceChange = (accountNumber: string, field: "arrears" | "currentBill", val: string) => {
    setBalancesState((prev) => ({
      ...prev,
      [accountNumber]: {
        ...prev[accountNumber],
        [field]: val,
      },
    }));
  };

  const handleZeroOut = (accountNumber: string) => {
    setBalancesState((prev) => ({
      ...prev,
      [accountNumber]: { arrears: "0.00", currentBill: "0.00" },
    }));
  };

  const handleSaveSingleProperty = async (accountNumber: string) => {
    const current = balancesState[accountNumber];
    const arrears = current ? Math.max(0, parseFloat(current.arrears) || 0) : 0;
    const currentBill = current ? Math.max(0, parseFloat(current.currentBill) || 0) : 0;

    setIsSavingBalances(true);
    try {
      const res = await updateTestAccountBalancesAction([
        { accountNumber, arrears, currentBill },
      ]);
      if (res.success) {
        setBalancesState((prev) => ({
          ...prev,
          [accountNumber]: {
            arrears: arrears.toFixed(2),
            currentBill: currentBill.toFixed(2),
          },
        }));
        onNotify?.(`Cadastre ${accountNumber} updated to GH₵ ${(arrears + currentBill).toFixed(2)} in database.`, "success");
        await fetchTestAccountBalances();
      } else {
        onNotify?.(`Failed to update ${accountNumber}: ${res.error}`, "error");
      }
    } catch {
      onNotify?.("Failed to update test account", "error");
    } finally {
      setIsSavingBalances(false);
    }
  };

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
    fetchTestAccountBalances();
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

  // Filter properties for active multi-property account
  const filteredProperties = selectedTestAccount?.properties.filter((p) => {
    if (!propertySearchQuery.trim()) return true;
    const q = propertySearchQuery.toLowerCase();
    return p.accountNumber.toLowerCase().includes(q) || p.digitalAddress.toLowerCase().includes(q);
  }) || [];

  const selectedProperty =
    selectedTestAccount?.properties.find((p) => p.accountNumber === activePropertyAcc) ||
    filteredProperties[0] ||
    selectedTestAccount?.properties[0] ||
    null;

  const currentArrearsStr = selectedProperty ? (balancesState[selectedProperty.accountNumber]?.arrears ?? selectedProperty.defaultArrears.toFixed(2)) : "0.00";
  const currentBillStr = selectedProperty ? (balancesState[selectedProperty.accountNumber]?.currentBill ?? selectedProperty.defaultCurrentBill.toFixed(2)) : "0.00";
  const arrNum = parseFloat(currentArrearsStr) || 0;
  const curNum = parseFloat(currentBillStr) || 0;
  const currentTotalDue = (arrNum + curNum).toFixed(2);
  const isPropPaid = arrNum === 0 && curNum === 0;

  if (isLoading) {
    return <SettingsSkeleton />;
  }

  return (
    <div className="w-full flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden bg-white font-sans border-0 rounded-none shadow-none">
      {/* MOBILE SETTINGS NAVIGATION STRIP (< 768px) - Clean Apple Typography, Zero Pills */}
      <div className="block md:hidden border-b border-[#E5E5EA] bg-white px-4 shrink-0">
        <div className="flex items-center gap-6 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveSettingsTab("TEST_USERS")}
            className={`py-3 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer relative ${
              activeSettingsTab === "TEST_USERS"
                ? "text-[#007AFF] border-b-2 border-[#007AFF]"
                : "text-[#6C6C70] hover:text-[#1C1C1E]"
            }`}
          >
            <span>Test Users</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSettingsTab("GATEWAY")}
            className={`py-3 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer relative ${
              activeSettingsTab === "GATEWAY"
                ? "text-[#007AFF] border-b-2 border-[#007AFF]"
                : "text-[#6C6C70] hover:text-[#1C1C1E]"
            }`}
          >
            <span>SMS Gateway</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSettingsTab("PROTOCOLS")}
            className={`py-3 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer relative ${
              activeSettingsTab === "PROTOCOLS"
                ? "text-[#007AFF] border-b-2 border-[#007AFF]"
                : "text-[#6C6C70] hover:text-[#1C1C1E]"
            }`}
          >
            <span>Compliance &amp; Protocols</span>
          </button>
        </div>
      </div>

      {/* DESKTOP SUPABASE SECONDARY SIDEBAR (>= 768px) */}
      <aside className="hidden md:flex w-64 shrink-0 border-r border-[#E5E5EA] bg-[#FBFBFB] flex-col justify-between overflow-y-auto">
        <div className="p-3 space-y-6">
          <div className="px-3 pt-2">
            <h2 className="text-base font-bold text-[#1C1C1E] tracking-tight">
              Settings
            </h2>
            <p className="text-[11px] text-[#8E8E93] mt-0.5">
              System &amp; Simulator
            </p>
          </div>

          {/* MAIN SETTINGS MODULES */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider px-3 block">
              Configuration
            </span>
            <button
              type="button"
              onClick={() => setActiveSettingsTab("TEST_USERS")}
              className={`w-full px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors cursor-pointer flex items-center gap-2.5 ${
                activeSettingsTab === "TEST_USERS"
                  ? "bg-[#007AFF]/10 text-[#007AFF] font-semibold"
                  : "text-[#6C6C70] hover:text-[#1C1C1E] hover:bg-[#F2F2F7]"
              }`}
            >
              <FlaskConical className="w-3.5 h-3.5 shrink-0" />
              <span>Test Users Sandbox</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSettingsTab("GATEWAY")}
              className={`w-full px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors cursor-pointer flex items-center gap-2.5 ${
                activeSettingsTab === "GATEWAY"
                  ? "bg-[#007AFF]/10 text-[#007AFF] font-semibold"
                  : "text-[#6C6C70] hover:text-[#1C1C1E] hover:bg-[#F2F2F7]"
              }`}
            >
              <Radio className="w-3.5 h-3.5 shrink-0" />
              <span>SMS Gateway</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSettingsTab("PROTOCOLS")}
              className={`w-full px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors cursor-pointer flex items-center gap-2.5 ${
                activeSettingsTab === "PROTOCOLS"
                  ? "bg-[#007AFF]/10 text-[#007AFF] font-semibold"
                  : "text-[#6C6C70] hover:text-[#1C1C1E] hover:bg-[#F2F2F7]"
              }`}
            >
              <Server className="w-3.5 h-3.5 shrink-0" />
              <span>Compliance &amp; Protocols</span>
            </button>
          </div>

          {/* WHEN IN TEST USERS TAB: SUB-LIST IN SIDEBAR */}
          {activeSettingsTab === "TEST_USERS" && (
            <div className="space-y-1 pt-2 border-t border-[#E5E5EA]">
              <span className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider px-3 block">
                Test Profiles
              </span>
              {TEST_ACCOUNTS.map((acc) => {
                const isSelected = selectedTestAccountId === acc.id;
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => {
                      setSelectedTestAccountId(acc.id);
                      if (acc.properties.length > 0) {
                        setActivePropertyAcc(acc.properties[0].accountNumber);
                        setPropertySearchQuery("");
                      }
                    }}
                    className={`w-full px-3 py-2 rounded-lg text-xs text-left transition-colors cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? "bg-[#007AFF]/10 text-[#007AFF] font-semibold"
                        : "text-[#6C6C70] hover:text-[#1C1C1E] hover:bg-[#F2F2F7]"
                    }`}
                  >
                    <div className="min-w-0 pr-1">
                      <span className="block truncate">{acc.name}</span>
                      <span className="text-[10px] text-[#8E8E93] block truncate font-mono">
                        {acc.phone}
                      </span>
                    </div>
                    <span className="text-[10px] text-[#8E8E93] shrink-0">
                      {acc.badgeDescription}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar Footer: Gateway Balance Badge */}
        <div className="p-3 border-t border-[#E5E5EA] bg-white text-xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#8E8E93] block">
            Gateway Balance
          </span>
          <span className="font-mono font-semibold text-[#34C759] text-xs block tabular-nums">
            {settings?.balanceInfo
              ? `${settings.balanceInfo.smsBalance} Credits • ${settings.balanceInfo.mainBalance.replace('GHS', 'GH₵')}`
              : "93 Credits • GH₵ 0.025"}
          </span>
        </div>
      </aside>

      {/* MAIN CONTENT CANVAS (SUPABASE SINGLE CENTERED COLUMN) */}
      <main className="flex-1 min-h-0 overflow-y-auto bg-white p-4 sm:p-6 lg:p-10">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* VIEW A: TEST ACCOUNT SANDBOX (When Test Users tab is active) */}
          {activeSettingsTab === "TEST_USERS" && selectedTestAccount && selectedProperty && (
            <div className="space-y-8 animate-in fade-in-50 duration-200">
              {/* Interactive Test Ratepayer Profile Selector */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#1C1C1E] block">
                    Select Test Ratepayer Profile
                  </span>
                  <span className="text-[11px] text-[#6C6C70]">
                    {TEST_ACCOUNTS.length} configured profiles
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {TEST_ACCOUNTS.map((acc) => {
                    const isSelected = selectedTestAccountId === acc.id;
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => {
                          setSelectedTestAccountId(acc.id);
                          if (acc.properties.length > 0) {
                            setActivePropertyAcc(acc.properties[0].accountNumber);
                            setPropertySearchQuery("");
                          }
                        }}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative flex flex-col justify-between gap-2 ${
                          isSelected
                            ? "border-[#007AFF] bg-[#007AFF]/5 shadow-2xs"
                            : "border-[#E5E5EA] bg-white hover:border-[#D1D1D6] hover:bg-[#F9FAFB]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className={`text-xs font-semibold block truncate ${isSelected ? "text-[#007AFF]" : "text-[#1C1C1E]"}`}>
                              {acc.name}
                            </span>
                            <span className="text-[10px] text-[#8E8E93] font-mono block mt-0.5">
                              {acc.phone}
                            </span>
                          </div>
                          {isSelected && (
                            <span className="text-[10px] text-[#007AFF] font-bold shrink-0">
                              Active
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-[#6C6C70] border-t border-[#E5E5EA]/60 pt-2 mt-1">
                          <span className="truncate">{acc.badgeDescription}</span>
                          <span className="text-[10px] font-mono text-[#8E8E93]">{acc.properties.length} propert{acc.properties.length === 1 ? "y" : "ies"}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selected Profile Header */}
              <div className="border-t border-[#E5E5EA] pt-6">
                <h1 className="text-xl font-bold text-[#1C1C1E] tracking-tight">
                  {selectedTestAccount.name}
                </h1>
                <p className="text-xs text-[#6C6C70] mt-1">
                  {selectedTestAccount.description}
                </p>
              </div>

              {/* Multi-Property Cadastre Selector (Tabs + Filter) */}
              {selectedTestAccount.category === "MULTI" && (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-[#1C1C1E]">
                      Select Property Cadastre ({selectedTestAccount.properties.length} linked)
                    </span>
                    <div className="relative w-full sm:w-64">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8E93]" />
                      <input
                        type="text"
                        value={propertySearchQuery}
                        onChange={(e) => setPropertySearchQuery(e.target.value)}
                        placeholder="Filter by account or address..."
                        className="w-full h-8 pl-8 pr-3 rounded-lg border border-[#E5E5EA] text-xs bg-[#F9FAFB] text-[#1C1C1E] placeholder:text-[#8E8E93] focus:bg-white focus:outline-none focus:border-[#007AFF] transition-all"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        data-lpignore="true"
                        data-1p-ignore="true"
                        data-bwignore="true"
                        data-form-type="other"
                      />
                    </div>
                  </div>

                  {/* Horizontal Scrollable Tabs Strip */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {filteredProperties.map((p) => {
                      const isSelected = p.accountNumber === selectedProperty.accountNumber;
                      return (
                        <button
                          key={p.accountNumber}
                          type="button"
                          onClick={() => setActivePropertyAcc(p.accountNumber)}
                          className={`py-1.5 px-3 text-xs font-mono transition-colors shrink-0 cursor-pointer border-b-2 ${
                            isSelected
                              ? "text-[#007AFF] border-[#007AFF] font-semibold"
                              : "text-[#6C6C70] border-transparent hover:text-[#1C1C1E]"
                          }`}
                        >
                          <span>{p.accountNumber}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Section 1: Assessment Balances (Supabase Card) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#1C1C1E] block">
                    Assessment rate balances
                  </span>
                  <button
                    type="button"
                    onClick={fetchTestAccountBalances}
                    disabled={isFetchingBalances}
                    className="text-[11px] text-[#8E8E93] hover:text-[#1C1C1E] transition-colors cursor-pointer flex items-center gap-1.5"
                    title="Reload live balances from database"
                  >
                    <RefreshCw className={`w-3 h-3 ${isFetchingBalances ? "animate-spin text-[#007AFF]" : ""}`} />
                    <span>{isFetchingBalances ? "Syncing..." : "Sync from DB"}</span>
                  </button>
                </div>

                <div className="border border-[#E5E5EA] bg-white rounded-xl overflow-hidden shadow-2xs">
                  <div className="divide-y divide-[#E5E5EA]">
                    {/* Row 1: Cadastre Identifier */}
                    <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-0.5 max-w-sm">
                        <span className="text-xs font-semibold text-[#1C1C1E] block">
                          Cadastre Identifier
                        </span>
                        <p className="text-[11px] text-[#6C6C70] leading-relaxed">
                          GhanaPost GPS digital address and cadastral zoning.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-xs text-[#1C1C1E] bg-[#F9FAFB] px-3 py-2 rounded-lg border border-[#E5E5EA]">
                        <span>{selectedProperty.accountNumber} &bull; {selectedProperty.digitalAddress}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(selectedProperty.accountNumber, "acc")}
                          className="text-[#8E8E93] hover:text-[#1C1C1E] cursor-pointer ml-1"
                          title="Copy account number"
                        >
                          {copiedKey === "acc" ? <Check className="w-3.5 h-3.5 text-[#34C759]" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Row 2: Arrears Debt */}
                    <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-0.5 max-w-sm">
                        <span className="text-xs font-semibold text-[#1C1C1E] block">
                          Arrears Debt
                        </span>
                        <p className="text-[11px] text-[#6C6C70] leading-relaxed">
                          Prior unpaid rate arrears carried forward from previous fiscal periods.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-[#8E8E93] font-mono">GH₵</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={currentArrearsStr}
                          onChange={(e) => handleBalanceChange(selectedProperty.accountNumber, "arrears", e.target.value)}
                          className="w-full sm:w-64 h-9 px-3 rounded-lg border border-[#E5E5EA] text-xs font-mono text-[#1C1C1E] bg-[#F9FAFB] focus:bg-white focus:outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] transition-all"
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck={false}
                          data-lpignore="true"
                          data-1p-ignore="true"
                          data-bwignore="true"
                          data-form-type="other"
                        />
                      </div>
                    </div>

                    {/* Row 3: Current Municipal Rate */}
                    <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-0.5 max-w-sm">
                        <span className="text-xs font-semibold text-[#1C1C1E] block">
                          Current Municipal Rate
                        </span>
                        <p className="text-[11px] text-[#6C6C70] leading-relaxed">
                          Assessed annual property rate fee for the active 2026 fiscal year.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-[#8E8E93] font-mono">GH₵</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={currentBillStr}
                          onChange={(e) => handleBalanceChange(selectedProperty.accountNumber, "currentBill", e.target.value)}
                          className="w-full sm:w-64 h-9 px-3 rounded-lg border border-[#E5E5EA] text-xs font-mono text-[#1C1C1E] bg-[#F9FAFB] focus:bg-white focus:outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] transition-all"
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck={false}
                          data-lpignore="true"
                          data-1p-ignore="true"
                          data-bwignore="true"
                          data-form-type="other"
                        />
                      </div>
                    </div>

                    {/* Row 4: Total Outstanding Balance */}
                    <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#F9FAFB]/50">
                      <div className="space-y-0.5 max-w-sm">
                        <span className="text-xs font-semibold text-[#1C1C1E] block">
                          Total Assessment Balance
                        </span>
                        <p className="text-[11px] text-[#6C6C70] leading-relaxed">
                          Net balance payable by ratepayer at citizen checkout.
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-mono font-bold text-sm text-[#1C1C1E] tabular-nums">
                          GH₵ {currentTotalDue}
                        </span>
                        <span className={`text-[11px] font-semibold ${isPropPaid ? "text-[#34C759]" : "text-[#FF9500]"}`}>
                          &bull; {isPropPaid ? "Paid / Cleared" : "Balance Due"}
                        </span>
                      </div>
                    </div>

                    {/* Row 5: Citizen Verification Links */}
                    <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-0.5 max-w-sm">
                        <span className="text-xs font-semibold text-[#1C1C1E] block">
                          Direct Citizen Links
                        </span>
                        <p className="text-[11px] text-[#6C6C70] leading-relaxed">
                          Instant deep links to test digital bill inspection and MoMo payment gateway.
                        </p>
                      </div>
                      <div className="flex items-center gap-4 text-xs font-semibold shrink-0">
                        <a
                          href={`${citizenAppUrl}/bill?accountNumber=${selectedProperty.accountNumber}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#007AFF] hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>Inspect Bill</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        <a
                          href={`${citizenAppUrl}/checkout?propertyId=${selectedProperty.accountNumber}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#007AFF] hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>Pay in Checkout</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Supabase Card Footer */}
                  <div className="px-6 py-3.5 border-t border-[#E5E5EA] bg-[#F9FAFB] flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => handleZeroOut(selectedProperty.accountNumber)}
                      className="text-xs font-semibold text-[#6C6C70] hover:text-[#1C1C1E] transition-colors cursor-pointer"
                    >
                      Zero Out Balance
                    </button>
                    <button
                      type="button"
                      disabled={isSavingBalances}
                      onClick={() => handleSaveSingleProperty(selectedProperty.accountNumber)}
                      className="h-8 px-4 rounded-lg text-xs font-semibold bg-[#1C1C1E] text-white hover:bg-[#3A3A3C] active:scale-[0.98] transition-all disabled:opacity-40 cursor-pointer flex items-center gap-1.5 shadow-xs"
                    >
                      {isSavingBalances ? <AppleSpinner size="xs" className="text-white" /> : null}
                      <span>Save changes</span>
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* VIEW B: SMS GATEWAY & ENGINE */}
          {activeSettingsTab === "GATEWAY" && (
            <div className="space-y-8 animate-in fade-in-50 duration-200">
              <div>
                <h1 className="text-2xl font-bold text-[#1C1C1E] tracking-tight">
                  SMS Gateway Settings
                </h1>
                <p className="text-xs text-[#6C6C70] mt-1">
                  Configure telephony providers, API credentials, and live delivery routes.
                </p>
              </div>

              {/* Section 1: SMS Delivery Mode */}
              <div className="space-y-3">
                <span className="text-sm font-semibold text-[#1C1C1E] block">
                  SMS Delivery Mode
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Mode Option 1: Test / Simulation */}
                  <div
                    onClick={() => handleModeChange("TEST")}
                    className={`p-5 rounded-xl border transition-all cursor-pointer ${
                      dispatchMode === "TEST"
                        ? "border-[#007AFF] bg-[#007AFF]/5 shadow-2xs"
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
                          Test Mode (Free Simulation)
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
                    className={`p-5 rounded-xl border transition-all cursor-pointer ${
                      dispatchMode === "LIVE"
                        ? "border-[#34C759] bg-[#34C759]/5 shadow-2xs"
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
                          Live SMS Mode (Real Dispatch)
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

              {/* Section 2: Carrier Credentials (Supabase Card) */}
              <div className="space-y-3">
                <span className="text-sm font-semibold text-[#1C1C1E] block">
                  Carrier Credentials &amp; Engine
                </span>

                <form onSubmit={handleSaveSettings} className="border border-[#E5E5EA] bg-white rounded-xl overflow-hidden shadow-2xs">
                  <div className="divide-y divide-[#E5E5EA]">
                    {/* API Key */}
                    <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-0.5 max-w-sm">
                        <span className="text-xs font-semibold text-[#1C1C1E] block">
                          Carrier API Key
                        </span>
                        <p className="text-[11px] text-[#6C6C70] leading-relaxed">
                          Secret API key used to authenticate HTTP requests to the SMS gateway.
                        </p>
                      </div>
                      <div className="relative w-full sm:w-80">
                        <input
                          type={showApiKey ? "text" : "password"}
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          placeholder="Arkesel / Twilio API Key"
                          className="w-full h-9 pl-3 pr-9 border border-[#E5E5EA] rounded-lg text-xs font-mono bg-[#F9FAFB] text-[#1C1C1E] focus:bg-white focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] focus:outline-none transition-colors"
                          autoComplete="new-password"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck={false}
                          data-lpignore="true"
                          data-1p-ignore="true"
                          data-bwignore="true"
                          data-form-type="other"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8E8E93] hover:text-[#1C1C1E] p-0.5 transition-colors cursor-pointer"
                        >
                          {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Sender ID */}
                    <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-0.5 max-w-sm">
                        <span className="text-xs font-semibold text-[#1C1C1E] block">
                          Registered Sender ID
                        </span>
                        <p className="text-[11px] text-[#6C6C70] leading-relaxed">
                          Max 11 alphanumeric characters approved by Ghana National Communications Authority (NCA).
                        </p>
                      </div>
                      <div className="w-full sm:w-80">
                        <input
                          type="text"
                          maxLength={11}
                          value={senderId}
                          onChange={(e) => setSenderId(e.target.value.toUpperCase())}
                          placeholder="KKMA"
                          className="w-full h-9 px-3 border border-[#E5E5EA] rounded-lg text-xs font-mono font-semibold tracking-wider bg-[#F9FAFB] text-[#1C1C1E] focus:bg-white focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] focus:outline-none transition-colors"
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="characters"
                          spellCheck={false}
                          data-lpignore="true"
                          data-1p-ignore="true"
                          data-bwignore="true"
                          data-form-type="other"
                        />
                      </div>
                    </div>

                    {/* Telephony Engine */}
                    <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-0.5 max-w-sm">
                        <span className="text-xs font-semibold text-[#1C1C1E] block">
                          Active Telephony Engine
                        </span>
                        <p className="text-[11px] text-[#6C6C70] leading-relaxed">
                          Select domestic Ghana (+233) route or international carrier dispatch.
                        </p>
                      </div>
                      <div className="w-full sm:w-80">
                        <select
                          value={provider}
                          onChange={(e) => setProvider(e.target.value as any)}
                          className="w-full h-9 px-3 border border-[#E5E5EA] rounded-lg text-xs bg-[#F9FAFB] text-[#1C1C1E] focus:bg-white focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] focus:outline-none transition-colors cursor-pointer"
                        >
                          <option value="arkesel">Arkesel (Ghana Domestic Gateway)</option>
                          <option value="twilio">Twilio (International Gateway)</option>
                        </select>
                      </div>
                    </div>

                    {/* Diagnostics Result Banner if active */}
                    {testResult && (
                      <div className="p-4 bg-[#F8F9FA]">
                        <div
                          className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
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
                      </div>
                    )}
                  </div>

                  {/* Supabase Card Footer */}
                  <div className="px-6 py-3.5 border-t border-[#E5E5EA] bg-[#F9FAFB] flex items-center justify-between">
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={isTesting || !apiKey.trim()}
                      className="h-8 px-3 rounded-lg text-xs font-semibold text-[#1C1C1E] bg-white border border-[#E5E5EA] hover:bg-[#F2F2F7] transition-all disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
                    >
                      {isTesting ? (
                        <AppleSpinner size="xs" className="text-[#007AFF]" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5 text-[#6C6C70]" />
                      )}
                      <span>Test Connection</span>
                    </button>

                    <button
                      type="submit"
                      disabled={isSaving}
                      className="h-8 px-4 rounded-lg text-xs font-semibold bg-[#1C1C1E] text-white hover:bg-[#3A3A3C] active:scale-[0.98] transition-all disabled:opacity-40 cursor-pointer flex items-center gap-1.5 shadow-xs"
                    >
                      {isSaving ? <AppleSpinner size="xs" className="text-white" /> : <Save className="w-3.5 h-3.5 text-white" />}
                      <span>Save changes</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* VIEW C: REGULATORY PROTOCOLS */}
          {activeSettingsTab === "PROTOCOLS" && (
            <div className="space-y-8 animate-in fade-in-50 duration-200">
              <div>
                <h1 className="text-2xl font-bold text-[#1C1C1E] tracking-tight">
                  Compliance &amp; Protocols
                </h1>
                <p className="text-xs text-[#6C6C70] mt-1">
                  Legal telephony dispatch specifications under the Local Governance Act, 2016 (Act 936).
                </p>
              </div>

              <div className="space-y-3">
                <span className="text-sm font-semibold text-[#1C1C1E] block">
                  Telephony Compliance Standards
                </span>

                <div className="border border-[#E5E5EA] bg-white rounded-xl overflow-hidden shadow-2xs divide-y divide-[#E5E5EA]">
                  <div className="p-5 space-y-1">
                    <span className="text-xs font-semibold text-[#1C1C1E] block">
                      Dual Direct Links Standard
                    </span>
                    <p className="text-xs text-[#6C6C70] leading-relaxed">
                      Every demand notice and bill dispatch SMS notice embeds two direct links: Link 1 to inspect the digital assessment bill (<code className="text-[10px] text-[#007AFF]">/dashboard?accountNumber=...</code>) and Link 2 for direct in-app mobile checkout (<code className="text-[10px] text-[#007AFF]">/checkout?propertyId=...</code>).
                    </p>
                  </div>

                  <div className="p-5 space-y-1">
                    <span className="text-xs font-semibold text-[#1C1C1E] block">
                      E.164 Number Normalization
                    </span>
                    <p className="text-xs text-[#6C6C70] leading-relaxed">
                      Domestic phone numbers entered in local format (024, 050, 020) are automatically formatted to the international Ghana standard (+233) prior to carrier gateway handoff to prevent delivery failure.
                    </p>
                  </div>

                  <div className="p-5 space-y-1">
                    <span className="text-xs font-semibold text-[#1C1C1E] block">
                      Immutable Auditing &amp; Provider SIDs
                    </span>
                    <p className="text-xs text-[#6C6C70] leading-relaxed">
                      All outbound SMS transactions write to the municipal <code className="text-[10px]">AuditLog</code> and <code className="text-[10px]">Notification</code> tables with gateway message SIDs, status codes, and recipient timestamps for statutory compliance.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Safety Confirmation Modal for Switching to LIVE Mode */}
      {showLiveConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/35 backdrop-blur-xs p-0 sm:p-4 font-sans">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-[#E5E5EA] max-w-md w-full p-6 space-y-4 animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FF9500]/10 border border-[#FF9500]/20 flex items-center justify-center shrink-0 text-[#FF9500]">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-[#1C1C1E]">
                  Activate LIVE SMS Dispatch?
                </h3>
                <p className="text-xs text-[#6C6C70] mt-1 leading-relaxed">
                  You are switching from simulation mode to <strong>LIVE GATEWAY</strong>. Outbound billing messages will be transmitted across Ghanaian telecom networks and bill actual account credits.
                </p>
              </div>
            </div>

            <div className="p-3 bg-[#FF9500]/5 border border-[#FF9500]/20 rounded-xl text-[11px] text-[#B06000] leading-relaxed">
              Ensure you have verified message templates and sender identity under NCA guidelines before proceeding.
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowLiveConfirmModal(false)}
                className="h-8 px-4 text-xs font-semibold text-[#6C6C70] hover:text-[#1C1C1E] hover:bg-[#F2F2F7] rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmLiveMode}
                className="h-8 px-4 text-xs font-semibold bg-[#34C759] hover:bg-[#2EB84E] text-white rounded-lg transition-colors cursor-pointer shadow-xs"
              >
                Activate Live Mode
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
