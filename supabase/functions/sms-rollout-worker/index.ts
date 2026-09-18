// @ts-nocheck
// supabase/functions/sms-rollout-worker/index.ts
// Supabase Edge Function - processes SmsRolloutJob rows asynchronously
// Invoked via fire-and-forget fetch() from the Next.js server action

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ARKESEL_BASE = "https://sms.arkesel.com/api/v2/sms/send";
const CONCURRENCY = 50;

Deno.serve(async (req: any) => {
  let jobId;
  try {
    const body = await req.json();
    jobId = body?.jobId;
  } catch {
    return new Response("Bad Request: missing jobId", { status: 400 });
  }

  if (!jobId) return new Response("Bad Request: jobId required", { status: 400 });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const arkeselApiKey = Deno.env.get("ARKESEL_API_KEY");
  const arkeselSenderId = Deno.env.get("ARKESEL_SENDER_ID") || "KKMA";
  const db = createClient(supabaseUrl, supabaseServiceKey);

  const { data: job, error: jobErr } = await db
    .from("SmsRolloutJob")
    .select("*")
    .eq("id", jobId)
    .single();

  if (jobErr || !job) return new Response("Job not found: " + jobId, { status: 404 });

  await db.from("SmsRolloutJob").update({ status: "RUNNING" }).eq("id", jobId);

  const accountNumbers = job.accountNumbers || [];
  const template = job.template || "";
  const mode = job.mode || "TEST";

  const { data: properties } = await db
    .from("Property")
    .select("accountNumber:account_no, name, telephone, totalAmountDue:outstanding_amt, arrears, currentFee:current_bill, ownerDigitalAddress, municipality, billYear, settlementDeadline, owner:PropertyOwner(name, tel, mobileNumber), users:User(id, phoneNumber, name)")
    .in("account_no", accountNumbers);

  if (!properties || properties.length === 0) {
    await db.from("SmsRolloutJob").update({ status: "DONE", totalCount: 0 }).eq("id", jobId);
    return new Response("No eligible properties", { status: 200 });
  }

  const phoneMap = new Map();
  for (const p of properties) {
    const rawPhone = p.telephone || p.owner?.tel || p.owner?.mobileNumber || p.users?.[0]?.phoneNumber;
    if (!rawPhone) continue;
    const normPhone = rawPhone.trim().replace(/[^\d+]/g, "");
    if (!normPhone || normPhone === "0" || normPhone.length < 7) continue;

    const rawOwnerName = p.name || p.owner?.name || p.users?.[0]?.name || "Municipal Ratepayer";
    const accNo = p.accountNumber || "";

    const upper = (rawOwnerName || "").toUpperCase().trim();
    let groupKey: string;
    if (!upper || upper.includes("NO NAME")) {
      // Keep unverified / unnamed records separate per account
      groupKey = `${normPhone}::UNNAMED::${accNo}`;
    } else {
      const cleanName = upper
        .replace(/\b(MR|MRS|MS|DR|ING|ALHAJI|HAJIA|HON|CHIEF|NII|NANA|REV|PASTOR|ELDER|MADAM)\b\.?/gi, "")
        .replace(/[^\w\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      groupKey = `${normPhone}::${cleanName}`;
    }

    if (!phoneMap.has(groupKey)) {
      phoneMap.set(groupKey, { phone: normPhone, ownerName: rawOwnerName, props: [] });
    }
    phoneMap.get(groupKey).props.push(p);
  }

  const recipients = Array.from(phoneMap.values());
  const totalCount = recipients.length;
  await db.from("SmsRolloutJob").update({ totalCount }).eq("id", jobId);

  let sentCount = 0;
  let failedCount = 0;

  for (let i = 0; i < recipients.length; i += CONCURRENCY) {
    const chunk = recipients.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      chunk.map(async ({ phone, ownerName, props }) => {
        const totalDue = props.reduce((s: number, p: any) => s + (p.totalAmountDue || 0), 0);
        const arrears = props.reduce((s: number, p: any) => s + (p.arrears || 0), 0);
        const accNo = props[0]?.accountNumber || "";
        const assessmentLink = "https://ratepayer.kkma.gov.gh/dashboard?accountNumber=" + encodeURIComponent(accNo);
        const checkoutLink = "https://ratepayer.kkma.gov.gh/checkout?propertyId=" + encodeURIComponent(accNo);

        const currentFee = props.reduce((s: number, p: any) => s + (p.currentFee || 0), 0);
        const propertyAccounts = props.map((p: any) => p.accountNumber).join(", ");
        const gpsAddress =
          Array.from(
            new Set(
              props
                .map((p: any) => p.ownerDigitalAddress?.trim())
                .filter((addr: any) => Boolean(addr))
            )
          ).join(", ") || props[0]?.ownerDigitalAddress || "N/A";
        const dueDateFormatted = props[0]?.settlementDeadline
          ? new Date(props[0].settlementDeadline).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : "30-Jun-2025";

        const messageText = template
          .replace(/{{ownerName}}/g, ownerName)
          .replace(/{{accountNumber}}/g, accNo)
          .replace(/{{propertyAccounts}}/g, propertyAccounts)
          .replace(/{{totalAmountDue}}/g, totalDue < 0 ? Math.abs(totalDue).toFixed(2) : totalDue.toFixed(2))
          .replace(/{{arrears}}/g, arrears.toFixed(2))
          .replace(/{{currentFee}}/g, currentFee.toFixed(2))
          .replace(/{{propertyGpsAddress}}/g, gpsAddress)
          .replace(/{{dueDate}}/g, dueDateFormatted)
          .replace(/{{municipality}}/g, props[0]?.municipality || "Kpone-Katamanso (KKMA)")
          .replace(/{{billYear}}/g, String(props[0]?.billYear || new Date().getFullYear()))
          .replace(/{{paymentLink}}/g, checkoutLink)
          .replace(/{{link_assessment}}/g, assessmentLink)
          .replace(/{{link_checkout}}/g, checkoutLink);

        if (mode === "LIVE") {
          const smsRes = await fetch(ARKESEL_BASE, {
            method: "POST",
            headers: { "api-key": arkeselApiKey, "Content-Type": "application/json" },
            body: JSON.stringify({ sender: arkeselSenderId, message: messageText, recipients: [phone] }),
          });
          const json = await smsRes.json().catch(() => ({}));
          if (!smsRes.ok || json?.status !== "success") throw new Error("Arkesel rejected: " + JSON.stringify(json));
        }
      })
    );

    for (const r of results) {
      if (r.status === "fulfilled") sentCount++;
      else failedCount++;
    }

    await db.from("SmsRolloutJob").update({ sentCount, failedCount }).eq("id", jobId);
  }

  const finalStatus = failedCount === totalCount && totalCount > 0 ? "FAILED" : "DONE";
  await db.from("SmsRolloutJob").update({ status: finalStatus, sentCount, failedCount }).eq("id", jobId);

  return new Response(JSON.stringify({ jobId, sentCount, failedCount, totalCount }), {
    headers: { "Content-Type": "application/json" },
  });
});
