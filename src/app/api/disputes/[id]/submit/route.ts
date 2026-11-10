import { provideEvidence, acceptClaim, getDispute } from "@/lib/paypal";
import { getOrders } from "@/lib/store";
import { readProofFiles } from "@/lib/proof";
import { ok, fail } from "@/lib/api";

// Runs only after the seller approves. Sends evidence (or accepts the claim) via the Disputes REST API.
// Good Proof Vault photos are attached as files; if PayPal refuses the files, the note and tracking still go.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { action, notes, tracking, attachProof = true } = await req.json();
    if (action === "accept") {
      const res = await acceptClaim(id, notes);
      return ok({ done: true, links: res.links || [] });
    }

    let files: Awaited<ReturnType<typeof readProofFiles>> = [];
    if (attachProof) {
      const d: any = await getDispute(id);
      const txnIds: string[] = (d.disputed_transactions || []).map((t: any) => t.seller_transaction_id);
      const order = (await getOrders()).find((o) => txnIds.includes(o.captureId));
      if (order) files = await readProofFiles(order);
    }

    try {
      const res = await provideEvidence(id, notes, tracking || undefined, files);
      return ok({ done: true, photosAttached: files.length, links: res.links || [] });
    } catch (e) {
      if (!files.length) throw e;
      console.error("evidence with photos failed, retrying without files", e);
      const res = await provideEvidence(id, notes, tracking || undefined);
      return ok({ done: true, photosAttached: 0, photoError: e instanceof Error ? e.message : String(e), links: res.links || [] });
    }
  } catch (e) {
    return fail(e);
  }
}
