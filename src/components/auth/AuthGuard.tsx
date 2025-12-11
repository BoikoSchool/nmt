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
  const { appUser, isLoading } = useAppUser();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) {
      // Don't do anything while loading
      return;
    }

    if (!appUser) {
      // Not logged in, redirect to login page
      router.push('/login');
      return;
    }

    if (appUser.role !== role) {
      // Logged in, but wrong role. Redirect to their correct dashboard.
      const destination = appUser.role === 'admin' ? '/admin' : '/student';
      router.push(destination);
    }
  }, [appUser, isLoading, router, role]);
  
  // While loading, show a spinner
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  // If user has the correct role, render the children
  if (appUser && appUser.role === role) {
    return <>{children}</>;
  }

  // Otherwise, render nothing (or a spinner) while redirecting
  return (
    <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
    </div>
  );
}
