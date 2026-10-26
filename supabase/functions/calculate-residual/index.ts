/**
 * Compte à rebours promoteur — Edge Function.
 *
 * POST { action: "preview" | "export", params }
 *   preview : calcul en mémoire, aucun accès base.
 *   export  : Bearer requis, puis RPC deduct_credit. Le résultat n'est
 *             renvoyé qu'une fois le crédit validé.
 *
 * Les taux sont des fractions : 0.15 représente 15 %.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const SWISS_CANTONS = [
  "AG",
  "AI",
  "AR",
  "BE",
  "BL",
  "BS",
  "FR",
  "GE",
  "GL",
  "GR",
  "JU",
  "LU",
  "NE",
  "NW",
  "OW",
  "SG",
  "SH",
  "SO",
  "SZ",
  "TG",
  "TI",
  "UR",
  "VD",
  "VS",
  "ZG",
  "ZH",
] as const;

type SwissCanton = (typeof SWISS_CANTONS)[number];

const EXIT_SURFACE_BASES = ["spd", "sre"] as const;

type ExitSurfaceBasis = (typeof EXIT_SURFACE_BASES)[number];

interface GeometricInputs {
  volumeSia416M3: number;
  spdM2: number;
  sreM2: number;
  parcelAreaM2: number;
  canton: SwissCanton;
  zone: string;
}

interface FinancialParameters {
  exitPriceChfPerM2: number;
  exitSurfaceBasis: ExitSurfaceBasis;
  cfc2CostChfPerM3: number;
  cfc1RateOnCfc2: number;
  cfc4RateOnCfc2: number;
  cfc5RateOnWorks: number;
  developerMarginRateOnExit: number;
  landAcquisitionCostRate: number;
}

interface ResidualLandValueInput {
  geometry: GeometricInputs;
  financials: FinancialParameters;
}

interface CfcCostBreakdown {
  cfc1Chf: number;
  cfc2Chf: number;
  cfc4Chf: number;
  cfc5Chf: number;
  totalExcludingLandChf: number;
}

interface ResidualMetrics {
  utilizationIndex: number;
  volumePerSpdM: number;
  sreToSpdRatio: number;
  residualToExitRatio: number;
  constructionCostToExitRatio: number;
}

type FinancialWarningCode =
  | "negative_residual"
  | "sre_exceeds_spd"
  | "unusual_volume_ratio"
  | "unusual_utilization"
  | "land_share_high"
  | "cost_share_high";

interface FinancialWarning {
  code: FinancialWarningCode;
  message: string;
}

interface ResidualLandValueResult {
  exitSurfaceBasis: ExitSurfaceBasis;
  exitSurfaceM2: number;
  exitValueChf: number;
  costs: CfcCostBreakdown;
  developerMarginChf: number;
  residualLandValueChf: number;
  residualLandValueChfPerParcelM2: number;
  maxPurchasePriceChf: number;
  maxPurchasePriceChfPerParcelM2: number;
  landAcquisitionCostsChf: number;
  breakEvenExitPriceChfPerM2: number;
  metrics: ResidualMetrics;
  warnings: readonly FinancialWarning[];
}

const VOLUME_PER_SPD_RANGE = { min: 2.4, max: 6.5 };
const UTILIZATION_INDEX_RANGE = { min: 0.2, max: 4 };
const HIGH_RESIDUAL_SHARE = 0.45;
const HIGH_COST_SHARE = 0.8;

const CANTONS = new Set<string>(SWISS_CANTONS);
const SURFACE_BASES = new Set<string>(EXIT_SURFACE_BASES);

const decimal = new Intl.NumberFormat("fr-CH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

class FinancialInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FinancialInputError";
  }
}

/** Convertit un pourcentage saisi par un utilisateur (15) en fraction (0.15). */
export function percent(points: number): number {
  if (!Number.isFinite(points)) {
    throw new FinancialInputError("Un pourcentage doit être un nombre fini.");
  }
  return points / 100;
}

/**
 * chiffre d'affaires = surface (SPd ou SRE) × prix de sortie
 * CFC 2              = volume SIA 416 × coût au m³
 * CFC 1              = CFC 2 × taux CFC 1
 * CFC 4              = CFC 2 × taux CFC 4
 * CFC 5              = (CFC 1 + CFC 2 + CFC 4) × taux CFC 5
 * marge              = chiffre d'affaires × taux de marge
 * valeur résiduelle  = chiffre d'affaires − CFC 1 − CFC 2 − CFC 4 − CFC 5 − marge
 * prix d'achat max.  = valeur résiduelle / (1 + frais d'acquisition)
 */
