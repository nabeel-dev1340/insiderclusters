# Threat Model

This document outlines the security threats considered during design and implementation.

## Attack Vectors & Mitigations

### 1. **Cross-Site Scripting (XSS)**

**Description**: Attacker injects malicious JavaScript into the page, executed in users' browsers.

**Attack Vector**:
- Reflected: `/?search=<script>alert('xss')</script>`
- Stored: Admin comment contains `<img src=x onerror="fetch(...)">`
- DOM-based: Client-side code processes untrusted input

**Mitigation**:
- **Content Security Policy (CSP)**: Strict default-deny (`default-src 'self'`)
  - No inline scripts allowed unless nonce-protected
  - No eval(), unsafe-inline, unsafe-eval
- **Input Validation**: All user input validated and sanitized (Zod)
- **Output Encoding**: React auto-escapes text by default
- **X-XSS-Protection**: Legacy browser header

**Residual Risk**: Low
- CSP is comprehensive and enforced
- React's default escaping prevents most vectors

---

### 2. **Cross-Site Request Forgery (CSRF)**

**Description**: Attacker tricks user into performing unwanted action on their behalf.

**Attack Vector**:
```html
<!-- Attacker's site -->
<form action="https://insiderclusters.com/api/auth/logout" method="POST">
  <input name="csrf" value="evil" />
</form>
<script>document.forms[0].submit();</script>
```

**Mitigation**:
- **CSRF Tokens**: Double-submit cookie pattern
  - Server generates `secret` → hash → return as `token`
  - Client sends `token` back in header or form
  - Server validates: `hash(cookie_secret) === token`
- **SameSite Cookies**: `SameSite=Lax` prevents cross-site cookie submission
- **State-Changing Method Validation**: Only POST/PUT/DELETE require tokens

**Residual Risk**: Very Low
- Double-submit + SameSite provide defense in depth
- Token rotates per request (short lifetime)

---

### 3. **SQL Injection**

**Description**: Attacker modifies SQL queries by injecting malicious input.

**Attack Vector**:
```sql
SELECT * FROM users WHERE email = 'user@example.com' OR '1'='1';
```

**Mitigation**:
- **Parameterized Queries**: pg driver uses prepared statements
  - All user input passed as parameters, not concatenated
  - Example: `pool.query("... WHERE email = $1", [userEmail])`
- **Input Validation**: Schema validation (Zod) ensures expected types
- **Least Privilege**: Database user has limited permissions

**Residual Risk**: Very Low
- Parameterized queries are proven defense
- Validation adds additional layer

---

### 4. **Brute Force Attack (Authentication)**

**Description**: Attacker tries many passwords/tokens to gain access.

**Attack Vector**:
```bash
# Try common emails
for email in test1@gmail.com test2@gmail.com ...
  curl -X POST /api/auth/request-link \
    -d "{\"email\": \"$email\"}"
done

# Try token guessing (SHA256, ~2^256 possibilities)
for i in {0..1000000}
  curl /auth/verify?token=$(sha256 "$i")
done
```

**Mitigation**:
- **Rate Limiting** (multi-layer):
  - Per email: 3 requests / 15 min
  - Per IP: 10 requests / hour
  - Exponential backoff strategy
- **Strong Tokens**: SHA256 (256-bit), cryptographically random
  - Infeasible to guess: 2^256 possibilities
- **No Account Enumeration**: Same response for existing/non-existing emails
- **Device Fingerprinting**: Detects unusual access patterns

**Residual Risk**: Low
- Rate limits prevent rapid attempts
- Token strength makes guessing infeasible
- But IP spoofing possible (distributed botnet); mitigation: Cloudflare

---

### 5. **Denial of Service (DoS / DDoS)**

**Description**: Attacker floods server with requests, causing unavailability.

**Attack Vector**:
```bash
# Volumetric attack
while true; do curl https://insiderclusters.com; done

# Application-level attack
for i in {1..10000}; do
  curl -X POST /api/auth/request-link -d '{"email": "test@example.com"}'
done
```

**Mitigation**:
- **Rate Limiting**: Limits request frequency per endpoint
  - 100 requests / hour per IP (public pages)
  - 30 requests / min per session (API)
- **Cloudflare DDoS Protection** (recommended):
  - Free tier: L3/4 DDoS protection
  - Paid: Advanced bot management, rate limiting rules
- **Hetzner Network Isolation**: VPS behind Hetzner's DDoS filter
- **Connection Pooling**: Database connections limited (no connection exhaustion)

**Residual Risk**: Medium
- Application-level rate limiting effective for small/medium attacks
- Volumetric DDoS (Gbps+ traffic) requires Cloudflare/ISP protection
- Mitigation: Deploy Cloudflare in front before public launch

