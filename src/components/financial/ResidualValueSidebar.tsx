import { useEffect, useState } from "react";
import {
  Box,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  LandPlot,
  Printer,
  Ruler,
  TriangleAlert,
} from "lucide-react";
import { FinancialReportDialog } from "./FinancialReportView.tsx";
import { calculateResidualLandValue } from "../../server/financial/residualCalculator.ts";
import {
  consumeTokenForValuation,
  getUserTokenBalance,
  TokenServiceError,
  type ValuationProjectDetails,
} from "../../services/tokenService.ts";
import {
  MORGES_CONTROLS,
  MORGES_GEOMETRY,
  MORGES_REPORT_SITE,
  type ReportSite,
} from "../../server/financial/morgesScenario.ts";
import type {
  GeometricInputs,
  ResidualLandValueInput,
  ResidualLandValueResult,
} from "../../server/financial/types.ts";

const EXIT_PRICE = { min: 6_000, max: 14_000, step: 100 };
const CFC2_COST = { min: 600, max: 1_200, step: 10 };
const MARGIN = { min: 8, max: 25, step: 0.5 };
const CFC1 = { min: 0, max: 10, step: 0.5 };
const CFC4 = { min: 0, max: 15, step: 0.5 };
const CFC5 = { min: 0, max: 40, step: 0.5 };
const ACQUISITION = { min: 0, max: 8, step: 0.1 };

const COMFORT_MARGIN = 0.12;
const COMFORT_RESIDUAL_SHARE = 0.12;

