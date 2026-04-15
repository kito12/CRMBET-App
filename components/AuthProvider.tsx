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
      if (firebaseUser) {
        const userRef  = doc(db, "users", firebaseUser.uid);
        const userSnap = await getDoc(userRef);
        const email    = firebaseUser.email ?? "";
        const role: UserRole = isAdminEmail(email) ? "admin" : "agent";
        const name  = firebaseUser.displayName ?? email.split("@")[0];
        const photo = firebaseUser.photoURL ?? undefined;

        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid: firebaseUser.uid, email, name, role, photo: photo ?? null,
            createdAt: serverTimestamp(), active: true,
          });
          setUser({ uid: firebaseUser.uid, email, name, role, photo });
        } else {
          const data = userSnap.data();
          const resolvedRole: UserRole = isAdminEmail(email) ? "admin" : (data.role as UserRole ?? "agent");
          if (isAdminEmail(email) && data.role !== "admin") {
            await setDoc(userRef, { role: "admin" }, { merge: true });
          }
          // Keep name/photo fresh from Google
          await setDoc(userRef, { name, photo: photo ?? null }, { merge: true });
          setUser({
            uid:   firebaseUser.uid,
            email: data.email ?? email,
            name,
            role:  resolvedRole,
            photo,
          });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
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
