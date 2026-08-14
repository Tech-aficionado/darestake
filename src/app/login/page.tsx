"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  browserLocalPersistence,
  setPersistence,
} from "firebase/auth";
import { auth, googleProvider, setGoogleAccessToken } from "@/lib/firebase";

/**
 * Dedicated login page.
 * 
 * Strategy:
 * 1. On mount, check if we already have a user (redirect result or cached)
 * 2. If not, immediately trigger signInWithRedirect (no popup, no new tab)
 * 3. When Google auth completes, the browser redirects BACK here
 * 4. getRedirectResult picks up the credential
 * 5. We redirect to /dashboard
 * 
 * This works in PWA because:
 * - No popup (blocked in standalone)
 * - No window.open (blocked in standalone) 
 * - The redirect happens IN the same window/webview
 * - Firebase's /__/auth/handler runs on authDomain then redirects back here
 */
export default function LoginPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "redirecting" | "processing" | "error">("checking");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [attempted, setAttempted] = useState(false);

  // Step 1: Check if user is already authenticated
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Already signed in -- go to dashboard
        router.replace("/dashboard");
      }
    });
    return () => unsubscribe();
  }, [router]);

  // Step 2: Handle redirect result (runs when returning from Google)
  useEffect(() => {
    async function handleRedirect() {
      try {
        // Ensure localStorage persistence
        await setPersistence(auth, browserLocalPersistence);
        
        const result = await getRedirectResult(auth);
        if (result) {
          // Success! We got back from Google with a valid credential
          setStatus("processing");
          const credential = GoogleAuthProvider.credentialFromResult(result);
          if (credential?.accessToken) {
            setGoogleAccessToken(credential.accessToken);
          }
          // onAuthStateChanged will fire and redirect to /dashboard
          return;
        }
        
        // No redirect result means either:
        // a) First visit to this page (haven't redirected yet)
        // b) Something went wrong silently
        // Either way, we should trigger the redirect
        if (!attempted) {
          setAttempted(true);
          triggerAuth();
        }
      } catch (error: unknown) {
        const firebaseError = error as { code?: string; message?: string };
        console.error("Redirect result error:", firebaseError);
        setStatus("error");
        setErrorMsg(`${firebaseError.code || "unknown"}: ${firebaseError.message || ""}`);
      }
    }
    
    handleRedirect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Step 3: Trigger the actual auth
  const triggerAuth = useCallback(async () => {
    setStatus("redirecting");

    try {
      // REDIRECT ONLY -- never popup. This page is the path an installed PWA
      // (Android standalone) is deliberately routed to, and there a popup does
      // not reliably *reject*: Cross-Origin-Opener-Policy blocks the
      // window.closed polling Firebase uses to detect a closed popup, so the
      // signInWithPopup promise can hang forever instead of throwing. A
      // popup-then-catch-then-redirect pattern therefore never reaches the
      // redirect, and the user is stranded on the spinner.
      await signInWithRedirect(auth, googleProvider);
    } catch (error: unknown) {
      const firebaseError = error as { code?: string; message?: string };
      console.error("Auth trigger error:", firebaseError);
      setStatus("error");
      setErrorMsg(`${firebaseError.code || "unknown"}: ${firebaseError.message || ""}`);
    }
  }, []);

  return (
    <div className="min-h-dvh bg-[#0D0D0D] flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        {/* Logo */}
        <div className="inline-flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-full bg-[#FF6B35] flex items-center justify-center text-black font-bold text-sm">D</div>
          <span className="text-white font-bold text-lg">DareStake</span>
        </div>

        {status === "checking" && (
          <>
            <div className="w-10 h-10 mx-auto mb-4 border-3 border-[#FF6B35] border-t-transparent rounded-full animate-spin" />
            <p className="text-white/50 text-sm">Checking authentication...</p>
          </>
        )}

        {status === "redirecting" && (
          <>
            <div className="w-10 h-10 mx-auto mb-4 border-3 border-[#FF6B35] border-t-transparent rounded-full animate-spin" />
            <p className="text-white/80 text-sm font-medium mb-2">Redirecting to Google...</p>
            <p className="text-white/40 text-xs">You&apos;ll be taken to Google to sign in, then brought back here.</p>
          </>
        )}

        {status === "processing" && (
          <>
            <div className="w-10 h-10 mx-auto mb-4 border-3 border-green-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-green-400 text-sm font-medium">Signed in! Redirecting...</p>
          </>
        )}

        {status === "error" && (
          <div>
            <div className="text-4xl mb-4">⚠️</div>
            <p className="text-red-400 text-sm font-medium mb-2">Sign-in failed</p>
            <p className="text-red-400/60 text-xs font-mono break-all mb-6">{errorMsg}</p>
            <button
              onClick={() => {
                setStatus("checking");
                setErrorMsg("");
                setAttempted(false);
                triggerAuth();
              }}
              className="px-6 py-3 rounded-xl bg-[#FF6B35] text-black font-bold text-sm"
            >
              Try Again
            </button>
            <button
              onClick={() => router.push("/")}
              className="block mx-auto mt-3 text-white/40 text-xs underline"
            >
              Back to home
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
