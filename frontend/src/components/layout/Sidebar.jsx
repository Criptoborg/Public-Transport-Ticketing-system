import React from 'react';
import { NavLink } from 'react-router-dom';

export default function Sidebar() {
  // Helper function to build the link class with active state
  const linkClass = ({ isActive }) => 
    `sidebar-link ${isActive ? 'active' : ''}`;

  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        <p className="sidebar-heading">ADMINISTRATION</p>
        
        <NavLink to="/admin" end className={linkClass}>
          Dashboard
        </NavLink>
        
        <NavLink to="/admin/routes" className={linkClass}>
          Routes
        </NavLink>
        
        <NavLink to="/admin/trips" className={linkClass}>
          Trips & Schedules
        </NavLink>
        
        <NavLink to="/admin/tickets" className={linkClass}>
          Issued Tickets
        </NavLink>
        
        {/* You can easily add more links here later without breaking the layout */}
        {/* <NavLink to="/admin/users" className={linkClass}>Users</NavLink> */}
      </nav>
    </aside>
  );
}