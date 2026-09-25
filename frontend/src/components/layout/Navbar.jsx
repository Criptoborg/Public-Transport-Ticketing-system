import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const exit = () => { logout(); navigate('/'); };
  return (
    <header className="topbar">
      <Link className="brand" to={isAuthenticated ? '/dashboard' : '/'}><span className="brand-mark">R</span><span>Routely</span></Link>
      <nav className="nav-links">
        {!isAuthenticated ? <><NavLink to="/">Home</NavLink><NavLink to="/login">Log in</NavLink><Link className="nav-cta" to="/register">Create account</Link></> : user.role === 'admin' ? <><NavLink to="/admin">Control room</NavLink><NavLink to="/admin/routes">Routes</NavLink><NavLink to="/admin/trips">Trips</NavLink><NavLink to="/admin/tickets">Tickets</NavLink><button className="text-button" onClick={exit}>Sign out</button></> : <><NavLink to="/dashboard">Dashboard</NavLink><NavLink to="/trips">Find a trip</NavLink><NavLink to="/tickets">My tickets</NavLink><button className="text-button" onClick={exit}>Sign out</button></>}
      </nav>
    </header>
  );
}
