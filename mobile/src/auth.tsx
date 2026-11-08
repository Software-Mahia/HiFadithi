import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Platform } from "react-native";

import * as SecureStore from "expo-secure-store";

import { ApiError, login as loginRequest, me, setAuthToken } from "./api";
import type { User } from "./api";

const TOKEN_KEY = "hifadithi.access_token";

async function readToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    return (globalThis as unknown as { localStorage?: Storage }).localStorage?.getItem(TOKEN_KEY) ?? null;
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

async function writeToken(token: string | null) {
  if (Platform.OS === "web") {
    const storage = (globalThis as unknown as { localStorage?: Storage }).localStorage;
    if (token) storage?.setItem(TOKEN_KEY, token);
    else storage?.removeItem(TOKEN_KEY);
    return;
  }
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

type AuthState = {
  user: User | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async (token: string) => {
    setAuthToken(token);
    try {
      setUser(await me(token));
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setAuthToken(null);
        await writeToken(null);
        setUser(null);
        return;
      }
      throw error;
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const token = await readToken();
        if (token && active) await loadUser(token);
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [loadUser]);

  const signIn = useCallback(
    async (username: string, password: string) => {
      const tokens = await loginRequest(username, password);
      await writeToken(tokens.access);
      await loadUser(tokens.access);
    },
    [loadUser],
  );

  const signOut = useCallback(async () => {
    await writeToken(null);
    setAuthToken(null);
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    const token = await readToken();
    if (token) await loadUser(token);
  }, [loadUser]);

  const value = useMemo(
    () => ({ user, loading, signIn, signOut, refresh }),
    [user, loading, signIn, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
