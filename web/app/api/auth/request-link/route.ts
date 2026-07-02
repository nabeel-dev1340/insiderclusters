import { NextResponse, type NextRequest } from "next/server";
import { createMagicToken } from "@/lib/auth/tokens";
import { isRateLimited } from "@/lib/auth/rate-limit";
import { sendMagicLink } from "@/lib/email";
import { posthog } from "@/lib/posthog";

// Simple, permissive email shape check. Real validity is proven by the user
// actually receiving and clicking the link.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest): Promise<NextResponse> {
  let email: string;
  try {
    const body = (await req.json()) as { email?: unknown };
    email = String(body.email ?? "").trim().toLowerCase();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  if (await isRateLimited(email)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a minute and try again." },
      { status: 429 }
    );
  }

  const token = await createMagicToken(email);
  const appUrl = process.env.APP_URL ?? req.nextUrl.origin;
  const link = `${appUrl}/auth/verify?token=${encodeURIComponent(token)}`;

  await sendMagicLink(email, link);

  posthog().capture({ distinctId: email, event: "magic link requested" });

  // Always respond the same way regardless of whether the email maps to an
  // existing user (no account enumeration). In dev, surface the link so the
  // flow is testable without an email provider.
  const payload: Record<string, unknown> = { ok: true };
  if (process.env.NODE_ENV !== "production") payload.devLink = link;
  return NextResponse.json(payload);
}
