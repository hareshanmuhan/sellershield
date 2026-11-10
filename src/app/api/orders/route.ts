import { createOrder } from "@/lib/paypal";
import { getOrders } from "@/lib/store";
import { ok, fail } from "@/lib/api";

export async function GET() {
  return ok(await getOrders());
}

export async function POST(req: Request) {
  try {
    const { amount, item } = await req.json();
    const order = await createOrder(String(amount), String(item));
    return ok({ id: order.id });
  } catch (e) {
    return fail(e);
  }
}
