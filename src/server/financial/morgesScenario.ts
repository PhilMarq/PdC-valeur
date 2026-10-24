/**
 * Scénario de travail validé à l'étape 1.
 * Hypothèse d'avant-projet pour un immeuble d'une vingtaine de logements
 * à Morges (VD), ordres de grandeur romands 2025-2026.
 */

import type {
  FinancialParameters,
  GeometricInputs,
  ResidualLandValueInput,
} from "./types.ts";

export const MORGES_GEOMETRY: GeometricInputs = {
  volumeSia416M3: 11_200,
  spdM2: 2_860,
  sreM2: 2_380,
  parcelAreaM2: 1_680,
  canton: "VD",
  zone: "habitation collective, secteur urbain",
};

/** Positions par défaut des curseurs. Les pourcentages sont en points (15 = 15 %). */
export const MORGES_CONTROLS = {
  exitPriceChfPerM2: 8_900,
  cfc2CostChfPerM3: 820,
  cfc1Percent: 2.5,
  cfc4Percent: 6,
  cfc5Percent: 22,
  developerMarginPercent: 15,
  landAcquisitionPercent: 3,
} as const;

export const MORGES_FINANCIALS: FinancialParameters = {
  exitPriceChfPerM2: MORGES_CONTROLS.exitPriceChfPerM2,
  exitSurfaceBasis: "sre",
  cfc2CostChfPerM3: MORGES_CONTROLS.cfc2CostChfPerM3,
  cfc1RateOnCfc2: MORGES_CONTROLS.cfc1Percent / 100,
  cfc4RateOnCfc2: MORGES_CONTROLS.cfc4Percent / 100,
  cfc5RateOnWorks: MORGES_CONTROLS.cfc5Percent / 100,
  developerMarginRateOnExit: MORGES_CONTROLS.developerMarginPercent / 100,
  landAcquisitionCostRate: MORGES_CONTROLS.landAcquisitionPercent / 100,
};

export const MORGES_SCENARIO: ResidualLandValueInput = {
  geometry: MORGES_GEOMETRY,
  financials: MORGES_FINANCIALS,
};

/**
 * Identité de la fiche et cadrage foncier du scénario de Morges.
 * La médiane et les quartiles sont un ordre de grandeur de travail pour
 * le comparatif de la fiche. Ils ne reproduisent pas un registre officiel.
 */
export interface ReportSite {
  locality: string;
  cadastralReference: string;
  cadastralSheet: string;
  benchmark: {
    areaLabel: string;
    medianChfPerParcelM2: number;
    lowerQuartileChfPerParcelM2: number;
    upperQuartileChfPerParcelM2: number;
    periodLabel: string;
  };
}

export const MORGES_REPORT_SITE: ReportSite = {
  locality: "Morges",
  cadastralReference: "4521",
  cadastralSheet: "7",
  benchmark: {
    areaLabel: "district de Morges (VD)",
    medianChfPerParcelM2: 2_280,
    lowerQuartileChfPerParcelM2: 1_450,
    upperQuartileChfPerParcelM2: 3_650,
    periodLabel: "cadrage 2024–2025",
  },
};
