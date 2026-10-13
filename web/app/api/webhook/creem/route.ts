import { NextResponse, type NextRequest } from "next/server";
import { creemEventSchema, processCreemEvent, verifyCreemSignature } from "@/lib/creem-webhook";
import { logger } from "@/lib/logger";
export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CREEM_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ received: false }, { status: 503 });
  const raw = await req.text();
  if (!verifyCreemSignature(raw, req.headers.get("creem-signature") ?? "", secret)) {
    return NextResponse.json({ received: false }, { status: 403 });
  }
  let event;
  try { event = creemEventSchema.parse(JSON.parse(raw)); }
  catch { return NextResponse.json({ received: false }, { status: 400 }); }
  try {
    await processCreemEvent(event);
    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error("creem", "Webhook processing failed", {
      eventId: event.id,error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ received: false }, { status: 500 });
  }
}