---

### 6. **Man-in-the-Middle (MITM)**

**Description**: Attacker intercepts HTTP traffic to steal or modify data.

**Attack Vector**:
```
User → (plaintext HTTP) → [Attacker] → Server
```

**Mitigation**:
- **HTTPS Only**: All traffic encrypted with TLS 1.2+
  - Coolify provides Let's Encrypt certificate
- **HSTS Header**: Enforces HTTPS for 1 year
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
  - Browser won't connect over HTTP after first HTTPS visit
- **Secure Cookies**: `Secure` flag prevents transmission over HTTP
- **Certificate Pinning**: (Not implemented; not needed for MVP)

**Residual Risk**: Very Low
- HTTPS + HSTS provides comprehensive protection
- Attacker would need to compromise certificate (NSA-level effort)

---

### 7. **Clickjacking**

**Description**: Attacker tricks user into clicking invisible button/link.

**Attack Vector**:
```html
<!-- Attacker's site -->
<iframe src="https://insiderclusters.com/dashboard" style="opacity: 0;"></iframe>
<button>Click for Free Money</button> <!-- Hidden overlay -->
```

**Mitigation**:
- **X-Frame-Options: DENY**: Prevents embedding in iframes
- **CSP Frame-Ancestors**: `frame-ancestors 'none'` (stricter than X-Frame-Options)

**Residual Risk**: Very Low
- Headers prevent framing entirely
- No legitimate reason to embed in iframe anyway

---

### 8. **Account Enumeration**

**Description**: Attacker discovers which emails are registered by observing response differences.

**Attack Vector**:
```bash
# If server responds differently for exist/not-exist:
curl /api/auth/request-link -d '{"email": "elon@twitter.com"}' # → 200 "Email sent"
curl /api/auth/request-link -d '{"email": "fake@fake.com"}'    # → 404 "Email not found"
```

**Mitigation**:
- **Same Response for Both Cases**:
  - Whether email exists or not, return: `{ ok: true }`
  - User proves account existence by receiving email
- **No Email Validation**: Accept any email format (real validity proven by receipt)

**Residual Risk**: Very Low
- Responses are indistinguishable
- Timing analysis possible but minimal (both paths hit same rate limits)

---

### 9. **Session Fixation**

**Description**: Attacker forces user to use a known session ID, then hijacks the session.

**Attack Vector**:
```
Attacker: "Visit https://insiderclusters.com/?session=abc123"
User visits → session token set to abc123
Attacker: Uses token "abc123" to access user's account
```

**Mitigation**:
- **Session Regeneration**: New token issued after successful login
  - Old token invalidated
- **Strong Token Generation**: Cryptographic random UUID
  - Infeasible for attacker to predict
- **HttpOnly Cookies**: Token cannot be read/set by JavaScript

**Residual Risk**: Very Low
- Session regeneration prevents fixation
- Strong tokens prevent guessing

---

### 10. **Insecure Deserialization**

**Description**: Attacker sends malicious serialized data, causing RCE.

**Attack Vector**:
```javascript
// Dangerous: eval() or unsafe deserialization
const data = JSON.parse(userInput); // This is safe with JSON
// But pickle, yaml, or custom serializers could be dangerous
```

**Mitigation**:
- **JSON Only**: All data serialized as JSON (safe by design)
- **Input Validation**: Zod schemas enforce expected structure
- **No eval()**: Never use eval(), Function(), or equivalent

**Residual Risk**: Very Low
- JSON format is inherently safe
- No dangerous deserialization patterns used

---

### 11. **Unvalidated Redirects**

**Description**: Attacker sends user to malicious site via `/auth/verify?redirect=attacker.com`.

**Attack Vector**:
```
https://insiderclusters.com/auth/verify?redirect=https://phishing-site.com
```

**Mitigation**:
- **Whitelist-Only Redirects**:
  - Only redirect to `APP_URL` (configured safe origin)
  - Reject any other destination
- **No User-Controlled Redirect**: Redirect hardcoded, not from query param

**Residual Risk**: Low
- Whitelist approach prevents redirects to external sites
- But query parameter could be phishing vector (user copy-pastes malicious URL)

---

### 12. **Information Disclosure**

**Description**: Attacker gains sensitive info from error messages, logs, or headers.

**Attack Vector**:
```bash
# Trigger error
curl /api/nonexistent

# Response reveals server details:
# {"error": "ReferenceError: Cannot read property 'query' of undefined at postgres.query (server.js:123)"}
```

**Mitigation**:
- **Generic Error Messages**: All errors return safe, non-revealing messages
  - "An error occurred. Please try again."
  - "Not found"
  - "Too many requests"
