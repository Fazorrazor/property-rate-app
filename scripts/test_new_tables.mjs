import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://jzezuitkenrfkzrkphiz.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);

const res1 = await supabase.from("Division_11_P").select("*").limit(1);
console.log("Division_11_P:", res1.data, "error:", res1.error);

const res2 = await supabase.from("OWNER$").select("*").limit(1);
console.log("OWNER$:", res2.data, "error:", res2.error);
