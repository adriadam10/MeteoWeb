import { i18n } from "@lingui/core";

const MS_TO_KMH = 3.6;

export function formatNumber(value: number | null | undefined, digits = 1): string {
  if (value == null) return "—";
  return new Intl.NumberFormat(i18n.locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** Weathercloud reports wind in m/s; km/h is what people here read. */
export const toKmh = (ms: number | null | undefined) => (ms == null ? null : ms * MS_TO_KMH);

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat(i18n.locale, { hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso),
  );
}

/** Date only when it isn't today: a frame from 10 minutes ago just needs the time. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const sameDay = date.toDateString() === new Date().toDateString();
  return new Intl.DateTimeFormat(i18n.locale, {
    ...(sameDay ? {} : { day: "numeric", month: "short" }),
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatRelative(iso: string, now: number): string {
  const minutes = Math.round((new Date(iso).getTime() - now) / 60_000);
  const rtf = new Intl.RelativeTimeFormat(i18n.locale, { numeric: "auto" });
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  return rtf.format(Math.round(minutes / 60), "hour");
}

const COMPASS_POINTS = 16;

/** Index 0..15 into N, NNE, NE… so the label can be translated by the caller. */
export const compassIndex = (degrees: number) =>
  Math.round((((degrees % 360) + 360) % 360) / (360 / COMPASS_POINTS)) % COMPASS_POINTS;
