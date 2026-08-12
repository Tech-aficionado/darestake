"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
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
 * Detect if we're on a mobile/tablet device.
 * Mobile browsers almost always block popups, so we go straight to redirect.
 */
function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  ) || (window.innerWidth <= 768);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    signInLoading: false,
    error: null,
  });

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setState((prev) => ({
        ...prev,
        user,
        loading: false,
        signInLoading: false,
      }));
    });
    return () => unsubscribe();
  }, []);

  // Handle redirect result (for mobile browsers that block popups)
  useEffect(() => {
    // If we're returning from a redirect, show loading state
    const hasRedirectPending = sessionStorage.getItem("auth_redirect_pending");
    if (hasRedirectPending) {
      setState((prev) => ({ ...prev, signInLoading: true }));
    }

    getRedirectResult(auth)
      .then((result) => {
        sessionStorage.removeItem("auth_redirect_pending");
        if (result) {
          const credential = GoogleAuthProvider.credentialFromResult(result);
          if (credential?.accessToken) {
            setGoogleAccessToken(credential.accessToken);
          }
        }
      })
      .catch((error) => {
        sessionStorage.removeItem("auth_redirect_pending");
        console.error("Redirect result error:", error);
        // Don't show error for "no redirect result" -- that's normal on fresh page loads
        if (error.code !== "auth/popup-closed-by-user") {
          setState((prev) => ({
            ...prev,
            error: getErrorMessage(error.code),
            signInLoading: false,
          }));
        }
      });
  }, []);

  const signIn = useCallback(async () => {
    setState((prev) => ({ ...prev, signInLoading: true, error: null }));

    // On mobile, go straight to redirect -- popups are almost always blocked
    if (isMobileDevice()) {
      try {
        sessionStorage.setItem("auth_redirect_pending", "true");
        await signInWithRedirect(auth, googleProvider);
        return; // Page will reload after redirect
      } catch (error: unknown) {
        const firebaseError = error as { code?: string; message?: string };
        console.error("Redirect sign-in error:", firebaseError);
        sessionStorage.removeItem("auth_redirect_pending");
        setState((prev) => ({
          ...prev,
          error: getErrorMessage(firebaseError.code),
          signInLoading: false,
        }));
      }
      return;
    }

    // Desktop: try popup first, fall back to redirect
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setGoogleAccessToken(credential.accessToken);
      }
    } catch (error: unknown) {
      const firebaseError = error as { code?: string; message?: string };
      console.error("Sign in error:", firebaseError);

      // If popup was blocked or closed, fall back to redirect
      if (
        firebaseError.code === "auth/popup-blocked" ||
        firebaseError.code === "auth/popup-closed-by-user" ||
        firebaseError.code === "auth/cancelled-popup-request"
      ) {
        try {
          sessionStorage.setItem("auth_redirect_pending", "true");
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectError) {
          console.error("Redirect fallback failed:", redirectError);
          sessionStorage.removeItem("auth_redirect_pending");
        }
      }

      setState((prev) => ({
        ...prev,
        error: getErrorMessage(firebaseError.code),
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

function getErrorMessage(code?: string): string {
  switch (code) {
    case "auth/popup-blocked":
      return "Popup was blocked. Trying redirect...";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Sign-in was cancelled.";
    case "auth/unauthorized-domain":
      return "This domain is not authorized for sign-in. Contact the app owner.";
    case "auth/network-request-failed":
      return "Network error. Check your connection.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again later.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    case "auth/internal-error":
      return "Something went wrong. Please try again.";
    case "auth/operation-not-allowed":
      return "Google sign-in is not enabled for this app.";
    case "auth/credential-already-in-use":
      return "This account is already linked to another user.";
    default:
      return `Sign-in failed (${code || "unknown"}). Please try again.`;
  }
}