export function calculateResidualLandValue(input: ResidualLandValueInput): ResidualLandValueResult {
  assertInputShape(input);
  const { geometry, financials } = input;

  assertCanton(geometry.canton);
  assertZone(geometry.zone);
  assertPositive("Volume SIA 416 (m³)", geometry.volumeSia416M3);
  assertPositive("SPd (m²)", geometry.spdM2);
  assertPositive("SRE (m²)", geometry.sreM2);
  assertPositive("Surface de parcelle (m²)", geometry.parcelAreaM2);
  assertSurfaceBasis(financials.exitSurfaceBasis);
  assertPositive("Prix de sortie (CHF/m²)", financials.exitPriceChfPerM2);
  assertPositive("Coût CFC 2 (CHF/m³)", financials.cfc2CostChfPerM3);
  assertRate("Taux CFC 1", financials.cfc1RateOnCfc2);
  assertRate("Taux CFC 4", financials.cfc4RateOnCfc2);
  assertRate("Taux CFC 5", financials.cfc5RateOnWorks);
  assertRate("Marge promoteur", financials.developerMarginRateOnExit, {
    exclusiveMax: true,
  });
  assertRate("Frais d'acquisition du terrain", financials.landAcquisitionCostRate);

  const exitSurfaceM2 = financials.exitSurfaceBasis === "spd" ? geometry.spdM2 : geometry.sreM2;
  const exitValueChf = roundChf(exitSurfaceM2 * financials.exitPriceChfPerM2);

  const cfc2Chf = roundChf(geometry.volumeSia416M3 * financials.cfc2CostChfPerM3);
  const cfc1Chf = roundChf(cfc2Chf * financials.cfc1RateOnCfc2);
  const cfc4Chf = roundChf(cfc2Chf * financials.cfc4RateOnCfc2);
  const cfc5Chf = roundChf((cfc1Chf + cfc2Chf + cfc4Chf) * financials.cfc5RateOnWorks);
  const totalExcludingLandChf = cfc1Chf + cfc2Chf + cfc4Chf + cfc5Chf;

  const developerMarginChf = roundChf(exitValueChf * financials.developerMarginRateOnExit);
  const residualLandValueChf = exitValueChf - totalExcludingLandChf - developerMarginChf;

  const maxPurchasePriceChf = roundChf(
    residualLandValueChf / (1 + financials.landAcquisitionCostRate),
  );
  const landAcquisitionCostsChf = residualLandValueChf - maxPurchasePriceChf;

  const utilizationIndex = geometry.spdM2 / geometry.parcelAreaM2;
  const volumePerSpdM = geometry.volumeSia416M3 / geometry.spdM2;
  const sreToSpdRatio = geometry.sreM2 / geometry.spdM2;
  const residualToExitRatio = residualLandValueChf / exitValueChf;
  const constructionCostToExitRatio = totalExcludingLandChf / exitValueChf;

  const breakEvenExitValueChf = totalExcludingLandChf / (1 - financials.developerMarginRateOnExit);
  const breakEvenExitPriceChfPerM2 = breakEvenExitValueChf / exitSurfaceM2;

  return {
    exitSurfaceBasis: financials.exitSurfaceBasis,
    exitSurfaceM2,
    exitValueChf,
    costs: {
      cfc1Chf,
      cfc2Chf,
      cfc4Chf,
      cfc5Chf,
      totalExcludingLandChf,
    },
    developerMarginChf,
    residualLandValueChf,
    residualLandValueChfPerParcelM2: residualLandValueChf / geometry.parcelAreaM2,
    maxPurchasePriceChf,
    maxPurchasePriceChfPerParcelM2: maxPurchasePriceChf / geometry.parcelAreaM2,
    landAcquisitionCostsChf,
    breakEvenExitPriceChfPerM2,
    metrics: {
      utilizationIndex,
      volumePerSpdM,
      sreToSpdRatio,
      residualToExitRatio,
      constructionCostToExitRatio,
    },
    warnings: collectWarnings({
      sreM2: geometry.sreM2,
      spdM2: geometry.spdM2,
      utilizationIndex,
      volumePerSpdM,
      residualLandValueChf,
      residualToExitRatio,
      constructionCostToExitRatio,
    }),
  };
}

