import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Printer, X } from "lucide-react";
import {
  MORGES_REPORT_SITE,
  type ReportSite,
} from "../../server/financial/morgesScenario.ts";
import type {
  FinancialParameters,
  GeometricInputs,
  ResidualLandValueResult,
  SwissCanton,
} from "../../server/financial/types.ts";

const COMFORT_MARGIN = 0.12;
const COMFORT_RESIDUAL_SHARE = 0.12;

const CANTON_NAMES: Record<SwissCanton, string> = {
  AG: "Argovie",
  AI: "Appenzell Rhodes-Intérieures",
  AR: "Appenzell Rhodes-Extérieures",
  BE: "Berne",
  BL: "Bâle-Campagne",
  BS: "Bâle-Ville",
  FR: "Fribourg",
  GE: "Genève",
  GL: "Glaris",
  GR: "Grisons",
  JU: "Jura",
  LU: "Lucerne",
  NE: "Neuchâtel",
  NW: "Nidwald",
  OW: "Obwald",
  SG: "Saint-Gall",
  SH: "Schaffhouse",
  SO: "Soleure",
  SZ: "Schwyz",
  TG: "Thurgovie",
  TI: "Tessin",
  UR: "Uri",
  VD: "Vaud",
  VS: "Valais",
  ZG: "Zoug",
  ZH: "Zurich",
};

const shareFormat = new Intl.NumberFormat("fr-CH", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const ratioFormat = new Intl.NumberFormat("fr-CH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const pointFormat = new Intl.NumberFormat("fr-CH", {
  maximumFractionDigits: 1,
});

