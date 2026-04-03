
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { User, UserRole } from '../types';
import { mockLogin, authenticateUser } from '../services/mockBackend';

interface AuthContextType {
  user: User | null;
  login: (role: UserRole) => Promise<void>; // Kept for demo user convenience
  loginWithEmailPassword: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'eventhorizon_user';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Initialize user state from localStorage if available
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      // parsed may be { user, token } for backwards compatibility accept whole object
      return parsed && parsed.user ? parsed.user : parsed;
    } catch (error) {
      console.error("Failed to parse user session", error);
      return null;
    }
  });

  const login = async (role: UserRole) => {
    const resp = await mockLogin(role);
    // resp expected { user, token }
    const u = (resp && (resp as any).user) ? (resp as any).user : resp;
    const token = (resp && (resp as any).token) ? (resp as any).token : null;
    setUser(u);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: u, token }));
    if (token) localStorage.setItem('eventhorizon_token', token);
  };

  const loginWithEmailPassword = async (email: string, password: string) => {
    const resp = await authenticateUser(email, password);
    const u = (resp && (resp as any).user) ? (resp as any).user : resp;
    const token = (resp && (resp as any).token) ? (resp as any).token : null;
    setUser(u);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: u, token }));
    if (token) localStorage.setItem('eventhorizon_token', token);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('eventhorizon_token');
  };

  const value = {
    user,
    login,
    loginWithEmailPassword,
    logout,
    isAuthenticated: !!user,
    isAdmin: user?.role === UserRole.ADMIN,
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
