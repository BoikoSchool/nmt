"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppUser } from '@/hooks/useAppUser';
import { useAuth } from '@/firebase';
import { handleSignOut } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
  role: 'admin' | 'student';
}

export function AuthGuard({ children, role }: AuthGuardProps) {
  const { firebaseUser, appUser, appUserError, firebaseUserError, isLoading } = useAppUser();
  const router = useRouter();
  const auth = useAuth();

  useEffect(() => {
    if (isLoading) {
      // Don't do anything while loading
      return;
    }

    if (!firebaseUser) {
      // Not logged in, redirect to login page
      router.replace('/login');
      return;
    }

    if (appUser && appUser.role !== role) {
      // Logged in, but wrong role. Redirect to their correct dashboard.
      const destination = appUser.role === 'admin' ? '/admin' : '/student';
      router.replace(destination);
    }
  }, [appUser, firebaseUser, isLoading, router, role]);

  const signOutAndGoHome = async () => {
    await handleSignOut(auth);
    router.replace('/');
  };

  if (appUserError || firebaseUserError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Не вдалося завантажити профіль</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>Будь ласка, спробуйте оновити сторінку або увійдіть ще раз.</p>
            <Button onClick={signOutAndGoHome} className="w-full">
              Вийти та повернутися на головну
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // While loading, or if the user doesn't have the right role (and we are about to redirect), show a loader.
  if (isLoading || !firebaseUser || !appUser || appUser.role !== role) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  // If loading is finished and the user has the correct role, render the children
  return <>{children}</>;
}
