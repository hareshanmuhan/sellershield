import { createOrder, type ShipTo } from "@/lib/paypal";
import { getOrders } from "@/lib/store";
import { ok, fail } from "@/lib/api";

// A made-up package-forwarding address, only used when the demo store's "test Scam Radar" box is ticked.
const TEST_FORWARDER: ShipTo = {
  name: "Mike Ross c/o QuickBox Forwarding",
  line1: "1000 Airport Rd, Suite 240",
  city: "New Castle",
  state: "DE",
  postalCode: "19720",
  countryCode: "US",
};

export async function GET() {
  return ok(await getOrders());
}

export async function POST(req: Request) {
  try {
    const { amount, item, scamTest } = await req.json();
    const order = await createOrder(String(amount), String(item), scamTest ? TEST_FORWARDER : undefined);
    return ok({ id: order.id });
  } catch (e) {
    return fail(e);
  }
}
