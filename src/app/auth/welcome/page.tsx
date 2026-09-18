"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

function WelcomeRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const acc = searchParams.get("accountNumber") || searchParams.get("propertyId");
    if (acc) {
      router.replace(`/dashboard?accountNumber=${encodeURIComponent(acc)}`);
    } else {
      router.replace("/checkout");
    }
  }, [router, searchParams]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-on-surface-muted">
      <Loader2 className="w-8 h-8 animate-spin text-[#4B1426]" />
      <p className="text-sm font-medium">Redirecting to municipal portal...</p>
    </div>
  );
}

export default function WelcomePage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-on-surface-muted">
        <Loader2 className="w-8 h-8 animate-spin text-[#4B1426]" />
        <p className="text-sm font-medium">Redirecting to municipal portal...</p>
      </div>
    }>
      <WelcomeRedirect />
    </Suspense>
  );
}
