import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('dms_user');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('dms_token'));
  const [loading, setLoading] = useState(true);

  // Hydrate session on initial app load
  useEffect(() => {
    const hydrateSession = async () => {
      const storedToken = localStorage.getItem('dms_token');
      if (storedToken) {
        try {
          const res = await authApi.getMe();
          if (res.data?.success && res.data?.data) {
            setUser(res.data.data);
            localStorage.setItem('dms_user', JSON.stringify(res.data.data));
          }
        } catch (err) {
          console.warn('Session hydration failed:', err.message);
          localStorage.removeItem('dms_token');
          localStorage.removeItem('dms_user');
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    };

    hydrateSession();
  }, []);

  const login = async (credentials) => {
    const res = await authApi.login(credentials);
    const { user: userData, token: userToken } = res.data.data;
    localStorage.setItem('dms_token', userToken);
    localStorage.setItem('dms_user', JSON.stringify(userData));
    setToken(userToken);
    setUser(userData);
    return userData;
  };

  const register = async (formData) => {
    const res = await authApi.register(formData);
    const { user: userData, token: userToken } = res.data.data;
    localStorage.setItem('dms_token', userToken);
    localStorage.setItem('dms_user', JSON.stringify(userData));
    setToken(userToken);
    setUser(userData);
    return userData;
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (err) {
      console.warn('Logout API error:', err.message);
    } finally {
      localStorage.removeItem('dms_token');
      localStorage.removeItem('dms_user');
      setToken(null);
      setUser(null);
    }
  };

  const refreshUser = async () => {
    try {
      const res = await authApi.getMe();
      if (res.data?.data) {
        setUser(res.data.data);
        localStorage.setItem('dms_user', JSON.stringify(res.data.data));
      }
    } catch (err) {
      console.error('Failed to refresh user:', err);
    }
  };

  const value = {
    user,
    token,
    isAuthenticated: !!token && !!user,
    loading,
    login,
    register,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

