import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://jzezuitkenrfkzrkphiz.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);

const { count, error } = await supabase.from("Property").select("*", { count: "exact", head: true });
if (error) {
  console.error("Supabase Error:", error);
} else {
  console.log("Supabase connected! Property count:", count);
}