const shareFormat = new Intl.NumberFormat("fr-CH", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

type ViabilityTone = "green" | "orange" | "red";

interface ResidualValueSidebarProps {
  geometry?: GeometricInputs;
  reportSite?: ReportSite;
  syncedFromStudio?: boolean;
  userId?: string | null;
  accessToken?: string | null;
  reportAuthor?: string | null;
  /** Volet plein cadre, sans la colonne factice du Studio. */
  embedded?: boolean;
  className?: string;
}

interface ControlState {
  exitPriceChfPerM2: number;
  cfc2CostChfPerM3: number;
  marginPercent: number;
  cfc1Percent: number;
  cfc4Percent: number;
  cfc5Percent: number;
  acquisitionPercent: number;
}

const INITIAL_CONTROLS: ControlState = {
  exitPriceChfPerM2: MORGES_CONTROLS.exitPriceChfPerM2,
  cfc2CostChfPerM3: MORGES_CONTROLS.cfc2CostChfPerM3,
  marginPercent: MORGES_CONTROLS.developerMarginPercent,
  cfc1Percent: MORGES_CONTROLS.cfc1Percent,
  cfc4Percent: MORGES_CONTROLS.cfc4Percent,
  cfc5Percent: MORGES_CONTROLS.cfc5Percent,
  acquisitionPercent: MORGES_CONTROLS.landAcquisitionPercent,
};

export function ResidualValueSidebar({
  geometry = MORGES_GEOMETRY,
  reportSite = MORGES_REPORT_SITE,
  syncedFromStudio = false,
  userId = null,
  accessToken = null,
  reportAuthor = null,
  embedded = false,
  className,
}: ResidualValueSidebarProps) {
  const [controls, setControls] = useState<ControlState>(INITIAL_CONTROLS);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [consuming, setConsuming] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const input: ResidualLandValueInput = {
    geometry,
    financials: {
      exitPriceChfPerM2: controls.exitPriceChfPerM2,
      exitSurfaceBasis: "sre",
      cfc2CostChfPerM3: controls.cfc2CostChfPerM3,
      cfc1RateOnCfc2: controls.cfc1Percent / 100,
      cfc4RateOnCfc2: controls.cfc4Percent / 100,
      cfc5RateOnWorks: controls.cfc5Percent / 100,
      developerMarginRateOnExit: controls.marginPercent / 100,
      landAcquisitionCostRate: controls.acquisitionPercent / 100,
    },
  };

  const outcome = computeResidual(input);
  const patch = (partial: Partial<ControlState>) => {
    setControls((current) => ({ ...current, ...partial }));
  };
  const demoMode = userId === null;
  const projectDetails: ValuationProjectDetails = {
    commune: reportSite.locality,
    canton: geometry.canton,
    parcelle: reportSite.cadastralReference,
    sreM2: geometry.sreM2,
    spdM2: geometry.spdM2,
    volumeSia416M3: geometry.volumeSia416M3,
    parcelAreaM2: geometry.parcelAreaM2,
  };

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setBalanceLoading(true);
    setBalanceError(null);
    setConfirming(false);
    setNotice(null);
    getUserTokenBalance(userId, accessToken)
      .then((next) => {
        if (!cancelled) setBalance(next);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setBalance(null);
        setBalanceError(error instanceof Error ? error.message : "Le solde de jetons n'a pas pu être lu.");
      })
      .finally(() => {
        if (!cancelled) setBalanceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, accessToken]);

  const insufficient = !demoMode && balance === 0;
  const exportBlocked = !outcome.ok || balanceLoading || insufficient || balanceError !== null;

  const openReport = () => {
    if (!outcome.ok) return;
    if (demoMode) {
      setReportOpen(true);
      return;
    }
    if (insufficient || balanceError || balance === null) return;
    setNotice(null);
    setConfirming(true);
  };

  const confirmExport = async () => {
    if (!userId || consuming) return;
    setConsuming(true);
    setNotice(null);
    try {
      const spent = await consumeTokenForValuation(userId, projectDetails, accessToken);
      if (!spent) {
        setBalance(0);
        setConfirming(false);
        setNotice("Solde de jetons insuffisant");
        return;
      }
      const next = await getUserTokenBalance(userId, accessToken);
      setBalance(next);
      setConfirming(false);
      setReportOpen(true);
    } catch (error) {
      setConfirming(false);
      if (error instanceof TokenServiceError && error.code === "insufficient") {
        setBalance(0);
        setNotice("Solde de jetons insuffisant");
        return;
      }
      setNotice(error instanceof Error ? error.message : "Le jeton n'a pas pu être déduit.");
    } finally {
      setConsuming(false);
    }
  };

  return (
    <aside
      className={cx(
        "flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-white text-neutral-950",
        embedded ? "max-w-none" : "border-neutral-200 sm:w-[28rem] sm:flex-none sm:border-l",
        className,
      )}
    >
      <header className="border-b border-neutral-200 px-5 py-4">
        {syncedFromStudio ? (
          <p
            data-testid="studio-sync"
            className="mb-2 inline-flex rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-neutral-600"
          >
            Projet synchronisé depuis le Studio 3D
          </p>
        ) : null}
        {!demoMode ? (
          <p className="mb-2" data-testid="token-balance">
            {balanceLoading ? (
              <span className="inline-flex rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-neutral-500">
                Lecture du solde…
              </span>
            ) : balanceError ? (
              <span className="inline-flex rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-neutral-600">
                Solde indisponible
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-neutral-700">
                <span
                  className={cx("size-1.5 rounded-full", balance !== null && balance > 0 ? "bg-emerald-500" : "bg-neutral-400")}
                  aria-hidden
                />
                {formatTokenBalance(balance ?? 0)}
              </span>
            )}
          </p>
        ) : null}
        <h1 className="text-lg font-semibold tracking-tight">Bilan Foncier Résiduel</h1>
        <p className="mt-1 text-xs text-neutral-500">
          {reportSite.locality}, {geometry.canton} · parcelle n° {reportSite.cadastralReference}
        </p>
        <p className="text-xs text-neutral-400">{geometry.zone}</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          <MetricBadge icon={Box} label={`${formatGrouped(geometry.volumeSia416M3)} m³ SIA`} />
          <MetricBadge icon={Ruler} label={`${formatGrouped(geometry.sreM2)} m² SRE`} />
          <MetricBadge icon={LandPlot} label={`${formatGrouped(geometry.parcelAreaM2)} m² terrain`} />
        </ul>
      </header>

      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
        <div className="sticky top-0 z-10 border-b border-neutral-200 bg-white px-5 py-4 shadow-sm">
          {outcome.ok ? (
            <ImpactCard result={outcome.result} marginRate={input.financials.developerMarginRateOnExit} />
          ) : (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {outcome.message}
            </p>
          )}
        </div>

        <div className="space-y-6 px-5 py-5">
          <div className="space-y-5">
            <RangeField
              id="exit-price"
              label="Prix de sortie estimé (CHF/m² SRE)"
              value={controls.exitPriceChfPerM2}
              {...EXIT_PRICE}
              formatBound={(value) => formatGrouped(value)}
              onChange={(exitPriceChfPerM2) => patch({ exitPriceChfPerM2 })}
            />
            <RangeField
              id="cfc2-cost"
              label="Coût CFC 2 au m³ (CHF/m³)"
              value={controls.cfc2CostChfPerM3}
              {...CFC2_COST}
              formatBound={(value) => formatGrouped(value)}
              onChange={(cfc2CostChfPerM3) => patch({ cfc2CostChfPerM3 })}
            />
            <RangeField
              id="developer-margin"
              label="Marge promoteur visée (%)"
              value={controls.marginPercent}
              {...MARGIN}
              formatBound={(value) => `${formatPoints(value)} %`}
              onChange={(marginPercent) => patch({ marginPercent })}
            />
          </div>

          <section className="rounded-xl border border-neutral-200">
            <h2>
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
                aria-expanded={advancedOpen}
                aria-controls="fees-advanced"
                onClick={() => setAdvancedOpen((open) => !open)}
              >
                Frais & honoraires avancés
                <ChevronDown
                  className={cx("size-4 text-neutral-500 transition-transform", advancedOpen && "rotate-180")}
                  aria-hidden
                />
              </button>
            </h2>
            {advancedOpen ? (
              <div id="fees-advanced" className="space-y-5 border-t border-neutral-200 px-3 py-4">
                <RangeField
                  id="cfc1-rate"
                  label="CFC 1 — Travaux préparatoires"
                  hint="% du CFC 2"
                  value={controls.cfc1Percent}
                  {...CFC1}
                  formatBound={(value) => `${formatPoints(value)} %`}
                  onChange={(cfc1Percent) => patch({ cfc1Percent })}
                />
                <RangeField
                  id="cfc4-rate"
                  label="CFC 4 — Aménagements extérieurs"
                  hint="% du CFC 2"
                  value={controls.cfc4Percent}
                  {...CFC4}
                  formatBound={(value) => `${formatPoints(value)} %`}
                  onChange={(cfc4Percent) => patch({ cfc4Percent })}
                />
                <RangeField
                  id="cfc5-rate"
                  label="CFC 5 — Frais secondaires"
                  hint="% de CFC 1 + 2 + 4"
                  value={controls.cfc5Percent}
                  {...CFC5}
                  formatBound={(value) => `${formatPoints(value)} %`}
                  onChange={(cfc5Percent) => patch({ cfc5Percent })}
                />
                <RangeField
                  id="acquisition-rate"
                  label="Frais d'acquisition"
                  hint="% du prix d'achat"
                  value={controls.acquisitionPercent}
                  {...ACQUISITION}
                  formatBound={(value) => `${formatPoints(value)} %`}
                  onChange={(acquisitionPercent) => patch({ acquisitionPercent })}
                />
              </div>
            ) : null}
          </section>

          {outcome.ok ? <CountdownTable result={outcome.result} /> : null}
        </div>
      </div>

      <footer className="border-t border-neutral-200 px-5 py-4">
        {confirming ? (
          <div className="rounded-xl border border-neutral-200 px-3 py-3">
            <p className="text-sm text-neutral-800">Cette action déduira 1 jeton.</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={consuming}
                onClick={() => void confirmExport()}
                className="inline-flex flex-1 items-center justify-center rounded-lg bg-neutral-950 px-3 py-2 text-sm font-medium text-white disabled:bg-neutral-300"
              >
                {consuming ? "Déduction…" : "Confirmer"}
              </button>
              <button
                type="button"
                disabled={consuming}
                onClick={() => setConfirming(false)}
                className="inline-flex flex-1 items-center justify-center rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-800"
              >
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            data-testid="open-financial-report"
            disabled={exportBlocked}
            aria-haspopup="dialog"
            onClick={openReport}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500"
          >
            <Printer className="size-4" aria-hidden />
            Générer / Imprimer la Fiche PDF
          </button>
        )}
        {insufficient || notice === "Solde de jetons insuffisant" ? (
          <p role="alert" data-testid="token-shortage" className="mt-2 text-center text-xs font-medium text-red-700">
            Solde de jetons insuffisant
          </p>
        ) : notice ? (
          <p role="alert" className="mt-2 text-center text-xs text-red-700">
            {notice}
          </p>
        ) : balanceError ? (
          <p role="alert" className="mt-2 text-center text-xs text-red-700">
            {balanceError}
          </p>
        ) : (
          <p className="mt-2 text-center text-xs text-neutral-500">
            {!outcome.ok
              ? "Le calcul doit aboutir pour éditer la fiche."
              : demoMode
                ? "Mode Démo"
                : balanceLoading
                  ? "Lecture du solde de jetons."
                  : "Aperçu au format A4, prêt pour l'impression."}
          </p>
        )}
      </footer>

      {reportOpen && outcome.ok ? (
        <FinancialReportDialog
          geometry={geometry}
          financials={input.financials}
          result={outcome.result}
          site={reportSite}
          author={reportAuthor}
          onClose={() => setReportOpen(false)}
        />
      ) : null}
    </aside>
  );
}

function ImpactCard({
  result,
  marginRate,
}: {
  result: ResidualLandValueResult;
  marginRate: number;
}) {
  const viability = assessViability(result, marginRate);
  const styles = TONE_STYLES[viability.tone];
  const Icon = viability.tone === "green" ? CircleCheck : viability.tone === "orange" ? TriangleAlert : CircleAlert;

  return (
    <section
      aria-live="polite"
      data-testid="viability"
      data-viability={viability.tone}
      className={cx("rounded-2xl border px-4 py-4", styles.card)}
    >
      <p className={cx("inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium", styles.badge)}>
        <Icon className="size-3.5" aria-hidden />
        {viability.label}
      </p>
      <p className="mt-4 text-xs font-medium tracking-wide text-neutral-500 uppercase">
        Prix Max d'Achat Foncier
      </p>
      <p
        data-testid="max-purchase-price"
        data-amount={result.maxPurchasePriceChf}
        className={cx(
          "mt-1 text-4xl leading-none font-semibold tracking-tight tabular-nums",
          viability.tone === "red" ? "text-red-800" : "text-neutral-950",
        )}
      >
        {formatChf(result.maxPurchasePriceChf)}
      </p>
      <p
        data-testid="max-purchase-per-m2"
        data-amount={result.maxPurchasePriceChfPerParcelM2}
        className="mt-2 text-base font-medium text-neutral-700 tabular-nums"
      >
        {formatChf(result.maxPurchasePriceChfPerParcelM2)}/m² de terrain
      </p>
      {viability.detail ? (
        <p role={viability.tone === "red" ? "alert" : "status"} className={cx("mt-3 text-sm", styles.text)}>
          {viability.detail}
        </p>
      ) : null}
    </section>
  );
}

function CountdownTable({ result }: { result: ResidualLandValueResult }) {
  const exit = result.exitValueChf;
  const rows: Array<{ label: string; amount: number; strong?: boolean; indent?: boolean }> = [
    { label: "Chiffre d'affaires potentiel", amount: result.exitValueChf, strong: true },
    { label: "CFC 1 — Travaux préparatoires", amount: result.costs.cfc1Chf },
    { label: "CFC 2 — Bâtiment", amount: result.costs.cfc2Chf },
    { label: "CFC 4 — Aménagements extérieurs", amount: result.costs.cfc4Chf },
    { label: "CFC 5 — Frais secondaires", amount: result.costs.cfc5Chf },
    { label: "Marge promoteur", amount: result.developerMarginChf },
    { label: "Valeur résiduelle du terrain", amount: result.residualLandValueChf, strong: true },
    { label: "dont frais d'acquisition", amount: result.landAcquisitionCostsChf, indent: true },
    { label: "prix maximum d'achat", amount: result.maxPurchasePriceChf, strong: true, indent: true },
  ];

  return (
    <section>
      <h2 className="text-sm font-semibold">Compte à rebours</h2>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Décomposition du chiffre d'affaires jusqu'au prix maximum d'achat du terrain
          </caption>
          <thead className="text-xs text-neutral-500">
            <tr>
              <th scope="col" className="pb-2 text-left font-medium">
                Poste
              </th>
              <th scope="col" className="pb-2 text-right font-medium">
                Montant
              </th>
              <th scope="col" className="pb-2 pl-3 text-right font-medium">
                Part
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const separated = row.label === "Valeur résiduelle du terrain";
              return (
                <tr key={row.label} className={cx("border-neutral-200", separated && "border-t")}>
                  <th
                    scope="row"
                    className={cx(
                      "py-1.5 pr-3 text-left font-normal",
                      row.strong && "font-medium",
                      row.indent && "pl-4 font-normal text-neutral-600",
                    )}
                  >
                    {row.label}
                  </th>
                  <td className={cx("py-1.5 text-right whitespace-nowrap tabular-nums", row.strong && "font-medium")}>
                    {formatChf(row.amount)}
                  </td>
                  <td className="py-1.5 pl-3 text-right whitespace-nowrap text-neutral-500 tabular-nums">
                    {shareFormat.format(exit === 0 ? 0 : row.amount / exit)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <GeometryWarnings result={result} />
    </section>
  );
}

function GeometryWarnings({ result }: { result: ResidualLandValueResult }) {
  const warnings = result.warnings.filter((warning) => warning.code !== "negative_residual");
  if (warnings.length === 0) return null;
  return (
    <ul className="mt-3 space-y-1 text-xs text-amber-800">
      {warnings.map((warning) => (
        <li key={warning.code}>{warning.message}</li>
      ))}
    </ul>
  );
}

function MetricBadge({
  icon: Icon,
  label,
}: {
  icon: typeof Box;
  label: string;
}) {
  return (
    <li className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-600">
      <Icon className="size-3.5" aria-hidden />
      {label}
    </li>
  );
}

function RangeField({
  id,
  label,
  hint,
  value,
  min,
  max,
  step,
  formatBound,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  formatBound: (value: number) => string;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const rangeId = `${id}-range`;

  const commit = (raw: string) => {
    const parsed = parseEditable(raw);
    if (parsed === null || parsed < min || parsed > max) return;
    const next = alignToStep(parsed, min, max, step);
    onChange(next);
    if (String(next) !== raw) setDraft(String(next));
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <label htmlFor={id} className="pt-1 text-sm font-medium text-neutral-800">
          {label}
          {hint ? <span className="mt-0.5 block text-xs font-normal text-neutral-500">{hint}</span> : null}
        </label>
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={draft ?? value}
          data-testid={id}
          onFocus={() => setDraft(String(value))}
          onChange={(event) => {
            setDraft(event.target.value);
            commit(event.target.value);
          }}
          onBlur={() => {
            const parsed = parseEditable(draft ?? String(value));
            const next = alignToStep(parsed ?? value, min, max, step);
            onChange(next);
            setDraft(null);
          }}
          className="w-28 rounded-md border border-neutral-300 bg-white px-2 py-1 text-right text-sm tabular-nums focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
        />
      </div>
      <input
        id={rangeId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={hint ? `${label} (${hint})` : label}
        data-testid={rangeId}
        onChange={(event) => {
          onChange(Number(event.target.value));
          setDraft(null);
        }}
        className="mt-3 h-6 w-full cursor-pointer accent-neutral-900"
      />
      <div className="mt-1 flex justify-between text-xs text-neutral-400 tabular-nums">
        <span>{formatBound(min)}</span>
        <span>{formatBound(max)}</span>
      </div>
    </div>
  );
}

function assessViability(
  result: ResidualLandValueResult,
  marginRate: number,
): { tone: ViabilityTone; label: string; detail: string | null } {
  if (result.residualLandValueChf < 0) {
    const warning = result.warnings.find((item) => item.code === "negative_residual");
    return {
      tone: "red",
      label: "Non viable",
      detail:
        warning?.message ??
        "Valeur résiduelle négative : ces hypothèses ne dégagent aucun prix d'achat pour le terrain.",
    };
  }

  const lowMargin = marginRate < COMFORT_MARGIN;
  const thinResidual = result.metrics.residualToExitRatio < COMFORT_RESIDUAL_SHARE;
  if (lowMargin || thinResidual) {
    const sentences = [
      lowMargin ? "La marge promoteur est inférieure à 12 %." : "",
      thinResidual ? "La valeur résiduelle représente moins de 12 % du chiffre d'affaires." : "",
    ].filter(Boolean);
    return { tone: "orange", label: "Marge faible", detail: sentences.join(" ") };
  }

  return { tone: "green", label: "Viable", detail: null };
}

const TONE_STYLES: Record<ViabilityTone, { card: string; badge: string; text: string }> = {
  green: {
    card: "border-emerald-200 bg-emerald-50",
    badge: "bg-emerald-100 text-emerald-800",
    text: "text-emerald-900",
  },
  orange: {
    card: "border-amber-200 bg-amber-50",
    badge: "bg-amber-100 text-amber-900",
    text: "text-amber-950",
  },
  red: {
    card: "border-red-200 bg-red-50",
    badge: "bg-red-100 text-red-800",
    text: "text-red-900",
  },
};

function computeResidual(
  input: ResidualLandValueInput,
): { ok: true; result: ResidualLandValueResult } | { ok: false; message: string } {
  try {
    return { ok: true, result: calculateResidualLandValue(input) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Le calcul n'a pas pu aboutir.";
    return { ok: false, message };
  }
}

function parseEditable(raw: string): number | null {
  const normalized = raw.replace(/\s/g, "").replaceAll("'", "").replaceAll("’", "").replace(",", ".");
  if (normalized === "" || normalized === "-" || normalized === ".") return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function alignToStep(value: number, min: number, max: number, step: number): number {
  const clamped = Math.min(max, Math.max(min, value));
  const steps = Math.round((clamped - min) / step);
  const decimals = step.toString().split(".")[1]?.length ?? 0;
  const snapped = Number((min + steps * step).toFixed(decimals));
  return Math.min(max, Math.max(min, snapped));
}

/** Groupement suisse : 5’677’514. L’espace fin de fr-CH est trop discret à l’écran. */
function formatGrouped(value: number): string {
  const rounded = Math.round(Math.abs(value));
  const grouped = String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, "’");
  return value < 0 ? `-${grouped}` : grouped;
}

function formatChf(value: number): string {
  return `${formatGrouped(value)} CHF`;
}

function formatPoints(value: number): string {
  return new Intl.NumberFormat("fr-CH", { maximumFractionDigits: 1 }).format(value);
}

function formatTokenBalance(balance: number): string {
  const count = Math.max(0, Math.trunc(balance));
  return count > 1 ? `${count} jetons disponibles` : `${count} jeton disponible`;
}

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
