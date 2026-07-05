# Secrets Rotation & Management

This document describes the process for rotating API keys and other secrets in production.

## Overview

Secrets are stored as environment variables in Coolify and loaded at application startup. Rotation requires:

1. Generating a new key in the third-party service
2. Updating the environment variable in Coolify
3. Redeploying or restarting the application
4. Testing to confirm the new key works
5. Revoking the old key in the third-party service

## Secrets Inventory

| Service | Variable Name | Purpose | Frequency |
|---------|---------------|---------|-----------|
| Resend | `RESEND_API_KEY` | Email delivery | Quarterly |
| Lemon Squeezy | `LEMONSQUEEZY_API_KEY` | Payment API | Quarterly |
| Lemon Squeezy | `LEMONSQUEEZY_WEBHOOK_SECRET` | Webhook signature | Quarterly or on compromise |
| Discord | `DISCORD_BOT_TOKEN` | Bot authentication | Quarterly or on compromise |
| PostHog | `NEXT_PUBLIC_POSTHOG_KEY` | Analytics (public, but rotate if abuse) | As needed |
| Database | `DATABASE_URL` | PostgreSQL connection | After password change only |

---

## Rotation Procedures

### 1. Resend API Key Rotation

**Timeline**: ~5 minutes  
**Downtime**: None (keys work in parallel during transition)

#### Steps:

1. **Generate new key**:
   - Log into [Resend Dashboard](https://resend.com/api-keys)
   - Click "Add Another API Key"
   - Give it a name: "insiderclusters-prod-[date]"
   - Copy the new key (shown once)

2. **Update Coolify**:
   - SSH into Coolify server (or use web UI)
   - Navigate to: Applications → insiderclusters → Environment Variables
   - Find: `RESEND_API_KEY`
   - Replace with the new key
   - Save changes

3. **Redeploy**:
   - Trigger a redeploy in Coolify (or restart the container)
   - Monitor logs for: "Resend API key initialized"
   - Test: Submit a magic link request, verify email arrives

4. **Revoke old key**:
   - In [Resend Dashboard](https://resend.com/api-keys)
   - Find the old key (date it was created)
   - Click the delete/revoke button
   - Confirm

5. **Verify**:
   - Test magic link login flow end-to-end
   - Check PostHog for any email delivery errors

---

### 2. Lemon Squeezy API Key Rotation

**Timeline**: ~5 minutes  
**Downtime**: None (webhook secret critical, but API key less so)

#### Steps:

1. **Generate new key**:
   - Log into [Lemon Squeezy Developer Dashboard](https://app.lemonsqueezy.com/developers/api-keys)
   - Click "Create API Key"
   - Give it a name: "insiderclusters-prod-[date]"
   - Copy the new key

2. **Update Coolify**:
   - Update `LEMONSQUEEZY_API_KEY` in environment variables
   - Redeploy

3. **Revoke old key**:
   - In Lemon Squeezy dashboard, click the delete icon next to the old key
   - Confirm

4. **Verify**:
   - If using API to fetch subscription data, test that flow
   - Check logs for any API errors

---

### 3. Lemon Squeezy Webhook Secret Rotation

**Timeline**: ~10 minutes  
**Downtime**: ~30 seconds (webhook processing paused during secret update)

#### Steps:

1. **Generate new secret**:
   - In Lemon Squeezy: Developers → Webhooks
   - Find the webhook for insiderclusters
   - Click "Reveal Secret" and copy it

2. **Update Coolify**:
   - Update `LEMONSQUEEZY_WEBHOOK_SECRET` in environment variables
   - Redeploy

3. **Webhook validation**:
   - New webhook events will be verified with the new secret
   - Old signed events in flight will fail validation (acceptable)

4. **Verify**:
   - Trigger a test webhook from Lemon Squeezy
   - Check logs: "Webhook signature validated successfully"

---

### 4. Discord Bot Token Rotation

**Timeline**: ~5 minutes  
**Downtime**: ~30 seconds (bot restarts)

#### Steps:

1. **Generate new token**:
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Select the "InsiderClusters" application
   - Click "Regenerate" under the TOKEN section
   - Copy the new token (shown once)

2. **Update Coolify**:
   - Update `DISCORD_BOT_TOKEN` in environment variables
   - Redeploy

3. **Verify**:
   - Check Discord logs/activity
   - If bot posts messages, verify they still work
   - Old token becomes invalid immediately

---

### 5. Database Password Rotation

**Timeline**: ~10 minutes  
**Downtime**: ~1-2 seconds (connection pool drain)

#### Steps:

1. **Change password on VPS PostgreSQL**:
   ```bash
   # SSH to VPS
   ssh root@vps-ip
   
   # Connect to Postgres
   sudo -u postgres psql
   
   # Change password
   ALTER USER insiderclusters_user WITH PASSWORD 'new_strong_password_here';
   
   # Exit
   \q
   ```

2. **Update Coolify**:
   - Update `DATABASE_URL` with new password:
   ```
   postgresql://insiderclusters_user:new_password@vps-ip:5432/insiderclusters
   ```

3. **Redeploy**:
   - Coolify redeploys, new connections use new password
   - Old connection pool drains

4. **Verify**:
   - Check logs for any database errors
   - Run a health check endpoint that queries the database

---

## Emergency Key Revocation

If a key is compromised (leaked in logs, exposed in code, etc.):

1. **Immediate action** (same day):
   - Revoke the key immediately in the third-party service
   - Generate a new key

2. **Update & Deploy** (within 1 hour):
   - Update Coolify environment variable
   - Redeploy application

3. **Monitor** (24 hours):
   - Watch logs for any fraudulent activity
   - Check billing for unauthorized charges (Lemon Squeezy)
   - Review PostHog for anomalies

4. **Document**:
   - Record incident in security log
   - Note when key was revoked
   - Determine root cause (prevent recurrence)

---

## Automation (Future)

For reduced manual work, implement secret rotation using:

1. **Coolify Secret Versioning** (if available):
   - Support multiple active keys in parallel
   - Gradual rollover without redeployment

2. **Cloud Provider Services**:
   - AWS Secrets Manager
   - HashiCorp Vault

3. **Scheduled Rotation**:
   - Cron job that rotates keys every 90 days
   - Automatic Coolify redeploy on rotation

---

## Checklist

### Before Rotating Any Secret:

- [ ] Backup current secret (in case rollback needed)
- [ ] Test environment configured with test API keys
- [ ] Monitoring/alerts working (PostHog, error logs)
- [ ] Team notified of impending rotation
- [ ] Maintenance window scheduled (if needed)

### After Rotating Any Secret:

- [ ] Application running without errors
- [ ] All integration tests passing
- [ ] Audit trail recorded (who, when, which secret)
- [ ] Old secret revoked (if not auto-revoking)
- [ ] Team notified of completion
- [ ] Calendar reminder set for next rotation (90 days)

---

## References

- [OWASP: Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [Resend: API Keys](https://resend.com/api-keys)
- [Lemon Squeezy: API & Webhooks](https://docs.lemonsqueezy.com/)
- [Discord: Bot Tokens](https://discord.com/developers/docs/topics/oauth2#bot-access-tokens)
