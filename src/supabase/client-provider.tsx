//src/supabase/client-provider.tsx;
"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

type SupabaseAuthContextValue = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
};

const SupabaseAuthContext = createContext<SupabaseAuthContextValue | null>(
  null
);

export function SupabaseClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) console.error("Supabase getSession error:", error);
        setSession(data.session ?? null);
        setIsLoading(false);
      })
      .catch((err) => {
        if (!mounted) return;
        console.error("Supabase getSession crash:", err);
        setIsLoading(false);
      });

    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      isLoading,
    }),
    [session, isLoading]
  );

  return (
    <SupabaseAuthContext.Provider value={value}>
      {children}
    </SupabaseAuthContext.Provider>
  );
}

export function useSupabaseAuth() {
  const ctx = useContext(SupabaseAuthContext);
  if (!ctx)
    throw new Error(
      "useSupabaseAuth must be used within SupabaseClientProvider"
    );
  return ctx;
}
