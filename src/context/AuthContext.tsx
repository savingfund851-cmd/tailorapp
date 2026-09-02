import React, { createContext, useState, useEffect, ReactNode } from 'react';

type User = {
  id: number;
  username: string;
  role: string;
  userType: string;
  permissions?: Record<string, boolean>;
};

type AuthContextType = {
  token: string | null;
  user: User | null;
  lang: 'en' | 'bn';
  login: (token: string, user: User) => void;
  logout: () => void;
  toggleLang: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  hasPermission: (perm: string) => boolean;
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem('token'));
  const [user, setUser] = useState<User | null>(() => {
    const storedUser = sessionStorage.getItem('user');
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const [lang, setLang] = useState<'en' | 'bn'>(() => {
    return (localStorage.getItem('lang') as 'en' | 'bn') || 'en';
  });

  // Cross-tab session sync:
  // When a new tab opens without a session, it asks other tabs for the token.
  // Other tabs respond by temporarily writing their session to localStorage.
  useEffect(() => {
    // Listen for requests from other tabs
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'requestSession') {
        // Another tab is asking for our session — share it if we have one
        const t = sessionStorage.getItem('token');
        const u = sessionStorage.getItem('user');
        if (t && u) {
          localStorage.setItem('shareSession', JSON.stringify({ token: t, user: u }));
          // Clean up immediately so it doesn't persist
          setTimeout(() => localStorage.removeItem('shareSession'), 500);
        }
      }

      if (e.key === 'shareSession' && e.newValue) {
        // We received session data from another tab
        if (!sessionStorage.getItem('token')) {
          try {
            const data = JSON.parse(e.newValue);
            sessionStorage.setItem('token', data.token);
            sessionStorage.setItem('user', data.user);
            setToken(data.token);
            setUser(JSON.parse(data.user));
          } catch (err) {
            // ignore parse errors
          }
        }
      }

      if (e.key === 'logoutSync') {
        // Another tab logged out — sync logout across all tabs
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        setToken(null);
        setUser(null);
      }
    };

    window.addEventListener('storage', handleStorage);

    // If this tab has no session, ask other tabs
    if (!sessionStorage.getItem('token')) {
      localStorage.setItem('requestSession', Date.now().toString());
      localStorage.removeItem('requestSession');
    }

    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    sessionStorage.setItem('token', newToken);
    sessionStorage.setItem('user', JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    // Notify other tabs to logout too
    localStorage.setItem('logoutSync', Date.now().toString());
    localStorage.removeItem('logoutSync');
  };

  const toggleLang = () => {
    const newLang = lang === 'en' ? 'bn' : 'en';
    setLang(newLang);
    localStorage.setItem('lang', newLang);
  };

  const isAdmin = user?.role === 'master';

  const hasPermission = (perm: string) => {
    if (isAdmin) return true;
    if (!user || !user.permissions) return false;
    return !!user.permissions[perm];
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        lang,
        login,
        logout,
        toggleLang,
        isAuthenticated: !!token,
        isAdmin,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
