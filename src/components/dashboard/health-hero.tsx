"use client";
import { useEffect, useRef, useState } from "react";
import { animate, motion, useReducedMotion } from "motion/react";
import { Hint, money, type Health } from "./shared";
import { cn } from "@/lib/utils";

const statusCopy = {
  healthy: { headline: "Your shop is in good shape.", color: "var(--shield)" },
  watch: { headline: "Your shop needs a little attention.", color: "var(--marigold)" },
  danger: { headline: "Your PayPal account is at risk.", color: "var(--coral)" },
} as const;

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/** Counts from the last shown number to `value` (0 on first load); jumps straight there under reduced motion. */
function useCountUp(value: number) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? value : 0);
  const shown = useRef(reduce ? value : 0);
  useEffect(() => {
    if (reduce) {
      shown.current = value;
      return setN(value);
    }
    const controls = animate(shown.current, value, {
      duration: 1.2,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        shown.current = v;
        setN(Math.round(v));
      },
    });
    return () => controls.stop();
  }, [value, reduce]);
  return n;
}

function ScoreRing({ score, color }: { score: number; color: string }) {
  const n = useCountUp(score);
  const r = 82;
  return (
    <div className="relative size-52 shrink-0" role="img" aria-label={`Account health ${score} out of 100`}>
      <svg viewBox="0 0 200 200" className="size-full -rotate-90">
        <circle cx="100" cy="100" r={r} fill="none" stroke="var(--muted)" strokeWidth="16" />
        {/* tick marks every 10 points, like a gauge */}
        {Array.from({ length: 10 }).map((_, i) => {
          const a = (i / 10) * Math.PI * 2;
          return (
            <line
              key={i}
              x1={100 + Math.cos(a) * 64}
              y1={100 + Math.sin(a) * 64}
              x2={100 + Math.cos(a) * 69}
              y2={100 + Math.sin(a) * 69}
              stroke="var(--border)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          );
        })}
        <motion.circle
          cx="100"
          cy="100"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="16"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: score / 100 }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden>
        <span className="font-heading text-6xl font-extrabold tabular-nums leading-none">{n}</span>
        <span className="text-sm text-muted-foreground mt-1">out of 100</span>
      </div>
    </div>
  );
}

export function HealthHero({ health, heldTotal, heldCount }: { health: Health | null; heldTotal: number; heldCount: number }) {
  if (!health) {
    return (
      <section className="flex items-center gap-8 py-4" aria-busy>
        <div className="size-52 rounded-full border-[16px] border-muted animate-pulse" />
        <p className="text-muted-foreground">Checking your account…</p>
      </section>
    );
  }
  const copy = statusCopy[health.status];
  const ratePct = health.rate * 100;
  const meter = Math.min(100, (health.rate / 0.015) * 100);

  return (
    <section className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-10 py-2">
      <ScoreRing score={health.score} color={copy.color} />
      <div className="flex-1 min-w-0 flex flex-col gap-4">
        <div>
          <p className="text-muted-foreground">{greeting()}.</p>
          <h1 className="font-heading text-4xl sm:text-5xl font-extrabold mt-1 text-balance">{copy.headline}</h1>
        </div>

        <div className="max-w-md">
          <div className="flex flex-wrap items-center justify-between gap-x-4 text-sm mb-1.5">
            <span className="flex items-center gap-1 whitespace-nowrap">
              Disputes: <b className="tabular-nums">{ratePct.toFixed(2)}%</b> of sales
              <Hint>
                A dispute is when a buyer asks PayPal to step in. PayPal gets strict once more than 1.5% of your sales end
                in one: higher fees and less time to reply.
              </Hint>
            </span>
            <span className="text-muted-foreground">PayPal&apos;s line: 1.5%</span>
          </div>
          <div className="relative h-3 rounded-full bg-muted overflow-hidden">
            <motion.div
              className={cn("h-full rounded-full", health.status === "danger" ? "bg-coral" : health.status === "watch" ? "bg-marigold" : "bg-shield")}
              initial={{ width: 0 }}
              animate={{ width: `${meter}%` }}
              transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <p className="text-sm mt-2 text-pretty">{health.message}</p>
        </div>

        <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <div>
            <div className="font-heading text-2xl font-bold tabular-nums">{money(heldTotal)}</div>
            <div className="text-muted-foreground flex items-center gap-1">
              waiting on {heldCount} order{heldCount === 1 ? "" : "s"} without tracking
              <Hint>
                PayPal can hold a new seller&apos;s money for up to 21 days. Adding tracking usually gets it released about a
                day after delivery. Holds are simulated here because the sandbox can&apos;t create them.
              </Hint>
            </div>
          </div>
          <div>
            <div className="font-heading text-2xl font-bold tabular-nums">{health.sales}</div>
            <div className="text-muted-foreground flex items-center gap-1">
              sales in 90 days
              <Hint>
                Includes {health.baseline.sales} simulated past sales and {health.baseline.disputes} past dispute so the demo
                has history. Live sandbox data: {health.liveSales} sales, {health.liveDisputes} disputes.
              </Hint>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
