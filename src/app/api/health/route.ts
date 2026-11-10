import { listDisputes } from "@/lib/paypal";
import { getOrders } from "@/lib/store";
import { computeHealth } from "@/lib/health";
import { ok, fail } from "@/lib/api";

// Sandbox accounts start empty, so the demo can add a labelled history baseline
// (e.g. 120 past sales, 1 past dispute). Set both to 0 to use only live data.
const BASE_SALES = Number(process.env.DEMO_BASELINE_SALES ?? 120);
const BASE_DISPUTES = Number(process.env.DEMO_BASELINE_DISPUTES ?? 1);

export async function GET() {
  try {
    const orders = await getOrders();
    let live: any[] = [];
    try {
      live = (await listDisputes()).items || [];
    } catch (e) {
      console.error("dispute list failed", e);
    }
    const untracked = orders.filter((o) => !o.tracking && !o.refunded).length;
    const sales = BASE_SALES + orders.length;
    const disputes = BASE_DISPUTES + live.length;
    return ok({
      ...computeHealth(sales, disputes, untracked),
      liveSales: orders.length,
      liveDisputes: live.length,
      baseline: { sales: BASE_SALES, disputes: BASE_DISPUTES },
    });
  } catch (e) {
    return fail(e);
  }
}
