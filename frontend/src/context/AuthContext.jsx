import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';
import { clearAllQrs } from '../utils/offlineQr';
import { getToken, setToken, clearToken, currentPortal } from '../portal';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (token) {
      api.get('/auth/me')
        .then((res) => setUser(res.data))
        .catch(() => clearToken())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // role: on the staff portal, whether the person chose Admin or Warden.
  const login = async (email, password, remember = false, role = undefined) => {
    // The server only accepts roles that belong to this portal.
    const res = await api.post('/auth/login', { email, password, remember, role, portal: currentPortal() || undefined });
    setToken(res.data.token, undefined, remember);
    setUser(res.data);
    return res.data;
  };

  const register = async (formData) => {
    const res = await api.post('/auth/register', formData);
    setToken(res.data.token, 'student', true);
    setUser(res.data);
    return res.data;
  };

  const logout = () => {
    clearToken();
    clearAllQrs();
    setUser(null);
  };

  // Merges fresh fields (e.g. after a profile update) into the current user
  // so the UI (sidebar name/photo, etc.) reflects changes immediately.
  const updateUser = (fields) => {
    setUser((prev) => (prev ? { ...prev, ...fields } : prev));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
