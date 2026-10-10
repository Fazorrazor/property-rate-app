import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: "property-rate-admin/.env" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log("Checking all candidate tables in Supabase...");

  const candidateTables = [
    "FeePayments",
    "FeePayment",
    "Transaction",
    "Receipt",
    "PaidUserRecord",
    "AdjustArrears",
    "CollectorsCommPmts",
    "tmpbill",
    "Bill",
    "Property",
    "Property11",
    "FixedFees",
    "FixedFees11",
    "Ff2020",
    "tblPermitPayment"
  ];

  for (const t of candidateTables) {
    const { count, error } = await supabase.from(t).select("*", { count: "exact", head: true });
    if (error) {
      console.log(`Table "${t}": NOT ACCESSIBLE (${error.message})`);
    } else {
      console.log(`Table "${t}": ${count} rows`);
    }
  }

  // Now search for PR-011-001350 in each accessible table
  console.log("\nSearching for PR-011-001350...");
  for (const t of ["FeePayments", "Transaction", "Receipt", "PaidUserRecord", "AdjustArrears"]) {
    try {
      const { data } = await supabase.from(t).select("*").or(`accountNo.eq.PR-011-001350,accountNumber.eq.PR-011-001350,reference.ilike.%PR-011-001350%`);
      if (data && data.length > 0) {
        console.log(`Found in "${t}":`, data);
      }
    } catch (e) {
      // ignore
    }
  }

  // Also search for any payment for PR-011-001350 by transaction or user
  const { data: prop } = await supabase.from("Property").select("*").eq("account_no", "PR-011-001350");
  console.log("Property record for PR-011-001350:", prop);
}

run();
