import { useEffect, useState } from "react";
import type { ResidualLandValueInput, ResidualLandValueResult } from "../financial/types.ts";
import { createSupabaseClient } from "../services/supabaseClient.ts";

const DEBOUNCE_MS = 120;

export interface ResidualCalculationState {
  result: ResidualLandValueResult | null;
  isCalculating: boolean;
  error: string | null;
}

export class ResidualRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ResidualRequestError";
    this.status = status;
  }
}

export function useResidualCalculation(params: ResidualLandValueInput): ResidualCalculationState {
  const [result, setResult] = useState<ResidualLandValueResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fingerprint = JSON.stringify(params);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      const nextParams = JSON.parse(fingerprint) as ResidualLandValueInput;
      setIsCalculating(true);
      setError(null);
      postResidual("preview", nextParams, null, controller.signal)
        .then((next) => {
          if (controller.signal.aborted) return;
          setResult(next);
        })
        .catch((reason: unknown) => {
          if (controller.signal.aborted || isAbort(reason)) return;
          setError(messageFrom(reason));
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsCalculating(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [fingerprint]);

  return { result, isCalculating, error };
}

/**
 * Export officiel. Le débit passe par `consume_credit()` (auth.uid(), 1 crédit).
 * `deduct_credit()` n'est plus dans la base live ; on ne l'appelle que si
 * `consume_credit` est absent. Le résultat vient de l'aperçu, après le débit.
 */
export async function exportResidualCalculation(
  params: ResidualLandValueInput,
  accessToken: string,
): Promise<ResidualLandValueResult> {
  const result = await postResidual("preview", params, null);
  await consumeOneCredit(accessToken);
  return result;
}

async function consumeOneCredit(accessToken: string): Promise<void> {
  const client = createSupabaseClient(accessToken);
  const consumed = await client.rpc("consume_credit");
  if (!consumed.error && typeof consumed.data === "number") return;
  if (consumed.error && isNoCredits(consumed.error.message)) {
    throw new ResidualRequestError(402, "Solde de jetons insuffisant.");
  }
  if (consumed.error && isJwtError(consumed.error)) {
    throw new ResidualRequestError(401, "Jeton de session invalide ou expiré.");
  }
  if (consumed.error && !isMissingFunction(consumed.error.message)) {
    throw new ResidualRequestError(402, "Le jeton n'a pas pu être déduit.");
  }

  const legacy = await client.rpc("deduct_credit");
  if (legacy.error) {
    if (isJwtError(legacy.error)) {
      throw new ResidualRequestError(401, "Jeton de session invalide ou expiré.");
    }
    if (isNoCredits(legacy.error.message)) {
      throw new ResidualRequestError(402, "Solde de jetons insuffisant.");
    }
    throw new ResidualRequestError(402, "Le jeton n'a pas pu être déduit.");
  }
  const payload = readLegacyPayload(legacy.data);
  if (payload.ok) return;
  if (payload.error === "insufficient") {
    throw new ResidualRequestError(402, "Solde de jetons insuffisant.");
  }
  if (payload.error === "unauthenticated") {
    throw new ResidualRequestError(401, "Jeton de session invalide ou expiré.");
  }
  throw new ResidualRequestError(402, "Le jeton n'a pas pu être déduit.");
}

function isMissingFunction(message: string): boolean {
  return /could not find the function|schema cache|PGRST202/i.test(message);
}

function isNoCredits(message: string): boolean {
  return /NO_CREDITS|insufficient/i.test(message);
}

function isJwtError(error: { message?: string; code?: string }): boolean {
  return /jwt|unauthor|invalid claim|PGRST301|401/i.test(`${error.code ?? ""} ${error.message ?? ""}`);
}

function readLegacyPayload(data: unknown): { ok: boolean; error: string | null } {
  let value = data;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value) as unknown;
    } catch {
      return { ok: false, error: null };
    }
  }
  if (Array.isArray(value)) value = value[0];
  if (!value || typeof value !== "object") return { ok: false, error: null };
  const row = value as Record<string, unknown>;
  return { ok: row.ok === true, error: typeof row.error === "string" ? row.error : null };
}

async function postResidual(
  action: "preview" | "export",
  params: ResidualLandValueInput,
  accessToken: string | null,
  signal?: AbortSignal,
): Promise<ResidualLandValueResult> {
  const key = readAnonKey();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: key,
  };
  headers.Authorization = action === "export" ? `Bearer ${accessToken ?? ""}` : `Bearer ${key}`;

  const response = await fetch(endpoint(), {
    method: "POST",
    headers,
    body: JSON.stringify({ action, params }),
    signal,
  });

  let payload: { success?: boolean; result?: ResidualLandValueResult; error?: string } | null = null;
  try {
    payload = (await response.json()) as { success?: boolean; result?: ResidualLandValueResult; error?: string };
  } catch {
    payload = null;
  }

  if (response.ok && payload?.success === true && payload.result) return payload.result;

  const message = payload?.error || "Le calcul n'a pas pu aboutir.";
  throw new ResidualRequestError(response.status, message);
}

function endpoint(): string {
  const base = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/$/, "");
  if (!base) {
    throw new ResidualRequestError(0, "Configuration Supabase incomplète : VITE_SUPABASE_URL est absente.");
  }
  return `${base}/functions/v1/calculate-residual`;
}

function readAnonKey(): string {
  const key =
    import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!key) {
    throw new ResidualRequestError(0, "Configuration Supabase incomplète : VITE_SUPABASE_ANON_KEY est absente.");
  }
  return key;
}

function messageFrom(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Le calcul n'a pas pu aboutir.";
}

function isAbort(reason: unknown): boolean {
  return reason instanceof DOMException && reason.name === "AbortError";
}
