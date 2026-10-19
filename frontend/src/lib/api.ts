import { useEffect, useState } from "react";

// Mirrors backend/src/meteoweb/schemas.py.
export const METRICS = [
  "temperature",
  "humidity",
  "dew_point",
  "heat_index",
  "pressure",
  "wind_speed",
  "wind_speed_avg",
  "wind_direction",
  "rain",
  "rain_rate",
  "uv_index",
  "solar_radiation",
] as const;
export type Metric = (typeof METRICS)[number];

export const HISTORY_VARIABLES = [
  "temperature",
  "humidity",
  "pressure",
  "wind_speed",
  "rain",
  "solar_radiation",
  "uv_index",
] as const;
export type HistoryVariable = (typeof HISTORY_VARIABLES)[number];

export const PERIODS = ["day", "week", "month"] as const;
export type Period = (typeof PERIODS)[number];

export type Reading = { value: number; at: string };
export type DayRange = { min: Reading | null; max: Reading | null };

export type Current = {
  observed_at: string;
  values: Record<Metric, number | null>;
  today: Partial<Record<Metric, DayRange>>;
  station_url: string;
};

export type HistoryPoint = {
  at: string;
  avg: number | null;
  min: number | null;
  max: number | null;
  total: number | null;
};

export type History = { variable: HistoryVariable; period: Period; points: HistoryPoint[] };

export class ApiError extends Error {}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(body.detail ?? `HTTP ${response.status}`);
  }
  return response.json();
}

type ApiState<T> = { data: T | null; error: string | null; loading: boolean };

/** Fetches `url` and refetches every `refreshMs`; keeps the last good data on errors. */
export function useApi<T>(url: string, refreshMs: number): ApiState<T> {
  const [state, setState] = useState<ApiState<T>>({ data: null, error: null, loading: true });

  useEffect(() => {
    const controller = new AbortController();
    const load = () => {
      setState((prev) => ({ ...prev, loading: true }));
      fetchJson<T>(url, { signal: controller.signal })
        .then((data) => setState({ data, error: null, loading: false }))
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setState((prev) => ({ ...prev, error: String(error), loading: false }));
        });
    };
    load();
    const timer = window.setInterval(load, refreshMs);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [url, refreshMs]);

  return state;
}
