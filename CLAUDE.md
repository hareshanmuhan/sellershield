# SellerShield

PayPal AI Hackathon project (Devpost, deadline **Nov 13, 1:30 AM IST**).

SellerShield is an AI account-health agent for small PayPal sellers. Next.js 15 (App Router) + TypeScript + Tailwind.

## Features
- **Account health score** with a forecast of PayPal's 1.5% dispute-rate cliff (exact math in `src/lib/health.ts`, no AI).
- **AI tracking autopilot**: reads shipping emails / label photos, extracts carrier + tracking number, adds tracking via Orders v2 `POST /v2/checkout/orders/{id}/track`.
- **AI pre-dispute fixer**: rates buyer messages for dispute risk, suggests a refund via Payments v2 refund, only after the seller approves.
- **AI dispute responder**: Disputes API `provide-evidence` / `accept-claim`.
- **Real earnings + money countdown**: fee/net from the capture's `seller_receivable_breakdown`, ~3% currency loss, INR estimate from the FBIL rate (`src/lib/earnings.ts`, `fx.ts`). All fees and rules live in `src/lib/config.ts`.
- **Scam Radar**: code rules (`src/lib/scam.ts`) + Gemini; the code verdict is a floor the AI can't lower.
- **Proof Vault**: up to 3 packing photos per order in `data/proof/<orderId>/`, checked by Gemini vision; attached to dispute evidence.
- **Chat agent** (`src/lib/agent.ts`): Gemini function calling. Read-only tools run directly; tracking, refunds and dispute answers become confirm cards.

## Key files
- `src/lib/gemini.ts`: Google Gemini via REST (`askJSON`), model from `GEMINI_MODEL` (default `gemini-2.5-flash`).
- `src/lib/paypal.ts`: PayPal sandbox REST client.
- `src/lib/store.ts`: local order store in `data/db.json`.
- `src/app/api/*`: route handlers (orders, capture, tracking, risk, refund, disputes, assistant, health, webhooks).
- `src/app/page.tsx`: seller dashboard. `src/app/store/page.tsx`: demo store for creating sandbox orders.

## Rules
- The AI only proposes; money moves only on explicit seller approval, and amounts are validated in code (refund never exceeds the order total).
- Secrets live in `.env.local` (gitignored). Never print or commit them, and never ask the user to paste the PayPal secret into chat.
- Held funds and baseline sales history are simulated (sandbox limitation) and must stay labelled as such.

## Sandbox gotchas (found while testing)
- Use US sandbox accounts (app "SellerShield-US"). India-registered sandbox accounts fail checkout with a generic PayPal error.
- The store's `PayPalScriptProvider` sets `buyerCountry: "US"` so checkout works when testing from a non-US IP.
- New disputes can take a few minutes to appear in the unfiltered `GET /v1/customer/disputes` list.
- For item-not-received disputes, `provide-evidence` rejects `evidence_type: OTHER` (`EVIDENCE_TYPE_IS_NOT_ALLOWED`); send tracking (`PROOF_OF_FULFILLMENT`).
- Sandbox test buyer login lives in `sandbox-buyer.local.txt` (gitignored).
- `provide-evidence` only works while the dispute is `WAITING_FOR_SELLER_RESPONSE`; otherwise `ACTION_NOT_ALLOWED_IN_CURRENT_DISPUTE_STATE`.
- The payer only comes back with a country code (no full address), so Scam Radar compares countries and names.
- Captures under dispute may have no `seller_receivable_breakdown`; earnings then use the labelled fee estimate.
- Sandbox buyer emails end in example.com; the Scam Radar prompt tells Gemini not to judge by email.
- The store's PayPal popup doesn't open when the in-app browser pane is hidden; use `/checkoutnow?token=<orderId>&locale.x=en_US&country.x=US`, then call the capture route.

See `README.md` for setup and the full sandbox test flow.
