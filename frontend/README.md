# Routely Frontend

React/Vite frontend for the Public Transport Ticketing System. It integrates with the existing Express backend without changing backend behavior.

## Setup

```powershell
cd frontend
npm install
copy .env.example .env
npm run dev
```

The Vite app defaults to the URL shown in the terminal. Set `VITE_API_BASE_URL` to the backend URL when needed:

```env
VITE_API_BASE_URL=http://localhost:5000
```

Only the API base URL belongs in frontend environment variables. Backend secrets remain server-side.

## Commands

- `npm run dev` starts Vite development mode.
- `npm run build` creates a production build.
- `npm run preview` previews the production build.

## Structure

- `src/services/api.js`: Axios instance, JWT injection, and API error handling.
- `src/context/AuthContext.jsx`: persisted authentication state and logout.
- `src/components/`: navigation, notices, status badges, and route guards.
- `src/pages/AuthPages.jsx`: registration, login, forgot-password, and reset-password.
- `src/pages/PassengerPages.jsx`: dashboard, trip search, booking, and ticket history.
- `src/pages/AdminPages.jsx`: route, trip, and ticket management.

## Backend integration

The frontend uses the existing response envelope `{ success, message, data }`. Authenticated requests send `Authorization: Bearer <JWT>`. Passenger and admin screens are protected using the role returned from login.

Booking uses the backend's active endpoint `POST /api/tickets/createticket` with `{ "trip": "TRIP_ID" }`. The backend is the source of truth for route distance and fare; the frontend displays returned `distanceKm`, `fare`, and ticket `amount` values without recalculating them.

Admin route creation sends `originCoordinates` and `destinationCoordinates` with numeric latitude and longitude fields. The backend calls its routing provider and returns the calculated distance and fare.

## Main flows

- Public landing page to registration or login.
- Passenger dashboard to scheduled trips, booking, and ticket history.
- Password recovery through `/forgot-password` and `/reset-password/:token`.
- Admin control room with route CRUD, trip creation, and ticket status management.
