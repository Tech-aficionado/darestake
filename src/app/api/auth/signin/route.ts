import { NextRequest, NextResponse } from "next/server";

/**
 * This page is opened in a Chrome Custom Tab / real browser from the PWA.
 * It performs Google sign-in via Firebase, stores the credential,
 * and redirects back to the PWA with a success flag.
 * 
 * The PWA and this page share the same origin (darestake-sigma.vercel.app)
 * so localStorage is shared between them.
 */
export async function GET(request: NextRequest) {
  const returnUrl = request.nextUrl.searchParams.get("return") || "/";
  
  // Serve an HTML page that does Firebase auth and stores the result
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>DareStake - Sign In</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      background: #0D0D0D; 
      color: white; 
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100dvh;
      padding: 20px;
    }
    .container {
      text-align: center;
      max-width: 320px;
    }
    h1 { font-size: 24px; margin-bottom: 8px; }
    p { color: rgba(255,255,255,0.5); font-size: 14px; margin-bottom: 24px; }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 14px 28px;
      background: #FF6B35;
      color: black;
      font-weight: 700;
      font-size: 16px;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      width: 100%;
      justify-content: center;
    }
    .btn:disabled { opacity: 0.5; }
    .status {
      margin-top: 16px;
      font-size: 13px;
      color: rgba(255,255,255,0.4);
    }
    .error { color: #ff6b6b; margin-top: 12px; font-size: 13px; }
    .success { color: #4ade80; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔥 DareStake</h1>
    <p>Sign in with your Google account</p>
    <button class="btn" id="signInBtn" onclick="doSignIn()">
      <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
      Sign in with Google
    </button>
    <div class="status" id="status"></div>
  </div>

  <script type="module">
    import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
    import { getAuth, signInWithPopup, GoogleAuthProvider, browserLocalPersistence, setPersistence } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

    const firebaseConfig = {
      apiKey: "${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}",
      authDomain: "${process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}",
      projectId: "${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}",
      storageBucket: "${process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}",
      messagingSenderId: "${process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID}",
      appId: "${process.env.NEXT_PUBLIC_FIREBASE_APP_ID}",
    };

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    await setPersistence(auth, browserLocalPersistence);

    window.doSignIn = async function() {
      const btn = document.getElementById("signInBtn");
      const status = document.getElementById("status");
      btn.disabled = true;
      btn.textContent = "Signing in...";
      status.textContent = "Opening Google sign-in...";
      status.className = "status";

      try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        
        status.textContent = "✓ Signed in as " + result.user.displayName;
        status.className = "status success";
        btn.textContent = "Done! Returning to app...";

        // The auth state is now in localStorage on this origin.
        // The PWA shares the same origin, so onAuthStateChanged will pick it up.
        // Close this tab/window after a moment.
        setTimeout(() => {
          // Try to close this tab (works if opened via window.open)
          window.close();
          // If close doesn't work (not opened via JS), redirect back
          setTimeout(() => {
            window.location.href = "${returnUrl}";
          }, 500);
        }, 1500);
      } catch (err) {
        console.error("Auth error:", err);
        btn.disabled = false;
        btn.textContent = "Try Again";
        status.innerHTML = '<div class="error">Error: ' + (err.code || err.message || "unknown") + '</div>';
      }
    };

    // Auto-trigger sign-in on load
    doSignIn();
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html" },
  });
}
