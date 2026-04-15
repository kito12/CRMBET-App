"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export type UserRole = "admin" | "agent";

export interface AuthUser {
  uid:   string;
  email: string;
  name:  string;
  role:  UserRole;
}

interface AuthContextType {
  user:    AuthUser | null;
  loading: boolean;
  signIn:  (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// Emails that always receive admin role (set in .env.local)
function isAdminEmail(email: string) {
  const list = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
    .split(",")
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userRef  = doc(db, "users", firebaseUser.uid);
        const userSnap = await getDoc(userRef);
        const email    = firebaseUser.email ?? "";
        const role: UserRole = isAdminEmail(email) ? "admin" : "agent";

        if (!userSnap.exists()) {
          // First sign-in — create the user document
          const name = firebaseUser.displayName ?? email.split("@")[0];
          await setDoc(userRef, {
            uid:       firebaseUser.uid,
            email,
            name,
            role,
            createdAt: serverTimestamp(),
            active:    true,
          });
          setUser({ uid: firebaseUser.uid, email, name, role });
        } else {
          const data = userSnap.data();
          // Always enforce admin role for emails on the allow-list
          const resolvedRole: UserRole = isAdminEmail(email) ? "admin" : (data.role as UserRole ?? "agent");
          if (isAdminEmail(email) && data.role !== "admin") {
            await setDoc(userRef, { role: "admin" }, { merge: true });
          }
          setUser({
            uid:   firebaseUser.uid,
            email: data.email ?? email,
            name:  data.name  ?? email.split("@")[0],
            role:  resolvedRole,
          });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
