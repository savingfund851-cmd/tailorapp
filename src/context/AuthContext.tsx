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
