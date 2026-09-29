// import React from "react";
// import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
// import Navbar from "./components/layout/Navbar";
// import { ProtectedRoute, AdminRoute } from "./components/common/ProtectedRoute";
// import { AuthProvider } from "./context/AuthContext";
// import Landing from "./pages/public/Landing";
// import {
//   Login,
//   Register,
//   ForgotPassword,
//   ResetPassword,
// } from "./pages/public/AuthPages";
// import {
//   Dashboard,
//   Trips,
//   TripDetails,
//   Tickets,
// } from "./pages/passenger/PassengerPages";
// import {
//   AdminDashboard,
//   AdminRoutes,
//   AdminTrips,
//   AdminTickets,
// } from "./pages/admin/AdminPages";
// import "./styles.css";

// export default function App() {
//   return (
//     <AuthProvider>
//       <BrowserRouter>
//         <Navbar />
//         <Routes>
//           <Route path="/" element={<Landing />} />
//           <Route path="/login" element={<Login />} />
//           <Route path="/register" element={<Register />} />
//           <Route path="/forgot-password" element={<ForgotPassword />} />
//           <Route path="/reset-password/:token" element={<ResetPassword />} />
//           <Route element={<ProtectedRoute />}>
//             <Route path="/dashboard" element={<Dashboard />} />
//             <Route path="/trips" element={<Trips />} />
//             <Route path="/trips/:id" element={<TripDetails />} />
//             <Route path="/tickets" element={<Tickets />} />
//             <Route element={<AdminRoute />}>
//               <Route path="/admin" element={<AdminDashboard />} />
//               <Route path="/admin/routes" element={<AdminRoutes />} />
//               <Route path="/admin/trips" element={<AdminTrips />} />
//               <Route path="/admin/tickets" element={<AdminTickets />} />
//             </Route>
//           </Route>
//           <Route path="*" element={<Navigate to="/" replace />} />
//         </Routes>
//       </BrowserRouter>
//     </AuthProvider>
//   );
// }
import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Navbar from "./components/layout/Navbar";
import Footer from "./components/layout/Footer"; // <--- 1. IMPORT FOOTER HERE
import { ProtectedRoute, AdminRoute } from "./components/common/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import Landing from "./pages/public/Landing";
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
    <AuthProvider>
      <BrowserRouter>
        {/* 2. WRAP EVERYTHING IN A FLEX CONTAINER TO PUSH FOOTER DOWN */}
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
          
          <Navbar />
          
          {/* flex-grow makes the routes take up all available space, pushing footer down */}
          <main style={{ flexGrow: 1 }}> 
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password/:token" element={<ResetPassword />} />
              
              <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/trips" element={<Trips />} />
                <Route path="/trips/:id" element={<TripDetails />} />
                <Route path="/tickets" element={<Tickets />} />
                
                <Route element={<AdminRoute />}>
                  <Route path="/admin" element={<AdminDashboard />} />
                  <Route path="/admin/routes" element={<AdminRoutes />} />
                  <Route path="/admin/trips" element={<AdminTrips />} />
                  <Route path="/admin/tickets" element={<AdminTickets />} />
                </Route>
              </Route>
              
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>

          <Footer /> {/* <--- 3. RENDER FOOTER HERE */}
          
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
