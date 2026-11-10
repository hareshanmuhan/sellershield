// Scam Radar: simple code rules first, then Gemini for the judgement call.
// The code verdict is a floor: the AI can raise the alarm but never lower it.
import { askJSON } from "./gemini";
import type { Order, ScamResult } from "./store";

type Flag = { id: string; level: "check" | "stop"; reason: string };

const FORWARDER = /forward(ing|er)?|freight|re-?ship|shipito|myus|planet\s*express|stackry|borderlinx|viabox|parcel\s*(hub|for)|package\s*forward|\bc\/o\b|care of/i;
// Areas packed with US package-forwarding warehouses (tax-free states near ports).
const FORWARDER_ZIPS = /^(19720|19713|97230|97203|33166|33122|33172|33178)\b/;

const PATTERNS: { id: string; level: Flag["level"]; re: RegExp; reason: string }[] = [
  {
    id: "outside_paypal",
    level: "stop",
    re: /zelle|venmo|cash\s*app|western\s*union|moneygram|wire\s*transfer|bank\s*transfer|gift\s*card|crypto|bitcoin|usdt|friends?\s*(and|&)\s*family|outside\s*(of\s*)?paypal|pay\s*you\s*(directly|another way)|check\s*(in the mail|payment)/i,
    reason: "The buyer wants to pay or settle outside PayPal, which removes your seller protection.",
  },
  {
    id: "address_change",
    level: "stop",
    re: /(change|update|new|different|another|other)\s+(the\s+|my\s+)?(shipping\s+|delivery\s+)?address|ship\s+(it\s+)?to\s+(this|my|a|another|a different)\s+(new\s+)?(address|location)|send\s+it\s+to\s+(this|my\s+(cousin|friend|brother|sister|son|daughter))/i,
    reason: "The buyer asked to change the address after paying. PayPal only protects you if you ship to the address on the order.",
  },
  {
    id: "friend_pickup",
    level: "check",
    re: /(friend|cousin|agent|driver|courier|someone|my\s+(guy|man|brother|sister|assistant))\s+(will|can|is going to|gonna)\s+(come\s+)?(pick|collect|grab)|pick\s*(it\s*)?up\s+(in person|from you)|local\s+pickup/i,
    reason: "Someone else will pick it up. Hand-overs leave no tracking, so you can't prove delivery in a dispute.",
  },
  {
    id: "urgency",
    level: "check",
    re: /urgent|asap|right\s+(now|away)|immediately|today\s+only|overnight\s+it|need\s+it\s+(by|today|tomorrow)|hurry|as\s+soon\s+as\s+possible|emergency/i,
    reason: "The buyer is pushing you to rush. Pressure is a common scam tactic to stop you from checking.",
  },
];

const fmtAddr = (a?: Order["shipTo"]) =>
  a ? [a.name, a.line1, a.line2, a.city, a.state, a.postalCode, a.countryCode].filter(Boolean).join(", ") : "unknown";

export function scamRules(o: Order, messages: string): Flag[] {
  const flags: Flag[] = [];
  const ship = o.shipTo;
  const payerCountry = o.payer?.countryCode || o.payer?.address?.countryCode;
  if (ship?.countryCode && payerCountry && ship.countryCode !== payerCountry) {
    flags.push({
      id: "different_country",
      level: "check",
      reason: `It ships to ${ship.countryCode}, but the PayPal account is from ${payerCountry}.`,
    });
  }
  const shipText = [ship?.name, ship?.line1, ship?.line2].filter(Boolean).join(" ");
  if ((shipText && FORWARDER.test(shipText)) || (ship?.postalCode && FORWARDER_ZIPS.test(ship.postalCode))) {
    flags.push({
      id: "forwarder",
      level: "check",
      reason: "The shipping address looks like a package-forwarding warehouse, which is often used to resend goods abroad.",
    });
  }
  if (ship?.name && o.payer?.name && !namesOverlap(ship.name, o.payer.name)) {
    flags.push({
      id: "different_name",
      level: "check",
      reason: `It ships to "${ship.name}", not the PayPal account holder "${o.payer.name}".`,
    });
  }
  for (const p of PATTERNS) if (messages && p.re.test(messages)) flags.push({ id: p.id, level: p.level, reason: p.reason });
  return flags;
}

