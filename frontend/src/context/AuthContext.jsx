import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchMe } from '../lib/api';

const AuthContext = createContext(null);

/**
 * Helper to decode JWT payload without a library
 */
const parseJwt = (token) => {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch (e) {
    return null;
  }
};

/**
 * AuthProvider: wraps the app and provides auth state + actions to all children.
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [isExpired, setIsExpired] = useState(false);

  // Function to check if token is expired
  const checkTokenExpiration = (currentToken) => {
    if (!currentToken) return false;
    const decoded = parseJwt(currentToken);
    if (!decoded || !decoded.exp) return false;
    
    // exp is in seconds, Date.now() is in milliseconds
    const expirationTime = decoded.exp * 1000;
    if (Date.now() >= expirationTime) {
      return true;
    }
    return false;
  };

  // On mount, restore user from localStorage if token exists
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (token && storedUser) {
      if (checkTokenExpiration(token)) {
        setIsExpired(true);
        logout();
      } else {
        try {
          setUser(JSON.parse(storedUser));
        } catch {
          logout();
        }
      }
    }
    setLoading(false);

    // Optional: Periodically check expiration
    const interval = setInterval(() => {
      if (token && checkTokenExpiration(token)) {
        setIsExpired(true);
        logout();
      }
    }, 60000); // check every minute

    return () => clearInterval(interval);
  }, [token]);

  /** Call after a successful register/login API response */
  const login = (userData, jwtToken) => {
    setIsExpired(false);
    setUser(userData);
    setToken(jwtToken);
    localStorage.setItem('token', jwtToken);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  /** Clear auth state */
  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  /** Refresh user data from API */
  const refreshUser = async () => {
    try {
      const userData = await fetchMe();
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
    } catch (err) {
      console.error('Failed to refresh user:', err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, refreshUser, loading, isExpired, setIsExpired }}>
      {children}
    </AuthContext.Provider>
  );
};

/** Convenience hook */
export const useAuth = () => useContext(AuthContext);
