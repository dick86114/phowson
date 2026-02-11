import { useCallback, useEffect, useMemo, useState } from 'react';

export type AuthUser = {
  id: string;
  name: string;
  avatar: string;
  role: 'admin' | 'family';
  email: string;
};

const STORAGE_KEY = 'photologs:auth:user';
const TOKEN_KEY = 'photologs:auth:token';

const defaultUser = null;

const readUser = (): AuthUser | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultUser;
    const parsed = JSON.parse(raw) as AuthUser;
    if (!parsed?.id) return defaultUser;
    const role = String((parsed as any).role ?? '').toLowerCase();
    const normalizedRole: AuthUser['role'] | null = role === 'admin' ? 'admin' : role === 'family' ? 'family' : null;
    if (!normalizedRole) return defaultUser;
    const avatar = String((parsed as any).avatar ?? '').trim() || `/media/avatars/${parsed.id}`;
    const normalized = { ...parsed, role: normalizedRole, avatar };
    if ((parsed as any).role !== normalizedRole) localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  } catch {
    return defaultUser;
  }
};

const writeUser = (user: AuthUser | null) => {
  if (!user) localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
};

const writeToken = (token: string | null) => {
  if (!token) localStorage.removeItem(TOKEN_KEY);
  else localStorage.setItem(TOKEN_KEY, token);
};

export const useAuth = () => {
  const [user, setUser] = useState<AuthUser | null>(() => readUser());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setUser(readUser());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const loginAsAdmin = useCallback(() => {
    const admin: AuthUser = {
      id: 'admin',
      name: '管理员',
      avatar: 'https://coreva-normal.trae.ai/api/ide/v1/text_to_image?prompt=portrait%20photo%2C%20minimalist%20admin%20avatar%2C%20soft%20light%2C%20neutral%20background%2C%20modern%20design%2C%20high%20detail&image_size=square',
      role: 'admin',
      email: 'admin@phowson.com',
    };
    writeUser(admin);
    setUser(admin);
  }, []);

  const logout = useCallback(() => {
    writeUser(null);
    writeToken(null);
    setUser(null);
    if (typeof window !== 'undefined') window.location.hash = '#/login';
  }, []);

  const setSession = useCallback((nextUser: AuthUser, token: string) => {
    const avatar = String((nextUser as any)?.avatar ?? '').trim() || `/media/avatars/${nextUser.id}`;
    writeUser({ ...nextUser, avatar });
    writeToken(token);
    setUser({ ...nextUser, avatar });
  }, []);

  const updateUser = useCallback((nextUser: AuthUser) => {
    const avatar = String((nextUser as any)?.avatar ?? '').trim() || `/media/avatars/${nextUser.id}`;
    writeUser({ ...nextUser, avatar });
    setUser({ ...nextUser, avatar });
  }, []);

  return useMemo(
    () => ({
      user,
      loginAsAdmin,
      setSession,
      updateUser,
      logout,
    }),
    [user, loginAsAdmin, setSession, updateUser, logout],
  );
};
