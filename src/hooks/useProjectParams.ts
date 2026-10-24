import { useMemo } from "react";
import {
  MORGES_GEOMETRY,
  MORGES_REPORT_SITE,
  type ReportSite,
} from "../server/financial/morgesScenario.ts";
import {
  SWISS_CANTONS,
  type GeometricInputs,
  type SwissCanton,
} from "../server/financial/types.ts";

const PARAM_KEYS = [
  "sre",
  "spd",
  "sia",
  "volume",
  "parcel",
  "terrain",
  "canton",
  "commune",
  "parcelle",
] as const;

const CANTONS = new Set<string>(SWISS_CANTONS);

export interface ProjectParams {
  geometry: GeometricInputs;
  site: ReportSite;
  /** Au moins un paramètre de scénario est présent dans l'URL. */
  syncedFromStudio: boolean;
}

export function useProjectParams(search?: string): ProjectParams {
  const query = search ?? (typeof window === "undefined" ? "" : window.location.search);
  return useMemo(() => readProjectParams(query), [query]);
}

/** Lit un scénario de parcelle. Chaque champ absent ou invalide reprend Morges. */
export function readProjectParams(search: string): ProjectParams {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const parcelNumber = readLabel(params.get("parcelle"));

  const geometry: GeometricInputs = {
    sreM2: readPositive(params.get("sre")) ?? MORGES_GEOMETRY.sreM2,
    spdM2: readPositive(params.get("spd")) ?? MORGES_GEOMETRY.spdM2,
    volumeSia416M3:
      readPositive(params.get("sia")) ??
      readPositive(params.get("volume")) ??
      MORGES_GEOMETRY.volumeSia416M3,
    parcelAreaM2:
      readPositive(params.get("parcel")) ??
      readPositive(params.get("terrain")) ??
      MORGES_GEOMETRY.parcelAreaM2,
    canton: readCanton(params.get("canton")) ?? MORGES_GEOMETRY.canton,
    zone: MORGES_GEOMETRY.zone,
  };

  const site: ReportSite = {
    ...MORGES_REPORT_SITE,
    locality: readLabel(params.get("commune")) ?? MORGES_REPORT_SITE.locality,
    cadastralReference: parcelNumber ?? MORGES_REPORT_SITE.cadastralReference,
    cadastralSheet: parcelNumber ? undefined : MORGES_REPORT_SITE.cadastralSheet,
  };

  return {
    geometry,
    site,
    syncedFromStudio: PARAM_KEYS.some((key) => params.has(key)),
  };
}

function readPositive(raw: string | null): number | null {
  if (raw === null) return null;
  const normalized = raw.trim().replace(/\s/g, "").replaceAll("'", "").replaceAll("’", "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function readCanton(raw: string | null): SwissCanton | null {
  if (raw === null) return null;
  const code = raw.trim().toUpperCase();
  return CANTONS.has(code) ? (code as SwissCanton) : null;
}

function readLabel(raw: string | null): string | null {
  if (raw === null) return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}
