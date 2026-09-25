import { redirect } from "next/navigation";
import { claimAccessGrant } from "@/app/actions";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function PaymentShortLinkPage({ params }: Props) {
  const { token } = await params;
  if (!token) redirect("/checkout");

  const cleanToken = token.trim();

  // If token is a direct property account number (e.g. KKDA03991001, KKMA-00049, prop_...)
  if (
    cleanToken.toUpperCase().startsWith("KK") ||
    cleanToken.toUpperCase().startsWith("ACC-") ||
    cleanToken.startsWith("prop_")
  ) {
    redirect(`/checkout?propertyId=${encodeURIComponent(cleanToken)}`);
  }

  try {
    const res = await claimAccessGrant(cleanToken);
    if (res.success && res.accountNumber) {
      if (res.isMulti) {
        redirect(
          `/checkout?propertyId=ALL&accountNumber=${encodeURIComponent(res.accountNumber)}`
        );
      } else {
        redirect(`/checkout?propertyId=${encodeURIComponent(res.accountNumber)}`);
      }
    }
  } catch (err) {
    // If error is a Next.js redirect exception, re-throw it so Next.js handles navigation
    if (err && typeof err === "object" && "digest" in err) {
      throw err;
    }
  }

  // If requires verification or device mismatch, route cleanly to security fallback
  redirect(`/auth/access?token=${encodeURIComponent(cleanToken)}`);
}
