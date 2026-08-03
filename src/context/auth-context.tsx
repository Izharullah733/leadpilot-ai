"use client";

import { createContext, useContext } from "react";
import type { AuthContext } from "@/lib/auth";

const AuthContextValue = createContext<AuthContext | null>(null);

export function AuthProvider({
  value,
  children,
}: {
  value: AuthContext;
  children: React.ReactNode;
}) {
  return (
    <AuthContextValue.Provider value={value}>
      {children}
    </AuthContextValue.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContextValue);
  if (!context) {
    throw new Error("useAuthContext must be used inside AuthProvider.");
  }
  return context;
}
