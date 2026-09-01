"use client";

import { useState, useEffect, useRef, useMemo, useCallback, Suspense } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { PropertiesSkeleton } from "@/components/ui/Skeletons";
import {
  Search,
  X,
  TrendingUp,
  AlertTriangle,
  ReceiptText,
  CreditCard,
  CheckCircle2,
  MapPin,
  Building2,
  Calendar,
  FileText,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  Bell,
  Coins,
  History,
} from "lucide-react";
import {
  getDashboardData,
  getUserNotifications,
  markNotificationAsRead,
  DashboardProperty,
  AppNotification,
} from "@/app/actions";
import { useRouter, useSearchParams } from "next/navigation";

function AnimatedValue({ value, className }: { value: string | number; className?: string }) {
  return (
    <div className={`relative overflow-hidden inline-flex items-center ${className || ""}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={String(value)}
          initial={{ opacity: 0, y: 12, filter: "blur(2px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -12, filter: "blur(2px)" }}
          transition={{ type: "spring", stiffness: 450, damping: 25, mass: 0.5 }}
          className="inline-block origin-left"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

function PropertiesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deepLinkAccount = searchParams.get("accountNumber");
  const deepLinkAction = searchParams.get("action");
  const hasAutoOpened = useRef(false);

  const [properties, setProperties] = useState<DashboardProperty[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();

  const carouselRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    async function load() {
      try {
        const [dashRes, notifRes] = await Promise.all([
          getDashboardData(),
          getUserNotifications(),
        ]);

        if (dashRes && dashRes.properties.length > 0) {
          setProperties(dashRes.properties);
          if (deepLinkAccount) {
            const match = dashRes.properties.find((p) => p.accountNumber === deepLinkAccount);
            const targetId = match ? match.id : dashRes.properties[0].id;
            setSelectedId(targetId);
          } else {
            setSelectedId(dashRes.properties[0].id);
          }
        }

        if (notifRes) {
          setNotifications(notifRes.notifications);
          setUnreadCount(notifRes.unreadCount);
        }
      } catch (err) {
        console.error("Error loading properties:", err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [deepLinkAccount]);

  const filteredProperties = properties
    .filter((property) => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        property.accountNumber.toLowerCase().includes(query) ||
        property.ownerDigitalAddress.toLowerCase().includes(query) ||
        property.propertyClassification.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      const aPaid = a.status === "PAID";
      const bPaid = b.status === "PAID";
      if (aPaid && !bPaid) return 1;
      if (!aPaid && bPaid) return -1;
      return b.totalAmountDue - a.totalAmountDue;
    });

  // Ensure selected property remains valid when filtered
  useEffect(() => {
    if (filteredProperties.length > 0) {
      if (!selectedId || !filteredProperties.some((p) => p.id === selectedId)) {
        setSelectedId(filteredProperties[0].id);
      }
    }
  }, [filteredProperties, selectedId]);

  // Handle auto-opening the payment checkout for deep links
  useEffect(() => {
    if (selectedId && deepLinkAction === "pay" && !hasAutoOpened.current) {
      const prop = properties.find((p) => p.id === selectedId);
      if (prop && prop.status !== "PAID") {
        hasAutoOpened.current = true;
        router.push(`/checkout?propertyId=${prop.id}`);
      }
    }
  }, [selectedId, deepLinkAction, properties, router]);



  // Lock selected card into center of viewport
  const scrollToCard = (id: string, smooth = true) => {
    const el = cardRefs.current[id];
    if (el) {
      el.scrollIntoView({
        behavior: smooth ? "smooth" : "auto",
        inline: "center",
        block: "nearest",
      });
    }
  };

  const handleSelectCard = (id: string) => {
    setSelectedId(id);
    scrollToCard(id, true);
  };

  // Arrow navigation: prev / next property
  const currentIndex = filteredProperties.findIndex((p) => p.id === selectedId);
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < filteredProperties.length - 1;

  const goToPrev = () => {
    if (canGoPrev) handleSelectCard(filteredProperties[currentIndex - 1].id);
  };
  const goToNext = () => {
    if (canGoNext) handleSelectCard(filteredProperties[currentIndex + 1].id);
  };

  // Scroll listener to update selected card when swiped
  const handleScroll = () => {
    if (!carouselRef.current) return;
    const container = carouselRef.current;
    const containerCenter = container.getBoundingClientRect().left + container.offsetWidth / 2;

    let closestId = selectedId;
    let minDistance = Infinity;

    for (const prop of filteredProperties) {
      const el = cardRefs.current[prop.id];
      if (el) {
        const rect = el.getBoundingClientRect();
        const cardCenter = rect.left + rect.width / 2;
        const distance = Math.abs(containerCenter - cardCenter);
        if (distance < minDistance) {
          minDistance = distance;
          closestId = prop.id;
        }
      }
    }

    if (closestId && closestId !== selectedId && minDistance < 60) {
      setSelectedId(closestId);
    }
  };

  // Initial center lock when loaded
  useEffect(() => {
    if (selectedId && !isLoading) {
      const timer = setTimeout(() => {
        scrollToCard(selectedId, false);
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [selectedId, isLoading]);

  const selectedProperty = properties.find((p) => p.id === selectedId) || filteredProperties[0] || null;

  if (isLoading) {
    return <PropertiesSkeleton />;
  }

  return (
    <main className="relative flex-1 min-h-screen bg-background p-4 sm:p-5 max-w-md mx-auto w-full pb-36 font-sans space-y-4 pt-2 text-foreground">
      {/* Sticky Static Header & Search Section (Isolated from scrollable property content) */}
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-md -mx-4 px-4 sm:-mx-5 sm:px-5 pt-2 pb-3 space-y-3 border-b border-border-light/60 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold tracking-tight text-foreground select-none">
              Heinz
            </span>
            <div className="border-l border-border-light pl-3">
              <h1 className="text-sm font-semibold text-foreground leading-tight">
                Properties
              </h1>
              <p className="text-xs text-on-surface-muted leading-tight mt-0.5">
                {properties.length > 0
                  ? `${properties.length} Assessed Account${properties.length === 1 ? "" : "s"} • FY 2025`
                  : "0 properties linked"}
              </p>
            </div>
          </div>

          {/* Clean Notification Icon (No Bubble) */}
          <button
            type="button"
            onClick={() => setShowNotifModal(true)}
            className="relative p-1.5 text-on-surface-muted hover:text-foreground transition-colors cursor-pointer"
            aria-label="View notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#C5221F]" />
            )}
          </button>
        </div>

        {/* Search Bar (Only shown if properties exist) */}
        {properties.length > 0 && (
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-on-surface-muted absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Search Account No. or GPS Address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-9 rounded-xl bg-surface border border-border-light text-xs font-normal text-foreground placeholder:text-on-surface-subtle focus:outline-none focus:border-[#4B1426] transition-colors shadow-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 p-1 text-on-surface-muted hover:text-foreground cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </header>

      {/* 0 PROPERTIES LINKED EMPTY STATE */}
      {properties.length === 0 ? (
        <div className="p-8 rounded-2xl bg-surface border border-border-light shadow-sm text-center flex flex-col items-center justify-center space-y-4 my-auto py-12">
          <div className="w-14 h-14 rounded-2xl bg-surface-subtle flex items-center justify-center text-[#4B1426] border border-border-subtle">
            <Building2 className="w-7 h-7" />
          </div>
          <div className="space-y-1.5 max-w-xs">
            <h2 className="text-base font-bold text-foreground">No Properties Linked</h2>
            <p className="text-xs text-on-surface-muted leading-relaxed">
              You do not have any property accounts linked to this phone number yet. Link an account to view and pay your rate assessments.
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/settings")}
            className="btn-3d-primary px-6 h-11 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-md mt-2"
          >
            <span>Link Property Account</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <>
          {/* 1. CENTERED HORIZONTAL CAROUSEL WITH ARROW NAVIGATION */}
          <section className="space-y-2" aria-label="Properties Carousel">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-xs font-semibold text-foreground">Assessed Properties</span>
              <span className="text-[11px] text-on-surface-muted">
                {filteredProperties.length > 1
                  ? `${currentIndex + 1} of ${filteredProperties.length}`
                  : "1 property"}
              </span>
            </div>

            {filteredProperties.length === 0 ? (
              <div className="p-6 rounded-2xl bg-surface border border-border-light shadow-sm text-center space-y-1.5">
                <p className="text-xs font-medium text-foreground">No records match &ldquo;{searchQuery}&rdquo;</p>
                <p className="text-[11px] text-on-surface-muted">Search by Account No. or GPS Digital Address.</p>
              </div>
            ) : (
              <div className="relative block">
            {/* Left Arrow */}
            <button
              type="button"
              onClick={goToPrev}
              disabled={!canGoPrev}
              className={`absolute top-1/2 -translate-y-1/2 -left-1 z-10 w-7 h-7 rounded-full bg-surface border border-border-light shadow-md flex items-center justify-center transition-all cursor-pointer ${
                canGoPrev
                  ? "text-foreground hover:bg-background hover:border-[#4B1426] active:scale-90"
                  : "text-[#DADCE0] opacity-0 pointer-events-none"
              }`}
              aria-label="Previous property"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Carousel */}
            <div
              ref={carouselRef}
              onScroll={handleScroll}
              className={`flex overflow-x-auto gap-3 snap-x snap-mandatory scroll-smooth scrollbar-none pb-2 pt-1 -mx-4 sm:-mx-5 ${
                filteredProperties.length === 1 ? "px-4 sm:px-5" : "px-[6%] sm:px-[6%]"
              }`}
            >
              {filteredProperties.map((property) => {
                const isSelected = selectedProperty?.id === property.id;
                const isPaid = property.status === "PAID";

                return (
                  <article
                    key={property.id}
                    ref={(el) => {
                      cardRefs.current[property.id] = el;
                    }}
                    onClick={() => handleSelectCard(property.id)}
                    className={`bg-surface shrink-0 snap-center rounded-2xl p-4 cursor-pointer space-y-2.5 transition-all duration-300 border ${
                      filteredProperties.length === 1 ? "w-full" : "w-[92%]"
                    } ${
                      isSelected
                        ? "opacity-100 scale-100 border-[#4B1426] ring-1.5 ring-[#4B1426] shadow-lg z-10"
                        : "opacity-45 scale-[0.96] border-border-light hover:opacity-75 shadow-sm bg-surface"
                    }`}
                  >
                    {/* Top GPS and Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs text-on-surface-muted font-mono min-w-0">
                        <MapPin className="w-3.5 h-3.5 text-on-surface-muted shrink-0" />
                        <span className="truncate">{property.ownerDigitalAddress}</span>
                      </div>

                      <span
                        className={`text-xs font-medium shrink-0 ${
                          isPaid
                            ? "text-[#137333]"
                            : property.status === "PARTIALLY_PAID"
                            ? "text-[#B06000]"
                            : "text-[#C5221F]"
                        }`}
                      >
                        {isPaid ? "Settled" : property.status === "PARTIALLY_PAID" ? "Partial" : "Due"}
                      </span>
                    </div>

                    {/* Account Number & Class */}
                    <div>
                      <h3 className="text-xs font-semibold text-foreground truncate">
                        {property.accountNumber}
                      </h3>
                      <p className="text-[11px] text-on-surface-muted truncate mt-0.5">
                        {property.propertyClassification}
                      </p>
                    </div>

                    {/* Financial Mini Row */}
                    <div className="pt-2 border-t border-border-light flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] text-on-surface-muted block">Total Due</span>
                        <span className="font-semibold text-foreground">
                          {isPaid ? "GH₵ 0.00" : property.totalAmountDueFormatted}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-on-surface-muted block">Carried Arrears</span>
                        <span className="font-medium text-foreground">
                          {property.arrearsFormatted}
                        </span>
                      </div>
                    </div>

                    {/* Pay Button */}
                    {!isPaid && (
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/checkout?propertyId=${property.id}`);
                          }}
                          className="btn-3d-primary w-full h-10 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <CreditCard className="w-4 h-4 shrink-0" />
                          <span>Pay Now</span>
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>

            {/* Right Arrow */}
            <button
              type="button"
              onClick={goToNext}
              disabled={!canGoNext}
              className={`absolute top-1/2 -translate-y-1/2 -right-1 z-10 w-7 h-7 rounded-full bg-surface border border-border-light shadow-md flex items-center justify-center transition-all cursor-pointer ${
                canGoNext
                  ? "text-foreground hover:bg-background hover:border-[#4B1426] active:scale-90"
                  : "text-[#DADCE0] opacity-0 pointer-events-none"
              }`}
              aria-label="Next property"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </section>

      {/* 2. SELECTED PROPERTY DETAILS POPULATING THE PAGE BELOW */}
      {selectedProperty && (
        <section
          className="space-y-3.5 pt-1"
          aria-label="Selected Property Particulars"
        >
            {/* Digital Demand Notice & Financial Ledger (Unified) */}
            <article className="relative p-4 rounded-2xl bg-surface border border-border-light shadow-md space-y-3 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between pb-2 border-b border-border-light">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-foreground" />
                  <div>
                    <h2 className="text-xs font-semibold text-foreground">
                      Digital Demand Notice &bull; FY {selectedProperty.billYear}
                    </h2>
                    <p className="text-[11px] text-on-surface-muted">Local Governance Act, 2016 (Act 936)</p>
                  </div>
                </div>
                <span
                  className={`text-xs font-medium ${
                    selectedProperty.status === "PAID"
                      ? "text-[#137333]"
                      : selectedProperty.status === "PARTIALLY_PAID"
                      ? "text-[#B06000]"
                      : "text-[#C5221F]"
                  }`}
                >
                  {selectedProperty.status === "PAID"
                    ? "Settled in Full"
                    : selectedProperty.status === "PARTIALLY_PAID"
                    ? "Partially Settled"
                    : "Statutory Cutoff: 30-Jun"}
                </span>
              </div>

              {/* Particulars Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[11px] text-on-surface-muted">Account Head</span>
                  <div className="font-mono font-semibold text-foreground mt-0.5 min-h-[20px]">
                    <AnimatedValue value={selectedProperty.accountNumber} />
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-on-surface-muted">GPS Digital Address</span>
                  <div className="font-mono font-medium text-foreground mt-0.5 min-h-[20px]">
                    <AnimatedValue value={selectedProperty.ownerDigitalAddress} />
                  </div>
                </div>
                <div className="col-span-2 pt-2 border-t border-border-light">
                  <span className="text-[11px] text-on-surface-muted">Property Classification</span>
                  <div className="font-medium text-foreground mt-0.5 min-h-[20px]">
                    <AnimatedValue value={selectedProperty.propertyClassification} />
                  </div>
                </div>
              </div>

              {/* Financial Ledger Section */}
              <div className="pt-2 border-t border-border-light/60">
                <div className="flex items-center justify-between pb-2">
                  <span className="text-xs font-semibold text-foreground">
                    Financial Ledger
                  </span>
                  <span className="text-[11px] text-on-surface-muted">
                    Bill Date: {selectedProperty.billDateFormatted}
                  </span>
                </div>

                <div
                  className={`space-y-2 text-xs divide-y divide-[#F1F3F4] transition-opacity ${
                    selectedProperty.status === "PAID" ? "opacity-25" : ""
                  }`}
                >
                  <div className="flex items-center justify-between pt-1 text-on-surface-muted">
                    <span>Previous Year Assessment</span>
                    <span className="font-medium text-foreground">
                      <AnimatedValue value={selectedProperty.previousYearBillFormatted} />
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 text-on-surface-muted">
                    <span>Amount Settled Last Year</span>
                    <span className="font-medium text-foreground">
                      <AnimatedValue value={selectedProperty.amountPaidLastYearFormatted} />
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 text-on-surface-muted">
                    <span>Cumulative Carried Arrears</span>
                    <span className="font-medium text-foreground">
                      <AnimatedValue value={selectedProperty.arrearsFormatted} />
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 text-on-surface-muted">
                    <span>2025 Current Assessment</span>
                    <span className="font-medium text-foreground">
                      <AnimatedValue value={selectedProperty.currentFeeFormatted} />
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2.5 text-sm font-semibold">
                    <span className="text-foreground">Total Rate Assessment Due</span>
                    <span className="text-foreground">
                      <AnimatedValue
                        value={
                          selectedProperty.status === "PAID"
                            ? "GH₵ 0.00"
                            : selectedProperty.totalAmountDueFormatted
                        }
                      />
                    </span>
                  </div>
                </div>
              </div>

              {/* Faded Black Curtain Overlay for Settled Properties */}
              {selectedProperty.status === "PAID" && (
                <div className="absolute inset-0 bg-[#1C1D1F]/88 backdrop-blur-[2px] flex flex-col items-center justify-center p-4 text-center text-white space-y-1.5 transition-all">
                  <CheckCircle2 className="w-5 h-5 text-[#81C995] mb-0.5" />
                  <h4 className="text-xs font-semibold text-white tracking-tight">
                    Financial Ledger Settled &bull; GH₵ 0.00 Outstanding
                  </h4>
                  <p className="text-[11px] text-[#DADCE0] max-w-[260px] leading-relaxed">
                    All statutory rating charges and carried arrears for FY {selectedProperty.billYear} have been liquidated.
                  </p>
                </div>
              )}
            </article>

            {/* Valuation & Rate Computation */}
            <article className="p-4 rounded-2xl bg-surface border border-border-light shadow-md space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-border-light">
                <span className="text-xs font-semibold text-foreground">
                  Valuation &amp; Computation
                </span>
                <span className="text-[11px] text-on-surface-muted">Statutory Factor</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[11px] text-on-surface-muted">Rateable Capital Valuation</span>
                  <div className="text-sm font-semibold text-foreground mt-0.5 min-h-[22px]">
                    <AnimatedValue value={selectedProperty.rateableValueFormatted} />
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-on-surface-muted">Rate Imposed Factor</span>
                  <div className="font-mono text-sm font-semibold text-foreground mt-0.5 min-h-[22px]">
                    <AnimatedValue value={selectedProperty.rateImposedFormatted} />
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-border-light flex items-center justify-between text-xs">
                <span className="text-on-surface-muted">2025 Current Assessment Fee</span>
                <span className="font-semibold text-foreground">
                  <AnimatedValue value={selectedProperty.currentFeeFormatted} />
                </span>
              </div>
            </article>

            {/* Statutory Deadline Alert */}
            <div className="p-3.5 rounded-xl bg-surface border border-border-light shadow-sm flex items-center gap-2.5 text-xs">
              <AlertTriangle className="w-4 h-4 text-on-surface-muted shrink-0" />
              <span className="text-on-surface-muted">
                Statutory Payment Cutoff:{" "}
                <strong className="text-foreground font-semibold">
                  {selectedProperty.settlementDeadlineFormatted}
                </strong>{" "}
                (Under Act 936)
              </span>
            </div>

            {/* Settled Compliance Note */}
            {selectedProperty.status === "PAID" && (
              <div className="p-4 rounded-2xl bg-surface border border-border-light shadow-sm space-y-2">
                <div className="flex items-center gap-2 text-[#137333] text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Account Fully Settled (GH₵ 0.00 Balance)</span>
                </div>
                <p className="text-xs text-on-surface-muted">
                  All statutory property rating obligations for {selectedProperty.accountNumber} have been satisfied under Act 936.
                </p>
                <div className="pt-2 border-t border-border-light flex justify-end">
                  <button
                    type="button"
                    onClick={() => router.push("/receipts")}
                    className="text-xs font-medium text-foreground hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>View Official Payment Receipts</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
        </section>
      )}
      </>
      )}

      {/* ═══════════════════════════════════════════════════════════
          3. REMOVED FAB EXPANSION MENU
         ═══════════════════════════════════════════════════════════ */}

      {/* NOTIFICATIONS QUICK PREVIEW MODAL */}
      <AnimatePresence>
        {showNotifModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-xs"
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
                <span>View All Notifications</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════
// FAB EXPANSION MENU — ANIMATION VARIANTS
// ═══════════════════════════════════════════════════════════════

/** Staggered container: controls child sequencing */
const fabContainerVariants = (reducedMotion: boolean): Variants => ({
  hidden: {
    transition: {
      staggerChildren: reducedMotion ? 0.02 : 0.05,
      staggerDirection: 1,   // Collapse order: top (index 0) first → bottom last
      when: "afterChildren",  // Container waits for all children to exit
    },
  },
  visible: {
    transition: {
      delayChildren: reducedMotion ? 0.02 : 0.06,
      staggerChildren: reducedMotion ? 0.04 : 0.1,
      staggerDirection: -1,  // Expand order: bottom (last index) first → top last
    },
  },
});

/** Individual card: springs out from the FAB origin */
const fabCardVariants = (reducedMotion: boolean): Variants => ({
  hidden: {
    opacity: 0,
    scale: reducedMotion ? 0.9 : 0.65,
    y: reducedMotion ? 15 : 60,
    filter: reducedMotion ? "none" : "blur(4px)",
    transition: reducedMotion
      ? { duration: 0.08 }
      : {
          type: "spring" as const,
          stiffness: 520,
          damping: 30,
          mass: 0.5,
        },
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    filter: "blur(0px)",
    transition: reducedMotion
      ? { duration: 0.12 }
      : {
          type: "spring" as const,
          stiffness: 420,
          damping: 18,
          mass: 0.6,
        },
  },
});

/** Hook: respects prefers-reduced-motion media query */
function usePrefersReducedMotion() {
  const [prefersReduced, setPrefersReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return prefersReduced;
}

export default function PropertiesPage() {
  return (
    <Suspense
      fallback={<PropertiesSkeleton />}
    >
      <PropertiesContent />
    </Suspense>
  );
}
