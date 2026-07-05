# Production Deployment Checklist

Complete this checklist before deploying to production.

## Pre-Deployment (1 week before)

### Code & Testing
- [ ] All tests passing (`npm test`)
- [ ] Type checking clean (`npm run type-check` or `tsc --noEmit`)
- [ ] Linting clean (`npm run lint`)
- [ ] Security audit clean (`npm audit --production`)
- [ ] Manual testing of critical flows:
  - [ ] Magic link auth flow (request → email → verify → dashboard)
  - [ ] Session expiration (after 30 days)
  - [ ] Rate limiting (trigger intentionally, verify HTTP 429)
  - [ ] CSRF protection (test with invalid token)
  - [ ] Error handling (trigger error, verify no stack trace)

### Security Review
- [ ] Security code review completed
- [ ] Threat model reviewed and approved
- [ ] All hardcoded secrets removed (grep for env vars)
- [ ] CSP tested in production mode (no CSP violations)
- [ ] HSTS tested (will cache for 1 year)
- [ ] CORS headers tested (verify same-origin enforcement)

### Database
- [ ] Migrations tested locally (0001 → 0006)
- [ ] Database backup script tested
- [ ] Migration rollback procedure documented
- [ ] Audit logs table created and verified
- [ ] Connection pooling configured (if applicable)

### Documentation
- [ ] Security documentation reviewed (`docs/security/`)
- [ ] API documentation updated
- [ ] Runbook created (how to deploy, scale, monitor)
- [ ] Incident response plan drafted

---

## Pre-Deployment (Coolify Setup)

