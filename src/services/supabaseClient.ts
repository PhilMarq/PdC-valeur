import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const MISSING_KEYS_MESSAGE =
  "Configuration Supabase incomplète : ajoutez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans le fichier .env, puis relancez l'application.";

type SupabaseEnv = {
  url: string;
  anonKey: string;
};

/** Clé publique du projet partagé avec le Studio 3D et la vitrine. */
export function readSupabaseEnv(): SupabaseEnv {
  const url = readEnv("VITE_SUPABASE_URL");
  const anonKey = readEnv("VITE_SUPABASE_ANON_KEY") || readEnv("VITE_SUPABASE_PUBLISHABLE_KEY");
  if (!url || !anonKey) {
    throw new Error(MISSING_KEYS_MESSAGE);
  }
  return { url, anonKey };
}

/**
 * Client navigateur. `accessToken` est le jeton de session Supabase transmis
 * par le Studio : les fonctions `get_my_credits` et `deduct_credit` lisent
 * `auth.uid()` depuis ce jeton, pas depuis un identifiant libre.
 */
export function createSupabaseClient(accessToken?: string | null): SupabaseClient {
  const { url, anonKey } = readSupabaseEnv();
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    accessToken: accessToken ? async () => accessToken : undefined,
  });
}

function readEnv(name: string): string {
  const value = import.meta.env[name];
  return typeof value === "string" ? value.trim() : "";
}
