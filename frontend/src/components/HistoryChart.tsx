import { useLingui } from "@lingui/react/macro";
import {
  BarController,
  BarElement,
  type ChartData,
  Chart as ChartJS,
  type ChartOptions,
  Filler,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  TimeScale,
  Tooltip,
} from "chart.js";
import "chartjs-adapter-date-fns";
import { enGB, es } from "date-fns/locale";
import { useState } from "react";
import { Chart } from "react-chartjs-2";
import {
  HISTORY_VARIABLES,
  type History,
  type HistoryVariable,
  PERIODS,
  type Period,
  useApi,
} from "../lib/api";
import { formatNumber, toKmh } from "../lib/format";
import { useCssColors } from "../lib/useCssColors";

ChartJS.register(
  TimeScale,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  BarController,
  BarElement,
  Filler,
  Tooltip,
);

const REFRESH_MS = 10 * 60_000;

type Kind = "band" | "bars" | "peak";
const SERIES: Record<HistoryVariable, { unit: string; digits: number; kind: Kind }> = {
  temperature: { unit: "°C", digits: 1, kind: "band" },
  humidity: { unit: "%", digits: 0, kind: "band" },
  pressure: { unit: "hPa", digits: 1, kind: "band" },
  wind_speed: { unit: "km/h", digits: 1, kind: "peak" },
  rain: { unit: "mm", digits: 1, kind: "bars" },
  solar_radiation: { unit: "W/m²", digits: 0, kind: "peak" },
  uv_index: { unit: "", digits: 0, kind: "peak" },
};

export function HistoryChart() {
  const { t, i18n } = useLingui();
  const [variable, setVariable] = useState<HistoryVariable>("temperature");
  const [period, setPeriod] = useState<Period>("day");
  const { data, error } = useApi<History>(
    `/api/v1/weather/history/${variable}?period=${period}`,
    REFRESH_MS,
  );
  const colors = useCssColors();

  const labels: Record<HistoryVariable, string> = {
    temperature: t`Temperature`,
    humidity: t`Humidity`,
    pressure: t`Pressure`,
    wind_speed: t`Wind`,
    rain: t`Rain`,
    solar_radiation: t`Solar`,
    uv_index: t`UV`,
  };
  const periodLabels: Record<Period, string> = { day: t`24 h`, week: t`7 days`, month: t`30 days` };
  const series = SERIES[variable];
  const seriesLabels = { total: t`Total`, max: t`Max`, min: t`Min`, avg: t`Average` };
  const summaryLabel = (h: History, label: string) => {
    const max = highest(h);
    return max ? t`${label}: highest ${max}` : label;
  };
  // While a new variable loads, keep showing nothing rather than the previous one's data.
  const history = data?.variable === variable && data.period === period ? data : null;

  return (
    <section
      aria-label={t`History`}
      className="flex min-h-72 flex-col gap-3 rounded-2xl border border-border bg-card p-4 text-card-fg shadow-sm lg:min-h-48 lg:flex-1"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label={t`Variable`} className="flex flex-wrap gap-1">
          {HISTORY_VARIABLES.map((name) => (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={name === variable}
              onClick={() => setVariable(name)}
              className="cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium text-muted-fg transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary aria-selected:bg-primary aria-selected:text-on-primary"
            >
              {labels[name]}
            </button>
          ))}
        </div>
        <fieldset className="flex rounded-full border border-border p-0.5">
          <legend className="sr-only">{t`Period`}</legend>
          {PERIODS.map((name) => (
            <button
              key={name}
              type="button"
              aria-pressed={name === period}
              onClick={() => setPeriod(name)}
              className="cursor-pointer rounded-full px-3 py-1 text-sm text-muted-fg transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-primary aria-pressed:bg-muted aria-pressed:font-medium aria-pressed:text-fg"
            >
              {periodLabels[name]}
            </button>
          ))}
        </fieldset>
      </div>
      <div className="relative min-h-0 flex-1">
        {history ? (
          <Chart
            type={series.kind === "bars" ? "bar" : "line"}
            data={buildData(history, colors, seriesLabels)}
            options={buildOptions(history, i18n.locale, colors)}
            aria-label={summaryLabel(history, labels[variable])}
            role="img"
          />
        ) : (
          <p className="absolute inset-0 flex items-center justify-center text-muted-fg">
            {error ? t`History unavailable` : t`Loading…`}
          </p>
        )}
      </div>
    </section>
  );
}

type SeriesLabels = { total: string; max: string; min: string; avg: string };
type Colors = ReturnType<typeof useCssColors>;

const scaled = (variable: HistoryVariable, value: number | null) =>
  variable === "wind_speed" ? toKmh(value) : value;

function buildData(
  history: History,
  colors: Colors,
  label: SeriesLabels,
): ChartData<"line" | "bar"> {
  const { kind } = SERIES[history.variable];
  const point = (pick: (p: History["points"][number]) => number | null) =>
    history.points.map((p) => ({
      x: new Date(p.at).getTime(),
      y: scaled(history.variable, pick(p)),
    }));

  if (kind === "bars") {
    return {
      datasets: [
        { label: label.total, data: point((p) => p.total), backgroundColor: colors.primary },
      ],
    };
  }
  const line = { pointRadius: 0, pointHitRadius: 8, tension: 0.3, borderWidth: 2 };
  if (kind === "peak") {
    return {
      datasets: [
        {
          ...line,
          label: label.max,
          data: point((p) => p.max),
          borderColor: colors["accent-soft"],
          borderDash: [5, 4],
        },
        { ...line, label: label.avg, data: point((p) => p.avg), borderColor: colors.primary },
      ],
    };
  }
  return {
    datasets: [
      {
        ...line,
        label: label.max,
        data: point((p) => p.max),
        borderWidth: 0,
        fill: "+1",
        backgroundColor: colors["chart-band"],
      },
      { ...line, label: label.min, data: point((p) => p.min), borderWidth: 0 },
      { ...line, label: label.avg, data: point((p) => p.avg), borderColor: colors.primary },
    ],
  };
}

function buildOptions(
  history: History,
  locale: string,
  colors: Colors,
): ChartOptions<"line" | "bar"> {
  const { unit, digits } = SERIES[history.variable];
  const grid = { color: colors.border };
  const ticks = { color: colors["muted-fg"] };
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: "index", intersect: false },
    scales: {
      x: {
        type: "time",
        adapters: { date: { locale: locale === "es" ? es : enGB } },
        time: {
          unit: history.period === "day" ? "hour" : "day",
          // date-fns defaults to 12 h ("11AM"); 24 h reads fine in both locales.
          displayFormats: { hour: "HH:mm", day: "d MMM" },
          tooltipFormat: history.period === "day" ? "HH:mm" : "d MMM HH:mm",
        },
        grid,
        ticks: { ...ticks, maxRotation: 0, autoSkipPadding: 16 },
      },
      y: {
        grid,
        ticks: { ...ticks, callback: (value) => `${formatNumber(Number(value), digits)} ${unit}` },
        beginAtZero: SERIES[history.variable].kind !== "band",
      },
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${formatNumber(ctx.parsed.y, digits)} ${unit}`,
        },
      },
    },
  };
}

function highest(history: History): string | null {
  const values = history.points
    .map((p) => scaled(history.variable, p.max ?? p.total))
    .filter((v): v is number => v != null);
  if (!values.length) return null;
  const { unit, digits } = SERIES[history.variable];
  return `${formatNumber(Math.max(...values), digits)} ${unit}`.trim();
}
