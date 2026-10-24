/**
 * Démonstration exécutable du compte à rebours.
 *
 *   node --experimental-strip-types src/server/financial/demo.ts
 *
 * Le scénario est une hypothèse de travail pour une faisabilité en Romandie
 * (ordres de grandeur 2025-2026). Ce n'est pas une estimation officielle.
 */

import { MORGES_SCENARIO as scenario } from "./morgesScenario.ts";
import {
  calculateResidualLandValue,
  FinancialInputError,
  percent,
} from "./residualCalculator.ts";
import type {
  ResidualLandValueInput,
  ResidualLandValueResult,
} from "./types.ts";

const chf = new Intl.NumberFormat("fr-CH", {
  style: "currency",
  currency: "CHF",
  maximumFractionDigits: 0,
});

const integer = new Intl.NumberFormat("fr-CH", {
  maximumFractionDigits: 0,
});

const number = new Intl.NumberFormat("fr-CH", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

const share = new Intl.NumberFormat("fr-CH", {
  style: "percent",
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

const rate = new Intl.NumberFormat("fr-CH", {
  style: "percent",
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

function assertClose(actual: number, expected: number, label: string): void {
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > 0.01) {
    throw new Error(`${label} : obtenu ${actual}, attendu ${expected}.`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

/**
 * Cas chiffré à la main, pour verrouiller la formule indépendamment du scénario.
 * SRE 250 m² × 10 000 CHF = 2 500 000 CHF.
 * CFC 2 = 800 000 ; CFC 1 = 16 000 ; CFC 4 = 40 000 ; CFC 5 = 171 200.
 * Marge 15 % = 375 000. Valeur résiduelle = 1 097 800.
 * Prix d'achat max = arrondi de 1 097 800 / 1.03 = 1 065 825.
 * Frais d'acquisition = solde, 31 975, pour que les deux postes égalent la valeur résiduelle.
 */
function verifyReferenceCase(): void {
  const result = calculateResidualLandValue({
    geometry: {
      volumeSia416M3: 1_000,
      spdM2: 300,
      sreM2: 250,
      parcelAreaM2: 500,
      canton: "VD",
      zone: "cas de référence",
    },
    financials: {
      exitPriceChfPerM2: 10_000,
      exitSurfaceBasis: "sre",
      cfc2CostChfPerM3: 800,
      cfc1RateOnCfc2: 0.02,
      cfc4RateOnCfc2: 0.05,
      cfc5RateOnWorks: 0.2,
      developerMarginRateOnExit: 0.15,
      landAcquisitionCostRate: 0.03,
    },
  });

  assertClose(result.exitValueChf, 2_500_000, "Chiffre d'affaires");
  assertClose(result.costs.cfc2Chf, 800_000, "CFC 2");
  assertClose(result.costs.cfc1Chf, 16_000, "CFC 1");
  assertClose(result.costs.cfc4Chf, 40_000, "CFC 4");
  assertClose(result.costs.cfc5Chf, 171_200, "CFC 5");
  assertClose(result.costs.totalExcludingLandChf, 1_027_200, "Coûts hors terrain");
  assertClose(result.developerMarginChf, 375_000, "Marge");
  assertClose(result.residualLandValueChf, 1_097_800, "Valeur résiduelle");
  assertClose(result.maxPurchasePriceChf, 1_065_825, "Prix d'achat maximum");
  assertClose(result.landAcquisitionCostsChf, 31_975, "Frais d'acquisition");
  assertClose(result.residualLandValueChfPerParcelM2, 1_097_800 / 500, "CHF/m² résiduel");
  assertClose(
    result.exitValueChf -
      result.costs.totalExcludingLandChf -
      result.developerMarginChf -
      result.maxPurchasePriceChf -
      result.landAcquisitionCostsChf,
    0,
    "Identité comptable",
  );
  assert(result.warnings.length === 0, "Le cas de référence ne doit pas lever d'alerte.");

  const deficit = calculateResidualLandValue({
    geometry: {
      volumeSia416M3: 1_000,
      spdM2: 300,
      sreM2: 250,
      parcelAreaM2: 500,
      canton: "GE",
      zone: "cas déficitaire",
    },
    financials: {
      exitPriceChfPerM2: 1_000,
      exitSurfaceBasis: "sre",
      cfc2CostChfPerM3: 800,
      cfc1RateOnCfc2: 0.02,
      cfc4RateOnCfc2: 0.05,
      cfc5RateOnWorks: 0.2,
      developerMarginRateOnExit: 0.15,
      landAcquisitionCostRate: 0.03,
    },
  });
  assertClose(deficit.residualLandValueChf, -814_700, "Déficit");
  assert(
    deficit.warnings.some((warning) => warning.code === "negative_residual"),
    "Un déficit doit produire l'alerte negative_residual.",
  );

  let rejected = false;
  try {
    calculateResidualLandValue({
      geometry: {
        volumeSia416M3: 1_000,
        spdM2: 300,
        sreM2: 250,
        parcelAreaM2: 500,
        canton: "VD",
        zone: "taux invalide",
      },
      financials: {
        exitPriceChfPerM2: 10_000,
        exitSurfaceBasis: "sre",
        cfc2CostChfPerM3: 800,
        cfc1RateOnCfc2: 2.5,
        cfc4RateOnCfc2: 0,
        cfc5RateOnWorks: 0,
        developerMarginRateOnExit: 0.15,
        landAcquisitionCostRate: 0,
      },
    });
  } catch (error) {
    rejected = error instanceof FinancialInputError;
  }
  assert(rejected, "Un taux saisi en points (2.5 au lieu de 0.025) doit être refusé.");
}

function formatRate(value: number): string {
  return rate.format(value).replace("%", " %");
}

function field(label: string, value: string): void {
  console.log(`  ${label.padEnd(24, " ")}${value}`);
}

function row(label: string, amount: number, partOfExit: number): void {
  const name = label.padEnd(44, " ");
  const money = chf.format(amount).padStart(16, " ");
  const part = share.format(partOfExit).padStart(8, " ");
  console.log(`  ${name}${money}${part}`);
}

function printScenario(input: ResidualLandValueInput, result: ResidualLandValueResult): void {
  const { geometry, financials } = input;
  const exit = result.exitValueChf;
  const surfaceLabel = result.exitSurfaceBasis === "sre" ? "SRE" : "SPd";

  console.log("");
  console.log("Module d'évaluation financière — valeur résiduelle du terrain");
  console.log("Scénario : immeuble de logements collectifs, Morges (VD)");
  console.log("Ordre de grandeur : une vingtaine de logements, faisabilité d'avant-projet.");
  console.log("");
  console.log("Entrées géométriques");
  field("Volume SIA 416", `${integer.format(geometry.volumeSia416M3)} m³`);
  field("SPd", `${integer.format(geometry.spdM2)} m²`);
  field("SRE", `${integer.format(geometry.sreM2)} m²`);
  field("Parcelle", `${integer.format(geometry.parcelAreaM2)} m²`);
  field("Indice d'utilisation", number.format(result.metrics.utilizationIndex));
  field("Volume / SPd", `${number.format(result.metrics.volumePerSpdM)} m`);
  field("SRE / SPd", number.format(result.metrics.sreToSpdRatio));
  field("Canton et zone", `${geometry.canton} — ${geometry.zone}`);
  console.log("");
  console.log("Hypothèses");
  field("Prix de sortie", `${chf.format(financials.exitPriceChfPerM2)}/m² ${surfaceLabel}`);
  field("CFC 2", `${chf.format(financials.cfc2CostChfPerM3)}/m³ SIA 416`);
  field("CFC 1", `${formatRate(financials.cfc1RateOnCfc2)} du CFC 2`);
  field("CFC 4", `${formatRate(financials.cfc4RateOnCfc2)} du CFC 2`);
  field("CFC 5", `${formatRate(financials.cfc5RateOnWorks)} de CFC 1 + 2 + 4`);
  field("Marge promoteur", `${formatRate(financials.developerMarginRateOnExit)} du chiffre d'affaires`);
  field("Frais d'acquisition", `${formatRate(financials.landAcquisitionCostRate)} du prix d'achat`);
  console.log("");
  console.log("Compte à rebours");
  console.log(`${"".padEnd(46, " ")}${"Montant".padStart(16, " ")}${"Part".padStart(8, " ")}`);
  row("Chiffre d'affaires potentiel", result.exitValueChf, 1);
  row("CFC 1 — Travaux préparatoires", result.costs.cfc1Chf, result.costs.cfc1Chf / exit);
  row("CFC 2 — Bâtiment", result.costs.cfc2Chf, result.costs.cfc2Chf / exit);
  row("CFC 4 — Aménagements extérieurs", result.costs.cfc4Chf, result.costs.cfc4Chf / exit);
  row("CFC 5 — Frais secondaires", result.costs.cfc5Chf, result.costs.cfc5Chf / exit);
  row("Marge promoteur", result.developerMarginChf, result.developerMarginChf / exit);
  row("Valeur résiduelle du terrain", result.residualLandValueChf, result.residualLandValueChf / exit);
  row("  dont frais d'acquisition", result.landAcquisitionCostsChf, result.landAcquisitionCostsChf / exit);
  row("  prix maximum d'achat", result.maxPurchasePriceChf, result.maxPurchasePriceChf / exit);
  console.log("");
  console.log(
    `  Valeur résiduelle        ${chf.format(result.residualLandValueChfPerParcelM2)}/m² de terrain`,
  );
  console.log(
    `  Prix maximum d'achat     ${chf.format(result.maxPurchasePriceChfPerParcelM2)}/m² de terrain`,
  );
  console.log(
    `  Seuil de prix de sortie  ${chf.format(result.breakEvenExitPriceChfPerM2)}/m² ${surfaceLabel} (valeur résiduelle nulle)`,
  );

  if (result.warnings.length > 0) {
    console.log("");
    console.log("Points de contrôle");
    for (const warning of result.warnings) {
      console.log(`  - ${warning.message}`);
    }
  }
}

function printSensitivity(input: ResidualLandValueInput): void {
  console.log("");
  console.log("Sensibilité — marge promoteur, prix de sortie inchangé à 8 900 CHF/m² SRE");
  console.log("  Marge     Prix maximum d'achat     CHF/m² de terrain");
  for (const marginPoints of [12, 15, 18]) {
    const result = calculateResidualLandValue({
      ...input,
      financials: {
        ...input.financials,
        developerMarginRateOnExit: percent(marginPoints),
      },
    });
    const marginLabel = formatRate(percent(marginPoints)).padEnd(8, " ");
    const price = chf.format(result.maxPurchasePriceChf).padStart(22, " ");
    const perM2 = `${chf.format(result.maxPurchasePriceChfPerParcelM2)}/m²`.padStart(20, " ");
    console.log(`  ${marginLabel}${price}${perM2}`);
  }

  console.log("");
  console.log("Sensibilité — prix de sortie, marge inchangée à 15 %");
  console.log("  CHF/m² SRE   Prix maximum d'achat     CHF/m² de terrain");
  for (const exitPrice of [6_000, 8_900, 11_000]) {
    const result = calculateResidualLandValue({
      ...input,
      financials: { ...input.financials, exitPriceChfPerM2: exitPrice },
    });
    const priceLabel = chf.format(exitPrice).padEnd(14, " ");
    const price = chf.format(result.maxPurchasePriceChf).padStart(22, " ");
    const perM2 = `${chf.format(result.maxPurchasePriceChfPerParcelM2)}/m²`.padStart(20, " ");
    console.log(`  ${priceLabel}${price}${perM2}`);
  }
}

function verifyScenarioIdentity(result: ResidualLandValueResult): void {
  const gap =
    result.exitValueChf -
    result.costs.totalExcludingLandChf -
    result.developerMarginChf -
    result.maxPurchasePriceChf -
    result.landAcquisitionCostsChf;
  assertClose(gap, 0, "Identité du scénario Morges");
}

verifyReferenceCase();
const result = calculateResidualLandValue(scenario);
verifyScenarioIdentity(result);
printScenario(scenario, result);
printSensitivity(scenario);
console.log("");
console.log("Contrôles du cas de référence et du scénario : OK");
console.log("");
