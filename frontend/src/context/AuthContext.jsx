import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const AuthContext = createContext(null);
const TOKEN_KEY = 'transport_token';
const USER_KEY = 'transport_user';

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
  });

  const login = (payload) => {
    localStorage.setItem(TOKEN_KEY, payload.token);
    localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
    setToken(payload.token);
    setUser(payload.user);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  };

  useEffect(() => {
    const handleUnauthorized = () => {
      const intendedPath = `${location.pathname}${location.search}${location.hash}`;
      logout();
      if (location.pathname !== '/login') {
        navigate('/login', { replace: true, state: { from: { pathname: intendedPath } } });
      }
    };
    window.addEventListener('routely:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('routely:unauthorized', handleUnauthorized);
  }, [location, navigate]);

  const value = useMemo(() => ({ token, user, login, logout, isAuthenticated: Boolean(token && user) }), [token, user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
