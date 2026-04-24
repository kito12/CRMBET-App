import { getApps, initializeApp, cert, App } from "firebase-admin/app";
import { getAuth, Auth } from "firebase-admin/auth";
import { getFirestore, Firestore } from "firebase-admin/firestore";

// Initializes firebase-admin exactly once per runtime.
// Requires FIREBASE_SERVICE_ACCOUNT_JSON env var (stringified service-account JSON).

let app: App | null = null;

function getApp(): App {
  if (app) return app;
  const existing = getApps()[0];
  if (existing) {
    app = existing;
    return app;
  }
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!json) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON env var is not set. " +
        "Download a service-account key from Firebase console → Project settings → Service accounts, " +
        "stringify the JSON, and add it to your .env.local and Vercel env vars."
    );
  }
  let creds: Record<string, unknown>;
  try {
    creds = JSON.parse(json);
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.");
  }
  app = initializeApp({ credential: cert(creds as Parameters<typeof cert>[0]) });
  return app;
}

export function adminAuth(): Auth {
  return getAuth(getApp());
}

export function adminDb(): Firestore {
  return getFirestore(getApp());
}
