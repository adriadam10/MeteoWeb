import { useLingui } from "@lingui/react/macro";
import { ArrowUp, CloudRain, Droplets, Gauge, Sun, SunDim, Thermometer, Wind } from "lucide-react";
import type { ReactNode } from "react";
import type { Current, DayRange } from "../lib/api";
import { compassIndex, formatNumber, formatTime, toKmh } from "../lib/format";

export function Conditions({ current }: { current: Current }) {
  const { t } = useLingui();
  const v = current.values;
  const today = current.today;

  return (
    <section aria-label={t`Current conditions`} className="grid grid-cols-2 gap-3">
      <TemperatureCard current={current} />
      <Card icon={<Droplets />} title={t`Humidity`}>
        <Value value={formatNumber(v.humidity, 0)} unit="%" />
        <Detail>
          {t`Dew point`} {formatNumber(v.dew_point)} °C
        </Detail>
      </Card>
      <Card icon={<Gauge />} title={t`Pressure`}>
        <Value value={formatNumber(v.pressure)} unit="hPa" />
        <RangeDetail range={today.pressure} digits={1} />
      </Card>
      <WindCard current={current} />
      <Card icon={<CloudRain />} title={t`Rain today`}>
        <Value value={formatNumber(v.rain)} unit="mm" />
        <Detail>
          {t`Rate`} {formatNumber(v.rain_rate)} mm/h
        </Detail>
      </Card>
      <Card icon={<Sun />} title={t`UV index`}>
        <Value value={formatNumber(v.uv_index, 0)} />
        <Detail>
          <UvLevel uv={v.uv_index} />
        </Detail>
      </Card>
      <Card icon={<SunDim />} title={t`Solar radiation`}>
        <Value value={formatNumber(v.solar_radiation, 0)} unit="W/m²" />
        <RangeDetail range={today.solar_radiation} digits={0} onlyMax />
      </Card>
    </section>
  );
}

function TemperatureCard({ current }: { current: Current }) {
  const { t } = useLingui();
  const range = current.today.temperature;
  return (
    <article className="col-span-2 flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 text-card-fg shadow-sm">
      <div>
        <h2 className="flex items-center gap-1.5 text-sm font-medium text-muted-fg">
          <Thermometer aria-hidden className="size-4" />
          {t`Temperature`}
        </h2>
        <p className="text-5xl font-semibold tracking-tight tabular-nums">
          {formatNumber(current.values.temperature)}
          <span className="ml-1 text-2xl text-muted-fg">°C</span>
        </p>
        <p className="text-sm text-muted-fg">
          {t`Feels like`} {formatNumber(current.values.heat_index)} °C
        </p>
      </div>
      <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-fg">{t`Max`}</dt>
        <dd className="text-right font-mono tabular-nums">
          {range?.max ? `${formatNumber(range.max.value)} ° · ${formatTime(range.max.at)}` : "—"}
        </dd>
        <dt className="text-muted-fg">{t`Min`}</dt>
        <dd className="text-right font-mono tabular-nums">
          {range?.min ? `${formatNumber(range.min.value)} ° · ${formatTime(range.min.at)}` : "—"}
        </dd>
      </dl>
    </article>
  );
}

function WindCard({ current }: { current: Current }) {
  const { t } = useLingui();
  const direction = current.values.wind_direction;
  const compass = [
    t`N`,
    t`NNE`,
    t`NE`,
    t`ENE`,
    t`E`,
    t`ESE`,
    t`SE`,
    t`SSE`,
    t`S`,
    t`SSW`,
    t`SW`,
    t`WSW`,
    t`W`,
    t`WNW`,
    t`NW`,
    t`NNW`,
  ];
  return (
    <Card icon={<Wind />} title={t`Wind`}>
      <div className="flex items-center gap-2">
        <Value value={formatNumber(toKmh(current.values.wind_speed))} unit="km/h" />
        {direction != null && (
          // The reading is where the wind comes from; the arrow shows where it blows.
          <ArrowUp
            aria-hidden
            className="size-5 shrink-0 text-primary"
            style={{ transform: `rotate(${direction + 180}deg)` }}
          />
        )}
      </div>
      <Detail>
        {direction != null ? `${compass[compassIndex(direction)]} · ` : ""}
        {t`avg`} {formatNumber(toKmh(current.values.wind_speed_avg))} km/h
      </Detail>
    </Card>
  );
}

function UvLevel({ uv }: { uv: number | null }) {
  const { t } = useLingui();
  if (uv == null) return "—";
  if (uv < 3) return t`Low`;
  if (uv < 6) return t`Moderate`;
  if (uv < 8) return t`High`;
  if (uv < 11) return t`Very high`;
  return t`Extreme`;
}

function Card({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <article className="flex min-w-0 flex-col gap-0.5 rounded-2xl border border-border bg-card p-3 text-card-fg shadow-sm">
      <h2 className="flex items-center gap-1.5 text-sm font-medium text-muted-fg [&_svg]:size-4">
        <span aria-hidden>{icon}</span>
        {title}
      </h2>
      {children}
    </article>
  );
}

function Value({ value, unit }: { value: string; unit?: string }) {
  return (
    <p className="text-2xl font-semibold tabular-nums">
      {value}
      {unit && <span className="ml-1 text-sm font-normal text-muted-fg">{unit}</span>}
    </p>
  );
}

function Detail({ children }: { children: ReactNode }) {
  return <p className="truncate text-sm text-muted-fg">{children}</p>;
}

function RangeDetail({
  range,
  digits,
  onlyMax = false,
}: {
  range: DayRange | undefined;
  digits: number;
  onlyMax?: boolean;
}) {
  const { t } = useLingui();
  if (!range?.max) return <Detail>—</Detail>;
  const max = `${t`max`} ${formatNumber(range.max.value, digits)}`;
  if (onlyMax || !range.min) return <Detail>{max}</Detail>;
  return (
    <Detail>
      {t`min`} {formatNumber(range.min.value, digits)} · {max}
    </Detail>
  );
}
