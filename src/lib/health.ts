// Account-health math. Plain code, no AI: numbers must be exact.
// Thresholds come from PayPal's published seller rules.
export const RATE_LIMIT = 0.015; // 1.5% dispute rate
export const MIN_SALES_FOR_HIGH_VOLUME = 100; // >100 sales in 3 months
export const STANDARD_FEE = 15;
export const HIGH_VOLUME_FEE = 30;

export type Health = {
  sales: number;
  disputes: number;
  rate: number; // 0..1
  untracked: number;
  score: number; // 0..100
  disputesUntilCliff: number;
  status: "healthy" | "watch" | "danger";
  feePerDispute: number;
  responseDays: number;
  message: string;
};

export function computeHealth(sales: number, disputes: number, untracked: number): Health {
  const rate = sales > 0 ? disputes / sales : 0;
  // Smallest number of extra disputes that pushes the rate to 1.5% or above.
  const needed = Math.max(0, Math.ceil(RATE_LIMIT * sales - disputes));
  const disputesUntilCliff = rate >= RATE_LIMIT ? 0 : Math.max(1, needed);
  const overCliff = rate >= RATE_LIMIT && sales > MIN_SALES_FOR_HIGH_VOLUME;

  let score = 100;
  score -= Math.min(60, (rate / RATE_LIMIT) * 50);
  score -= Math.min(30, untracked * 5);
  score = Math.max(0, Math.round(score));

  const status: Health["status"] =
    rate >= RATE_LIMIT ? "danger" : rate >= RATE_LIMIT * 0.6 || untracked > 2 ? "watch" : "healthy";

  const message = overCliff
    ? `You are over PayPal's 1.5% dispute line. Each new dispute now costs $${HIGH_VOLUME_FEE} and you get only 3 days to respond.`
    : rate >= RATE_LIMIT
      ? `Your dispute rate is over 1.5%. Once you pass ${MIN_SALES_FOR_HIGH_VOLUME} sales, each dispute costs $${HIGH_VOLUME_FEE} and you get only 3 days to respond.`
      : `${disputesUntilCliff} more dispute${disputesUntilCliff === 1 ? "" : "s"} would push you past 1.5%. Then each dispute costs $${HIGH_VOLUME_FEE} instead of $${STANDARD_FEE}, and your response time drops from 10 days to 3.`;

  return {
    sales,
    disputes,
    rate,
    untracked,
    score,
    disputesUntilCliff,
    status,
    feePerDispute: overCliff ? HIGH_VOLUME_FEE : STANDARD_FEE,
    responseDays: overCliff ? 3 : 10,
    message,
  };
}