function namesOverlap(a: string, b: string) {
  const words = (s: string) => new Set(s.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 1));
  const wb = words(b);
  return [...words(a)].some((w) => wb.has(w));
}

const rank = { safe: 0, check: 1, stop: 2 } as const;

export function codeVerdict(flags: Flag[]): ScamResult["verdict"] {
  if (flags.some((f) => f.level === "stop")) return "stop";
  // A forwarding address plus any other warning sign is the classic reshipping scam.
  if (flags.some((f) => f.id === "forwarder") && flags.length >= 2) return "stop";
  return flags.length ? "check" : "safe";
}

const HEADLINES = { safe: "Safe to ship", check: "Check first", stop: "Don't ship yet" } as const;

export async function scanOrder(o: Order, messages: string): Promise<ScamResult> {
  const flags = scamRules(o, messages);
  const floor = codeVerdict(flags);

  let ai: { verdict?: ScamResult["verdict"]; reasons?: string[]; whatToDo?: string } = {};
  try {
    ai = await askJSON(`You protect a small online seller from buyer scams BEFORE they ship.
Order: "${o.item}" for $${o.amount}.
Ship to: ${fmtAddr(o.shipTo)}
PayPal payer: ${o.payer?.name || "unknown"}, ${o.payer?.email || ""}, country ${o.payer?.countryCode || "unknown"}
Messages from the buyer: """${messages.slice(0, 3000) || "none"}"""
Warning signs our rules already found: ${JSON.stringify(flags.map((f) => f.reason))}
Common scams: shipping to a freight forwarder, "my friend will pick it up", urgency pressure, paying or refunding outside PayPal, changing the address after payment, overpayment.
Don't judge by the email address or its domain: PayPal has already verified the payer, and test accounts use example.com.
Decide: "safe" (nothing unusual), "check" (something to confirm first), or "stop" (likely scam, don't ship).
Write for someone with no tech background. Return JSON:
{"verdict":"safe|check|stop","reasons":["up to 3 short plain sentences"],"whatToDo":"one or two concrete steps, e.g. only ship to the address on the PayPal order"}`);
  } catch (e) {
    console.error("scam AI failed", e);
  }

  let aiVerdict: ScamResult["verdict"] = ai.verdict && ai.verdict in rank ? ai.verdict : "safe";
  // With no rule hit and no buyer message, the AI has nothing concrete to go on: allow "check" at most.
  if (!flags.length && !messages.trim() && aiVerdict === "stop") aiVerdict = "check";
  const verdict = rank[aiVerdict] > rank[floor] ? aiVerdict : floor;
  // Rule reasons are exact; the AI tends to repeat them in other words, so add at most one of its own.
  const aiReasons = (ai.reasons || []).slice(0, flags.length ? 1 : 3);
  const reasons = [...flags.map((f) => f.reason), ...aiReasons]
    .filter((r, i, all) => r && all.indexOf(r) === i)
    .slice(0, 4);
  const fallbackTodo = {
    safe: "Ship to the address on the PayPal order and add tracking.",
    check: "Message the buyer through PayPal to confirm, and only ship to the address on the PayPal order, with tracking.",
    stop: "Don't ship. Don't accept any payment outside PayPal. If you're unsure, refund the order through PayPal.",
  }[verdict];

  return {
    verdict,
    headline: HEADLINES[verdict],
    reasons: reasons.length ? reasons : ["Nothing unusual in the address or messages."],
    whatToDo: verdict === "safe" ? fallbackTodo : ai.whatToDo || fallbackTodo,
    flags: flags.map((f) => f.id),
    checkedAt: new Date().toISOString(),
  };
}
