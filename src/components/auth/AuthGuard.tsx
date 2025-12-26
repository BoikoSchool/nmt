"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppUser } from "@/hooks/useAppUser";
import { handleSignOut } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface AuthGuardProps {
  children: React.ReactNode;
  role: "admin" | "student";
}

export function AuthGuard({ children, role }: AuthGuardProps) {
  const { appUser, appUserError, isLoading } = useAppUser();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    // Якщо немає appUser (не залогінений або помилка) → на /login
    if (!appUser) {
      router.replace("/login");
      return;
    }

    // Якщо роль не відповідає → редірект на правильну сторінку
    if (appUser.role !== role) {
      const destination = appUser.role === "admin" ? "/admin" : "/student";
      router.replace(destination);
    }
  }, [appUser, isLoading, router, role]);

  const signOutAndGoHome = async () => {
    await handleSignOut();
    router.replace("/");
  };

  // Показуємо помилку якщо не вдалося завантажити профіль
  if (appUserError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Не вдалося завантажити профіль</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Спробуйте оновити сторінку або увійдіть ще раз.
            </p>
            <p className="text-sm text-destructive">{appUserError}</p>
            <Button onClick={signOutAndGoHome} className="w-full">
              Вийти та повернутися на головну
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Показуємо лоадер якщо:
  // 1. Завантажується автентифікація
  // 2. Завантажується профіль
  // 3. Немає appUser (редірект в процесі)
  if (isLoading || !appUser) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  // Якщо роль не відповідає - показуємо лоадер (редірект в процесі через useEffect)
  if (appUser.role !== role) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  // ✅ Тепер точно є appUser з правильною роллю
  return <>{children}</>;
}
