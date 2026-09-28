# 🚌 Public Transport Ticketing System

A full-stack web application designed to simplify public transport trip discovery, ticket booking, and transport management.

The system allows passengers to register, find available trips, book tickets, and manage their bookings. Administrators can manage routes, trips, fares, and issued tickets.

This project was developed as a collaborative capstone project by **Group 72**.

---

## 🌐 Live Application

### Frontend
https://public-transport-ticketing-system-1.onrender.com

### Backend API
https://public-transport-ticketing-system-5biy.onrender.com

> The application is hosted on Render. Services may take a short time to become available after periods of inactivity.

---

## ✨ Features

### Passenger Features

- Create a passenger account
- Secure login and authentication
- Forgot and reset password
- Search and view available trips
- View route and fare information
- Book transport tickets
- Receive a unique ticket reference
- View booked ticket details
- View ticket history
- Cancel eligible tickets
- Responsive interface for desktop and mobile devices

### Admin Features

- Secure admin authentication
- Role-based access control
- Create and manage transport routes
- Create and manage trips
- Manage route and trip information
- View passenger bookings and issued tickets
- Manage relevant ticket and trip statuses

---

## 🎯 Project Objective

The objective of the Public Transport Ticketing System is to provide a functional MVP that demonstrates how passengers and transport administrators can interact through a centralized digital ticketing platform.

### Passenger Flow

Register → Login → Find Trip → Select Trip → Book Ticket → View Ticket → Ticket History

### Admin Flow

Login → Manage Routes → Manage Trips → View and Manage Bookings

---

## 🛠️ Technologies Used

### Frontend

- React.js
- Vite
- React Router
- JavaScript
- CSS
- REST API integration

### Backend

- Node.js
- Express.js
- MongoDB
- Mongoose
- JSON Web Token (JWT)
- bcryptjs

### External Services

- MongoDB Atlas — cloud database
- Render — frontend and backend deployment
- Resend — transactional email service
- OpenRouteService — route distance calculation

### Development Tools

- Git
- GitHub
- Visual Studio Code
- Postman
- GitHub Copilot

---

## 🏗️ Project Structure

```text
Public-Transport-Ticketing-system/
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── utils/
│   │   └── app.js
│   │
│   ├── .env.example
│   ├── package.json
│   └── README.md
│
├── frontend/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   │   ├── common/
│   │   │   └── layout/
│   │   ├── context/
│   │   ├── pages/
│   │   │   ├── public/
│   │   │   ├── passenger/
│   │   │   └── admin/
│   │   ├── services/
│   │   ├── utils/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── styles.css
│   │
│   ├── .env.example
│   ├── package.json
│   └── vite.config.js
│
└── .gitignore
```

---

## ⚙️ Installation and Local Setup

### 1. Clone the Repository

```bash
git clone https://github.com/Criptoborg/Public-Transport-Ticketing-system.git
```

Move into the project directory:

```bash
cd Public-Transport-Ticketing-system
```

---

## 🔧 Backend Setup

Move into the backend directory:

```bash
cd backend
```

Install dependencies:

```bash
npm install
```

Create a `.env` file inside the `backend` directory.

Use `.env.example` as a reference.

