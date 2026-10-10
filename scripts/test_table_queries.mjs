import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://jzezuitkenrfkzrkphiz.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const tables = [
  "Property", "PropertyOwner", "PropertyTypes", "PropertyCategorys", "Property11",
  "Division_11_P", "tPremise", "tOccupants", "tConstructionMaterial", "OWNER$",
  "Bill", "BillSettings", "tmpbill", "FeePayments", "FixedFees", "FixedFees11",
  "Ff2020", "AdjustArrears", "DefaultersList", "tAssessmentType"
];

for (const t of tables) {
  const { data, count, error } = await supabase.from(t).select("*", { count: "exact" }).range(0, 1);
  if (error) console.error(`Error querying ${t}:`, error.message);
  else console.log(`✓ ${t}: count=${count}, sample=${data?.length}`);
}
