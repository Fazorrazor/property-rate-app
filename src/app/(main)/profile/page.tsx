"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Phone,
  Building2,
  CreditCard,
  LogOut,
  ChevronRight,
  Loader2,
  Lock,
  Headphones,
  Clock,
  Link2,
} from "lucide-react";
import { HeinzLoader } from "@/components/ui/HeinzLoader";
import { ProfileSkeleton } from "@/components/ui/Skeletons";
import { getDashboardData, logoutUser, DashboardData } from "@/app/actions";

export default function ProfilePage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await getDashboardData();
        if (res) {
          setData(res);
        }
      } catch (err) {
        console.error("Error loading profile:", err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logoutUser();
      router.push("/auth/welcome");
    } catch (err) {
      console.error(err);
      setIsLoggingOut(false);
    }
  };

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  const user = data?.user || {
    name: null,
    phoneNumber: "",
    id: "",
    isVerified: false,
  };

  const propertiesCount = data?.properties?.length || 0;
  const hasLinkedProperties = propertiesCount > 0;

  const formatPhone = (phone: string) => {
    const d = phone.replace(/\D/g, "");
    if (d.length === 10) {
      return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
    }
    return phone;
  };

  const displayName = hasLinkedProperties && user.name && user.name !== "Ratepayer"
    ? user.name
    : user.phoneNumber
    ? `Taxpayer (${formatPhone(user.phoneNumber)})`
    : "Unlinked Taxpayer";

  const getInitials = (name?: string | null) => {
    if (!name || name === "Ratepayer" || name === "Unlinked Taxpayer") return "TX";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <main className="relative flex-1 min-h-screen bg-surface-subtle p-4 sm:p-5 pb-24 max-w-md mx-auto w-full font-sans space-y-4 pt-2 text-on-surface">
      {/* Profile Card */}
      <section className="p-4 rounded-xl bg-surface border border-border-light space-y-3 shadow-md">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-[#4B1426] text-white font-medium text-base flex items-center justify-center shrink-0">
            {getInitials(displayName)}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-semibold text-on-surface">{displayName}</h2>
              {hasLinkedProperties && <ShieldCheck className="w-4 h-4 text-[#188038]" />}
            </div>
            <p className="text-xs text-on-surface-muted flex items-center gap-1 mt-0.5">
              <Phone className="w-3 h-3" />
              <span>{user.phoneNumber ? formatPhone(user.phoneNumber) : "—"}</span>
            </p>
          </div>
        </div>

        <div className="pt-2 border-t border-border-subtle grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-lg bg-surface-subtle border border-border-subtle">
            <span className="text-[11px] text-on-surface-muted">Taxpayer ID</span>
            <p className="font-mono font-medium text-on-surface mt-0.5">
              {hasLinkedProperties && user.id ? `TP-${user.id.substring(0, 4).toUpperCase()}-KKMA` : "—"}
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-surface-subtle border border-border-subtle">
            <span className="text-[11px] text-on-surface-muted">Assembly District</span>
            <p className="font-medium text-on-surface mt-0.5">
              {hasLinkedProperties ? "Kpone-Katamanso" : "—"}
            </p>
          </div>
        </div>
      </section>

      {/* Municipal Records */}
      <section className="rounded-xl bg-surface border border-border-light overflow-hidden divide-y divide-[#E8EAED] shadow-md">
        <button
          type="button"
          onClick={() => router.push("/properties")}
          className="w-full p-3.5 flex items-center justify-between hover:bg-surface-subtle transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface-subtle flex items-center justify-center text-[#4B1426]">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-on-surface">Registered Properties</p>
              <p className="text-[11px] text-on-surface-muted">
                {hasLinkedProperties ? `${propertiesCount} Account Head${propertiesCount === 1 ? "" : "s"} & Valuation Bills` : "0 properties linked"}
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-on-surface-muted" />
        </button>

        <button
          type="button"
          onClick={() => router.push("/receipts")}
          className="w-full p-3.5 flex items-center justify-between hover:bg-surface-subtle transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface-subtle flex items-center justify-center text-[#4B1426]">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-on-surface">Payment Receipts</p>
              <p className="text-[11px] text-on-surface-muted">
                {hasLinkedProperties ? "Official audit certificates & records" : "0 receipts"}
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-on-surface-muted" />
        </button>
      </section>

      {/* Settings & Account */}
      <section className="rounded-xl bg-surface border border-border-light overflow-hidden shadow-md">
        <button
          type="button"
          onClick={() => router.push("/settings")}
          className="w-full p-3.5 flex items-center justify-between hover:bg-surface-subtle transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface-subtle flex items-center justify-center text-[#4B1426]">
              <Link2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-on-surface">Account Settings</p>
              <p className="text-[11px] text-on-surface-muted">Manage your linked properties</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-on-surface-muted" />
        </button>
      </section>

      {/* Security & Access */}
      <section className="p-4 rounded-xl bg-surface border border-border-light space-y-2.5 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-on-surface-muted" />
            <h3 className="text-xs font-semibold text-on-surface">
              Security &amp; Authentication
            </h3>
          </div>
          <span className="text-[11px] text-on-surface-muted">SMS OTP</span>
        </div>

        <div className="p-3 rounded-lg bg-surface-subtle border border-border-subtle flex items-center justify-between gap-3 text-xs">
          <div>
            <p className="font-medium text-on-surface">Two-Step Phone OTP</p>
            <p className="text-[11px] text-on-surface-muted">
              Account access bound to telephone number
            </p>
          </div>

          <div className="text-[#4B1426] text-[11px] font-semibold flex items-center gap-1 shrink-0">
            <Lock className="w-3 h-3" />
            <span>Active</span>
          </div>
        </div>
      </section>

      {/* Support Information */}
      <section className="p-4 rounded-xl bg-surface border border-border-light space-y-2 shadow-md">
        <div className="flex items-center gap-1.5">
          <Headphones className="w-3.5 h-3.5 text-on-surface-muted" />
          <h3 className="text-xs font-semibold text-on-surface">
            Municipal Revenue Support
          </h3>
        </div>

        <div className="space-y-1.5 text-xs">
          <div className="p-2.5 rounded-lg bg-surface-subtle border border-border-subtle flex items-center justify-between">
            <div>
              <p className="font-medium text-on-surface">Directorate Hotline</p>
              <p className="text-[11px] text-on-surface-muted">Kpone-Katamanso Assembly</p>
            </div>
            <a
              href="tel:0244729789"
              className="text-xs font-medium text-[#4B1426] hover:underline"
            >
              0244729789
            </a>
          </div>

          <div className="p-2.5 rounded-lg bg-surface-subtle border border-border-subtle flex items-center justify-between text-on-surface-muted">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Office Hours: Mon – Fri: 8:00 AM – 5:00 PM</span>
            </div>
            <span>Kpone</span>
          </div>
        </div>
      </section>

      {/* Log Out Button */}
      <button
        type="button"
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="btn-3d-danger w-full h-11 rounded-xl text-white font-medium text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
      >
        {isLoggingOut ? (
          <span className="animate-pulse">Logging Out...</span>
        ) : (
          <>
            <LogOut className="w-3.5 h-3.5" />
            <span>Log Out</span>
          </>
        )}
      </button>
    </main>
  );
}
