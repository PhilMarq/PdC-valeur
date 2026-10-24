/**
 * Compte à rebours promoteur — valeur résiduelle du terrain.
 *
 *   chiffre d'affaires = surface (SPd ou SRE) × prix de sortie
 *   CFC 2              = volume SIA 416 × coût au m³
 *   CFC 1              = CFC 2 × taux CFC 1
 *   CFC 4              = CFC 2 × taux CFC 4
 *   CFC 5              = (CFC 1 + CFC 2 + CFC 4) × taux CFC 5
 *   marge              = chiffre d'affaires × taux de marge
 *   valeur résiduelle  = chiffre d'affaires − CFC 1 − CFC 2 − CFC 4 − CFC 5 − marge
 *   prix d'achat max.  = valeur résiduelle / (1 + frais d'acquisition)
 *
 * Les lignes du compte sont arrondies au franc. La valeur résiduelle, puis les
 * frais d'acquisition, sont les postes d'ajustement : le total retrouve le
 * chiffre d'affaires.
 * Le volume et les surfaces sont des entrées déjà extraites de la scène.
 */

import {
  EXIT_SURFACE_BASES,
  SWISS_CANTONS,
  type ExitSurfaceBasis,
  type FinancialWarning,
  type ResidualLandValueInput,
  type ResidualLandValueResult,
  type SwissCanton,
} from "./types.ts";

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

export class FinancialInputError extends Error {
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

export function calculateResidualLandValue(
  input: ResidualLandValueInput,
): ResidualLandValueResult {
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

  const exitSurfaceM2 =
    financials.exitSurfaceBasis === "spd" ? geometry.spdM2 : geometry.sreM2;
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

  const breakEvenExitValueChf =
    totalExcludingLandChf / (1 - financials.developerMarginRateOnExit);
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
    residualLandValueChfPerParcelM2:
      residualLandValueChf / geometry.parcelAreaM2,
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

  if (
    values.residualLandValueChf > 0 &&
    values.residualToExitRatio > HIGH_RESIDUAL_SHARE
  ) {
    warnings.push({
      code: "land_share_high",
      message:
        "La charge foncière dépasse 45 % du chiffre d'affaires. Contrôlez le coût CFC 2 et le prix de sortie : une part aussi haute est rare hors des marchés les plus tendus.",
    });
  }

  if (
    values.residualLandValueChf >= 0 &&
    values.constructionCostToExitRatio > HIGH_COST_SHARE
  ) {
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
    throw new FinancialInputError(
      "La base du prix de sortie doit être « spd » ou « sre ».",
    );
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

function assertRate(
  name: string,
  value: number,
  options?: { exclusiveMax?: boolean },
): void {
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
