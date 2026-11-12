import { draftDispute } from "@/lib/dispute-draft";
import { ok, fail } from "@/lib/api";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    return ok(await draftDispute((await params).id));
  } catch (e) {
    return fail(e);
  }
}
