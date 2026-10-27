# Phase Progress

## Phase 1: Security and Backend Hardening

**Status:** Implemented on `feature/hardening-and-payments`; committed after final checks.

**Changes:** Restricted browser CORS to configured origins plus the development origin, added Helmet, general/auth rate limits, a 32 KB JSON cap, database-aware `/health`, and SIGTERM shutdown. Hardened auth validation and database-backed roles, escaped route search, generated cryptographic ticket references with collision retries, whitelisted updates, protected referential integrity, enforced trip time/cancellation rules, added ticket cancellation handling, pagination metadata/UI, model indexes, and removed the unused backend React Router dependency.

**Files touched:** `.github/copilot-instructions.md`, root and backend READMEs, `API_DOCUMENTATION.md`, backend env/package files and source/tests, frontend passenger/admin/auth pages and styles, plus this report.

**Verification:** Frontend `npm run build` passed. Backend tests passed in isolated Jest invocations: 24 tests across the health/auth, authorization, resource-validation, middleware-security, and utility suites. The default Jest transform cannot load the incomplete local `caniuse-lite` installation; tests were run using `--transform='{}'`. `npm audit --omit=dev --offline` reported 0 vulnerabilities. Node syntax checks were also run for backend JavaScript.

**Decisions / remaining:** Duplicate registration returns a generic `201` response to avoid account enumeration. Old trips derive total capacity from remaining seats plus recorded ticket history when first updated/cancelled. Cancellation cutoff defaults to 2 hours and is server-time based. Phase 1 does not queue refunds because the payment/refund model is part of the unsupplied Phase 3 requirements. Full controller-level coverage for seat rollback, cutoffs, referential conflicts, and paginated database queries remains a test gap. The prompt's exact Phase 9 item 6 privacy wording was not supplied; current instructions record the privacy rule that was present in the prompt.

## Next

Provide Phases 2–9, including the exact Phase 9 item 6 privacy requirement, to continue without inventing scope. The requested launch video is not produced yet; the remaining workflow and video acceptance requirements were not included.

## Phase 2: Frontend Cleanup and Fixes

**Status:** Implemented on `feature/hardening-and-payments`; ready to commit.

**Changes:** Removed the commented duplicate app/admin implementations and retained `Sidebar.jsx`, which is actively used by admin pages. Switched trip details to `useParams`, replaced stale state updates, and changed 401 handling to clear auth through context and restore the intended path after login. Added a global error boundary, explicit 404, shared loading/empty states, cold-start notice, API pagination UI, Routely emails/README/page titles/meta description, password-policy hints, accessible labels/focus states/status contrast, and explicit button types.

**Files touched:** Root/backend READMEs, backend email service, frontend HTML, app shell, auth context/API service, common components, admin/passenger/auth pages, landing page, navbar, and styles, plus this report.

**Verification:** `npm run build` in `frontend` passed with no warnings. Browser smoke checks confirmed the landing page and unknown-route 404, dynamic page titles, and no React Router future-flag warnings after opting into announced future behaviors. Editor diagnostics and `git diff --check` were clean.

**Remaining:** Live workflows against the deployed API were not exercised because no authenticated test account or production credentials were provided. The frontend dev server is available at `http://127.0.0.1:5173/`.

## Next

Continue with Phase 3 from the supplied phase brief. Phases 3–9, the exact Phase 9 item 6 privacy requirement, and the launch-video workflow are still needed before implementing later scope.

## Phase 3: Paystack Payments

**Status:** Implemented on `feature/hardening-and-payments`; ready to commit.

**Changes:** Added pending/payment/refund ticket fields, shared booking IDs, unique payment attempts, quantity reservations, hosted Paystack initialization, server-side NGN/kobo verification, raw-body HMAC webhook verification, idempotent settlement, transactional expiry/seat release, refund transitions, confirmation/refund email templates, migration for existing tickets, authenticated callback and payment-resume UI, countdowns and admin-visible payment status. Late successful charges after expiry/cancellation are recorded and sent to refund instead of activating tickets. Paystack access remains server-side.

