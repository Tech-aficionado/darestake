"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
} from "firebase/auth";
import { auth, googleProvider, setGoogleAccessToken } from "@/lib/firebase";

interface AuthState {
  user: User | null;
  loading: boolean;
  signInLoading: boolean;
  error: string | null;
}

interface AuthContextType extends AuthState {
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signInLoading: false,
  error: null,
  signIn: async () => {},
  signOut: async () => {},
  clearError: () => {},
});

/**
 * Detect PWA standalone mode.
 */
function isPWAStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    signInLoading: false,
    error: null,
  });
  const signInTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (signInTimeoutRef.current) {
        clearTimeout(signInTimeoutRef.current);
        signInTimeoutRef.current = null;
      }
      setState((prev) => ({
        ...prev,
        user,
        loading: false,
        signInLoading: false,
      }));
    });
    return () => {
      unsubscribe();
      if (signInTimeoutRef.current) clearTimeout(signInTimeoutRef.current);
    };
  }, []);

  const signIn = useCallback(async () => {
    // In PWA standalone mode: navigate to dedicated /login page
    // That page handles redirect flow in the same window
    if (isPWAStandalone()) {
      window.location.href = "/login";
      return;
    }

    // Regular browser: use popup
    setState((prev) => ({ ...prev, signInLoading: true, error: null }));

    signInTimeoutRef.current = setTimeout(() => {
      setState((prev) => {
        if (prev.signInLoading && !prev.user) {
          return { ...prev, signInLoading: false, error: null };
        }
        return prev;
      });
    }, 30000);

    try {
      const result = await signInWithPopup(auth, googleProvider);

      if (signInTimeoutRef.current) {
        clearTimeout(signInTimeoutRef.current);
        signInTimeoutRef.current = null;
      }

      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setGoogleAccessToken(credential.accessToken);
      }
    } catch (error: unknown) {
      if (signInTimeoutRef.current) {
        clearTimeout(signInTimeoutRef.current);
        signInTimeoutRef.current = null;
      }

      const firebaseError = error as { code?: string; message?: string };
      console.error("Sign in error:", firebaseError.code, firebaseError.message);

      if (firebaseError.code === "auth/popup-closed-by-user" ||
          firebaseError.code === "auth/cancelled-popup-request") {
        setState((prev) => ({ ...prev, signInLoading: false, error: null }));
        return;
      }

      // If popup blocked, go to login page as fallback
      if (firebaseError.code === "auth/popup-blocked") {
        window.location.href = "/login";
        return;
      }

      setState((prev) => ({
        ...prev,
        error: `Sign-in failed: ${firebaseError.code || firebaseError.message || "unknown"}`,
        signInLoading: false,
      }));
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      setGoogleAccessToken(null);
      await firebaseSignOut(auth);
      setState((prev) => ({ ...prev, user: null, error: null }));
    } catch (error) {
      console.error("Sign out error:", error);
      setState((prev) => ({
        ...prev,
        error: "Failed to sign out. Try again.",
      }));
    }
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user: state.user,
        loading: state.loading,
        signInLoading: state.signInLoading,
        error: state.error,
        signIn,
        signOut,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
