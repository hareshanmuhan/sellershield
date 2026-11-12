import { assessRisk } from "@/lib/risk";
import { ok, fail } from "@/lib/api";

export async function POST(req: Request) {
  try {
    const { orderId, message } = await req.json();
    return ok(await assessRisk(orderId, String(message || "")));
  } catch (e) {
    return fail(e, e instanceof Error && e.message === "Order not found" ? 404 : 500);
  }
}