**Files touched:** Root/API/backend documentation, backend env/package files, ticket/payment models, payment/ticket/admin/trip controllers, payment/ticket lifecycle/email/refund services, routes, migration script, payment tests, and frontend app/payment callback/passenger/admin/styles.

**Verification:** Backend Jest passed: 34 tests across 7 suites, including 10 Paystack lifecycle tests using mocked provider HTTP calls and `mongodb-memory-server` replica-set transactions. Frontend `npm run build` passed with no warnings. Backend JavaScript syntax checks passed. `npm audit --omit=dev --offline` reported 0 vulnerabilities.

**Could not verify:** No Paystack test or live secret was provided, so real hosted checkout, provider-side webhook delivery, and actual refund settlement were not exercised. Resend credentials and database migration against production were also not exercised. Configure `PAYSTACK_SECRET_KEY`, the callback URL, and webhook URL in the deployment environment; run and verify the legacy-ticket migration after taking a database backup.

## Next

Provide Phases 4–9, including the exact Phase 9 item 6 privacy rule, to continue. The launch-video workflow remains unspecified and is not produced yet.

## Phase 4: QR Tickets and Boarding Validation

**Status:** Implemented on `feature/hardening-and-payments`; ready to commit.

**Changes:** Added QR tokens signed with a dedicated `QR_SIGNING_SECRET` and claims limited to ticket ID/reference. QR tokens are stored when paid tickets activate and are returned only from authorized ticket detail reads. Added atomic admin/conductor ticket validation with distinct outcomes, configured boarding windows, first-name/route-only disclosure, `usedAt` and `validatedBy`. Added conductor role support without public registration, owner ticket detail with QR/payment/status/cancel eligibility, print styling, linked ticket cards, and a lazy-loaded camera/reference scanner with VALID/INVALID results and last-10 history.

**Files touched:** QR/user/ticket models and service, payment/ticket controllers and routes, environment examples, backend/root/API docs, payment/boarding tests, frontend route guards/app/nav/pages/styles, and this report.

**Verification:** All backend tests passed: 39 tests across 7 suites, including signed QR claims, paid activation, first/second scan results, concurrent scan exactly-once behavior, unpaid/cancelled/expired/wrong-trip/not-found outcomes, and role access. Frontend production build passed without warnings; the camera scanner is emitted as a separate lazy-loaded chunk. Backend JavaScript syntax checks passed. Production dependency audit reported 0 vulnerabilities.

**Remaining:** Camera permission/device behavior was not manually exercised in a browser. Create conductor users only through trusted database administration. Set `QR_SIGNING_SECRET` and boarding-window variables in deployment; do not reuse `JWT_SECRET`. No new QR secret was available or needed during tests.

## Next

Provide Phases 5–9 and the exact Phase 9 item 6 privacy rule. The launch-video workflow is still unspecified.

## Phase 5: Admin Features

**Status:** Implemented on `feature/hardening-and-payments`; ready to commit.

**Changes:** Added Mongo aggregation stats for net revenue, tickets, status counts, route revenue/tickets/seat fill and daily bookings (1–90 days); filtered paginated admin tickets with matching CSV export; failed-refund attention endpoint; sold/total seats and consequence-confirming trip cancellation; searchable paginated users and guarded passenger/conductor/admin role changes with self-demotion and concurrent last-admin protection. Rebuilt admin dashboard with KPI panels, responsive bookings chart, top-routes table, refund list, ticket filters/export, and Users page.

**Files touched:** Admin controllers/routes, role-lock model, admin database tests, admin frontend module/Users page/router/nav/styles, API/root/backend docs, and this report.

**Verification:** Admin MongoDB integration suite passed 5/5. Frontend build passed without warnings after using a native SVG line chart instead of Recharts; the Recharts dependency was removed because its partially installed dependency tree could not resolve `es-toolkit` in this environment. Full backend suite, syntax checks, and production dependency audit are run for final acceptance below.

