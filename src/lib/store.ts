// Tiny JSON-file store for orders the app has seen. PayPal stays the source of truth;
// this just remembers order/capture IDs, tracking, and buyer messages for the dashboard.
import { promises as fs } from "fs";
import path from "path";

export type Order = {
  orderId: string;
  captureId: string;
  amount: string;
  item: string;
  buyerEmail?: string;
  createdAt: string;
  tracking?: { carrier: string; number: string; addedAt: string };
  refunded?: { amount: string; at: string };
  buyerMessage?: string;
  risk?: { level: "low" | "medium" | "high"; reason: string };
  /** PayPal's own numbers from the capture's seller_receivable_breakdown. */
  breakdown?: { gross: string; fee: string; net: string; currency: string };
  /** Where the buyer asked PayPal to ship, and what PayPal knows about the payer. */
  shipTo?: Address & { name?: string };
  payer?: { name?: string; email?: string; countryCode?: string; address?: Address };
  scam?: ScamResult;
  /** Messages the seller pasted into Scam Radar. */
  scamNotes?: string;
  proof?: ProofPhoto[];
};

export type Address = {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  countryCode?: string;
};

export type ScamResult = {
  verdict: "safe" | "check" | "stop";
  headline: string;
  reasons: string[];
  whatToDo: string;
  flags: string[];
  checkedAt: string;
};

export type ProofPhoto = {
  file: string;
  at: string;
  mimeType: string;
  good: boolean;
  feedback: string;
  checks?: { itemMatches: boolean; labelVisible: boolean; boxSealed: boolean };
};

export type WebhookEvent = { id: string; type: string; summary: string; at: string; resourceId?: string };

type DB = { orders: Order[]; events: WebhookEvent[] };

const FILE = path.join(process.cwd(), "data", "db.json");

// Demo data (real sandbox orders) used when data/db.json doesn't exist yet,
// e.g. on a fresh deploy whose disk was wiped, so the dashboard isn't empty for judges.
const SEED = path.join(process.cwd(), "seed", "demo-db.json");

async function load(): Promise<DB> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8"));
  } catch {}
  try {
    const db: DB = JSON.parse(await fs.readFile(SEED, "utf8"));
    await save(db);
    return db;
  } catch {
    return { orders: [], events: [] };
  }
}

async function save(db: DB) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(db, null, 2));
}

export async function getOrders() {
  return (await load()).orders;
}

export async function addOrder(o: Order) {
  const db = await load();
  db.orders.unshift(o);
  await save(db);
}

export async function updateOrder(orderId: string, patch: Partial<Order>) {
  const db = await load();
  const o = db.orders.find((x) => x.orderId === orderId);
  if (!o) throw new Error(`Order ${orderId} not found`);
  Object.assign(o, patch);
  await save(db);
  return o;
}

export async function getEvents() {
  return (await load()).events;
}

export async function addEvent(e: WebhookEvent) {
  const db = await load();
  db.events.unshift(e);
  db.events = db.events.slice(0, 50);
  await save(db);
}
