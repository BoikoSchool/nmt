"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { handleSignInWithGoogle } from "@/lib/auth";
import { useSupabaseAuth } from "@/supabase/client-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Chrome, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function getDisplayName(user: any) {
  return (
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email ||
    "користувач"
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { user, isLoading } = useSupabaseAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const { toast } = useToast();
  const didWelcomeToastRef = useRef(false);

  useEffect(() => {
    if (isLoading) return;

    // Якщо залогінений — поки що ведемо на /student
    // (ролі перенесемо пізніше в Postgres таблицю profiles/users)
    if (user) {
      if (!didWelcomeToastRef.current) {
        didWelcomeToastRef.current = true;

        toast({
          title: "Вхід успішний!",
          description: `Вітаємо, ${getDisplayName(user)}!`,
        });
      }

      router.push("/student");
    }
  }, [user, isLoading, router, toast]);

  const onSignIn = async () => {
    setIsSigningIn(true);
    try {
      await handleSignInWithGoogle();
      toast({
        title: "Відкриваю Google…",
        description: "Зараз буде перенаправлення на авторизацію.",
      });
      // Далі буде redirect на Google і повернення назад
    } catch (error) {
      console.error("Google Sign-In Error:", error);
      toast({
        variant: "destructive",
        title: "Помилка входу",
        description: "Не вдалося увійти через Google. Спробуйте ще раз.",
      });
      setIsSigningIn(false);
    }
  };

  // Поки визначається сесія або йде sign-in
  if (isLoading || isSigningIn) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </main>
    );
  }

  // Якщо не залогінений — показуємо сторінку логіну
  if (!user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4 sm:p-8">
        <div className="w-full max-w-md text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl font-headline">
            НМТ Demo
          </h1>
          <p className="mt-4 max-w-2xl mx-auto text-lg text-muted-foreground">
            Платформа для підготовки до національного мультипредметного тесту.
          </p>

          <Card className="mt-12 text-left">
            <CardHeader>
              <CardTitle>Вхід в систему</CardTitle>
              <CardDescription>
                Для доступу до платформи, будь ласка, увійдіть за допомогою
                вашого Google акаунта.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={onSignIn}
                className="w-full"
                disabled={isSigningIn}
              >
                {isSigningIn ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Chrome className="mr-2 h-4 w-4" />
                )}
                Увійти через Google
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  // Якщо user вже є, але ще не встигли заредіректити
  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <Loader2 className="h-16 w-16 animate-spin text-primary" />
    </main>
  );
}
