import { AppState } from 'react-native';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import { api, APIError, type StaffSession, type StaffUser } from './api';

const KEY = 'hifadithi.staff-session';
type Invitation = { invitation_code: string; expires_at: string };
type AuthState = {
  user: StaffUser | null;
  loading: boolean;
  error: string | null;
  restore: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  acceptInvitation: (code: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  invite: (
    email: string,
    fullName: string,
    role: StaffUser['role'],
  ) => Promise<Invitation>;
};
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const token = useRef<string | null>(null);
  const generation = useRef(0);

  const clear = useCallback(async () => {
    generation.current += 1;
    token.current = null;
    setUser(null);
    setLoading(false);
    try {
      await SecureStore.deleteItemAsync(KEY);
    } catch {
      setError('Unable to clear the stored session. Please try again.');
      throw new Error('Unable to clear the stored session. Please try again.');
    }
  }, []);

  const restore = useCallback(() => {
    const current = ++generation.current;
    return SecureStore.getItemAsync(KEY)
      .then(async (stored) => {
        if (current !== generation.current) return;
        setLoading(true);
        setError(null);
        setUser(null);
        token.current = stored;
        if (!stored) return;
        const result = await api<{ user: StaffUser }>('/api/auth/me/', {
          token: stored,
        });
        if (current === generation.current) setUser(result.user);
      })
      .catch(async (failure: unknown) => {
        if (current !== generation.current) return;
        if (failure instanceof APIError && failure.status === 401) {
          await clear().catch(() => undefined);
        } else {
          setError(
            failure instanceof Error
              ? failure.message
              : 'Unable to restore your session.',
          );
        }
      })
      .finally(() => {
        if (current === generation.current) setLoading(false);
      });
  }, [clear]);

  useEffect(() => {
    void restore();
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setLoading(true);
        setUser(null);
        setError(null);
        void restore();
      }
    });
    return () => {
      generation.current += 1;
      listener.remove();
    };
  }, [restore]);

  async function saveSession(session: StaffSession) {
    try {
      await SecureStore.setItemAsync(KEY, session.token);
    } catch {
      await api('/api/auth/sign-out/', {
        token: session.token,
        body: {},
      }).catch(() => undefined);
      throw new Error(
        'Unable to save your session securely. Please try again.',
      );
    }
    generation.current += 1;
    token.current = session.token;
    setUser(session.user);
    setError(null);
    setLoading(false);
  }
  async function signIn(email: string, password: string) {
    await saveSession(
      await api<StaffSession>('/api/auth/sign-in/', {
        body: { email: email.trim(), password },
      }),
    );
  }
  async function acceptInvitation(code: string, password: string) {
    await saveSession(
      await api<StaffSession>('/api/auth/accept-invitation/', {
        body: { invitation_code: code.trim(), password },
      }),
    );
  }
  async function signOut() {
    // Retain the session for retry if server-side revocation fails.
    if (token.current) {
      try {
        await api('/api/auth/sign-out/', { token: token.current, body: {} });
      } catch (failure) {
        if (!(failure instanceof APIError && failure.status === 401))
          throw failure;
      }
    }
    await clear();
  }
  async function invite(
    email: string,
    fullName: string,
    role: StaffUser['role'],
  ) {
    if (!token.current) throw new Error('Sign in required.');
    try {
      return await api<Invitation>('/api/auth/invitations/', {
        token: token.current,
        body: { email: email.trim(), full_name: fullName.trim(), role },
      });
    } catch (failure) {
      if (failure instanceof APIError && failure.status === 401) await clear();
      if (failure instanceof APIError && failure.status === 403)
        await restore();
      throw failure;
    }
  }
  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        restore,
        signIn,
        acceptInvitation,
        signOut,
        invite,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('AuthProvider is missing.');
  return auth;
}
