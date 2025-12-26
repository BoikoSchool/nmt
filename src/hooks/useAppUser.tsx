"use client";

import { useEffect, useMemo, useState } from "react";
import { useSupabaseAuth } from "@/supabase/client-provider";
import { supabase } from "@/lib/supabaseClient";

type FirebaseLikeUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
};

export type AppUserProfile = {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "student";
  class: string | null;
  created_at: string; // timestamptz з Postgres
};

export const useAppUser = () => {
  const { user, isLoading: isAuthLoading } = useSupabaseAuth();

  const [appUser, setAppUser] = useState<AppUserProfile | null>(null);
  const [appUserError, setAppUserError] = useState<string | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(false);

  // лишаємо це ім’я, щоб не ламати компоненти (як і було в тебе)
  const firebaseUser: FirebaseLikeUser | null = user
    ? {
        uid: user.id,
        email: user.email ?? null,
        displayName:
          (user.user_metadata?.full_name as string | undefined) ??
          (user.user_metadata?.name as string | undefined) ??
          null,
      }
    : null;

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      if (isAuthLoading) return;

      // якщо розлогінились
      if (!user) {
        setAppUser(null);
        setAppUserError(null);
        return;
      }

      setIsProfileLoading(true);
      setAppUserError(null);

      const { data, error } = await supabase
        .from("profiles")
        .select("id,email,full_name,role,class,created_at")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        setAppUser(null);
        setAppUserError(error.message);
        setIsProfileLoading(false);
        return;
      }

      if (!data) {
        // Це означає: або не спрацював бекфілл/тригер, або користувач ще не створився в profiles
        setAppUser(null);
        setAppUserError(
          "Профіль не знайдено в profiles. Перевір бекфілл/тригер на auth.users."
        );
        setIsProfileLoading(false);
        return;
      }

      setAppUser(data as AppUserProfile);
      setIsProfileLoading(false);
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [user?.id, isAuthLoading]);

  return useMemo(() => {
    const isLoading = isAuthLoading || isProfileLoading;

    return {
      firebaseUser, // тимчасово
      appUser, // тут вже буде role
      firebaseUserError: null,
      appUserError,
      isLoading,
      isAdmin: appUser?.role === "admin",
    };
  }, [firebaseUser, appUser, appUserError, isAuthLoading, isProfileLoading]);
};
