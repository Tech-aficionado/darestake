import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, UserCredential, browserLocalPersistence, setPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);

// CRITICAL: Use localStorage persistence instead of IndexedDB.
// IndexedDB fails with "Database is closing/hidden" in PWA standalone mode
// on Android Chrome. localStorage is reliable in all contexts.
if (typeof window !== "undefined") {
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn("Failed to set auth persistence:", err);
  });
}

export const googleProvider = new GoogleAuthProvider();

// NOTE: Drive scope is NOT added to the default provider.
// It's requested on-demand only when user uploads a photo proof.

export const db = getFirestore(app);

// Store the Google access token from sign-in for Drive API calls
let _googleAccessToken: string | null = null;

export function setGoogleAccessToken(token: string | null) {
  _googleAccessToken = token;
}

/**
 * Get the current Google OAuth access token for Drive API calls.
 * If no token is cached, triggers a re-auth popup to get a fresh one.
 */
export async function getGoogleAccessToken(): Promise<string | null> {
  if (_googleAccessToken) return _googleAccessToken;

  try {
    const provider = new GoogleAuthProvider();
    provider.addScope("https://www.googleapis.com/auth/drive.file");
    const result: UserCredential = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      _googleAccessToken = credential.accessToken;
      return _googleAccessToken;
    }
  } catch (error) {
    console.error("Failed to get Google access token:", error);
  }

  return null;
}

export default app;
