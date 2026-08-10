import React, { createContext, useState, useEffect, ReactNode } from 'react';

type User = {
  id: number;
  username: string;
};

type AuthContextType = {
  token: string | null;
  user: User | null;
  lang: 'en' | 'bn';
  login: (token: string, user: User) => void;
  logout: () => void;
  toggleLang: () => void;
  isAuthenticated: boolean;
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [lang, setLang] = useState<'en' | 'bn'>('en');

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    const storedLang = localStorage.getItem('lang') as 'en' | 'bn';

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    if (storedLang) {
      setLang(storedLang);
    }
  }, []);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const toggleLang = () => {
    const newLang = lang === 'en' ? 'bn' : 'en';
    setLang(newLang);
    localStorage.setItem('lang', newLang);
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