- **Server Logging**: Full error context logged server-side (hidden from clients)
  - Includes stack trace, request ID for support
  - Never logged to stdout in production (Coolify captures logs separately)
- **Header Removal**: `Server` and `X-Powered-By` headers removed

**Residual Risk**: Very Low
- Client-facing errors are generic
- Full context available server-side for debugging

---

## Threat Severity & Residual Risk

| Threat | Mitigation | Residual Risk | Effort to Exploit |
|--------|-----------|---------------|-------------------|
| XSS | CSP + Input Validation | Low | Medium (CSP bypass) |
| CSRF | Tokens + SameSite | Very Low | High (token prediction) |
| SQL Injection | Parameterized Queries | Very Low | High (pg driver safety) |
| Brute Force (Auth) | Rate Limiting | Low | High (slow attack) |
| DDoS (Volumetric) | Cloudflare | Medium | Low (botnet required) |
| MITM | HTTPS + HSTS | Very Low | Extreme (cert compromise) |
| Clickjacking | X-Frame-Options | Very Low | High (X-Frame-Options universal) |
| Account Enumeration | Same Response | Very Low | High (timing analysis hard) |
| Session Fixation | Regeneration | Very Low | High (token prediction) |
| Insecure Deserialization | JSON Only | Very Low | High (JSON safe by design) |
| Unvalidated Redirects | Whitelist | Low | Medium (phishing still possible) |
| Information Disclosure | Generic Errors | Very Low | High (no stack traces) |

---

## Out of Scope (Phase 2)

The following threats are **not** currently mitigated but are considered for future phases:

1. **Insider Threats** (malicious employee access)
   - Mitigation: Audit logging, access controls, key rotation
   - Status: Audit logs implemented; access controls pending

2. **Supply Chain Attacks** (compromised dependencies)
   - Mitigation: Dependency scanning (npm audit), lock files
   - Status: npm audit warns of vulnerabilities; automated fixes pending

3. **Physical Security** (someone walks into data center)
   - Mitigation: Hetzner's physical security, VPS isolation
   - Status: Delegated to hosting provider

4. **Cryptographic Weaknesses** (SHA1, MD5 in old code)
   - Mitigation: Use SHA256+ for hashing
   - Status: All new code uses SHA256

5. **Zero-Day Exploits** (unknown vulnerabilities in dependencies)
   - Mitigation: None feasible; requires patching when disclosed
   - Status: Auto-update Next.js, monitor security advisories

---

## Compliance & Regulations

### GDPR (General Data Protection Regulation)

- **Data Minimization**: Collect only necessary data (email, insider data from SEC)
- **Encryption**: Passwords hashed (magic link auth)
- **Right to Deletion**: Implement user data deletion endpoint (future)
- **Privacy Policy**: Required (ensure policy is accurate)

### CAN-SPAM (Email Regulations)

- **Unsubscribe Option**: Provide email digest controls
- **Accurate Sender Info**: Use "InsiderClusters" as sender name
- **Opt-Out Respected**: Honor email preference updates within 10 days

### PCI-DSS (Payment Card Data)

- **Not Applicable**: We use Lemon Squeezy for processing
- **No Card Data Stored**: Never store credit card numbers
- **Webhook Signature Validation**: Validate Lemon Squeezy webhook origin

---

## Security Testing Checklist

Before production, run:

- [ ] **OWASP ZAP**: Automated vulnerability scanning
- [ ] **Burp Suite Community**: Manual penetration testing
- [ ] **CSP Evaluator**: Check CSP for weaknesses
- [ ] **SSL Labs**: TLS certificate validation
- [ ] **npm audit**: Dependency vulnerability scanning
- [ ] **Code Review**: Security-focused peer review
- [ ] **Penetration Test**: Third-party pen test (recommended)

---

## Incident Response Plan

### If Breach Suspected:

1. **Immediate** (0-5 min):
   - Disable affected service/account
   - Notify on-call team
   - Start incident log

2. **Assessment** (5-30 min):
   - Determine scope: what data accessed?
   - When did breach occur?
   - Who had access?

3. **Containment** (30 min - 2 hours):
   - Rotate affected credentials
   - Patch vulnerability
   - Restart services
   - Verify fix effectiveness

4. **Notification** (1-24 hours):
   - Notify affected users
   - Notify authorities (if required by law)
   - Post-mortem with team

5. **Follow-up** (days/weeks):
   - Root cause analysis
   - Process improvements
   - Customer communication

See: [INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md) (future)

---

## References

- [OWASP Top 10 Web Application Security Risks](https://owasp.org/www-project-top-ten/)
- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
- [CWE Top 25 Most Dangerous Software Weaknesses](https://cwe.mitre.org/top25/)
