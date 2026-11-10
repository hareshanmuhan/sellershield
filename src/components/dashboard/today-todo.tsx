"use client";
import { motion } from "motion/react";
import { MessageCircleWarning, PackageSearch, Scale, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { expectedLabel, money, plainReason, type EarningsMap, type Order, type TabKey } from "./shared";

type Todo = { id: string; icon: React.ReactNode; title: string; why: string; cta: string; tab: TabKey; orderId?: string; urgent?: boolean };

export function buildTodos(orders: Order[], disputes: any[], earnings: EarningsMap = {}): Todo[] {
  const todos: Todo[] = [];
  for (const d of disputes) {
    if (d.status !== "WAITING_FOR_SELLER_RESPONSE" && d.status !== "OPEN") continue;
    todos.push({
      id: `d-${d.dispute_id}`,
      icon: <Scale />,
      title: `Answer a dispute for ${money(d.dispute_amount?.value || 0)}`,
      why: `${plainReason(d.reason)}. If you don't reply in time, PayPal sides with the buyer.`,
      cta: "Answer it",
      tab: "disputes",
      urgent: true,
    });
  }
  for (const o of orders) {
    if (o.risk && o.risk.level !== "low" && !o.refunded) {
      todos.push({
        id: `r-${o.orderId}`,
        icon: <MessageCircleWarning />,
        title: `Reply to the buyer of ${o.item}`,
        why: `They sound ${o.risk.level === "high" ? "very " : ""}unhappy. A quick fix now costs less than a dispute fee.`,
        cta: "See the reply",
        tab: "buyers",
        orderId: o.orderId,
      });
    }
  }
  for (const o of orders) {
    if (!o.tracking && !o.refunded) {
      todos.push({
        id: `t-${o.orderId}`,
        icon: <PackageSearch />,
        title: `Add tracking for ${o.item}`,
        why: (() => {
          const exp = expectedLabel(earnings[o.orderId]);
          return exp
            ? `Without tracking, ${money(earnings[o.orderId].kept)} may be held until ${exp.date}. With it, about a day after delivery.`
            : `PayPal may hold this ${money(o.amount)} until it can see the parcel moving.`;
        })(),
        cta: "Add tracking",
        tab: "shipping",
        orderId: o.orderId,
      });
    }
  }
  return todos;
}

export function TodayTodo({ todos, loading, atRisk, onGo }: { todos: Todo[]; loading?: boolean; atRisk?: boolean; onGo: (tab: TabKey, orderId?: string) => void }) {
  return (
    <section className="rounded-2xl bg-card border overflow-hidden shadow-[0_1px_0_var(--border)]" aria-labelledby="todo-title">
      <div className="tape h-2" aria-hidden />
      <div className="p-5 sm:p-6">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="todo-title" className="font-heading text-2xl font-bold">Today&apos;s to-do</h2>
          {todos.length > 0 && <span className="text-sm text-muted-foreground">{todos.length} thing{todos.length === 1 ? "" : "s"}</span>}
        </div>

        {loading ? (
          <div className="mt-4 flex flex-col gap-3" aria-busy>
            {[0, 1].map((i) => <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />)}
          </div>
        ) : todos.length === 0 ? (
          <div className="flex items-center gap-3 mt-4 text-muted-foreground">
            <PartyPopper className="size-6 text-shield" />
            <p>
              You&apos;re all caught up. Every order has tracking and no buyer is waiting on you.
              {atRisk && " Your dispute rate is still high, so answer buyer messages quickly to keep it from growing."}
            </p>
          </div>
        ) : (
          <ul className="mt-3 divide-y">
            {todos.slice(0, 5).map((t, i) => (
              <motion.li
                key={t.id}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.08, duration: 0.35 }}
                className="flex items-start gap-3 py-3"
              >
                <span
                  className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full [&_svg]:size-[18px] ${
                    t.urgent ? "bg-coral-soft text-coral" : "bg-marigold-soft text-marigold-ink"
                  }`}
                >
                  {t.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold leading-snug">{t.title}</div>
                  <div className="text-sm text-muted-foreground">{t.why}</div>
                </div>
                <Button size="sm" variant={t.urgent ? "default" : "outline"} onClick={() => onGo(t.tab, t.orderId)} className="shrink-0">
                  {t.cta}
                </Button>
              </motion.li>
            ))}
          </ul>
        )}
        {todos.length > 5 && <p className="text-sm text-muted-foreground mt-2">And {todos.length - 5} more in the tabs below.</p>}
      </div>
    </section>
  );
}
