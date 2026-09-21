# Public Transport Ticketing API

A simple Node.js, Express, MongoDB and Mongoose backend for the Public Transport Ticketing System MVP. Ticket creation represents a booking only; there is no real payment gateway.

## Setup

1. Install Node.js 18 or newer and MongoDB (local or Atlas).
2. From this directory run `npm install`.
3. Copy `.env.example` to `.env` and set:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=replace_with_a_long_random_secret
```

4. Start development mode with `npm run dev`, or production mode with `npm start`.

The API runs at `http://localhost:5000` by default. No backend files are required outside this `backend/` directory; the root `.gitignore` ignores dependencies and secrets.

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

| Method | URL | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | No | Register a passenger. Body: `{ "name", "email", "password" }`; password must be at least 6 characters. |
| POST | `/api/auth/login` | No | Log in. Body: `{ "email", "password" }`; returns a one-day JWT and safe user data. |

Example success:

```json
{ "success": true, "message": "Login successful", "data": { "token": "JWT_TOKEN", "user": { "id": "...", "name": "Ada", "email": "ada@example.com", "role": "passenger" } } }
```

Use the returned token as `Authorization: Bearer JWT_TOKEN` for protected endpoints.

## Route endpoints

| Method | URL | Auth/role | Purpose |
|---|---|---|---|
| GET | `/api/routes` | Any logged-in user | List routes. Optional filters: `origin`, `destination`, `status`. |
| GET | `/api/routes/:id` | Any logged-in user | Get one route. |
| POST | `/api/routes` | Admin | Create route. Body: `{ "origin", "destination", "fare", "status?" }`. Fare must be greater than 0. |
| PUT | `/api/routes/:id` | Admin | Update route using any route fields. |
| DELETE | `/api/routes/:id` | Admin | Delete a route. |

Example route body: `{ "origin": "Lagos", "destination": "Ibadan", "fare": 2500 }`.

## Trip endpoints

| Method | URL | Auth/role | Purpose |
|---|---|---|---|
| GET | `/api/trips` | Any logged-in user | List trips with populated route details. Optional filters: `status`, `route`. |
| GET | `/api/trips/:id` | Any logged-in user | Get one trip with route details. |
| POST | `/api/trips` | Admin | Create trip. Body: `{ "route", "departureTime", "arrivalTime", "availableSeats", "status?" }`. |
| PUT | `/api/trips/:id` | Admin | Update trip. Arrival must be after departure and seats cannot be negative. |
| DELETE | `/api/trips/:id` | Admin | Delete a trip. |

Dates must be valid date strings, for example `2026-10-01T08:00:00.000Z`.

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
├── config/db.js
├── controllers/
├── middleware/
├── models/
├── routes/
├── services/
├── utils/generateTicketReference.js
├── .env.example
├── app.js
├── package.json
└── README.md
```

The `services/` folder is intentionally empty for future business logic. Assumptions: route/trip reads require a logged-in user, ticket booking is allowed for any authenticated role because the MVP has one booking flow, and deleting a route or trip does not cascade-delete existing tickets.
