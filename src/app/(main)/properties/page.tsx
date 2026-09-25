"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HeinzLoader } from "@/components/ui/HeinzLoader";

function PropertiesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deepLinkAccount = searchParams.get("accountNumber") || searchParams.get("propertyId") || "";

  useEffect(() => {
    if (deepLinkAccount) {
      router.replace(`/bill?accountNumber=${encodeURIComponent(deepLinkAccount)}`);
    } else {
      router.replace("/bill");
    }
  }, [deepLinkAccount, router]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <HeinzLoader size="large" />
      <p className="mt-4 text-xs text-on-surface-muted font-medium tracking-tight">
        Redirecting to Municipal Bill Portal...
      </p>
    </div>
  );
}

export default function PropertiesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
          <HeinzLoader size="large" />
        </div>
      }
    >
      <PropertiesContent />
    </Suspense>
  );
}
