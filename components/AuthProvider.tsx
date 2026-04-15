"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
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
  user:          AuthUser | null;
  loading:       boolean;
  signInGoogle:  () => Promise<void>;
  signOut:       () => Promise<void>;
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

const googleProvider = new GoogleAuthProvider();

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          const email = firebaseUser.email ?? "";
          const name  = firebaseUser.displayName ?? email.split("@")[0];
          const photo = firebaseUser.photoURL ?? undefined;
          const role: UserRole = isAdminEmail(email) ? "admin" : "agent";

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
              const resolvedRole: UserRole = isAdminEmail(email) ? "admin" : (data.role as UserRole ?? "agent");
              await setDoc(userRef, { name, photo: photo ?? null, role: resolvedRole }, { merge: true });
            }
          } catch (firestoreErr) {
            // Firestore failed — still sign the user in with basic info
            console.warn("Firestore write failed, using auth data only:", firestoreErr);
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
    await signInWithPopup(auth, googleProvider);
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signInGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
