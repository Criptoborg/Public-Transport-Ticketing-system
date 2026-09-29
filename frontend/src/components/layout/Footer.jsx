import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-content page-shell">
        <div className="footer-grid">
          <div className="footer-brand">
            <div className="brand">
              <span className="brand-mark">R</span>
              <span>Routely</span>
            </div>
            <p className="footer-tagline">
              Public transport, made simple. Every journey starts with a better plan.
            </p>
          </div>
          
          <div className="footer-links">
            <h4>Quick Links</h4>
            <nav>
              <Link to="/">Home</Link>
              <Link to="/trips">Find a Trip</Link>
              <Link to="/tickets">My Tickets</Link>
              <Link to="/login">Log in</Link>
            </nav>
          </div>
          
          <div className="footer-contact">
            <h4>Contact</h4>
            <p>support@routely.com</p>
            <p>+234 123 456 7890</p>
          </div>
        </div>
        
        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} Routely. All rights reserved.</p>
          <div className="footer-legal">
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/terms">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}