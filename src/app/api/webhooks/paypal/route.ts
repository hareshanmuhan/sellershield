import { verifyWebhook } from "@/lib/paypal";
import { addEvent, getEvents } from "@/lib/store";
import { ok, fail } from "@/lib/api";

export async function GET() {
  return ok(await getEvents());
}

// Subscribe this URL in the PayPal dashboard to CUSTOMER.DISPUTE.CREATED / UPDATED
// and PAYMENT.CAPTURE.COMPLETED so new disputes show up on the dashboard instantly.
export async function POST(req: Request) {
  try {
    const event = await req.json();
    if (!(await verifyWebhook(req.headers, event))) return fail("Webhook signature check failed", 401);
    await addEvent({
      id: event.id,
      type: event.event_type,
      summary: event.summary || event.event_type,
      at: new Date().toISOString(),
      resourceId: event.resource?.dispute_id || event.resource?.id,
    });
    return ok({ received: true });
  } catch (e) {
    return fail(e);
  }
}