const dateFormat = new Intl.DateTimeFormat("fr-CH", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export interface FinancialReportViewProps {
  geometry: GeometricInputs;
  financials: FinancialParameters;
  result: ResidualLandValueResult;
  site?: ReportSite;
  issuedAt?: Date;
}

/**
 * Fiche A4 du bilan financier. Le fond, les filets et les marges sont
 * calés sur une page : l'aperçu et `window.print()` montrent le même document.
 */
export function FinancialReportView({
  geometry,
  financials,
  result,
  site = MORGES_REPORT_SITE,
  issuedAt = new Date(),
}: FinancialReportViewProps) {
  const status = operationStatus(result, financials.developerMarginRateOnExit);
  const basis = result.exitSurfaceBasis === "sre" ? "SRE" : "SPd";
  const otherBasis = result.exitSurfaceBasis === "sre" ? "SPd" : "SRE";
  const otherSurfaceM2 = result.exitSurfaceBasis === "sre" ? geometry.spdM2 : geometry.sreM2;
  const equivalentPrice = otherSurfaceM2 > 0 ? result.exitValueChf / otherSurfaceM2 : 0;
  const cantonName = CANTON_NAMES[geometry.canton];
  const notes = result.warnings.filter((warning) => warning.code !== "negative_residual");

  const rows: AccountRow[] = [
    {
      label: "Chiffre d'affaires potentiel",
      amount: result.exitValueChf,
      tone: "result",
    },
    {
      label: "CFC 1 — Travaux préparatoires",
      hint: `${formatPoints(financials.cfc1RateOnCfc2)} du CFC 2`,
      amount: result.costs.cfc1Chf,
      tone: "plain",
    },
    {
      label: "CFC 2 — Bâtiment",
      hint: `${formatGrouped(geometry.volumeSia416M3)} m³ × ${formatGrouped(financials.cfc2CostChfPerM3)} CHF`,
      amount: result.costs.cfc2Chf,
      tone: "plain",
    },
    {
      label: "CFC 4 — Aménagements extérieurs",
      hint: `${formatPoints(financials.cfc4RateOnCfc2)} du CFC 2`,
      amount: result.costs.cfc4Chf,
      tone: "plain",
    },
    {
      label: "CFC 5 — Frais secondaires",
      hint: `${formatPoints(financials.cfc5RateOnWorks)} de CFC 1 + 2 + 4`,
      amount: result.costs.cfc5Chf,
      tone: "plain",
    },
    {
      label: "Total CFC 1, 2, 4 et 5",
      amount: result.costs.totalExcludingLandChf,
      tone: "total",
    },
    {
      label: "Marge promoteur",
      hint: `${formatPoints(financials.developerMarginRateOnExit)} du chiffre d'affaires`,
      amount: result.developerMarginChf,
      tone: "plain",
    },
    {
      label: "Valeur résiduelle du terrain",
      amount: result.residualLandValueChf,
      tone: "result",
    },
    {
      label: "Frais d'acquisition",
      hint: `${formatPoints(financials.landAcquisitionCostRate)} du prix d'achat`,
      amount: result.landAcquisitionCostsChf,
      tone: "plain",
      indent: true,
    },
    {
      label: "Prix maximum d'achat",
      amount: result.maxPurchasePriceChf,
      tone: "result",
    },
  ];

  return (
    <article
      className="financial-report flex min-h-[297mm] w-[210mm] shrink-0 flex-col bg-white px-[12mm] pt-[8mm] pb-[7mm] text-[#1b2430] shadow-[0_18px_50px_rgba(20,24,31,0.28)] print:shadow-none"
      data-testid="financial-report"
      lang="fr"
    >
      <header>
        <div className="h-[2.5px] bg-[#1b2430]" />
        <div className="mt-px h-px bg-[#1b2430]" />
        <div className="mt-[4mm] flex items-start justify-between gap-[6mm]">
          <div className="min-w-0">
            <p className="font-sans text-[9px] font-medium tracking-[0.16em] text-[#7c6844] uppercase">
              Bilan financier & potentiel foncier
            </p>
            <h1
              id="financial-report-title"
              className="mt-[1mm] max-w-[148mm] text-[16.5px] leading-[1.2] font-semibold tracking-tight"
            >
              Faisabilité Financière & Valeur Résiduelle du Foncier
            </h1>
          </div>
          <p className="flex size-[11mm] shrink-0 items-center justify-center border border-[#1b2430] font-sans text-[11px] font-semibold tracking-wide">
            {geometry.canton}
          </p>
        </div>

        <dl className="mt-[4mm] grid grid-cols-[1.4fr_1fr_auto] gap-x-[6mm] gap-y-[1mm] border-y border-[#e4dfd6] py-[2.5mm]">
          <div>
            <dt className="font-sans text-[8px] tracking-[0.12em] text-[#5e6872] uppercase">Localisation</dt>
            <dd className="mt-px text-[12.5px] leading-tight font-medium">
              {site.locality}, {geometry.canton}
            </dd>
          </div>
          <div>
            <dt className="font-sans text-[8px] tracking-[0.12em] text-[#5e6872] uppercase">Référence cadastrale</dt>
            <dd className="mt-px text-[12.5px] leading-tight font-medium">
              Parcelle n° {site.cadastralReference}
              {site.cadastralSheet ? (
                <span className="font-normal text-[#5e6872]"> · feuille {site.cadastralSheet}</span>
              ) : null}
            </dd>
          </div>
          <div className="text-right">
            <dt className="font-sans text-[8px] tracking-[0.12em] text-[#5e6872] uppercase">Date</dt>
            <dd className="mt-px font-sans text-[12.5px] leading-tight font-medium tabular-nums">{dateFormat.format(issuedAt)}</dd>
          </div>
          <div className="col-span-2">
            <dt className="sr-only">Affectation</dt>
            <dd className="text-[10.5px] text-[#5e6872]">
              Canton de {cantonName} · {sentenceCase(geometry.zone)}
            </dd>
          </div>
          <div className="text-right">
            <dt className="sr-only">Dossier</dt>
            <dd className="font-sans text-[10px] tracking-[0.08em] text-[#5e6872] uppercase">
              Dossier BF-{site.cadastralReference}
            </dd>
          </div>
        </dl>
      </header>

      <div className="mt-[3.5mm] space-y-[3.2mm]">
        <section className="break-inside-avoid">
          <SectionHeading index="01" title="Hypothèses de sortie" kicker="Exit value" />
          <div className="mt-[2.5mm] grid grid-cols-4 gap-[3mm]">
            <Fact
              label="SRE"
              value={`${formatGrouped(geometry.sreM2)} m²`}
              detail={result.exitSurfaceBasis === "sre" ? "Surface valorisée" : "Surface énergétique"}
            />
            <Fact
              label="SPd"
              value={`${formatGrouped(geometry.spdM2)} m²`}
              detail={result.exitSurfaceBasis === "spd" ? "Surface valorisée" : "Surface de plancher"}
            />
            <Fact
              label="Prix moyen"
              value={`${formatGrouped(financials.exitPriceChfPerM2)} CHF`}
              detail={`par m² ${basis}`}
            />
            <Fact
              label="Chiffre d'affaires"
              value={formatChf(result.exitValueChf)}
              detail={`${formatGrouped(result.exitSurfaceM2)} m² × ${formatGrouped(financials.exitPriceChfPerM2)}`}
            />
          </div>
          <p className="mt-[2mm] font-sans text-[9px] text-[#5e6872] tabular-nums">
            Équivalent {otherBasis} {formatGrouped(equivalentPrice)} CHF/m² · Volume SIA 416{" "}
            {formatGrouped(geometry.volumeSia416M3)} m³ · IUS {ratioFormat.format(result.metrics.utilizationIndex)} ·
            SRE/SPd {shareFormat.format(result.metrics.sreToSpdRatio)}
          </p>
        </section>

        <section className="break-inside-avoid">
          <SectionHeading index="02" title="Bilan des coûts CFC" kicker="Compte à rebours" />
          <table className="mt-[1.2mm] w-full border-collapse text-[10.5px]">
            <caption className="sr-only">
              Compte à rebours du chiffre d'affaires jusqu'au prix maximum d'achat du terrain, avec la part de chaque
              poste
            </caption>
            <thead>
              <tr className="border-b border-[#1b2430] font-sans text-[8px] tracking-[0.12em] text-[#5e6872] uppercase">
                <th scope="col" className="py-[0.8mm] text-left font-medium">
                  Poste
                </th>
                <th scope="col" className="py-[0.8mm] text-right font-medium">
                  Montant
                </th>
                <th scope="col" className="w-[22mm] py-[0.8mm] pl-[3mm] text-right font-medium">
                  Part du CA
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.label}
                  className={
                    row.tone === "plain"
                      ? "border-b border-[#ece7de]"
                      : "border-t border-[#1b2430]"
                  }
                >
                  <th
                    scope="row"
                    className={`py-[0.7mm] pr-[3mm] text-left font-normal ${
                      row.tone === "plain" ? "" : "font-semibold"
                    } ${row.indent ? "pl-[4mm] font-normal text-[#5e6872]" : ""}`}
                  >
                    {row.label}
                    {row.hint ? <span className="font-normal text-[#8a8175]"> · {row.hint}</span> : null}
                  </th>
                  <td
                    className={`py-[0.7mm] text-right font-sans whitespace-nowrap tabular-nums ${
                      row.tone === "plain" ? "" : "font-semibold"
                    }`}
                  >
                    {formatChf(row.amount)}
                  </td>
                  <td className="py-[0.7mm] pl-[3mm] text-right font-sans whitespace-nowrap text-[#5e6872] tabular-nums">
                    {shareFormat.format(result.exitValueChf === 0 ? 0 : row.amount / result.exitValueChf)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-[1.5mm] text-[8.5px] leading-snug text-[#5e6872]">
            CFC 3, équipements d'exploitation, non isolé : inclus dans le bâtiment. Les frais d'acquisition sont une
            décote du prix vendeur, distincte des postes CFC 1 à 5.
          </p>
        </section>

        <section className="break-inside-avoid">
          <SectionHeading index="03" title="Indicateur clé" kicker="Valeur résiduelle" />
          <div className="mt-[2.5mm] border border-[#1b2430] p-[1mm]">
            <div
              className="border border-[#1b2430] px-[4.5mm] py-[2.6mm]"
              data-testid="report-max-purchase"
              data-amount={result.maxPurchasePriceChf}
            >
              <div className="flex items-start justify-between gap-[4mm]">
                <p className="font-sans text-[8.5px] font-medium tracking-[0.16em] text-[#7c6844] uppercase">
                  Prix maximum d'achat foncier
                </p>
                <p className="border border-[#1b2430] px-[2mm] py-px font-sans text-[8px] font-medium tracking-[0.14em] uppercase">
                  {status.label}
                </p>
              </div>
              <p className="mt-[1mm] font-sans text-[26px] leading-none font-semibold tracking-tight tabular-nums">
                {formatChf(result.maxPurchasePriceChf)}
              </p>
              <p className="mt-[1.5mm] font-sans text-[13px] font-medium tabular-nums">
                {formatChf(result.maxPurchasePriceChfPerParcelM2)}
                <span className="font-normal text-[#5e6872]"> / m² de terrain</span>
              </p>
              <dl className="mt-[3mm] grid grid-cols-3 gap-[4mm] border-t border-[#e4dfd6] pt-[2mm]">
                <div>
                  <dt className="font-sans text-[8px] tracking-[0.1em] text-[#5e6872] uppercase">Valeur résiduelle</dt>
                  <dd className="mt-px font-sans font-medium tabular-nums">{formatChf(result.residualLandValueChf)}</dd>
                </div>
                <div>
                  <dt className="font-sans text-[8px] tracking-[0.1em] text-[#5e6872] uppercase">Frais d'acquisition</dt>
                  <dd className="mt-px font-sans font-medium tabular-nums">{formatChf(result.landAcquisitionCostsChf)}</dd>
                </div>
                <div>
                  <dt className="font-sans text-[8px] tracking-[0.1em] text-[#5e6872] uppercase">Assiette</dt>
                  <dd className="mt-px font-sans font-medium tabular-nums">
                    {formatGrouped(geometry.parcelAreaM2)} m²
                  </dd>
                </div>
              </dl>
              <p className="mt-[1.5mm] text-[9px] text-[#5e6872]">{status.sentence}</p>
            </div>
          </div>
        </section>

        <section className="break-inside-avoid">
          <SectionHeading index="04" title="Benchmarking foncier cantonal" kicker="Transactions" />
          <p className="mt-[2mm] text-[10px] text-[#3c4652]">
            Prix d'achat calculé et médiane des transactions foncières du {site.benchmark.areaLabel}.
          </p>
          <BenchmarkChart
            pricePerM2={result.maxPurchasePriceChfPerParcelM2}
            benchmark={site.benchmark}
          />
          <p className="mt-[2mm] text-[10px] leading-snug">{benchmarkReading(result.maxPurchasePriceChfPerParcelM2, site.benchmark)}</p>
          <p className="mt-[1mm] text-[8.5px] leading-snug text-[#5e6872]">
            Médiane {formatGrouped(site.benchmark.medianChfPerParcelM2)} CHF/m², quartiles{" "}
            {formatGrouped(site.benchmark.lowerQuartileChfPerParcelM2)} –{" "}
            {formatGrouped(site.benchmark.upperQuartileChfPerParcelM2)} CHF/m², {site.benchmark.periodLabel}. Ordre de
            grandeur de cadrage pour terrain à bâtir : cette référence n'est pas une extraction du registre foncier.
          </p>
        </section>

        {notes.length > 0 ? (
          <ul className="space-y-[0.5mm] text-[8.5px] text-[#6b5428]">
            {notes.map((warning) => (
              <li key={warning.code}>{warning.message}</li>
            ))}
          </ul>
        ) : null}
      </div>

      <footer className="mt-auto border-t border-[#1b2430] pt-[2.5mm]">
        <p className="text-[8px] leading-snug text-[#5e6872]">
          Réserves. Analyse indicative de faisabilité, établie sur des hypothèses de prix et de ratios. Elle est hors
          audit de sol, hors étude de pollution et hors contrôle géotechnique. Toute décision d'acquisition reste
          soumise à validation notariale et bancaire.
        </p>
        <div className="mt-[1.5mm] flex items-center justify-between font-sans text-[8px] tracking-[0.12em] text-[#8a8175] uppercase">
          <p>Bilan financier & potentiel foncier</p>
          <p>Page 1 / 1</p>
        </div>
      </footer>
    </article>
  );
}

export function FinancialReportDialog({
  onClose,
  ...report
}: FinancialReportViewProps & { onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [issuedAt] = useState(() => report.issuedAt ?? new Date());
  const site = report.site ?? MORGES_REPORT_SITE;

  useEffect(() => {
    const previousTitle = document.title;
    const previousOverflow = document.body.style.overflow;
    document.title = `Faisabilité financière — ${site.locality}`;
    document.body.classList.add("financial-report-open");
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.title = previousTitle;
      document.body.classList.remove("financial-report-open");
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose, site.locality]);

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="financial-report-title"
      tabIndex={-1}
      className="report-backdrop fixed inset-0 z-50 overflow-auto bg-[#1b2430]/60 outline-none"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 bg-[#1b2430]/95 px-5 py-3 text-white print:hidden">
        <div>
          <p className="text-sm font-medium">Aperçu de la fiche A4</p>
          <p className="text-xs text-white/70">Impression ou enregistrement PDF depuis la boîte du navigateur.</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-[#1b2430] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <Printer className="size-4" aria-hidden />
            Imprimer
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/30 px-3 py-1.5 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <X className="size-4" aria-hidden />
            Fermer
          </button>
        </div>
      </div>
      <div
        className="flex justify-center px-4 py-6 print:block print:p-0"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <FinancialReportView {...report} site={site} issuedAt={issuedAt} />
      </div>
    </div>,
    document.body,
  );
}

function SectionHeading({ index, title, kicker }: { index: string; title: string; kicker: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[#1b2430] pb-[1.2mm]">
      <h2 className="text-[12.5px] font-semibold tracking-tight">
        <span className="mr-[2mm] font-sans text-[9px] font-medium tracking-[0.16em] text-[#7c6844]">{index}</span>
        {title}
      </h2>
      <p className="font-sans text-[8px] tracking-[0.14em] text-[#5e6872] uppercase">{kicker}</p>
    </div>
  );
}

function Fact({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="border-l border-[#e4dfd6] pl-[2.5mm]">
      <p className="font-sans text-[8px] tracking-[0.12em] text-[#5e6872] uppercase">{label}</p>
      <p className="mt-px font-sans text-[12px] leading-tight font-semibold tabular-nums">{value}</p>
      <p className="mt-px text-[8.5px] text-[#5e6872]">{detail}</p>
    </div>
  );
}

function BenchmarkChart({
  pricePerM2,
  benchmark,
}: {
  pricePerM2: number;
  benchmark: ReportSite["benchmark"];
}) {
  const price = Math.round(pricePerM2);
  const ceiling = niceCeiling(
    Math.max(price, benchmark.upperQuartileChfPerParcelM2, benchmark.medianChfPerParcelM2, 1),
  );
  const reading = `Prix maximum ${formatGrouped(Math.max(price, 0))} CHF par mètre carré, médiane ${formatGrouped(benchmark.medianChfPerParcelM2)} CHF, quartiles ${formatGrouped(benchmark.lowerQuartileChfPerParcelM2)} à ${formatGrouped(benchmark.upperQuartileChfPerParcelM2)}.`;

  return (
    <figure className="mt-[2.5mm]" role="img" aria-label={reading}>
      <CompareBar label="Prix maximum d'achat" value={Math.max(price, 0)} ceiling={ceiling} tone="ink" />
      <div className="mt-[1.6mm]">
        <CompareBar label="Médiane du district" value={benchmark.medianChfPerParcelM2} ceiling={ceiling} tone="brass" />
      </div>
      <div className="relative mt-[2mm] h-[3.2mm] bg-[#f1eee8]">
        <div
          className="absolute inset-y-0 bg-[#e4d5bc]"
          style={{
            left: `${shareOf(benchmark.lowerQuartileChfPerParcelM2, ceiling)}%`,
            width: `${shareOf(benchmark.upperQuartileChfPerParcelM2 - benchmark.lowerQuartileChfPerParcelM2, ceiling)}%`,
          }}
        />
        <div
          className="absolute inset-y-0 w-px bg-[#7c6844]"
          style={{ left: `${shareOf(benchmark.medianChfPerParcelM2, ceiling)}%` }}
        />
        {price > 0 ? (
          <div
            className="absolute -top-[0.8mm] h-[4.8mm] w-[2px] bg-[#1b2430]"
            style={{ left: `${shareOf(price, ceiling)}%` }}
          />
        ) : null}
      </div>
      <div className="mt-[0.8mm] flex justify-between font-sans text-[8px] text-[#8a8175] tabular-nums">
        <span>0</span>
        <span>
          {formatGrouped(benchmark.lowerQuartileChfPerParcelM2)} – {formatGrouped(benchmark.upperQuartileChfPerParcelM2)}
        </span>
        <span>{formatGrouped(ceiling)} CHF/m² de terrain</span>
      </div>
      <figcaption className="mt-[1mm] flex flex-wrap gap-x-[4mm] gap-y-[0.5mm] font-sans text-[8px] tracking-[0.04em] text-[#5e6872] uppercase">
        <span className="inline-flex items-center gap-[1.5mm]">
          <span className="inline-block h-[2mm] w-[4mm] bg-[#1b2430]" /> Prix calculé
        </span>
        <span className="inline-flex items-center gap-[1.5mm]">
          <span className="inline-block h-[2mm] w-[4mm] bg-[#7c6844]" /> Médiane
        </span>
        <span className="inline-flex items-center gap-[1.5mm]">
          <span className="inline-block h-[2mm] w-[4mm] bg-[#e4d5bc]" /> Quartiles
        </span>
      </figcaption>
    </figure>
  );
}

function CompareBar({
  label,
  value,
  ceiling,
  tone,
}: {
  label: string;
  value: number;
  ceiling: number;
  tone: "ink" | "brass";
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[10px]">{label}</p>
        <p className="font-sans text-[10px] font-medium tabular-nums">{formatGrouped(value)} CHF/m²</p>
      </div>
      <div className="mt-[0.8mm] h-[2.2mm] bg-[#f1eee8]">
        <div
          className={tone === "ink" ? "h-full bg-[#1b2430]" : "h-full bg-[#7c6844]"}
          style={{ width: `${shareOf(value, ceiling)}%` }}
        />
      </div>
    </div>
  );
}

interface AccountRow {
  label: string;
  hint?: string;
  amount: number;
  tone: "plain" | "total" | "result";
  indent?: boolean;
}

function operationStatus(
  result: ResidualLandValueResult,
  marginRate: number,
): { label: string; sentence: string } {
  if (result.residualLandValueChf < 0) {
    return {
      label: "Non viable",
      sentence: "Ces hypothèses ne dégagent aucune valeur pour le terrain.",
    };
  }
  const lowMargin = marginRate < COMFORT_MARGIN;
  const thinResidual = result.metrics.residualToExitRatio < COMFORT_RESIDUAL_SHARE;
  if (lowMargin || thinResidual) {
    return {
      label: "Marge faible",
      sentence: "La marge, ou la part du terrain dans le chiffre d'affaires, passe sous 12 %.",
    };
  }
  return {
    label: "Viable",
    sentence: "La charge foncière reste compatible avec la marge promoteur visée.",
  };
}

function benchmarkReading(pricePerM2: number, benchmark: ReportSite["benchmark"]): string {
  if (!(pricePerM2 > 0)) {
    return "Ces hypothèses ne dégagent pas de prix d'achat. La comparaison avec les transactions du secteur ne s'applique pas.";
  }
  const price = Math.round(pricePerM2);
  const delta = price - benchmark.medianChfPerParcelM2;
  const relative = Math.abs(delta) / benchmark.medianChfPerParcelM2;
  const place =
    price > benchmark.upperQuartileChfPerParcelM2
      ? "au-delà du troisième quartile"
      : price < benchmark.lowerQuartileChfPerParcelM2
        ? "sous le premier quartile"
        : "dans l'intervalle interquartile";
  if (relative < 0.03) {
    return `Le prix maximum d'achat est aligné sur la médiane du ${benchmark.areaLabel}, ${place}.`;
  }
  const pct = new Intl.NumberFormat("fr-CH", {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(relative);
  const direction = delta > 0 ? "au-dessus" : "en dessous";
  return `Le prix maximum d'achat se situe ${formatGrouped(Math.abs(delta))} CHF/m² ${direction} de la médiane du ${benchmark.areaLabel} (${pct}), ${place}.`;
}

function shareOf(value: number, ceiling: number): number {
  if (!(ceiling > 0) || !(value > 0)) return 0;
  return Math.min(100, (value / ceiling) * 100);
}

function niceCeiling(value: number): number {
  const padded = Math.max(value, 1) * 1.08;
  const magnitude = 10 ** Math.floor(Math.log10(padded));
  const step = magnitude / 2;
  return Math.ceil(padded / step) * step;
}

function sentenceCase(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) return trimmed;
  return trimmed.charAt(0).toLocaleUpperCase("fr-CH") + trimmed.slice(1);
}

function formatPoints(rate: number): string {
  return `${pointFormat.format(rate * 100)} %`;
}

function formatGrouped(value: number): string {
  const rounded = Math.round(Math.abs(value));
  const grouped = String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, "\u2019");
  return value < 0 ? `-${grouped}` : grouped;
}

function formatChf(value: number): string {
  return `${formatGrouped(value)} CHF`;
}