function collectWarnings(values: {
  sreM2: number;
  spdM2: number;
  utilizationIndex: number;
  volumePerSpdM: number;
  residualLandValueChf: number;
  residualToExitRatio: number;
  constructionCostToExitRatio: number;
}): FinancialWarning[] {
  const warnings: FinancialWarning[] = [];

  if (values.residualLandValueChf < 0) {
    warnings.push({
      code: "negative_residual",
      message:
        "Le compte à rebours est déficitaire : ces hypothèses ne dégagent aucune valeur pour le terrain. Le prix de sortie, le coût CFC 2 ou la marge doivent être revus.",
    });
  }

  if (values.sreM2 > values.spdM2) {
    warnings.push({
      code: "sre_exceeds_spd",
      message:
        "La SRE dépasse la SPd. Pour du logement, la surface chauffée est en général inférieure à la surface de plancher déterminante.",
    });
  }

  if (
    values.volumePerSpdM < VOLUME_PER_SPD_RANGE.min ||
    values.volumePerSpdM > VOLUME_PER_SPD_RANGE.max
  ) {
    warnings.push({
      code: "unusual_volume_ratio",
      message: `Le ratio volume SIA 416 / SPd est de ${decimal.format(values.volumePerSpdM)} m. Une opération de logement se situe le plus souvent entre ${decimal.format(VOLUME_PER_SPD_RANGE.min)} et ${decimal.format(VOLUME_PER_SPD_RANGE.max)} m, sous-sol et toiture inclus.`,
    });
  }

  if (
    values.utilizationIndex < UTILIZATION_INDEX_RANGE.min ||
    values.utilizationIndex > UTILIZATION_INDEX_RANGE.max
  ) {
    warnings.push({
      code: "unusual_utilization",
      message: `L'indice d'utilisation (SPd / parcelle) est de ${decimal.format(values.utilizationIndex)}. Contrôlez la surface de parcelle et la SPd.`,
    });
  }

  if (values.residualLandValueChf > 0 && values.residualToExitRatio > HIGH_RESIDUAL_SHARE) {
    warnings.push({
      code: "land_share_high",
      message:
        "La charge foncière dépasse 45 % du chiffre d'affaires. Contrôlez le coût CFC 2 et le prix de sortie : une part aussi haute est rare hors des marchés les plus tendus.",
    });
  }

  if (values.residualLandValueChf >= 0 && values.constructionCostToExitRatio > HIGH_COST_SHARE) {
    warnings.push({
      code: "cost_share_high",
      message:
        "Les coûts CFC 1, 2, 4 et 5 dépassent 80 % du chiffre d'affaires. La marge et le terrain sont alors très contraints.",
    });
  }

  return warnings;
}

function assertInputShape(input: ResidualLandValueInput): void {
  if (!input?.geometry || !input.financials) {
    throw new FinancialInputError(
      "Les entrées géométriques et les paramètres financiers sont requis.",
    );
  }
}

function assertCanton(value: string): asserts value is SwissCanton {
  if (!CANTONS.has(value)) {
    throw new FinancialInputError(
      `Canton « ${value} » inconnu. Utilisez le code officiel à deux lettres, par exemple VD, GE ou ZH.`,
    );
  }
}

function assertZone(value: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new FinancialInputError("La zone d'affectation est requise.");
  }
}

function assertSurfaceBasis(value: string): asserts value is ExitSurfaceBasis {
  if (!SURFACE_BASES.has(value)) {
    throw new FinancialInputError("La base du prix de sortie doit être « spd » ou « sre ».");
  }
}

function assertPositive(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new FinancialInputError(`${name} doit être un nombre fini strictement positif.`);
  }
}

/** Arrondi commercial au franc : les moitiés s'éloignent de zéro. */
function roundChf(value: number): number {
  if (!Number.isFinite(value)) {
    throw new FinancialInputError("Un montant calculé n'est pas un nombre fini.");
  }
  return Math.sign(value) * Math.round(Math.abs(value));
}

