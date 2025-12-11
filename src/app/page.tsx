"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppUser } from '@/hooks/useAppUser';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const { appUser, isLoading } = useAppUser();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) {
      // Still loading, do nothing yet
      return;
    }

    if (!appUser) {
      // No user, redirect to login
      router.push('/login');
    } else {
      // User found, redirect based on role
      if (appUser.role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/student');
      }
    }
  }, [appUser, isLoading, router]);

  // Show a loading spinner while we determine the user's state and role
  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <Loader2 className="h-16 w-16 animate-spin text-primary" />
    </main>
  );
}
