"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export type UserRole = "admin" | "agent";

export interface AuthUser {
  uid:    string;
  email:  string;
  name:   string;
  role:   UserRole;
  photo?: string;
}

interface AuthContextType {
  user:         AuthUser | null;
  loading:      boolean;
  authError:    string;
  signInGoogle: () => Promise<void>;
  signOut:      () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

function isAdminEmail(email: string) {
  const list = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
    .split(",")
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

async function isInvited(email: string): Promise<boolean> {
  try {
    const q = query(
      collection(db, "invites"),
      where("email", "==", email.toLowerCase())
    );
    const snap = await getDocs(q);
    return !snap.empty;
  } catch {
    return false;
  }
}

const googleProvider = new GoogleAuthProvider();

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,      setUser]      = useState<AuthUser | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          const email = firebaseUser.email ?? "";
          const name  = firebaseUser.displayName ?? email.split("@")[0];
          const photo = firebaseUser.photoURL ?? undefined;

          // Check access: must be admin or invited
          const admin   = isAdminEmail(email);
          const invited = admin ? true : await isInvited(email);

          if (!invited) {
            // Not authorised — sign out immediately
            await firebaseSignOut(auth);
            setAuthError("Your account hasn't been granted access. Contact your administrator.");
            setUser(null);
            return;
          }

          const role: UserRole = admin ? "admin" : "agent";
          setAuthError("");

          try {
            const userRef  = doc(db, "users", firebaseUser.uid);
            const userSnap = await getDoc(userRef);

            if (!userSnap.exists()) {
              await setDoc(userRef, {
                uid: firebaseUser.uid, email, name, role,
                photo: photo ?? null,
                createdAt: serverTimestamp(), active: true,
              });
            } else {
              const data = userSnap.data();
              const resolvedRole: UserRole = admin ? "admin" : (data.role as UserRole ?? "agent");
              await setDoc(userRef, { name, photo: photo ?? null, role: resolvedRole }, { merge: true });
            }
          } catch (err) {
            console.warn("Firestore write failed:", err);
          }

          setUser({ uid: firebaseUser.uid, email, name, role, photo });
        } else {
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  const signInGoogle = useCallback(async () => {
    setAuthError("");
    await signInWithPopup(auth, googleProvider);
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, authError, signInGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
