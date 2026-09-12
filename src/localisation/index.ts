import { useSyncExternalStore } from "react";
import { zh, templates } from "./catalogue";
export type Locale = "en" | "zh-CN";
const key = "heatpilot.locale";
const listeners = new Set<() => void>();
const normalise = (value: string | null): Locale =>
  value === "zh-CN" ? "zh-CN" : "en";
let locale: Locale = "en";
try {
  if (typeof window !== "undefined")
    locale = normalise(window.localStorage.getItem(key));
} catch {
  /* Private storage may be unavailable. */
}
export const getLocale = () => locale;
function announce() {
  document.documentElement.lang = locale === "en" ? "en-GB" : "zh-CN";
  document.title =
    locale === "en"
      ? "Heatpilot — District Heating Intelligence"
      : "Heatpilot — 区域供热智能运行";
  listeners.forEach((fn) => fn());
}
export function setLocale(next: Locale) {
  locale = normalise(next);
  try {
    localStorage.setItem(key, locale);
  } catch {
    /* Selection still works in memory. */
  }
  announce();
}
if (typeof window !== "undefined") {
  announce();
  window.addEventListener("storage", (e) => {
    if (e.key === key) {
      locale = normalise(e.newValue);
      announce();
    }
  });
}
export function useLocale() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    getLocale,
    () => "en" as Locale,
  );
}
const compiled = templates.map(([en, cn]) => {
  const parts = en.split(/(\{\d+\})/g);
  return {
    regex: new RegExp(
      "^" +
        parts
          .map((p) =>
            /^\{\d+\}$/.test(p)
              ? "(.+?)"
              : p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          )
          .join("") +
        "$",
    ),
    cn,
  };
});
export function translate(value: string, language: Locale = locale): string {
  if (language === "en" || !value.trim()) return value;
  // Never reinterpret JSON, identifiers, numeric values or source URLs.
  if (/^\s*[{[]/.test(value) || /^https?:/.test(value)) return value;
  const source = value.trim().replace(/\s+/g, " ");
  let translated = Object.prototype.hasOwnProperty.call(zh, source)
    ? zh[source]
    : undefined;
  if (!translated)
    for (const { regex, cn } of compiled) {
      const match = source.match(regex);
      if (match) {
        translated = cn.replace(/\{(\d+)\}/g, (_, i) => {
          const value = match[Number(i) + 1];
          return Object.prototype.hasOwnProperty.call(zh, value)
            ? zh[value]
            : value;
        });
        break;
      }
    }
  if (!translated && source.includes(" · "))
    return value
      .split(" · ")
      .map((part) => translate(part, language))
      .join(" · ");
  if (!translated) return value; // Safe English fallback for unknown backend messages.
  return (
    value.slice(0, value.length - value.trimStart().length) +
    translated +
    value.slice(value.trimEnd().length)
  );
}
// Preserve React elements, IDs passed as props, numbers and application state.
// Only presentation strings at explicit JSX boundaries are localised.
export function tx<T>(value: T): T {
  if (typeof value === "string") return translate(value) as T;
  if (Array.isArray(value)) return value.map((v) => tx(v)) as T;
  return value;
}
export const defaultBrief =
  "Investigate the selected asset using physical evidence. Test an alternative explanation and prepare a verified simulator intervention if appropriate.";
