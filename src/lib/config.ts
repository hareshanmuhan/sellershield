// Every fee, rate and rule SellerShield uses for money math, in one place.
// Rates as of Nov 2026. Check PayPal's fee page before relying on them for real money.
// The AI never does this math; plain code reads these numbers.

export const RATES_AS_OF = "Nov 2026";

/** Used only when PayPal's own fee breakdown isn't available for an order. */
export const PAYPAL_FEE_ESTIMATE = { percent: 0.0349, fixedUsd: 0.49 };

/** PayPal keeps its original fee when you refund a buyer (full or partial). */
export const REFUND_RETURNS_FEE = false;

/** Dispute fees and the 1.5% "high dispute rate" line. */
export const DISPUTE_FEE_STANDARD = 15;
export const DISPUTE_FEE_HIGH_VOLUME = 30;
export const DISPUTE_RATE_LIMIT = 0.015;
export const MIN_SALES_FOR_HIGH_VOLUME = 100;

/** Typical spread when PayPal converts USD to INR, on top of the market rate. */
export const CURRENCY_LOSS_PERCENT = 0.03;

/** Money-release rules (rule of thumb, not a PayPal promise). */
export const HOLD_DAYS_NO_TRACKING = 21;
export const RELEASE_DAYS_AFTER_DELIVERY = 1;
/** We can't read carrier delivery dates, so assume this transit time after tracking is added. */
export const ASSUMED_TRANSIT_DAYS = 5;

/** Free FBIL reference rate (Reserve Bank of India's benchmark), with a fallback source. */
export const FX_PRIMARY_URL = "https://api.frankfurter.dev/v2/providers/fbil/rates?base=USD&quotes=INR";
export const FX_FALLBACK_URL = "https://api.frankfurter.dev/v1/latest?base=USD&symbols=INR";
export const FX_CACHE_MINUTES = 360;
