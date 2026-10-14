"use client";

import React, { useState, useEffect } from "react";
import {
  Building2,
  Users,
  CreditCard,
  Receipt,
  MessageSquare,
  ShieldCheck,
  Settings,
  MoreHorizontal,
  X,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export type DockTab =
  | "REGISTRY"
  | "RATEPAYERS"
  | "PAID_USERS"
  | "FEE_PAYMENTS"
  | "SMS_CENTER"
  | "AUDIT_LOGS"
  | "SETTINGS";

interface FloatingMobileDockProps {
  activeTab: DockTab;
  onSelectTab: (tab: DockTab) => void;
  hasActiveAlert?: boolean;
  allowedTabs?: DockTab[];
}

interface TabItem {
  key: DockTab;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
}

const ALL_TABS: TabItem[] = [
  { key: "RATEPAYERS", label: "Property Owners", shortLabel: "Owners", icon: Users },
  { key: "REGISTRY", label: "Properties Cadastre", shortLabel: "Properties", icon: Building2 },
  { key: "PAID_USERS", label: "Paid Ratepayers", shortLabel: "Paid", icon: CreditCard },
  { key: "FEE_PAYMENTS", label: "Fee Payments", shortLabel: "Payments", icon: Receipt },
  { key: "SMS_CENTER", label: "Send SMS Bills", shortLabel: "SMS Bills", icon: MessageSquare },
  { key: "AUDIT_LOGS", label: "Activity Log", shortLabel: "Activity", icon: ShieldCheck },
  { key: "SETTINGS", label: "System Settings", shortLabel: "Settings", icon: Settings },
];

export function FloatingMobileDock({
  activeTab,
  onSelectTab,
  hasActiveAlert = false,
  allowedTabs,
}: FloatingMobileDockProps) {
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const availableTabs = allowedTabs
    ? ALL_TABS.filter((t) => allowedTabs.includes(t.key))
    : ALL_TABS;

  // If <= 4 tabs (e.g. Officer mode with 3 tabs), show all directly on the bar
  const isDirectMode = availableTabs.length <= 4;
  const primaryTabs = isDirectMode ? availableTabs : availableTabs.slice(0, 4);
  const secondaryTabs = isDirectMode ? [] : availableTabs.slice(4);

  const isSecondaryActive = secondaryTabs.some((t) => t.key === activeTab);
  const hasSecondaryAlert = Boolean(
    hasActiveAlert && secondaryTabs.some((t) => t.key === "SMS_CENTER" || t.key === "AUDIT_LOGS")
  );

  // Lock background viewport scrolling when more sheet is active
  useEffect(() => {
    if (isMoreOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isMoreOpen]);

  return (
    <div className="lg:hidden">
      {/* iOS Native Fixed Bottom Navigation Bar */}
      <nav
        className="fixed bottom-0 inset-x-0 z-30 bg-white/92 backdrop-blur-2xl border-t border-[#E5E5EA] shadow-[0_-2px_12px_rgba(0,0,0,0.04)] pb-[env(safe-area-inset-bottom,0px)]"
        role="navigation"
        aria-label="Mobile Bottom Navigation"
      >
        <div className="h-14 flex items-center justify-around px-1 max-w-lg mx-auto">
          {primaryTabs.map((item) => {
            const isActive = activeTab === item.key;
            const Icon = item.icon;
            const isActivity = item.key === "AUDIT_LOGS";

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  onSelectTab(item.key);
                  setIsMoreOpen(false);
                }}
                className="flex-1 flex flex-col items-center justify-center py-1 relative cursor-pointer active:scale-92 transition-all min-h-[44px]"
                aria-current={isActive ? "page" : undefined}
                aria-label={item.label}
              >
                <motion.div
                  className="relative flex items-center justify-center"
                  animate={isActive ? { scale: [1, 0.86, 1.12, 1] } : { scale: 1 }}
                  transition={{ duration: 0.28, ease: "easeOut" }}
                >
                  <Icon
                    className={`w-5 h-5 transition-colors ${
                      isActive
                        ? "text-[#007AFF] stroke-[2.3]"
                        : "text-[#8E8E93] stroke-[1.8]"
                    }`}
                  />
                  {isActivity && hasActiveAlert && (
                    <span
                      className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-[#FF3B30] ring-2 ring-white animate-pulse"
                      aria-label="Pending alert"
                    />
                  )}
                </motion.div>
                <span
                  className={`text-[10px] tracking-tight mt-1 transition-colors ${
                    isActive
                      ? "text-[#007AFF] font-semibold"
                      : "text-[#8E8E93] font-medium"
                  }`}
                >
                  {item.shortLabel}
                </span>
                {isActive && (
                  <span className="w-1 h-1 rounded-full bg-[#007AFF] mt-0.5" />
                )}
              </button>
            );
          })}

          {/* More Tab (for secondary items like SMS, Activity, Settings) */}
          {secondaryTabs.length > 0 && (
            <button
              type="button"
              onClick={() => setIsMoreOpen((prev) => !prev)}
              className="flex-1 flex flex-col items-center justify-center py-1 relative cursor-pointer active:scale-92 transition-all min-h-[44px]"
              aria-expanded={isMoreOpen}
              aria-label="More navigation options"
            >
              <motion.div
                className="relative flex items-center justify-center"
                animate={isSecondaryActive || isMoreOpen ? { scale: [1, 0.86, 1.12, 1] } : { scale: 1 }}
                transition={{ duration: 0.28, ease: "easeOut" }}
              >
                <MoreHorizontal
                  className={`w-5 h-5 transition-colors ${
                    isSecondaryActive || isMoreOpen
                      ? "text-[#007AFF] stroke-[2.3]"
                      : "text-[#8E8E93] stroke-[1.8]"
                  }`}
                />
                {hasSecondaryAlert && (
                  <span
                    className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-[#FF3B30] ring-2 ring-white animate-pulse"
                    aria-label="Pending alert"
                  />
                )}
              </motion.div>
              <span
                className={`text-[10px] tracking-tight mt-1 transition-colors ${
                  isSecondaryActive || isMoreOpen
                    ? "text-[#007AFF] font-semibold"
                    : "text-[#8E8E93] font-medium"
                }`}
              >
                More
              </span>
              {isSecondaryActive && (
                <span className="w-1 h-1 rounded-full bg-[#007AFF] mt-0.5" />
              )}
            </button>
          )}
        </div>
      </nav>

      {/* iOS More Actions Sheet */}
      <AnimatePresence>
        {isMoreOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="fixed inset-0 bg-black/35 backdrop-blur-xs z-[10000] lg:hidden pointer-events-auto"
              onClick={() => setIsMoreOpen(false)}
              aria-hidden="true"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="fixed bottom-0 inset-x-0 bg-white rounded-t-2xl z-[10000] lg:hidden border-t border-[#E5E5EA] shadow-2xl p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] max-w-lg mx-auto will-change-transform pointer-events-auto"
              role="dialog"
              aria-modal="true"
              aria-label="More Navigation Options"
            >
              {/* Drag Handle */}
              <div className="w-10 h-1 bg-[#D1D1D6] rounded-full mx-auto mb-3" />

              <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-[#E5E5EA]">
                <span className="text-xs font-bold text-[#1C1C1E]">More Options</span>
                <button
                  type="button"
                  onClick={() => setIsMoreOpen(false)}
                  className="w-7 h-7 rounded-full bg-[#F2F2F7] flex items-center justify-center text-[#8E8E93] hover:text-[#1C1C1E] cursor-pointer"
                  aria-label="Close sheet"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-1">
                {secondaryTabs.map((item) => {
                  const isActive = activeTab === item.key;
                  const Icon = item.icon;
                  const isActivity = item.key === "AUDIT_LOGS";

                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        onSelectTab(item.key);
                        setIsMoreOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors cursor-pointer text-left ${
                        isActive
                          ? "bg-[#007AFF]/10 text-[#007AFF]"
                          : "hover:bg-[#F2F2F7] text-[#1C1C1E]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            isActive
                              ? "bg-[#007AFF] text-white"
                              : "bg-[#F2F2F7] text-[#007AFF]"
                          }`}
                        >
                          <Icon className="w-4 h-4 stroke-[2.2]" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold">{item.label}</span>
                          <span className="text-[10px] text-[#8E8E93]">
                            {item.key === "SMS_CENTER"
                              ? "Transactional bill rollout notices"
                              : item.key === "AUDIT_LOGS"
                              ? "Governance & transaction audit log"
                              : "Municipal configurations"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isActivity && hasActiveAlert && (
                          <span className="w-2 h-2 rounded-full bg-[#FF3B30] animate-pulse" />
                        )}
                        <ChevronRight className="w-4 h-4 text-[#C7C7CC]" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
