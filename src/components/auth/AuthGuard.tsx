"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppUser } from '@/hooks/useAppUser';
import { Loader2 } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
  role: 'admin' | 'student';
}

export function AuthGuard({ children, role }: AuthGuardProps) {
  const { appUser, appUserError, isLoading } = useAppUser();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) {
      // Don't do anything while loading
      return;
    }

    if (!appUser) {
      // Not logged in or profile missing, redirect to login page
      router.push('/login');
      return;
    }

    if (appUser.role !== role) {
      // Logged in, but wrong role. Redirect to their correct dashboard.
      const destination = appUser.role === 'admin' ? '/admin' : '/student';
      router.push(destination);
    }
  }, [appUser, isLoading, router, role]);
  
  // While loading, or if the user doesn't have the right role (and we are about to redirect), show a loader.
  if (isLoading || !appUser || appUser.role !== role) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  // If loading is finished and the user has the correct role, render the children
  return <>{children}</>;
}
