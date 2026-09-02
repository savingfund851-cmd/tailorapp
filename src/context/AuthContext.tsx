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
  authLoading: boolean;
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

  // If no token in sessionStorage, we need to wait for cross-tab sync
  const [authLoading, setAuthLoading] = useState<boolean>(() => !sessionStorage.getItem('token'));

  // Cross-tab session sync
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      // Another tab is asking for our session
      if (e.key === 'requestSession') {
        const t = sessionStorage.getItem('token');
        const u = sessionStorage.getItem('user');
        if (t && u) {
          localStorage.setItem('shareSession', JSON.stringify({ token: t, user: u }));
          setTimeout(() => localStorage.removeItem('shareSession'), 1000);
        }
      }

      // We received session data from another tab
      if (e.key === 'shareSession' && e.newValue) {
        if (!sessionStorage.getItem('token')) {
          try {
            const data = JSON.parse(e.newValue);
            sessionStorage.setItem('token', data.token);
            sessionStorage.setItem('user', data.user);
            setToken(data.token);
            setUser(JSON.parse(data.user));
            setAuthLoading(false);
          } catch (err) {
            // ignore
          }
        }
      }

      // Another tab logged out
      if (e.key === 'logoutSync') {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        setToken(null);
        setUser(null);
      }
    };

    window.addEventListener('storage', handleStorage);

    // If this tab has no session, ask other tabs for it
    if (!sessionStorage.getItem('token')) {
      // Small delay to ensure event listeners in other tabs are ready
      setTimeout(() => {
        localStorage.setItem('requestSession', Date.now().toString());
        // Don't remove immediately — let other tabs see it
        setTimeout(() => localStorage.removeItem('requestSession'), 200);
      }, 100);

      // Give up waiting after 800ms — show login page if no response
      setTimeout(() => {
        setAuthLoading(false);
      }, 800);
    } else {
      setAuthLoading(false);
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
    setTimeout(() => localStorage.removeItem('logoutSync'), 500);
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
        authLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
