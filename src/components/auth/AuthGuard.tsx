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
  const { firebaseUser, appUser, appUserError, firebaseUserError, isLoading } =
    useAppUser();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    // Не залогінений → на /login
    if (!firebaseUser) {
      router.replace("/login");
      return;
    }

    // Якщо профіль (appUser) вже є і роль не та — редіректимо
    // (коли перенесемо profiles/users у Supabase, це запрацює автоматично)
    if (appUser && appUser.role !== role) {
      const destination = appUser.role === "admin" ? "/admin" : "/student";
      router.replace(destination);
    }
  }, [appUser, firebaseUser, isLoading, router, role]);

  const signOutAndGoHome = async () => {
    await handleSignOut();
    router.replace("/");
  };

  if (appUserError || firebaseUserError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Не вдалося завантажити профіль</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>Спробуйте оновити сторінку або увійдіть ще раз.</p>
            <Button onClick={signOutAndGoHome} className="w-full">
              Вийти та повернутися на головну
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Поки вантажиться або поки робимо редірект — спінер
  if (isLoading || !firebaseUser) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  // Тимчасово пропускаємо, навіть якщо appUser ще null (бо ролі ще не перенесені)
  // Коли appUser з’явиться, роль перевіриться у useEffect.
  return <>{children}</>;
}
