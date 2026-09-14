import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { User } from "../types/models";
import { api } from "../services/api";
import { getOrCreateDeviceId } from "../services/deviceId";

const TOKEN_KEY = "9tel-auth-token";
const USER_KEY = "9tel-user";

interface AuthContextValue {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  signIn: (token: string, user: User) => Promise<void>;
  updateUser: (user: User) => Promise<void>;
  signOut: () => Promise<void>;
  /**
   * Silently establishes a Free-tier guest session tied to this device —
   * no phone, email, or name required. Called once on cold start when
   * there's no stored session yet, so Free-tier calling works with zero
   * registration friction. Registration only happens later, when the
   * user links a phone at Premium upgrade time (see the Premium screen
   * and login.tsx's `intent=upgrade` handling).
   */
  bootstrapGuestSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [storedToken, storedUser] = await Promise.all([
        AsyncStorage.getItem(TOKEN_KEY),
        AsyncStorage.getItem(USER_KEY),
      ]);
      if (storedToken) setToken(storedToken);
      if (storedUser) setUser(JSON.parse(storedUser));
      setIsLoading(false);
    })();
  }, []);

  const signIn = async (newToken: string, newUser: User) => {
    await AsyncStorage.setItem(TOKEN_KEY, newToken);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  // For updates that don't involve a new token — e.g. completing
  // registration via PATCH /api/auth/profile after linking a phone.
  const updateUser = async (updatedUser: User) => {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
    setUser(updatedUser);
  };

  const signOut = async () => {
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
    setToken(null);
    setUser(null);
  };

  const bootstrapGuestSession = async () => {
    const deviceId = await getOrCreateDeviceId();
    const { token: newToken, user: newUser } = await api.auth.device(deviceId);
    await signIn(newToken, newUser);
  };

  return (
    <AuthContext.Provider value={{ token, user, isLoading, signIn, updateUser, signOut, bootstrapGuestSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
