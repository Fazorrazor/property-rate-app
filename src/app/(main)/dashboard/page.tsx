"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HeinzLoader } from "@/components/ui/HeinzLoader";

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const accountNumberParam = searchParams.get("accountNumber") || searchParams.get("propertyId") || "";
  const tokenParam = searchParams.get("token") || undefined;

  useEffect(() => {
    if (tokenParam) {
      router.replace(`/auth/access?token=${encodeURIComponent(tokenParam)}`);
      return;
    }
    if (accountNumberParam) {
      router.replace(`/bill?accountNumber=${encodeURIComponent(accountNumberParam)}`);
    } else {
      router.replace("/bill");
    }
  }, [accountNumberParam, tokenParam, router]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <HeinzLoader size="large" />
      <p className="mt-4 text-xs text-on-surface-muted font-medium tracking-tight">
        Redirecting to Municipal Bill Portal...
      </p>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
          <HeinzLoader size="large" />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
