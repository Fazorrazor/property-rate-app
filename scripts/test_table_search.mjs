import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://jzezuitkenrfkzrkphiz.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

// Test search on PropertyOwner
const searchFilter = ["name.ilike.%KWAME%", "mobileNumber.ilike.%KWAME%", "tel.ilike.%KWAME%"].join(",");
const res = await supabase.from("PropertyOwner").select("*", { count: "exact" }).or(searchFilter).range(0, 4);
console.log("PropertyOwner search result:", res.count, res.data?.map(d => ({ name: d.name, mobile: d.mobileNumber })));

// Test search on DefaultersList
const defRes = await supabase.from("DefaultersList").select("*", { count: "exact" }).ilike("accountNo", "%020%").range(0, 2);
console.log("DefaultersList search result:", defRes.count, defRes.data);
