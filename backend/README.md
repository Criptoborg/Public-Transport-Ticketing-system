# Routely API

A Node.js, Express, MongoDB and Mongoose backend for Routely.

## Setup

1. Install Node.js 18 or newer and MongoDB (local or Atlas).
2. From this directory run `npm install`.
3. Copy `.env.example` to `.env` and set:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=replace_with_a_long_random_secret
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=onboarding@resend.dev
FRONTEND_URL=http://localhost:5173
OPENROUTESERVICE_API_KEY=your_openrouteservice_api_key
BASE_FARE=300
FARE_PER_KM=70
CANCEL_CUTOFF_HOURS=2
PAYSTACK_SECRET_KEY=sk_test_replace_with_paystack_test_secret
PAYSTACK_CALLBACK_URL=http://localhost:5173/payment/callback
PENDING_TICKET_MINUTES=15
QR_SIGNING_SECRET=replace_with_a_separate_long_random_secret
BOARDING_WINDOW_BEFORE_MINUTES=60
BOARDING_WINDOW_AFTER_MINUTES=30
```

`CANCEL_CUTOFF_HOURS` sets the minimum time before departure when a passenger may cancel; it defaults to 2 hours. `PAYSTACK_SECRET_KEY` is a backend-only Paystack test/live key and must never be exposed in frontend configuration. `PAYSTACK_CALLBACK_URL` defaults to `${FRONTEND_URL}/payment/callback`. `PENDING_TICKET_MINUTES` defaults to 15. Passwords must contain at least 8 characters, including a letter and a number.

`TRIP_REMINDER_INTERVAL_MINUTES` controls the reminder job scan interval (default 1 minute); eligible paid tickets are emailed once as they reach approximately three hours before departure.

The canonical pending-booking payment API uses `POST /api/payments/initialize` with a booking/ticket ID and the signed webhook at `/api/payments/webhook`. The pre-existing trip-based payment API is retained separately under `/api/payments/legacy`: initialize with `tripId`/`quantity`, verify by reference, and read a payment by ID. Its independent `Payment` records and `PAYMENT_TIMEOUT_MINUTES` remain for compatibility; new frontend work should use the canonical pending-booking API. `BACKEND_URL` is used for the legacy callback fallback; `PAYSTACK_PUBLIC_KEY` is a client-facing provider key and must contain only the Paystack public key, never the secret.

## Seed scripts

`npm run seed:admin` requires `SEED_ADMIN_NAME`, `SEED_ADMIN_EMAIL`, and `SEED_ADMIN_PASSWORD`. The password must be at least 16 characters and include lowercase/uppercase letters, a number, and a symbol. It is hashed with bcrypt, never printed, and an existing non-admin account is never promoted.

`npm run seed:demo` creates one marked Lagos–Ibadan route and trip using stable demo keys, leaving existing records untouched on reruns. It refuses to run when `NODE_ENV=production` unless explicitly invoked as `npm run seed:demo -- --force`. Keep the `.env.example` placeholders out of real credentials.

4. Start development mode with `npm run dev`, or production mode with `npm start`.

The API runs at `http://localhost:5000` by default. No backend files are required outside this `backend/` directory; the root `.gitignore` ignores dependencies and secrets.

In production, set `FRONTEND_URL` to the allowed frontend origin(s), separated by commas if needed. Development additionally permits `http://localhost:5173`. API lists accept `page` and `limit` (default 1 and 20, limit capped at 100) and return pagination details in `meta` while keeping the result array in `data`.

## Paystack payments and legacy tickets

Bookings reserve seats and create pending tickets. Passengers are redirected to Paystack-hosted checkout; Routely never collects card details. A successful verify response or a valid signed webhook activates tickets. Pending reservations expire after `PENDING_TICKET_MINUTES`, releasing held seats. Configure Paystack's webhook URL as `https://YOUR_API_HOST/api/payments/webhook` using the secret key for the same Paystack environment.

Before enabling payments on an existing database, run `node scripts/migrate-existing-tickets.js` from this directory. The script marks existing tickets paid and assigns each a legacy booking ID. Back up the database before migration.

Eligible cancellations initiate partial refunds per ticket for multi-ticket bookings. Provider acceptance marks tickets `refunded`; failures are saved as `refund_failed` for admin follow-up. Bank/card posting times depend on Paystack and the provider.

## Admin reporting and users

`GET /api/admin/stats?days=30` returns aggregate net revenue, tickets sold/status totals, top routes with net revenue and average seat fill, and a continuous daily booking series. `days` is clamped from 1 to 90. `GET /api/admin/tickets` accepts `status`, `paymentStatus`, `route`, `startDate`, `endDate` and `search` filters; `GET /api/admin/tickets/export.csv` exports the same filtered set.

`GET /api/admin/users` lists/searches users with pagination. `PATCH /api/admin/users/:id/role` accepts `passenger`, `conductor`, or `admin`. The current admin cannot demote their own account, and the database guards against demoting the last remaining admin. Trip cancellation runs the ticket/refund cascade and deliberately restores no seats.

## QR tickets and boarding validation

