# SellerShield

PayPal AI Hackathon project (Devpost, deadline **Nov 13, 1:30 AM IST**).

SellerShield is an AI account-health agent for small PayPal sellers. Next.js 15 (App Router) + TypeScript + Tailwind.

## Features
- **Account health score** with a forecast of PayPal's 1.5% dispute-rate cliff (exact math in `src/lib/health.ts`, no AI).
- **AI tracking autopilot**: reads shipping emails / label photos, extracts carrier + tracking number, adds tracking via Orders v2 `POST /v2/checkout/orders/{id}/track`.
- **AI pre-dispute fixer**: rates buyer messages for dispute risk, suggests a refund via Payments v2 refund, only after the seller approves.
- **AI dispute responder**: Disputes API `provide-evidence` / `accept-claim`.
- **"Ask about my account" chat** grounded in the seller's real orders/disputes.

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

See `README.md` for setup and the full sandbox test flow.
