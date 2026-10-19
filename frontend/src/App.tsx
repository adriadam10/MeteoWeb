import { useLingui } from "@lingui/react/macro";
import { Camera } from "./components/Camera";
import { Conditions } from "./components/Conditions";
import { Header } from "./components/Header";
import { HistoryChart } from "./components/HistoryChart";
import { type Current, useApi } from "./lib/api";
import { formatNumber } from "./lib/format";

const CURRENT_REFRESH_MS = 60_000;

export function App() {
  const { t } = useLingui();
  const { data: current, error } = useApi<Current>("/api/v1/weather/current", CURRENT_REFRESH_MS);
  const temperature = current?.values.temperature;

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      {/* Single page: the live temperature is what's worth seeing in a narrow tab. */}
      <title>
        {temperature != null ? `${formatNumber(temperature)} °C · MeteoWeb` : "MeteoWeb"}
      </title>
      <Header current={current} error={error} />
      <main className="grid flex-1 grid-cols-[minmax(0,1fr)] gap-4 p-4 lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_400px] lg:px-6 lg:pb-6">
        <div className="flex min-h-0 flex-col gap-4">
          <Camera />
          <HistoryChart />
        </div>
        <div className="min-h-0">
          {current ? (
            <Conditions current={current} />
          ) : (
            <p className="rounded-2xl border border-border bg-card p-4 text-muted-fg">
              {error ? t`Station unreachable` : t`Loading…`}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