function assertRate(name: string, value: number, options?: { exclusiveMax?: boolean }): void {
  const withinMax = options?.exclusiveMax ? value < 1 : value <= 1;
  if (!Number.isFinite(value) || value < 0 || !withinMax) {
    const asPercent =
      Number.isFinite(value) && value > 1 && value <= 100
        ? ` Pour ${value} %, passez ${value / 100} ou percent(${value}).`
        : "";
    const upper = options?.exclusiveMax ? "1 exclu" : "1 inclus";
    throw new FinancialInputError(
      `${name} doit être une fraction comprise entre 0 et ${upper}.${asPercent}`,
    );
  }
}

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type CreditOutcome =
  | { ok: true }
  | { ok: false; status: 401 | 402 | 500; error: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ success: false, error: "Méthode non autorisée." }, 405);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "Corps JSON invalide." }, 400);
  }

  const parsed = readBody(body);
  if (!parsed.ok) return json({ success: false, error: parsed.error }, 400);

  if (parsed.action === "export") {
    const authorization = readAuthorization(req);
    if (!authorization) {
      return json({ success: false, error: "Jeton d'accès requis." }, 401);
    }

    let result: ResidualLandValueResult;
    try {
      result = calculateResidualLandValue(parsed.params);
    } catch (error) {
      return calculationError(error);
    }

    const credit = await deductCredit(authorization);
    if (!credit.ok) return json({ success: false, error: credit.error }, credit.status);
    return json({ success: true, result, creditDeducted: true });
  }

  try {
    const result = calculateResidualLandValue(parsed.params);
    return json({ success: true, result });
  } catch (error) {
    return calculationError(error);
  }
});

function readBody(
  body: unknown,
): { ok: true; action: "preview" | "export"; params: ResidualLandValueInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Corps JSON invalide." };
  const record = body as Record<string, unknown>;
  if (record.action !== "preview" && record.action !== "export") {
    return { ok: false, error: "Action attendue : preview ou export." };
  }
  return { ok: true, action: record.action, params: record.params as ResidualLandValueInput };
}

function readAuthorization(req: Request): string | null {
  const header = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  if (!match) return null;
  const token = match[1];
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) return null;
  return `Bearer ${token}`;
}

async function deductCredit(authorization: string): Promise<CreditOutcome> {
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anonKey) {
    return { ok: false, status: 500, error: "Configuration Supabase incomplète." };
  }

  const token = authorization.replace(/^Bearer\s+/i, "");
  const supabase = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    accessToken: async () => token,
  });

  const consumed = await supabase.rpc("consume_credit");
  if (!consumed.error && typeof consumed.data === "number") return { ok: true };
  if (consumed.error && /NO_CREDITS|insufficient/i.test(consumed.error.message)) {
    return { ok: false, status: 402, error: "Solde de jetons insuffisant." };
  }
  if (consumed.error && /jwt|unauthor|invalid claim|PGRST301|401/i.test(`${consumed.error.code ?? ""} ${consumed.error.message ?? ""}`)) {
    return { ok: false, status: 401, error: "Jeton de session invalide ou expiré." };
  }
  if (consumed.error && !/could not find the function|schema cache|PGRST202/i.test(consumed.error.message)) {
    return { ok: false, status: 402, error: "Le jeton n'a pas pu être déduit." };
  }

  const { data, error } = await supabase.rpc("deduct_credit");
  if (error) {
    const text = `${error.code ?? ""} ${error.message ?? ""}`;
    if (/jwt|unauthor|invalid claim|PGRST301|401/i.test(text)) {
      return { ok: false, status: 401, error: "Jeton de session invalide ou expiré." };
    }
    if (/NO_CREDITS|insufficient/i.test(text)) {
      return { ok: false, status: 402, error: "Solde de jetons insuffisant." };
    }
    return { ok: false, status: 402, error: "Le jeton n'a pas pu être déduit." };
  }

  const payload = readPayload(data);
  if (payload.ok) return { ok: true };
  if (payload.error === "unauthenticated") {
    return {
      ok: false,
      status: 401,
      error: "Session Supabase absente : le Studio doit transmettre le jeton de connexion.",
    };
  }
  if (payload.error === "insufficient") {
    return { ok: false, status: 402, error: "Solde de jetons insuffisant." };
  }
  return { ok: false, status: 402, error: "Le jeton n'a pas pu être déduit." };
}

function readPayload(data: unknown): { ok: boolean; error: string | null } {
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
  const error = typeof row.error === "string" ? row.error : null;
  return { ok: row.ok === true, error };
}

function calculationError(error: unknown): Response {
  if (error instanceof FinancialInputError) {
    return json({ success: false, error: error.message }, 400);
  }
  return json({ success: false, error: "Le calcul n'a pas pu aboutir." }, 500);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
