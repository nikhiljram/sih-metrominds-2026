import { useState, useEffect } from 'react';
import api from '../api';

export function useAuth() {
  const [userSession, setUserSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.get('/auth/me')
        .then(res => {
          setUserSession(res.data);
        })
        .catch(() => {
          localStorage.removeItem('token');
          setUserSession(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = (sessionData: any) => {
    setUserSession(sessionData);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // Ignore
    }
    localStorage.removeItem('token');
    setUserSession(null);
    window.location.href = '/login';
  };

  return { userSession, loading, login, logout };
}
