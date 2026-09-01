"use client";

import { usePathname, useRouter } from "next/navigation";
import { Home, Building2, ReceiptText, Settings } from "lucide-react";
import { motion } from "framer-motion";

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

const NAV_ITEMS: NavItem[] = [
  { name: "Home", path: "/dashboard", icon: Home },
  { name: "Properties", path: "/properties", icon: Building2 },
  { name: "Payments", path: "/receipts", icon: ReceiptText },
  { name: "Settings", path: "/profile", icon: Settings },
];

export function BottomNavBar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <>
      {/* Ambient fade-out background shadow behind the navigation */}
      <div className="fixed bottom-0 left-0 right-0 h-28 z-20 pointer-events-none bg-gradient-to-t from-background via-background/90 to-transparent" />

      <motion.nav
        initial={{ y: 80, opacity: 0, x: "-50%" }}
        animate={{ y: 0, opacity: 1, x: "-50%" }}
        transition={{ duration: 0.3 }}
        className="fixed bottom-3 left-1/2 z-30 max-w-md w-11/12"
        aria-label="Bottom Navigation"
      >
        <div className="h-14 px-2 bg-surface/85 backdrop-blur-lg rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.15)] flex items-center justify-between gap-1 border border-border-light/80">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.path);

            return (
              <button
                key={item.name}
                type="button"
                onClick={() => router.push(item.path)}
                className={`flex-1 h-11 flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
                  isActive
                    ? "text-primary"
                    : "text-on-surface-muted hover:text-foreground"
                }`}
                aria-label={item.name}
              >
                <Icon
                  className={`w-5 h-5 shrink-0 transition-transform ${
                    isActive ? "text-primary scale-105" : "text-on-surface-muted"
                  }`}
                  strokeWidth={isActive ? 2.3 : 1.7}
                />
                <span
                  className={`text-[10px] leading-tight block tracking-tight ${
                    isActive ? "font-semibold text-primary" : "font-normal text-on-surface-muted"
                  }`}
                >
                  {item.name}
                </span>
              </button>
            );
          })}
        </div>
      </motion.nav>
    </>
  );
}
