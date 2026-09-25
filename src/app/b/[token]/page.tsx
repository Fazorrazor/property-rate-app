import { redirect } from "next/navigation";
import { claimAccessGrant } from "@/app/actions";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function BillShortLinkPage({ params }: Props) {
  const { token } = await params;
  if (!token) redirect("/bill");

  const cleanToken = token.trim();

  // If token is a direct property account number (e.g. KKMA-00049 or prop_...)
  if (
    cleanToken.toUpperCase().startsWith("KKMA-") ||
    cleanToken.toUpperCase().startsWith("ACC-") ||
    cleanToken.startsWith("prop_")
  ) {
    redirect(`/bill?accountNumber=${encodeURIComponent(cleanToken)}`);
  }

  try {
    const res = await claimAccessGrant(cleanToken);
    if (res.success && res.accountNumber) {
      redirect(`/bill?accountNumber=${encodeURIComponent(res.accountNumber)}`);
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
