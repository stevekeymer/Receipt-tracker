# ZeroHours Spend — SaaS UI, performance and SEO audit
Date: 2026-10-24
Scope: GitHub source review and Cloudflare Pages deployment checks. No authenticated interactive browser session or Lighthouse measurements were available.

## Changes shipped
- Organized Settings into dedicated categories (accounts, categories, billing, profile/security, appearance, offline/device), preserving existing forms and access checks.
- Added mobile navigation and improved Settings back-navigation.
- Reworked service-worker asset strategy: JavaScript and CSS are fetched fresh when online, cached copies are used offline, cache version incremented to v26 and settings-ui.js added to offline shell.
- Added /features.html, a public crawlable product overview with a title, meta description, canonical, Open Graph metadata and SoftwareApplication structured data.
- Added sitemap.xml, robots.txt and Cloudflare Pages security/search headers.
- Set private application root to noindex; search discovery should focus on public marketing content, not authenticated financial views.
- Linked the sign-in panel to the public product overview.

## Findings requiring follow-up

### P0 — Correctness and security
1. Perform authenticated browser regression tests on iPhone Safari/PWA and desktop Chrome, including navigation, trial gate, MFA, account sharing, receipt scanning and offline PIN. Code inspection is not a substitute.
2. Verify Stripe test-mode billing webhooks and seven-day trial conversion before any live payment launch.
3. Validate tenant isolation, sharing permissions and deletion paths against the database RLS policies, not just UI controls.
4. Add automated tests and CI for access-control scenarios, payment state changes and offline synchronization.

### P1 — Performance
1. Main index.html is ~92 KB with a large inline script, ~100 inline style attributes and inline CSS. Extract application JavaScript and styles into versioned assets with a build step; use minification and tree-shaking after regression tests.
2. loadCloudExpenses currently retrieves expense_items by owner and filters to active expense IDs in the browser. Restrict the query server-side to the selected account's expense IDs (or account_id with RLS) to reduce transfer and client memory for users with multiple accounts.
3. renderItems searches expenses with Array.find per item; use a Map keyed by expense ID to avoid O(items × expenses) behavior.
4. Search/filter events call render synchronously; debounce text input and paginate/virtualize large expense lists.
5. Add RUM or Lighthouse measurement for LCP, INP, CLS, transferred JS, long tasks and API request counts. No performance score is asserted without measurement.
6. Verify correct cache-control for hashed assets and check offline updates on installed iOS PWAs.

### P1 — UX
1. Test settings navigation with keyboard, screen reader and mobile viewport; improve focus restoration when changing screens.
2. Account creation and invitation should have a clear confirmation state and visible pending invitation status. Invitation emails are not currently automatic.
3. Categories are stored in browser localStorage; design a per-user/per-account synchronized category model before changing storage. Do not migrate blindly because it affects existing users and shared accounts.
4. Improve feedback for duplicate categories, empty submissions, long-running saves and error states.
5. Clarify AI allowances (trial lifetime vs paid monthly) and display consumption against the shared scan/chat budget.
6. Simplify owner-versus-sponsored-member billing explanations while keeping full detail available.
7. Replace emoji-only icons with accessible, consistent iconography over time.

### P1 — SEO and acquisition
1. Private app root should not be indexed; /features.html is the intended indexable landing page.
2. Publish a product-specific privacy policy, terms, support/contact page and accurate product screenshots before public launch.
3. Add an OG preview image (1200×630) and verify social cards, canonical, sitemap and search-console ownership.
4. Add relevant public content only where useful (receipts, shared expenses, small business workflows); avoid thin keyword-stuffed pages.
5. Check indexing after deployment via Search Console; no rankings or crawl success are claimed.
6. Validate all copy against actual product behavior, especially test-mode billing, email delivery, receipt retention and AI processing.

### P2 — Product operations
1. Add anonymous opt-in analytics for onboarding funnel, first expense, first scan, invited member acceptance, trial conversion and retention. Never send receipt contents or financial records to analytics.
2. Add centralized error monitoring with redaction for financial details and authentication tokens.
3. Add rate limiting and abuse detection for scan API, invite endpoints and other paid operations.
4. Add an accessible in-app help center and a support path.

## Suggested verification checklist
- [ ] New customer can reach /features.html without login
- [ ] Public page has canonical/meta/schema; sitemap includes only public URL
- [ ] App root sends X-Robots-Tag: noindex
- [ ] Returning PWA receives latest JS when online and loads offline after installation
- [ ] Mobile tab bar does not obscure controls or conflict with authentication overlays
- [ ] All six Settings screens open and back-navigation works
- [ ] Shared-account owner/member permissions behave as before
- [ ] Category creation and receipt scanning still work
- [ ] Stripe trial and billing state remain unchanged
- [ ] Measure Lighthouse mobile performance after browser access is available

## Release boundaries
This release does not modify Supabase schema, stored expenses, Stripe pricing or payments. It does not implement the prospective AI chat assistant. It does not claim a measured Core Web Vitals improvement or a completed end-to-end test.
