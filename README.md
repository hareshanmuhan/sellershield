# 🛡️ SellerShield

**AI bodyguard for small sellers going global: stops scams before you ship, proves you shipped right, shows what you really earn in ₹, and handles buyer complaints.**

Built for the [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/). Runs on the PayPal **sandbox**.

**Live demo:** https://sellershield-ib2c.onrender.com (free Render instance: the first visit after a quiet spell can take about a minute to wake up)

## The problem

A small seller in India selling to buyers abroad through PayPal loses money in ways they don't see coming: a parcel shipped to a reshipping scammer, money held for 21 days because tracking wasn't added, a dispute lost for lack of proof, PayPal and currency fees that eat the margin, and an angry buyer who becomes a $15–$30 dispute. SellerShield watches the account, tells the seller what to do in plain words, and does the PayPal work for them, but only after they click to approve.

## Features

| Feature | What the seller sees | AI part | PayPal part |
|---|---|---|---|
| **Scam Radar** | "Safe to ship" / "Check first" / "Don't ship yet" on every new order, with the reason and what to do | Gemini judges messages and order details; code rules for forwarder addresses, name/country mismatch, paying outside PayPal, address changes, "friend will pick up", urgency. The code verdict is a floor the AI can't lower. | Orders v2 (shipping address, payer) |
| **Proof Vault** | Upload 2–3 packing photos per order; get "✅ good proof" or "retake: …" | Gemini **vision** checks the right item, a readable label or size, and a sealed box | Disputes v1 `provide-evidence` (photos attached as files) |
| **Real earnings in ₹** | Buyer paid → PayPal fee → you keep → ~3% currency loss → ≈ ₹ in your bank (estimate) | none: exact math in code | Payments v2 capture `seller_receivable_breakdown` |
| **Money countdown** | "Money expected by Tue, Dec 1" on each order and in the to-do list | none: rule-based (21-day hold without tracking, ~1 day after delivery with it) | Orders + tracking |
| **Tracking autopilot** | Paste a shipping email or label photo, tracking goes to PayPal | Gemini **extraction** of carrier + tracking number, matched to the order | Orders v2 `POST /v2/checkout/orders/{id}/track` |
| **Calm unhappy buyers** | Risk rating, a ready reply, and the true cost of a refund vs. losing a dispute | Gemini rates dispute risk and drafts the reply | Payments v2 refund (after approval) |
| **Dispute responder** | Fight or accept, with the evidence note written and packing photos attached | Gemini drafts the answer from the order, tracking and photos | Disputes v1 `get`, `provide-evidence`, `accept-claim` |
| **Account health** | Score out of 100 and how close you are to PayPal's 1.5% dispute line | none: exact math in code | Disputes v1 list |
| **Ask SellerShield (agent)** | Chat that looks things up and prepares actions; shows every step it took | Gemini **function calling** with 6 tools: earnings, buyer risk, Scam Radar, dispute draft, add tracking, refund | All of the above |

**Design rule:** the AI only proposes. Tracking, refunds and dispute answers run only after the seller clicks **Confirm**, and every amount is checked in code (a refund can never exceed what's left of the order). All money math (fees, earnings, the 1.5% line) is plain code with its constants in [`src/lib/config.ts`](src/lib/config.ts) ("rates as of Nov 2026").

## PayPal APIs used

- **OAuth 2.0** client credentials
- **JS SDK** (`@paypal/react-paypal-js`) for checkout in the demo store
- **Orders v2**: create, capture, get, `track` (add tracking)
- **Payments v2**: get capture (`seller_receivable_breakdown` for the real fee), refund
- **Disputes v1**: list, get, `provide-evidence` (multipart, with photo files), `accept-claim`
- **Webhooks**: `verify-webhook-signature` for live events

## AI used (Google Gemini, `gemini-2.5-flash`)

- **Function-calling agent**: the chat plans and calls tools, then waits for the seller's confirmation on anything that touches money or PayPal.
- **Vision**: checks packing photos, and reads shipping labels for tracking numbers.
- **Extraction and judgement**: tracking numbers from emails, scam signals, buyer dispute risk, dispute answers. Everything returns strict JSON that code validates.

Other data: USD→INR from the free FBIL reference rate via [frankfurter.dev](https://frankfurter.dev) (falls back to the ECB rate).

## Try it as a judge (sandbox)

1. Open **Demo store** and buy any item with PayPal. Log in with this **sandbox-only** test buyer (fake money, not a real account):
   - Email: `sb-xrufm53811894@personal.example.com`
   - Password: `Nw1/DKhp`
2. Go back to **My shop**. The new order appears with Scam Radar, earnings in ₹, the money countdown, and a to-do to add tracking.
3. Tick **Test Scam Radar** in the store before buying to ship to a made-up package-forwarding address: the order is flagged **Don't ship yet**.
4. Open **Ask SellerShield** and try: "How much will I really get in rupees from my newest order, and is it safe to ship?" or "I shipped it with FedEx, tracking 794612345678".
5. **Unhappy buyers** tab: paste "One of the mugs arrived chipped" to see the risk, the reply, and refund vs. dispute costs.
6. **Packing photos** on any order: upload 2–3 photos and see the vision check.

The dashboard starts with a few real sandbox orders from [`seed/demo-db.json`](seed/demo-db.json), so it's never empty.

## Run it locally

1. Node 20+.
2. `npm install`
3. Copy `.env.example` to `.env.local` and fill in:
   - `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, and `NEXT_PUBLIC_PAYPAL_CLIENT_ID` (same as the client id) from a **US** sandbox app at developer.paypal.com
   - `PAYPAL_API_BASE=https://api-m.sandbox.paypal.com`
   - `GEMINI_API_KEY` from https://aistudio.google.com/apikey, and `GEMINI_MODEL=gemini-2.5-flash`
4. `npm run dev` and open http://localhost:3000

Production: `npm install && npm run build`, then `npm start`.

## What is simulated (and why)

- **Held funds:** the sandbox can't create holds, so "money waiting" and the countdown follow PayPal's published rules and are labelled as estimates.
- **Sales history:** a new sandbox account has almost no sales, so the health score adds a labelled baseline of 120 sales and 1 dispute (`DEMO_BASELINE_SALES`, `DEMO_BASELINE_DISPUTES`; set both to `0` for live data only).
- **INR amounts** are estimates: reference rate minus a typical 3% PayPal conversion spread.
- **Scam Radar** is a smart warning, not a guarantee.

## Tech

Next.js 15 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui, Motion, PayPal REST APIs + JS SDK, Google Gemini REST API. Orders the app has seen are stored in `data/db.json`; packing photos in `data/proof/`.

## License

[MIT](LICENSE)
