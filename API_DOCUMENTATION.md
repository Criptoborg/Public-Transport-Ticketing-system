# Public Transport Ticketing System API Documentation

## Overview

This document describes the REST API for the Public Transport Ticketing System.

**Production Base URL**

```text
https://public-transport-ticketing-system-5biy.onrender.com
```

For local development:

```text
http://localhost:5000
```

All request and response bodies use JSON unless stated otherwise.

## Authentication

Protected endpoints require a JWT in the `Authorization` header:

```http
Authorization: Bearer <token>
```

Tokens are returned by the login endpoint and expire after 1 day.

The API has two roles:

- `passenger` — default role for registered users.
- `admin` — can manage routes and trips and access administrative ticket endpoints.

## Standard Response Format

Successful responses generally follow:

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {}
}
```

Errors generally follow:

```json
{
  "success": false,
  "message": "Error description",
  "data": null
}
```

---

## Health Check

### GET `/`

Checks whether the API is running.

**Authentication:** None

**Example response**

```json
{
  "success": true,
  "message": "Public Transport Ticketing API is running"
}
```

---

# Authentication

Base path: `/api/auth`

## Register Passenger

### POST `/api/auth/register`

Creates a new passenger account. New users receive the `passenger` role by default.

**Authentication:** None

**Request body**

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

**Validation**

- `name`, `email`, and `password` are required.
- Email must be valid.
- Password must contain at least 6 characters.
- Email must not already be registered.

**Success:** `201 Created`

```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "user": {
      "id": "USER_ID",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "passenger"
    }
  }
}
```

**Common errors**

- `400` — missing/invalid fields or password too short.
- `409` — email already registered.

---

## Login

### POST `/api/auth/login`

Authenticates a user and returns a JWT.

**Authentication:** None

**Request body**

```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Success:** `200 OK`

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "JWT_TOKEN",
    "user": {
      "id": "USER_ID",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "passenger"
    }
  }
}
```

**Common errors**

- `400` — email/password missing.
- `401` — invalid email or password.

---

## Forgot Password

### POST `/api/auth/forgot-password`

Requests a password-reset email.

**Authentication:** None

**Request body**

```json
{
  "email": "john@example.com"
}
```

For security, the endpoint returns the same generic success response even when an account does not exist.

**Success:** `200 OK`

```json
{
  "success": true,
  "message": "If an account exists with that email, a password reset link has been sent.",
  "data": null
}
```

The generated reset token expires after 15 minutes.

---

## Reset Password

### POST `/api/auth/reset-password`

Resets a password using the token received through the reset link.

**Authentication:** None

**Request body**

```json
{
  "token": "RESET_TOKEN",
  "newPassword": "newPassword123"
}
```

**Success:** `200 OK`

```json
{
  "success": true,
  "message": "Password reset successful",
  "data": null
}
```

**Common errors**

- `400` — missing token/password, password too short, or invalid/expired token.

---

# Routes

Base path: `/api/routes`

All route endpoints require authentication. Creating, updating, and deleting routes additionally require the `admin` role.

## List Routes

### GET `/api/routes`

Returns routes, sorted newest first.

**Authentication:** Bearer token

**Optional query parameters**

- `origin` — case-insensitive origin search.
- `destination` — case-insensitive destination search.
- `status` — e.g. `active` or `inactive`.

**Example**

```text
GET /api/routes?origin=Ikotun&destination=Yaba&status=active
```

**Success:** `200 OK`

---

## Get Route

### GET `/api/routes/:id`

Returns one route.

**Authentication:** Bearer token

**Common errors**

- `400` — invalid route ID.
- `404` — route not found.

---

## Create Route

### POST `/api/routes`

Creates a route.

**Authentication:** Bearer token + Admin role

**Request body**

```json
{
  "origin": "Ikotun",
  "destination": "Yaba",
  "originCoordinates": {
    "latitude": 6.5444,
    "longitude": 3.2633
  },
  "destinationCoordinates": {
    "latitude": 6.5095,
    "longitude": 3.3711
  },
  "status": "active"
}
```

A positive `fare` may also be supplied manually:

```json
{
  "origin": "Ikotun",
  "destination": "Yaba",
  "fare": 1500,
  "status": "active"
}
```

When valid origin and destination coordinates are provided and no positive manual fare is supplied, the backend can calculate route distance/fare. If neither produces a fare, the configured base fare is used.

**Success:** `201 Created`

**Common errors**

- `400` — origin/destination missing or only one coordinate object supplied.
- `401` — missing/invalid authentication token.
- `403` — authenticated user is not an admin.

---

## Update Route

### PUT `/api/routes/:id`

Updates route fields.

**Authentication:** Bearer token + Admin role

**Example request**

```json
{
  "fare": 1800,
  "status": "active"
}
```

If coordinates are updated and no positive fare is explicitly supplied, the backend may recalculate the fare and distance.

**Success:** `200 OK`

**Common errors**

- `400` — invalid route ID or invalid route data.
- `404` — route not found.
- `403` — admin permission required.

---

## Delete Route

### DELETE `/api/routes/:id`

Deletes a route.

**Authentication:** Bearer token + Admin role

**Success:** `200 OK`

```json
{
  "success": true,
  "message": "Route deleted successfully",
  "data": null
}
```

---

# Trips

Base path: `/api/trips`

All trip endpoints require authentication. Creating, updating, and deleting trips require the `admin` role.

## List Trips

### GET `/api/trips`

Returns trips ordered by departure time.

**Authentication:** Bearer token

**Optional query parameters**

- `status` — `scheduled`, `completed`, or `cancelled`.
- `route` — MongoDB route ID.

**Example**

```text
GET /api/trips?status=scheduled&route=ROUTE_ID
```

**Success:** `200 OK`

---

## Get Trip

### GET `/api/trips/:id`

Returns one trip with populated route information.

**Authentication:** Bearer token

**Common errors**

- `400` — invalid trip ID.
- `404` — trip not found.

---

## Create Trip

### POST `/api/trips`

Creates a new trip.

**Authentication:** Bearer token + Admin role

**Request body**

```json
{
  "route": "ROUTE_ID",
  "departureTime": "2026-10-01T08:00:00.000Z",
  "arrivalTime": "2026-10-01T09:30:00.000Z",
  "availableSeats": 30,
  "status": "scheduled"
}
```

**Validation**

- Route, departure time, arrival time, and available seats are required.
- Route must be a valid existing route ID.
- Arrival time must be later than departure time.
- Available seats cannot be negative.
- Status can be `scheduled`, `completed`, or `cancelled`.

**Success:** `201 Created`

---

## Update Trip

### PUT `/api/trips/:id`

Updates a trip.

**Authentication:** Bearer token + Admin role

**Example request**

```json
{
  "availableSeats": 25,
  "status": "scheduled"
}
```

**Success:** `200 OK`

---

## Delete Trip

### DELETE `/api/trips/:id`

Deletes a trip.

**Authentication:** Bearer token + Admin role

**Success:** `200 OK`

---

# Tickets

Base path: `/api/tickets`

Every ticket endpoint requires a valid Bearer token.

## Book/Create Ticket

### POST `/api/tickets/createticket`

Books a ticket for the authenticated user.

**Authentication:** Bearer token

**Request body**

```json
{
  "trip": "TRIP_ID"
}
```

The backend:

1. Confirms the trip exists.
2. Requires the trip to have `scheduled` status.
3. Requires at least one available seat.
4. Decreases available seats by one.
5. Uses the fare stored on the trip's route rather than accepting an amount from the client.
6. Generates a unique ticket reference.

**Success:** `201 Created`

**Common errors**

- `400` — trip missing/invalid, trip is not scheduled, or no seats available.
- `404` — trip not found.

---

## My Tickets

### GET `/api/tickets/my-tickets`

Returns all tickets belonging to the logged-in user, newest purchase first.

**Authentication:** Bearer token

**Success:** `200 OK`

---

## Get Ticket

### GET `/api/tickets/:id`

Returns one ticket.

**Authentication:** Bearer token

Passengers may only view their own tickets. Admin users may view other tickets through this endpoint.

**Common errors**

- `400` — invalid ticket ID.
- `403` — passenger attempted to view another user's ticket.
- `404` — ticket not found.

---

## Cancel Ticket

### DELETE `/api/tickets/:id`

Cancels an active ticket belonging to the authenticated passenger.

**Authentication:** Bearer token

When cancellation succeeds, the ticket status becomes `cancelled` and one seat is returned to the associated trip.

**Success:** `200 OK`

**Common errors**

- `400` — invalid ticket ID or ticket is not active.
- `403` — passenger attempted to cancel another user's ticket.
- `404` — ticket not found.

---

# Admin Ticket Management

Base path: `/api/admin`

Every endpoint in this section requires both a valid Bearer token and the `admin` role.

## View Issued Tickets

### GET `/api/admin/tickets`

Returns issued tickets with populated passenger, trip, and route information.

**Authentication:** Bearer token + Admin role

**Success:** `200 OK`

---

## Update Ticket Status

### PATCH `/api/admin/tickets/:id/status`

Changes a ticket's status.

**Authentication:** Bearer token + Admin role

**Request body**

```json
{
  "status": "used"
}
```

Allowed values:

- `active`
- `used`
- `cancelled`

**Success:** `200 OK`

**Common errors**

- `400` — invalid ticket ID or invalid status.
- `404` — ticket not found.
- `403` — admin permission required.

---

# Data Models

## User

| Field | Type | Notes |
|---|---|---|
| name | String | Required |
| email | String | Required, unique, lowercase |
| password | String | Required, hidden from normal queries |
| role | String | `passenger` or `admin`; default `passenger` |

## Route

| Field | Type | Notes |
|---|---|---|
| origin | String | Required |
| destination | String | Required |
| fare | Number | Required, greater than 0 |
| distanceKm | Number | Optional |
| originCoordinates | Object | Optional latitude/longitude |
| destinationCoordinates | Object | Optional latitude/longitude |
| status | String | `active` or `inactive` |

## Trip

| Field | Type | Notes |
|---|---|---|
| route | ObjectId | Required Route reference |
| departureTime | Date | Required |
| arrivalTime | Date | Required and later than departure |
| availableSeats | Number | Required, minimum 0 |
| status | String | `scheduled`, `completed`, or `cancelled` |

## Ticket

| Field | Type | Notes |
|---|---|---|
| user | ObjectId | Required User reference |
| trip | ObjectId | Required Trip reference |
| ticketReference | String | Required and unique |
| amount | Number | Taken from stored route fare during booking |
| status | String | `active`, `used`, or `cancelled` |
| purchaseDate | Date | Defaults to current time |

---

# HTTP Status Codes

| Code | Meaning |
|---|---|
| 200 | Request successful |
| 201 | Resource created successfully |
| 400 | Invalid request or validation failure |
| 401 | Authentication required or token invalid/expired |
| 403 | Authenticated but not permitted |
| 404 | Resource/endpoint not found |
| 409 | Resource conflict, such as duplicate registration |
| 500 | Unexpected server error |

---

# Production URLs

**Frontend**

```text
https://public-transport-ticketing-system-1.onrender.com
```

**Backend API**

```text
https://public-transport-ticketing-system-5biy.onrender.com
```

---

## Notes

- Do not expose `JWT_SECRET`, MongoDB credentials, Resend credentials, or routing API keys in frontend code or committed files.
- Production environment variables are configured on the deployment platform.
- The frontend should use the deployed backend URL through `VITE_API_BASE_URL`.
- The API documentation reflects the backend implementation on the repository's `main` branch at the time this document was generated.
