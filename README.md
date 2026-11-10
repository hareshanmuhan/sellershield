# 🛡️ SellerShield

**AI that keeps small sellers' PayPal money safe and flowing.**

Small online sellers get their PayPal money held or their accounts limited, often because of small mistakes: no tracking on an order, a creeping dispute rate, or a dispute answered too late. SellerShield watches the account and fixes these through the PayPal APIs before they turn into lost money.

Built for the [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/).

## What it does

| Feature | AI part (Gemini) | PayPal part |
|---|---|---|
| **Account health + 1.5% cliff forecast** | — (exact math in code) | Disputes API, captured orders |
| **Tracking autopilot** | Reads a messy shipping email or label photo, extracts carrier + tracking number, matches the order | Orders v2 `POST /v2/checkout/orders/{id}/track` |
| **Stop a dispute before it starts** | Reads the buyer's message, rates dispute risk, suggests the cheapest fair fix, writes a reply | Payments v2 refund (only after seller approves) |
| **Dispute responder** | Recommends fight vs accept with money math, writes the evidence note | Disputes v1 `get`, `provide-evidence`, `accept-claim` |
| **Ask about my account** | Answers in plain language using the seller's real data | Orders + Disputes data |
| **Live events** | — | Webhooks (`CUSTOMER.DISPUTE.CREATED`, etc.) |

**Design rule:** the AI only proposes. Money moves only when the seller clicks approve, and amounts are checked in code (a refund can never exceed the order total).

## Run it locally

1. Node 20+ required.
2. `npm install`
3. Copy `.env.example` to `.env.local` and fill in:
   - `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `NEXT_PUBLIC_PAYPAL_CLIENT_ID` from your sandbox app at developer.paypal.com
   - `GEMINI_API_KEY` from https://aistudio.google.com/apikey
4. `npm run dev` and open http://localhost:3000

## Try the full flow (sandbox)

1. **Demo store** → buy an item, logging in with your sandbox **Personal** account. A real sandbox order is created and captured.
2. **Dashboard** → the order shows "Tracking: Missing" and counts toward "money waiting".
3. Paste a shipping email like `Your UPS package 1Z999AA10123456784 for the leather wallet has shipped` → **Read with AI** → **Send tracking to PayPal**.
4. Pick an order, paste a buyer complaint → **Check risk with AI** → **Approve refund**.
5. Open a dispute: log into https://www.sandbox.paypal.com as the buyer, open the transaction and report a problem. It appears under **Disputes** → **Draft response** → **Submit evidence**.
6. (Optional) Add a webhook in the dashboard pointing to `https://<your-host>/api/webhooks/paypal` and set `PAYPAL_WEBHOOK_ID`.

## What is simulated (and why)

- **Held funds:** the sandbox cannot create holds or account limitations, so the "money waiting" panel is labelled as simulated.
- **Sales history:** a new sandbox account has almost no sales, so the health score adds a labelled baseline (`DEMO_BASELINE_SALES=120`, `DEMO_BASELINE_DISPUTES=1`). Set both to `0` to use only live data.

Everything else calls the real PayPal sandbox APIs.

## Tech

Next.js 15 (App Router), TypeScript, Tailwind, PayPal REST APIs + JS SDK, Google Gemini (`gemini-2.5-flash`). Orders the app has seen are stored in `data/db.json`.

## License

MIT
