# API Endpoint Security Guide

This guide provides a template and best practices for securing new API endpoints.

## Security Checklist

For every new API endpoint, ensure:

- [ ] Input validation with Zod schemas
- [ ] CSRF token validation (POST/PUT/DELETE)
- [ ] Rate limiting applied
- [ ] Authentication check (if required)
- [ ] Authorization check (user owns resource)
- [ ] Error handling with masking
- [ ] Audit logging for sensitive actions
- [ ] Request ID tracking
- [ ] Response validation (don't leak internals)

---

## Template: Secure API Endpoint

```typescript
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { validateCSRFRequest } from "@/lib/middleware/csrf";
import { checkRateLimit, RateLimitPolicy, getClientIP } from "@/lib/middleware/rate-limit";
import { validateData } from "@/lib/validation";
import { handleError } from "@/lib/error-handler";
import { logger } from "@/lib/logger";
import { auditLog, AUDIT_EVENTS } from "@/lib/audit/log";

// 1. Define input schema
const updateSettingsSchema = z.object({
  emailAlerts: z.boolean().optional(),
  emailDigest: z.enum(["daily", "weekly", "monthly", "never"]).optional(),
});

type UpdateSettingsPayload = z.infer<typeof updateSettingsSchema>;

// 2. Define the handler
export async function POST(req: NextRequest): Promise<NextResponse> {
  // Extract context
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
  const clientIP = getClientIP(req);

  try {
    // STEP 1: Validate CSRF token
    const isCsrfValid = await validateCSRFRequest(req);
    if (!isCsrfValid) {
      logger.security("csrf_validation_failed", { endpoint: "update_settings", requestId });
      return NextResponse.json(
        { error: "Security validation failed." },
        { status: 403 }
      );
    }

    // STEP 2: Check authentication
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "You must be signed in." },
        { status: 401 }
      );
    }

    // STEP 3: Rate limit
    const rateLimit = checkRateLimit({
      policy: RateLimitPolicy.API_SESSION,
      identifier: `settings:${user.id}`,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again." },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfter) },
        }
      );
    }

    // STEP 4: Parse and validate input
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const validation = validateData<UpdateSettingsPayload>(
      updateSettingsSchema,
      body
    );
    if (!validation.success) {
      logger.warn("validation_failed", {
        endpoint: "update_settings",
        error: validation.error,
      });
      return NextResponse.json(
        { error: "Invalid input: " + validation.error },
        { status: 400 }
      );
    }

    const { emailAlerts, emailDigest } = validation.data!;

    // STEP 5: Authorization (ensure user owns resource)
    // In this case: user can only update their own settings
    // (Already implicit since getCurrentUser() returns their own user)

    // STEP 6: Business logic
    // Update user settings in database
    // ... your code here ...

    // STEP 7: Audit log
    await auditLog({
      userId: user.id,
      email: user.email,
      action: AUDIT_EVENTS.EMAIL_ALERTS_TOGGLED,
      details: { emailAlerts, emailDigest },
      ipAddress: clientIP,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    // STEP 8: Return success
    logger.info("settings_updated", { userId: user.id, requestId });
    return NextResponse.json({
      ok: true,
      emailAlerts,
      emailDigest,
    });
  } catch (err) {
    const { status, userMessage } = handleError(
      err,
      "update_settings",
      requestId
    );
    return NextResponse.json({ error: userMessage }, { status });
  }
}

// GET: Return current settings (no CSRF needed for safe methods)
export async function GET(req: NextRequest): Promise<NextResponse> {
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();

  try {
    // STEP 1: Check authentication
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "You must be signed in." },
        { status: 401 }
      );
    }

    // STEP 2: Rate limit (read operations have higher limits)
    const rateLimit = checkRateLimit({
      policy: RateLimitPolicy.DASHBOARD_SESSION,
      identifier: `settings-read:${user.id}`,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again." },
        { status: 429 }
      );
    }

    // STEP 3: Get user settings
    // ... your code here ...

    return NextResponse.json({
      ok: true,
      emailAlerts: true, // Example
      emailDigest: "daily",
    });
  } catch (err) {
    const { status, userMessage } = handleError(
      err,
      "get_settings",
      requestId
    );
    return NextResponse.json({ error: userMessage }, { status });
  }
}
```

---

## Common Patterns

### 1. **Owner Verification**

Always check that the user owns the resource they're modifying:

```typescript
// WRONG: User can modify anyone's settings
const settings = await db.query("UPDATE user_settings SET ... WHERE id = $1", [settingsId]);

// CORRECT: User can only modify their own settings
const settings = await db.query(
  "UPDATE user_settings SET ... WHERE id = $1 AND user_id = $2",
  [settingsId, user.id]
);

// Verify the update actually happened
if (!settings.rowCount) {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
```

### 2. **Sensitive Field Filtering**

Never return internal fields to clients:

```typescript
// WRONG: Exposes password_hash, internal_id
const user = await db.query("SELECT * FROM users WHERE id = $1", [userId]);
return NextResponse.json(user.rows[0]);

// CORRECT: Select only public fields
const user = await db.query(
  "SELECT id, email, created_at, plan FROM users WHERE id = $1",
  [userId]
);
return NextResponse.json(user.rows[0]);
```

### 3. **Idempotent Operations**

Use database constraints to make operations idempotent:

```typescript
// WRONG: Multiple submissions create multiple records
await db.query(
  "INSERT INTO watchlist_items (user_id, ticker) VALUES ($1, $2)",
  [user.id, ticker]
);

// CORRECT: UNIQUE constraint prevents duplicates
// Database has: UNIQUE(user_id, ticker)
try {
  await db.query(
    "INSERT INTO watchlist_items (user_id, ticker) VALUES ($1, $2)",
    [user.id, ticker]
  );
} catch (err) {
  if (err.code === "23505") {
    // UNIQUE violation: item already exists
    return NextResponse.json({ ok: true }); // Idempotent success
  }
  throw err;
}
```

### 4. **Pagination Safety**

Prevent offset/limit abuse:

```typescript
const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10000).default(0),
});

const { limit, offset } = validateData(paginationSchema, {
  limit: req.nextUrl.searchParams.get("limit"),
  offset: req.nextUrl.searchParams.get("offset"),
}).data!;

// Safe: User can't request all 1M rows at once
const items = await db.query(
  "SELECT * FROM items WHERE user_id = $1 LIMIT $2 OFFSET $3",
  [user.id, limit, offset]
);
```

### 5. **Webhook Signature Validation**

Validate third-party webhooks to prevent forgery:

```typescript
import { createHmac } from "crypto";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const signature = req.headers.get("x-signature-ed25519");
  const timestamp = req.headers.get("x-signature-timestamp");

  if (!signature || !timestamp) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.text();
  const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET!;

  // Verify signature (Lemon Squeezy example)
  const expectedSignature = createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");

  if (signature !== expectedSignature) {
    logger.security("webhook_signature_invalid", { source: "lemon_squeezy" });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Process webhook
  const data = JSON.parse(body);
  // ... handle webhook ...

  return NextResponse.json({ ok: true });
}
```

---

## Testing Security

### Unit Tests

```typescript
// test/api/settings.test.ts
import { POST } from "@/app/api/settings/route";

describe("POST /api/settings", () => {
  test("rejects requests without CSRF token", async () => {
    const req = new Request("http://localhost:3000/api/settings", {
      method: "POST",
      body: JSON.stringify({ emailAlerts: false }),
    });

    const res = await POST(req as any);
    expect(res.status).toBe(403);
  });

  test("rejects unauthenticated requests", async () => {
    const req = new Request("http://localhost:3000/api/settings", {
      method: "POST",
      headers: { "x-csrf-token": "valid-token" },
      body: JSON.stringify({ emailAlerts: false }),
    });

    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  test("validates input", async () => {
    const req = new Request("http://localhost:3000/api/settings", {
      method: "POST",
      headers: { "x-csrf-token": "valid-token", Cookie: "session=..." },
      body: JSON.stringify({ emailDigest: "invalid" }), // Invalid enum value
    });

    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });
});
```

### Integration Tests

```typescript
// test/api/settings.integration.test.ts
test("authenticated user can update settings", async () => {
  // 1. Sign in
  const signInRes = await fetch("/api/auth/request-link", {
    method: "POST",
    body: JSON.stringify({ email: "test@example.com" }),
  });
  const { devLink } = await signInRes.json();

  // 2. Verify token
  const token = new URL(devLink).searchParams.get("token");
  const verifyRes = await fetch(`/auth/verify?token=${token}`);
  expect(verifyRes.status).toBe(200);

  // 3. Get CSRF token
  const csrfRes = await fetch("/api/settings", { method: "GET" });
  const csrfHeaders = csrfRes.headers.get("set-cookie");
  const csrfToken = ...; // Extract from response body or cookie

  // 4. Update settings
  const updateRes = await fetch("/api/settings", {
    method: "POST",
    headers: { "x-csrf-token": csrfToken },
    body: JSON.stringify({ emailAlerts: false }),
    credentials: "include",
  });

  expect(updateRes.status).toBe(200);
  const { ok } = await updateRes.json();
  expect(ok).toBe(true);
});
```

---

## Common Mistakes

### ❌ **Don't**: Trust user input

```typescript
// WRONG
const ticker = req.query.ticker;
const data = await db.query(`SELECT * FROM stocks WHERE ticker = '${ticker}'`);
```

### ✅ **Do**: Validate and sanitize

```typescript
// CORRECT
const { ticker } = validateData(z.object({ ticker: z.string().toUpperCase() }), {
  ticker: req.query.ticker,
}).data!;
const data = await db.query("SELECT * FROM stocks WHERE ticker = $1", [ticker]);
```

---

### ❌ **Don't**: Return all user data

```typescript
// WRONG
return NextResponse.json(user); // Includes password_hash, internal fields
```

### ✅ **Do**: Select specific fields

```typescript
// CORRECT
return NextResponse.json({
  id: user.id,
  email: user.email,
  plan: user.plan,
});
```

---

### ❌ **Don't**: Skip authentication

```typescript
// WRONG
const settings = await db.query("SELECT * FROM user_settings WHERE id = $1", [id]);
```

### ✅ **Do**: Verify ownership

```typescript
// CORRECT
const user = await getCurrentUser();
const settings = await db.query(
  "SELECT * FROM user_settings WHERE id = $1 AND user_id = $2",
  [id, user.id]
);
if (!settings.rowCount) {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
```

---

## References

- [OWASP: REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
- [OWASP: Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [API Security: Top 10](https://owasp.org/www-project-api-security/)