After payment, each ticket receives a JWT signed with `QR_SIGNING_SECRET`; its payload contains only the ticket ID and ticket reference. Keep this secret separate from `JWT_SECRET`. The frontend renders the signed token as a QR; card/list responses do not include it. Admins and users with the `conductor` role can call `POST /api/tickets/validate` with `{ "code": "SIGNED_QR_TOKEN_OR_REFERENCE" }`. Boarding is limited to the configured window before and after departure (defaults 60 and 30 minutes), and an active paid ticket is atomically marked used once. Create conductor accounts only through trusted database administration, never public registration.

Owners and admins can view `/api/tickets/:id`; that response includes the signed QR for paid active tickets and a `cancellationAllowed` flag calculated from the server clock. List responses never include the QR token.

## Authentication

Register creates passenger accounts only. To create the first admin safely, first generate a password hash from this directory:

```powershell
node -e "const bcrypt=require('bcryptjs'); bcrypt.hash('ChangeThisPassword',10).then(console.log)"
```

Then use `mongosh` or MongoDB Compass to insert one admin document into the `users` collection, replacing the hash and database name:

```javascript
db.users.insertOne({
  name: 'System Admin',
  email: 'admin@example.com',
  password: 'PASTE_BCRYPT_HASH_HERE',
  role: 'admin',
  createdAt: new Date(),
  updatedAt: new Date()
})
```

Do not add `role: "admin"` to the public registration request. The API ignores that field and always creates passengers.

## Response format

Successful responses use `{ "success": true, "message": "...", "data": ... }`. Errors use the same shape with `success: false` and `data: null`.

## Authentication endpoints

Public `GET /api/legal/config` returns the active legal version, passenger cancellation cutoff, and refund amount formula. Registration requires `{ "termsAccepted": true }`; the server records the accepted version and time. Authenticated `POST /api/auth/me/accept-terms` with `{ "termsAccepted": true }` records updated terms after the in-app prompt. `GET /api/auth/me/export` downloads the current user's profile, ticket, and payment-reference data. `DELETE /api/auth/me` requires the current password and `confirmation: "DELETE"`; it refuses the last admin, cancels/refunds upcoming paid tickets before anonymisation, and revokes existing sessions. Failed refunds remain for admin follow-up. Account deletion retains pseudonymised ticket/payment records and has no configured purge interval.

| Method | URL | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | No | Register a passenger. Body: `{ "name", "email", "password" }`; password must be at least 8 characters and contain a letter and a number. |
| POST | `/api/auth/login` | No | Log in. Body: `{ "email", "password" }`; returns a one-day JWT and safe user data. |
| POST | `/api/auth/forgot-password` | No | Request a reset link. Body: `{ "email" }`; always returns a generic success message. |
| POST | `/api/auth/reset-password` | No | Set a new password. Body: `{ "token", "newPassword" }`; token expires after 15 minutes. |
| GET | `/api/auth/me` | User | Get the signed-in user's safe profile. |
| PATCH | `/api/auth/me` | User | Update name. Body: `{ "name" }`. |
| POST | `/api/auth/change-password` | User | Change password. Body: `{ "currentPassword", "newPassword" }`; the new password follows the 8-character letter/number rule. Existing sessions remain valid. |

Example success:

```json
{ "success": true, "message": "Login successful", "data": { "token": "JWT_TOKEN", "user": { "id": "...", "name": "Ada", "email": "ada@example.com", "role": "passenger" } } }
```

Use the returned token as `Authorization: Bearer JWT_TOKEN` for protected endpoints.

Registration sends a deterministic welcome email through Resend after the user is saved. A Resend failure is logged safely and does not fail registration. Forgot-password also returns the same generic response whether or not the email exists. Reset tokens are generated with Node.js `crypto`, stored only as SHA-256 hashes, and are never returned by the API or logged.

Successful forgot-password response:

```json
{ "success": true, "message": "If an account exists with that email, a password reset link has been sent.", "data": null }
```

Successful reset response:

```json
{ "success": true, "message": "Password reset successful", "data": null }
```

Invalid or expired reset tokens return HTTP 400. Missing or short passwords also return HTTP 400.

## Route endpoints

| Method | URL | Auth/role | Purpose |
|---|---|---|---|
| GET | `/api/routes` | Any logged-in user | List routes. Optional filters: `origin`, `destination`, `status`. |
| GET | `/api/routes/:id` | Any logged-in user | Get one route. |
| POST | `/api/routes` | Admin | Create route. Body: `{ "origin", "destination", "fare", "status?" }`, or provide coordinate pairs for automatic fare calculation. |
| PUT | `/api/routes/:id` | Admin | Update route using any route fields. |
| DELETE | `/api/routes/:id` | Admin | Delete a route. |

Example manual route body: `{ "origin": "Lagos", "destination": "Ibadan", "fare": 2500 }`.

