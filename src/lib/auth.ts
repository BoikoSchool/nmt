"use client";

import { supabase } from "@/lib/supabaseClient";

/**
 * Google sign-in через Supabase OAuth.
 * Працює як редірект: відкриє Google, потім поверне назад у застосунок.
 */
export async function handleSignInWithGoogle() {
  const redirectTo = `${window.location.origin}/login`;

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
    },
  });

  if (error) {
    console.error("Supabase Google sign-in error:", error);
    throw error;
  }
}

/**
 * Вихід із системи
 */
export async function handleSignOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("Supabase signOut error:", error);
    throw error;
  }
}
