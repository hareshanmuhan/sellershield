"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, type EarningsMap, type Health, type Order, type TabKey } from "@/components/dashboard/shared";
import { HealthHero } from "@/components/dashboard/health-hero";
import { WelcomeBanner } from "@/components/dashboard/welcome-banner";
import { TodayTodo, buildTodos } from "@/components/dashboard/today-todo";
import { BuyersPanel, DisputesPanel, OrdersPanel, ShippingPanel, UpdatesPanel } from "@/components/dashboard/panels";
import { ChatSheet } from "@/components/dashboard/chat-sheet";

const tabs: { key: TabKey; label: string }[] = [
  { key: "orders", label: "Orders" },
  { key: "shipping", label: "Add tracking" },
  { key: "buyers", label: "Unhappy buyers" },
  { key: "disputes", label: "Disputes" },
  { key: "updates", label: "PayPal news" },
];

export default function Dashboard() {
  const [health, setHealth] = useState<Health | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [earnings, setEarnings] = useState<EarningsMap>({});
  const [tab, setTab] = useState<TabKey>("orders");
  const [focus, setFocus] = useState("");
  const tabsRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const [h, o, e] = await Promise.all([api<Health>("/api/health"), api<Order[]>("/api/orders"), api("/api/webhooks/paypal")]);
      setHealth(h);
      setOrders(o);
      setEvents(e);
      api("/api/disputes").then(setDisputes).catch(() => setDisputes([]));
      api("/api/earnings").then((r) => setEarnings(r.orders)).catch(() => {});
    } catch (e: any) {
      toast.error("Couldn't load your account", { description: e.message });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const held = orders.filter((o) => !o.tracking && !o.refunded);
  const heldTotal = held.reduce((s, o) => s + Number(o.amount || 0), 0);
  const todos = useMemo(() => buildTodos(orders, disputes, earnings), [orders, disputes, earnings]);

  const go = useCallback((t: TabKey, orderId?: string) => {
    setTab(t);
    if (orderId) setFocus(orderId);
    tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const counts: Partial<Record<TabKey, number>> = {
    shipping: held.length,
    buyers: orders.filter((o) => o.risk && o.risk.level !== "low" && !o.refunded).length,
    disputes: disputes.filter((d) => d.status === "WAITING_FOR_SELLER_RESPONSE").length,
  };

  return (
    <>
      <WelcomeBanner />

      <div className="grid xl:grid-cols-[1.4fr_1fr] gap-8 items-start">
        <HealthHero health={health} heldTotal={heldTotal} heldCount={held.length} />
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.4 }}>
          <TodayTodo todos={todos} loading={!health} atRisk={health?.status === "danger"} onGo={go} />
        </motion.div>
      </div>

      <div ref={tabsRef} className="mt-12 scroll-mt-20">
        {/* min-w-0: the Tabs root is a flex container, so without it the tab bar widens the whole page on phones. */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="min-w-0">
          <div className="relative min-w-0 max-w-full overflow-x-auto -mx-4 px-4 pb-1">
            <TabsList className="h-auto bg-card border p-1 rounded-full">
              {tabs.map((t) => (
                <TabsTrigger
                  key={t.key}
                  value={t.key}
                  className="rounded-full px-4 py-2 text-[15px] font-bold data-[state=active]:bg-pine data-[state=active]:text-white data-[state=active]:shadow-none"
                >
                  {t.label}
                  {!!counts[t.key] && (
                    <span className="ml-1 inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-marigold px-1.5 text-xs text-pine">
                      {counts[t.key]}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>

        <div className="mt-4 rounded-2xl border bg-card p-5 sm:p-7 min-h-64">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tab}
              role="tabpanel"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              {tab === "orders" && <OrdersPanel orders={orders} earnings={earnings} onGo={go} />}
              {tab === "shipping" && <ShippingPanel orders={orders} focus={focus} onDone={refresh} />}
              {tab === "buyers" && <BuyersPanel orders={orders} focus={focus} onDone={refresh} />}
              {tab === "disputes" && <DisputesPanel disputes={disputes} onDone={refresh} />}
              {tab === "updates" && <UpdatesPanel events={events} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <ChatSheet health={health} orders={orders} onChanged={refresh} onGo={go} />
    </>
  );
}
