import { NextRequest } from "next/server";
import { adminAuth, adminDb } from "./firebase-admin";

export type AuthedUser = {
  uid: string;
  email: string | undefined;
  role: "admin" | "agent" | "unknown";
};

/**
 * Verifies the Firebase ID token from the Authorization: Bearer <token> header.
 * Returns the decoded user + role lookup. Throws on missing/invalid token.
 */
export async function verifyAuth(req: NextRequest): Promise<AuthedUser> {
  const auth = req.headers.get("authorization") ?? "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new Error("Missing Authorization header");
  const token = match[1];

  const decoded = await adminAuth().verifyIdToken(token);
  const uid = decoded.uid;

  // Role comes from /users/{uid}.role in Firestore.
  let role: AuthedUser["role"] = "unknown";
  try {
    const snap = await adminDb().doc(`users/${uid}`).get();
    const data = snap.data();
    if (data?.role === "admin") role = "admin";
    else if (data?.role === "agent") role = "agent";
  } catch {
    // leave as unknown
  }

  return { uid, email: decoded.email, role };
}

export async function requireAdmin(req: NextRequest): Promise<AuthedUser> {
  const user = await verifyAuth(req);
  if (user.role !== "admin") throw new Error("Admin role required");
  return user;
}
