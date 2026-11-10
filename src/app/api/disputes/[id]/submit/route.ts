import { provideEvidence, acceptClaim } from "@/lib/paypal";
import { ok, fail } from "@/lib/api";

// Runs only after the seller approves. Sends evidence (or accepts the claim) via the Disputes REST API.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { action, notes, tracking } = await req.json();
    const res = action === "accept" ? await acceptClaim(id, notes) : await provideEvidence(id, notes, tracking || undefined);
    return ok({ done: true, links: res.links || [] });
  } catch (e) {
    return fail(e);
  }
}
