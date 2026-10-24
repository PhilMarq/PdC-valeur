/**
 * Contrats du moteur de valeur résiduelle.
 *
 * Les grandeurs géométriques (volume SIA 416, SPd, SRE, parcelle) sont des
 * entrées déjà extraites. Ce module ne lit aucune scène 3D et ne dépend
 * d'aucun moteur de rendu.
 *
 * Les taux sont des fractions : 0.15 représente 15 %.
 */

export const SWISS_CANTONS = [
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

export type SwissCanton = (typeof SWISS_CANTONS)[number];

/** Surface à laquelle s'applique le prix de sortie. */
export const EXIT_SURFACE_BASES = ["spd", "sre"] as const;

export type ExitSurfaceBasis = (typeof EXIT_SURFACE_BASES)[number];

/**
 * Données géométriques et de contexte réglementaire.
 * Le canton et la zone qualifient l'étude. Ils ne sélectionnent aucun barème
 * caché : les prix et les taux restent des hypothèses explicites.
 */
export interface GeometricInputs {
  /** Volume du bâtiment selon SIA 416, en m³. */
  volumeSia416M3: number;
  /** Surface de plancher déterminante, en m². */
  spdM2: number;
  /** Surface de référence énergétique (SIA 380/1), en m². */
  sreM2: number;
  /** Surface de la parcelle, en m². */
  parcelAreaM2: number;
  canton: SwissCanton;
  /** Affectation communale, par exemple « habitation collective ». */
  zone: string;
}

/**
 * Hypothèses financières ajustables d'une étude de faisabilité.
 *
 * CFC 1 et CFC 4 sont exprimés en fraction du CFC 2.
 * CFC 5 est exprimé en fraction de l'ensemble des travaux (CFC 1 + 2 + 4),
 * convention d'avant-projet : le taux forfaitaire couvre honoraires,
 * assurances, intérêts intercalaires et commercialisation.
 * La marge promoteur est une fraction du chiffre d'affaires.
 */
export interface FinancialParameters {
  /** Prix de sortie estimé, en CHF par m² de la surface de référence choisie. */
  exitPriceChfPerM2: number;
  exitSurfaceBasis: ExitSurfaceBasis;
  /** Coût de construction CFC 2, en CHF par m³ SIA 416. */
  cfc2CostChfPerM3: number;
  /** CFC 1 — travaux préparatoires, fraction du CFC 2. */
  cfc1RateOnCfc2: number;
  /** CFC 4 — aménagements extérieurs, fraction du CFC 2. */
  cfc4RateOnCfc2: number;
  /** CFC 5 — frais secondaires, fraction de (CFC 1 + CFC 2 + CFC 4). */
  cfc5RateOnWorks: number;
  /** Marge promoteur visée, fraction du chiffre d'affaires. */
  developerMarginRateOnExit: number;
  /**
   * Frais d'acquisition du terrain (droit de mutation, notaire, registre
   * foncier), fraction du prix d'achat. Mettre 0 pour obtenir la charge
   * foncière brute, sans décote.
   */
  landAcquisitionCostRate: number;
}

export interface ResidualLandValueInput {
  geometry: GeometricInputs;
  financials: FinancialParameters;
}

export interface CfcCostBreakdown {
  /** CFC 1 — travaux préparatoires. */
  cfc1Chf: number;
  /** CFC 2 — bâtiment. */
  cfc2Chf: number;
  /** CFC 4 — aménagements extérieurs. */
  cfc4Chf: number;
  /** CFC 5 — frais secondaires. */
  cfc5Chf: number;
  /**
   * Somme CFC 1 + 2 + 4 + 5.
   * Le CFC 0 (terrain) est le résultat du compte à rebours, pas un coût saisi.
   */
  totalExcludingLandChf: number;
}

export interface ResidualMetrics {
  /** SPd / surface de parcelle. */
  utilizationIndex: number;
  /** Volume SIA 416 / SPd, en mètres. */
  volumePerSpdM: number;
  /** SRE / SPd. */
  sreToSpdRatio: number;
  /** Valeur résiduelle / chiffre d'affaires. */
  residualToExitRatio: number;
  /** Coûts CFC 1+2+4+5 / chiffre d'affaires. */
  constructionCostToExitRatio: number;
}

export type FinancialWarningCode =
  | "negative_residual"
  | "sre_exceeds_spd"
  | "unusual_volume_ratio"
  | "unusual_utilization"
  | "land_share_high"
  | "cost_share_high";

export interface FinancialWarning {
  code: FinancialWarningCode;
  message: string;
}

export interface ResidualLandValueResult {
  exitSurfaceBasis: ExitSurfaceBasis;
  /** Surface retenue pour le prix de sortie, en m². */
  exitSurfaceM2: number;
  /** Chiffre d'affaires potentiel (valeur de sortie). */
  exitValueChf: number;
  costs: CfcCostBreakdown;
  developerMarginChf: number;
  /**
   * Valeur résiduelle du terrain, ou charge foncière admissible.
   * Chiffre d'affaires − coûts CFC 1/2/4/5 − marge.
   * Ce montant doit couvrir le prix d'achat et les frais d'acquisition.
   * Une valeur négative est un déficit de l'opération.
   */
  residualLandValueChf: number;
  residualLandValueChfPerParcelM2: number;
  /**
   * Prix maximum payable au vendeur.
   * Valeur résiduelle / (1 + taux de frais d'acquisition).
   */
  maxPurchasePriceChf: number;
  maxPurchasePriceChfPerParcelM2: number;
  landAcquisitionCostsChf: number;
  /**
   * Prix de sortie, en CHF/m², qui annule la valeur résiduelle
   * sans changer la marge ni les coûts.
   */
  breakEvenExitPriceChfPerM2: number;
  metrics: ResidualMetrics;
  warnings: readonly FinancialWarning[];
}
