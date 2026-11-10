"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { ArrowUp, Check, PackageCheck, Undo2, ArrowRightCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ShieldMark } from "@/components/site-header";
import { cn } from "@/lib/utils";
import { api, money, type Health, type Order, type TabKey } from "./shared";
import { RefundDialog } from "./refund-dialog";

type Action =
  | { type: "add_tracking"; orderId: string; item?: string; soldAt?: string; carrier: string; trackingNumber: string }
  | { type: "refund"; orderId: string; item?: string; soldAt?: string; amount: string; note?: string }
  | { type: "open"; tab: TabKey; orderId?: string; item?: string; label?: string };

type Msg = { id: number; role: "user" | "bot"; text: string; actions?: Action[] };
type CardState = "waiting" | "running" | "done" | "skipped";

const starters = ["What should I do first today?", "Why could my money be held?", "How close am I to PayPal's dispute line?"];

export function ChatSheet({
  health,
  orders,
  onChanged,
  onGo,
}: {
  health: Health | null;
  orders: Order[];
  onChanged: () => void;
  onGo: (tab: TabKey, orderId?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [cards, setCards] = useState<Record<string, CardState>>({});
  const [refund, setRefund] = useState<{ key: string; action: Extract<Action, { type: "refund" }> } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, busy]);

  async function ask(text: string) {
    if (!text.trim() || busy) return;
    const history = msgs.map((m) => ({ role: m.role, text: m.text }));
    setMsgs((m) => [...m, { id: nextId.current++, role: "user", text }]);
    setQ("");
    setBusy(true);
    try {
      const r = await api("/api/assistant", { question: text, health, history });
      setMsgs((m) => [...m, { id: nextId.current++, role: "bot", text: r.answer, actions: r.actions }]);
    } catch (e: any) {
      setMsgs((m) => [...m, { id: nextId.current++, role: "bot", text: `I couldn't answer that: ${e.message}` }]);
    }
    setBusy(false);
  }

  const mark = (key: string, s: CardState) => setCards((c) => ({ ...c, [key]: s }));

  async function run(key: string, a: Action) {
    if (a.type === "open") {
      setOpen(false);
      onGo(a.tab, a.orderId);
      return;
    }
    if (a.type === "refund") {
      setRefund({ key, action: a });
      return;
    }
    mark(key, "running");
    try {
      await api("/api/tracking/apply", { orderId: a.orderId, carrier: a.carrier, trackingNumber: a.trackingNumber });
      toast.success("Tracking added to PayPal", { description: `${a.item}: ${a.carrier} ${a.trackingNumber}` });
      mark(key, "done");
      onChanged();
    } catch (e: any) {
      toast.error("PayPal didn't accept the tracking", { description: e.message });
      mark(key, "waiting");
    }
  }

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.div
            className="fixed bottom-5 right-5 z-40"
            initial={{ opacity: 0, scale: 0.85, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 380, damping: 26, delay: 0.6 }}
          >
            <Button
              onClick={() => setOpen(true)}
              className="h-14 rounded-full pl-3 pr-5 text-base font-bold shadow-[0_8px_24px_-8px_rgba(23,48,42,0.55)] bg-pine hover:bg-pine/90"
            >
              <ShieldMark className="size-8" />
              Ask SellerShield
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-md p-0 gap-0 bg-background">
          <SheetHeader className="border-b bg-card px-5 py-4">
            <SheetTitle className="font-heading text-xl flex items-center gap-2">
              <ShieldMark className="size-7" /> Ask SellerShield
            </SheetTitle>
            <SheetDescription>Answers come from your real orders. I suggest; you decide.</SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3" aria-live="polite">
            {msgs.length === 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-muted-foreground">Try one of these:</p>
                {starters.map((s) => (
                  <button
                    key={s}
                    onClick={() => ask(s)}
                    className="text-left rounded-xl border bg-card px-4 py-3 font-bold hover:border-shield hover:bg-shield-soft/50 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {msgs.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22 }}
                className={cn("flex flex-col gap-2", m.role === "user" ? "items-end" : "items-start")}
              >
                <div
                  className={cn(
                    "max-w-[88%] rounded-2xl px-4 py-2.5 whitespace-pre-wrap",
                    m.role === "user" ? "bg-pine text-white rounded-br-md" : "bg-card border rounded-bl-md"
                  )}
                >
                  {m.text}
                </div>
                {m.actions?.map((a, i) => {
                  const key = `${m.id}-${i}`;
                  return <ActionCard key={key} action={a} state={cards[key] || "waiting"} onYes={() => run(key, a)} onNo={() => mark(key, "skipped")} />;
                })}
              </motion.div>
            ))}

            {busy && (
              <div className="flex gap-1.5 px-4 py-3 rounded-2xl bg-card border w-fit" aria-label="SellerShield is thinking">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="size-2 rounded-full bg-shield"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form
            className="border-t bg-card p-3 flex gap-2 items-end"
            onSubmit={(e) => {
              e.preventDefault();
              ask(q);
            }}
          >
            <Textarea
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask(q);
                }
              }}
              rows={1}
              placeholder="Ask about your money, orders or disputes"
              aria-label="Your question"
              className="min-h-11 max-h-32 resize-none"
            />
            <Button type="submit" size="icon" className="size-11 shrink-0 rounded-full" disabled={busy || !q.trim()} aria-label="Send">
              <ArrowUp />
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      <RefundDialog
        order={orders.find((o) => o.orderId === refund?.action.orderId)}
        amount={refund?.action.amount || ""}
        note={refund?.action.note || "Refund from seller"}
        open={!!refund}
        onOpenChange={(o) => !o && setRefund(null)}
        onDone={() => {
          if (refund) mark(refund.key, "done");
          onChanged();
        }}
      />
    </>
  );
}