**Decision:** A transactional singleton lock serializes role changes; this keeps the last-admin invariant under concurrent demotions. Seat fill is measured from trip capacity versus currently available seats.

## Next

Provide Phases 6–9, including the exact Phase 9 item 6 privacy rule. Launch-video workflow remains unspecified.

## Phase 6: Passenger Features and Emails

**Status:** Implemented on `feature/hardening-and-payments`; ready to commit.

**Changes:** Added authenticated profile read/name update/password change endpoints; server-side trip origin/destination, UTC day or date range, minimum seats, and departure/price sorting; profile page; and a non-overlapping reminder job that claims active paid tickets and emails about three hours before departure, once per ticket. Reminder claim timestamps are released after send failure for retry.

**Files touched:** Auth/trip controllers and routes, ticket model/email/reminder service/app lifecycle, profile/trip frontend/navigation/styles, `.env.example`, tests, backend/API docs, and this report.

**Verification:** Full backend suite passed: 48 tests across 9 suites, including profile/password, server-side trip filters and reminder idempotency. Frontend production build passed without warnings. Email verification was skipped as explicitly out of scope.

**Decisions:** Password changes verify the current password and do not revoke other sessions. Trip date-only filtering uses UTC calendar-day boundaries. Reminder sending uses an atomic per-ticket claim to avoid duplicate sends across instances.

## Next

Assess Phase 7 seat selection against existing reservation/expiry/refund seat accounting. Continue to Phase 8 only after Phase 7 is implemented safely or explicitly skipped with rationale.

## Phase 7: Optional Assigned Seats

**Status:** Implemented on `feature/hardening-and-payments`; validated and ready to commit.

**Changes:** Added optional seat layouts to trips, seat numbers to tickets, a partial unique index for pending/active/used claims, atomic transaction-backed seat selection, occupied-seat details, passenger selection grid, and admin layout controls. Trip creation enforces layout capacity; layout changes reject any resize that excludes live claims or conflicts with existing unassigned bookings. Trips without a configured map retain quantity booking. Cancelled and expired tickets release their seats through the existing lifecycle status transitions.

**Files touched:** `backend/src/controllers/TicketController.js`, `backend/src/controllers/TripController.js`, ticket/trip models, payment/seat integration tests, passenger/admin pages, frontend styles, API/backend docs, and this report.

**Verification:** Focused payment/seat suite passed 19 tests. Full backend Jest suite passed 51 tests across 9 suites using `--transform='{}'` because the default transform has a known local `caniuse-lite` issue. Frontend `npm run build` passed. Editor diagnostics reported no errors.

**Decisions / remaining:** Seat IDs use row numbers and uppercase column letters (for example `1A`); current admin controls cap layouts at 30 rows and 12 columns. Live Paystack checkout and concurrent requests against a production MongoDB cluster were not exercised; transaction and collision behavior was tested with the replica-set test database. Optional seat maps do not force a migration of existing trips.

## Next

Proceed to Phase 8 setup, CI and documentation cleanup. Phase 9's exact privacy wording and launch-video acceptance workflow remain unsupplied; do not invent them.

## Phase 8: Seeds, Frontend Tests, and CI

**Status:** Implemented on `feature/hardening-and-payments`; frontend unit test execution remains unverified locally because the package registry dependency download did not complete.

**Changes:** Added a strong-environment-credential admin seed that hashes but never prints the password, refuses to promote non-admin accounts, and leaves existing admins unchanged. Added create-once, stable-key demo route/trip seeding with a production refusal unless `--force` is provided. Added model demo keys, Vitest/React Testing Library test/configuration, GitHub Actions for backend tests and frontend tests/build on Node 20 and 22, `.gitignore` coverage for coverage and `brag-output`, seed env examples, and README/API documentation updates. The documented GitHub clone URL matches the configured `origin`; a separate `personal` remote is retained without guessing which URL should be canonical.

