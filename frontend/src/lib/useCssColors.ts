import { useEffect, useState } from "react";

const NAMES = ["primary", "accent-soft", "muted-fg", "border", "chart-band", "card"] as const;
export type CssColors = Record<(typeof NAMES)[number], string>;

function read(): CssColors {
  const style = getComputedStyle(document.documentElement);
  return Object.fromEntries(
    NAMES.map((name) => [name, style.getPropertyValue(`--${name}`).trim()]),
  ) as CssColors;
}

/** Canvas can't use CSS variables, so charts re-read them whenever the OS theme flips. */
export function useCssColors(): CssColors {
  const [colors, setColors] = useState(read);
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setColors(read());
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return colors;
}
