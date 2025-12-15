"use client";

import { useMemo } from 'react';
import { doc } from 'firebase/firestore';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import type { AppUser } from '@/lib/types';

/**
 * Custom hook to get both Firebase user and application-specific user data.
 * @returns An object containing the Firebase user, the app user data from Firestore,
 * and a loading state.
 */
export const useAppUser = () => {
  const { user: firebaseUser, isUserLoading: isFirebaseUserLoading } = useUser();
  const firestore = useFirestore();

  // Create a memoized reference to the user document in Firestore
  const userDocRef = useMemoFirebase(() => {
    if (firebaseUser) {
      return doc(firestore, 'users', firebaseUser.uid);
    }
    return null; // No user, so no doc ref
  }, [firestore, firebaseUser]);

  // Use the useDoc hook to fetch the app-specific user data
  const { data: appUser, isLoading: isAppUserLoading, error: appUserError } = useDoc<AppUser>(userDocRef);

  // Loading is true while Firebase auth resolves or while the app-user document is being fetched.
  const isLoading = isFirebaseUserLoading || isAppUserLoading;

  return {
    firebaseUser,
    appUser,
    appUserError,
    isLoading,
  };
};
