# Polar payments setup

Polar (https://polar.sh) checkout + webhooks, integrated 2026-07-14 against the
**live production environment** (org `insiderclusters`,
id `969d11a1-26bb-4772-9369-a4fa99b3f8b8`). Products, checkouts, and orders are
real. Test mode is disabled: the $10 "Test Product" is archived and the
`TESTFREE100` discount is deleted.

## Business model (since 2026-07-14)

No free tier. Two paid plans, each a 7-day free trial (card collected at
checkout, first charge when the trial ends), each with monthly and annual
(20% off) billing shown side by side on Polar's checkout page:

| Plan | Monthly | Annual | Gets |
| --- | --- | --- | --- |
| Basic | $9 | $86.40 | Real-time feed + full history + weekly email digest |
| Pro | $19 | $182.40 | Basic + instant email & Telegram alerts |

Access rule (`web/lib/plan.ts` `hasAccess`, mirrored in the scraper):
`users.plan IN ('basic','pro') AND subscription_status IN ('active','trialing')`.
Everyone else — including signed-in users who never subscribed or whose
subscription lapsed — hits the dashboard paywall. Public SEO pages stay public.

## Polar resources (production)

- Basic monthly `52b3645d-32c8-4f69-9900-9c1701646a85` ($9/mo)
- Basic annual `6aee14c3-f2f3-421b-bc19-aea615218d6a` ($86.40/yr)
- Pro monthly `2628c4fd-38c8-4948-8095-50d25d18db9d` ($19/mo)
- Pro annual `a5036a7a-e7fb-4b76-be3c-338f79245a3a` ($182.40/yr)
- All four: 7-day trial (`trial_interval=day, trial_interval_count=7`) and
  `metadata.tier` = basic|pro. Ids live in `web/lib/billing.ts`.
- Webhook endpoint `acf43aa5-3f04-4091-9677-1f8010140655` →
  `https://insiderclusters.com/api/webhook/polar` (raw; order.created/updated/
  paid/refunded + customer.state_changed)
- Archived: "Test Product" `008cb105-822f-4e01-8688-cb759bd90936`

## How the flow works

1. Signup is still a free magic-link account (`/login`).
2. `/checkout?plan=basic|pro` (login required) creates a Polar checkout with
   the tier's monthly+annual products and `externalCustomerId = users.id`;
   raw `?products=<id>` still works for ad-hoc links.
3. Polar hosts checkout + confirmation; trial starts immediately.
4. `POST /api/webhook/polar` verifies the signature, then
   `customer.state_changed` syncs `users.plan`, `subscription_status`,
   `polar_customer_id`, `polar_subscription_id` (tier resolved from product id
   via `web/lib/billing.ts`; pro > basic when both). No live subscription →
   `plan='free'`, which means paywall. `order.paid` is PostHog revenue
   telemetry only.
5. Scraper dispatch: Pro (active/trialing) → instant email + Telegram;
   Basic → weekly email digest; everyone else → nothing.

## Files (this integration)

- `web/lib/polar.ts` — shared SDK client (`POLAR_SERVER` picks the env)
- `web/lib/billing.ts` — product ids, prices, tier lookup
- `web/lib/plan.ts` — `hasAccess` / `effectivePlan` ("none" | "basic" | "pro")
- `web/app/checkout/route.ts`, `web/app/api/webhook/polar/route.ts`
- `web/components/pricing.tsx` (plan cards), `web/components/paywall.tsx`
- `web/app/dashboard/*` (paywall in layout, de-gated feed/detail, settings)
- `web/app/pricing|terms|login|page.tsx` — copy for the new model
- `web/lib/clusters.ts` — free-tier delay/cap queries removed
- `scraper/src/alerts.ts` (+ its test) — pro/basic recipient queries
- `packages/db/migrations/0008_polar_billing.sql` — renames lemonsqueezy_* →
  polar_*, backfills plan 'paid' → 'pro'

## Environment keys (names only — values in `.env`, git-ignored)

`POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`, `POLAR_SERVER=production`.
All three must be added to Coolify (runtime env is enough; none are
`NEXT_PUBLIC_`).

## Deploy checklist

- [ ] `npx tsc --noEmit` + `next build` (web), `npm run typecheck` + `npm test`
      (scraper) — all passed at setup time.
- [ ] Run `npm run migrate` against the **prod** DB (0008) before or with the
      deploy.
- [ ] Add the three `POLAR_*` env vars in Coolify, deploy web + scraper.
- [ ] End-to-end: log in on prod → paywall → Start free trial → Polar checkout
      (real card, trial = $0 today) → confirm the webhook delivery shows 200 in
      https://polar.sh/dashboard/insiderclusters/settings/webhooks and the
      users row flips to plan basic/pro + status trialing. Cancel from the
      Polar receipt email if it was only a smoke test.
- [ ] Local dev caveat: the registered webhook points at production, so local
      checkouts won't sync plan state unless you tunnel and register a second
      endpoint (or flip `POLAR_SERVER=sandbox` with sandbox products).

## Notes

- **Customer portal needs no app code.** Polar hosts it and emails customers a
  secure link (receipts + trial reminders included) for card changes, plan
  switches, and cancellation. Settings points users there.
- Existing prod users predating billing have `plan='free'` → they'll see the
  paywall and can start a trial. Any old `plan='paid'` rows were grandfathered
  to `pro` by migration 0008.
- This integration talks to **production** Polar — there is no test discount
  anymore; trials are the no-charge test path.