### Infrastructure
- [ ] Coolify project created and configured
- [ ] VPS (Hetzner) ready with Docker installed
- [ ] Domain name DNS configured (pointing to Coolify server)
- [ ] SSL certificate provisioned (Let's Encrypt via Coolify)
- [ ] Firewall rules configured:
  - [ ] Allow port 80 (HTTP → HTTPS redirect)
  - [ ] Allow port 443 (HTTPS)
  - [ ] Allow port 22 (SSH, restricted to your IP)
  - [ ] Block all other ports

### Environment Variables
- [ ] All required env vars set in Coolify:
  - [ ] `APP_URL` (production domain)
  - [ ] `NODE_ENV=production`
  - [ ] `RESEND_API_KEY` (verified working)
  - [ ] `LEMONSQUEEZY_API_KEY` (verified working)
  - [ ] `LEMONSQUEEZY_WEBHOOK_SECRET` (verified matching Lemon Squeezy)
  - [ ] `DISCORD_BOT_TOKEN` (verified working)
  - [ ] `NEXT_PUBLIC_POSTHOG_KEY` (production instance)
  - [ ] `DATABASE_URL` (postgres://...)
  - [ ] `NEXT_PUBLIC_VERSION` (e.g., "1.0.0")
- [ ] Secrets NOT logged or exposed in config
- [ ] env var validation runs at startup (no missing keys)

### Database
- [ ] PostgreSQL container running
- [ ] Database created: `insiderclusters`
- [ ] User created: `insiderclusters_user` with limited privileges
- [ ] Migrations applied (via `npm run migrate`)
- [ ] Backup script configured (daily 03:15 UTC cron)

### Monitoring & Logging
- [ ] PostHog project created (production)
- [ ] Error tracking configured in PostHog
- [ ] Request logs flowing to Coolify (stdout)
- [ ] Health check endpoint verified (`GET /api/health`)

---

## Deployment Day (1-2 hours before)

### Final Checks
- [ ] All team members notified
- [ ] Maintenance window scheduled (if needed)
- [ ] Rollback plan reviewed (git tags, database snapshots)
- [ ] Support team on standby
- [ ] Status page updated (if applicable)

### Deployment
- [ ] Code pushed to main branch
- [ ] Coolify triggered to redeploy (or manually: `git pull && npm install && npm build && npm start`)
- [ ] Build logs checked (no errors)
- [ ] Container started successfully
- [ ] Logs checked for:
  - [ ] "Server listening on port 3000"
  - [ ] "Database connected"
  - [ ] "API keys initialized"
  - [ ] No ERROR or WARN messages

### Post-Deployment (Immediate)

#### Health Checks
- [ ] Application responding to requests (curl homepage)
- [ ] Health endpoint returns 200 (`curl /api/health`)
- [ ] Database connectivity verified (check health endpoint)
- [ ] All env vars loaded correctly (no missing keys)

#### Core Flows
- [ ] Magic link auth works:
  - [ ] Request link endpoint responds
  - [ ] Email received (check inbox)
  - [ ] Verification link works
  - [ ] Dashboard accessible after login
- [ ] Session persistence (close browser, re-open, still logged in)
- [ ] Logout works (session cleared, redirected to login)

#### Security Headers
- [ ] HTTPS redirect works (http://domain → https://domain)
- [ ] HSTS header present (`curl -I` → look for Strict-Transport-Security)
- [ ] CSP header present (no violations in DevTools console)
- [ ] X-Frame-Options: DENY
- [ ] X-Content-Type-Options: nosniff
- [ ] CORS headers working (same-origin policy enforced)

#### Error Handling
- [ ] Trigger a 404 error (visit non-existent page)
  - [ ] Error message is generic (no stack trace)
  - [ ] Status code is correct
- [ ] Trigger a 500 error (if possible)
  - [ ] Error message is generic
  - [ ] Full error logged server-side (visible in Coolify logs)

#### Rate Limiting
- [ ] Rate limiting working:
  - [ ] Request magic link 4 times rapidly
  - [ ] 4th request returns 429 (Too Many Requests)
  - [ ] Retry-After header present

#### Monitoring
- [ ] PostHog receiving events:
  - [ ] Sign in event captured
  - [ ] Sign out event captured
- [ ] Error tracking working (PostHog shows magic link errors if any)
- [ ] Request logs visible in Coolify (stdout)

---

## Post-Deployment (Next 24 hours)

### Monitoring
- [ ] Error rate < 1% (check PostHog)
- [ ] Response times < 500ms (check PostHog)
- [ ] No database connection errors
- [ ] Rate limit triggers appear normal (no spam)
- [ ] Audit logs working (check database)

### User Testing
- [ ] Announce launch to early users
- [ ] Monitor feedback for issues
- [ ] Verify users can sign up and use app
- [ ] Check email delivery for magic links (no spam folder)

### Documentation & Knowledge
- [ ] Runbook updated with actual commands
- [ ] Team trained on incident response
- [ ] Monitoring dashboards set up
- [ ] Escalation contacts documented

---

## Post-Deployment (Next 7 days)

### Monitoring
- [ ] Error rate remains low (< 1%)
- [ ] Database backups completing daily
- [ ] No security alerts (PostHog, console errors)
- [ ] Performance stable (no degradation)

### Scaling Readiness
- [ ] Traffic analysis: requests/minute, peak traffic
- [ ] Database query performance (slow query log)
- [ ] Memory/CPU usage trending
- [ ] Scaling plan prepared (if needed)

### Security
- [ ] No unauthorized access attempts
- [ ] Rate limit patterns look normal
- [ ] CSRF attempts logged but blocked
- [ ] Audit logs clean (no suspicious activity)

---

## Post-Deployment (Next 30 days)

### Optimization
- [ ] Review slow endpoints (PostHog)
- [ ] Optimize database queries (add indexes if needed)
- [ ] Review error logs and fix common issues
- [ ] User feedback incorporated into bug fixes

### Maintenance
- [ ] Backup restore tested successfully
- [ ] Disaster recovery plan validated
- [ ] Security patch schedule established (monitor npm audit)
- [ ] Cost analysis (database, VPS, Coolify)

---

## Rollback Plan

If critical issues occur after deployment:

### Immediate (< 15 min)
1. **Identify Issue**
   - Check error rate in PostHog
   - Check health endpoint response
   - Review Coolify logs

2. **Decision**
   - Is it a critical issue? (can't sign in, data loss risk, etc.)
   - Can it be fixed with a hotfix? (< 30 min)
   - Or should we rollback?

### Rollback (if needed)

#### Option 1: Git Rollback
```bash
# SSH to VPS
ssh root@vps-ip

# Go to app directory
cd /opt/coolify/sources/insiderclusters/

# Revert to previous commit
git revert HEAD
# OR
git reset --hard [previous-commit-hash]

# Rebuild and restart
npm install && npm build && npm start
```

#### Option 2: Database Snapshot
```bash
# If database was corrupted
# Restore from daily backup (stored in /backups/...)
pg_restore -d insiderclusters < /backups/insiderclusters_2026-07-04.sql
```

#### Option 3: Full VM Snapshot (Hetzner)
If everything fails, Hetzner supports VM snapshots:
1. Hetzner Cloud Console → Server → Snapshots
2. Restore from previous snapshot
3. DNS updates automatic

### Post-Rollback
- Investigate root cause
- Fix issue locally
- Test extensively
- Re-deploy when confident

---

## Monitoring Tools

### Built-in
- [ ] Health check endpoint: `GET /api/health`
- [ ] Database connectivity: included in health check
- [ ] Request logs: visible in Coolify stdout

### PostHog
- [ ] Set up dashboard for:
  - [ ] Daily active users
  - [ ] Sign-in success rate
  - [ ] Error rate by endpoint
  - [ ] Response time trends
- [ ] Alerts for:
  - [ ] High error rate (> 5%)
  - [ ] Slow endpoints (> 1s)
  - [ ] Database connection failures

### Optional (Phase 2)
- [ ] Prometheus: Detailed metrics (CPU, memory, disk)
- [ ] Grafana: Visualization of Prometheus data
- [ ] Uptime Monitor: External health checks
- [ ] Log Aggregation: Centralized log search

---

## Incident Response

### During an Incident
1. **Declare incident** (notify team)
2. **Assess impact** (how many users affected?)
3. **Assign incident commander**
4. **Begin mitigation** (rollback, hotfix, or workaround)
5. **Communicate** (update status page every 15 min)
6. **Resolve** (fix and deploy, or accept impact)
7. **Document** (incident post-mortem within 24 hours)

### Post-Incident
- [ ] Root cause analysis completed
- [ ] Preventive measures implemented
- [ ] Process improvements documented
- [ ] Team debriefed

---

## Checklists for Other Scenarios

### Deploying a Hotfix
- [ ] Hotfix branch created from main
- [ ] Minimal changes (only fix, no refactoring)
- [ ] Tests passing
- [ ] Code reviewed (fast-tracked for emergency)
- [ ] Deploy to production
- [ ] Monitor for 30 min
- [ ] Merge back to main

### Scaling the Application
- [ ] Load testing completed
- [ ] Database query optimization done
- [ ] Caching strategy implemented (if needed)
- [ ] Load balancer configured (if multiple instances)
- [ ] Monitoring alerts adjusted for new capacity

### Adding a New API Endpoint
- [ ] Endpoint implemented using security template
- [ ] All security checks included (CSRF, rate limit, validation, etc.)
- [ ] Tests passing
- [ ] Documentation updated
- [ ] API security guide checklist completed
- [ ] Deployed with health check passing

---

## References

- [AWS Well-Architected Review](https://aws.amazon.com/well-architected/)
- [Google: Production Readiness Review](https://sre.google/workbook/production-readiness-review/)
- [Coolify Deployment Guide](https://coolify.io/docs)
- [Next.js Production Checklist](https://nextjs.org/docs/going-to-production)
