import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Route, Routes, Link, useLocation } from "react-router-dom";
import Navbar from "./components/layout/Navbar";
import Footer from "./components/layout/Footer";
import { ProtectedRoute, AdminRoute, BoardingStaffRoute } from "./components/common/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import ErrorBoundary from "./components/common/ErrorBoundary";
import Notice from "./components/common/Notice";
import { LoadingState } from "./components/common/PageStates";
import Landing from "./pages/public/Landing";
import PaymentCallback from "./pages/public/PaymentCallback";
import TicketDetail from "./pages/passenger/TicketDetail";
import Profile from "./pages/passenger/Profile";
const ValidateTickets = lazy(() => import("./pages/admin/ValidateTickets"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
import {
  Login,
  Register,
  ForgotPassword,
  ResetPassword,
} from "./pages/public/AuthPages";
import {
  Dashboard,
  Trips,
  TripDetails,
  Tickets,
} from "./pages/passenger/PassengerPages";
import {
  AdminDashboard,
  AdminRoutes,
  AdminTrips,
  AdminTickets,
} from "./pages/admin/AdminPages";
import "./styles.css";

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <ErrorBoundary>
          <div className="app-shell">
          <Navbar />
          <div className="app-main">
            <PageTitleSync />
            <ApiWarmupNotice />
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password/:token" element={<ResetPassword />} />
              
              <Route element={<ProtectedRoute />}>
                <Route path="/payment/callback" element={<PaymentCallback />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/trips" element={<Trips />} />
                <Route path="/trips/:id" element={<TripDetails />} />
                <Route path="/tickets" element={<Tickets />} />
                <Route path="/tickets/:id" element={<TicketDetail />} />
                <Route element={<BoardingStaffRoute />}>
                  <Route path="/admin/validate-tickets" element={<Suspense fallback={<div className="page-shell"><LoadingState label="Loading scanner..." /></div>}><ValidateTickets /></Suspense>} />
                </Route>
                
                <Route element={<AdminRoute />}>
                  <Route path="/admin" element={<AdminDashboard />} />
                  <Route path="/admin/routes" element={<AdminRoutes />} />
                  <Route path="/admin/trips" element={<AdminTrips />} />
                  <Route path="/admin/tickets" element={<AdminTickets />} />
                  <Route path="/admin/users" element={<Suspense fallback={<div className="page-shell"><LoadingState label="Loading users..." /></div>}><AdminUsers /></Suspense>} />
                  <Route path="/admin/users" element={<Suspense fallback={<div className="page-shell"><LoadingState label="Loading users..." /></div>}><AdminUsers /></Suspense>} />
                </Route>
              </Route>
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
          <Footer />
          </div>
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  );
}

function PageTitleSync() {
  const { pathname } = useLocation();
  useEffect(() => {
    const label = pathname === "/" ? "Find your next trip" : pathname
      .split("/")
      .filter(Boolean)
      .map((part) => part.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()))
      .join(" | ");
    document.title = `${label || "Find your next trip"} | Routely`;
  }, [pathname]);
  return null;
}

function ApiWarmupNotice() {
  const [isSlow, setIsSlow] = useState(false);
  useEffect(() => {
    const update = (event) => setIsSlow(event.detail);
    window.addEventListener("routely:api-slow", update);
    return () => window.removeEventListener("routely:api-slow", update);
  }, []);
  return isSlow ? <Notice type="info">The server is waking up. This can take a few seconds.</Notice> : null;
}

function NotFound() {
  return (
    <main className="page-shell error-page">
      <p className="eyebrow">404 / ROUTELY</p>
      <h1>That stop is not on this route.</h1>
      <p>The page may have moved or the address may be incorrect.</p>
      <Link className="button button-primary" to="/">Return home</Link>
    </main>
  );
}
