import { useLingui } from "@lingui/react/macro";
import { Download, ExternalLink, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import type { Current } from "../lib/api";
import { formatRelative } from "../lib/format";
import { changeLocale, LOCALES, type Locale } from "../lib/i18n";
import { useInstall } from "../lib/pwa";

const STALE_AFTER_MS = 30 * 60_000;

export function Header({ current, error }: { current: Current | null; error: string | null }) {
  const { t } = useLingui();
  const now = useNow(30_000);
  const stale = current && now - new Date(current.observed_at).getTime() > STALE_AFTER_MS;

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 lg:px-6">
      <div className="flex items-center gap-3">
        <img src="/logo.svg" alt="" className="size-9" />
        <div>
          <h1 className="text-xl font-semibold leading-tight">MeteoWeb</h1>
          <p className="text-sm text-muted-fg" aria-live="polite">
            {current
              ? t`Updated ${formatRelative(current.observed_at, now)}`
              : error
                ? ""
                : t`Loading…`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {(error || stale) && (
          <span
            role="status"
            className="flex items-center gap-1.5 rounded-full border border-danger/40 px-3 py-1 text-sm text-danger"
          >
            <WifiOff aria-hidden className="size-4" />
            {error ? t`Station unreachable` : t`Station data is old`}
          </span>
        )}
        {current && (
          <a
            href={current.station_url}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm text-muted-fg transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-primary"
          >
            Weathercloud
            <ExternalLink aria-hidden className="size-4" />
          </a>
        )}
        <InstallButton />
        <LocalePicker />
      </div>
    </header>
  );
}

// Only while Chrome offers it; elsewhere the browser menu installs it.
function InstallButton() {
  const { t } = useLingui();
  const install = useInstall();
  if (!install) return null;
  return (
    <button
      type="button"
      onClick={install}
      className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted-fg transition-colors hover:bg-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-primary"
    >
      <Download aria-hidden className="size-4" />
      {t`Install app`}
    </button>
  );
}

function LocalePicker() {
  const { t, i18n } = useLingui();
  return (
    <fieldset className="flex rounded-full border border-border p-0.5">
      <legend className="sr-only">{t`Language`}</legend>
      {(Object.keys(LOCALES) as Locale[]).map((locale) => (
        <button
          key={locale}
          type="button"
          lang={locale}
          aria-pressed={i18n.locale === locale}
          title={LOCALES[locale].name}
          onClick={() => changeLocale(locale)}
          className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-sm text-muted-fg transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-primary aria-pressed:bg-muted aria-pressed:text-fg"
        >
          <Flag locale={locale} />
          {LOCALES[locale].label}
        </button>
      ))}
    </fieldset>
  );
}

// Inline SVG flags: Windows does not render flag emoji.
function Flag({ locale }: { locale: Locale }) {
  if (locale === "es") {
    return (
      <svg aria-hidden viewBox="0 0 3 2" className="h-3 w-[18px] rounded-[2px]">
        <rect width="3" height="2" fill="#c60b1e" />
        <rect width="3" height="1" y="0.5" fill="#ffc400" />
      </svg>
    );
  }
  return (
    <svg aria-hidden viewBox="0 0 60 30" className="h-3 w-[18px] rounded-[2px]">
      <clipPath id="flag-gb">
        <path d="M0 0v30h60V0z" />
      </clipPath>
      <g clipPath="url(#flag-gb)">
        <path d="M0 0v30h60V0z" fill="#012169" />
        <path d="M0 0l60 30m0-30L0 30" stroke="#fff" strokeWidth="6" />
        <path d="M0 0l60 30m0-30L0 30" stroke="#C8102E" strokeWidth="4" />
        <path d="M30 0v30M0 15h60" stroke="#fff" strokeWidth="10" />
        <path d="M30 0v30M0 15h60" stroke="#C8102E" strokeWidth="6" />
      </g>
    </svg>
  );
}

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}
