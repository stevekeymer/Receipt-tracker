# ZeroHours Spend — Stripe test billing setup

Stripe account: zerohours.ca (test/sandbox only)
- Product: `prod_VUvuvvMAeTZENc`
- CAD monthly licensed seat price: `price_1UTw2PFmszEXwvfMa1ZTFtwW` ($9.99 per unique active user)
- Checkout endpoint: `POST /api/billing/checkout` (authenticated owner)
- Portal endpoint: `POST /api/billing/portal`
- Stripe webhook endpoint: `https://spend.zerohours.ca/api/billing/webhook`
- Seat sync: `POST /api/billing/sync-seats` (owner); `POST /api/billing/reconcile-owner` (accepted shared member)
- AI scan: `POST /api/scan` (existing endpoint)

## REQUIRED before testing checkout
Set the following as **Cloudflare Pages production environment secrets** (Workers & Pages → receipt-tracker → Settings → Variables and Secrets), never in GitHub, the browser, or chat:

1. `STRIPE_SECRET_KEY`: **test** secret API key (`sk_test_...`) from the same zerohours.ca Stripe account.
2. `SUPABASE_SERVICE_ROLE_KEY`: Supabase project's secret service role key. Server only. Required for trusted Stripe webhook database writes and AI usage reconciliation.
3. `STRIPE_WEBHOOK_SECRET`: test webhook endpoint signing secret (`whsec_...`). Create a Stripe test webhook destination at `https://spend.zerohours.ca/api/billing/webhook` for `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted`.
4. `BILLING_TEST_ENABLED`: keep **unset** while setting up. Set to `true` **only after** webhook, checkout and scan metering have passed testing, because enabling this gates AI scanning on an active test subscription. It does not gate the rest of the app.

Ensure Stripe **Customer Portal** is enabled/configured in test mode, with card updates, invoices and cancellation enabled. **Do not allow customers to edit subscription quantities in the portal**; seats must match active users and be synchronized from Supabase. Ensure Stripe Tax/tax collection settings are reviewed before any live launch.

The integration rejects live Stripe secret keys and live webhook events. It cannot charge real customers.

## Test checklist
- Owner with one user: checkout shows $9.99 CAD/month.
- Owner with two distinct accepted users across multiple expense accounts: checkout shows 3 seats, $29.97 CAD/month.
- Accept invitation: sync increases Stripe subscription item quantity, prorated by Stripe.
- Remove shared user: owner sync decreases quantity. A user shared to two expense accounts should count only once.
- Portal: update test payment method, see test invoices, cancel at period end.
- Webhook: verify signature, update Supabase subscription row and period end; invalid signature returns HTTP 400.
- AI: enable `BILLING_TEST_ENABLED=true` only after test subscription is active; confirm user-scoped reservations and actual token cost, concurrent requests, and 429 when remaining allowance is insufficient. Manual entry remains available.
- Test signed-out and expired sessions, MFA-required accounts, missing server secrets, failed payments, canceled subscriptions, and webhook retries.

## Known pre-launch work
- This is a **test integration**, not live billing. The Cloudflare secret values and Stripe webhook destination are not automatically provisioned.
- AI cost is estimated from model token usage using fixed rates and a conservative CAD conversion factor; reconcile against OpenAI invoice rates and exchange rates before representing it as a guaranteed $4 spend cap.
- AI allowance resets at UTC calendar-month boundaries; decide whether to align to each Stripe subscription billing cycle before live launch.
- A user shared across different owners has a separate AI allowance per paying owner.
- Automatic owner seat sync on invitation acceptance/removal is implemented. Review unusual membership transitions and out-of-order Stripe events before live billing.
- Consider checkout session idempotency, webhook event deduplication, grace periods, seat payment failures, refunds, and subscription access enforcement before activating live subscriptions.