For automatic fare calculation, provide both `originCoordinates` and `destinationCoordinates`, each with numeric `latitude` and `longitude`. The backend calls the current openrouteservice v2 `directions/driving-car` hosted endpoint, extracts the road distance in meters, converts it to kilometers, and stores `distanceKm` and the calculated `fare` on the route. The formula is `round(BASE_FARE + (distanceKm * FARE_PER_KM))`; defaults are `round(300 + (distanceKm * 70))`. For example, 16 km produces 1,420 Naira with the defaults. Routing failures return a controlled error and do not crash the server.

Example automatic route body:

```json
{
  "origin": "Lagos",
  "destination": "Ibadan",
  "originCoordinates": { "latitude": 6.5244, "longitude": 3.3792 },
  "destinationCoordinates": { "latitude": 7.3775, "longitude": 3.9470 }
}
```

Routes with the existing explicit `fare` shape remain supported. When coordinates are supplied, both coordinate pairs are required and the API-calculated fare replaces any client-supplied fare.

## Trip endpoints

| Method | URL | Auth/role | Purpose |
|---|---|---|---|
| GET | `/api/trips` | Any logged-in user | List trips with populated route details. Filters: `status`, `route`, `origin`, `destination`, `date` (UTC day) or `from`/`to`, `minSeats`, and `sort=departure|price`. |
| GET | `/api/trips/:id` | Any logged-in user | Get one trip with route details. |
| POST | `/api/trips` | Admin | Create trip. Body: `{ "route", "departureTime", "arrivalTime", "availableSeats", "status?" }`. |
| PUT | `/api/trips/:id` | Admin | Update trip. Arrival must be after departure and seats cannot be negative. |
| DELETE | `/api/trips/:id` | Admin | Delete a trip. |

Dates must be valid date strings, for example `2026-10-01T08:00:00.000Z`.
Trip reads accept `origin`, `destination`, `date` (a UTC calendar day) or `from`/`to`, `minSeats`, and `sort=departure|price`, in addition to status/route and pagination. Trips with a seat layout return `seatMap` from `GET /api/trips/:id`; bookings must submit exactly `quantity` unique seat IDs in `seats`.

Optional `seatLayout: { "rows", "columns" }` enables assigned seats; capacity is rows × columns.

## Trip reminders

A background job checks once per minute for active paid tickets with departures about three hours away and sends a Routely reminder through Resend. A per-ticket claim prevents concurrent instances from sending duplicate reminders; unsuccessful email attempts are released for retry. Optional email verification at registration is out of scope.

## Ticket endpoints

| Method | URL | Auth/role | Purpose |
|---|---|---|---|
| POST | `/api/tickets` | Passenger or admin token | Book a scheduled trip. Body: `{ "trip": "TRIP_ID" }`; the server obtains the fare, generates the reference, and reduces seats. |
| GET | `/api/tickets/my-tickets` | Logged-in user | List only the current user's tickets, with passenger, trip and route details. |
| GET | `/api/tickets/:id` | Owner or admin | View a ticket. Passengers cannot view another passenger's ticket. |

Example booking response data includes `ticketReference`, `amount`, `status`, `purchaseDate`, populated `trip`, and populated `trip.route`.

## Admin endpoints

| Method | URL | Auth/role | Purpose |
|---|---|---|---|
| GET | `/api/admin/tickets` | Admin | List all issued tickets with passenger, trip and route details. |
| PATCH | `/api/admin/tickets/:id/status` | Admin | Change status. Body: `{ "status": "active" }`, `used`, or `cancelled`. |

## Admin reporting and access

- `GET /api/admin/stats?days=30` returns total net revenue (paid revenue minus completed refunds), tickets sold/status totals, top ten routes with net revenue and average seat fill, and a continuous daily booking series. `days` is clamped to 1–90.
- `GET /api/admin/tickets` accepts `status`, `paymentStatus`, `route`, `startDate`, `endDate`, and `search`; data remains paginated.
- `GET /api/admin/tickets/export.csv` exports the same filtered set.
- `GET /api/admin/users` accepts `page`, `limit`, and name/email `search`.
- `PATCH /api/admin/users/:id/role` accepts `passenger`, `conductor`, or `admin`. Self-demotion is denied, and a database lock protects the final admin during concurrent role changes.

The admin dashboard reports revenue, ticket counts, booking trends, top routes, and failed refunds. Trip cancellation runs the ticket/refund cascade and does not restore trip seats.

## Postman testing order

1. Start MongoDB and the API.
2. Register a passenger and log in as that passenger.
3. Create the first admin directly in MongoDB, then log in as the admin.
4. As admin, create a route.
5. As admin, create a scheduled trip using the route ID.
6. As passenger, list routes and trips.
7. As passenger, book the trip with only its trip ID.
8. As passenger, call `my-tickets` and the returned ticket ID.
9. As admin, list all tickets and update the ticket status.
10. Test a passenger token against an admin endpoint and confirm HTTP 403.

## Folder structure

```text
backend/
├── src/
│   ├── config/db.js
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── utils/generateTicketReference.js
│   └── app.js
├── .env.example
├── package.json
└── README.md
```

Assumptions: route/trip reads require a logged-in user; booking requires authentication; and deleting a route or trip with ticket references is refused.
