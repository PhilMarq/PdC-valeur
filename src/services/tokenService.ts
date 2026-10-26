import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseClient } from "./supabaseClient.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type TokenErrorCode = "unauthenticated" | "mismatch" | "config" | "unavailable";

export class TokenServiceError extends Error {
  readonly code: TokenErrorCode;

  constructor(code: TokenErrorCode, message: string) {
    super(message);
    this.name = "TokenServiceError";
    this.code = code;
  }
}

/**
 * Solde de `public.profiles.credits` pour l'utilisateur connecté.
 * La lecture passe par la ligne `profiles`, puis par `get_my_credits()`.
 */
export async function getUserTokenBalance(userId: string, accessToken?: string | null): Promise<number> {
  const client = await clientFor(userId, accessToken);
  const fromProfile = await client.from("profiles").select("credits").eq("id", userId).maybeSingle();
  if (fromProfile.error) assertAccepted(fromProfile.error);
  if (!fromProfile.error && fromProfile.data && typeof fromProfile.data.credits === "number") {
    return fromProfile.data.credits;
  }

  const rpc = await client.rpc("get_my_credits");
  if (rpc.error) assertAccepted(rpc.error);
  if (!rpc.error && typeof rpc.data === "number") return rpc.data;

  if (fromProfile.error || rpc.error) {
    throw new TokenServiceError("unavailable", "Le solde de jetons n'a pas pu être lu.");
  }
  throw new TokenServiceError(
    "unauthenticated",
    "Session Supabase absente : le Studio doit transmettre le jeton de connexion.",
  );
}

async function clientFor(userId: string, accessToken?: string | null): Promise<SupabaseClient> {
  let client: SupabaseClient;
  try {
    client = createSupabaseClient(accessToken);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Configuration Supabase incomplète.";
    throw new TokenServiceError("config", message);
  }

  if (!accessToken) {
    throw new TokenServiceError(
      "unauthenticated",
      "Session Supabase absente : le Studio doit transmettre le jeton de connexion.",
    );
  }

  const session = readSession(accessToken);
  if (!session) {
    throw new TokenServiceError("unauthenticated", "Jeton de session invalide ou expiré.");
  }
  if (session.subject !== userId.toLowerCase()) {
    throw new TokenServiceError("mismatch", "Le jeton ne correspond pas à l'utilisateur indiqué.");
  }
  if (session.expiresAt !== null && session.expiresAt * 1000 <= Date.now()) {
    throw new TokenServiceError("unauthenticated", "Jeton de session invalide ou expiré.");
  }
  return client;
}

function readSession(accessToken: string): { subject: string; expiresAt: number | null } | null {
  const payload = accessToken.split(".")[1];
  if (!payload) return null;
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const json = JSON.parse(atob(padded)) as { sub?: unknown; exp?: unknown };
    if (typeof json.sub !== "string" || !UUID_PATTERN.test(json.sub)) return null;
    const expiresAt = typeof json.exp === "number" && Number.isFinite(json.exp) ? json.exp : null;
    return { subject: json.sub.toLowerCase(), expiresAt };
  } catch {
    return null;
  }
}

function assertAccepted(error: { message?: string; code?: string }): void {
  const text = `${error.code ?? ""} ${error.message ?? ""}`;
  if (/jwt|unauthor|invalid claim|PGRST301|401/i.test(text)) {
    throw new TokenServiceError("unauthenticated", "Jeton de session invalide ou expiré.");
  }
}