function ActionCard({ action, state, onYes, onNo }: { action: Action; state: CardState; onYes: () => void; onNo: () => void }) {
  // Several orders can share an item name, so say when this one sold.
  const sold =
    "soldAt" in action && action.soldAt
      ? `Sold ${new Date(action.soldAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
      : "";
  const view =
    action.type === "add_tracking"
      ? { icon: <PackageCheck />, title: `Add tracking to ${action.item ?? "this order"}`, detail: `${action.carrier} ${action.trackingNumber}`, yes: "Add tracking", done: "Tracking added" }
      : action.type === "refund"
        ? { icon: <Undo2 />, title: `Refund ${money(action.amount)} for ${action.item ?? "this order"}`, detail: "You'll see the amount once more before it's sent.", yes: "Review refund", done: "Refunded" }
        : { icon: <ArrowRightCircle />, title: action.label || "Open the right screen", detail: action.item, yes: "Take me there", done: "" };

  if (action.type === "open") {
    return (
      <Button variant="outline" size="sm" onClick={onYes} className="bg-card">
        <ArrowRightCircle /> {view.title}
      </Button>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: state === "skipped" ? 0.55 : 1, scale: 1 }}
      className="w-[88%] rounded-xl border-2 border-dashed border-marigold bg-marigold-soft/60 p-3"
    >
      <div className="flex gap-2.5">
        <span className="mt-0.5 text-marigold-ink [&_svg]:size-5">{view.icon}</span>
        <div className="min-w-0">
          <div className="font-bold leading-snug">{view.title}</div>
          {sold && <div className="text-sm text-muted-foreground">{sold}</div>}
          {view.detail && <div className="text-sm text-muted-foreground break-words">{view.detail}</div>}
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        {state === "done" ? (
          <span className="inline-flex items-center gap-1.5 font-bold text-shield"><Check className="size-4" /> {view.done}</span>
        ) : state === "skipped" ? (
          <span className="text-sm text-muted-foreground">Skipped</span>
        ) : (
          <>
            <Button size="sm" onClick={onYes} disabled={state === "running"}>{state === "running" ? "Working…" : view.yes}</Button>
            <Button size="sm" variant="ghost" onClick={onNo} disabled={state === "running"}>Not now</Button>
          </>
        )}
      </div>
    </motion.div>
  );
}
