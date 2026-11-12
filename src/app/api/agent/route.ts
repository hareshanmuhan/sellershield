import { runAgent } from "@/lib/agent";
import { ok, fail } from "@/lib/api";

// Chat agent. Returns the answer, the steps it took, and any actions waiting for the seller's confirmation.
export async function POST(req: Request) {
  try {
    const { question, history } = await req.json();
    if (!String(question || "").trim()) return fail("Ask a question", 400);
    return ok(await runAgent(String(question), Array.isArray(history) ? history : []));
  } catch (e) {
    return fail(e);
  }
}
