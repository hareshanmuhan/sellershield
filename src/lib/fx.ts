import { FX_CACHE_MINUTES, FX_FALLBACK_URL, FX_PRIMARY_URL } from "./config";

export type FxRate = { rate: number; date: string; source: "FBIL" | "ECB (fallback)" };

let cached: { value: FxRate; at: number } | null = null;

/** USD -> INR reference rate. FBIL first, then the ECB-based fallback. Cached for a few hours. */
export async function getUsdInr(): Promise<FxRate | null> {
  if (cached && Date.now() - cached.at < FX_CACHE_MINUTES * 60_000) return cached.value;
  let value: FxRate | null = null;
  try {
    const rows = await (await fetch(FX_PRIMARY_URL, { cache: "no-store", signal: AbortSignal.timeout(8000) })).json();
    const row = Array.isArray(rows) ? rows.find((r: any) => r.base === "USD" && r.quote === "INR") : null;
    if (row?.rate > 0) value = { rate: Number(row.rate), date: row.date, source: "FBIL" };
  } catch {}
  if (!value) {
    try {
      const d = await (await fetch(FX_FALLBACK_URL, { cache: "no-store", signal: AbortSignal.timeout(8000) })).json();
      if (d?.rates?.INR > 0) value = { rate: Number(d.rates.INR), date: d.date, source: "ECB (fallback)" };
    } catch {}
  }
  if (value) cached = { value, at: Date.now() };
  return value;
}
