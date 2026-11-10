import { getOrders } from "@/lib/store";
import { addProof, removeProof } from "@/lib/proof";
import { ok, fail } from "@/lib/api";

async function find(orderId: string) {
  return (await getOrders()).find((o) => o.orderId === orderId);
}

export async function GET(_req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const order = await find((await params).orderId);
  return order ? ok(order.proof || []) : fail("Order not found", 404);
}

// Upload 1-3 packing photos; each one is saved with a timestamp and checked by Gemini vision.
export async function POST(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const order = await find((await params).orderId);
    if (!order) return fail("Order not found", 404);
    const { images } = await req.json();
    return ok(await addProof(order, Array.isArray(images) ? images : []));
  } catch (e) {
    return fail(e, 400);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const order = await find((await params).orderId);
    if (!order) return fail("Order not found", 404);
    const file = new URL(req.url).searchParams.get("file") || "";
    return ok(await removeProof(order, file));
  } catch (e) {
    return fail(e, 400);
  }
}