Example:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=your_sender_email
FRONTEND_URL=http://localhost:5173
OPENROUTESERVICE_API_KEY=your_openrouteservice_api_key
BASE_FARE=300
FARE_PER_KM=70
```

Start the backend development server:

```bash
npm run dev
```

The backend runs locally on:

```text
http://localhost:5000
```

---

## 💻 Frontend Setup

Open another terminal and move into the frontend directory:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Create a `.env` file using `.env.example` as a reference.

For local development:

```env
VITE_API_BASE_URL=http://localhost:5000
```

Start the frontend:

```bash
npm run dev
```

The frontend will normally be available at:

```text
http://localhost:5173
```

---

## 🔐 Authentication & Authorization

The application uses **JWT-based authentication**.

Passwords are hashed before being stored in the database.

Protected backend endpoints require a valid JWT, while role-based authorization separates passenger functionality from administrative functionality.

Public registration creates passenger accounts. Administrative functionality is restricted to authorized admin users.

---

## 🗺️ Fare Calculation

The system integrates with **OpenRouteService** to determine road distance between supported route coordinates.

The backend uses the calculated distance to determine the fare.

The basic fare calculation follows:

```text
Fare = Base Fare + (Distance in KM × Fare Per KM)
```

Fare calculation is handled by the backend rather than the frontend.

---

## 🎟️ Ticketing

When a passenger selects an available trip and books a ticket, the backend creates a ticket associated with the passenger and selected trip.

Ticket information includes a unique ticket reference and relevant booking information.

Passengers can access their ticket history and manage eligible bookings through their account.

---

## 📧 Email Functionality

The backend integrates with **Resend** for transactional emails.

Email functionality includes:

- Welcome email after registration
- Password reset email
- Password reset link/token workflow

---

## 🔒 Security

Security measures implemented in the project include:

- Password hashing with bcrypt
- JWT authentication
- Role-based authorization
- Protected API endpoints
- Backend input validation
- Environment variables for sensitive configuration
- Passwords excluded from normal API responses
- `.env` files excluded from Git
- Centralized backend error handling
- Restricted administrative operations

> Never commit API keys, database credentials, JWT secrets, or `.env` files to the repository.

---

## ☁️ Deployment

The application is deployed using Render and MongoDB Atlas.

### Frontend

The React/Vite frontend is deployed as a **Render Static Site**.

**Live Application:**

https://public-transport-ticketing-system-1.onrender.com

### Backend

The Node.js/Express backend is deployed as a **Render Web Service**.

**Production API:**

https://public-transport-ticketing-system-5biy.onrender.com

### Database

The production MongoDB database is hosted on **MongoDB Atlas**.

### Production Architecture

```text
Passenger / Admin
       │
       ▼
React + Vite Frontend
       │
       ▼
Node.js + Express API
       │
       ▼
MongoDB Atlas
```

---

## 🧪 Testing

The application has been tested across the main passenger and administrative flows.

Testing includes:

- User registration
- Login and authentication
- Forgot/reset password
- Protected routes
- Route management
- Trip management
- Trip discovery
- Ticket booking
- Ticket history
- Ticket cancellation
- Admin authorization
- Frontend/backend integration
- Production deployment integration
- Responsive frontend testing

Backend API endpoints can also be tested using Postman.

---

## 🔄 Development Workflow

The project uses Git and GitHub for version control and team collaboration.

Development follows a feature-branch workflow:

```text
Feature Branch
      │
      ▼
Pull Request
      │
      ▼
Code Review
      │
      ▼
Main Branch
```

Contributors work on separate feature branches and submit Pull Requests for review before their changes are merged into the protected `main` branch.

---

## 👥 Team Collaboration

This project was developed collaboratively by **Group 72**.

Team members contributed to different areas of the system, including:

- Authentication and user management
- Routes and trip management
- Ticketing functionality
- Backend integration
- Frontend authentication
- Passenger interface
- Admin interface
- Layout and responsive design
- Testing and debugging
- Deployment and integration

GitHub branches, commits, and Pull Requests provide a record of individual contributions.

---

## 🚀 Future Improvements

Possible future improvements include:

- Online payment integration
- QR-code based tickets
- Real-time vehicle tracking
- Seat selection
- Push notifications
- More advanced administrator analytics
- Improved route discovery
- Production-grade monitoring and logging

These features are outside the scope of the current MVP.

---

## 📌 Project Status

**MVP completed, deployed, and tested.**

The core passenger and administrator workflows have been implemented, integrated, deployed, and tested successfully.

### Live Links

**Frontend:**  
https://public-transport-ticketing-system-1.onrender.com

**Backend:**  
https://public-transport-ticketing-system-5biy.onrender.com

---

## 📄 License

This project was developed for educational and capstone purposes Group 72
