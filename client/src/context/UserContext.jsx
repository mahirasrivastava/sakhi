import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api.js";

/**
 * Optional patient accounts.
 *
 * Signed out is the normal, fully-supported state. Nothing in the app gates on
 * `user` being present — this context exists so a returning user can carry a
 * language preference between devices, not so the app can decide who is allowed
 * to use it.
 *
 * Kept entirely separate from AuthContext, which is the ASHA worker session.
 * The two use different cookies and different endpoints; a patient can never
 * become a worker by any path through this file.
 */
const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  // Distinct from "signed out" — during the first check we do not yet know, and
  // rendering a "Sign in" prompt to someone already signed in looks broken.
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.user.me()
      .then((res) => { if (!cancelled) setUser(res.user); })
      // 401 here is the overwhelmingly common case: nobody is signed in. It is
      // not an error and must never surface as one.
      .catch(() => { if (!cancelled) setUser(null); })
      .finally(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (handle, password) => {
    const res = await api.user.login({ handle, password });
    setUser(res.user);
    return res.user;
  }, []);

  const register = useCallback(
    (handle, password, language) => api.user.register({ handle, password, language }),
    []
  );

  const logout = useCallback(async () => {
    // Clear locally even if the network call fails — a sign-out that appears to
    // do nothing is worse than one that races the server, especially on a
    // borrowed phone where the user is trying to leave no trace.
    try { await api.user.logout(); } finally { setUser(null); }
  }, []);

  const savePreferences = useCallback(async (prefs) => {
    if (!user) return null;
    const res = await api.user.setPreferences(prefs);
    setUser(res.user);
    return res.user;
  }, [user]);

  const value = useMemo(
    () => ({ user, checking, isSignedIn: Boolean(user), login, register, logout, savePreferences }),
    [user, checking, login, register, logout, savePreferences]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used inside UserProvider");
  return ctx;
}
