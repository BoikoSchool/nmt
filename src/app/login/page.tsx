"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/firebase';
import { handleSignInWithGoogle } from '@/lib/auth';
import { useAppUser } from '@/hooks/useAppUser';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Chrome, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function LoginPage() {
  const auth = useAuth();
  const router = useRouter();
  const { appUser, isLoading } = useAppUser();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // If user data is loaded and a user exists, redirect them based on their role
    if (!isLoading && appUser) {
      if (appUser.role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/student');
      }
    }
  }, [appUser, isLoading, router]);

  const onSignIn = async () => {
    if(!auth) return;
    setIsSigningIn(true);
    try {
      const resultUser = await handleSignInWithGoogle(auth);
      if (resultUser) {
        toast({
          title: 'Вхід успішний!',
          description: `Вітаємо, ${resultUser.displayName}!`,
        });
        // The useEffect will handle the redirection after appUser is loaded
      }
    } catch (error) {
      console.error('Google Sign-In Error:', error);
      toast({
        variant: 'destructive',
        title: 'Помилка входу',
        description: 'Не вдалося увійти через Google. Спробуйте ще раз.',
      });
    } finally {
      setIsSigningIn(false);
    }
  };
  
  // While we are determining the user's auth state, show a loader.
  // Also show a loader if a sign-in is in progress.
  if (isLoading || isSigningIn) {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
        </main>
    );
  }

  // If user is not logged in (and not loading), show the login page
  if (!appUser) {
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
                Для доступу до платформи, будь ласка, увійдіть за допомогою вашого Google акаунта.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={onSignIn} className="w-full" disabled={isSigningIn}>
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

  // If we are logged in but just waiting for the redirect, show a spinner.
  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
    </main>
  );
}
