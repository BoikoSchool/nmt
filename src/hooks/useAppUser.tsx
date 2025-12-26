"use client";

import { useEffect, useMemo, useState, useRef } from "react";
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
  created_at: string;
};

export const useAppUser = () => {
  const { user, isLoading: isAuthLoading } = useSupabaseAuth();

  const [appUser, setAppUser] = useState<AppUserProfile | null>(null);
  const [appUserError, setAppUserError] = useState<string | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(false);

  // Зберігаємо попередній userId для порівняння
  const prevUserIdRef = useRef<string | null>(null);

  // Мемоізуємо firebaseUser щоб уникнути зайвих ре-рендерів
  const firebaseUser: FirebaseLikeUser | null = useMemo(() => {
    if (!user) return null;

    return {
      uid: user.id,
      email: user.email ?? null,
      displayName:
        (user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.name as string | undefined) ??
        null,
    };
  }, [user?.id, user?.email, user?.user_metadata]);

  useEffect(() => {
    let cancelled = false;
    let retryCount = 0;
    const maxRetries = 3;

    async function loadProfile() {
      // Чекаємо завершення автентифікації
      if (isAuthLoading) {
        return;
      }

      // Якщо користувач розлогінився
      if (!user) {
        if (prevUserIdRef.current !== null) {
          // Користувач тільки що розлогінився
          setAppUser(null);
          setAppUserError(null);
          setIsProfileLoading(false);
          prevUserIdRef.current = null;
        }
        return;
      }

      // Якщо той самий користувач - не перезавантажуємо
      if (prevUserIdRef.current === user.id && appUser?.id === user.id) {
        return;
      }

      prevUserIdRef.current = user.id;
      setIsProfileLoading(true);
      setAppUserError(null);

      // Retry логіка для мережевих збоїв
      while (retryCount <= maxRetries && !cancelled) {
        try {
          const { data, error } = await supabase
            .from("profiles")
            .select("id,email,full_name,role,class,created_at")
            .eq("id", user.id)
            .maybeSingle();

          if (cancelled) return;

          if (error) {
            // Якщо це мережева помилка - пробуємо ще раз
            if (
              retryCount < maxRetries &&
              (error.message.includes("network") ||
                error.message.includes("timeout") ||
                error.message.includes("fetch"))
            ) {
              retryCount++;
              await new Promise((resolve) =>
                setTimeout(resolve, 1000 * retryCount)
              );
              continue;
            }

            setAppUser(null);
            setAppUserError(error.message);
            setIsProfileLoading(false);
            return;
          }

          if (!data) {
            // Профіль не знайдено - можливо ще не створився через тригер
            // Чекаємо трошки і пробуємо ще раз
            if (retryCount < maxRetries) {
              retryCount++;
              await new Promise((resolve) =>
                setTimeout(resolve, 500 * retryCount)
              );
              continue;
            }

            setAppUser(null);
            setAppUserError(
              "Профіль не знайдено в profiles. Перевір бекфілл/тригер на auth.users."
            );
            setIsProfileLoading(false);
            return;
          }

          // Успішно завантажили профіль
          setAppUser(data as AppUserProfile);
          setIsProfileLoading(false);
          return;
        } catch (err) {
          if (cancelled) return;

          console.error("Profile load error:", err);

          if (retryCount < maxRetries) {
            retryCount++;
            await new Promise((resolve) =>
              setTimeout(resolve, 1000 * retryCount)
            );
            continue;
          }

          setAppUser(null);
          setAppUserError("Не вдалося завантажити профіль");
          setIsProfileLoading(false);
          return;
        }
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [user?.id, isAuthLoading]);

  return useMemo(() => {
    // isLoading має бути true якщо:
    // 1. Автентифікація ще завантажується
    // 2. Або профіль завантажується
    // 3. Або є user але немає appUser (ще завантажується)
    const isLoading =
      isAuthLoading ||
      isProfileLoading ||
      (!!user && !appUser && !appUserError);

    return {
      firebaseUser,
      appUser,
      firebaseUserError: null,
      appUserError,
      isLoading,
      isAdmin: appUser?.role === "admin",
    };
  }, [
    firebaseUser,
    appUser,
    appUserError,
    isAuthLoading,
    isProfileLoading,
    user,
  ]);
};
