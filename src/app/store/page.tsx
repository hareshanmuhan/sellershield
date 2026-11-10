"use client";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Camera, Coffee, Wallet } from "lucide-react";

const PRODUCTS = [
  { name: "Handmade leather wallet", price: "45.00", icon: Wallet, tint: "bg-marigold-soft text-marigold-ink" },
  { name: "Vintage film camera", price: "120.00", icon: Camera, tint: "bg-shield-soft text-shield" },
  { name: "Ceramic coffee mug set", price: "28.00", icon: Coffee, tint: "bg-coral-soft text-coral" },
];

// A tiny storefront that creates REAL sandbox orders, so the dashboard has real PayPal data.
// Log in with your sandbox Personal (buyer) account when the PayPal window opens.
export default function Store() {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "";

  if (!clientId) {
    return (
      <p className="rounded-2xl border bg-card p-6">Add NEXT_PUBLIC_PAYPAL_CLIENT_ID to .env.local to load checkout.</p>
    );
  }

  return (
    // buyerCountry pins the sandbox checkout to a US buyer even when testing from another country's IP.
    <PayPalScriptProvider options={{ clientId, currency: "USD", intent: "capture", locale: "en_US", buyerCountry: "US" }}>
      <h1 className="font-heading text-4xl font-extrabold">Demo store</h1>
      <p className="text-muted-foreground mt-2 mb-8 max-w-xl">
        A pretend shop for testing. Pay with your sandbox buyer account; each purchase becomes a real sandbox order on
        your dashboard. No real money moves.
      </p>
      <div className="grid md:grid-cols-3 gap-5">
        {PRODUCTS.map((p, i) => (
          <motion.div
            key={p.name}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.35 }}
            className="rounded-2xl border bg-card p-5 flex flex-col gap-4"
          >
            <div className={`h-36 rounded-xl flex items-center justify-center ${p.tint}`}>
              <p.icon className="size-14" strokeWidth={1.5} />
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <div className="font-heading text-lg font-bold leading-tight">{p.name}</div>
              <div className="font-heading text-xl font-bold tabular-nums">${p.price}</div>
            </div>
            <PayPalButtons
              style={{ layout: "vertical", height: 40 }}
              createOrder={async () => {
                const r = await fetch("/api/orders", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ amount: p.price, item: p.name }),
                });
                const d = await r.json();
                if (!r.ok) throw new Error(d.error);
                return d.id;
              }}
              onApprove={async (data) => {
                const r = await fetch(`/api/orders/${data.orderID}/capture`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ item: p.name }),
                });
                const d = await r.json();
                if (r.ok) toast.success(`Paid for ${p.name}`, { description: "It's on your dashboard now, under Orders." });
                else toast.error("Payment went through but saving the order failed", { description: d.error });
              }}
              onError={(err) => toast.error("PayPal checkout stopped", { description: String(err) })}
            />
          </motion.div>
        ))}
      </div>
    </PayPalScriptProvider>
  );
}
