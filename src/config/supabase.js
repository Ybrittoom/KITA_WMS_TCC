import { createClient } from "@supabase/supabase-js";

let supabaseClient;

/** Cria um cliente Auth sem sessão compartilhada entre requisições do servidor. */
export function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    const error = new Error("SUPABASE_URL e SUPABASE_ANON_KEY precisam estar configurados.");
    error.code = "SUPABASE_CONFIG_MISSING";
    throw error;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
  }

  return supabaseClient;
}
