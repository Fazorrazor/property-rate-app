"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Link2, Building2, AlertTriangle, Plus, ChevronLeft, Loader2, Info } from "lucide-react";
import { getDashboardData, linkPropertyAccount, DashboardData } from "@/app/actions";
import { motion, AnimatePresence } from "framer-motion";
import { HeinzLoader } from "@/components/ui/HeinzLoader";

export default function SettingsPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isLinking, setIsLinking] = useState(false);
  const [accountNumber, setAccountNumber] = useState("");
  const [linkError, setLinkError] = useState("");
  const [linkSuccess, setLinkSuccess] = useState(false);

  async function load() {
    try {
      const res = await getDashboardData();
      if (res) {
        setData(res);
      }
    } catch (err) {
      console.error("Error loading settings:", err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const handleLinkProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    setLinkError("");
    setLinkSuccess(false);

    if (!accountNumber.trim()) {
      setLinkError("Please enter an Account Number.");
      return;
    }

    setIsLinking(true);
    try {
      const res = await linkPropertyAccount(accountNumber.trim());
      if (res.success) {
        setLinkSuccess(true);
        setAccountNumber("");
        await load();
      } else {
        setLinkError(res.error || "Failed to link property.");
      }
    } catch (err) {
      setLinkError("An unexpected error occurred.");
    } finally {
      setIsLinking(false);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-surface-subtle flex flex-col items-center justify-center">
        <HeinzLoader size="large" />
      </main>
    );
  }

  const properties = data?.properties || [];

  return (
    <main className="min-h-screen bg-surface-subtle flex flex-col font-sans max-w-md mx-auto w-full pb-24">
      <div className="sticky top-0 z-10 bg-surface/90 backdrop-blur-md border-b border-border-subtle p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 rounded-full bg-surface-subtle border border-border-light flex items-center justify-center text-on-surface-muted hover:text-foreground transition-colors cursor-pointer shadow-xs"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-foreground leading-tight">Settings</h1>
            <p className="text-[11px] text-on-surface-muted">Manage Linked Properties</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        <section className="p-4 rounded-2xl bg-surface border border-border-light shadow-md space-y-4">
          <div className="flex items-center gap-2 text-foreground">
            <Link2 className="w-5 h-5 text-[#4B1426]" />
            <h2 className="text-sm font-semibold">Link New Property</h2>
          </div>
          <p className="text-xs text-on-surface-muted">
            Enter the Municipal Account Number of the property you want to add to your profile. You can link up to 3 phone numbers per property.
          </p>

          <form onSubmit={handleLinkProperty} className="space-y-3">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-on-surface-muted ml-1">Account Number</label>
              <input
                type="text"
                placeholder="e.g. KKDA03188007"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className="w-full h-11 px-3 rounded-xl bg-surface-subtle border border-border-light text-sm font-medium text-foreground focus:outline-none focus:border-[#4B1426] transition-colors"
                disabled={isLinking}
              />
            </div>

            <AnimatePresence>
              {linkError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-[#FCE8E6] border border-[#FAD2CF] text-[#C5221F] p-2.5 rounded-lg text-xs flex items-start gap-2"
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>{linkError}</p>
                </motion.div>
              )}
              {linkSuccess && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-[#E6F4EA] border border-[#CEEAD6] text-[#137333] p-2.5 rounded-lg text-xs flex items-start gap-2"
                >
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>Property linked successfully! It is now available on your dashboard.</p>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={isLinking || !accountNumber.trim()}
              className="w-full h-11 rounded-xl bg-[#4B1426] hover:bg-[#558467] text-white font-medium text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm disabled:opacity-50"
            >
              {isLinking ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Link Property Account</span>
                </>
              )}
            </button>
          </form>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground px-1">Your Linked Properties ({properties.length})</h2>
          <div className="space-y-3">
            {properties.map(prop => (
              <div key={prop.id} className="p-3.5 rounded-2xl bg-surface border border-border-light shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-surface-subtle flex items-center justify-center border border-border-subtle shrink-0 text-[#4B1426]">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground leading-tight">{prop.accountNumber}</p>
                    <p className="text-[11px] text-on-surface-muted mt-0.5">{prop.ownerDigitalAddress}</p>
                  </div>
                </div>
              </div>
            ))}

            {properties.length === 0 && (
              <div className="p-6 text-center border border-dashed border-border-light rounded-2xl">
                <p className="text-sm text-on-surface-muted">No properties linked yet.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
