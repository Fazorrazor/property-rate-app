"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  X,
  FileText,
  MapPin,
  CreditCard,
  ReceiptText,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  Building2,
} from "lucide-react";
import { DashboardSkeleton } from "@/components/ui/Skeletons";
import { motion, AnimatePresence } from "framer-motion";
import {
  getDashboardData,
  getUserNotifications,
  markNotificationAsRead,
  DashboardData,
  AppNotification,
} from "@/app/actions";


export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Notification states
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [topRolloutBanner, setTopRolloutBanner] = useState<AppNotification | null>(null);

  const loadData = async () => {
    try {
      const [dashRes, notifRes] = await Promise.all([
        getDashboardData(),
        getUserNotifications(),
      ]);

      if (dashRes) {
        setData(dashRes);
      }

      const isSettled = dashRes?.metrics ? dashRes.metrics.totalOutstanding <= 0 : false;

      if (notifRes) {
        setNotifications(notifRes.notifications);
        setUnreadCount(notifRes.unreadCount);

        // Only pop up if the taxpayer has outstanding rates (not settled)
        if (!isSettled) {
          const unreadRollout = notifRes.notifications.find(
            (n) => !n.isRead && n.type === "BILLING_ROLLOUT"
          );

          if (unreadRollout) {
            const seenKey = `popup_seen_${unreadRollout.id}`;
            const alreadySeen =
              typeof window !== "undefined" && localStorage.getItem(seenKey);

            if (!alreadySeen) {
              setTopRolloutBanner(unreadRollout);
              if (typeof window !== "undefined") {
                localStorage.setItem(seenKey, "true");
              }
            }
          }
        } else {
          setTopRolloutBanner(null);
        }
      }
    } catch (err) {
      console.error("Error loading dashboard:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Auto-dismiss top rollout notification after 5 seconds
  useEffect(() => {
    if (topRolloutBanner) {
      const timer = setTimeout(() => {
        setTopRolloutBanner(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [topRolloutBanner]);

  const properties = [...(data?.properties || [])].sort((a, b) => {
    const aPaid = a.status === "PAID";
    const bPaid = b.status === "PAID";
    if (aPaid && !bPaid) return 1;
    if (!aPaid && bPaid) return -1;
    return b.totalAmountDue - a.totalAmountDue;
  });



  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const metrics = data?.metrics || {
    totalValuationFormatted: "GH₵ 0",
    totalOutstanding: 0,
    totalOutstandingFormatted: "GH₵ 0.00",
    totalProperties: 0,
    paidCount: 0,
    unpaidCount: 0,
    complianceStatus: "Compliant" as const,
  };

  const isAllPaid = metrics.totalOutstanding <= 0;

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col pb-24 px-4 sm:px-5 max-w-md mx-auto w-full font-sans gap-3.5">
      {/* 1. TOP ROLLOUT IN-APP POPUP NOTIFICATION (Appears once, swipe to dismiss, auto-5s) */}
      <AnimatePresence>
        {topRolloutBanner && (
          <motion.div
            initial={{ y: -100, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -100, opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", damping: 24, stiffness: 300 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.8, bottom: 0.1 }}
            onDragEnd={(_, info) => {
              if (info.offset.y < -15 || info.velocity.y < -80) {
                if (topRolloutBanner && typeof window !== "undefined") {
                  localStorage.setItem(`popup_seen_${topRolloutBanner.id}`, "true");
                }
                setTopRolloutBanner(null);
              }
            }}
            onClick={() => {
              if (topRolloutBanner) {
                markNotificationAsRead(topRolloutBanner.id);
                if (typeof window !== "undefined") {
                  localStorage.setItem(`popup_seen_${topRolloutBanner.id}`, "true");
                }
                setTopRolloutBanner(null);
              }
              router.push("/properties");
            }}
            className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-md bg-[#17433F] text-white p-3.5 rounded-2xl shadow-2xl border border-white/10 flex items-start gap-3 cursor-grab active:cursor-grabbing"
            role="alert"
          >
            <div className="w-8 h-8 rounded-xl bg-[#4B1426] text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
              <FileText className="w-4 h-4" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#8AB4F8]">
                  Municipal Rollout
                </span>
                <span className="text-[10px] text-[#9AA0A6]">Swipe up to dismiss</span>
              </div>
              <h4 className="text-xs font-semibold text-[#F3F4F4] mt-0.5 truncate">
                {topRolloutBanner.title}
              </h4>
              <p className="text-[11px] text-[#DADCE0] mt-0.5 line-clamp-2 leading-relaxed">
                {topRolloutBanner.message}
              </p>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (topRolloutBanner && typeof window !== "undefined") {
                  localStorage.setItem(`popup_seen_${topRolloutBanner.id}`, "true");
                }
                setTopRolloutBanner(null);
              }}
              className="text-[#9AA0A6] hover:text-white p-1 rounded cursor-pointer shrink-0"
              aria-label="Dismiss banner"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sleek Header / Balance Card */}
      <div className="-mx-4 sm:-mx-5 -mt-4 sm:-mt-5 px-5 sm:px-6 pt-8 pb-8 bg-surface text-foreground shadow-sm rounded-b-[36px] relative overflow-hidden shrink-0 z-20 border-b border-border-light transition-colors duration-300">
        
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 bg-primary opacity-5 rounded-full blur-[80px] pointer-events-none" />

        <header className="flex items-center justify-between mb-10 relative z-10">
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
                  : "Municipal Portal"}
              </h1>
              <p className="text-[11px] text-on-surface-muted leading-tight mt-0.5">
                {properties.length > 0 ? "Kpone-Katamanso Assembly" : "No Assembly District Assigned"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowNotifModal(true)}
              className="relative p-2 text-on-surface-muted hover:text-foreground hover:bg-surface-subtle rounded-full transition-colors cursor-pointer"
              aria-label="View notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#FF453A] border border-surface" />
              )}
            </button>
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
                  ? "text-[#A2AB73]"
                  : "text-[#FF453A]"
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
              {properties.length === 0 ? (
                <button
                  type="button"
                  onClick={() => router.push("/settings")}
                  className="flex items-center justify-center gap-1.5 bg-primary text-on-primary hover:bg-primary-hover active:scale-95 transition-all px-4 py-2.5 rounded-xl cursor-pointer shadow-md"
                >
                  <span className="text-[13px] font-bold tracking-wide uppercase">Link Property</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : !isAllPaid ? (
                <button
                  type="button"
                  onClick={() => router.push("/checkout?propertyId=ALL")}
                  className="flex items-center justify-center gap-1.5 bg-primary text-on-primary hover:bg-primary-hover active:scale-95 transition-all px-4 py-2.5 rounded-xl cursor-pointer shadow-md"
                >
                  <span className="text-[13px] font-bold tracking-wide uppercase">Pay Total</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => router.push("/receipts")}
                  className="flex items-center justify-center gap-1.5 bg-surface-subtle text-foreground hover:bg-border-light active:scale-95 transition-all px-4 py-2.5 rounded-xl cursor-pointer"
                >
                  <span className="text-[13px] font-bold tracking-wide uppercase">Receipts</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-4 flex-1 flex flex-col min-h-0 pt-2"
      >

        {/* Registered Property List */}
        <section className="flex flex-col space-y-3 flex-1" aria-label="Properties">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-semibold text-on-surface-muted uppercase tracking-wider">
              Assessed Properties ({properties.length})
            </h2>
            <button
              type="button"
              onClick={() => router.push("/properties")}
              className="text-xs font-medium text-foreground hover:underline cursor-pointer flex items-center gap-0.5"
            >
              <span>View all</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="flex flex-col gap-4 mt-2 flex-1">
            {properties.length === 0 ? (
              <div className="p-6 rounded-2xl bg-surface border border-border-light shadow-sm text-center flex flex-col items-center justify-center space-y-3 py-10">
                <div className="w-12 h-12 rounded-xl bg-surface-subtle flex items-center justify-center text-[#4B1426] border border-border-subtle">
                  <Building2 className="w-6 h-6" />
                </div>
                <div className="space-y-1 max-w-xs">
                  <h3 className="text-sm font-bold text-foreground">No Properties Linked</h3>
                  <p className="text-xs text-on-surface-muted leading-relaxed">
                    Link your Municipal Property Account Number to view your annual rate assessment, demand notice, and make payments.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => router.push("/settings")}
                  className="btn-3d-primary px-5 h-10 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-sm mt-2"
                >
                  <span>Link Property Account</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
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
                        ? "text-[#137333]"
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

                {/* Financial Breakdown (Dynamic Height) */}
                <div className="space-y-3 pt-1">
                  {/* Detailed Valuation (Only visible on tall screens) */}
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

                  {/* Core Balances (Always visible) */}
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
                      onClick={() => router.push(`/properties?accountNumber=${properties[0].accountNumber}&action=pay`)}
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
                          ? "text-[#137333]"
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
                        onClick={() => router.push(`/properties?accountNumber=${prop.accountNumber}&action=pay`)}
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

            {properties.length === 0 && (
              <div className="p-6 text-center bg-surface rounded-xl border border-border-light shadow-sm">
                <p className="text-xs text-on-surface-muted">
                  No registered properties found for this telephone number.
                </p>
              </div>
            )}
          </div>
        </section>
      </motion.div>

      {/* 2. SMALL NOTIFICATION MODAL / DROPDOWN */}
      <AnimatePresence>
        {showNotifModal && (
          <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40"
              onClick={() => setShowNotifModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -15, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -15, scale: 0.96 }}
              transition={{ type: "spring", damping: 25, stiffness: 320 }}
              className="relative z-10 w-full max-w-sm bg-surface rounded-2xl border border-border-light shadow-2xl p-4 space-y-3 font-sans"
            >
              <div className="flex items-center justify-between pb-2 border-b border-border-light">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-foreground" />
                  <h3 className="text-xs font-semibold text-foreground">Recent Notices</h3>
                  {unreadCount > 0 && (
                    <span className="text-xs text-on-surface-muted font-normal">
                      ({unreadCount} unread)
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowNotifModal(false)}
                  className="text-on-surface-muted hover:text-foreground p-1 rounded-lg transition-colors cursor-pointer"
                  aria-label="Close notification modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Quick list of recent notifications */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="text-xs text-on-surface-muted text-center py-4">No recent notifications</p>
                ) : (
                  notifications.slice(0, 3).map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        markNotificationAsRead(item.id);
                        setShowNotifModal(false);
                        router.push("/notifications");
                      }}
                      className={`p-3 rounded-xl transition-colors cursor-pointer space-y-1 text-xs border ${
                        item.isRead
                          ? "bg-surface border-border-light hover:bg-background"
                          : "bg-surface border-[#4B1426]/40 shadow-md hover:bg-[#FDFBFD]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-foreground truncate">{item.title}</span>
                        <span className="text-[10px] text-on-surface-muted shrink-0">{item.timeAgo}</span>
                      </div>
                      <p className="text-[11px] text-on-surface-muted line-clamp-2 leading-relaxed">
                        {item.message}
                      </p>
                    </div>
                  ))
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowNotifModal(false);
                  router.push("/notifications");
                }}
                className="btn-3d-primary w-full h-10 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span>View Full Notifications</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
