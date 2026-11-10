import { getHealthSnapshot } from "@/lib/health-data";
import { ok, fail } from "@/lib/api";

export async function GET() {
  try {
    return ok(await getHealthSnapshot());
  } catch (e) {
    return fail(e);
  }
}
