# Security Architecture Overview

This document describes the comprehensive security protections implemented across the insiderclusters application.

## Table of Contents

1. [Security Layers](#security-layers)
2. [Authentication & Sessions](#authentication--sessions)
3. [Input Validation](#input-validation)
4. [API Protection](#api-protection)
5. [Error Handling](#error-handling)
6. [Logging & Monitoring](#logging--monitoring)
7. [Deployment Considerations](#deployment-considerations)

---

## Security Layers

### 1. **Network & Transport Security**

- **HSTS (HTTP Strict Transport Security)**: Enforces HTTPS for all connections
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
  - Prevents downgrade attacks to HTTP

- **Content Security Policy (CSP)**: Strict default-deny policy with selective exceptions
  - Prevents XSS attacks by restricting script execution
  - Whitelist: PostHog, Google Fonts, Resend, Lemon Squeezy
  - Inline scripts protected with nonce tokens

- **CORS Configuration**: Same-origin policy with explicit allow-list
  - Only APP_URL and localhost origins allowed
  - Methods restricted to GET, POST, OPTIONS
  - Credentials mode: allow with SameSite=Lax cookies

### 2. **Anti-Clickjacking & MIME Sniffing**

- **X-Frame-Options: DENY** - Prevents embedding in iframes
- **X-Content-Type-Options: nosniff** - Prevents MIME type sniffing
- **Referrer-Policy: strict-origin-when-cross-origin** - Controls referrer leakage

### 3. **Request/Response Security**

- **CSRF Protection** (Cross-Site Request Forgery)
  - Double-submit cookie pattern with secret + token
  - Validated on all state-changing requests (POST, PUT, DELETE)
  - Per-request token with 24-hour expiry

- **Rate Limiting** (multi-layer)
  - Auth endpoints: 3 per email / 15 min, 10 per IP / hour
  - API endpoints: 30 per session / min, 60 per IP / min
  - Public pages: 100 per IP / hour
  - In-memory token bucket algorithm (can be upgraded to Redis)

---

## Authentication & Sessions

### Magic Link Authentication

1. User enters email → validates format
2. CSRF token validated (if POST)
3. Rate limits checked (per email + per IP)
4. Magic link token created (SHA256 hash of cryptographic secret)
5. Link sent via Resend API
6. User clicks link → verified with stored token
7. Session created (UUID, HttpOnly, Secure, SameSite=Lax cookies)

### Session Security

- **HttpOnly Cookies**: Cannot be accessed by JavaScript (XSS protection)
- **Secure Flag**: Only sent over HTTPS in production
- **SameSite=Lax**: CSRF protection without breaking legitimate redirects
- **Token Storage**: Random UUID, stored in database with hash comparison
- **TTL**: 30 days (configurable)
- **Regeneration**: Token regenerated after login to prevent fixation attacks

### Device Fingerprinting (Optional)

- Detects unusual access patterns: User-Agent + IP hash
- Logs mismatches for security monitoring
- Does not block access (informational only)

---

## Input Validation

All API endpoints validate input using **Zod** schemas:

```typescript
// Email validation: strict format, normalized
const emailSchema = z
  .string()
  .email()
  .toLowerCase()
  .trim()
  .max(255);

// Token validation: must be 64-char hex (SHA256)
const tokenSchema = z
  .string()
  .hex()
  .length(64);
```

### Validation Results

- **Success**: Request proceeds
- **Failure**: 400 Bad Request with sanitized error message
- **Examples**: Invalid email, missing token, malformed JSON

### Request Payloads

- `/api/auth/request-link`: `{ email: string }`
- `/api/auth/verify`: `{ token: string }`
- `/api/auth/logout`: (form-based with CSRF token)

---

## API Protection

### Endpoints Covered

#### Public Endpoints
- `GET /api/auth/request-link` - Get CSRF token + initialize form
- `POST /api/auth/request-link` - Request magic link
  - Rate limited per email & IP
  - CSRF validated
  - Input validated

#### Authenticated Endpoints
- `POST /api/auth/logout` - Sign out
  - CSRF validated
  - Rate limited per session
  - Deletes session record

### Future API Endpoints

All new endpoints should follow this pattern:

```typescript
export async function POST(req: NextRequest) {
  const requestId = req.headers.get("x-request-id");
  
  try {
    // 1. Validate CSRF
    if (!await validateCSRFRequest(req)) {
      return NextResponse.json({ error: "CSRF validation failed" }, { status: 403 });
    }
    
    // 2. Parse & validate input
    const validation = validateData(mySchema, await req.json());
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    
    // 3. Check rate limits
    const rateLimit = checkRateLimit({
      policy: RateLimitPolicy.API_SESSION,
      identifier: user.id
    });
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429 });
    }
    
    // 4. Business logic
    // ...
    
    // 5. Audit log
    await auditLog({
      userId: user.id,
      email: user.email,
      action: "action_performed",
      ipAddress,
      userAgent
    });
    
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, userMessage } = handleError(err, "endpoint_name", requestId);
    return NextResponse.json({ error: userMessage }, { status });
  }
}
```

---

## Error Handling

### Client-Facing Errors

All errors returned to clients are generic and non-informative:

- `500`: "An error occurred. Please try again."
- `404`: "Not found"
- `429`: "Too many requests. Please try again later."

**Never expose**: Stack traces, SQL errors, file paths, or internal system details.

### Server-Side Logging

Full error context logged server-side with:

- Component name
- Request ID (for tracing)
- User ID (if applicable)
- Stack trace (dev only)
- Timestamp

Example:

```
[2026-07-05T12:34:56Z] [ERROR] [request_link] Database error
{
  "statusCode": 500,
  "requestId": "uuid-1234",
  "stack": "Error: connection timeout..."
}
```

### Secret Masking

Logs automatically mask sensitive data:

- API keys: `api_key=***`
- Tokens: `token=***`
- Database URLs: `DATABASE_URL=***`
- Email addresses: `user***@example.com`

---

## Logging & Monitoring

### Structured Logging

All logs are JSON-formatted with:

- `timestamp`: ISO 8601
- `level`: debug, info, warn, error
- `component`: Module name
- `message`: Event description
- `context`: Additional fields (masked)

### Audit Logging

Security-relevant events logged to database (`audit_logs` table):

- **Authentication**: magic link requested, signed in, signed out
- **Rate Limits**: threshold exceeded
- **CSRF**: validation failed
- **API Access**: key created/revoked, unauthorized attempts
- **Settings**: email alerts toggled, plan changed

**Retention**: 90 days (configurable per compliance requirements)

### Request Monitoring

In-memory metrics tracked per endpoint:

- Total requests
- Error rate (>50% triggers alert)
- Rate limit triggers (>100/min triggers alert)
- Average response time (>1s triggers alert)

Reset every 5 minutes. For production multi-instance deployment, replace with Prometheus/Grafana.

### PostHog Analytics

Integrated for application-level events:

- User authentication flows
- Feature usage
- Error tracking (via `onRequestError`)

---

## Secrets Management

### Environment Variables

All secrets loaded at runtime from environment:

```bash
RESEND_API_KEY=re_...
LEMONSQUEEZY_API_KEY=...
LEMONSQUEEZY_WEBHOOK_SECRET=...
DISCORD_BOT_TOKEN=...
DATABASE_URL=postgres://...
```

### API Key Validation

Check at startup via `validateRequiredAPIKeys()` to catch missing config early.

### Key Rotation

See [SECRETS_ROTATION.md](./SECRETS_ROTATION.md) for manual rotation process.

---

## Deployment Considerations

### Before Production

- [ ] All environment variables set in Coolify
- [ ] HTTPS certificate installed (Let's Encrypt via Coolify)
- [ ] Database backups configured and tested
- [ ] Rate limits tuned for expected traffic
- [ ] HSTS header tested (browser will cache)
- [ ] CSP report-uri (optional, for violation reports)
- [ ] Audit logs table created and working
- [ ] Error logging flows to stdout (captured by Coolify)

### Cloudflare (Optional)

If using Cloudflare as reverse proxy:

- [ ] Zone configured with DNSSEC
- [ ] Bot Fight Mode enabled
- [ ] Rate limiting rules added (Cloudflare WAF)
- [ ] Cache Rules configured (static content only)

### Monitoring

- [ ] PostHog dashboard set up for error tracking
- [ ] Request metrics accessible (monitor endpoint)
- [ ] Alerts configured for: high error rate, rate limit spikes, slow endpoints

---

## Threat Model

### Threats Mitigated

| Threat | Mitigation |
|--------|-----------|
| XSS (Cross-Site Scripting) | CSP + input validation + output encoding |
| CSRF (Cross-Site Request Forgery) | Double-submit CSRF tokens + SameSite cookies |
| SQL Injection | Parameterized queries (pg driver) + input validation |
| Brute Force (auth) | Rate limiting per email + IP + device fingerprinting |
| DDoS | Cloudflare (free tier) + Hetzner protection + rate limiting |
| Account Enumeration | No email enumeration (same response for exist/not exist) |
| Session Fixation | Session regeneration after login |
| MITM (Man-in-the-Middle) | HSTS + HTTPS only |
| Clickjacking | X-Frame-Options: DENY |
| MIME Sniffing | X-Content-Type-Options: nosniff |

### Out of Scope (Phase 2)

- WAF (Web Application Firewall) - enable if attacks detected
- 2FA (Two-Factor Authentication) - magic link already provides good security
- Encryption at rest - data is semi-public anyway
- API authentication (API keys) - not yet needed

---

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [MDN: Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [CSP Evaluator](https://csp-evaluator.withgoogle.com/)
