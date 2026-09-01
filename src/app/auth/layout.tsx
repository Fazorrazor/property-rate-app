"use client";

import { useRef, useEffect, useState, createContext, useContext } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const routeHierarchy: Record<string, number> = {
  "/auth/welcome": 1,
  "/auth/login": 2,
  "/auth/verify": 3,
};

const STYLES = {
  layoutWrapper: "relative flex-1 min-h-screen bg-surface-subtle text-on-surface flex flex-col justify-between max-w-md mx-auto w-full font-sans overflow-x-hidden",
  fixedHeader: "fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-md h-24 px-6 sm:px-8 pt-6 flex items-center justify-center bg-surface-subtle z-30 border-b border-transparent",
  backButton: "absolute left-6 sm:left-8 h-11 w-11 rounded-2xl bg-surface border border-border-light shadow-sm flex items-center justify-center text-on-surface-muted hover:text-on-surface hover:border-border-light hover:bg-surface-subtle transition-all active:scale-95 cursor-pointer",
  logoTextWrapper: "text-center space-y-0.5 pointer-events-none select-none",
  logoTitle: "text-2xl font-black tracking-[0.25em] text-on-surface uppercase leading-none",
  logoSubtitle: "text-[10px] font-bold uppercase tracking-widest text-on-surface-muted pt-0.5",
  mainContentContainer: "flex-1 flex flex-col justify-center px-6 sm:px-8 pt-24 relative w-full overflow-hidden",
  slideInnerContainer: "w-full flex-1 flex flex-col justify-center",
};

export const AuthTransitionContext = createContext({
  isExitingToDashboard: false,
  triggerDashboardExit: () => {},
});

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const prevPathRef = useRef(pathname);
  const [direction, setDirection] = useState(1);
  const [isExitingToDashboard, setIsExitingToDashboard] = useState(false);

  useEffect(() => {
    const prevOrder = routeHierarchy[prevPathRef.current] || 1;
    const currentOrder = routeHierarchy[pathname] || 1;
    if (currentOrder > prevOrder) {
      setDirection(1); // Forward
    } else if (currentOrder < prevOrder) {
      setDirection(-1); // Backward
    }
    prevPathRef.current = pathname;
  }, [pathname]);

  const handleBack = () => {
    if (pathname === "/auth/verify") {
      router.push("/auth/login");
    } else if (pathname === "/auth/login") {
      router.push("/auth/welcome");
    }
  };

  const isVerifyPage = pathname === "/auth/verify";
  const isWelcomePage = pathname === "/auth/welcome";
  const showHeader = !isExitingToDashboard && !isVerifyPage;
  const showBackButton = pathname !== "/auth/welcome";

  return (
    <AuthTransitionContext.Provider value={{ isExitingToDashboard, triggerDashboardExit: () => setIsExitingToDashboard(true) }}>
      <div className={`relative flex-1 min-h-screen text-on-surface flex flex-col justify-between max-w-md mx-auto w-full font-sans overflow-x-hidden ${isWelcomePage ? "bg-slate-950 text-white" : "bg-surface-subtle"}`}>
        
        {/* 1. Rigid Fixed Header */}
        <AnimatePresence>
          {showHeader && (
            <motion.nav 
              initial={false}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className={`fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-md h-24 px-6 sm:px-8 pt-6 flex items-center justify-center z-30 border-b border-transparent ${
                isWelcomePage ? "bg-transparent" : "bg-surface-subtle"
              }`}
              aria-label="Authentication navigation"
            >
              {showBackButton && (
                <button
                  type="button"
                  onClick={handleBack}
                  className={STYLES.backButton}
                  aria-label="Go back"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}

              <div className={STYLES.logoTextWrapper}>
                <h2 className={`text-2xl font-black tracking-[0.25em] uppercase leading-none ${
                  isWelcomePage ? "text-white drop-shadow-md" : "text-slate-950"
                }`}>
                  HEINZ
                </h2>
                <p className={`text-[10px] font-bold uppercase tracking-widest pt-0.5 ${
                  isWelcomePage ? "text-slate-200/90 drop-shadow-sm" : "text-slate-400"
                }`}>
                  Municipal Property Portal
                </p>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>

        {/* 2. Main Content Container */}
        <main className={`flex-1 flex flex-col justify-center relative w-full overflow-hidden ${
          isWelcomePage ? "p-0" : isVerifyPage ? "px-6 sm:px-8" : "px-6 sm:px-8 pt-24"
        }`}>
          <div className={`w-full flex-1 flex flex-col justify-center ${isWelcomePage ? "h-full" : ""}`}>
            {children}
          </div>
        </main>
      </div>
    </AuthTransitionContext.Provider>
  );
}
