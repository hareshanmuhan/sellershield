import { listDisputes } from "@/lib/paypal";
import { ok, fail } from "@/lib/api";

export async function GET() {
  try {
    const data = await listDisputes();
    return ok(data.items || []);
  } catch (e) {
    return fail(e);
  }
}