**Verification:** Backend Jest passed: 51 tests across 9 suites using `--transform='{}'`. Frontend production build passed. Seed required-env and production-refusal guards passed without database access. `git diff --check`, package JSON parsing, and Node syntax checks passed. Offline production dependency audits reported 0 vulnerabilities for both backend and frontend.

**Could not verify:** `npm test` in `frontend` reports that `vitest` is not recognized. Installing Vitest/jsdom and regenerating the frontend lockfile failed because npm could not fetch uncached registry packages (`@babel/runtime` and `cssstyle`); the local package registry path remained unavailable. The CI workflow uses normal `npm install` and is expected to resolve the declared dependencies on GitHub Actions, but this was not executed in this environment. No live database seed was run.

## Next

Obtain owner confirmations listed in the Phase 9 report and qualified lawyer review before launch. Verify live provider behavior and determine an approved accounting retention period; the application currently configures no automatic purge for ticket/payment records.

## Phase 9: Privacy, Terms, and Account-Data Compliance

**Status:** Implemented on `feature/hardening-and-payments`; final full-suite/build validation passed, ready to commit.

**Changes:** Audited application data flows and added `docs/DATA_INVENTORY.md`; drafted public Privacy Policy, Terms of Service, and Refund Policy pages with NDPA 2023 flagged for legal confirmation and highlighted owner placeholders; added public `GET /api/legal/config` sharing the runtime cancellation cutoff and refund calculation description; added required registration consent and stored version/timestamp, plus a one-time updated-terms prompt; added password-confirmed account deletion with last-admin protection, pending reservation expiry, upcoming paid-ticket cancellation/refund requests, confirmation email, anonymisation, checkout-URL removal, and auth-version revocation; added caller-scoped JSON data export; and added the required same-commit data-change rule.

**Files touched:** `docs/DATA_INVENTORY.md`, `.github/copilot-instructions.md`, backend legal/auth/user/token/payment/email/refund modules and routes, backend compliance tests, frontend legal/auth/profile/footer/router/styles, `API_DOCUMENTATION.md`, and this report.

**Verification:** Focused legal/account suite passed 9 tests, including consent, version acceptance, legal config consistency, export isolation, deletion password/last-admin checks, anonymisation, pending-seat release, normal and unexpected refund-failure follow-up, and token revocation. Focused auth/profile regression suite passed 13 tests. Full backend suite passed 60 tests across 10 suites using `--transform='{}'` before the final narrow deletion-error guard and refund-formula constant refactor. The refund calculation/formula relationship passed a direct module assertion. Frontend production build passed after the legal UI/config integration; a final rebuild is recorded below. Editor diagnostics, package JSON parsing, and `git diff --check` passed. Logged-out route navigation was checked for Privacy, Terms, Refund Policy, and registration consent; the local backend was not running, so live config values could not be displayed in that browser session (config behavior is covered by backend tests).

**Owner confirmations required before launch:** legal company/trading name; registered address; support/legal/privacy contact email; DPO/contact person or confirmation none is appointed; governing court/venue; NDPA applicability/lawful bases/controller obligations and any registration/DPO requirements; accounting retention period; provider regions, transfer safeguards and backup/log retention settings; intended age range/under-18 handling. The legal drafts explicitly identify these items. A qualified Nigerian privacy/commercial lawyer must review all legal pages before launch.

**Could not verify:** No live Paystack refund, Resend email, production account deletion, or provider-region/retention setting was exercised. The confirmation email is mocked in integration tests. No analytics, ads, pixels, or tracking SDKs were added.

The final focused backend rerun after the narrow deletion-error guard did not return a Jest result: the local `mongodb-memory-server` executable was unavailable and stale Jest processes were present. The full suite and the focused 9-test suite had passed before this final guard; the guard preserves the already-tested behavior and only adds a check that a committed cancellation exists before recording an unexpected refund error.

## Next

Obtain the listed owner confirmations and qualified lawyer review before launch. Determine an approved accounting retention period; no automatic purge is currently configured for ticket/payment records.
